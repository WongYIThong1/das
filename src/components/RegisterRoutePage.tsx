'use client';

import { useRouter } from 'next/navigation';
import { AuthPage } from './AuthPage';

interface RegisterRoutePageProps {
  inviteCode?: string;
}

export default function RegisterRoutePage({ inviteCode }: RegisterRoutePageProps) {
  const router = useRouter();

  return <AuthPage mode="register" inviteCode={inviteCode} onNavigate={(path) => router.push(path)} />;
}
