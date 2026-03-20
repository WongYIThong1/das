import { ApiRequestError } from './auth-api';

// ─── Submit request types ──────────────────────────────────────────────────────

export type PurchaseInvoiceSubmitHeader = {
  creditorCode: string;
  purchaseAgent: string;
  supplierInvoiceNo: string;
  docDate: string;
  displayTerm: string;
  location: string;
  currency: string;
  currencyRate: number | string;
  description: string;
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
  isNewItem?: boolean;
  autoCreateStock?: boolean;
  stockProposal?: Record<string, unknown>;
};

export type PurchaseInvoiceSubmitRequest = {
  draftId: string;
  accessToken?: string;
  header: PurchaseInvoiceSubmitHeader;
  details: PurchaseInvoiceSubmitDetailItem[];
};

// ─── Response types ────────────────────────────────────────────────────────────

/** Status values returned by POST /draft/{draftId}/submit and GET /submits/{submitId} */
export type PurchaseInvoiceSubmitTaskStatus =
  | 'queued'
  | 'validating'
  | 'creating_stock'
  | 'creating_pi'
  | 'completed'
  | 'failed';

export type PurchaseInvoiceSubmitCreateResponse = {
  submitId: string;
  status: string;
  statusUrl?: string;
  sseUrl?: string;
};

export type PurchaseInvoiceSubmitValidationError = {
  lineNo?: number;
  field?: string;
  code?: string;
  message?: string;
};

export type PurchaseInvoiceSubmitTaskResponse = {
  submitId: string;
  draftId?: string;
  uploadId?: string;
  bookId?: string;
  status: PurchaseInvoiceSubmitTaskStatus;
  stage?: string;
  validationErrors?: PurchaseInvoiceSubmitValidationError[];
  stockResults?: unknown;
  piResult?: unknown;
  lastError?: string;
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string;
};

// Legacy alias kept for SubmitProvider compatibility
export type PurchaseInvoiceSubmitResponse = {
  success: boolean;
};

// ─── API functions ─────────────────────────────────────────────────────────────

export async function submitPurchaseInvoice(
  request: PurchaseInvoiceSubmitRequest
): Promise<PurchaseInvoiceSubmitCreateResponse> {
  const { draftId, accessToken, header, details } = request;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await fetch(`/api/purchase-invoice/draft/${draftId}/submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ header, details }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    throw new ApiRequestError(
      payload?.error ?? payload?.message ?? 'Failed to submit purchase invoice.',
      response.status
    );
  }

  return (await response.json()) as PurchaseInvoiceSubmitCreateResponse;
}

export async function getPurchaseInvoiceSubmitTask(
  submitId: string,
  accessToken?: string
): Promise<PurchaseInvoiceSubmitTaskResponse> {
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await fetch(`/api/purchase-invoice/submits/${submitId}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(payload?.error ?? 'Submit task not found.', response.status);
  }

  return (await response.json()) as PurchaseInvoiceSubmitTaskResponse;
}
