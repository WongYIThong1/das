# Purchase Invoice Picker Options API

本文档描述给 `purchase invoice` 页面专用的轻量选择器接口：

- `GET /purchase-invoice/creditor/options`
- `GET /purchase-invoice/agent/options`
- `GET /purchase-invoice/stock/options`

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
