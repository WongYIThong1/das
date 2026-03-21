# Creditor APIs

## 1) List

`GET /user/creditor`

用于 creditor 列表页（分页、排序、搜索）。

### Header

```http
X-Book-Id: <book-id>
```

### Query 参数

- `page` 默认 `1`
- `pageSize` 默认 `20`，最大 `100`
- `sortBy` 可选：`companyName | code | currency`
- `sortOrder` 可选：`asc | desc`
- `search` 可选：按 `code/companyName/currency/type/phone/area/agent` 模糊匹配

### 返回

```json
{
  "items": [
    {
      "code": "400-A001",
      "companyName": "ANTS MICRO COMPUTER SDN. BHD.",
      "currency": "MYR",
      "type": "LOCAL",
      "phone": "03-12345678",
      "area": "03",
      "agent": "JULIANWG",
      "active": true
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

`GET /user/creditor/detail?code=<creditorCode>`

用于 creditor 详情页，返回主档完整字段，并告诉前端哪些字段当前列表有显示、哪些没显示。

### Header

```http
X-Book-Id: <book-id>
```

### Query 参数

- `code` 必填（creditor code / AccNo）

### 返回

```json
{
  "creditor": {
    "code": "400-A001",
    "companyName": "ANTS MICRO COMPUTER SDN. BHD.",
    "desc2": "",
    "taxCode": "",
    "displayTerm": "C.O.D.",
    "purchaseAgent": "JULIANWG",
    "address1": "UNIT 1",
    "address2": "JALAN ABC",
    "address3": "",
    "address4": "",
    "postCode": "43000",
    "deliverAddr1": "",
    "deliverAddr2": "",
    "deliverAddr3": "",
    "deliverAddr4": "",
    "deliverPostCode": "",
    "attention": "",
    "phone1": "03-12345678",
    "phone2": "",
    "fax1": "",
    "fax2": "",
    "areaCode": "03",
    "creditorType": "LOCAL",
    "currencyCode": "MYR",
    "currencyRate": 1,
    "discountPercent": 0,
    "active": true
  },
  "fieldView": {
    "visibleInList": [
      "code",
      "companyName",
      "currencyCode",
      "creditorType",
      "phone1",
      "areaCode",
      "purchaseAgent",
      "active"
    ],
    "hiddenInList": [
      "desc2",
      "taxCode",
      "displayTerm",
      "address1",
      "address2",
      "address3",
      "address4",
      "postCode",
      "deliverAddr1",
      "deliverAddr2",
      "deliverAddr3",
      "deliverAddr4",
      "deliverPostCode",
      "attention",
      "phone2",
      "fax1",
      "fax2",
      "currencyRate",
      "discountPercent"
    ]
  }
}
```

### 错误码

- `400`：缺少 `X-Book-Id` 或 `code`
- `404`：book 不存在 / creditor 不存在
- `500`：数据库查询失败
