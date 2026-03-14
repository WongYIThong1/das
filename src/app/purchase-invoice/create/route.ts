import { proxyToBackend } from '@/lib/server/proxy';

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL ?? 'http://localhost:8080';

export async function POST(request: Request) {
  return proxyToBackend(request, {
    backendBaseUrl: BACKEND_BASE_URL,
    upstreamPath: '/purchase-invoice/create',
    allowedMethods: ['POST'],
    maxBodyBytes: 20 * 1024 * 1024,
    timeoutMs: 120_000,
    csrf: { enabled: true, allowSameSite: true },
  });
}
