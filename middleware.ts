import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { APP_SESSION_COOKIE } from './src/lib/session-cookie';

const AUTH_PAGES = new Set(['/login', '/register']);
const TOTP_PAGES = new Set(['/totp', '/toptp']);
const REGISTER_PENDING_COOKIE = 'registerPendingKey';
const LOGIN_PENDING_COOKIE = 'loginPendingKey';

function isBypassedPath(pathname: string) {
  return (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  );
}

function isPublicPath(pathname: string) {
  return pathname.startsWith('/invite/');
}

function buildRedirectResponse(request: NextRequest, pathname: string) {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = '';
  return NextResponse.redirect(target);
}

function buildRefreshBootstrapResponse(request: NextRequest) {
  const target = request.nextUrl.clone();
  target.pathname = '/api/auth/refresh';
  target.search = '';
  const redirectPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  target.searchParams.set('redirect', redirectPath || '/home');
  return NextResponse.redirect(target);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isBypassedPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.get(APP_SESSION_COOKIE)?.value === '1';
  const hasPendingFlow =
    Boolean(request.cookies.get(REGISTER_PENDING_COOKIE)?.value) ||
    Boolean(request.cookies.get(LOGIN_PENDING_COOKIE)?.value);

  if (TOTP_PAGES.has(pathname)) {
    if (hasSession) {
      return buildRedirectResponse(request, '/home');
    }
    if (!hasPendingFlow) {
      return buildRedirectResponse(request, '/login');
    }
    return NextResponse.next();
  }

  if (AUTH_PAGES.has(pathname)) {
    if (hasSession) {
      return buildRedirectResponse(request, '/home');
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!hasSession) {
    return buildRefreshBootstrapResponse(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
