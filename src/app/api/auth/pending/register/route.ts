import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { PendingRegisterAuthFlow } from '../../../../../lib/auth';
import { createPendingRegisterAuth, REGISTER_PENDING_COOKIE, LOGIN_PENDING_COOKIE } from '../../../../../lib/pending-auth';

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as PendingRegisterAuthFlow | null;
  if (
    !payload ||
    payload.mode !== 'register' ||
    !payload.email ||
    !payload.password ||
    !payload.identifierOrEmail
  ) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const nonce = await createPendingRegisterAuth(payload);
  const cookieStore = await cookies();
  cookieStore.set(REGISTER_PENDING_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });
  cookieStore.delete(LOGIN_PENDING_COOKIE);

  return NextResponse.json({ ok: true, pendingAuthFlow: payload }, { status: 200 });
}
