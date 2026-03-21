# Item APIs

## 1) List

`GET /user/item`

用于 item 列表页（分页、排序、搜索）。

### Header

```http
X-Book-Id: <book-id>
```

### Query 参数

- `page` 默认 `1`
- `pageSize` 默认 `20`，最大 `100`
- `sortBy` 可选：`itemCode | description`
- `sortOrder` 可选：`asc | desc`
- `search` 可选：按 `itemCode/description/desc2/group/type/baseUOM` 模糊匹配

### 返回

```json
{
  "items": [
    {
      "itemCode": "SW-OF-365-FA",
      "description": "MICROSOFT OFFICE 365 FAMILY",
      "description2": null,
      "group": "SOFTWARE",
      "type": "NORMAL",
      "baseUOM": "UNIT",
      "control": false,
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

`GET /user/item/detail?itemCode=<itemCode>`

用于 item 详情页，返回完整主档字段，并告诉前端哪些字段当前列表有显示、哪些没显示。

### Header

```http
X-Book-Id: <book-id>
```

### Query 参数

- `itemCode` 必填
- `code` 可作为兼容别名

### 返回

```json
{
  "stock": {
    "itemCode": "SW-OF-365-FA",
    "description": "MICROSOFT OFFICE 365 FAMILY",
    "description2": "",
    "itemGroup": "SOFTWARE",
    "itemGroupDescription": "Software",
    "itemGroupShortCode": "SW",
    "purchaseCode": "610-0000",
    "itemType": "NORMAL",
    "control": false,
    "taxCode": "",
    "purchaseTaxCode": "",
    "salesUOM": "UNIT",
    "purchaseUOM": "UNIT",
    "reportUOM": "UNIT",
    "baseUOM": "UNIT",
    "active": true
  },
  "fieldView": {
    "visibleInList": [
      "itemCode",
      "description",
      "description2",
      "group",
      "type",
      "baseUOM",
      "control",
      "active"
    ],
    "hiddenInList": [
      "itemGroup",
      "itemGroupDescription",
      "itemGroupShortCode",
      "purchaseCode",
      "itemType",
      "taxCode",
      "purchaseTaxCode",
      "salesUOM",
      "purchaseUOM",
      "reportUOM"
    ]
  }
}
```

### 错误码

- `400`：缺少 `X-Book-Id` 或 `itemCode`
- `404`：book 不存在 / item 不存在
- `500`：数据库查询失败
