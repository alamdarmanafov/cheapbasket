import { NextResponse } from 'next/server';
import { fetchAnySource } from '@/lib/wolt';
import { errText, requireAdmin } from '@/lib/server';

export const maxDuration = 60;

/** POST { url } → normalised Wolt venue assortment (admin only; Wolt is called from the server). */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const { url } = (await req.json()) as { url?: string };
    if (!url) return NextResponse.json({ error: 'Link boşdur' }, { status: 400 });
    return NextResponse.json(await fetchAnySource(url));
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
