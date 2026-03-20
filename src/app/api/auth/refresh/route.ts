import { NextResponse } from 'next/server';
import { applySetCookies, jsonError } from '../../../../lib/auth-route';
import { proxyAuthRequest } from '../../../../lib/auth-server';
import { clearAppSessionCookie, setAppSessionCookie } from '../../../../lib/session-cookie';

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
  const result = await proxyAuthRequest(
    '/auth/user/refresh',
    {
      method: 'POST',
    },
    request.headers
  );

  if (result.ok) {
    const response = applySetCookies(NextResponse.json(result.data, { status: result.status }), result.setCookies);
    const sessionLike = result.data as { expiresIn?: unknown } | null;
    const expiresIn = typeof sessionLike?.expiresIn === 'number' ? sessionLike.expiresIn : undefined;
    setAppSessionCookie(response, { expiresInSeconds: expiresIn });
    return response;
  }

  if ('error' in result) {
    const response = applySetCookies(jsonError(result.error, result.status), result.setCookies);
    if (result.status === 401 || result.status === 403) {
      clearAppSessionCookie(response);
    }
    return response;
  }

  const response = jsonError('service_unavailable', 503);
  clearAppSessionCookie(response);
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
    const response = applySetCookies(target, result.setCookies);
    const sessionLike = result.data as { expiresIn?: unknown } | null;
    const expiresIn = typeof sessionLike?.expiresIn === 'number' ? sessionLike.expiresIn : undefined;
    setAppSessionCookie(response, { expiresInSeconds: expiresIn });
    return response;
  }

  const target = redirectTo(request, '/login');
  const response = 'error' in result ? applySetCookies(target, result.setCookies) : target;
  if (redirectPath !== '/home') {
    const loginUrl = new URL(response.headers.get('location') ?? '/login', url.origin);
    loginUrl.searchParams.set('redirect', redirectPath);
    response.headers.set('location', loginUrl.toString());
  }
  if ('error' in result && (result.status === 401 || result.status === 403)) {
    clearAppSessionCookie(response);
  }
  return response;
}
