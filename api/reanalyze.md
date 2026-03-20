# Purchase Invoice Reanalyze API

`reanalyze` 用于对已经完成的采购发票任务重新跑一轮 `OCR + AI`，重新生成草稿结果。

这个接口适合这些场景：

- OCR 结果有误，需要重新识别
- AI 草稿规则更新后，想复用同一份原文件重跑
- 用户手动修正后，希望重新生成匹配结果

注意：

- `reanalyze` 只重跑 `OCR + AI`
- 不会重新上传 fileserver
- 不会重新生成原文件外链
- 会继续复用原来的 `externalLink`

---

## 1. 支持的接口

### 单个 task 重新分析

`POST /user/purchase-invoice/task/{taskId}/reanalyze`

### batch item 重新分析

`POST /user/purchase-invoice/group/item/{itemId}/reanalyze`

两者逻辑一致，区别只是路由入口不同：

- task 入口直接按 `taskId` 重跑
- batch 入口先定位 `itemId`，再找到对应 `taskId` 重跑

---

## 2. 请求头

所有 reanalyze 接口都需要：

- `X-Book-Id: <bookid>`

说明：

- reanalyze 只能在当前 `bookid` 范围内查找任务
- 如果 `bookid` 不匹配，会当作找不到任务处理

---

## 3. 允许触发的状态

reanalyze 只允许已结束任务触发。

允许的分析状态：

- `completed`
- `completed_with_warnings`
- `failed`

不允许的状态：

- `queued`
- `processing`
- `fileserver_uploading`
- `ocrprocessing`
- `aianalyzing`
- `reanalyze_queued`
- `reanalyzing`

如果任务还在处理中，会返回冲突。

---

## 4. 与 submit 的关系

如果任务已经提交，或正在提交，reanalyze 会被阻止。

阻止条件：

- task 已经 `submitted`
- task submit 正在进行
- batch item 已经 `submitted`
- batch item submit 正在进行

返回结果：

- 已提交：`409 Conflict`
- 提交进行中：`409 Conflict`

这个限制是为了避免同一份草稿在提交后又被重新分析，造成数据覆盖。

---

## 5. 重跑行为

reanalyze 的执行流程：

1. 校验 `X-Book-Id`
2. 校验 task / item 是否存在
3. 校验 submit 状态是否允许
4. 把任务状态改成 `reanalyze_queued`
5. 进入队列重新执行
6. worker 重跑 `OCR + AI`
7. 输出的新结果覆盖原 task 的草稿数据

重跑时会保留：

- 原始文件本体
- 原始 fileserver link
- 原始上传记录

重跑时会更新：

- `draft`
- `warnings`
- `diagnostics`
- `aiUsage`
- `status`
- `lastReanalyzeRequestedAt`
- `lastReanalyzedAt`

---

## 6. 状态流转

reanalyze 会使用下面两个状态：

| 状态 | 说明 |
|---|---|
| `reanalyze_queued` | 已进入重新分析队列 |
| `reanalyzing` | 正在执行重新分析 |

完成后会回到：

- `completed`
- `completed_with_warnings`
- `failed`

如果是 batch item，相关的 `analysisStatus` 也会同步反映这个变化。

---

## 7. 成功返回

### 7.1 task reanalyze

```json
{
  "success": true,
  "taskId": "uuid",
  "groupId": "uuid",
  "itemId": "uuid",
  "status": "reanalyze_queued"
}
```

### 7.2 batch item reanalyze

```json
{
  "success": true,
  "groupId": "uuid",
  "itemId": "uuid",
  "taskId": "uuid",
  "status": "reanalyze_queued"
}
```

---

## 8. 失败返回

### 8.1 任务不存在

`404 Not Found`

```text
task not found
```

### 8.2 任务不允许 reanalyze

`409 Conflict`

```text
task not ready for reanalyze
```

### 8.3 已提交任务

`409 Conflict`

```text
submitted task cannot be reanalyzed
```

### 8.4 提交中任务

`409 Conflict`

```text
task submit in progress
```

---

## 9. 前端建议

前端展示时可以按下面规则处理：

- `reanalyze_queued` 显示为“重新分析中”
- `reanalyzing` 显示为“重新分析中”
- 只要进入 reanalyze，就要把原本的分析结果视为“可被新结果覆盖”
- 如果任务已经 `submitted`，前端不要再给 reanalyze 按钮

对于 batch item：

- item 层可以单独 reanalyze
- group 层不需要额外新接口
- 重新分析完成后，建议重新拉 `batch/group` 或 `batch/item` 以更新状态

---

## 10. 相关文档

- [`create.md`](./create.md)
- [`batch.md`](./batch.md)
- [`submit.md`](./submit.md)

