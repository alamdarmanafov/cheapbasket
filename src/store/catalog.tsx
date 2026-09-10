import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { Product, Branch, Banner, Store, LatLng, DEFAULT_LOCATION, catalog, withDistances, withStoreHours } from '@/data/products';
import { fetchBanners, fetchBranches, fetchCategories, fetchProducts, fetchStores } from '@/lib/catalog';
import { tr } from '@/lib/i18n';
import { hasSupabase, supabase } from '@/lib/supabase';
import { notify } from '@/lib/confirm';

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
  /** `interactive` = the user tapped; explains a denied permission instead of staying silent. */
  /** `prompt: false` never shows the OS dialog — it only uses an already-granted permission. */
  requestLocation: (opts?: { interactive?: boolean; prompt?: boolean }) => Promise<void>;
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

    // Each source lands on screen as it arrives instead of everything waiting on
    // the slowest. The home screen needs the stores, the banner and the
    // categories — a few dozen rows between them — but it used to sit behind the
    // whole product catalogue, which is thousands of rows and most of the wait.
    const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
    const deadline = <T,>(p: Promise<T>): Promise<T> =>
      Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(tr('err.network'))), 15000))]);

    const storesP = deadline(fetchStores()).then((s) => {
      catalog.stores = s;
      setStores(s);
      return s;
    });

    const jobs: Promise<unknown>[] = [
      storesP.catch(fail),
      deadline(fetchCategories()).then((cs) => { catalog.categories = cs; }).catch(() => undefined),
      deadline(fetchBanners()).then(setBanners).catch(() => undefined),
      deadline(fetchProducts())
        .then((p) => { catalog.products = p; setProducts(p); })
        .catch(fail),
      // Branches carry their store's hours, so they wait for the stores — not for
      // the catalogue.
      Promise.all([deadline(fetchBranches(catalog.location)), storesP])
        .then(([b, s]) => {
          // Distances are recomputed from the location as it stands *now*, not as
          // it stood when the fetch began: the position arriving mid-fetch would
          // otherwise be overwritten by this result, leaving every distance
          // measured from the default point in the city centre.
          const branches = withDistances(withStoreHours(b, s), catalog.location);
          catalog.branches = branches;
          setBranches(branches);
        })
        .catch(fail),
    ];

    await Promise.allSettled(jobs);
    setLoading(false);
  }, []);

  const requestLocation = useCallback(async (opts: { interactive?: boolean; prompt?: boolean } = {}) => {
    const prompt = opts.prompt ?? true;
    try {
      // Silent mode reads the existing grant; it must never raise the OS dialog.
      const { status, canAskAgain } = prompt
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Staying null when we never asked keeps "not decided yet" distinct from
        // "declined", so the branches view can still put the question once.
        if (!prompt) return;
        setLocationGranted(false);
        // Permanently denied → the only way to enable it is the OS settings.
        if (!canAskAgain && Platform.OS !== 'web') Linking.openSettings().catch(() => undefined);
        else if (opts.interactive) notify(tr('loc.blocked'), tr('loc.blockedWeb'));
        return;
      }
      setLocationGranted(true);
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
      if (prompt) setLocationGranted(false);
    }
  }, []);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => refresh(), 600);
  }, [refresh]);

  useEffect(() => {
    refresh();
    // No permission dialog on launch — the branches view asks when it needs it.
    requestLocation({ prompt: false });
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, scheduleRefresh)
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
