'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  ChevronRight,
  Pencil,
  Trash2,
  Hash,
  Building2,
  User,
  Coins,
  Calendar as CalendarIcon,
  CircleDollarSign,
  Wallet,
  Receipt,
  Settings2,
  Store,
  FileDigit,
  Plus,
  Search,
  ArrowUpDown,
  ArrowUpRight,
  Clock3,
  AlertCircle,
  ChevronDownIcon,
  LoaderCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { UploadInvoiceModal } from './UploadInvoiceModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { useAuth } from './AuthProvider';
import { Input } from './ui/input';
import { ApiRequestError } from '../lib/auth-api';
import type {
  GetPurchaseInvoiceListParams,
  PurchaseInvoiceListItem,
  PurchaseInvoiceSortBy,
  PurchaseInvoiceSortOrder,
} from '../lib/purchase-invoice-api';
import { getPurchaseInvoiceList } from '../lib/purchase-invoice-api';

interface EditableInvoice {
  id: string; // This will be the supplierInvoiceNo (DocKey)
  supplierInvoiceNo: string;
  creditorName: string;
  purchaseAgent: string;
  currency: string;
  docDate: string;
  amount: number;
  netTotal: number;
  docNo: string; // This is the user-facing invoiceNo
}

const PAGE_SIZE = 20;

type SortOption = {
  label: string;
  sortBy: PurchaseInvoiceSortBy;
  sortOrder: PurchaseInvoiceSortOrder;
};

type AutoRefreshOption = {
  label: string;
  intervalMs: number | null;
};

type FilterDraft = {
  supplier: string;
  dateFrom: string;
  dateTo: string;
  grandTotalMin: string;
  grandTotalMax: string;
};

type InvoiceQuery = Omit<GetPurchaseInvoiceListParams, 'page' | 'pageSize'>;

const sortOptions: SortOption[] = [
  { label: 'Latest first', sortBy: 'date', sortOrder: 'desc' },
  { label: 'Oldest first', sortBy: 'date', sortOrder: 'asc' },
  { label: 'Supplier A-Z', sortBy: 'supplier', sortOrder: 'asc' },
  { label: 'Supplier Z-A', sortBy: 'supplier', sortOrder: 'desc' },
  { label: 'Agent A-Z', sortBy: 'agent', sortOrder: 'asc' },
  { label: 'Agent Z-A', sortBy: 'agent', sortOrder: 'desc' },
  { label: 'Currency A-Z', sortBy: 'currency', sortOrder: 'asc' },
  { label: 'Currency Z-A', sortBy: 'currency', sortOrder: 'desc' },
  { label: 'Grand total high-low', sortBy: 'grandTotal', sortOrder: 'desc' },
  { label: 'Grand total low-high', sortBy: 'grandTotal', sortOrder: 'asc' },
  { label: 'Amount high-low', sortBy: 'amount', sortOrder: 'desc' },
  { label: 'Amount low-high', sortBy: 'amount', sortOrder: 'asc' },
  { label: 'Invoice No A-Z', sortBy: 'invoiceNo', sortOrder: 'asc' },
];

const autoRefreshOptions: AutoRefreshOption[] = [
  { label: 'Off', intervalMs: null },
  { label: 'Every 5 minutes', intervalMs: 5 * 60 * 1000 },
  { label: 'Every 10 minutes', intervalMs: 10 * 60 * 1000 },
];

const defaultFilters: FilterDraft = {
  supplier: '',
  dateFrom: '',
  dateTo: '',
  grandTotalMin: '',
  grandTotalMax: '',
};

function mapToEditableInvoice(item: PurchaseInvoiceListItem): EditableInvoice {
  return {
    id: item.supplierInvoiceNo,
    supplierInvoiceNo: item.supplierInvoiceNo,
    creditorName: item.supplier,
    purchaseAgent: item.agent,
    currency: item.currency,
    docDate: item.date,
    amount: item.amount,
    netTotal: item.grandTotal,
    docNo: item.invoiceNo,
  };
}

