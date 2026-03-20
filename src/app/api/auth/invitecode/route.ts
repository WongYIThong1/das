import { NextResponse } from 'next/server';
import { verifyInviteCode } from '../../../../lib/invitecode-server';

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { inviteCode?: string } | null;
  const inviteCode = payload?.inviteCode?.trim() ?? '';

  if (!inviteCode) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  }

  const result = await verifyInviteCode(inviteCode);
  if (result.ok) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (result.status === 400) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  }

  if (result.status === 401) {
    return NextResponse.json({ ok: false, error: 'invalid_invite_code' }, { status: 401 });
  }

  return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 503 });
}
