/** Normalised product from any market provider. */
export interface MarketProduct {
  external_id: string;
  name: string;
  brand: string;
  category: string | null;
  barcode: string | null;
  quantity: string;    // e.g. "1", "3"
  unit: string;        // e.g. "L", "kg", "ədəd"
  price: number;
  old_price: number | null;
  discount: boolean;
  image_url: string | null;
  product_url: string | null;
  market: string;      // market slug
  last_updated: string; // ISO timestamp
}

export interface ProviderResult {
  market: string;
  products: MarketProduct[];
  error?: string;
}

export interface MarketProvider {
  market: string;  // slug
  name: string;
  fetch(): Promise<ProviderResult>;
}
