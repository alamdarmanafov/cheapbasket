import { applyStorePrefs, DEFAULT_PREFS } from '../lib/storePrefs';
import { Branch, Store } from '../data/products';

const store = (id: string): Store => ({ id, name: id, color: '#000', initial: id[0] });
const branch = (storeId: string, distanceKm: number): Branch => ({ id: `${storeId}-${distanceKm}`, storeId, name: '', address: '', lat: 0, lng: 0, openUntil: '', mapsUrl: null, phone: null, openFrom: null, alwaysOpen: false, distanceKm, walkMinutes: 0 });
const stores = [store('araz'), store('bravo'), store('wolt')];
const branches = [branch('araz', 0.8), branch('bravo', 4.5), branch('araz', 9)];

describe('applyStorePrefs', () => {
  it('keeps everything by default', () => {
    expect(applyStorePrefs(stores, branches, DEFAULT_PREFS, true)).toEqual({ stores, hidden: 0 });
  });
  it('keeps only the chosen stores', () => {
    const r = applyStorePrefs(stores, branches, { ...DEFAULT_PREFS, favorites: ['bravo'] }, true);
    expect(r.stores.map((s) => s.id)).toEqual(['bravo']);
    expect(r.hidden).toBe(2);
  });
  it('keeps only stores with a branch inside the radius, when the location is known', () => {
    const r = applyStorePrefs(stores, branches, { ...DEFAULT_PREFS, nearbyOnly: true, radiusKm: 3 }, true);
    expect(r.stores.map((s) => s.id)).toEqual(['araz']);
    expect(applyStorePrefs(stores, branches, { ...DEFAULT_PREFS, nearbyOnly: true, radiusKm: 3 }, false).hidden).toBe(0);
  });
  it('ignores a filter that would leave nothing', () => {
    expect(applyStorePrefs(stores, branches, { ...DEFAULT_PREFS, favorites: ['nowhere'] }, true).hidden).toBe(0);
    expect(applyStorePrefs(stores, branches, { ...DEFAULT_PREFS, nearbyOnly: true, radiusKm: 2 }, true).stores.map((s) => s.id)).toEqual(['araz']);
    expect(applyStorePrefs([store('wolt')], branches, { ...DEFAULT_PREFS, nearbyOnly: true, radiusKm: 2 }, true).hidden).toBe(0);
  });
  it('stacks both filters', () => {
    const r = applyStorePrefs(stores, branches, { favorites: ['araz', 'bravo'], nearbyOnly: true, radiusKm: 5 }, true);
    expect(r.stores.map((s) => s.id)).toEqual(['araz', 'bravo']);
  });
});
