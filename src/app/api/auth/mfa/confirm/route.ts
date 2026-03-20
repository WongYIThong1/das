import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { applySetCookies, jsonError } from '../../../../../lib/auth-route';
import { proxyAuthRequest } from '../../../../../lib/auth-server';
import {
  clearPendingAuth,
  getPendingRegisterAuth,
  LOGIN_PENDING_COOKIE,
  REGISTER_PENDING_COOKIE,
} from '../../../../../lib/pending-auth';

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    totpCode?: string;
  } | null;
  const cookieStore = await cookies();
  const registerNonce = cookieStore.get(REGISTER_PENDING_COOKIE)?.value ?? null;
  const loginNonce = cookieStore.get(LOGIN_PENDING_COOKIE)?.value ?? null;
  const pendingRegister = registerNonce ? await getPendingRegisterAuth(registerNonce) : null;
  const resolvedPayload = {
    email: payload?.email ?? pendingRegister?.email,
    password: payload?.password ?? pendingRegister?.password,
    totpCode: payload?.totpCode,
  };
  if (!resolvedPayload.email || !resolvedPayload.password || !resolvedPayload.totpCode) {
    return jsonError('invalid_request', 400);
  }

  const result = await proxyAuthRequest(
    '/auth/user/mfa/confirm',
    {
      method: 'POST',
      body: JSON.stringify(resolvedPayload),
    },
    request.headers
  );

  if (result.ok) {
    const response = applySetCookies(NextResponse.json(result.data, { status: result.status }), result.setCookies);
    if (registerNonce || loginNonce) {
      await clearPendingAuth(registerNonce, loginNonce);
    }
    response.cookies.delete(REGISTER_PENDING_COOKIE);
    response.cookies.delete(LOGIN_PENDING_COOKIE);
    return response;
  }

  if ('error' in result) {
    return applySetCookies(jsonError(result.error, result.status), result.setCookies);
  }

  return jsonError('service_unavailable', 503);
}
