/** Push segments (client-safe: no server imports). */
export type Segment = 'all' | 'plus' | 'free' | 'inactive7' | 'basket' | 'city' | 'no_basket';
export const SEGMENTS: Array<{ id: Segment; label: string }> = [
  { id: 'all', label: 'Hamısı' },
  { id: 'plus', label: 'Plus abunəçilər' },
  { id: 'free', label: 'Free istifadəçilər' },
  { id: 'basket', label: 'Səbətində məhsul olanlar' },
  { id: 'no_basket', label: 'Səbəti boş olanlar' },
  { id: 'inactive7', label: '7 gündür girməyənlər' },
  { id: 'city', label: 'Şəhər üzrə' },
];
