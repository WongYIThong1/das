const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL ?? 'http://localhost:8080';

function buildTargetUrl(request: Request) {
  const requestUrl = new URL(request.url);
  return new URL(`/purchase-invoice/create${requestUrl.search}`, BACKEND_BASE_URL);
}

export async function POST(request: Request) {
  const targetUrl = buildTargetUrl(request);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const upstream = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: await request.arrayBuffer(),
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
