const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL ?? 'http://localhost:8080';

function buildTargetUrl(request: Request, taskId: string) {
  const requestUrl = new URL(request.url);
  return new URL(`/purchase-invoice/create/${taskId}${requestUrl.search}`, BACKEND_BASE_URL);
}

export async function GET(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  const targetUrl = buildTargetUrl(request, taskId);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const upstream = await fetch(targetUrl, {
    method: 'GET',
    headers,
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
