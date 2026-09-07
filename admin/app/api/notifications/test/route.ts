import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';

export const maxDuration = 60;

/** POST { email?: string; title: string; body: string } → send a test push notification. */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });

  const { email, title, body } = (await req.json()) as { email?: string; title?: string; body?: string };
  if (!body?.trim()) return NextResponse.json({ error: 'Mətn boşdur' }, { status: 400 });

  const db = adminDb();
  let tokens: string[] = [];

  try {
    if (email && email.trim() && email.trim().toLowerCase() !== 'hamı') {
      // Find user_id from profiles table by email
      const { data: profile } = await db.from('profiles').select('user_id').eq('email', email.trim()).maybeSingle();
      let userId: string | null = profile?.user_id ?? null;

      // Fallback: look up via auth.admin if not found in profiles
      if (!userId) {
        const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 });
        const found = users.find((u) => u.email === email.trim());
        userId = found?.id ?? null;
      }

      if (!userId) return NextResponse.json({ error: 'İstifadəçi tapılmadı: ' + email }, { status: 404 });

      const { data: rows } = await db.from('push_tokens').select('token').eq('user_id', userId);
      tokens = (rows ?? []).map((r) => r.token).filter(Boolean);
    } else {
      // All users
      const { data: rows } = await db.from('push_tokens').select('token');
      tokens = (rows ?? []).map((r) => r.token).filter(Boolean);
    }

    if (!tokens.length) return NextResponse.json({ sent: 0, errors: 0, message: 'Heç bir qeydiyyatlı cihaz tapılmadı' });

    let sent = 0;
    let errors = 0;

    for (let i = 0; i < tokens.length; i += 100) {
      const chunk = tokens.slice(i, i + 100).map((to) => ({
        to,
        title: title?.trim() || 'Test bildirişi 🔔',
        body: body.trim(),
        sound: 'default',
        channelId: 'general',
      }));
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      const j = (await res.json()) as { data?: Array<{ status: string }> };
      for (const t of j.data ?? []) t.status === 'ok' ? sent++ : errors++;
    }

    return NextResponse.json({ sent, errors });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
