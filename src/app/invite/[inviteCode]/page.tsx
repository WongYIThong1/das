import { redirect } from 'next/navigation';

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

  redirect(`/api/auth/invitecode?inviteCode=${encodeURIComponent(normalizedInviteCode)}`);
}
