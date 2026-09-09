import { Linking, Platform } from 'react-native';
import type { Branch, LatLng } from '@/data/products';

/**
 * Google Maps through an https link rather than the comgooglemaps:// scheme.
 *
 * On iOS the universal link opens the Google Maps app when it is installed and
 * falls back to Google Maps on the web when it is not — with no
 * LSApplicationQueriesSchemes entry and so no rebuild needed to change it.
 */
const GOOGLE = 'https://www.google.com/maps';

/** Names like "Araz" are ambiguous on their own; "Al market" already says what it is. */
function searchTerm(storeName: string): string {
  return /market|store|mağaza|supermarket/i.test(storeName) ? storeName : `${storeName} supermarket`;
}

/**
 * Opens Google Maps on the chain's branches around the shopper.
 *
 * Google's own listing is used here rather than our branch table: it carries
 * every branch of the chain, not just the ones an admin has entered, and it
 * comes with live navigation. Without a known position Google falls back to the
 * device's own location.
 */
export function openStoreBranches(storeName: string, at?: LatLng | null): void {
  const q = encodeURIComponent(searchTerm(storeName));
  const url = at ? `${GOOGLE}/search/${q}/@${at.lat},${at.lng},13z` : `${GOOGLE}/search/${q}`;
  Linking.openURL(url).catch(() => undefined);
}

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
