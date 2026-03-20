import { ApiRequestError } from './auth-api';

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
  uomDecision?: {
    selectedUom: string;
    confidence: number;
    reason: string;
    reviewRequired: boolean;
  };
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
  draftId?: string;
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
  draftId?: string;
};

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
  cursor?: string;
  limit?: number;
};

// ─── Draft API response shape ─────────────────────────────────────────────────

type DraftHeader = {
  creditorCode?: string;
  purchaseAgent?: string;
  supplierInvoiceNo?: string;
  docDate?: string;
  displayTerm?: string;
  location?: string;
  currency?: string;
  currencyRate?: number | string;
  displayRate?: number | string;
  description?: string;
  creditorAddress?: string;
  creditorAddressLines?: string[];
};

type DraftDetailItem = {
  itemCode?: string;
  accNo?: string;
  qty?: number | string;
  uom?: string;
  unitPrice?: number | string;
  amount?: number | string;
  description?: string;
  desc2?: string;
  taxCode?: string;
  itemGroup?: string;
  isNewItem?: boolean;
  autoCreateStock?: boolean;
  stockProposal?: Record<string, unknown>;
  warnings?: unknown[];
};

type DraftApiResponse = {
  draftId?: string;
  uploadId?: string;
  groupId?: string;
  bookId?: string;
  status?: string;
  header?: DraftHeader;
  warnings?: unknown[];          // header / global warnings
  confidenceSummary?: unknown;
  details?: DraftDetailItem[];
};

// Map API warning codes to UI warning codes (the UI was written before the API stabilised)
const WARNING_CODE_MAP: Record<string, string> = {
  invoice_number_missing: 'missing_invoice_number',
  doc_date_missing: 'missing_invoice_date',
  creditor_fallback_cash_purchase: 'creditor_not_matched',
  creditor_low_confidence: 'creditor_needs_review',
  item_code_unmatched: 'item_not_matched',
  stock_proposed_new: 'item_needs_review',
};

function normalizeWarningCode(code: string): string {
  return WARNING_CODE_MAP[code] ?? code;
}

function normalizeWarning(w: unknown): unknown {
  if (typeof w === 'string') return normalizeWarningCode(w);
  if (typeof w === 'object' && w !== null && 'code' in w) {
    const obj = w as Record<string, unknown>;
    return { ...obj, code: normalizeWarningCode(obj.code as string) };
  }
  return w;
}

