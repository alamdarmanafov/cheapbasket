import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { fonts, radius, space } from '@/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { Btn, Card, Chip, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useCatalog } from '@/store/catalog';
import { useAuth } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/confirm';
import { track } from '@/lib/track';
import { haversineKm } from '@/data/products';
import { useT } from '@/lib/i18n';

/**
 * "There is a store right here and it is not on your map."
 *
 * The phone knows where it stands; the shopper picks the chain (or names a
 * new one), the address comes back from the coordinates, and the suggestion
 * waits for the admin, who makes it a branch and pays the points. If a
 * branch of that chain already sits within 150 m the screen says so
 * instead of collecting a duplicate.
 */
export default function AddBranch() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useStyles();
  const cat = useCatalog();
  const auth = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [newStore, setNewStore] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);

  const locate = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        notify(t('addBranch.noLocation'), t('addBranch.noLocationBody'));
        return;
      }
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? null });
      if (Platform.OS !== 'web' && !address) {
        const [geo] = await Location.reverseGeocodeAsync({ latitude: p.coords.latitude, longitude: p.coords.longitude }).catch(() => []);
        if (geo) setAddress([geo.street ? `${geo.street}${geo.streetNumber ? ` ${geo.streetNumber}` : ''}` : geo.name, geo.district || geo.subregion, geo.city].filter(Boolean).join(', '));
      }
    } catch {
      notify(t('addBranch.noLocation'), t('addBranch.noLocationBody'));
    } finally {
      setLocating(false);
    }
  };
  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A branch of the chosen chain already here? Say so before the form is filled.
  const nearby = pos && storeId ? cat.branches.filter((b) => b.storeId === storeId).map((b) => ({ b, km: haversineKm(pos, { lat: b.lat, lng: b.lng }) })).sort((a, b) => a.km - b.km)[0] : null;
  const duplicate = nearby && nearby.km < 0.15 ? nearby.b : null;

  const canSend = !!pos && (!!storeId || newStore.trim().length >= 2) && !duplicate && !busy;

  const send = async () => {
    if (!supabase || !pos) return;
    if (!auth.user) return router.push('/auth');
    setBusy(true);
    const { error } = await supabase.from('branch_suggestions').insert({
      user_id: auth.user.id,
      store_id: storeId,
      store_name: storeId ? null : newStore.trim(),
      name: name.trim() || null,
      address: address.trim() || null,
      lat: pos.lat,
      lng: pos.lng,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) return notify(t('common.error'), error.message.replace(/^.*?: /, ''));
    track('branch_suggest', { store_id: storeId, new_store: !storeId });
    notify(t('addBranch.sentTitle'), t('addBranch.sentBody'));
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t('addBranch.title')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
          <Txt v="caption" color={colors.gray}>{t('addBranch.body')}</Txt>

          {/* Where */}
          <Card style={{ marginTop: space.md }}>
            <Row gap={10}>
              <Ionicons name={pos ? 'location' : 'location-outline'} size={20} color={pos ? colors.success : colors.gray} />
              <View style={{ flex: 1 }}>
                <Txt v="captionStrong">{pos ? t('addBranch.located', { m: pos.accuracy != null ? Math.round(pos.accuracy) : 0 }) : locating ? t('addBranch.locating') : t('addBranch.notLocated')}</Txt>
                {pos && (
                  <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
                    {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                  </Txt>
                )}
              </View>
              <Btn title={t('addBranch.relocate')} variant="secondary" size="md" full={false} loading={locating} onPress={locate} />
            </Row>
          </Card>

          {/* Which chain */}
          <Txt v="bodyStrong" style={{ marginTop: space.lg, marginBottom: space.sm }}>{t('addBranch.store')}</Txt>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {cat.stores.map((s) => (
              <Chip key={s.id} text={s.name} active={storeId === s.id} onPress={() => { setStoreId(s.id); setNewStore(''); }} />
            ))}
            <Chip text={t('addBranch.otherStore')} active={storeId === null && newStore.length > 0} onPress={() => setStoreId(null)} />
          </Row>
          {storeId === null && (
            <TextInput value={newStore} onChangeText={setNewStore} placeholder={t('addBranch.otherStorePh')} placeholderTextColor={colors.grayLight} style={styles.input} testID="new-store" />
          )}
          {duplicate && (
            <Row gap={8} style={styles.warn}>
              <Ionicons name="alert-circle" size={18} color={colors.warning} />
              <Txt v="caption" color={colors.warning} style={{ flex: 1 }}>{t('addBranch.duplicate', { name: duplicate.name, m: Math.round((nearby?.km ?? 0) * 1000) })}</Txt>
            </Row>
          )}

          {/* Details */}
          <Txt v="bodyStrong" style={{ marginTop: space.lg, marginBottom: space.sm }}>{t('addBranch.details')}</Txt>
          <TextInput value={name} onChangeText={setName} placeholder={t('addBranch.namePh')} placeholderTextColor={colors.grayLight} style={styles.input} />
          <TextInput value={address} onChangeText={setAddress} placeholder={t('addBranch.addressPh')} placeholderTextColor={colors.grayLight} style={styles.input} />
          <TextInput value={note} onChangeText={setNote} placeholder={t('addBranch.notePh')} placeholderTextColor={colors.grayLight} style={[styles.input, { minHeight: 64 }]} multiline />

          <Btn title={auth.user ? t('addBranch.send') : t('scan.suggestSignIn')} icon="paper-plane" disabled={!!auth.user && !canSend} loading={busy} onPress={send} style={{ marginTop: space.lg }} />
          <Txt v="caption" color={colors.grayLight} center style={{ marginTop: space.sm }}>{t('addBranch.review')}</Txt>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  input: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, fontFamily: fonts.regular, color: colors.dark, marginTop: space.sm },
  warn: { marginTop: space.sm, backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: space.sm },
}));
