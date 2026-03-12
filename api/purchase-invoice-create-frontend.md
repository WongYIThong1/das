# Purchase Invoice Create Frontend Guide

这份文档只给前端使用，说明现在应该如何接：

- 上传 invoice 文件
- 创建异步 preview task
- 轮询 task 状态
- 展示 AI 解析结果

当前 `/purchase-invoice/create` **不会同步直接返回 preview 结果**。

## 你要调的接口

1. `POST /purchase-invoice/create`
2. `GET /purchase-invoice/create/{taskId}`
3. `POST /purchase-invoice/create/{taskId}/cancel`

都要求：

- 已登录
- 带 `app_session` cookie
- `credentials: "include"`

## 推荐前端流程

建议页面固定成 5 步：

1. 用户选择 PDF / 图片
2. 前端调用 `POST /purchase-invoice/create`
3. 后端返回 `taskId`
4. 前端轮询 `GET /purchase-invoice/create/{taskId}`
5. 成功后用 `result.payload` 填表单

## Step 1: 创建 task

```js
async function createPurchaseInvoicePreviewTask(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/purchase-invoice/create", {
    method: "POST",
    body: formData,
    credentials: "include"
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || "preview task create failed");
  }

  return body;
}
```

成功返回：

```json
{
  "taskId": "uuid",
  "status": "queued"
}
```

注意：

- 当前后端要求配置 `FILESERVER_BASE_URL`，否则会直接报错（因为 submit 需要 URL 形式的 `externalLink`）。

## Step 2: 轮询 task

```js
async function getPurchaseInvoicePreviewTask(taskId) {
  const res = await fetch(`/purchase-invoice/create/${taskId}`, {
    method: "GET",
    credentials: "include"
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || "preview task query failed");
  }

  return body;
}

async function waitForPurchaseInvoicePreview(taskId, {
  interval = 1500,
  timeout = 120000
} = {}) {
  const startedAt = Date.now();

  while (true) {
    const task = await getPurchaseInvoicePreviewTask(taskId);

    // 即使 OCR 还没完成，后端也会尽早返回 FileServer 外链（externalLink/file），前端可以先展示下载按钮。
    // if (task.externalLink) showDownload(task.externalLink)

    if (task.status === "succeeded") {
      return task.result;
    }

    if (task.status === "failed") {
      throw new Error(task.error || "preview failed");
    }

    if (Date.now() - startedAt > timeout) {
      throw new Error("preview timeout");
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
```

## 建议的前端状态

建议至少有这些状态：

- `idle`
- `uploading`
- `queued`
- `ocr-processing`
- `analyzing`
- `preview-ready`
- `preview-error`
- `preview-canceled`

状态映射：

- `queued` -> 显示“任务已创建”
- `ocr_processing` -> 显示“OCR 处理中”
- `analyzing` -> 显示“AI 分析中”
- `succeeded` -> 进入确认表单
- `failed` -> 显示错误并允许重传
- `canceled` -> 显示“已取消”

## Cancel

用户点击取消时：

- `POST /purchase-invoice/create/${taskId}/cancel`
- 取消后前端应停止轮询，并提示用户可以重新上传

## 成功结果怎么用

轮询成功后，你拿到的是：

- `result.payload`
- `result.matches`
- `result.warnings`
- `result.extracted`

### `payload`

前端主表单直接用它。

顶层字段：

- `creditorCode`
- `purchaseAgent`
- `supplierInvoiceNo`
- `externalLink`
- `docDate`
- `currencyCode`
- `currencyRate`
- `displayTerm`
- `purchaseLocation`
- `description`
- `creditorAddressLines`
- `details[]`

每条 `details[]`：

- `itemCode`
- `description`
- `desc2`
- `qty`
- `unitPrice`
- `amount`
- `uom`
- `taxCode`
- `accNo`
- `itemGroup`

### `externalLink` (FileServer 下载链接)

如果后端配置了 `FILESERVER_BASE_URL`，preview 阶段会在 OCR 进行时把原文件上传到 FileServer，并把永久下载链接写到：

- `result.payload.externalLink`

前端建议：

- 在预览页直接展示这个链接（用户可下载原始发票文件）
- submit 时把 `payload` 原样提交即可（后端也会兜底补齐 externalLink）

### `matches`

这是前端 review 的关键。

每个匹配结果现在都有：

- `status`
- `confidence`
- `extractedValue`
- `reason`
- `candidate`
- `topCandidates`

