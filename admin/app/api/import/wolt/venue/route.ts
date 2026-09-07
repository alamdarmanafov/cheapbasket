import { NextResponse } from 'next/server';
import { fetchWoltVenueInfo, venueSlug } from '@/lib/wolt';
import { errText, requireAdmin } from '@/lib/server';

export const maxDuration = 30;

/** GET /api/import/wolt/venue?slug=<slug>
 * Returns detailed venue info including opening hours extracted from the Wolt v3 API.
 */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const raw = new URL(req.url).searchParams.get('slug')?.trim() ?? '';
  if (!raw) return NextResponse.json({ error: 'slug parametri tələb olunur' }, { status: 400 });
  const slug = venueSlug(raw) ?? raw.toLowerCase().trim();
  try {
    const info = await fetchWoltVenueInfo(slug);
    if (!info) return NextResponse.json({ error: 'Venue tapılmadı' }, { status: 404 });
    return NextResponse.json(info);
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
