# Stock Group APIs

## 1) List

`GET /user/stockgroup`

用于 stock group 列表页（分页、排序、搜索）。

### Header

```http
X-Book-Id: <book-id>
```

### Query 参数

- `page` 默认 `1`
- `pageSize` 默认 `20`，最大 `100`
- `sortBy` 可选：`itemGroup | description | shortCode | purchaseCode`
- `sortOrder` 可选：`asc | desc`
- `search` 可选：按 `itemGroup/description/shortCode/purchaseCode` 模糊匹配

### 返回

```json
{
  "items": [
    {
      "itemGroup": "HDD",
      "description": "SSD, HARD DISK & EXTERNAL HARD DISK",
      "shortCode": "HDD",
      "purchaseCode": "610-0000",
      "itemCount": 161,
      "generatedItemCode": "HDD-W7VHUK"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```

### 兼容说明

`GET /user/stockgroup/detail?itemGroup=<itemGroup>` 仍保留兼容入口，但返回内容与列表一致，不再单独区分 detail。
