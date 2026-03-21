# Purchase Invoice APIs

这份文档把 purchase invoice 的主流程一次写完整，包含：

- 列表 / 详情
- upload/create
- task view
- batch create / batch view / batch submit
- submit / submit status
- history / history events
- reanalyze
- void
- 错误处理与重复请求行为

目标是让前端可以直接按这里接，不需要再靠猜状态。

---

## 1) List

`GET /user/purchase-invoice`

用于列表页摘要查询（分页、排序、筛选）。

### Header

```http
X-Book-Id: <book-id>
```

### Query 参数

- `page` 默认 `1`
- `pageSize` 默认 `20`，最大 `100`
- `sortBy` 可选：`date|supplier|agent|currency|grandTotal|amount|invoiceNo`
- `sortOrder` 可选：`asc|desc`
- `supplier` 可选：供应商模糊筛选
- `dateFrom` 可选：`YYYY-MM-DD`
- `dateTo` 可选：`YYYY-MM-DD`
- `grandTotalMin` 可选：数字
- `grandTotalMax` 可选：数字

### 返回

列表项新增 `docKey`，用于稳定打开详情。

```json
{
  "items": [
    {
      "docKey": "12345",
      "invoiceNo": "PIY1426#02127",
      "supplierInvoiceNo": "MT259209.000",
      "supplier": "MEADOW TECHNOLOGY SDN BHD",
      "agent": "JULIANWG",
      "currency": "MYR",
      "date": "2026-03-21",
      "grandTotal": 174.0,
      "amount": 174.0
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```

---

## 2) Detail

`GET /user/purchase-invoice/detail?docKey=<docKey>`

用于详情页，按 `docKey` 查询 `PI + PIDTL`。

### Header

```http
X-Book-Id: <book-id>
```

### Query 参数

- `docKey` 必填

### 返回

```json
{
  "success": true,
  "bookId": "efcf1e38-080b-45eb-be81-0fc22bf64444",
  "docKey": "12345",
  "header": {
    "docKey": "12345",
    "invoiceNo": "PIY1426#02127",
    "supplierInvoiceNo": "MT259209.000",
    "supplier": "MEADOW TECHNOLOGY SDN BHD",
    "agent": "JULIANWG",
    "currency": "MYR",
    "date": "2026-03-21",
    "grandTotal": 174.0,
    "amount": 174.0
  },
  "details": [
    {
      "itemCode": "SW-OF-365-FA",
      "description": "MICROSOFT OFFICE 365 FAMILY",
      "uom": "UNIT",
      "qty": 1,
      "unitPrice": 174.0,
      "amount": 174.0,
      "taxCode": "",
      "accNo": "610-0000"
    }
  ]
}
```

### 错误码

- `400`：缺少 `X-Book-Id` 或 `docKey`
- `404`：book 或 doc 不存在
- `500`：数据库查询失败

---

## 3) Create

`POST /user/purchase-invoice/create`

用于上传单个 PDF / 图片，创建一个 purchase invoice task。

### Header

```http
X-Book-Id: <book-id>
```

### Request

- `multipart/form-data`
- 只允许一个文件
- 文件字段名固定为 `file`
- 额外字段会被拒绝

### 返回

```json
{
  "success": true,
  "taskId": "e1a58d22-68ad-42e0-912b-09823889cc14",
  "uploadId": "7f1f7c4f-d4f8-4d8f-8f9b-b3f6b1d7ef55",
  "bookId": "efcf1e38-080b-45eb-be81-0fc22bf64444",
  "originalName": "MEADOW # MT257895.pdf",
  "contentType": "application/pdf",
  "size": 123456,
  "status": "queued"
}
```

### 行为说明

- create 成功后会先落盘 task
- 然后进入后台处理队列
- 后台处理顺序：
  - `queued`
  - `processing`
  - `fileserver_uploading`
  - `ocrprocessing`
  - `aianalyzing`
  - `completed` / `completed_with_warnings`
  - 或 `failed`

### 错误码

- `400`：invalid multipart form / missing file / 文件类型不支持 / book 校验失败
- `404`：book 不存在
- `500`：保存 task 失败 / 服务器内部错误

