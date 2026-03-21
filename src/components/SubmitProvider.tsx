'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  submitPurchaseInvoice,
  getPurchaseInvoiceSubmitTask,
  formatPurchaseInvoiceSubmitValidationError,
  formatPurchaseInvoiceSubmitPiResult,
  formatPurchaseInvoiceSubmitStockResult,
  type PurchaseInvoiceSubmitRequest,
  type PurchaseInvoiceSubmitTaskStatus,
  type PurchaseInvoiceSubmitTaskResponse,
  type PurchaseInvoiceSubmitValidationError,
  type PurchaseInvoiceSubmitWarning,
} from '../lib/purchase-invoice-submit-api';
import { ApiRequestError } from '../lib/auth-api';

// ---------------------------------------------------------------------------
// Status label & progress mapping
// ---------------------------------------------------------------------------

export type SubmitPhase = PurchaseInvoiceSubmitTaskStatus;

export type SubmitStepInfo = {
  progress: number;
  label: string;
  description: string;
};

const STEP_MAP: Record<SubmitPhase, SubmitStepInfo> = {
  queued: {
    progress: 5,
    label: 'Queued',
    description: 'Invoice is queued and waiting to be processed.',
  },
  validating: {
    progress: 20,
    label: 'Validating',
    description: 'Checking invoice fields and stock items.',
  },
  stock_creating: {
    progress: 50,
    label: 'Creating Stock',
    description: 'Creating new stock items in the accounting system.',
  },
  stock_failed: {
    progress: -1,
    label: 'Stock Creation Failed',
    description: 'Failed to create one or more stock items.',
  },
  pi_creating: {
    progress: 80,
    label: 'Creating Invoice',
    description: 'Writing the purchase invoice into the accounting system.',
  },
  submitted: {
    progress: 100,
    label: 'Submitted',
    description: 'Purchase invoice has been successfully created.',
  },
  completed: {
    progress: 100,
    label: 'Completed',
    description: 'Purchase invoice has been successfully created.',
  },
  failed: {
    progress: -1,
    label: 'Failed',
    description: 'An error occurred. Please review the details and retry.',
  },
};

export function getStepInfo(status: SubmitPhase): SubmitStepInfo {
  return STEP_MAP[status] ?? STEP_MAP.queued;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export type SubmitContextValue = {
  isOpen: boolean;
  status: SubmitPhase | null;
  stepInfo: SubmitStepInfo | null;
  task: PurchaseInvoiceSubmitTaskResponse | null;
  result: null;
  errorMessage: string | null;
  isRunning: boolean;
  startSubmit: (request: PurchaseInvoiceSubmitRequest, options?: { silent?: boolean }) => Promise<void>;
  dismiss: () => void;
};

const SubmitContext = createContext<SubmitContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 180_000;

const SUBMIT_STORAGE_KEY = 'pi:submit:task';

type StoredTask = { submitId: string; startedAt: number };

function readStored(): StoredTask | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SUBMIT_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<StoredTask>;
    if (typeof p.submitId !== 'string' || !p.submitId) return null;
    if (typeof p.startedAt !== 'number') return null;
    return { submitId: p.submitId, startedAt: p.startedAt };
  } catch { return null; }
}

function writeStored(v: StoredTask | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!v) window.sessionStorage.removeItem(SUBMIT_STORAGE_KEY);
    else window.sessionStorage.setItem(SUBMIT_STORAGE_KEY, JSON.stringify(v));
  } catch { /* ignore */ }
}

function formatErrorMessage(
  validationErrors: PurchaseInvoiceSubmitValidationError[] | Array<PurchaseInvoiceSubmitValidationError | string> | undefined,
  warnings: PurchaseInvoiceSubmitWarning[] | undefined,
  stockResults: unknown[] | undefined,
  piResult: unknown,
  lastError: string | undefined,
  fallback: string
): string {
  if (validationErrors && validationErrors.length > 0) {
    return validationErrors.map(formatPurchaseInvoiceSubmitValidationError).join('; ') || fallback;
  }
  if (stockResults && stockResults.length > 0) {
    return stockResults.map((r) => formatPurchaseInvoiceSubmitStockResult(r as any)).join('; ') || fallback;
  }
  const piMessage = formatPurchaseInvoiceSubmitPiResult(piResult as any);
  if (piMessage) {
    return piMessage;
  }
  if (warnings && warnings.length > 0) {
    return warnings.map((w) => w.message).filter(Boolean).join('; ') || fallback;
  }
  if (lastError === 'worker_unavailable') {
    return 'The accounting system worker is offline. Please contact your administrator.';
  }
  return lastError || fallback;
}

