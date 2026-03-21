import { NextResponse } from 'next/server';

function isAllowedProtocol(protocol: string) {
  return protocol === 'http:' || protocol === 'https:';
}

function hasAllowedPathname(pathname: string) {
  return pathname.startsWith('/images/') || pathname.startsWith('/files/');
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const rawUrl = requestUrl.searchParams.get('url');

  if (!rawUrl) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  if (!isAllowedProtocol(target.protocol) || !hasAllowedPathname(target.pathname)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'upstream_unavailable' }, { status: upstream.status || 502 });
    }

    const response = new NextResponse(upstream.body, {
      status: upstream.status,
    });

    const contentType = upstream.headers.get('content-type');
    const contentDisposition = upstream.headers.get('content-disposition');
    const contentLength = upstream.headers.get('content-length');
    const cacheControl = upstream.headers.get('cache-control');

    if (contentType) response.headers.set('Content-Type', contentType);
    if (contentDisposition) response.headers.set('Content-Disposition', contentDisposition);
    if (contentLength) response.headers.set('Content-Length', contentLength);
    response.headers.set('Cache-Control', cacheControl ?? 'private, no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');

    return response;
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
