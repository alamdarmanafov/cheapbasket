import { adminDb, fetchAll } from './server';
import { buildMatcher, fetchAnySource, WoltItem, MatchableProduct } from './wolt';
import { notifyRecentDrops } from './alerts';
import { slugify } from './supabase';

export interface SyncSource { id: string; store_id: string; url: string; name: string | null; enabled: boolean; last_run_at: string | null; last_result: SyncResult | null }
export interface SyncResult { ok: boolean; venue?: string; found: number; matched: number; created: number; updated: number; unchanged: number; removed: number; pending: number; photos?: number; error?: string; at: string }

function itemToProduct(it: WoltItem, brand: string) {
  const base = slugify(it.name);
  const id = base || 'product-' + it.ext_id;
  return { id, name: it.name, brand, barcode: it.barcode ?? null, size: '', image_url: it.image_url ?? null };
}

/** Re-read one Wolt venue, queue new products for review, and upsert prices for existing products. */
export async function syncSource(src: { id: string; store_id: string; url: string }): Promise<SyncResult> {
  const db = adminDb();
  const at = new Date().toISOString();
  try {
    const venue = await fetchAnySource(src.url);
    const [products, prices, pendingData] = await Promise.all([
      fetchAll<{ id: string; barcode: string | null; brand: string; name: string; size: string; image_url: string | null }>(
        (from, to) => db.from('products').select('id, barcode, brand, name, size, image_url').range(from, to)
      ),
      fetchAll<{ product_id: string; price: unknown; discount_price: unknown }>(
        (from, to) => db.from('prices').select('product_id, price, discount_price').eq('store_id', src.store_id).range(from, to)
      ),
      fetchAll<{ id: string }>(
        (from, to) => db.from('pending_products').select('id').range(from, to)
      ),
    ]);
    const productList: MatchableProduct[] = products;
    const match = buildMatcher(productList);
    const current = new Map(prices.map((p) => [p.product_id, { price: Number(p.price), discount: p.discount_price == null ? null : Number(p.discount_price) }]));
    const next = new Map<string, { price: number; discount: number | null }>();
    const noPhoto = new Set(products.filter((p) => !p.image_url).map((p) => p.id));
    const photos = new Map<string, string>();

    const productIds = new Set(products.map((p) => p.id));
    const pendingIds = new Set(pendingData.map((p) => p.id));
    const pendingInserts: Record<string, unknown>[] = [];

    const brand = venue.venue || '';
    let matched = 0;

    for (const it of venue.items) {
      if (it.price == null) continue;
      const matchedId = match(it);
      if (!matchedId) {
        // Queue unmatched items for admin review (AI matching runs separately via /api/ai/match-pending)
        const np = itemToProduct(it, brand);
        if (!productIds.has(np.id) && !pendingIds.has(np.id)) {
          pendingInserts.push({
            id: np.id, name: np.name, brand: np.brand, barcode: np.barcode, size: np.size,
            image_url: np.image_url ?? it.image_url ?? null, category: it.category ?? null,
            store_id: src.store_id, source_name: brand || null,
          });
          pendingIds.add(np.id);
        }
        continue;
      }
      matched++;
      if (it.image_url && noPhoto.has(matchedId) && !photos.has(matchedId)) photos.set(matchedId, it.image_url);
      const cand = { price: it.regular_price ?? it.price, discount: it.regular_price != null ? it.price : null };
      const prev = next.get(matchedId);
      const eff = (x: { price: number; discount: number | null }) => x.discount ?? x.price;
      if (!prev || eff(cand) < eff(prev)) next.set(matchedId, cand);
    }

    // Insert new pending products in batches
    let pending = 0;
    for (let i = 0; i < pendingInserts.length; i += 200) {
      const batch = pendingInserts.slice(i, i + 200);
      const { error } = await db.from('pending_products').upsert(batch, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw error;
      pending += batch.length;
    }

    const rows: Record<string, unknown>[] = [];
    let unchanged = 0;
    for (const [id, v] of next) {
      const cur = current.get(id);
      if (cur && cur.price === v.price && cur.discount === v.discount) { unchanged++; continue; }
      rows.push({ product_id: id, store_id: src.store_id, price: v.price, discount_price: v.discount, updated_at: at });
    }
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await db.from('prices').upsert(rows.slice(i, i + 200), { onConflict: 'product_id,store_id' });
      if (error) throw error;
    }

    // Write price history for changed prices
    if (rows.length > 0) {
      const historyRows = rows.map((r) => ({ ...r, recorded_at: at }));
      for (let i = 0; i < historyRows.length; i += 200) {
        await db.from('price_history').insert(historyRows.slice(i, i + 200)).then(() => {}, () => {});
      }
    }

    // Fill photos for existing products that had none
    for (const [id, image_url] of photos) await db.from('products').update({ image_url }).eq('id', id).is('image_url', null);
    const result: SyncResult = { ok: true, venue: venue.venue, found: venue.items.length, matched, created: 0, updated: rows.length, unchanged, removed: 0, pending, photos: photos.size, at };
    await db.from('import_sources').update({ last_run_at: at, last_result: result, name: venue.venue || null }).eq('id', src.id);
    return result;
  } catch (e) {
    const result: SyncResult = { ok: false, found: 0, matched: 0, created: 0, updated: 0, unchanged: 0, removed: 0, pending: 0, error: e instanceof Error ? e.message : String(e), at };
    await db.from('import_sources').update({ last_run_at: at, last_result: result }).eq('id', src.id);
    return result;
  }
}

/** Run every enabled source (or one), then push instant alerts for the drops this run produced. */
export async function runSync(opts: { onlyId?: string; notify?: boolean } = {}) {
  const db = adminDb();
  const started = new Date(Date.now() - 60_000).toISOString();
  let q = db.from('import_sources').select('id, store_id, url, enabled');
  if (opts.onlyId) q = q.eq('id', opts.onlyId);
  else q = q.eq('enabled', true);
  const { data: sources } = await q;
  const results: Array<{ id: string; store_id: string } & SyncResult> = [];
  for (const s of sources ?? []) results.push({ id: s.id, store_id: s.store_id, ...(await syncSource(s)) });
  const alerts = opts.notify === false ? null : await notifyRecentDrops(started);
  return { results, alerts };
}
