'use client';

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronDown, Plus, Trash2, Waves, Loader2, Edit3, Download, LayoutList } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { RefreshCcw } from 'lucide-react';

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { safeExternalHref } from '@/lib/safe-url';
import { Search, AlertTriangle } from 'lucide-react';

import { waitForPurchaseInvoicePreview, type PreviewTaskStatus, PurchaseInvoicePreviewPayload, PurchaseInvoicePreviewDetail, getCreditorOptions, getAgentOptions, getStockOptions, getCreditorDetail, getStockDetail, type PurchaseInvoicePreviewMatches, type PreviewProposedNewItem } from '../../../../lib/purchase-invoice-create-api';
import { type PurchaseInvoiceSubmitRequest } from '../../../../lib/purchase-invoice-submit-api';
import { useAuth } from '../../../../components/AuthProvider';
import { useSubmit } from '../../../../components/SubmitProvider';
import { usePreviewProgress } from '../../../../components/PreviewProgressProvider';
import { BatchStatusModal, type BatchStatusItem } from '../../../../components/BatchStatusModal';

export default function PurchaseInvoiceTaskPage({ taskIdOverride, isGroup = false, groupId: groupIdProp }: { taskIdOverride?: string; isGroup?: boolean; groupId?: string } = {}) {
  const params = useParams();
  const router = useRouter();
  const taskId = taskIdOverride ?? (params.taskId as string);
  const groupId = groupIdProp || (typeof params.groupId === 'string' ? params.groupId : '');

  const { profile, accessToken } = useAuth();
  const { startSubmit, isRunning: submitting, status: submitStatus } = useSubmit();
  const { startReanalyze, isRunning: reanalyzeRunning } = usePreviewProgress();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadNonce, setLoadNonce] = useState(0);
  const [payload, setPayload] = useState<PurchaseInvoicePreviewPayload | null>(null);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<unknown[]>([]);
  const [taskStatus, setTaskStatus] = useState<PreviewTaskStatus | null>(null);
  const [draftId, setDraftId] = useState<string>('');
  const [earlyDownloadUrl, setEarlyDownloadUrl] = useState<string | null>(null);
  const [earlyExternalLink, setEarlyExternalLink] = useState<string | null>(null);
  const [matches, setMatches] = useState<PurchaseInvoicePreviewMatches>({});

  const [createItemsEnabled, setCreateItemsEnabled] = useState<Record<number, boolean>>({});
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [deletingItemIndex, setDeletingItemIndex] = useState<number | null>(null);
  const [groupItems, setGroupItems] = useState<BatchStatusItem[]>([]);
  const [groupAllDone, setGroupAllDone] = useState(false);
  const [groupNow, setGroupNow] = useState(Date.now());

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

          // Auto-enable createMissing toggles based on empty codes
          const p = res.payload as PurchaseInvoicePreviewPayload;
          const itemToggles: Record<number, boolean> = {};
          p.details.forEach((d: PurchaseInvoicePreviewDetail, i: number) => {
            if (!d.itemCode && previewMatches.items?.[i]?.proposedNewItem) {
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

  const retryLoad = () => {
    setLoadNonce((current) => current + 1);
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

  // Preload picker options as soon as the user enters the page, so the first open
  // of the dropdown is instant (no need to type before seeing options).
  useEffect(() => {
    let cancelled = false;

    const preload = async () => {
      try {
        setIsCreditorLoading(true);
        const creditors = await getCreditorOptions({ page: 1, pageSize: 20 }, accessToken ?? undefined);
        if (!cancelled) {
          setCreditorOptions(creditors.items || []);
          setCreditorPage(creditors.page ?? 1);
          setCreditorTotalPages(creditors.totalPages ?? 1);
        }
      } catch (error) {
        // keep silent: user can still search/open dropdown which will retry
        console.error('Creditor preload error:', error);
      } finally {
        if (!cancelled) setIsCreditorLoading(false);
      }

      try {
        setIsAgentLoading(true);
        const agents = await getAgentOptions({ page: 1, pageSize: 20 }, accessToken ?? undefined);
        if (!cancelled) {
          setAgentOptions(agents.items || []);
          setAgentPage(agents.page ?? 1);
          setAgentTotalPages(agents.totalPages ?? 1);
        }
      } catch (error) {
        console.error('Agent preload error:', error);
      } finally {
        if (!cancelled) setIsAgentLoading(false);
      }
    };

    void preload();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  // Fetch group items for the stats modal when opened on a batch item page.
  // Uses SSE for real-time updates with a polling fallback.
  useEffect(() => {
    if (!isGroup || !groupId || !isStatsModalOpen) return;

    const controller = new AbortController();
    const { signal } = controller;

    const TERMINAL = new Set(['succeeded', 'failed', 'canceled', 'cancelled']);

    const mapPhase = (s: string): BatchStatusItem['phase'] => {
      switch (s) {
        case 'queued': case 'uploaded': return 'queued';
        case 'ocr_started': case 'ocr_completed': return 'ocr_processing';
        case 'draft_ready': case 'analyzing': return 'analyzing';
        case 'completed': return 'succeeded';
        case 'failed': return 'failed';
        default: return 'queued';
      }
    };
    const parseMs = (v?: string | null) => { if (!v) return null; const ms = Date.parse(v); return isNaN(ms) ? null : ms; };

    type GroupData = {
      status?: string;
      items?: Array<{
        taskId?: string; itemId?: string; fileName?: string; size?: number;
        status?: string; warningCount?: number; downloadLink?: string;
        startedAt?: string; completedAt?: string;
      }>;
    };

    const applyGroupData = (data: GroupData): boolean => {
      const mapped: BatchStatusItem[] = (data.items ?? []).map((it) => ({
        id: it.taskId ?? it.itemId ?? '',
        fileName: it.fileName ?? it.taskId ?? '',
        fileSize: it.size ?? 0,
        phase: mapPhase(it.status ?? ''),
        previewTaskId: it.taskId ?? it.itemId ?? null,
        startedAt: parseMs(it.startedAt),
        completedAt: parseMs(it.completedAt),
        error: null,
        warningCount: it.warningCount ?? 0,
        downloadUrl: it.downloadLink ?? undefined,
      }));
      if (mapped.length > 0) { setGroupItems(mapped); setGroupNow(Date.now()); }
      const done = data.status === 'completed' || data.status === 'failed' || data.status === 'partial_failed'
        || (mapped.length > 0 && mapped.every((i) => TERMINAL.has(i.phase)));
      if (done) setGroupAllDone(true);
      return done;
    };

    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const startPolling = () => {
      const poll = async () => {
        if (signal.aborted) return;
        try {
          const pollHeaders: Record<string, string> = {};
          if (accessToken) pollHeaders['Authorization'] = `Bearer ${accessToken}`;
          const res = await fetch(`/api/purchase-invoice/tasks/group/${groupId}`, {
            headers: pollHeaders, cache: 'no-store', signal,
          });
          if (!res.ok || signal.aborted) return;
          const data = (await res.json()) as GroupData;
          const done = applyGroupData(data);
          if (!done && !signal.aborted) pollTimer = setTimeout(poll, 2500);
        } catch {
          if (!signal.aborted) pollTimer = setTimeout(poll, 3000);
        }
      };
      pollTimer = setTimeout(poll, 500);
    };

    void (async () => {
      try {
        const sseHeaders: Record<string, string> = { Accept: 'text/event-stream' };
        if (accessToken) sseHeaders['Authorization'] = `Bearer ${accessToken}`;
        const res = await fetch(`/api/purchase-invoice/tasks/group/${groupId}/stream`, {
          headers: sseHeaders, signal,
        });
        if (!res.ok || !res.body) { startPolling(); return; }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (value?.length) {
              buf += decoder.decode(value, { stream: !done });
            }
            const blocks = buf.split('\n\n');
            buf = done ? '' : (blocks.pop() ?? '');
            for (const block of blocks) {
              if (!block.trim()) continue;
              let dataStr = '';
              for (const line of block.split('\n')) {
                if (line.startsWith('data:')) dataStr += line.slice(5).trim();
              }
              if (!dataStr) continue;
              try {
                const parsed = JSON.parse(dataStr) as GroupData;
                const isDone = applyGroupData(parsed);
                if (isDone) return;
              } catch { /* skip malformed event */ }
            }
            if (done) break;
          }
        } finally {
          reader.cancel().catch(() => {});
        }
        // SSE ended without reaching terminal state — fall back to polling
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
  }, [isGroup, groupId, isStatsModalOpen, accessToken]);

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
    const msg =
      customMsg ??
      (isWarningObject(warning)
        ? warning.message ?? warning.code
        : typeof warning === 'string'
          ? warning
          : 'Warning');
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
          <p className="font-medium">{msg}</p>
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

    if (field === 'itemCode' || field === 'description') {
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
        // Switching off "Create": allow selecting an existing stock item again.
        newDetails[lineIndex] = {
          ...current,
          itemCode: '',
        };
        return { ...prev, details: newDetails };
      }

      const suggestedCode = String(proposed.itemCodeSuggestion || '').trim();
      const suggestedGroup = String(proposed.itemGroup || current.itemGroup || '').trim();
      const suggestedDesc = String(proposed.description || current.description || '').trim();
      const suggestedDesc2 = String(proposed.desc2 || current.desc2 || '').trim();
      const suggestedUom = String(proposed.purchaseUom || proposed.baseUom || current.uom || 'UNIT').trim();

      newDetails[lineIndex] = {
        ...current,
        // Fill into the row so the user can see/edit it inline.
        itemCode: suggestedCode,
        itemGroup: suggestedGroup,
        description: suggestedDesc,
        desc2: suggestedDesc2,
        uom: suggestedUom,
      };

      return { ...prev, details: newDetails };
    });
  };

  const addItem = () => {
    setPayload((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        details: [
          ...prev.details,
          {
            itemCode: '',
            description: '',
            desc2: '',
            qty: 1,
            unitPrice: 0,
            amount: 0,
            uom: 'UNIT',
            taxCode: '',
            accNo: '',
            itemGroup: ''
          }
        ]
      };
    });
  };

  const removeItem = (index: number) => {
    setPayload((prev) => {
      if (!prev) return prev;
      const newDetails = [...prev.details];
      newDetails.splice(index, 1);
      return { ...prev, details: newDetails };
    });
  };

  const buildSubmitRequest = (): PurchaseInvoiceSubmitRequest | null => {
    if (!payload || !draftId) return null;

    const details = payload.details.map((d: any, i: number) => {
      const isNewItem = !!(createItemsEnabled[i] && matches.items?.[i]?.proposedNewItem);
      const proposed = isNewItem ? ((matches.items?.[i]?.proposedNewItem || {}) as PreviewProposedNewItem) : null;
      return {
        lineNo: i + 1,
        itemCode: d.itemCode || '',
        accNo: d.accNo || '',
        qty: d.qty,
        uom: d.uom || '',
        unitPrice: d.unitPrice,
        amount: d.amount,
        description: d.description || '',
        desc2: d.desc2 || '',
        taxCode: d.taxCode || '',
        itemGroup: d.itemGroup || '',
        isNewItem,
        autoCreateStock: isNewItem,
        ...(isNewItem && proposed ? { stockProposal: proposed as unknown as Record<string, unknown> } : {}),
      };
    });

    return {
      draftId,
      accessToken: accessToken ?? undefined,
      header: {
        creditorCode: payload.creditorCode,
        purchaseAgent: payload.purchaseAgent || '',
        supplierInvoiceNo: payload.supplierInvoiceNo,
        docDate: payload.docDate,
        displayTerm: payload.displayTerm,
        location: payload.purchaseLocation || 'HQ',
        currency: payload.currencyCode,
        currencyRate: payload.currencyRate,
        description: payload.description || 'PURCHASE INVOICE',
      },
      details,
    };
  };

  const handleSubmit = async () => {
    const req = buildSubmitRequest();
    if (!req) return;
    await startSubmit(req);
  };

  const handleSubmitSilent = async () => {
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

  const statusLabel =
    submitStatus === 'completed'
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
                {submitStatus !== 'completed' && (
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

  const subtotal = payload.details.reduce((acc, item) => acc + (Number(item.qty) * Number(item.unitPrice)), 0);
  const taxAmount = payload.details.reduce((acc, item) => {
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
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${submitStatus === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-50 text-zinc-600'}`}>
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
              {submitStatus !== 'completed' && (
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
          {submitStatus !== 'completed' && (
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
                                    const addrLines = addrParts.length > 0
                                      ? addrParts
                                      : detail.creditorAddressLines ?? (detail.creditorAddress ? [detail.creditorAddress] : undefined);
                                    setPayload((prev) => {
                                      if (!prev) return prev;
                                      return {
                                        ...prev,
                                        purchaseAgent: detail.purchaseAgent ?? prev.purchaseAgent,
                                        displayTerm: detail.displayTerm ?? prev.displayTerm,
                                        currencyCode: detail.currencyCode ?? detail.currency ?? prev.currencyCode,
                                        currencyRate: detail.currencyRate ?? prev.currencyRate,
                                        creditorAddressLines: addrLines ?? [],
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

              <div className={cn("p-4 rounded-xl transition-all duration-200", checkWarning('missing_items') ? "border-2 border-yellow-400 bg-yellow-50/20 ring-4 ring-yellow-400/10" : "")}>
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
                  {payload.details.map((item, index) => (
                    <div key={index} className={cn(
                      "flex flex-col gap-1 rounded-lg p-2 -mx-2 transition-all duration-200",
                      hasAnyWarningForLine(index + 1)
                        ? "border border-yellow-400 bg-yellow-50/30 ring-2 ring-yellow-400/10"
                        : ""
                    )}>
                      <div className="flex flex-wrap gap-2 mb-1 items-center">
                        {/* Show single badge for all warnings on this line */}
                        {(() => {
                          const lineWarnings = warnings
                            .filter((w) => isWarningObject(w) && (w as any).line === index + 1)
                            .map((w) => w as { code: string; message?: string });
                          if (lineWarnings.length === 0) return null;
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
                        {/* Auto-create item toggle */}
                        {matches.items?.[index]?.proposedNewItem && (
                          <button
                            type="button"
                            onClick={() =>
                              setCreateItemsEnabled((prev) => {
                                const nextEnabled = !prev[index];
                                applyProposedNewItemToLine(index, nextEnabled);
                                return { ...prev, [index]: nextEnabled };
                              })
                            }
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium transition-all',
                              createItemsEnabled[index]
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:border-zinc-300'
                            )}
                          >
                            <span
                              className={cn(
                                'relative inline-flex h-3 w-5 shrink-0 items-center rounded-full transition-colors',
                                createItemsEnabled[index] ? 'bg-emerald-500' : 'bg-zinc-300'
                              )}
                            >
                              <span
                                className={cn(
                                  'inline-block h-2 w-2 rounded-full bg-white shadow-sm transition-transform',
                                  createItemsEnabled[index] ? 'translate-x-2.5' : 'translate-x-0.5'
                                )}
                              />
                            </span>
                            AutoCreate
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-[1.5fr_1fr_60px_60px_1fr_1fr_60px] gap-3 items-center">
                        {createItemsEnabled[index] && matches.items?.[index]?.proposedNewItem ? (
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
                                            const gi = detail.groupInfo as Record<string, unknown> | undefined;
                                            setPayload((prev) => {
                                              if (!prev) return prev;
                                              const newDetails = [...prev.details];
                                              const current = newDetails[index];
                                              if (!current) return prev;
                                              newDetails[index] = {
                                                ...current,
                                                accNo: (gi?.purchaseCode as string) ?? detail.accNo ?? current.accNo,
                                                taxCode: detail.purchaseTaxCode ?? detail.taxCode ?? current.taxCode,
                                                itemGroup: detail.itemGroup ?? current.itemGroup,
                                                uom: detail.purchaseUOM ?? detail.baseUOM ?? current.uom,
                                                description: detail.description ?? current.description,
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
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  className="mt-4 flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>
            </div>
          </div>

          <Dialog open={editingItemIndex !== null} onOpenChange={(open) => !open && setEditingItemIndex(null)}>
            <DialogContent className="sm:max-w-[450px] bg-white">
              <DialogHeader>
                <DialogTitle>Extra Item Details</DialogTitle>
              </DialogHeader>
              {editingItemIndex !== null && payload.details[editingItemIndex] && (
                <div className="grid gap-4 py-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Description</label>
                    <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                      {payload.details[editingItemIndex].description || ''}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Description 2 (desc2)</label>
                    <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                      {payload.details[editingItemIndex].desc2 || ''}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Tax Code</label>
                    <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                      {payload.details[editingItemIndex].taxCode || ''}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Item Group (Creation only)</label>
                    <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                      {payload.details[editingItemIndex].itemGroup || ''}
                    </div>
                  </div>
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
              </DialogHeader>
              <p className="text-sm text-zinc-500">
                {deletingItemIndex !== null && payload.details[deletingItemIndex]
                  ? <>Remove <span className="font-medium text-zinc-900">{payload.details[deletingItemIndex].itemCode || 'this item'}</span> from the invoice?</>
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
            <h2 className="text-lg font-medium mb-8">Preview</h2>
            
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
                    {payload.details.map((item, index) => (
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
    />
    </TooltipProvider>
  );
}
