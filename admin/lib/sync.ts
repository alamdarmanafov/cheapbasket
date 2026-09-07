import { adminDb } from './server';
import { buildMatcher, fetchAnySource } from './wolt';
import { notifyRecentDrops } from './alerts';

export interface SyncSource { id: string; store_id: string; url: string; name: string | null; enabled: boolean; last_run_at: string | null; last_result: SyncResult | null }
export interface SyncResult { ok: boolean; venue?: string; found: number; matched: number; updated: number; unchanged: number; removed: number; photos?: number; error?: string; at: string }

/** Re-read one Wolt venue and update prices of products we already have (never creates products). */
export async function syncSource(src: { id: string; store_id: string; url: string }): Promise<SyncResult> {
  const db = adminDb();
  const at = new Date().toISOString();
  try {
    const venue = await fetchAnySource(src.url);
    const [{ data: products }, { data: prices }] = await Promise.all([
      db.from('products').select('id, barcode, brand, name, size, image_url'),
      db.from('prices').select('product_id, price, discount_price').eq('store_id', src.store_id),
    ]);
    const match = buildMatcher(products ?? []);
    const current = new Map((prices ?? []).map((p) => [p.product_id, { price: Number(p.price), discount: p.discount_price == null ? null : Number(p.discount_price) }]));
    const next = new Map<string, { price: number; discount: number | null }>();
    const noPhoto = new Set((products ?? []).filter((p) => !p.image_url).map((p) => p.id));
    const photos = new Map<string, string>();
    let matched = 0;
    for (const it of venue.items) {
      if (it.price == null) continue;
      const id = match(it);
      if (!id) continue;
      matched++;
      if (it.image_url && noPhoto.has(id) && !photos.has(id)) photos.set(id, it.image_url);
      const cand = { price: it.regular_price ?? it.price, discount: it.regular_price != null ? it.price : null };
      const prev = next.get(id);
      const eff = (x: { price: number; discount: number | null }) => x.discount ?? x.price;
      if (!prev || eff(cand) < eff(prev)) next.set(id, cand);
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
    // Products without a photo get the Wolt photo (existing photos are never replaced).
    for (const [id, image_url] of photos) await db.from('products').update({ image_url }).eq('id', id);
    const result: SyncResult = { ok: true, venue: venue.venue, found: venue.items.length, matched, updated: rows.length, unchanged, removed: 0, photos: photos.size, at };
    await db.from('import_sources').update({ last_run_at: at, last_result: result, name: venue.venue || null }).eq('id', src.id);
    return result;
  } catch (e) {
    const result: SyncResult = { ok: false, found: 0, matched: 0, updated: 0, unchanged: 0, removed: 0, error: e instanceof Error ? e.message : String(e), at };
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
