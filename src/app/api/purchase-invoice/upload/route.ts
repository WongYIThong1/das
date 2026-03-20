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

  const upstreamUrl = `${baseUrl}/user/purchase-invoice/upload`;

  try {
    const contentType = request.headers.get('content-type') ?? '';

    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': contentType,
      },
      // Stream the body directly instead of buffering the entire upload in RAM.
      // Without this, Next.js reads the whole multipart payload before forwarding,
      // doubling the effective upload time for large files.
      body: request.body,
      // @ts-expect-error Node.js fetch requires duplex:'half' for streaming request bodies
      duplex: 'half',
    });

    const data = (await response.json().catch(() => null)) as unknown;
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
