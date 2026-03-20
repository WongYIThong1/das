'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  getPurchaseInvoicePreviewTask,
  reanalyzePurchaseInvoicePreviewTask,
  type PreviewTaskStatus,
  type PurchaseInvoicePreviewTaskResponse,
} from '../lib/purchase-invoice-create-api';
import { ApiRequestError } from '../lib/auth-api';
import { useAuth } from './AuthProvider';

export type PreviewPhase = PreviewTaskStatus;

export type PreviewStepInfo = {
  progress: number;
  label: string;
  description: string;
};

const STEP_MAP: Record<PreviewPhase, PreviewStepInfo> = {
  queued: {
    progress: 10,
    label: 'Preparing',
    description: 'Queueing the file and warming up the AI preview pipeline.',
  },
  ocr_processing: {
    progress: 45,
    label: 'Reading Documents',
    description: 'Extracting text and structure from the invoice for AI understanding.',
  },
  analyzing: {
    progress: 80,
    label: 'AI Preview',
    description: 'Matching creditors/items and preparing a clean review draft.',
  },
  succeeded: {
    progress: 100,
    label: 'Draft Ready',
    description: 'Preview complete. Your review draft is ready to open.',
  },
  failed: {
    progress: -1,
    label: 'Preview Failed',
    description: 'The preview task failed before the review draft was produced.',
  },
  canceled: {
    progress: -1,
    label: 'Cancelled',
    description: 'This preview was cancelled before completion.',
  },
};

export function getPreviewStepInfo(status: PreviewPhase): PreviewStepInfo {
  return STEP_MAP[status] ?? STEP_MAP.queued;
}

export type StartReanalyzeArgs = {
  taskId: string;
  fileName?: string | null;
  onProgress?: (task: PurchaseInvoicePreviewTaskResponse) => void;
};

export type PreviewProgressContextValue = {
  isOpen: boolean;
  runId: number;
  status: PreviewPhase | null;
  stepInfo: PreviewStepInfo | null;
  task: PurchaseInvoicePreviewTaskResponse | null;
  errorMessage: string | null;
  isRunning: boolean;
  mode: 'reanalyze' | null;
  fileName: string | null;
  startReanalyze: (args: StartReanalyzeArgs) => Promise<PreviewPhase>;
  dismiss: () => void;
};

const PreviewProgressContext = createContext<PreviewProgressContextValue | null>(null);

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 120_000;

export function PreviewProgressProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [runId, setRunId] = useState(0);
  const [status, setStatus] = useState<PreviewPhase | null>(null);
  const [task, setTask] = useState<PurchaseInvoicePreviewTaskResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'reanalyze' | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const { accessToken } = useAuth();
  const runningRef = useRef(false);

  const stepInfo = useMemo(() => {
    if (!status) return null;
    return getPreviewStepInfo(status);
  }, [status]);

  const dismiss = useCallback(() => {
    if (runningRef.current) return;
    setIsOpen(false);
    setStatus(null);
    setTask(null);
    setErrorMessage(null);
    setIsRunning(false);
    setMode(null);
    setFileName(null);
  }, []);

  const startReanalyze = useCallback(async (args: StartReanalyzeArgs): Promise<PreviewPhase> => {
    if (!args.taskId) return 'failed';
    if (runningRef.current) return 'queued';

    runningRef.current = true;
    setIsRunning(true);
    setIsOpen(true);
    setRunId((v) => v + 1);
    setMode('reanalyze');
    setFileName(args.fileName?.trim() ? args.fileName.trim() : null);
    setErrorMessage(null);
    setStatus('queued');

    const startedAt = Date.now();

    try {
      // Kick off reanalyze (async) and immediately start polling for task status.
      const first = await reanalyzePurchaseInvoicePreviewTask(args.taskId, { accessToken: accessToken ?? undefined });
      setTask(first);
      setStatus(first.status);
      args.onProgress?.(first);

      while (true) {
        const next = await getPurchaseInvoicePreviewTask(args.taskId, { accessToken: accessToken ?? undefined });
        setTask(next);
        setStatus(next.status);
        args.onProgress?.(next);

        if (next.status === 'succeeded') return 'succeeded';

        if (next.status === 'failed') {
          const msg = next.error || 'Preview failed.';
          setErrorMessage(msg);
          return 'failed';
        }

        if (next.status === 'canceled') {
          setErrorMessage(null);
          return 'canceled';
        }

        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setErrorMessage('The operation timed out. Please try again.');
          return 'failed';
        }

        await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (err: unknown) {
      const message =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'An unexpected error occurred.';
      setErrorMessage(message);
      setStatus('failed');
      return 'failed';
    } finally {
      runningRef.current = false;
      setIsRunning(false);
    }
  }, [accessToken]);

  const value: PreviewProgressContextValue = useMemo(
    () => ({
      isOpen,
      runId,
      status,
      stepInfo,
      task,
      errorMessage,
      isRunning,
      mode,
      fileName,
      startReanalyze,
      dismiss,
    }),
    [dismiss, errorMessage, fileName, isOpen, isRunning, mode, runId, startReanalyze, status, stepInfo, task]
  );

  return <PreviewProgressContext.Provider value={value}>{children}</PreviewProgressContext.Provider>;
}

export function usePreviewProgress() {
  const ctx = useContext(PreviewProgressContext);
  if (!ctx) {
    throw new Error('usePreviewProgress must be used within PreviewProgressProvider.');
  }
  return ctx;
}
