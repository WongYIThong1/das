# Purchase Invoice Submit Frontend Guide

这份文档只给前端使用，目标是让前端在完成 preview 确认后，正确调用：

- `POST /purchase-invoice/submit`
- `GET /purchase-invoice/submit/{taskId}`

这个接口和 `POST /purchase-invoice/create` 不一样：

- `/purchase-invoice/create`
  - 上传 invoice
  - AI 解析
  - 自动匹配主数据
  - 返回给前端确认
- `/purchase-invoice/submit`
  - 创建一个异步 submit task
  - 后台执行缺失 `Stock` / `Creditor` / `Purchase Invoice` 编排
  - 前端通过 `taskId` 轮询最终状态

## 什么时候调用

推荐前端流程固定为：

1. 用户上传文件，调用 `/purchase-invoice/create`
2. 前端展示 `payload + matches + warnings`
3. 用户确认并修正字段
4. 前端组装最终提交数据
5. 调用 `POST /purchase-invoice/submit`
6. 轮询 `GET /purchase-invoice/submit/{taskId}`

也就是说：

- `/create` 是预解析
- `/submit` 是真正创建的异步任务入口

## 最重要的一点

`/purchase-invoice/submit` 必须带：

- `previewTaskId`

这个值必须来自上一轮 preview：

- `POST /purchase-invoice/create` 返回的 `taskId`

或者你轮询：

- `GET /purchase-invoice/create/{taskId}`

时对应的同一个 task。

如果前端漏传 `previewTaskId`，后端会直接返回：

```json
{
  "error": "missing previewTaskId"
}
```

这时 submit 会在最前面就失败，不会继续做：

- 本地规则校验
- AI 审核
- stock create
- creditor create
- purchase invoice create

## 认证

这个接口必须登录后调用，和其他前端业务接口一样：

- 已登录
- 带 `app_session` cookie
- `credentials: "include"`

示例：

```js
const res = await fetch("/purchase-invoice/submit", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
});
```

前端不需要传 `bookId`。

后端会自动使用当前登录用户绑定的：

- `bookId`
- `company`

## 第一步响应

`POST /purchase-invoice/submit` 成功时不再同步返回最终创建结果，而是返回：

```json
{
  "taskId": "uuid",
  "requestId": "submit-20260308-0001",
  "previewTaskId": "preview-task-uuid",
  "status": "queued"
}
```

状态码：

- `202 Accepted`

## 第二步轮询状态

- `GET /purchase-invoice/submit/{taskId}`

返回结构示例：

```json
{
  "taskId": "uuid",
  "requestId": "submit-20260308-0001",
  "previewTaskId": "preview-task-uuid",
  "status": "validating",
  "message": "validating submit payload",
  "result": {
    "requestId": "submit-20260308-0001",
    "previewTaskId": "preview-task-uuid",
    "bookId": "4c892050-45a7-4c82-840d-12af91f5312d",
    "company": "Antsdemo",
    "finalPayload": {},
    "stockCreates": []
  }
}
```

当前 submit task 固定使用这 6 个状态：

- `queued`
- `preparing`
- `validating`
- `dispatching`
- `succeeded`
- `failed`

前端建议显示：

- `queued`：任务已创建
- `preparing`：正在准备提交数据
- `validating`：正在校验提交内容
- `dispatching`：正在执行下游创建
- `succeeded`：创建成功
- `failed`：创建失败

## 请求结构

请求体固定分成 4 部分：

- `requestId`
- `previewTaskId`
- `payload`
- `createMissing`

### `payload.externalLink`

`rules.md/create.md` 要求下游创建 PI 时 `payload.externalLink` 必须非空（用于写入 PI/APInvoice 的 ExternalLink 字段）。  
但浏览器上传拿不到用户机器上的真实文件路径，所以当前后端会自动补一个稳定占位值：

- `upload:{previewTaskId}:{originalFileName}`

如果 preview 阶段配置了 FileServer 并成功上传，后端会优先使用 preview 返回的：

- `result.payload.externalLink`（FileServer 的 `downloadUrl`）

同时 submit 会在执行前向 FileServer 查询一次状态：

