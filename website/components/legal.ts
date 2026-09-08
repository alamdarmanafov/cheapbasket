import { PRICING, Lang } from './content';

/**
 * Edit these before publishing: everything else in this file is written around
 * them. `legalName` and `address` are the only details the codebase cannot know
 * — fill in the registered entity, or the policies read as if the app has no
 * operator behind it.
 */
export const COMPANY = {
  brand: 'Cheap Market AI',
  legalName: 'Cheap Market AI',           // TODO: rəsmi hüquqi ad ( fiziki şəxs Ələmdar Manafov)
  address: 'Bakı, Azərbaycan',            // TODO: rəsmi ünvan
  email: 'info@bepositive.az',
  site: 'cheapmarket.app',
  updated: '8 sentyabr 2026',
  updatedEn: '8 September 2026',
};

export type Slug = 'privacy' | 'terms' | 'refunds' | 'cookies';
export interface LegalSection {
  h: string;
  p?: string[];
  ul?: string[];
}
export interface LegalDoc {
  title: string;
  updatedLabel: string;
  intro: string;
  sections: LegalSection[];
}

const az: Record<Slug, LegalDoc> = {
  privacy: {
    title: 'Məxfilik siyasəti',
    updatedLabel: `Son yenilənmə: ${COMPANY.updated}`,
    intro: `Bu siyasət ${COMPANY.brand} mobil tətbiqinin və ${COMPANY.site} saytının hansı məlumatları topladığını, niyə topladığını və onları kiminlə bölüşdüyünü izah edir. Qısası: yalnız tətbiqin işləməsi üçün lazım olanı toplayırıq, məlumatını satmırıq və reklam şəbəkələrinə vermirik.`,
    sections: [
      {
        h: '1. Hansı məlumatları toplayırıq',
        ul: [
          'Hesab məlumatları: e-poçt ünvanı, ad (yazmısansa) və şəhər (yazmısansa). Apple və ya Google ilə daxil olursansa, həmin xidmətdən yalnız e-poçt və ad gəlir.',
          'Səbətin və yadda saxladığın siyahılar.',
          'Abunəlik vəziyyəti: planın (pulsuz/Plus), bitmə tarixi və App Store / Google Play tərəfindən verilən əməliyyat identifikatoru. Kart məlumatlarını nə görürük, nə saxlayırıq.',
          'Xal və dəvət məlumatları: dəvət kodun, kimin kodu ilə qoşulduğun, xal hərəkətlərin.',
          'Qeydə alınan alış-veriş səfərləri: hansı marketə getdiyin, səbətin cəmi və qənaətin (statistika üçün).',
          'İstifadə hadisələri: tətbiqin açılması, axtarış, skan, səbətə əlavə, xəritə açılışı kimi anonim hadisələr — hansı funksiyaların işlədiyini görmək üçün.',
          'Bildiriş tokeni: bildirişləri qoşmusansa, cihazına bildiriş göndərmək üçün.',
          'Bizə yazdığın geri bildirim mesajları.',
        ],
      },
      {
        h: '2. Yerləşmə məlumatı cihazından çıxmır',
        p: [
          'Tətbiq yerləşmə icazəsini yalnız "Marketlər" bölməsinə keçəndə istəyir, tətbiqi ilk açanda yox. Koordinatların yalnız cihazın içində istifadə olunur: ən yaxın filialı və məsafəni hesablamaq üçün. Şəhər/rayon adı da cihazın öz əməliyyat sistemi tərəfindən müəyyən edilir.',
          'Koordinatlarını serverimizə göndərmirik və heç bir yerdə saxlamırıq. İcazə verməsən, tətbiqin qalan hissəsi normal işləyir — sadəcə məsafə göstərilmir.',
        ],
      },
      {
        h: '3. Kamera',
        p: [
          'Kameraya yalnız barkod skanı üçün müraciət olunur. Skan cihazın içində baş verir; şəkil çəkilmir, saxlanılmır və serverə göndərilmir. Yalnız oxunan barkod rəqəmi məhsulu tapmaq üçün istifadə olunur.',
        ],
      },
      {
        h: '4. Bu məlumatları niyə istifadə edirik',
        ul: [
          'Xidməti göstərmək: səbətini müqayisə etmək, ən sərfəli marketi və ən yaxın filialı tapmaq (müqavilənin icrası).',
          'Hesabını yaratmaq və qorumaq, sui-istifadəni və saxta hesabları aşkarlamaq (qanuni maraq).',
          'Abunəliyi aktivləşdirmək və yoxlamaq (müqavilənin icrası).',
          'Razılıq vermisənsə, bildiriş göndərmək — istənilən vaxt söndürə bilərsən.',
          'Tətbiqi yaxşılaşdırmaq: hansı funksiyaların işlədildiyini ümumi şəkildə görmək (qanuni maraq).',
        ],
      },
      {
        h: '5. Kimlərlə bölüşürük',
        p: ['Məlumatını satmırıq. Yalnız tətbiqin işləməsi üçün lazım olan xidmət təminatçıları ilə bölüşürük:'],
        ul: [
          'Supabase — məlumat bazası və hesab girişi (hesab, səbət, xal məlumatları).',
          'Vercel — sayt və server tərəfi (sorğuların emalı).',
          'Apple App Store / Google Play — abunəliyin ödənişi və yoxlanılması. Ödəniş tamamilə onların tərəfindədir.',
          'Expo — bildiriş göndərmə xidməti (yalnız bildiriş tokeni).',
          'OpenAI — məhsul kataloqunun avtomatik uyğunlaşdırılması və endirim xəbərlərinin hazırlanması. Bura yalnız məhsul adları və qiymətlər gedir; şəxsi məlumatın, səbətin və e-poçtun göndərilmir.',
        ],
      },
      {
        h: '6. Nə qədər saxlayırıq',
        p: [
          'Hesab məlumatlarını hesabın aktiv olduğu müddətdə saxlayırıq. Hesabı silsən, hesabına bağlı bütün məlumatlar (səbət, siyahılar, xallar, səfər tarixçəsi) dərhal və birdəfəlik silinir.',
          'Anonim istifadə hadisələri hesabla əlaqəsi kəsilmiş şəkildə statistika üçün qala bilər.',
          'Ödəniş qeydlərini qanunvericiliyin tələb etdiyi müddətdə saxlayırıq.',
        ],
      },
      {
        h: '7. Sənin hüquqların',
        p: [
          'Məlumatlarına baxmaq, düzəltmək və silmək hüququn var. Ad və şəhəri tətbiqdə "Hesab" bölməsindən dəyişə bilərsən.',
          'Hesabı tamamilə silmək üçün: Profil → Hesabı sil. Bu, təsdiqdən sonra hesabını və bütün məlumatlarını birdəfəlik silir — bərpa mümkün deyil.',
          `İstənilən sualla ${COMPANY.email} ünvanına yaza bilərsən.`,
        ],
      },
      {
        h: '8. Uşaqlar',
        p: [
          'Tətbiq 16 yaşdan kiçik şəxslər üçün nəzərdə tutulmayıb və biz bilərəkdən onlardan məlumat toplamırıq. Belə bir hesabdan xəbərdar olsaq, onu siləcəyik.',
        ],
      },
      {
        h: '9. Təhlükəsizlik',
        p: [
          'Bütün əlaqə şifrələnmiş kanal (HTTPS) üzərindən gedir. Məlumat bazasında hər istifadəçi yalnız öz sətirlərini görə və dəyişə bilər; plan, xal və abunəlik kimi sahələr yalnız server tərəfindən yazılır.',
          'Heç bir sistem tam təhlükəsiz deyil, lakin sızma baş verərsə, tələb olunan hallarda səni və səlahiyyətli orqanı məlumatlandıracağıq.',
        ],
      },
      {
        h: '10. Dəyişikliklər və əlaqə',
        p: [
          'Bu siyasət dəyişə bilər. Əhəmiyyətli dəyişiklik olarsa, tətbiqdə bildiriş göstərəcəyik.',
          `Suallar üçün: ${COMPANY.email} · ${COMPANY.legalName}, ${COMPANY.address}.`,
        ],
      },
    ],
  },

  terms: {
    title: 'İstifadə şərtləri',
    updatedLabel: `Son yenilənmə: ${COMPANY.updated}`,
    intro: `${COMPANY.brand} tətbiqindən və ${COMPANY.site} saytından istifadə etməklə bu şərtləri qəbul etmiş olursan. Razı deyilsənsə, xidmətdən istifadə etmə.`,
    sections: [
      {
        h: '1. Xidmət nədir',
        p: [
          'Cheap Market AI market qiymətlərini müqayisə edən köməkçi tətbiqdir. Sənin səbətindəki məhsulların cəmini müxtəlif marketlər üzrə hesablayır və ən sərfəli variantı göstərir. Biz market deyilik, satış etmirik və heç bir marketin nümayəndəsi deyilik.',
        ],
      },
      {
        h: '2. Qiymətlər barədə vacib qeyd',
        p: [
          'Qiymətlər marketlərin açıq onlayn kataloqlarından avtomatik toplanır və mütəmadi yenilənir. Buna baxmayaraq, qiymət mağazada fərqli ola bilər: kataloq gec yenilənə bilər, filiallar arasında fərq ola bilər, endirim bitmiş ola bilər.',
          'Ödəniş anında mağazadakı qiymət əsasdır. Tətbiqdəki qiymətlə mağazadakı qiymət arasındakı fərqə görə məsuliyyət daşımırıq. Qiymətlər məlumat xarakterlidir və təklif sayılmır.',
        ],
      },
      {
        h: '3. Hesab',
        p: [
          'Xidmətdən istifadə üçün hesab lazımdır. Hesabının təhlükəsizliyinə özün cavabdehsən. Bir şəxs bir hesabdan istifadə etməlidir.',
          'Yanlış məlumatla və ya başqasının adına hesab yaratmaq qadağandır.',
        ],
      },
      {
        h: '4. Plus abunəliyi',
        ul: [
          `Qiymət: ${PRICING.plusMonthly} / ay və ya ${PRICING.plusYearly} / il. Ödəniş təsdiqlədiyin anda App Store və ya Google Play hesabından alınır. Qiymət mağazada yerli valyutada göstərilir və ölkəyə görə fərqlənə bilər.`,
          'Plus abunəliyi App Store və ya Google Play üzərindən alınır və həmin hesaba bağlanır.',
          'Abunəlik avtomatik yenilənir. Cari dövr bitməzdən ən azı 24 saat əvvəl ləğv etməsən, növbəti dövr üçün ödəniş avtomatik alınır.',
          'Ləğv etməyi cihazın parametrlərindən (App Store və ya Google Play abunəliklər bölməsi) edə bilərsən. Ləğv etdikdən sonra Plus cari ödənişli dövrün sonunadək aktiv qalır.',
          'Bir abunəlik yalnız bir hesabda işləyir. Eyni ödənişi bir neçə hesabda aktivləşdirməyə cəhd bloklanır.',
        ],
      },
      {
        h: '5. Xal sistemi',
        p: [
          'Tətbiqi işlətdikcə və dost dəvət etdikcə xal qazanırsan. Xallar pul deyil, nağdlaşdırıla, satıla və ya başqasına köçürülə bilməz. Yalnız tətbiq daxilində Plus günlərinə çevrilə bilər.',
          'Dəvət mükafatı dəvət etdiyin şəxs tətbiqdə ilk real alış-verişini qeydə alanda verilir. Gündəlik və ümumi limit tətbiq olunur.',
          'Saxta hesablarla xal toplamaq aşkarlanarsa, xallar geri alınır və hesab bloklana bilər.',
        ],
      },
      {
        h: '6. Qadağan olunan istifadə',
        ul: [
          'Saxta hesablar yaratmaq, xal və ya abunəliyi süni yolla əldə etməyə cəhd etmək.',
          'Tətbiqi və ya API-ni avtomatlaşdırılmış vasitələrlə kütləvi sorğulamaq, məlumat bazasını kopyalamaq.',
          'Sistemin təhlükəsizliyini pozmağa, başqa istifadəçilərin məlumatına çıxış əldə etməyə cəhd etmək.',
          'Tətbiqi qanunsuz məqsədlər üçün istifadə etmək.',
          'Bu qaydaların pozulması hesabın xəbərdarlıq olmadan bağlanması ilə nəticələnə bilər.',
        ],
      },
      {
        h: '7. Əqli mülkiyyət',
        p: [
          'Tətbiq, sayt, loqo, dizayn və məzmun bizə məxsusdur. Market adları və loqoları müvafiq şirkətlərə aiddir və yalnız məhsulu tanıtmaq üçün istifadə olunur.',
        ],
      },
      {
        h: '8. Məsuliyyətin məhdudlaşdırılması',
        p: [
          'Xidmət "olduğu kimi" təqdim olunur. Fasiləsiz və ya səhvsiz işləyəcəyinə zəmanət vermirik.',
          'Qanunvericiliyin icazə verdiyi həddə, tətbiqdən istifadə nəticəsində yaranan dolayı zərərlərə görə məsuliyyət daşımırıq. Hər halda məsuliyyətimiz son 12 ayda bizə ödədiyin məbləğlə məhdudlaşır.',
        ],
      },
      {
        h: '9. Xidmətin dayandırılması',
        p: [
          'İstənilən vaxt hesabını silə bilərsən (Profil → Hesabı sil). Biz də bu şərtləri pozan hesabları dayandıra bilərik.',
        ],
      },
      {
        h: '10. Tətbiq olunan qanunvericilik',
        p: [
          'Bu şərtlərə Azərbaycan Respublikasının qanunvericiliyi tətbiq olunur. Mübahisələr mümkün olduqda danışıqlar yolu ilə, olmadıqda Azərbaycan Respublikasının səlahiyyətli məhkəmələrində həll edilir.',
        ],
      },
      {
        h: '11. Dəyişikliklər və əlaqə',
        p: [
          'Şərtlər dəyişə bilər; əhəmiyyətli dəyişikliyi tətbiqdə bildirəcəyik.',
          `Əlaqə: ${COMPANY.email} · ${COMPANY.legalName}, ${COMPANY.address}.`,
        ],
      },
    ],
  },

  refunds: {
    title: 'Geri qaytarma siyasəti',
    updatedLabel: `Son yenilənmə: ${COMPANY.updated}`,
    intro: 'Plus abunəliyi App Store və Google Play üzərindən satılır. Ödənişi biz qəbul etmirik, ona görə geri qaytarmanı da birbaşa biz edə bilmirik — bunu Apple və Google öz qaydalarına uyğun həyata keçirir. Aşağıda nə etməli olduğun yazılıb.',
    sections: [
      {
        h: '1. Apple (iPhone / iPad)',
        p: [
          'Geri qaytarma sorğusunu Apple-a göndərməlisən: reportaproblem.apple.com ünvanına Apple ID-nlə daxil ol, müvafiq alışı seç və səbəbini yaz.',
          'Qərarı Apple verir. Apple adətən son 90 gün ərzindəki alışlara baxır.',
        ],
      },
      {
        h: '2. Google Play (Android)',
        p: [
          'play.google.com/store/account/subscriptions səhifəsindən və ya Google Play tətbiqindən geri qaytarma tələb edə bilərsən.',
          'İlk 48 saat ərzində geri qaytarma adətən avtomatik təsdiqlənir; sonrakı müraciətlərə Google fərdi baxır.',
        ],
      },
      {
        h: '3. Abunəliyi ləğv etmək',
        p: [
          'Ləğv etmək geri qaytarma deyil: ləğv etdikdən sonra növbəti ödəniş alınmır, amma Plus artıq ödədiyin dövrün sonunadək aktiv qalır.',
          'iPhone: Parametrlər → Apple ID → Abunəliklər. Android: Google Play → Profil → Ödənişlər və abunəliklər.',
          'Növbəti ödənişin qarşısını almaq üçün dövr bitməzdən ən azı 24 saat əvvəl ləğv et.',
        ],
      },
      {
        h: '4. Xal ilə alınmış Plus',
        p: [
          'Xal ilə açılan Plus günləri pulla alınmadığı üçün geri qaytarılmır və pula çevrilmir.',
        ],
      },
      {
        h: '5. Səhv ödəniş və texniki problem',
        p: [
          'Ödəniş etmisənsə, amma Plus aktivləşməyibsə, əvvəlcə tətbiqdə "Alışları bərpa et" düyməsini yoxla. Problem qalarsa, bizə yaz — abunəliyi əl ilə aktivləşdirməyə kömək edək.',
          `Əlaqə: ${COMPANY.email}. Cavab müddəti adətən 2 iş günüdür.`,
        ],
      },
      {
        h: '6. İstehlakçı hüquqları',
        p: [
          'Yaşadığın ölkənin qanunvericiliyi sənə əlavə geri qaytarma hüququ verirsə, bu siyasət həmin hüquqları məhdudlaşdırmır.',
        ],
      },
    ],
  },

  cookies: {
    title: 'Kuki (cookie) siyasəti',
    updatedLabel: `Son yenilənmə: ${COMPANY.updated}`,
    intro: `${COMPANY.site} saytı reklam və ya izləmə kukiləri istifadə etmir. Aşağıda saytın və tətbiqin cihazında nə saxladığı dəqiq yazılıb.`,
    sections: [
      {
        h: '1. Saytda kuki',
        p: [
          'Bu sayt statik səhifədir: analitika, piksel və ya reklam kuki-si qurmur. Dil seçimi yalnız səhifə açıq olduğu müddətdə yaddaşda saxlanılır və heç yerə göndərilmir.',
          'Sayt şriftləri Google Fonts-dan yüklənir. Google Fonts kuki qurmur, lakin şrift faylını göndərmək üçün brauzerinin IP ünvanını görür.',
        ],
      },
      {
        h: '2. Tətbiqdə kuki yoxdur',
        p: [
          'Mobil tətbiq brauzer olmadığı üçün kuki istifadə etmir. Bunun yerinə bəzi məlumatları cihazın öz yaddaşında saxlayır:',
        ],
        ul: [
          'Giriş sessiyası — hər dəfə yenidən şifrə yazmamağın üçün.',
          'Səbətin — internetsiz də açıla bilsin deyə.',
          'Dil seçimin.',
          'Tanışlıq ekranının göstərilib-göstərilmədiyi.',
          'Pop-up bildirişlərin neçə dəfə göstərildiyi — eyni elanı təkrar göstərməmək üçün. Bu sayğac cihazda qalır, serverə göndərilmir.',
        ],
      },
      {
        h: '3. Bunları necə silmək olar',
        p: [
          'Tətbiqdən çıxış etsən sessiya silinir. Tətbiqi cihazdan silsən, yuxarıdakı bütün məlumatlar cihazdan tamamilə silinir.',
          'Saytda isə silinəsi bir şey yoxdur — heç nə saxlanılmır.',
        ],
      },
      {
        h: '4. Əlaqə',
        p: [`Sual varsa: ${COMPANY.email}.`],
      },
    ],
  },
};

