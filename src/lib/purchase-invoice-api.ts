import { ApiRequestError } from './auth-api';
import { getMockPurchaseInvoiceList } from './mock-data';

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
  try {
    return (await getMockPurchaseInvoiceList({
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
    })) as PurchaseInvoiceListResponse;
  } catch (error) {
    throw error instanceof ApiRequestError ? error : new ApiRequestError('Unable to load mock purchase invoices.', 500);
  }
}
