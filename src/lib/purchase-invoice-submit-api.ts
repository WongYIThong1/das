import { ApiRequestError } from './auth-api';
import { createMockSubmitTask, getMockSubmitTask } from './mock-data';

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

export type PurchaseInvoiceCreateMissingItemPayload = {
  itemCode: string;
  description: string;
  itemGroup: string;
  itemType: string;
  salesUom: string;
  purchaseUom: string;
  reportUom: string;
  uomConfirmed?: boolean;
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

export async function submitPurchaseInvoice(request: PurchaseInvoiceSubmitRequest) {
  try {
    return {
      ...(await createMockSubmitTask(request)),
      httpStatus: 202,
    } satisfies PurchaseInvoiceSubmitEnvelope;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }
    throw new ApiRequestError('Unable to submit mock purchase invoice.', 500);
  }
}

export async function getPurchaseInvoiceSubmitTask(taskId: string) {
  try {
    return (await getMockSubmitTask(taskId)) as PurchaseInvoiceSubmitTaskResponse;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }
    throw new ApiRequestError('Submit task not found.', 404);
  }
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
