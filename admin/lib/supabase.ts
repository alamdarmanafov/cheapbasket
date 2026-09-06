'use client';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const STORE_IDS = ['araz', 'bravo', 'neptun', 'bazarstore'] as const;
export type StoreId = (typeof STORE_IDS)[number];

export interface Store { id: string; name: string; color: string; initial: string }
export interface Product {
  id: string; barcode: string | null; name: string; brand: string; size: string; category: string;
  emoji: string | null; tint: string | null; image_url: string | null; rating: number | null;
}
export interface PriceRow { product_id: string; store_id: string; price: number | null; updated_at: string }
export interface Branch { id: string; store_id: string; name: string; address: string; lat: number; lng: number; open_until: string | null }
export interface AdminUser { id: string; email: string | null; created_at: string; last_sign_in_at: string | null; provider: string; display_name: string | null; plan: 'free' | 'plus'; city: string | null }

export const CATEGORIES = ['Süd məhsulları', 'Yumurta', 'Qida', 'İçkilər', 'Ət', 'Meyvə-tərəvəz', 'Çörək', 'Şirniyyat', 'Ev və gigiyena'];

export const slugify = (s: string) =>
  s.toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
