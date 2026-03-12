'use client';

import { useRouter } from 'next/navigation';
import { AuthPage } from '../../../components/AuthPage';

export default function RegisterPage() {
  const router = useRouter();

  return <AuthPage mode="register" onNavigate={(path) => router.push(path)} />;
}
