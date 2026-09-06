import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BRANCHES, PRODUCTS, Product, Branch, catalog } from '@/data/products';
import { fetchBranches, fetchProducts } from '@/lib/catalog';
import { hasSupabase } from '@/lib/supabase';

interface CatalogState {
  products: Product[];
  branches: Branch[];
  loading: boolean;
  source: 'mock' | 'supabase';
  refresh: () => Promise<void>;
}

const Ctx = createContext<CatalogState | null>(null);

/** Loads the catalog from Supabase (when configured) and publishes it to the registry + screens. */
export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [branches, setBranches] = useState<Branch[]>(BRANCHES);
  const [loading, setLoading] = useState(hasSupabase);
  const [source, setSource] = useState<'mock' | 'supabase'>('mock');

  const refresh = async () => {
    if (!hasSupabase) return;
    setLoading(true);
    try {
      // Never block the UI on a slow/blocked network: fall back to the bundled catalog after 8s.
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('catalog timeout')), 8000));
      const [p, b] = await Promise.race([Promise.all([fetchProducts(), fetchBranches()]), timeout]);
      if (p.length) {
        catalog.products = p;
        setProducts(p);
        setSource('supabase');
      }
      if (b.length) {
        catalog.branches = b;
        setBranches(b);
      }
    } catch {
      setSource('mock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo(() => ({ products, branches, loading, source, refresh }), [products, branches, loading, source]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalog(): CatalogState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCatalog must be used inside CatalogProvider');
  return ctx;
}
