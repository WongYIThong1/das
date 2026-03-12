'use client';

import { useRouter } from 'next/navigation';
import { AuthPage } from '../../../components/AuthPage';

export default function LoginPage() {
  const router = useRouter();

  return <AuthPage mode="login" onNavigate={(path) => router.push(path)} />;
}
