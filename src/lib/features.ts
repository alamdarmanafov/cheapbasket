import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Switches the admin flips in `app_settings` without shipping a build.
 *
 * Read once per launch and shared: a screen that asks after another already
 * did gets the answer at once. Missing rows count as off — a feature the
 * table does not mention is a feature nobody turned on.
 */
let receipts: boolean | null = null;
let pending: Promise<boolean> | null = null;

export function receiptsEnabled(): Promise<boolean> {
  if (receipts != null) return Promise.resolve(receipts);
  if (pending) return pending;
  if (!supabase) return Promise.resolve(false);
  const p = Promise.resolve(supabase.from('app_settings').select('value').eq('key', 'receipts').maybeSingle())
    .then(({ data }) => {
      receipts = (data?.value as { enabled?: boolean } | null)?.enabled === true;
      return receipts;
    })
    .catch(() => false)
    .finally(() => {
      pending = null;
    });
  pending = p;
  return p;
}

/** False until the setting has been read, so nothing shows and then vanishes. */
export function useReceiptsEnabled(): boolean {
  const [on, setOn] = useState(receipts === true);
  useEffect(() => {
    let alive = true;
    receiptsEnabled().then((v) => alive && setOn(v));
    return () => {
      alive = false;
    };
  }, []);
  return on;
}
