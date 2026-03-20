import type { AuthSessionResponse, ProfileResponse, SessionUser } from './auth-api';

export type AuthStatus = 'unknown' | 'loading' | 'authenticated' | 'unauthenticated';

export type PendingAuthMode = 'login' | 'register';

export type PendingRegisterAuthFlow = {
  mode: 'register';
  requiresEnrollment: true;
  identifierOrEmail: string;
  email: string;
  password: string;
  inviteCode?: string;
  secret?: string;
  otpauth?: string;
  qrImageSrc?: string;
};

export type PendingLoginAuthFlow = {
  mode: 'login';
  requiresEnrollment: false;
  identifierOrEmail: string;
  mfaToken: string;
  expiresIn?: number;
};

export type PendingAuthFlow = PendingRegisterAuthFlow | PendingLoginAuthFlow;

export type AuthContextValue = {
  profile: ProfileResponse | null;
  authStatus: AuthStatus;
  accessToken: string | null;
  pendingAuthFlow: PendingAuthFlow | null;
  activeInviteCode: string | null;
  isAuthenticated: boolean;
  setPendingAuthFlow: (flow: PendingAuthFlow | null) => void;
  clearPendingAuthFlow: () => Promise<void>;
  setActiveInviteCode: (inviteCode: string | null) => void;
  clearActiveInviteCode: () => void;
  setProfile: (profile: ProfileResponse | null) => void;
  setAccessToken: (token: string | null) => void;
  setSession: (session: AuthSessionResponse | { accessToken: string; user: SessionUser }) => void;
  refreshProfile: (options?: { silent?: boolean }) => Promise<ProfileResponse | null>;
  clearAuthState: () => Promise<void>;
};

export function getAuthInitials(profile: ProfileResponse | null) {
  const source = profile?.username || profile?.email || '';
  if (!source) {
    return 'U';
  }
  return (
    source
      .split(/[\s._@-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || source.slice(0, 2).toUpperCase()
  );
}
