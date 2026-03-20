import { NextResponse } from 'next/server';
import { verifyInviteCode } from '../../../../lib/invitecode-server';

function getPublicOrigin(request: Request) {
  const configuredOrigin = process.env.APP_URL?.trim();
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, '');
  }

  const host = request.headers.get('x-forwarded-host')?.trim() || request.headers.get('host')?.trim();
  const proto = request.headers.get('x-forwarded-proto')?.trim() || 'https';
  if (host) {
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

function redirectTo(request: Request, pathname: string) {
  const url = new URL(pathname, getPublicOrigin(request));
  url.pathname = pathname;
  url.search = '';
  return NextResponse.redirect(url);
}

async function handleInviteCode(request: Request, inviteCode: string) {
  const normalizedInviteCode = inviteCode.trim();

  if (!normalizedInviteCode) {
    return redirectTo(request, '/login');
  }

  const result = await verifyInviteCode(normalizedInviteCode);
  if (!result.ok) {
    return redirectTo(request, '/login');
  }

  const response = redirectTo(request, `/register?inviteCode=${encodeURIComponent(normalizedInviteCode)}`);
  response.cookies.set('activeInviteCode', normalizedInviteCode, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60,
  });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const inviteCode = url.searchParams.get('inviteCode')?.trim() ?? '';
  return handleInviteCode(request, inviteCode);
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { inviteCode?: string } | null;
  const inviteCode = payload?.inviteCode?.trim() ?? '';

  if (!inviteCode) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  }

  const result = await verifyInviteCode(inviteCode);
  if (result.ok) {
    const response = NextResponse.json({ ok: true }, { status: 200 });
    response.cookies.set('activeInviteCode', inviteCode, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60,
    });
    return response;
  }

  if (result.status === 400) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  }

  if (result.status === 401) {
    return NextResponse.json({ ok: false, error: 'invalid_invite_code' }, { status: 401 });
  }

  return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 503 });
}
