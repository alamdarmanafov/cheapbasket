/** Whole days until an ISO date ends, or null when there is no date or it has passed. */
export function daysLeft(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (!Number.isFinite(end)) return null;
  const d = Math.ceil((end - now.getTime()) / 86400000);
  return d < 0 ? null : d;
}
