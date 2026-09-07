export const manat = (n: number, digits = 2) => `${n.toFixed(digits)} ₼`;

export const signedManat = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)} ₼`;

export function freshness(minutes: number): string {
  if (minutes < 1) return 'indicə';
  if (minutes < 60) return `${minutes} dəqiqə əvvəl`;
  const h = Math.round(minutes / 60);
  if (h < 24) return `${h} saat əvvəl`;
  return `${Math.round(h / 24)} gün əvvəl`;
}

/** Freshness bucket drives the colour of the "last updated" pill. */
export function freshnessLevel(minutes: number): 'fresh' | 'ok' | 'stale' {
  if (minutes <= 30) return 'fresh';
  if (minutes <= 180) return 'ok';
  return 'stale';
}

export const plural = (n: number, word: string) => `${n} ${word}`;
