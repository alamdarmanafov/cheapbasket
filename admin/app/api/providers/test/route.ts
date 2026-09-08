import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server';
import { fetchWoltVenue } from '@/lib/wolt';

export const maxDuration = 60;

const PROVIDERS = [
  { market: 'araz', name: 'Araz', url: 'https://wolt.com/az/aze/baku/venue/araz' },
  { market: 'bazarstore', name: 'BazarStore', url: 'https://wolt.com/az/aze/baku/venue/bazarstore' },
  { market: 'bravo', name: 'Bravo', url: 'https://wolt.com/az/aze/baku/venue/bravo-supermarket' },
  { market: 'neptun', name: 'Neptun', url: 'https://wolt.com/az/aze/baku/venue/neptun' },
  { market: 'oba', name: 'OBA', url: 'https://wolt.com/az/aze/baku/venue/oba-market' },
  { market: 'spar', name: 'SPAR', url: 'https://wolt.com/az/aze/baku/venue/spar-azerbaijan' },
  { market: 'tamstore', name: 'Tam Store', url: 'https://wolt.com/az/aze/baku/venue/tam-store' },
];

/** POST /api/providers/test?market=<id>  — test one or all provider slugs. */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const marketFilter = searchParams.get('market');
  const toTest = marketFilter ? PROVIDERS.filter((p) => p.market === marketFilter) : PROVIDERS;

  const results = await Promise.allSettled(
    toTest.map(async (p) => {
      const start = Date.now();
      const venue = await fetchWoltVenue(p.url);
      return { market: p.market, name: p.name, url: p.url, ok: true, items: venue.items.length, venue: venue.venue, ms: Date.now() - start };
    })
  );

  return NextResponse.json({
    results: results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { market: toTest[i].market, name: toTest[i].name, url: toTest[i].url, ok: false, items: 0, error: (r.reason as Error).message }
    ),
  });
}
