# Purchase Invoice Batch API

Batch API handles two stages for purchase invoice files:

1. Draft pipeline: OCR, row extraction, creditor/item matching, draft generation.
2. Submit pipeline: submit one item or submit all items in a group.

Batch upload supports up to 50 files per request. Each file gets an `itemId`, and the batch gets a `groupId`.

## 1. Endpoints

All endpoints require:

- `X-Book-Id: <bookid>`

### Draft / analysis

- `POST /user/purchase-invoice/batch/create`
- `GET /user/purchase-invoice/batch/group?groupId=<uuid>`
- `GET /user/purchase-invoice/batch/groups?page=<n>&pageSize=<n>`
- `GET /user/purchase-invoice/batch/item?itemId=<uuid>`
- `GET /user/purchase-invoice/batch/group/events?groupId=<uuid>` (SSE)

### Submit

- `POST /user/purchase-invoice/group/item/{itemId}/submit`
- `POST /user/purchase-invoice/group/{groupId}/submit-all`

## 2. State Model

Batch has two visible state tracks:

- `analysisStatus`: OCR / analyze lifecycle
- `submitStatus`: submit lifecycle

### Analysis statuses

- `queued`
- `processing`
- `fileserver_uploading`
- `ocrprocessing`
- `aianalyzing`
- `completed`
- `completed_with_warnings`
- `failed`

### Item submit statuses

When submit starts, batch item `status` is switched to submit-stage status.
Original OCR state stays in `analysisStatus`.

- `submit_queued`
- `submitting_stock`
- `submitting_pi`
- `submitted`
- `submit_failed`
- `not_ready`

### Group submit statuses

Group snapshot has an aggregate submit status in addition to the analysis status:

- `idle`
- `submitting`
- `completed`
- `completed_with_failures`

## 3. POST /batch/create

Content type:

- `multipart/form-data`

Rules:

- Field name must be `file`
- Allowed file count: `1..50`
- Allowed file types are the same as single create:
  - `application/pdf`
  - `image/jpeg`
  - `image/png`
  - `image/webp`

Response:

```json
{
  "success": true,
  "groupId": "uuid",
  "bookId": "uuid",
  "status": "processing",
  "submitStatus": "idle",
  "totalItems": 2,
  "queuedCount": 1,
  "processingCount": 1,
  "completedCount": 0,
  "failedCount": 0,
  "createdAt": "timestamp",
  "startedAt": "timestamp",
  "updatedAt": "timestamp",
  "items": [
    {
      "groupId": "uuid",
      "itemId": "uuid",
      "taskId": "uuid",
      "bookId": "uuid",
      "fileName": "A.pdf",
      "status": "queued",
      "analysisStatus": "queued",
      "submitStatus": "",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ]
}
```

Each batch item task also carries the file server result:

```json
{
  "fileServer": {
    "code": "file-code",
    "link": "http://host/files/file-code",
    "imageUrl": "http://host/images/file-code"
  }
}
```

`externalLink` stays on the file `link`. `imageUrl` is preview-only.

## 4. GET /batch/group

`GET /user/purchase-invoice/batch/group?groupId=<uuid>`

Returns the current group snapshot with all items.

Group fields:

- `groupId`
- `bookId`
- `status`
- `submitStatus`
- `totalItems`
- `queuedCount`
- `processingCount`
- `completedCount`
- `failedCount`
- `submitQueuedCount`
- `submittingCount`
- `submittedCount`
- `submitFailedCount`
- `notReadyCount`
- `createdAt`
- `startedAt`
- `completedAt`
- `updatedAt`
- `items[]`

Item fields in the group snapshot:

- `groupId`
- `itemId`
- `taskId`
- `bookId`
- `fileName`
- `status`
- `analysisStatus`
- `submitStatus`
- `submitTaskId`
- `submitError`
- `submitDocNo`
- `submitDocKey`
- `submittedAt`
- `createdAt`
- `startedAt`
- `completedAt`
- `updatedAt`

Notes:

- `status` is the current visible item status.
- Before submit, `status` follows analysis.
- When submit starts, `status` switches to submit-stage status.
- `analysisStatus` keeps the original OCR/analyze result.
- Group `status` is still the analysis aggregate.
- Group `submitStatus` is the submit aggregate.

## 5. GET /batch/groups

`GET /user/purchase-invoice/batch/groups?page=1&pageSize=20`

Returns historical batch groups for the current `bookId`.

Response:

```json
{
  "total": 10,
  "page": 1,
  "pageSize": 20,
  "hasNext": false,
  "items": []
}
```

## 6. GET /batch/item

