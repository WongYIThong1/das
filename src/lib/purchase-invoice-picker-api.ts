import { ApiRequestError } from './auth-api';

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
  page?: number;
  pageSize?: number;
  search?: string;
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

async function getPickerOptions<T>(path: string, { page = 1, pageSize = 20, search }: PickerParams) {
  const query = new URLSearchParams();
  query.set('page', String(page));
  query.set('pageSize', String(pageSize));
  if (search?.trim()) {
    query.set('search', search.trim());
  }

  const response = await fetch(`${path}?${query.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiRequestError(await parseApiError(response), response.status);
  }

  return (await response.json()) as PurchaseInvoicePickerPage<T>;
}

export function getPurchaseInvoiceCreditorOptions(params: PickerParams) {
  return getPickerOptions<PurchaseInvoiceCreditorOption>('/purchase-invoice/creditor/options', params);
}

export function getPurchaseInvoiceAgentOptions(params: PickerParams) {
  return getPickerOptions<PurchaseInvoiceAgentOption>('/purchase-invoice/agent/options', params);
}

export function getPurchaseInvoiceStockOptions(params: PickerParams) {
  return getPickerOptions<PurchaseInvoiceStockOption>('/purchase-invoice/stock/options', params);
}
