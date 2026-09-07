export type Lang = 'az' | 'en';

export const PRICING = { plusMonthly: '1.99 $', plusYearly: '9.99 $' };

export const LINKS = {
  appStore: '#download',
  googlePlay: '#download',
  site: 'https://cheapmarket.app',
  instagram: 'https://instagram.com/cheapmarketapp',
  tiktok: 'https://tiktok.com/@cheapmarket.az',
  linkedin: 'https://linkedin.com/company/cheapmarket',
  email: 'mailto:hello@cheapmarket.app',
};

const az = {
  nav: { how: 'Necə işləyir?', features: 'Üstünlüklər', plus: 'Plus', faq: 'FAQ', download: 'Tətbiqi yüklə' },
  hero: {
    eyebrow: 'Daha ağıllı alış-veriş',
    h1a: 'Alış-verişə getməzdən əvvəl ',
    h1b: 'ən sərfəli marketi',
    h1c: ' tap.',
    p: 'Almaq istədiyin məhsulları səbətə əlavə et. Cheap Market qiymətləri müqayisə etsin və sənə ən sərfəli marketi göstərsin.',
  },
  how: {
    h2: 'Necə işləyir?',
    sub: '3 sadə addımda daha ağıllı alış-veriş et.',
    steps: [
      ['Səbətini yarat', 'Almaq istədiyin məhsulları axtar və ya barkodunu skan edib səbətinə əlavə et.'],
      ['Qiymətləri müqayisə et', 'Cheap Market səbətindəki bütün məhsulların qiymətini marketlər üzrə analiz edir.'],
      ['Ən sərfəli marketi tap', 'Bütün səbət üçün ən sərfəli marketi və sənə ən yaxın filialı xəritədə gör.'],
    ],
  },
  choice: {
    h2a: '10 məhsul.',
    h2b: '4 market.',
    h2c: '1 ən sərfəli seçim.',
    p: 'Cheap Market səbətindəki bütün məhsulları müqayisə edir və sənə "bu məhsul burada ucuzdur" yox, "sənin səbətin üçün ən sərfəli market budur" deyir.',
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
    sub: 'Pulsuz başla. Plus ilə tətbiq sənin yerinə qiymətləri izləsin.',
    free: 'FREE',
    freePrice: '0 ₼',
    freePer: '/ həmişə',
    freeItems: ['1 aktiv səbət + 1 yadda saxlanılan siyahı', 'Bütün səbət üçün qiymət müqayisəsi', 'Ən sərfəli market və ən yaxın filial', 'Xəritə, iş saatları və marşrut', 'Gündə 1 dəfə şəkillə məhsul tanıma'],
    freeCta: 'Pulsuz başla',
    plus: 'PLUS',
    plusPer: '/ ay',
    plusYearly: `və ya ${PRICING.plusYearly} / il`,
    plusItems: ['Limitsiz səbət və siyahı', 'Hər səhər AI endirim xəbəri', 'Qiymət düşən kimi dərhal bildiriş', 'Qiymət tarixçəsi və qrafiklər', 'Tapılmayan məhsula əvəzedici təklif', 'Limitsiz şəkillə məhsul tanıma', 'Qənaət statistikası və alış-veriş tarixçəsi', 'AI köməkçisi: büdcəyə görə səbət'],
    plusCta: 'Plus-a keç',
    popular: 'ƏN POPULYAR',
  },
  faq: {
    h2: 'Tez-tez verilən suallar',
    items: [
      ['Niyə hər məhsulu yox, bütün səbəti müqayisə edirsiniz?', 'Çünki 10 məhsulu 4 fərqli marketdən almağa heç kim getmir. Cheap Market bütün səbətinin cəmini hər marketdə hesablayır və bir marketə göndərir — orada ən çox qənaət edirsən.'],
      ['Səbətimdəki məhsul bir marketdə yoxdursa nə olur?', 'Tətbiq bunu açıq göstərir: "1 məhsul burada yoxdur". Plus istifadəçilərə isə eyni kateqoriyadan ən yaxın əvəzedici məhsulu təklif edir.'],
      ['Qiymətlər haradan gəlir və endirimlər görünür?', 'Qiymətlər marketlərin rəsmi onlayn kataloqlarından avtomatik yenilənir. Endirimli qiymət ayrıca göstərilir və ən ucuz seçim həmişə endirim nəzərə alınmaqla hesablanır.'],
      ['Marketin içindəyəm — tətbiq mənə necə kömək edir?', 'Barkodu skan et və ya məhsulun şəklini çək: tətbiq dərhal deyir ki, bu məhsul burada sərfəlidir, yoxsa başqa marketdə neçə qəpik ucuzdur.'],
      ['Plus nə üçün lazımdır? Pulsuz versiya kifayət deyil?', 'Pulsuz versiya ilə ən sərfəli marketi tapırsan. Plus isə səni "gözləyir": qiymət düşən kimi bildiriş göndərir, hər səhər AI endirim xəbəri yazır, limitsiz səbət və qiymət tarixçəsi verir. Bir aylıq Plus adətən bir alış-verişdə özünü çıxarır.'],
      ['Xal sistemi necə işləyir?', 'Marşruta gedəndə, dost dəvət edəndə və tətbiqi işlədəndə xal toplayırsan. 300 xal = 7 gün pulsuz Plus. Dəvət kodunla gələn dostun da xal qazanır.'],
      ['Hansı marketlər və şəhərlər var?', 'Bakının ən böyük market şəbəkələri ilə başlayırıq və hər həftə yeni market və filiallar əlavə olunur. Filial xəritəsi lokasiyana görə ən yaxın açıq marketi göstərir.'],
      ['Məlumatlarım təhlükəsizdirmi?', 'Lokasiyanı yalnız ən yaxın filialı tapmaq üçün istifadə edirik və onu saxlamırıq. Hesabını istənilən vaxt Profil → Hesab bölməsindən tam silə bilərsən.'],
    ],
  },
  download: { h2: 'Cheap Market-i indi yüklə', p: 'Daha ağıllı alış-verişə bu gün başla.', web: 'Web versiyasını aç' },
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
    p: 'Add what you need to your basket. Cheap Market compares prices across supermarkets and tells you where the whole basket costs least.',
  },
  how: {
    h2: 'How it works',
    sub: 'Smarter shopping in 3 simple steps.',
    steps: [
      ['Build your basket', 'Search products or scan a barcode and add them to your basket.'],
      ['Compare prices', 'Cheap Market analyses every item in your basket across all supermarkets.'],
      ['Find the cheapest store', 'See the best store for the whole basket and the nearest branch on the map.'],
    ],
  },
  choice: {
    h2a: '10 products.',
    h2b: '4 supermarkets.',
    h2c: '1 best choice.',
    p: 'Cheap Market does not just say "this item is cheaper there". It tells you which store is cheapest for your entire basket.',
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
    sub: 'Start free. Let Plus watch the prices for you.',
    free: 'FREE',
    freePrice: '0 ₼',
    freePer: '/ forever',
    freeItems: ['1 active basket + 1 saved list', 'Whole-basket price comparison', 'Cheapest store and nearest branch', 'Map, opening hours and directions', 'Photo product recognition, once a day'],
    freeCta: 'Start free',
    plus: 'PLUS',
    plusPer: '/ month',
    plusYearly: `or ${PRICING.plusYearly} / year`,
    plusItems: ['Unlimited baskets and lists', 'AI deal digest every morning', 'Instant alert when a price drops', 'Price history and charts', 'Substitutes for missing products', 'Unlimited photo recognition', 'Savings statistics and trip history', 'AI assistant: a basket for your budget'],
    plusCta: 'Go Plus',
    popular: 'MOST POPULAR',
  },
  faq: {
    h2: 'Frequently asked questions',
    items: [
      ['Why compare the whole basket instead of each product?', 'Because nobody visits four supermarkets to buy ten items. Cheap Market totals your entire basket at every store and sends you to the one where you save the most.'],
      ['What if a product is missing at one store?', 'The app says so clearly: "1 item not available here". Plus members also get the closest substitute from the same category suggested automatically.'],
      ['Where do the prices come from? Do you show discounts?', 'Prices are refreshed automatically from the supermarkets\' official online catalogues. Discounted prices are shown separately and the cheapest choice always takes discounts into account.'],
      ['I am inside the store — how does the app help?', 'Scan the barcode or take a photo of the product: the app instantly tells you whether it is a good deal here or how much cheaper it is elsewhere.'],
      ['Why Plus? Is the free version not enough?', 'Free finds you the cheapest store. Plus keeps watching for you: instant price-drop alerts, an AI deal digest every morning, unlimited baskets and price history. One month of Plus usually pays for itself in a single shop.'],
      ['How do points work?', 'You earn points for following a route, inviting friends and using the app. 300 points = 7 days of Plus for free. Friends who join with your code earn points too.'],
      ['Which supermarkets and cities?', 'We start with the biggest chains in Baku and add new stores and branches every week. The branch map shows the nearest open store based on your location.'],
      ['Is my data safe?', 'Your location is used only to find the nearest branch and is never stored. You can delete your account completely at any time from Profile → Account.'],
    ],
  },
  download: { h2: 'Get Cheap Market now', p: 'Start shopping smarter today.', web: 'Open the web version' },
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
