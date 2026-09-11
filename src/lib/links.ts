/** Public site URL used in share texts (the app is distributed via App Store / Google Play; no public web build). */
export const SITE_URL = 'https://cheapmarket.app';

/** Public page for one product — the link a share carries, and what opens the app when it is installed. */
export const productUrl = (id: string) => `${SITE_URL}/p?id=${encodeURIComponent(id)}`;
