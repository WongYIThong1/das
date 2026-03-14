'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
    label: 'Transmission',
    description: 'Securing your connection and queueing the invoice for processing.',
  },
  preparing: {
    progress: 25,
    label: 'Synthesis',
    description: 'Finalizing invoice metadata and preparing missing master data records.',
  },
  validating: {
    progress: 50,
    label: 'Compliance Audit',
    description: 'Running AI audit and ledger validation rules to ensure data integrity.',
  },
  dispatching: {
    progress: 75,
    label: 'Ledger Integration',
    description: 'Writing creditors, stock items, and the final invoice into your accounting system.',
  },
  succeeded: {
    progress: 100,
    label: 'Finalized',
    description: 'Transaction complete. Your purchase invoice has been successfully ledgered.',
  },
  failed: {
    progress: -1,
    label: 'Submission Failed',
    description: 'An error occurred during the integration process. Please review and retry.',
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
const SUBMIT_STORAGE_KEY = 'pi:submit:task';
const SUBMIT_REQUEST_STORAGE_KEY = 'pi:submit:request';

type StoredSubmitTask = {
  taskId: string;
  startedAt: number;
};

type StoredSubmitRequest = {
  request: PurchaseInvoiceSubmitRequest;
  startedAt: number;
};

function readStoredSubmitTask(): StoredSubmitTask | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SUBMIT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSubmitTask>;
    if (typeof parsed.taskId !== 'string' || !parsed.taskId) return null;
    if (typeof parsed.startedAt !== 'number' || !Number.isFinite(parsed.startedAt)) return null;
    return { taskId: parsed.taskId, startedAt: parsed.startedAt };
  } catch {
    return null;
  }
}

function writeStoredSubmitTask(task: StoredSubmitTask | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!task) {
      window.sessionStorage.removeItem(SUBMIT_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(SUBMIT_STORAGE_KEY, JSON.stringify(task));
  } catch {
    // ignore
  }
}

function readStoredSubmitRequest(): StoredSubmitRequest | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SUBMIT_REQUEST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSubmitRequest>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.startedAt !== 'number' || !Number.isFinite(parsed.startedAt)) return null;
    const req = parsed.request as PurchaseInvoiceSubmitRequest | undefined;
    if (!req || typeof req !== 'object') return null;
    if (typeof (req as any).requestId !== 'string' || !(req as any).requestId) return null;
    if (typeof (req as any).previewTaskId !== 'string' || !(req as any).previewTaskId) return null;
    return { request: req, startedAt: parsed.startedAt };
  } catch {
    return null;
  }
}

function writeStoredSubmitRequest(value: StoredSubmitRequest | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!value) {
      window.sessionStorage.removeItem(SUBMIT_REQUEST_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(SUBMIT_REQUEST_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

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
    writeStoredSubmitTask(null);
    writeStoredSubmitRequest(null);
    setIsOpen(false);
    // Reset state for next submit
    setStatus(null);
    setTask(null);
    setResult(null);
    setErrorMessage(null);
  }, []);

  const pollSubmitTask = useCallback(async (submitTaskId: string, startedAt: number) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsRunning(true);
    setIsOpen(true);
    setStatus((current) => current ?? 'queued');
    setErrorMessage(null);

    try {
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
      setErrorMessage(message);
    } finally {
      runningRef.current = false;
      setIsRunning(false);
    }
  }, []);

  useEffect(() => {
    const stored = readStoredSubmitTask();
    if (stored) {
      void pollSubmitTask(stored.taskId, stored.startedAt);
      return;
    }

    const pending = readStoredSubmitRequest();
    if (!pending) return;

    // If we refreshed before receiving a taskId, retry the submit once using the same requestId.
    // This relies on backend-side idempotency keyed by requestId.
    void (async () => {
      if (Date.now() - pending.startedAt > POLL_TIMEOUT_MS) {
        writeStoredSubmitRequest(null);
        return;
      }

      setIsOpen(true);
      setIsRunning(true);
      setStatus((current) => current ?? 'queued');
      setErrorMessage(null);

      try {
        const createRes = await submitPurchaseInvoice(pending.request);
        const submitTaskId = (createRes as any).taskId as string | undefined;

        if (!submitTaskId) {
          setStatus('succeeded');
          setResult(createRes as any);
          writeStoredSubmitRequest(null);
          return;
        }

        writeStoredSubmitTask({ taskId: submitTaskId, startedAt: pending.startedAt });
        writeStoredSubmitRequest(null);
        await pollSubmitTask(submitTaskId, pending.startedAt);
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
        setIsRunning(false);
      }
    })();
  }, [pollSubmitTask]);

  const startSubmit = useCallback(async (request: PurchaseInvoiceSubmitRequest) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsRunning(true);
    setIsOpen(true);
    setStatus('queued');
    setTask(null);
    setResult(null);
    setErrorMessage(null);

    const startedAt = Date.now();
    writeStoredSubmitRequest({ request, startedAt });

    try {
      // Step 1: POST /purchase-invoice/submit
      const createRes = await submitPurchaseInvoice(request);
      const submitTaskId = (createRes as any).taskId as string | undefined;

      if (!submitTaskId) {
        // Synchronous result (no task)
        setStatus('succeeded');
        setResult(createRes as any);
        writeStoredSubmitRequest(null);
        return;
      }

      // Persist task so a page refresh can resume polling / show final state.
      writeStoredSubmitTask({ taskId: submitTaskId, startedAt });
      writeStoredSubmitRequest(null);
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
    const stored = readStoredSubmitTask();
    if (stored) {
      void pollSubmitTask(stored.taskId, stored.startedAt);
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