### 重复请求行为

- `create` **不是幂等接口**
- 同一份文件重复 POST，会生成新的 `taskId`
- 如果前端没有收到响应，不能默认“自动重试”而不做判断
- 建议先看 `history` 或 task 状态，再决定是否重新上传

---

## 4) Task View

`GET /user/purchase-invoice/create/status?taskId=<taskId>`

这是 upload/create 的“任务详情视图”，前端用于：

- 看 OCR / AI 结果
- 看当前状态
- 看 `draft` 是否已经被 submit 覆盖
- 看是否有 warning

### Header

```http
X-Book-Id: <book-id>
```

### Query 参数

- `taskId` 必填

### 返回

这个接口返回的是 task 的客户端安全版本，保留：

- `taskId`
- `uploadId`
- `groupId`
- `itemId`
- `bookId`
- `originalName`
- `contentType`
- `size`
- `status`
- `createdAt`
- `updatedAt`
- `fileServer`
- `draft`
- `warnings`
- `reanalyzeCount`
- `lastReanalyzeRequestedAt`
- `lastReanalyzedAt`
- `recoveredAfterRestart`
- `recoveredAt`
- `recoveryReason`

不返回的字段：

- `ocrRaw`
- `aiUsage`
- `diagnostics`
- `storedPath`

### 典型 status 流转

- `queued`
- `processing`
- `fileserver_uploading`
- `ocrprocessing`
- `aianalyzing`
- `reanalyze_queued`
- `reanalyzing`
- `completed`
- `completed_with_warnings`
- `failed`

### 说明

- `create/status` 是可重复读取的
- 同一个 `taskId` 在流程继续推进时，状态会更新
- 如果 `submit` 改过草稿，这里会看到更新后的 `draft`
- 如果任务已完成，再次请求还是返回同一个最终快照

### 错误码

- `400`：缺少 `X-Book-Id` 或 `taskId`
- `404`：task 不存在
- `500`：读取 task 失败 / 编码失败

---

## 5) Batch Create

`POST /user/purchase-invoice/batch/create`

用于一次上传 1~50 个文件，系统会自动建立一个 batch group。

### Header

```http
X-Book-Id: <book-id>
```

### Request

- `multipart/form-data`
- 文件字段名固定为 `file`
- 最多 `50` 个文件
- 额外字段会被拒绝

### 返回

```json
{
  "success": true,
  "groupId": "0ffb82f0-de5d-4475-880a-e04240622095",
  "bookId": "efcf1e38-080b-45eb-be81-0fc22bf64444",
  "status": "queued",
  "totalItems": 2,
  "queuedCount": 2,
  "processingCount": 0,
  "completedCount": 0,
  "failedCount": 0,
  "items": []
}
```

### 行为说明

- 系统会自动给每个文件分配一个 `itemId`
- 每个文件还是一个独立 task
- group 只是把这些 task 聚合起来，方便前端看进度

### 错误码

- `400`：invalid multipart form / 文件太多 / 缺少文件
- `404`：book 不存在
- `500`：batch group 创建失败

---

## 6) Batch View

### 6.1 Group View

`GET /user/purchase-invoice/batch/group?groupId=<groupId>`

用于看单个 batch group 的完整状态。

#### 返回

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
- `recoveredAfterRestart`
- `recoveredAt`
- `updatedAt`
- `items`

### 6.2 Groups List

`GET /user/purchase-invoice/batch/groups?page=1&pageSize=20`

用于列出当前 `bookId` 下所有 batch group。

### 6.3 Item View

`GET /user/purchase-invoice/batch/item?itemId=<itemId>`

返回：

```json
{
  "item": {
    "groupId": "...",
    "itemId": "...",
    "taskId": "...",
    "bookId": "...",
    "fileName": "...",
    "status": "ready",
    "analysisStatus": "completed",
    "submitTaskId": "",
    "submitStatus": "",
    "submitError": "",
    "submitDocNo": "",
    "submitDocKey": 0,
    "createdAt": "...",
    "startedAt": "...",
    "completedAt": "...",
    "updatedAt": "..."
  },
  "task": { }
}
```

