'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, UploadCloud, FileText, ImageIcon, Loader2, AlertCircle, Trash2, Check, Camera, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { authFetch } from '../lib/auth-fetch';
import { ApiRequestError } from '../lib/auth-api';

export interface BatchCreatedPayload {
  groupId: string;
  items: Array<{ itemId: string; taskId: string; fileName: string }>;
}

interface UploadInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchCreated?: (payload: BatchCreatedPayload) => void;
}

const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 100;
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 120_000;

type FileEntry = { id: string; file: File; isImage: boolean };

type ProcessPhase =
  | 'uploading'
  | 'queued'
  | 'fileserver_uploading'
  | 'ocrprocessing'
  | 'aianalyzing'
  | 'done';

type ProgressStep = { label: string; sub: string };
const PROGRESS_STEPS: ProgressStep[] = [
  { label: 'Uploading',         sub: 'Sending file to server' },
  { label: 'Reading document',  sub: 'Extracting text with OCR' },
  { label: 'Analysing invoice', sub: 'AI matching & validation' },
  { label: 'Ready',             sub: 'Opening invoice form' },
];

function phaseToStep(phase: ProcessPhase | null): number {
  switch (phase) {
    case 'uploading':
    case 'queued':
    case 'fileserver_uploading': return 0;
    case 'ocrprocessing':        return 1;
    case 'aianalyzing':          return 2;
    case 'done':                 return 3;
    default:                     return -1;
  }
}

function randomId() { return Math.random().toString(36).slice(2, 10); }

function isSupportedFile(file: File) {
  if (ALLOWED_TYPES.has(file.type)) return true;
  const n = file.name.toLowerCase();
  return ['.pdf', '.png', '.jpg', '.jpeg', '.webp'].some((e) => n.endsWith(e));
}

