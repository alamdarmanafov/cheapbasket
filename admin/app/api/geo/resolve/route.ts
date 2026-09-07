import { NextResponse } from 'next/server';
import { resolvePlace } from '@/lib/geo';
import { errText, requireAdmin } from '@/lib/server';

/** POST { q } — Google Maps link, "lat, lng" or an address → { lat, lng, name?, address? } */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const { q } = (await req.json()) as { q?: string };
    return NextResponse.json(await resolvePlace(q ?? ''));
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 400 });
  }
}
