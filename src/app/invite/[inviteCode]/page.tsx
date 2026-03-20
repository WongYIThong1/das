import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyInviteCode } from '../../../lib/invitecode-server';

interface InvitePageProps {
  params: Promise<{
    inviteCode: string;
  }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { inviteCode } = await params;
  const normalizedInviteCode = inviteCode.trim();

  if (!normalizedInviteCode) {
    redirect('/login');
  }

  const result = await verifyInviteCode(normalizedInviteCode);
  if (!result.ok) {
    redirect('/login');
  }

  const cookieStore = await cookies();
  cookieStore.set('activeInviteCode', normalizedInviteCode, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60,
  });

  redirect('/register');
}
