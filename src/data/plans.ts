export type PlanId = 'free' | 'plus';

export interface PlanFeature {
  emoji: string;
  label: string;
}

export const FREE_FEATURES: PlanFeature[] = [
  { emoji: '🛒', label: '1 səbət' },
  { emoji: '💰', label: 'Qiymət müqayisəsi' },
  { emoji: '🏆', label: 'Ən sərfəli market' },
  { emoji: '📍', label: 'Yaxın filial' },
  { emoji: '📷', label: 'Barkod skanı' },
  { emoji: '🤳', label: 'Gündə 1 şəkillə tanıma' },
];

export const PLUS_FEATURES: PlanFeature[] = [
  { emoji: '🛒', label: 'Limitsiz səbət' },
  { emoji: '📊', label: 'Qiymət tarixçəsi' },
  { emoji: '🔔', label: 'Qiymət düşüşü bildirişi' },
  { emoji: '🤖', label: 'AI tövsiyələri' },
  { emoji: '💚', label: 'Qənaət statistikası' },
  { emoji: '🤖', label: 'Hər gün AI endirim xəbəri' },
  { emoji: '🤳', label: 'Limitsiz şəkillə məhsul tanıma' },
];

export const PLUS_PRICING = {
  monthly: { price: 1.99, label: '1.99 $ / ay' },
  yearly: { price: 9.99, label: '9.99 $ / il', note: 'İki aydan çox pulsuz' },
} as const;
