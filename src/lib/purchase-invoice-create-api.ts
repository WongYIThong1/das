import { ApiRequestError } from './auth-api';
import { authFetch } from './auth-fetch';

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
  imageUrl?: string;
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
  // Currency: API returns currencyCode; keep currency for compat
  currency?: string;
  currencyCode?: string;
  currencyRate?: number | string;
  displayRate?: number | string;
  description?: string;
  // External download link stored in the header
  externalLink?: string;
  // Address: new API uses invAddr1-4
  invAddr1?: string;
  invAddr2?: string;
  invAddr3?: string;
  invAddr4?: string;
  // Legacy address fields (keep for compat)
  creditorAddress?: string;
  creditorAddressLines?: string[];
};

type DraftDetailItem = {
  itemCode?: string;
  itemGroup?: string;
  accNo?: string;
  qty?: number | string;
  uom?: string;
  unitPrice?: number | string;
  amount?: number | string;
  description?: string;
  desc2?: string;
  taxCode?: string;
  // New API fields for auto-create stock
  isAutoCreate?: boolean;
  autoCreateStatus?: string;   // 'ready' | 'blocked'
  autoCreateReason?: string;   // 'item_not_found'
  autoCreateStock?: Record<string, unknown>;
  // Legacy fields (keep for compat)
  isNewItem?: boolean;
  stockProposal?: Record<string, unknown>;
  // New API: boolean flag; old API: array of warning objects
  warning?: boolean;
  warnings?: unknown[];
};

type DraftApiResponse = {
  draftId?: string;
  uploadId?: string;
  groupId?: string;
  bookId?: string;
  status?: string;
  header?: DraftHeader;
  warnings?: unknown[];
  confidenceSummary?: unknown;
  details?: DraftDetailItem[];
  docScore?: number;
  docWarning?: boolean;
};

