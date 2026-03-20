'use client';

import RegisterRoutePage from './RegisterRoutePage';

interface InviteRegisterPageProps {
  inviteCode: string;
}

export default function InviteRegisterPage({ inviteCode }: InviteRegisterPageProps) {
  return <RegisterRoutePage inviteCode={inviteCode} />;
}