你应该优先显示：

- `matches.creditor`
- `matches.agent`
- `matches.items[]`

### `warnings`

前端用它决定：

- 哪些字段必须高亮
- 哪些字段不能直接提交到 `/purchase-invoice/submit`

## Match 状态怎么处理

### `matched`

- 可以直接用 `payload` 当前值
- 正常显示

### `review`

- `payload` 里可能已经有建议值
- 前端必须高亮
- 应显示 `topCandidates`
- 应要求用户确认

### `unmatched`

- `payload` 里通常没有可直接提交的 `itemCode`
- 前端必须要求用户做明确决策
- 默认主路径应该是“建议新建 item”
- 若 `topCandidates` 不为空，应允许用户改成直接选现有 item

## 候选展示建议

### Creditor

建议展示：

- `matches.creditor.extractedValue`
- `matches.creditor.candidate`
- `matches.creditor.topCandidates`

### Agent

重点是：

- 如果 OCR 提取到 `CELINE`
- 但本地没有 `CELINE`
- 当前后端会返回：
  - `extractedValue = "CELINE"`
  - `candidate = null`
  - `topCandidates = []` 或少量高分候选

也就是说：

- 前端不要把低分假候选当成真实 agent
- 如果 `candidate = null`，就让用户自己选或留空

### Item

每一行建议显示：

- `matches.items[i].extractedValue`
- `matches.items[i].candidate`
- `matches.items[i].topCandidates`
- `matches.items[i].reason`

如果 `item` 没匹配到，后端会带：

- `proposedNewItem`

前端应该直接把它做成“建议新建 item”的默认卡片。

`proposedNewItem` 现在尽量接近 `stock create` 的形状：

- `itemCodeSuggestion`
- `description`
- `desc2`
- `itemGroup`
- `baseUom`
- `salesUom`
- `purchaseUom`
- `reportUom`
- `itemType`
- `stockControl`
- `hasSerialNo`
- `hasBatchNo`
- `active`
- `taxCode`
- `purchaseTaxCode`

推荐前端行为：

1. 默认选中“建议新建 item”
2. 允许用户改成“选择现有 item”
3. 如果用户选择现有 item：
   - 把 `payload.details[i].itemCode` 改成现有 code
   - 不要提交这一行的 `createMissing.items[]`
4. 如果用户保留“建议新建 item”：
   - 保留 `payload.details[i].itemCode = ""`
   - submit 时必须生成对应的 `createMissing.items[]`

## 当前后端自动填充规则

### Creditor

- 高置信度命中会自动填 `payload.creditorCode`
- `review/unmatched` 不会强行填 code

### Agent

- 只根据 OCR 提取的人名做匹配
- 没匹配到就留空
- 不再用供应商默认 agent 去顶替

### Item

- 高置信度命中时会回填：
  - `itemCode`
  - `itemGroup`
  - `description`
  - `uom`
- `qty / unitPrice / amount` 继续保留发票值
- 未匹配时不会硬猜 `itemCode`
- 未匹配时会返回一份尽量填满的 `proposedNewItem`

### Tax / AccNo

- 后端会先按历史尝试推断
- `taxCode` 在 preview 阶段可能保持空值
- submit 阶段允许空 `taxCode` 直接透传；如果前端手动填写了非空值，则必须是账套里的合法税码
- `accNo` 仍会在 submit 前继续校验

## 推荐的提交阻断规则

在前端进入 `/purchase-invoice/submit` 前，建议阻断：

- `missing_invoice_number`
- `missing_invoice_date`
- `missing_items`
- `creditor_not_matched`
- `item_not_matched`

说明：

- `item_not_matched` 不代表必须报错
- 它代表前端必须先做下面两者之一：
  - 选现有 item
  - 确认建议新 item，并准备 `createMissing.items[]`

建议强提醒但允许继续编辑：

- `creditor_needs_review`
- `agent_needs_review`
- `item_needs_review`

## 常见错误

### `400`

- 没传 `file`
- 文件类型不支持
- 文件过大

### `401`

- 登录态失效

### `404`

- `taskId` 不存在
- 当前用户无权访问这个 task

### `500`

- OCR 服务失败
- AI 分析失败
- 后端内部异常

## 你不需要做的事

前端现在不需要：

- 自己做 OCR
- 自己把 1000+ 主数据发给模型做匹配
- 自己决定 `bookId`
- 自己刷新 token

这些都由后端完成。
