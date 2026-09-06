# Qeydiyyat (E-poçt · Apple · Google) və Push bildirişlər — quraşdırma addımları

Kod tərəfi hazırdır (`src/store/auth.tsx`, `app/auth.tsx`, `src/lib/notifications.ts`). Aşağıdakılar yalnız konsollarda edilməli işlərdir. Hər bölmə müstəqildir.

Sabit dəyərlər:

| Dəyər | |
|---|---|
| iOS Bundle ID | `az.cheapbasket.app` |
| Android package | `az.cheapbasket.app` |
| App Store SKU (təklif) | `CHEAPBASKET001` — App Store Connect-də daxili identifikatordur, istənilən unikal sətir ola bilər, sonradan dəyişmir |
| Deep link scheme | `cheapbasket://` |
| Supabase auth callback | `https://khnctzbktybgcwkrfmhi.supabase.co/auth/v1/callback` |
| EAS project ID | `04a934d4-0df9-4bc3-b4c2-f1f0f0fb67ed` |

---

## 0. Supabase — SQL və URL ayarları (5 dəq)

1. **SQL Editor** → `supabase/migrations/0003_auth_and_push.sql` faylını işə sal (profil avtomatik yaradılır, `push_tokens`, `price_alerts` cədvəlləri).
2. **Authentication → URL Configuration**:
   - Site URL: `https://cheapbasket-website.vercel.app` (və ya tətbiqin web linki)
   - Redirect URLs-ə əlavə et: `cheapbasket://auth/callback`, `cheapbasket://**`, `https://<tətbiqin-vercel-linki>/**`, `exp://**` (Expo Go üçün)

## 1. E-poçt ilə qeydiyyat (2 dəq)

1. **Authentication → Providers → Email**: Enabled ✅. "Confirm email" açıq qalsın (istifadəçi linkə klikləyir).
2. **Authentication → Email Templates**: "Confirm signup" və "Reset password" mətnlərini Azərbaycan dilinə çevir (istəyə görə).
3. Production üçün **Project Settings → Auth → SMTP**: öz SMTP-ni qoş (Resend / Brevo / SES). Supabase-in default göndərişi saatda 2–4 e-poçtla məhdudlaşır.

Test: tətbiqdə Profil → **Daxil ol** → Qeydiyyatdan keç → e-poçta gələn linkə klik → Profil-də adın görünür.

## 2. Apple ilə giriş (20–30 dəq, Apple Developer hesabı lazımdır, 99 $/il)

**Apple Developer (developer.apple.com → Certificates, Identifiers & Profiles)**

1. **Identifiers → App IDs** → `az.cheapbasket.app` (EAS build zamanı avtomatik yaranır; yoxdursa əl ilə yarat) → Capabilities-də **Sign In with Apple** ✅ → Save.
2. **Identifiers → Services IDs → +** → Description: `Cheap Basket Web`, Identifier: `az.cheapbasket.web` → Continue → Register.
   Sonra onu aç → **Sign In with Apple** ✅ → Configure:
   - Primary App ID: `az.cheapbasket.app`
   - Domains: `khnctzbktybgcwkrfmhi.supabase.co`
   - Return URLs: `https://khnctzbktybgcwkrfmhi.supabase.co/auth/v1/callback`
3. **Keys → +** → Name: `Cheap Basket Sign in with Apple` → **Sign In with Apple** ✅ → Configure → Primary App ID seç → Register → **Download** (`AuthKey_XXXXXXXXXX.p8`, bir dəfə yüklənir, saxla). Key ID-ni qeyd et.
4. Sağ üstdə **Team ID**-ni qeyd et (10 simvol).

**Supabase → Authentication → Providers → Apple**

- Enabled ✅
- Client IDs: `az.cheapbasket.app,az.cheapbasket.web` (vergüllə, boşluqsuz — birinci iOS native giriş, ikinci web/Android üçün)
- Secret Key (for OAuth): Supabase-in "Generate a client secret" bölməsində Team ID, Key ID, Services ID və `.p8` məzmununu daxil edib yaradılan secret-i yapışdır (6 ayda bir yenilənməlidir).

