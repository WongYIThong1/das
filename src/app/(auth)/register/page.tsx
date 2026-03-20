import { cookies } from 'next/headers';
import RegisterRoutePage from '../../../components/RegisterRoutePage';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{
    inviteCode?: string;
  }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const inviteCode = resolvedSearchParams.inviteCode?.trim() || cookieStore.get('activeInviteCode')?.value;

  return <RegisterRoutePage inviteCode={inviteCode} />;
}
