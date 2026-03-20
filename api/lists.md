# Purchase Invoice List API

## Endpoint

`GET /user/purchase-invoice`

## Headers

- `X-Book-Id` required

## Query Parameters

- `page`
  - optional
  - default: `1`
- `pageSize`
  - optional
  - default: `20`
  - max: `100`
- `sortBy`
  - optional
  - allowed: `date`, `supplier`, `agent`, `currency`, `grandTotal`, `amount`, `invoiceNo`
  - default: `date`
- `sortOrder`
  - optional
  - allowed: `asc`, `desc`
  - default: `desc`
  - special rule: `invoiceNo` only supports `asc`
- `supplier`
  - optional
  - case-insensitive contains match
- `dateFrom`
  - optional
  - format: `YYYY-MM-DD`
- `dateTo`
  - optional
  - format: `YYYY-MM-DD`
- `grandTotalMin`
  - optional
  - numeric
- `grandTotalMax`
  - optional
  - numeric

## Behavior

- Data source is `root."PI"`
- Records are always filtered by `bookid = X-Book-Id`
- Cancelled invoices are excluded by default:
  - `coalesce("Cancelled", false) = false`
- `supplier` filter uses `PI."CreditorName"`
- `agent` uses `PI."PurchaseAgent"`
- `currency` uses `PI."CurrencyCode"`
- `date` uses `PI."DocDate"`
- `grandTotal` uses `PI."Total"`
- `amount` uses `PI."NetTotal"`

## Response Shape

```json
{
  "items": [
    {
      "invoiceNo": "PIY1426#03086",
      "supplierInvoiceNo": "GROUP-RETRY-20260319-001",
      "supplier": "FUWELL INTERNATIONAL PTE LTD",
      "agent": "",
      "currency": "SGD",
      "date": "2026-03-19",
      "grandTotal": 57,
      "amount": 57
    }
  ],
  "total": 2473,
  "page": 1,
  "pageSize": 20,
  "hasNext": true
}
```

## Validation Rules

- Missing `X-Book-Id` returns `400`
- Unknown `bookid` returns `404`
- Invalid `page`, `pageSize`, dates, or totals return `400`
- `invoiceNo desc` returns `400`
- `dateFrom > dateTo` returns `400`
- `grandTotalMin > grandTotalMax` returns `400`

## Supported Sorts

- `date desc` Latest first
- `date asc` Oldest first
- `supplier asc` Supplier A-Z
- `supplier desc` Supplier Z-A
- `agent asc` Agent A-Z
- `agent desc` Agent Z-A
- `currency asc` Currency A-Z
- `currency desc` Currency Z-A
- `grandTotal desc` Grand total high-low
- `grandTotal asc` Grand total low-high
- `amount desc` Amount high-low
- `amount asc` Amount low-high
- `invoiceNo asc` Invoice No A-Z

## Example

```http
GET /user/purchase-invoice?page=1&pageSize=20&sortBy=date&sortOrder=desc&supplier=FUWELL&dateFrom=2026-03-01&dateTo=2026-03-31&grandTotalMin=50&grandTotalMax=1000
X-Book-Id: efcf1e38-080b-45eb-be81-0fc22bf64444
```
