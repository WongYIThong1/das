import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPendingAuthFlow, LOGIN_PENDING_COOKIE, REGISTER_PENDING_COOKIE } from '../../../../lib/pending-auth';

export async function GET() {
  const cookieStore = await cookies();
  const registerNonce = cookieStore.get(REGISTER_PENDING_COOKIE)?.value ?? null;
  const loginNonce = cookieStore.get(LOGIN_PENDING_COOKIE)?.value ?? null;
  const pendingAuthFlow = await getPendingAuthFlow(registerNonce, loginNonce);

  if (!pendingAuthFlow) {
    cookieStore.delete(REGISTER_PENDING_COOKIE);
    cookieStore.delete(LOGIN_PENDING_COOKIE);
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ pendingAuthFlow }, { status: 200 });
}
