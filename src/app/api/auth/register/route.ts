import { NextResponse } from 'next/server';
import { applySetCookies, jsonError } from '../../../../lib/auth-route';
import { proxyAuthRequest } from '../../../../lib/auth-server';
import { setAppSessionCookie } from '../../../../lib/session-cookie';

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    name?: string;
    email?: string;
    password?: string;
    inviteCode?: string;
  } | null;

  const result = await proxyAuthRequest(
    '/auth/user/register',
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
    return applySetCookies(jsonError(result.error, result.status), result.setCookies, request);
  }

  return jsonError('service_unavailable', 503);
}
