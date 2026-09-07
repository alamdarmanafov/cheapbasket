import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';
import { buildMatcher, MatchableProduct } from '@/lib/wolt';
import { aiMatch, logAiMatch } from '@/lib/ai/productMatcher';

export const maxDuration = 300;

/**
 * POST /api/ai/match-pending
 * Runs AI matching on unmatched pending products in batches.
 * Separated from the sync hot path to avoid 504 timeouts.
 * Body: { limit?: number } — max pending items to process (default 50)
 */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.min(200, Math.max(1, body.limit ?? 50));

  const db = adminDb();
  try {
    const [{ data: pending }, { data: products }] = await Promise.all([
      db.from('pending_products').select('id, name, barcode, brand, size, store_id').is('ai_suggested_id', null).limit(limit),
      db.from('products').select('id, barcode, brand, name, size'),
    ]);
    if (!pending?.length) return NextResponse.json({ ok: true, processed: 0, matched: 0, review: 0, rejected: 0 });

    const productList: MatchableProduct[] = products ?? [];
    const match = buildMatcher(productList);

    let matched = 0;
    let review = 0;
    let rejected = 0;

    const AI_BATCH = 5;
    for (let i = 0; i < pending.length; i += AI_BATCH) {
      const batch = pending.slice(i, i + AI_BATCH);
      await Promise.all(batch.map(async (p) => {
        // Skip if it now matches algorithmically
        if (match({ name: `${p.brand} ${p.name}`, barcode: p.barcode })) {
          await db.from('pending_products').delete().eq('id', p.id);
          matched++;
          return;
        }

        const firstWord = (p.name ?? '').split(' ')[0].toLowerCase();
        const candidates = productList
          .filter((c) => `${c.brand} ${c.name}`.toLowerCase().includes(firstWord))
          .slice(0, 20);

        if (!candidates.length) { rejected++; return; }

        const result = await aiMatch({ name: `${p.brand} ${p.name}`.trim(), barcode: p.barcode ?? null }, candidates);
        await logAiMatch(db, { name: p.name ?? '', barcode: p.barcode ?? null }, result);

        if (result.status === 'matched' && result.product_id) {
          // High confidence: delete from pending (product already exists, prices update via next sync)
          await db.from('pending_products').delete().eq('id', p.id);
          matched++;
        } else if (result.status === 'review' && result.product_id) {
          // Medium confidence: mark with AI suggestion for admin review
          await db.from('pending_products').update({
            ai_suggested_id: result.product_id,
            ai_confidence: result.confidence,
          }).eq('id', p.id);
          review++;
        } else {
          rejected++;
        }
      }));
    }

    return NextResponse.json({ ok: true, processed: pending.length, matched, review, rejected });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
