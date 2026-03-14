# Purchase Invoice Picker Options API

本文档描述给 `purchase invoice` 页面专用的轻量选择器接口：

- `GET /purchase-invoice/creditor/options`
- `GET /purchase-invoice/creditor/detail`
- `GET /purchase-invoice/agent/options`
- `GET /purchase-invoice/stock/options`
- `GET /purchase-invoice/sales-uom/options`
- `GET /purchase-invoice/stock/detail`

这两个接口只返回 PI 页面下拉/搜索选择器需要的最小字段，不替代现有：

- `/creditor/lists`
- `/stock/lists`

## 1. 认证要求

这两个接口都必须已登录。

后端会自动根据当前用户 session 里的：

- `bookId`
- `company`

去读取对应公司的本地 SQLite 数据，不允许前端自己传账套。

## 2. Creditor 选择器

### Request

```text
GET /purchase-invoice/creditor/options?page=1&pageSize=20&search=GREX
```

### Query 参数

- `page`
  - 可选
  - 默认 `1`
- `pageSize`
  - 可选
  - 默认 `20`
  - 最大 `50`
- `search`
  - 可选
  - 匹配：
    - `AccNo`
    - `CompanyName`
    - `CurrencyCode`

### Response

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 1,
  "totalPages": 1,
  "bookId": "4c892050-45a7-4c82-840d-12af91f5312d",
  "company": "Antsdemo",
  "items": [
    {
      "accNo": "400-G001",
      "companyName": "GREX MULTIMEDIA SDN BHD",
      "currency": "MYR"
    }
  ]
}
```

### 默认排序

```text
CompanyName asc, AccNo asc
```

## 2.1 Creditor Detail（选中 creditor 后补全字段）

用途：

- 用户在前端选中 `creditorCode` / `accNo` 后，用这个接口补回：
  - `addressLines`
  - `taxCode`
  - `currencyCode`

### Request

```text
GET /purchase-invoice/creditor/detail?accNo=400-G001
```

### Response

```json
{
  "bookId": "4c892050-45a7-4c82-840d-12af91f5312d",
  "company": "Antsdemo",
  "creditor": {
    "accNo": "400-G001",
    "companyName": "GREX MULTIMEDIA SDN BHD",
    "addressLines": [
      "LINE 1",
      "LINE 2"
    ],
    "taxCode": "TX-0",
    "currencyCode": "MYR"
  }
}
```

## 3. Stock 选择器

## 3. Agent 选择器

### Request

```text
GET /purchase-invoice/agent/options?page=1&pageSize=20&search=JULIAN
```

### Query 参数

- `page`
  - 可选
  - 默认 `1`
- `pageSize`
  - 可选
  - 默认 `20`
  - 最大 `50`
- `search`
  - 可选
  - 匹配：
    - `PurchaseAgent`
    - `Description`
    - `Desc2`

### Response

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 1,
  "totalPages": 1,
  "bookId": "4c892050-45a7-4c82-840d-12af91f5312d",
  "company": "Antsdemo",
  "items": [
    {
      "code": "JULIANWG",
      "description": "JULIAN WONG"
    }
  ]
}
```

### 默认排序

```text
PurchaseAgent asc
```

## 4. Stock 选择器

### Request

```text
GET /purchase-invoice/stock/options?page=1&pageSize=20&search=O365
```

### Query 参数

- `page`
  - 可选
  - 默认 `1`
- `pageSize`
  - 可选
  - 默认 `20`
  - 最大 `50`
- `search`
  - 可选
  - 匹配：
    - `ItemCode`
    - `Description`
    - `Desc2`
    - `ItemGroup`

### Response

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 1,
  "totalPages": 1,
  "bookId": "4c892050-45a7-4c82-840d-12af91f5312d",
  "company": "Antsdemo",
  "items": [
    {
      "itemCode": "O365FAMILY",
      "description": "MICROSOFT OFFICE 365 FAMILY (ESD POCKET)",
      "group": "O365"
    }
  ]
}
```

### 默认排序

```text
ItemCode asc
```

## 4.1 Sales UOM 选择器

### Request

```text
GET /purchase-invoice/sales-uom/options?page=1&pageSize=20&search=UNIT
```

### Query 参数

- `page`
  - 可选
  - 默认 `1`
- `pageSize`
  - 可选
  - 默认 `20`
  - 最大 `50`
- `search`
  - 可选
  - 匹配：
    - `BaseUOM`

### Response

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 2,
  "totalPages": 1,
  "bookId": "4c892050-45a7-4c82-840d-12af91f5312d",
  "company": "Antsdemo",
  "items": [
    {
      "code": "UNIT"
    },
    {
      "code": "USER"
    }
  ]
}
```

### 默认排序

```text
Code asc
```

## 4.2 Stock Detail（选中 item 后补全字段）

用途：

- 用户在前端下拉框选中一个 `itemCode` 后，用这个接口把该 item 的主数据补全到当前 `details[i]` 行。

### Request

```text
GET /purchase-invoice/stock/detail?itemCode=9F4-003
```

### Response

```json
{
  "bookId": "4c892050-45a7-4c82-840d-12af91f5312d",
  "company": "Antsdemo",
  "item": {
    "itemCode": "9F4-003",
    "description": "SOME ITEM",
    "desc2": "",
    "group": "9F4",
    "baseUom": "UNIT",
    "salesUom": "UNIT",
    "purchaseUom": "UNIT",
    "reportUom": "UNIT",
    "uoms": [
      { "uom": "UNIT", "rate": 1 }
    ],
    "active": true,
    "accNo": "610-0000"
  }
}
```

说明：

- `accNo` 来自 `ItemGroup.PurchaseCode`，如果为空则后端会回退到 `610-0000`（永不返回空）。
- `group` 就是该 item 当前绑定的 `ItemGroup`。
- `uoms[]` 来自 `ItemUOM`，并确保包含 `baseUom`（即使 ItemUOM 缺数据）。

## 5. 错误响应

### 未登录

```json
{
  "error": "unauthorized"
}
```

### 非法页码

```json
{
  "error": "invalid page"
}
```

### 非法 pageSize

```json
{
  "error": "invalid pageSize"
}
```

### 内部失败

Creditor:

```json
{
  "error": "purchase invoice creditor options failed"
}
```

Stock:

```json
{
  "error": "purchase invoice stock options failed"
}
```

Agent:

```json
{
  "error": "purchase invoice agent options failed"
}
```

## 6. 前端使用建议

- Creditor 下拉搜索用 `/purchase-invoice/creditor/options`
- Agent 下拉搜索用 `/purchase-invoice/agent/options`
- Item 下拉搜索用 `/purchase-invoice/stock/options`
- 不要再用通用 `/creditor/lists` 和 `/stock/lists` 给 PI 选择器做首屏加载
- 这两个接口是轻量 picker API，适合边输入边查
