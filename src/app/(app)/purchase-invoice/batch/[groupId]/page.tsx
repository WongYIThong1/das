'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2, AlertCircle, Loader2, Clock, ArrowRight,
  FileText, Download, AlertTriangle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../../../components/AuthProvider';
import { type BatchStatusItem, type BatchItemPhase } from '../../../../components/BatchStatusModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<BatchItemPhase, string> = {
  pending:        'Pending',
  queued:         'Queued',
  ocr_processing: 'Reading',
  analyzing:      'Analyzing',
  succeeded:      'Ready',
  failed:         'Failed',
  canceled:       'Cancelled',
  cancelled:      'Cancelled',
};

const PHASE_STYLE: Record<BatchItemPhase, string> = {
  pending:        'bg-zinc-100 text-zinc-400',
  queued:         'bg-sky-100 text-sky-700',
  ocr_processing: 'bg-amber-100 text-amber-700',
  analyzing:      'bg-violet-100 text-violet-700',
  succeeded:      'bg-emerald-100 text-emerald-700',
  failed:         'bg-red-100 text-red-600',
  canceled:       'bg-zinc-100 text-zinc-400',
  cancelled:      'bg-zinc-100 text-zinc-400',
};

const ACTIVE_PHASES   = new Set<BatchItemPhase>(['queued', 'ocr_processing', 'analyzing']);
const TERMINAL_PHASES = new Set<BatchItemPhase>(['succeeded', 'failed', 'canceled', 'cancelled']);

function mapStatus(status: string): BatchItemPhase {
  switch (status) {
    case 'queued': case 'uploaded': return 'queued';
    case 'ocr_started': case 'ocr_completed': return 'ocr_processing';
    case 'draft_ready': case 'analyzing': return 'analyzing';
    case 'completed': return 'succeeded';
    case 'failed': return 'failed';
    default: return 'queued';
  }
}

