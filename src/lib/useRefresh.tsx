import React, { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { colors } from '@/theme';
import { useCatalog } from '@/store/catalog';
import { useAuth } from '@/store/auth';

/**
 * Pull-to-refresh for any screen: reloads the live catalogue (stores, products, prices, banners)
 * and the user's profile, plus an optional screen-specific loader.
 */
export function useRefresh(extra?: () => Promise<unknown> | void) {
  const cat = useCatalog();
  const auth = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([cat.refresh(), auth.user ? auth.refreshProfile() : Promise.resolve(), extra ? extra() : Promise.resolve()]);
    } finally {
      setRefreshing(false);
    }
  }, [cat, auth, extra]);
  const control = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />;
  return { refreshing, onRefresh, control };
}
