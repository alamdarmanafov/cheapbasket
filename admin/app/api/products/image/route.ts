import { NextResponse } from 'next/server';
import { searchWoltVenues, fetchWoltVenue, buildMatcher } from '@/lib/wolt';
import { errText, requireAdmin } from '@/lib/server';

export const maxDuration = 60;

/**
 * GET /api/products/image?q=BRAND+NAME
 * Searches Wolt venues for the brand, fetches their menus, and returns the
 * first item image that matches the product name.
 */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ error: 'Ən azı 2 hərf yaz' }, { status: 400 });

  try {
    // Use the first word as brand for venue search
    const brand = q.split(/\s+/)[0];
    const { venues } = await searchWoltVenues(brand).catch(() => ({ venues: [] as Awaited<ReturnType<typeof searchWoltVenues>>['venues'] }));

    const topVenues = venues.slice(0, 3);
    for (const venue of topVenues) {
      try {
        const result = await fetchWoltVenue(venue.url);
        // Build a matcher from the venue's items treated as products
        const items = result.items.map((i) => ({ id: i.ext_id, barcode: i.barcode, brand: '', name: i.name, size: '' }));
        const match = buildMatcher(items);
        const matchedId = match({ name: q, barcode: null });
        if (matchedId) {
          const item = result.items.find((i) => i.ext_id === matchedId);
          if (item?.image_url) return NextResponse.json({ image_url: item.image_url, venue: result.venue, item_name: item.name });
        }
        // Fallback: fuzzy search by name substring
        const lq = q.toLowerCase();
        const fallback = result.items.find((i) => {
          const ln = i.name.toLowerCase();
          return lq.split(/\s+/).filter((w) => w.length > 2).every((w) => ln.includes(w));
        });
        if (fallback?.image_url) return NextResponse.json({ image_url: fallback.image_url, venue: result.venue, item_name: fallback.name });
      } catch {
        // try next venue
      }
    }

    return NextResponse.json({ error: 'Şəkil tapılmadı' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
