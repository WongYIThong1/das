import { ApiRequestError } from './auth-api';
import { safeFetch } from './safe-fetch';

export type PreviewTaskStatus = 'queued' | 'ocr_processing' | 'analyzing' | 'succeeded' | 'failed' | 'canceled';
export type PreviewMatchStatus = 'matched' | 'review' | 'unmatched';

export type PreviewWarningCode =
  | 'missing_invoice_number'
  | 'missing_invoice_date'
  | 'missing_items'
  | 'creditor_not_matched'
  | 'creditor_needs_review'
  | 'agent_not_matched'
  | 'agent_needs_review'
  | 'item_not_matched'
  | 'item_needs_review'
  | string;

export type PreviewWarningObject = Record<string, unknown> & {
  code: string;
  message?: string;
  line?: number;
  critical?: boolean;
};

export type PreviewWarning = PreviewWarningCode | PreviewWarningObject;

export type PreviewCandidate = Record<string, unknown> & {
  code?: string;
  companyName?: string;
  name?: string;
  itemCode?: string;
  description?: string;
  itemGroup?: string;
  purchaseAgent?: string;
  proposedNewItem?: Record<string, unknown>;
};

export type PreviewProposedNewItem = Record<string, unknown> & {
  itemCodeSuggestion?: string;
  description?: string;
  desc2?: string;
  itemGroup?: string;
  baseUom?: string;
  salesUom?: string;
  purchaseUom?: string;
  reportUom?: string;
  itemType?: string;
  stockControl?: boolean;
  hasSerialNo?: boolean;
  hasBatchNo?: boolean;
  active?: boolean;
  taxCode?: string;
  purchaseTaxCode?: string;
};

export type PreviewMatch = {
  status: PreviewMatchStatus;
  confidence?: number;
  extractedValue?: string;
  reason?: string;
  candidate?: PreviewCandidate | null;
  topCandidates?: PreviewCandidate[];
  proposedNewItem?: PreviewProposedNewItem | null;
  extracted?: unknown;
};

export type PurchaseInvoicePreviewDetail = {
  itemCode: string;
  description: string;
  desc2: string;
  qty: number | string;
  unitPrice: number | string;
  amount: number | string;
  uom: string;
  taxCode: string;
  accNo: string;
  itemGroup: string;
};

export type PurchaseInvoicePreviewPayload = {
  creditorCode: string;
  purchaseAgent: string;
  supplierInvoiceNo: string;
  externalLink?: string;
  docDate: string;
  currencyCode: string;
  currencyRate: number | string;
  displayTerm: string;
  purchaseLocation: string;
  description: string;
  creditorAddressLines: string[];
  details: PurchaseInvoicePreviewDetail[];
};

export type PurchaseInvoicePreviewMatches = {
  creditor?: PreviewMatch;
  agent?: PreviewMatch;
  items?: PreviewMatch[];
};

export type PurchaseInvoicePreviewFile = {
  fileId: string;
  status: string;
  downloadUrl?: string;
  statusUrl?: string;
  sha256?: string;
  size?: number;
  originalName?: string;
  contentType?: string;
};
export type PurchaseInvoicePreviewExtracted = Record<string, unknown> & {
  creditorName?: string;
  creditorAddressLines?: string[];
  agentName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  description?: string;
  displayTerm?: string;
  purchaseLocation?: string;
  items?: unknown[];
};

export type PurchaseInvoicePreviewResponse = {
  taskId?: string;
  success?: boolean;
  payload: PurchaseInvoicePreviewPayload;
  warnings: PreviewWarning[];
  file?: PurchaseInvoicePreviewFile;
  matches: PurchaseInvoicePreviewMatches;
  extracted?: PurchaseInvoicePreviewExtracted;
  provider?: string;
  sourceFileName?: string;
  bookId?: string;
  company?: string;
};

export type PurchaseInvoicePreviewTaskCreateResponse = {
  taskId: string;
  status: Extract<PreviewTaskStatus, 'queued'> | PreviewTaskStatus;
};

export type PurchaseInvoicePreviewTaskResponse = {
  taskId: string;
  status: PreviewTaskStatus;
  // The backend may return these early (even before `result`) so the UI can
  // offer "Download original" while the preview task is still running.
  externalLink?: string;
  file?: PurchaseInvoicePreviewFile;
  result?: PurchaseInvoicePreviewResponse;
  error?: string;
};

