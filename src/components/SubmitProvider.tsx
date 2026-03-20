'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  submitPurchaseInvoice,
  getPurchaseInvoiceSubmitTask,
  type PurchaseInvoiceSubmitRequest,
  type PurchaseInvoiceSubmitTaskStatus,
  type PurchaseInvoiceSubmitTaskResponse,
  type PurchaseInvoiceSubmitValidationError,
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
    progress: 10,
    label: 'Queued',
    description: 'Invoice is queued and waiting to be processed.',
  },
  validating: {
    progress: 35,
    label: 'Validating',
    description: 'Checking invoice data, item codes, and ledger rules.',
  },
  creating_stock: {
    progress: 65,
    label: 'Creating Stock',
    description: 'Creating new stock items proposed by the system.',
  },
  creating_pi: {
    progress: 85,
    label: 'Creating Invoice',
    description: 'Writing the purchase invoice into the accounting system.',
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

type StoredTask = { submitId: string; accessToken?: string; startedAt: number };

function readStored(): StoredTask | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SUBMIT_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<StoredTask>;
    if (typeof p.submitId !== 'string' || !p.submitId) return null;
    if (typeof p.startedAt !== 'number') return null;
    return { submitId: p.submitId, accessToken: p.accessToken, startedAt: p.startedAt };
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
  validationErrors: PurchaseInvoiceSubmitValidationError[] | undefined,
  lastError: string | undefined,
  fallback: string
): string {
  if (validationErrors && validationErrors.length > 0) {
    return validationErrors.map((e) => e.message).filter(Boolean).join('; ') || fallback;
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
    setStatus(null);
    setTask(null);
    setErrorMessage(null);
  }, []);

  // Processes a snapshot/status object from either SSE or polling.
  // Returns true if a terminal state was reached.
  const processSnapshot = useCallback((data: Partial<PurchaseInvoiceSubmitTaskResponse>): boolean => {
    if (data.submitId) setTask(data as PurchaseInvoiceSubmitTaskResponse);

    const newStatus = data.status;
    if (newStatus) setStatus(newStatus);

    if (newStatus === 'completed') return true;

    if (newStatus === 'failed') {
      setErrorMessage(formatErrorMessage(data.validationErrors, data.lastError, 'Purchase invoice creation failed.'));
      return true;
    }

    return false;
  }, []);

  // SSE-based listener — returns normally on terminal state, throws if connection fails.
  const listenSSE = useCallback(async (
    submitId: string,
    accessToken: string | undefined,
    startedAt: number,
    signal?: AbortSignal,
  ): Promise<void> => {
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const response = await fetch(`/api/purchase-invoice/submits/${submitId}/stream`, { headers, signal });
    if (!response.ok || !response.body) throw new Error('sse_unavailable');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    const ERROR_EVENTS = new Set(['validation_failed', 'stock_create_error', 'pi_create_error']);

    try {
      while (true) {
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setErrorMessage('The operation timed out. Please check the invoice list.');
          return;
        }

        const { done, value } = await reader.read();

        if (value?.length) {
          buf += decoder.decode(value, { stream: !done });
        }
        const blocks = buf.split('\n\n');
        buf = done ? '' : (blocks.pop() ?? '');

        for (const block of blocks) {
          if (!block.trim()) continue;

          let eventName = 'message';
          let dataStr = '';
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataStr = line.slice(5).trim();
          }

          if (!dataStr) continue;
          let parsed: Partial<PurchaseInvoiceSubmitTaskResponse>;
          try { parsed = JSON.parse(dataStr); } catch { continue; }

          const isTerminal = processSnapshot(parsed);

          if (ERROR_EVENTS.has(eventName) && !isTerminal) {
            setStatus('failed');
            setErrorMessage(
              formatErrorMessage(parsed.validationErrors, parsed.lastError, 'Purchase invoice creation failed.')
            );
            return;
          }

          if (eventName === 'done' || isTerminal) return;
        }

        if (done) return;
      }
    } finally {
      reader.cancel().catch(() => {});
    }
  }, [processSnapshot]);

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
        setErrorMessage('The operation timed out. Please check the invoice list to see if it was created.');
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
      const submitId = createRes.submitId;

      if (!submitId) {
        setStatus('completed');
        return;
      }

      writeStored({ submitId, accessToken, startedAt });
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
