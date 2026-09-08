import React from 'react';
import { View } from 'react-native';
import { Branch } from '@/data/products';
import { MiniMap } from './MiniMap';

/** Native map: SVG-based mini map (no API key required). */
export function RealMap({
  width, height, branch, interactive = true, radius = 0,
}: {
  width: number; height: number; branch: Branch;
  others?: Branch[]; allBranches?: Branch[];
  interactive?: boolean; radius?: number;
  onBranchPress?: (b: Branch) => void;
}) {
  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden' }} pointerEvents={interactive ? 'auto' : 'none'}>
      <MiniMap width={width} height={height} branch={branch} labels={!interactive} />
    </View>
  );
}
