# Plus abunəliyi — App Store və Google Play ödənişi

Ödəniş birbaşa Apple / Google vasitəsilə gedir (üçüncü tərəf yoxdur). Axın:

1. Tətbiqdə **Plus-a keç** → App Store / Google Play ödəniş pəncərəsi.
2. Uğurlu ödənişdən sonra tətbiq `EXPO_PUBLIC_API_URL/api/iap/verify` ünvanına müraciət edir (istifadəçinin Supabase tokeni ilə).
3. Server qəbzi Apple **App Store Server API** / Google **Play Developer API** ilə yoxlayır və `profiles` cədvəlində `plan = plus`, `plan_expires_at` yazır.
4. Yenilənmə / ləğv / geri qaytarma Apple **Server Notifications V2** və Google **Real-time developer notifications** ilə avtomatik gəlir.
5. "Alışları bərpa et" düyməsi yeni telefonda abunəliyi geri qaytarır.

Məhsul ID-ləri: aylıq `az.cheapbasket.app`, illik `az.cheapbasket.app.yearly`.

## Supabase

SQL Editor-də `supabase/migrations/0008_iap.sql` faylını işlət.

## Apple (App Store Connect)

1. **Users and Access → Integrations → In-App Purchase** → Generate API key → `.p8` faylını yüklə. **Key ID** və **Issuer ID** dəyərlərini götür.
2. Vercel → admin layihəsi (`cheapbasket-7ae9`) → Settings → Environment Variables:
   - `APPLE_IAP_KEY_ID` — Key ID
   - `APPLE_IAP_ISSUER_ID` — Issuer ID
   - `APPLE_IAP_PRIVATE_KEY` — `.p8` faylının bütün məzmunu (`-----BEGIN PRIVATE KEY-----` sətirləri daxil)
   - `APPLE_BUNDLE_ID` — `az.cheapbasket.app`
3. App Store Connect → App → **App Information → App Store Server Notifications**:
   - Production URL: `https://cheapbasket-7ae9.vercel.app/api/iap/apple/notifications`
   - Sandbox URL: eyni ünvan. Version 2 seç.
4. Sandbox test üçün: **Users and Access → Sandbox → Testers** → test Apple ID yarat; iPhone-da Settings → App Store → Sandbox Account ilə daxil ol.

## Google (Play Console) — sonra

1. Play Console → **Monetise → Products → Subscriptions** → `az.cheapbasket.app` (aylıq) və `az.cheapbasket.app.yearly` (illik) yarat, hər birinə bir base plan.
2. Google Cloud → **IAM → Service accounts** → yeni hesab → JSON açar yüklə. Play Console → **Users and permissions** → bu hesabı əlavə et (View financial data + Manage orders and subscriptions).
3. Vercel admin env: `GOOGLE_PLAY_SERVICE_ACCOUNT` = JSON faylının məzmunu (bir sətirdə), `GOOGLE_PLAY_PACKAGE` = `az.cheapbasket.app`.
4. Play Console → **Monetise → Monetisation setup → Real-time developer notifications**: Pub/Sub mövzusu yarat, push abunəliyi ünvanı `https://cheapbasket-7ae9.vercel.app/api/iap/google/notifications`.
5. Test: Play Console → **Setup → License testing** → öz Gmail-ini əlavə et.

## Tətbiq

`eas.json` içində hər profil üçün `EXPO_PUBLIC_API_URL=https://cheapbasket-7ae9.vercel.app` var. `expo-iap` native modul olduğu üçün yeni build lazımdır:

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

Veb versiyada (cheapbasket.vercel.app) ödəniş yoxdur — Plus yalnız tətbiqdən alınır.

## Yoxlama

- Admin panel → İstifadəçilər: plan, bitmə tarixi və mənbə (`plan_source = apple/google`) görünür.
- Supabase → `iap_events` cədvəli: hər yoxlama və bildiriş qeyd olunur.
