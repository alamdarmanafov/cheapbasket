/**
 * What a shopper types in English, Turkish or Russian, and the Azerbaijani
 * word the catalogue is written in.
 *
 * Keys and values are in the search's normalised spelling (Latin, no
 * diacritics: ə→e, ş→s …), so "молоко" reaches "sud" the same way "sud"
 * does. Several foreign words may point at one product word, and one foreign
 * word may open onto several ours ("meat" is both "et" and "toyuq"'s aisle).
 */
const RAW: Record<string, string[]> = {
  // dairy
  sud: ['milk', 'süt', 'sut', 'молоко', 'молока'],
  qatiq: ['yogurt', 'yoghurt', 'yoğurt', 'yogurt', 'йогурт', 'кефир', 'kefir', 'ayran'],
  pendir: ['cheese', 'peynir', 'сыр', 'сыра'],
  kesmik: ['cottage', 'curd', 'lor', 'творог'],
  kere: ['butter', 'tereyağı', 'tereyagi', 'масло сливочное', 'сливочное'],
  smetan: ['sour cream', 'krema', 'сметана'],
  qaymaq: ['cream', 'kaymak', 'сливки'],
  yumurta: ['egg', 'eggs', 'yumurta', 'яйцо', 'яйца'],
  // bakery and staples
  corek: ['bread', 'ekmek', 'хлеб', 'хлеба'],
  lavas: ['lavash', 'lavaş', 'лаваш'],
  un: ['flour', 'un', 'мука', 'муки'],
  seker: ['sugar', 'şeker', 'seker', 'сахар', 'сахара'],
  duz: ['salt', 'tuz', 'соль'],
  duyu: ['rice', 'pirinç', 'pirinc', 'рис', 'риса'],
  makaron: ['pasta', 'spaghetti', 'makarna', 'макароны', 'спагетти', 'паста'],
  yarma: ['groats', 'bulgur', 'крупа', 'гречка', 'булгур'],
  yag: ['oil', 'yağ', 'sıvı yağ', 'масло', 'растительное'],
  zeytun: ['olive', 'zeytin', 'оливки', 'маслины', 'оливковое'],
  noxud: ['chickpea', 'chickpeas', 'nohut', 'нут', 'горох'],
  lobya: ['beans', 'fasulye', 'фасоль'],
  mercimek: ['lentil', 'lentils', 'mercimek', 'чечевица'],
  // meat, poultry, fish
  et: ['meat', 'beef', 'lamb', 'et', 'мясо', 'говядина', 'баранина'],
  toyuq: ['chicken', 'tavuk', 'piliç', 'pilic', 'курица', 'куриное', 'куриная'],
  kolbasa: ['sausage', 'salami', 'sucuk', 'sosis', 'колбаса', 'сосиски', 'сардельки'],
  baliq: ['fish', 'salmon', 'balık', 'balik', 'somon', 'рыба', 'лосось', 'сёмга', 'семга'],
  tuna: ['tuna', 'ton balığı', 'тунец'],
  // fruit and veg
  alma: ['apple', 'apples', 'elma', 'яблоко', 'яблоки'],
  banan: ['banana', 'bananas', 'muz', 'банан', 'бананы'],
  portagal: ['orange', 'oranges', 'portakal', 'апельсин', 'апельсины'],
  limon: ['lemon', 'limon', 'лимон'],
  uzum: ['grape', 'grapes', 'üzüm', 'uzum', 'виноград'],
  nar: ['pomegranate', 'nar', 'гранат'],
  armud: ['pear', 'armut', 'груша'],
  ciyelek: ['strawberry', 'çilek', 'cilek', 'клубника'],
  pomidor: ['tomato', 'tomatoes', 'domates', 'помидор', 'помидоры', 'томат'],
  xiyar: ['cucumber', 'salatalık', 'salatalik', 'огурец', 'огурцы'],
  kartof: ['potato', 'potatoes', 'patates', 'картофель', 'картошка'],
  sogan: ['onion', 'onions', 'soğan', 'sogan', 'лук'],
  sarimsaq: ['garlic', 'sarımsak', 'sarimsak', 'чеснок'],
  yerkoku: ['carrot', 'carrots', 'havuç', 'havuc', 'морковь'],
  kelem: ['cabbage', 'lahana', 'капуста'],
  bibar: ['pepper', 'peppers', 'biber', 'перец'],
  badimcan: ['eggplant', 'aubergine', 'patlıcan', 'patlican', 'баклажан'],
  goyerti: ['herbs', 'greens', 'yeşillik', 'зелень', 'укроп', 'петрушка', 'кинза'],
  // drinks
  su: ['water', 'su', 'вода'],
  cay: ['tea', 'çay', 'cay', 'чай'],
  qehve: ['coffee', 'kahve', 'кофе'],
  sire: ['juice', 'meyve suyu', 'сок'],
  kola: ['cola', 'coke', 'кола'],
  limonad: ['lemonade', 'soda', 'gazoz', 'лимонад', 'газировка'],
  pive: ['beer', 'bira', 'пиво'],
  serab: ['wine', 'şarap', 'sarap', 'вино'],
  // sweets and snacks
  sokolad: ['chocolate', 'çikolata', 'cikolata', 'шоколад'],
  konfet: ['candy', 'sweets', 'şeker', 'конфеты', 'конфета'],
  peceniye: ['cookie', 'cookies', 'biscuit', 'bisküvi', 'biskuvi', 'kurabiye', 'печенье'],
  vafli: ['wafer', 'gofret', 'вафли'],
  dondurma: ['ice cream', 'dondurma', 'мороженое'],
  cips: ['chips', 'crisps', 'cips', 'чипсы'],
  bal: ['honey', 'bal', 'мёд', 'мед'],
  murebbe: ['jam', 'reçel', 'recel', 'варенье', 'джем'],
  // household and hygiene
  sabun: ['soap', 'sabun', 'мыло'],
  sampun: ['shampoo', 'şampuan', 'sampuan', 'шампунь'],
  dis: ['toothpaste', 'diş macunu', 'dis', 'зубная', 'паста'],
  toz: ['detergent', 'washing powder', 'deterjan', 'порошок', 'стиральный'],
  salfet: ['napkin', 'napkins', 'tissue', 'peçete', 'pecete', 'салфетки'],
  kagiz: ['toilet paper', 'tuvalet kağıdı', 'туалетная бумага', 'бумага'],
  bez: ['diaper', 'diapers', 'nappies', 'bebek bezi', 'подгузники', 'памперс'],
  // tins and sauces
  konserv: ['canned', 'tinned', 'konserve', 'консервы'],
  ketcup: ['ketchup', 'ketçap', 'кетчуп'],
  mayonez: ['mayonnaise', 'mayo', 'mayonez', 'майонез'],
  sirke: ['vinegar', 'sirke', 'уксус'],
  edviyyat: ['spice', 'spices', 'baharat', 'специи', 'приправа'],
};

const fold = (s: string) =>
  s.toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/[^a-z0-9а-яё]+/g, ' ').trim();

/** Foreign word (normalised) → the catalogue's words it may mean. Built once. */
const INDEX: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const [az, words] of Object.entries(RAW)) {
    for (const w of words) {
      for (const tok of fold(w).split(' ')) {
        if (tok.length < 2) continue;
        const list = m.get(tok) ?? [];
        if (!list.includes(az)) list.push(az);
        m.set(tok, list);
      }
    }
  }
  return m;
})();

/** The catalogue words a typed word may stand for; empty when it is not in the dictionary. */
export function synonymsOf(word: string): string[] {
  return INDEX.get(fold(word)) ?? [];
}
