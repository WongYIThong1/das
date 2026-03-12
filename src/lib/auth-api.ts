export type AuthApiError = {
  error?: string;
  message?: string;
};

export type RegisterStartRequest = {
  username: string;
  email: string;
  password: string;
  accountbookKey: string;
};

export type RegisterStartResponse = {
  registrationTicket: string;
  nextAction: 'totp_enroll';
};

export type LoginStartRequest = {
  identifier: string;
  password: string;
};

export type LoginStartResponse = {
  loginTicket: string;
  requires2fa: boolean;
  requires2faEnrollment?: boolean;
  mfaType: 'totp';
};

export type TotpEnrollResponse = {
  factorId: string;
  qrCodeSvg: string;
  secret: string;
  uri: string;
};

export type VerifyRegisterTotpRequest = {
  registrationTicket: string;
  factorId: string;
  code: string;
};

export type VerifyLoginTotpRequest = {
  loginTicket: string;
  factorId?: string;
  code: string;
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

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

async function parseApiError(response: Response) {
  let body: AuthApiError | null = null;
  try {
    body = (await response.json()) as AuthApiError;
  } catch {
    body = null;
  }
  return body?.error || body?.message || `Request failed with status ${response.status}`;
}

async function requestJson<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api/auth${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiRequestError(await parseApiError(response), response.status);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export function registerStart(payload: RegisterStartRequest) {
  return requestJson<RegisterStartResponse>('/register/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function registerTotpEnroll(registrationTicket: string) {
  return requestJson<TotpEnrollResponse>('/register/totp/enroll', {
    method: 'POST',
    body: JSON.stringify({ registrationTicket }),
  });
}

export function registerTotpVerify(payload: VerifyRegisterTotpRequest) {
  return requestJson<ProfileResponse>('/register/totp/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginStart(payload: LoginStartRequest) {
  return requestJson<LoginStartResponse>('/login/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginTotpEnroll(loginTicket: string) {
  return requestJson<TotpEnrollResponse>('/login/totp/enroll', {
    method: 'POST',
    body: JSON.stringify({ loginTicket }),
  });
}

export function loginTotpVerify(payload: VerifyLoginTotpRequest) {
  return requestJson<ProfileResponse>('/login/totp/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getProfile() {
  return requestJson<ProfileResponse>('/profile', {
    method: 'GET',
  });
}

export function logout() {
  return requestJson<null>('/logout', {
    method: 'POST',
  });
}
