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

export type PurchaseInvoiceSubmitRequestV2 = {
  taskId: string;
  accessToken?: string;
  header: PurchaseInvoiceSubmitHeader;
  details: PurchaseInvoiceSubmitDetailItem[];
  createMissing?: PurchaseInvoiceSubmitRequestLegacy['createMissing'];
};

export type PurchaseInvoiceSubmitPayload = {
  creditorCode: string;
  purchaseAgent: string;
  supplierInvoiceNo: string;
  docDate: string;
  currencyCode: string;
  currencyRate: number | string;
  displayTerm: string;
  purchaseLocation?: string;
  description: string;
  details: Array<{
    itemCode: string;
    description: string;
    desc2?: string;
    qty: number | string;
    unitPrice: number | string;
    amount: number | string;
    uom: string;
    taxCode: string;
    accNo: string;
    itemGroup?: string;
  }>;
};

export type PurchaseInvoiceCreateMissingItemPayload = {
  itemCode: string;
  description: string;
  itemGroup?: string;
  itemType?: string;
  salesUom?: string;
  purchaseUom?: string;
  reportUom?: string;
  stockControl?: boolean;
  hasSerialNo?: boolean;
  hasBatchNo?: boolean;
  isActive?: boolean;
  taxCode?: string;
  purchaseTaxCode?: string;
  uomConfirmed?: boolean;
};

export type PurchaseInvoiceSubmitRequestLegacy = {
  requestId: string;
  previewTaskId: string;
  accessToken?: string;
  payload: PurchaseInvoiceSubmitPayload;
  createMissing?: {
    items?: Array<{
      line: number;
      enabled: boolean;
      payload: PurchaseInvoiceCreateMissingItemPayload;
    }>;
  };
};

export type PurchaseInvoiceSubmitRequest = PurchaseInvoiceSubmitRequestV2 | PurchaseInvoiceSubmitRequestLegacy;

// ─── Response types ────────────────────────────────────────────────────────────

export type PurchaseInvoiceSubmitTaskStatus =
  | 'queued'
  | 'validating'
  | 'stock_creating'
  | 'stock_failed'
  | 'pi_creating'
  | 'completed'
  | 'failed';

export type PurchaseInvoiceSubmitEnvelope = {
  submitTaskId: string;
  taskId?: string;
  status: string;
  requestId?: string;
  httpStatus?: number;
  success?: boolean;
  message?: string;
  purchaseInvoice?: {
    success?: boolean;
    message?: string;
  };
  stockCreates?: Array<{ success?: boolean }>;
  creditorCreate?: { success?: boolean };
};

export type PurchaseInvoiceSubmitCreateResponse = PurchaseInvoiceSubmitEnvelope;

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

function isSubmitRequestV2(request: PurchaseInvoiceSubmitRequest): request is PurchaseInvoiceSubmitRequestV2 {
  return 'taskId' in request;
}

export async function submitPurchaseInvoice(
  request: PurchaseInvoiceSubmitRequest
): Promise<PurchaseInvoiceSubmitEnvelope> {
  const accessToken = request.accessToken;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const body = isSubmitRequestV2(request)
    ? JSON.stringify({
        taskId: request.taskId,
        draft: {
          header: {
            creditorCode: request.header.creditorCode,
            docDate: request.header.docDate,
            supplierInvoiceNo: request.header.supplierInvoiceNo,
            currencyCode: request.header.currencyCode,
            currencyRate: request.header.currencyRate,
            description: request.header.description || 'PURCHASE INVOICE',
            externalLink: request.header.externalLink,
            displayTerm: request.header.displayTerm,
            invAddr1: request.header.invAddr1 ?? '',
            invAddr2: request.header.invAddr2 ?? '',
            invAddr3: request.header.invAddr3 ?? '',
            invAddr4: request.header.invAddr4 ?? '',
          },
          details: request.details.map((d) => ({
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
      })
    : JSON.stringify(request);

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

  const data = (await response.json()) as {
    submitTaskId?: string;
    taskId?: string;
    status?: string;
    success?: boolean;
    message?: string;
    purchaseInvoice?: { success?: boolean; message?: string };
    stockCreates?: Array<{ success?: boolean }>;
    creditorCreate?: { success?: boolean };
  };
  const submitTaskId = data.submitTaskId ?? data.taskId ?? '';
  return {
    submitTaskId,
    taskId: data.taskId,
    status: data.status ?? 'queued',
    requestId: !isSubmitRequestV2(request) ? request.requestId : undefined,
    httpStatus: response.status,
    success: data.success,
    message: data.message,
    purchaseInvoice: data.purchaseInvoice,
    stockCreates: data.stockCreates,
    creditorCreate: data.creditorCreate,
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

export async function waitForPurchaseInvoiceSubmit(
  submitTaskId: string,
  accessToken?: string,
  options?: { timeoutMs?: number; intervalMs?: number }
): Promise<PurchaseInvoiceSubmitEnvelope> {
  const timeoutMs = options?.timeoutMs ?? 180_000;
  const intervalMs = options?.intervalMs ?? 1_500;
  const startedAt = Date.now();

  while (true) {
    const task = await getPurchaseInvoiceSubmitTask(submitTaskId, accessToken);
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'stock_failed') {
      return {
        submitTaskId: task.submitTaskId ?? task.submitId,
        taskId: task.taskId,
        status: task.status,
        httpStatus: task.status === 'completed' ? 201 : 200,
        success: task.status === 'completed',
        message: task.lastError,
        purchaseInvoice: {
          success: task.status === 'completed',
          message: task.lastError,
        },
      };
    }

    if (Date.now() - startedAt > timeoutMs) {
      return {
        submitTaskId: task.submitTaskId ?? task.submitId ?? submitTaskId,
        taskId: task.taskId,
        status: task.status,
        httpStatus: 202,
        success: false,
        message: 'submit_timeout',
      };
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
