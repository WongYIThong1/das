# Purchase Invoice Create Preview

`/purchase-invoice/create` 现在是一个异步 preview 接口。

它不再同步返回 AI 结果，而是：

1. 接收前端上传的 invoice 文件
2. 转发到外部 OCR 服务创建 OCR task
3. 后端后台等待 OCR 完成
4. 用 `gpt-5.4` 分析 OCR 原文
5. 自动匹配本地账套主数据
6. 产出给前端确认的 Purchase Invoice payload

真正创建仍然走：

- `POST /purchase-invoice/submit`

## 当前实现

当前 AI 链路已经切成两段：

- OCR：
  - 使用 [ocr.md](/home/ubuntu/backend/ocr.md) 定义的外部 OCR 服务
  - 后端只拿 OCR 原文，不再把 PDF/图片直接发给多个视觉模型
- 字段理解和模糊匹配：
  - 只使用 YunJinTao OpenAI 兼容接口
- `base_url=https://cdn.yunjintao.com/v1`
  - `model=gpt-5.4`

已删除旧的多 provider 流程：

- AI Studio
- OpenRouter
- Cloudflare

## 认证

必须登录后调用，沿用：

- `HttpOnly app_session` cookie

前端请求要带：

```js
credentials: "include"
```

后端会自动从当前登录用户 profile 获取：

- `bookId`
- `company`

前端不能自己指定账套。

## 接口

### 1. 创建 preview task

- `POST /purchase-invoice/create`

请求格式：

- `multipart/form-data`

字段：

- `file`
  - 必填
  - 仅支持：
    - `application/pdf`
    - `image/png`
    - `image/jpeg`
    - `image/webp`

当前默认上传限制：

- `15 MB`

成功返回：

```json
{
  "taskId": "uuid",
  "status": "queued"
}
```

状态码：

- `202 Accepted`

注意：

- 当前版本要求必须配置 `FILESERVER_BASE_URL`（用于生成可下载的 `externalLink` URL）。
- 如果未配置或 FileServer 上传失败，preview 会直接返回错误（不会创建 task）。

### 2. 查询 preview task

- `GET /purchase-invoice/create/{taskId}`

成功返回示例：

```json
{
  "taskId": "uuid",
  "status": "succeeded",
  "reanalyzeCount": 0,
  "ocrMode": "raw",
  "ocrVariant": "",
  "ocrQualityScore": 0,
  "result": {
    "success": true,
    "provider": "gpt-5.4",
    "bookId": "4c892050-45a7-4c82-840d-12af91f5312d",
    "company": "Antsdemo",
    "warnings": [],
    "file": {
      "fileId": "P5hRCpfR7c8-KHr51w6dXg",
      "status": "pending",
      "downloadUrl": "http://192.168.11.163:8080/d/<token>",
      "statusUrl": "http://192.168.11.163:8080/v1/files/<file_id>",
      "sha256": "69b84e0a...",
      "size": 574658,
      "originalName": "GREX-1013860.pdf",
      "contentType": "application/pdf"
    },
    "payload": {
      "creditorCode": "400-G001",
      "purchaseAgent": "",
      "supplierInvoiceNo": "01-HQ-1013860",
      "externalLink": "http://192.168.11.163:8080/d/<token>",
      "docDate": "2026-02-03",
      "currencyCode": "MYR",
      "currencyRate": 1,
      "displayTerm": "C.O.D.",
      "purchaseLocation": "HQ",
      "description": "PURCHASE INVOICE",
      "creditorAddressLines": [],
      "details": []
    },
    "matches": {
      "creditor": {
        "status": "matched",
        "confidence": 0.97,
        "extractedValue": "GREX MULTIMEDIA SDN BHD",
        "reason": "high confidence local exact/near-exact match",
        "candidate": {
          "code": "400-G001",
          "companyName": "GREX MULTIMEDIA SDN BHD"
        },
        "topCandidates": []
      },
      "agent": {
        "status": "unmatched",
        "confidence": 0,
        "extractedValue": "CELINE",
        "candidate": null,
        "topCandidates": []
      },
      "items": []
    },
    "extracted": {
      "invoiceNumber": "01-HQ-1013860",
      "invoiceDate": "2026-02-03",
      "creditorName": "GREX MULTIMEDIA SDN BHD",
      "creditorAddressLines": [],
      "currencyCode": "MYR",
      "agentName": "CELINE",
      "description": "",
      "displayTerm": "",
      "purchaseLocation": "",
      "items": []
    }
  }
}
```

## FileServer externalLink

如果后端配置了 `FILESERVER_BASE_URL`，在 OCR 进行的同时会把原文件上传到 FileServer，并返回永久 `downloadUrl`：

