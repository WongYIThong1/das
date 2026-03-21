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

  try {
    const body = await request.text();
    const trimmedBody = body.trim();
    const isNullPayload = trimmedBody.length === 0 || trimmedBody === 'null';

    if (isNullPayload) {
      console.warn('[purchase-invoice submit route] rejected empty/null payload');
      return NextResponse.json(
        { error: 'invalid_request', message: 'submit payload is empty or null' },
        { status: 400 }
      );
    }

    let parsedBody: unknown = null;
    try {
      parsedBody = JSON.parse(trimmedBody) as unknown;
    } catch {
      return NextResponse.json(
        { error: 'invalid_request', message: 'submit payload is not valid JSON' },
        { status: 400 }
      );
    }
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'submit payload must be a JSON object' },
        { status: 400 }
      );
    }
    const normalizedBody = JSON.stringify(parsedBody);

    console.log('[submit] raw body from frontend:', trimmedBody.slice(0, 500));
    console.log('[submit] normalized body to backend:', normalizedBody.slice(0, 500));

    const response = await fetch(`${baseUrl}/user/purchase-invoice/submit`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: normalizedBody,
    });

    const raw = await response.text();
    console.log('[submit] backend status:', response.status, 'raw:', raw);
    const trimmedRaw = raw.trim();
    let parsed: unknown = null;
    if (trimmedRaw.length > 0) {
      try {
        parsed = JSON.parse(trimmedRaw) as unknown;
      } catch {
        parsed = null;
      }
    }

    if (parsed !== null) {
      return NextResponse.json(parsed, { status: response.status });
    }

    if (trimmedRaw.length > 0) {
      return NextResponse.json(
        {
          error: response.ok ? undefined : 'upstream_error',
          message: trimmedRaw,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(
      {
        error: response.ok ? undefined : 'upstream_empty_error',
        message: response.ok ? 'ok' : 'Upstream returned an empty error response.',
      },
      { status: response.status }
    );
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
