import { ApiRequestError } from './auth-api';

export type PurchaseInvoiceListItem = {
  supplierInvoiceNo: string;
  supplier: string;
  agent: string;
  currency: string;
  date: string;
  grandTotal: number;
  amount: number;
  invoiceNo: string;
};

export type PurchaseInvoiceListResponse = {
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  items: PurchaseInvoiceListItem[];
};

export type PurchaseInvoiceSortBy =
  | 'supplier'
  | 'agent'
  | 'currency'
  | 'date'
  | 'grandTotal'
  | 'amount'
  | 'invoiceNo';

export type PurchaseInvoiceSortOrder = 'asc' | 'desc';

export type GetPurchaseInvoiceListParams = {
  pageSize: number;
  page?: number;
  accessToken: string;
  bookId: string;
  sortBy?: PurchaseInvoiceSortBy;
  sortOrder?: PurchaseInvoiceSortOrder;
  dateFrom?: string;
  dateTo?: string;
  supplier?: string;
  grandTotalMin?: number;
  grandTotalMax?: number;
};

type PurchaseInvoiceApiItem = {
  supplierInvoiceNo: string;
  supplier: string;
  agent: string;
  currency: string;
  date: string;
  grandTotal: string | number;
  amount: string | number;
  invoiceNo: string;
};

type PurchaseInvoiceApiResponse = {
  total?: number;
  page?: number;
  pageSize?: number;
  hasNext?: boolean;
  items?: PurchaseInvoiceApiItem[];
  error?: string;
};

function getErrorMessage(code: string | undefined, fallback: string) {
  switch (code) {
    case 'invalid_request':
      return 'The purchase invoice request is invalid.';
    case 'invalid_sort':
      return 'This invoice sorting option is not supported.';
    case 'book_not_found':
      return 'This workspace could not be found.';
    case 'service_unavailable':
      return 'The purchase invoice service is temporarily unavailable.';
    default:
      return fallback;
  }
}

function buildQuery(params: GetPurchaseInvoiceListParams) {
  const query = new URLSearchParams();
  query.set('page', String(Math.max(1, params.page ?? 1)));
  query.set('pageSize', String(Math.max(1, Math.min(100, params.pageSize))));

  if (params.sortBy) {
    query.set('sortBy', params.sortBy);
  }
  if (params.sortOrder) {
    query.set('sortOrder', params.sortOrder);
  }
  if (params.supplier?.trim()) {
    query.set('supplier', params.supplier.trim());
  }
  if (params.dateFrom) {
    query.set('dateFrom', params.dateFrom);
  }
  if (params.dateTo) {
    query.set('dateTo', params.dateTo);
  }
  if (typeof params.grandTotalMin === 'number') {
    query.set('grandTotalMin', String(params.grandTotalMin));
  }
  if (typeof params.grandTotalMax === 'number') {
    query.set('grandTotalMax', String(params.grandTotalMax));
  }

  return query;
}

function parseMoney(value: string | number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getPurchaseInvoiceList(params: GetPurchaseInvoiceListParams) {
  const response = await fetch(`/api/purchase-invoice?${buildQuery(params).toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'X-Book-Id': params.bookId,
    },
    credentials: 'include',
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as PurchaseInvoiceApiResponse | null;

  if (!response.ok) {
    throw new ApiRequestError(
      getErrorMessage(payload?.error, 'Unable to load purchase invoices right now.'),
      response.status
    );
  }

  return {
    total: payload?.total ?? 0,
    page: payload?.page ?? 1,
    pageSize: payload?.pageSize ?? params.pageSize,
    hasNext: Boolean(payload?.hasNext),
    items: (payload?.items ?? []).map((item) => ({
      supplierInvoiceNo: item.supplierInvoiceNo,
      supplier: item.supplier,
      agent: item.agent,
      currency: item.currency,
      date: item.date,
      grandTotal: parseMoney(item.grandTotal),
      amount: parseMoney(item.amount),
      invoiceNo: item.invoiceNo,
    })),
  } satisfies PurchaseInvoiceListResponse;
}
