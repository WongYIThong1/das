import { proxyToBackend } from '@/lib/server/proxy';

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL ?? 'http://localhost:8080';

export async function GET(request: Request) {
  return proxyToBackend(request, {
    backendBaseUrl: BACKEND_BASE_URL,
    upstreamPath: '/creditor/lists',
    allowedMethods: ['GET'],
    timeoutMs: 30_000,
    csrf: { enabled: false },
  });
}
