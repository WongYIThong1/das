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
    return maybeGetSetCookie.getSetCookie();
  }

  const single = headers.get('set-cookie');
  if (!single) {
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

export async function proxyAuthRequest(
  path: string,
  init: RequestInit = {},
  requestHeaders?: Headers
): Promise<ProxyResult> {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    return { ok: false, status: 503, error: 'service_unavailable', data: null, setCookies: [] };
  }

  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  const incomingCookie = requestHeaders?.get('cookie');
  if (incomingCookie) {
    headers.set('cookie', incomingCookie);
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      cache: 'no-store',
    });

    const setCookies = getSetCookieHeaders(response.headers);
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok) {
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
    return { ok: false, status: 503, error: 'service_unavailable', data: null, setCookies: [] };
  }
}
