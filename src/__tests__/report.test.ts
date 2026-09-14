import { monthlyReport } from '../lib/report';

describe('monthlyReport', () => {
  it('sums a month and names the store visited most', () => {
    const r = monthlyReport([
      { store_id: 'araz', total: '10.50', saving: '1', items: 3, created_at: '2026-09-02T10:00:00Z' },
      { store_id: 'bravo', total: 40, saving: 2.5, items: 8, created_at: '2026-09-10T10:00:00Z' },
      { store_id: 'araz', total: 5, saving: 0, items: 1, created_at: '2026-09-12T10:00:00Z' },
      { store_id: 'bravo', total: 100, saving: 9, items: 20, created_at: '2026-08-30T10:00:00Z' },
    ]);
    expect(r.map((m) => m.key)).toEqual(['2026-09', '2026-08']);
    expect(r[0]).toMatchObject({ trips: 3, spent: 55.5, saved: 3.5, items: 12, topStore: 'araz' });
    expect(r[1]).toMatchObject({ trips: 1, spent: 100, topStore: 'bravo' });
  });
  it('is empty without trips', () => {
    expect(monthlyReport([])).toEqual([]);
  });
});
