import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';

export const maxDuration = 30;

interface SyncResult { ok: boolean; found: number; updated: number; error?: string }
interface SyncSource { id: string; store_id: string; name: string | null; last_run_at: string | null; last_result: SyncResult | null }

/** Aggregated stats for the admin dashboard. */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const db = adminDb();
    const [
      prodRes,
      storesRes,
      pricesRes,
      branchRes,
      profilesRes,
      syncRes,
    ] = await Promise.all([
      db.from('products').select('*', { count: 'exact', head: true }),
      db.from('stores').select('id, name, color, initial'),
      db.from('prices').select('product_id, store_id'),
      db.from('branches').select('*', { count: 'exact', head: true }),
      db.from('profiles').select('plan, plan_expires_at'),
      db.from('import_sources')
        .select('id, store_id, name, last_run_at, last_result')
        .order('last_run_at', { ascending: false })
        .limit(5),
    ]);

    const totalProducts = prodRes.count ?? 0;
    const storeList = storesRes.data ?? [];
    const priceRows = pricesRes.data ?? [];
    const totalBranches = branchRes.count ?? 0;
    const profiles = profilesRes.data ?? [];

    const now = Date.now();
    const productsWithPriceSet = new Set(priceRows.map((p) => p.product_id));
    const plusActive = profiles.filter(
      (p) => p.plan === 'plus' && (!p.plan_expires_at || new Date(p.plan_expires_at).getTime() > now),
    );

    const storeCoverage = storeList.map((s) => {
      const covered = new Set(priceRows.filter((p) => p.store_id === s.id).map((p) => p.product_id)).size;
      return { id: s.id, name: s.name, color: (s.color as string) ?? '#888', covered, total: totalProducts };
    });

    const recentSyncs: SyncSource[] = (syncRes.data ?? []) as SyncSource[];

    return NextResponse.json({
      totalProducts,
      productsWithPrice: productsWithPriceSet.size,
      productsWithoutPrice: totalProducts - productsWithPriceSet.size,
      totalBranches,
      totalUsers: profiles.length,
      totalPlus: plusActive.length,
      storeCoverage,
      recentSyncs,
    });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
