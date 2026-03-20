import { NextResponse } from 'next/server';
import { applySetCookies, jsonError } from '../../../../lib/auth-route';
import { proxyAuthRequest } from '../../../../lib/auth-server';

export async function POST(request: Request) {
  const result = await proxyAuthRequest(
    '/auth/user/refresh',
    {
      method: 'POST',
    },
    request.headers
  );

  if (result.ok) {
    return applySetCookies(NextResponse.json(result.data, { status: result.status }), result.setCookies);
  }

  if ('error' in result) {
    return applySetCookies(jsonError(result.error, result.status), result.setCookies);
  }

  return jsonError('service_unavailable', 503);
}
