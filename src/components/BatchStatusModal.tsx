'use client';

import React from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, Clock, ArrowRight, FileText, Download, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BatchItemPhase =
  | 'pending'
  | 'cancelled'
  | 'queued'
  | 'ocr_processing'
  | 'analyzing'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export interface BatchStatusItem {
  id: string;
  fileName: string;
  fileSize: number;
  phase: BatchItemPhase;
  previewTaskId: string | null;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
  warningCount?: number;
  downloadUrl?: string;
}

export interface BatchStatusModalProps {
  isOpen: boolean;
  batchId: string;
  groupId?: string;
  items: BatchStatusItem[];
  allDone: boolean;
  now: number;
  onClose: () => void;
  submitStatus?: string;
  warningCount?: number;
  onSubmitAll?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<BatchItemPhase, string> = {
  pending:       'Pending',
  queued:        'Queued',
  ocr_processing:'Reading',
  analyzing:     'Analyzing',
  succeeded:     'Ready',
  failed:        'Failed',
  canceled:      'Cancelled',
  cancelled:     'Cancelled',
};

const PHASE_STYLE: Record<BatchItemPhase, string> = {
  pending:       'bg-zinc-100 text-zinc-400',
  queued:        'bg-sky-100 text-sky-700',
  ocr_processing:'bg-amber-100 text-amber-700',
  analyzing:     'bg-violet-100 text-violet-700',
  succeeded:     'bg-emerald-100 text-emerald-700',
  failed:        'bg-red-100 text-red-600',
  canceled:      'bg-zinc-100 text-zinc-400',
  cancelled:     'bg-zinc-100 text-zinc-400',
};

const ACTIVE_PHASES  = new Set<BatchItemPhase>(['queued', 'ocr_processing', 'analyzing']);
const TERMINAL_PHASES = new Set<BatchItemPhase>(['succeeded', 'failed', 'canceled', 'cancelled']);

const SUBMIT_STATUS_STYLE: Record<string, string> = {
  queued:      'bg-sky-50 border-sky-200 text-sky-700',
  preparing:   'bg-amber-50 border-amber-200 text-amber-700',
  validating:  'bg-violet-50 border-violet-200 text-violet-700',
  dispatching: 'bg-violet-50 border-violet-200 text-violet-700',
  succeeded:   'bg-emerald-50 border-emerald-200 text-emerald-700',
  failed:      'bg-red-50 border-red-200 text-red-600',
};

const SUBMIT_STATUS_LABEL: Record<string, string> = {
  queued:      'Queued',
  preparing:   'Preparing',
  validating:  'Validating',
  dispatching: 'Dispatching',
  succeeded:   'Done',
  failed:      'Failed',
};

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BatchStatusModal({
  isOpen,
  batchId,
  groupId,
  items,
  allDone,
  now,
  onClose,
  submitStatus,
  warningCount = 0,
  onSubmitAll,
}: BatchStatusModalProps) {
  const doneCount     = items.filter((i) => TERMINAL_PHASES.has(i.phase)).length;
  const succeededCount = items.filter((i) => i.phase === 'succeeded').length;
  const overallPct    = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
  const isComplete    = allDone || (items.length > 0 && doneCount === items.length);

  const submitLabel = submitStatus
    ? (SUBMIT_STATUS_LABEL[submitStatus] ?? submitStatus)
    : 'Draft';
  const submitStyle = submitStatus
    ? (SUBMIT_STATUS_STYLE[submitStatus] ?? 'bg-zinc-50 border-zinc-200 text-zinc-500')
    : 'bg-zinc-50 border-zinc-200 text-zinc-400';

  return (
    <AnimatePresence>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-950">Batch Stats</h2>
                <p className="mt-0.5 font-mono text-[11px] text-zinc-400">{batchId}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X size={15} />
              </button>
            </div>

            {/* Summary row */}
            <div className="grid grid-cols-4 divide-x divide-zinc-100 border-b border-zinc-100 bg-zinc-50/60">
              <div className="px-5 py-3">
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">Total</p>
                <p className="mt-1 text-xl font-bold text-zinc-900">{items.length}</p>
              </div>
              <div className="px-5 py-3">
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">Ready</p>
                <p className="mt-1 text-xl font-bold text-emerald-600">{succeededCount}</p>
              </div>
              <div className="px-5 py-3">
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">In Progress</p>
                <p className="mt-1 text-xl font-bold text-violet-600">
                  {items.filter((i) => ACTIVE_PHASES.has(i.phase)).length}
                </p>
              </div>
              <div className="px-5 py-3">
                <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">Warnings</p>
                <p className={`mt-1 text-xl font-bold ${warningCount > 0 ? 'text-amber-500' : 'text-zinc-300'}`}>
                  {warningCount}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="px-6 pt-4 pb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-zinc-500">
                  {isComplete ? 'All files processed' : `Processing…`}
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
            <div className="px-6 pb-4">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_80px_80px_56px_72px_96px] gap-3 border-b border-zinc-100 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                <div>File</div>
                <div>Process</div>
                <div>Submit</div>
                <div className="text-center">Warn</div>
                <div className="text-right">Elapsed</div>
                <div className="text-right">Actions</div>
              </div>

              {/* Table rows */}
              <div className="max-h-[260px] overflow-y-auto divide-y divide-zinc-50 [scrollbar-gutter:stable]">
                {items.map((item, index) => {
                  const isActive = ACTIVE_PHASES.has(item.phase);
                  const isDone   = TERMINAL_PHASES.has(item.phase);
                  const elapsed  = item.startedAt != null
                    ? (isDone ? item.completedAt ?? now : now) - item.startedAt
                    : null;
                  const isLast   = index === items.length - 1;
                  const warns    = item.warningCount ?? 0;

                  return (
                    <div key={item.id} className="grid grid-cols-[1fr_80px_80px_56px_72px_96px] gap-3 items-center py-3">
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

                      {/* Process status */}
                      <div>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${PHASE_STYLE[item.phase]}`}>
                          {PHASE_LABEL[item.phase]}
                        </span>
                      </div>

                      {/* Submit status (only on last row) */}
                      <div>
                        {isLast ? (
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${submitStyle}`}>
                            {submitLabel}
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-300">—</span>
                        )}
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
                          <>
                            <Clock size={9} />
                            <span className="tabular-nums">{formatElapsed(elapsed)}</span>
                          </>
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
                              if (groupId && item.previewTaskId) {
                                sessionStorage.setItem(`groupId_for_${item.previewTaskId}`, groupId);
                              }
                              const url = groupId
                                ? `/purchase-invoice/group/${item.previewTaskId}`
                                : `/purchase-invoice/${item.previewTaskId}`;
                              window.open(url, '_blank');
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

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/60 px-6 py-3">
              <p className="text-[11px] text-zinc-400">
                {isComplete
                  ? `${succeededCount} of ${items.length} ready`
                  : 'Processing in progress…'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Close
                </button>
                {onSubmitAll && (
                  <button
                    type="button"
                    onClick={() => { onSubmitAll(); onClose(); }}
                    className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                  >
                    Submit All
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
