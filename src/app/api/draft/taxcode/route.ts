import { NextResponse } from 'next/server';

function getBackendBaseUrl() {
  const baseUrl = process.env.BACKEND_BASE_URL?.trim();
  if (!baseUrl) return null;
  return baseUrl.replace(/\/+$/, '');
}

export async function GET(request: Request) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization')?.trim();
  if (!authorization) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`${baseUrl}/user/draft/taxcode`);
  upstreamUrl.search = incomingUrl.search;

  try {
    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { Authorization: authorization },
      cache: 'no-store',
    });

    const data = (await response.json().catch(() => null)) as unknown;
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