function mapDraftToPreviewResponse(
  draft: DraftApiResponse,
  taskId: string,
  fileName: string
): PurchaseInvoicePreviewResponse {
  const header = draft.header ?? {};
  const rawDetails = draft.details ?? [];

  const details: PurchaseInvoicePreviewDetail[] = rawDetails.map((d) => ({
    itemCode: d.itemCode ?? '',
    description: d.description ?? '',
    desc2: d.desc2 ?? '',
    qty: d.qty ?? 0,
    unitPrice: d.unitPrice ?? 0,
    amount: d.amount ?? 0,
    uom: d.uom ?? '',
    taxCode: d.taxCode ?? '',
    accNo: d.accNo ?? '',
    itemGroup: d.itemGroup ?? '',
  }));

  // Flatten warnings: header-level first (no line), then per-detail (1-based line).
  const warnings: PreviewWarning[] = [];

  // Top-level / header warnings (no line index)
  (draft.warnings ?? []).forEach((w) => {
    const n = normalizeWarning(w);
    if (typeof n === 'string') {
      warnings.push({ code: n } satisfies PreviewWarningObject);
    } else if (typeof n === 'object' && n !== null) {
      warnings.push(n as PreviewWarningObject);
    }
  });

  // Per-detail warnings — use 1-based line index to match the UI's `line={index + 1}`
  rawDetails.forEach((d, i) => {
    (d.warnings ?? []).forEach((w) => {
      const n = normalizeWarning(w);
      if (typeof n === 'string') {
        warnings.push({ code: n, line: i + 1 } satisfies PreviewWarningObject);
      } else if (typeof n === 'object' && n !== null) {
        warnings.push({ ...(n as Record<string, unknown>), line: i + 1 } as PreviewWarningObject);
      }
    });
  });

  // Map isNewItem / stockProposal into the matches.items structure so the existing
  // UI logic for "new item proposals" continues to work unchanged.
  const matchItems: PreviewMatch[] = rawDetails.map((d) => {
    let normalizedProposal: PreviewProposedNewItem | null = null;
    if (d.isNewItem) {
      const sp = (d.stockProposal ?? {}) as Record<string, unknown>;
      normalizedProposal = {
        ...sp,
        // API returns itemCode; type uses itemCodeSuggestion
        itemCodeSuggestion: (sp.itemCode as string) ?? (sp.itemCodeSuggestion as string) ?? '',
        // API uses uppercase UOM field names; type uses lowercase
        baseUom: (sp.baseUOM as string) ?? (sp.baseUom as string) ?? '',
        salesUom: (sp.salesUOM as string) ?? (sp.salesUom as string) ?? '',
        purchaseUom: (sp.purchaseUOM as string) ?? (sp.purchaseUom as string) ?? '',
        reportUom: (sp.reportUOM as string) ?? (sp.reportUom as string) ?? '',
      } as PreviewProposedNewItem;
    }
    return {
      status: d.isNewItem ? 'unmatched' : 'matched',
      proposedNewItem: normalizedProposal,
    };
  });

  return {
    taskId,
    draftId: draft.draftId,
    sourceFileName: fileName,
    bookId: draft.bookId,
    payload: {
      creditorCode: header.creditorCode ?? '',
      purchaseAgent: header.purchaseAgent ?? '',
      supplierInvoiceNo: header.supplierInvoiceNo ?? '',
      docDate: header.docDate ?? '',
      currencyCode: header.currency ?? '',
      currencyRate: header.currencyRate ?? 1,
      displayTerm: header.displayTerm ?? '',
      purchaseLocation: header.location ?? 'HQ',
      description: header.description ?? 'PURCHASE INVOICE',
      creditorAddressLines: header.creditorAddressLines ?? (header.creditorAddress ? [header.creditorAddress] : []),
      details,
    },
    warnings,
    matches: { items: matchItems },
  };
}

// ─── Status mapping ───────────────────────────────────────────────────────────

function mapBackendStatus(status: string): PreviewTaskStatus {
  switch (status) {
    case 'ocr_started':
    case 'ocr_completed':
      return 'ocr_processing';
    case 'draft_ready':
      return 'analyzing';
    case 'completed':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'queued':
    case 'uploaded':
      return 'queued';
    default:
      return status as PreviewTaskStatus;
  }
}