**EAS**: `app.json`-da `ios.usesAppleSignIn: true` və `expo-apple-authentication` plugin-i var; `eas build` capability-ni özü əlavə edir.

Test: iOS build-də (Expo Go-da işləmir) **Apple ilə davam et** → Face ID → Profil-də ad.

## 3. Google ilə giriş (15 dəq)

**Google Cloud Console (console.cloud.google.com)**

1. Yeni layihə: `Cheap Basket`.
2. **APIs & Services → OAuth consent screen**: External → App name `Cheap Basket`, support e-mail, logo (`assets/icon.png`), Authorized domain: `supabase.co` → Save. Scopes: `email`, `profile`, `openid`. Publish (Testing rejimində yalnız əlavə etdiyin e-poçtlar girə bilər).
3. **Credentials → Create Credentials → OAuth client ID**:
   - Type: **Web application**, Name: `Cheap Basket Supabase`
   - Authorized redirect URIs: `https://khnctzbktybgcwkrfmhi.supabase.co/auth/v1/callback`
   - Yaranan **Client ID** və **Client Secret**-i qeyd et.

**Supabase → Authentication → Providers → Google**

- Enabled ✅, Client ID və Client Secret-i yapışdır → Save.

Tətbiq Supabase-in hosted OAuth axınını istifadə edir (`expo-web-browser`), ona görə ayrıca iOS/Android client ID **lazım deyil**; Expo Go-da da işləyir.

Test: **Google ilə davam et** → brauzer açılır → hesab seç → tətbiqə qayıdır → Profil-də ad.

## 4. Push bildirişlər (30 dəq)

Tətbiq **Expo Push Service** istifadə edir: cihaz tokeni `push_tokens` cədvəlinə yazılır, göndəriş `https://exp.host/--/api/v2/push/send` vasitəsilə olur.

**iOS (APNs)**

1. `eas credentials` → iOS → Push Notifications → **Set up a new push key** → EAS Apple hesabınla APNs key yaradır (və ya mövcud `.p8` yükləyirsən). Hamısı.

**Android (FCM v1)**

1. **Firebase Console (console.firebase.google.com)** → Add project `Cheap Basket` → Android app əlavə et → package `az.cheapbasket.app` → `google-services.json` yüklə → repo kökünə qoy (gitignore-dadır; `app.config.js` avtomatik götürür).
   EAS build-də istifadə üçün: `eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment production` və `app.config.js`-də `process.env.GOOGLE_SERVICES_JSON` yolu (lazım olsa mən əlavə edərəm).
2. **Project Settings → Service accounts → Generate new private key** (JSON).
3. **expo.dev → layihə → Credentials → Android → FCM V1 service account key** → həmin JSON-u yüklə.

**Test**

1. Real cihazda (preview build) Profil → **Qiymət düşüşü bildirişi** açarını aç (Plus tələb edir; demo üçün Plus-a keç) → icazə ver.
2. Supabase **Table Editor → push_tokens**-da `ExponentPushToken[...]` görünməlidir.
3. Test göndəriş: https://expo.dev/notifications → tokeni yapışdır → Send.

**Avtomatik "qiymət düşdü" bildirişi (növbəti addım, backend)**: Supabase **Edge Function** + **pg_cron** — hər saat `prices` cədvəlində düşən qiymətləri `price_alerts` ilə tutuşdurub Expo Push API-yə göndərir. İstəsən bunu da yazım.

## 5. App Store Connect (qeyd)

- **My Apps → + → New App**: Platform iOS, Name `Cheap Basket`, Primary language Azerbaijani (yoxdursa English), Bundle ID `az.cheapbasket.app` (developer portalda yarandıqdan sonra siyahıda çıxır), **SKU** `CHEAPBASKET001`, User Access: Full.
- Sign in with Apple istifadə edən tətbiqlərdə Apple **hesab silmə** funksiyası tələb edir (Profil → "Hesabı sil") — mağazaya göndərməzdən əvvəl əlavə edərik.
