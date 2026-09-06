export type Lang = 'az' | 'en';

export const PRICING = { plusMonthly: '1.99 $', plusYearly: '9.99 $' };

export const LINKS = {
  appStore: '#download',
  googlePlay: '#download',
  webApp: 'https://cheapbasket.vercel.app',
  instagram: 'https://instagram.com/cheapbasket.az',
  tiktok: 'https://tiktok.com/@cheapbasket.az',
  linkedin: 'https://linkedin.com/company/cheapbasket',
  email: 'mailto:hello@cheapbasket.az',
};

const az = {
  nav: { how: 'Necə işləyir?', features: 'Üstünlüklər', plus: 'Plus', faq: 'FAQ', download: 'Tətbiqi yüklə' },
  hero: {
    eyebrow: 'Daha ağıllı alış-veriş',
    h1a: 'Alış-verişə getməzdən əvvəl ',
    h1b: 'ən sərfəli marketi',
    h1c: ' tap.',
    p: 'Almaq istədiyin məhsulları səbətə əlavə et. Cheap Basket qiymətləri müqayisə etsin və sənə ən sərfəli marketi göstərsin.',
    trustB: '10.000+ istifadəçi',
    trust: 'Artıq daha ağıllı alış-veriş edir',
  },
  how: {
    h2: 'Necə işləyir?',
    sub: '3 sadə addımda daha ağıllı alış-veriş et.',
    steps: [
      ['Səbətini yarat', 'Almaq istədiyin məhsulları axtar və ya barkodunu skan edib səbətinə əlavə et.'],
      ['Qiymətləri müqayisə et', 'Cheap Basket səbətindəki bütün məhsulların qiymətini marketlər üzrə analiz edir.'],
      ['Ən sərfəli marketi tap', 'Bütün səbət üçün ən sərfəli marketi və sənə ən yaxın filialı xəritədə gör.'],
    ],
  },
  choice: {
    h2a: '10 məhsul.',
    h2b: '4 market.',
    h2c: '1 ən sərfəli seçim.',
    p: 'Cheap Basket səbətindəki bütün məhsulları müqayisə edir və sənə "bu məhsul burada ucuzdur" yox, "sənin səbətin üçün ən sərfəli market budur" deyir.',
    cta: 'Tətbiqi yüklə',
  },
  benefits: [
    ['Real qiymətlər', 'Gündəlik yenilənir'],
    ['Yaxın filiallar', 'Xəritədə göstərilir'],
    ['Barkod skanı', 'Marketin içində müqayisə'],
    ['Vaxta qənaət', 'Səbətini əvvəlcədən hazırla'],
  ],
  pricing: {
    h2: 'Sənin üçün uyğun seçim',
    sub: 'Sadə başla. İstəsən daha çox qənaət et.',
    free: 'FREE',
    freePrice: '0 ₼',
    freePer: '/ həmişə',
    freeItems: ['1 səbət', 'Qiymət müqayisəsi', 'Ən sərfəli market', 'Yaxın filial', 'Barkod skanı'],
    freeCta: 'Pulsuz başla',
    plus: 'PLUS',
    plusPer: '/ ay',
    plusYearly: `və ya ${PRICING.plusYearly} / il`,
    plusItems: ['Limitsiz səbət', 'Qiymət tarixçəsi', 'Qiymət düşüşü bildirişi', 'AI tövsiyələri', 'Qənaət statistikası'],
    plusCta: 'Plus-a keç',
    popular: 'ƏN POPULYAR',
  },
  reviews: {
    h2: 'İstifadəçilərimiz nə deyir?',
    items: [
      ['Artıq marketə getməzdən əvvəl mütləq yoxlayıram. Hər dəfə qənaət edirəm!', 'Nigar R.', 'Bakı'],
      ['Çox rahatdır. Xəritə ilə yaxın filialı göstərməsi superdir.', 'Tural M.', 'Sumqayıt'],
      ['10 məhsulluq səbətdə 3–4 manat fərq çıxır. Ayda ciddi qənaətdir.', 'Aysel K.', 'Gəncə'],
    ],
  },
  faq: {
    h2: 'Tez-tez verilən suallar',
    items: [
      ['Hansı marketlər var?', 'Hazırda Araz, Bravo, Neptun və Bazarstore. Yeni marketlər mütəmadi əlavə olunur.'],
      ['Qiymətlər nə qədər dəqiqdir?', 'Qiymətlər gündəlik yenilənir və hər məhsulda "son yenilənmə" vaxtı göstərilir.'],
      ['Tətbiq pulsuzdur?', 'Bəli. Səbət yaratmaq, qiymətləri müqayisə etmək və ən sərfəli marketi tapmaq həmişə pulsuzdur. Plus əlavə funksiyalar üçündür.'],
      ['Barkod skanı nə üçündür?', 'Marketin içində məhsulu skan edirsən, tətbiq dərhal deyir: burada almaq sərfəlidir, yoxsa başqa yerdə ucuzdur.'],
      ['Hansı şəhərlərdə işləyir?', 'Bakı ilə başlayırıq. Filial xəritəsi lokasiyana görə ən yaxın marketi göstərir.'],
    ],
  },
  download: { h2: 'Cheap Basket-i indi yüklə', p: 'Daha ağıllı alış-verişə bu gün başla.', web: 'Web versiyasını aç' },
  footer: {
    tagline: 'Daha ağıllı alış-veriş.\nDaha çox qənaət.',
    info: 'Məlumat',
    company: 'Şirkət',
    social: 'Sosial media',
    about: 'Haqqımızda',
    contact: 'Əlaqə',
    privacy: 'Məxfilik siyasəti',
    rights: 'Bütün hüquqlar qorunur.',
  },
};

