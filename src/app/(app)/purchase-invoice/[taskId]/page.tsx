'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronDown, Plus, Trash2, Waves, Loader2, Edit3, Download, LayoutList, Check } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { RefreshCcw } from 'lucide-react';

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { safeExternalHref } from '@/lib/safe-url';
import { Search, AlertTriangle } from 'lucide-react';

import {
  waitForPurchaseInvoicePreview,
  getPurchaseInvoicePreviewTask,
  type PreviewTaskStatus,
  PurchaseInvoicePreviewPayload,
  PurchaseInvoicePreviewDetail,
  getCreditorOptions,
  getAgentOptions,
  getStockOptions,
  getDraftStockGroupOptions,
  getDraftStockGroupDetail,
  getDraftTaxCodeOptions,
  getCreditorDetail,
  getStockDetail,
  type PurchaseInvoicePreviewMatches,
  type PreviewProposedNewItem,
  type DraftStockGroupOption,
  type DraftTaxCodeOption,
} from '../../../../lib/purchase-invoice-create-api';
import { type PurchaseInvoiceSubmitRequest } from '../../../../lib/purchase-invoice-submit-api';
import { useAuth } from '../../../../components/AuthProvider';
import { authFetch } from '../../../../lib/auth-fetch';
import { useSubmit } from '../../../../components/SubmitProvider';
import { usePreviewProgress } from '../../../../components/PreviewProgressProvider';
import { BatchStatusModal, type BatchStatusItem } from '../../../../components/BatchStatusModal';

type PurchaseInvoiceTaskPageProps = {
  taskIdOverride?: string;
  isGroup?: boolean;
  groupId?: string;
  earlyImageUrlOverride?: string;
  groupItemIdOverride?: string;
  onGroupItemResolved?: (next: { groupId?: string; taskId?: string; imageUrl?: string }) => void;
};

function buildAssetProxyUrl(url: string | null | undefined): string | null {
  const safeUrl = safeExternalHref(url);
  if (!safeUrl) {
    return null;
  }
  return `/api/purchase-invoice/asset?url=${encodeURIComponent(safeUrl)}`;
}

