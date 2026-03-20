/**
 * auth-fetch — thin fetch wrapper with automatic 401 → refresh → retry.
 *
 * AuthProvider registers the current token getter and a refresh function via
 * registerAuthStore(). All API callers use authFetch() instead of fetch() so
 * that a single expired-token 401 is silently recovered without forcing logout.
 */

type GetTokenFn = () => string | null;
type RefreshFn  = () => Promise<string | null>;

let _getToken: GetTokenFn = () => null;
let _refresh: RefreshFn   = () => Promise.resolve(null);

// Deduplicates concurrent refreshes — if 5 requests all get 401 at once, only
// one refresh call is made and all 5 retries wait for it.
let _inflightRefresh: Promise<string | null> | null = null;

export function registerAuthStore(opts: { getToken: GetTokenFn; refresh: RefreshFn }) {
  _getToken = opts.getToken;
  _refresh  = opts.refresh;
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  // Inject Authorization header if not already set by the caller.
  const token = _getToken();
  const headers = new Headers(init?.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(input, { ...init, headers });
  if (res.status !== 401) return res;

  // 401 — attempt a single token refresh (deduplicated across concurrent calls).
  if (!_inflightRefresh) {
    _inflightRefresh = _refresh().finally(() => { _inflightRefresh = null; });
  }
  const newToken = await _inflightRefresh;

  // If refresh failed or returned nothing, return the original 401 response.
  // The periodic proactive refresh in AuthProvider will handle eventual logout
  // for definitive auth failures.
  if (!newToken) return res;

  // Retry the original request exactly once with the new token.
  const retryHeaders = new Headers(init?.headers);
  retryHeaders.set('Authorization', `Bearer ${newToken}`);
  return fetch(input, { ...init, headers: retryHeaders });
}
