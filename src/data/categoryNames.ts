import { activeLang, type Lang } from '@/lib/i18n';

/**
 * Display names for categories in the app's other languages.
 *
 * The category itself is one Azerbaijani string in the database — products carry
 * it, the admin panel edits it, and everything matches on it — so translating it
 * there would break every product's link to its category. The stored name stays
 * the key; only what the reader sees changes.
 *
 * A category the admin adds later simply shows its Azerbaijani name until it is
 * listed here, which is the right failure: a name nobody translated is better
 * than a blank chip.
 */
const NAMES: Record<string, { en: string; tr: string; ru: string }> = {
  'süd məhsulları': { en: 'Dairy', tr: 'Süt ürünleri', ru: 'Молочные продукты' },
  yumurta: { en: 'Eggs', tr: 'Yumurta', ru: 'Яйца' },
  qida: { en: 'Food', tr: 'Gıda', ru: 'Продукты' },
  içkilər: { en: 'Drinks', tr: 'İçecekler', ru: 'Напитки' },
  ət: { en: 'Meat', tr: 'Et', ru: 'Мясо' },
  'meyvə-tərəvəz': { en: 'Fruit & veg', tr: 'Meyve-sebze', ru: 'Фрукты и овощи' },
  çörək: { en: 'Bakery', tr: 'Ekmek', ru: 'Хлеб' },
  şirniyyat: { en: 'Sweets', tr: 'Tatlı', ru: 'Сладости' },
  'ev və gigiyena': { en: 'Home & hygiene', tr: 'Ev ve hijyen', ru: 'Дом и гигиена' },

  // Names that arrive with imported catalogues rather than from the seed list.
  balıq: { en: 'Fish', tr: 'Balık', ru: 'Рыба' },
  toyuq: { en: 'Chicken', tr: 'Tavuk', ru: 'Курица' },
  dondurma: { en: 'Ice cream', tr: 'Dondurma', ru: 'Мороженое' },
  konserv: { en: 'Tinned food', tr: 'Konserve', ru: 'Консервы' },
  makaron: { en: 'Pasta', tr: 'Makarna', ru: 'Макароны' },
  çay: { en: 'Tea', tr: 'Çay', ru: 'Чай' },
  qəhvə: { en: 'Coffee', tr: 'Kahve', ru: 'Кофе' },
  'uşaq qidası': { en: 'Baby food', tr: 'Bebek maması', ru: 'Детское питание' },
  təmizlik: { en: 'Cleaning', tr: 'Temizlik', ru: 'Уборка' },
  gigiyena: { en: 'Hygiene', tr: 'Hijyen', ru: 'Гигиена' },
  kosmetika: { en: 'Cosmetics', tr: 'Kozmetik', ru: 'Косметика' },
  'ev heyvanları': { en: 'Pets', tr: 'Evcil hayvan', ru: 'Питомцы' },
};

/** What to show for a stored category name in the reader's language. */
export function categoryLabel(name: string, lang: Lang = activeLang()): string {
  if (lang === 'az') return name;
  return NAMES[name.trim().toLowerCase()]?.[lang] ?? name;
}
