'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Pencil,
  Trash2,
  Hash,
  FileText,
  Layers,
  Tag,
  Scale,
  ShieldAlert,
  Plus,
  Search,
  ArrowUpDown,
  Clock,
  Package,
  Activity,
  Settings2,
  AlertCircle,
  LoaderCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { ApiRequestError } from '../lib/auth-api';
import type { GetStockListParams, StockListItem, StockSortBy, StockSortOrder } from '../lib/stock-api';
import { getStockList } from '../lib/stock-api';

type SortOption = {
  label: string;
  sortBy: StockSortBy;
  sortOrder: StockSortOrder;
};

type AutoRefreshOption = {
  label: string;
  intervalMs: number | null;
};

type StockQuery = Omit<GetStockListParams, 'pageSize' | 'page' | 'accessToken' | 'bookId'>;

type PrefetchedStockPage = {
  queryKey: string;
  page: number;
  items: StockListItem[];
  total: number;
  hasNext: boolean;
};

const PAGE_SIZE = 20;

const sortOptions: SortOption[] = [
  { label: 'Item code A-Z', sortBy: 'itemCode', sortOrder: 'asc' },
  { label: 'Item code Z-A', sortBy: 'itemCode', sortOrder: 'desc' },
  { label: 'Description A-Z', sortBy: 'description', sortOrder: 'asc' },
  { label: 'Description Z-A', sortBy: 'description', sortOrder: 'desc' },
];

