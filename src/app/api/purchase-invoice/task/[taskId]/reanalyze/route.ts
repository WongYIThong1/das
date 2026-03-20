import { NextResponse } from 'next/server';

function getBackendBaseUrl() {
  const baseUrl = process.env.BACKEND_BASE_URL?.trim();
  if (!baseUrl) return null;
  return baseUrl.replace(/\/+$/, '');
}

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const authorization = request.headers.get('authorization')?.trim();
  if (!authorization) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { taskId } = await params;
  if (!taskId) return NextResponse.json({ error: 'missing_taskId' }, { status: 400 });

  try {
    const response = await fetch(`${baseUrl}/user/purchase-invoice/task/${encodeURIComponent(taskId)}/reanalyze`, {
      method: 'POST',
      headers: { Authorization: authorization },
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
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
