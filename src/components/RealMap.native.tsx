import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import Constants from 'expo-constants';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { Branch, catalog, getStore } from '@/data/products';
import { colors } from '@/theme';
import { Txt } from './ui';

/** Google Maps on Android always; on iOS too when GOOGLE_MAPS_IOS_KEY was baked into the build, otherwise Apple Maps. */
const iosGoogleKey = (Constants.expoConfig?.ios?.config as { googleMapsApiKey?: string } | undefined)?.googleMapsApiKey;
const PROVIDER = Platform.OS === 'android' || iosGoogleKey ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

/** Native map: user, the selected branch and the store's other branches. */
export function RealMap({ width, height, branch, others = [], interactive = true, radius = 0 }: { width: number; height: number; branch: Branch; others?: Branch[]; interactive?: boolean; radius?: number }) {
  const me = catalog.location;
  const ref = useRef<MapView>(null);
  const store = getStore(branch.storeId);

  // Fit user + selected branch whenever the target changes.
  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.fitToCoordinates(
        [
          { latitude: me.lat, longitude: me.lng },
          { latitude: branch.lat, longitude: branch.lng },
        ],
        { edgePadding: { top: 90, right: 60, bottom: interactive ? 320 : 60, left: 60 }, animated: true },
      );
    }, 300);
    return () => clearTimeout(t);
  }, [branch.id, branch.lat, branch.lng, me.lat, me.lng, interactive]);

  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden' }} pointerEvents={interactive ? 'auto' : 'none'}>
      <MapView
        ref={ref}
        provider={PROVIDER}
        style={{ width, height }}
        initialRegion={{ latitude: (me.lat + branch.lat) / 2, longitude: (me.lng + branch.lng) / 2, latitudeDelta: Math.max(0.02, Math.abs(me.lat - branch.lat) * 2.5), longitudeDelta: Math.max(0.02, Math.abs(me.lng - branch.lng) * 2.5) }}
        showsUserLocation
        showsMyLocationButton={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
      >
        <Polyline coordinates={[{ latitude: me.lat, longitude: me.lng }, { latitude: branch.lat, longitude: branch.lng }]} strokeColor={colors.primary} strokeWidth={3} lineDashPattern={[8, 6]} />
        {others
          .filter((b) => b.id !== branch.id)
          .map((b) => (
            <Marker key={b.id} coordinate={{ latitude: b.lat, longitude: b.lng }} title={b.name} description={b.address} opacity={0.75} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: getStore(b.storeId).color, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Txt style={{ color: '#fff', fontSize: 9, lineHeight: 11, fontWeight: '700' }}>{getStore(b.storeId).initial}</Txt>
              </View>
            </Marker>
          ))}
        <Marker coordinate={{ latitude: branch.lat, longitude: branch.lng }} title={branch.name} description={branch.address} pinColor={store.color} />
      </MapView>
    </View>
  );
}
