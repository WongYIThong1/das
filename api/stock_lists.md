# Item List API

## Endpoint

`GET /user/item`

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
  - allowed: `itemCode`, `description`
  - default: `itemCode`
- `sortOrder`
  - optional
  - allowed: `asc`, `desc`
  - default: `asc`
- `search`
  - optional
  - case-insensitive contains search

## Behavior

- Data source is `root."Item"`
- Records are always filtered by `bookid = X-Book-Id`
- Query is paginated

## Response Fields

- `itemCode`
  - source: `Item.ItemCode`
- `description`
  - source: `Item.Description`
- `description2`
  - source: `Item.Desc2`
- `group`
  - source: `Item.ItemGroup`
- `type`
  - source: `Item.ItemType`
- `baseUOM`
  - source: `Item.BaseUOM`
- `control`
  - source: `Item.StockControl`
- `active`
  - source: `Item.IsActive`

## Response Shape

```json
{
  "items": [
    {
      "itemCode": "ITEM-001",
      "description": "Sample Item",
      "description2": null,
      "group": "RAW",
      "type": "STOCK",
      "baseUOM": "PCS",
      "control": true,
      "active": true
    }
  ],
  "total": 1531,
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

- `itemCode asc` ItemCode A-Z
- `itemCode desc` ItemCode Z-A
- `description asc` Description A-Z
- `description desc` Description Z-A

## Search

`search` matches against:

- `itemCode`
- `description`
- `description2`
- `group`
- `type`
- `baseUOM`

## Example

```http
GET /user/item?page=1&pageSize=20&sortBy=itemCode&sortOrder=asc
X-Book-Id: efcf1e38-080b-45eb-be81-0fc22bf64444
```
