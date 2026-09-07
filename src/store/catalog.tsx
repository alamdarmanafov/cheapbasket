import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import { Product, Branch, Banner, Store, LatLng, DEFAULT_LOCATION, catalog, withDistances } from '@/data/products';
import { fetchBanners, fetchBranches, fetchProducts, fetchStores } from '@/lib/catalog';
import { hasSupabase, supabase } from '@/lib/supabase';

interface CatalogState {
  stores: Store[];
  products: Product[];
  branches: Branch[];
  banners: Banner[];
  location: LatLng;
  /** Human-readable place for the header (city / district), when known. */
  place: string | null;
  locationGranted: boolean | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  requestLocation: () => Promise<void>;
}

const Ctx = createContext<CatalogState | null>(null);

/** Loads stores/products/branches from Supabase and the device location; publishes both to the registry. */
export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [location, setLocation] = useState<LatLng>(DEFAULT_LOCATION);
  const [place, setPlace] = useState<string | null>(null);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(hasSupabase);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hasSupabase) return;
    setLoading(true);
    setError(null);
    try {
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Şəbəkə cavab vermir')), 10000));
      const [s, p, b, bn] = await Promise.race([
        Promise.all([fetchStores(), fetchProducts(), fetchBranches(catalog.location), fetchBanners().catch(() => [] as Banner[])]),
        timeout,
      ]);
      catalog.stores = s;
      catalog.products = p;
      catalog.branches = b;
      setStores(s);
      setProducts(p);
      setBranches(b);
      setBanners(bn);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const requestLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationGranted(status === 'granted');
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      catalog.location = loc;
      setLocation(loc);
      setBranches((prev) => {
        const next = withDistances(prev, loc);
        catalog.branches = next;
        return next;
      });
      if (Platform.OS !== 'web') {
        const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.lat, longitude: loc.lng }).catch(() => []);
        if (geo) setPlace([geo.district || geo.subregion, geo.city || geo.region].filter(Boolean).join(', ') || null);
      }
    } catch {
      setLocationGranted(false);
    }
  }, []);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => refresh(), 600);
  }, [refresh]);

  useEffect(() => {
    refresh();
    requestLocation();
    const db = supabase;
    if (!db) return;

    // 1) Realtime: any admin change to the catalog tables triggers a (debounced) reload.
    const channel = db
      .channel('catalog')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prices' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banners' }, scheduleRefresh)
      .subscribe();

    // 2) Coming back to the app refreshes too (covers devices without a live socket).
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleRefresh();
    });

    // 3) Safety net: periodic refresh every 5 minutes.
    const interval = setInterval(() => refresh(), 5 * 60 * 1000);

    return () => {
      db.removeChannel(channel);
      sub.remove();
      clearInterval(interval);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [refresh, requestLocation, scheduleRefresh]);

  const value = useMemo(
    () => ({ stores, products, branches, banners, location, place, locationGranted, loading, error, refresh, requestLocation }),
    [stores, products, branches, banners, location, place, locationGranted, loading, error, refresh, requestLocation],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalog(): CatalogState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCatalog must be used inside CatalogProvider');
  return ctx;
}
