'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ScanText,
  Wand2,
  CircleStop,
  Download,
  RotateCw,
  Trash2,
  Sparkles,
  ImageIcon,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ApiRequestError } from '../lib/auth-api';
import { safeExternalHref } from '@/lib/safe-url';
import { useAuth } from './AuthProvider';
import {
  cancelPurchaseInvoicePreviewTask,
  createPurchaseInvoicePreviewTask,
  waitForPurchaseInvoicePreview,
  type PreviewTaskStatus,
  type PurchaseInvoicePreviewResponse,
} from '../lib/purchase-invoice-create-api';

interface UploadInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (preview: PurchaseInvoicePreviewResponse) => void;
  /** Called instead of onSuccess when the user submits more than one file. */
  onBatchFiles?: (files: File[]) => void;
}

const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_FILES = 100;

type Rotation = 0 | 90 | 180 | 270;

type FileEntry = {
  id: string;
  file: File;
  rotation: Rotation;
  previewUrl: string | null;
  isImage: boolean;
};

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function isSupportedFile(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) return true;
  const name = file.name.toLowerCase();
  return ['.pdf', '.png', '.jpg', '.jpeg', '.webp'].some((ext) => name.endsWith(ext));
}

function isImageFile(file: File): boolean {
  if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp'].some((ext) => name.endsWith(ext));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function applyCanvasRotation(file: File, rotation: Rotation): Promise<File> {
  if (rotation === 0) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const flipped = rotation === 90 || rotation === 270;
      canvas.width = flipped ? img.height : img.width;
      canvas.height = flipped ? img.width : img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: file.type || 'image/jpeg' }) : file),
        file.type || 'image/jpeg',
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ─── Stage helpers ────────────────────────────────────────────────────────────

type StageMeta = {
  label: string;
  headline: string;
  body: string;
  progress: number;
  color: {
    badge: string;
    bar: string;
    ring: string;
    icon: string;
  };
  icon: React.ElementType;
};

