import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme';
import { Card, Chip, Divider, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StoreAvatar } from '@/components/product';
import { useT } from '@/lib/i18n';
import { useCatalog } from '@/store/catalog';
import { useAuth } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { setStorePrefs, useStorePrefs } from '@/lib/storePrefs';

const RADII = [2, 3, 5, 10];

/** Which stores the comparison considers: a chosen set, and/or only the ones with a branch nearby. */
export default function Stores() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const cat = useCatalog();
  const auth = useAuth();
  const prefs = useStorePrefs();
  const chosen = new Set(prefs.favorites ?? cat.stores.map((s) => s.id));
  const all = !prefs.favorites;

  // A copy on the profile, for the record; the device stays the source of truth.
  useEffect(() => {
    if (!supabase || !auth.user) return;
    supabase.from('profiles').upsert({ user_id: auth.user.id, favorite_stores: prefs.favorites ?? cat.stores.map((s) => s.id) }).then(() => undefined, () => undefined);
  }, [prefs.favorites, auth.user, cat.stores]);

  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // Everything ticked is the same as no filter; storing it as a list would
    // quietly exclude any store added later.
    setStorePrefs({ favorites: next.size >= cat.stores.length ? null : [...next] });
  };

  const nearestKm = (storeId: string) => {
    const b = cat.branches.filter((x) => x.storeId === storeId).sort((a, c) => a.distanceKm - c.distanceKm)[0];
    return b ? b.distanceKm : null;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t('stores.title')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }}>
        <Txt v="caption" color={colors.gray}>
          {t('stores.intro')}
        </Txt>

        <Card style={{ marginTop: space.md, paddingVertical: space.xs }}>
          <Pressable onPress={() => setStorePrefs({ favorites: null })} style={styles.row} accessibilityRole="radio" accessibilityState={{ selected: all }}>
            <Ionicons name={all ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={all ? colors.success : colors.grayLight} />
            <Txt v="bodyStrong" style={{ marginLeft: 12, flex: 1 }}>
              {t('stores.all')}
            </Txt>
          </Pressable>
          {cat.stores.map((s) => {
            const on = chosen.has(s.id);
            const km = nearestKm(s.id);
            return (
              <React.Fragment key={s.id}>
                <Divider />
                <Pressable onPress={() => toggle(s.id)} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.grayLight} />
                  <StoreAvatar store={s} size={28} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Txt v="body" style={{ fontSize: 14 }}>
                      {s.name}
                    </Txt>
                    {km != null && cat.locationGranted === true && (
                      <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
                        {t('stores.nearest', { km: km.toFixed(1) })}
                      </Txt>
                    )}
                  </View>
                </Pressable>
              </React.Fragment>
            );
          })}
        </Card>

        <Card style={{ marginTop: space.lg }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: space.md }}>
              <Txt v="bodyStrong">{t('stores.nearbyOnly')}</Txt>
              <Txt v="caption" color={colors.gray} style={{ marginTop: 2 }}>
                {cat.locationGranted === true ? t('stores.nearbyBody') : t('stores.nearbyNeedsLocation')}
              </Txt>
            </View>
            <Switch value={prefs.nearbyOnly} onValueChange={(v) => { setStorePrefs({ nearbyOnly: v }); }} trackColor={{ true: colors.primary, false: colors.line }} thumbColor={colors.white} />
          </Row>
          {prefs.nearbyOnly && (
            <Row gap={8} style={{ marginTop: space.md, flexWrap: 'wrap' }}>
              {RADII.map((r) => (
                <Chip key={r} text={`${r} km`} active={prefs.radiusKm === r} onPress={() => setStorePrefs({ radiusKm: r })} />
              ))}
            </Row>
          )}
          {cat.locationGranted !== true && (
            <Pressable onPress={() => cat.requestLocation({ interactive: true })} style={{ marginTop: space.md }} accessibilityRole="button">
              <Txt v="captionStrong" color={colors.primary}>
                {t('markets.enableLocation')}
              </Txt>
            </Pressable>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
});
