# Purchase Invoice APIs

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

### 返回（重点）

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

## 3) Void

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
- 如果两个都提供，会一并下发给客户端

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
