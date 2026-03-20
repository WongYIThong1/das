import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { applySetCookies, jsonError } from '../../../../lib/auth-route';
import { proxyAuthRequest } from '../../../../lib/auth-server';
import {
  clearPendingAuth,
  getPendingLoginAuth,
  LOGIN_PENDING_COOKIE,
  REGISTER_PENDING_COOKIE,
} from '../../../../lib/pending-auth';
import { setAppSessionCookie } from '../../../../lib/session-cookie';

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    mfaToken?: string;
    totpCode?: string;
  } | null;
  const cookieStore = await cookies();
  const loginNonce = cookieStore.get(LOGIN_PENDING_COOKIE)?.value ?? null;
  const registerNonce = cookieStore.get(REGISTER_PENDING_COOKIE)?.value ?? null;
  const pendingLogin = loginNonce ? await getPendingLoginAuth(loginNonce) : null;
  const resolvedPayload = {
    mfaToken: payload?.mfaToken ?? pendingLogin?.mfaToken,
    totpCode: payload?.totpCode,
  };
  if (!resolvedPayload.mfaToken || !resolvedPayload.totpCode) {
    return jsonError('invalid_request', 400);
  }

  const result = await proxyAuthRequest(
    '/auth/user/mfa',
    {
      method: 'POST',
      body: JSON.stringify(resolvedPayload),
    },
    request.headers
  );

  if (result.ok) {
    const response = applySetCookies(NextResponse.json(result.data, { status: result.status }), result.setCookies);
    const sessionLike = result.data as { expiresIn?: unknown } | null;
    const expiresIn = typeof sessionLike?.expiresIn === 'number' ? sessionLike.expiresIn : undefined;
    setAppSessionCookie(response, { expiresInSeconds: expiresIn });
    if (loginNonce || registerNonce) {
      await clearPendingAuth(registerNonce, loginNonce);
    }
    response.cookies.delete(LOGIN_PENDING_COOKIE);
    response.cookies.delete(REGISTER_PENDING_COOKIE);
    return response;
  }

  if ('error' in result) {
    return applySetCookies(jsonError(result.error, result.status), result.setCookies);
  }

  return jsonError('service_unavailable', 503);
}
