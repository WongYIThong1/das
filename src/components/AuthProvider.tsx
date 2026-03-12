'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getProfile } from '../lib/auth-api';
import type { AuthContextValue, AuthStatus, PendingAuthFlow } from '../lib/auth';
import type { ProfileResponse } from '../lib/auth-api';

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_TOUCH_THROTTLE_MS = 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<ProfileResponse | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('unknown');
  const [pendingAuthFlow, setPendingAuthFlowState] = useState<PendingAuthFlow | null>(null);
  const lastSessionTouchAtRef = useRef(0);

  const setProfile = useCallback((nextProfile: ProfileResponse | null) => {
    setProfileState(nextProfile);
    setAuthStatus(nextProfile ? 'authenticated' : 'unauthenticated');
    if (nextProfile) {
      lastSessionTouchAtRef.current = Date.now();
    }
  }, []);

  const clearPendingAuthFlow = useCallback(() => {
    setPendingAuthFlowState(null);
  }, []);

  const clearAuthState = useCallback(() => {
    setProfileState(null);
    setAuthStatus('unauthenticated');
    setPendingAuthFlowState(null);
    lastSessionTouchAtRef.current = 0;
  }, []);

  const refreshProfile = useCallback(async () => {
    setAuthStatus((current) => (current === 'authenticated' ? current : 'loading'));
    try {
      const nextProfile = await getProfile();
      setProfileState(nextProfile);
      setAuthStatus('authenticated');
      lastSessionTouchAtRef.current = Date.now();
      return nextProfile;
    } catch {
      setProfileState(null);
      setAuthStatus('unauthenticated');
      return null;
    }
  }, []);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !profile) {
      return;
    }

    const touchSession = () => {
      const now = Date.now();
      if (document.visibilityState === 'hidden') {
        return;
      }
      if (now - lastSessionTouchAtRef.current < SESSION_TOUCH_THROTTLE_MS) {
        return;
      }
      void refreshProfile();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        touchSession();
      }
    };

    window.addEventListener('focus', touchSession);
    window.addEventListener('pageshow', touchSession);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', touchSession);
      window.removeEventListener('pageshow', touchSession);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authStatus, profile, refreshProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      authStatus,
      pendingAuthFlow,
      isAuthenticated: authStatus === 'authenticated' && Boolean(profile),
      setPendingAuthFlow: setPendingAuthFlowState,
      clearPendingAuthFlow,
      setProfile,
      refreshProfile,
      clearAuthState,
    }),
    [authStatus, clearAuthState, clearPendingAuthFlow, pendingAuthFlow, profile, refreshProfile, setProfile]
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
