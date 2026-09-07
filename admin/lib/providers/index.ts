export type { MarketProduct, ProviderResult, MarketProvider } from './types';
export { ArazProvider } from './araz';
export { BazarstoreProvider } from './bazarstore';
export { BravoProvider } from './bravo';
export { NeptunProvider } from './neptun';
export { OBAProvider } from './oba';
export { SparProvider } from './spar';
export { TamStoreProvider } from './tamstore';

import { ArazProvider } from './araz';
import { BazarstoreProvider } from './bazarstore';
import { BravoProvider } from './bravo';
import { NeptunProvider } from './neptun';
import { OBAProvider } from './oba';
import { SparProvider } from './spar';
import { TamStoreProvider } from './tamstore';
import type { MarketProvider } from './types';

export const ALL_PROVIDERS: MarketProvider[] = [
  ArazProvider,
  BazarstoreProvider,
  BravoProvider,
  NeptunProvider,
  OBAProvider,
  SparProvider,
  TamStoreProvider,
];

export function getProvider(market: string): MarketProvider | undefined {
  return ALL_PROVIDERS.find((p) => p.market === market);
}