- preview 结果会把它放到 `payload.externalLink`
- 同时也会返回 `result.file`（包含 `fileId/status/statusUrl` 等）

注意：

- FileServer 扫描是异步的，`status` 可能是 `pending/scanning/ready`
- `downloadUrl` 永远可用，但扫描未完成时下载会返回 `409 not_ready`

处理中返回示例：

```json
{
  "taskId": "uuid",
  "status": "ocr_processing",
  "externalLink": "http://192.168.11.163:8080/d/<token>",
  "reanalyzeCount": 0,
  "ocrMode": "raw",
  "ocrVariant": "",
  "ocrQualityScore": 0,
  "file": {
    "fileId": "P5hRCpfR7c8-KHr51w6dXg",
    "status": "pending",
    "downloadUrl": "http://192.168.11.163:8080/d/<token>",
    "statusUrl": "http://192.168.11.163:8080/v1/files/<file_id>"
  }
}
```

失败返回示例：

```json
{
  "taskId": "uuid",
  "status": "failed",
  "error": "ocr task failed"
}
```

### 3. 取消 preview task

- `POST /purchase-invoice/create/{taskId}/cancel`

成功示例：

```json
{
  "taskId": "uuid",
  "status": "canceled"
}
```

### 4. 手动 Reanalyze (重跑 OCR + 分析)

- `POST /purchase-invoice/create/{taskId}/reanalyze`

用途：

- 针对手写、倾斜、反光等图片，第一次 OCR 结果太差时，让用户手动点一次重跑。

行为：

- 后端会复用该任务的 FileServer 文件下载链接，重新创建 OCR task（`mode=auto`）。
- 任务会回到 `queued -> ocr_processing -> analyzing -> succeeded/failed`。
- `reanalyzeCount` 会自增 1。

注意：

- **不会自动触发**，只有用户手动调用才会触发。

## Task 状态

当前支持：

- `queued`
- `ocr_processing`
- `analyzing`
- `succeeded`
- `failed`
- `canceled`

## 字段提取策略

`gpt-5.4` 只看 OCR 原文，不直接看文件。

它负责提取：

- `invoiceNumber`
- `invoiceDate`
- `creditorName`
- `creditorAddressLines`
- `currencyCode`
- `agentName`
- `description`
- `displayTerm`
- `purchaseLocation`
- `items[]`
  - `description`
  - `desc2`
  - `qty`
  - `unitPrice`
  - `amount`
  - `uom`
  - `taxCode`

后端随后做标准化：

- 日期转 `YYYY-MM-DD`
- 货币/UOM 大写
- 清理 `SN:`、license key 等干扰文本
- `NO TAX / NIL / 0 / EXEMPT` 这类值统一视为“没有明确税码”
- preview 阶段如果税码无法确认，会保持空值并返回 warning，不会强制补默认税码

## 模糊匹配策略

不会把数据库全部发给模型。

当前流程是：

1. 先在本地账套库里做候选召回
2. 只拿少量 Top K 候选给 `gpt-5.4` 复判
3. 返回：
   - `candidate`
   - `topCandidates`
   - `status`
   - `confidence`
   - `reason`
   - `extractedValue`

本地候选来源：

- `Creditor`
- `PurchaseAgent`
- `Item`
- `ItemGroup`
- `ItemUOM`
- 历史 `PI/PIDTL`

## 规则保持不变

preview 仍然会按当前账套的已知有效值收口：

- `displayTerm`
- `purchaseLocation`
- `currencyCode`
- `taxCode`
- `accNo`

其中：

- `purchaseAgent`
  - 只根据 OCR 提取的人名去匹配
  - 没匹配到就留空
- `itemCode`
  - 只有在高置信度或 AI review 选择后才会回填
- `description`
  - 顶层一定有值，默认 `PURCHASE INVOICE`
  - 明细 description 一定有值
- `desc2`
  - 默认不自动填
- `itemGroup`
  - 明细 `itemGroup` 现在不允许为空
  - 先由 AI 从现有 `ItemGroup` / `ShortCode` 里选择
  - 如果 AI 选不到或返回脏值，后端会按本地规则强制挑一个最可能的 group
- `baseUom / salesUom / purchaseUom / reportUom`
  - 新 item 默认优先使用 `UNIT`
  - 如果当前账套没有 `UNIT`，后端会回退到 `USER`，再不行才使用第一个可用 Base UOM
  - `proposedNewItem.uomDecision` 仅用于说明最终默认到了哪个 UOM

## 错误响应

`400 Bad Request`

- 缺少文件
- 文件类型不支持
- 文件过大

`401 Unauthorized`

- 登录态无效

`404 Not Found`

- `taskId` 不存在
- 当前用户不是该 task 所属账套

`500 Internal Server Error`

- OCR 服务失败
- GPT 分析失败
- Redis 读写失败
