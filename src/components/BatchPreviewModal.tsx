'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Loader2,
  Hash,
  CircleStop,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ApiRequestError } from '../lib/auth-api';
import { useAuth } from './AuthProvider';
import { authFetch } from '../lib/auth-fetch';
import { BatchStatusModal, type BatchStatusItem } from './BatchStatusModal';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BatchPreviewModalProps {
  isOpen: boolean;
  files: File[];
  onClose: () => void;
}

type Phase = 'uploading' | 'monitoring' | 'failed';

const TERMINAL = new Set(['succeeded', 'failed', 'canceled', 'cancelled', 'submitted', 'submit_failed', 'not_ready']);

function mapStatus(status: string): BatchStatusItem['phase'] | null {
  switch (status) {
    case 'queued':
    case 'uploaded':
    case 'processing':
    case 'fileserver_uploading':
      return 'queued';
    case 'ocr_started':
    case 'ocr_completed':
    case 'ocrprocessing':
    case 'reanalyze_queued':
    case 'reanalyzing':
      return 'ocr_processing';
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
    case 'canceled':
      return 'canceled';
    case 'cancelled':
      return 'cancelled';
    case 'submit_queued':
      return 'submit_queued';
    case 'submitting_stock':
      return 'submitting_stock';
    case 'submitting_pi':
      return 'submitting_pi';
    case 'submitted':
      return 'submitted';
    case 'submit_failed':
      return 'submit_failed';
    case 'not_ready':
      return 'not_ready';
    default:
      return null;
  }
}

