import { ApiRequestError } from './auth-api';

export type StockListItem = {
  itemCode: string;
  description: string;
  description2?: string;
  group: string;
  type: string;
  baseUOM: string;
  control: boolean;
  active: boolean;
};

export type StockListResponse = {
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  items: StockListItem[];
};

export type StockSortBy = 'itemCode' | 'description';
export type StockSortOrder = 'asc' | 'desc';

export type GetStockListParams = {
  pageSize: number;
  page?: number;
  accessToken: string;
  bookId: string;
  sortBy?: StockSortBy;
  sortOrder?: StockSortOrder;
  search?: string;
};

type StockApiResponse = {
  total?: number;
  page?: number;
  pageSize?: number;
  hasNext?: boolean;
  items?: StockListItem[];
  error?: string;
};

function getErrorMessage(code: string | undefined, fallback: string) {
  switch (code) {
    case 'invalid_request':
      return 'The stock request is invalid.';
    case 'invalid_sort':
      return 'This stock sorting option is not supported.';
    case 'book_not_found':
      return 'This workspace could not be found.';
    case 'service_unavailable':
      return 'The stock service is temporarily unavailable.';
    default:
      return fallback;
  }
}

function buildQuery(params: GetStockListParams) {
  const query = new URLSearchParams();
  query.set('page', String(Math.max(1, params.page ?? 1)));
  query.set('pageSize', String(Math.max(1, Math.min(100, params.pageSize))));

  if (params.sortBy) {
    query.set('sortBy', params.sortBy);
  }
  if (params.sortOrder) {
    query.set('sortOrder', params.sortOrder);
  }
  if (params.search?.trim()) {
    query.set('search', params.search.trim());
  }

  return query;
}

export async function getStockList(params: GetStockListParams) {
  const response = await fetch(`/api/stock-manage?${buildQuery(params).toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'X-Book-Id': params.bookId,
    },
    credentials: 'include',
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as StockApiResponse | null;

  if (!response.ok) {
    throw new ApiRequestError(
      getErrorMessage(payload?.error, 'Unable to load stock items right now.'),
      response.status
    );
  }

  return {
    total: payload?.total ?? 0,
    page: payload?.page ?? 1,
    pageSize: payload?.pageSize ?? params.pageSize,
    hasNext: Boolean(payload?.hasNext),
    items: payload?.items ?? [],
  } satisfies StockListResponse;
}
