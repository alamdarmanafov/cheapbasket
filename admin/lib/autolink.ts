import { adminDb, fetchAll } from './server';
import { applyLink, bestMatch, feedItems, prepareItems } from './find';

export interface AutolinkResult { store_id: string; sources: number; items: number; candidates: number; linked: number; queued: number; error?: string }

interface Settings { auto_min: number; queue_min: number; cursor: string | null }

async function settings(): Promise<Settings> {
  const { data } = await adminDb().from('app_settings').select('value').eq('key', 'autolink').maybeSingle();
  const v = (data?.value ?? {}) as Partial<Settings>;
  return { auto_min: Number(v.auto_min ?? 0.85), queue_min: Number(v.queue_min ?? 0.6), cursor: v.cursor ?? null };
}

/**
 * Every product we have no price for at this store, against the store's whole
 * feed, in one pass.
 *
 * A barcode match, or a name so close it is not really a question, links
 * itself and gets the price. The band below that goes to the review queue
 * with both spellings, for the admin to answer. Below the band nothing is
 * kept: a 40% match is two different products.
 *
 * A feed item already linked to another product, or a pair the admin has
 * already refused, is left alone.
 */
export async function autolinkStore(storeId: string): Promise<AutolinkResult> {
  const db = adminDb();
  const cfg = await settings();
  const out: AutolinkResult = { store_id: storeId, sources: 0, items: 0, candidates: 0, linked: 0, queued: 0 };
  try {
    const [{ data: sources }, products, priced, links, decided] = await Promise.all([
      db.from('import_sources').select('url').eq('store_id', storeId).eq('enabled', true),
      fetchAll<{ id: string; brand: string; name: string; size: string; barcode: string | null }>((f, t) => db.from('products').select('id, brand, name, size, barcode').range(f, t)),
      fetchAll<{ product_id: string }>((f, t) => db.from('prices').select('product_id').eq('store_id', storeId).range(f, t)),
      fetchAll<{ ext_id: string; product_id: string }>((f, t) => db.from('product_links').select('ext_id, product_id').eq('store_id', storeId).range(f, t)),
      fetchAll<{ ext_id: string; product_id: string; status: string }>((f, t) => db.from('match_queue').select('ext_id, product_id, status').eq('store_id', storeId).neq('status', 'open').range(f, t)),
    ]);
    const urls = (sources ?? []).map((s) => s.url as string);
    out.sources = urls.length;
    if (!urls.length) return { ...out, error: 'Aktiv mənbə yoxdur' };

    const seen = new Map<string, Awaited<ReturnType<typeof feedItems>>['items'][number]>();
    for (const u of urls) for (const it of (await feedItems(u)).items) if (!seen.has(it.ext_id)) seen.set(it.ext_id, it);
    const feed = prepareItems([...seen.values()]);
    out.items = feed.prepared.length;

    const hasPrice = new Set(priced.map((p) => p.product_id));
    const takenExt = new Set(links.map((l) => l.ext_id));
    const refused = new Set(decided.filter((d) => d.status === 'rejected').map((d) => `${d.ext_id}|${d.product_id}`));
    const todo = products.filter((p) => !hasPrice.has(p.id));
    out.candidates = todo.length;

    const queue: Array<Record<string, unknown>> = [];
    for (const p of todo) {
      const m = bestMatch(p, feed);
      if (!m) continue;
      const item = feed.prepared[m.idx];
      if (takenExt.has(item.it.ext_id)) continue;
      if (m.exactBarcode || m.score >= cfg.auto_min) {
        await applyLink(db, { product_id: p.id, store_id: storeId, ext_id: item.it.ext_id, price: item.it.price as number, regular_price: item.it.regular_price, barcode: item.it.barcode });
        takenExt.add(item.it.ext_id);
        out.linked++;
      } else if (m.score >= cfg.queue_min && !refused.has(`${item.it.ext_id}|${p.id}`)) {
        queue.push({ store_id: storeId, ext_id: item.it.ext_id, product_id: p.id, feed_name: item.it.name, feed_price: item.it.price, feed_regular: item.it.regular_price, feed_barcode: item.it.barcode, score: Number(m.score.toFixed(3)), status: 'open' });
      }
    }
    for (let i = 0; i < queue.length; i += 200) {
      const { error } = await db.from('match_queue').upsert(queue.slice(i, i + 200), { onConflict: 'store_id,ext_id,product_id', ignoreDuplicates: true });
      if (error) throw error;
    }
    out.queued = queue.length;
    return out;
  } catch (e) {
    return { ...out, error: e instanceof Error ? e.message : String(e) };
  }
}

/** The next store in line: one per cron run, round-robin over stores with a feed. */
export async function autolinkNext(): Promise<AutolinkResult | { skipped: true; reason: string }> {
  const db = adminDb();
  const cfg = await settings();
  const { data: sources } = await db.from('import_sources').select('store_id').eq('enabled', true);
  const ids = [...new Set((sources ?? []).map((s) => s.store_id as string))].sort();
  if (!ids.length) return { skipped: true, reason: 'no sources' };
  const i = cfg.cursor ? ids.indexOf(cfg.cursor) : -1;
  const storeId = ids[(i + 1) % ids.length];
  const result = await autolinkStore(storeId);
  await db.from('app_settings').update({ value: { ...cfg, cursor: storeId }, updated_at: new Date().toISOString() }).eq('key', 'autolink');
  return result;
}

/** Accept or refuse a queued pair. Accepting links and prices it. */
export async function decideMatch(ids: string[], decision: 'accept' | 'reject'): Promise<{ done: number; errors: string[] }> {
  const db = adminDb();
  const { data: rows } = await db.from('match_queue').select('*').in('id', ids).eq('status', 'open');
  let done = 0;
  const errors: string[] = [];
  for (const r of rows ?? []) {
    try {
      if (decision === 'accept') await applyLink(db, { product_id: r.product_id, store_id: r.store_id, ext_id: r.ext_id, price: Number(r.feed_price), regular_price: r.feed_regular == null ? null : Number(r.feed_regular), barcode: r.feed_barcode });
      await db.from('match_queue').update({ status: decision === 'accept' ? 'accepted' : 'rejected', decided_at: new Date().toISOString() }).eq('id', r.id);
      done++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { done, errors };
}