function parseTs(v: string | null | undefined): number | null {
  if (!v) return null;
  const ms = Date.parse(v);
  return isNaN(ms) ? null : ms;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BatchPreviewModal({ isOpen, files, onClose }: BatchPreviewModalProps) {
  const { accessToken } = useAuth();
  const [phase, setPhase] = useState<Phase>('uploading');
  const [error, setError] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [items, setItems] = useState<BatchStatusItem[]>([]);
  const [now, setNow] = useState(Date.now());
  const [allDone, setAllDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clock tick for elapsed times
  useEffect(() => {
    if (phase !== 'monitoring' || allDone) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [phase, allDone]);

  // Upload
  useEffect(() => {
    if (!isOpen || files.length === 0) return;

    setPhase('uploading');
    setError(null);
    setGroupId(null);
    setItems([]);
    setAllDone(false);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    void (async () => {
      try {
        const formData = new FormData();
        for (const f of files) formData.append('files', f);

        const response = await authFetch('/api/purchase-invoice/upload', {
          method: 'POST',
          body: formData,
          signal: ctrl.signal,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new ApiRequestError(payload?.error ?? 'Batch upload failed.', response.status);
        }

        const data = (await response.json()) as {
          groupId?: string;
          files?: Array<{ id?: string; originalName?: string; size?: number; status?: string }>;
        };

        if (!data.groupId) throw new ApiRequestError('Batch upload did not return a group ID.', 500);

        // Seed items from upload response so the modal shows immediately
        const initialItems: BatchStatusItem[] = (data.files ?? []).map((f) => ({
          id: f.id ?? '',
          fileName: f.originalName ?? f.id ?? '',
          fileSize: f.size ?? 0,
          phase: mapStatus(f.status ?? 'queued') ?? 'queued',
          previewTaskId: f.id ?? null,
          startedAt: Date.now(),
          completedAt: null,
          error: null,
        }));

        setGroupId(data.groupId);
        setItems(initialItems);
        setNow(Date.now());
        setPhase('monitoring');
      } catch (err) {
        if (
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof ApiRequestError && err.status === 499)
        ) return;
        const msg =
          err instanceof ApiRequestError ? err.message :
          err instanceof Error ? err.message :
          'Batch upload failed.';
        setError(msg);
        setPhase('failed');
      }
    })();

    return () => {
      ctrl.abort();
      abortRef.current = null;
    };
  }, [isOpen, files, accessToken]);

  // Monitor group status via SSE, with polling as fallback.
  useEffect(() => {
    if (phase !== 'monitoring' || !groupId || allDone) return;

    const controller = new AbortController();
    const { signal } = controller;

    type GroupData = {
      status?: string;
      items?: Array<{
        taskId?: string; itemId?: string; fileName?: string; size?: number;
        status?: string; warningCount?: number; downloadLink?: string;
        draftId?: string; startedAt?: string; completedAt?: string;
      }>;
    };

    const applyGroupData = (data: GroupData): boolean => {
      let mapped: BatchStatusItem[] = [];
      setItems((prev) => {
        const prevById = new Map(prev.map((item) => [item.id, item]));
        mapped = (data.items ?? []).map((item) => {
          const id = item.taskId ?? item.itemId ?? '';
          const previous = prevById.get(id);
          const phase = mapStatus(item.status ?? '') ?? previous?.phase ?? 'queued';
          return {
            id,
            fileName: item.fileName ?? item.taskId ?? previous?.fileName ?? '',
            fileSize: item.size ?? previous?.fileSize ?? 0,
            phase,
            previewTaskId: item.taskId ?? item.itemId ?? previous?.previewTaskId ?? null,
            startedAt: parseTs(item.startedAt) ?? previous?.startedAt ?? null,
            completedAt: parseTs(item.completedAt) ?? previous?.completedAt ?? null,
            error: null,
            warningCount: item.warningCount ?? previous?.warningCount ?? 0,
            downloadUrl: item.downloadLink ?? previous?.downloadUrl,
            imageUrl: previous?.imageUrl,
          };
        });
        return mapped.length > 0 ? mapped : prev;
      });
      setNow(Date.now());
      const groupDone =
        data.status === 'completed' || data.status === 'failed' || data.status === 'partial_failed' ||
        (mapped.length > 0 && mapped.every((i) => TERMINAL.has(i.phase)));
      if (groupDone) setAllDone(true);
      return groupDone;
    };

    const startPolling = () => {
      const poll = async () => {
        if (signal.aborted) return;
        try {
          const res = await authFetch(`/api/purchase-invoice/tasks/group/${groupId}`, {
            cache: 'no-store', signal,
          });
          if (!res.ok || signal.aborted) return;
          const data = (await res.json()) as GroupData;
          const done = applyGroupData(data);
          if (!done && !signal.aborted) pollTimerRef.current = setTimeout(poll, 2000);
        } catch {
          if (!signal.aborted) pollTimerRef.current = setTimeout(poll, 3000);
        }
      };
      pollTimerRef.current = setTimeout(poll, 500);
    };

    void (async () => {
      try {
        const res = await authFetch(`/api/purchase-invoice/tasks/group/${groupId}/stream`, {
          headers: { Accept: 'text/event-stream' }, signal,
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
        // SSE stream ended without a terminal state — fall back to polling
        if (!signal.aborted) startPolling();
      } catch {
        if (!signal.aborted) startPolling();
      }
    })();

    return () => {
      controller.abort();
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [phase, groupId, allDone, accessToken]);

  const handleCancel = () => {
    abortRef.current?.abort();
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    onClose();
  };

  // When monitoring: show BatchStatusModal directly
  if (phase === 'monitoring' && groupId) {
    return (
      <BatchStatusModal
        isOpen={isOpen}
        batchId={groupId}
        groupId={groupId}
        items={items}
        allDone={allDone}
        now={now}
        onClose={onClose}
      />
    );
  }

  // Uploading / failed states
  return (
    <AnimatePresence>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onMouseDown={(e) => { if (phase === 'failed' && e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-zinc-950">Batch Upload</h2>
                  <div className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-violet-600">
                    <Sparkles size={9} />
                    AI
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400">
                  <Hash size={10} />
                  <span className="font-mono tracking-wider">{files.length} file{files.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              {phase === 'failed' && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Body */}
            <div className="flex flex-col items-center py-10 px-8 text-center">
              {phase === 'uploading' && (
                <>
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
                    <Loader2 size={28} className="animate-spin text-violet-600" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-800">Uploading {files.length} files…</p>
                  <p className="mt-1 text-xs text-zinc-400">Files are being sent for AI processing.</p>
                </>
              )}
              {phase === 'failed' && (
                <>
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
                    <AlertCircle size={28} className="text-red-500" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-800">Upload failed</p>
                  <p className="mt-1 text-xs text-red-500">{error ?? 'Please try again.'}</p>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/60 px-6 py-4">
              {phase === 'uploading' ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900"
                >
                  <CircleStop size={14} />
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
                >
                  Close
                </button>
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