export default function PurchaseInvoiceTaskPage({
  taskIdOverride,
  isGroup = false,
  groupId: groupIdProp,
  earlyImageUrlOverride,
  groupItemIdOverride,
  onGroupItemResolved,
}: PurchaseInvoiceTaskPageProps = {}) {
  const params = useParams();
  const router = useRouter();
  const taskId = taskIdOverride ?? (params.taskId as string);
  const groupId = groupIdProp || (typeof params.groupId === 'string' ? params.groupId : '');

  const { profile, accessToken } = useAuth();
  const { startSubmit, isRunning: submitting, status: submitStatus } = useSubmit();
  // Tracks whether this task was already submitted (persists across modal dismissal
  // and covers tasks loaded from a previous session where submitStatus starts null).
  const [pageAlreadySubmitted, setPageAlreadySubmitted] = useState(false);
  const { startReanalyze, isRunning: reanalyzeRunning } = usePreviewProgress();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadNonce, setLoadNonce] = useState(0);
  const [payload, setPayload] = useState<PurchaseInvoicePreviewPayload | null>(null);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [manuallyAddedRows, setManuallyAddedRows] = useState<Record<number, boolean>>({});
  const [warnings, setWarnings] = useState<unknown[]>([]);
  const [taskStatus, setTaskStatus] = useState<PreviewTaskStatus | null>(null);
  const [draftId, setDraftId] = useState<string>('');
  const [earlyDownloadUrl, setEarlyDownloadUrl] = useState<string | null>(null);
  const [earlyExternalLink, setEarlyExternalLink] = useState<string | null>(null);
  const [earlyImageUrl, setEarlyImageUrl] = useState<string | null>(earlyImageUrlOverride ?? null);
  const [isRefreshingOriginal, setIsRefreshingOriginal] = useState(false);
  const [previewMode, setPreviewMode] = useState<'form' | 'original'>('form');
  const [matches, setMatches] = useState<PurchaseInvoicePreviewMatches>({});

  const [createItemsEnabled, setCreateItemsEnabled] = useState<Record<number, boolean>>({});
  const [manualAutoCreateEnabled, setManualAutoCreateEnabled] = useState<Record<number, boolean>>({});
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [deletingItemIndex, setDeletingItemIndex] = useState<number | null>(null);
  const [groupItems, setGroupItems] = useState<BatchStatusItem[]>([]);
  const [groupAllDone, setGroupAllDone] = useState(false);
  const [groupNow, setGroupNow] = useState(Date.now());
  const [submittingGroupItems, setSubmittingGroupItems] = useState<Set<string>>(new Set());
  const [groupMonitorNonce, setGroupMonitorNonce] = useState(0);

  // Search/Picker states
  const [creditorOptions, setCreditorOptions] = useState<any[]>([]);
  const [agentOptions, setAgentOptions] = useState<any[]>([]);
  const [stockOptions, setStockOptions] = useState<any[]>([]);
  
  const [creditorSearch, setCreditorSearch] = useState("");
  const [agentSearch, setAgentSearch] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  
  const [isCreditorLoading, setIsCreditorLoading] = useState(false);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [isStockLoading, setIsStockLoading] = useState(false);
  const [isCreditorLoadingMore, setIsCreditorLoadingMore] = useState(false);
  const [isAgentLoadingMore, setIsAgentLoadingMore] = useState(false);
  const [isStockLoadingMore, setIsStockLoadingMore] = useState(false);
  
  const [isCreditorOpen, setIsCreditorOpen] = useState(false);
  const [creditorCompanyName, setCreditorCompanyName] = useState<string>('');
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [activeStockIdx, setActiveStockIdx] = useState<number | null>(null);

  const [creditorPage, setCreditorPage] = useState(1);
  const [creditorTotalPages, setCreditorTotalPages] = useState(1);
  const [agentPage, setAgentPage] = useState(1);
  const [agentTotalPages, setAgentTotalPages] = useState(1);
  const [stockPage, setStockPage] = useState(1);
  const [stockTotalPages, setStockTotalPages] = useState(1);
  const autoCreateSnapshotRef = useRef<Record<number, { itemCode: string; itemGroup: string; accNo: string }>>({});
  const autoCreateBaselineRef = useRef<Record<number, { itemCode: string; itemGroup: string; accNo: string }>>({});
  const manualStockSnapshotRef = useRef<Record<number, { itemCode: string; itemGroup: string; accNo: string }>>({});
  const itemCodeManuallyEditedRef = useRef<Record<number, boolean>>({});
  const [draftStockGroupOptions, setDraftStockGroupOptions] = useState<DraftStockGroupOption[]>([]);
  const [draftTaxCodeOptions, setDraftTaxCodeOptions] = useState<DraftTaxCodeOption[]>([]);
  const [draftPickersLoading, setDraftPickersLoading] = useState(false);
  const [stockGroupDialogSearch, setStockGroupDialogSearch] = useState('');
  const [isStockGroupPickerOpen, setIsStockGroupPickerOpen] = useState(false);
  const [stockGroupSearch, setStockGroupSearch] = useState('');
  const [isTaxCodePickerOpen, setIsTaxCodePickerOpen] = useState(false);
  const [taxCodeSearch, setTaxCodeSearch] = useState('');

  // Keep late-arriving parent override in sync (common on group/item route).
  useEffect(() => {
    if (!earlyImageUrlOverride) return;
    setEarlyImageUrl((current) => current || earlyImageUrlOverride);
  }, [earlyImageUrlOverride]);

  useEffect(() => {
    if (!taskId) return;

    let isMounted = true;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    setPayload(null);
    waitForPurchaseInvoicePreview(taskId, 'invoice', {
      accessToken: accessToken ?? undefined,
      signal: controller.signal,
      onProgress: (nextTask) => {
        if (!isMounted) {
          return;
        }
        setTaskStatus(nextTask.status);
        if (nextTask.file?.downloadUrl) {
          setEarlyDownloadUrl(nextTask.file.downloadUrl);
        }
        if (nextTask.externalLink) {
          setEarlyExternalLink(nextTask.externalLink);
        }
        if (nextTask.imageUrl) {
          setEarlyImageUrl(nextTask.imageUrl);
        }
      },
    })
      .then((res: any) => {
        if (isMounted) {
          if (res.draftId) setDraftId(res.draftId);
          setPayload(res.payload);
          const resolvedWarnings = res.warnings || [];
          setWarnings(resolvedWarnings);
          const previewMatches: PurchaseInvoicePreviewMatches = res.matches || {};
          setMatches(previewMatches);


          // Auto-enable autocreate whenever the backend proposes a new item.
          // This keeps `isAutoCreate` aligned with the server-side proposal.
          const p = res.payload as PurchaseInvoicePreviewPayload;
          const itemToggles: Record<number, boolean> = {};
          p.details.forEach((d: PurchaseInvoicePreviewDetail, i: number) => {
            if (previewMatches.items?.[i]?.proposedNewItem) {
              itemToggles[i] = true;
            }
          });
          setCreateItemsEnabled(itemToggles);

          // If the backend suggested a new item and we auto-enabled create, fill the row inputs
          // so users can review/edit inline (instead of showing "Create: NEWITEM" text).
          const nextDetails = p.details.map((d, i) => {
            if (!itemToggles[i]) return d;
            const proposed = (previewMatches.items?.[i]?.proposedNewItem || {}) as PreviewProposedNewItem;
            return {
              ...d,
              itemCode: String(proposed.itemCodeSuggestion || d.itemCode || ''),
              itemGroup: String(proposed.itemGroup || d.itemGroup || ''),
              description: String(proposed.description || d.description || ''),
              desc2: String((proposed as any).desc2 || d.desc2 || ''),
              uom: String(proposed.purchaseUom || proposed.baseUom || d.uom || 'UNIT'),
            } satisfies PurchaseInvoicePreviewDetail;
          });
          autoCreateBaselineRef.current = nextDetails.reduce<Record<number, { itemCode: string; itemGroup: string; accNo: string }>>((acc, detail, index) => {
            if (!itemToggles[index]) return acc;
            acc[index] = {
              itemCode: detail.itemCode,
              itemGroup: detail.itemGroup,
              accNo: detail.accNo,
            };
            return acc;
          }, {});
          autoCreateSnapshotRef.current = Object.fromEntries(
            Object.entries(autoCreateSnapshotRef.current).filter(([key]) => itemToggles[Number(key)] !== false)
          ) as Record<number, { itemCode: string; itemGroup: string; accNo: string }>;
          setPayload({ ...p, details: nextDetails });

          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          if (err?.status === 499) {
            toast.message('Preview cancelled. You can upload another invoice anytime.');
            router.push('/purchase-invoice');
            return;
          }
          const message = err?.message || 'Failed to load preview';
          setLoadError(message);
          toast.error(message);
          setLoading(false);
        }
      });
    return () => { isMounted = false; controller.abort(); };
  }, [router, taskId, loadNonce, accessToken]);

  // On mount: query history API to check if this task was already submitted
  // (handles page refresh after submission).
  useEffect(() => {
    if (!taskId || !accessToken) return;
    let cancelled = false;
    authFetch(`/api/purchase-invoice/history?q=${encodeURIComponent(taskId)}&type=task&pageSize=5`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => res.json())
      .then((data: any) => {
        if (cancelled) return;
        const items: any[] = data?.items ?? [];
        const found = items.find((item) => item.taskId === taskId && item.status === 'submitted');
        if (found) setPageAlreadySubmitted(true);
      })
      .catch(() => { /* ignore — non-critical */ });
    return () => { cancelled = true; };
  }, [taskId, accessToken]);

  // Once submit reaches a terminal success, latch pageAlreadySubmitted.
  useEffect(() => {
    if ((submitStatus === 'submitted' || submitStatus === 'completed') && taskId) {
      setPageAlreadySubmitted(true);
    }
  }, [submitStatus, taskId]);

  // Backend may mark task succeeded before image rendering is available.
  // Retry a few times in background so users don't need manual refresh.
  useEffect(() => {
    if (!taskId || !accessToken) return;
    if (taskStatus !== 'succeeded') return;
    if (earlyImageUrl) return;

    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (cancelled) return;

        try {
          const refreshed = await getPurchaseInvoicePreviewTask(taskId, {
            accessToken,
            signal: controller.signal,
          });

          if (cancelled) return;

          if (refreshed.externalLink) {
            setEarlyExternalLink((prev) => prev || refreshed.externalLink || null);
            setEarlyDownloadUrl((prev) => prev || refreshed.externalLink || null);
          }

          if (refreshed.imageUrl) {
            setEarlyImageUrl(refreshed.imageUrl);
            return;
          }
        } catch {
          // Ignore transient errors and keep retrying briefly.
        }

        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [taskId, accessToken, taskStatus, earlyImageUrl]);

  const retryLoad = () => {
    setLoadNonce((current) => current + 1);
  };

  const handleRefreshOriginal = async () => {
    if (!accessToken) {
      toast.error('Your session is not ready yet.');
      return;
    }

    setIsRefreshingOriginal(true);
    try {
      let resolvedTaskId = taskId;

      if (groupItemIdOverride) {
        const itemRes = await authFetch(`/api/purchase-invoice/batch/item?itemId=${encodeURIComponent(groupItemIdOverride)}`, {
          cache: 'no-store',
        });
        if (itemRes.ok) {
          const itemData = await itemRes.json() as {
            item?: { groupId?: string; taskId?: string };
            task?: { fileServer?: { imageUrl?: string } };
          };
          if (itemData.item?.taskId) {
            resolvedTaskId = itemData.item.taskId;
          }
          if (itemData.task?.fileServer?.imageUrl) {
            setEarlyImageUrl(itemData.task.fileServer.imageUrl);
          }
          onGroupItemResolved?.({
            groupId: itemData.item?.groupId,
            taskId: itemData.item?.taskId,
            imageUrl: itemData.task?.fileServer?.imageUrl,
          });
        }
      }

      if (!resolvedTaskId) {
        throw new Error('Preview task is not ready yet.');
      }

      const refreshed = await getPurchaseInvoicePreviewTask(resolvedTaskId, {
        accessToken,
      });
      if (refreshed.externalLink) {
        setEarlyExternalLink(refreshed.externalLink);
        setEarlyDownloadUrl(refreshed.externalLink);
      }
      if (refreshed.imageUrl) {
        setEarlyImageUrl(refreshed.imageUrl);
      }
      toast.success(refreshed.imageUrl ? 'Preview refreshed.' : 'Preview checked. Image is still not ready yet.');
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Unable to refresh the original preview.';
      toast.error(message);
    } finally {
      setIsRefreshingOriginal(false);
    }
  };

  // Duplicate invoice check removed — not needed at this stage.


  const handleReanalyze = async () => {
    if (reanalyzeRunning) return;
    if (!taskId) return;

    try {
      toast.message('Reanalyzing invoice. This can take a moment…');
      const finalStatus = await startReanalyze({
        taskId,
        fileName: null,
        onProgress: (res) => {
          setTaskStatus(res.status);
          if (res.file?.downloadUrl) setEarlyDownloadUrl(res.file.downloadUrl);
          if (res.externalLink) setEarlyExternalLink(res.externalLink);
          if (res.imageUrl) setEarlyImageUrl(res.imageUrl);
        },
      });

      if (finalStatus === 'succeeded') {
        setLoadNonce((current) => current + 1);
      }
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Failed to reanalyze invoice.';
      toast.error(message);
    }
  };

  const activeEditingDetail = editingItemIndex !== null ? payload?.details?.[editingItemIndex] ?? null : null;
  const activeAutoCreate = editingItemIndex !== null
    ? !!(manualAutoCreateEnabled[editingItemIndex] || (createItemsEnabled[editingItemIndex] && matches.items?.[editingItemIndex]?.proposedNewItem))
    : false;

  // Fetch group items for the stats modal when opened on a batch item page.
  // Uses SSE for real-time updates with a polling fallback.
  useEffect(() => {
    if (!isGroup || !groupId || !isStatsModalOpen) return;

    const controller = new AbortController();
    const { signal } = controller;

    const TERMINAL = new Set<BatchStatusItem['phase']>(['succeeded', 'failed', 'canceled', 'cancelled', 'submitted', 'submit_failed', 'not_ready']);

    const mapPhase = (s: string): BatchStatusItem['phase'] | null => {
      switch (s) {
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
        case 'canceled': return 'canceled';
        case 'cancelled': return 'cancelled';
        case 'submit_queued': return 'submit_queued';
        case 'submitting_stock': return 'submitting_stock';
        case 'submitting_pi': return 'submitting_pi';
        case 'submitted': return 'submitted';
        case 'submit_failed': return 'submit_failed';
        case 'not_ready': return 'not_ready';
        default: return null;
      }
    };
    const parseMs = (v?: string | null) => { if (!v) return null; const ms = Date.parse(v); return isNaN(ms) ? null : ms; };

    // itemId → mutable snapshot map so SSE can update individual rows
    const itemMap = new Map<string, BatchStatusItem>();

    type GroupSnapshot = {
      status?: string;
      submitStatus?: string;
      items?: Array<{
        itemId?: string; taskId?: string; fileName?: string;
        status?: string; analysisStatus?: string; startedAt?: string; completedAt?: string;
      }>;
    };

    type SseEvent = {
      eventType?: string; itemId?: string; status?: string;
      fileName?: string; startedAt?: string; completedAt?: string;
    };

    const isGroupDone = (data: GroupSnapshot) => {
      const analysisDone = data.status === 'completed' || data.status === 'completed_with_failures';
      const submitInProgress = data.submitStatus === 'submitting';
      return analysisDone && !submitInProgress;
    };

    const applySnapshot = (data: GroupSnapshot): boolean => {
      for (const it of data.items ?? []) {
        const id = it.itemId ?? it.taskId ?? '';
        if (!id) continue;
        const previous = itemMap.get(id);
        const phase = mapPhase(it.status ?? '') ?? previous?.phase ?? 'queued';
        const analysisPhase = it.analysisStatus
          ? (mapPhase(it.analysisStatus) ?? previous?.analysisPhase ?? undefined)
          : (phase === 'succeeded' ? 'succeeded' : previous?.analysisPhase);
        itemMap.set(id, {
          ...(previous ?? {}),
          id,
          fileName: it.fileName ?? previous?.fileName ?? id,
          fileSize: previous?.fileSize ?? 0,
          phase,
          analysisPhase,
          previewTaskId: it.taskId ?? it.itemId ?? previous?.previewTaskId ?? null,
          startedAt: parseMs(it.startedAt) ?? previous?.startedAt ?? null,
          completedAt: parseMs(it.completedAt) ?? previous?.completedAt ?? null,
          error: null,
          warningCount: previous?.warningCount ?? 0,
        });
      }
      if (itemMap.size > 0) { setGroupItems([...itemMap.values()]); setGroupNow(Date.now()); }
      const done = isGroupDone(data) || (itemMap.size > 0 && [...itemMap.values()].every((i) => TERMINAL.has(i.phase)));
      if (done) setGroupAllDone(true);
      return done;
    };

    const applyEvent = (ev: SseEvent): boolean => {
      if (ev.eventType === 'item_status_changed' && ev.itemId) {
        const existing = itemMap.get(ev.itemId) ?? {
          id: ev.itemId, fileName: ev.fileName ?? ev.itemId,
          fileSize: 0, previewTaskId: ev.itemId,
          startedAt: null, completedAt: null, error: null, warningCount: 0,
          phase: 'queued' as BatchStatusItem['phase'],
        };
        const newPhase = ev.status ? (mapPhase(ev.status) ?? existing.phase) : existing.phase;
        itemMap.set(ev.itemId, {
          ...existing,
          phase: newPhase,
          fileName: ev.fileName ?? existing.fileName,
          startedAt: parseMs(ev.startedAt) ?? existing.startedAt,
          completedAt: parseMs(ev.completedAt) ?? existing.completedAt,
        });
        setGroupItems([...itemMap.values()]); setGroupNow(Date.now());
      }
      // Handle submit stage SSE events
      if (
        (ev.eventType === 'item_submit_queued' || ev.eventType === 'item_submit_status_changed' ||
         ev.eventType === 'item_submitted' || ev.eventType === 'item_submit_failed' ||
         ev.eventType === 'item_submit_skipped') && ev.itemId
      ) {
        const phaseFromStatus = ev.status ? mapPhase(ev.status) : null;
        const phaseFromEvent: BatchStatusItem['phase'] | null =
          ev.eventType === 'item_submit_queued'  ? 'submit_queued' :
          ev.eventType === 'item_submitted'       ? 'submitted' :
          ev.eventType === 'item_submit_failed'   ? 'submit_failed' :
          ev.eventType === 'item_submit_skipped'  ? 'not_ready' : null;
        const existing = itemMap.get(ev.itemId);
        if (existing) {
          const newPhase: BatchStatusItem['phase'] =
            (phaseFromStatus && phaseFromStatus !== 'queued') ? phaseFromStatus :
            phaseFromEvent ?? (ev.status ? (mapPhase(ev.status) ?? existing.phase) : existing.phase);
          itemMap.set(ev.itemId, { ...existing, phase: newPhase });
          setGroupItems([...itemMap.values()]); setGroupNow(Date.now());
        }
      }
      if (ev.eventType === 'group_status_changed') {
        const allTerminal = itemMap.size > 0 && [...itemMap.values()].every((i) => TERMINAL.has(i.phase));
        if (allTerminal) { setGroupAllDone(true); return true; }
      }
      const allTerminal = itemMap.size > 0 && [...itemMap.values()].every((i) => TERMINAL.has(i.phase));
      if (allTerminal) { setGroupAllDone(true); return true; }
      return false;
    };

    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const startPolling = () => {
      const poll = async () => {
        if (signal.aborted) return;
        try {
          const res = await authFetch(`/api/purchase-invoice/batch/group?groupId=${encodeURIComponent(groupId)}`, {
            cache: 'no-store', signal,
          });
          if (!res.ok || signal.aborted) return;
          const data = (await res.json()) as GroupSnapshot;
          const done = applySnapshot(data);
          if (!done && !signal.aborted) pollTimer = setTimeout(poll, 2500);
        } catch {
          if (!signal.aborted) pollTimer = setTimeout(poll, 3000);
        }
      };
      pollTimer = setTimeout(poll, 500);
    };

    void (async () => {
      // Initial snapshot fetch so the modal has data immediately
      try {
        const res = await authFetch(`/api/purchase-invoice/batch/group?groupId=${encodeURIComponent(groupId)}`, {
          cache: 'no-store', signal,
        });
        if (res.ok) {
          const data = (await res.json()) as GroupSnapshot;
          if (applySnapshot(data)) return;
        }
      } catch { /* continue to SSE */ }

      // Then connect to SSE for live updates
      try {
        const res = await authFetch(
          `/api/purchase-invoice/batch/group/events?groupId=${encodeURIComponent(groupId)}`,
          { headers: { Accept: 'text/event-stream' }, signal },
        );
        if (!res.ok || !res.body) { startPolling(); return; }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (value?.length) buf += decoder.decode(value, { stream: !done });
            const blocks = buf.split(/\r?\n\r?\n/);
            buf = done ? '' : (blocks.pop() ?? '');
            for (const block of blocks) {
              if (!block.trim()) continue;
              let dataStr = '';
              for (const rawLine of block.split('\n')) {
                const line = rawLine.replace(/\r$/, '');
                if (line.startsWith('data:')) dataStr = line.slice(5).trim();
              }
              if (!dataStr) continue;
              try {
                const ev = JSON.parse(dataStr) as SseEvent;
                if (ev.eventType === 'replay_completed') continue;
                if (applyEvent(ev)) return;
              } catch { /* skip */ }
            }
            if (done) break;
          }
        } finally { reader.cancel().catch(() => {}); }
        if (!signal.aborted) startPolling();
      } catch {
        if (!signal.aborted) startPolling();
      }
    })();

    const tick = window.setInterval(() => { if (!signal.aborted) setGroupNow(Date.now()); }, 1000);
    return () => {
      controller.abort();
      window.clearInterval(tick);
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [isGroup, groupId, isStatsModalOpen, accessToken, groupMonitorNonce]);

  async function handleGroupSubmitItem(itemId: string) {
    setSubmittingGroupItems((prev) => new Set([...prev, itemId]));
    try {
      const res = await authFetch(`/api/purchase-invoice/batch/item/submit?itemId=${encodeURIComponent(itemId)}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null;
        toast.error(data?.error ?? 'Submit failed.');
      } else {
        setGroupItems((prev) => prev.map((it) => it.id === itemId ? { ...it, phase: 'submit_queued' } : it));
        setGroupAllDone(false);
        setGroupMonitorNonce((n) => n + 1);
      }
    } catch {
      toast.error('Submit failed.');
    } finally {
      setSubmittingGroupItems((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
    }
  }

  async function handleGroupSubmitAll() {
    if (!groupId) return;
    try {
      const res = await authFetch(`/api/purchase-invoice/batch/group/submit-all?groupId=${encodeURIComponent(groupId)}`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => null) as { queuedCount?: number; error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error ?? 'Submit all failed.');
      } else {
        toast.success(`${data?.queuedCount ?? 0} invoice${(data?.queuedCount ?? 0) !== 1 ? 's' : ''} queued for submission.`);
        setGroupAllDone(false);
        setGroupMonitorNonce((n) => n + 1);
      }
    } catch {
      toast.error('Submit all failed.');
    }
  }

  // When the AI returns a creditorCode but we have no display name yet,
  // fetch the creditor detail to populate the button label.
  useEffect(() => {
    const code = payload?.creditorCode;
    if (!code || creditorCompanyName || !accessToken) return;
    void getCreditorDetail(code, accessToken).then((detail) => {
      if (detail?.companyName) setCreditorCompanyName(detail.companyName);
    });
  }, [payload?.creditorCode, creditorCompanyName, accessToken]);

  useEffect(() => {
    if (!isCreditorOpen) {
      return;
    }

    const fetchOptions = async () => {
      // If we already preloaded and user hasn't typed a search, don't refetch on open.
      if (!creditorSearch.trim() && creditorOptions.length > 0 && creditorPage >= 1) {
        return;
      }
      setIsCreditorLoading(true);
      setIsCreditorLoadingMore(false);
      try {
        const res = await getCreditorOptions({ search: creditorSearch, page: 1, pageSize: 20 }, accessToken ?? undefined);
        setCreditorOptions(res.items || []);
        setCreditorPage(res.page ?? 1);
        setCreditorTotalPages(res.totalPages ?? 1);
      } catch (error) {
        console.error('Creditor options error:', error);
      } finally {
        setIsCreditorLoading(false);
      }
    };
    const timer = setTimeout(fetchOptions, 250);
    return () => clearTimeout(timer);
  }, [creditorOptions.length, creditorPage, creditorSearch, isCreditorOpen]);

  useEffect(() => {
    if (!isAgentOpen) {
      return;
    }

    const fetchOptions = async () => {
      if (!agentSearch.trim() && agentOptions.length > 0 && agentPage >= 1) {
        return;
      }
      setIsAgentLoading(true);
      setIsAgentLoadingMore(false);
      try {
        const res = await getAgentOptions({ search: agentSearch, page: 1, pageSize: 20 }, accessToken ?? undefined);
        setAgentOptions(res.items || []);
        setAgentPage(res.page ?? 1);
        setAgentTotalPages(res.totalPages ?? 1);
      } catch (error) {
        console.error('Agent options error:', error);
      } finally {
        setIsAgentLoading(false);
      }
    };
    const timer = setTimeout(fetchOptions, 250);
    return () => clearTimeout(timer);
  }, [agentOptions.length, agentPage, agentSearch, isAgentOpen]);

  useEffect(() => {
    if (activeStockIdx === null) {
      return;
    }

    const fetchOptions = async () => {
      setIsStockLoading(true);
      setIsStockLoadingMore(false);
      try {
        const res = await getStockOptions({ search: stockSearch, page: 1, pageSize: 20 }, accessToken ?? undefined);
        setStockOptions(res.items || []);
        setStockPage(res.page ?? 1);
        setStockTotalPages(res.totalPages ?? 1);
      } catch (error) {
        console.error('Stock options error:', error);
      } finally {
        setIsStockLoading(false);
      }
    };
    const timer = setTimeout(fetchOptions, 250);
    return () => clearTimeout(timer);
  }, [activeStockIdx, stockSearch]);

  useEffect(() => {
    if (editingItemIndex === null) {
      return;
    }

    let isMounted = true;
    const loadDraftPickers = async () => {
      if (draftStockGroupOptions.length > 0 && draftTaxCodeOptions.length > 0) {
        return;
      }
      setDraftPickersLoading(true);
      try {
        const [groups, taxCodes] = await Promise.all([
          draftStockGroupOptions.length > 0 ? Promise.resolve(draftStockGroupOptions) : getDraftStockGroupOptions(accessToken ?? undefined),
          draftTaxCodeOptions.length > 0 ? Promise.resolve(draftTaxCodeOptions) : getDraftTaxCodeOptions(accessToken ?? undefined),
        ]);
        if (!isMounted) return;
        setDraftStockGroupOptions(groups);
        setDraftTaxCodeOptions(taxCodes);
      } catch (error) {
        console.error('Draft picker options error:', error);
      } finally {
        if (isMounted) setDraftPickersLoading(false);
      }
    };

    void loadDraftPickers();
    return () => {
      isMounted = false;
    };
  }, [accessToken, draftStockGroupOptions.length, draftTaxCodeOptions.length, editingItemIndex]);

  const loadMoreCreditors = async () => {
    if (!isCreditorOpen) return;
    if (isCreditorLoading || isCreditorLoadingMore) return;
    if (creditorPage >= creditorTotalPages) return;

    setIsCreditorLoadingMore(true);
    try {
      const nextPage = creditorPage + 1;
      const res = await getCreditorOptions({ search: creditorSearch, page: nextPage, pageSize: 20 }, accessToken ?? undefined);
      setCreditorOptions((prev) => {
        const seen = new Set(prev.map((o) => o.accNo));
        return [...prev, ...(res.items || []).filter((o) => !seen.has(o.accNo))];
      });
      setCreditorPage(res.page ?? nextPage);
      setCreditorTotalPages(res.totalPages ?? creditorTotalPages);
    } catch (error) {
      console.error('Creditor options (load more) error:', error);
    } finally {
      setIsCreditorLoadingMore(false);
    }
  };

  const loadMoreAgents = async () => {
    if (!isAgentOpen) return;
    if (isAgentLoading || isAgentLoadingMore) return;
    if (agentPage >= agentTotalPages) return;

    setIsAgentLoadingMore(true);
    try {
      const nextPage = agentPage + 1;
      const res = await getAgentOptions({ search: agentSearch, page: nextPage, pageSize: 20 }, accessToken ?? undefined);
      setAgentOptions((prev) => [...prev, ...(res.items || [])]);
      setAgentPage(res.page ?? nextPage);
      setAgentTotalPages(res.totalPages ?? agentTotalPages);
    } catch (error) {
      console.error('Agent options (load more) error:', error);
    } finally {
      setIsAgentLoadingMore(false);
    }
  };

  const loadMoreStocks = async () => {
    if (activeStockIdx === null) return;
    if (isStockLoading || isStockLoadingMore) return;
    if (stockPage >= stockTotalPages) return;

    setIsStockLoadingMore(true);
    try {
      const nextPage = stockPage + 1;
      const res = await getStockOptions({ search: stockSearch, page: nextPage, pageSize: 20 }, accessToken ?? undefined);
      setStockOptions((prev) => [...prev, ...(res.items || [])]);
      setStockPage(res.page ?? nextPage);
      setStockTotalPages(res.totalPages ?? stockTotalPages);
    } catch (error) {
      console.error('Stock options (load more) error:', error);
    } finally {
      setIsStockLoadingMore(false);
    }
  };

  type WarningObject = {
    code: string;
    message?: string;
    line?: number;
    field?: string;
    severity?: string;
  };

  const isWarningObject = (value: unknown): value is WarningObject => {
    return typeof value === 'object' && value !== null && 'code' in value && typeof (value as any).code === 'string';
  };

  const checkWarning = (code: string, line?: number) => {
    const isGlobal = line === undefined || line === -1;
    return warnings.find(w => {
      // if warning is object
      if (isWarningObject(w)) {
        if (!w.code.includes(code)) return false;
        if (!isGlobal && w.line !== line) return false;
        return true;
      }
      // if warning is string
      if (typeof w === 'string') {
        if (!isGlobal) return w.includes(code) && w.includes(String(line));
        return w.includes(code);
      }
      return false;
    });
  };

  const removeWarning = (codes: string[], line?: number) => {
    const isGlobal = line === undefined || line === -1;
    setWarnings(prev => prev.filter(w => {
      if (isWarningObject(w)) {
        if (codes.includes(w.code)) {
          if (!isGlobal && w.line === line) return false;
          if (isGlobal) return false;
        }
        return true;
      }
      if (typeof w === 'string') {
        return !codes.some(c => !isGlobal ? (w.includes(c) && w.includes(String(line))) : w.includes(c));
      }
      return true;
    }));
  };

  const FieldWarning = ({ code, line, customMsg }: { code: string, line?: number, customMsg?: string }) => {
    const warning = checkWarning(code, line);
    if (!warning) return null;
    const backendMessage = isWarningObject(warning) ? warning.message : undefined;
    const backendField = isWarningObject(warning) ? warning.field : undefined;
    const fallbackMessage = isWarningObject(warning)
      ? warning.code
      : typeof warning === 'string'
        ? warning
        : 'Warning';
    const msg = backendMessage || customMsg || fallbackMessage;
    const detailSuffix = backendField ? ` (${backendField})` : '';
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className="cursor-help bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200 transition-colors uppercase tracking-wider text-[10px] py-0 px-1.5 h-5 flex items-center gap-1"
          >
            <AlertTriangle className="w-3 h-3 text-yellow-600" />
            WARNING
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="bg-zinc-900 border-zinc-800 text-white p-2 text-xs shadow-xl">
          <p className="font-medium">{msg}{detailSuffix}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  const hasAnyWarningForLine = (line: number) => {
    return warnings.some(w => isWarningObject(w) && (w as any).line === line);
  };

  const getBorderClass = (code: string, line?: number) => {
    const hasWarning = line !== undefined && line > 0
      ? hasAnyWarningForLine(line)
      : checkWarning(code, line);
    return hasWarning
      ? 'border-yellow-400 bg-yellow-50/50 ring-2 ring-yellow-400/20'
      : 'border-gray-200 bg-white focus:border-gray-300 focus:ring-1 focus:ring-gray-300';
  };

  const handleFieldChange = (field: keyof PurchaseInvoicePreviewPayload, value: any) => {
    setPayload((prev) => (prev ? { ...prev, [field]: value } : null));
    
    if (field === 'supplierInvoiceNo') removeWarning(['missing_invoice_number', 'invoice_number_already_exists']);
    if (field === 'docDate') removeWarning(['missing_invoice_date']);
    if (field === 'creditorCode') removeWarning(['creditor_needs_review', 'creditor_not_matched']);
    if (field === 'purchaseAgent') removeWarning(['agent_needs_review', 'agent_not_matched']);
    if (field === 'currencyCode') removeWarning(['currency_not_confirmed']);
    if (field === 'displayTerm') removeWarning(['display_term_not_confirmed']);
  };

  const handleItemChange = (index: number, field: keyof PurchaseInvoicePreviewDetail, value: any) => {
    setPayload((prev) => {
      if (!prev) return prev;
      const newDetails = [...prev.details];
      newDetails[index] = { ...newDetails[index], [field]: value };
      
      // Auto calc amount if qty or unitPrice changes
      if (field === 'qty' || field === 'unitPrice') {
        const qty = Number(newDetails[index].qty) || 0;
        const price = Number(newDetails[index].unitPrice) || 0;
        newDetails[index].amount = (qty * price).toFixed(2);
      }
      return { ...prev, details: newDetails };
    });

    if (field === 'itemCode') {
      itemCodeManuallyEditedRef.current[index] = true;
      removeWarning(['item_needs_review', 'item_not_matched'], index + 1);
    }
    if (field === 'description') {
       removeWarning(['item_needs_review', 'item_not_matched'], index + 1);
    }
    if (field === 'taxCode') {
       removeWarning(['tax_code_not_confirmed'], index + 1);
    }
  };

  const applyProposedNewItemToLine = (lineIndex: number, enabled: boolean) => {
    setPayload((prev) => {
      if (!prev) return prev;
      const proposed = (matches.items?.[lineIndex]?.proposedNewItem || {}) as PreviewProposedNewItem;
      const newDetails = [...prev.details];
      const current = newDetails[lineIndex];
      if (!current) return prev;

      if (!enabled) {
        autoCreateSnapshotRef.current[lineIndex] = {
          itemCode: current.itemCode || autoCreateBaselineRef.current[lineIndex]?.itemCode || '',
          itemGroup: current.itemGroup || autoCreateBaselineRef.current[lineIndex]?.itemGroup || '',
          accNo: current.accNo || autoCreateBaselineRef.current[lineIndex]?.accNo || '',
        };
        // Switching off "Create": allow selecting an existing stock item again.
        newDetails[lineIndex] = {
          ...current,
          itemCode: '',
          itemGroup: '',
          accNo: '',
        };
        return { ...prev, details: newDetails };
      }

      const cached = autoCreateSnapshotRef.current[lineIndex];
      const baseline = autoCreateBaselineRef.current[lineIndex];
      const suggestedCode = String(cached?.itemCode || proposed.itemCodeSuggestion || '').trim();
      const suggestedGroup = String(cached?.itemGroup || baseline?.itemGroup || proposed.itemGroup || current.itemGroup || '').trim();
      const suggestedAccNo = String(cached?.accNo || baseline?.accNo || current.accNo || '').trim();
      const suggestedDesc = String(proposed.description || current.description || '').trim();
      const suggestedDesc2 = String(proposed.desc2 || current.desc2 || '').trim();
      const suggestedUom = String(proposed.purchaseUom || proposed.baseUom || current.uom || 'UNIT').trim();

      newDetails[lineIndex] = {
        ...current,
        // Fill into the row so the user can see/edit it inline.
        itemCode: suggestedCode,
        itemGroup: suggestedGroup,
        accNo: suggestedAccNo,
        description: suggestedDesc,
        desc2: suggestedDesc2,
        uom: suggestedUom,
      };

      return { ...prev, details: newDetails };
    });
  };

  const applyDraftStockGroupToLine = (lineIndex: number, value: string) => {
    const selected = draftStockGroupOptions.find((option) => {
      const optionValue = String(option.itemGroup || option.shortCode || '').trim();
      return optionValue === value;
    });

    const nextItemGroup = String(selected?.itemGroup || selected?.shortCode || value || '').trim();
    const nextAccNo = String(selected?.purchaseCode || '').trim();

    // Apply itemGroup + accNo immediately from list data
    setPayload((prev) => {
      if (!prev) return prev;
      const newDetails = [...prev.details];
      const current = newDetails[lineIndex];
      if (!current) return prev;
      newDetails[lineIndex] = { ...current, itemGroup: nextItemGroup, accNo: nextAccNo };
      return { ...prev, details: newDetails };
    });

    // Fetch detail to get server-generated unique ItemCode, apply if user hasn't manually edited
    void getDraftStockGroupDetail(value, accessToken ?? undefined).then((detail) => {
      const generatedItemCode = String(detail?.generatedItemCode || '').trim();
      if (!generatedItemCode) return;
      setPayload((prev) => {
        if (!prev) return prev;
        const newDetails = [...prev.details];
        const current = newDetails[lineIndex];
        if (!current) return prev;
        // Only apply if user hasn't manually typed their own itemCode
        if (itemCodeManuallyEditedRef.current[lineIndex]) return prev;
        newDetails[lineIndex] = { ...current, itemCode: generatedItemCode };
        return { ...prev, details: newDetails };
      });
    });
  };

  const applyDraftTaxCodeToLine = (lineIndex: number, value: string) => {
    setPayload((prev) => {
      if (!prev) return prev;
      const newDetails = [...prev.details];
      const current = newDetails[lineIndex];
      if (!current) return prev;

      newDetails[lineIndex] = {
        ...current,
        taxCode: value,
      };

      return { ...prev, details: newDetails };
    });
  };

  const removeItem = (index: number) => {
    const shiftRecord = <T,>(source: Record<number, T>): Record<number, T> => {
      const next: Record<number, T> = {};
      for (const [key, value] of Object.entries(source)) {
        const keyIndex = Number(key);
        if (Number.isNaN(keyIndex)) continue;
        if (keyIndex < index) next[keyIndex] = value;
        if (keyIndex > index) next[keyIndex - 1] = value;
      }
      return next;
    };

    autoCreateSnapshotRef.current = shiftRecord(autoCreateSnapshotRef.current);
    autoCreateBaselineRef.current = shiftRecord(autoCreateBaselineRef.current);
    manualStockSnapshotRef.current = shiftRecord(manualStockSnapshotRef.current);
    itemCodeManuallyEditedRef.current = shiftRecord(itemCodeManuallyEditedRef.current);
    setCreateItemsEnabled((prev) => shiftRecord(prev));
    setManualAutoCreateEnabled((prev) => shiftRecord(prev));
    setManuallyAddedRows((prev) => shiftRecord(prev));
    setPayload((prev) => {
      if (!prev) return prev;
      const newDetails = [...prev.details];
      newDetails.splice(index, 1);
      return { ...prev, details: newDetails };
    });
  };

  const isBackendAutoCreateRow = (index: number) => !!(createItemsEnabled[index] && matches.items?.[index]?.proposedNewItem);
  const isManualAutoCreateRow = (index: number) => !!manualAutoCreateEnabled[index];
  const isAutoCreateRow = (index: number) => isBackendAutoCreateRow(index) || isManualAutoCreateRow(index);

  const createBlankDetail = (): PurchaseInvoicePreviewDetail => ({
    itemCode: '',
    description: '',
    desc2: '',
    qty: 1,
    unitPrice: 0,
    amount: 0,
    uom: 'UNIT',
    taxCode: '',
    accNo: '',
    itemGroup: '',
  });

  const appendNewItem = (): number | null => {
    if (!payload) return null;
    const nextIndex = payload.details.length;
    setPayload((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        details: [...prev.details, createBlankDetail()],
      };
    });
    setManuallyAddedRows((prev) => ({ ...prev, [nextIndex]: true }));
    return nextIndex;
  };

  const startNewStockItem = () => {
    const nextIndex = appendNewItem();
    if (nextIndex === null) return;
    setActiveStockIdx(nextIndex);
  };

  const buildSubmitRequest = (): PurchaseInvoiceSubmitRequest | null => {
    if (!payload || !taskId) return null;

    const details = payload.details.map((d: any, i: number) => {
      const proposed = matches.items?.[i]?.proposedNewItem ? ((matches.items?.[i]?.proposedNewItem || {}) as PreviewProposedNewItem) : null;
      const isAutoCreate = isAutoCreateRow(i);
      const qty = Number(d.qty);
      const unitPrice = Number(d.unitPrice);
      const amount = Number(d.amount);
      const autoCreateStock = isAutoCreate ? {
        ItemCode: d.itemCode || proposed?.itemCodeSuggestion || '',
        Description: d.description || proposed?.description || '',
        ItemGroup: d.itemGroup || proposed?.itemGroup || '',
        SalesUOM: proposed?.salesUom || 'UNIT',
        PurchaseUOM: proposed?.purchaseUom || 'UNIT',
        ReportUOM: proposed?.reportUom || 'UNIT',
        BaseUOM: proposed?.baseUom || 'UNIT',
        TaxCode: d.taxCode || proposed?.taxCode || null,
        PurchaseTaxCode: d.taxCode || proposed?.purchaseTaxCode || proposed?.taxCode || null,
        IsActive: true,
        StockControl: true,
      } : null;
      return {
        lineNo: i + 1,
        itemCode: d.itemCode || '',
        accNo: d.accNo || '',
        qty,
        uom: d.uom || '',
        unitPrice,
        amount,
        description: d.description || '',
        desc2: d.desc2 || '',
        taxCode: d.taxCode || '',
        itemGroup: d.itemGroup || '',
        isAutoCreate,
        ...(autoCreateStock ? { autoCreateStock } : {}),
      };
    });

    // Build address lines from creditorAddressLines
    const [invAddr1 = '', invAddr2 = '', invAddr3 = '', invAddr4 = ''] = payload.creditorAddressLines ?? [];

    return {
      taskId,
      accessToken: accessToken ?? undefined,
      header: {
        creditorCode: payload.creditorCode,
        purchaseAgent: payload.purchaseAgent || '',
        supplierInvoiceNo: payload.supplierInvoiceNo,
        docDate: payload.docDate,
        displayTerm: payload.displayTerm,
        currencyCode: payload.currencyCode,
        currencyRate: Number(payload.currencyRate) > 0 ? Number(payload.currencyRate) : 1,
        description: payload.description || 'PURCHASE INVOICE',
        externalLink: earlyExternalLink || payload.externalLink || '',
        invAddr1,
        invAddr2,
        invAddr3,
        invAddr4,
      },
      details,
    };
  };

  const validateBeforeSubmit = (): string | null => {
    if (!payload) return null;
    const details = payload.details ?? [];
    if (!accessToken?.trim()) {
      return 'Session expired. Please sign in again before submitting.';
    }
    if (details.length === 0) {
      return 'At least one item is required before submit.';
    }
    const missingExternalLink = !(earlyExternalLink || payload.externalLink || '').trim();
    if (missingExternalLink) {
      return 'Original document link is missing. Please reupload or refresh the task.';
    }
    const invalidLines = details.flatMap((detail, index) => {
      const problems: string[] = [];
      if (!String(detail.itemCode || '').trim()) problems.push('itemCode');
      if (!String(detail.uom || '').trim()) problems.push('uom');
      if (!String(detail.accNo || '').trim()) problems.push('accNo');
      const qty = Number(detail.qty);
      if (!Number.isFinite(qty) || qty <= 0) problems.push('qty');
      const unitPrice = Number(detail.unitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) problems.push('unitPrice');
      return problems.length > 0 ? [`line ${index + 1}: ${problems.join(', ')}`] : [];
    });
    if (invalidLines.length > 0) {
      return `Submit validation failed: ${invalidLines.join(' ; ')}`;
    }
    const missingAutoCreateLines = details.flatMap((detail, index) => {
      if (!isAutoCreateRow(index)) return [];
      return String(detail.itemCode || '').trim() && String(detail.description || '').trim() ? [] : [index + 1];
    });

    if (missingAutoCreateLines.length > 0) {
      return `Lines ${missingAutoCreateLines.join(', ')} need ItemCode and Description before submit.`;
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateBeforeSubmit();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const req = buildSubmitRequest();
    if (!req) return;
    await startSubmit(req);
  };

  const handleSubmitSilent = async () => {
    const validationError = validateBeforeSubmit();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const req = buildSubmitRequest();
    if (!req) return;
    await startSubmit(req, { silent: true });
  };

  const formatNumber = (num: number | string) => {
    return new Intl.NumberFormat('en-US').format(Number(num) || 0);
  };

  const parseNumber = (str: string) => {
    return Number(str.replace(/,/g, '')) || 0;
  };

  const downloadOriginalHref = safeExternalHref(earlyDownloadUrl || earlyExternalLink || payload?.externalLink || null);
  const proxiedDownloadOriginalHref = buildAssetProxyUrl(earlyDownloadUrl || earlyExternalLink || payload?.externalLink || null);
  const previewImageSrc = buildAssetProxyUrl(earlyImageUrl);
  const previewDocumentSrc = buildAssetProxyUrl(earlyExternalLink || payload?.externalLink || null);

  const isSubmitted = pageAlreadySubmitted || submitStatus === 'submitted' || submitStatus === 'completed';

  const statusLabel =
    isSubmitted
      ? 'Submitted'
      : taskStatus === 'queued'
        ? 'Queued'
        : taskStatus === 'ocr_processing'
          ? 'Reading'
          : taskStatus === 'analyzing'
            ? 'Drafting'
            : taskStatus === 'canceled'
              ? 'Cancelled'
              : taskStatus === 'failed'
                ? 'Failed'
                : taskStatus === 'succeeded'
                  ? 'Ready'
                  : null;

  if (loading) {
    return (
      <div className="flex h-screen flex-col bg-white">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200/80 bg-white/80 px-6 py-4 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950">Purchase invoice review draft</h1>
            {statusLabel ? (
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                {statusLabel}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <Link href={isGroup && groupId ? `/purchase-invoice/batch/${groupId}` : '/purchase-invoice'} className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900">Back</Link>
            {downloadOriginalHref ? (
              <div className="flex items-center gap-2">
                <a
                  href={downloadOriginalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
                >
                  <Download className="h-4 w-4" />
                  Download Original
                </a>
                {!isSubmitted && (
                  <button
                    type="button"
                    onClick={handleReanalyze}
                    disabled={reanalyzeRunning || submitting}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50"
                    title="Re-run OCR and AI extraction for this invoice"
                  >
                    {reanalyzeRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    Reanalyze
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-zinc-500">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            <p className="text-sm">Loading preview...</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !payload) {
    return (
      <div className="flex h-screen flex-col bg-white">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200/80 bg-white/80 px-6 py-4 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950">Purchase invoice review draft</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={isGroup && groupId ? `/purchase-invoice/batch/${groupId}` : '/purchase-invoice'}
              className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              Back
            </Link>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-zinc-900">Unable to load preview</h2>
                <p className="text-sm text-zinc-600">{loadError ?? 'Preview payload is unavailable.'}</p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={retryLoad}
                    className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                  >
                    Retry
                  </button>
                  <Link
                    href="/purchase-invoice"
                    className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Back to list
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const draftDetails = payload?.details ?? [];
  const subtotal = draftDetails.reduce((acc, item) => acc + (Number(item.qty) * Number(item.unitPrice)), 0);
  const taxAmount = draftDetails.reduce((acc, item) => {
    // Basic mock: 11% tax for items that have a taxCode present
    if (item.taxCode) {
      return acc + (Number(item.amount) * 0.11);
    }
    return acc;
  }, 0);
  const totalAmount = subtotal + taxAmount;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen flex-col bg-white font-sans text-zinc-900">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200/80 bg-white/80 px-6 py-4 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-950">Purchase invoice review draft</h1>
          {statusLabel ? (
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isSubmitted ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-50 text-zinc-600'}`}>
              {statusLabel}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/purchase-invoice"
            className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            Back
          </Link>
          {downloadOriginalHref && (
            <div className="flex items-center gap-2">
              <a
                href={downloadOriginalHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
              >
                <Download className="h-4 w-4" />
                Download Original
              </a>
              {!isSubmitted && (
                <button
                  type="button"
                  onClick={handleReanalyze}
                  disabled={reanalyzeRunning || submitting}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50"
                  title="Re-run OCR and AI extraction for this invoice"
                >
                  {reanalyzeRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  Reanalyze
                </button>
              )}
            </div>
          )}
          {isGroup && (
            <button
              type="button"
              onClick={() => setIsStatsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
            >
              <LayoutList className="h-4 w-4" />
              Stats
            </button>
          )}
          {!isSubmitted && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Purchase Invoice
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] h-full">
          
          {/* Left Column: Form */}
          <div className="p-8 border-r border-gray-100 overflow-y-auto">
            <h2 className="text-lg font-medium mb-8">Invoice Details</h2>

            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                {/* Creditor Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    Creditor Code
                    <FieldWarning code="creditor_not_matched" customMsg="No matching creditor found" />
                    <FieldWarning code="creditor_needs_review" customMsg="Please review creditor match" />
                  </label>
                  <Popover open={isCreditorOpen} onOpenChange={setIsCreditorOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        role="combobox"
                        className={cn("w-full h-[42px] flex items-center justify-between border rounded-md px-3 py-2 text-sm transition-all duration-200 bg-white outline-none", getBorderClass('creditor_', -1))}
                      >
                        {payload.creditorCode ? (
                          <span className="flex flex-col items-start min-w-0">
                            <span className="font-medium text-sm leading-tight">{payload.creditorCode}</span>
                            {creditorCompanyName && (
                              <span className="text-xs text-gray-400 truncate w-full leading-tight">{creditorCompanyName}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">Select Creditor</span>
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 bg-white shadow-xl border border-gray-100" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Search creditor..." 
                          value={creditorSearch}
                          onValueChange={setCreditorSearch}
                        />
                        <CommandList
                          className="max-h-72 overflow-auto"
                          onScroll={(event) => {
                            const target = event.currentTarget;
                            if (target.scrollTop + target.clientHeight >= target.scrollHeight - 32) {
                              void loadMoreCreditors();
                            }
                          }}
                        >
                          {isCreditorLoading && <div className="p-4 text-xs text-center text-gray-500">Loading...</div>}
                          <CommandEmpty>No results found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="none"
                              onSelect={() => {
                                handleFieldChange('creditorCode', "");
                                setCreditorCompanyName('');
                                setIsCreditorOpen(false);
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium text-red-500">None</span>
                              </div>
                            </CommandItem>
                            {creditorOptions.map((opt) => (
                              <CommandItem
                                key={opt.accNo}
                                value={opt.accNo}
                                onSelect={() => {
                                  handleFieldChange('creditorCode', opt.accNo);
                                  setCreditorCompanyName(opt.companyName ?? '');
                                  setIsCreditorOpen(false);
                                  // Fetch full creditor detail to update address, agent, currency, term
                                  void getCreditorDetail(opt.accNo, accessToken ?? undefined).then((detail) => {
                                    if (!detail) return;
                                    // Build address from address1-4 fields
                                    const addrParts = [detail.address1, detail.address2, detail.address3, detail.address4]
                                      .map((s) => s?.trim())
                                      .filter(Boolean) as string[];
                                    setPayload((prev) => {
                                      if (!prev) return prev;
                                      return {
                                        ...prev,
                                        purchaseAgent: detail.purchaseAgent ?? prev.purchaseAgent,
                                        displayTerm: detail.displayTerm ?? prev.displayTerm,
                                        currencyCode: detail.currencyCode ?? prev.currencyCode,
                                        currencyRate: detail.currencyRate ?? prev.currencyRate,
                                        creditorAddressLines: addrParts.length > 0 ? addrParts : prev.creditorAddressLines,
                                      };
                                    });
                                  });
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-semibold">{opt.accNo}</span>
                                  <span className="text-xs text-gray-500">{opt.companyName}</span>
                                </div>
                              </CommandItem>
                            ))}
                            {payload.creditorCode && !creditorSearch && !creditorOptions.find(o => o.accNo === payload.creditorCode) && (
                              <CommandItem
                                value={payload.creditorCode}
                                onSelect={() => setIsCreditorOpen(false)}
                              >
                                {payload.creditorCode} (Current)
                              </CommandItem>
                            )}
                          </CommandGroup>
                          {isCreditorLoadingMore ? (
                            <div className="p-3 text-xs text-center text-gray-500">Loading more...</div>
                          ) : null}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                {/* Purchase Agent */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    Purchase Agent
                    <FieldWarning code="agent_not_matched" customMsg="No matching agent found" />
                    <FieldWarning code="agent_needs_review" customMsg="Please review agent match" />
                  </label>
                  <div className="w-full h-[42px] flex items-center border rounded-md px-3 py-2 text-sm bg-zinc-50 text-zinc-600 select-none">
                    {payload.purchaseAgent || ''}
                  </div>
                </div>
                {/* Supplier Invoice No */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    Supplier Invoice No
                    <FieldWarning code="missing_invoice_number" customMsg="Missing Invoice No" />
                    <FieldWarning code="invoice_number_already_exists" customMsg="Invoice No Already Exists" />
                  </label>
                  <input
                    type="text"
                    value={payload.supplierInvoiceNo}
                    onChange={(e) => handleFieldChange('supplierInvoiceNo', e.target.value)}
                    className={cn("w-full h-[42px] rounded-md px-3 py-2.5 text-sm transition-colors border outline-none", getBorderClass('invoice_number', -1))}
                  />
                </div>
              </div>

              {/* Dates & Terms */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    Doc Date (YYYY-MM-DD)
                    <FieldWarning code="missing_invoice_date" customMsg="Missing Date" />
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "w-full h-[42px] flex items-center justify-between border rounded-md px-3 py-2 text-sm transition-colors bg-white outline-none",
                          !payload.docDate && "text-gray-500",
                          getBorderClass('missing_invoice_date')
                        )}
                      >
                        {payload.docDate ? payload.docDate : "Pick a date"}
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50 bg-white" align="start">
                      <Calendar
                        mode="single"
                        selected={payload.docDate ? new Date(payload.docDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            handleFieldChange('docDate', format(date, 'yyyy-MM-dd'));
                          }
                        }}
                        initialFocus
                        captionLayout="dropdown"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    Display Term
                    <FieldWarning code="display_term_not_confirmed" customMsg="Review term" />
                  </label>
                  <div className="w-full h-[42px] flex items-center rounded-lg px-3 py-2.5 text-sm border bg-zinc-50 text-zinc-600">
                    {payload.displayTerm || ''}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Location
                  </label>
                  <div className="w-full h-[42px] flex items-center rounded-lg px-3 py-2.5 text-sm border bg-zinc-50 text-zinc-600">
                    {payload.purchaseLocation || ''}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Currency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    Currency
                    <FieldWarning code="currency_not_confirmed" customMsg="Review currency" />
                  </label>
                  <div className="w-full h-[42px] flex items-center rounded-lg px-3 py-2.5 text-sm border bg-zinc-50 text-zinc-600">
                    {payload.currencyCode || ''}
                  </div>
                </div>
                {/* Currency Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Currency Rate
                  </label>
                  <div className="w-full h-[42px] flex items-center rounded-lg px-3 py-2.5 text-sm border bg-zinc-50 text-zinc-600">
                    {String(payload.currencyRate) || ''}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={payload.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  className="w-full h-[42px] rounded-lg px-3 py-2.5 text-sm border border-gray-200 bg-white outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
                />
              </div>

              <div className={cn("p-4 rounded-xl transition-all duration-200", !isSubmitted && checkWarning('missing_items') ? "border-2 border-yellow-400 bg-yellow-50/20 ring-4 ring-yellow-400/10" : "")}>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                  Items Details
                  <FieldWarning code="missing_items" customMsg="Missing Items" />
                </label>
                
                <div className="bg-gray-50/50 rounded-md p-3 mb-2 grid grid-cols-[1.5fr_1fr_60px_60px_1fr_1fr_60px] gap-3 text-xs font-medium text-gray-500 items-center">
                  <div>Item Code</div>
                  <div>Acc No</div>
                  <div className="text-center">QTY</div>
                  <div className="text-center">UOM</div>
                  <div className="text-right">Unit Price</div>
                  <div className="text-right">Amount</div>
                  <div className="text-center">Action</div>
                </div>

                <div className="space-y-3">
                  {draftDetails.map((item, index) => (
                    <div key={index} className={cn(
                      "flex flex-col gap-1 rounded-lg p-2 -mx-2 transition-all duration-200",
                      hasAnyWarningForLine(index + 1)
                        ? "border border-yellow-400 bg-yellow-50/30 ring-2 ring-yellow-400/10"
                        : isAutoCreateRow(index)
                        ? "border border-blue-300 bg-blue-50/20 ring-2 ring-blue-300/10"
                        : ""
                    )}>
                      <div className="flex flex-wrap gap-2 mb-1 items-center">
                        {/* Show single badge for all warnings on this line */}
                        {(() => {
                          const lineWarnings = warnings
                            .filter((w) => isWarningObject(w) && (w as any).line === index + 1)
                            .map((w) => w as { code: string; message?: string });
                          if (lineWarnings.length === 0 || isSubmitted) return null;
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="cursor-help bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200 transition-colors uppercase tracking-wider text-[10px] py-0 px-1.5 h-5 flex items-center gap-1"
                                >
                                  <AlertTriangle className="w-3 h-3 text-yellow-600" />
                                  {lineWarnings.length > 1 ? `${lineWarnings.length} WARNINGS` : 'WARNING'}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="bg-zinc-900 border-zinc-800 text-white p-2 text-xs shadow-xl max-w-xs">
                                <ul className="space-y-1">
                                  {lineWarnings.map((wo, wi) => (
                                    <li key={wi} className="flex items-start gap-1.5">
                                      <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0 mt-0.5" />
                                      <span>{wo.message || wo.code}</span>
                                    </li>
                                  ))}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })()}
                        {/* New item badge */}
                        {isAutoCreateRow(index) && (
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-blue-200 uppercase tracking-wider text-[10px] py-0 px-1.5 h-5 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3 text-blue-500" />
                            NEW ITEM
                          </Badge>
                        )}
                        {/* Auto-create item toggle */}
                        {matches.items?.[index]?.proposedNewItem && (() => {
                          const isBackend = !!matches.items?.[index]?.proposedNewItem;
                          const toggleOn = isBackend ? !!createItemsEnabled[index] : !!manualAutoCreateEnabled[index];
                          const handleToggle = () => {
                            if (isBackend) {
                              setCreateItemsEnabled((prev) => {
                                const nextEnabled = !prev[index];
                                applyProposedNewItemToLine(index, nextEnabled);
                                return { ...prev, [index]: nextEnabled };
                              });
                            } else {
                              const nextEnabled = !manualAutoCreateEnabled[index];
                              setManualAutoCreateEnabled((prev) => ({ ...prev, [index]: nextEnabled }));
                              setPayload((prev) => {
                                if (!prev) return prev;
                                const newDetails = [...prev.details];
                                const current = newDetails[index];
                                if (!current) return prev;
                                if (nextEnabled) {
                                  // Stock → AutoCreate: cache stock selection, clear for new code input
                                  // Reset manual-edit flag so stock group changes auto-update the prefix
                                  itemCodeManuallyEditedRef.current[index] = false;
                                  manualStockSnapshotRef.current[index] = {
                                    itemCode: current.itemCode || '',
                                    itemGroup: current.itemGroup || '',
                                    accNo: current.accNo || '',
                                  };
                                  newDetails[index] = { ...current, itemCode: '', itemGroup: '', accNo: '' };
                                } else {
                                  // AutoCreate → Stock: restore cached stock selection
                                  const snap = manualStockSnapshotRef.current[index];
                                  newDetails[index] = {
                                    ...current,
                                    itemCode: snap?.itemCode || '',
                                    itemGroup: snap?.itemGroup || '',
                                    accNo: snap?.accNo || '',
                                  };
                                }
                                return { ...prev, details: newDetails };
                              });
                            }
                          };
                          return (
                            <button
                              type="button"
                              onClick={handleToggle}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium transition-all',
                                toggleOn
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                  : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:border-zinc-300'
                              )}
                            >
                              <span
                                className={cn(
                                  'relative inline-flex h-3 w-5 shrink-0 items-center rounded-full transition-colors',
                                  toggleOn ? 'bg-emerald-500' : 'bg-zinc-300'
                                )}
                              >
                                <span
                                  className={cn(
                                    'inline-block h-2 w-2 rounded-full bg-white shadow-sm transition-transform',
                                    toggleOn ? 'translate-x-2.5' : 'translate-x-0.5'
                                  )}
                                />
                              </span>
                              AutoCreate
                            </button>
                          );
                        })()}
                      </div>
                      <div className="grid grid-cols-[1.5fr_1fr_60px_60px_1fr_1fr_60px] gap-3 items-center">
                        {isAutoCreateRow(index) ? (
                          <input
                            type="text"
                            value={item.itemCode || ''}
                            onChange={(e) => handleItemChange(index, 'itemCode', e.target.value)}
                            placeholder="New Item Code"
                            className={cn(
                              "w-full border rounded-lg px-2 py-2 text-sm transition-all duration-200 outline-none h-[38px] bg-white",
                              getBorderClass('item_', index + 1)
                            )}
                          />
                        ) : (
                          <Popover 
                            open={activeStockIdx === index} 
                            onOpenChange={(open) => setActiveStockIdx(open ? index : null)}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  "w-full border rounded-lg px-2 py-2 text-sm text-left transition-colors outline-none truncate h-[38px] bg-white",
                                  getBorderClass('item_', index + 1)
                                )}
                              >
                                {item.itemCode || <span className="text-gray-400 italic">Item Code</span>}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[350px] p-0 bg-white shadow-xl border border-gray-100" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput 
                                  placeholder="Search stock item..." 
                                  value={stockSearch}
                                  onValueChange={setStockSearch}
                                />
                                <CommandList
                                  className="max-h-72 overflow-auto"
                                  onScroll={(event) => {
                                    const target = event.currentTarget;
                                    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 32) {
                                      void loadMoreStocks();
                                    }
                                  }}
                                >
                                  {isStockLoading && <div className="p-4 text-xs text-center text-gray-500">Loading...</div>}
                                  <CommandEmpty>No stock found.</CommandEmpty>
                                  <CommandGroup>
                                    {stockOptions.map((opt) => (
                                      <CommandItem
                                        key={opt.itemCode}
                                        value={opt.itemCode}
                                        onSelect={() => {
                                          handleItemChange(index, 'itemCode', opt.itemCode);
                                          handleItemChange(index, 'description', opt.description);
                                          handleItemChange(index, 'itemGroup', opt.group);
                                          setActiveStockIdx(null);
                                          setStockSearch("");
                                          // Fetch full stock detail to fill accNo, taxCode, uom
                                          void getStockDetail(opt.itemCode, accessToken ?? undefined).then((detail) => {
                                            if (!detail) return;
                                            setPayload((prev) => {
                                              if (!prev) return prev;
                                              const newDetails = [...prev.details];
                                              const current = newDetails[index];
                                              if (!current) return prev;
                                              newDetails[index] = {
                                                ...current,
                                                accNo: detail.purchaseCode ?? current.accNo,
                                                taxCode: detail.purchaseTaxCode ?? detail.taxCode ?? current.taxCode,
                                                itemGroup: detail.itemGroup ?? current.itemGroup,
                                                uom: detail.purchaseUOM ?? detail.baseUOM ?? current.uom,
                                                description: detail.description ?? current.description,
                                                desc2: detail.description2 ?? detail.desc2 ?? current.desc2,
                                              };
                                              return { ...prev, details: newDetails };
                                            });
                                          });
                                        }}
                                      >
                                        <div className="flex flex-col">
                                          <span className="font-semibold">{opt.itemCode}</span>
                                          <span className="text-xs text-gray-500 line-clamp-1">{opt.description}</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                  {isStockLoadingMore ? (
                                    <div className="p-3 text-xs text-center text-gray-500">Loading more...</div>
                                  ) : null}
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                      <div className="w-full border rounded-lg px-2 py-2 text-sm bg-zinc-50 text-zinc-600 h-[38px] flex items-center">
                        {item.accNo || ''}
                      </div>
                      <div className="w-full border rounded-lg px-2 py-2 text-sm text-center bg-zinc-50 text-zinc-600 h-[38px] flex items-center justify-center">
                        {String(item.qty)}
                      </div>
                      <div className="w-full border rounded-lg px-2 py-2 text-sm text-center bg-zinc-50 text-zinc-600 h-[38px] flex items-center justify-center">
                        {item.uom || ''}
                      </div>
                      <div className="w-full border rounded-lg px-2 py-2 text-sm text-right bg-zinc-50 text-zinc-600 h-[38px] flex items-center justify-end">
                        {String(item.unitPrice)}
                      </div>
                      <div className="w-full border rounded-lg px-2 py-2 text-sm text-right bg-zinc-50 text-zinc-600 h-[38px] flex items-center justify-end">
                        {String(item.amount)}
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingItemIndex(index)}
                          className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                          title="Edit Advanced Details"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingItemIndex(index)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      </div>
                      {item.description && (
                        <p className="text-xs text-zinc-400 px-1 truncate" title={item.description}>
                          {item.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={startNewStockItem}
                  className="mt-4 flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>
            </div>
          </div>

          <Dialog open={editingItemIndex !== null} onOpenChange={(open) => { if (!open) { setEditingItemIndex(null); setIsStockGroupPickerOpen(false); setStockGroupSearch(''); setIsTaxCodePickerOpen(false); setTaxCodeSearch(''); } }}>
            <DialogContent className="sm:max-w-[450px] bg-white">
              <DialogHeader>
                <DialogTitle>Extra Item Details</DialogTitle>
                <DialogDescription className="sr-only">
                  Review and edit details for the selected invoice item.
                </DialogDescription>
              </DialogHeader>
              {editingItemIndex !== null && activeEditingDetail && (
                <div className="grid gap-4 py-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Description</label>
                    {activeAutoCreate ? (
                      <input
                        type="text"
                        value={activeEditingDetail.description || ''}
                        onChange={(e) => handleItemChange(editingItemIndex, 'description', e.target.value)}
                        placeholder="Item description"
                        className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400 transition-colors"
                      />
                    ) : (
                      <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                        {activeEditingDetail.description || ''}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Description 2 (desc2)</label>
                    {activeAutoCreate ? (
                      <input
                        type="text"
                        value={activeEditingDetail.desc2 || ''}
                        onChange={(e) => handleItemChange(editingItemIndex, 'desc2', e.target.value)}
                        placeholder="Secondary description"
                        className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400 transition-colors"
                      />
                    ) : (
                      <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                        {activeEditingDetail.desc2 || ''}
                      </div>
                    )}
                  </div>
                  {activeAutoCreate ? (
                    <>
                      {/* Stock Group */}
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Stock Group</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => { setIsStockGroupPickerOpen((v) => !v); setStockGroupSearch(''); }}
                            className="w-full h-[38px] flex items-center justify-between border border-gray-200 rounded-md px-3 py-2 text-sm bg-white outline-none"
                          >
                            {activeEditingDetail.itemGroup ? (
                              <span className="font-medium text-sm">{activeEditingDetail.itemGroup}</span>
                            ) : (
                              <span className="text-gray-400">Select stock group</span>
                            )}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </button>
                          {isStockGroupPickerOpen && (
                            <div className="mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden">
                              <div className="border-b border-gray-100 px-3 py-2">
                                <input
                                  autoFocus
                                  type="text"
                                  placeholder="Search stock group..."
                                  value={stockGroupSearch}
                                  onChange={(e) => setStockGroupSearch(e.target.value)}
                                  className="w-full text-sm outline-none bg-transparent placeholder:text-gray-400"
                                />
                              </div>
                              <div className="max-h-48 overflow-y-auto">
                                {draftPickersLoading && <div className="p-4 text-xs text-center text-gray-500">Loading...</div>}
                                {(() => {
                                  const q = stockGroupSearch.toLowerCase();
                                  const filtered = draftStockGroupOptions.filter((opt) => {
                                    if (!q) return true;
                                    return [opt.itemGroup, opt.shortCode, opt.purchaseCode, opt.itemGroupDescription, opt.description]
                                      .some((v) => String(v || '').toLowerCase().includes(q));
                                  });
                                  if (filtered.length === 0) return <div className="p-4 text-xs text-center text-gray-400">No results found.</div>;
                                  return filtered.map((option) => {
                                    const value = String(option.itemGroup || option.shortCode || '').trim();
                                    if (!value) return null;
                                    const label = String(option.itemGroupDescription || option.description || option.itemGroup || value).trim();
                                    const meta = [option.shortCode, option.purchaseCode].map((v) => String(v || '').trim()).filter(Boolean).join(' · ');
                                    return (
                                      <button
                                        key={value}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => { applyDraftStockGroupToLine(editingItemIndex, value); setIsStockGroupPickerOpen(false); }}
                                        className="w-full flex flex-col items-start px-3 py-2 text-left text-sm hover:bg-zinc-50 transition-colors"
                                      >
                                        <span className="font-medium text-zinc-800">{label}</span>
                                        {meta && <span className="text-xs text-gray-400">{meta}</span>}
                                      </button>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Account Code — read-only */}
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Account Code</label>
                        <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                          {activeEditingDetail.accNo || ''}
                        </div>
                      </div>

                      {/* Tax Code */}
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Tax Code</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => { setIsTaxCodePickerOpen((v) => !v); setTaxCodeSearch(''); }}
                            className="w-full h-[38px] flex items-center justify-between border border-gray-200 rounded-md px-3 py-2 text-sm bg-white outline-none"
                          >
                            {activeEditingDetail.taxCode ? (
                              <span className="font-medium text-sm">{activeEditingDetail.taxCode}</span>
                            ) : (
                              <span className="text-gray-400">Select tax code</span>
                            )}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </button>
                          {isTaxCodePickerOpen && (
                            <div className="mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden">
                              <div className="border-b border-gray-100 px-3 py-2">
                                <input
                                  autoFocus
                                  type="text"
                                  placeholder="Search tax code..."
                                  value={taxCodeSearch}
                                  onChange={(e) => setTaxCodeSearch(e.target.value)}
                                  className="w-full text-sm outline-none bg-transparent placeholder:text-gray-400"
                                />
                              </div>
                              <div className="max-h-48 overflow-y-auto">
                                {draftPickersLoading && <div className="p-4 text-xs text-center text-gray-500">Loading...</div>}
                                {(() => {
                                  const q = taxCodeSearch.toLowerCase();
                                  const filtered = draftTaxCodeOptions.filter((opt) => {
                                    if (!q) return true;
                                    return [opt.taxCode, opt.description, opt.name]
                                      .some((v) => String(v || '').toLowerCase().includes(q));
                                  });
                                  if (filtered.length === 0) return <div className="p-4 text-xs text-center text-gray-400">No results found.</div>;
                                  return filtered.map((option) => {
                                    const value = String(option.taxCode || '').trim();
                                    if (!value) return null;
                                    const label = String(option.description || option.name || '').trim();
                                    return (
                                      <button
                                        key={value}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => { applyDraftTaxCodeToLine(editingItemIndex, value); setIsTaxCodePickerOpen(false); }}
                                        className="w-full flex flex-col items-start px-3 py-2 text-left text-sm hover:bg-zinc-50 transition-colors"
                                      >
                                        <span className="font-medium text-zinc-800">{value}</span>
                                        {label && label !== value && <span className="text-xs text-gray-400">{label}</span>}
                                      </button>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Tax Code</label>
                        <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                          {activeEditingDetail.taxCode || ''}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Item Group</label>
                        <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                          {activeEditingDetail.itemGroup || ''}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setEditingItemIndex(null)}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Confirm
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete confirmation dialog */}
          <Dialog open={deletingItemIndex !== null} onOpenChange={(open) => !open && setDeletingItemIndex(null)}>
            <DialogContent className="sm:max-w-[360px] bg-white">
              <DialogHeader>
                <DialogTitle>Delete item?</DialogTitle>
                <DialogDescription className="sr-only">
                  Confirm removing this item from the invoice.
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-zinc-500">
                {deletingItemIndex !== null && draftDetails[deletingItemIndex]
                  ? <>Remove <span className="font-medium text-zinc-900">{draftDetails[deletingItemIndex].itemCode || 'this item'}</span> from the invoice?</>
                  : 'This action cannot be undone.'}
              </p>
              <DialogFooter className="gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingItemIndex(null)}
                  className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (deletingItemIndex !== null) removeItem(deletingItemIndex);
                    setDeletingItemIndex(null);
                  }}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Right Column: Preview */}
          <div className="bg-[#f8f9fa] p-8 overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-medium">Preview</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleRefreshOriginal}
                  disabled={isRefreshingOriginal}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRefreshingOriginal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                  Refresh
                </button>
                {(earlyImageUrl || earlyExternalLink) && (
                  <div className="flex items-center rounded-lg bg-zinc-100 p-1 gap-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('form')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      previewMode === 'form'
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('original')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      previewMode === 'original'
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    Original
                  </button>
                  </div>
                )}
              </div>
            </div>

            {previewMode === 'original' && (earlyImageUrl || earlyExternalLink) ? (
              <div className="flex flex-col items-center gap-4">
                {previewImageSrc ? (
                  /* Rendered image preview (works for both images and PDFs) */
                  <div className="w-full max-w-2xl mx-auto rounded-xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08)] bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewImageSrc}
                      alt="Invoice original"
                      className="w-full h-auto block"
                    />
                  </div>
                ) : previewDocumentSrc ? (
                  /* PDF iframe fallback if no imageUrl */
                  <iframe
                    src={previewDocumentSrc}
                    className="w-full max-w-2xl mx-auto rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] bg-white"
                    style={{ height: '80vh', border: 'none' }}
                    title="Invoice original"
                  />
                ) : null}
                {(proxiedDownloadOriginalHref || downloadOriginalHref) && (
                  <a
                    href={proxiedDownloadOriginalHref || downloadOriginalHref || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
                  >
                    <Download size={12} />
                    Download original file
                  </a>
                )}
              </div>
            ) : (
            <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-10 max-w-2xl mx-auto">
              {/* Logo */}
              <div className="mb-10 flex justify-between items-start">
                <div className="w-12 h-12 bg-[#1a1f2e] rounded-xl flex items-center justify-center text-white">
                  <Waves className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold text-zinc-900">INVOICE</div>
                  <div className="text-sm text-zinc-500 mt-1">#{payload.supplierInvoiceNo}</div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-8 mb-10">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Doc Date</div>
                  <div className="text-sm font-medium">{payload.docDate}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Term</div>
                  <div className="text-sm font-medium">{payload.displayTerm}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Currency</div>
                  <div className="text-sm font-medium">{payload.currencyCode}</div>
                </div>
              </div>

              {/* Addresses & Agent */}
              <div className="grid grid-cols-2 gap-8 mb-10">
                <div>
                  <div className="text-sm text-gray-500 mb-2">Creditor:</div>
                  <div className="text-base font-medium mb-0.5">{payload.creditorCode || ''}</div>
                  {creditorCompanyName && (
                    <div className="text-sm font-medium text-gray-700 mb-1 break-words max-w-xs">{creditorCompanyName}</div>
                  )}
                  <div className="text-sm text-gray-500 max-w-lg leading-relaxed">
                    {payload.creditorAddressLines?.join(', ') || 'No address provided'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-2">Purchase Agent:</div>
                  <div className="text-base font-medium mb-1">{payload.purchaseAgent || ''}</div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left font-medium text-gray-500 py-3">Item Code</th>
                      <th className="text-left font-medium text-gray-500 py-3">Acc No</th>
                      <th className="text-right font-medium text-gray-500 py-3">QTY</th>
                      <th className="text-right font-medium text-gray-500 py-3">Price</th>
                      <th className="text-right font-medium text-gray-500 py-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {draftDetails.map((item, index) => (
                      <tr key={index}>
                        <td className="py-4 font-medium">{item.itemCode || ''}</td>
                        <td className="py-4 text-gray-600">{item.accNo || ''}</td>
                        <td className="py-4 text-right text-gray-600">{item.qty} {item.uom}</td>
                        <td className="py-4 text-right text-gray-600">{formatNumber(item.unitPrice)}</td>
                        <td className="py-4 text-right font-medium">{formatNumber(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer / Summary */}
              <div className="flex justify-end pt-6 border-t border-gray-100">
                {/* Totals */}
                <div className="w-64 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal ({payload.currencyCode})</span>
                    <span className="font-medium">{formatNumber(subtotal)}</span>
                  </div>
                  {taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Auto Tax (11% if code present)</span>
                    <span className="font-medium">{formatNumber(taxAmount.toFixed(2))}</span>
                  </div>
                  )}
                  <div className="flex justify-between text-base font-semibold pt-3 border-t border-gray-100">
                    <span className="text-zinc-900">Total</span>
                    <span className="text-zinc-900">{formatNumber(totalAmount.toFixed(2))}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {payload.description && (
                <div className="mt-12 pt-6 border-t border-gray-100">
                  <div className="text-sm text-gray-500 mb-2">Description</div>
                  <div className="text-sm text-gray-900 whitespace-pre-line leading-relaxed">
                    {payload.description}
                  </div>
                </div>
              )}
            </div>
            )}
          </div>

        </div>
      </div>
    </div>
    <BatchStatusModal
      isOpen={isStatsModalOpen}
      batchId={groupId || taskId}
      groupId={groupId || undefined}
      items={groupItems}
      allDone={groupAllDone}
      now={groupNow}
      submitStatus={submitStatus ?? undefined}
      warningCount={groupItems.reduce((a, i) => a + (i.warningCount ?? 0), 0)}
      onClose={() => setIsStatsModalOpen(false)}
      onSubmitItem={isGroup && groupId ? handleGroupSubmitItem : undefined}
      onSubmitAll={isGroup && groupId ? handleGroupSubmitAll : undefined}
      submittingItems={submittingGroupItems}
    />
    </TooltipProvider>
  );
}
