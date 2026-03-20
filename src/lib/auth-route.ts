import { NextResponse } from 'next/server';

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function normalizeSetCookie(value: string) {
  return value.replace(/Path=\/auth\/user/gi, 'Path=/api/auth');
}

export function applySetCookies(response: NextResponse, setCookies: string[]) {
  for (const value of setCookies) {
    response.headers.append('set-cookie', normalizeSetCookie(value));
  }
  return response;
}
