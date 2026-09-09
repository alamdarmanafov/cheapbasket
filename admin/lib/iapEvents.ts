import { IapEvent } from './supabase';

/**
 * A paid period: the first purchase, a renewal, or a resubscribe.
 *
 * `verify` is deliberately excluded. The app posts it after a purchase *and* on
 * every "restore purchases" and launch check, so counting it would report a
 * user who simply reopened the app ten times as ten payments.
 *
 * Apple sends notificationType (with an optional subtype); Google's route
 * encodes its numeric type as `google/<type>/<state>` — 4 purchased,
 * 2 renewed, 1 recovered, 7 restarted.
 */
export const isPaidEvent = (e: string): boolean =>
  /^SUBSCRIBED/i.test(e) || /^DID_RENEW/i.test(e) || /^OFFER_REDEEMED/i.test(e) || /^google\/(1|2|4|7)\//.test(e);

/** Money going back to the user: an Apple refund/revoke, or Google's revoked (12). */
export const isRefundEvent = (e: string): boolean =>
  /^REFUND/i.test(e) || /^REVOKE/i.test(e) || /^google\/12\//.test(e);

export interface PaymentSummary {
  paid: number;
  refunds: number;
  last: string | null;
  platform: string | null;
  events: IapEvent[];
}

/** Groups the raw event log into a per-user payment summary. */
export function summarise(events: IapEvent[]): Map<string, PaymentSummary> {
  const out = new Map<string, PaymentSummary>();
  for (const e of events) {
    if (!e.user_id) continue;
    const s = out.get(e.user_id) ?? { paid: 0, refunds: 0, last: null, platform: null, events: [] };
    s.events.push(e);
    if (isPaidEvent(e.event)) {
      s.paid++;
      if (!s.last || e.created_at > s.last) {
        s.last = e.created_at;
        s.platform = e.platform;
      }
    }
    if (isRefundEvent(e.event)) s.refunds++;
    out.set(e.user_id, s);
  }
  // Newest first, so the detail list reads as a history.
  for (const s of out.values()) s.events.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return out;
}
