import { ApiRequestError } from './auth-api';
import { getMockCreditorList } from './mock-data';

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

export async function getCreditorList({ page, pageSize, sortBy, sortOrder, search }: GetCreditorListParams) {
  try {
    return (await getMockCreditorList({ page, pageSize, sortBy, sortOrder, search })) as CreditorListResponse;
  } catch (error) {
    throw error instanceof ApiRequestError ? error : new ApiRequestError('Unable to load mock creditors.', 500);
  }
}
