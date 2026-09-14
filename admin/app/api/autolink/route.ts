import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';
import { autolinkStore, decideMatch } from '@/lib/autolink';

export const maxDuration = 60;

/** GET → the open queue with our product beside the feed's item, plus what each store has waiting. */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const db = adminDb();
    const [{ data: rows, error }, { data: stores }, { data: sources }] = await Promise.all([
      db.from('match_queue').select('*, products(brand, name, size, barcode)').eq('status', 'open').order('score', { ascending: false }).limit(500),
      db.from('stores').select('id, name, color').order('name'),
      db.from('import_sources').select('store_id').eq('enabled', true),
    ]);
    if (error) throw error;
    const withFeed = new Set((sources ?? []).map((s) => s.store_id as string));
    return NextResponse.json({ rows: rows ?? [], stores: (stores ?? []).map((s) => ({ ...s, feed: withFeed.has(s.id) })) });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}

/** POST { store_id } → run the batch pass for one store now. */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const { store_id } = (await req.json()) as { store_id: string };
    if (!store_id) return NextResponse.json({ error: 'store_id lazımdır' }, { status: 400 });
    return NextResponse.json(await autolinkStore(store_id));
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}

/** PUT { ids, decision } → yes or no for queued pairs. */
export async function PUT(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const { ids, decision } = (await req.json()) as { ids: string[]; decision: 'accept' | 'reject' };
    if (!Array.isArray(ids) || !ids.length || !['accept', 'reject'].includes(decision)) return NextResponse.json({ error: 'ids və decision lazımdır' }, { status: 400 });
    return NextResponse.json(await decideMatch(ids.slice(0, 200), decision));
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
