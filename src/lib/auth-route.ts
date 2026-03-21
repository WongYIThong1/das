import { NextResponse } from 'next/server';

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function isLocalhostRequest(request?: Request) {
  if (!request) {
    return false;
  }
  try {
    const url = new URL(request.url);
    return url.protocol === 'http:' && (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '::1'
    );
  } catch {
    return false;
  }
}

function normalizeSetCookie(value: string, request?: Request) {
  const cookieName = value.split(';', 1)[0]?.split('=')[0]?.trim() ?? '';
  let normalized = value;

  if (/^refresh_token$/i.test(cookieName)) {
    // Refresh token only needs to come back to our auth routes.
    // Using "/" is the most browser-friendly path for local dev and avoids path-specific cookie rejection.
    normalized = normalized.replace(/Path=\/auth(?:\/[^;]*)?/gi, 'Path=/');
    normalized = normalized.replace(/Path=\/api\/auth(?:\/[^;]*)?/gi, 'Path=/');
  } else {
    normalized = normalized.replace(/Path=\/auth(?:\/[^;]*)?/gi, 'Path=/api/auth');
  }
  normalized = normalized.replace(/;\s*Domain=[^;]+/gi, '');
  if (isLocalhostRequest(request)) {
    normalized = normalized.replace(/;\s*Secure/gi, '');
    // Browsers reject SameSite=None cookies when Secure is absent (common on localhost HTTP).
    // If we strip Secure for local dev, force SameSite=Lax so the cookie remains storable.
    normalized = normalized.replace(/;\s*SameSite=None/gi, '; SameSite=Lax');
  }
  return normalized;
}

export function applySetCookies(response: NextResponse, setCookies: string[], request?: Request) {
  for (const value of setCookies) {
    response.headers.append('set-cookie', normalizeSetCookie(value, request));
  }
  return response;
}
