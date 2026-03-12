'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  submitPurchaseInvoice,
  getPurchaseInvoiceSubmitTask,
  type PurchaseInvoiceSubmitRequest,
  type PurchaseInvoiceSubmitTaskStatus,
  type PurchaseInvoiceSubmitTaskResponse,
  type PurchaseInvoiceSubmitResponse,
} from '../lib/purchase-invoice-submit-api';
import { ApiRequestError } from '../lib/auth-api';

// ---------------------------------------------------------------------------
// Status label & progress mapping
// ---------------------------------------------------------------------------

export type SubmitPhase = PurchaseInvoiceSubmitTaskStatus;

export type SubmitStepInfo = {
  /** Progress value 0-100 */
  progress: number;
  /** User-friendly label */
  label: string;
  /** Shorter secondary text shown below the label */
  description: string;
};

const STEP_MAP: Record<SubmitPhase, SubmitStepInfo> = {
  queued: {
    progress: 8,
    label: 'Submitting',
    description: 'Your invoice has been queued and will begin processing shortly.',
  },
  preparing: {
    progress: 25,
    label: 'Preparing data',
    description: 'Organising your invoice details and checking for missing records.',
  },
  validating: {
    progress: 50,
    label: 'Verifying',
    description: 'Running compliance checks and AI review on your submission.',
  },
  dispatching: {
    progress: 75,
    label: 'Creating records',
    description: 'Writing stock items, creditors, and the purchase invoice into the ledger.',
  },
  succeeded: {
    progress: 100,
    label: 'Complete',
    description: 'Your purchase invoice was created successfully!',
  },
  failed: {
    progress: -1, // keep last known progress
    label: 'Failed',
    description: 'Something went wrong while processing your invoice.',
  },
};

export function getStepInfo(status: SubmitPhase): SubmitStepInfo {
  return STEP_MAP[status] ?? STEP_MAP.queued;
}

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

export type SubmitContextValue = {
  /** Whether the modal should be visible */
  isOpen: boolean;
  /** Current backend status */
  status: SubmitPhase | null;
  /** Derived step info */
  stepInfo: SubmitStepInfo | null;
  /** Full task response (available once first poll returns) */
  task: PurchaseInvoiceSubmitTaskResponse | null;
  /** Final result (only when succeeded or partially succeeded) */
  result: (PurchaseInvoiceSubmitResponse & { validation?: unknown }) | null;
  /** Error message when failed */
  errorMessage: string | null;
  /** Whether the submit is still in-flight */
  isRunning: boolean;
  /** Kick off a submit */
  startSubmit: (request: PurchaseInvoiceSubmitRequest) => Promise<void>;
  /** Close the modal (only allowed when not running) */
  dismiss: () => void;
};

const SubmitContext = createContext<SubmitContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 180_000;

export function SubmitProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<SubmitPhase | null>(null);
  const [task, setTask] = useState<PurchaseInvoiceSubmitTaskResponse | null>(null);
  const [result, setResult] = useState<(PurchaseInvoiceSubmitResponse & { validation?: unknown }) | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Prevent concurrent submits
  const runningRef = useRef(false);

  const dismiss = useCallback(() => {
    if (runningRef.current) return; // can't dismiss while running
    setIsOpen(false);
    // Reset state for next submit
    setStatus(null);
    setTask(null);
    setResult(null);
    setErrorMessage(null);
  }, []);

  const startSubmit = useCallback(async (request: PurchaseInvoiceSubmitRequest) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsRunning(true);
    setIsOpen(true);
    setStatus('queued');
    setTask(null);
    setResult(null);
    setErrorMessage(null);

    try {
      // Step 1: POST /purchase-invoice/submit
      const createRes = await submitPurchaseInvoice(request);
      const submitTaskId = (createRes as any).taskId as string | undefined;

      if (!submitTaskId) {
        // Synchronous result (no task)
        setStatus('succeeded');
        setResult(createRes as any);
        return;
      }

      // Step 2: Poll GET /purchase-invoice/submit/{taskId}
      const startedAt = Date.now();

      while (true) {
        const taskRes = await getPurchaseInvoiceSubmitTask(submitTaskId);
        setTask(taskRes);
        setStatus(taskRes.status);

        if (taskRes.status === 'succeeded' && taskRes.result) {
          setResult(taskRes.result);
          return;
        }

        if (taskRes.status === 'failed') {
          const msg = taskRes.error || taskRes.message || 'Purchase invoice creation failed.';
          setErrorMessage(msg);
          // Even on failure, set partial results so the UI can display them
          if (taskRes.result) {
            setResult(taskRes.result);
          }
          return;
        }

        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setErrorMessage('The operation timed out. Please check the invoice list to see if it was created, or try again.');
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (err: unknown) {
      const message =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'An unexpected error occurred.';
      setStatus('failed');
      setErrorMessage(message);
    } finally {
      runningRef.current = false;
      setIsRunning(false);
    }
  }, []);

  const stepInfo = useMemo<SubmitStepInfo | null>(() => {
    if (!status) return null;
    return getStepInfo(status);
  }, [status]);

  const value = useMemo<SubmitContextValue>(
    () => ({
      isOpen,
      status,
      stepInfo,
      task,
      result,
      errorMessage,
      isRunning,
      startSubmit,
      dismiss,
    }),
    [isOpen, status, stepInfo, task, result, errorMessage, isRunning, startSubmit, dismiss],
  );

  return <SubmitContext.Provider value={value}>{children}</SubmitContext.Provider>;
}

export function useSubmit() {
  const ctx = useContext(SubmitContext);
  if (!ctx) {
    throw new Error('useSubmit must be used within SubmitProvider.');
  }
  return ctx;
}
