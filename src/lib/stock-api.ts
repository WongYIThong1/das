import { ApiRequestError } from './auth-api';
import { safeFetch } from './safe-fetch';

export type StockListItem = {
  itemCode: string;
  description: string;
  desc2?: string;
  group: string;
  type: string;
  baseUom: string;
  control: boolean;
  active: boolean;
};

export type StockListResponse = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  bookId: string;
  company: string;
  items: StockListItem[];
};

export type StockSortBy =
  | 'itemCode'
  | 'description'
  | 'group'
  | 'type'
  | 'baseUom'
  | 'control'
  | 'active';

export type StockSortOrder = 'asc' | 'desc';

export type GetStockListParams = {
  page: number;
  pageSize: number;
  sortBy?: StockSortBy;
  sortOrder?: StockSortOrder;
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

export async function getStockList({ page, pageSize, sortBy, sortOrder, search }: GetStockListParams) {
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

  const response = await safeFetch(`/stock/lists?${query.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiRequestError(await parseApiError(response), response.status);
  }

  return (await response.json()) as StockListResponse;
}
