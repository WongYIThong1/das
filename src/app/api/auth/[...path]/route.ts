import { encodePathSegments, proxyToBackend } from '@/lib/server/proxy';

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL ?? 'http://localhost:8080';

async function proxyRequest(request: Request, pathSegments: string[] | undefined) {
  let safePath: string;
  try {
    safePath = encodePathSegments(pathSegments);
  } catch {
    return Response.json({ error: 'Invalid path' }, { status: 400 });
  }

  return proxyToBackend(request, {
    backendBaseUrl: BACKEND_BASE_URL,
    upstreamPath: `/api/auth/${safePath}`,
    allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxBodyBytes: 2 * 1024 * 1024,
    timeoutMs: 30_000,
    csrf: { enabled: true, allowSameSite: true },
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
