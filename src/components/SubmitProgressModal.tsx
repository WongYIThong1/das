'use client';

import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useSubmit, getStepInfo, type SubmitPhase } from './SubmitProvider';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Step timeline items
// ---------------------------------------------------------------------------

const ORDERED_PHASES: SubmitPhase[] = ['queued', 'preparing', 'validating', 'dispatching', 'succeeded'];

function phaseIndex(phase: SubmitPhase | null): number {
  if (!phase) return -1;
  if (phase === 'failed') return -1;
  return ORDERED_PHASES.indexOf(phase);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SubmitProgressModal() {
  const { isOpen, status, stepInfo, result, errorMessage, isRunning, dismiss } = useSubmit();
  const router = useRouter();

  const currentIdx = phaseIndex(status);
  const isFailed = status === 'failed';
  const isSucceeded = status === 'succeeded';
  const isDone = isFailed || isSucceeded;

  // Compute animated progress width
  const progressPercent = useMemo(() => {
    if (!status || !stepInfo) return 0;
    if (isFailed) {
      // Keep the progress at whatever step it failed at
      const failIdx = currentIdx >= 0 ? currentIdx : 2; // default to validating
      return getStepInfo(ORDERED_PHASES[failIdx] ?? 'validating').progress;
    }
    return stepInfo.progress;
  }, [status, stepInfo, isFailed, currentIdx]);

  // Partial success info (e.g. stock/creditor created but PI failed)
  const partialSuccessItems = useMemo(() => {
    if (!result) return [];
    const items: string[] = [];
    if (result.stockCreates?.some((s) => s.success)) {
      const count = result.stockCreates.filter((s) => s.success).length;
      items.push(`${count} stock item${count > 1 ? 's' : ''} created`);
    }
    if (result.creditorCreate?.success) {
      items.push('Creditor created');
    }
    return items;
  }, [result]);

  const handleGoToList = () => {
    dismiss();
    router.push('/purchase-invoice');
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isRunning) dismiss(); }}>
      <DialogContent
        showCloseButton={!isRunning}
        onPointerDownOutside={(e) => { if (isRunning) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (isRunning) e.preventDefault(); }}
        className="sm:max-w-md bg-white"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            {isRunning && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
            {isSucceeded && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            {isFailed && <XCircle className="h-5 w-5 text-red-500" />}
            {isRunning ? 'Submitting Purchase Invoice' : isSucceeded ? 'Invoice Created' : 'Submission Failed'}
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-sm">
            {stepInfo?.description ?? 'Preparing your submission…'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="mt-2">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${
                isFailed ? 'bg-red-400' : isSucceeded ? 'bg-emerald-500' : 'bg-zinc-800'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">
              {stepInfo?.label ?? '…'}
            </span>
            {!isDone && (
              <span className="text-xs tabular-nums text-zinc-400">
                {progressPercent}%
              </span>
            )}
          </div>
        </div>

        {/* Step timeline */}
        <div className="mt-4 space-y-2.5">
          {ORDERED_PHASES.filter((p) => p !== 'succeeded').map((phase, idx) => {
            const info = getStepInfo(phase);
            const isActive = status === phase;
            const isCompleted = currentIdx > idx || isSucceeded;
            const isFailedAtThisStep = isFailed && (currentIdx === idx || (currentIdx === -1 && idx === 0));

            return (
              <div key={phase} className="flex items-center gap-3">
                {/* Indicator */}
                <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                  {isCompleted && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                  {isActive && !isDone && (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-700" />
                  )}
                  {isFailedAtThisStep && (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  {!isCompleted && !isActive && !isFailedAtThisStep && (
                    <div className="h-2 w-2 rounded-full bg-zinc-200" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-sm transition-colors ${
                    isActive && !isDone
                      ? 'font-medium text-zinc-900'
                      : isCompleted
                        ? 'text-zinc-500'
                        : isFailedAtThisStep
                          ? 'font-medium text-red-600'
                          : 'text-zinc-300'
                  }`}
                >
                  {info.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Error details */}
        {isFailed && errorMessage && (
          <div className="mt-3 rounded-lg border border-red-100 bg-red-50/60 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-xs leading-relaxed text-red-700">{errorMessage}</p>
            </div>

            {/* Partial success notices */}
            {partialSuccessItems.length > 0 && (
              <div className="mt-2 border-t border-red-100 pt-2">
                <p className="text-[11px] font-medium text-red-600 mb-1">However, some records were created:</p>
                <ul className="space-y-0.5">
                  {partialSuccessItems.map((item) => (
                    <li key={item} className="flex items-center gap-1.5 text-[11px] text-red-600">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        {isDone && (
          <DialogFooter className="mt-1">
            {isFailed && (
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100"
              >
                Back to Editor
              </button>
            )}
            {isSucceeded && (
              <button
                type="button"
                onClick={handleGoToList}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                View Invoice List
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
