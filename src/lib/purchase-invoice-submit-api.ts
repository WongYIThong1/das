import { ApiRequestError } from './auth-api';
import { safeFetch } from './safe-fetch';

export type PurchaseInvoiceSubmitDetail = {
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

export type PurchaseInvoiceSubmitPayload = {
  creditorCode: string;
  purchaseAgent: string;
  supplierInvoiceNo: string;
  docDate: string;
  currencyCode: string;
  currencyRate: number | string;
  displayTerm: string;
  purchaseLocation: string;
  description: string;
  details: PurchaseInvoiceSubmitDetail[];
};

export type PurchaseInvoiceCreateMissingCreditorPayload = {
  code: string;
  companyName: string;
  currency: string;
  type: string;
  phone: string;
  area: string;
  agent: string;
  active: boolean;
};

export type PurchaseInvoiceCreateMissingItemPayload = {
  itemCode: string;
  description: string;
  itemGroup: string;
  itemType: string;
  salesUom: string;
  purchaseUom: string;
  reportUom: string;
  stockControl: boolean;
  hasSerialNo: boolean;
  hasBatchNo: boolean;
  isActive: boolean;
  taxCode: string;
  purchaseTaxCode: string;
};

export type PurchaseInvoiceSubmitRequest = {
  requestId: string;
  previewTaskId: string;
  payload: PurchaseInvoiceSubmitPayload;
  createMissing?: {
    creditor?: {
      enabled: boolean;
      payload: PurchaseInvoiceCreateMissingCreditorPayload;
    };
    items?: Array<{
      line: number;
      enabled: boolean;
      payload: PurchaseInvoiceCreateMissingItemPayload;
    }>;
  };
};

export type PurchaseInvoiceSubmitStepResult = {
  kind?: string;
  requestId?: string;
  statusCode?: number;
  success?: boolean;
  message?: string;
  response?: unknown;
};

export type PurchaseInvoiceSubmitResponse = {
  success: boolean;
  requestId: string;
  bookId?: string;
  company?: string;
  message?: string;
  finalPayload?: PurchaseInvoiceSubmitPayload;
  stockCreates?: PurchaseInvoiceSubmitStepResult[];
  creditorCreate?: PurchaseInvoiceSubmitStepResult | null;
  purchaseInvoice?: PurchaseInvoiceSubmitStepResult | null;
};

export type PurchaseInvoiceSubmitEnvelope = PurchaseInvoiceSubmitResponse & {
  httpStatus: number;
};

export type PurchaseInvoiceSubmitTaskStatus = 'queued' | 'preparing' | 'validating' | 'dispatching' | 'succeeded' | 'failed';

export type PurchaseInvoiceSubmitTaskCreateResponse = {
  taskId: string;
  requestId: string;
  previewTaskId: string;
  status: Extract<PurchaseInvoiceSubmitTaskStatus, 'queued'> | PurchaseInvoiceSubmitTaskStatus;
  message?: string;
};

export type PurchaseInvoiceSubmitTaskResponse = {
  taskId: string;
  requestId: string;
  previewTaskId: string;
  status: PurchaseInvoiceSubmitTaskStatus;
  message?: string;
  result?: PurchaseInvoiceSubmitResponse & {
    validation?: unknown;
  };
  error?: string;
};

type PurchaseInvoiceStructuredError = PurchaseInvoiceSubmitResponse & {
  error?: string;
  validation?: unknown;
};

async function parseApiBody<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function parseApiError(response: Response) {
  const body = await parseApiBody<{ error?: string; message?: string; requestId?: string; previewTaskId?: string; target?: string }>(response);
  if (body) {
    const base = body.error || body.message || `Request failed with status ${response.status}`;
    const parts = [
      typeof body.requestId === 'string' && body.requestId ? `requestId=${body.requestId}` : null,
      typeof body.previewTaskId === 'string' && body.previewTaskId ? `previewTaskId=${body.previewTaskId}` : null,
      typeof body.target === 'string' && body.target ? `target=${body.target}` : null,
    ].filter((value): value is string => Boolean(value));

    return parts.length > 0 ? `${base} (${parts.join(', ')})` : base;
  }

  const fallbackText = await response.text().catch(() => '');
  return fallbackText || `Request failed with status ${response.status}`;
}

export async function submitPurchaseInvoice(request: PurchaseInvoiceSubmitRequest) {
  const response = await safeFetch('/purchase-invoice/submit', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const fallbackResponse = response.clone();
  const body = await parseApiBody<PurchaseInvoiceStructuredError | PurchaseInvoiceSubmitTaskCreateResponse>(response);
  if (!body) {
    throw new ApiRequestError(`Request failed with status ${response.status}`, response.status);
  }

  const anyBody = body as Record<string, unknown>;
  const hasStructuredResult =
    typeof anyBody.requestId === 'string' ||
    'purchaseInvoice' in anyBody ||
    'creditorCreate' in anyBody ||
    'stockCreates' in anyBody;

  if (!response.ok && !hasStructuredResult) {
    const structured = body as PurchaseInvoiceStructuredError;
    throw new ApiRequestError(structured.error || structured.message || (await parseApiError(fallbackResponse)), response.status);
  }

  return {
    ...(body as PurchaseInvoiceStructuredError),
    httpStatus: response.status,
  } satisfies PurchaseInvoiceSubmitEnvelope;
}

export async function getPurchaseInvoiceSubmitTask(taskId: string) {
  const response = await safeFetch(`/purchase-invoice/submit/${taskId}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiRequestError(await parseApiError(response), response.status);
  }

  return (await response.json()) as PurchaseInvoiceSubmitTaskResponse;
}

export async function waitForPurchaseInvoiceSubmit(
  taskId: string,
  options?: {
    intervalMs?: number;
    timeoutMs?: number;
    onProgress?: (task: PurchaseInvoiceSubmitTaskResponse) => void;
  }
) {
  const intervalMs = options?.intervalMs ?? 1500;
  const timeoutMs = options?.timeoutMs ?? 180000;
  const startedAt = Date.now();

  while (true) {
    const task = await getPurchaseInvoiceSubmitTask(taskId);
    options?.onProgress?.(task);

    if (task.status === 'succeeded' && task.result) {
      return {
        ...task.result,
        httpStatus: 201,
      } satisfies PurchaseInvoiceSubmitEnvelope;
    }

    if (task.status === 'failed') {
      const message = task.error || task.message || 'Purchase invoice submit failed.';
      throw new ApiRequestError(message, 400);
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new ApiRequestError('Submit timed out. Please retry later with the same request ID.', 408);
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }
}
