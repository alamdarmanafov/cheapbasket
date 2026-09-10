import { tr } from './i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ErrorCode, useIAP, type Purchase, type ProductSubscription } from 'expo-iap';
import { notify } from './confirm';
import { celebrate } from './celebrate';
import { useAuth } from '@/store/auth';
import { API_URL, PLUS_SKUS, PLUS_SKU_LIST, PlusPeriod, PlusStore, verifyWithServer } from './plusStore';

const isPlusSku = (id: string | null | undefined) => !!id && PLUS_SKU_LIST.includes(id);

/** Build the server verification body for a store purchase. */
function verifyBody(p: Purchase) {
  if (Platform.OS === 'ios') return { platform: 'apple' as const, transactionId: p.id };
  return { platform: 'google' as const, productId: p.productId, purchaseToken: p.purchaseToken ?? '' };
}

/** Localised price label from the store, e.g. "1,99 US$". */
function priceOf(subs: ProductSubscription[], sku: string): string | undefined {
  const s = subs.find((x) => x.id === sku);
  return s?.displayPrice || undefined;
}

/**
 * Native (iOS/Android) subscription purchase via StoreKit 2 / Google Play Billing.
 * Flow: requestPurchase → store sheet → onPurchaseSuccess → server verifies with Apple/Google → profile gets Plus → finishTransaction.
 */
export function usePlusStore(): PlusStore {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const restoring = useRef(false);
  const purchasesRef = useRef<Purchase[]>([]);

  const { connected, subscriptions, fetchProducts, requestPurchase, finishTransaction, getAvailablePurchases, availablePurchases } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      if (!isPlusSku(purchase.productId)) return;
      try {
        const r = await verifyWithServer(verifyBody(purchase));
        await auth.refreshProfile();
        if (r.active) celebrate(tr('iap.activeTitle'), tr('iap.activeBody'));
        else setError(tr('iap.pendingBody'));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        // The transaction is finished whether or not our server could confirm it.
        //
        // It used to be finished only after a successful verification, so a
        // server-side failure left it sitting in the store's queue — and the
        // store refuses to start a new purchase of a product that already has an
        // unfinished one. That is the "Failed to request purchase" that followed
        // every failed verification: the first attempt jammed the queue and every
        // later attempt was refused before it began.
        //
        // Nothing is lost by finishing: a subscription's entitlement lives with
        // the store account, so "Alışları bərpa et" reads it back and verifies it
        // again once the server side is working.
        await finishTransaction({ purchase }).catch(() => undefined);
        setBusy(false);
      }
    },
    onPurchaseError: (e) => {
      setBusy(false);
      if (e.code === ErrorCode.UserCancelled) return;
      setError(e.message || tr('iap.failed'));
    },
    onError: (e) => setError(e.message),
  });

  // Load store products once connected.
  useEffect(() => {
    if (!connected) return;
    fetchProducts({ skus: PLUS_SKU_LIST, type: 'subs' })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoaded(true));
  }, [connected, fetchProducts]);

  const prices = useMemo<Partial<Record<PlusPeriod, string>>>(
    () => ({ monthly: priceOf(subscriptions, PLUS_SKUS.monthly), yearly: priceOf(subscriptions, PLUS_SKUS.yearly) }),
    [subscriptions],
  );

  const buy = useCallback(
    async (period: PlusPeriod) => {
      const sku = PLUS_SKUS[period];
      setError(null);
      if (!connected) {
        setError(tr('iap.noStore'));
        return;
      }
      if (!API_URL) {
        setError(tr('iap.noServer'));
        return;
      }
      setBusy(true);
      try {
        const sub = subscriptions.find((s) => s.id === sku);
        const offerToken = sub && 'subscriptionOfferDetailsAndroid' in sub ? (sub as { subscriptionOfferDetailsAndroid?: Array<{ offerToken: string }> | null }).subscriptionOfferDetailsAndroid?.[0]?.offerToken : undefined;
        await requestPurchase({
          type: 'subs',
          request: {
            apple: { sku },
            google: { skus: [sku], subscriptionOffers: offerToken ? [{ sku, offerToken }] : [] },
          },
        });
        // Result arrives in onPurchaseSuccess / onPurchaseError.
      } catch (e) {
        setBusy(false);
        setError((e as Error).message);
      }
    },
    [connected, subscriptions, requestPurchase],
  );

  /** Re-verify every Plus purchase on this store account (restore on a new phone, renewals). */
  const verifyAll = useCallback(
    async (purchases: Purchase[], silent: boolean) => {
      const mine = purchases.filter((p) => isPlusSku(p.productId));
      if (!mine.length) {
        if (!silent) notify(tr('iap.noPurchase'), tr('iap.noPurchaseBody'));
        return;
      }
      let active = false;
      let lastErr: string | null = null;
      for (const p of mine) {
        try {
          const r = await verifyWithServer(verifyBody(p));
          active = active || r.active;
        } catch (e) {
          lastErr = (e as Error).message;
        }
      }
      await auth.refreshProfile();
      if (silent) return;
      if (active) celebrate(tr('iap.restored'), tr('iap.restoredBody'));
      else if (lastErr) setError(lastErr);
      else notify(tr('iap.notActive'), tr('iap.notActiveBody'));
    },
    [auth],
  );

  const restore = useCallback(async () => {
    if (!connected || !auth.user) {
      setError(auth.user ? tr('iap.noStoreShort') : tr('iap.signInFirst'));
      return;
    }
    setError(null);
    setBusy(true);
    restoring.current = true;
    try {
      await getAvailablePurchases();
      // Fallback in case the state update does not re-fire the effect below (e.g. still an empty list).
      setTimeout(() => {
        if (!restoring.current) return;
        restoring.current = false;
        verifyAll(purchasesRef.current, false).finally(() => setBusy(false));
      }, 1500);
    } catch (e) {
      restoring.current = false;
      setBusy(false);
      setError((e as Error).message);
    }
  }, [connected, auth.user, getAvailablePurchases, verifyAll]);

  // getAvailablePurchases resolves into `availablePurchases` state → finish the restore there.
  useEffect(() => {
    purchasesRef.current = availablePurchases;
    if (!restoring.current) return;
    restoring.current = false;
    verifyAll(availablePurchases, false).finally(() => setBusy(false));
  }, [availablePurchases, verifyAll]);

  return useMemo(
    () => ({ available: true, ready: connected && loaded, busy, error, prices, buy, restore }),
    [connected, loaded, busy, error, prices, buy, restore],
  );
}
