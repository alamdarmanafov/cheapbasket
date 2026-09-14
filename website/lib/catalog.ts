/**
 * Build-time reads for the static site.
 *
 * The catalogue tables answer only signed-in sessions; the site reads the
 * product *index* (names, no prices) through public_product_index() with
 * the anon key when the pages are generated, and each product page fetches
 * its own prices in the browser through public_product(), one product per
 * call, exactly as the shared links always have.
 */
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export interface IndexRow { id: string; name: string; brand: string; size: string; category: string }

let cache: Promise<IndexRow[]> | null = null;

export function productIndex(): Promise<IndexRow[]> {
  if (cache) return cache;
  cache = (async () => {
    if (!SUPABASE_URL || !SUPABASE_KEY) return [];
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/public_product_index`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json' },
        body: '{}',
      });
      if (!r.ok) return [];
      const rows = (await r.json()) as IndexRow[];
      return Array.isArray(rows) ? rows.filter((x) => x && typeof x.id === 'string' && /^[A-Za-z0-9._~-]+$/.test(x.id)) : [];
    } catch {
      return [];
    }
  })();
  return cache;
}

export const fullName = (p: IndexRow) => [p.brand, p.name, p.size].filter(Boolean).join(' ').trim();
