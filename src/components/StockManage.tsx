'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Eye,
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
import StockDetailModal from './StockDetailModal';
import StockGroupDetailModal, { type StockGroupListItem } from './StockGroupDetailModal';
type TaxCodeListItem = {
  taxCode: string;
  description: string;
  taxRate: number;
  inclusive: boolean;
  active: boolean;
  taxAccNo: string;
  isDefault: boolean;
  supplyPurchase: string;
  taxSystem: string;
};

type SgSortOption = {
  label: string;
  sortBy: 'itemGroup' | 'description' | 'shortCode' | 'purchaseCode';
  sortOrder: 'asc' | 'desc';
};

const sgSortOptions: SgSortOption[] = [
  { label: 'Group A-Z', sortBy: 'itemGroup', sortOrder: 'asc' },
  { label: 'Group Z-A', sortBy: 'itemGroup', sortOrder: 'desc' },
  { label: 'Description A-Z', sortBy: 'description', sortOrder: 'asc' },
  { label: 'Description Z-A', sortBy: 'description', sortOrder: 'desc' },
  { label: 'Short code A-Z', sortBy: 'shortCode', sortOrder: 'asc' },
  { label: 'Purchase code A-Z', sortBy: 'purchaseCode', sortOrder: 'asc' },
];

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
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailItemCode, setDetailItemCode] = useState('');

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'stock' | 'stockgroup' | 'taxcode'>('stock');

  // ── Stock Group tab state ─────────────────────────────────────────────────
  const [sgItems, setSgItems] = useState<StockGroupListItem[]>([]);
  const [sgTotal, setSgTotal] = useState(0);
  const [sgCurrentPage, setSgCurrentPage] = useState(1);
  const [sgHasNext, setSgHasNext] = useState(false);
  const [sgSearch, setSgSearch] = useState('');
  const [sgDebouncedSearch, setSgDebouncedSearch] = useState('');
  const [sgSortLabel, setSgSortLabel] = useState(sgSortOptions[0].label);
  const [sgIsDisplayOpen, setSgIsDisplayOpen] = useState(false);
  const [sgIsLoading, setSgIsLoading] = useState(false);
  const [sgIsFetchingNext, setSgIsFetchingNext] = useState(false);
  const [sgInitialError, setSgInitialError] = useState<string | null>(null);
  const [sgNextError, setSgNextError] = useState<string | null>(null);
  const [sgDetailOpen, setSgDetailOpen] = useState(false);
  const [sgDetailItem, setSgDetailItem] = useState<StockGroupListItem | null>(null);

  // ── Tax Code tab state ────────────────────────────────────────────────────
  const [tcItems, setTcItems] = useState<TaxCodeListItem[]>([]);
  const [tcTotal, setTcTotal] = useState(0);
  const [tcCurrentPage, setTcCurrentPage] = useState(1);
  const [tcHasNext, setTcHasNext] = useState(false);
  const [tcSearch, setTcSearch] = useState('');
  const [tcDebouncedSearch, setTcDebouncedSearch] = useState('');
  const [tcSortOrder, setTcSortOrder] = useState<'asc' | 'desc'>('asc');
  const [tcIsLoading, setTcIsLoading] = useState(false);
  const [tcIsFetchingNext, setTcIsFetchingNext] = useState(false);
  const [tcInitialError, setTcInitialError] = useState<string | null>(null);
  const [tcNextError, setTcNextError] = useState<string | null>(null);
  const tcScrollRef = useRef<HTMLDivElement | null>(null);
  const tcLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const tcLatestQueryRef = useRef('');

  const displayMenuRef = useRef<HTMLDivElement>(null);
  const sgDisplayMenuRef = useRef<HTMLDivElement>(null);
  const sgScrollRef = useRef<HTMLDivElement | null>(null);
  const sgLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const sgLatestQueryRef = useRef('');
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
  const sgSortOption = useMemo(
    () => sgSortOptions.find((o) => o.label === sgSortLabel) ?? sgSortOptions[0],
    [sgSortLabel]
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
        throw new ApiRequestError('Your session is not ready yet.', 503);
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

  // ── Stock Group: fetch + load ─────────────────────────────────────────────
  const fetchStockGroups = useCallback(
    async (page: number, search: string, sortBy: string, sortOrder: string) => {
      if (!profile || !accessToken) throw new ApiRequestError('Session not ready.', 503);
      const query = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search.trim()) query.set('search', search.trim());
      query.set('sortBy', sortBy);
      query.set('sortOrder', sortOrder);
      const res = await fetch(`/api/stockgroup?${query.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}`, 'X-Book-Id': profile.bookId },
        cache: 'no-store',
      });
      const payload = (await res.json().catch(() => null)) as {
        total?: number; page?: number; hasNext?: boolean; items?: StockGroupListItem[];
        error?: string;
      } | null;
      if (!res.ok) throw new ApiRequestError('Unable to load stock groups.', res.status);
      return payload;
    },
    [accessToken, profile]
  );

  const loadStockGroupNextPage = useCallback(async () => {
    if (!sgHasNext || sgIsLoading || sgIsFetchingNext || !profile) return;
    const queryKey = JSON.stringify({ sgDebouncedSearch, sgSortOption });
    if (sgLatestQueryRef.current !== queryKey) return;
    setSgIsFetchingNext(true);
    setSgNextError(null);
    try {
      const nextPage = sgCurrentPage + 1;
      const data = await fetchStockGroups(nextPage, sgDebouncedSearch, sgSortOption.sortBy, sgSortOption.sortOrder);
      if (sgLatestQueryRef.current !== queryKey) return;
      setSgTotal(data?.total ?? 0);
      setSgCurrentPage(data?.page ?? nextPage);
      setSgHasNext(Boolean(data?.hasNext));
      setSgItems((prev) => {
        const existing = new Set(prev.map((i) => i.itemGroup));
        return prev.concat((data?.items ?? []).filter((i) => !existing.has(i.itemGroup)));
      });
    } catch (error) {
      if (sgLatestQueryRef.current !== queryKey) return;
      if (error instanceof ApiRequestError && error.status === 401) { handleAuthFailure(); return; }
      setSgNextError(getErrorMessage(error, 'Unable to load more stock groups.'));
    } finally {
      setSgIsFetchingNext(false);
    }
  }, [sgHasNext, sgIsLoading, sgIsFetchingNext, profile, sgCurrentPage, sgDebouncedSearch, sgSortOption, fetchStockGroups, handleAuthFailure]);

  // Stock Group: debounce search
  useEffect(() => {
    const timer = window.setTimeout(() => setSgDebouncedSearch(sgSearch), 500);
    return () => window.clearTimeout(timer);
  }, [sgSearch]);

  // Stock Group: reload on tab + query change
  useEffect(() => {
    if (activeTab !== 'stockgroup' || !profile) return;
    const queryKey = JSON.stringify({ sgDebouncedSearch, sgSortOption });
    sgLatestQueryRef.current = queryKey;
    setSgItems([]);
    setSgTotal(0);
    setSgCurrentPage(1);
    setSgHasNext(false);
    setSgInitialError(null);
    setSgNextError(null);
    sgScrollRef.current?.scrollTo({ top: 0 });
    setSgIsLoading(true);
    fetchStockGroups(1, sgDebouncedSearch, sgSortOption.sortBy, sgSortOption.sortOrder)
      .then((data) => {
        if (sgLatestQueryRef.current !== queryKey) return;
        setSgTotal(data?.total ?? 0);
        setSgCurrentPage(data?.page ?? 1);
        setSgHasNext(Boolean(data?.hasNext));
        setSgItems(data?.items ?? []);
      })
      .catch((err) => {
        if (sgLatestQueryRef.current !== queryKey) return;
        if (err instanceof ApiRequestError && err.status === 401) { handleAuthFailure(); return; }
        setSgInitialError(getErrorMessage(err, 'Unable to load stock groups.'));
      })
      .finally(() => setSgIsLoading(false));
  }, [activeTab, sgDebouncedSearch, sgSortOption, profile, fetchStockGroups, handleAuthFailure]);

  // Stock Group: infinite scroll
  useEffect(() => {
    if (!sgScrollRef.current || !sgLoadMoreRef.current) return;
    if (sgIsLoading || sgIsFetchingNext || sgInitialError || sgNextError || !sgHasNext) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void loadStockGroupNextPage(); },
      { root: sgScrollRef.current, rootMargin: '0px 0px 400px 0px', threshold: 0.01 }
    );
    observer.observe(sgLoadMoreRef.current);
    return () => observer.disconnect();
  }, [sgHasNext, sgInitialError, sgIsFetchingNext, sgIsLoading, sgNextError, loadStockGroupNextPage]);

  // Stock Group: click-outside display menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sgDisplayMenuRef.current && !sgDisplayMenuRef.current.contains(event.target as Node)) {
        setSgIsDisplayOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Tax Code: fetch + effects ─────────────────────────────────────────────
  const fetchTaxCodes = useCallback(
    async (page: number, search: string, sortOrder: 'asc' | 'desc') => {
      if (!profile || !accessToken) throw new ApiRequestError('Session not ready.', 503);
      const query = new URLSearchParams({ page: String(page), pageSize: '20', sortBy: 'taxCode', sortOrder });
      if (search.trim()) query.set('search', search.trim());
      const res = await fetch(`/api/taxcode?${query.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}`, 'X-Book-Id': profile.bookId },
        cache: 'no-store',
      });
      const payload = (await res.json().catch(() => null)) as {
        total?: number; page?: number; hasNext?: boolean; items?: TaxCodeListItem[];
      } | null;
      if (!res.ok) throw new ApiRequestError('Unable to load tax codes.', res.status);
      return payload;
    },
    [accessToken, profile]
  );

  const loadTaxCodeNextPage = useCallback(async () => {
    if (!tcHasNext || tcIsLoading || tcIsFetchingNext || !profile) return;
    const queryKey = JSON.stringify({ tcDebouncedSearch, tcSortOrder });
    if (tcLatestQueryRef.current !== queryKey) return;
    setTcIsFetchingNext(true);
    setTcNextError(null);
    try {
      const nextPage = tcCurrentPage + 1;
      const data = await fetchTaxCodes(nextPage, tcDebouncedSearch, tcSortOrder);
      if (tcLatestQueryRef.current !== queryKey) return;
      setTcTotal(data?.total ?? 0);
      setTcCurrentPage(data?.page ?? nextPage);
      setTcHasNext(Boolean(data?.hasNext));
      setTcItems((prev) => {
        const existing = new Set(prev.map((i) => i.taxCode));
        return prev.concat((data?.items ?? []).filter((i) => !existing.has(i.taxCode)));
      });
    } catch (err) {
      if (tcLatestQueryRef.current !== queryKey) return;
      if (err instanceof ApiRequestError && err.status === 401) { handleAuthFailure(); return; }
      setTcNextError(getErrorMessage(err, 'Unable to load more tax codes.'));
    } finally {
      setTcIsFetchingNext(false);
    }
  }, [tcHasNext, tcIsLoading, tcIsFetchingNext, profile, tcCurrentPage, tcDebouncedSearch, tcSortOrder, fetchTaxCodes, handleAuthFailure]);

  // Tax Code: debounce search
  useEffect(() => {
    const timer = window.setTimeout(() => setTcDebouncedSearch(tcSearch), 500);
    return () => window.clearTimeout(timer);
  }, [tcSearch]);

  // Tax Code: reload on tab + query change
  useEffect(() => {
    if (activeTab !== 'taxcode' || !profile) return;
    const queryKey = JSON.stringify({ tcDebouncedSearch, tcSortOrder });
    tcLatestQueryRef.current = queryKey;
    setTcItems([]);
    setTcTotal(0);
    setTcCurrentPage(1);
    setTcHasNext(false);
    setTcInitialError(null);
    setTcNextError(null);
    tcScrollRef.current?.scrollTo({ top: 0 });
    setTcIsLoading(true);
    fetchTaxCodes(1, tcDebouncedSearch, tcSortOrder)
      .then((data) => {
        if (tcLatestQueryRef.current !== queryKey) return;
        setTcTotal(data?.total ?? 0);
        setTcCurrentPage(data?.page ?? 1);
        setTcHasNext(Boolean(data?.hasNext));
        setTcItems(data?.items ?? []);
      })
      .catch((err) => {
        if (tcLatestQueryRef.current !== queryKey) return;
        if (err instanceof ApiRequestError && err.status === 401) { handleAuthFailure(); return; }
        setTcInitialError(getErrorMessage(err, 'Unable to load tax codes.'));
      })
      .finally(() => setTcIsLoading(false));
  }, [activeTab, tcDebouncedSearch, tcSortOrder, profile, fetchTaxCodes, handleAuthFailure]);

  // Tax Code: infinite scroll
  useEffect(() => {
    if (!tcScrollRef.current || !tcLoadMoreRef.current) return;
    if (tcIsLoading || tcIsFetchingNext || tcInitialError || tcNextError || !tcHasNext) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void loadTaxCodeNextPage(); },
      { root: tcScrollRef.current, rootMargin: '0px 0px 400px 0px', threshold: 0.01 }
    );
    observer.observe(tcLoadMoreRef.current);
    return () => observer.disconnect();
  }, [tcHasNext, tcInitialError, tcIsFetchingNext, tcIsLoading, tcNextError, loadTaxCodeNextPage]);

  // ── Stock: debounce search ────────────────────────────────────────────────
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

  const renderTaxCodeTable = () => {
    if (tcIsLoading) {
      return (
        <div className="flex h-full items-center justify-center px-6 py-10">
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <LoaderCircle size={18} className="animate-spin text-zinc-500" />
            <span>Loading tax codes...</span>
          </div>
        </div>
      );
    }

    if (tcInitialError) {
      return (
        <div className="flex h-full items-center justify-center px-6 py-10">
          <div className="max-w-md text-center">
            <AlertCircle size={20} className="mx-auto text-red-500" />
            <h3 className="mt-4 text-base font-semibold text-zinc-900">Could not load tax codes</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{tcInitialError}</p>
            <button
              type="button"
              onClick={() => { setTcInitialError(null); setTcItems([]); setTcCurrentPage(1); }}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    if (tcItems.length === 0) {
      return (
        <div className="flex h-full items-center justify-center px-6 py-10">
          <div className="space-y-5 text-center">
            <Tag size={28} className="mx-auto text-zinc-400" strokeWidth={1.9} />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight text-zinc-950">
                {tcDebouncedSearch ? 'No tax codes match this search' : 'No tax codes yet'}
              </h3>
              <p className="mx-auto max-w-sm text-sm leading-6 text-zinc-600">
                {tcDebouncedSearch ? 'Try broadening your search.' : 'This company database has no tax codes.'}
              </p>
            </div>
            {tcDebouncedSearch && (
              <button
                type="button"
                onClick={() => setTcSearch('')}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <>
        <table className="w-full min-w-[640px] text-left text-[11px]">
          <thead className="sticky top-0 z-10 bg-white shadow-sm">
            <tr>
              <th className="bg-white pl-6 pr-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Tag size={12} className="text-zinc-400" />
                  <span>Tax Code</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <FileText size={12} className="text-zinc-400" />
                  <span>Description</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">Rate</th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">Inclusive</th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Activity size={12} className="text-zinc-400" />
                  <span>Active</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {tcItems.map((tc) => (
              <tr key={tc.taxCode} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50">
                <td className="pl-6 pr-3 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-700">
                      {tc.taxCode}
                    </span>
                    {tc.isDefault && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                        Default
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  <span className="max-w-[180px] truncate font-medium text-zinc-800" title={tc.description}>
                    {tc.description || '—'}
                  </span>
                </td>
                <td className="px-3 py-1.5 font-semibold text-zinc-700">
                  {tc.taxRate !== undefined && tc.taxRate !== null ? `${tc.taxRate}%` : '—'}
                </td>
                <td className="px-3 py-1.5">
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    tc.inclusive
                      ? 'border-blue-200 bg-blue-50 text-blue-600'
                      : 'border-zinc-200 bg-zinc-100 text-zinc-500'
                  }`}>
                    {tc.inclusive ? 'Inclusive' : 'Exclusive'}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    tc.active
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                      : 'border-zinc-200 bg-zinc-100 text-zinc-500'
                  }`}>
                    {tc.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div ref={tcLoadMoreRef} className="flex flex-col items-center justify-center gap-2 px-6 py-5 text-xs text-zinc-500">
          {tcIsFetchingNext && (
            <div className="flex items-center gap-2">
              <LoaderCircle size={14} className="animate-spin" />
              Loading more tax codes...
            </div>
          )}
          {!tcIsFetchingNext && tcNextError && (
            <>
              <p className="text-red-600">{tcNextError}</p>
              <button type="button" onClick={() => void loadTaxCodeNextPage()}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
              >Retry load more</button>
            </>
          )}
          {!tcIsFetchingNext && !tcNextError && tcHasNext && <p>Scroll down to load more.</p>}
          {!tcHasNext && tcItems.length > 0 && <p>No more tax codes.</p>}
        </div>
      </>
    );
  };

  const renderStockGroupTable = () => {
    if (sgIsLoading) {
      return (
        <div className="flex h-full items-center justify-center px-6 py-10">
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <LoaderCircle size={18} className="animate-spin text-zinc-500" />
            <span>Loading stock groups...</span>
          </div>
        </div>
      );
    }

    if (sgInitialError) {
      return (
        <div className="flex h-full items-center justify-center px-6 py-10">
          <div className="max-w-md text-center">
            <AlertCircle size={20} className="mx-auto text-red-500" />
            <h3 className="mt-4 text-base font-semibold text-zinc-900">Could not load stock groups</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{sgInitialError}</p>
            <button
              type="button"
              onClick={() => { setSgInitialError(null); setSgItems([]); setSgCurrentPage(1); }}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    if (sgItems.length === 0) {
      return (
        <div className="flex h-full items-center justify-center px-6 py-10">
          <div className="space-y-5 text-center">
            <Layers size={28} className="mx-auto text-zinc-400" strokeWidth={1.9} />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight text-zinc-950">
                {sgDebouncedSearch ? 'No groups match this search' : 'No stock groups yet'}
              </h3>
              <p className="mx-auto max-w-md text-sm leading-6 text-zinc-600">
                {sgDebouncedSearch
                  ? 'Try broadening your search.'
                  : 'This company database has no stock groups.'}
              </p>
            </div>
            {sgDebouncedSearch && (
              <button
                type="button"
                onClick={() => setSgSearch('')}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <>
        <table className="w-full min-w-[640px] text-left text-[11px]">
          <thead className="sticky top-0 z-10 bg-white shadow-sm">
            <tr>
              <th className="bg-white pl-6 pr-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Layers size={12} className="text-zinc-400" />
                  <span>Group</span>
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
                  <Hash size={12} className="text-zinc-400" />
                  <span>Short Code</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Tag size={12} className="text-zinc-400" />
                  <span>Purchase Code</span>
                </div>
              </th>
              <th className="bg-white px-3 py-1.5 font-semibold uppercase tracking-tight text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Package size={12} className="text-zinc-400" />
                  <span>Items</span>
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
            {sgItems.map((group) => (
              <tr key={group.itemGroup} className="group border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50">
                <td className="pl-6 pr-3 py-1.5 font-mono font-medium text-zinc-900">{group.itemGroup}</td>
                <td className="px-3 py-1.5">
                  <span className="max-w-[240px] truncate font-medium text-zinc-800" title={group.description}>
                    {group.description}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <span className="rounded-full border border-zinc-200/60 bg-zinc-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-600">
                    {group.shortCode || '-'}
                  </span>
                </td>
                <td className="px-3 py-1.5 font-mono text-zinc-500">{group.purchaseCode || '-'}</td>
                <td className="px-3 py-1.5">
                  <span className="rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-600">
                    {group.itemCount}
                  </span>
                </td>
                <td className="pl-3 pr-6 py-1.5">
                  <button
                    type="button"
                    onClick={() => { setSgDetailItem(group); setSgDetailOpen(true); }}
                    className="flex items-center gap-1 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-zinc-900 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50"
                    title="View"
                  >
                    <Eye size={10} />
                    <span className="text-[10px] font-semibold">View</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div ref={sgLoadMoreRef} className="flex flex-col items-center justify-center gap-2 px-6 py-5 text-xs text-zinc-500">
          {sgIsFetchingNext && (
            <div className="flex items-center gap-2">
              <LoaderCircle size={14} className="animate-spin" />
              Loading more groups...
            </div>
          )}
          {!sgIsFetchingNext && sgNextError && (
            <>
              <p className="text-red-600">{sgNextError}</p>
              <button
                type="button"
                onClick={() => void loadStockGroupNextPage()}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                Retry load more
              </button>
            </>
          )}
          {!sgIsFetchingNext && !sgNextError && sgHasNext && (
            <p>Scroll down to load more.</p>
          )}
          {!sgHasNext && sgItems.length > 0 && <p>No more stock groups.</p>}
        </div>
      </>
    );
  };

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
        <table className="w-full min-w-[640px] text-left text-[11px]">
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
                      type="button"
                      onClick={() => { setDetailItemCode(item.itemCode); setDetailModalOpen(true); }}
                      className="flex items-center gap-1 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-zinc-900 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50"
                      title="View"
                    >
                      <Eye size={10} />
                      <span className="text-[10px] font-semibold">View</span>
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
          {activeTab === 'stock' && (
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
              {isInitialLoading ? '...' : total}
            </span>
          )}
          {activeTab === 'stockgroup' && (
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
              {sgIsLoading ? '...' : sgTotal}
            </span>
          )}
          {activeTab === 'taxcode' && (
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
              {tcIsLoading ? '...' : tcTotal}
            </span>
          )}
        </div>

        <p className="text-xs text-zinc-500">
          {activeTab === 'stock'
            ? total > 0
              ? `Loaded ${items.length} of ${total} stock items.`
              : 'Manage your inventory items, classifications, and stock control settings.'
            : activeTab === 'stockgroup'
              ? sgTotal > 0
                ? `Loaded ${sgItems.length} of ${sgTotal} stock groups.`
                : 'View and browse your inventory item groups.'
              : tcTotal > 0
                ? `Loaded ${tcItems.length} of ${tcTotal} tax codes.`
                : 'View the tax codes configured for this company.'}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="shrink-0 border-b border-zinc-200 px-6">
        <div className="flex gap-0">
          <button
            type="button"
            onClick={() => setActiveTab('stock')}
            className={`border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'stock'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Stock
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stockgroup')}
            className={`border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'stockgroup'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Stock Group
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('taxcode')}
            className={`border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'taxcode'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Tax Code
          </button>
        </div>
      </div>

      {/* ── Tax Code toolbar ─────────────────────────────────────────────── */}
      {activeTab === 'taxcode' && (
        <div className="flex min-h-[40px] shrink-0 items-center gap-4 px-6 py-2">
          <div className="group relative max-w-md flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-blue-500" />
            <input
              type="text"
              placeholder="Search tax code..."
              value={tcSearch}
              onChange={(e) => setTcSearch(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pl-9 pr-4 text-xs text-zinc-900 transition-all placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
          <button
            type="button"
            onClick={() => setTcSortOrder((o) => o === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50"
          >
            <ArrowUpDown size={14} />
            <span>{tcSortOrder === 'asc' ? 'A → Z' : 'Z → A'}</span>
          </button>
        </div>
      )}

      {/* ── Stock Group toolbar ──────────────────────────────────────────── */}
      {activeTab === 'stockgroup' && (
        <div className="flex min-h-[40px] shrink-0 items-center justify-between gap-4 px-6 py-2">
          <div className="group relative max-w-md flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-blue-500" />
            <input
              type="text"
              placeholder="Search group, description, short code, or purchase code..."
              value={sgSearch}
              onChange={(e) => setSgSearch(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pl-9 pr-4 text-xs text-zinc-900 transition-all placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
          <div className="relative" ref={sgDisplayMenuRef}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => setSgIsDisplayOpen((o) => !o)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all ${
                sgIsDisplayOpen
                  ? 'border-blue-600 bg-blue-50/50 text-blue-600'
                  : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              <ArrowUpDown size={14} />
              <span>Display</span>
            </motion.button>
            <AnimatePresence>
              {sgIsDisplayOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="absolute right-0 top-full z-50 mt-2 w-56 origin-top overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg"
                >
                  <div className="p-3">
                    <h3 className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      <ArrowUpDown size={12} />
                      Sort By
                    </h3>
                    <div className="space-y-1">
                      {sgSortOptions.map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => { setSgSortLabel(opt.label); setSgIsDisplayOpen(false); }}
                          className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-xs text-zinc-700 transition hover:bg-zinc-50"
                        >
                          <div
                            className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                              sgSortLabel === opt.label ? 'border-blue-600' : 'border-zinc-300'
                            }`}
                          >
                            {sgSortLabel === opt.label && <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />}
                          </div>
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Stock toolbar ─────────────────────────────────────────────────── */}
      {activeTab === 'stock' && (
      <>
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
      </> )} {/* end activeTab === 'stock' toolbar */}

      {/* ── Content area ──────────────────────────────────────────────────── */}
      {activeTab === 'stock' && (
        <div ref={scrollContainerRef} className="flex-1 overflow-auto">
          {renderTable()}
        </div>
      )}
      {activeTab === 'stockgroup' && (
        <div ref={sgScrollRef} className="flex-1 overflow-auto">
          {renderStockGroupTable()}
        </div>
      )}
      {activeTab === 'taxcode' && (
        <div ref={tcScrollRef} className="flex-1 overflow-auto">
          {renderTaxCodeTable()}
        </div>
      )}

      <StockDetailModal
        isOpen={detailModalOpen}
        itemCode={detailItemCode}
        onClose={() => setDetailModalOpen(false)}
      />

      <StockGroupDetailModal
        isOpen={sgDetailOpen}
        item={sgDetailItem}
        onClose={() => setSgDetailOpen(false)}
      />

    </motion.div>
  );
}
