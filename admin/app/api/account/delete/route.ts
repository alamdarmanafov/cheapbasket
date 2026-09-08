import { NextResponse } from 'next/server';
import { adminDb, errText } from '@/lib/server';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

/**
 * Self-serve account deletion, required by App Store guideline 5.1.1(v).
 *
 * The caller proves who they are with their own Supabase access token — never a
 * user id from the body, which anyone could forge. The service role then removes
 * that auth user; `on delete cascade` on the tables keyed by auth.users clears
 * their profile, baskets, lists and push tokens with it.
 */
export async function POST(req: Request) {
  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401, headers: cors });

  try {
    const db = adminDb();
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return NextResponse.json({ error: 'Sessiya etibarsızdır' }, { status: 401, headers: cors });

    const { error: delErr } = await db.auth.admin.deleteUser(data.user.id);
    if (delErr) throw delErr;
    return NextResponse.json({ ok: true }, { headers: cors });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500, headers: cors });
  }
}
