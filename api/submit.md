# Purchase Invoice Submit API

`/user/purchase-invoice/submit` 用于把前端已确认的草稿正式提交到客户端 AutoCount。

流程：

1. 本地先校验字段
2. 若有 `isAutoCreate=true`，先逐条下发 `stock create`
3. stock 全部成功后再下发 `pi create`
4. 任何一步失败即结束，`pi create` 不会继续

- 说明：

- `ExternalLink` 最终以 upload task 中的 fileserver `link` 为准，不使用 `imageUrl`
- 同一 `bookid` submit 串行执行
- 这是异步任务接口，需轮询状态

## Endpoints

- `POST /user/purchase-invoice/submit`
- `GET /user/purchase-invoice/submit/status?submitTaskId=<uuid>`

## Headers

- `X-Book-Id` required

## POST Request

```json
{
  "taskId": "upload-task-id",
  "draft": {
    "header": {
      "creditorCode": "400-A001",
      "docDate": "2026-03-20",
      "supplierInvoiceNo": "INV-001",
      "currencyCode": "MYR",
      "currencyRate": 1,
      "description": "PURCHASE INVOICE",
      "externalLink": "will be overridden by server",
      "displayTerm": "C.O.D.",
      "invAddr1": "",
      "invAddr2": "",
      "invAddr3": "",
      "invAddr4": ""
    },
    "details": [
      {
        "itemCode": "O365FAMILY",
        "description": "MICROSOFT OFFICE 365 FAMILY",
        "uom": "UNIT",
        "qty": 1,
        "unitPrice": 300,
        "amount": 300,
        "taxCode": "",
        "accNo": "610-1100",
        "isAutoCreate": false
      },
      {
        "itemCode": "KM-NEW-Y2601",
        "description": "NEW ITEM",
        "uom": "UNIT",
        "qty": 1,
        "unitPrice": 50,
        "amount": 50,
        "taxCode": "",
        "accNo": "610-0000",
        "isAutoCreate": true,
        "autoCreateStock": {
          "ItemCode": "KM-NEW-Y2601",
          "Description": "NEW ITEM",
          "ItemGroup": "KEY-MOUS",
          "SalesUOM": "UNIT",
          "PurchaseUOM": "UNIT",
          "ReportUOM": "UNIT",
          "BaseUOM": "UNIT",
          "TaxCode": null,
          "PurchaseTaxCode": null,
          "IsActive": "T",
          "StockControl": "T"
        }
      }
    ]
  }
}
```

## POST Response

```json
{
  "success": true,
  "submitTaskId": "uuid",
  "taskId": "upload-task-id",
  "bookId": "efcf1e38-080b-45eb-be81-0fc22bf64444",
  "status": "queued"
}
```

## Status Response

```json
{
  "submitTaskId": "uuid",
  "taskId": "upload-task-id",
  "bookId": "efcf1e38-080b-45eb-be81-0fc22bf64444",
  "status": "stock_creating",
  "currentStep": "create_stock:0",
  "currentRequestId": "submit-stock-3b3f1d2c-8f5b-4c4d-bf8d-9ceea7f2c71d",
  "createdAt": "2026-03-20T00:00:00Z",
  "updatedAt": "2026-03-20T00:00:05Z",
  "validationErrors": [],
  "stockResults": [],
  "piResult": null
}
```

## Status Values

- `queued`
- `validating`
- `stock_creating`
- `stock_failed`
- `pi_creating`
- `submitted`
- `failed`

`currentRequestId` shows the exact WS `requestId` currently waiting for a response.

## Hard Validation Rules

- `taskId` required and must belong to current `bookid`
- `draft.details` must not be empty
- each detail must have: `itemCode`, `uom`, `qty > 0`, `unitPrice >= 0`, `accNo`
- if `isAutoCreate=true`, `autoCreateStock.ItemCode` and `autoCreateStock.Description` required
- `externalLink` must be available from upload task fileserver `link`
- `imageUrl` is for preview only and must not replace `externalLink`
- `imageUrl` may still appear in create/batch item responses for UI preview
- PI `DocDate` is taken from the front-end draft during submit
- `currencyRate <= 0` will be normalized to `1` before PI create
- `purchaseAgent` is accepted in the front-end draft but not forwarded to PI create

## Failure Rules

- if target `bookid` WS client offline: fail
- if any `stock create` fails: stop and fail, do not create PI
- if PI create fails: fail (already-created stock is not rolled back)

## Success / Resubmit Rules

- When submit succeeds, the submit task final status is `submitted`.
- The corresponding batch item status is also updated to `submitted`.
- After that, the same batch item cannot be submitted again.
- If a user tries to submit the same item again, the API returns `409 Conflict`.
- `submit-all` skips already submitted items.
