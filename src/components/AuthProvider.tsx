'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthContextValue, AuthStatus, PendingAuthFlow } from '../lib/auth';
import {
  type AuthSessionResponse,
  ApiRequestError,
  clearPendingAuthFlowRemote,
  getPendingAuthFlow,
  mapSessionUserToProfile,
  refreshSession,
  type ProfileResponse,
  type SessionUser,
} from '../lib/auth-api';
import { registerAuthStore } from '../lib/auth-fetch';

const AuthContext = createContext<AuthContextValue | null>(null);
const ACTIVE_INVITE_STORAGE_KEY = 'auth.activeInviteCode';
const AUTH_REFRESH_LOCK_NAME = 'auth-refresh';
const AUTH_REFRESH_LEASE_KEY = 'auth.refresh.lease';
const AUTH_REFRESH_LEASE_TTL_MS = 20_000;

function parseJwtExpiry(accessToken: string) {
  const payloadSegment = accessToken.split('.')[1];
  if (!payloadSegment) {
    return null;
  }

  try {
    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function resolveAccessTokenExpiry(session: { accessToken: string; expiresIn?: number }) {
  if (typeof session.expiresIn === 'number' && Number.isFinite(session.expiresIn) && session.expiresIn > 0) {
    return Date.now() + session.expiresIn * 1000;
  }

  return parseJwtExpiry(session.accessToken);
}

function readActiveInviteCode() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage.getItem(ACTIVE_INVITE_STORAGE_KEY);
}

async function withAuthRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined') {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (locks?.request) {
      return locks.request(AUTH_REFRESH_LOCK_NAME, { mode: 'exclusive' }, task);
    }
  }

  if (typeof window === 'undefined') {
    return task();
  }

  const leaseId = (globalThis.crypto?.randomUUID?.() ?? `lease_${Date.now()}_${Math.random().toString(16).slice(2)}`);

  const readLease = () => {
    try {
      const raw = window.localStorage.getItem(AUTH_REFRESH_LEASE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { id?: unknown; expiresAt?: unknown } | null;
      if (typeof parsed?.id !== 'string' || typeof parsed?.expiresAt !== 'number') return null;
      return parsed.id && parsed.expiresAt > Date.now() ? parsed : null;
    } catch {
      return null;
    }
  };

  const acquireLease = async () => {
    while (true) {
      const current = readLease();
      if (!current) {
        const next = JSON.stringify({ id: leaseId, expiresAt: Date.now() + AUTH_REFRESH_LEASE_TTL_MS });
        try {
          window.localStorage.setItem(AUTH_REFRESH_LEASE_KEY, next);
        } catch {
          return;
        }
        const confirmed = readLease();
        if (confirmed && confirmed.id === leaseId) {
          return;
        }
      }

      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
  };

  await acquireLease();
  try {
    return await task();
  } finally {
    try {
      const current = readLease();
      if (current && current.id === leaseId) {
        window.localStorage.removeItem(AUTH_REFRESH_LEASE_KEY);
      }
    } catch {
      // Ignore release failures.
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<ProfileResponse | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('unknown');
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [accessTokenExpiresAt, setAccessTokenExpiresAt] = useState<number | null>(null);
  const [pendingAuthFlow, setPendingAuthFlowState] = useState<PendingAuthFlow | null>(null);
  const [activeInviteCode, setActiveInviteCodeState] = useState<string | null>(() => readActiveInviteCode());
  const authRevisionRef = useRef(0);
  const refreshInFlightRef = useRef<Promise<AuthSessionResponse | null> | null>(null);
  // Ref keeps the latest token accessible synchronously from the auth store
  // without needing to re-register on every token change.
  const accessTokenRef = useRef<string | null>(null);
  accessTokenRef.current = accessToken;

  const setProfile = useCallback((nextProfile: ProfileResponse | null) => {
    authRevisionRef.current += 1;
    setProfileState(nextProfile);
    setAuthStatus(nextProfile ? 'authenticated' : 'unauthenticated');
  }, []);

  const setAccessToken = useCallback((token: string | null) => {
    authRevisionRef.current += 1;
    setAccessTokenState(token);
    if (!token) {
      setAccessTokenExpiresAt(null);
    }
  }, []);

  const setSession = useCallback((session: AuthSessionResponse | { accessToken: string; user: SessionUser }) => {
    authRevisionRef.current += 1;
    setAccessTokenState(session.accessToken);
    setProfileState(mapSessionUserToProfile(session.user));
    setAuthStatus('authenticated');
    setAccessTokenExpiresAt(resolveAccessTokenExpiry(session));
  }, []);

  const clearPendingAuthFlow = useCallback(async () => {
    setPendingAuthFlowState(null);
    try {
      await clearPendingAuthFlowRemote();
    } catch {
      // Keep local cleanup non-blocking.
    }
  }, []);

  const clearActiveInviteCode = useCallback(() => {
    setActiveInviteCodeState(null);
  }, []);

  const clearAuthState = useCallback(async () => {
    authRevisionRef.current += 1;
    setProfileState(null);
    setAuthStatus('unauthenticated');
    setAccessTokenState(null);
    setAccessTokenExpiresAt(null);
    setPendingAuthFlowState(null);
    setActiveInviteCodeState(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ACTIVE_INVITE_STORAGE_KEY);
    }
    try {
      await clearPendingAuthFlowRemote();
    } catch {
      // Keep local cleanup non-blocking.
    }
  }, []);

  const refreshSessionOnce = useCallback(async (options?: { silent?: boolean }) => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const refreshRevision = authRevisionRef.current;
    if (!options?.silent) {
      setAuthStatus('loading');
    }

    const refreshPromise = withAuthRefreshLock(async () => {
      try {
        const session = await refreshSession();
        if (refreshRevision !== authRevisionRef.current) {
          return session;
        }
        const nextProfile = mapSessionUserToProfile(session.user);
        setAccessTokenState(session.accessToken);
        setAccessTokenExpiresAt(resolveAccessTokenExpiry(session));
        setProfileState(nextProfile);
        setAuthStatus('authenticated');
        return session;
      } catch (err) {
        if (refreshRevision !== authRevisionRef.current) {
          return null;
        }
        const isDefinitiveAuthFailure = err instanceof ApiRequestError && (err.status === 401 || err.status === 403);
        if (!options?.silent || isDefinitiveAuthFailure) {
          setAccessTokenState(null);
          setAccessTokenExpiresAt(null);
          setProfileState(null);
          setAuthStatus('unauthenticated');
          return null;
        }
        // Silent refresh hit a transient error (network, 5xx, etc.) — keep the user logged in.
        return null;
      }
    });

    refreshInFlightRef.current = refreshPromise;
    try {
      return await refreshPromise;
    } finally {
      if (refreshInFlightRef.current === refreshPromise) {
        refreshInFlightRef.current = null;
      }
    }
  }, []);

  const refreshProfile = useCallback(async (options?: { silent?: boolean }) => {
    const session = await refreshSessionOnce(options);
    return session ? mapSessionUserToProfile(session.user) : null;
  }, [refreshSessionOnce]);

  // Register the auth store once so authFetch() can automatically refresh
  // expired tokens and retry failed requests without involving components.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    registerAuthStore({
      getToken: () => accessTokenRef.current,
      refresh: async () => {
        const session = await refreshSessionOnce({ silent: true });
        return session?.accessToken ?? null;
      },
    });
  // Empty deps: the store uses refs/stable callbacks, no need to re-register.
  }, [refreshSessionOnce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (authStatus !== 'authenticated' || !accessTokenExpiresAt) {
      return;
    }

    const now = Date.now();
    const refreshInMs = Math.max(accessTokenExpiresAt - now - 60_000, 15_000);
    const timer = window.setTimeout(() => {
      void refreshProfile({ silent: true });
    }, refreshInMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [accessTokenExpiresAt, authStatus, refreshProfile]);

  // Re-check token when the tab becomes visible again (handles computer sleep / background tabs
  // where the setTimeout may not have fired reliably).
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (authStatus !== 'authenticated' || !accessTokenExpiresAt) {
        return;
      }
      // Refresh if the token is already expired or expires within the next 5 minutes.
      if (accessTokenExpiresAt - Date.now() < 5 * 60_000) {
        void refreshProfile({ silent: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [accessTokenExpiresAt, authStatus, refreshProfile]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (activeInviteCode) {
      window.sessionStorage.setItem(ACTIVE_INVITE_STORAGE_KEY, activeInviteCode);
      return;
    }

    window.sessionStorage.removeItem(ACTIVE_INVITE_STORAGE_KEY);
  }, [activeInviteCode]);

  useEffect(() => {
    if (pendingAuthFlow) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const restored = await getPendingAuthFlow();
        if (!cancelled && restored) {
          setPendingAuthFlowState(restored);
        }
      } catch {
        if (!cancelled) {
          setPendingAuthFlowState(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingAuthFlow]);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      authStatus,
      accessToken,
      pendingAuthFlow,
      activeInviteCode,
      isAuthenticated: authStatus === 'authenticated' && Boolean(profile),
      setPendingAuthFlow: setPendingAuthFlowState,
      clearPendingAuthFlow,
      setActiveInviteCode: setActiveInviteCodeState,
      clearActiveInviteCode,
      setProfile,
      setAccessToken,
      setSession,
      refreshProfile,
      clearAuthState,
    }),
    [
      accessToken,
      activeInviteCode,
      authStatus,
      clearActiveInviteCode,
      clearAuthState,
      clearPendingAuthFlow,
      pendingAuthFlow,
      profile,
      refreshProfile,
      setAccessToken,
      setProfile,
      setSession,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}