- `pending/scanning/ready`：允许提交
- `infected/scan_error`：直接阻止提交（返回 400）

因此前端暂时不需要自己传 `externalLink`（即使不传，后端也会自动填充/选用 FileServer link）。

示例：

```json
{
  "requestId": "submit-20260308-0001",
  "previewTaskId": "preview-task-uuid",
  "payload": {
    "creditorCode": "",
    "purchaseAgent": "JULIANWG",
    "supplierInvoiceNo": "INV-001",
    "docDate": "2026-03-08",
    "currencyCode": "MYR",
    "currencyRate": 1,
    "displayTerm": "C.O.D.",
    "purchaseLocation": "HQ",
    "description": "PURCHASE INVOICE",
    "details": [
      {
        "itemCode": "",
        "description": "MICROSOFT OFFICE 365 FAMILY (ESD POCKET)",
        "desc2": "",
        "qty": 2,
        "unitPrice": 335,
        "amount": 670,
        "uom": "UNIT",
        "taxCode": "MYSST8",
        "accNo": "610-0000",
        "itemGroup": "O365"
      }
    ]
  },
  "createMissing": {
    "creditor": {
      "enabled": true,
      "payload": {
        "code": "400-G001",
        "companyName": "GREX MULTIMEDIA SDN BHD",
        "currency": "MYR",
        "type": "TRD",
        "phone": "03-12345678",
        "area": "",
        "agent": "JULIANWG",
        "active": true
      }
    },
    "items": [
      {
        "line": 1,
        "enabled": true,
        "payload": {
          "itemCode": "O365FAMILY",
          "description": "MICROSOFT OFFICE 365 FAMILY (ESD POCKET)",
          "itemGroup": "O365",
          "itemType": "",
          "salesUom": "UNIT",
          "purchaseUom": "UNIT",
          "reportUom": "UNIT",
          "stockControl": false,
          "hasSerialNo": false,
          "hasBatchNo": false,
          "isActive": true,
          "taxCode": "",
          "purchaseTaxCode": ""
        }
      }
    ]
  }
}
```

## `payload` 怎么来

`payload` 应该来自 preview 结果里的：

- `response.payload`

`previewTaskId` 也必须来自 preview 结果里的：

- `taskId`

前端再允许用户对这些字段做修正：

- `creditorCode`
- `purchaseAgent`
- `supplierInvoiceNo`
- `docDate`
- `currencyCode`
- `displayTerm`
- `purchaseLocation`
- `description`
- `details[].itemCode`
- `details[].description`
- `details[].desc2`
- `details[].qty`
- `details[].unitPrice`
- `details[].amount`
- `details[].uom`
- `details[].taxCode`
- `details[].accNo`
- `details[].itemGroup`

最终提交时，前端要发送：

- `previewTaskId`
- 最终确认版的 `payload`
- `createMissing`

不是把原始 preview 响应整包直接发回去。

## 最小正确 submit 示例

```json
{
  "requestId": "submit-20260309043036-64bd2ceb",
  "previewTaskId": "250c5b39-5531-4e64-a9f9-f714938c59e8",
  "payload": {
    "creditorCode": "400-F001",
    "purchaseAgent": "",
    "supplierInvoiceNo": "84726",
    "docDate": "2022-06-22",
    "currencyCode": "SGD",
    "currencyRate": 1,
    "displayTerm": "C.O.D.",
    "purchaseLocation": "HQ",
    "description": "PURCHASE INVOICE",
    "details": [
      {
        "itemCode": "KM-LOGITECH-Y1006",
        "description": "LOGITECH M590 GRAP BLUETOOTH & UNIFIED MOUSE",
        "desc2": "",
        "qty": 1,
        "unitPrice": 57,
        "amount": 57,
        "uom": "UNIT",
        "taxCode": "MYSST8",
        "accNo": "610-0000",
        "itemGroup": "KEY-MOUS"
      }
    ]
  },
  "createMissing": {
    "items": []
  }
}
```

## 前端最容易犯的错误

- 漏传 `previewTaskId`
- 使用了旧的或错误账套的 `previewTaskId`
- preview 还没 `succeeded` 就直接 submit
- 只把 `payload` 发回去，没有带 `createMissing`

