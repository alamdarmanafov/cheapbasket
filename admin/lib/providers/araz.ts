import { createWoltProvider } from './woltProvider';

// Araz Market — Wolt venue URL (update slug if it changes)
export const ArazProvider = createWoltProvider({
  market: 'araz',
  name: 'Araz',
  woltUrl: 'https://wolt.com/az/aze/baku/venue/araz',
});