export function SubmitProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<SubmitPhase | null>(null);
  const [task, setTask] = useState<PurchaseInvoiceSubmitTaskResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const runningRef = useRef(false);
  // Holds the AbortController for the active SSE connection so it can be
  // cancelled when the user dismisses the modal or the component unmounts.
  const listenAbortRef = useRef<AbortController | null>(null);

  const dismiss = useCallback(() => {
    if (runningRef.current) return;
    listenAbortRef.current?.abort();
    listenAbortRef.current = null;
    writeStored(null);
    setIsOpen(false);
    setErrorMessage(null);
    // Keep terminal success status so the page badge + buttons stay correct
    // after the user closes the progress modal.
    setStatus((prev) => (prev === 'submitted' || prev === 'completed') ? prev : null);
    setTask((prev) => (prev?.status === 'submitted' || prev?.status === 'completed') ? prev : null);
  }, []);

  // Processes a snapshot/status object from either SSE or polling.
  // Returns true if a terminal state was reached.
  const processSnapshot = useCallback((data: Partial<PurchaseInvoiceSubmitTaskResponse>): boolean => {
    if (data.submitId || data.submitTaskId) setTask(data as PurchaseInvoiceSubmitTaskResponse);

    const newStatus = data.status;
    if (newStatus) setStatus(newStatus);

    if (newStatus === 'completed' || newStatus === 'submitted') return true;

    if (newStatus === 'failed' || newStatus === 'stock_failed') {
      setErrorMessage(formatErrorMessage(data.validationErrors, data.warnings, data.stockResults, data.piResult, data.lastError, 'Purchase invoice creation failed.'));
      return true;
    }

    return false;
  }, []);

  // No SSE endpoint for submit — always use polling.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const listenSSE = useCallback(async (
    _submitId: string,
    _accessToken: string | undefined,
    _startedAt: number,
    _signal?: AbortSignal,
  ): Promise<void> => {
    throw new Error('sse_unavailable');
  }, []);

  // Polling fallback — used when SSE is unavailable.
  const pollSubmitTask = useCallback(async (
    submitId: string,
    accessToken: string | undefined,
    startedAt: number,
  ): Promise<void> => {
    while (true) {
      const res = await getPurchaseInvoiceSubmitTask(submitId, accessToken);
      const isTerminal = processSnapshot(res);
      if (isTerminal) return;

      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setErrorMessage(formatErrorMessage(res.validationErrors, res.warnings, res.stockResults, res.piResult, res.lastError, 'The operation timed out. Please check the invoice list to see if it was created.'));
        return;
      }

      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }, [processSnapshot]);

  // Starts listening via SSE, falls back to polling on failure.
  const listenToSubmit = useCallback(async (
    submitId: string,
    accessToken: string | undefined,
    startedAt: number,
  ): Promise<void> => {
    // Create a new AbortController so dismiss() can cancel the SSE connection.
    const ctrl = new AbortController();
    listenAbortRef.current = ctrl;

    setIsRunning(true);
    setIsOpen(true);
    setStatus((c) => c ?? 'queued');
    setErrorMessage(null);

    try {
      try {
        await listenSSE(submitId, accessToken, startedAt, ctrl.signal);
      } catch {
        // If the user dismissed / aborted, don't fall back to polling.
        if (ctrl.signal.aborted) return;
        // SSE not available or failed before connecting — fall back to polling
        await pollSubmitTask(submitId, accessToken, startedAt);
      }
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setErrorMessage(
          err instanceof ApiRequestError ? err.message :
          err instanceof Error ? err.message :
          'An unexpected error occurred.'
        );
      }
    } finally {
      runningRef.current = false;
      setIsRunning(false);
      if (listenAbortRef.current === ctrl) listenAbortRef.current = null;
    }
  }, [listenSSE, pollSubmitTask]);

  const startSubmit = useCallback(async (request: PurchaseInvoiceSubmitRequest, options?: { silent?: boolean }) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsRunning(true);
    if (!options?.silent) setIsOpen(true);
    setStatus('queued');
    setTask(null);
    setErrorMessage(null);

    const startedAt = Date.now();
    const { accessToken } = request;

    try {
      const createRes = await submitPurchaseInvoice(request);
      const submitId = createRes.submitTaskId;

      if (!submitId) {
        setStatus('completed');
        return;
      }

      writeStored({ submitId, startedAt });
      // Keep runningRef = true so dismiss() stays blocked while listening.
      // listenToSubmit's finally block resets runningRef and isRunning.
      void listenToSubmit(submitId, accessToken, startedAt);
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message :
        err instanceof Error ? err.message :
        'An unexpected error occurred.';
      setStatus('failed');
      setErrorMessage(message);
      runningRef.current = false;
      setIsRunning(false);
    }
  }, [listenToSubmit]);

  const stepInfo = useMemo<SubmitStepInfo | null>(() => {
    if (!status) return null;
    return getStepInfo(status);
  }, [status]);

  const value = useMemo<SubmitContextValue>(() => ({
    isOpen, status, stepInfo, task, result: null, errorMessage, isRunning, startSubmit, dismiss,
  }), [isOpen, status, stepInfo, task, errorMessage, isRunning, startSubmit, dismiss]);

  return <SubmitContext.Provider value={value}>{children}</SubmitContext.Provider>;
}

export function useSubmit() {
  const ctx = useContext(SubmitContext);
  if (!ctx) throw new Error('useSubmit must be used within SubmitProvider.');
  return ctx;
}
