import { NextResponse } from 'next/server';
import { applySetCookies, jsonError } from '../../../../lib/auth-route';
import { proxyAuthRequest } from '../../../../lib/auth-server';
import { clearAppSessionCookie, setAppSessionCookie } from '../../../../lib/session-cookie';

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
