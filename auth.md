# Auth Backend Changes (Required)

This document describes backend changes needed to support secure authentication with:
- `refresh_token` stored only in an `HttpOnly` cookie
- `access_token` returned in the response body and kept in frontend memory

## Goals
- Frontend never sees `refresh_token` in JavaScript.
- Refresh is done via `POST /auth/refresh` using the `HttpOnly` cookie.
- Tokens are rotated safely and consistently.

## Endpoint Behavior

### POST /auth/login
- On success:
  - Return session data in JSON (at least `access_token`, `expires_in`, optionally `expires_at`, `user`).
  - Set `refresh_token` in an `HttpOnly` cookie.
- Cookie attributes (recommended):
  - `HttpOnly`
  - `SameSite=Lax` (or `Strict` if compatible)
  - `Secure` in production
  - `Path=/auth` or `/`
  - `Max-Age` aligned with refresh token lifetime

### POST /auth/register
- Same as login:
  - Return session data in JSON.
  - Set `refresh_token` in an `HttpOnly` cookie.

### POST /auth/refresh
- Request body:
  - No `refresh_token` in JSON.
- Behavior:
  - Read `refresh_token` from the `HttpOnly` cookie.
  - Rotate refresh token if supported.
  - Return new session in JSON.
  - Update `refresh_token` cookie if rotated.
- On failure:
  - Return `401`.
  - Optionally clear cookie.

### POST /auth/logout (recommended)
- Clear the `refresh_token` cookie.
- Return `204` or a simple JSON confirmation.

## CORS and Cookies
- If frontend and backend are on different origins:
  - Backend must allow credentials:
    - `Access-Control-Allow-Credentials: true`
    - `Access-Control-Allow-Origin` must be explicit (not `*`)
  - Frontend must send `credentials: 'include'`.

## Error Semantics
- `401` for invalid/expired refresh token.
- `422` for missing cookie if required.
- `400` for invalid payloads (login/register).

## Example Set-Cookie Header
```
Set-Cookie: refresh_token=...; HttpOnly; Path=/auth; SameSite=Lax; Max-Age=1209600; Secure
```

## Notes
- Do not return `refresh_token` in JSON responses.
- Access tokens should remain short-lived; refresh tokens should be longer-lived.
