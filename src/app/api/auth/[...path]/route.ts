const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL ?? 'http://localhost:8080';

function buildTargetUrl(request: Request, pathSegments: string[] | undefined) {
  const requestUrl = new URL(request.url);
  const upstreamPath = `/api/auth/${(pathSegments ?? []).join('/')}`;
  return new URL(`${upstreamPath}${requestUrl.search}`, BACKEND_BASE_URL);
}

async function proxyRequest(request: Request, pathSegments: string[] | undefined) {
  const targetUrl = buildTargetUrl(request, pathSegments);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const method = request.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body,
    redirect: 'manual',
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') {
      responseHeaders.set(key, value);
    }
  });

  const setCookies = typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : [];
  for (const cookie of setCookies) {
    responseHeaders.append('set-cookie', cookie);
  }
  if (setCookies.length === 0) {
    const setCookie = upstream.headers.get('set-cookie');
    if (setCookie) {
      responseHeaders.set('set-cookie', setCookie);
    }
  }

  const responseBody = await upstream.arrayBuffer();
  return new Response(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function POST(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PUT(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PATCH(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function DELETE(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function OPTIONS(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}
