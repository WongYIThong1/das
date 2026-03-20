# Creditor List API

## Endpoint

`GET /user/creditor`

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
  - allowed: `companyName`, `code`, `currency`
  - default: `companyName`
- `sortOrder`
  - optional
  - allowed: `asc`, `desc`
  - default: `asc`
- `search`
  - optional
  - case-insensitive contains search

## Behavior

- Data source is `root."Creditor"`
- Records are always filtered by `bookid = X-Book-Id`
- Query is paginated

## Response Fields

- `code`
  - source: `Creditor.AccNo`
- `companyName`
  - source: `Creditor.CompanyName`
- `currency`
  - source: `Creditor.CurrencyCode`
- `type`
  - source: `Creditor.CreditorType`
- `phone`
  - source: `Creditor.Phone1`
- `area`
  - source: `Creditor.AreaCode`
- `agent`
  - source: `Creditor.PurchaseAgent`
- `active`
  - source: `Creditor.IsActive`

## Response Shape

```json
{
  "items": [
    {
      "code": "400-7001",
      "companyName": "77 MOBILITY TECHNOLOGIES PTE LTD",
      "currency": "SGD",
      "type": "",
      "phone": "",
      "area": "",
      "agent": "",
      "active": true
    }
  ],
  "total": 321,
  "page": 1,
  "pageSize": 20,
  "hasNext": true
}
```

## Validation Rules

- Missing `X-Book-Id` returns `400`
- Unknown `bookid` returns `404`
- Invalid `page` or `pageSize` returns `400`
- `pageSize > 100` returns `400`
- Invalid `sortBy` or `sortOrder` returns `400`

## Supported Sorts

- `companyName asc` Company A-Z
- `companyName desc` Company Z-A
- `code asc` Code A-Z
- `code desc` Code Z-A
- `currency asc` Currency A-Z
- `currency desc` Currency Z-A

## Search

`search` matches against:

- `code`
- `companyName`
- `currency`
- `type`
- `phone`
- `area`
- `agent`

## Example

```http
GET /user/creditor?page=1&pageSize=20&sortBy=companyName&sortOrder=asc
X-Book-Id: efcf1e38-080b-45eb-be81-0fc22bf64444
```
