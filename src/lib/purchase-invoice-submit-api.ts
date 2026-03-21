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
  IsActive?: boolean | string;
  StockControl?: boolean | string;
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
  | 'submitted'
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
  validationErrors?: PurchaseInvoiceSubmitValidationErrorLike[];
  warnings?: PurchaseInvoiceSubmitWarning[];
  lastError?: string;
  stockResults?: PurchaseInvoiceSubmitStockResultLike[];
  piResult?: PurchaseInvoiceSubmitPiResultLike;
};

type SubmitErrorPayload = {
  error?: string;
  message?: string;
  validationErrors?: PurchaseInvoiceSubmitValidationErrorLike[];
  warnings?: PurchaseInvoiceSubmitWarning[];
  stockResults?: PurchaseInvoiceSubmitStockResultLike[];
  piResult?: PurchaseInvoiceSubmitPiResultLike;
  lastError?: string;
  currentStep?: string;
};

function formatSubmitErrorMessage(payload: SubmitErrorPayload | null, fallback: string): string {
  const validationMessage = payload?.validationErrors?.map(formatPurchaseInvoiceSubmitValidationError).filter(Boolean).join('; ');
  if (validationMessage) return validationMessage;
  const stockMessage = payload?.stockResults?.map(formatPurchaseInvoiceSubmitStockResult).filter(Boolean).join('; ');
  if (stockMessage) return stockMessage;
  const piMessage = formatPurchaseInvoiceSubmitPiResult(payload?.piResult);
  if (piMessage) return piMessage;
  const warningMessage = payload?.warnings?.map((w) => w.message).filter(Boolean).join('; ');
  if (warningMessage) return warningMessage;
  if (payload?.message?.trim()) return payload.message;
  if (payload?.lastError?.trim()) return payload.lastError;
  if (payload?.error?.trim()) return payload.error;
  return fallback;
}

export type PurchaseInvoiceSubmitCreateResponse = PurchaseInvoiceSubmitEnvelope;

export type PurchaseInvoiceSubmitValidationError = {
  lineNo?: number;
  field?: string;
  code?: string;
  message?: string;
};

export type PurchaseInvoiceSubmitValidationErrorLike = PurchaseInvoiceSubmitValidationError | string;

export type PurchaseInvoiceSubmitWarning = {
  code?: string;
  severity?: string;
  message?: string;
};

export type PurchaseInvoiceSubmitStockResultLike = string | Record<string, unknown>;
export type PurchaseInvoiceSubmitPiResultLike = string | Record<string, unknown> | null;

