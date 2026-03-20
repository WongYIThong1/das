# Purchase Invoice Create API

`POST /user/purchase-invoice/create` 是采购发票的统一创建入口。

这个接口的职责只有一件事：

- 接收用户上传的单个 PDF / 图片文件
- 立即返回 `taskId`
- 后台异步执行文件存储、OCR、AI 分析、credior/item 回填、草稿生成
- 用户通过状态接口轮询任务进度和最终草稿结果

默认并发配置：

- `PURCHASE_INVOICE_WORKERS` 默认 `16`
- `PURCHASE_INVOICE_GLOBAL_CONCURRENCY` 默认 `16`
- `PURCHASE_INVOICE_PER_BOOK_CONCURRENCY` 默认 `4`

如果你要继续提高吞吐量，可以通过环境变量再往上调，但要注意 OCR / AI 外部服务的限流。

---

## 1. 接口总览

### 创建任务

`POST /user/purchase-invoice/create`

### 查询状态

`GET /user/purchase-invoice/create/status?taskId=<uuid>`

### 提交草稿

草稿确认后请使用：

- `POST /user/purchase-invoice/submit`
- `GET /user/purchase-invoice/submit/status?submitTaskId=<uuid>`

详细规则见 [`submit.md`](./submit.md)。

---

## 2. 认证与请求头

### 必填请求头

- `X-Book-Id: <uuid>`

说明：

- `bookid` 用于定位当前账套
- 创建任务前会先检查该 `bookid` 是否存在
- 后台所有匹配逻辑也只会在该 `bookid` 的数据范围内执行

### 其他请求头

- `Content-Type: multipart/form-data`，上传文件时由客户端或 curl 自动设置
- `application/json` 不支持本接口的创建模式

---

## 3. 请求方式

### 3.1 推荐方式：multipart/form-data

该接口当前只接受单文件上传。

支持的文件类型：

- `application/pdf`
- `image/jpeg`
- `image/png`
- `image/webp`

限制：

- 只允许 1 个文件
- 最大大小：`20MB`
- 表单字段名必须是 `file`

### 3.2 不支持：application/json

如果你用 JSON 调用 `create`，服务会直接返回错误：

```text
json create submission is not supported on this endpoint; use multipart/form-data with file
```

这不是临时限制，而是当前接口设计。

---

## 4. 请求参数

### Header

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `X-Book-Id` | uuid string | 是 | 当前账套 ID |

### Form Data

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `file` | file | 是 | 采购发票 PDF 或图片 |

### 文件限制

| 项目 | 规则 |
|---|---|
| 单次上传数量 | 1 |
| 文件大小 | 最大 20MB |
| MIME 类型 | `application/pdf` / `image/jpeg` / `image/png` / `image/webp` |
| 返回文件内容 | 不直接返回文件内容，只返回任务信息 |

---

## 5. 创建流程

一次 `create` 会按下面流程执行：

1. 校验 `X-Book-Id`
2. 校验文件是否存在、是否只有一个文件
3. 校验文件类型和大小
4. 生成 `taskId` 和 `uploadId`
5. 将原始文件写入本地任务目录
6. 写入任务 JSON
7. 返回 `taskId`
8. 后台异步执行：
   - `fileserver_uploading`
   - `ocrprocessing`
   - `aianalyzing`
   - `completed` / `completed_with_warnings`

---

## 6. 状态流转

任务状态是异步更新的，前端需要轮询状态接口。

状态枚举如下：

| 状态 | 说明 |
|---|---|
| `queued` | 已创建任务，等待调度 |
| `processing` | 任务开始处理中 |
| `fileserver_uploading` | 文件正在上传到文件服务器 |
| `ocrprocessing` | 正在进行 OCR |
| `aianalyzing` | 正在进行 AI 草稿分析 |
| `completed` | 成功完成 |
| `completed_with_warnings` | 完成但存在警告 |

说明：

- `completed_with_warnings` 不是失败
- 这表示结果已经生成，但某些字段置信度偏低，或者存在明细/匹配告警
- 前端建议把此状态显示为“可用，但需要人工复核”