export async function getCreditorOptions(
  params?: PickerParams,
  accessToken?: string
): Promise<PurchaseInvoicePickerPage<PurchaseInvoiceCreditorOption>> {
  const query = new URLSearchParams();
  if (params?.search?.trim()) query.set('search', params.search.trim());
  if (params?.limit) query.set('limit', String(params.limit));
  else if (params?.pageSize) query.set('limit', String(params.pageSize));
  if (params?.cursor) query.set('cursor', params.cursor);

  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await fetch(`/api/purchase-invoice/creditor?${query.toString()}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(payload?.error ?? 'Failed to load creditors.', response.status);
  }

  const data = (await response.json()) as {
    items?: Array<{
      code?: string;          // /user/purchase-invoice/creditor and /user/creditor
      creditorCode?: string;  // alternate field name
      companyName?: string;
      currency?: string;
      purchaseAgent?: string;
      agent?: string;
      active?: boolean;
    }>;
    total?: number;
    totalCreditors?: number;
    nextCursor?: string | null;
    hasMore?: boolean;
  };

  const items = (data.items ?? []).map((c) => ({
    accNo: c.creditorCode ?? c.code ?? '',
    companyName: c.companyName ?? '',
    currency: c.currency ?? '',
  }));

  const pageSize = params?.pageSize ?? params?.limit ?? 20;
  const total = data.total ?? data.totalCreditors ?? items.length;
  const page = params?.page ?? 1;

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    bookId: '',
    company: '',
    items,
  };
}

export async function getAgentOptions(
  params?: PickerParams,
  accessToken?: string
): Promise<PurchaseInvoicePickerPage<PurchaseInvoiceAgentOption>> {
  // Agents are not a separate endpoint; return empty for now
  return {
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 20,
    total: 0,
    totalPages: 1,
    bookId: '',
    company: '',
    items: [],
  };
}

export async function getStockOptions(
  params?: PickerParams,
  accessToken?: string
): Promise<PurchaseInvoicePickerPage<PurchaseInvoiceStockOption>> {
  const query = new URLSearchParams();
  if (params?.search?.trim()) query.set('search', params.search.trim());
  if (params?.limit) query.set('limit', String(params.limit));
  else if (params?.pageSize) query.set('limit', String(params.pageSize));
  if (params?.cursor) query.set('cursor', params.cursor);

  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await fetch(`/api/purchase-invoice/stock?${query.toString()}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(payload?.error ?? 'Failed to load stock items.', response.status);
  }

  const data = (await response.json()) as {
    items?: Array<{
      itemCode?: string;
      code?: string;         // alternate field name
      description?: string;
      group?: string;
      itemGroup?: string;    // alternate field name
      type?: string;
      baseUOM?: string;
      control?: boolean;
      active?: boolean;
    }>;
    total?: number;
    totalStocks?: number;
    nextCursor?: string | null;
    hasMore?: boolean;
  };

  const items = (data.items ?? []).map((s) => ({
    itemCode: s.itemCode ?? s.code ?? '',
    description: s.description ?? '',
    group: s.group ?? s.itemGroup ?? '',
  }));

  const pageSize = params?.pageSize ?? params?.limit ?? 20;
  const total = data.total ?? data.totalStocks ?? items.length;
  const page = params?.page ?? 1;

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    bookId: '',
    company: '',
    items,
  };
}

// ─── Detail fetchers ─────────────────────────────────────────────────────────

export type CreditorDetail = {
  code?: string;
  creditorCode?: string;
  companyName?: string;
  purchaseAgent?: string;
  displayTerm?: string;
  currency?: string;
  currencyCode?: string;
  currencyRate?: number | string;
  displayRate?: number | string;
  creditorAddress?: string;
  creditorAddressLines?: string[];
  address1?: string;
  address2?: string;
  address3?: string;
  address4?: string;
  isActive?: boolean;
  active?: boolean;
};

export type StockDetail = {
  itemCode: string;
  description?: string;
  desc2?: string;
  itemGroup?: string;
  itemType?: string;
  taxCode?: string;
  purchaseTaxCode?: string;
  salesUOM?: string;
  purchaseUOM?: string;
  reportUOM?: string;
  baseUOM?: string;
  accNo?: string;
  stockControl?: boolean;
  groupInfo?: Record<string, unknown>;
  active?: boolean;
};

