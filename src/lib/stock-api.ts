import { ApiRequestError } from './auth-api';
import { getMockStockList } from './mock-data';

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

export async function getStockList({ page, pageSize, sortBy, sortOrder, search }: GetStockListParams) {
  try {
    return (await getMockStockList({ page, pageSize, sortBy, sortOrder, search })) as StockListResponse;
  } catch (error) {
    throw error instanceof ApiRequestError ? error : new ApiRequestError('Unable to load mock stock items.', 500);
  }
}
