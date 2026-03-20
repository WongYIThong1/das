import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AuthGate from '../../components/AuthGate';
import { APP_SESSION_COOKIE } from '../../lib/session-cookie';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  if (cookieStore.get(APP_SESSION_COOKIE)?.value === '1') {
    redirect('/home');
  }

  return <AuthGate>{children}</AuthGate>;
}