### 6.4 SSE

`GET /user/purchase-invoice/batch/group/events?groupId=<groupId>`

SSE 行为：

- 连接后先发历史快照
- 后续推送变更事件
- 每 `15` 秒发一次 `ping`

事件类型包括：

- `group_created`
- `item_status_changed`
- `item_submit_queued`
- `item_submit_skipped`
- `item_submit_failed`
- `item_submitted`
- `group_status_changed`
- `replay_completed`
- `ping`

---

## 7) Batch Submit / Batch Reanalyze

这组接口用于 batch item 的单项 submit、整组 submit all、以及单项 reanalyze。

### 7.1 单项 Submit

`POST /user/purchase-invoice/group/item/{itemId}/submit`

行为：

- 读取对应 item
- 读取 item 对应 task
- 若 task 不是 ready 状态，则标记为 `not_ready`
- 若可以提交，则创建一个 submit task
- 再把 batch item 连接到这个 submit task

返回：

```json
{
  "success": true,
  "groupId": "...",
  "itemId": "...",
  "taskId": "...",
  "submitTaskId": "...",
  "status": "submit_queued"
}
```

### 7.2 整组 Submit All

`POST /user/purchase-invoice/group/{groupId}/submit-all`

行为：

- 遍历 group 内所有 item
- 只提交未完成 submit 的项
- 已 `submitted` 的项会跳过
- 不可提交的项会标记为 `not_ready`

返回：

```json
{
  "success": true,
  "groupId": "...",
  "bookId": "...",
  "queuedCount": 2,
  "skippedNotReadyCount": 1,
  "skippedSubmittedCount": 3
}
```

### 7.3 单项 Reanalyze

`POST /user/purchase-invoice/group/item/{itemId}/reanalyze`

行为：

- 只允许未提交、且没有 submit 进行中的 item
- 会把对应 task 送回 reanalyze 队列

返回：

```json
{
  "success": true,
  "groupId": "...",
  "itemId": "...",
  "taskId": "...",
  "status": "reanalyze_queued"
}
```

### 7.4 Batch Submit 的重复请求行为

- 单项 submit：
  - 当前实现只对 `submitted` 做硬拦截
  - 前端应在 `submit_queued / submitting_stock / submitting_pi` 时禁用按钮
- submit-all：
  - 已提交的 item 会跳过
  - 未提交但还在处理中或状态不稳定的 item，前端应先等状态稳定再发

---

## 8) Submit

`POST /user/purchase-invoice/submit`

用于把前端当前显示出来的 draft 发起最终入库流程。

### Header

```http
X-Book-Id: <book-id>
```

### Request Body

```json
{
  "taskId": "e1a58d22-68ad-42e0-912b-09823889cc14",
  "draft": {
    "header": {
      "creditorCode": "400-M012",
      "docDate": "2026-03-21",
      "supplierInvoiceNo": "MT259209.000",
      "currencyCode": "MYR",
      "currencyRate": 1,
      "description": "PURCHASE INVOICE",
      "externalLink": "http://files/xxx",
      "displayTerm": "C.O.D.",
      "invAddr1": "NO.7 & 9",
      "invAddr2": "JALAN KEEMBONG 22"
    },
    "details": [
      {
        "itemCode": "KM-LOGITECH-Y1402",
        "description": "LOGITECH M171 WIRELESS MOUSE",
        "uom": "UNIT",
        "qty": 1,
        "unitPrice": 79,
        "amount": 79,
        "taxCode": "",
        "accNo": "610-0000",
        "isAutoCreate": false
      }
    ]
  }
}
```

### 返回

```json
{
  "success": true,
  "submitTaskId": "2d14d8c4-0c0f-45d7-9d0c-0e2f25c9d4bf",
  "taskId": "e1a58d22-68ad-42e0-912b-09823889cc14",
  "bookId": "efcf1e38-080b-45eb-be81-0fc22bf64444",
  "status": "queued"
}
```

### 行为说明

