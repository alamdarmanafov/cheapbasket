import { useCallback, useMemo } from 'react';
import { notify } from './confirm';
import { PlusStore } from './plusStore';

/**
 * Web build: there is no App Store / Google Play here, so purchases are unavailable.
 * The native implementation lives in ./iap.native.ts (picked automatically by Metro on iOS/Android).
 */
export function usePlusStore(): PlusStore {
  const buy = useCallback(async () => {
    notify('Tətbiqdən al', 'Plus abunəliyi App Store və ya Google Play vasitəsilə yalnız iOS/Android tətbiqində alına bilər.');
  }, []);
  const restore = useCallback(async () => {
    notify('Tətbiqdən bərpa et', 'Alışları bərpa etmək üçün iOS/Android tətbiqini aç.');
  }, []);
  return useMemo(() => ({ available: false, ready: false, busy: false, error: null, prices: {}, buy, restore }), [buy, restore]);
}
