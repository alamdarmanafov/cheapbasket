/**
 * Push texts in the reader's language.
 *
 * Every alert used to go out in Azerbaijani whatever the phone showed; the
 * profile carries `lang` now (written by the app), and this picks the words.
 * Azerbaijani stays the fallback for a profile without one.
 */
export type Lang = 'az' | 'en' | 'tr' | 'ru';

export const langOf = (p: { lang?: string | null } | null | undefined): Lang => {
  const l = p?.lang;
  return l === 'en' || l === 'tr' || l === 'ru' ? l : 'az';
};

const C = {
  az: {
    dropOne: (n: string) => `${n} ucuzlaşdı 🔻`,
    dropMany: (n: number) => `Səbətindəki ${n} məhsul ucuzlaşdı 🔻`,
    watchMany: (n: number) => `İzlədiyin ${n} məhsul ucuzlaşdı 🔻`,
    line: (name: string, store: string, from: string, to: string) => `${name}: ${store}-da ${from} → ${to} ₼`,
    more: (n: number) => `+${n} məhsul daha`,
    digestPersonal: (n: number) => `Səbətindəki ${n} məhsul ucuzlaşdı 🔻`,
    digestGeneral: (n: number) => `Bu gün ${n} məhsul ucuzlaşdı 🔻`,
    rewardTitle: (pts: number) => `Təklifin qəbul edildi 🎉 +${pts} xal`,
    rewardBody: (name: string) => `"${name}" bazaya əlavə olundu. Xallar hesabındadır.`,
    aiLang: 'Azərbaycan dilində',
  },
  en: {
    dropOne: (n: string) => `${n} just got cheaper 🔻`,
    dropMany: (n: number) => `${n} items in your basket got cheaper 🔻`,
    watchMany: (n: number) => `${n} items you watch got cheaper 🔻`,
    line: (name: string, store: string, from: string, to: string) => `${name}: ${from} → ${to} ₼ at ${store}`,
    more: (n: number) => `+${n} more`,
    digestPersonal: (n: number) => `${n} items in your basket got cheaper 🔻`,
    digestGeneral: (n: number) => `${n} products got cheaper today 🔻`,
    rewardTitle: (pts: number) => `Your suggestion was approved 🎉 +${pts} points`,
    rewardBody: (name: string) => `"${name}" is in the catalogue now. The points are in your account.`,
    aiLang: 'in English',
  },
  tr: {
    dropOne: (n: string) => `${n} ucuzladı 🔻`,
    dropMany: (n: number) => `Sepetindeki ${n} ürün ucuzladı 🔻`,
    watchMany: (n: number) => `Takip ettiğin ${n} ürün ucuzladı 🔻`,
    line: (name: string, store: string, from: string, to: string) => `${name}: ${store}'da ${from} → ${to} ₼`,
    more: (n: number) => `+${n} ürün daha`,
    digestPersonal: (n: number) => `Sepetindeki ${n} ürün ucuzladı 🔻`,
    digestGeneral: (n: number) => `Bugün ${n} ürün ucuzladı 🔻`,
    rewardTitle: (pts: number) => `Önerin kabul edildi 🎉 +${pts} puan`,
    rewardBody: (name: string) => `"${name}" kataloğa eklendi. Puanlar hesabında.`,
    aiLang: 'Türkçe',
  },
  ru: {
    dropOne: (n: string) => `${n} подешевел 🔻`,
    dropMany: (n: number) => `В корзине подешевело товаров: ${n} 🔻`,
    watchMany: (n: number) => `Подешевело отслеживаемых товаров: ${n} 🔻`,
    line: (name: string, store: string, from: string, to: string) => `${name}: ${from} → ${to} ₼ в ${store}`,
    more: (n: number) => `и ещё ${n}`,
    digestPersonal: (n: number) => `В корзине подешевело товаров: ${n} 🔻`,
    digestGeneral: (n: number) => `Сегодня подешевело товаров: ${n} 🔻`,
    rewardTitle: (pts: number) => `Ваше предложение принято 🎉 +${pts} баллов`,
    rewardBody: (name: string) => `«${name}» добавлен в каталог. Баллы уже на счету.`,
    aiLang: 'на русском языке',
  },
} as const;

export const copy = (lang: Lang) => C[lang];
