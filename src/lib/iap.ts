import { tr } from './i18n';
import { useCallback, useMemo } from 'react';
import { notify } from './confirm';
import { PlusStore } from './plusStore';

/**
 * Web build: there is no App Store / Google Play here, so purchases are unavailable.
 * The native implementation lives in ./iap.native.ts (picked automatically by Metro on iOS/Android).
 */
export function usePlusStore(): PlusStore {
  const buy = useCallback(async () => {
    notify(tr('iap.webBuy'), tr('iap.webBuyBody'));
  }, []);
  const restore = useCallback(async () => {
    notify(tr('iap.webRestore'), tr('iap.webRestoreBody'));
  }, []);
  return useMemo(() => ({ available: false, ready: false, busy: false, error: null, prices: {}, buy, restore }), [buy, restore]);
}
