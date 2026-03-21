'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSubmit, getStepInfo, type SubmitPhase } from './SubmitProvider';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, XCircle, Loader2, AlertTriangle, ArrowRight, Maximize2, Minimize2 } from 'lucide-react';
import { formatPurchaseInvoiceSubmitPiResult, formatPurchaseInvoiceSubmitValidationError, formatPurchaseInvoiceSubmitStockResult } from '../lib/purchase-invoice-submit-api';

// ---------------------------------------------------------------------------

const ORDERED_PHASES: SubmitPhase[] = ['queued', 'validating', 'stock_creating', 'pi_creating'];

function phaseIndex(phase: SubmitPhase | null): number {
  if (!phase || phase === 'failed' || phase === 'stock_failed' || phase === 'completed' || phase === 'submitted') return -1;
  return ORDERED_PHASES.indexOf(phase);
}

const STEP_ICONS: Record<string, string> = {
  queued:         '⟳',
  validating:     '✦',
  stock_creating: '⚙',
  pi_creating:    '↗',
};

const STEP_LABELS: Record<string, string> = {
  queued:         'Queued',
  validating:     'Validating',
  stock_creating: 'Creating Stock',
  pi_creating:    'Creating Invoice',
};

// ---------------------------------------------------------------------------

export default function SubmitProgressModal() {
  const { isOpen, status, stepInfo, task, errorMessage, isRunning, dismiss } = useSubmit();
  const router = useRouter();
  const [isDocked, setIsDocked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen && isRunning && status === 'queued') setIsDocked(false);
  }, [isOpen, isRunning, status]);

  const isCompleted = status === 'completed' || status === 'submitted';
  const isFailed    = status === 'failed' || status === 'stock_failed';
  const isDone      = isCompleted || isFailed;
  const currentIdx  = phaseIndex(status);

  const progressPercent = useMemo(() => {
    if (!status || !stepInfo) return 0;
    if (isFailed) {
      const failIdx = currentIdx >= 0 ? currentIdx : 1;
      return getStepInfo(ORDERED_PHASES[failIdx] ?? 'validating').progress;
    }
    return stepInfo.progress;
  }, [status, stepInfo, isFailed, currentIdx]);

  const handleGoToList = () => { dismiss(); router.push('/purchase-invoice'); };

  if (!isOpen) return null;

  // Validation errors from task snapshot
  const validationErrors = (task as any)?.validationErrors ?? [];
  const stockResults = (task as any)?.stockResults ?? [];
  const piResultMessage = formatPurchaseInvoiceSubmitPiResult((task as any)?.piResult);

  // ── Docked pill ──────────────────────────────────────────────────────────
  if (isDocked) {
    const node = (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.95 }}
          className="fixed bottom-6 right-6 z-[100] w-80 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <div className="flex items-center gap-2">
              {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />}
              {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
              {isFailed && <XCircle className="h-3.5 w-3.5 text-red-500" />}
              <span className="text-xs font-semibold text-zinc-900">
                {isRunning ? (stepInfo?.label ?? 'Processing…') : isCompleted ? 'Submitted' : 'Failed'}
              </span>
              <span className="text-[10px] font-bold tabular-nums text-zinc-400">{progressPercent}%</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setIsDocked(false)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <Maximize2 className="h-3 w-3" />
              </button>
              {!isRunning && (
                <button onClick={dismiss} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="h-1 overflow-hidden rounded-full bg-zinc-100">
              <motion.div
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={`h-full rounded-full ${isFailed ? 'bg-red-400' : isCompleted ? 'bg-emerald-500' : 'bg-zinc-900'}`}
              />
            </div>
            {isDone && (
              <button
                onClick={isCompleted ? handleGoToList : dismiss}
                className="mt-3 w-full rounded-lg bg-zinc-950 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-800"
              >
                {isCompleted ? 'View Invoice List' : 'Back to Editor'}
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
    return mounted ? createPortal(node, document.body) : null;
  }

  // ── Centered modal ───────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div className="flex items-center gap-2.5">
                {isRunning && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
                {isCompleted && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                {isFailed && <XCircle className="h-5 w-5 text-red-500" />}
                <div>
                  <h2 className="text-sm font-semibold text-zinc-950">
                    {isRunning ? 'Submitting Purchase Invoice' : isCompleted ? 'Invoice Submitted' : 'Submission Failed'}
                  </h2>
                  <p className="text-[11px] text-zinc-400">{stepInfo?.description ?? 'Processing…'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsDocked(true)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                  title="Minimise"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
                {!isRunning && (
                  <button onClick={dismiss} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="px-6 pt-5 pb-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                  {stepInfo?.label ?? '—'}
                </span>
                <span className="text-[11px] font-bold tabular-nums text-zinc-700">{progressPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                <motion.div
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${isFailed ? 'bg-red-400' : isCompleted ? 'bg-emerald-500' : 'bg-zinc-900'}`}
                />
              </div>
            </div>

            {/* Step table */}
            <div className="px-6 py-4">
              <div className="overflow-hidden rounded-xl border border-zinc-100">
                {ORDERED_PHASES.map((phase, idx) => {
                  const isActive     = status === phase;
                  const isCompleted_ = isCompleted || (currentIdx > idx && !isFailed);
                  const isFailedHere = isFailed && (currentIdx === idx || (currentIdx === -1 && idx === 0));

                  return (
                    <div
                      key={phase}
                      className={`flex items-center gap-4 px-4 py-3 ${idx < ORDERED_PHASES.length - 1 ? 'border-b border-zinc-50' : ''} ${isActive && !isDone ? 'bg-zinc-50/80' : ''}`}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-100 bg-white text-sm">
                        {isCompleted_
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          : isActive && !isDone
                            ? <Loader2 className="h-4 w-4 animate-spin text-zinc-700" />
                            : isFailedHere
                              ? <XCircle className="h-4 w-4 text-red-500" />
                              : <span className="text-[11px] text-zinc-300">{STEP_ICONS[phase]}</span>
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isActive && !isDone ? 'text-zinc-900' : isCompleted_ ? 'text-zinc-400' : isFailedHere ? 'text-red-600' : 'text-zinc-300'}`}>
                          {STEP_LABELS[phase]}
                        </p>
                        {isActive && !isDone && (
                          <p className="text-[10px] text-zinc-400 truncate">{getStepInfo(phase).description}</p>
                        )}
                      </div>

                      <div className="shrink-0">
                        {isCompleted_ && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Done</span>
                        )}
                        {isActive && !isDone && (
                          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-white">Active</span>
                        )}
                        {isFailedHere && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">Failed</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Validation errors */}
            {isFailed && validationErrors.length > 0 && (
              <div className="mx-6 mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-red-500">Validation Errors</p>
                <ul className="space-y-1">
                  {validationErrors.map((e: any, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-red-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      <span>{formatPurchaseInvoiceSubmitValidationError(e)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Stock results */}
            {isFailed && stockResults.length > 0 && (
              <div className="mx-6 mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-amber-500">Stock Results</p>
                <ul className="space-y-1">
                  {stockResults.map((r: any, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span>{formatPurchaseInvoiceSubmitStockResult(r)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* PI result */}
            {isFailed && piResultMessage && (
              <div className="mx-6 mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-rose-500">PI Result</p>
                <div className="flex items-start gap-2 text-xs text-rose-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                  <span>{piResultMessage}</span>
                </div>
              </div>
            )}

            {/* Generic error */}
            {isFailed && errorMessage && validationErrors.length === 0 && stockResults.length === 0 && !piResultMessage && (
              <div className="mx-6 mb-4 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-xs font-medium leading-relaxed text-red-700">{errorMessage}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/60 px-6 py-3">
              {isDone ? (
                isFailed ? (
                  <button
                    onClick={dismiss}
                    className="rounded-xl border border-zinc-200 bg-white px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                  >
                    Back to Editor
                  </button>
                ) : (
                  <button
                    onClick={handleGoToList}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                  >
                    View Invoice List <ArrowRight className="h-4 w-4" />
                  </button>
                )
              ) : (
                <button
                  onClick={() => setIsDocked(true)}
                  className="rounded-xl border border-zinc-200 bg-white px-5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Continue in background
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
