import type { ProfileResponse } from './auth-api';

export type AuthStatus = 'unknown' | 'loading' | 'authenticated' | 'unauthenticated';

export type PendingAuthMode = 'login' | 'register';

export type PendingAuthFlow = {
  mode: PendingAuthMode;
  ticket: string;
  factorId?: string;
  requiresEnrollment: boolean;
  qrCodeSvg?: string;
  secret?: string;
  uri?: string;
  identifierOrEmail: string;
};

export type AuthContextValue = {
  profile: ProfileResponse | null;
  authStatus: AuthStatus;
  pendingAuthFlow: PendingAuthFlow | null;
  isAuthenticated: boolean;
  setPendingAuthFlow: (flow: PendingAuthFlow | null) => void;
  clearPendingAuthFlow: () => void;
  setProfile: (profile: ProfileResponse | null) => void;
  refreshProfile: () => Promise<ProfileResponse | null>;
  clearAuthState: () => void;
};

export function getAuthInitials(profile: ProfileResponse | null) {
  const source = profile?.username || profile?.email || '';
  if (!source) {
    return 'U';
  }
  return source
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || source.slice(0, 2).toUpperCase();
}