---

## 7. 创建响应

### 成功返回

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

### 字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `success` | boolean | 是否成功接收任务 |
| `taskId` | uuid string | 任务 ID，用于轮询状态 |
| `uploadId` | uuid string | 上传记录 ID |
| `bookId` | uuid string | 当前账套 |
| `originalName` | string | 原始文件名 |
| `contentType` | string | 文件 MIME 类型 |
| `size` | number | 文件大小，单位 bytes |
| `status` | string | 初始状态，通常是 `queued` |

---

## 8. 状态查询接口

### 请求

`GET /user/purchase-invoice/create/status?taskId=<uuid>`

### 额外请求头

- `X-Book-Id: <uuid>`

状态查询必须同时提供：

- `taskId`
- `X-Book-Id`

### 返回

状态接口会直接返回完整任务对象，包含：

- 基本信息
- 文件服务器结果（`code` / `link` / `imageUrl`）
- OCR 原始数据
- AI usage
- 草稿数据
- warnings
- diagnostics
- 耗时统计

---

## 9. 状态查询返回结构

下面是典型返回示例：

```json
{
  "taskId": "ab17394d-3cad-42b5-a427-0843845f19ba",
  "uploadId": "5464f515-4993-47b0-8a56-a208c8638449",
  "bookId": "efcf1e38-080b-45eb-be81-0fc22bf64444",
  "originalName": "Fuwell # 84726 (1) (2).pdf",
  "contentType": "application/pdf",
  "size": 574658,
  "storedPath": "uploads/purchase-invoice/tasks/efcf1e38-080b-45eb-be81-0fc22bf64444/ab17394d-3cad-42b5-a427-0843845f19ba.pdf",
  "status": "ocrprocessing",
  "createdAt": "2026-03-20T01:02:37.954072997Z",
  "updatedAt": "2026-03-20T01:02:37.999308188Z",
  "fileServer": {
    "code": "32798f012b6ff891993dd05e39635c42e871f5dee4ec6b25bbccaa48d155882e",
    "link": "http://192.168.11.163:3000/files/32798f012b6ff891993dd05e39635c42e871f5dee4ec6b25bbccaa48d155882e",
    "imageUrl": "http://192.168.11.163:3000/images/32798f012b6ff891993dd05e39635c42e871f5dee4ec6b25bbccaa48d155882e"
  },
  "aiUsage": {
    "promptTokens": 0,
    "completionTokens": 0,
    "totalTokens": 0
  },
  "fileServerMs": 40,
  "ocrMs": 2367,
  "analyzeMs": 6173,
  "saveMs": 1,
  "totalMs": 8597,
  "draft": {
    "header": {
      "creditorCode": "400-F001",
      "docDate": "2022-06-22",
      "supplierInvoiceNo": "84726",
      "currencyCode": "SGD",
      "description": "PURCHASE INVOICE",
      "externalLink": "http://192.168.11.163:3000/files/32798f012b6ff891993dd05e39635c42e871f5dee4ec6b25bbccaa48d155882e",
      "displayTerm": "C.O.D.",
      "purchaseAgent": "JULIANWG",
      "invAddr1": "1 ROCHOR CANAL ROAD",
      "invAddr2": "#04-51 SIM LIM SQUARE",
      "invAddr3": "SINGAPORE 188504",
      "confidence": {
        "creditorCode": 0.99,
        "currencyCode": 0.9,
        "description": 0.9,
        "docDate": 0.9,
        "supplierInvoiceNo": 0.9
      }
    },
    "details": [
      {
        "itemCode": "KM-LOGITECH-1719",
        "description": "LOGITECH M590 SILENT WL/BT MOUSE (BLACK)",
        "uom": "UNIT",
        "qty": 1,
        "unitPrice": 57,
        "amount": 57,
        "accNo": "610-0000",
        "confidence": {
          "accNo": 0.9,
          "amount": 0.9,
          "description": 0.9,
          "itemCode": 0.42857142857142855,
          "qty": 0.9,
          "taxCode": 0,
          "unitPrice": 0.9,
          "uom": 0.9
        },
        "warning": true
      }
    ],
    "docScore": 0.8014285714285716,
    "docWarning": false
  },
  "warnings": null,
  "diagnostics": [
    "file_read_ms=1",
    "fileserver_ms=51",
    "ocr_ms=2367",
    "analyze_ms=6173",
    "save_ms=1",
    "total_pipeline_ms=8597"
  ]
}
```

