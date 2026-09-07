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

import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';

export const maxDuration = 30;

/** List all pending products awaiting admin review. */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const { data, error } = await adminDb().from('pending_products').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: errText(error) }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

type Body =
  | { op: 'approve'; id: string; category?: string }
  | { op: 'reject'; id: string }
  | { op: 'approve_all' };

/** Approve (move to products), reject (delete), or bulk-approve all pending products. */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const body = (await req.json()) as Body;
  const db = adminDb();

  try {
    if (body.op === 'approve') {
      const { data: pending, error: e1 } = await db.from('pending_products').select('*').eq('id', body.id).single();
      if (e1 || !pending) return NextResponse.json({ error: 'Məhsul tapılmadı' }, { status: 404 });
      const { error: e2 } = await db.from('products').upsert(
        {
          id: pending.id,
          name: pending.name,
          brand: pending.brand ?? '',
          barcode: pending.barcode ?? null,
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
      return NextResponse.json({ ok: true });
    }

    if (body.op === 'reject') {
      const { error } = await db.from('pending_products').delete().eq('id', body.id);
      if (error) return NextResponse.json({ error: errText(error) }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.op === 'approve_all') {
      const { data: pending, error: e1 } = await db.from('pending_products').select('*');
      if (e1) return NextResponse.json({ error: errText(e1) }, { status: 500 });
      if (!pending?.length) return NextResponse.json({ ok: true, count: 0 });

      const productRows = pending.map((p: Record<string, unknown>) => ({
        id: p.id,
        name: p.name,
        brand: p.brand ?? '',
        barcode: p.barcode ?? null,
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

      // Delete all approved items
      const ids = pending.map((p: Record<string, unknown>) => p.id as string);
      const { error: e3 } = await db.from('pending_products').delete().in('id', ids);
      if (e3) return NextResponse.json({ error: errText(e3) }, { status: 500 });

      return NextResponse.json({ ok: true, count: pending.length });
    }

    return NextResponse.json({ error: 'Naməlum əməliyyat' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