export async function getCreditorDetail(
  code: string,
  accessToken?: string
): Promise<CreditorDetail | null> {
  const query = new URLSearchParams({ code });
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await fetch(`/api/purchase-invoice/creditor/detail?${query}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const data = (await response.json()) as Record<string, unknown>;
  return data as unknown as CreditorDetail;
}

export async function getStockDetail(
  itemCode: string,
  accessToken?: string
): Promise<StockDetail | null> {
  const query = new URLSearchParams({ itemCode });
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await fetch(`/api/purchase-invoice/stock/detail?${query}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const data = (await response.json()) as Record<string, unknown>;
  return data as unknown as StockDetail;
}

export async function createPurchaseInvoicePreviewTask(
  file: File,
  options?: { signal?: AbortSignal; accessToken?: string }
): Promise<PurchaseInvoicePreviewTaskCreateResponse> {
  if (options?.signal?.aborted) {
    throw new ApiRequestError('Preview cancelled.', 499);
  }

  const formData = new FormData();
  formData.append('files', file);

  const headers: Record<string, string> = {};
  if (options?.accessToken) headers['Authorization'] = `Bearer ${options.accessToken}`;

  const response = await fetch('/api/purchase-invoice/upload', {
    method: 'POST',
    headers,
    body: formData,
    signal: options?.signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(payload?.error ?? 'Upload failed.', response.status);
  }

  const data = (await response.json()) as {
    taskId?: string;
    files?: Array<{ id?: string; status?: string }>;
  };

  const fileEntry = data.files?.[0];
  const taskId = fileEntry?.id ?? data.taskId ?? '';

  return {
    taskId,
    status: 'queued',
  };
}

export async function getPurchaseInvoicePreviewTask(
  taskId: string,
  options?: { signal?: AbortSignal; accessToken?: string }
): Promise<PurchaseInvoicePreviewTaskResponse> {
  if (options?.signal?.aborted) {
    throw new ApiRequestError('Preview cancelled.', 499);
  }

  const headers: Record<string, string> = {};
  if (options?.accessToken) headers['Authorization'] = `Bearer ${options.accessToken}`;

  const response = await fetch(`/api/purchase-invoice/tasks/${taskId}`, {
    method: 'GET',
    headers,
    signal: options?.signal,
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(payload?.error ?? 'Preview task not found.', response.status);
  }

  const data = (await response.json()) as {
    taskId?: string;
    itemId?: string;
    status?: string;
    draftId?: string;
    downloadLink?: string;
    ready?: boolean;
    result?: PurchaseInvoicePreviewResponse;
    error?: string;
  };

  const mappedStatus = mapBackendStatus(data.status ?? '');

  return {
    taskId: data.taskId ?? data.itemId ?? taskId,
    status: mappedStatus,
    externalLink: data.downloadLink,
    result: data.result,
    error: data.error,
    draftId: data.draftId,
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function cancelPurchaseInvoicePreviewTask(_taskId: string): Promise<void> {
  // No cancel endpoint documented — no-op
}

export async function reanalyzePurchaseInvoicePreviewTask(
  taskId: string,
  options?: { accessToken?: string }
): Promise<PurchaseInvoicePreviewTaskResponse> {
  return getPurchaseInvoicePreviewTask(taskId, options);
}

// ─── Shared helper: fetch draft and map to preview response ──────────────────

async function fetchDraftAndMap(
  draftId: string,
  taskId: string,
  fileName: string,
  accessToken?: string,
): Promise<PurchaseInvoicePreviewResponse> {
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`/api/purchase-invoice/draft/${draftId}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(payload?.error ?? 'Failed to load invoice draft.', res.status);
  }

  const draft = (await res.json()) as DraftApiResponse;
  return mapDraftToPreviewResponse(draft, taskId, fileName);
}

// ─── SSE-based listener ───────────────────────────────────────────────────────

async function waitForPreviewViaSSE(
  taskId: string,
  fileName: string,
  options?: {
    timeoutMs?: number;
    onProgress?: (task: PurchaseInvoicePreviewTaskResponse) => void;
    signal?: AbortSignal;
    accessToken?: string;
  },
): Promise<PurchaseInvoicePreviewResponse> {
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const startedAt = Date.now();

  const headers: Record<string, string> = { Accept: 'text/event-stream' };
  if (options?.accessToken) headers['Authorization'] = `Bearer ${options.accessToken}`;

  const response = await fetch(`/api/purchase-invoice/tasks/${taskId}/stream`, {
    headers,
    signal: options?.signal,
  });

  if (!response.ok || !response.body) throw new Error('sse_unavailable');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  // Track last known values across events
  let lastStatus: PreviewTaskStatus | null = null;
  let lastDraftId: string | undefined;
  let lastExternalLink: string | undefined;

  const emitProgress = (status: PreviewTaskStatus, draftId?: string, externalLink?: string) => {
    options?.onProgress?.({ taskId, status, draftId, externalLink });
  };

  try {
    while (true) {
      if (options?.signal?.aborted) throw new ApiRequestError('Preview cancelled.', 499);
      if (Date.now() - startedAt > timeoutMs) throw new ApiRequestError('Preview timed out. Please try again.', 408);

      const { done, value } = await reader.read();

      if (value?.length) {
        buf += decoder.decode(value, { stream: !done });
      }
      const blocks = buf.split('\n\n');
      buf = done ? '' : (blocks.pop() ?? '');

      for (const block of blocks) {
        if (!block.trim()) continue;

        let eventName = 'message';
        let dataStr = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) dataStr = line.slice(5).trim();
        }

        if (!dataStr) continue;
        let parsed: Record<string, unknown>;
        try { parsed = JSON.parse(dataStr); } catch { continue; }

        // Extract fields from the event payload
        const rawStatus = (parsed.status as string) ?? '';
        if (rawStatus) lastStatus = mapBackendStatus(rawStatus);
        if (parsed.draftId) lastDraftId = parsed.draftId as string;
        if (parsed.downloadLink) lastExternalLink = parsed.downloadLink as string;

        if (lastStatus) emitProgress(lastStatus, lastDraftId, lastExternalLink);

        // Terminal: success
        if (lastStatus === 'succeeded' || eventName === 'item_ready') {
          const draftId = lastDraftId ?? (parsed.draftId as string | undefined);
          if (!draftId) throw new ApiRequestError('Preview completed but draft data is unavailable.', 500);
          return await fetchDraftAndMap(draftId, taskId, fileName, options?.accessToken);
        }

        // Terminal: failure
        if (lastStatus === 'failed' || eventName === 'item_failed') {
          throw new ApiRequestError((parsed.error as string) || 'Preview failed.', 500);
        }

        // Stream closed by server at terminal state
        if (eventName === 'done') {
          if (lastStatus === 'succeeded') {
            const draftId = lastDraftId;
            if (!draftId) throw new ApiRequestError('Preview completed but draft data is unavailable.', 500);
            return await fetchDraftAndMap(draftId, taskId, fileName, options?.accessToken);
          }
          if (lastStatus === 'failed') throw new ApiRequestError('Preview failed.', 500);
          // done without known terminal status — fall through and let polling handle it
          throw new Error('sse_done_unknown');
        }
      }

      if (done) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  throw new Error('sse_stream_ended');
}

// ─── Polling fallback ─────────────────────────────────────────────────────────

async function waitForPreviewViaPolling(
  taskId: string,
  fileName: string,
  options?: {
    intervalMs?: number;
    timeoutMs?: number;
    onProgress?: (task: PurchaseInvoicePreviewTaskResponse) => void;
    signal?: AbortSignal;
    accessToken?: string;
  },
): Promise<PurchaseInvoicePreviewResponse> {
  const intervalMs = options?.intervalMs ?? 1500;
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const startedAt = Date.now();

  while (true) {
    if (options?.signal?.aborted) throw new ApiRequestError('Preview cancelled.', 499);

    const task = await getPurchaseInvoicePreviewTask(taskId, {
      signal: options?.signal,
      accessToken: options?.accessToken,
    });
    options?.onProgress?.(task);

    if (task.status === 'canceled') throw new ApiRequestError('Preview cancelled.', 499);

    if (task.status === 'succeeded') {
      if (task.result) {
        return { taskId: task.taskId, draftId: task.draftId, ...task.result, sourceFileName: fileName };
      }
      if (task.draftId) return await fetchDraftAndMap(task.draftId, task.taskId, fileName, options?.accessToken);
      throw new ApiRequestError('Preview completed but draft data is unavailable.', 500);
    }

    if (task.status === 'failed') throw new ApiRequestError(task.error || 'Preview failed.', 500);

    if (Date.now() - startedAt > timeoutMs) throw new ApiRequestError('Preview timed out. Please try again.', 408);

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }
}

// ─── Public API: SSE first, polling fallback ──────────────────────────────────

export async function waitForPurchaseInvoicePreview(
  taskId: string,
  fileName: string,
  options?: {
    intervalMs?: number;
    timeoutMs?: number;
    onProgress?: (task: PurchaseInvoicePreviewTaskResponse) => void;
    signal?: AbortSignal;
    accessToken?: string;
  }
): Promise<PurchaseInvoicePreviewResponse> {
  try {
    return await waitForPreviewViaSSE(taskId, fileName, options);
  } catch (err) {
    // Propagate cancellation and timeout without retrying
    if (err instanceof ApiRequestError && (err.status === 499 || err.status === 408)) throw err;
    // SSE not available or stream ended unexpectedly — fall back to polling
    return await waitForPreviewViaPolling(taskId, fileName, options);
  }
}