- submit 会先把前端传来的 draft 回写到原始 task
- 然后创建一个独立的 `submitTask`
- submit 任务会在后台执行：
  - `queued`
  - `validating`
  - `stock_creating`
  - `stock_failed`
  - `pi_creating`
  - `submitted`
  - `failed`

### 关键约束

- 同一个 `bookId` 下，submit 处理是按书串行调度的
- 不同 `bookId` 可以并行
- 同一 submit task 内，auto-create stock 是按明细顺序处理的

### 错误码

- `400`：missing taskId / draft 非法 / task 没有 fileserver link
- `404`：task 不存在
- `500`：提交任务持久化失败

### 重复请求行为

- 当前实现**没有做 submit 去重**
- 如果前端在任务还没终结时重复 POST `/submit`，可能生成新的 `submitTaskId`
- 所以前端应先查 `submit/status` 或 `history`，再决定要不要重新提交

---

## 9) Submit Status View

`GET /user/purchase-invoice/submit/status?submitTaskId=<submitTaskId>`

用于查看 submit 任务本身的完整进度。

### Header

```http
X-Book-Id: <book-id>
```

### 返回

返回完整的 `submitTask` JSON，包括：

- `submitTaskId`
- `taskId`
- `bookId`
- `status`
- `currentStep`
- `currentRequestId`
- `createdAt`
- `updatedAt`
- `draft`
- `diagnostics`
- `warnings`
- `validationErrors`
- `stockResults`
- `piResult`

### 典型状态含义

- `queued`：已入队，还没开始
- `validating`：本地校验中
- `stock_creating`：正在创建 auto-create stock
- `stock_failed`：某一行 stock 创建失败
- `pi_creating`：正在创建 PI
- `submitted`：PI 成功
- `failed`：整体失败

### 错误码

- `400`：missing submitTaskId
- `404`：submit task 不存在
- `500`：读取 submit task 失败

---

## 10) History

`GET /user/purchase-invoice/history`

用于跨设备历史列表。

`GET /user/purchase-invoice/history/events`

用于跨设备实时更新。

### 特点

- 历史索引持久化在主库 `root."PurchaseInvoiceHistory"`
- 同一个 `X-Book-Id` 下，电脑 A / B 都能看到同样的记录
- 返回的是最小字段集合：
  - `type`
  - `id`
  - `bookId`
  - `groupId`
  - `taskId`
  - `status`
  - `createdAt`
  - `updatedAt`

### 状态映射

历史视图会把底层分析 / submit 状态归一化成前端更好用的状态：

- `uploading`
- `analyzing`
- `ready`
- `submitting`
- `submitted`
- `failed`

### 删除

`DELETE /user/purchase-invoice/history?type=<task|group>&id=<id>`

只删除历史索引，不删除业务单据，也不删除文件。

### SSE

连接后先发 snapshot，之后推送 upsert / delete 事件，另外每 15 秒发 ping。

### 重复请求行为

- `GET /history` 和 `GET /history/events` 都是可重复请求的读接口
- SSE 断线后，建议先重新 GET 一次 history，再重新连 SSE

---

## 11) Reanalyze

### 11.1 单个 Task Reanalyze

`POST /user/purchase-invoice/task/{taskId}/reanalyze`

只允许 terminal task 重新分析。

### 返回

```json
{
  "success": true,
  "taskId": "e1a58d22-68ad-42e0-912b-09823889cc14",
  "groupId": "",
  "itemId": "",
  "status": "reanalyze_queued"
}
```

### 规则

- 只有 terminal task 才允许 reanalyze
- 如果已经提交或 submit 进行中，会返回 `409`
- reanalyze 只重跑 OCR / AI / 解析
- 它不会重新上传 fileserver

### 可能的错误

- `409`：submitted task cannot be reanalyzed / task submit in progress / task not ready for reanalyze
- `404`：task 不存在
- `500`：入队失败

### 重复请求行为

- reanalyze 对 terminal task 是允许的
- 但如果 task 已经进入 reanalyze 队列，再重复点会被当前状态挡住

---

## 12) Void

`POST /user/purchase-invoice/void`

