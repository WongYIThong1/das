import type { NextResponse } from 'next/server';

export const APP_SESSION_COOKIE = 'app_session';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

type SessionCookieOptions = {
  expiresInSeconds?: number;
  request?: Request;
};

function getCookieMaxAge(expiresInSeconds?: number) {
  if (typeof expiresInSeconds !== 'number' || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    // Keep a short fallback window if the backend does not provide expiresIn.
    return 60 * 60;
  }
  return Math.max(60, Math.floor(expiresInSeconds));
}

function shouldUseSecureCookie(request?: Request) {
  if (!request) {
    return process.env.NODE_ENV === 'production';
  }
  try {
    const url = new URL(request.url);
    if (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1')
    ) {
      return false;
    }
    return url.protocol === 'https:' || process.env.NODE_ENV === 'production';
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}

export function setAppSessionCookie(response: NextResponse, options?: SessionCookieOptions) {
  response.cookies.set(APP_SESSION_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookie(options?.request),
    path: '/',
    maxAge: getCookieMaxAge(options?.expiresInSeconds),
  });
}

export function clearAppSessionCookie(response: NextResponse, request?: Request) {
  response.cookies.set(APP_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookie(request),
    path: '/',
    maxAge: 0,
  });
}

export function clearRefreshTokenCookie(response: NextResponse, request?: Request) {
  const secure = shouldUseSecureCookie(request);
  const base = {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure,
    maxAge: 0,
  };

  // Clear all paths we may have used while normalizing proxy cookies.
  response.cookies.set(REFRESH_TOKEN_COOKIE, '', { ...base, path: '/' });
  response.cookies.set(REFRESH_TOKEN_COOKIE, '', { ...base, path: '/api/auth' });
  response.cookies.set(REFRESH_TOKEN_COOKIE, '', { ...base, path: '/auth/user' });
}
