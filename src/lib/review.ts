import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';

const COUNT_KEY = 'cb_trip_count';
const ASKED_KEY = 'cb_review_asked';

/**
 * The store's "rate this app" sheet, once, after the third shopping trip.
 *
 * Three trips is someone the app has actually helped; earlier is a stranger,
 * later is a habit nobody interrupts. The OS decides whether the sheet really
 * appears (Apple shows it at most three times a year), so this only asks, and
 * never twice.
 */
export async function noteTripForReview(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const n = Number((await AsyncStorage.getItem(COUNT_KEY)) ?? '0') + 1;
    await AsyncStorage.setItem(COUNT_KEY, String(n));
    if (n < 3 || (await AsyncStorage.getItem(ASKED_KEY))) return;
    await AsyncStorage.setItem(ASKED_KEY, new Date().toISOString());
    if (await StoreReview.hasAction().catch(() => false)) setTimeout(() => StoreReview.requestReview().catch(() => undefined), 1500);
  } catch {
    // Nothing the person asked for depends on this.
  }
}
