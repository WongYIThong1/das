import { encodePathSegment, proxyToBackend } from '@/lib/server/proxy';

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL ?? 'http://localhost:8080';

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  let encodedTaskId: string;
  try {
    encodedTaskId = encodePathSegment(taskId);
  } catch {
    return Response.json({ error: 'Invalid taskId' }, { status: 400 });
  }

  return proxyToBackend(request, {
    backendBaseUrl: BACKEND_BASE_URL,
    upstreamPath: `/purchase-invoice/create/${encodedTaskId}/cancel`,
    allowedMethods: ['POST'],
    timeoutMs: 30_000,
    csrf: { enabled: true, allowSameSite: true },
  });
}
