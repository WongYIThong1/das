# Purchase Invoice History API

`/user/purchase-invoice/history` 用来给前端做“跨设备历史列表”。
同一个 `X-Book-Id` 下，电脑 A 创建、OCR、分析、submit 的记录，电脑 B 也能直接看到。
历史索引持久化在主库 `root."PurchaseInvoiceHistory"`，不是内存态。
当前接口只返回最小字段：`type`、`id`、`bookId`、`groupId`、`taskId`、`status`、`createdAt`、`updatedAt`。

`/user/purchase-invoice/history/events` 用来给前端做实时更新。

## 1. 适用场景

- 查看当前 `bookId` 下所有 purchase invoice 的历史记录
- 从历史列表按 `taskId` / `groupId` 进入详情
- 多台电脑同时查看同一个 `bookId` 的进度
- 页面需要实时显示状态变化，不想一直轮询

## 2. 鉴权与上下文

所有接口都使用请求头：

```http
X-Book-Id: <book-id>
```

规则：

- 同一个 `bookId` 共享历史
- 不同 `bookId` 互相隔离
- 没有 `X-Book-Id` 返回 `400`
- `bookId` 不存在返回 `404`

## 3. 历史列表接口

### `GET /user/purchase-invoice/history`

返回当前 `bookId` 下的历史列表。

### Query 参数

- `page`: 页码，默认 `1`
- `pageSize`: 每页数量，默认 `20`，最大 `100`
- `type`: `all | group | task`，默认 `all`
- `status`: 按 `displayStatus` 过滤
- `q`: 模糊搜索，匹配 `taskId`、`groupId`、`submitTaskId`、`fileName`、`id`

### 返回结构

```json
{
  "total": 2,
  "page": 1,
  "pageSize": 20,
  "hasNext": false,
  "items": []
}
```

## 3.1 删除历史记录

### `DELETE /user/purchase-invoice/history?type=<task|group>&id=<id>`

软删除历史记录（只隐藏历史索引，不删除业务单据、不删除上传文件）。

- `type=task`：删除单个 task 历史
- `type=group`：删除 group 历史，并同时隐藏该 group 下关联 task 的历史索引

返回：

```json
{
  "success": true,
  "bookId": "efcf1e38-080b-45eb-be81-0fc22bf64444",
  "type": "task",
  "id": "e1a58d22-68ad-42e0-912b-09823889cc14"
}
```

### `historyItem` 字段

- `type`: `group` 或 `task`
- `id`: 当前条目的主 ID
- `bookId`: 当前 book
- `groupId`: group ID
- `taskId`: task ID
- `status`: 当前状态
- `createdAt`: 创建时间，固定不变，前端建议显示这个时间
- `updatedAt`: 最近更新时间

前端如果要跳转，直接使用 `groupId` 或 `taskId` 自己拼路由即可。

## 4. 状态定义

这个接口只返回后端计算后的统一状态字符串，前端不需要再展开状态映射。

## 5. SSE 实时接口

### `GET /user/purchase-invoice/history/events`

用于实时接收历史变更。

### Query 参数

- `page`
- `pageSize`
- `type`
- `status`
- `q`

这些参数和历史列表一致。

### SSE 行为

连接后会先推送一条快照：

```text
event: history
data: {"eventType":"snapshot",...}
```

之后如果历史发生变化，会推送：

- `eventType=upsert`
- `eventType=delete`

另外每 15 秒会推送一次：

- `event: ping`

### SSE 事件示例

```text
event: history
data: {"eventType":"snapshot","bookId":"...","at":"...","items":[...]}

event: history
data: {"eventType":"upsert","bookId":"...","at":"...","item":{"type":"task","id":"...","groupId":"...","taskId":"...","status":"...","createdAt":"...","updatedAt":"..."}}

event: history
data: {"eventType":"delete","bookId":"...","at":"...","type":"task","id":"..."}

event: ping
data: {"eventType":"ping","bookId":"...","at":"..."}
```

## 6. 前端接法建议

### 历史页

- 首次进入先 `GET /user/purchase-invoice/history`
- 再连 `GET /user/purchase-invoice/history/events`
- 如果 SSE 断线，先重新 GET 一次 history，再重新接 SSE

### 跳转

- `type=group` 的记录跳转到 group 详情
- `type=task` 的记录跳转到 task 详情

### 推荐展示

- `uploading`
- `analyzing`
- `ready`
- `submitting`
- `submitted`
- `failed`

## 7. 注意事项

- 这个接口是“历史视图”，不是 OCR 原始结果接口
- 不会返回 `ocrRaw`、`aiUsage`、`diagnostics`、`storedPath`
- 历史索引存储在主库 `root."PurchaseInvoiceHistory"`
- 服务重启后历史列表仍可查
- 当前实现按 `X-Book-Id` 隔离，不同 bookid 不会互相看到

## 8. 示例

### 列表

```bash
curl -sS \
  -H 'X-Book-Id: efcf1e38-080b-45eb-be81-0fc22bf64444' \
  'http://127.0.0.1:8080/user/purchase-invoice/history?page=1&pageSize=20'
```

### SSE

```bash
curl -N \
  -H 'X-Book-Id: efcf1e38-080b-45eb-be81-0fc22bf64444' \
  'http://127.0.0.1:8080/user/purchase-invoice/history/events?page=1&pageSize=20'
```

### 删除

```bash
curl -X DELETE -sS \
  -H 'X-Book-Id: efcf1e38-080b-45eb-be81-0fc22bf64444' \
  'http://127.0.0.1:8080/user/purchase-invoice/history?type=task&id=e1a58d22-68ad-42e0-912b-09823889cc14'
```
