import React from 'react';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Branch, catalog, getStore } from '@/data/products';
import { colors } from '@/theme';

/**
 * Stylised street map drawn with SVG — no API key, works on web and native.
 * Production swaps this for react-native-maps and keeps the same pins/labels.
 */
export function MiniMap({ width, height, branch, showOthers = true, labels = true }: { width: number; height: number; branch: Branch; showOthers?: boolean; labels?: boolean }) {
  const me = catalog.location;
  // Scale the viewport so the selected branch always fits.
  const span = Math.max(0.03, Math.abs(branch.lng - me.lng) * 2.6, Math.abs(branch.lat - me.lat) * 3.4);
  const project = (lat: number, lng: number) => ({
    x: width / 2 + (lng - me.lng) * (width / span),
    y: height * 0.58 - (lat - me.lat) * (height / (span * 0.75)),
  });
  const user = project(me.lat, me.lng);
  const target = project(branch.lat, branch.lng);
  const midX = (user.x + target.x) / 2;
  const route = `M ${user.x} ${user.y} L ${midX} ${user.y} L ${midX} ${target.y} L ${target.x} ${target.y}`;

  const streets: React.ReactNode[] = [];
  for (let x = 20; x < width; x += 64) streets.push(<Line key={`v${x}`} x1={x} y1={0} x2={x} y2={height} stroke="#FFFFFF" strokeWidth={x % 128 === 20 ? 9 : 4} />);
  for (let y = 30; y < height; y += 72) streets.push(<Line key={`h${y}`} x1={0} y1={y} x2={width} y2={y} stroke="#FFFFFF" strokeWidth={y % 144 === 30 ? 9 : 4} />);
  const pinScale = height > 300 ? 1 : 0.75;

  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill="#EAF0EA" />
      <Rect x={width * 0.62} y={height * 0.08} width={width * 0.3} height={height * 0.18} rx={14} fill="#D6E8D2" />
      <Rect x={width * 0.05} y={height * 0.7} width={width * 0.32} height={height * 0.14} rx={14} fill="#D6E8D2" />
      <Rect x={width * 0.3} y={height * 0.2} width={width * 0.2} height={height * 0.1} rx={10} fill="#E8F0F4" />
      {streets}
      {showOthers &&
        catalog.branches.filter((b) => b.id !== branch.id).map((b) => {
          const p = project(b.lat, b.lng);
          return (
            <React.Fragment key={b.id}>
              <Circle cx={p.x} cy={p.y} r={11} fill={getStore(b.storeId).color} opacity={0.3} />
              <Circle cx={p.x} cy={p.y} r={5} fill={getStore(b.storeId).color} />
            </React.Fragment>
          );
        })}
      <Path d={route} stroke={colors.primary} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="9 7" />
      <Circle cx={user.x} cy={user.y} r={18} fill="#2587FF" opacity={0.15} />
      <Circle cx={user.x} cy={user.y} r={8} fill="#2587FF" stroke="#FFFFFF" strokeWidth={3} />
      {labels && (
        <SvgText x={user.x} y={user.y + 26} fontSize={11} fontWeight="700" fill="#2587FF" textAnchor="middle" fontFamily="Inter_700Bold">
          Sən
        </SvgText>
      )}
      <Path
        d={`M ${target.x} ${target.y} c ${-12 * pinScale} ${-16 * pinScale} ${-17 * pinScale} ${-23 * pinScale} ${-17 * pinScale} ${-31 * pinScale} a ${17 * pinScale} ${17 * pinScale} 0 1 1 ${34 * pinScale} 0 c 0 ${8 * pinScale} ${-5 * pinScale} ${15 * pinScale} ${-17 * pinScale} ${31 * pinScale} z`}
        fill={colors.primary}
        stroke="#FFFFFF"
        strokeWidth={3}
      />
      <Circle cx={target.x} cy={target.y - 31 * pinScale} r={6 * pinScale} fill="#FFFFFF" />
      {labels && (
        <>
          <Rect x={target.x - 48} y={target.y + 8} width={96} height={22} rx={11} fill="#FFFFFF" />
          <SvgText x={target.x} y={target.y + 23} fontSize={11} fontWeight="700" fill={colors.dark} textAnchor="middle" fontFamily="Inter_700Bold">
            {branch.name}
          </SvgText>
          <Rect x={target.x - 28} y={target.y - 48 * pinScale - 26} width={56} height={22} rx={11} fill={colors.dark} />
          <SvgText x={target.x} y={target.y - 48 * pinScale - 11} fontSize={10} fontWeight="700" fill="#FFFFFF" textAnchor="middle" fontFamily="Inter_700Bold">
            {branch.distanceKm} km
          </SvgText>
        </>
      )}
    </Svg>
  );
}