---

## 10. `draft.header` 字段说明

### 10.1 头部字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `creditorCode` | string | 从 creditor 主档匹配出的供应商代码 |
| `docDate` | string | 单据日期，格式为 `YYYY-MM-DD` |
| `supplierInvoiceNo` | string | 供应商发票号 |
| `currencyCode` | string | 币别 |
| `description` | string | 默认固定为 `PURCHASE INVOICE` |
| `externalLink` | string | 文件服务器文件链接（`link`），不是预览图链接 |
| `displayTerm` | string | 付款条款，来自 creditor 主档 |
| `purchaseAgent` | string | 业务员 / agent，来自 creditor 主档 |
| `invAddr1` | string | 地址行 1，来自 creditor 主档 |
| `invAddr2` | string | 地址行 2，来自 creditor 主档 |
| `invAddr3` | string | 地址行 3，来自 creditor 主档 |
| `invAddr4` | string | 地址行 4，来自 creditor 主档 |
| `confidence` | object | 各字段置信度 |

### 10.2 重要规则

- creditor 相关字段最终以数据库主档为准
- 不是 OCR 地址优先
- 只要识别出 `creditorCode`，其余 creditor 资料应自动回填
- 如果主档回读失败，会产生 warning，但不会让整单直接失败

---

## 11. `draft.details` 字段说明

每一行明细包含：

| 字段 | 类型 | 说明 |
|---|---|---|
| `itemCode` | string | 料号 |
| `itemGroup` | string | 料组 |
| `description` | string | 品名 |
| `uom` | string | 单位 |
| `qty` | number | 数量 |
| `unitPrice` | number | 单价 |
| `amount` | number | 金额 |
| `accNo` | string | 会计科目 / purchase code |
| `taxCode` | string | 税码 |
| `confidence` | object | 每列置信度 |
| `isAutoCreate` | boolean | 该行是否为系统生成的待建 stock 草稿 |
| `autoCreateStatus` | string | `ready` / `blocked` |
| `autoCreateReason` | string | 当前固定为 `item_not_found` |
| `autoCreateStock` | object | 后续 submit 可直接使用的 stock create 草稿 |
| `warning` | boolean | 该行是否需要人工复核 |

### 明细回填规则

- item 能匹配到时，会从 `Item` 和 `ItemGroup` 回填：
  - `uom`
  - `taxCode`
  - `accNo`
- item 匹配不到时，会自动返回一条 `autoCreateStock`
  - `ItemGroup` 会先做智能匹配，必要时再用 AI 从候选组里选一个
  - `ItemCode` 优先用 OCR/AI 原始值；没有可靠值时按 `ItemGroup.ShortCode` 生成
  - `SalesUOM / PurchaseUOM / ReportUOM / BaseUOM` 固定为 `UNIT`
  - `TaxCode / PurchaseTaxCode` 固定返回 `null`
  - `accNo` 来自选中的 `ItemGroup.PurchaseCode`
- 如果 `amount == 0` 但 `qty * unitPrice > 0`，会补金额
- 如果 `qty == 0` 但 OCR 行里明显像 `1 UNIT 57.00`，会尝试补成 `qty = 1`
- 如果金额和单价乘数量差异太大，会打 warning

---

## 12. `warnings` 说明

`warnings` 是一个数组，表示任务中存在的非致命问题。

常见 warning：

- `creditor_match_warning`
- `creditor_defaulted_cash_purchase`
- `creditor_master_warning`
- `item_match_warning`
- `ocr_warning`
- `analyze_warning`
- `detail_amount_mismatch_warning`

示例：

