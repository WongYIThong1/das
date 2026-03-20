export const dynamic = 'force-dynamic';

function getBackendBaseUrl() {
  const baseUrl = process.env.BACKEND_BASE_URL?.trim();
  if (!baseUrl) return null;
  return baseUrl.replace(/\/+$/, '');
}

export async function GET(request: Request) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    return new Response('service_unavailable', { status: 503 });
  }

  const authorization = request.headers.get('authorization')?.trim();
  if (!authorization) {
    return new Response('invalid_request', { status: 400 });
  }

  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`${baseUrl}/user/purchase-invoice/batch/group/events`);
  upstreamUrl.search = incomingUrl.search;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: authorization,
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch {
    return new Response('service_unavailable', { status: 503 });
  }

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    return new Response('upstream_error', { status: upstreamResponse.status });
  }

  // Pump upstream body into a new ReadableStream so we can swallow
  // socket-close errors that occur when the backend ends the SSE stream.
  const upstreamReader = upstreamResponse.body.getReader();
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await upstreamReader.read();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch {
        // Backend closed the socket (e.g. after all events sent) — close cleanly
        controller.close();
      }
    },
    cancel() {
      upstreamReader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
