# Draft Creditor API

`GET /user/draft/creditor` 用于采购发票草稿里的 creditor 快速选择与回填。

这个接口有两种模式：

- 不带 `creditorCode` 时，返回轻量列表，只展示 `creditorCode` 和 `companyName`
- 带 `creditorCode` 时，返回单条完整资料，前端据此覆盖表单

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
| `search` | string | 模糊搜索，匹配 creditor code / company name |
| `page` | number | 页码，默认 `1` |
| `pageSize` | number | 每页条数，默认 `20`，最大 `100` |
| `sortBy` | string | `companyName` 或 `creditorCode` |
| `sortOrder` | string | `asc` 或 `desc` |

### 详情模式

| 参数 | 类型 | 说明 |
|---|---|---|
| `creditorCode` | string | 选中的 creditor code |

补充：

- 也支持 `code` 作为 `creditorCode` 的别名
- 如果传了 `creditorCode`，接口直接返回详情，不再分页

---

## 3. 列表返回

### Response

```json
{
  "items": [
    {
      "creditorCode": "400-A001",
      "companyName": "ANTS MICRO COMPUTER SDN. BHD."
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
| `creditorCode` | `Creditor.AccNo` |
| `companyName` | `Creditor.CompanyName` |

---

## 4. 详情返回

### Response

```json
{
  "creditor": {
    "creditorCode": "400-A001",
    "companyName": "ANTS MICRO COMPUTER SDN. BHD.",
    "desc2": "",
    "taxCode": "SR",
    "displayTerm": "C.O.D.",
    "purchaseAgent": "JULIANWG",
    "address1": "1 ROCHOR CANAL ROAD",
    "address2": "#04-51 SIM LIM SQUARE",
    "address3": "SINGAPORE 188504",
    "address4": "",
    "postCode": "188504",
    "deliverAddr1": "",
    "deliverAddr2": "",
    "deliverAddr3": "",
    "deliverAddr4": "",
    "deliverPostCode": "",
    "attention": "",
    "phone1": "",
    "phone2": "",
    "fax1": "",
    "fax2": "",
    "areaCode": "",
    "creditorType": "",
    "currencyCode": "SGD",
    "currencyRate": 1,
    "discountPercent": 0,
    "active": true
  }
}
```

### 详情字段含义

| 字段 | 来源 |
|---|---|
| `creditorCode` | `Creditor.AccNo` |
| `companyName` | `Creditor.CompanyName` |
| `desc2` | `Creditor.Desc2` |
| `taxCode` | `Creditor.TaxCode` |
| `displayTerm` | `Creditor.DisplayTerm` |
| `purchaseAgent` | `Creditor.PurchaseAgent` |
| `address1-4` | `Creditor.Address1-4` |
| `postCode` | `Creditor.PostCode` |
| `deliverAddr1-4` | `Creditor.DeliverAddr1-4` |
| `deliverPostCode` | `Creditor.DeliverPostCode` |
| `attention` | `Creditor.Attention` |
| `phone1` / `phone2` | `Creditor.Phone1/Phone2` |
| `fax1` / `fax2` | `Creditor.Fax1/Fax2` |
| `areaCode` | `Creditor.AreaCode` |
| `creditorType` | `Creditor.CreditorType` |
| `currencyCode` | `Creditor.CurrencyCode` |
| `currencyRate` | `Creditor.CurrencyRate` |
| `discountPercent` | `Creditor.DiscountPercent` |
| `active` | `Creditor.IsActive` |

---

## 5. 前端替换规则

用户选中 creditor 后，前端应该用详情响应里的值覆盖当前草稿表单：

| 前端字段 | 用来替换的值 |
|---|---|
| `creditorCode` / `accNo` | `creditor.creditorCode` |
| `creditorName` / `companyName` | `creditor.companyName` |
| `taxCode` | `creditor.taxCode` |
| `displayTerm` | `creditor.displayTerm` |
| `purchaseAgent` | `creditor.purchaseAgent` |
| `invAddr1` | `creditor.address1` |
| `invAddr2` | `creditor.address2` |
| `invAddr3` | `creditor.address3` |
| `invAddr4` | `creditor.address4` |
| `postCode` | `creditor.postCode` |
| `currencyCode` | `creditor.currencyCode` |
| `currencyRate` | `creditor.currencyRate` |
| `phone` | 优先用 `phone1` |
| `area` | `creditor.areaCode` |

说明：

- creditor 相关字段建议完全以这个接口返回为准
- 不要再用 OCR 文本去覆盖 creditor 主档字段

---

## 6. 支持的排序

- `companyName asc`
- `companyName desc`
- `creditorCode asc`
- `creditorCode desc`

---

## 7. 示例

### 搜索列表

```http
GET /user/draft/creditor?search=ants&page=1&pageSize=20
X-Book-Id: efcf1e38-080b-45eb-be81-0fc22bf64444
```

### 选中详情

```http
GET /user/draft/creditor?creditorCode=400-A001
X-Book-Id: efcf1e38-080b-45eb-be81-0fc22bf64444
```

