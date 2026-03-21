'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, CheckCircle2, AlertCircle, Loader2, Clock, FileText, ImageIcon, ArrowUpRight, Download, Send } from 'lucide-react';
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
  | 'canceled'
  // Reanalyze phases
  | 'reanalyze_queued'
  | 'reanalyzing'
  // Submit phases
  | 'submit_queued'
  | 'submitting_stock'
  | 'submitting_pi'
  | 'submitted'
  | 'submit_failed'
  | 'not_ready';

export interface BatchStatusItem {
  id: string;
  fileName: string;
  fileSize: number;
  phase: BatchItemPhase;
  analysisPhase?: BatchItemPhase;   // from analysisStatus — persists across submit
  previewTaskId: string | null;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
  warningCount?: number;
  downloadUrl?: string;
  imageUrl?: string;
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
  onSubmitItem?: (itemId: string) => void;
  submittingItems?: Set<string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TERMINAL: Set<BatchItemPhase> = new Set(['succeeded', 'failed', 'canceled', 'cancelled', 'submitted', 'submit_failed', 'not_ready']);
const ACTIVE:   Set<BatchItemPhase> = new Set(['queued', 'ocr_processing', 'analyzing', 'reanalyze_queued', 'reanalyzing', 'submit_queued', 'submitting_stock', 'submitting_pi']);
const SUBMIT_PHASES: Set<BatchItemPhase> = new Set(['submit_queued', 'submitting_stock', 'submitting_pi', 'submitted', 'submit_failed', 'not_ready']);

function formatElapsed(ms: number): string {
  if (ms < 1000)   return '<1s';
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function isImage(name: string) {
  return /\.(png|jpe?g|webp)$/i.test(name);
}

const PHASE_CFG: Record<BatchItemPhase, { label: string; dot: string; text: string; bg: string }> = {
  pending:          { label: 'Pending',         dot: 'bg-zinc-300',    text: 'text-zinc-400',   bg: 'bg-zinc-100' },
  queued:           { label: 'Queued',           dot: 'bg-blue-400',    text: 'text-blue-600',   bg: 'bg-blue-50' },
  ocr_processing:   { label: 'Reading',          dot: 'bg-amber-400',   text: 'text-amber-700',  bg: 'bg-amber-50' },
  analyzing:        { label: 'Analysing',        dot: 'bg-violet-400',  text: 'text-violet-700', bg: 'bg-violet-50' },
  succeeded:        { label: 'Ready',            dot: 'bg-emerald-500', text: 'text-emerald-700',bg: 'bg-emerald-50' },
  failed:           { label: 'Failed',           dot: 'bg-red-400',     text: 'text-red-600',    bg: 'bg-red-50' },
  reanalyze_queued: { label: 'Reanalysing',      dot: 'bg-sky-400',     text: 'text-sky-700',    bg: 'bg-sky-50' },
  reanalyzing:      { label: 'Reanalysing',      dot: 'bg-sky-400',     text: 'text-sky-700',    bg: 'bg-sky-50' },
  canceled:         { label: 'Cancelled',        dot: 'bg-zinc-300',    text: 'text-zinc-400',   bg: 'bg-zinc-100' },
  cancelled:        { label: 'Cancelled',        dot: 'bg-zinc-300',    text: 'text-zinc-400',   bg: 'bg-zinc-100' },
  submit_queued:    { label: 'Queued',           dot: 'bg-blue-400',    text: 'text-blue-600',   bg: 'bg-blue-50' },
  submitting_stock: { label: 'Creating Stock',   dot: 'bg-amber-400',   text: 'text-amber-700',  bg: 'bg-amber-50' },
  submitting_pi:    { label: 'Creating Invoice', dot: 'bg-violet-400',  text: 'text-violet-700', bg: 'bg-violet-50' },
  submitted:        { label: 'Submitted',        dot: 'bg-emerald-500', text: 'text-emerald-700',bg: 'bg-emerald-50' },
  submit_failed:    { label: 'Submit Failed',    dot: 'bg-red-400',     text: 'text-red-600',    bg: 'bg-red-50' },
  not_ready:        { label: 'Not Ready',        dot: 'bg-zinc-300',    text: 'text-zinc-400',   bg: 'bg-zinc-100' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function BatchStatusModal({
  isOpen,
  batchId,
  groupId,
  items,
  allDone,
  now,
  onClose,
  onSubmitAll,
  onSubmitItem,
  submittingItems = new Set(),
}: BatchStatusModalProps) {
  const router = useRouter();
  const gid = groupId ?? batchId;

  const total         = items.length;
  const doneCount     = items.filter((i) => TERMINAL.has(i.phase)).length;
  const readyCount    = items.filter((i) => i.phase === 'succeeded').length;
  const activeCount   = items.filter((i) => ACTIVE.has(i.phase)).length;
  const failedCount   = items.filter((i) => i.phase === 'failed' || i.phase === 'canceled' || i.phase === 'cancelled' || i.phase === 'submit_failed').length;
  const submittedCount = items.filter((i) => i.phase === 'submitted').length;
  const pct           = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const allReady      = allDone && readyCount > 0 && failedCount === 0;
  const hasSubmitted  = submittedCount > 0;
  const canSubmitAll  = readyCount > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-900/8 max-h-[88vh]"
            onMouseDown={(e) => e.stopPropagation()}
          >

            {/* ── Header ───────────────────────────────────────────────── */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900">Batch Processing</h2>
                  <p className="font-mono text-[10px] text-zinc-400 mt-0.5">{gid}</p>
                </div>
              </div>

              <div className="flex items-center gap-6 mr-4">
                {[
                  { label: 'Total',      value: total,          cls: 'text-zinc-700' },
                  { label: 'Ready',      value: readyCount,     cls: 'text-emerald-600' },
                  { label: 'Processing', value: activeCount,    cls: 'text-violet-600' },
                  { label: 'Submitted',  value: submittedCount, cls: submittedCount > 0 ? 'text-blue-600' : 'text-zinc-300' },
                  { label: 'Failed',     value: failedCount,    cls: failedCount > 0 ? 'text-red-500' : 'text-zinc-300' },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className={`text-lg font-bold tabular-nums leading-none ${s.cls}`}>{s.value}</p>
                    <p className="mt-0.5 text-[10px] font-medium text-zinc-400">{s.label}</p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X size={14} />
              </button>
            </div>

            {/* ── Progress bar ─────────────────────────────────────────── */}
            <div className="px-6 py-3 border-b border-zinc-100 bg-zinc-50/50">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-zinc-400">
                  {allDone
                    ? allReady ? 'All files ready' : `${readyCount} of ${total} ready`
                    : `Processing…`}
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-zinc-600">{pct}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-zinc-200">
                <motion.div
                  className={`h-full rounded-full ${allReady ? 'bg-emerald-500' : failedCount > 0 && allDone ? 'bg-amber-400' : 'bg-zinc-800'}`}
                  animate={{ width: `${pct}%` }}
                  transition={{ ease: 'easeOut', duration: 0.4 }}
                />
              </div>
            </div>

            {/* ── Table ────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-400">File</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-400 w-36">Status</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-400 w-24">Time</th>
                    <th className="px-6 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-400 w-52">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-16 text-center">
                        <Loader2 className="mx-auto animate-spin text-zinc-300" size={20} />
                      </td>
                    </tr>
                  )}
                  {items.map((item) => {
                    const cfg      = PHASE_CFG[item.phase] ?? PHASE_CFG.pending;
                    const active   = ACTIVE.has(item.phase);
                    const done     = TERMINAL.has(item.phase);
                    const img      = isImage(item.fileName);
                    const elapsed  = item.startedAt != null
                      ? (done && item.completedAt != null ? item.completedAt : now) - item.startedAt
                      : null;
                    // Analysis done = this item can be opened and/or submitted
                    const analysisDone = item.analysisPhase === 'succeeded' || item.phase === 'succeeded';
                    const inSubmitStage = SUBMIT_PHASES.has(item.phase);
                    const canSubmit = analysisDone && !inSubmitStage && item.phase !== 'submitted' && onSubmitItem != null;
                    const isSubmitting = submittingItems.has(item.id);

                    return (
                      <tr key={item.id} className="group transition-colors hover:bg-zinc-50/60">
                        {/* File */}
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                              {item.phase === 'succeeded' || item.phase === 'submitted' ? (
                                <CheckCircle2 size={15} className="text-emerald-500" />
                              ) : item.phase === 'failed' || item.phase === 'submit_failed' ? (
                                <AlertCircle size={15} className="text-red-400" />
                              ) : active ? (
                                <Loader2 size={15} className={`animate-spin ${cfg.text}`} />
                              ) : img ? (
                                <ImageIcon size={14} className="text-zinc-400" />
                              ) : (
                                <FileText size={14} className="text-zinc-400" />
                              )}
                            </div>
                            <span className="truncate text-[13px] font-medium text-zinc-800 min-w-0" title={item.fileName}>
                              {item.fileName}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
                            {active
                              ? <Loader2 size={9} className="animate-spin" />
                              : <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />}
                            {cfg.label}
                          </span>
                        </td>

                        {/* Time */}
                        <td className="px-4 py-3 text-right">
                          {elapsed != null ? (
                            <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap text-xs tabular-nums text-zinc-500">
                              <Clock size={12} />
                              {formatElapsed(elapsed)}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-200">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.downloadUrl && (
                              <a
                                href={item.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                                title="Download"
                              >
                                <Download size={13} />
                              </a>
                            )}
                            {canSubmit && (
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => onSubmitItem!(item.id)}
                                className="flex h-7 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                              >
                                {isSubmitting ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                                Submit
                              </button>
                            )}
                            {analysisDone ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (gid) {
                                    sessionStorage.setItem(`groupId_for_${item.id}`, gid);
                                  }
                                  if (item.imageUrl) {
                                    sessionStorage.setItem(`imageUrl_for_${item.id}`, item.imageUrl);
                                  }
                                  router.push(`/purchase-invoice/group/${item.id}`);
                                }}
                                className="flex h-7 items-center gap-1 rounded-lg bg-zinc-900 px-2.5 text-[11px] font-semibold text-white transition hover:bg-zinc-700"
                              >
                                Open <ArrowUpRight size={10} />
                              </button>
                            ) : (
                              !canSubmit && <span className="text-[11px] text-zinc-200">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Footer ───────────────────────────────────────────────── */}
            <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/60 px-6 py-3.5">
              <p className="text-[11px] text-zinc-400">
                {hasSubmitted
                  ? `${submittedCount} submitted · ${readyCount} ready`
                  : allDone
                  ? `${readyCount} of ${total} files ready`
                  : `${activeCount} file${activeCount !== 1 ? 's' : ''} processing…`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Close
                </button>
                {onSubmitAll && canSubmitAll && (
                  <button
                    type="button"
                    onClick={onSubmitAll}
                    className="flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                  >
                    <Send size={13} />
                    Submit All Ready
                  </button>
                )}
              </div>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
