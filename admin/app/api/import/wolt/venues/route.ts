import { NextResponse } from 'next/server';
import { fetchWoltVenueInfo, searchWoltVenues } from '@/lib/wolt';
import { errText, requireAdmin } from '@/lib/server';

export const maxDuration = 60;

/** GET ?q=Araz → Wolt venues of that chain in Baku (name, address, coordinates, slug). */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ error: 'Ən azı 2 hərf yaz' }, { status: 400 });
  try {
    const r = await searchWoltVenues(q);
    // Fill missing address/coordinates from the venue endpoint (max 15 lookups per search).
    let lookups = 0;
    for (const v of r.venues) {
      if ((v.lat == null || !v.address) && lookups < 15) {
        lookups++;
        const info = await fetchWoltVenueInfo(v.slug);
        if (info) { v.address = v.address ?? info.address; v.lat = v.lat ?? info.lat; v.lng = v.lng ?? info.lng; }
      }
    }
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
