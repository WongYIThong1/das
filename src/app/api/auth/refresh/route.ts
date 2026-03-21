import { NextResponse } from 'next/server';
import { applySetCookies, jsonError } from '../../../../lib/auth-route';
import { proxyAuthRequest } from '../../../../lib/auth-server';
import { clearAppSessionCookie, clearRefreshTokenCookie, setAppSessionCookie } from '../../../../lib/session-cookie';

function normalizeRedirectPath(raw: string | null | undefined) {
  const candidate = raw?.trim();
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return '/home';
  }
  if (candidate.startsWith('/api/auth/refresh')) {
    return '/home';
  }
  return candidate;
}

function redirectTo(request: Request, pathname: string) {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = '';
  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  const incomingCookie = request.headers.get('cookie') ?? '';
  console.info('[auth refresh route] incoming cookies', {
    hasRefreshToken: /(?:^|;\s*)refresh_token=/.test(incomingCookie),
    cookieLength: incomingCookie.length,
  });

  const result = await proxyAuthRequest(
    '/auth/user/refresh',
    {
      method: 'POST',
    },
    request.headers
  );

  console.info('[auth refresh route] proxy result', {
    ok: result.ok,
    status: result.status,
    setCookieCount: result.setCookies.length,
    cookieNames: result.setCookies.map((cookie) => cookie.split('=')[0]?.trim() || 'unknown'),
  });

  if (result.ok) {
    const response = NextResponse.json(result.data, { status: result.status });
    const sessionLike = result.data as { expiresIn?: unknown } | null;
    const expiresIn = typeof sessionLike?.expiresIn === 'number' ? sessionLike.expiresIn : undefined;
    setAppSessionCookie(response, { expiresInSeconds: expiresIn, request });
    applySetCookies(response, result.setCookies, request);
    console.info('[auth refresh route] outgoing response cookies', {
      setCookieHeaders: response.headers.getSetCookie().map((cookie) => cookie.split(';')[0]),
    });
    return response;
  }

  if ('error' in result) {
    console.warn('[auth refresh route] upstream rejected refresh', {
      status: result.status,
      error: result.error,
    });
    const response = applySetCookies(jsonError(result.error, result.status), result.setCookies, request);
    if (result.status === 401 || result.status === 403) {
      clearAppSessionCookie(response, request);
      clearRefreshTokenCookie(response, request);
    }
    return response;
  }

  const response = jsonError('service_unavailable', 503);
  clearAppSessionCookie(response, request);
  clearRefreshTokenCookie(response, request);
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectPath = normalizeRedirectPath(url.searchParams.get('redirect'));
  const result = await proxyAuthRequest(
    '/auth/user/refresh',
    {
      method: 'POST',
    },
    request.headers
  );

  if (result.ok) {
    const target = redirectTo(request, redirectPath);
    const response = applySetCookies(target, result.setCookies, request);
    const sessionLike = result.data as { expiresIn?: unknown } | null;
    const expiresIn = typeof sessionLike?.expiresIn === 'number' ? sessionLike.expiresIn : undefined;
    setAppSessionCookie(response, { expiresInSeconds: expiresIn, request });
    return response;
  }

  const target = redirectTo(request, '/login');
  const response = 'error' in result ? applySetCookies(target, result.setCookies, request) : target;
  if (redirectPath !== '/home') {
    const loginUrl = new URL(response.headers.get('location') ?? '/login', url.origin);
    loginUrl.searchParams.set('redirect', redirectPath);
    response.headers.set('location', loginUrl.toString());
  }
  if ('error' in result && (result.status === 401 || result.status === 403)) {
    clearAppSessionCookie(response, request);
    clearRefreshTokenCookie(response, request);
  }
  return response;
}