## Submit 前会做的严格校验

`/purchase-invoice/submit` 不会直接把前端数据原样发给客户端。

在真正派发 `stock / creditor / purchase invoice create` 之前，后端会先按当前账套的本地规则做一轮严格校验。很多以前会在客户端或 AutoCount 里失败的情况，现在会更早在 submit 阶段直接返回 `400`。

现在 submit 还会额外做一层 AI 审核：

- 后端会用 `previewTaskId` 回查 preview 阶段的 `extracted`
- 再把“最终提交版 payload”和 preview 结果做一致性审核
- 如果 AI 认为提交内容和原发票明显不一致，也会直接 `400`

### Header 规则

后端当前会校验：

- `creditorCode`
  - 如果有值，长度必须 `<= 12`
- `displayTerm`
  - 必填
  - 长度必须 `<= 30`
  - 必须是当前账套里已经存在的有效值
- `purchaseLocation`
  - 必填
  - 长度必须 `<= 8`
  - 必须是当前账套里已经存在的有效值
- `currencyCode`
  - 必填
  - 长度必须 `<= 5`
  - 必须是当前账套里已经存在的有效值
- `description`
  - 必填
  - 长度必须 `<= 80`
- `supplierInvoiceNo`
  - 必填
  - 长度必须 `<= 30`
  - 会先在本地账套里查重，重复会直接失败
- `docDate`
  - 必须是 `yyyy-MM-dd`

### Detail 规则

每条 `details[]` 当前会校验：

- 至少要有 1 行
- `qty > 0`
- `unitPrice >= 0`
- `uom`
  - 必填
  - 长度必须 `<= 8`
- `taxCode`
  - 允许为空
  - 如果有值，长度必须 `<= 14`
  - 如果有值，必须是当前账套里已经存在的有效税码
- `accNo`
  - 必填
  - 长度必须 `<= 12`
  - 必须是当前账套里已经存在的有效科目
- `description`
  - 必填
  - 长度必须 `<= 100`
- `itemCode`
  - 如果有值，长度必须 `<= 30`

## 后端会自动补什么

submit 阶段不是完全死板校验。当前后端会先尝试自动补这几类字段：

- `accNo`
  - 优先按 `同供应商 + 同 itemCode` 的历史明细推最常用值
  - 推不到再按 `全局该 itemCode` 的历史推
- `taxCode`
  - 优先按 `同供应商 + 同 itemCode` 的历史明细推最常用值
  - 推不到再按 `全局该 itemCode` 的历史推
  - 如果还是推不到，会继续保持空，不会再强制补默认税码
- `description`
  - 顶层如果为空，会自动补成 `PURCHASE INVOICE`
  - 明细如果为空，会优先用 `item` 主数据描述，再回退到 AI 提取值
- `purchaseLocation`
  - 如果为空或不合法，会先尝试收口成短代码；仍不合法时回退 `HQ`
- `displayTerm`
  - 如果为空，会先回退到 `C.O.D.`
- `currencyCode`
  - 如果为空，会先回退到 `MYR`
- `description`
  - 顶层永远固定成 `PURCHASE INVOICE`
  - 前端传别的值也不会被保留

但要注意：

- 自动补值后，仍然会再走一次“必须存在于当前账套已知值集合”的校验
- 如果补完还是不合法，submit 一样会直接失败

## 什么情况下会直接 400

前端常见会遇到这些 submit 阶段错误：

- `supplierInvoiceNo already exists`
- `displayTerm does not exist in current accountbook`
- `purchaseLocation does not exist in current accountbook`
- `currencyCode does not exist in current accountbook`
- `details[0].taxCode does not exist in current accountbook`
- `details[0].accNo is required`
- `details[0].accNo does not exist in current accountbook`
- `details[0].description is too long`

所以前端最稳的做法不是“先 submit 再看客户端报错”，而是：

1. 先展示 preview 结果
2. 让用户补齐 warning 和缺失字段
3. 再提交最终 payload

## `createMissing` 什么时候要带

只有在主数据缺失时才需要带。

### 1. `creditorCode` 为空

说明当前账套没有现成 creditor 可直接用。

这时前端必须：

