import { NextResponse } from 'next/server';
import { applySetCookies, jsonError } from '../../../../lib/auth-route';
import { proxyAuthRequest } from '../../../../lib/auth-server';
import { setAppSessionCookie } from '../../../../lib/session-cookie';

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  const result = await proxyAuthRequest(
    '/auth/user/login',
    {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    },
    request.headers
  );

  if (result.ok) {
    const response = NextResponse.json(result.data, { status: result.status });
    const sessionLike = result.data as { accessToken?: unknown; expiresIn?: unknown } | null;
    if (typeof sessionLike?.accessToken === 'string') {
      const expiresIn = typeof sessionLike.expiresIn === 'number' ? sessionLike.expiresIn : undefined;
      setAppSessionCookie(response, { expiresInSeconds: expiresIn, request });
    }
    return applySetCookies(response, result.setCookies, request);
  }

  if ('error' in result) {
    if (result.error === 'mfa_required' && result.data) {
      return applySetCookies(NextResponse.json(result.data, { status: result.status }), result.setCookies, request);
    }
    return applySetCookies(jsonError(result.error, result.status), result.setCookies, request);
  }

  return jsonError('service_unavailable', 503);
}