function getStageMeta(taskStatus: PreviewTaskStatus | null, error: string | null): StageMeta {
  if (error || taskStatus === 'failed') {
    return {
      label: 'Failed',
      headline: 'Preview failed',
      body: error ?? 'The background task failed before the review draft was produced.',
      progress: 100,
      color: { badge: 'bg-red-100 text-red-700', bar: 'bg-red-500', ring: 'ring-red-200', icon: 'text-red-600' },
      icon: AlertCircle,
    };
  }
  switch (taskStatus) {
    case 'queued':
      return {
        label: 'Queued',
        headline: 'Waiting in queue',
        body: 'Your invoice has been queued for background processing.',
        progress: 24,
        color: { badge: 'bg-sky-100 text-sky-700', bar: 'bg-sky-500', ring: 'ring-sky-200', icon: 'text-sky-600' },
        icon: Sparkles,
      };
    case 'ocr_processing':
      return {
        label: 'Reading',
        headline: 'AI reading files',
        body: 'Scanning pages and extracting text, numbers, and layout.',
        progress: 52,
        color: { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', ring: 'ring-amber-200', icon: 'text-amber-600' },
        icon: ScanText,
      };
    case 'analyzing':
      return {
        label: 'Analyzing',
        headline: 'Building draft',
        body: 'Matching creditor, agent, tax codes, and line items.',
        progress: 82,
        color: { badge: 'bg-violet-100 text-violet-700', bar: 'bg-violet-500', ring: 'ring-violet-200', icon: 'text-violet-600' },
        icon: Wand2,
      };
    case 'canceled':
      return {
        label: 'Cancelled',
        headline: 'Processing cancelled',
        body: 'This draft was cancelled. You can upload a different invoice anytime.',
        progress: 100,
        color: { badge: 'bg-zinc-100 text-zinc-600', bar: 'bg-zinc-400', ring: 'ring-zinc-200', icon: 'text-zinc-500' },
        icon: CircleStop,
      };
    case 'succeeded':
      return {
        label: 'Done',
        headline: 'Preview ready',
        body: 'The review draft is ready and will open automatically.',
        progress: 100,
        color: { badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', ring: 'ring-emerald-200', icon: 'text-emerald-600' },
        icon: CheckCircle2,
      };
    default:
      return {
        label: 'Ready',
        headline: 'Ready to analyze',
        body: 'Upload your invoice files and click Analyze to begin.',
        progress: 8,
        color: { badge: 'bg-zinc-100 text-zinc-600', bar: 'bg-zinc-400', ring: 'ring-zinc-200', icon: 'text-zinc-400' },
        icon: UploadCloud,
      };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UploadInvoiceModal({ isOpen, onClose, onSuccess, onBatchFiles }: UploadInvoiceModalProps) {
  const { accessToken } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<PreviewTaskStatus | null>(null);
  const [earlyDownloadUrl, setEarlyDownloadUrl] = useState<string | null>(null);
  const [earlyExternalLink, setEarlyExternalLink] = useState<string | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const previewTaskIdRef = useRef<string | null>(null);
  const cancelHandledRef = useRef(false);

  const revokeAll = useCallback((entries: FileEntry[]) => {
    entries.forEach((e) => { if (e.previewUrl) URL.revokeObjectURL(e.previewUrl); });
  }, []);

  const resetState = useCallback(() => {
    setFiles((prev) => { revokeAll(prev); return []; });
    setIsDragging(false);
    setIsUploading(false);
    setProgress(0);
    setError(null);
    setTaskStatus(null);
    setEarlyDownloadUrl(null);
    setEarlyExternalLink(null);
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    previewTaskIdRef.current = null;
  }, [revokeAll]);

  useEffect(() => {
    if (isOpen) { cancelHandledRef.current = false; resetState(); return; }
    resetState();
  }, [isOpen, resetState]);

  const applyFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const entries: FileEntry[] = [];
    let skipped = 0;
    for (const f of arr) {
      if (!isSupportedFile(f) || f.size > MAX_FILE_SIZE) { skipped++; continue; }
      entries.push({ id: randomId(), file: f, rotation: 0, previewUrl: isImageFile(f) ? URL.createObjectURL(f) : null, isImage: isImageFile(f) });
    }
    if (skipped > 0) toast.error(`${skipped} file${skipped > 1 ? 's' : ''} skipped — unsupported or over 15 MB.`);
    if (entries.length === 0) return;
    setFiles((prev) => {
      const combined = [...prev, ...entries];
      if (combined.length > MAX_FILES) {
        combined.slice(MAX_FILES).forEach((e) => { if (e.previewUrl) URL.revokeObjectURL(e.previewUrl); });
        toast.error(`Kept the first ${MAX_FILES} files.`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
    setError(null);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => { const e = prev.find((x) => x.id === id); if (e?.previewUrl) URL.revokeObjectURL(e.previewUrl); return prev.filter((x) => x.id !== id); });
  }, []);

  const clearAll = useCallback(() => {
    setFiles((prev) => { revokeAll(prev); return []; });
  }, [revokeAll]);

  const rotateFile = useCallback((id: string) => {
    setFiles((prev) => prev.map((e) => e.id === id ? { ...e, rotation: (((e.rotation + 90) % 360) as Rotation) } : e));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); if (!isUploading) setIsDragging(true); }, [isUploading]);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (isUploading) return;
    if (e.dataTransfer.files?.length) applyFiles(e.dataTransfer.files);
  }, [applyFiles, isUploading]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) applyFiles(e.target.files);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!files.length || isUploading) return;
    toast.dismiss();
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    cancelHandledRef.current = false;
    setIsUploading(true);
    setProgress(8);
    setError(null);
    setTaskStatus(null);
    setEarlyDownloadUrl(null);
    setEarlyExternalLink(null);

    try {
      const processed = await Promise.all(files.map((e) => e.isImage && e.rotation !== 0 ? applyCanvasRotation(e.file, e.rotation) : e.file));
      if (controller.signal.aborted) throw new ApiRequestError('Preview cancelled.', 499);

      // ── Batch path: hand off to BatchPreviewModal ──
      if (processed.length > 1) {
        setIsUploading(false);
        setProgress(0);
        resetState();
        onBatchFiles?.(processed);
        return;
      }

      const primary = processed[0];
      const task = await createPurchaseInvoicePreviewTask(primary, {
        signal: controller.signal,
        accessToken: accessToken ?? undefined,
      });
      previewTaskIdRef.current = task.taskId;
      setTaskStatus(task.status);
      setProgress(24);

      const preview = await waitForPurchaseInvoicePreview(task.taskId, primary.name, {
        signal: controller.signal,
        accessToken: accessToken ?? undefined,
        onProgress: (t) => {
          setTaskStatus(t.status);
          if (t.file?.downloadUrl) setEarlyDownloadUrl(t.file.downloadUrl);
          if (t.externalLink) setEarlyExternalLink(t.externalLink);
          const map: Partial<Record<typeof t.status, number>> = { queued: 24, ocr_processing: 52, analyzing: 82, canceled: 100, succeeded: 100 };
          const p = map[t.status]; if (p !== undefined) setProgress(p);
        },
      });

      setProgress(100);
      setTaskStatus('succeeded');
      window.setTimeout(() => {
        onSuccess(preview);
        setFiles((prev) => { revokeAll(prev); return []; });
        setProgress(0); setIsUploading(false); setTaskStatus(null);
      }, 180);
    } catch (err) {
      const isCancel = (err instanceof DOMException && err.name === 'AbortError') || (err instanceof ApiRequestError && err.status === 499);
      if (isCancel) {
        setIsUploading(false); setProgress(0); setTaskStatus(null); setError(null);
        if (!cancelHandledRef.current) { onClose(); toast.message('Cancelled.', { icon: <CircleStop size={16} className="text-red-500" /> }); }
        return;
      }
      setIsUploading(false); setProgress(0); setTaskStatus('failed');
      const msg = getErrorMessage(err, 'Preview failed. Please try another file.');
      setError(msg);
      if (err instanceof ApiRequestError && err.status === 401) { toast.error('Session expired.'); onClose(); return; }
      toast.error(msg);
    } finally {
      uploadAbortRef.current = null;
    }
  };

  const handleCancelUpload = () => {
    cancelHandledRef.current = true;
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    const id = previewTaskIdRef.current;
    previewTaskIdRef.current = null;
    if (id) void cancelPurchaseInvoicePreviewTask(id).catch(() => null);
    resetState(); onClose();
    toast.message('Cancelled.', { icon: <CircleStop size={16} className="text-red-500" /> });
  };

  const handleClose = useCallback(() => {
    if (isUploading) return;
    resetState(); onClose();
  }, [isUploading, onClose, resetState]);

  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); handleClose(); } };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [handleClose, isOpen]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const showProcessing = Boolean(isUploading || taskStatus || error);
  const stage = useMemo(() => getStageMeta(taskStatus, error), [taskStatus, error]);
  const StageIcon = stage.icon;
  const totalBytes = useMemo(() => files.reduce((s, e) => s + e.file.size, 0), [files]);
  const hasImages = files.some((e) => e.isImage);
  const downloadHref = safeExternalHref(earlyDownloadUrl || earlyExternalLink);

  const iconAnim = useMemo(() => {
    if (error || taskStatus === 'failed') return { animate: { x: [0, -5, 5, -3, 3, 0] }, transition: { duration: 0.4 } };
    if (taskStatus === 'ocr_processing') return { animate: { scale: [1, 1.04, 1] }, transition: { duration: 1.0, repeat: Infinity } };
    if (taskStatus === 'analyzing') return { animate: { rotate: [0, 8, -8, 0], scale: [1, 1.06, 1] }, transition: { duration: 1.0, repeat: Infinity } };
    if (taskStatus === 'succeeded') return { animate: { scale: [0.9, 1.08, 1] }, transition: { duration: 0.3 } };
    if (taskStatus === 'queued') return { animate: { y: [0, -4, 0] }, transition: { duration: 1.4, repeat: Infinity } };
    return { animate: { scale: [1, 1.03, 1] }, transition: { duration: 2, repeat: Infinity } };
  }, [error, taskStatus]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onMouseDown={(e) => { if (!isUploading && e.target === e.currentTarget) handleClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-7 pt-6 pb-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-950">Upload Invoice</h2>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {showProcessing
                    ? 'AI is processing your files'
                    : files.length > 0
                      ? `${files.length} file${files.length > 1 ? 's' : ''} · ${formatBytes(totalBytes)}`
                      : 'PDF, PNG, JPG, JPEG, WEBP · up to 100 files'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-violet-600">
                  <Sparkles size={10} />
                  AI
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isUploading}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="px-7 pb-2">
              <AnimatePresence mode="wait" initial={false}>

                {/* Processing view */}
                {showProcessing ? (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="pb-4"
                  >
                    <div className="flex flex-col items-center py-6 text-center">
                      {/* Icon ring */}
                      <div className={`relative mb-6 flex h-20 w-20 items-center justify-center rounded-[1.6rem] ring-[6px] ring-offset-2 ${stage.color.ring} bg-white shadow-sm`}>
                        {taskStatus === 'ocr_processing' && (
                          <div aria-hidden="true" className="absolute inset-[10px] overflow-hidden rounded-[1.3rem]">
                            <motion.div
                              className="absolute left-0 right-0 h-1 rounded-full bg-amber-400/60 blur-[1px]"
                              animate={{ top: [6, 36, 6] }}
                              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                            />
                          </div>
                        )}
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.div
                            key={taskStatus ?? 'idle'}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.15 }}
                            className={stage.color.icon}
                          >
                            <motion.div animate={iconAnim.animate as any} transition={iconAnim.transition as any}>
                              <StageIcon size={32} />
                            </motion.div>
                          </motion.div>
                        </AnimatePresence>
                        {isUploading && !error && (
                          <motion.div
                            className="absolute inset-0 rounded-[1.6rem] border-2 border-white/50"
                            animate={{ opacity: [0.2, 0.7, 0.2] }}
                            transition={{ duration: 1.8, repeat: Infinity }}
                          />
                        )}
                      </div>

                      <span className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest ${stage.color.badge}`}>
                        {stage.label}
                      </span>
                      <p className="text-lg font-semibold text-zinc-950">{stage.headline}</p>
                      <p className="mt-1.5 max-w-xs text-sm text-zinc-500">{stage.body}</p>

                      {/* Progress */}
                      <div className="mt-6 w-full max-w-sm">
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                          <motion.div
                            className={`h-full rounded-full ${stage.color.bar}`}
                            animate={{ width: `${isUploading ? progress : 0}%` }}
                            transition={{ ease: 'easeOut', duration: 0.3 }}
                          />
                        </div>
                        <div className="mt-1.5 flex justify-between text-[11px] text-zinc-400">
                          <span>{stage.label}</span>
                          <span>{isUploading ? `${progress}%` : '—'}</span>
                        </div>
                      </div>

                      {downloadHref ? (
                        <a
                          href={downloadHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
                        >
                          <Download size={13} />
                          Download original
                        </a>
                      ) : null}
                    </div>
                  </motion.div>

                ) : files.length === 0 ? (
                  /* Empty drop zone */
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="pb-4"
                  >
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all ${
                        isDragging ? 'border-violet-400 bg-violet-50' : 'border-zinc-200 bg-zinc-50/60 hover:border-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={handleFileInput}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                      <div className="flex flex-col items-center justify-center px-8 py-14 text-center">
                        <motion.div
                          animate={{ y: isDragging ? -4 : 0 }}
                          transition={{ duration: 0.2 }}
                          className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${isDragging ? 'bg-violet-100 text-violet-600' : 'bg-white text-zinc-400 shadow-sm ring-1 ring-zinc-200'}`}
                        >
                          <UploadCloud size={28} />
                        </motion.div>
                        <p className="text-sm font-semibold text-zinc-800">
                          {isDragging ? 'Drop to add files' : 'Drop files here, or click to browse'}
                        </p>
                        <p className="mt-1.5 text-xs text-zinc-400">
                          PDF · PNG · JPG · WEBP &nbsp;·&nbsp; max 15 MB per file &nbsp;·&nbsp; up to {MAX_FILES} files
                        </p>
                      </div>
                    </div>
                  </motion.div>

                ) : (
                  /* Files selected view */
                  <motion.div
                    key="files"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="pb-4"
                  >
                    {/* Compact add-more bar */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`relative mb-4 flex items-center gap-3 overflow-hidden rounded-xl border border-dashed px-4 py-2.5 transition-all ${
                        isDragging ? 'border-violet-400 bg-violet-50' : 'border-zinc-200 bg-zinc-50/60 hover:border-zinc-300'
                      }`}
                    >
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={handleFileInput}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                      <UploadCloud size={14} className="shrink-0 text-zinc-400" />
                      <span className="text-xs font-medium text-zinc-500">
                        {isDragging ? 'Drop to add' : 'Drop or click to add more files'}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] text-zinc-400">
                        {MAX_FILES - files.length} of {MAX_FILES} remaining
                      </span>
                    </div>

                    {/* Grid header */}
                    <div className="mb-2.5 flex items-center justify-between">
                      <p className="text-xs font-semibold text-zinc-500">
                        {files.length} file{files.length > 1 ? 's' : ''}
                        {hasImages ? <span className="ml-2 font-normal text-zinc-400">· hover image to rotate</span> : null}
                      </p>
                      <button
                        type="button"
                        onClick={clearAll}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-zinc-400 transition hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={11} />
                        Clear all
                      </button>
                    </div>

                    {/* Scrollable thumbnail grid */}
                    <div className="max-h-[320px] overflow-y-auto rounded-xl bg-zinc-50 p-2 [scrollbar-gutter:stable]">
                      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
                        {files.map((entry) => (
                          <div key={entry.id} className="group relative">
                            {/* Thumbnail card */}
                            <div className="relative aspect-square overflow-hidden rounded-lg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] ring-1 ring-black/5">
                              {entry.isImage && entry.previewUrl ? (
                                <div className="flex h-full w-full items-center justify-center bg-zinc-100">
                                  <img
                                    src={entry.previewUrl}
                                    alt={entry.file.name}
                                    draggable={false}
                                    className="max-h-full max-w-full object-contain transition-transform duration-300 ease-in-out"
                                    style={{ transform: `rotate(${entry.rotation}deg)` }}
                                  />
                                </div>
                              ) : (
                                <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                                  <FileText size={18} className="text-zinc-300" />
                                  <p className="line-clamp-2 px-1 text-center text-[8px] leading-tight text-zinc-400">
                                    {entry.file.name}
                                  </p>
                                </div>
                              )}

                              {/* Controls overlay — appears on hover */}
                              <div className="absolute inset-0 rounded-lg bg-black/0 transition-colors group-hover:bg-black/10" />

                              {/* Remove */}
                              <button
                                type="button"
                                onClick={() => removeFile(entry.id)}
                                className="absolute right-0.5 top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                              >
                                <X size={9} />
                              </button>

                              {/* Rotate (images only) */}
                              {entry.isImage ? (
                                <button
                                  type="button"
                                  onClick={() => rotateFile(entry.id)}
                                  title="Rotate 90°"
                                  className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                                >
                                  <RotateCw size={10} />
                                </button>
                              ) : null}

                              {/* Rotation badge */}
                              {entry.isImage && entry.rotation !== 0 ? (
                                <div className="absolute left-0.5 top-0.5 rounded-md bg-black/60 px-1 py-0.5 text-[8px] font-semibold text-white">
                                  {entry.rotation}°
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Error */}
                    {error ? (
                      <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                        <AlertCircle size={15} className="mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">Preview failed</p>
                          <p className="mt-0.5 text-xs text-red-600/80">{error}</p>
                        </div>
                      </div>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-between gap-3 border-t border-zinc-100 bg-white px-7 py-4">
              <p className="text-xs text-zinc-400">
                {showProcessing
                  ? `Analyzing ${files.length} file${files.length > 1 ? 's' : ''}…`
                  : 'Session cookie is sent automatically.'}
              </p>
              <div className="flex items-center gap-2">
                {showProcessing ? (
                  <button
                    type="button"
                    onClick={handleCancelUpload}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
                  >
                    Cancel
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { handleClose(); }}
                      disabled={isUploading}
                      className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUpload()}
                      disabled={files.length === 0 || isUploading}
                      className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                    >
                      {isUploading ? (
                        <><Loader2 size={15} className="animate-spin" />{stage.label}…</>
                      ) : (
                        <>
                          {files.length > 1 ? `Analyze ${files.length} files` : 'Analyze'}
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
