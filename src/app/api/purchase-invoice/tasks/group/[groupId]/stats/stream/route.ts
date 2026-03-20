import { NextResponse } from 'next/server';
import { makeSseResponse } from '../../../../../../_sse-proxy';

export const dynamic = 'force-dynamic';

function getBackendBaseUrl() {
  const baseUrl = process.env.BACKEND_BASE_URL?.trim();
  if (!baseUrl) return null;
  return baseUrl.replace(/\/+$/, '');
}

export async function GET(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  const authorization = request.headers.get('authorization')?.trim();
  if (!authorization) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { groupId } = await params;
  const upstreamUrl = `${baseUrl}/user/purchase-invoice/tasks/group/${groupId}/stats/stream`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Authorization: authorization, Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
      signal: request.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const data = (await upstream.json().catch(() => null)) as unknown;
      return NextResponse.json(data ?? { error: 'upstream_error' }, { status: upstream.status });
    }

    return makeSseResponse(upstream.body, request.signal);
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
