import { ApiRequestError } from './auth-api';
import { safeFetch } from './safe-fetch';

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
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  bookId: string;
  company: string;
  items: CreditorListItem[];
};

export type CreditorSortBy =
  | 'code'
  | 'companyName'
  | 'currency'
  | 'type'
  | 'phone'
  | 'area'
  | 'agent'
  | 'active';

export type CreditorSortOrder = 'asc' | 'desc';

export type GetCreditorListParams = {
  page: number;
  pageSize: number;
  sortBy?: CreditorSortBy;
  sortOrder?: CreditorSortOrder;
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

export async function getCreditorList({ page, pageSize, sortBy, sortOrder, search }: GetCreditorListParams) {
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

  const response = await safeFetch(`/creditor/lists?${query.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiRequestError(await parseApiError(response), response.status);
  }

  return (await response.json()) as CreditorListResponse;
}
