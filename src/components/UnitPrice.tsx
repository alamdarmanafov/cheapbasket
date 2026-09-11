import React from 'react';
import { colors } from '@/theme';
import { Txt } from './ui';
import { useT } from '@/lib/i18n';
import { unitPrice } from '@/lib/unitPrice';

/** "4.80 ₼/kq" next to a price, when the packet size allows it. Renders nothing otherwise. */
export function UnitPrice({ price, size, color = colors.gray, fontSize = 11 }: { price: number | null | undefined; size: string | null | undefined; color?: string; fontSize?: number }) {
  const t = useT();
  const u = unitPrice(price, size);
  if (!u) return null;
  const unit = u.unit === 'kg' ? t('unit.kg') : u.unit === 'l' ? t('unit.l') : t('unit.pc');
  return (
    <Txt v="caption" color={color} style={{ fontSize }} num>
      {u.per.toFixed(2)} ₼/{unit}
    </Txt>
  );
}
