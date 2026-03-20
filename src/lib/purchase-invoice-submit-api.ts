import { ApiRequestError } from './auth-api';
import { authFetch } from './auth-fetch';

// ─── Submit request types ──────────────────────────────────────────────────────

export type PurchaseInvoiceSubmitHeader = {
  creditorCode: string;
  purchaseAgent: string;
  supplierInvoiceNo: string;
  docDate: string;
  displayTerm: string;
  currencyCode: string;
  currencyRate: number | string;
  description: string;
  externalLink: string;
  invAddr1?: string;
  invAddr2?: string;
  invAddr3?: string;
  invAddr4?: string;
};

export type PurchaseInvoiceAutoCreateStock = {
  ItemCode: string;
  Description: string;
  ItemGroup?: string;
  SalesUOM?: string;
  PurchaseUOM?: string;
  ReportUOM?: string;
  BaseUOM?: string;
  TaxCode?: string | null;
  PurchaseTaxCode?: string | null;
  IsActive?: boolean;
  StockControl?: boolean;
};

export type PurchaseInvoiceSubmitDetailItem = {
  lineNo: number;
  itemCode: string;
  accNo: string;
  qty: number | string;
  uom: string;
  unitPrice: number | string;
  amount: number | string;
  description: string;
  desc2: string;
  taxCode: string;
  itemGroup: string;
  isAutoCreate: boolean;
  autoCreateStock?: PurchaseInvoiceAutoCreateStock;
};

export type PurchaseInvoiceSubmitRequest = {
  taskId: string;
  accessToken?: string;
  header: PurchaseInvoiceSubmitHeader;
  details: PurchaseInvoiceSubmitDetailItem[];
};

// ─── Response types ────────────────────────────────────────────────────────────

export type PurchaseInvoiceSubmitTaskStatus =
  | 'queued'
  | 'validating'
  | 'stock_creating'
  | 'stock_failed'
  | 'pi_creating'
  | 'completed'
  | 'failed';

export type PurchaseInvoiceSubmitCreateResponse = {
  submitTaskId: string;
  status: string;
};

export type PurchaseInvoiceSubmitValidationError = {
  lineNo?: number;
  field?: string;
  code?: string;
  message?: string;
};

export type PurchaseInvoiceSubmitWarning = {
  code?: string;
  severity?: string;
  message?: string;
};

export type PurchaseInvoiceSubmitTaskResponse = {
  submitId: string;
  submitTaskId?: string;
  taskId?: string;
  bookId?: string;
  status: PurchaseInvoiceSubmitTaskStatus;
  currentStep?: string;
  validationErrors?: PurchaseInvoiceSubmitValidationError[];
  stockResults?: unknown[];
  piResult?: unknown;
  lastError?: string;
  warnings?: PurchaseInvoiceSubmitWarning[];
};

// Legacy alias
export type PurchaseInvoiceSubmitResponse = {
  success: boolean;
};

// ─── API functions ─────────────────────────────────────────────────────────────

export async function submitPurchaseInvoice(
  request: PurchaseInvoiceSubmitRequest
): Promise<PurchaseInvoiceSubmitCreateResponse> {
  const { taskId, accessToken, header, details } = request;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const body = JSON.stringify({
    taskId,
    draft: {
      header: {
        creditorCode: header.creditorCode,
        docDate: header.docDate,
        supplierInvoiceNo: header.supplierInvoiceNo,
        currencyCode: header.currencyCode,
        currencyRate: header.currencyRate,
        description: header.description || 'PURCHASE INVOICE',
        externalLink: header.externalLink,
        displayTerm: header.displayTerm,
        invAddr1: header.invAddr1 ?? '',
        invAddr2: header.invAddr2 ?? '',
        invAddr3: header.invAddr3 ?? '',
        invAddr4: header.invAddr4 ?? '',
      },
      details: details.map((d) => ({
        itemCode: d.itemCode,
        description: d.description,
        uom: d.uom,
        qty: d.qty,
        unitPrice: d.unitPrice,
        amount: d.amount,
        taxCode: d.taxCode,
        accNo: d.accNo,
        isAutoCreate: d.isAutoCreate,
        ...(d.isAutoCreate && d.autoCreateStock ? { autoCreateStock: d.autoCreateStock } : {}),
      })),
    },
  });

  const response = await authFetch('/api/purchase-invoice/submit', {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    throw new ApiRequestError(
      payload?.error ?? payload?.message ?? 'Failed to submit purchase invoice.',
      response.status
    );
  }

  const data = (await response.json()) as { submitTaskId?: string; status?: string };
  return {
    submitTaskId: data.submitTaskId ?? '',
    status: data.status ?? 'queued',
  };
}

export async function getPurchaseInvoiceSubmitTask(
  submitTaskId: string,
  accessToken?: string
): Promise<PurchaseInvoiceSubmitTaskResponse> {
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const url = `/api/purchase-invoice/submit/status?submitTaskId=${encodeURIComponent(submitTaskId)}`;

  const response = await authFetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(payload?.error ?? 'Status not found.', response.status);
  }

  const data = (await response.json()) as {
    submitTaskId?: string;
    taskId?: string;
    bookId?: string;
    status?: string;
    currentStep?: string;
    validationErrors?: PurchaseInvoiceSubmitValidationError[];
    stockResults?: unknown[];
    piResult?: unknown;
    lastError?: string;
    warnings?: PurchaseInvoiceSubmitWarning[];
  };

  const rawStatus = data.status ?? 'queued';
  const status: PurchaseInvoiceSubmitTaskStatus =
    rawStatus === 'completed'      ? 'completed' :
    rawStatus === 'failed'         ? 'failed' :
    rawStatus === 'stock_creating' ? 'stock_creating' :
    rawStatus === 'stock_failed'   ? 'stock_failed' :
    rawStatus === 'pi_creating'    ? 'pi_creating' :
    rawStatus === 'validating'     ? 'validating' :
    'queued';

  return {
    submitId: data.submitTaskId ?? submitTaskId,
    submitTaskId: data.submitTaskId,
    taskId: data.taskId,
    bookId: data.bookId,
    status,
    currentStep: data.currentStep,
    validationErrors: data.validationErrors,
    stockResults: data.stockResults,
    piResult: data.piResult,
    lastError: data.lastError,
    warnings: data.warnings,
  };
}