function formatMoney(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseFilterDate(value: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatFilterDate(date?: Date) {
  return date ? format(date, 'yyyy-MM-dd') : '';
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function PurchaseInvoice() {
  const router = useRouter();
  const { clearAuthState } = useAuth();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDisplayOpen, setIsDisplayOpen] = useState(false);
  const [selectedSortLabel, setSelectedSortLabel] = useState(sortOptions[0].label);
  const [selectedAutoRefreshLabel, setSelectedAutoRefreshLabel] = useState(autoRefreshOptions[0].label);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [draftFilters, setDraftFilters] = useState<FilterDraft>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterDraft>(defaultFilters);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<EditableInvoice | null>(null);
  const [items, setItems] = useState<PurchaseInvoiceListItem[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [company, setCompany] = useState('');
  const [bookId, setBookId] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [nextPageError, setNextPageError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const displayMenuRef = useRef<HTMLDivElement>(null);
  const latestQueryKeyRef = useRef('');

  const hasMore = totalPages > 0 && page < totalPages;
  const loadedCount = items.length;
  const selectedSortOption = useMemo(
    () => sortOptions.find((option) => option.label === selectedSortLabel) ?? sortOptions[0],
    [selectedSortLabel]
  );
  const selectedAutoRefreshOption = useMemo(
    () => autoRefreshOptions.find((option) => option.label === selectedAutoRefreshLabel) ?? autoRefreshOptions[0],
    [selectedAutoRefreshLabel]
  );
  const currentQuery = useMemo<InvoiceQuery>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      sortBy: selectedSortOption.sortBy,
      sortOrder: selectedSortOption.sortOrder,
      supplier: appliedFilters.supplier.trim() || undefined,
      dateFrom: appliedFilters.dateFrom || undefined,
      dateTo: appliedFilters.dateTo || undefined,
      grandTotalMin: parseOptionalNumber(appliedFilters.grandTotalMin),
      grandTotalMax: parseOptionalNumber(appliedFilters.grandTotalMax),
    }),
    [appliedFilters, debouncedSearch, selectedSortOption]
  );

  const activeFilterCount = useMemo(
    () =>
      [
        currentQuery.search,
        currentQuery.supplier,
        currentQuery.dateFrom,
        currentQuery.dateTo,
        currentQuery.grandTotalMin,
        currentQuery.grandTotalMax,
      ].filter((value) => value !== undefined && value !== '').length,
    [currentQuery]
  );
  const amountBounds = useMemo(() => {
    const itemMax = items.reduce((maxValue, item) => Math.max(maxValue, item.grandTotal), 0);
    const currentMin = parseOptionalNumber(draftFilters.grandTotalMin) ?? 0;
    const currentMax = parseOptionalNumber(draftFilters.grandTotalMax) ?? 0;
    const rawMax = Math.max(itemMax, currentMin, currentMax, 100);
    const roundedMax = rawMax <= 100 ? 100 : Math.ceil(rawMax / 100) * 100;

    return {
      min: 0,
      max: roundedMax,
    };
  }, [draftFilters.grandTotalMax, draftFilters.grandTotalMin, items]);
  const amountRange = useMemo(() => {
    const minValue = clampValue(parseOptionalNumber(draftFilters.grandTotalMin) ?? amountBounds.min, amountBounds.min, amountBounds.max);
    const maxValue = clampValue(parseOptionalNumber(draftFilters.grandTotalMax) ?? amountBounds.max, minValue, amountBounds.max);
    return [minValue, maxValue] as [number, number];
  }, [amountBounds, draftFilters.grandTotalMax, draftFilters.grandTotalMin]);
  const fromDate = useMemo(() => parseFilterDate(draftFilters.dateFrom), [draftFilters.dateFrom]);
  const toDate = useMemo(() => parseFilterDate(draftFilters.dateTo), [draftFilters.dateTo]);

  const handleAuthFailure = useCallback(() => {
    clearAuthState();
    router.replace('/login');
  }, [clearAuthState, router]);

  const loadInvoices = useCallback(
    async (targetPage: number, mode: 'replace' | 'append', query: InvoiceQuery) => {
      const queryKey = JSON.stringify(query);

      if (mode === 'replace') {
        setIsInitialLoading(true);
        setInitialError(null);
        setNextPageError(null);
      } else {
        setIsFetchingNextPage(true);
        setNextPageError(null);
      }

      try {
        const response = await getPurchaseInvoiceList({ page: targetPage, pageSize: PAGE_SIZE, ...query });

        if (latestQueryKeyRef.current !== queryKey) {
          return;
        }

        setPage(response.page);
        setTotal(response.total);
        setTotalPages(response.totalPages);
        setCompany(response.company);
        setBookId(response.bookId);
        setItems((current) => {
          if (mode === 'replace') {
            return response.items;
          }

          const existingKeys = new Set(current.map((item) => item.supplierInvoiceNo));
          const appended = response.items.filter((item) => !existingKeys.has(item.supplierInvoiceNo));
          return current.concat(appended);
        });
      } catch (error) {
        if (latestQueryKeyRef.current !== queryKey) {
          return;
        }

        if (error instanceof ApiRequestError && error.status === 401) {
          handleAuthFailure();
          return;
        }

        const message = getErrorMessage(error, 'Unable to load purchase invoices.');
        if (mode === 'replace') {
          setInitialError(message);
        } else {
          setNextPageError(message);
        }
      } finally {
        if (latestQueryKeyRef.current !== queryKey) {
          return;
        }

        if (mode === 'replace') {
          setIsInitialLoading(false);
        } else {
          setIsFetchingNextPage(false);
        }
      }
    },
    [handleAuthFailure]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedFilters((current) => {
        const next = { ...draftFilters };
        if (JSON.stringify(current) === JSON.stringify(next)) {
          return current;
        }
        return next;
      });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [draftFilters]);

  useEffect(() => {
    const queryKey = JSON.stringify(currentQuery);
    latestQueryKeyRef.current = queryKey;
    setItems([]);
    setPage(0);
    setTotal(0);
    setTotalPages(0);
    setNextPageError(null);
    scrollContainerRef.current?.scrollTo({ top: 0 });
    void loadInvoices(1, 'replace', currentQuery);
  }, [currentQuery, loadInvoices]);

  useEffect(() => {
    const shouldRefresh = sessionStorage.getItem('pi:list:refresh');
    if (!shouldRefresh) {
      return;
    }
    sessionStorage.removeItem('pi:list:refresh');
    latestQueryKeyRef.current = JSON.stringify(currentQuery);
    void loadInvoices(1, 'replace', currentQuery);
  }, [currentQuery, loadInvoices]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (displayMenuRef.current && !displayMenuRef.current.contains(event.target as Node)) {
        setIsDisplayOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!scrollContainerRef.current || !loadMoreRef.current) {
      return;
    }
    if (isInitialLoading || isFetchingNextPage || initialError || nextPageError || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }
        void loadInvoices(page + 1, 'append', currentQuery);
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '0px 0px 320px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [currentQuery, hasMore, initialError, isFetchingNextPage, isInitialLoading, loadInvoices, nextPageError, page]);

  useEffect(() => {
    if (!selectedAutoRefreshOption.intervalMs) {
      return;
    }

    const timer = window.setInterval(() => {
      latestQueryKeyRef.current = JSON.stringify(currentQuery);
      void loadInvoices(1, 'replace', currentQuery);
    }, selectedAutoRefreshOption.intervalMs);

    return () => window.clearInterval(timer);
  }, [currentQuery, loadInvoices, selectedAutoRefreshOption.intervalMs]);

  const handleDeleteClick = (invoice: EditableInvoice) => {
    setInvoiceToDelete(invoice);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (invoiceToDelete) {
      console.log('Delete invoice:', invoiceToDelete.id);
    }
  };

  const handleApplyFilters = () => {
    setAppliedFilters({ ...draftFilters });
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setDraftFilters({ ...defaultFilters });
    setAppliedFilters({ ...defaultFilters });
    setSelectedSortLabel(sortOptions[0].label);
  };

  const renderedInvoices = useMemo(() => items.map(mapToEditableInvoice), [items]);

  const renderTable = () => {
    if (isInitialLoading) {
      return (
        <div className="flex h-full items-center justify-center px-6 py-10">
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <LoaderCircle size={18} className="animate-spin text-zinc-500" />
            Loading purchase invoices...
          </div>
        </div>
      );
    }

    if (initialError) {
      return (
        <div className="flex h-full items-center justify-center px-6 py-10">
          <div className="max-w-md text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center text-red-500">
              <AlertCircle size={20} />
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-900">Could not load invoices</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{initialError}</p>
            <button
              type="button"
              onClick={() => void loadInvoices(1, 'replace', currentQuery)}
              className="mt-5 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    if (renderedInvoices.length === 0) {
      return (
        <div className="flex h-full items-center justify-center px-6 py-10">
          <div className="max-w-lg px-6 py-4 text-center">
            <div className="space-y-5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center text-zinc-700">
                <Receipt size={28} strokeWidth={1.9} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950">
                  {activeFilterCount > 0 ? 'No invoices match these filters' : 'No purchase invoices yet'}
                </h3>
                <p className="mx-auto max-w-md text-sm leading-6 text-zinc-600">
                  {activeFilterCount > 0
                    ? 'Try broadening your search, adjusting the supplier, or widening the amount and date range.'
                    : company
                      ? `${company} does not have any purchase invoices yet. Start by creating the first one for this workspace.`
                      : 'This company database is currently empty.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {activeFilterCount === 0 ? (
                  <Button
                    type="button"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="rounded-xl px-4 py-2.5 text-sm"
                  >
                    <Plus size={16} />
                    Create Invoice
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleResetFilters}
                    className="rounded-xl px-4 py-2.5 text-sm"
                  >
                    Clear Filters
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void loadInvoices(1, 'replace', currentQuery)}
                  className="rounded-xl px-4 py-2.5 text-sm"
                >
                  Reload List
                </Button>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-900"
              >
                {activeFilterCount > 0 ? 'Need a wider result set?' : 'Invoice sync becomes visible here'}
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 z-10 bg-white shadow-sm">
            <tr>
              <th className="bg-white pl-6 pr-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <FileDigit size={12} className="text-zinc-400" />
                  <span>Invoice No</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Hash size={12} className="text-zinc-400" />
                  <span>Supplier Invoice No</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Store size={12} className="text-zinc-400" />
                  <span>Supplier</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <User size={12} className="text-zinc-400" />
                  <span>Agent</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Coins size={12} className="text-zinc-400" />
                  <span>Currency</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <CalendarIcon size={12} className="text-zinc-400" />
                  <span>Date</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <CircleDollarSign size={12} className="text-zinc-400" />
                  <span>GrandTotal</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Wallet size={12} className="text-zinc-400" />
                  <span>Amount</span>
                </div>
              </th>
              <th className="bg-white pl-3 pr-6 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Settings2 size={12} className="text-zinc-400" />
                  <span>Actions</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {renderedInvoices.map((invoice) => (
              <tr key={invoice.id} className="group">
                <td className="pl-6 pr-3 py-1.5 text-zinc-600">
                  <div className="flex items-center gap-1.5">
                    <FileDigit size={12} className="text-zinc-400" />
                    <span className="font-semibold text-zinc-900">{invoice.docNo}</span>
                  </div>
                </td>
                <td className="px-3 py-1.5 font-medium text-zinc-600">{invoice.supplierInvoiceNo}</td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Building2 size={14} className="text-blue-500/70" />
                    <span className="max-w-[160px] truncate font-medium text-zinc-900" title={invoice.creditorName}>
                      {invoice.creditorName}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <User size={14} className="text-emerald-500/70" />
                    <span className="max-w-[120px] truncate font-medium text-zinc-700" title={invoice.purchaseAgent}>
                      {invoice.purchaseAgent}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  <span className="rounded-full border border-zinc-200/60 bg-zinc-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                    {invoice.currency}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-zinc-400">{invoice.docDate}</td>
                <td className="px-3 py-1.5">
                  <span className="text-[12px] font-bold text-emerald-600">{formatMoney(invoice.netTotal)}</span>
                </td>
                <td className="px-3 py-1.5 font-medium text-zinc-500">{formatMoney(invoice.amount)}</td>
                <td className="pl-3 pr-6 py-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="flex cursor-not-allowed items-center gap-1 rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-zinc-400 shadow-sm opacity-70"
                      title="Edit disabled"
                    >
                      <Pencil size={10} />
                      <span className="text-[10px] font-semibold">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(invoice)}
                      className="flex items-center gap-1 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-zinc-900 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50"
                      title="Delete"
                    >
                      <Trash2 size={10} className="text-red-500" />
                      <span className="text-[10px] font-semibold">Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div ref={loadMoreRef} className="flex flex-col items-center justify-center gap-2 px-6 py-5 text-xs text-zinc-500">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2">
              <LoaderCircle size={14} className="animate-spin" />
              Loading more invoices...
            </div>
          )}
          {!isFetchingNextPage && nextPageError && (
            <>
              <p className="text-red-600">{nextPageError}</p>
              <button
                type="button"
                onClick={() => void loadInvoices(page + 1, 'append', currentQuery)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                Retry load more
              </button>
            </>
          )}
          {!isFetchingNextPage && !nextPageError && hasMore && <p>Scroll down to load the next page.</p>}
          {!hasMore && <p>No more invoices.</p>}
        </div>
      </>
    );
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="invoice-list"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex h-full flex-col bg-white font-sans"
      >
          <div className="shrink-0 border-b border-zinc-200 px-6 py-2">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="cursor-pointer transition-colors hover:text-zinc-900">Procurement</span>
              <ChevronRight size={12} className="text-zinc-400" />
              <div className="flex items-center gap-1.5 font-medium text-zinc-900">
                <FileText size={12} />
                <span>Purchase Invoice</span>
              </div>
            </div>
          </div>

          <div className="shrink-0 px-6 pb-1 pt-4">
            <div className="mb-0.5 flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-zinc-900">Purchase Invoice</h1>
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                {isInitialLoading ? '...' : total}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              {company
                ? `Loaded ${loadedCount} of ${total} invoices for ${company}${bookId ? ` | ${bookId}` : ''}.`
                : 'Manage your purchase invoices and load more results as you scroll.'}
            </p>
          </div>

          <div className="flex min-h-[40px] shrink-0 flex-col gap-3 px-6 py-2">
            <div className="flex items-center justify-between gap-4">
              <div className="group relative max-w-md flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-blue-500" />
                <Input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search doc id, supplier, agent, date, amount, or invoice no"
                  className="bg-zinc-50 py-1.5 pl-9 pr-4 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="relative" ref={displayMenuRef}>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setIsDisplayOpen((open) => !open)}
                    className={`flex h-9 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-all shadow-sm ${
                      isDisplayOpen
                        ? 'border-zinc-300 bg-zinc-50 text-zinc-900'
                        : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    <ArrowUpDown size={14} />
                    <span>Display</span>
                  </motion.button>

                  <AnimatePresence>
                    {isDisplayOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="absolute right-0 top-full z-50 mt-2 w-72 origin-top overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg"
                      >
                        <div className="p-3">
                          <div className="mb-4">
                            <h3 className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                              <ArrowUpDown size={12} />
                              Sort By
                            </h3>
                            <div className="space-y-1">
                              {sortOptions.map((option) => (
                                <button
                                  key={option.label}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSortLabel(option.label);
                                    setIsDisplayOpen(false);
                                  }}
                                  className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-xs text-zinc-700 transition hover:bg-zinc-50"
                                >
                                  <div
                                    className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                                      selectedSortLabel === option.label ? 'border-blue-600' : 'border-zinc-300'
                                    }`}
                                  >
                                    {selectedSortLabel === option.label && <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />}
                                  </div>
                                  <span>{option.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h3 className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                              <Clock3 size={12} />
                              Auto Refresh
                            </h3>
                            <div className="space-y-1">
                              {autoRefreshOptions.map((option) => (
                                <button
                                  key={option.label}
                                  type="button"
                                  onClick={() => setSelectedAutoRefreshLabel(option.label)}
                                  className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-xs text-zinc-700 transition hover:bg-zinc-50"
                                >
                                  <div
                                    className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                                      selectedAutoRefreshLabel === option.label ? 'border-blue-600' : 'border-zinc-300'
                                    }`}
                                  >
                                    {selectedAutoRefreshLabel === option.label && (
                                      <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                                    )}
                                  </div>
                                  <span>{option.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">
                            Server-side search and sort are live. Auto refresh reloads the current query.
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50/50"
                >
                  <Plus size={14} className="text-blue-600" />
                  <span>Create Invoice</span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 px-3 py-3">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <Input
                  type="text"
                  value={draftFilters.supplier}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      supplier: event.target.value,
                    }))
                  }
                  placeholder="Supplier contains"
                  className="bg-white text-xs"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      data-empty={!fromDate}
                      className="h-9 w-full justify-between rounded-md text-left text-xs font-normal data-[empty=true]:text-zinc-400"
                    >
                      {fromDate ? format(fromDate, 'PPP') : <span>From date</span>}
                      <ChevronDownIcon size={14} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fromDate}
                      onSelect={(date) =>
                        setDraftFilters((current) => ({
                          ...current,
                          dateFrom: formatFilterDate(date),
                        }))
                      }
                      defaultMonth={fromDate}
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      data-empty={!toDate}
                      className="h-9 w-full justify-between rounded-md text-left text-xs font-normal data-[empty=true]:text-zinc-400"
                    >
                      {toDate ? format(toDate, 'PPP') : <span>To date</span>}
                      <ChevronDownIcon size={14} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={toDate}
                      onSelect={(date) =>
                        setDraftFilters((current) => ({
                          ...current,
                          dateTo: formatFilterDate(date),
                        }))
                      }
                      defaultMonth={toDate ?? fromDate}
                    />
                  </PopoverContent>
                </Popover>
                <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3 xl:col-span-1">
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="font-semibold text-zinc-700">Grand total range</span>
                    <span className="text-zinc-500">
                      {formatMoney(amountRange[0])} - {formatMoney(amountRange[1])}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={draftFilters.grandTotalMin}
                      onChange={(event) =>
                        setDraftFilters((current) => ({
                          ...current,
                          grandTotalMin: event.target.value,
                        }))
                      }
                      placeholder="Min"
                      className="h-9 text-xs"
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={draftFilters.grandTotalMax}
                      onChange={(event) =>
                        setDraftFilters((current) => ({
                          ...current,
                          grandTotalMax: event.target.value,
                        }))
                      }
                      placeholder="Max"
                      className="h-9 text-xs"
                    />
                  </div>
                  <Slider
                    min={amountBounds.min}
                    max={amountBounds.max}
                    step={1}
                    value={amountRange}
                    minStepsBetweenThumbs={1}
                    onValueChange={(nextRange) => {
                      const [nextMin, nextMax] = nextRange as number[];
                      setDraftFilters((current) => ({
                        ...current,
                        grandTotalMin: String(Math.round(nextMin)),
                        grandTotalMax: String(Math.round(nextMax)),
                      }));
                    }}
                    className="mt-4"
                  />
                  <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>{formatMoney(amountBounds.min)}</span>
                    <span>{formatMoney(amountBounds.max)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-zinc-500">
                  API filters: supplier, date range, grand total range, and keyword search. Active filters: {activeFilterCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetFilters}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyFilters}
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div ref={scrollContainerRef} className="flex-1 overflow-auto">
            {renderTable()}
          </div>

          <UploadInvoiceModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onSuccess={(preview) => {
              if (preview.taskId) {
                const target = `/purchase-invoice/${preview.taskId}`;
                router.prefetch(target);
                router.push(target);
                setIsUploadModalOpen(false);
              } else {
                toast.error('Preview task ID is missing. Please retry the upload.');
              }
            }}
          />

          <DeleteConfirmModal
            isOpen={deleteConfirmOpen}
            onClose={() => setDeleteConfirmOpen(false)}
            onConfirm={handleDeleteConfirm}
            title="Delete Invoice"
            itemName={invoiceToDelete?.supplierInvoiceNo}
            message="This invoice will be permanently removed from your records."
          />
      </motion.div>
    </AnimatePresence>
  );
}
