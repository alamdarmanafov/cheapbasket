/**
 * A month of shopping, summed from the recorded trips: what went out, what
 * the comparison kept in, where the money mostly went.
 */
export interface Trip { store_id: string; total: number | string; saving: number | string; items: number; created_at: string }

export interface MonthReport {
  /** `YYYY-MM` */
  key: string;
  year: number;
  /** 0-based, as `Date` counts. */
  month: number;
  trips: number;
  spent: number;
  saved: number;
  items: number;
  /** Store with the most trips this month, ties to the one with the higher spend. */
  topStore: string | null;
}

export function monthKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Newest month first. Months with no trips are not listed. */
export function monthlyReport(trips: Trip[]): MonthReport[] {
  const byMonth = new Map<string, MonthReport & { stores: Map<string, { n: number; spent: number }> }>();
  for (const t of trips) {
    const key = monthKeyOf(t.created_at);
    const d = new Date(t.created_at);
    let m = byMonth.get(key);
    if (!m) {
      m = { key, year: d.getFullYear(), month: d.getMonth(), trips: 0, spent: 0, saved: 0, items: 0, topStore: null, stores: new Map() };
      byMonth.set(key, m);
    }
    const total = Number(t.total) || 0;
    m.trips += 1;
    m.spent += total;
    m.saved += Number(t.saving) || 0;
    m.items += t.items || 0;
    const s = m.stores.get(t.store_id) ?? { n: 0, spent: 0 };
    s.n += 1;
    s.spent += total;
    m.stores.set(t.store_id, s);
  }
  return [...byMonth.values()]
    .map(({ stores, ...m }) => {
      let top: { id: string; n: number; spent: number } | null = null;
      for (const [id, s] of stores) if (!top || s.n > top.n || (s.n === top.n && s.spent > top.spent)) top = { id, ...s };
      return { ...m, spent: round(m.spent), saved: round(m.saved), topStore: top?.id ?? null };
    })
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}

const round = (n: number) => Math.round(n * 100) / 100;
