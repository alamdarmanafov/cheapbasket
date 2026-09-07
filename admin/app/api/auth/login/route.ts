import { NextResponse } from 'next/server';
import { COOKIE, safeEqual, signSession } from '@/lib/server';

/** Admin credentials live in env: ADMIN_EMAIL, ADMIN_PASSWORD (comma-separate several: a@x.com,b@x.com / pass1,pass2). */
export async function POST(req: Request) {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  const emails = (process.env.ADMIN_EMAIL ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const passwords = (process.env.ADMIN_PASSWORD ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!emails.length || !passwords.length) return NextResponse.json({ error: 'ADMIN_EMAIL / ADMIN_PASSWORD env dəyişənləri təyin edilməyib' }, { status: 500 });

  const i = emails.indexOf((email ?? '').trim().toLowerCase());
  const expected = passwords[i] ?? passwords[0];
  if (i < 0 || !safeEqual(password ?? '', expected)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down brute force
    return NextResponse.json({ error: 'E-poçt və ya şifrə yanlışdır' }, { status: 401 });
  }
  const token = await signSession(emails[i]);
  const res = NextResponse.json({ ok: true, email: emails[i] });
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 30 * 86400 });
  return res;
}
