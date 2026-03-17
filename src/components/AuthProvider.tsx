'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { AuthContextValue, AuthStatus, PendingAuthFlow } from '../lib/auth';
import type { ProfileResponse } from '../lib/auth-api';
import { mockProfile } from '../lib/mock-data';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<ProfileResponse | null>(mockProfile);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('authenticated');
  const [pendingAuthFlow, setPendingAuthFlowState] = useState<PendingAuthFlow | null>(null);

  const setProfile = useCallback((nextProfile: ProfileResponse | null) => {
    setProfileState(nextProfile ?? mockProfile);
    setAuthStatus('authenticated');
  }, []);

  const clearPendingAuthFlow = useCallback(() => {
    setPendingAuthFlowState(null);
  }, []);

  const clearAuthState = useCallback(() => {
    setProfileState(mockProfile);
    setAuthStatus('authenticated');
    setPendingAuthFlowState(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    setProfileState(mockProfile);
    setAuthStatus('authenticated');
    return mockProfile;
  }, []);

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