// Map API warning codes to UI warning codes
const WARNING_CODE_MAP: Record<string, string> = {
  // Invoice number
  invoice_number_missing:                'missing_invoice_number',
  // Doc date
  doc_date_missing:                      'missing_invoice_date',
  // Creditor
  creditor_fallback_cash_purchase:       'creditor_not_matched',
  creditor_defaulted_cash_purchase:      'creditor_not_matched',
  creditor_low_confidence:               'creditor_needs_review',
  creditor_match_warning:                'creditor_needs_review',
  creditor_master_warning:               'creditor_needs_review',
  // Item
  item_code_unmatched:                   'item_not_matched',
  item_match_warning:                    'item_needs_review',
  stock_proposed_new:                    'item_needs_review',
  detail_amount_mismatch_warning:        'item_needs_review',
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
  fileName: string,
  externalLink?: string,
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

  // Address: new API uses invAddr1-invAddr4; fall back to creditorAddressLines/creditorAddress
  const addrParts = [header.invAddr1, header.invAddr2, header.invAddr3, header.invAddr4]
    .map((s) => s?.trim())
    .filter(Boolean) as string[];
  const creditorAddressLines = addrParts.length > 0
    ? addrParts
    : header.creditorAddressLines ?? (header.creditorAddress ? [header.creditorAddress] : []);

  // Currency: new API uses currencyCode; fall back to currency
  const currencyCode = header.currencyCode ?? header.currency ?? '';

  // External download link: header.externalLink or caller-provided
  const resolvedExternalLink = header.externalLink ?? externalLink ?? '';

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

  // Per-detail warnings — 1-based line index to match the UI's `line={index + 1}`
  rawDetails.forEach((d, i) => {
    // New API: boolean flag
    if (d.warning === true) {
      warnings.push({ code: 'item_needs_review', line: i + 1 } satisfies PreviewWarningObject);
    }
    // Legacy: array of warning objects
    (d.warnings ?? []).forEach((w) => {
      const n = normalizeWarning(w);
      if (typeof n === 'string') {
        warnings.push({ code: n, line: i + 1 } satisfies PreviewWarningObject);
      } else if (typeof n === 'object' && n !== null) {
        warnings.push({ ...(n as Record<string, unknown>), line: i + 1 } as PreviewWarningObject);
      }
    });
  });

  // Map isAutoCreate / autoCreateStock into the matches.items structure so the existing
  // UI logic for "new item proposals" continues to work unchanged.
  const matchItems: PreviewMatch[] = rawDetails.map((d) => {
    // Support both new API (isAutoCreate/autoCreateStock) and legacy (isNewItem/stockProposal)
    const isNew = d.isAutoCreate ?? d.isNewItem ?? false;
    const sp = (d.autoCreateStock ?? d.stockProposal ?? {}) as Record<string, unknown>;

    let normalizedProposal: PreviewProposedNewItem | null = null;
    if (isNew && Object.keys(sp).length > 0) {
      normalizedProposal = {
        ...sp,
        // Backend returns PascalCase or camelCase — normalize to camelCase for the UI
        itemCodeSuggestion:
          (sp.ItemCode as string) ?? (sp.itemCode as string) ??
          (sp.itemCodeSuggestion as string) ?? d.itemCode ?? '',
        description:
          (sp.Description as string) ?? (sp.description as string) ?? d.description ?? '',
        itemGroup:
          (sp.ItemGroup as string) ?? (sp.itemGroup as string) ?? d.itemGroup ?? '',
        baseUom:
          (sp.BaseUOM as string) ?? (sp.BaseUom as string) ?? (sp.baseUom as string) ?? 'UNIT',
        salesUom:
          (sp.SalesUOM as string) ?? (sp.SalesUom as string) ?? (sp.salesUom as string) ?? 'UNIT',
        purchaseUom:
          (sp.PurchaseUOM as string) ?? (sp.PurchaseUom as string) ?? (sp.purchaseUom as string) ?? 'UNIT',
        reportUom:
          (sp.ReportUOM as string) ?? (sp.ReportUom as string) ?? (sp.reportUom as string) ?? 'UNIT',
        taxCode: (sp.TaxCode as string) ?? (sp.taxCode as string) ?? undefined,
        purchaseTaxCode: (sp.PurchaseTaxCode as string) ?? (sp.purchaseTaxCode as string) ?? undefined,
      } as PreviewProposedNewItem;
    }
    return {
      status: isNew ? 'unmatched' : 'matched',
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
      externalLink: resolvedExternalLink,
      docDate: header.docDate ?? '',
      currencyCode,
      currencyRate: header.currencyRate ?? header.displayRate ?? 1,
      displayTerm: header.displayTerm ?? '',
      purchaseLocation: header.location ?? '',
      description: header.description ?? 'PURCHASE INVOICE',
      creditorAddressLines,
      details,
    },
    warnings,
    matches: { items: matchItems },
  };
}

// ─── Status mapping ───────────────────────────────────────────────────────────

function mapBackendStatus(status: string): PreviewTaskStatus {
  switch (status) {
    case 'queued':
    case 'uploaded':
    case 'processing':
    case 'fileserver_uploading':
      return 'queued';
    case 'ocr_started':
    case 'ocr_completed':
    case 'ocrprocessing':
      return 'ocr_processing';
    case 'draft_ready':
    case 'aianalyzing':
      return 'analyzing';
    case 'reanalyze_queued':
    case 'reanalyzing':
      return 'ocr_processing';
    case 'completed':
    case 'completed_with_warnings':
      return 'succeeded';
    case 'failed':
      return 'failed';
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
  if (params?.page) query.set('page', String(params.page));
  const ps = params?.pageSize ?? params?.limit ?? 20;
  query.set('pageSize', String(ps));

  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await authFetch(`/api/draft/creditor?${query.toString()}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(payload?.error ?? 'Failed to load creditors.', response.status);
  }

  const data = (await response.json()) as {
    items?: Array<{ creditorCode?: string; companyName?: string }>;
    total?: number;
    page?: number;
    pageSize?: number;
    hasNext?: boolean;
  };

  const items = (data.items ?? []).map((c) => ({
    accNo: c.creditorCode ?? '',
    companyName: c.companyName ?? '',
    currency: '',
  }));

  const total = data.total ?? items.length;
  const page = data.page ?? params?.page ?? 1;
  const pageSize = data.pageSize ?? ps;

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
  if (params?.page) query.set('page', String(params.page));
  const ps = params?.pageSize ?? params?.limit ?? 20;
  query.set('pageSize', String(ps));

  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await authFetch(`/api/draft/stock?${query.toString()}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(payload?.error ?? 'Failed to load stock items.', response.status);
  }

  const data = (await response.json()) as {
    items?: Array<{ itemCode?: string; description?: string }>;
    total?: number;
    page?: number;
    pageSize?: number;
    hasNext?: boolean;
  };

  const items = (data.items ?? []).map((s) => ({
    itemCode: s.itemCode ?? '',
    description: s.description ?? '',
    group: '',
  }));

  const total = data.total ?? items.length;
  const page = data.page ?? params?.page ?? 1;
  const pageSize = data.pageSize ?? ps;

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
  creditorCode?: string;
  companyName?: string;
  taxCode?: string;
  displayTerm?: string;
  purchaseAgent?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  address4?: string;
  currencyCode?: string;
  currencyRate?: number | string;
  active?: boolean;
};

export type StockDetail = {
  itemCode: string;
  description?: string;
  description2?: string;
  desc2?: string;
  itemGroup?: string;
  taxCode?: string;
  purchaseTaxCode?: string;
  salesUOM?: string;
  purchaseUOM?: string;
  reportUOM?: string;
  baseUOM?: string;
  purchaseCode?: string;
  active?: boolean;
};

export async function getCreditorDetail(
  code: string,
  accessToken?: string
): Promise<CreditorDetail | null> {
  const query = new URLSearchParams({ creditorCode: code });
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await authFetch(`/api/draft/creditor?${query}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { creditor?: Record<string, unknown> };
  if (!data.creditor) return null;
  return data.creditor as unknown as CreditorDetail;
}

export async function getStockDetail(
  itemCode: string,
  accessToken?: string
): Promise<StockDetail | null> {
  const query = new URLSearchParams({ itemCode });
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await authFetch(`/api/draft/stock?${query}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { stock?: Record<string, unknown> };
  if (!data.stock) return null;
  const s = data.stock;
  return {
    itemCode: (s.itemCode as string) ?? itemCode,
    description: s.description as string | undefined,
    description2: s.description2 as string | undefined,
    desc2: (s.description2 as string | undefined) ?? (s.desc2 as string | undefined),
    itemGroup: s.itemGroup as string | undefined,
    taxCode: s.taxCode as string | undefined,
    purchaseTaxCode: s.purchaseTaxCode as string | undefined,
    salesUOM: s.salesUOM as string | undefined,
    purchaseUOM: s.purchaseUOM as string | undefined,
    reportUOM: s.reportUOM as string | undefined,
    baseUOM: s.baseUOM as string | undefined,
    purchaseCode: s.purchaseCode as string | undefined,
    active: s.active as boolean | undefined,
  };
}

export async function createPurchaseInvoicePreviewTask(
  file: File,
  options?: { signal?: AbortSignal; accessToken?: string }
): Promise<PurchaseInvoicePreviewTaskCreateResponse> {
  if (options?.signal?.aborted) {
    throw new ApiRequestError('Preview cancelled.', 499);
  }

  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {};
  if (options?.accessToken) headers['Authorization'] = `Bearer ${options.accessToken}`;

  const response = await authFetch('/api/purchase-invoice/upload', {
    method: 'POST',
    headers,
    body: formData,
    signal: options?.signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(payload?.error ?? 'Upload failed.', response.status);
  }

  const data = (await response.json()) as { taskId?: string; status?: string };

  return {
    taskId: data.taskId ?? '',
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

  const response = await authFetch(
    `/api/purchase-invoice/create/status?taskId=${encodeURIComponent(taskId)}`,
    { method: 'GET', headers, signal: options?.signal, cache: 'no-store' }
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(payload?.error ?? 'Preview task not found.', response.status);
  }

  const data = (await response.json()) as {
    taskId?: string;
    originalName?: string;
    status?: string;
    fileServer?: { code?: string; link?: string; imageUrl?: string };
    draft?: DraftApiResponse;
    warnings?: unknown[];
    error?: string;
  };

  const mappedStatus = mapBackendStatus(data.status ?? '');
  const externalLink = data.fileServer?.link ?? data.draft?.header?.externalLink;
  const imageUrl = data.fileServer?.imageUrl;

  // When completed, map the inline draft directly — no separate draft endpoint needed.
  let result: PurchaseInvoicePreviewResponse | undefined;
  if (mappedStatus === 'succeeded' && data.draft) {
    // Merge top-level warnings into the draft so they surface in the UI
    const mergedDraft: DraftApiResponse = {
      ...data.draft,
      warnings: [...(data.warnings ?? []), ...(data.draft.warnings ?? [])],
    };
    result = mapDraftToPreviewResponse(
      mergedDraft,
      taskId,
      data.originalName ?? taskId,
      externalLink,
    );
  }

  return {
    taskId: data.taskId ?? taskId,
    status: mappedStatus,
    externalLink,
    imageUrl,
    result,
    error: data.error,
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
  const headers: Record<string, string> = {};
  if (options?.accessToken) headers['Authorization'] = `Bearer ${options.accessToken}`;

  const response = await authFetch(`/api/purchase-invoice/task/${encodeURIComponent(taskId)}/reanalyze`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(payload?.error ?? 'Reanalyze failed.', response.status);
  }

  // Reanalyze returns { taskId, status: 'reanalyze_queued' } — treat as queued/processing
  return {
    taskId,
    status: 'ocr_processing',
    externalLink: undefined,
    imageUrl: undefined,
    result: undefined,
    error: undefined,
  };
}

// ─── SSE stub: no SSE endpoint in the current API ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function waitForPreviewViaSSE(
  _taskId: string,
  _fileName: string,
  _options?: unknown,
): Promise<PurchaseInvoicePreviewResponse> {
  // The current API has no SSE endpoint — always fall back to polling.
  throw new Error('sse_unavailable');
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
      // Draft is embedded inline in the status response via getPurchaseInvoicePreviewTask
      if (task.result) {
        return { taskId: task.taskId, draftId: task.draftId, ...task.result, sourceFileName: fileName };
      }
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
