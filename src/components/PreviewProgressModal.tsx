'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Ban,
  CheckCircle2,
  Loader2,
  Maximize2,
  Minimize2,
  ScanText,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePreviewProgress, getPreviewStepInfo, type PreviewPhase } from './PreviewProgressProvider';

const ORDERED_PHASES: PreviewPhase[] = ['queued', 'ocr_processing', 'analyzing', 'succeeded'];

function phaseIndex(phase: PreviewPhase | null): number {
  if (!phase) return -1;
  if (phase === 'failed' || phase === 'canceled') return -1;
  return ORDERED_PHASES.indexOf(phase);
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function PhaseIcon({ phase, isRunning }: { phase: PreviewPhase | null; isRunning: boolean }) {
  if (!phase) return <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />;
  if (phase === 'failed') return <XCircle className="h-6 w-6 text-red-500" />;
  if (phase === 'canceled') return <Ban className="h-6 w-6 text-amber-600" />;
  if (phase === 'succeeded') return <CheckCircle2 className="h-6 w-6 text-emerald-500" />;
  if (phase === 'ocr_processing') return <ScanText className={cn('h-6 w-6', isRunning ? 'text-amber-700' : 'text-zinc-500')} />;
  if (phase === 'analyzing') return <Sparkles className={cn('h-6 w-6', isRunning ? 'text-sky-700' : 'text-zinc-500')} />;
  return <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />;
}

export default function PreviewProgressModal() {
  const { isOpen, runId, status, stepInfo, errorMessage, isRunning, dismiss, mode, fileName } = usePreviewProgress();

  const [isDocked, setIsDocked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && isRunning) {
      setIsDocked(false);
    }
  }, [runId, isOpen, isRunning]);

  const currentIdx = phaseIndex(status);
  const isFailed = status === 'failed';
  const isCanceled = status === 'canceled';
  const isSucceeded = status === 'succeeded';
  const isDone = isFailed || isSucceeded || isCanceled;

  const progressPercent = useMemo(() => {
    if (!status) return 0;
    const info = getPreviewStepInfo(status);
    if (info.progress < 0) {
      const fallback = currentIdx >= 0 ? ORDERED_PHASES[currentIdx] : 'analyzing';
      return getPreviewStepInfo(fallback).progress;
    }
    return info.progress;
  }, [currentIdx, status]);

  const headerTitle = useMemo(() => {
    if (mode === 'reanalyze') {
      if (isRunning) return 'Reanalyzing Preview';
      if (isSucceeded) return 'Preview Updated';
      if (isCanceled) return 'Reanalyze Cancelled';
      return 'Reanalyze Failed';
    }
    return isRunning ? 'Processing Preview' : isSucceeded ? 'Preview Ready' : 'Preview';
  }, [isCanceled, isRunning, isSucceeded, mode]);

  const headerDescription = useMemo(() => {
    if (isFailed && errorMessage) return errorMessage;
    if (isCanceled) return 'Reanalyze stopped. The current draft is still available.';
    return stepInfo?.description ?? 'Processing...';
  }, [errorMessage, isCanceled, isFailed, stepInfo?.description]);

  if (!isOpen) return null;

  // --- MODE 1: Docked (Bottom-right Card) ---
  if (isDocked) {
    const node = (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          style={{ right: 24, bottom: 24 }}
          className="fixed bottom-6 right-6 z-[100] w-[360px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <PhaseIcon phase={status} isRunning={isRunning} />
              <span className="text-xs font-bold text-zinc-900">{headerTitle}</span>
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
                {stepInfo?.label ?? 'Preview'}
              </span>
              <span className="text-[10px] font-bold tabular-nums text-zinc-500">{progressPercent}%</span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full',
                  isFailed ? 'bg-red-500' : isSucceeded ? 'bg-emerald-500' : isCanceled ? 'bg-amber-600' : 'bg-zinc-900'
                )}
              />
            </div>
            <p className="mt-2 text-[11px] text-zinc-500 truncate">{fileName ? fileName : headerDescription}</p>
            {isDone && (
              <button
                onClick={dismiss}
                className="mt-3 w-full rounded-lg bg-zinc-900 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-800"
              >
                Back to Draft
              </button>
            )}
          </div>

        </motion.div>
      </AnimatePresence>
    );

    // Render docked mode into <body> so it can't be affected by transformed layout ancestors.
    return mounted ? createPortal(node, document.body) : null;
  }

  // --- MODE 2: Centered ---
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          isRunning ? setIsDocked(true) : dismiss();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-preview-progress-dialog
        className="sm:max-w-md bg-white p-0 overflow-hidden border-none shadow-2xl"
      >
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
          <button
            onClick={() => setIsDocked(true)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            title="Continue in background"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          {!isRunning && (
            <button onClick={dismiss} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="relative p-6">
          <div className="mb-6">
            <DialogHeader className="gap-1">
              <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
                <PhaseIcon phase={status} isRunning={isRunning} />
                {headerTitle}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 text-sm">{headerDescription}</DialogDescription>
            </DialogHeader>
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                Current Status: <span className="text-zinc-900">{stepInfo?.label}</span>
              </span>
              <span className="text-sm font-bold tabular-nums text-zinc-900">{progressPercent}%</span>
            </div>
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full',
                  isFailed ? 'bg-red-500' : isSucceeded ? 'bg-emerald-500' : isCanceled ? 'bg-amber-600' : 'bg-zinc-900'
                )}
              />
            </div>
          </div>

          <div className="space-y-4 mb-2">
            {ORDERED_PHASES.filter((p) => p !== 'succeeded').map((phase, idx) => {
              const isActive = status === phase;
              const isCompleted = currentIdx > idx || isSucceeded;
              const label = getPreviewStepInfo(phase).label;

              return (
                <div key={phase} className="flex items-center gap-4">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : isActive && !isDone ? (
                      <Loader2 className="h-5 w-5 animate-spin text-zinc-900" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-zinc-200" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-sm',
                      isActive ? 'font-bold text-zinc-900' : isCompleted ? 'text-zinc-500' : 'text-zinc-300'
                    )}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {isDone && (
          <DialogFooter className="bg-zinc-50/50 p-6 border-t border-zinc-100">
            <button
              onClick={dismiss}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-zinc-800 transition-all active:scale-[0.98]"
            >
              Back to Draft
            </button>
          </DialogFooter>
        )}

      </DialogContent>
    </Dialog>
  );
}