`GET /user/purchase-invoice/batch/item?itemId=<uuid>`

Returns:

- `item`: batch item snapshot
- `task`: full single-task payload, same shape as `/user/purchase-invoice/create/status`

`task` includes:

- `fileServer.code`
- `fileServer.link`
- `fileServer.imageUrl`
- `draft`
- `warnings`
- `diagnostics`
- `aiUsage`

This endpoint is the main place to inspect one file end-to-end.

## 7. SSE: GET /batch/group/events

`GET /user/purchase-invoice/batch/group/events?groupId=<uuid>`

Headers:

- `Accept: text/event-stream`
- `X-Book-Id: <bookid>`

Behavior:

1. Server replays historical events for the group.
2. Server emits `replay_completed`.
3. Server keeps streaming live events.
4. Server emits a `ping` heartbeat every 15 seconds.

Source of truth:

- Use `GET /user/purchase-invoice/batch/group?groupId=<uuid>` for final group state.
- Use `GET /user/purchase-invoice/batch/item?itemId=<uuid>` for final item state.
- SSE is for live progress only.
- If SSE says `ocrprocessing` / `aianalyzing` but the snapshot already says `completed`, the UI is stale and must refresh from the snapshot endpoint.

### SSE event shape

SSE event type is `batch`, and `data` is JSON.

Example:

```json
{
  "eventId": 1773975415760436409,
  "groupId": "uuid",
  "itemId": "uuid",
  "eventType": "item_status_changed",
  "status": "ocrprocessing",
  "fileName": "A.pdf",
  "startedAt": "timestamp",
  "completedAt": null,
  "at": "timestamp"
}
```

Common `eventType` values:

- `group_created`
- `item_status_changed`
- `group_status_changed`
- `replay_completed`
- `ping`
- `item_submit_queued`
- `item_submit_status_changed`
- `item_submitted`
- `item_submit_failed`
- `item_submit_skipped`

### SSE parsing note

- `event:` and `data:` lines may arrive in different TCP chunks.
- Clients must buffer until the blank line terminator before processing.
- Do not reset the `data` buffer per TCP packet.

## 8. POST /group/item/{itemId}/submit

Submit one batch item.

Rules:

- Requires `X-Book-Id`
- Item must already be OCR-ready:
  - `completed`
  - `completed_with_warnings`
- If item is already submitted, return `409`
- The server uses the current item task draft
- No request body is required

Behavior:

1. Create a normal submit task.
2. Link the submit task back to this batch item.
3. Batch item status moves to `submit_queued`.
4. The existing submit queue handles the actual `stock create` and `pi create`.

Response:

```json
{
  "success": true,
  "groupId": "uuid",
  "itemId": "uuid",
  "taskId": "uuid",
  "submitTaskId": "uuid",
  "status": "submit_queued"
}
```

## 9. POST /group/{groupId}/submit-all

Submit all ready items in one batch group.

Rules:

- Requires `X-Book-Id`
- Only ready items are queued
- Not-ready items are marked `not_ready` and skipped
- Already submitted items are skipped
- If one item fails, later items continue
- Submit execution is still serialized per `bookId`

Behavior:

1. Scan the group items.
2. Queue every eligible item into the normal submit queue.
3. Leave still-processing OCR items as `not_ready`.
4. Continue after failures.

Response:

```json
{
  "success": true,
  "groupId": "uuid",
  "bookId": "uuid",
  "queuedCount": 2,
  "skippedNotReadyCount": 1,
  "skippedSubmittedCount": 1
}
```

## 10. Submit Result Mapping

Submit status values map as follows:

| Submit stage | Meaning |
|---|---|
| `submit_queued` | Submit task created and waiting in queue |
| `submitting_stock` | Server is creating stock records |
| `submitting_pi` | Server is creating the purchase invoice |
| `submitted` | Submit finished successfully |
| `submit_failed` | Submit failed |
| `not_ready` | Item is not ready for submit yet |

For group snapshots:

| Group submit status | Meaning |
|---|---|
| `idle` | No submit in progress |
| `submitting` | One or more items are still in submit queue or running |
| `completed` | All submitted items finished successfully |
| `completed_with_failures` | At least one item failed submit |

## 11. Practical UI Rules

- Show `analysisStatus` for OCR progress.
- Show `submitStatus` for submit progress.
- Use `status` as the current display state for the item.
- Use `group.submitStatus` to show the group submit summary.
- Use `group.status` to show the OCR summary.
- Use `task.fileServer.imageUrl` only as preview URL.
- Use `task.fileServer.link` as the actual `externalLink`.

