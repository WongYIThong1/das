# Tax Code APIs

## 1) List

`GET /user/taxcode`

用于 tax code 列表页（分页、排序、搜索）。

### Header

```http
X-Book-Id: <book-id>
```

### Query 参数

- `page` 默认 `1`
- `pageSize` 默认 `20`，最大 `100`
- `sortBy` 可选：`taxCode`
- `sortOrder` 可选：`asc | desc`
- `search` 可选：按 `taxCode` 模糊匹配

### 返回

```json
{
  "items": [
    {
      "taxCode": "SR",
      "description": "Sales Tax",
      "taxRate": 6,
      "inclusive": false,
      "active": true,
      "taxAccNo": "GST-3000",
      "isDefault": false,
      "supplyPurchase": "S",
      "taxSystem": "Malaysia GST"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```

### 兼容说明

`GET /user/taxcode/detail?taxCode=<taxCode>` 仍保留兼容入口，返回内容与列表一致，不再单独区分 detail。
