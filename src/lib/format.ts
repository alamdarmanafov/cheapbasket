import { tr } from './i18n';

export const manat = (n: number, digits = 2) => `${n.toFixed(digits)} ₼`;

export function freshness(minutes: number): string {
  if (minutes < 1) return tr('time.now');
  if (minutes < 60) return tr('time.minutes', { n: minutes });
  const h = Math.round(minutes / 60);
  if (h < 24) return tr('time.hours', { n: h });
  return tr('time.days', { n: Math.round(h / 24) });
}

/** Same wording as `freshness`, from an ISO timestamp — used by the deal and alert lists. */
export function ago(iso: string): string {
  return freshness(Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)));
}

/** Freshness bucket drives the colour of the "last updated" pill. */
export function freshnessLevel(minutes: number): 'fresh' | 'ok' | 'stale' {
  if (minutes <= 30) return 'fresh';
  if (minutes <= 180) return 'ok';
  return 'stale';
}
