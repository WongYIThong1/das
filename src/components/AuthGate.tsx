'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { logoutSession } from '../lib/auth-api';

function isPublicAuthPath(pathname: string) {
  return pathname === '/login' || pathname === '/register' || pathname === '/totp' || pathname === '/toptp';
}

function isStandaloneAuthPath(pathname: string) {
  return pathname === '/login' || pathname === '/register';
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const { authStatus, isAuthenticated, pendingAuthFlow, clearPendingAuthFlow, refreshProfile } = useAuth();
  const [progress, setProgress] = useState(0);
  const [showLoader, setShowLoader] = useState(true);
  const skipLoader = isStandaloneAuthPath(pathname);
  // Guard against clearing the pending flow more than once per mount.
  const clearedStaleFlowRef = useRef(false);

  useEffect(() => {
    if (authStatus === 'unknown') {
      void refreshProfile();
    }
  }, [authStatus, refreshProfile]);

  useEffect(() => {
    if (skipLoader) {
      setShowLoader(false);
      return;
    }

    const target = authStatus === 'unknown' ? 28 : authStatus === 'loading' ? 84 : 100;
    const duration = authStatus === 'unknown' ? 260 : authStatus === 'loading' ? 900 : 420;
    const startValue = progress;
    const startedAt = performance.now();
    let frameId = 0;
    let hideTimer: number | undefined;

    setShowLoader(true);

    const step = (now: number) => {
      const elapsed = now - startedAt;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const nextValue = Math.round(startValue + (target - startValue) * eased);

      setProgress(nextValue);

      if (t < 1) {
        frameId = window.requestAnimationFrame(step);
        return;
      }

      if (target === 100) {
        hideTimer = window.setTimeout(() => {
          setShowLoader(false);
        }, 120);
      }
    };

    frameId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(frameId);
      if (hideTimer) {
        window.clearTimeout(hideTimer);
      }
    };
  }, [authStatus, skipLoader]);

  useEffect(() => {
    if (authStatus === 'unknown' || authStatus === 'loading') {
      return;
    }

    // If the user is already authenticated but a stale pendingAuthFlow was
    // restored from the backend (e.g. from a previous incomplete login), clear
    // it silently. Without this, the gate bounces: /purchase-invoice → /totp → /purchase-invoice → …
    if (isAuthenticated && pendingAuthFlow && !clearedStaleFlowRef.current) {
      clearedStaleFlowRef.current = true;
      void clearPendingAuthFlow();
      return;
    }

    // Only redirect to TOTP when the user is NOT yet authenticated.
    if (pendingAuthFlow && !isAuthenticated && pathname !== '/totp' && pathname !== '/toptp') {
      router.replace('/totp');
      return;
    }

    if (isPublicAuthPath(pathname)) {
      if (isAuthenticated) {
        router.replace('/purchase-invoice');
        return;
      }

      if (isStandaloneAuthPath(pathname)) {
        return;
      }

      if ((pathname === '/totp' || pathname === '/toptp') && !pendingAuthFlow) {
        router.replace('/login');
      }
      return;
    }

    if (!isAuthenticated) {
      // Clear server-side session cookie before redirecting to prevent a
      // redirect loop: if the cookie is still set, (auth)/layout would
      // immediately redirect back to /purchase-invoice on every page load.
      void logoutSession().catch(() => {}).finally(() => {
        router.replace('/login');
      });
    }
  }, [authStatus, clearPendingAuthFlow, isAuthenticated, pathname, pendingAuthFlow, router]);

  if (showLoader) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 px-6 font-sans text-zinc-900">
        <div className="w-full max-w-md">
          <div className="space-y-5">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Loading</p>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Preparing workspace...</h1>
              <p className="text-sm leading-6 text-zinc-500">
                {progress < 30
                  ? 'Starting a secure session and checking your access.'
                  : progress < 85
                    ? 'Loading company context, routes, and workspace data.'
                    : 'Finalizing everything so the app can open cleanly.'}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                <span>Workspace status</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-zinc-200/80">
                <div
                  className="h-full rounded-full bg-zinc-900 transition-[width] duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
