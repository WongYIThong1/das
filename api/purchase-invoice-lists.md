# Purchase Invoice Lists API

本文档描述采购发票列表接口：

- `GET /purchase-invoice/lists`

这个接口给前端列表页使用，用于分页读取当前登录用户所属账套的采购发票数据。

## 1. 功能说明

这个接口会自动根据当前登录用户的会话，判断用户绑定的是哪个：

- `bookId`
- `company`

然后后端只读取该公司的本地 SQLite 数据库：

- `/data/{company}/{company}.db`

客户端不需要也不能自己传 `bookId`，这样可以避免串账。

## 2. 认证要求

该接口是受保护接口，必须已登录。

要求：

- 浏览器自动带上 `app_session` Cookie
- 后端通过现有认证中间件校验登录态
- 后端自动刷新 session
- 后端自动根据当前 profile 选择对应公司库

如果未登录，会返回：

```json
{
  "error": "unauthorized"
}
```

## 3. 请求方式

### Method

`GET`

### URL

```text
/purchase-invoice/lists
```

### Query 参数

- `page`
  - 可选
  - 默认 `1`
  - 必须大于等于 `1`
- `pageSize`
  - 可选
  - 默认 `20`
  - 最大 `100`
- `sortBy`
  - 可选
  - 支持字段：
    - `supplier`
    - `agent`
    - `currency`
    - `date`
    - `grandTotal`
    - `amount`
    - `invoiceNo`
- `sortOrder`
  - 可选
  - 支持：
    - `asc`
    - `desc`
  - 默认 `desc`
- `search`
  - 可选
  - 关键字搜索
  - 会匹配多个字段
- `dateFrom`
  - 可选
  - 格式：`YYYY-MM-DD`
- `dateTo`
  - 可选
  - 格式：`YYYY-MM-DD`
- `supplier`
  - 可选
  - 按供应商名称模糊筛选
- `grandTotalMin`
  - 可选
  - 按总金额最小值筛选
- `grandTotalMax`
  - 可选
  - 按总金额最大值筛选

### 示例

```text
GET /purchase-invoice/lists?page=1&pageSize=20
```

```text
GET /purchase-invoice/lists?page=1&pageSize=20&sortBy=supplier&sortOrder=asc
```

```text
GET /purchase-invoice/lists?page=1&pageSize=20&search=AUTO COUNT
```

```text
GET /purchase-invoice/lists?page=1&pageSize=20&dateFrom=2026-03-01&dateTo=2026-03-31&supplier=AUTO&grandTotalMin=1&grandTotalMax=10
```

## 4. 排序规则

返回结果固定按最新优先排序。

后端排序逻辑：

```sql
order by coalesce(LastModified, CreatedTimeStamp, DocDate) desc, DocKey desc
```

也就是说：

- 第 1 页永远是最新的数据
- 越新的采购发票越靠前

如果传了 `sortBy`，则按指定字段排序。

支持排序字段：

- `supplier`
- `agent`
- `currency`
- `date`
- `grandTotal`
- `amount`
- `invoiceNo`

默认排序：

- `sortBy=date`
- `sortOrder=desc`

## 4.1 搜索与过滤

### search

`search` 会在以下字段做模糊匹配：

- `DocKey`
- `CreditorName`
- `PurchaseAgent`
- `CurrencyCode`
- `DocNo`
- `SupplierInvoiceNo`
- `DocDate`
- `GrandTotal` 对应值
- `Amount` 对应值

### date range

日期过滤使用：

- `dateFrom`
- `dateTo`

格式固定：

```text
YYYY-MM-DD
```

### supplier filter

供应商筛选使用：

- `supplier`

这是模糊匹配，不要求完整名称。

### grandTotal min/max

金额区间使用：

- `grandTotalMin`
- `grandTotalMax`

比较字段使用：

- `coalesce(FinalTotal, NetTotal, Total, 0)`

## 5. 返回结构

