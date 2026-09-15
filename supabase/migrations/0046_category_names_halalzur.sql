-- EN/TR/RU names for the categories that had none yet: the two pre-existing
-- ones migration 0034 missed by name mismatch ("Hazır qidalar" was never in
-- its list; "Ət" there doesn't match the real "Ət məhsulları" row) and the
-- Halalzur-import categories added since. Guarded on names = '{}' so it never
-- overwrites a translation entered by hand in the admin in the meantime.
update categories set names = v.names
from (values
  ('Hazır qidalar',        '{"en":"Ready meals","tr":"Hazır yemekler","ru":"Готовые блюда"}'::jsonb),
  ('Ət məhsulları',        '{"en":"Meat","tr":"Et ürünleri","ru":"Мясные продукты"}'::jsonb),
  ('Yağlar',                '{"en":"Oils","tr":"Yağlar","ru":"Масла"}'::jsonb),
  ('Çipsi',                 '{"en":"Chips","tr":"Cips","ru":"Чипсы"}'::jsonb),
  ('Quru çay',              '{"en":"Tea","tr":"Çay","ru":"Чай"}'::jsonb),
  ('Şokolad',               '{"en":"Chocolate","tr":"Çikolata","ru":"Шоколад"}'::jsonb),
  ('Kosmetika',             '{"en":"Cosmetics","tr":"Kozmetik","ru":"Косметика"}'::jsonb),
  ('Uşaq qidası',           '{"en":"Baby food","tr":"Bebek maması","ru":"Детское питание"}'::jsonb),
  ('Ədviyyat',              '{"en":"Spices","tr":"Baharat","ru":"Специи"}'::jsonb),
  ('Dənli məhsullar',       '{"en":"Grains","tr":"Tahıl ürünleri","ru":"Крупы"}'::jsonb),
  ('Makaron və düyü',       '{"en":"Pasta & rice","tr":"Makarna ve pirinç","ru":"Макароны и рис"}'::jsonb),
  ('Dondurulmuş məhsullar', '{"en":"Frozen foods","tr":"Dondurulmuş gıdalar","ru":"Замороженные продукты"}'::jsonb),
  ('Konservlər',            '{"en":"Canned goods","tr":"Konserveler","ru":"Консервы"}'::jsonb),
  ('Qəlyanaltılar',         '{"en":"Snacks","tr":"Atıştırmalıklar","ru":"Снеки"}'::jsonb),
  ('Souslar',               '{"en":"Sauces","tr":"Soslar","ru":"Соусы"}'::jsonb)
) as v(name, names)
where lower(categories.name) = lower(v.name) and categories.names = '{}'::jsonb;

notify pgrst, 'reload schema';
