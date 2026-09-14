import { NextResponse } from 'next/server';
import { adminDb, errText } from '@/lib/server';

export const maxDuration = 30;

const MAX_ROWS = 5000;

/** The link's store, or nothing: the page shows the name before asking for a file. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!token || token.length < 16) return NextResponse.json({ error: 'Link düzgün deyil' }, { status: 404 });
  const { data } = await adminDb().from('stores').select('id, name, color, logo_url').eq('partner_token', token).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Link düzgün deyil və ya ləğv olunub' }, { status: 404 });
  return NextResponse.json({ store: data });
}

/**
 * POST { token, filename, note, rows: [{ barcode, name, size, price }] }
 * A store's own list, held for the admin. Nothing reaches `prices` from here:
 * the upload is a row in partner_uploads until someone on our side matches
 * and applies it.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string; filename?: string; note?: string; rows?: Array<{ barcode?: string; name?: string; size?: string; brand?: string; price?: number }> };
    const token = body.token ?? '';
    if (!token || token.length < 16) return NextResponse.json({ error: 'Link düzgün deyil' }, { status: 404 });
    const db = adminDb();
    const { data: store } = await db.from('stores').select('id, name').eq('partner_token', token).maybeSingle();
    if (!store) return NextResponse.json({ error: 'Link düzgün deyil və ya ləğv olunub' }, { status: 404 });
    const rows = (body.rows ?? [])
      .map((r) => ({
        barcode: String(r.barcode ?? '').replace(/\D/g, '').slice(0, 14) || null,
        name: String(r.name ?? '').trim().slice(0, 160),
        brand: String(r.brand ?? '').trim().slice(0, 80) || null,
        size: String(r.size ?? '').trim().slice(0, 40) || null,
        price: Number(r.price),
      }))
      .filter((r) => (r.name || r.barcode) && Number.isFinite(r.price) && r.price > 0 && r.price < 10000)
      .slice(0, MAX_ROWS);
    if (!rows.length) return NextResponse.json({ error: 'Faylda oxunan sətir yoxdur (ad və ya barkod + qiymət lazımdır)' }, { status: 400 });
    // One open upload per store per hour: a re-sent file replaces, not stacks.
    const { count } = await db.from('partner_uploads').select('*', { count: 'exact', head: true }).eq('store_id', store.id).eq('status', 'pending').gte('created_at', new Date(Date.now() - 3600000).toISOString());
    if ((count ?? 0) >= 3) return NextResponse.json({ error: 'Bir saatda 3 yükləmə. Bir az sonra yenidən cəhd edin.' }, { status: 429 });
    const { data, error } = await db.from('partner_uploads').insert({ store_id: store.id, filename: String(body.filename ?? '').slice(0, 120) || null, note: String(body.note ?? '').slice(0, 500) || null, rows, row_count: rows.length }).select('id').single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id, rows: rows.length, store: store.name });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
