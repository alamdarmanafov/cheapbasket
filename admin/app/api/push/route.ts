import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';

/** Sends a push to every registered device via Expo Push Service. */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const { title, body } = (await req.json()) as { title?: string; body?: string };
  if (!body?.trim()) return NextResponse.json({ error: 'Mətn boşdur' }, { status: 400 });

  const { data: tokens, error } = await adminDb().from('push_tokens').select('token');
  if (error) return NextResponse.json({ error: errText(error) }, { status: 500 });

  let sent = 0;
  let errors = 0;
  const list = (tokens ?? []).map((t) => t.token as string);
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100).map((to) => ({ to, title: title || 'Cheap Basket', body, sound: 'default', channelId: 'price-drops' }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(chunk) });
    const j = (await res.json()) as { data?: Array<{ status: string }> };
    for (const t of j.data ?? []) t.status === 'ok' ? sent++ : errors++;
  }
  return NextResponse.json({ sent, errors });
}
