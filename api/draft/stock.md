# Draft Stock API

`GET /user/draft/stock` 用于采购发票草稿里的 stock/item 快速选择与回填。

这个接口有两种模式：

- 不带 `itemCode` 时，返回轻量列表，只展示 `itemCode` 和 `description`
- 带 `itemCode` 时，返回单条完整资料，前端据此覆盖明细行

---

## 1. 请求头

### 必填

- `X-Book-Id`

说明：

- 所有数据都只在当前 `bookid` 下查询
- `bookid` 不存在时返回 `404`

---

## 2. 查询参数

### 列表模式

| 参数 | 类型 | 说明 |
|---|---|---|
| `search` | string | 模糊搜索，匹配 item code / description |
| `page` | number | 页码，默认 `1` |
| `pageSize` | number | 每页条数，默认 `20`，最大 `100` |
| `sortBy` | string | `itemCode` 或 `description` |
| `sortOrder` | string | `asc` 或 `desc` |

### 详情模式

| 参数 | 类型 | 说明 |
|---|---|---|
| `itemCode` | string | 选中的 item code |

补充：

- 也支持 `code` 作为 `itemCode` 的别名
- 如果传了 `itemCode`，接口直接返回详情，不再分页

---

## 3. 列表返回

### Response

```json
{
  "items": [
    {
      "itemCode": "O365FAMILY",
      "description": "MICROSOFT OFFICE 365 FAMILY(6P)-ESD"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```

### 字段说明

| 字段 | 说明 |
|---|---|
| `itemCode` | `Item.ItemCode` |
| `description` | `Item.Description` |

---

## 4. 详情返回

### Response

```json
{
  "stock": {
    "itemCode": "O365FAMILY",
    "description": "MICROSOFT OFFICE 365 FAMILY(6P)-ESD",
    "description2": "",
    "itemGroup": "O365",
    "itemGroupDescription": "OFFICE 365",
    "itemGroupShortCode": "O365",
    "purchaseCode": "610-0000",
    "itemType": "STOCK",
    "control": true,
    "taxCode": "SR",
    "purchaseTaxCode": "SR",
    "salesUOM": "UNIT",
    "purchaseUOM": "UNIT",
    "reportUOM": "UNIT",
    "baseUOM": "UNIT",
    "active": true
  }
}
```

### 详情字段含义

| 字段 | 来源 |
|---|---|
| `itemCode` | `Item.ItemCode` |
| `description` | `Item.Description` |
| `description2` | `Item.Desc2` |
| `itemGroup` | `Item.ItemGroup` |
| `itemGroupDescription` | `ItemGroup.Description` |
| `itemGroupShortCode` | `ItemGroup.ShortCode` |
| `purchaseCode` | `ItemGroup.PurchaseCode` |
| `itemType` | `Item.ItemType` |
| `control` | `Item.StockControl` |
| `taxCode` | `Item.TaxCode` |
| `purchaseTaxCode` | `Item.PurchaseTaxCode` |
| `salesUOM` | `Item.SalesUOM` |
| `purchaseUOM` | `Item.PurchaseUOM` |
| `reportUOM` | `Item.ReportUOM` |
| `baseUOM` | `Item.BaseUOM` |
| `active` | `Item.IsActive` |

---

## 5. 前端替换规则

用户选中 stock 后，前端应该用详情响应里的值覆盖当前明细行：

| 前端字段 | 用来替换的值 |
|---|---|
| `itemCode` | `stock.itemCode` |
| `description` | `stock.description` |
| `description2` | `stock.description2` |
| `itemGroup` | `stock.itemGroup` |
| `itemType` | `stock.itemType` |
| `control` / `stockControl` | `stock.control` |
| `taxCode` | `stock.taxCode` |
| `purchaseTaxCode` | `stock.purchaseTaxCode` |
| `salesUOM` | `stock.salesUOM` |
| `purchaseUOM` | `stock.purchaseUOM` |
| `reportUOM` | `stock.reportUOM` |
| `baseUOM` | `stock.baseUOM` |
| `accNo` | `stock.purchaseCode` |

说明：

- `accNo` 不要自己猜，直接从 `purchaseCode` 回填
- 如果是自动建档草稿，也应该优先沿用同一个 `itemGroup` 的 `purchaseCode`

---

## 6. 支持的排序

- `itemCode asc`
- `itemCode desc`
- `description asc`
- `description desc`

---

## 7. 示例

### 搜索列表

```http
GET /user/draft/stock?search=365&page=1&pageSize=20
X-Book-Id: efcf1e38-080b-45eb-be81-0fc22bf64444
```

### 选中详情

```http
GET /user/draft/stock?itemCode=O365FAMILY
X-Book-Id: efcf1e38-080b-45eb-be81-0fc22bf64444
```