const en: Record<Slug, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    updatedLabel: `Last updated: ${COMPANY.updatedEn}`,
    intro: `This policy explains what the ${COMPANY.brand} app and the ${COMPANY.site} website collect, why, and who we share it with. In short: we collect only what the app needs to work, we do not sell your data, and we do not pass it to advertising networks.`,
    sections: [
      {
        h: '1. What we collect',
        ul: [
          'Account details: your email address, your name (if you enter one) and your city (if you enter one). If you sign in with Apple or Google, we receive only your email and name from them.',
          'Your basket and any lists you save.',
          'Subscription state: your plan (free or Plus), its expiry, and the transaction identifier issued by the App Store or Google Play. We never see or store card details.',
          'Points and referral data: your invite code, whose code you joined with, and your points history.',
          'Recorded shopping trips: which store you went to, your basket total and what you saved (used for your savings statistics).',
          'Usage events: anonymous events such as app open, search, scan, add-to-basket and map open, so we can see which features are used.',
          'A notification token, if you turn notifications on, so we can send them to your device.',
          'Any feedback message you send us.',
        ],
      },
      {
        h: '2. Location never leaves your device',
        p: [
          'The app asks for location only when you open the Stores tab — not at launch. Your coordinates are used entirely on the device, to work out the nearest branch and the distance to it. The city or district name is resolved by your phone’s own operating system.',
          'We do not send your coordinates to our servers and we do not store them anywhere. If you decline, everything else keeps working — you simply do not see distances.',
        ],
      },
      {
        h: '3. Camera',
        p: [
          'The camera is used only for barcode scanning. Scanning happens on the device: no photo is taken, stored or uploaded. Only the barcode number is used, to look the product up.',
        ],
      },
      {
        h: '4. Why we use it',
        ul: [
          'To provide the service: comparing your basket and finding the cheapest store and nearest branch (performance of a contract).',
          'To create and protect your account, and to detect abuse and fake accounts (legitimate interest).',
          'To activate and verify your subscription (performance of a contract).',
          'To send notifications, where you have consented — you can turn them off at any time.',
          'To improve the app by seeing, in aggregate, which features get used (legitimate interest).',
        ],
      },
      {
        h: '5. Who we share it with',
        p: ['We do not sell your data. We share it only with the providers the app needs to run:'],
        ul: [
          'Supabase — database and sign-in (account, basket and points data).',
          'Vercel — website and server-side request handling.',
          'Apple App Store / Google Play — subscription payment and verification. Payment is handled entirely on their side.',
          'Expo — push notification delivery (the notification token only).',
          'OpenAI — automatic product-catalogue matching and preparing deal digests. Only product names and prices are sent; your personal details, your basket and your email are not.',
        ],
      },
      {
        h: '6. How long we keep it',
        p: [
          'We keep account data for as long as your account exists. If you delete your account, everything attached to it — basket, lists, points, trip history — is deleted immediately and permanently.',
          'Anonymous usage events may remain for statistics once detached from your account.',
          'Payment records are kept for as long as the law requires.',
        ],
      },
      {
        h: '7. Your rights',
        p: [
          'You have the right to access, correct and delete your data. Your name and city can be changed in the app under Account.',
          'To delete everything: Profile → Delete account. After confirmation this permanently removes your account and all its data; it cannot be undone.',
          `For anything else, write to ${COMPANY.email}.`,
        ],
      },
      {
        h: '8. Children',
        p: [
          'The app is not intended for anyone under 16 and we do not knowingly collect their data. If we learn of such an account, we will delete it.',
        ],
      },
      {
        h: '9. Security',
        p: [
          'All traffic goes over an encrypted connection (HTTPS). In the database each user can read and change only their own rows; fields such as plan, points and subscription state are writable only by the server.',
          'No system is perfectly secure, but if a breach occurs we will notify you and the relevant authority where required.',
        ],
      },
      {
        h: '10. Changes and contact',
        p: [
          'This policy may change. If a change is significant we will show a notice in the app.',
          `Questions: ${COMPANY.email} · ${COMPANY.legalName}, ${COMPANY.address}.`,
        ],
      },
    ],
  },

  terms: {
    title: 'Terms of Service',
    updatedLabel: `Last updated: ${COMPANY.updatedEn}`,
    intro: `By using the ${COMPANY.brand} app or the ${COMPANY.site} website you accept these terms. If you do not agree with them, please do not use the service.`,
    sections: [
      {
        h: '1. What the service is',
        p: [
          'Cheap Market AI is a companion app that compares supermarket prices. It totals the products in your basket across different stores and shows you the cheapest option. We are not a supermarket, we do not sell groceries, and we do not represent any store.',
        ],
      },
      {
        h: '2. Important note about prices',
        p: [
          'Prices are collected automatically from supermarkets’ public online catalogues and refreshed regularly. Even so, the price in store may differ: a catalogue can lag, branches can vary, a discount can have ended.',
          'The price at the till is the one that counts. We are not liable for a difference between the price in the app and the price in the store. Prices are informational and do not constitute an offer.',
        ],
      },
      {
        h: '3. Your account',
        p: [
          'An account is required. You are responsible for keeping it secure. One person should use one account.',
          'Creating an account with false details, or in someone else’s name, is not allowed.',
        ],
      },
      {
        h: '4. Plus subscription',
        ul: [
          `Price: ${PRICING.plusMonthly} / month or ${PRICING.plusYearly} / year. Payment is charged to your App Store or Google Play account on confirmation. The store shows the price in your local currency and it may differ by country.`,
          'Plus is purchased through the App Store or Google Play and is tied to that account.',
          'It renews automatically. Unless you cancel at least 24 hours before the current period ends, the next period is charged automatically.',
          'You cancel from your device settings (App Store or Google Play subscriptions). After cancelling, Plus stays active until the end of the period you already paid for.',
          'One subscription works on one account. Attempting to activate the same purchase on several accounts is blocked.',
        ],
      },
      {
        h: '5. Points',
        p: [
          'You earn points by using the app and by inviting friends. Points are not money: they cannot be cashed out, sold or transferred. They can only be converted into Plus days inside the app.',
          'A referral reward is paid when the person you invited records their first real shopping trip. Daily and lifetime limits apply.',
          'If points are found to have been farmed with fake accounts, they are reversed and the account may be blocked.',
        ],
      },
      {
        h: '6. Prohibited use',
        ul: [
          'Creating fake accounts, or trying to obtain points or a subscription by artificial means.',
          'Querying the app or API in bulk with automated tools, or copying the database.',
          'Attempting to breach the security of the system or reach other users’ data.',
          'Using the app for unlawful purposes.',
          'Breaking these rules may result in your account being closed without notice.',
        ],
      },
      {
        h: '7. Intellectual property',
        p: [
          'The app, website, logo, design and content belong to us. Store names and logos belong to the respective companies and are used only to identify the product.',
        ],
      },
      {
        h: '8. Limitation of liability',
        p: [
          'The service is provided "as is". We do not warrant that it will be uninterrupted or error-free.',
          'To the extent permitted by law we are not liable for indirect losses arising from use of the app. In any case our liability is limited to the amount you paid us in the last 12 months.',
        ],
      },
      {
        h: '9. Ending the service',
        p: [
          'You can delete your account at any time (Profile → Delete account). We may likewise suspend accounts that break these terms.',
        ],
      },
      {
        h: '10. Governing law',
        p: [
          'These terms are governed by the law of the Republic of Azerbaijan. Disputes are settled by negotiation where possible, and otherwise by the competent courts of the Republic of Azerbaijan.',
        ],
      },
      {
        h: '11. Changes and contact',
        p: [
          'These terms may change; we will announce a significant change in the app.',
          `Contact: ${COMPANY.email} · ${COMPANY.legalName}, ${COMPANY.address}.`,
        ],
      },
    ],
  },

  refunds: {
    title: 'Refund Policy',
    updatedLabel: `Last updated: ${COMPANY.updatedEn}`,
    intro: 'Plus is sold through the App Store and Google Play. We never receive the payment, so we cannot issue the refund ourselves — Apple and Google handle it under their own rules. Here is what to do.',
    sections: [
      {
        h: '1. Apple (iPhone / iPad)',
        p: [
          'Request the refund from Apple: sign in at reportaproblem.apple.com with your Apple ID, choose the purchase and give a reason.',
          'The decision is Apple’s. Apple normally considers purchases made in the last 90 days.',
        ],
      },
      {
        h: '2. Google Play (Android)',
        p: [
          'You can request a refund at play.google.com/store/account/subscriptions or from the Google Play app.',
          'Within the first 48 hours refunds are usually approved automatically; after that Google reviews each request individually.',
        ],
      },
      {
        h: '3. Cancelling a subscription',
        p: [
          'Cancelling is not the same as a refund: no further payment is taken, but Plus stays active until the end of the period you have already paid for.',
          'iPhone: Settings → Apple ID → Subscriptions. Android: Google Play → Profile → Payments and subscriptions.',
          'Cancel at least 24 hours before the period ends to avoid the next charge.',
        ],
      },
      {
        h: '4. Plus obtained with points',
        p: [
          'Plus days unlocked with points were not paid for in money, so they are not refundable and cannot be converted into money.',
        ],
      },
      {
        h: '5. Wrong charge or a technical problem',
        p: [
          'If you paid but Plus did not activate, first try "Restore purchases" in the app. If it still does not work, write to us and we will activate it manually.',
          `Contact: ${COMPANY.email}. We usually reply within 2 working days.`,
        ],
      },
      {
        h: '6. Consumer rights',
        p: [
          'If the law where you live gives you further refund rights, nothing in this policy limits them.',
        ],
      },
    ],
  },

  cookies: {
    title: 'Cookie Policy',
    updatedLabel: `Last updated: ${COMPANY.updatedEn}`,
    intro: `The ${COMPANY.site} website uses no advertising or tracking cookies. Here is exactly what the site and the app keep on your device.`,
    sections: [
      {
        h: '1. Cookies on the website',
        p: [
          'This site is a static page: it sets no analytics, pixel or advertising cookies. Your language choice is held in memory only while the page is open and is never sent anywhere.',
          'Fonts are loaded from Google Fonts. Google Fonts sets no cookies, but it does see your browser’s IP address in order to serve the font file.',
        ],
      },
      {
        h: '2. The app uses no cookies',
        p: [
          'The mobile app is not a browser, so it uses no cookies. Instead it keeps a few things in your device’s own storage:',
        ],
        ul: [
          'Your sign-in session, so you do not retype your password every time.',
          'Your basket, so it opens even without a connection.',
          'Your language choice.',
          'Whether you have seen the intro screens.',
          'How many times each announcement pop-up has been shown, so the same one is not repeated. This counter stays on the device and is never sent to the server.',
        ],
      },
      {
        h: '3. How to clear it',
        p: [
          'Signing out clears the session. Deleting the app removes everything above from the device completely.',
          'On the website there is nothing to clear — nothing is stored.',
        ],
      },
      {
        h: '4. Contact',
        p: [`Questions: ${COMPANY.email}.`],
      },
    ],
  },
};

export const LEGAL: Record<Lang, Record<Slug, LegalDoc>> = { az, en };
