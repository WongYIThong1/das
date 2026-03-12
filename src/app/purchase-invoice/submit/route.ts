const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL ?? 'http://localhost:8080';

function buildTargetUrl(request: Request) {
  const requestUrl = new URL(request.url);
  return new URL(`/purchase-invoice/submit${requestUrl.search}`, BACKEND_BASE_URL);
}

function readSubmitMeta(bodyBuffer: ArrayBuffer) {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bodyBuffer)) as {
      requestId?: unknown;
      previewTaskId?: unknown;
    };

    return {
      requestId: typeof parsed.requestId === 'string' ? parsed.requestId : 'unknown',
      previewTaskId: typeof parsed.previewTaskId === 'string' ? parsed.previewTaskId : 'unknown',
    };
  } catch {
    return {
      requestId: 'unknown',
      previewTaskId: 'unknown',
    };
  }
}

export async function POST(request: Request) {
  const targetUrl = buildTargetUrl(request);
  const requestBody = await request.arrayBuffer();
  const { requestId, previewTaskId } = readSubmitMeta(requestBody);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  let upstream: Response;

  const forwardOnce = () =>
    fetch(targetUrl, {
      method: 'POST',
      headers,
      body: requestBody,
      redirect: 'manual',
    });

  console.info('[purchase-invoice-submit-proxy] forward', {
    requestId,
    previewTaskId,
    target: targetUrl.toString(),
    attempt: 1,
  });

  try {
    upstream = await forwardOnce();
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'upstream fetch failed';
    console.error('[purchase-invoice-submit-proxy] upstream fetch failed', {
      requestId,
      previewTaskId,
      target: targetUrl.toString(),
      message,
      attempt: 1,
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    console.info('[purchase-invoice-submit-proxy] retry forward', {
      requestId,
      previewTaskId,
      target: targetUrl.toString(),
      attempt: 2,
    });

    try {
      upstream = await forwardOnce();
    } catch (retryError) {
      const retryMessage = retryError instanceof Error && retryError.message ? retryError.message : 'upstream fetch retry failed';
      console.error('[purchase-invoice-submit-proxy] upstream retry failed', {
        requestId,
        previewTaskId,
        target: targetUrl.toString(),
        message: retryMessage,
        attempt: 2,
      });
      return Response.json(
        {
          error: 'purchase invoice submit upstream unavailable',
          message: retryMessage,
          target: targetUrl.toString(),
          requestId,
          previewTaskId,
        },
        { status: 502 }
      );
    }
  }

  console.info('[purchase-invoice-submit-proxy] upstream response', {
    requestId,
    previewTaskId,
    status: upstream.status,
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

  responseHeaders.set('x-purchase-invoice-request-id', requestId);
  responseHeaders.set('x-purchase-invoice-preview-task-id', previewTaskId);

  const responseBody = await upstream.arrayBuffer();
  return new Response(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