function isImageFile(file: File) {
  if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return true;
  const n = file.name.toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp'].some((e) => n.endsWith(e));
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function statusToPhase(status: string): ProcessPhase {
  switch (status) {
    case 'fileserver_uploading': return 'fileserver_uploading';
    case 'ocrprocessing':        return 'ocrprocessing';
    case 'aianalyzing':          return 'aianalyzing';
    default:                     return 'queued';
  }
}

function FileTypeBadge({ isImage }: { isImage: boolean }) {
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
      isImage ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'
    }`}>
      {isImage ? <ImageIcon size={14} /> : <FileText size={14} />}
    </div>
  );
}

function formatErrorDetails(data: {
  error?: string;
  message?: string;
  lastError?: string;
  validationErrors?: Array<{ message?: string }>;
  warnings?: Array<{ message?: string }>;
} | null | undefined, fallback: string): string {
  const validationMessage = data?.validationErrors?.map((e) => e.message).filter(Boolean).join('; ');
  if (validationMessage) return validationMessage;
  const warningMessage = data?.warnings?.map((w) => w.message).filter(Boolean).join('; ');
  if (warningMessage) return warningMessage;
  return data?.message || data?.lastError || data?.error || fallback;
}

export function UploadInvoiceModal({ isOpen, onClose, onBatchCreated }: UploadInvoiceModalProps) {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [phase, setPhase] = useState<ProcessPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFiles([]); setIsDragging(false);
    setIsBusy(false); setIsBatchUploading(false); setPhase(null); setError(null);
    abortRef.current?.abort(); abortRef.current = null;
  }, []);

  useEffect(() => { reset(); }, [isOpen, reset]);

  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isBusy) { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [isOpen, isBusy, onClose]);

  const applyFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    let skipped = 0;
    const entries: FileEntry[] = [];
    for (const f of arr) {
      if (!isSupportedFile(f) || f.size > MAX_FILE_SIZE) { skipped++; continue; }
      entries.push({ id: randomId(), file: f, isImage: isImageFile(f) });
    }
    if (skipped > 0) toast.error(`${skipped} file${skipped > 1 ? 's' : ''} skipped (unsupported or over 20 MB).`);
    if (!entries.length) return;
    setFiles((prev) => {
      const combined = [...prev, ...entries];
      if (combined.length > MAX_FILES) { toast.error(`Max ${MAX_FILES} files.`); return combined.slice(0, MAX_FILES); }
      return combined;
    });
    setError(null);
  }, []);

  const removeFile = useCallback((id: string) => setFiles((p) => p.filter((e) => e.id !== id)), []);
  const clearAll = useCallback(() => setFiles([]), []);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); if (!isBusy) setIsDragging(true); }, [isBusy]);
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (!isBusy && e.dataTransfer.files?.length) applyFiles(e.dataTransfer.files);
  }, [applyFiles, isBusy]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) applyFiles(e.target.files);
    e.target.value = '';
  };

  const pollStatus = async (taskId: string, signal: AbortSignal): Promise<void> => {
    const startedAt = Date.now();

    while (true) {
      if (signal.aborted) return;
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        const finalRes = await authFetch(`/api/purchase-invoice/create/status?taskId=${encodeURIComponent(taskId)}`, {
          cache: 'no-store', signal,
        }).catch(() => null);
        if (finalRes && 'ok' in finalRes && finalRes.ok) {
          const finalData = await finalRes.json().catch(() => null) as {
            status?: string;
            error?: string;
            lastError?: string;
            message?: string;
            taskId?: string;
            fileServer?: { imageUrl?: string };
            validationErrors?: Array<{ message?: string }>;
            warnings?: Array<{ message?: string }>;
          } | null;
          if (finalData?.status === 'completed' || finalData?.status === 'completed_with_warnings') {
            setPhase('done');
            await new Promise((r) => setTimeout(r, 300));
            router.push(`/purchase-invoice/${taskId}`);
            onClose();
            return;
          }
          if (finalData?.status === 'failed') {
            const validationMessage = finalData.validationErrors?.map((e) => e.message).filter(Boolean).join('; ');
            const warningMessage = finalData.warnings?.map((w) => w.message).filter(Boolean).join('; ');
            throw new ApiRequestError(validationMessage || warningMessage || finalData.lastError || finalData.message || finalData.error || 'Processing failed.', 500, finalData);
          }
        }
        throw new ApiRequestError('Processing timed out. Please try again.', 408);
      }

      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (signal.aborted) return;

      const res = await authFetch(`/api/purchase-invoice/create/status?taskId=${encodeURIComponent(taskId)}`, {
        cache: 'no-store', signal,
      });

      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as any;
        throw new ApiRequestError(d?.error ?? 'Failed to check status.', res.status);
      }

      const d = (await res.json()) as { status?: string };
      const status = d.status ?? '';

      if (status === 'failed') {
        throw new ApiRequestError(
          (d as any)?.lastError || (d as any)?.message || (d as any)?.error || 'Processing failed. Please try again.',
          500,
          d,
        );
      }

      if (status === 'completed' || status === 'completed_with_warnings') {
        setPhase('done');
        await new Promise((r) => setTimeout(r, 300));
        router.push(`/purchase-invoice/${taskId}`);
        onClose();
        return;
      }

      setPhase(statusToPhase(status));
    }
  };

  const handleUpload = async () => {
    if (!files.length || isBusy || !accessToken) return;
    setIsBusy(true); setError(null); setPhase('uploading');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      // ── Batch upload (2+ files) ──────────────────────────────────────────
      if (files.length > 1) {
        setIsBatchUploading(true);
        const form = new FormData();
        for (const entry of files) form.append('file', entry.file, entry.file.name);

        const res = await authFetch('/api/purchase-invoice/batch/create', {
          method: 'POST',
          body: form,
          signal: ctrl.signal,
        });
        const data = (await res.json().catch(() => null)) as {
          groupId?: string;
          items?: Array<{ itemId?: string; taskId?: string; fileName?: string }>;
          error?: string; message?: string; lastError?: string;
          validationErrors?: Array<{ message?: string }>;
          warnings?: Array<{ message?: string }>;
        } | null;
        if (!res.ok) {
          console.error('[Batch upload] failed:', res.status, data);
          throw new ApiRequestError(formatErrorDetails(data, 'Batch upload failed.'), res.status, data);
        }

        const groupId = data?.groupId;
        if (!groupId) throw new ApiRequestError('Unexpected server response.', 500);

        const items = (data?.items ?? []).map((it) => {
          const itemId = it.itemId ?? '';
          const taskId = it.taskId ?? itemId;
          if (itemId) sessionStorage.setItem(`groupId_for_${itemId}`, groupId);
          return { itemId, taskId, fileName: it.fileName ?? itemId };
        });

        onClose();
        onBatchCreated?.({ groupId, items });
        return;
      }

      // ── Single upload ────────────────────────────────────────────────────
      const form = new FormData();
      form.append('file', files[0].file, files[0].file.name);
      const res = await authFetch('/api/purchase-invoice/upload', {
        method: 'POST',
        body: form,
        signal: ctrl.signal,
      });
      const data = (await res.json().catch(() => null)) as {
        taskId?: string;
        error?: string;
        message?: string;
        lastError?: string;
        validationErrors?: Array<{ message?: string }>;
        warnings?: Array<{ message?: string }>;
      } | null;
      if (!res.ok) {
        const msg = data?.error === 'service_unavailable' ? 'Service temporarily unavailable.' :
                    data?.error === 'invalid_request'     ? 'Invalid upload request.' :
                    formatErrorDetails(data, 'Upload failed. Please try again.');
        throw new ApiRequestError(msg, res.status, data);
      }
      if (!data?.taskId) throw new ApiRequestError('Unexpected server response.', 500);

      setPhase('queued');
      await pollStatus(data.taskId, ctrl.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof ApiRequestError && err.status === 401) { toast.error('Session expired.'); onClose(); return; }
      setPhase(null);
      setError(err instanceof ApiRequestError ? err.message : err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      abortRef.current = null; setIsBusy(false); setIsBatchUploading(false);
    }
  };

  const hasFiles = files.length > 0;
  const totalBytes = files.reduce((s, e) => s + e.file.size, 0);
  const isProcessing = isBusy && phase !== null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => { if (!isBusy && e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <h2 className="text-[15px] font-semibold text-zinc-900">Upload Invoice</h2>
              <button
                type="button"
                onClick={() => { if (!isBusy) onClose(); }}
                disabled={isBusy}
                className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30"
              >
                <X size={15} />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="px-5 pb-5">
              <AnimatePresence mode="wait" initial={false}>

                {/* Batch uploading spinner */}
                {isBatchUploading && (
                  <motion.div
                    key="batch-uploading"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-col items-center gap-3 py-10"
                  >
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      <Loader2 size={28} className="text-zinc-800" />
                    </motion.div>
                    <p className="text-[13px] font-semibold text-zinc-800">Uploading {files.length} files…</p>
                    <p className="text-[11px] text-zinc-400">{formatBytes(totalBytes)} total</p>
                  </motion.div>
                )}

                {/* Single-file processing steps */}
                {isProcessing && !isBatchUploading && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18 }}
                    className="py-5 space-y-5"
                  >
                    <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-zinc-200">
                        {files[0]?.isImage
                          ? <ImageIcon size={15} className="text-blue-500" />
                          : <FileText size={15} className="text-orange-500" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-zinc-800" title={files[0]?.file.name}>
                          {files[0]?.file.name ?? 'Invoice'}
                        </p>
                        <p className="text-[11px] text-zinc-400">{formatBytes(files[0]?.file.size ?? 0)}</p>
                      </div>
                    </div>

                    <div className="space-y-0">
                      {PROGRESS_STEPS.map((step, i) => {
                        const active = phaseToStep(phase);
                        const isDone = i < active;
                        const isCurrent = i === active;
                        const isPending = i > active;
                        return (
                          <div key={i} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <motion.div
                                initial={false}
                                animate={isDone ? { backgroundColor: '#18181b', scale: 1 } : isCurrent ? { backgroundColor: '#ffffff', scale: 1.08 } : { backgroundColor: '#ffffff', scale: 1 }}
                                transition={{ duration: 0.2 }}
                                className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 shadow-sm ${
                                  isDone ? 'border-zinc-950 bg-zinc-950' : isCurrent ? 'border-zinc-950 bg-white' : 'border-zinc-200 bg-white'
                                }`}
                              >
                                {isDone && (
                                  <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                                    <Check size={11} className="text-white" strokeWidth={3} />
                                  </motion.div>
                                )}
                                {isCurrent && (
                                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                                    <Loader2 size={13} className="text-zinc-950" />
                                  </motion.div>
                                )}
                                {isPending && <div className="h-2 w-2 rounded-full bg-zinc-200" />}
                              </motion.div>
                              {i < PROGRESS_STEPS.length - 1 && (
                                <div className="mt-0.5 mb-0.5 w-0.5 flex-1 min-h-[20px] rounded-full" style={{ background: isDone ? '#18181b' : '#e4e4e7' }} />
                              )}
                            </div>
                            <div className={`pb-5 pt-0.5 min-w-0 ${i === PROGRESS_STEPS.length - 1 ? 'pb-1' : ''}`}>
                              <p className={`text-[13px] font-semibold leading-tight transition-colors duration-200 ${
                                isDone ? 'text-zinc-400 line-through decoration-zinc-300' : isCurrent ? 'text-zinc-900' : 'text-zinc-300'
                              }`}>
                                {step.label}
                              </p>
                              {isCurrent && (
                                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-0.5 text-[11px] text-zinc-400">
                                  {step.sub}
                                </motion.p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* File selection */}
                {!isProcessing && !isBatchUploading && (
                  <motion.div
                    key="select"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.12 }}
                    className="space-y-3"
                  >
                    {!hasFiles ? (
                      <>
                        <div
                          ref={dropRef}
                          onDragOver={onDragOver}
                          onDragLeave={onDragLeave}
                          onDrop={onDrop}
                          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-all duration-150 ${
                            isDragging ? 'border-zinc-400 bg-zinc-50' : 'border-zinc-200 bg-zinc-50/50 hover:border-zinc-300 hover:bg-zinc-50'
                          }`}
                        >
                          <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={onFileInput} className="absolute inset-0 cursor-pointer opacity-0" />
                          <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-150 ${
                            isDragging ? 'bg-zinc-200 text-zinc-600 scale-110' : 'bg-white text-zinc-400 shadow-sm ring-1 ring-zinc-200'
                          }`}>
                            <UploadCloud size={26} />
                          </div>
                          <p className="text-sm font-semibold text-zinc-700">{isDragging ? 'Release to add files' : 'Drop files here'}</p>
                          <p className="mt-1.5 text-xs text-zinc-400">or click to browse</p>
                          <div className="mt-6 flex items-center gap-1.5">
                            {['PDF', 'PNG', 'JPG', 'WEBP'].map((fmt) => (
                              <span key={fmt} className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 ring-1 ring-zinc-200">{fmt}</span>
                            ))}
                            <span className="ml-1 text-[10px] text-zinc-300">· 20 MB max</span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="mt-3 flex gap-2">
                          <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={onFileInput}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                          >
                            <Camera size={15} />
                            Take Photo
                          </button>
                          <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50">
                            <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={onFileInput} className="sr-only" />
                            <FolderOpen size={15} />
                            Choose Files
                          </label>
                        </div>
                      </>
                    ) : (
                      <>
                        <label
                          onDragOver={onDragOver}
                          onDragLeave={onDragLeave}
                          onDrop={onDrop}
                          className={`relative flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-4 py-2.5 transition-all ${
                            isDragging ? 'border-zinc-400 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                          }`}
                        >
                          <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={onFileInput} className="sr-only" />
                          <UploadCloud size={13} className="shrink-0 text-zinc-400" />
                          <span className="text-xs text-zinc-500">{isDragging ? 'Drop to add' : 'Drop or click to add more'}</span>
                          <span className="ml-auto text-[11px] text-zinc-300">{files.length}/{MAX_FILES}</span>
                        </label>

                        <div className="max-h-56 space-y-1 overflow-y-auto pr-0.5">
                          {files.map((entry) => (
                            <div key={entry.id} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-zinc-50">
                              <FileTypeBadge isImage={entry.isImage} />
                              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-800" title={entry.file.name}>{entry.file.name}</span>
                              <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{formatBytes(entry.file.size)}</span>
                              <button
                                type="button"
                                onClick={() => removeFile(entry.id)}
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-zinc-400">{formatBytes(totalBytes)} total</span>
                          <button
                            type="button"
                            onClick={clearAll}
                            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 size={10} /> Clear all
                          </button>
                        </div>
                      </>
                    )}

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[12px] text-red-600"
                      >
                        <AlertCircle size={13} className="mt-0.5 shrink-0" />
                        <p>{error}</p>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Footer ── */}
            {!isProcessing && !isBatchUploading && (
              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-5 py-4">
                <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleUpload()}
                  disabled={!hasFiles}
                  className="inline-flex min-w-[90px] items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                >
                  Upload
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
