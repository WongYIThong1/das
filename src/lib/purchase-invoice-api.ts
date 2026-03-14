import { ApiRequestError } from './auth-api';
import { safeFetch } from './safe-fetch';

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
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  bookId: string;
  company: string;
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
  page: number;
  pageSize: number;
  sortBy?: PurchaseInvoiceSortBy;
  sortOrder?: PurchaseInvoiceSortOrder;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  supplier?: string;
  grandTotalMin?: number;
  grandTotalMax?: number;
};

async function parseApiError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.error || body.message || `Request failed with status ${response.status}`;
  } catch {
    const fallbackText = await response.text().catch(() => '');
    return fallbackText || `Request failed with status ${response.status}`;
  }
}

export async function getPurchaseInvoiceList({
  page,
  pageSize,
  sortBy,
  sortOrder,
  search,
  dateFrom,
  dateTo,
  supplier,
  grandTotalMin,
  grandTotalMax,
}: GetPurchaseInvoiceListParams) {
  const query = new URLSearchParams();
  query.set('page', String(page));
  query.set('pageSize', String(pageSize));

  if (sortBy) {
    query.set('sortBy', sortBy);
  }
  if (sortOrder) {
    query.set('sortOrder', sortOrder);
  }
  if (search) {
    query.set('search', search);
  }
  if (dateFrom) {
    query.set('dateFrom', dateFrom);
  }
  if (dateTo) {
    query.set('dateTo', dateTo);
  }
  if (supplier) {
    query.set('supplier', supplier);
  }
  if (typeof grandTotalMin === 'number' && Number.isFinite(grandTotalMin)) {
    query.set('grandTotalMin', String(grandTotalMin));
  }
  if (typeof grandTotalMax === 'number' && Number.isFinite(grandTotalMax)) {
    query.set('grandTotalMax', String(grandTotalMax));
  }

  const response = await safeFetch(`/purchase-invoice/lists?${query.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiRequestError(await parseApiError(response), response.status);
  }

  return (await response.json()) as PurchaseInvoiceListResponse;
}