export type PurchaseInvoiceSubmitTaskResponse = {
  submitId: string;
  submitTaskId?: string;
  taskId?: string;
  bookId?: string;
  status: PurchaseInvoiceSubmitTaskStatus;
  currentStep?: string;
  validationErrors?: PurchaseInvoiceSubmitValidationErrorLike[];
  stockResults?: PurchaseInvoiceSubmitStockResultLike[];
  piResult?: PurchaseInvoiceSubmitPiResultLike;
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

export function formatPurchaseInvoiceSubmitValidationError(value: PurchaseInvoiceSubmitValidationErrorLike): string {
  if (typeof value === 'string') {
    switch (value) {
      case 'client_offline':
        return 'AutoCount client is offline or unreachable.';
      case 'worker_unavailable':
        return 'Submission worker is unavailable.';
      default:
        return value;
    }
  }

  const parts = [value.message, value.code, value.field].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  const base = parts.join(' | ') || 'Validation error';
  return value.lineNo ? `${base} (line ${value.lineNo})` : base;
}

export function formatPurchaseInvoiceSubmitStockResult(value: PurchaseInvoiceSubmitStockResultLike): string {
  if (typeof value === 'string') {
    switch (value) {
      case 'client_offline':
        return 'AutoCount client is offline or unreachable.';
      case 'sync_in_progress':
        return 'Stock sync is already in progress.';
      default:
        return value;
    }
  }

  const record = value as Record<string, unknown>;
  const entity = typeof record.entity === 'string' && record.entity.trim() ? record.entity : undefined;
  const type = typeof record.type === 'string' && record.type.trim() ? record.type : undefined;
  const reason = typeof record.reason === 'string' && record.reason.trim() ? record.reason : undefined;
  const message =
    typeof record.message === 'string' && record.message.trim() ? record.message :
    typeof record.payload === 'object' && record.payload !== null && typeof (record.payload as Record<string, unknown>).message === 'string'
      ? String((record.payload as Record<string, unknown>).message)
      : undefined;

  const head = [entity, type, reason].filter(Boolean).join(' / ');
  if (head && message) return `${head}: ${message}`;
  if (message) return message;
  if (head) return head;
  return 'Stock operation failed.';
}

export function formatPurchaseInvoiceSubmitPiResult(value: PurchaseInvoiceSubmitPiResultLike | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value;

  const record = value as Record<string, unknown>;
  const entity = typeof record.entity === 'string' && record.entity.trim() ? record.entity : undefined;
  const type = typeof record.type === 'string' && record.type.trim() ? record.type : undefined;
  const reason = typeof record.reason === 'string' && record.reason.trim() ? record.reason : undefined;
  const message =
    typeof record.message === 'string' && record.message.trim() ? record.message :
    typeof record.payload === 'object' && record.payload !== null && typeof (record.payload as Record<string, unknown>).message === 'string'
      ? String((record.payload as Record<string, unknown>).message)
      : undefined;

  const head = [entity, type, reason].filter(Boolean).join(' / ');
  if (head && message) return `${head}: ${message}`;
  if (message) return message;
  if (head) return head;
  return '';
}

export function normalizePurchaseInvoiceSubmitStockResults(
  value: unknown[] | undefined
): PurchaseInvoiceSubmitStockResultLike[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PurchaseInvoiceSubmitStockResultLike => {
    return typeof item === 'string' || (typeof item === 'object' && item !== null);
  });
}