const en: typeof az = {
  nav: { how: 'How it works', features: 'Features', plus: 'Plus', faq: 'FAQ', download: 'Get the app' },
  hero: {
    eyebrow: 'Smarter grocery shopping',
    h1a: 'Find the ',
    h1b: 'cheapest supermarket',
    h1c: ' before you go.',
    p: 'Add what you need to your basket. Cheap Basket compares prices across supermarkets and tells you where the whole basket costs least.',
    trustB: '10,000+ users',
    trust: 'already shop smarter',
  },
  how: {
    h2: 'How it works',
    sub: 'Smarter shopping in 3 simple steps.',
    steps: [
      ['Build your basket', 'Search products or scan a barcode and add them to your basket.'],
      ['Compare prices', 'Cheap Basket analyses every item in your basket across all supermarkets.'],
      ['Find the cheapest store', 'See the best store for the whole basket and the nearest branch on the map.'],
    ],
  },
  choice: {
    h2a: '10 products.',
    h2b: '4 supermarkets.',
    h2c: '1 best choice.',
    p: 'Cheap Basket does not just say "this item is cheaper there". It tells you which store is cheapest for your entire basket.',
    cta: 'Get the app',
  },
  benefits: [
    ['Real prices', 'Updated daily'],
    ['Nearby branches', 'Shown on the map'],
    ['Barcode scan', 'Compare in-store'],
    ['Save time', 'Plan your basket ahead'],
  ],
  pricing: {
    h2: 'A plan that fits you',
    sub: 'Start simple. Save more when you want.',
    free: 'FREE',
    freePrice: '0 ₼',
    freePer: '/ forever',
    freeItems: ['1 basket', 'Price comparison', 'Cheapest store', 'Nearest branch', 'Barcode scan'],
    freeCta: 'Start free',
    plus: 'PLUS',
    plusPer: '/ month',
    plusYearly: `or ${PRICING.plusYearly} / year`,
    plusItems: ['Unlimited baskets', 'Price history', 'Price-drop alerts', 'AI recommendations', 'Savings statistics'],
    plusCta: 'Go Plus',
    popular: 'MOST POPULAR',
  },
  reviews: {
    h2: 'What our users say',
    items: [
      ['I always check before going to the store now. I save every single time!', 'Nigar R.', 'Baku'],
      ['So convenient. Showing the nearest branch on the map is brilliant.', 'Tural M.', 'Sumgait'],
      ['A 10-item basket differs by 3–4 manat between stores. That adds up every month.', 'Aysel K.', 'Ganja'],
    ],
  },
  faq: {
    h2: 'Frequently asked questions',
    items: [
      ['Which supermarkets are covered?', 'Araz, Bravo, Neptun and Bazarstore today. New chains are added regularly.'],
      ['How accurate are the prices?', 'Prices are refreshed daily and every product shows when it was last updated.'],
      ['Is the app free?', 'Yes. Building a basket, comparing prices and finding the cheapest store is always free. Plus adds extra features.'],
      ['What is the barcode scan for?', 'Scan a product in the store and the app tells you instantly whether buying it here is a good deal or cheaper elsewhere.'],
      ['Which cities?', 'We start with Baku. The branch map shows the nearest store based on your location.'],
    ],
  },
  download: { h2: 'Get Cheap Basket now', p: 'Start shopping smarter today.', web: 'Open the web version' },
  footer: {
    tagline: 'Smarter shopping.\nMore savings.',
    info: 'Info',
    company: 'Company',
    social: 'Social',
    about: 'About',
    contact: 'Contact',
    privacy: 'Privacy policy',
    rights: 'All rights reserved.',
  },
};

export const CONTENT: Record<Lang, typeof az> = { az, en };
