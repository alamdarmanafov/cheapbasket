import type { Page, Route } from '@playwright/test';

/** What the app asks the backend for, answered from here. */
export const SUPABASE_URL = 'https://e2e.supabase.local';
export const USER_ID = '11111111-1111-4111-8111-111111111111';

const stores = [
  { id: 'araz', name: 'Araz', color: '#E53935', initial: 'A', logo_url: null, open_from: '08:00', open_until: '23:00', always_open: false },
  { id: 'bravo', name: 'Bravo', color: '#1E88E5', initial: 'B', logo_url: null, open_from: '08:00', open_until: '23:00', always_open: false },
  { id: 'oba', name: 'OBA', color: '#43A047', initial: 'O', logo_url: null, open_from: '08:00', open_until: '23:00', always_open: false },
];
const now = new Date().toISOString();
const products = [
  { id: 'sutas-sud-1l', barcode: '8690767010012', name: 'Süd 3.2%', brand: 'Sütaş', size: '1 L', category: 'Süd məhsulları', emoji: '🥛', tint: null, image_url: null, rating: null, prices: { araz: 2.1, bravo: 2.4, oba: 2.25 }, regular_prices: {}, updated_at: now },
  { id: 'gilezi-yumurta', barcode: null, name: 'Ağ Yumurta İri', brand: 'Giləzi', size: '10 ədəd', category: 'Yumurta', emoji: '🥚', tint: null, image_url: null, rating: null, prices: { araz: 2.5 }, regular_prices: {}, updated_at: now },
  { id: 'azercay-100', barcode: '4760012345678', name: 'Qara çay', brand: 'Azərçay', size: '100 q', category: 'Çay', emoji: '🍵', tint: null, image_url: null, rating: null, prices: { araz: 3.2, oba: 2.9 }, regular_prices: {}, updated_at: now },
];
const categories = [
  { id: 'sud', name: 'Süd məhsulları', emoji: '🥛', names: { en: 'Dairy' } },
  { id: 'yumurta', name: 'Yumurta', emoji: '🥚', names: { en: 'Eggs' } },
  { id: 'cay', name: 'Çay', emoji: '🍵', names: { en: 'Tea' } },
];
const profile = { user_id: USER_ID, display_name: 'Test Alıcı', plan: 'free', plan_expires_at: null, blocked: false, city: 'Bakı', points: 12, referral_code: 'TEST12', lang: 'az' };
const settings = [
  { key: 'points', value: { suggestion: 10, price_report: 2, referral: 100, trip: 10, plus_tiers: [{ points: 100, days: 7 }, { points: 200, days: 30 }, { points: 350, days: 90 }] } },
  { key: 'receipts', value: { enabled: false, free_per_day: 3 } },
];

const b64 = (o: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/** A session supabase-js accepts from storage: not expired, shaped like its own. */
export function session() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER_ID, role: 'authenticated', exp, aud: 'authenticated', email: 'test@example.com' })}.e2e`;
  return {
    access_token: token, refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp,
    user: { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Test Alıcı' }, created_at: now, is_anonymous: false },
  };
}

function table(pathname: string, params: URLSearchParams): unknown[] {
  const name = pathname.replace(/^\/rest\/v1\//, '').split('/')[0];
  const eq = (key: string) => { const v = params.get(key); return v && v.startsWith('eq.') ? v.slice(3) : null; };
  switch (name) {
    case 'stores': return stores;
    case 'product_prices': {
      const id = eq('id');
      const bc = params.get('barcode');
      let rows = products;
      if (id) rows = rows.filter((p) => p.id === id);
      if (bc && bc.startsWith('in.')) { const list = bc.slice(4, -1).split(','); rows = rows.filter((p) => p.barcode && list.includes(p.barcode)); }
      return rows;
    }
    case 'categories': return categories;
    case 'app_settings': { const k = eq('key'); return k ? settings.filter((s) => s.key === k) : settings; }
    case 'profiles': return [profile];
    default: return [];
  }
}

/** Route every backend call to the fixtures above. */
export async function mockBackend(page: Page) {
  await page.route(`${SUPABASE_URL}/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const accept = req.headers()['accept'] ?? '';
    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname.endsWith('/user')) return route.fulfill({ json: session().user });
      if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, body: '' });
      return route.fulfill({ json: {} });
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null });
    if (url.pathname.startsWith('/rest/v1/')) {
      if (req.method() !== 'GET' && req.method() !== 'HEAD') return route.fulfill({ status: 201, json: [] });
      const rows = table(url.pathname, url.searchParams);
      if (accept.includes('vnd.pgrst.object')) {
        if (rows.length === 1) return route.fulfill({ json: rows[0] });
        return route.fulfill({ status: 406, json: { code: 'PGRST116', details: `Results contain ${rows.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' } });
      }
      return route.fulfill({ json: rows, headers: { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` } });
    }
    return route.fulfill({ status: 404, body: '' });
  });
}

/** Skip onboarding and arrive signed in, the way a returning shopper does. */
export async function signedIn(page: Page) {
  const s = session();
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem('cb_onboarded', '1');
    window.localStorage.setItem('cb_lang', 'az');
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`, value: s });
}

export async function onboardedOnly(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('cb_onboarded', '1');
    window.localStorage.setItem('cb_lang', 'az');
  });
}
