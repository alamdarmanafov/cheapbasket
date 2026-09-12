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
    receiptTitle: (pts: number) => `Çekin qəbul edildi 🧾 +${pts} xal`,
    receiptBody: (n: number) => `${n} qiymət yeniləndi. Təşəkkürlər!`,
    dropOne: (n: string) => `${n} ucuzlaşdı 🔻`,
    dropMany: (n: number) => `Səbətindəki ${n} məhsul ucuzlaşdı 🔻`,
    watchMany: (n: number) => `İzlədiyin ${n} məhsul ucuzlaşdı 🔻`,
    line: (name: string, store: string, from: string, to: string) => `${name}: ${store}-da ${from} → ${to} ₼`,
    more: (n: number) => `+${n} məhsul daha`,
    digestPersonal: (n: number) => `Səbətindəki ${n} məhsul ucuzlaşdı 🔻`,
    digestGeneral: (n: number) => `Bu gün ${n} məhsul ucuzlaşdı 🔻`,
    rewardTitle: (pts: number) => `Təklifin qəbul edildi 🎉 +${pts} xal`,
    rewardBody: (name: string) => `"${name}" bazaya əlavə olundu. Xallar hesabındadır.`,
    priceTitle: (pts: number) => pts > 0 ? `Qiymətin qəbul edildi 🎉 +${pts} xal` : 'Qiymətin qəbul edildi 🎉',
    priceBody: (name: string, store: string, price: string) => `${name}: ${store}-da ${price} ₼ kimi yazıldı. Təşəkkürlər!`,
    aiLang: 'Azərbaycan dilində',
  },
  en: {
    receiptTitle: (pts: number) => `Receipt approved 🧾 +${pts} points`,
    receiptBody: (n: number) => `${n} prices updated. Thank you!`,
    dropOne: (n: string) => `${n} just got cheaper 🔻`,
    dropMany: (n: number) => `${n} items in your basket got cheaper 🔻`,
    watchMany: (n: number) => `${n} items you watch got cheaper 🔻`,
    line: (name: string, store: string, from: string, to: string) => `${name}: ${from} → ${to} ₼ at ${store}`,
    more: (n: number) => `+${n} more`,
    digestPersonal: (n: number) => `${n} items in your basket got cheaper 🔻`,
    digestGeneral: (n: number) => `${n} products got cheaper today 🔻`,
    rewardTitle: (pts: number) => `Your suggestion was approved 🎉 +${pts} points`,
    rewardBody: (name: string) => `"${name}" is in the catalogue now. The points are in your account.`,
    priceTitle: (pts: number) => pts > 0 ? `Your price was accepted 🎉 +${pts} points` : 'Your price was accepted 🎉',
    priceBody: (name: string, store: string, price: string) => `${name} is now ${price} ₼ at ${store}. Thank you!`,
    aiLang: 'in English',
  },
  tr: {
    receiptTitle: (pts: number) => `Fişin kabul edildi 🧾 +${pts} puan`,
    receiptBody: (n: number) => `${n} fiyat güncellendi. Teşekkürler!`,
    dropOne: (n: string) => `${n} ucuzladı 🔻`,
    dropMany: (n: number) => `Sepetindeki ${n} ürün ucuzladı 🔻`,
    watchMany: (n: number) => `Takip ettiğin ${n} ürün ucuzladı 🔻`,
    line: (name: string, store: string, from: string, to: string) => `${name}: ${store}'da ${from} → ${to} ₼`,
    more: (n: number) => `+${n} ürün daha`,
    digestPersonal: (n: number) => `Sepetindeki ${n} ürün ucuzladı 🔻`,
    digestGeneral: (n: number) => `Bugün ${n} ürün ucuzladı 🔻`,
    rewardTitle: (pts: number) => `Önerin kabul edildi 🎉 +${pts} puan`,
    rewardBody: (name: string) => `"${name}" kataloğa eklendi. Puanlar hesabında.`,
    priceTitle: (pts: number) => pts > 0 ? `Fiyatın kabul edildi 🎉 +${pts} puan` : 'Fiyatın kabul edildi 🎉',
    priceBody: (name: string, store: string, price: string) => `${name}: ${store} için ${price} ₼ olarak yazıldı. Teşekkürler!`,
    aiLang: 'Türkçe',
  },
  ru: {
    receiptTitle: (pts: number) => `Чек принят 🧾 +${pts} баллов`,
    receiptBody: (n: number) => `Обновлено цен: ${n}. Спасибо!`,
    dropOne: (n: string) => `${n} подешевел 🔻`,
    dropMany: (n: number) => `В корзине подешевело товаров: ${n} 🔻`,
    watchMany: (n: number) => `Подешевело отслеживаемых товаров: ${n} 🔻`,
    line: (name: string, store: string, from: string, to: string) => `${name}: ${from} → ${to} ₼ в ${store}`,
    more: (n: number) => `и ещё ${n}`,
    digestPersonal: (n: number) => `В корзине подешевело товаров: ${n} 🔻`,
    digestGeneral: (n: number) => `Сегодня подешевело товаров: ${n} 🔻`,
    rewardTitle: (pts: number) => `Ваше предложение принято 🎉 +${pts} баллов`,
    rewardBody: (name: string) => `«${name}» добавлен в каталог. Баллы уже на счету.`,
    priceTitle: (pts: number) => pts > 0 ? `Ваша цена принята 🎉 +${pts} баллов` : 'Ваша цена принята 🎉',
    priceBody: (name: string, store: string, price: string) => `${name}: в ${store} записано ${price} ₼. Спасибо!`,
    aiLang: 'на русском языке',
  },
} as const;

export const copy = (lang: Lang) => C[lang];
