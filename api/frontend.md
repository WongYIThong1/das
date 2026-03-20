# Purchase Invoice Create API

## Overview

`POST /user/purchase-invoice/create`

This endpoint starts an OCR import task by uploading one invoice file.
It returns a `taskId` immediately and processes OCR/matching asynchronously.

This endpoint currently supports `multipart/form-data` only.
`application/json` create-submission mode is not enabled yet.

## Endpoints

- `POST /user/purchase-invoice/create`
- `GET /user/purchase-invoice/create/status?taskId=<uuid>`

## Base URL

Use the gateway:

- `http://api.my365biz.com`

## Headers

- `Authorization: Bearer <accessToken>` required

Gateway behavior:

- The gateway validates `accessToken` via `GET /auth/user/verify`
- On success, it injects `X-User-Id`, `X-User-Email`, `X-Book-Id` to the backend

## Content Type

- `multipart/form-data`

## Form Fields

- `file` required
  - allowed types:
    - `application/pdf`
    - `image/jpeg`
    - `image/png`
    - `image/webp`
  - only one file is allowed
  - max file size: `20MB`

## Status Values

- `queued`
- `fileserver_uploading`
- `ocrprocessing`
- `aianalyzing`
- `completed`
- `completed_with_warnings`

## Response

```json
{
  "success": true,
  "taskId": "uuid",
  "uploadId": "uuid",
  "bookId": "efcf1e38-080b-45eb-be81-0fc22bf64444",
  "originalName": "invoice.pdf",
  "contentType": "application/pdf",
  "size": 123456,
  "status": "queued"
}
```

## JSON Request Behavior

If you call this endpoint with `Content-Type: application/json`,
the API returns:

- `400 Bad Request`
- message: `json create submission is not supported on this endpoint; use multipart/form-data with file`

## Errors

- `400 Bad Request`
  - missing `Authorization`
  - invalid multipart form
  - missing file
  - unsupported file type
  - file too large
  - json mode not supported
- `404 Not Found`
  - book not found
- `500 Internal Server Error`
  - task persistence failed

## Example

```bash
curl -X POST http://api.my365biz.com/user/purchase-invoice/create \
  -H "Authorization: Bearer <accessToken>" \
  -F "file=@/path/to/invoice.pdf"
```
