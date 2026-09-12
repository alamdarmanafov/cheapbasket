import { NextResponse } from 'next/server';
import { errText, requireAdmin } from '@/lib/server';
import { segmentTokens, type Segment } from '@/lib/segments';
import { PUSH_CHANNEL, PUSH_SOUND } from '@/lib/push';

/** GET ?segment=&city= → how many devices/users the segment has. */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const u = new URL(req.url);
  try {
    const r = await segmentTokens((u.searchParams.get('segment') as Segment) || 'all', u.searchParams.get('city') ?? undefined);
    return NextResponse.json({ devices: r.tokens.length, users: r.users });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}

/** POST { title, body, segment?, city?, url? } → Expo push to the segment. */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const { title, body, segment, city, url } = (await req.json()) as { title?: string; body?: string; segment?: Segment; city?: string; url?: string };
  if (!body?.trim()) return NextResponse.json({ error: 'Mətn boşdur' }, { status: 400 });
  try {
    const { tokens } = await segmentTokens(segment ?? 'all', city);
    let sent = 0;
    let errors = 0;
    for (let i = 0; i < tokens.length; i += 100) {
      const chunk = tokens.slice(i, i + 100).map((to) => ({ to, title: title || 'Cheap Market AI', body, sound: PUSH_SOUND, channelId: PUSH_CHANNEL, data: url ? { url } : undefined }));
      const res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(chunk) });
      const j = (await res.json()) as { data?: Array<{ status: string }> };
      for (const t of j.data ?? []) t.status === 'ok' ? sent++ : errors++;
    }
    return NextResponse.json({ sent, errors, devices: tokens.length });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