function parseTs(v: string | null | undefined): number | null {
  if (!v) return null;
  const ms = Date.parse(v);
  return isNaN(ms) ? null : ms;
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BatchGroupPage() {
  const params   = useParams();
  const router   = useRouter();
  const groupId  = typeof params.groupId === 'string' ? params.groupId : '';
  const { accessToken } = useAuth();

  const [items, setItems]     = useState<BatchStatusItem[]>([]);
  const [allDone, setAllDone] = useState(false);
  const [now, setNow]         = useState(Date.now());
  const [error, setError]     = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clock tick
  useEffect(() => {
    if (allDone) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [allDone]);

  // Poll group endpoint
  useEffect(() => {
    if (!groupId || allDone) return;

    const headers: Record<string, string> = {};
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const poll = async () => {
      try {
        const res = await fetch(`/api/purchase-invoice/tasks/group/${groupId}`, {
          headers,
          cache: 'no-store',
        });
        if (!res.ok) {
          setError(`Failed to load batch (${res.status})`);
          return;
        }

        const data = (await res.json()) as {
          status?: string;
          items?: Array<{
            taskId?: string;
            itemId?: string;
            fileName?: string;
            size?: number;
            status?: string;
            warningCount?: number;
            downloadLink?: string;
            startedAt?: string;
            completedAt?: string;
          }>;
        };

        const mapped: BatchStatusItem[] = (data.items ?? []).map((item) => ({
          id: item.taskId ?? item.itemId ?? '',
          fileName: item.fileName ?? item.taskId ?? '',
          fileSize: item.size ?? 0,
          phase: mapStatus(item.status ?? ''),
          previewTaskId: item.taskId ?? item.itemId ?? null,
          startedAt: parseTs(item.startedAt),
          completedAt: parseTs(item.completedAt),
          error: null,
          warningCount: item.warningCount ?? 0,
          downloadUrl: item.downloadLink ?? undefined,
        }));

        if (mapped.length > 0) setItems(mapped);
        setNow(Date.now());
        setError(null);

        const done =
          data.status === 'completed' ||
          data.status === 'failed' ||
          data.status === 'partial_failed' ||
          (mapped.length > 0 && mapped.every((i) => TERMINAL_PHASES.has(i.phase)));

        if (done) {
          setAllDone(true);
        } else {
          pollTimer.current = setTimeout(poll, 2000);
        }
      } catch {
        pollTimer.current = setTimeout(poll, 3000);
      }
    };

    pollTimer.current = setTimeout(poll, 0);
    return () => { if (pollTimer.current) clearTimeout(pollTimer.current); };
  }, [groupId, allDone, accessToken]);

  const doneCount      = items.filter((i) => TERMINAL_PHASES.has(i.phase)).length;
  const succeededCount = items.filter((i) => i.phase === 'succeeded').length;
  const warningTotal   = items.reduce((a, i) => a + (i.warningCount ?? 0), 0);
  const overallPct     = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
  const isComplete     = allDone || (items.length > 0 && doneCount === items.length);

  return (
    <div className="flex h-screen flex-col bg-white font-sans text-zinc-900">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200/80 bg-white/80 px-6 py-4 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-950">Batch Upload</h1>
          <p className="mt-0.5 font-mono text-[11px] text-zinc-400">{groupId}</p>
        </div>
        <Link
          href="/purchase-invoice"
          className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
        >
          Back
        </Link>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-4xl mx-auto w-full">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">{error}</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-4 divide-x divide-zinc-100 rounded-2xl border border-zinc-200 bg-zinc-50/60 mb-6">
              <div className="px-5 py-4">
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">Total</p>
                <p className="mt-1 text-2xl font-bold text-zinc-900">{items.length}</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">Ready</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600">{succeededCount}</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">In Progress</p>
                <p className="mt-1 text-2xl font-bold text-violet-600">
                  {items.filter((i) => ACTIVE_PHASES.has(i.phase)).length}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">Warnings</p>
                <p className={`mt-1 text-2xl font-bold ${warningTotal > 0 ? 'text-amber-500' : 'text-zinc-300'}`}>
                  {warningTotal}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-zinc-500">
                  {isComplete ? 'All files processed' : 'Processing…'}
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-zinc-600">{overallPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <motion.div
                  className={`h-full rounded-full ${
                    isComplete && succeededCount === items.length
                      ? 'bg-emerald-500'
                      : isComplete ? 'bg-amber-400' : 'bg-zinc-900'
                  }`}
                  animate={{ width: `${overallPct}%` }}
                  transition={{ ease: 'easeOut', duration: 0.4 }}
                />
              </div>
            </div>

            {/* Table */}
            {items.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-zinc-400">
                <Loader2 className="animate-spin mr-2" size={16} /> Loading…
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_80px_56px_72px_96px] gap-3 border-b border-zinc-100 bg-zinc-50/60 px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                  <div>File</div>
                  <div>Status</div>
                  <div className="text-center">Warn</div>
                  <div className="text-right">Elapsed</div>
                  <div className="text-right">Actions</div>
                </div>

                <div className="divide-y divide-zinc-50">
                  {items.map((item) => {
                    const isActive = ACTIVE_PHASES.has(item.phase);
                    const isDone   = TERMINAL_PHASES.has(item.phase);
                    const elapsed  = item.startedAt != null
                      ? (isDone ? item.completedAt ?? now : now) - item.startedAt
                      : null;
                    const warns = item.warningCount ?? 0;

                    return (
                      <div key={item.id} className="grid grid-cols-[1fr_80px_56px_72px_96px] gap-3 items-center px-5 py-3">
                        {/* File */}
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-50">
                            {item.phase === 'succeeded' ? (
                              <CheckCircle2 size={13} className="text-emerald-500" />
                            ) : item.phase === 'failed' ? (
                              <AlertCircle size={13} className="text-red-500" />
                            ) : isActive ? (
                              <Loader2 size={13} className="animate-spin text-zinc-400" />
                            ) : (
                              <FileText size={13} className="text-zinc-300" />
                            )}
                          </div>
                          <p className="truncate text-xs font-medium text-zinc-800">{item.fileName}</p>
                        </div>

                        {/* Status */}
                        <div>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${PHASE_STYLE[item.phase]}`}>
                            {PHASE_LABEL[item.phase]}
                          </span>
                        </div>

                        {/* Warnings */}
                        <div className="flex justify-center">
                          {warns > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                              <AlertTriangle size={9} />
                              {warns}
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-300">—</span>
                          )}
                        </div>

                        {/* Elapsed */}
                        <div className="flex items-center justify-end gap-1 text-[10px] text-zinc-400">
                          {elapsed != null ? (
                            <><Clock size={9} /><span className="tabular-nums">{formatElapsed(elapsed)}</span></>
                          ) : <span>—</span>}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1">
                          {item.downloadUrl ? (
                            <a
                              href={item.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
                            >
                              <Download size={10} />
                            </a>
                          ) : null}
                          {item.phase === 'succeeded' && item.previewTaskId ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (item.previewTaskId) {
                                  sessionStorage.setItem(`groupId_for_${item.previewTaskId}`, groupId);
                                }
                                router.push(`/purchase-invoice/group/${item.previewTaskId}`);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-100"
                            >
                              View <ArrowRight size={10} />
                            </button>
                          ) : (
                            !item.downloadUrl && <span className="text-[11px] text-zinc-200">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
