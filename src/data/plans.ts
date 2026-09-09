export type PlanId = 'free' | 'plus';

/** Fallback prices, used only until the store reports the real localised ones. */
export const PLUS_PRICING = {
  monthly: { price: 1.99, label: '1.99 $' },
  yearly: { price: 9.99, label: '9.99 $', note: 'plus.yearlyNote' as const },
} as const;
