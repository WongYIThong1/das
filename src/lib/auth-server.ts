import http from 'node:http';
import https from 'node:https';

type ProxySuccess = {
  ok: true;
  status: number;
  data: unknown;
  setCookies: string[];
};

type ProxyFailure = {
  ok: false;
  status: number;
  error: string;
  data: unknown;
  setCookies: string[];
};

export type ProxyResult = ProxySuccess | ProxyFailure;

function describeCookies(setCookies: string[]) {
  return setCookies.map((cookie) => {
    const [nameValue, ...attributes] = cookie.split(';');
    const name = nameValue.split('=')[0]?.trim() || 'unknown';
    const path = attributes
      .map((attribute) => attribute.trim())
      .find((attribute) => attribute.toLowerCase().startsWith('path='));
    return path ? `${name} (${path})` : name;
  });
}

function getBackendBaseUrl() {
  const baseUrl = process.env.BACKEND_BASE_URL?.trim();
  if (!baseUrl) {
    return null;
  }

  return baseUrl.replace(/\/+$/, '');
}

function getSetCookieHeaders(headers: Headers) {
  const maybeGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof maybeGetSetCookie.getSetCookie === 'function') {
    const values = maybeGetSetCookie.getSetCookie();
    if (values.length > 0) {
      return values;
    }
  }

  const maybeRawHeaders = headers as Headers & {
    raw?: () => Record<string, string[]>;
    entries?: () => IterableIterator<[string, string]>;
  };
  if (typeof maybeRawHeaders.raw === 'function') {
    const raw = maybeRawHeaders.raw();
    const rawSetCookie = raw['set-cookie'] ?? raw['Set-Cookie'];
    if (Array.isArray(rawSetCookie) && rawSetCookie.length > 0) {
      return rawSetCookie.filter(Boolean);
    }
  }

  const single = headers.get('set-cookie') ?? headers.get('Set-Cookie');
  if (!single) {
    const collected: string[] = [];
    if (typeof maybeRawHeaders.entries === 'function') {
      for (const [key, value] of maybeRawHeaders.entries()) {
        if (key.toLowerCase() === 'set-cookie' && value) {
          collected.push(value);
        }
      }
    }
    if (collected.length > 0) {
      return collected;
    }
    return [];
  }

  const cookies: string[] = [];
  let start = 0;
  let index = 0;
  let inExpiresAttribute = false;

  while (index < single.length) {
    const current = single[index];

    if (!inExpiresAttribute && single.slice(index, index + 8).toLowerCase() === 'expires=') {
      inExpiresAttribute = true;
      index += 8;
      continue;
    }

    if (inExpiresAttribute && current === ';') {
      inExpiresAttribute = false;
    }

    if (!inExpiresAttribute && current === ',') {
      const remainder = single.slice(index + 1);
      if (/^\s*[^=;,]+=/i.test(remainder)) {
        cookies.push(single.slice(start, index).trim());
        start = index + 1;
      }
    }

    index += 1;
  }

  cookies.push(single.slice(start).trim());
  return cookies.filter(Boolean);
}

type RawHttpResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  bodyText: string;
};

function requestViaNode(url: string, init: RequestInit = {}, requestHeaders?: Headers): Promise<RawHttpResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === 'https:' ? https : http;
    const headers = new Headers(init.headers ?? {});
    if (!headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json');
    }

    const incomingCookie = requestHeaders?.get('cookie');
    if (incomingCookie) {
      headers.set('cookie', incomingCookie);
    }

    const req = transport.request(
      target,
      {
        method: init.method ?? 'GET',
        headers: Object.fromEntries(headers.entries()),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 500,
            headers: res.headers,
            bodyText: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );

    req.on('error', reject);

    if (init.body) {
      if (typeof init.body === 'string') {
        req.write(init.body);
      } else if (init.body instanceof Uint8Array) {
        req.write(init.body);
      } else {
        req.write(String(init.body));
      }
    }

    req.end();
  });
}

export async function proxyAuthRequest(
  path: string,
  init: RequestInit = {},
  requestHeaders?: Headers
): Promise<ProxyResult> {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    return { ok: false, status: 503, error: 'service_unavailable', data: null, setCookies: [] };
  }

  try {
    const response = await requestViaNode(`${baseUrl}${path}`, init, requestHeaders);
    const rawSetCookie = response.headers['set-cookie'];
    const setCookies = Array.isArray(rawSetCookie)
      ? rawSetCookie.filter(Boolean)
      : typeof rawSetCookie === 'string' && rawSetCookie
        ? [rawSetCookie]
        : [];
    console.info('[auth proxy] upstream response', {
      path,
      status: response.status,
      setCookieCount: setCookies.length,
      cookies: describeCookies(setCookies),
    });
    const data = (JSON.parse(response.bodyText || 'null') as Record<string, unknown> | null);

    if (response.status < 200 || response.status >= 300) {
      return {
        ok: false,
        status: response.status,
        error: typeof data?.error === 'string' ? data.error : 'service_unavailable',
        data,
        setCookies,
      };
    }

    return {
      ok: true,
      status: response.status,
      data,
      setCookies,
    };
  } catch {
    console.error('[auth proxy] upstream request failed', { path });
    return { ok: false, status: 503, error: 'service_unavailable', data: null, setCookies: [] };
  }
}
