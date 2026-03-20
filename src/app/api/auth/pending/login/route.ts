import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { PendingLoginAuthFlow } from '../../../../../lib/auth';
import { createPendingLoginAuth, LOGIN_PENDING_COOKIE, REGISTER_PENDING_COOKIE } from '../../../../../lib/pending-auth';

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as PendingLoginAuthFlow | null;
  if (!payload || payload.mode !== 'login' || !payload.mfaToken || !payload.identifierOrEmail) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const nonce = await createPendingLoginAuth(payload);
  const cookieStore = await cookies();
  cookieStore.set(LOGIN_PENDING_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });
  cookieStore.delete(REGISTER_PENDING_COOKIE);

  return NextResponse.json({ ok: true, pendingAuthFlow: payload }, { status: 200 });
}
