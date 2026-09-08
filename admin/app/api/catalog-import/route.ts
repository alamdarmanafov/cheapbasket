import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';
import { buildMatcher, MatchableProduct } from '@/lib/wolt';
import { slugify } from '@/lib/supabase';

export const maxDuration = 120;

interface PageProduct {
  name: string;
  price: number | null;
  old_price: number | null;
  unit?: string;
}

interface ExtractedProduct extends PageProduct {
  page: number;
}

/**
 * POST /api/catalog-import
 * Body: { store_id: string; market_name: string; pages: string[] }
 *   pages: array of base64-encoded JPEG images (one per PDF page)
 * Returns: { products: ExtractedProduct[]; matched: MatchedProduct[]; unmatched: ExtractedProduct[] }
 */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: 'OPENAI_API_KEY yoxdur' }, { status: 500 });

  const body = (await req.json()) as { store_id: string; market_name: string; pages: string[] };
  const { store_id, market_name, pages } = body;
  if (!store_id || !pages?.length) return NextResponse.json({ error: 'store_id və pages tələb olunur' }, { status: 400 });

  const db = adminDb();
  const { data: products } = await db.from('products').select('id, barcode, brand, name, size');
  const productList: MatchableProduct[] = products ?? [];
  const match = buildMatcher(productList);

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o';
  const systemPrompt = `You are a grocery price extractor for an Azerbaijani supermarket catalog.
Extract ALL product entries visible on this catalog page.
For each product return:
- name: full product name as shown (include brand, variant, size)
- price: current selling price as a number (AZN)
- old_price: crossed-out / before-discount price if shown, else null
- unit: "kg", "l", "ədəd" if shown, else null

Return a JSON object with a "products" array:
{"products":[{"name":"...","price":1.99,"old_price":null,"unit":null},...]}
If no products are visible, return {"products":[]}.`;

  const allExtracted: ExtractedProduct[] = [];

  // Process pages sequentially to avoid rate limits
  for (let i = 0; i < pages.length; i++) {
    const b64 = pages[i];
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: `Market: ${market_name}. Extract all products from this catalog page.` },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' } },
              ],
            },
          ],
          temperature: 0,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        }),
      });
      const j = await res.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } };
      if (!res.ok) { allExtracted.push({ name: `[API xəta: ${j.error?.message ?? res.status}]`, price: 0, old_price: null, page: i + 1 }); continue; }
      let parsed: PageProduct[] = [];
      try {
        const raw = JSON.parse(j.choices![0].message.content);
        parsed = Array.isArray(raw) ? raw : (raw.products ?? raw.items ?? []);
      } catch { continue; }
      for (const p of parsed) {
        if (!p.name || p.price == null) continue;
        allExtracted.push({ ...p, page: i + 1 });
      }
    } catch { continue; }
  }

  // Match extracted products against DB
  const matched: Array<ExtractedProduct & { product_id: string; product_name: string }> = [];
  const unmatched: ExtractedProduct[] = [];

  for (const p of allExtracted) {
    const id = match({ name: p.name, barcode: null });
    if (id) {
      const prod = productList.find((x) => x.id === id);
      matched.push({ ...p, product_id: id, product_name: prod ? `${prod.brand} ${prod.name} ${prod.size}`.trim() : id });
    } else {
      unmatched.push(p);
    }
  }

  return NextResponse.json({ extracted: allExtracted.length, matched, unmatched, store_id });
}

/**
 * PUT /api/catalog-import — apply matched prices + queue unmatched to pending_products
 * Body: { store_id: string; items: Array<{ product_id, price, old_price }>; unmatched?: ExtractedProduct[] }
 */
export async function PUT(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const body = (await req.json()) as {
    store_id: string;
    items: Array<{ product_id: string; price: number; old_price: number | null }>;
    unmatched?: Array<{ name: string; price: number; old_price: number | null; unit?: string }>;
  };
  const { store_id, items, unmatched } = body;
  if (!store_id) return NextResponse.json({ error: 'store_id tələb olunur' }, { status: 400 });

  const db = adminDb();
  const at = new Date().toISOString();
  let updated = 0;

  if (items?.length) {
    const rows = items.map((it) => ({
      product_id: it.product_id,
      store_id,
      price: it.old_price ?? it.price,
      discount_price: it.old_price != null ? it.price : null,
      updated_at: at,
    }));
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await db.from('prices').upsert(rows.slice(i, i + 200), { onConflict: 'product_id,store_id' });
      if (error) return NextResponse.json({ error: errText(error) }, { status: 500 });
    }
    const history = rows.map((r) => ({ ...r, recorded_at: at }));
    for (let i = 0; i < history.length; i += 200) {
      await db.from('price_history').insert(history.slice(i, i + 200)).then(() => {}, () => {});
    }
    updated = rows.length;
  }

  // Queue unmatched products into pending_products for review
  let pending = 0;
  if (unmatched?.length) {
    const { data: existing } = await db.from('pending_products').select('id');
    const existingIds = new Set((existing ?? []).map((r: { id: string }) => r.id));
    const pendingRows = unmatched
      .map((u) => ({ id: slugify(u.name), name: u.name, store_id, source_name: null }))
      .filter((r) => r.id && !existingIds.has(r.id));
    for (let i = 0; i < pendingRows.length; i += 200) {
      await db.from('pending_products').insert(pendingRows.slice(i, i + 200)).then(() => {}, () => {});
    }
    pending = pendingRows.length;
  }

  return NextResponse.json({ ok: true, updated, pending });
}
