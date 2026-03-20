const INVITE_VERIFY_PATH = '/auth/user/invitecode';

type InviteCodeVerifyResult = {
  ok: boolean;
  status: number;
};

function getBackendBaseUrl() {
  const baseUrl = process.env.BACKEND_BASE_URL?.trim();
  if (!baseUrl) {
    return null;
  }

  return baseUrl.replace(/\/+$/, '');
}

export async function verifyInviteCode(inviteCode: string): Promise<InviteCodeVerifyResult> {
  const trimmedCode = inviteCode.trim();
  if (!trimmedCode) {
    return { ok: false, status: 400 };
  }

  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    return { ok: false, status: 503 };
  }

  try {
    const response = await fetch(`${baseUrl}${INVITE_VERIFY_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inviteCode: trimmedCode }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const payload = (await response.json().catch(() => null)) as { ok?: boolean } | null;
    if (!payload?.ok) {
      return { ok: false, status: 503 };
    }

    return { ok: true, status: 200 };
  } catch {
    return { ok: false, status: 503 };
  }
}
