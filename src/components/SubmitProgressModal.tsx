'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useSubmit, getStepInfo, type SubmitPhase } from './SubmitProvider';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertTriangle, 
  ArrowRight,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Step timeline items
// ---------------------------------------------------------------------------
const ORDERED_PHASES: SubmitPhase[] = ['queued', 'preparing', 'validating', 'dispatching', 'succeeded'];

function phaseIndex(phase: SubmitPhase | null): number {
  if (!phase) return -1;
  if (phase === 'failed') return -1;
  return ORDERED_PHASES.indexOf(phase);
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SubmitProgressModal() {
  const { isOpen, status, stepInfo, result, errorMessage, isRunning, dismiss } = useSubmit();
  const router = useRouter();

  // local state to toggle between Centered Dialog and Bottom-right Card
  const [isDocked, setIsDocked] = useState(false);

  // Reset isDocked when a NEW submission starts
  useEffect(() => {
    if (isOpen && isRunning && status === 'queued') {
      setIsDocked(false);
    }
  }, [isOpen, isRunning, status]);

  const currentIdx = phaseIndex(status);
  const isFailed = status === 'failed';
  const isSucceeded = status === 'succeeded';
  const isDone = isFailed || isSucceeded;

  const progressPercent = useMemo(() => {
    if (!status || !stepInfo) return 0;
    if (isFailed) {
      const failIdx = currentIdx >= 0 ? currentIdx : 2;
      return getStepInfo(ORDERED_PHASES[failIdx] ?? 'validating').progress;
    }
    return stepInfo.progress;
  }, [status, stepInfo, isFailed, currentIdx]);

  const partialSuccessItems = useMemo(() => {
    if (!result) return [];
    const items: string[] = [];
    if (result.stockCreates?.some((s) => s.success)) {
      const count = result.stockCreates.filter((s) => s.success).length;
      items.push(`${count} stock items created`);
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

  // --- MODE 1: Docked (Bottom-right Card) ---
  if (isDocked) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-[100] w-[360px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5">
            <div className="flex items-center gap-2">
              {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />}
              {isSucceeded && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              {isFailed && <XCircle className="h-4 w-4 text-red-500" />}
              <span className="text-xs font-bold text-zinc-900">
                {isRunning ? 'Submitting Invoice' : 'Submission Progress'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsDocked(false)}
                className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-600"
                title="Expand"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              {!isRunning && (
                <button
                  onClick={dismiss}
                  className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="p-4">
            <div className="mb-2 flex items-center justify-between">
               <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                {stepInfo?.label ?? 'Audit'}
              </span>
              <span className="text-[10px] font-bold tabular-nums text-zinc-500">
                {progressPercent}%
              </span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  isFailed ? 'bg-red-400' : isSucceeded ? 'bg-emerald-500' : 'bg-zinc-900'
                )}
              />
            </div>
            <p className="mt-2 text-[11px] text-zinc-500 truncate">
              {stepInfo?.description}
            </p>
            {isDone && (
               <button
                  onClick={isSucceeded ? handleGoToList : dismiss}
                  className="mt-3 w-full rounded-lg bg-zinc-900 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-800"
               >
                  {isSucceeded ? 'View Invoice List' : 'Back to Editor'}
               </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // --- MODE 2: Centered (Original Modal) ---
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) isRunning ? setIsDocked(true) : dismiss(); }}>
      <DialogContent 
        showCloseButton={false} 
        className="sm:max-w-md bg-white p-0 overflow-hidden border-none shadow-2xl"
      >
        <div className="relative p-6">
          {/* Custom Header with Minimize */}
          <div className="absolute top-4 right-4 flex items-center gap-1">
             <button
                onClick={() => setIsDocked(true)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                title="Continue in background"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              {!isRunning && (
                <button
                  onClick={dismiss}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
          </div>

          <div className="mb-6">
            <DialogHeader className="gap-1">
              <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
                {isRunning && <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />}
                {isSucceeded && <CheckCircle2 className="h-6 w-6 text-emerald-500" />}
                {isFailed && <XCircle className="h-6 w-6 text-red-500" />}
                {isRunning ? 'Submitting Purchase Invoice' : isSucceeded ? 'Invoice Created' : 'Submission Failed'}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 text-sm">
                {stepInfo?.description ?? 'Processing...'}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Progress Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                Current Status: <span className="text-zinc-900">{stepInfo?.label}</span>
              </span>
              <span className="text-sm font-bold tabular-nums text-zinc-900">
                {progressPercent}%
              </span>
            </div>
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  isFailed ? 'bg-red-400' : isSucceeded ? 'bg-emerald-500' : 'bg-zinc-900'
                )}
              />
            </div>
          </div>

          {/* Step Timeline */}
          <div className="space-y-4 mb-2">
            {ORDERED_PHASES.filter(p => p !== 'succeeded').map((phase, idx) => {
              const isActive = status === phase;
              const isCompleted = currentIdx > idx || isSucceeded;
              const isFailedAtThisStep = isFailed && (currentIdx === idx || (currentIdx === -1 && idx === 0));

              return (
                <div key={phase} className="flex items-center gap-4">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                    {isCompleted ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> :
                     isActive && !isDone ? <Loader2 className="h-5 w-5 animate-spin text-zinc-900" /> :
                     isFailedAtThisStep ? <XCircle className="h-5 w-5 text-red-500" /> :
                     <div className="h-2 w-2 rounded-full bg-zinc-200" />}
                  </div>
                  <span className={cn(
                    "text-sm",
                    isActive ? "font-bold text-zinc-900" : isCompleted ? "text-zinc-500" : "text-zinc-300"
                  )}>
                    {getStepInfo(phase).label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Error Message */}
          {isFailed && errorMessage && (
            <div className="mt-6 rounded-2xl border border-red-100 bg-red-50/50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <div className="space-y-1">
                  <p className="text-xs leading-relaxed text-red-700 font-medium">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {isDone && (
          <DialogFooter className="bg-zinc-50/50 p-6 border-t border-zinc-100">
            {isFailed ? (
              <button
                onClick={dismiss}
                className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
              >
                Back to Editor
              </button>
            ) : (
              <button
                onClick={handleGoToList}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-zinc-800 transition-all active:scale-[0.98]"
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