```json
[
  {
    "code": "creditor_match_warning",
    "field": "header.creditorCode",
    "message": "low creditor match confidence",
    "severity": "warning",
    "score": 0.62
  }
]
```

前端建议：

- `warnings` 为空，表示结果比较干净
- `warnings` 非空，但 `status = completed_with_warnings`，表示已经生成草稿，只是建议人工确认

---

## 13. `diagnostics` 说明

`diagnostics` 记录每个阶段耗时，便于排查慢在哪里。

可能出现的键：

- `file_read_ms`
- `fileserver_ms`
- `ocr_ms`
- `analyze_ms`
- `save_ms`
- `total_pipeline_ms`

示例：

```json
[
  "file_read_ms=1",
  "fileserver_ms=51",
  "ocr_ms=2367",
  "analyze_ms=6173",
  "save_ms=1",
  "total_pipeline_ms=8597"
]
```

---

## 14. AI Token 统计

任务状态里会回传 AI usage：

```json
{
  "promptTokens": 622,
  "completionTokens": 210,
  "totalTokens": 832
}
```

这表示：

- `promptTokens`：输入给模型的 token
- `completionTokens`：模型输出的 token
- `totalTokens`：总 token

这些数据会被写入主库审计记录，便于按 `bookid`、日期、任务统计成本和性能。

---

## 15. 错误码

### 400 Bad Request

可能原因：

- 缺少 `X-Book-Id`
- `X-Book-Id` 不是有效账套
- 不是 `multipart/form-data`
- 文件字段缺失
- 上传了多个文件
- 上传了不支持的文件类型
- 文件超出 20MB
- 使用 JSON 创建任务

### 404 Not Found

可能原因：

- `bookid` 不存在
- `taskId` 不存在

### 500 Internal Server Error

可能原因：

- 保存任务失败
- 文件落盘失败
- 文件服务器异常
- OCR 异常
- AI 异常
- 主库审计写入失败

注意：

- 某些外部依赖失败不会导致整单直接失败
- 例如 file server 或 AI 异常时，系统仍尽量保留草稿和 warning

---

## 16. 典型调用示例

### 16.1 上传 PDF

```bash
curl -X POST 'http://localhost:8080/user/purchase-invoice/create' \
  -H 'X-Book-Id: efcf1e38-080b-45eb-be81-0fc22bf64444' \
  -F 'file=@/path/to/invoice.pdf;type=application/pdf'
```

### 16.2 上传图片

```bash
curl -X POST 'http://localhost:8080/user/purchase-invoice/create' \
  -H 'X-Book-Id: efcf1e38-080b-45eb-be81-0fc22bf64444' \
  -F 'file=@/path/to/invoice.jpg;type=image/jpeg'
```

### 16.3 查询状态

```bash
curl -X GET 'http://localhost:8080/user/purchase-invoice/create/status?taskId=ab17394d-3cad-42b5-a427-0843845f19ba' \
  -H 'X-Book-Id: efcf1e38-080b-45eb-be81-0fc22bf64444'
```

---

## 17. 前端建议

推荐前端按下面方式处理：

1. 用户上传后先展示任务卡片
2. 请求成功后立即拿到 `taskId`
3. 每隔 1-2 秒轮询状态接口
4. 看到 `queued` / `processing` / `ocrprocessing` / `aianalyzing` 时展示进度条
5. 看到 `completed` 时直接展示草稿
6. 看到 `completed_with_warnings` 时展示草稿，同时打上 `Warning` 标记

---

## 18. 实现备注

当前接口实现的关键点：

- 不是同步返回最终草稿
- 不是 JSON 提交接口
- 不是多文件批量上传接口
- 任务会落盘到本地 `uploads/purchase-invoice/tasks/<bookid>/`
- 状态查询直接读取任务文件
- 草稿会尽量自动回填 creditor 和 item 主档数据

---

## 19. 版本说明

当前文档对应的是现有真实实现：

- `POST /user/purchase-invoice/create`
- `GET /user/purchase-invoice/create/status`
- 不保留 `upload` 对外入口
