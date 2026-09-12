import { adminDb, fetchAll } from './server';
import { buildMatcher } from './wolt';

export interface ReceiptLine { name: string; price: number; qty: number }
export interface ReceiptRead { store: string | null; total: number | null; items: ReceiptLine[] }
export interface MatchedLine extends ReceiptLine { product_id: string | null; product_name: string | null }

/**
 * Reads a till receipt: which shop, the total, and every line with its price.
 * Same vision model as the product photo; the prompt asks for the lines as
 * printed, since the matcher does better with the shop's own wording than
 * with a tidied-up guess.
 */
export async function readReceipt(imageBase64: string): Promise<ReceiptRead> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY təyin edilməyib — çek oxuma bağlıdır');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You read supermarket till receipts from Azerbaijan. Reply with JSON: {"store": string|null, "total": number|null, "items": [{"name": string, "price": number, "qty": number}]}. "store" is the shop name printed at the top (e.g. Bravo, Araz, Neptun, Bazarstore, OBA, Rahat). "price" is the unit price in AZN for one piece (if the line shows a quantity and a line total, divide). "qty" defaults to 1. Copy product names as printed. Skip discounts, deposits, bags and totals from the item list. If a value is unreadable, leave it null.',
        },
        { role: 'user', content: [{ type: 'text', text: 'Bu çeki oxu.' }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' } }] },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = j.choices?.[0]?.message?.content ?? '{}';
  const p = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as { store?: unknown; total?: unknown; items?: unknown };
  const items = (Array.isArray(p.items) ? p.items : [])
    .map((it) => {
      const o = (it ?? {}) as { name?: unknown; price?: unknown; qty?: unknown };
      const price = Number(o.price);
      const qty = Math.max(1, Math.round(Number(o.qty) || 1));
      const name = String(o.name ?? '').trim();
      return { name, price: Number.isFinite(price) ? Math.round(price * 100) / 100 : 0, qty };
    })
    .filter((it) => it.name && it.price > 0)
    .slice(0, 80);
  const total = Number(p.total);
  return { store: typeof p.store === 'string' && p.store.trim() ? p.store.trim() : null, total: Number.isFinite(total) ? total : null, items };
}

/** Pairs each receipt line with a catalogue product, by the shared matcher. */
export async function matchReceipt(items: ReceiptLine[]): Promise<MatchedLine[]> {
  const db = adminDb();
  const products = await fetchAll<{ id: string; barcode: string | null; brand: string; name: string; size: string }>((from, to) =>
    db.from('products').select('id, barcode, brand, name, size').range(from, to),
  );
  const match = buildMatcher(products);
  const byId = new Map(products.map((p) => [p.id, `${p.brand} ${p.name} ${p.size}`.trim()]));
  return items.map((it) => {
    const id = match({ name: it.name, barcode: null });
    return { ...it, product_id: id, product_name: id ? byId.get(id) ?? null : null };
  });
}

/** The store whose name the receipt carries, if we know it. */
export async function guessStore(name: string | null): Promise<string | null> {
  if (!name) return null;
  const { data } = await adminDb().from('stores').select('id, name');
  const n = name.toLowerCase();
  const hit = (data ?? []).find((s) => n.includes(String(s.name).toLowerCase()) || n.includes(String(s.id).toLowerCase()));
  return hit ? (hit.id as string) : null;
}
