import { createClient } from '@supabase/supabase-js';

/** Cookie name for the admin session. */
export const COOKIE = 'cb_admin';

const enc = new TextEncoder();
const secret = () => process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'change-me';

// base64url helpers that work in both the Node and Edge runtimes (no Buffer).
const b64u = (bytes: Uint8Array) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return b64u(new Uint8Array(sig));
}

/** Session token: base64url(email|expiry).signature — verified in middleware and API routes (Web Crypto, edge-safe). */
export async function signSession(email: string, days = 30): Promise<string> {
  const payload = b64u(enc.encode(`${email}|${Date.now() + days * 86400000}`));
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySession(token: string | undefined): Promise<{ email: string } | null> {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  if ((await hmac(payload)) !== sig) return null;
  const [email, exp] = fromB64u(payload).split('|');
  if (!email || Number(exp) < Date.now()) return null;
  return { email };
}

/** Constant-time string compare for the password check. */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}

/** Server-only Supabase client with the service role key (bypasses RLS). Never import from client code. */
export function adminDb() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY təyin edilməyib');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireAdmin(req: Request): Promise<{ email: string } | null> {
  const cookie = req.headers.get('cookie') ?? '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return verifySession(m?.[1]);
}

/** Paginate through all rows bypassing PostgREST's default 1000-row cap.
 *  Pass a factory: (from, to) => supabaseQuery.range(from, to) */
export async function fetchAll<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const PAGE = 1000;
  let offset = 0;
  const all: T[] = [];
  while (true) {
    const { data, error } = await makeQuery(offset, offset + PAGE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

/** Supabase errors are plain objects (not Error instances); normalise to text. */
export function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { message?: string; hint?: string; details?: string; code?: string };
    return [o.message, o.details, o.hint, o.code ? `(${o.code})` : ''].filter(Boolean).join(' · ');
  }
  return String(e);
}
