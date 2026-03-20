import type { NextResponse } from 'next/server';

export const APP_SESSION_COOKIE = 'app_session';

type SessionCookieOptions = {
  expiresInSeconds?: number;
};

function getCookieMaxAge(expiresInSeconds?: number) {
  if (typeof expiresInSeconds !== 'number' || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    // Keep a short fallback window if the backend does not provide expiresIn.
    return 60 * 60;
  }
  return Math.max(60, Math.floor(expiresInSeconds));
}

export function setAppSessionCookie(response: NextResponse, options?: SessionCookieOptions) {
  response.cookies.set(APP_SESSION_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: getCookieMaxAge(options?.expiresInSeconds),
  });
}

export function clearAppSessionCookie(response: NextResponse) {
  response.cookies.set(APP_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
