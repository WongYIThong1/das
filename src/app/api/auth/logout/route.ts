import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { applySetCookies, jsonError } from '../../../../lib/auth-route';
import { proxyAuthRequest } from '../../../../lib/auth-server';
import { clearPendingAuth, LOGIN_PENDING_COOKIE, REGISTER_PENDING_COOKIE } from '../../../../lib/pending-auth';
import { clearAppSessionCookie } from '../../../../lib/session-cookie';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const registerNonce = cookieStore.get(REGISTER_PENDING_COOKIE)?.value ?? null;
  const loginNonce = cookieStore.get(LOGIN_PENDING_COOKIE)?.value ?? null;
  const result = await proxyAuthRequest(
    '/auth/user/logout',
    {
      method: 'POST',
    },
    request.headers
  );

  if (registerNonce || loginNonce) {
    await clearPendingAuth(registerNonce, loginNonce);
  }

  if (result.ok) {
    const response = NextResponse.json(result.data, { status: result.status });
    response.cookies.delete(REGISTER_PENDING_COOKIE);
    response.cookies.delete(LOGIN_PENDING_COOKIE);
    clearAppSessionCookie(response, request);
    return applySetCookies(response, result.setCookies, request);
  }

  if ('error' in result) {
    const response = jsonError(result.error, result.status);
    response.cookies.delete(REGISTER_PENDING_COOKIE);
    response.cookies.delete(LOGIN_PENDING_COOKIE);
    clearAppSessionCookie(response, request);
    return applySetCookies(response, result.setCookies, request);
  }

  const response = jsonError('service_unavailable', 503);
  response.cookies.delete(REGISTER_PENDING_COOKIE);
  response.cookies.delete(LOGIN_PENDING_COOKIE);
  clearAppSessionCookie(response, request);
  return response;
}
