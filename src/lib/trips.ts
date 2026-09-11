import { supabase } from './supabase';
import { track } from './track';

/**
 * Writes a shopping trip down: savings history, points (once per cooldown),
 * the month's board. Called from the comparison's "I bought here" and from
 * the shopping screen's "Done".
 */
export async function recordTrip(args: { storeId: string; branchId: string | null; total: number; saving: number; items: number }): Promise<{ earned: number; error?: string }> {
  if (!supabase) return { earned: 0, error: 'offline' };
  const { data, error } = await supabase.rpc('record_trip', {
    p_store_id: args.storeId,
    p_branch_id: args.branchId,
    p_total: Number(args.total.toFixed(2)),
    p_saving: Number(Math.max(0, args.saving).toFixed(2)),
    p_items: args.items,
  });
  if (error) return { earned: 0, error: error.message.replace(/^.*?: /, '') };
  const earned = (data as { points_earned?: number } | null)?.points_earned ?? 0;
  track('trip', { store_id: args.storeId, total: args.total, earned });
  return { earned };
}
