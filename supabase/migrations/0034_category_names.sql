-- Category display names in the app's other languages.
--
-- The category itself stays one Azerbaijani string (products match on it, the
-- admin edits it); this column carries what a reader in English, Turkish or
-- Russian sees for it: {"en": "Dairy", "tr": "Süt ürünleri", "ru": "Молочные продукты"}.
-- The app keeps a built-in table for the seeded names, so a category with no
-- entry here still shows a translation when it has one there, and its
-- Azerbaijani name otherwise.
alter table categories add column if not exists names jsonb not null default '{}'::jsonb;

update categories set names = v.names
from (values
  ('Süd məhsulları', '{"en":"Dairy","tr":"Süt ürünleri","ru":"Молочные продукты"}'::jsonb),
  ('Yumurta',        '{"en":"Eggs","tr":"Yumurta","ru":"Яйца"}'::jsonb),
  ('Qida',           '{"en":"Food","tr":"Gıda","ru":"Продукты"}'::jsonb),
  ('İçkilər',        '{"en":"Drinks","tr":"İçecekler","ru":"Напитки"}'::jsonb),
  ('Ət',             '{"en":"Meat","tr":"Et","ru":"Мясо"}'::jsonb),
  ('Meyvə-tərəvəz',  '{"en":"Fruit & veg","tr":"Meyve-sebze","ru":"Фрукты и овощи"}'::jsonb),
  ('Çörək',          '{"en":"Bakery","tr":"Ekmek","ru":"Хлеб"}'::jsonb),
  ('Şirniyyat',      '{"en":"Sweets","tr":"Tatlı","ru":"Сладости"}'::jsonb),
  ('Ev və gigiyena', '{"en":"Home & hygiene","tr":"Ev ve hijyen","ru":"Дом и гигиена"}'::jsonb),
  ('Balıq',          '{"en":"Fish","tr":"Balık","ru":"Рыба"}'::jsonb),
  ('Toyuq',          '{"en":"Chicken","tr":"Tavuk","ru":"Курица"}'::jsonb),
  ('Dondurma',       '{"en":"Ice cream","tr":"Dondurma","ru":"Мороженое"}'::jsonb),
  ('Konserv',        '{"en":"Tinned food","tr":"Konserve","ru":"Консервы"}'::jsonb),
  ('Makaron',        '{"en":"Pasta","tr":"Makarna","ru":"Макароны"}'::jsonb),
  ('Çay',            '{"en":"Tea","tr":"Çay","ru":"Чай"}'::jsonb),
  ('Qəhvə',          '{"en":"Coffee","tr":"Kahve","ru":"Кофе"}'::jsonb),
  ('Uşaq qidası',    '{"en":"Baby food","tr":"Bebek maması","ru":"Детское питание"}'::jsonb),
  ('Təmizlik',       '{"en":"Cleaning","tr":"Temizlik","ru":"Уборка"}'::jsonb),
  ('Gigiyena',       '{"en":"Hygiene","tr":"Hijyen","ru":"Гигиена"}'::jsonb),
  ('Kosmetika',      '{"en":"Cosmetics","tr":"Kozmetik","ru":"Косметика"}'::jsonb),
  ('Ev heyvanları',  '{"en":"Pets","tr":"Evcil hayvan","ru":"Питомцы"}'::jsonb),
  ('Alkoqol',        '{"en":"Alcohol","tr":"Alkol","ru":"Алкоголь"}'::jsonb),
  ('Dondurulmuş',    '{"en":"Frozen","tr":"Dondurulmuş","ru":"Заморозка"}'::jsonb),
  ('Qəlyanaltı',     '{"en":"Snacks","tr":"Atıştırmalık","ru":"Снеки"}'::jsonb),
  ('Ədviyyat',       '{"en":"Spices","tr":"Baharat","ru":"Специи"}'::jsonb),
  ('Yağ',            '{"en":"Oils","tr":"Yağ","ru":"Масло"}'::jsonb),
  ('Dənli',          '{"en":"Grains","tr":"Tahıl","ru":"Крупы"}'::jsonb),
  ('Uşaq',           '{"en":"Kids","tr":"Çocuk","ru":"Детское"}'::jsonb)
) as v(name, names)
where lower(categories.name) = lower(v.name) and categories.names = '{}'::jsonb;
