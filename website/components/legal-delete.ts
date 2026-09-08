import { Lang } from './content';
import { COMPANY } from './legal';

/** Copy for /delete-account — the public deletion URL required by Google Play. */
export const DELETE_COPY: Record<Lang, {
  title: string; intro: string; warnTitle: string; warnItems: string[];
  step1: string; step2: string; email: string; password: string; signIn: string; google: string; or: string;
  signedInAs: string; typeToConfirm: string; confirmWord: string; deleteBtn: string; working: string;
  doneTitle: string; doneBody: string; appleNote: string;
  inAppTitle: string; inAppBody: string; helpBody: string;
  notConfigured: string; notConfiguredBody: string;
  errCredentials: string; errSession: string; errDelete: string;
}> = {
  az: {
    title: 'Hesabı sil',
    intro: 'Burada Cheap Market AI hesabını və ona bağlı bütün məlumatları özün, birbaşa silə bilərsən. Bizə yazmağa və gözləməyə ehtiyac yoxdur.',
    warnTitle: 'Silinmə birdəfəlikdir və geri qaytarıla bilməz',
    warnItems: [
      'Hesabın, adın və e-poçtun silinir.',
      'Səbətin və yadda saxladığın bütün siyahılar silinir.',
      'Xalların, dəvət kodun və alış-veriş tarixçən silinir.',
      'Aktiv Plus abunəliyin varsa, əvvəlcə App Store və ya Google Play-dən ləğv et — hesabı silmək abunəliyi dayandırmır və ödəniş alınmağa davam edə bilər.',
    ],
    step1: '1. Hesabına daxil ol',
    step2: '2. Silinməni təsdiqlə',
    email: 'E-poçt',
    password: 'Şifrə',
    signIn: 'Daxil ol',
    google: 'Google ilə daxil ol',
    or: 'və ya',
    signedInAs: 'Daxil olduğun hesab:',
    typeToConfirm: 'Təsdiq üçün aşağıya SIL yaz.',
    confirmWord: 'SIL',
    deleteBtn: 'Hesabı birdəfəlik sil',
    working: 'Gözlə…',
    doneTitle: 'Hesabın silindi.',
    doneBody: 'Bütün məlumatların sistemdən tamamilə çıxarıldı. Fikrini dəyişsən, istənilən vaxt yenidən qeydiyyatdan keçə bilərsən.',
    appleNote: 'Apple ilə daxil olmusansa, veb üzərindən giriş mümkün deyil — hesabı tətbiqdən sil (aşağıda yazılıb) və ya bizə yaz.',
    inAppTitle: 'Tətbiqdən silmək',
    inAppBody: 'Tətbiqdə: Profil → aşağıda "Hesabı sil" → təsdiqlə. Nəticə eynidir.',
    helpBody: `Hər hansı problem olsa, ${COMPANY.email} ünvanına yaz — 2 iş günü ərzində cavab veririk.`,
    notConfigured: 'Bu səhifə hələ konfiqurasiya olunmayıb',
    notConfiguredBody: 'Sayt üçün NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY və NEXT_PUBLIC_API_URL dəyişənləri təyin edilməlidir. O vaxta qədər hesabı tətbiqdən silə bilərsən.',
    errCredentials: 'E-poçt və ya şifrə yanlışdır.',
    errSession: 'Sessiya təsdiqlənmədi. Yenidən cəhd et.',
    errDelete: 'Hesab silinmədi. Bir az sonra yenidən cəhd et.',
  },
  en: {
    title: 'Delete your account',
    intro: 'You can delete your Cheap Market AI account and everything attached to it right here, yourself. There is no need to write to us or wait.',
    warnTitle: 'Deletion is permanent and cannot be undone',
    warnItems: [
      'Your account, name and email are removed.',
      'Your basket and every saved list are removed.',
      'Your points, invite code and shopping history are removed.',
      'If you have an active Plus subscription, cancel it in the App Store or Google Play first — deleting the account does not stop the subscription and you may keep being charged.',
    ],
    step1: '1. Sign in',
    step2: '2. Confirm deletion',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    google: 'Continue with Google',
    or: 'or',
    signedInAs: 'Signed in as',
    typeToConfirm: 'Type DELETE below to confirm.',
    confirmWord: 'DELETE',
    deleteBtn: 'Delete my account permanently',
    working: 'Please wait…',
    doneTitle: 'Your account has been deleted.',
    doneBody: 'All of your data has been removed. If you change your mind, you are welcome to sign up again at any time.',
    appleNote: 'If you signed in with Apple, web sign-in is not available — delete from the app instead (see below), or write to us.',
    inAppTitle: 'Deleting from the app',
    inAppBody: 'In the app: Profile → "Delete account" at the bottom → confirm. The result is identical.',
    helpBody: `If anything goes wrong, write to ${COMPANY.email} — we reply within 2 working days.`,
    notConfigured: 'This page is not configured yet',
    notConfiguredBody: 'The site needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and NEXT_PUBLIC_API_URL. Until then, please delete your account from the app.',
    errCredentials: 'Wrong email or password.',
    errSession: 'Could not verify the session. Please try again.',
    errDelete: 'The account was not deleted. Please try again shortly.',
  },
};
