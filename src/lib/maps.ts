import { Linking, Platform } from 'react-native';
import type { Branch } from '@/data/products';

/**
 * Google Maps through an https link rather than the comgooglemaps:// scheme.
 *
 * On iOS the universal link opens the Google Maps app when it is installed and
 * falls back to Google Maps on the web when it is not — with no
 * LSApplicationQueriesSchemes entry and so no rebuild needed to change it.
 */
const GOOGLE = 'https://www.google.com/maps';

/** One branch: its own maps link when the admin saved one, otherwise directions to its coordinates. */
export function openBranch(b: Branch): void {
  const url =
    b.mapsUrl ||
    Platform.select({
      ios: `maps://maps.apple.com/?daddr=${b.lat},${b.lng}`,
      default: `${GOOGLE}?q=${b.lat},${b.lng}`,
    })!;
  Linking.openURL(url).catch(() => Linking.openURL(`${GOOGLE}?q=${b.lat},${b.lng}`).catch(() => undefined));
}