const autoRefreshOptions: AutoRefreshOption[] = [
  { label: 'OFF', intervalMs: null },
  { label: 'Every 5 minutes', intervalMs: 5 * 60 * 1000 },
  { label: 'Every 10 minutes', intervalMs: 10 * 60 * 1000 },
];

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function StockManage() {
  const router = useRouter();
  const { profile, accessToken, clearAuthState } = useAuth();
  const [items, setItems] = useState<StockListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [prefetchedPage, setPrefetchedPage] = useState<PrefetchedStockPage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isDisplayOpen, setIsDisplayOpen] = useState(false);
  const [selectedSortLabel, setSelectedSortLabel] = useState(sortOptions[0].label);
  const [selectedAutoRefreshLabel, setSelectedAutoRefreshLabel] = useState(autoRefreshOptions[0].label);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [isPrefetchingNextPage, setIsPrefetchingNextPage] = useState(false);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [nextPageError, setNextPageError] = useState<string | null>(null);
  const displayMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const latestQueryKeyRef = useRef('');
  const prefetchRequestKeyRef = useRef<string | null>(null);
  const prefetchedPageRef = useRef<PrefetchedStockPage | null>(null);
  const selectedSortOption = useMemo(
    () => sortOptions.find((option) => option.label === selectedSortLabel) ?? sortOptions[0],
    [selectedSortLabel]
  );
  const selectedAutoRefreshOption = useMemo(
    () => autoRefreshOptions.find((option) => option.label === selectedAutoRefreshLabel) ?? autoRefreshOptions[0],
    [selectedAutoRefreshLabel]
  );
  const currentQuery = useMemo<StockQuery>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      sortBy: selectedSortOption.sortBy,
      sortOrder: selectedSortOption.sortOrder,
    }),
    [debouncedSearch, selectedSortOption]
  );

  useEffect(() => {
    prefetchedPageRef.current = prefetchedPage;
  }, [prefetchedPage]);

  const handleAuthFailure = useCallback(() => {
    void clearAuthState();
    router.replace('/login');
  }, [clearAuthState, router]);

  const fetchStocks = useCallback(
    async (page: number, query: StockQuery) => {
      if (!profile || !accessToken) {
        throw new ApiRequestError('Your session is not ready yet.', 401);
      }

      return getStockList({
        pageSize: PAGE_SIZE,
        page,
        accessToken,
        bookId: profile.bookId,
        ...query,
      });
    },
    [accessToken, profile]
  );

  const applyStockPage = useCallback(
    (
      response: {
        items: StockListItem[];
        total: number;
        page: number;
        hasNext: boolean;
      },
      mode: 'replace' | 'append'
    ) => {
      setTotal(response.total);
      setCurrentPage(response.page);
      setHasNext(response.hasNext);
      setItems((current) => {
        if (mode === 'replace') {
          return response.items;
        }

        const existingCodes = new Set(current.map((item) => item.itemCode));
        const appended = response.items.filter((item) => !existingCodes.has(item.itemCode));
        return current.concat(appended);
      });
    },
    []
  );

  const prefetchStocks = useCallback(
    async (hasNextPage: boolean, loadedPage: number, query: StockQuery) => {
      const queryKey = JSON.stringify(query);

      if (!hasNextPage) {
        prefetchRequestKeyRef.current = null;
        setPrefetchedPage(null);
        setIsPrefetchingNextPage(false);
        return;
      }

      if (latestQueryKeyRef.current !== queryKey) {
        return;
      }

      const nextPage = loadedPage + 1;

      if (prefetchedPageRef.current?.queryKey === queryKey && prefetchedPageRef.current.page === nextPage) {
        return;
      }

      const requestKey = `${queryKey}:${nextPage}`;
      if (prefetchRequestKeyRef.current === requestKey) {
        return;
      }

      prefetchRequestKeyRef.current = requestKey;
      setIsPrefetchingNextPage(true);

      try {
        const response = await fetchStocks(nextPage, query);
        if (latestQueryKeyRef.current !== queryKey || prefetchRequestKeyRef.current !== requestKey) {
          return;
        }

        setPrefetchedPage({
          queryKey,
          page: nextPage,
          items: response.items,
          total: response.total,
          hasNext: response.hasNext,
        });
      } catch {
        if (latestQueryKeyRef.current === queryKey && prefetchRequestKeyRef.current === requestKey) {
          setPrefetchedPage(null);
        }
      } finally {
        if (prefetchRequestKeyRef.current === requestKey) {
          prefetchRequestKeyRef.current = null;
          setIsPrefetchingNextPage(false);
        }
      }
    },
    [fetchStocks]
  );

  const loadStocks = useCallback(
    async (page: number, mode: 'replace' | 'append', query: StockQuery) => {
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
        const response = await fetchStocks(page, query);

        if (latestQueryKeyRef.current !== queryKey) {
          return;
        }

        applyStockPage(response, mode);
        setPrefetchedPage(null);
        void prefetchStocks(response.hasNext, response.page, query);
      } catch (error) {
        if (latestQueryKeyRef.current !== queryKey) {
          return;
        }

        if (error instanceof ApiRequestError && error.status === 401) {
          handleAuthFailure();
          return;
        }

        const message = getErrorMessage(error, 'Unable to load stock items.');
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
    [applyStockPage, fetchStocks, handleAuthFailure, prefetchStocks]
  );

  const loadNextPage = useCallback(async () => {
    if (!hasNext || isInitialLoading || isFetchingNextPage || !profile) {
      return;
    }

    const queryKey = JSON.stringify(currentQuery);
    const nextPage = currentPage + 1;
    setNextPageError(null);
    setIsFetchingNextPage(true);

    try {
      const response =
        prefetchedPageRef.current?.queryKey === queryKey && prefetchedPageRef.current.page === nextPage
          ? prefetchedPageRef.current
          : await fetchStocks(nextPage, currentQuery);

      if (latestQueryKeyRef.current !== queryKey) {
        return;
      }

      applyStockPage(response, 'append');
      setPrefetchedPage(null);
      void prefetchStocks(response.hasNext, response.page, currentQuery);
    } catch (error) {
      if (latestQueryKeyRef.current !== queryKey) {
        return;
      }

      if (error instanceof ApiRequestError && error.status === 401) {
        handleAuthFailure();
        return;
      }

      setNextPageError(getErrorMessage(error, 'Unable to load more stock items.'));
    } finally {
      if (latestQueryKeyRef.current !== queryKey) {
        return;
      }

      setIsFetchingNextPage(false);
    }
  }, [
    applyStockPage,
    currentPage,
    currentQuery,
    fetchStocks,
    handleAuthFailure,
    hasNext,
    isFetchingNextPage,
    isInitialLoading,
    prefetchStocks,
    profile,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const queryKey = JSON.stringify(currentQuery);
    latestQueryKeyRef.current = queryKey;
    prefetchRequestKeyRef.current = null;
    setItems([]);
    setTotal(0);
    setCurrentPage(1);
    setHasNext(false);
    setPrefetchedPage(null);
    setIsPrefetchingNextPage(false);
    setNextPageError(null);
    scrollContainerRef.current?.scrollTo({ top: 0 });
    void loadStocks(1, 'replace', currentQuery);
  }, [currentQuery, loadStocks, profile]);

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
    if (isInitialLoading || isFetchingNextPage || initialError || nextPageError || !hasNext) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }
        void loadNextPage();
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '0px 0px 640px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNext, initialError, isFetchingNextPage, isInitialLoading, loadNextPage, nextPageError]);

  useEffect(() => {
    if (!selectedAutoRefreshOption.intervalMs || !profile) {
      return;
    }

    const timer = window.setInterval(() => {
      latestQueryKeyRef.current = JSON.stringify(currentQuery);
      prefetchRequestKeyRef.current = null;
      setPrefetchedPage(null);
      void loadStocks(1, 'replace', currentQuery);
    }, selectedAutoRefreshOption.intervalMs);

    return () => window.clearInterval(timer);
  }, [currentQuery, loadStocks, profile, selectedAutoRefreshOption.intervalMs]);

  const renderTable = () => {
    if (isInitialLoading) {
      return (
        <div className="flex h-full items-center justify-center px-6 py-10">
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <LoaderCircle size={18} className="animate-spin text-zinc-500" />
            <span>Loading stock items...</span>
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
            <h3 className="mt-4 text-base font-semibold text-zinc-900">Could not load stock items</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{initialError}</p>
            <button
              type="button"
              onClick={() => void loadStocks(1, 'replace', currentQuery)}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="flex h-full items-center justify-center px-6 py-10">
          <div className="max-w-lg px-6 py-4 text-center">
            <div className="space-y-5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center text-zinc-700">
                <Package size={28} strokeWidth={1.9} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950">
                  {debouncedSearch ? 'No stock items match this search' : 'No stock items yet'}
                </h3>
                <p className="mx-auto max-w-md text-sm leading-6 text-zinc-600">
                  {debouncedSearch
                    ? 'Try broadening your search or checking the item code and description.'
                    : 'This company database is currently empty.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {debouncedSearch ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                  >
                    Clear Search
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-500"
                  >
                    Add Item
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void loadStocks(1, 'replace', currentQuery)}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                >
                  Reload List
                </button>
              </div>
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
                  <Hash size={12} className="text-zinc-400" />
                  <span>Item Code</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <FileText size={12} className="text-zinc-400" />
                  <span>Description</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Layers size={12} className="text-zinc-400" />
                  <span>Group</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Tag size={12} className="text-zinc-400" />
                  <span>Type</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Scale size={12} className="text-zinc-400" />
                  <span>Base UOM</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert size={12} className="text-zinc-400" />
                  <span>Control</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Activity size={12} className="text-zinc-400" />
                  <span>Active</span>
                </div>
              </th>
              <th className="bg-white pl-3 pr-6 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Settings2 size={12} className="text-zinc-400" />
                  <span>Action</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.itemCode} className="group">
                <td className="pl-6 pr-3 py-1.5 font-mono font-medium text-zinc-900">{item.itemCode}</td>
                <td className="px-3 py-1.5">
                  <div className="flex flex-col">
                    <span className="max-w-[220px] truncate font-medium text-zinc-900" title={item.description}>
                      {item.description}
                    </span>
                    {item.description2 ? <span className="max-w-[220px] truncate text-[9px] text-zinc-500">{item.description2}</span> : null}
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  <span className="rounded-full border border-zinc-200/60 bg-zinc-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-600">
                    {item.group || '-'}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  {item.type ? (
                    <span className="rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-600">
                      {item.type}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-1.5 font-medium text-zinc-600">{item.baseUOM || '-'}</td>
                <td className="px-3 py-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      item.control
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-zinc-200 bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {item.control ? 'Controlled' : 'Open'}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      item.active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                        : 'border-zinc-200 bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {item.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="pl-3 pr-6 py-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      disabled
                      className="flex cursor-not-allowed items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-zinc-400 shadow-sm"
                      title="Temporarily disabled"
                    >
                      <Pencil size={10} />
                      <span className="text-[10px] font-semibold">Edit</span>
                    </button>
                    <button
                      disabled
                      className="flex cursor-not-allowed items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-zinc-400 shadow-sm"
                      title="Temporarily disabled"
                    >
                      <Trash2 size={10} />
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
              Loading more items...
            </div>
          )}
          {!isFetchingNextPage && nextPageError && (
            <>
              <p className="text-red-600">{nextPageError}</p>
              <button
                type="button"
                onClick={() => void loadNextPage()}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                Retry load more
              </button>
            </>
          )}
          {!isFetchingNextPage && !nextPageError && hasNext && (
            <p>{isPrefetchingNextPage ? 'Preparing the next page...' : 'Scroll down to load the next page.'}</p>
          )}
          {!hasNext && <p>No more stock items.</p>}
        </div>
      </>
    );
  };

  return (
    <motion.div
      key="stock-list"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex h-full flex-col bg-white font-sans"
    >
      <div className="shrink-0 border-b border-zinc-200 px-6 py-2">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="cursor-pointer transition-colors hover:text-zinc-900">Inventory</span>
          <ChevronRight size={12} className="text-zinc-400" />
          <div className="flex items-center gap-1.5 font-medium text-zinc-900">
            <Package size={12} />
            <span>Stock Manage</span>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-6 pb-1 pt-4">
        <div className="mb-0.5 flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Stock Manage</h1>
          <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
            {isInitialLoading ? '...' : total}
          </span>
        </div>

        <p className="text-xs text-zinc-500">
          {total > 0
            ? `Loaded ${items.length} of ${total} stock items.`
            : 'Manage your inventory items, classifications, and stock control settings.'}
        </p>
      </div>

      <div className="flex min-h-[40px] shrink-0 items-center justify-between gap-4 px-6 py-2">
        <div className="group relative max-w-md flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-blue-500" />
          <input
            type="text"
            placeholder="Search item code, description, group, type, or base UOM..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pl-9 pr-4 text-xs text-zinc-900 transition-all placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={displayMenuRef}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => setIsDisplayOpen((open) => !open)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-all shadow-sm ${
                isDisplayOpen
                  ? 'border-blue-600 bg-blue-50/50 text-blue-600'
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
                  className="absolute right-0 top-full z-50 mt-2 w-64 origin-top overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg"
                >
                  <div className="max-h-[400px] overflow-y-auto p-3">
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
                        <Clock size={12} />
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
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            disabled
            className="flex cursor-not-allowed items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-400 shadow-sm"
          >
            <Plus size={14} className="text-zinc-400" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      <div className="shrink-0 px-6 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span className="font-medium text-zinc-700">Search scope</span>
            <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5">Item code</span>
            <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5">Description</span>
            <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5">Group</span>
            <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5">Type</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            {debouncedSearch ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="rounded-full border border-zinc-300 bg-white px-2 py-0.5 font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100"
              >
                Query: {debouncedSearch}
              </button>
            ) : null}
            <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5">Sort: {selectedSortOption.label}</span>
            <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5">Refresh: {selectedAutoRefreshLabel}</span>
          </div>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        {renderTable()}
      </div>
    </motion.div>
  );
}
