import { proxyToBackend, readRequestBodyWithLimit } from '@/lib/server/proxy';

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL ?? 'http://localhost:8080';

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
  const requestBody = await readRequestBodyWithLimit(request, 2 * 1024 * 1024);
  if (!requestBody) {
    return Response.json({ error: 'Missing request body' }, { status: 400 });
  }

  const { requestId, previewTaskId } = readSubmitMeta(requestBody);

  console.info('[purchase-invoice-submit-proxy] forward', {
    requestId,
    previewTaskId,
  });

  const response = await proxyToBackend(request, {
    backendBaseUrl: BACKEND_BASE_URL,
    upstreamPath: '/purchase-invoice/submit',
    allowedMethods: ['POST'],
    maxBodyBytes: 2 * 1024 * 1024,
    bodyOverride: requestBody,
    timeoutMs: 60_000,
    csrf: { enabled: true, allowSameSite: true },
  });

  const headers = new Headers(response.headers);
  headers.set('x-purchase-invoice-request-id', requestId);
  headers.set('x-purchase-invoice-preview-task-id', previewTaskId);
  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers,
  });
}
