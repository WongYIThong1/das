import { NextResponse } from 'next/server';

function getBackendBaseUrl() {
  const baseUrl = process.env.BACKEND_BASE_URL?.trim();
  if (!baseUrl) return null;
  return baseUrl.replace(/\/+$/, '');
}

export async function POST(request: Request) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization')?.trim();
  if (!authorization) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    const response = await fetch(`${baseUrl}/user/purchase-invoice/void`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data = (await response.json().catch(() => null)) as unknown;
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