- 要么让用户手动选一个已有 creditor，并把 `payload.creditorCode` 填好
- 要么提供 `createMissing.creditor`

如果：

- `payload.creditorCode == ""`
- 且没有 `createMissing.creditor.enabled = true`

后端会直接拒绝 submit。

### 2. 某行 `itemCode` 为空

说明当前账套没有现成 item 可直接用。

这时前端必须：

- 要么让用户手动选一个已有 item，并把 `payload.details[i].itemCode` 填好
- 要么在 `createMissing.items[]` 里给这一行提供新 item 的创建信息

`createMissing.items[].line` 必须是：

- 1-based 行号

也就是：

- 第一行是 `1`
- 第二行是 `2`

## 前端建议规则

### 可以直接 submit 的情况

- `creditorCode` 已有值
- 每行 `itemCode` 都已有值
- 必填字段齐全
- 没有需要用户确认的关键 warning

这时 `createMissing` 可以为空：

```json
{
  "requestId": "submit-xxx",
  "payload": { ... },
  "createMissing": {}
}
```

### 需要先建 creditor 的情况

如果 preview 后：

- `payload.creditorCode == ""`

前端就要把“用户确认后的新 creditor 信息”放进：

- `createMissing.creditor.payload`

### 需要先建 stock 的情况

如果某条明细：

- `itemCode == ""`

前端就要给这一行放一个：

- `createMissing.items[]`

推荐默认策略：

- 默认使用 preview 返回的 `matches.items[i].proposedNewItem`
- 只有当用户明确改选现有 item 时，才不传这一行的 `createMissing.items[]`

通常这份数据可以来自前端已经展示给用户确认过的：

- AI 建议 item
- itemGroup
- uom

更推荐直接映射 preview 返回的：

- `itemCodeSuggestion` -> `createMissing.items[].payload.itemCode`
- `description` -> `createMissing.items[].payload.description`
- `itemGroup` -> `createMissing.items[].payload.itemGroup`
- `itemType` -> `createMissing.items[].payload.itemType`
- `salesUom` -> `createMissing.items[].payload.salesUom`
- `purchaseUom` -> `createMissing.items[].payload.purchaseUom`
- `reportUom` -> `createMissing.items[].payload.reportUom`
- `stockControl` -> `createMissing.items[].payload.stockControl`
- `hasSerialNo` -> `createMissing.items[].payload.hasSerialNo`
- `hasBatchNo` -> `createMissing.items[].payload.hasBatchNo`
- `active` -> `createMissing.items[].payload.isActive`
- `taxCode` -> `createMissing.items[].payload.taxCode`
- `purchaseTaxCode` -> `createMissing.items[].payload.purchaseTaxCode`

## 后端实际执行顺序

后端固定按这个顺序：

1. 校验请求
2. 创建缺失的 `Stock`
3. 创建缺失的 `Creditor`
4. 创建 `Purchase Invoice`

重要说明：

- 后端不会自动创建 `Agent`
- 后端不会自动创建 `ItemGroup`
- 后端不会自动创建 `UOM`
- 后端不会在没有 `createMissing.items[]` 的情况下自动拿 preview 的建议去建 item

这三类如果不存在，submit 会失败。

## 响应结构

成功或失败时，后端都会返回一个结构化结果：

```json
{
  "success": false,
  "requestId": "submit-20260308-0001",
  "bookId": "4c892050-45a7-4c82-840d-12af91f5312d",
  "company": "Antsdemo",
  "message": "creditor created but purchase invoice failed",
  "finalPayload": {
    "...": "..."
  },
  "stockCreates": [
    {
      "kind": "stock",
      "requestId": "submit-20260308-0001:stock:O365FAMILY",
      "statusCode": 201,
      "success": true,
      "message": "stock item created",
      "response": {
        "...": "..."
      }
    }
  ],
  "creditorCreate": {
    "kind": "creditor",
    "requestId": "submit-20260308-0001:creditor",
    "statusCode": 201,
    "success": true,
    "message": "creditor created",
    "response": {
      "...": "..."
    }
  },
  "purchaseInvoice": {
    "kind": "purchaseInvoice",
    "requestId": "submit-20260308-0001:pi",
    "statusCode": 400,
    "success": false,
    "message": "missing purchase invoice header fields",
    "response": {
      "...": "..."
    }
  }
}
```