### Success Response

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 2393,
  "totalPages": 120,
  "bookId": "4c892050-45a7-4c82-840d-12af91f5312d",
  "company": "Antsdemo",
  "items": [
    {
      "supplierInvoiceNo": "01-HQ-1013860",
      "supplier": "AUTO COUNT SDN. BHD.",
      "agent": "JULIANWG",
      "currency": "MYR",
      "date": "2026-03-07",
      "grandTotal": 1.08,
      "amount": 1.0,
      "invoiceNo": "PIY1426#03015"
    }
  ]
}
```

### 字段说明

#### 顶层字段

- `page`
  - 当前页码
- `pageSize`
  - 当前页大小
- `total`
  - 总记录数
- `totalPages`
  - 总页数
- `bookId`
  - 当前登录用户所属账套
- `company`
  - 当前登录用户所属公司
- `items`
  - 当前页数据列表

#### items 字段

- `supplierInvoiceNo`
  - 发票主键
  - 对应 SQLite `PI.DocKey`
- `supplier`
  - 供应商名称
  - 对应 `PI.CreditorName`
- `agent`
  - 经办人 / Agent
  - 对应 `PI.PurchaseAgent`
- `currency`
  - 币种
  - 对应 `PI.CurrencyCode`
- `date`
  - 单据日期
  - 对应 `PI.DocDate`
  - 输出格式固定为 `YYYY-MM-DD`
- `grandTotal`
  - 总金额
  - 优先取 `PI.FinalTotal`
  - 若为空则回退 `PI.NetTotal`
  - 再为空则回退 `PI.Total`
- `amount`
  - 金额
  - 优先取 `PI.Total`
  - 若为空则回退 `PI.ExTax`
  - 再为空则回退 `PI.NetTotal`
- `invoiceNo`
  - 发票号
  - 对应 `PI.DocNo`

## 6. 当前不返回的字段

你之前提到的表头里有：

- `Actions`

当前后端不返回 `actions` 字段。

原因是：

- 这些按钮属于前端交互层
- 当前后端还没有独立的行级操作权限模型

所以现在前端自己决定显示哪些按钮，例如：

- 查看
- 编辑
- 删除

## 7. 错误响应

### 未登录

```json
{
  "error": "unauthorized"
}
```

### 参数错误

```json
{
  "error": "invalid page"
}
```

```json
{
  "error": "invalid pageSize"
}
```

```json
{
  "error": "invalid sortBy"
}
```

```json
{
  "error": "invalid sortOrder"
}
```

```json
{
  "error": "invalid grandTotalMin"
}
```

```json
{
  "error": "invalid grandTotalMax"
}
```

### 读取失败

```json
{
  "error": "purchase invoice list failed"
}
```

## 8. 边界行为

### 公司库不存在

如果当前登录用户对应的公司库不存在：

- 不会报错创建空库
- 会直接返回空列表

示例：

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 0,
  "totalPages": 0,
  "bookId": "4c892050-45a7-4c82-840d-12af91f5312d",
  "company": "Antsdemo",
  "items": []
}
```

### 页码超出范围

如果 `page` 超过总页数：

- 不报错
- 返回空 `items`
- `total` 和 `totalPages` 仍然正确

## 9. 前端调用示例

### 同域

```js
const response = await fetch("/purchase-invoice/lists?page=1&pageSize=20");
const data = await response.json();
```

### 跨域

```js
const response = await fetch("http://localhost:8080/purchase-invoice/lists?page=1&pageSize=20", {
  credentials: "include"
});
const data = await response.json();
```

## 10. 前端表格映射建议

你前端表格可以直接这样映射：

- `SupplierInvoiceNo` -> `item.supplierInvoiceNo`
- `Supplier` -> `item.supplier`
- `Agent` -> `item.agent`
- `Currency` -> `item.currency`
- `Date` -> `item.date`
- `GrandTotal` -> `item.grandTotal`
- `Amount` -> `item.amount`
- `Invoice No` -> `item.invoiceNo`

## 11. 当前已确认的真实数据示例

当前 `data/Antsdemo/Antsdemo.db` 里已确认存在类似数据：

```json
{
  "supplierInvoiceNo": "01-HQ-1013860",
  "supplier": "AUTO COUNT SDN. BHD.",
  "agent": "JULIANWG",
  "currency": "MYR",
  "date": "2026-03-07",
  "grandTotal": 1.08,
  "amount": 1.0,
  "invoiceNo": "PIY1426#03015"
}
```
