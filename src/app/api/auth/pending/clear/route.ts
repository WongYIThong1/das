import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { clearPendingAuth, LOGIN_PENDING_COOKIE, REGISTER_PENDING_COOKIE } from '../../../../../lib/pending-auth';

export async function POST() {
  const cookieStore = await cookies();
  const registerNonce = cookieStore.get(REGISTER_PENDING_COOKIE)?.value ?? null;
  const loginNonce = cookieStore.get(LOGIN_PENDING_COOKIE)?.value ?? null;

  await clearPendingAuth(registerNonce, loginNonce);
  cookieStore.delete(REGISTER_PENDING_COOKIE);
  cookieStore.delete(LOGIN_PENDING_COOKIE);

  return NextResponse.json({ ok: true }, { status: 200 });
}