用于把一张已存在的 PI 发给 WS 客户端执行 `void`。

### Header

```http
X-Book-Id: <book-id>
```

### Request Body

```json
{
  "docKey": 240421,
  "docNo": "PIY1426#03078"
}
```

字段说明：

- `docKey`：可选，优先使用
- `docNo`：可选
- 两者至少提供一个

### 返回

```json
{
  "success": true,
  "bookId": "efcf1e38-080b-45eb-be81-0fc22bf64444",
  "requestId": "void-pi-2a9b3f7d-6b0d-4d2e-8aa2-8d5a5f8d3fd0",
  "entity": "pi",
  "type": "void_done",
  "status": "void_done",
  "docKey": 240421,
  "docNo": "PIY1426#03078",
  "reason": "",
  "elapsedMs": 8123
}
```

### 错误码

- `400`：缺少 `X-Book-Id`、`docKey`、`docNo`
- `404`：book 不存在
- `409`：客户端返回 `void_error`
- `503`：WS 客户端离线或无法发出 void 请求

---

## 13) 前端推荐接法

### 创建单据

1. 调 `POST /user/purchase-invoice/create`
2. 拿到 `taskId`
3. 轮询 `GET /user/purchase-invoice/create/status?taskId=...`
4. 或直接连 `GET /user/purchase-invoice/history/events`

### 批量创建

1. 调 `POST /user/purchase-invoice/batch/create`
2. 拿到 `groupId`
3. 轮询 `GET /user/purchase-invoice/batch/group?groupId=...`
4. 或连 `GET /user/purchase-invoice/batch/group/events?groupId=...`

### 提交

1. 前端把当前 draft 发给 `POST /user/purchase-invoice/submit`
2. 拿到 `submitTaskId`
3. 轮询 `GET /user/purchase-invoice/submit/status?submitTaskId=...`
4. 当状态到 `submitted` 后，再去历史里看 `submitted`

### 重新分析

1. 只有 task 已终结时才允许点 reanalyze
2. 如果 task 已经 submit 或 submit 进行中，直接拦截
3. reanalyze 完成后，继续看 `create/status`

---

## 14) 错误处理与再次请求规则

这部分是前端最需要看的。

### 14.1 create 失败后

- 如果 `create` 请求直接失败且没有拿到 `taskId`：
  - 可以重新上传
  - 但这会生成新 task
- 如果已经拿到 `taskId`：
  - 不要直接再传同一份当成“补偿重试”
  - 先查 `create/status`
  - 如果 task 已经在跑，就继续等

### 14.2 create 已完成后再次请求

- 再次查 `create/status` 会返回同一个最终结果
- 不会重新创建 task
- 如果你点的是“重新分析”，要走 `reanalyze`

### 14.3 submit 失败后

- `submit/status` 会保留：
  - `validationErrors`
  - `stockResults`
  - `piResult`
  - `status`
- 你可以根据失败点决定：
  - 校验失败：改 draft 后再 submit
  - stock 失败：先修 stock 再 submit
  - PI 失败：修 header / 明细后再 submit

### 14.4 submit 已完成后再次请求

- `submit/status` 会一直保留最终结果
- `history` 会显示 `submitted`
- 当前实现没有 submit 去重
- 如果前端重复 POST `/submit`，可能生成新的 `submitTaskId`
- 所以前端必须先判断当前是否已经 `submitted`

### 14.5 reanalyze 失败后

- 终态 task 可以再点 reanalyze
- 如果本地源文件已被清理，reanalyze 可能失败
- 这种情况需要重新 upload

### 14.6 history 失败后

- history 是索引，不是主数据
- 删除 history 只删除索引，不影响单据
- 如果 SSE 断了，先重新 GET 再重连 SSE

---

## 15) 备注

- `create/status` 是 task 视图
- `submit/status` 是 submit 视图
- `history` 是跨设备索引视图
- `batch/group` 和 `batch/item` 是 batch 视图
- 当前实现里，`taskClientPayload` 会隐藏：
  - `ocrRaw`
  - `aiUsage`
  - `diagnostics`
  - `storedPath`

