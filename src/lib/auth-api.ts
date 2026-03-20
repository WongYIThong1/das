export { ApiRequestError } from './api-error';
import { ApiRequestError } from './api-error';
import type { PendingLoginAuthFlow, PendingRegisterAuthFlow } from './auth';

export type AuthApiError = {
  error?: string;
  message?: string;
};

export type RegisterStartRequest = {
  name: string;
  email: string;
  password: string;
  inviteCode: string;
};

export type RegisterStartResponse = {
  ok: true;
  userId?: number;
  bookId?: string;
  mfaRequired: true;
};

export type MfaSetupRequest = {
  email: string;
  password: string;
};

export type MfaSetupResponse = {
  ok: true;
  secret: string;
  status: 'pending';
  otpauth: string;
  qrPngBase64: string;
};

export type MfaConfirmRequest = {
  email: string;
  password: string;
  totpCode: string;
};

export type LoginStartRequest = {
  email: string;
  password: string;
};

export type LoginStartResponse = {
  error: 'mfa_required';
  mfaToken?: string;
  expiresIn?: number;
};

export type CompleteLoginMfaRequest = {
  mfaToken: string;
  totpCode: string;
};

export type SessionUser = {
  id: number | string;
  email: string;
  name: string;
  bookId: string;
};

export type AuthSessionResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: SessionUser;
};

export type ProfileResponse = {
  userId: string;
  username: string;
  email: string;
  bookId: string;
  company: string;
  status: string;
  mfaEnabled: boolean;
};

function ensureValue(value: string, message: string) {
  if (!value.trim()) {
    throw new ApiRequestError(message, 400);
  }
}

function getErrorMessage(code: string | undefined, fallback: string) {
  switch (code) {
    case 'invalid_request':
      return 'Please complete all required fields.';
    case 'invalid_invite_code':
      return 'This invite link is invalid or has expired.';
    case 'email_exists':
      return 'This email address is already registered.';
    case 'username_exists':
      return 'This username is already taken.';
    case 'invalid_credentials':
      return 'The email or password is incorrect.';
    case 'invalid_mfa_code':
      return 'The OTP code is invalid. Please try again.';
    case 'mfa_not_setup':
      return 'MFA setup was not found. Please restart registration.';
    case 'mfa_already_enabled':
      return 'MFA is already enabled for this account.';
    case 'invalid_refresh_token':
      return 'Your session has expired. Please sign in again.';
    case 'service_unavailable':
      return 'The authentication service is temporarily unavailable.';
    default:
      return fallback;
  }
}

async function parseError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as AuthApiError | null;
  throw new ApiRequestError(getErrorMessage(payload?.error, fallback), response.status);
}

async function postJson<TResponse>(path: string, payload: unknown, fallback: string) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseError(response, fallback);
  }

  return (await response.json()) as TResponse;
}

async function postWithoutBody<TResponse>(path: string, fallback: string) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    await parseError(response, fallback);
  }

  return (await response.json()) as TResponse;
}

export function mapSessionUserToProfile(user: SessionUser): ProfileResponse {
  return {
    userId: String(user.id),
    username: user.name,
    email: user.email,
    bookId: user.bookId,
    company: 'My365Biz Workspace',
    status: 'active',
    mfaEnabled: true,
  };
}

export async function registerStart(payload: RegisterStartRequest) {
  ensureValue(payload.name, 'Username is required.');
  ensureValue(payload.email, 'Email is required.');
  ensureValue(payload.password, 'Password is required.');
  ensureValue(payload.inviteCode, 'Invite code is required.');

  return postJson<RegisterStartResponse>('/api/auth/register', payload, 'Unable to create the account right now.');
}

export async function registerMfaSetup(payload: MfaSetupRequest) {
  ensureValue(payload.email, 'Email is required.');
  ensureValue(payload.password, 'Password is required.');

  return postJson<MfaSetupResponse>('/api/auth/mfa/setup', payload, 'Unable to prepare MFA setup right now.');
}

export async function registerMfaConfirm(payload: MfaConfirmRequest) {
  ensureValue(payload.email, 'Email is required.');
  ensureValue(payload.password, 'Password is required.');
  ensureValue(payload.totpCode, 'Verification code is required.');

  return postJson<{ ok: true }>('/api/auth/mfa/confirm', payload, 'Unable to verify the OTP code right now.');
}

export async function storePendingRegisterAuth(flow: PendingRegisterAuthFlow) {
  return postJson<{ ok: true; pendingAuthFlow: PendingRegisterAuthFlow }>(
    '/api/auth/pending/register',
    flow,
    'Unable to save registration state right now.'
  );
}

export async function loginStart(payload: LoginStartRequest) {
  ensureValue(payload.email, 'Email is required.');
  ensureValue(payload.password, 'Password is required.');

  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as AuthApiError & LoginStartResponse | null;
  if (response.status === 401 && data?.error === 'mfa_required') {
    return {
      error: 'mfa_required',
      mfaToken: data.mfaToken,
      expiresIn: data.expiresIn,
    } satisfies LoginStartResponse;
  }

  if (!response.ok) {
    throw new ApiRequestError(
      getErrorMessage(data?.error, 'Unable to start sign in right now.'),
      response.status
    );
  }

  throw new ApiRequestError('Unexpected login response from the server.', response.status);
}

export async function storePendingLoginAuth(flow: PendingLoginAuthFlow) {
  return postJson<{ ok: true; pendingAuthFlow: PendingLoginAuthFlow }>(
    '/api/auth/pending/login',
    flow,
    'Unable to save sign-in state right now.'
  );
}

export async function getPendingAuthFlow() {
  const response = await fetch('/api/auth/pending', {
    method: 'GET',
    credentials: 'include',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    await parseError(response, 'Unable to restore authentication state right now.');
  }

  const payload = (await response.json()) as { pendingAuthFlow: PendingRegisterAuthFlow | PendingLoginAuthFlow };
  return payload.pendingAuthFlow;
}

export async function clearPendingAuthFlowRemote() {
  const response = await fetch('/api/auth/pending/clear', {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    await parseError(response, 'Unable to clear authentication state right now.');
  }

  return (await response.json()) as { ok: true };
}

export async function completeLoginMfa(payload: CompleteLoginMfaRequest) {
  ensureValue(payload.mfaToken, 'MFA token is required.');
  ensureValue(payload.totpCode, 'Verification code is required.');

  return postJson<AuthSessionResponse>('/api/auth/mfa', payload, 'Unable to verify the OTP code right now.');
}

export async function refreshSession() {
  return postWithoutBody<AuthSessionResponse>('/api/auth/refresh', 'Unable to restore your session right now.');
}

export async function logoutSession() {
  return postWithoutBody<{ ok: true }>('/api/auth/logout', 'Unable to sign out right now.');
}
