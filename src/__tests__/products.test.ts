import { Branch, catalog, isOpenNow, nearestBranch, stalestMinutes, storeProductCount, withDistances, Product } from '../data/products';

const branch = (over: Partial<Branch>): Branch => ({
  id: 'b', storeId: 'bravo', name: 'B', address: '', lat: 40.4, lng: 49.8, openUntil: '', mapsUrl: null, phone: null, openFrom: null, alwaysOpen: false, distanceKm: 0, walkMinutes: 0, ...over,
});
const product = (over: Partial<Product>): Product => ({
  id: 'p', barcode: '', name: 'P', brand: '', size: '', category: 'c', emoji: '', tint: '', imageUrl: null, prices: {}, regularPrices: {}, history: [], updatedMinutesAgo: 0, ...over,
});
/** A moment at the given Baku wall-clock time, whatever the machine's zone. */
const bakuAt = (h: number, m = 0) => new Date(Date.UTC(2026, 0, 15, h - 4, m));

describe('isOpenNow', () => {
  it('handles an ordinary day', () => {
    const b = branch({ openFrom: '08:00', openUntil: '23:00' });
    expect(isOpenNow(b, bakuAt(12))).toBe(true);
    expect(isOpenNow(b, bakuAt(23, 30))).toBe(false);
    expect(isOpenNow(b, bakuAt(7, 59))).toBe(false);
  });
  it('handles closing at midnight', () => {
    const b = branch({ openFrom: '08:00', openUntil: '00:00' });
    expect(isOpenNow(b, bakuAt(23, 59))).toBe(true);
    expect(isOpenNow(b, bakuAt(7))).toBe(false);
  });
  it('handles hours past midnight', () => {
    const b = branch({ openFrom: '09:00', openUntil: '02:00' });
    expect(isOpenNow(b, bakuAt(1))).toBe(true);
    expect(isOpenNow(b, bakuAt(3))).toBe(false);
    expect(isOpenNow(b, bakuAt(10))).toBe(true);
  });
  it('is always open when flagged, and unknown without hours', () => {
    expect(isOpenNow(branch({ alwaysOpen: true }), bakuAt(4))).toBe(true);
    expect(isOpenNow(branch({}), bakuAt(4))).toBeNull();
  });
});

describe('withDistances / nearestBranch', () => {
  it('sorts nearest first and measures from the given point', () => {
    const far = branch({ id: 'far', lat: 40.5, lng: 49.9 });
    const near = branch({ id: 'near', lat: 40.401, lng: 49.801 });
    const out = withDistances([far, near], { lat: 40.4, lng: 49.8 });
    expect(out.map((b) => b.id)).toEqual(['near', 'far']);
    expect(out[0].distanceKm).toBeLessThan(0.5);
    expect(out[0].walkMinutes).toBeGreaterThan(0);
  });
  it('finds the nearest branch of a store from the registry', () => {
    catalog.branches = withDistances([branch({ id: 'x', storeId: 'araz', lat: 40.6, lng: 49.9 }), branch({ id: 'y', storeId: 'araz', lat: 40.4, lng: 49.8 })], { lat: 40.4, lng: 49.8 });
    expect(nearestBranch('araz')?.id).toBe('y');
    expect(nearestBranch('none')).toBeUndefined();
  });
});

describe('storeProductCount / stalestMinutes', () => {
  it('counts products a store has a price for, and recomputes when the catalogue changes', () => {
    catalog.products = [product({ id: '1', prices: { bravo: 1, araz: null } }), product({ id: '2', prices: { bravo: 2 } })];
    expect(storeProductCount('bravo')).toBe(2);
    expect(storeProductCount('araz')).toBe(0);
    catalog.products = [product({ id: '3', prices: { araz: 5 } })];
    expect(storeProductCount('araz')).toBe(1);
    expect(storeProductCount('bravo')).toBe(0);
  });
  it('reports the oldest price among a set', () => {
    expect(stalestMinutes([product({ updatedMinutesAgo: 5 }), product({ updatedMinutesAgo: 90 })])).toBe(90);
    expect(stalestMinutes([])).toBe(0);
  });
});
