import { cookies } from 'next/headers';
import RegisterRoutePage from '../../../components/RegisterRoutePage';

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const inviteCode = cookieStore.get('activeInviteCode')?.value;

  return <RegisterRoutePage inviteCode={inviteCode} />;
}
