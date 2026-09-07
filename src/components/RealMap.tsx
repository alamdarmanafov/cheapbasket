import React from 'react';
import { View } from 'react-native';
import { Branch, catalog } from '@/data/products';
import { MiniMap } from './MiniMap';

/** Screenshot/demo builds render the drawn map instead of the Google embed (no network, no map labels). */
const STATIC_MAP = process.env.EXPO_PUBLIC_STATIC_MAP === '1';

/**
 * Web build: Google Maps embed (no API key). Shows the selected branch pin; the native build
 * (RealMap.native.tsx) renders Apple/Google Maps with every branch of the store.
 */
export function RealMap({ width, height, branch, interactive = true, radius = 0 }: { width: number; height: number; branch: Branch; others?: Branch[]; interactive?: boolean; radius?: number }) {
  const me = catalog.location;
  if (STATIC_MAP) {
    return (
      <View style={{ width, height, borderRadius: radius, overflow: 'hidden' }} pointerEvents={interactive ? 'auto' : 'none'}>
        <MiniMap width={width} height={height} branch={branch} labels={false} />
      </View>
    );
  }
  const src = `https://www.google.com/maps?q=${branch.lat},${branch.lng}&z=15&hl=az&output=embed`;
  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: '#EAF0EA' }} pointerEvents={interactive ? 'auto' : 'none'}>
      {React.createElement('iframe', { src, title: `${branch.name} — ${me.lat},${me.lng}`, style: { border: 0, width, height }, loading: 'lazy', allowFullScreen: false, referrerPolicy: 'no-referrer-when-downgrade' })}
    </View>
  );
}
