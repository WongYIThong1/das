'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  ChevronRight,
  Eye,
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
import { UploadInvoiceModal, type BatchCreatedPayload } from './UploadInvoiceModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import InvoiceDetailModal from './InvoiceDetailModal';
import { batchStore } from '../lib/batch-store';
import { authFetch } from '../lib/auth-fetch';
import { BatchStatusModal, type BatchStatusItem, type BatchItemPhase } from './BatchStatusModal';
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

type HistoryItem = {
  type: 'group' | 'task';
  id: string;
  bookId: string;
  groupId: string;
  taskId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

interface EditableInvoice {
  id: string; // This will be the supplierInvoiceNo (DocKey)
  rowKey: string;
  docKey: string;
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

type InvoiceQuery = Omit<GetPurchaseInvoiceListParams, 'pageSize' | 'page' | 'accessToken' | 'bookId'>;

type PrefetchedInvoicePage = {
  queryKey: string;
  page: number;
  items: PurchaseInvoiceListItem[];
  total: number;
  hasNext: boolean;
};

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
    rowKey: item.supplierInvoiceNo,
    docKey: item.docKey,
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
  const { profile, accessToken, clearAuthState } = useAuth();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // ── Batch status modal ────────────────────────────────────────────────────
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchGroupId, setBatchGroupId] = useState('');
  const [batchItems, setBatchItems] = useState<BatchStatusItem[]>([]);
  const [batchAllDone, setBatchAllDone] = useState(false);
  const [batchNow, setBatchNow] = useState(Date.now());
  const batchSseRef = useRef<AbortController | null>(null);
  const [submittingItems, setSubmittingItems] = useState<Set<string>>(new Set());

  // Tick while batch items are active
  useEffect(() => {
    if (!batchModalOpen || batchAllDone) return;
    const t = window.setInterval(() => setBatchNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [batchModalOpen, batchAllDone]);

  function mapBatchStatus(status: string): BatchItemPhase | null {
    switch (status) {
      case 'queued':
      case 'uploaded':
      case 'processing':
      case 'fileserver_uploading':
        return 'queued';
      case 'ocr_started':
      case 'ocr_completed':
      case 'ocrprocessing':
        return 'ocr_processing';
      case 'reanalyze_queued': case 'reanalyzing': return 'ocr_processing';
      case 'draft_ready':
      case 'analyzing':
      case 'aianalyzing':
        return 'analyzing';
      case 'completed':
      case 'completed_with_warnings':
      case 'succeeded':
      case 'success':
        return 'succeeded';
      case 'failed':
      case 'error':
        return 'failed';
      case 'canceled':  return 'canceled';
      case 'cancelled': return 'cancelled';
      case 'submit_queued':    return 'submit_queued';
      case 'submitting_stock': return 'submitting_stock';
      case 'submitting_pi':    return 'submitting_pi';
      case 'submitted':        return 'submitted';
      case 'submit_failed':    return 'submit_failed';
      case 'not_ready':        return 'not_ready';
      default:          return null;
    }
  }

  function parseTs(v: string | null | undefined): number | null {
    if (!v) return null;
    const ms = Date.parse(v);
    return isNaN(ms) ? null : ms;
  }

  async function fetchBatchItemImageUrl(itemId: string): Promise<string | null> {
    try {
      const res = await authFetch(
        `/api/purchase-invoice/batch/item?itemId=${encodeURIComponent(itemId)}`,
      );
      if (!res.ok) return null;
      const data = await res.json() as { task?: { fileServer?: { imageUrl?: string } } };
      return data.task?.fileServer?.imageUrl ?? null;
    } catch { return null; }
  }

  // Fetch the group snapshot and sync all item statuses from source of truth.
  // Returns true if all items are in a terminal state (safe to stop monitoring).
  async function syncGroupSnapshot(groupId: string, ctrl: AbortController): Promise<boolean> {
    try {
      const res = await authFetch(
        `/api/purchase-invoice/batch/group?groupId=${encodeURIComponent(groupId)}`,
        { signal: ctrl.signal },
      );
      if (!res.ok || ctrl.signal.aborted) return false;
      const data = await res.json();
      const items: Array<{ itemId?: string; taskId?: string; fileName?: string; status?: string; analysisStatus?: string; startedAt?: string; completedAt?: string }> = data?.items ?? [];
      if (!items.length) return false;

      const terminal = new Set<BatchItemPhase>(['succeeded', 'failed', 'canceled', 'cancelled', 'submitted', 'submit_failed', 'not_ready']);
      // Determine completion directly from API data — not React state
      const groupAnalysisDone = data.status === 'completed' || data.status === 'completed_with_failures';
      // If a submit is in progress, don't stop until submit also completes
      const submitInProgress = data.submitStatus === 'submitting';
      const allItemsDone = items.every((it) => {
        const phase = mapBatchStatus(it.status ?? '');
        return phase ? terminal.has(phase) : false;
      });
      const isDone = (groupAnalysisDone && !submitInProgress) || allItemsDone;

      setBatchNow(Date.now());
      setBatchItems((prev) => {
        const snapMap = new Map(items.map((it) => [it.itemId ?? '', it]));
        const next = prev.map((item) => {
          const snap = snapMap.get(item.id);
          if (!snap) return item;
          const mappedPhase = mapBatchStatus(snap.status ?? '');
          const phase = mappedPhase ?? item.phase;
          const mappedAnalysisPhase = snap.analysisStatus ? mapBatchStatus(snap.analysisStatus) : null;
          const analysisPhase = mappedAnalysisPhase ?? (phase === 'succeeded' ? 'succeeded' : item.analysisPhase);
          return {
            ...item,
            phase,
            analysisPhase,
            fileName: snap.fileName ?? item.fileName,
            previewTaskId: snap.taskId ?? item.previewTaskId,
            startedAt: parseTs(snap.startedAt) ?? item.startedAt,
            completedAt: parseTs(snap.completedAt) ?? item.completedAt,
          };
        });
        if (isDone) setBatchAllDone(true);
        return next;
      });

      // Fetch imageUrls for already-completed items
      items.forEach((it) => {
        if (mapBatchStatus(it.status ?? '') === 'succeeded' && it.itemId) {
          const itemId = it.itemId;
          void fetchBatchItemImageUrl(itemId).then((imageUrl) => {
            if (!imageUrl || ctrl.signal.aborted) return;
            setBatchItems((prev) =>
              prev.map((item) => item.id === itemId ? { ...item, imageUrl } : item)
            );
          });
        }
      });

      return isDone;
    } catch { return false; }
  }

  function connectBatchSSE(groupId: string) {
    batchSseRef.current?.abort();
    const ctrl = new AbortController();
    batchSseRef.current = ctrl;
    void (async () => {
      // Fetch source-of-truth snapshot before connecting SSE
      const alreadyDone = await syncGroupSnapshot(groupId, ctrl);
      if (alreadyDone || ctrl.signal.aborted) return;

      // SSE loop — reconnects on unexpected disconnect
      while (!ctrl.signal.aborted) {
        let interrupted = false;
        try {
          const res = await authFetch(
            `/api/purchase-invoice/batch/group/events?groupId=${encodeURIComponent(groupId)}`,
            { signal: ctrl.signal },
          );
          if (!res.ok || !res.body) break;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          let dataLine = '';
          // Snapshot already fetched — skip all replay events, only process live events
          let replayDone = false;
          while (true) {
            const { done, value } = await reader.read();
            if (ctrl.signal.aborted) break;
            if (done) { interrupted = true; break; }  // stream ended — treat as interrupted, re-sync
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';
            for (const rawLine of lines) {
              const line = rawLine.replace(/\r$/, '');
              if (line.startsWith('data: ')) { dataLine = line.slice(6); }
              else if (line === '' && dataLine) {
                try {
                  const ev = JSON.parse(dataLine) as {
                    eventType?: string; itemId?: string; status?: string;
                    fileName?: string; startedAt?: string; completedAt?: string;
                  };
                  // Mark when replay phase ends
                  if (ev.eventType === 'replay_completed') {
                    replayDone = true;
                    dataLine = '';
                    continue;
                  }
                  // During replay, skip all events — snapshot is the source of truth
                  if (!replayDone) {
                    dataLine = '';
                    continue;
                  }
                  // Skip non-item live events
                  if (
                    ev.eventType === 'ping' ||
                    ev.eventType === 'group_created' ||
                    ev.eventType === 'group_status_changed'
                  ) {
                    dataLine = '';
                    continue;
                  }
                  if (ev.eventType === 'item_status_changed' && ev.itemId) {
                    const resolvedPhase = ev.status ? mapBatchStatus(ev.status) : null;
                    setBatchNow(Date.now());
                    setBatchItems((prev) => {
                      const next = prev.map((item) =>
                        item.id === ev.itemId
                          ? {
                              ...item,
                              phase: resolvedPhase ?? item.phase,
                              fileName: ev.fileName ?? item.fileName,
                              startedAt: parseTs(ev.startedAt) ?? item.startedAt,
                              completedAt: parseTs(ev.completedAt) ?? null,
                            }
                          : item
                      );
                      const terminal = new Set<BatchItemPhase>(['succeeded', 'failed', 'canceled', 'cancelled']);
                      if (next.length > 0 && next.every((i) => terminal.has(i.phase))) {
                        setBatchAllDone(true);
                      }
                      return next;
                    });
                    if (resolvedPhase === 'succeeded') {
                      const itemId = ev.itemId;
                      void fetchBatchItemImageUrl(itemId).then((imageUrl) => {
                        if (!imageUrl || ctrl.signal.aborted) return;
                        setBatchItems((prev) =>
                          prev.map((item) =>
                            item.id === itemId ? { ...item, imageUrl } : item
                          )
                        );
                      });
                    }
                  }
                  if (
                    (ev.eventType === 'item_submit_queued' ||
                     ev.eventType === 'item_submit_status_changed' ||
                     ev.eventType === 'item_submitted' ||
                     ev.eventType === 'item_submit_failed' ||
                     ev.eventType === 'item_submit_skipped') &&
                    ev.itemId
                  ) {
                    // Derive phase: prefer ev.status, fall back to eventType mapping
                    const phaseFromStatus = ev.status ? mapBatchStatus(ev.status) : null;
                    const phaseFromEvent: BatchItemPhase | null =
                      ev.eventType === 'item_submit_queued'      ? 'submit_queued' :
                      ev.eventType === 'item_submitted'           ? 'submitted' :
                      ev.eventType === 'item_submit_failed'       ? 'submit_failed' :
                      ev.eventType === 'item_submit_skipped'      ? 'not_ready' : null;
                    const newPhaseCandidate: BatchItemPhase | null =
                      (phaseFromStatus && phaseFromStatus !== 'queued') ? phaseFromStatus :
                      phaseFromEvent ?? (ev.status ? mapBatchStatus(ev.status) : null);
                    setBatchNow(Date.now());
                    setBatchItems((prev) => {
                      const next = prev.map((item) =>
                        item.id === ev.itemId
                          ? { ...item, phase: newPhaseCandidate ?? item.phase }
                          : item
                      );
                      const terminal = new Set<BatchItemPhase>(['succeeded', 'failed', 'canceled', 'cancelled', 'submitted', 'submit_failed', 'not_ready']);
                      if (next.length > 0 && next.every((i) => terminal.has(i.phase))) {
                        setBatchAllDone(true);
                      }
                      return next;
                    });
                  }
                } catch { /* ignore parse errors */ }
                dataLine = '';
              }
            }
          }
        } catch {
          if (ctrl.signal.aborted) break;
          interrupted = true;
        }
        if (!interrupted || ctrl.signal.aborted) break;
        // Re-fetch source of truth — returns true if all done, then stop
        const allDone = await syncGroupSnapshot(groupId, ctrl);
        if (allDone || ctrl.signal.aborted) break;
        // Brief pause before reconnect
        await new Promise((r) => setTimeout(r, 2000));
      }
    })();
  }

  function handleBatchCreated({ groupId, items }: BatchCreatedPayload) {
    const initialItems: BatchStatusItem[] = items.map((it) => ({
      id: it.itemId,
      fileName: it.fileName,
      fileSize: 0,
      phase: 'queued' as BatchItemPhase,
      previewTaskId: it.taskId,   // taskId is what the preview API expects
      startedAt: null,
      completedAt: null,
      error: null,
    }));
    setBatchGroupId(groupId);
    setBatchItems(initialItems);
    setBatchAllDone(false);
    setBatchNow(Date.now());
    setBatchModalOpen(true);
    connectBatchSSE(groupId);
  }

  async function handleSubmitItem(itemId: string) {
    setSubmittingItems((prev) => new Set([...prev, itemId]));
    try {
      const res = await authFetch(`/api/purchase-invoice/batch/item/submit?itemId=${encodeURIComponent(itemId)}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null;
        toast.error(data?.error ?? 'Submit failed.');
      } else {
        // Optimistically move item to submit_queued and reconnect SSE for live updates
        setBatchItems((prev) => prev.map((it) => it.id === itemId ? { ...it, phase: 'submit_queued' } : it));
        setBatchAllDone(false);
        if (batchGroupId) connectBatchSSE(batchGroupId);
      }
    } catch {
      toast.error('Submit failed.');
    } finally {
      setSubmittingItems((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
    }
  }

  async function handleSubmitAll() {
    if (!batchGroupId) return;
    try {
      const res = await authFetch(`/api/purchase-invoice/batch/group/submit-all?groupId=${encodeURIComponent(batchGroupId)}`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => null) as { queuedCount?: number; error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error ?? 'Submit all failed.');
      } else {
        toast.success(`${data?.queuedCount ?? 0} invoice${(data?.queuedCount ?? 0) !== 1 ? 's' : ''} queued for submission.`);
        // Reconnect SSE to receive submit events
        setBatchAllDone(false);
        connectBatchSSE(batchGroupId);
      }
    } catch {
      toast.error('Submit all failed.');
    }
  }

  // ── History tab ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'invoices' | 'history'>('invoices');
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasNext, setHistoryHasNext] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDeleteConfirmOpen, setHistoryDeleteConfirmOpen] = useState(false);
  const [historyItemToDelete, setHistoryItemToDelete] = useState<HistoryItem | null>(null);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'group' | 'task'>('all');
  const [historySearchDraft, setHistorySearchDraft] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const historySseRef = useRef<AbortController | null>(null);
  const historyGetRef = useRef<AbortController | null>(null);
  // Cache: key → { items, total, hasNext }
  const historyCacheRef = useRef<Map<string, { items: HistoryItem[]; total: number; hasNext: boolean }>>(new Map());

  function historyParamKey(page: number, type: string, search: string) {
    return `${page}:${type}:${search}`;
  }

  // Debounce history search
  useEffect(() => {
    const t = window.setTimeout(() => setHistorySearch(historySearchDraft), 300);
    return () => window.clearTimeout(t);
  }, [historySearchDraft]);

  // GET-first + SSE-for-updates pattern
  useEffect(() => {
    if (activeTab !== 'history' || !accessToken) return;

    // Abort any in-flight SSE and GET
    historySseRef.current?.abort();
    historyGetRef.current?.abort();

    const sseCtrl = new AbortController();
    const getCtrl = new AbortController();
    historySseRef.current = sseCtrl;
    historyGetRef.current = getCtrl;

    const cacheKey = historyParamKey(historyPage, historyTypeFilter, historySearch);
    const params = new URLSearchParams({ page: String(historyPage), pageSize: '20' });
    if (historyTypeFilter !== 'all') params.set('type', historyTypeFilter);
    if (historySearch) params.set('q', historySearch);

    // --- Phase 1: serve from cache instantly, then refresh in background ---
    const cached = historyCacheRef.current.get(cacheKey);
    if (cached) {
      setHistoryItems(cached.items);
      setHistoryTotal(cached.total);
      setHistoryHasNext(cached.hasNext);
      setHistoryLoading(false);
    } else {
      setHistoryLoading(true);
    }

    // --- Phase 2: fire GET immediately for fresh data ---
    void (async () => {
      try {
        const res = await authFetch(
          `/api/purchase-invoice/history?${params.toString()}`,
          { signal: getCtrl.signal },
        );
        if (!res.ok || getCtrl.signal.aborted) return;
        const data = await res.json() as { items?: HistoryItem[]; total?: number; hasNext?: boolean };
        const items = data.items ?? [];
        const total = data.total ?? 0;
        const hasNext = data.hasNext ?? false;
        // Update cache
        historyCacheRef.current.set(cacheKey, { items, total, hasNext });
        setHistoryItems(items);
        setHistoryTotal(total);
        setHistoryHasNext(hasNext);
        setHistoryLoading(false);
      } catch { /* aborted or network error — ignore */ }
    })();

    // --- Phase 3: connect SSE for real-time upsert/delete events ---
    void (async () => {
      try {
        const res = await authFetch(
          `/api/purchase-invoice/history/events?${params.toString()}`,
          { headers: { Accept: 'text/event-stream' }, signal: sseCtrl.signal },
        );
        if (!res.ok || !res.body || sseCtrl.signal.aborted) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let dataLine = '';
        let snapshotReceived = false;
        while (true) {
          const { done, value } = await reader.read();
          if (sseCtrl.signal.aborted || done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const rawLine of lines) {
            const line = rawLine.replace(/\r$/, '');
            if (line.startsWith('data: ')) { dataLine = line.slice(6); }
            else if (line === '' && dataLine) {
              try {
                const ev = JSON.parse(dataLine) as {
                  eventType?: string;
                  items?: HistoryItem[];
                  item?: HistoryItem;
                  type?: string;
                  id?: string;
                };
                if (ev.eventType === 'snapshot') {
                  // Snapshot has no total/hasNext — only use items if GET hasn't populated cache yet
                  if (!snapshotReceived && !historyCacheRef.current.has(cacheKey)) {
                    const items = ev.items ?? [];
                    historyCacheRef.current.set(cacheKey, { items, total: items.length, hasNext: false });
                    setHistoryItems(items);
                    setHistoryTotal(items.length);
                    setHistoryHasNext(false);
                    setHistoryLoading(false);
                  }
                  snapshotReceived = true;
                } else if (ev.eventType === 'upsert' && ev.item) {
                  const upserted = ev.item;
                  setHistoryItems((prev) => {
                    const idx = prev.findIndex((i) => i.id === upserted.id);
                    const next = idx >= 0
                      ? prev.map((i, j) => j === idx ? upserted : i)
                      : [upserted, ...prev];
                    const cached2 = historyCacheRef.current.get(cacheKey);
                    historyCacheRef.current.set(cacheKey, {
                      items: next,
                      total: cached2 ? (idx >= 0 ? cached2.total : cached2.total + 1) : next.length,
                      hasNext: cached2?.hasNext ?? false,
                    });
                    return next;
                  });
                } else if (ev.eventType === 'delete' && ev.id) {
                  const deletedId = ev.id;
                  setHistoryItems((prev) => {
                    const next = prev.filter((i) => i.id !== deletedId);
                    const cached2 = historyCacheRef.current.get(cacheKey);
                    if (cached2) {
                      historyCacheRef.current.set(cacheKey, {
                        ...cached2,
                        items: next,
                        total: Math.max(0, cached2.total - 1),
                      });
                    }
                    return next;
                  });
                }
              } catch { /* ignore parse errors */ }
              dataLine = '';
            }
          }
        }
      } catch { /* aborted or SSE error — GET data already shown, no action needed */ }
    })();

    return () => {
      sseCtrl.abort();
      getCtrl.abort();
    };
  }, [activeTab, historyPage, historyTypeFilter, historySearch, accessToken]);

  async function handleViewHistoryItem(item: HistoryItem) {
    if (item.type === 'task') {
      window.open('/purchase-invoice/' + item.taskId, '_blank');
      return;
    }
    // group → load snapshot and open BatchStatusModal in current page
    try {
      const res = await authFetch(
        `/api/purchase-invoice/batch/group?groupId=${encodeURIComponent(item.groupId)}`,
      );
      if (!res.ok) return;
      const data = await res.json() as {
        items?: Array<{ itemId?: string; taskId?: string; fileName?: string; status?: string; startedAt?: string; completedAt?: string }>;
      };
      const rawItems = data?.items ?? [];
      const initialItems: BatchStatusItem[] = rawItems.map((it) => ({
        id: it.itemId ?? '',
        fileName: it.fileName ?? '',
        fileSize: 0,
        phase: mapBatchStatus(it.status ?? '') ?? 'queued',
        previewTaskId: it.taskId,
        startedAt: parseTs(it.startedAt),
        completedAt: parseTs(it.completedAt),
        error: null,
      }));
      const terminal = new Set<BatchItemPhase>(['succeeded', 'failed', 'canceled', 'cancelled', 'submitted', 'submit_failed', 'not_ready']);
      setBatchGroupId(item.groupId);
      setBatchItems(initialItems);
      setBatchAllDone(initialItems.length > 0 && initialItems.every((i) => terminal.has(i.phase)));
      setBatchNow(Date.now());
      setBatchModalOpen(true);
      connectBatchSSE(item.groupId);
    } catch { /* ignore */ }
  }

  function handleHistoryDelete(item: HistoryItem) {
    setHistoryItemToDelete(item);
    setHistoryDeleteConfirmOpen(true);
  }

  async function confirmHistoryDelete() {
    if (!historyItemToDelete) return;
    const item = historyItemToDelete;
    const params = new URLSearchParams({ type: item.type, id: item.id });
    try {
      const res = await authFetch(`/api/purchase-invoice/history?${params.toString()}`, { method: 'DELETE' });
      if (res.ok) {
        setHistoryItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    } catch { /* ignore */ }
  }

  function historyStatusBadge(status: string) {
    const s = status.toLowerCase();
    if (s === 'uploading' || s === 'analyzing') {
      return 'bg-amber-100 text-amber-700 border-amber-200';
    }
    if (s === 'ready' || s === 'submitted') {
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
    if (s === 'submitting') {
      return 'bg-violet-100 text-violet-700 border-violet-200';
    }
    if (s === 'failed') {
      return 'bg-red-100 text-red-700 border-red-200';
    }
    return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  }

  function formatHistoryDate(iso: string) {
    try {
      return format(new Date(iso), 'dd MMM yyyy HH:mm');
    } catch {
      return iso;
    }
  }

  const [isDisplayOpen, setIsDisplayOpen] = useState(false);
  const [selectedSortLabel, setSelectedSortLabel] = useState(sortOptions[0].label);
  const [selectedAutoRefreshLabel, setSelectedAutoRefreshLabel] = useState(autoRefreshOptions[0].label);
  const [draftFilters, setDraftFilters] = useState<FilterDraft>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterDraft>(defaultFilters);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<EditableInvoice | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailDocKey, setDetailDocKey] = useState('');
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
  const [invoiceToVoid, setInvoiceToVoid] = useState<EditableInvoice | null>(null);
  const [voidLoading, setVoidLoading] = useState(false);
  const [items, setItems] = useState<PurchaseInvoiceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [prefetchedPage, setPrefetchedPage] = useState<PrefetchedInvoicePage | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [isPrefetchingNextPage, setIsPrefetchingNextPage] = useState(false);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [nextPageError, setNextPageError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const displayMenuRef = useRef<HTMLDivElement>(null);
  const latestQueryKeyRef = useRef('');
  const prefetchRequestKeyRef = useRef<string | null>(null);
  const prefetchedPageRef = useRef<PrefetchedInvoicePage | null>(null);
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
      sortBy: selectedSortOption.sortBy,
      sortOrder: selectedSortOption.sortOrder,
      supplier: appliedFilters.supplier.trim() || undefined,
      dateFrom: appliedFilters.dateFrom || undefined,
      dateTo: appliedFilters.dateTo || undefined,
      grandTotalMin: parseOptionalNumber(appliedFilters.grandTotalMin),
      grandTotalMax: parseOptionalNumber(appliedFilters.grandTotalMax),
    }),
    [appliedFilters, selectedSortOption]
  );

  const activeFilterCount = useMemo(
    () =>
      [
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

  useEffect(() => {
    prefetchedPageRef.current = prefetchedPage;
  }, [prefetchedPage]);

  const handleAuthFailure = useCallback(() => {
    void clearAuthState();
    router.replace('/login');
  }, [clearAuthState, router]);

  const fetchInvoices = useCallback(
    async (page: number, query: InvoiceQuery) => {
      if (!profile || !accessToken) {
        throw new ApiRequestError('Your session is not ready yet.', 503);
      }

      return getPurchaseInvoiceList({
        pageSize: PAGE_SIZE,
        page,
        accessToken,
        bookId: profile.bookId,
        ...query,
      });
    },
    [accessToken, profile]
  );

  const applyInvoicePage = useCallback(
    (
      response: {
        items: PurchaseInvoiceListItem[];
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

        const existingKeys = new Set(current.map((item) => item.supplierInvoiceNo));
        const appended = response.items.filter((item) => !existingKeys.has(item.supplierInvoiceNo));
        return current.concat(appended);
      });
    },
    []
  );

  const prefetchInvoices = useCallback(
    async (hasNextPage: boolean, loadedPage: number, query: InvoiceQuery) => {
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
        const response = await fetchInvoices(nextPage, query);
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
    [fetchInvoices]
  );

  const loadInvoices = useCallback(
    async (page: number, mode: 'replace' | 'append', query: InvoiceQuery) => {
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
        const response = await fetchInvoices(page, query);

        if (latestQueryKeyRef.current !== queryKey) {
          return;
        }

        applyInvoicePage(response, mode);
        setPrefetchedPage(null);
        void prefetchInvoices(response.hasNext, response.page, query);
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
    [applyInvoicePage, fetchInvoices, handleAuthFailure, prefetchInvoices]
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
          : await fetchInvoices(nextPage, currentQuery);

      if (latestQueryKeyRef.current !== queryKey) {
        return;
      }

      applyInvoicePage(response, 'append');
      setPrefetchedPage(null);
      void prefetchInvoices(response.hasNext, response.page, currentQuery);
    } catch (error) {
      if (latestQueryKeyRef.current !== queryKey) {
        return;
      }

      if (error instanceof ApiRequestError && error.status === 401) {
        handleAuthFailure();
        return;
      }

      setNextPageError(getErrorMessage(error, 'Unable to load more purchase invoices.'));
    } finally {
      if (latestQueryKeyRef.current !== queryKey) {
        return;
      }

      setIsFetchingNextPage(false);
    }
  }, [
    applyInvoicePage,
    currentPage,
    currentQuery,
    fetchInvoices,
    handleAuthFailure,
    hasNext,
    isFetchingNextPage,
    isInitialLoading,
    prefetchInvoices,
    profile,
  ]);

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
    void loadInvoices(1, 'replace', currentQuery);
  }, [currentQuery, loadInvoices, profile]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const shouldRefresh = sessionStorage.getItem('pi:list:refresh');
    if (!shouldRefresh) {
      return;
    }
    sessionStorage.removeItem('pi:list:refresh');
    latestQueryKeyRef.current = JSON.stringify(currentQuery);
    prefetchRequestKeyRef.current = null;
    setPrefetchedPage(null);
    void loadInvoices(1, 'replace', currentQuery);
  }, [currentQuery, loadInvoices, profile]);

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
      void loadInvoices(1, 'replace', currentQuery);
    }, selectedAutoRefreshOption.intervalMs);

    return () => window.clearInterval(timer);
  }, [currentQuery, loadInvoices, profile, selectedAutoRefreshOption.intervalMs]);

  const handleDeleteClick = (invoice: EditableInvoice) => {
    setInvoiceToDelete(invoice);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {};

  const handleVoidClick = (invoice: EditableInvoice) => {
    setInvoiceToVoid(invoice);
    setVoidConfirmOpen(true);
  };

  const handleVoidConfirm = async () => {
    if (!invoiceToVoid) return;
    setVoidLoading(true);
    try {
      const res = await authFetch('/api/purchase-invoice/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docKey: invoiceToVoid.docKey, docNo: invoiceToVoid.docNo }),
      });
      if (res.ok) {
        toast.success('Invoice voided.');
      } else {
        toast.error('Failed to void invoice.');
      }
    } catch {
      toast.error('Failed to void invoice.');
    } finally {
      setVoidLoading(false);
      setVoidConfirmOpen(false);
      setInvoiceToVoid(null);
    }
  };

  const handleApplyFilters = () => {
    setAppliedFilters({ ...draftFilters });
  };

  const handleResetFilters = () => {
    setDraftFilters({ ...defaultFilters });
    setAppliedFilters({ ...defaultFilters });
    setSelectedSortLabel(sortOptions[0].label);
  };

  const renderedInvoices = useMemo(
    () =>
      items.map((item, index) => {
        const invoice = mapToEditableInvoice(item);
        const fallbackBase =
          invoice.id ||
          invoice.docNo ||
          `${invoice.creditorName}-${invoice.docDate}-${invoice.amount}-${invoice.netTotal}`;
        return {
          ...invoice,
          rowKey: `${fallbackBase}::${index}`,
        };
      }),
    [items]
  );

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
              onClick={() => void loadInvoices(null, 'replace', currentQuery)}
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
                  onClick={() => void loadInvoices(null, 'replace', currentQuery)}
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
        <table className="w-full min-w-[640px] text-left text-[11px]">
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
              <tr key={invoice.rowKey} className="group">
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
                      onClick={() => { setDetailDocKey(invoice.docKey); setDetailModalOpen(true); }}
                      className="flex items-center gap-1 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-zinc-900 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50"
                      title="View"
                    >
                      <Eye size={10} />
                      <span className="text-[10px] font-semibold">View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVoidClick(invoice)}
                      className="flex items-center gap-1 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-zinc-900 shadow-sm transition-all hover:border-red-200 hover:bg-red-50"
                      title="Void"
                    >
                      <Trash2 size={10} className="text-red-500" />
                      <span className="text-[10px] font-semibold">Void</span>
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
          {!hasNext && <p>No more invoices.</p>}
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
              {activeTab === 'invoices' && (
                <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                  {isInitialLoading ? '...' : total}
                </span>
              )}
              {activeTab === 'history' && (
                <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                  {historyLoading ? '...' : historyTotal}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              {activeTab === 'invoices'
                ? total > 0
                  ? `Loaded ${loadedCount} of ${total} invoices${profile?.bookId ? ` | ${profile.bookId}` : ''}.`
                  : 'Manage your purchase invoices and load more results as you scroll.'
                : 'Past invoice uploads and batch groups.'}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="shrink-0 border-b border-zinc-200 px-6">
            <div className="flex gap-0">
              <button
                type="button"
                onClick={() => setActiveTab('invoices')}
                className={`border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
                  activeTab === 'invoices'
                    ? 'border-zinc-900 text-zinc-900'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Invoices
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('history'); setHistoryPage(1); }}
                className={`border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
                  activeTab === 'history'
                    ? 'border-zinc-900 text-zinc-900'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700'
                }`}
              >
                History
              </button>
            </div>
          </div>

          <div className={`flex min-h-[40px] shrink-0 flex-col gap-3 px-6 py-2 ${activeTab !== 'invoices' ? 'hidden' : ''}`}>
            <div className="flex items-center justify-end gap-4">
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

          <div ref={scrollContainerRef} className={`flex-1 overflow-auto ${activeTab !== 'invoices' ? 'hidden' : ''}`}>
            {renderTable()}
          </div>

          <div className={`flex flex-1 flex-col overflow-hidden ${activeTab !== 'history' ? 'hidden' : ''}`}>
              {/* History toolbar */}
              <div className="shrink-0 flex items-center gap-3 px-6 py-2">
                <div className="flex items-center gap-1">
                  {(['all', 'task', 'group'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => { setHistoryTypeFilter(f); setHistoryPage(1); }}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                        historyTypeFilter === f
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      {f === 'all' ? 'All' : f === 'task' ? 'Tasks' : 'Groups'}
                    </button>
                  ))}
                </div>
                <Input
                  type="text"
                  value={historySearchDraft}
                  onChange={(e) => { setHistorySearchDraft(e.target.value); setHistoryPage(1); }}
                  placeholder="Search..."
                  className="h-8 max-w-[200px] text-xs"
                />
              </div>

              {/* History table */}
              <div className="flex-1 overflow-auto">
                {historyLoading ? (
                  <div className="flex h-full items-center justify-center py-10">
                    <div className="flex items-center gap-3 text-sm text-zinc-600">
                      <LoaderCircle size={18} className="animate-spin text-zinc-500" />
                      Loading history...
                    </div>
                  </div>
                ) : historyItems.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 py-16">
                    <div className="max-w-xs text-center">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                        <Clock3 size={24} strokeWidth={1.5} />
                      </div>
                      <h3 className="text-sm font-semibold text-zinc-900">No history yet</h3>
                      <p className="mt-1.5 text-xs leading-5 text-zinc-500">
                        {historySearch || historyTypeFilter !== 'all'
                          ? 'No items match your current filter or search.'
                          : 'Upload or process an invoice to see it appear here.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <table className="w-full min-w-[640px] table-fixed text-left text-[11px]">
                    <thead className="sticky top-0 z-10 bg-white shadow-sm">
                      <tr>
                        <th className="w-20 bg-white pl-6 pr-3 py-2 font-semibold uppercase tracking-tight text-zinc-500">Type</th>
                        <th className="bg-white px-3 py-2 font-semibold uppercase tracking-tight text-zinc-500">ID</th>
                        <th className="w-32 bg-white px-3 py-2 font-semibold uppercase tracking-tight text-zinc-500">Status</th>
                        <th className="w-40 bg-white px-3 py-2 font-semibold uppercase tracking-tight text-zinc-500">Created</th>
                        <th className="w-28 bg-white pl-3 pr-6 py-2 font-semibold uppercase tracking-tight text-zinc-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyItems.map((item) => (
                        <tr key={item.id} className="group border-t border-zinc-100 hover:bg-zinc-50/60">
                          <td className="pl-6 pr-3 py-2">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                item.type === 'group'
                                  ? 'border-blue-200 bg-blue-100 text-blue-700'
                                  : 'border-zinc-200 bg-zinc-100 text-zinc-600'
                              }`}
                            >
                              {item.type === 'group' ? 'Group' : 'Task'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className="block max-w-full truncate font-mono text-[10px] text-zinc-700"
                              title={item.type === 'group' ? item.groupId : item.taskId}
                            >
                              {item.type === 'group' ? item.groupId : item.taskId}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${historyStatusBadge(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-zinc-500">{formatHistoryDate(item.createdAt)}</td>
                          <td className="pl-3 pr-6 py-2">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleViewHistoryItem(item)}
                                className="flex items-center gap-1 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50"
                              >
                                <ArrowUpRight size={11} />
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => handleHistoryDelete(item)}
                                className="flex items-center rounded border border-zinc-200 bg-white p-0.5 text-zinc-700 shadow-sm transition-all hover:border-red-200 hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 size={11} className="text-red-500" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* History pagination */}
              {!historyLoading && (historyPage > 1 || historyHasNext) && (
                <div className="shrink-0 flex items-center justify-center gap-3 border-t border-zinc-100 px-6 py-2">
                  <button
                    type="button"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((p) => p - 1)}
                    className="rounded border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-[11px] text-zinc-500">Page {historyPage}</span>
                  <button
                    type="button"
                    disabled={!historyHasNext}
                    onClick={() => setHistoryPage((p) => p + 1)}
                    className="rounded border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

          <UploadInvoiceModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onBatchCreated={handleBatchCreated}
          />

          <BatchStatusModal
            isOpen={batchModalOpen}
            batchId={batchGroupId}
            groupId={batchGroupId}
            items={batchItems}
            allDone={batchAllDone}
            now={batchNow}
            onClose={() => { setBatchModalOpen(false); batchSseRef.current?.abort(); }}
            onSubmitAll={handleSubmitAll}
            onSubmitItem={handleSubmitItem}
            submittingItems={submittingItems}
          />

          <InvoiceDetailModal
            isOpen={detailModalOpen}
            docKey={detailDocKey}
            onClose={() => setDetailModalOpen(false)}
          />

          <DeleteConfirmModal
            isOpen={voidConfirmOpen}
            onClose={() => { setVoidConfirmOpen(false); setInvoiceToVoid(null); }}
            onConfirm={() => void handleVoidConfirm()}
            title="Void Invoice"
            itemName={invoiceToVoid?.docNo}
            message="This will send a void request to the accounting system. This cannot be undone."
          />

          <DeleteConfirmModal
            isOpen={deleteConfirmOpen}
            onClose={() => setDeleteConfirmOpen(false)}
            onConfirm={handleDeleteConfirm}
            title="Delete Invoice"
            itemName={invoiceToDelete?.supplierInvoiceNo}
            message="This invoice will be permanently removed from your records."
          />

          <DeleteConfirmModal
            isOpen={historyDeleteConfirmOpen}
            onClose={() => { setHistoryDeleteConfirmOpen(false); setHistoryItemToDelete(null); }}
            onConfirm={() => void confirmHistoryDelete()}
            title="Remove History"
            itemName={historyItemToDelete ? (historyItemToDelete.type === 'group' ? historyItemToDelete.groupId : historyItemToDelete.taskId) : undefined}
            message="This will hide the history record. The original invoice data will not be deleted."
          />
      </motion.div>
    </AnimatePresence>
  );
}
