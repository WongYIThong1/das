'use client';

import { useRouter } from 'next/navigation';
import { TotpPage } from '../../../components/TotpPage';

export default function TotpRoutePage() {
  const router = useRouter();

  return <TotpPage onNavigate={(path) => router.push(path)} onVerified={() => router.push('/purchase-invoice')} />;
}