export async function parseApiError(response: Response) {
  try {
    const errorBody = await response.json();
    return errorBody.error || errorBody.message || 'An unknown error occurred';
  } catch {
    return 'An unknown error occurred';
  }
}

export type PurchaseInvoicePickerPage<T> = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  bookId: string;
  company: string;
  items: T[];
};

export type PurchaseInvoiceCreditorOption = {
  accNo: string;
  companyName: string;
  currency: string;
};

export type PurchaseInvoiceAgentOption = {
  code: string;
  description: string;
};

export type PurchaseInvoiceStockOption = {
  itemCode: string;
  description: string;
  group: string;
};

type PickerParams = {
  search?: string;
  page?: number;
  pageSize?: number;
};

function clampPageSize(pageSize: number) {
  return Math.max(1, Math.min(50, pageSize));
}

function buildPickerQuery(params?: PickerParams) {
  const query = new URLSearchParams();
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = clampPageSize(params?.pageSize ?? 20);

  query.set('page', String(page));
  query.set('pageSize', String(pageSize));
  if (params?.search?.trim()) {
    query.set('search', params.search.trim());
  }

  return query;
}

export async function getCreditorOptions(params?: PickerParams) {
  const query = buildPickerQuery(params);

  const response = await safeFetch(`/purchase-invoice/creditor/options?${query.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiRequestError(await parseApiError(response), response.status);
  }

  return (await response.json()) as PurchaseInvoicePickerPage<PurchaseInvoiceCreditorOption>;
}

export async function getAgentOptions(params?: PickerParams) {
  const query = buildPickerQuery(params);

  const response = await safeFetch(`/purchase-invoice/agent/options?${query.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiRequestError(await parseApiError(response), response.status);
  }

  return (await response.json()) as PurchaseInvoicePickerPage<PurchaseInvoiceAgentOption>;
}

export async function getStockOptions(params?: PickerParams) {
  const query = buildPickerQuery(params);

  const response = await safeFetch(`/purchase-invoice/stock/options?${query.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiRequestError(await parseApiError(response), response.status);
  }

  return (await response.json()) as PurchaseInvoicePickerPage<PurchaseInvoiceStockOption>;
}

export async function createPurchaseInvoicePreviewTask(file: File, options?: { signal?: AbortSignal }) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await safeFetch('/purchase-invoice/create', {
    method: 'POST',
    body: formData,
    credentials: 'include',
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new ApiRequestError(await parseApiError(response), response.status);
  }

  return (await response.json()) as PurchaseInvoicePreviewTaskCreateResponse;
}

export async function getPurchaseInvoicePreviewTask(taskId: string, options?: { signal?: AbortSignal }) {
  const response = await safeFetch(`/purchase-invoice/create/${taskId}`, {
    method: 'GET',
    credentials: 'include',
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new ApiRequestError(await parseApiError(response), response.status);
  }

  return (await response.json()) as PurchaseInvoicePreviewTaskResponse;
}

export async function cancelPurchaseInvoicePreviewTask(taskId: string) {
  const response = await safeFetch(`/purchase-invoice/create/${taskId}/cancel`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiRequestError(await parseApiError(response), response.status);
  }

  return true;
}

export async function waitForPurchaseInvoicePreview(
  taskId: string,
  fileName: string,
  options?: {
    intervalMs?: number;
    timeoutMs?: number;
    onProgress?: (task: PurchaseInvoicePreviewTaskResponse) => void;
    signal?: AbortSignal;
  }
) {
  const intervalMs = options?.intervalMs ?? 1500;
  const timeoutMs = options?.timeoutMs ?? 120000;
  const startedAt = Date.now();

  while (true) {
    if (options?.signal?.aborted) {
      throw new ApiRequestError('Preview cancelled.', 499);
    }
    const task = await getPurchaseInvoicePreviewTask(taskId, { signal: options?.signal });
    options?.onProgress?.(task);

    if (task.status === 'canceled') {
      throw new ApiRequestError('Preview cancelled.', 499);
    }

    if (task.status === 'succeeded' && task.result) {
      return {
        taskId: task.taskId,
        ...task.result,
        sourceFileName: fileName,
      } satisfies PurchaseInvoicePreviewResponse;
    }

    if (task.status === 'failed') {
      throw new ApiRequestError(task.error || 'Preview failed.', 500);
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new ApiRequestError('Preview timed out. Please try again.', 408);
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }
}
