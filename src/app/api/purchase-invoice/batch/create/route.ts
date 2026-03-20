import { NextResponse } from 'next/server';

function getBackendBaseUrl() {
  const baseUrl = process.env.BACKEND_BASE_URL?.trim();
  if (!baseUrl) return null;
  return baseUrl.replace(/\/+$/, '');
}

export async function POST(request: Request) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const authorization = request.headers.get('authorization')?.trim();
  if (!authorization) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  try {
    const incoming = await request.formData();
    const form = new FormData();
    for (const [key, value] of incoming.entries()) {
      form.append(key, value);
    }
    const response = await fetch(`${baseUrl}/user/purchase-invoice/batch/create`, {
      method: 'POST',
      headers: { Authorization: authorization },
      body: form,
    });
    const text = await response.text();
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { /* non-JSON */ }
    if (!response.ok) {
      const err = (data as any) ?? {};
      return NextResponse.json(
        { error: err.error ?? err.message ?? (text.slice(0, 200) || 'upstream_error') },
        { status: response.status },
      );
    }
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error('[batch/create] proxy error:', err);
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