## 前端如何处理响应

### `201 Created`

代表整条链路成功：

- 缺失 stock 已创建
- 缺失 creditor 已创建
- PI 已创建

前端应该：

- 显示成功提示
- 显示 PI 创建结果
- 可选择跳转列表页或详情页

### `400 Bad Request`

代表 submit 最终失败。

但要注意：

- 失败不代表前面的 stock / creditor 没建成功

前端一定要检查：

- `stockCreates`
- `creditorCreate`
- `purchaseInvoice`
- `validation`

如果前两步已经成功，应该明确提示用户：

- “主数据已创建，但 Purchase Invoice 创建失败”

### `202 Accepted`

代表某个创建步骤已派发，但在等待窗口内还没拿到最终结果。

前端建议：

- 显示“正在处理”
- 允许用户稍后重试同一个 `requestId`

## 前端需要自己保证的事

### 1. `requestId` 要稳定且唯一

建议每次用户点击 submit 时生成一个新的 `requestId`。

如果前端因为网络问题重试同一次提交，应该复用同一个 `requestId`，这样后端才能做幂等。

### 1.5 `previewTaskId` 必须带回

- submit 必须带 preview 阶段返回的 `taskId`
- 不允许只拿 `payload` 单独 submit
- 如果 preview task 过期、跨账套、或不属于当前用户，后端会直接拒绝

### 2. 行号不要乱

`createMissing.items[].line` 必须和 `payload.details[]` 当前排序一致。

如果前端支持拖拽重排行，提交前必须重新生成正确的 `line`。

### 3. 不要把 preview 原始 warning 当成后端输入

后端 submit 只看：

- 最终 `payload`
- `createMissing`

前端自己要先把 preview 阶段的：

- `warnings`
- `matches`

转成最终用户确认结果，再提交。

## 推荐前端实现

建议前端把 preview 页面拆成两步：

### Step 1: Confirm

用户确认：

- creditor
- agent
- header fields
- item 明细

### Step 2: Submit

点击 submit 前，把页面状态转换成：

- `payload`
- `createMissing`

然后再调：

- `/purchase-invoice/submit`

## 常见错误

### `purchaseAgent does not exist`

表示：

- 你传了 `payload.purchaseAgent`
- 但账套里没有这个 agent

解决：

- 前端必须改成已有 agent
- 或者清空它

### `missing createMissing.items for line X`

表示：

- 某一行没有 `itemCode`
- 但你也没给它新建 stock 的信息

### `itemGroup does not exist`

表示：

- 你准备新建 stock
- 但所选 `itemGroup` 在当前账套不存在

### `createMissing.items line X itemGroup does not exist`

表示：

- 你提交的新 item 创建信息里
- `payload.itemGroup` 在当前账套不存在

### `createMissing.items line X contains invalid uom`

表示：

- 你提交的新 item 创建信息里
- `salesUom / purchaseUom / reportUom` 至少有一个不是当前账套可识别的 UOM

### `missing creditor create instruction`

表示：

- `creditorCode` 是空
- 但你没有提供 `createMissing.creditor`

### `previewTaskId is invalid or expired`

表示：

- preview task 不存在
- 或已经过期
- 或不属于当前用户/账套

### `validation.aiIssues` (AI 警告，不拦截)

说明：

- 后端会用 preview 阶段的发票提取结果做一致性审核
- 这些审核结果只作为 **warnings** 返回给前端展示
- **不会** 因为 AI 警告而阻断 submit

前端应：

- 把 `validation.aiIssues` 展示给用户（例如 “需要确认” 提示）
- 允许用户继续提交（真正失败会来自规则校验或下游 create 返回）

## 总结

前端可以把这条 submit 接口理解成：

- “提交最终确认后的 PI”
- “如果用户确认要新建缺失主数据，就顺便一起做”

真正重要的是：

- `payload` 永远是最终确认版
- `createMissing` 只负责补齐缺失的 `Stock/Creditor`
- `Agent/ItemGroup/UOM` 不会自动创建
