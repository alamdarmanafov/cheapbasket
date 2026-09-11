import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';
import { copy, langOf } from '@/lib/pushCopy';

export const maxDuration = 30;

/** Admin: pending receipts and open price reports. */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const db = adminDb();
  const [{ data: receipts }, { data: reports }, { data: stores }] = await Promise.all([
    db.from('receipts').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(100),
    db.from('price_reports').select('*, products(name, brand, size)').eq('resolved', false).order('created_at', { ascending: false }).limit(200),
    db.from('stores').select('id, name'),
  ]);
  return NextResponse.json({ receipts: receipts ?? [], reports: reports ?? [], stores: stores ?? [] });
}

type Body =
  | { op: 'approve'; id: string; store_id: string; items: Array<{ product_id: string | null; name: string; price: number; qty: number }> }
  | { op: 'reject'; id: string; note?: string }
  | { op: 'resolve_report'; id: string };

/**
 * Approve: the confirmed lines become that store's prices, the shopper is
 * paid and told. Reject: the receipt is closed with a note.
 */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const body = (await req.json()) as Body;
  const db = adminDb();
  try {
    if (body.op === 'resolve_report') {
      const { error } = await db.from('price_reports').update({ resolved: true }).eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (body.op === 'reject') {
      const { error } = await db.from('receipts').update({ status: 'rejected', note: body.note ?? null, reviewed_at: new Date().toISOString() }).eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    const { data: r, error: e1 } = await db.from('receipts').select('*').eq('id', body.id).single();
    if (e1 || !r) return NextResponse.json({ error: 'Çek tapılmadı' }, { status: 404 });
    if (r.status !== 'pending') return NextResponse.json({ error: 'Bu çek artıq baxılıb' }, { status: 409 });
    const lines = body.items.filter((it) => it.product_id && it.price > 0);
    if (lines.length) {
      const now = new Date().toISOString();
      const { error: e2 } = await db.from('prices').upsert(lines.map((it) => ({ product_id: it.product_id, store_id: body.store_id, price: it.price, updated_at: now })), { onConflict: 'product_id,store_id' });
      if (e2) throw e2;
    }
    const { error: e3 } = await db.from('receipts').update({ status: 'approved', store_id: body.store_id, items: body.items, reviewed_at: new Date().toISOString() }).eq('id', body.id);
    if (e3) throw e3;
    const { data: pts } = await db.rpc('award_receipt_points', { p_receipt: body.id });
    const points = Number(pts ?? 0);
    if (points > 0) {
      const [{ data: tokens }, { data: profile }] = await Promise.all([
        db.from('push_tokens').select('token').eq('user_id', r.user_id),
        db.from('profiles').select('lang').eq('user_id', r.user_id).maybeSingle(),
      ]);
      const c = copy(langOf(profile));
      const to = (tokens ?? []).map((t) => t.token as string).filter(Boolean);
      if (to.length) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(to.map((token) => ({ to: token, title: c.receiptTitle(points), body: c.receiptBody(lines.length), sound: 'default', channelId: 'price-drops', data: { url: '/referral' } }))),
        }).catch(() => undefined);
      }
    }
    return NextResponse.json({ ok: true, prices: lines.length, points });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
