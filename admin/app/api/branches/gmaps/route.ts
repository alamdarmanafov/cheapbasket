import { NextResponse } from 'next/server';
import { resolvePlace } from '@/lib/geo';
import { errText, requireAdmin } from '@/lib/server';

/**
 * GET /api/branches/gmaps?url=ENCODED_URL
 * Parse a Google Maps URL (long or short) → { name?, address?, lat, lng }
 *
 * Supported URL patterns:
 *   https://www.google.com/maps/place/NAME/@lat,lng,zoom
 *   https://maps.app.goo.gl/SHORTLINK  (followed via redirect)
 *   https://www.google.com/maps?q=lat,lng
 */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  }
  const url = new URL(req.url).searchParams.get('url')?.trim() ?? '';
  if (!url) return NextResponse.json({ error: 'URL boşdur' }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'Yalnız Google Maps URL qəbul edilir' }, { status: 400 });
  }
  try {
    const result = await resolvePlace(url);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 400 });
  }
}