export async function submitPurchaseInvoice(
  request: PurchaseInvoiceSubmitRequest
): Promise<PurchaseInvoiceSubmitEnvelope> {
  if (!request || typeof request !== 'object') {
    throw new ApiRequestError('Invalid submit payload: request is null.', 400);
  }

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
    const payload = (await response.json().catch(() => null)) as SubmitErrorPayload | null;
    throw new ApiRequestError(
      formatSubmitErrorMessage(payload, 'Failed to submit purchase invoice.'),
      response.status,
      payload,
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
    const payload = (await response.json().catch(() => null)) as SubmitErrorPayload | null;
    throw new ApiRequestError(
      formatSubmitErrorMessage(payload, 'Status not found.'),
      response.status,
      payload,
    );
  }

  const data = (await response.json()) as {
    submitTaskId?: string;
    taskId?: string;
    bookId?: string;
    status?: string;
    currentStep?: string;
    validationErrors?: PurchaseInvoiceSubmitValidationErrorLike[];
    stockResults?: unknown[];
    piResult?: PurchaseInvoiceSubmitPiResultLike;
    lastError?: string;
    warnings?: PurchaseInvoiceSubmitWarning[];
  };

  const rawStatus = data.status ?? 'queued';
  const status: PurchaseInvoiceSubmitTaskStatus =
    rawStatus === 'completed'      ? 'completed' :
    rawStatus === 'submitted'      ? 'submitted' :
    rawStatus === 'success'        ? 'submitted' :
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
    stockResults: normalizePurchaseInvoiceSubmitStockResults(data.stockResults),
    piResult: data.piResult ?? null,
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
    if (task.status === 'completed' || task.status === 'submitted' || task.status === 'failed' || task.status === 'stock_failed') {
      return {
        submitTaskId: task.submitTaskId ?? task.submitId,
        taskId: task.taskId,
        status: task.status,
        httpStatus: task.status === 'completed' || task.status === 'submitted' ? 201 : 200,
        success: task.status === 'completed' || task.status === 'submitted',
        message: task.lastError || task.validationErrors?.map(formatPurchaseInvoiceSubmitValidationError).filter(Boolean).join('; ') || task.stockResults?.map(formatPurchaseInvoiceSubmitStockResult).filter(Boolean).join('; ') || formatPurchaseInvoiceSubmitPiResult(task.piResult) || task.warnings?.map((w) => w.message).filter(Boolean).join('; ') || undefined,
        purchaseInvoice: {
          success: task.status === 'completed' || task.status === 'submitted',
          message: task.lastError || task.validationErrors?.map(formatPurchaseInvoiceSubmitValidationError).filter(Boolean).join('; ') || task.stockResults?.map(formatPurchaseInvoiceSubmitStockResult).filter(Boolean).join('; ') || formatPurchaseInvoiceSubmitPiResult(task.piResult) || task.warnings?.map((w) => w.message).filter(Boolean).join('; ') || undefined,
        },
        validationErrors: task.validationErrors,
        warnings: task.warnings,
        lastError: task.lastError,
        stockResults: task.stockResults,
        piResult: task.piResult,
      };
    }

    if (Date.now() - startedAt > timeoutMs) {
      const finalTask = await getPurchaseInvoiceSubmitTask(submitTaskId, accessToken).catch(() => null);
      if (finalTask && (finalTask.status === 'completed' || finalTask.status === 'submitted' || finalTask.status === 'failed' || finalTask.status === 'stock_failed')) {
        return {
          submitTaskId: finalTask.submitTaskId ?? finalTask.submitId,
          taskId: finalTask.taskId,
          status: finalTask.status,
        httpStatus: finalTask.status === 'completed' || finalTask.status === 'submitted' ? 201 : 200,
        success: finalTask.status === 'completed' || finalTask.status === 'submitted',
        message: finalTask.lastError || finalTask.validationErrors?.map(formatPurchaseInvoiceSubmitValidationError).filter(Boolean).join('; ') || finalTask.stockResults?.map(formatPurchaseInvoiceSubmitStockResult).filter(Boolean).join('; ') || formatPurchaseInvoiceSubmitPiResult(finalTask.piResult) || finalTask.warnings?.map((w) => w.message).filter(Boolean).join('; ') || undefined,
        purchaseInvoice: {
          success: finalTask.status === 'completed' || finalTask.status === 'submitted',
          message: finalTask.lastError || finalTask.validationErrors?.map(formatPurchaseInvoiceSubmitValidationError).filter(Boolean).join('; ') || finalTask.stockResults?.map(formatPurchaseInvoiceSubmitStockResult).filter(Boolean).join('; ') || formatPurchaseInvoiceSubmitPiResult(finalTask.piResult) || finalTask.warnings?.map((w) => w.message).filter(Boolean).join('; ') || undefined,
        },
          validationErrors: finalTask.validationErrors,
          warnings: finalTask.warnings,
          lastError: finalTask.lastError,
          stockResults: finalTask.stockResults,
          piResult: finalTask.piResult,
        };
      }
      return {
        submitTaskId: task.submitTaskId ?? task.submitId ?? submitTaskId,
        taskId: task.taskId,
        status: task.status,
        httpStatus: 202,
        success: false,
        message: task.lastError || task.validationErrors?.map(formatPurchaseInvoiceSubmitValidationError).filter(Boolean).join('; ') || task.stockResults?.map(formatPurchaseInvoiceSubmitStockResult).filter(Boolean).join('; ') || formatPurchaseInvoiceSubmitPiResult(task.piResult) || task.warnings?.map((w) => w.message).filter(Boolean).join('; ') || 'submit_timeout',
        validationErrors: task.validationErrors,
        warnings: task.warnings,
        lastError: task.lastError,
        stockResults: task.stockResults,
        piResult: task.piResult,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
