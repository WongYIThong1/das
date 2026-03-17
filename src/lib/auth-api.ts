import { mockProfile } from './mock-data';

export { ApiRequestError } from './api-error';
import { ApiRequestError } from './api-error';

export type AuthApiError = {
  error?: string;
  message?: string;
};

export type RegisterStartRequest = {
  username: string;
  email: string;
  password: string;
  accountbookKey?: string;
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

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function ensureValue(value: string, message: string) {
  if (!value.trim()) {
    throw new ApiRequestError(message, 400);
  }
}

export async function registerStart(payload: RegisterStartRequest) {
  await delay(180);
  ensureValue(payload.username, 'Username is required.');
  ensureValue(payload.email, 'Email is required.');
  ensureValue(payload.password, 'Password is required.');
  return {
    registrationTicket: 'mock-registration-ticket',
    nextAction: 'totp_enroll',
  } satisfies RegisterStartResponse;
}

export async function registerTotpEnroll(registrationTicket: string) {
  await delay(180);
  ensureValue(registrationTicket, 'Registration ticket is required.');
  return {
    factorId: 'mock-factor-id',
    qrCodeSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="white"/><rect x="12" y="12" width="24" height="24" fill="black"/><rect x="84" y="12" width="24" height="24" fill="black"/><rect x="12" y="84" width="24" height="24" fill="black"/></svg>',
    secret: 'MOCK-TOTP-SECRET',
    uri: 'otpauth://totp/365BIZ:demo?secret=MOCKTOTPSECRET&issuer=365BIZ',
  } satisfies TotpEnrollResponse;
}

export async function registerTotpVerify(payload: VerifyRegisterTotpRequest) {
  await delay(180);
  ensureValue(payload.registrationTicket, 'Registration ticket is required.');
  ensureValue(payload.code, 'Verification code is required.');
  return mockProfile;
}

export async function loginStart(payload: LoginStartRequest) {
  await delay(180);
  ensureValue(payload.identifier, 'Email or username is required.');
  ensureValue(payload.password, 'Password is required.');
  return {
    loginTicket: 'mock-login-ticket',
    requires2fa: true,
    requires2faEnrollment: false,
    mfaType: 'totp',
  } satisfies LoginStartResponse;
}

export async function loginTotpEnroll(loginTicket: string) {
  await delay(180);
  ensureValue(loginTicket, 'Login ticket is required.');
  return {
    factorId: 'mock-factor-id',
    qrCodeSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="white"/><rect x="12" y="12" width="24" height="24" fill="black"/><rect x="84" y="12" width="24" height="24" fill="black"/><rect x="12" y="84" width="24" height="24" fill="black"/></svg>',
    secret: 'MOCK-TOTP-SECRET',
    uri: 'otpauth://totp/365BIZ:demo?secret=MOCKTOTPSECRET&issuer=365BIZ',
  } satisfies TotpEnrollResponse;
}

export async function loginTotpVerify(payload: VerifyLoginTotpRequest) {
  await delay(180);
  ensureValue(payload.loginTicket, 'Login ticket is required.');
  ensureValue(payload.code, 'Verification code is required.');
  return mockProfile;
}

export async function getProfile() {
  await delay(120);
  return mockProfile;
}

export async function logout() {
  await delay(100);
  return null;
}
