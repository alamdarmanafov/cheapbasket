import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheCatalog, clearCatalogCache, readCatalogCache } from '../lib/cache';
import { Product } from '../data/products';

const product = (id: string, updatedMinutesAgo: number): Product => ({
  id, barcode: '', name: id, brand: '', size: '', category: 'c', emoji: '', tint: '', imageUrl: null, prices: { araz: 1 }, regularPrices: {}, history: [], updatedMinutesAgo,
});

beforeEach(async () => {
  jest.useFakeTimers();
  await clearCatalogCache();
});
afterEach(() => jest.useRealTimers());

describe('catalog cache', () => {
  it('coalesces several sources into one write and reads them back', async () => {
    cacheCatalog({ products: [product('a', 3)] });
    cacheCatalog({ stores: [{ id: 'araz', name: 'Araz', color: '#000', initial: 'A' }] });
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    const snap = await readCatalogCache();
    expect(snap?.products.map((p) => p.id)).toEqual(['a']);
    expect(snap?.stores.map((s) => s.id)).toEqual(['araz']);
  });
  it('ages prices by the time the snapshot sat on disk', async () => {
    const stored = { stores: [], products: [product('a', 3)], branches: [], banners: [], categories: [], savedAt: Date.now() - 120 * 60000 };
    await AsyncStorage.setItem('cb_catalog_v2', JSON.stringify(stored));
    const snap = await readCatalogCache();
    expect(snap?.products[0].updatedMinutesAgo).toBe(123);
  });
  it('refuses a snapshot older than a week', async () => {
    const stored = { stores: [], products: [product('a', 3)], branches: [], banners: [], categories: [], savedAt: Date.now() - 8 * 86400000 };
    await AsyncStorage.setItem('cb_catalog_v2', JSON.stringify(stored));
    expect(await readCatalogCache()).toBeNull();
  });
});
