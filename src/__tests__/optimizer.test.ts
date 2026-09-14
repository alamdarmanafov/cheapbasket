import { catalog, Product, Store } from '../data/products';
import { optimize, splitPlan } from '../lib/optimizer';

const store = (id: string): Store => ({ id, name: id, color: '#000', initial: id[0] });
const product = (id: string, prices: Record<string, number | null>): Product => ({
  id, barcode: '', name: id, brand: '', size: '', category: 'c', emoji: '', tint: '', imageUrl: null, prices, regularPrices: {}, history: [], updatedMinutesAgo: 0,
});

beforeEach(() => {
  catalog.stores = [store('araz'), store('bravo'), store('neptun')];
});

describe('optimize', () => {
  it('picks the cheapest store that carries the whole basket', () => {
    const o = optimize([
      { product: product('milk', { araz: 2, bravo: 1.8, neptun: 2.1 }), qty: 2 },
      { product: product('eggs', { araz: 3, bravo: 3.5, neptun: 2.9 }), qty: 1 },
    ]);
    // araz 2·2 + 3 = 7.0, bravo 3.6 + 3.5 = 7.1, neptun 4.2 + 2.9 = 7.1
    expect(o.best?.store.id).toBe('araz');
    expect(o.best?.total).toBeCloseTo(7);
    expect(o.ranked.map((r) => r.store.id)).toEqual(['araz', 'bravo', 'neptun']);
  });
  it('ranks full coverage above a cheaper partial one', () => {
    const o = optimize([
      { product: product('milk', { araz: 2, bravo: 1 }), qty: 1 },
      { product: product('eggs', { araz: 3, bravo: null }), qty: 1 },
    ]);
    expect(o.best?.store.id).toBe('araz');
    expect(o.ranked.find((r) => r.store.id === 'bravo')?.missing.map((m) => m.product.id)).toEqual(['eggs']);
  });
  it('reports the saving against the dearest full-coverage store', () => {
    const o = optimize([{ product: product('milk', { araz: 2, bravo: 1.5, neptun: null }), qty: 2 }]);
    expect(o.best?.store.id).toBe('bravo');
    expect(o.worst?.store.id).toBe('araz');
    expect(o.saving).toBeCloseTo(1);
  });
  it('sums the cheapest price per line across stores', () => {
    const o = optimize([
      { product: product('milk', { araz: 2, bravo: 1 }), qty: 1 },
      { product: product('eggs', { araz: 3, bravo: 4 }), qty: 1 },
    ]);
    expect(o.cheapestSplitTotal).toBe(4);
  });
  it('is empty without lines or stores', () => {
    expect(optimize([]).best).toBeNull();
    catalog.stores = [];
    expect(optimize([{ product: product('milk', { araz: 1 }), qty: 1 }]).ranked).toEqual([]);
  });
});

describe('splitPlan', () => {
  const store = (id: string) => ({ id, name: id, color: '#000', initial: id[0].toUpperCase() });
  const line = (id: string, prices: Record<string, number | null>, qty = 1) => ({ product: { id, prices } as never, qty });
  it('splits the basket when two stores beat the best single one by the margin', () => {
    const stores = [store('araz'), store('bravo')] as never[];
    const lines = [line('a', { araz: 1, bravo: 5 }), line('b', { araz: 5, bravo: 1 }), line('c', { araz: 1, bravo: 1 })];
    const plan = splitPlan(lines as never, stores as never, 2);
    expect(plan).not.toBeNull();
    expect(plan!.total).toBe(3);
    expect(plan!.saving).toBe(4);
    expect(plan!.a.lines.length + plan!.b.lines.length).toBe(3);
  });
  it('stays quiet when the second trip is not worth it', () => {
    const stores = [store('araz'), store('bravo')] as never[];
    const lines = [line('a', { araz: 1, bravo: 1.5 }), line('b', { araz: 1.5, bravo: 1 })];
    expect(splitPlan(lines as never, stores as never, 2)).toBeNull();
  });
});
