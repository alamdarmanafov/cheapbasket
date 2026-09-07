/** Public URLs used in share texts. Override the web app origin per build with EXPO_PUBLIC_WEB_URL. */
export const SITE_URL = 'https://cheapmarket.app';
export const WEB_APP_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://cheapbasket.vercel.app').replace(/\/$/, '');
