import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, verifySession } from '@/lib/server';

/**
 * Every page and API except /login and /api/auth/* requires a valid admin cookie.
 * /api/account is exempt because it authenticates the app user by their own
 * Supabase access token instead — an admin cookie would defeat its purpose.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth') || pathname.startsWith('/api/iap') || pathname.startsWith('/api/cron') || pathname.startsWith('/api/ai') || pathname.startsWith('/api/account') || pathname === '/icon.png') return NextResponse.next();
  const ok = await verifySession(req.cookies.get(COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
