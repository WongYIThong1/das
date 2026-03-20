import { randomUUID } from 'crypto';
import type { PendingAuthFlow, PendingLoginAuthFlow, PendingRegisterAuthFlow } from './auth';
import { getRedisClient } from './redis';

const PENDING_REGISTER_PREFIX = 'auth:pending:register:';
const PENDING_LOGIN_PREFIX = 'auth:pending:login:';
const PENDING_AUTH_TTL_SECONDS = 600;

export const REGISTER_PENDING_COOKIE = 'registerPendingKey';
export const LOGIN_PENDING_COOKIE = 'loginPendingKey';

function getKey(prefix: string, nonce: string) {
  return `${prefix}${nonce}`;
}

export async function createPendingRegisterAuth(flow: PendingRegisterAuthFlow) {
  const nonce = randomUUID();
  const redis = await getRedisClient();
  await redis.set(getKey(PENDING_REGISTER_PREFIX, nonce), JSON.stringify(flow), {
    EX: PENDING_AUTH_TTL_SECONDS,
  });
  return nonce;
}

export async function createPendingLoginAuth(flow: PendingLoginAuthFlow) {
  const nonce = randomUUID();
  const redis = await getRedisClient();
  await redis.set(getKey(PENDING_LOGIN_PREFIX, nonce), JSON.stringify(flow), {
    EX: PENDING_AUTH_TTL_SECONDS,
  });
  return nonce;
}

export async function getPendingRegisterAuth(nonce: string) {
  const redis = await getRedisClient();
  const raw = await redis.get(getKey(PENDING_REGISTER_PREFIX, nonce));
  return typeof raw === 'string' ? (JSON.parse(raw) as PendingRegisterAuthFlow) : null;
}

export async function getPendingLoginAuth(nonce: string) {
  const redis = await getRedisClient();
  const raw = await redis.get(getKey(PENDING_LOGIN_PREFIX, nonce));
  return typeof raw === 'string' ? (JSON.parse(raw) as PendingLoginAuthFlow) : null;
}

export async function deletePendingRegisterAuth(nonce: string) {
  const redis = await getRedisClient();
  await redis.del(getKey(PENDING_REGISTER_PREFIX, nonce));
}

export async function deletePendingLoginAuth(nonce: string) {
  const redis = await getRedisClient();
  await redis.del(getKey(PENDING_LOGIN_PREFIX, nonce));
}

export async function getPendingAuthFlow(
  registerNonce?: string | null,
  loginNonce?: string | null
): Promise<PendingAuthFlow | null> {
  if (registerNonce) {
    return getPendingRegisterAuth(registerNonce);
  }

  if (loginNonce) {
    return getPendingLoginAuth(loginNonce);
  }

  return null;
}

export async function clearPendingAuth(registerNonce?: string | null, loginNonce?: string | null) {
  if (registerNonce) {
    await deletePendingRegisterAuth(registerNonce);
  }
  if (loginNonce) {
    await deletePendingLoginAuth(loginNonce);
  }
}
