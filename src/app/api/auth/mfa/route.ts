import { NextResponse } from 'next/server';
import { applySetCookies, jsonError } from '../../../../lib/auth-route';
import { proxyAuthRequest } from '../../../../lib/auth-server';

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    mfaToken?: string;
    totpCode?: string;
  } | null;

  const result = await proxyAuthRequest(
    '/auth/user/mfa',
    {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
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
