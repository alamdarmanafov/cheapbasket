// -- Run in Supabase SQL editor:
// -- CREATE TABLE IF NOT EXISTS pending_products (
// --   id text PRIMARY KEY,
// --   name text NOT NULL,
// --   brand text DEFAULT '',
// --   barcode text,
// --   size text DEFAULT '',
// --   image_url text,
// --   category text,
// --   store_id text,
// --   source_name text,
// --   created_at timestamptz DEFAULT now()
// -- );
// -- suggested_by / suggested_at come from migration 0027 (user suggestions).

import { NextResponse } from 'next/server';
import { adminDb, errText, fetchAll, requireAdmin } from '@/lib/server';
import { rewardSuggester } from '@/lib/reward';
import { normalizeGtin } from '@/lib/gtin';
import { copy, langOf } from '@/lib/pushCopy';
import { EXPO_PUSH_URL, PUSH_CHANNEL, PUSH_SOUND } from '@/lib/push';

export const maxDuration = 30;

/** List all pending products awaiting admin review. */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const db = adminDb();
    const [data, branches] = await Promise.all([
      fetchAll<Record<string, unknown>>((from, to) => db.from('pending_products').select('*').order('created_at', { ascending: false }).range(from, to)),
      db.from('branch_suggestions').select('id, user_id, store_id, store_name, name, address, lat, lng, note, created_at, stores(name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(100),
    ]);
    return NextResponse.json({ data, branches: branches.data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}

type Body =
  | { op: 'approve'; id: string; category?: string; name?: string; brand?: string }
  | { op: 'reject'; id: string }
  | { op: 'approve_all' }
  | { op: 'approve_branch'; id: string; store_id?: string; store_name?: string; name?: string; address?: string }
  | { op: 'reject_branch'; id: string };

/** Approve (move to products), reject (delete), or bulk-approve all pending products. */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const body = (await req.json()) as Body;
  const db = adminDb();

  try {
    if (body.op === 'approve') {
      const { data: pending, error: e1 } = await db.from('pending_products').select('*').eq('id', body.id).single();
      if (e1 || !pending) return NextResponse.json({ error: 'Məhsul tapılmadı' }, { status: 404 });
      // A user's suggestion arrives with whatever they typed in the shop; the
      // admin can correct the name and brand right on the row before it lands.
      const name = String(body.name ?? pending.name ?? '').trim();
      if (!name) return NextResponse.json({ error: 'Məhsulun adı boşdur' }, { status: 400 });
      const { error: e2 } = await db.from('products').upsert(
        {
          id: pending.id,
          name,
          brand: String(body.brand ?? pending.brand ?? '').trim(),
          barcode: normalizeGtin(pending.barcode as string | null),
          size: pending.size ?? '',
          image_url: pending.image_url ?? null,
          category: body.category ?? pending.category ?? '',
          emoji: null,
          tint: null,
          rating: null,
        },
        { onConflict: 'id', ignoreDuplicates: true },
      );
      if (e2) return NextResponse.json({ error: errText(e2) }, { status: 500 });
      await db.from('pending_products').delete().eq('id', body.id);
      // The product is in by now; a failed payout must not read as a failed
      // approval. It is reported instead, and the credit is idempotent, so the
      // admin can retry it from the ledger without paying twice.
      let points = 0;
      let warning: string | undefined;
      try {
        points = await rewardSuggester(pending.suggested_by as string | null, pending.barcode as string | null, name);
      } catch (e) {
        warning = `Xal verilmədi: ${errText(e)}`;
      }
      return NextResponse.json({ ok: true, points, warning });
    }

    // A shopper's "there is a store here": becomes a branch (and a store, if
    // the chain is new), the shopper is paid and told. Nothing else moves.
    if (body.op === 'approve_branch') {
      const { data: sug } = await db.from('branch_suggestions').select('*').eq('id', body.id).eq('status', 'pending').maybeSingle();
      if (!sug) return NextResponse.json({ error: 'Təklif tapılmadı və ya baxılıb' }, { status: 404 });
      let storeId = (body.store_id ?? sug.store_id ?? '').trim();
      const storeName = (body.store_name ?? sug.store_name ?? '').trim();
      if (!storeId) {
        if (!storeName) return NextResponse.json({ error: 'Market seç və ya ad yaz' }, { status: 400 });
        storeId = storeName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `store-${Date.now()}`;
        const { data: existing } = await db.from('stores').select('id').eq('id', storeId).maybeSingle();
        if (!existing) {
          const { error: se } = await db.from('stores').insert({ id: storeId, name: storeName, color: '#6B7280', initial: storeName.slice(0, 1).toUpperCase() });
          if (se) return NextResponse.json({ error: errText(se) }, { status: 500 });
        }
      }
      const { data: store } = await db.from('stores').select('id, name, open_from, open_until, always_open').eq('id', storeId).maybeSingle();
      if (!store) return NextResponse.json({ error: 'Market tapılmadı' }, { status: 404 });
      const name = (body.name ?? sug.name ?? '').trim() || `${store.name} ${(body.address ?? sug.address ?? '').split(',')[0]}`.trim();
      const address = (body.address ?? sug.address ?? '').trim() || name;
      const base = `${storeId}-${name.toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.slice(0, 60);
      let branchId = base;
      for (let n = 2; ; n++) {
        const { data: taken } = await db.from('branches').select('id').eq('id', branchId).maybeSingle();
        if (!taken) break;
        branchId = `${base}-${n}`;
      }
      const { error: be } = await db.from('branches').insert({ id: branchId, store_id: storeId, name, address, lat: Number(sug.lat), lng: Number(sug.lng), open_from: store.open_from ?? null, open_until: store.open_until ?? null, always_open: !!store.always_open, maps_url: `https://maps.google.com/?q=${Number(sug.lat)},${Number(sug.lng)}` });
      if (be) return NextResponse.json({ error: errText(be) }, { status: 500 });
      const { data: pts } = await db.rpc('award_branch_points', { p_user: sug.user_id, p_ref: sug.id });
      const points = Number(pts ?? 0);
      await db.from('branch_suggestions').update({ status: 'approved', branch_id: branchId, points, decided_at: new Date().toISOString() }).eq('id', sug.id);
      const [{ data: tokens }, { data: profile }] = await Promise.all([db.from('push_tokens').select('token').eq('user_id', sug.user_id), db.from('profiles').select('lang').eq('user_id', sug.user_id).maybeSingle()]);
      const c = copy(langOf(profile));
      const to = (tokens ?? []).map((t) => t.token as string).filter(Boolean);
      if (to.length) {
        await fetch(EXPO_PUSH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(to.map((token) => ({ to: token, title: c.branchTitle(points), body: c.branchBody(`${store.name} · ${name}`), sound: PUSH_SOUND, channelId: PUSH_CHANNEL, data: { url: `/map?store=${storeId}&branch=${branchId}` } }))) }).catch(() => undefined);
      }
      return NextResponse.json({ ok: true, branch_id: branchId, store_id: storeId, points });
    }
    if (body.op === 'reject_branch') {
      const { error } = await db.from('branch_suggestions').update({ status: 'rejected', decided_at: new Date().toISOString() }).eq('id', body.id).eq('status', 'pending');
      if (error) return NextResponse.json({ error: errText(error) }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.op === 'reject') {
      const { error } = await db.from('pending_products').delete().eq('id', body.id);
      if (error) return NextResponse.json({ error: errText(error) }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.op === 'approve_all') {
      const pending = await fetchAll<Record<string, unknown>>((from, to) =>
        db.from('pending_products').select('*').range(from, to)
      );
      if (!pending?.length) return NextResponse.json({ ok: true, count: 0 });

      // A pending row without a name cannot become a product (name is NOT NULL),
      // and one bad row would otherwise fail the whole batch.
      const nameless = pending.filter((p: Record<string, unknown>) => !String(p.name ?? '').trim()).length;
      const productRows = pending
        .filter((p: Record<string, unknown>) => String(p.name ?? '').trim())
        .map((p: Record<string, unknown>) => ({
        id: p.id,
        name: p.name,
        brand: p.brand ?? '',
        barcode: normalizeGtin(p.barcode as string | null),
        size: p.size ?? '',
        image_url: p.image_url ?? null,
        category: p.category ?? '',
        emoji: null,
        tint: null,
        rating: null,
      }));

      // Upsert in batches
      for (let i = 0; i < productRows.length; i += 200) {
        const { error } = await db.from('products').upsert(productRows.slice(i, i + 200), { onConflict: 'id', ignoreDuplicates: true });
        if (error) return NextResponse.json({ error: errText(error) }, { status: 500 });
      }

      // Remove only what actually became a product. A nameless row stays in the
      // queue so it can be fixed or rejected, rather than vanishing unapproved.
      const ids = productRows.map((p) => p.id as string);
      if (ids.length) {
        const { error: e3 } = await db.from('pending_products').delete().in('id', ids);
        if (e3) return NextResponse.json({ error: errText(e3) }, { status: 500 });
      }

      // Suggested rows in the batch pay their suggesters too — one by one, since
      // each is a separate person, barcode and push.
      let rewarded = 0;
      const approved = new Set(ids);
      for (const p of pending as Array<Record<string, unknown>>) {
        if (!p.suggested_by || !approved.has(p.id as string)) continue;
        const pts = await rewardSuggester(p.suggested_by as string, p.barcode as string | null, String(p.name ?? '')).catch(() => 0);
        if (pts > 0) rewarded++;
      }

      return NextResponse.json({ ok: true, count: productRows.length, skipped: nameless, rewarded });
    }

    return NextResponse.json({ error: 'Naməlum əməliyyat' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
