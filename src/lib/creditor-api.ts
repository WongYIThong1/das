import { ApiRequestError } from './auth-api';

export type CreditorListItem = {
  code: string;
  companyName: string;
  currency: string;
  type: string;
  phone: string;
  area: string;
  agent: string;
  active: boolean;
};

export type CreditorListResponse = {
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  items: CreditorListItem[];
};

export type CreditorSortBy = 'companyName' | 'code' | 'currency';
export type CreditorSortOrder = 'asc' | 'desc';

export type GetCreditorListParams = {
  pageSize: number;
  page?: number;
  accessToken: string;
  bookId: string;
  sortBy?: CreditorSortBy;
  sortOrder?: CreditorSortOrder;
  search?: string;
};

type CreditorApiResponse = {
  total?: number;
  page?: number;
  pageSize?: number;
  hasNext?: boolean;
  items?: CreditorListItem[];
  error?: string;
};

function getErrorMessage(code: string | undefined, fallback: string) {
  switch (code) {
    case 'invalid_request':
      return 'The creditor request is invalid.';
    case 'invalid_sort':
      return 'This creditor sorting option is not supported.';
    case 'book_not_found':
      return 'This workspace could not be found.';
    case 'service_unavailable':
      return 'The creditor service is temporarily unavailable.';
    default:
      return fallback;
  }
}

function buildQuery(params: GetCreditorListParams) {
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

export async function getCreditorList(params: GetCreditorListParams) {
  const response = await fetch(`/api/creditor?${buildQuery(params).toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'X-Book-Id': params.bookId,
    },
    credentials: 'include',
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as CreditorApiResponse | null;

  if (!response.ok) {
    throw new ApiRequestError(
      getErrorMessage(payload?.error, 'Unable to load creditors right now.'),
      response.status
    );
  }

  return {
    total: payload?.total ?? 0,
    page: payload?.page ?? 1,
    pageSize: payload?.pageSize ?? params.pageSize,
    hasNext: Boolean(payload?.hasNext),
    items: payload?.items ?? [],
  } satisfies CreditorListResponse;
}
