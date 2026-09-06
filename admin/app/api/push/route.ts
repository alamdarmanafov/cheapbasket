import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/** Sends a push to every registered device. The caller's Supabase JWT must belong to an admin (RLS enforces it). */
export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) return NextResponse.json({ error: 'Admin deyil' }, { status: 403 });

  const { title, body } = (await req.json()) as { title?: string; body?: string };
  if (!body?.trim()) return NextResponse.json({ error: 'Mətn boşdur' }, { status: 400 });

  const { data: tokens, error } = await supabase.from('push_tokens').select('token');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let errors = 0;
  const list = (tokens ?? []).map((t) => t.token);
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100).map((to) => ({ to, title: title || 'Cheap Basket', body, sound: 'default', channelId: 'price-drops' }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(chunk) });
    const j = (await res.json()) as { data?: Array<{ status: string }> };
    for (const t of j.data ?? []) t.status === 'ok' ? sent++ : errors++;
  }
  return NextResponse.json({ sent, errors });
}
