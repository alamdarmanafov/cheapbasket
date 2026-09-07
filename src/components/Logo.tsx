import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '@/theme';

/**
 * Brand mark: a "C" that becomes a basket on wheels, with a price tag.
 * Renders crisp at any size — used for the header, splash and empty states.
 */
export function LogoMark({ size = 40, color = colors.white, bg = colors.primary, rounded = true }: { size?: number; color?: string; bg?: string | null; rounded?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {bg && <Rect x={0} y={0} width={100} height={100} rx={rounded ? 24 : 0} fill={bg} />}
      {/* C / basket body */}
      <Path
        d="M66 30 H46 C33 30 24 39 24 51 C24 63 33 70 46 70 H70 L78 62"
        stroke={color}
        strokeWidth={11}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* wheels */}
      <Circle cx={42} cy={82} r={5.5} fill={color} />
      <Circle cx={62} cy={82} r={5.5} fill={color} />
      {/* price tag */}
      <Path d="M61 44 L71 34 L80 34 L80 43 L70 53 Z" fill={color} />
      <Circle cx={75} cy={39} r={2.2} fill={bg ?? colors.primary} />
    </Svg>
  );
}
