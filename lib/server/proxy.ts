type ProxyMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

export type ProxyToBackendOptions = {
  backendBaseUrl: string;
  upstreamPath: string;
  allowedMethods?: ProxyMethod[];
  maxBodyBytes?: number;
  timeoutMs?: number;
  bodyOverride?: ArrayBuffer;
  csrf?: {
    enabled: boolean;
    allowSameSite?: boolean;
  };
  forwardHeadersAllowlist?: string[];
};

const DEFAULT_FORWARDED_HEADERS = [
  'accept',
  'accept-language',
  'authorization',
  'content-type',
  'cookie',
  'user-agent',
] as const;

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

const SPOOFABLE_FORWARDING_HEADERS = new Set([
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-forwarded-port',
  'x-real-ip',
]);

function isUnsafeMethod(method: string) {
  const upper = method.toUpperCase();
  return upper === 'POST' || upper === 'PUT' || upper === 'PATCH' || upper === 'DELETE';
}

function buildUpstreamHeaders(request: Request, allowlist: string[]) {
  const allowed = new Set(allowlist.map((value) => value.toLowerCase()));
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (allowed.has(lower)) {
      headers.set(key, value);
    }
  });

  for (const key of HOP_BY_HOP_HEADERS) {
    headers.delete(key);
  }
  for (const key of SPOOFABLE_FORWARDING_HEADERS) {
    headers.delete(key);
  }

  return headers;
}

function enforceCsrf(request: Request, options: ProxyToBackendOptions) {
  const enabled = options.csrf?.enabled ?? false;
  if (!enabled) return null;
  if (!isUnsafeMethod(request.method)) return null;

  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');

  if (origin) {
    if (origin !== expectedOrigin) {
      return Response.json({ error: 'CSRF blocked' }, { status: 403 });
    }
    return null;
  }

  const allowSameSite = options.csrf?.allowSameSite ?? true;
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (allowSameSite && (secFetchSite === 'same-origin' || secFetchSite === 'same-site')) {
    return null;
  }

  return Response.json({ error: 'CSRF blocked' }, { status: 403 });
}

async function readBodyWithLimit(request: Request, maxBytes: number) {
  if (!request.body) return undefined;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error('payload too large');
      }
      chunks.push(value);
    }
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

export async function readRequestBodyWithLimit(request: Request, maxBytes: number) {
  return readBodyWithLimit(request, maxBytes);
}

function copyResponseHeaders(upstream: Response) {
  const headers = new Headers();

  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'set-cookie') return;
    if (HOP_BY_HOP_HEADERS.has(lower)) return;
    headers.set(key, value);
  });

  const setCookies = typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : [];
  for (const cookie of setCookies) headers.append('set-cookie', cookie);
  if (setCookies.length === 0) {
    const setCookie = upstream.headers.get('set-cookie');
    if (setCookie) headers.set('set-cookie', setCookie);
  }

  headers.set('cache-control', 'no-store');
  headers.set('pragma', 'no-cache');
  return headers;
}

function safeProxyError(message: string, status = 502) {
  return Response.json({ error: message }, { status });
}

export function encodePathSegment(segment: string) {
  if (!segment || segment === '.' || segment === '..') {
    throw new Error('invalid path segment');
  }
  if (segment.includes('/') || segment.includes('\\')) {
    throw new Error('invalid path segment');
  }
  return encodeURIComponent(segment);
}

export function encodePathSegments(segments: string[] | undefined) {
  return (segments ?? []).map(encodePathSegment).join('/');
}

export async function proxyToBackend(request: Request, options: ProxyToBackendOptions) {
  const method = request.method.toUpperCase() as ProxyMethod;

  if (options.allowedMethods && !options.allowedMethods.includes(method)) {
    return new Response(null, { status: 405 });
  }

  const csrf = enforceCsrf(request, options);
  if (csrf) return csrf;

  const requestUrl = new URL(request.url);
  const targetUrl = new URL(`${options.upstreamPath}${requestUrl.search}`, options.backendBaseUrl);

  const forwardHeadersAllowlist = options.forwardHeadersAllowlist ?? [...DEFAULT_FORWARDED_HEADERS];
  const headers = buildUpstreamHeaders(request, forwardHeadersAllowlist);

  let body: ArrayBuffer | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    const maxBodyBytes = options.maxBodyBytes ?? 2 * 1024 * 1024;
    try {
      if (options.bodyOverride) {
        if (options.bodyOverride.byteLength > maxBodyBytes) {
          return safeProxyError('Payload too large', 413);
        }
        body = options.bodyOverride;
      } else {
        body = await readBodyWithLimit(request, maxBodyBytes);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('payload too large')) {
        return safeProxyError('Payload too large', 413);
      }
      return safeProxyError('Unable to read request body', 400);
    }
  }

  const timeoutMs = options.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
    });

    const responseBody = await upstream.arrayBuffer();
    return new Response(responseBody, {
      status: upstream.status,
      headers: copyResponseHeaders(upstream),
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    return safeProxyError(aborted ? 'Upstream timeout' : 'Upstream unavailable', 502);
  } finally {
    clearTimeout(timer);
  }
}
