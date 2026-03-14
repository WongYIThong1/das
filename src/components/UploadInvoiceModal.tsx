'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, UploadCloud, FileText, Loader2, AlertCircle, Sparkles, CheckCircle2, ScanText, Wand2, CircleStop, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ApiRequestError } from '../lib/auth-api';
import { safeExternalHref } from '@/lib/safe-url';
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
}

const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
const MAX_FILE_SIZE = 15 * 1024 * 1024;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function isSupportedFile(file: File) {
  if (ALLOWED_TYPES.has(file.type)) {
    return true;
  }

  const normalizedName = file.name.toLowerCase();
  return ['.pdf', '.png', '.jpg', '.jpeg', '.webp'].some((extension) => normalizedName.endsWith(extension));
}

export function UploadInvoiceModal({ isOpen, onClose, onSuccess }: UploadInvoiceModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<PreviewTaskStatus | null>(null);
  const [earlyDownloadUrl, setEarlyDownloadUrl] = useState<string | null>(null);
  const [earlyExternalLink, setEarlyExternalLink] = useState<string | null>(null);
  const uploadAbortRef = React.useRef<AbortController | null>(null);
  const previewTaskIdRef = React.useRef<string | null>(null);
  const cancelHandledRef = React.useRef(false);

  const resetState = useCallback(() => {
    setFile(null);
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
  }, []);

  useEffect(() => {
    // Always start the modal from a clean state.
    if (isOpen) {
      cancelHandledRef.current = false;
      resetState();
      return;
    }

    resetState();
  }, [isOpen, resetState]);

  const fileDescription = useMemo(() => {
    if (!file) {
      return 'PDF, PNG, JPG, JPEG, or WEBP up to 15 MB.';
    }

    return `${(file.size / 1024 / 1024).toFixed(2)} MB`;
  }, [file]);

  const stageCopy = useMemo(() => {
    switch (taskStatus) {
      case 'queued':
        return ['Preview task created', 'Your invoice has been queued for background processing.', 24] as const;
      case 'ocr_processing':
        return ['AI reading files', 'Reading the invoice and extracting its contents.', 48] as const;
      case 'analyzing':
        return ['AI building draft', 'Matching creditor, agent, tax code, and line items.', 76] as const;
      case 'canceled':
        return ['Cancelled', 'This draft was cancelled. You can upload a different invoice anytime.', 100] as const;
      case 'succeeded':
        return ['Preview ready', 'The review draft is ready and will open automatically.', 100] as const;
      case 'failed':
        return ['Preview failed', 'The background task failed before the review draft was produced.', 100] as const;
      default:
        return ['Ready to analyze', 'The preview will return payload, matches, and warnings for the review screen.', 8] as const;
    }
  }, [taskStatus]);

  const showStageCard = Boolean(isUploading || taskStatus || error);

  const stageIconAnimation = useMemo(() => {
    if (error || taskStatus === 'failed') {
      return {
        icon: { x: [0, -6, 6, -4, 4, 0], rotate: [0, -2, 2, -1, 1, 0] },
        transition: { duration: 0.42, ease: 'easeInOut' },
      } as const;
    }

    switch (taskStatus) {
      case 'queued':
        return {
          icon: { y: [0, -3, 0], rotate: [0, -4, 4, 0], scale: [1, 1.04, 1] },
          transition: { duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
        } as const;
      case 'ocr_processing':
        return {
          icon: { scale: [1, 1.03, 1] },
          transition: { duration: 1.1, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
        } as const;
      case 'analyzing':
        return {
          icon: { rotate: [0, 6, -6, 0], scale: [1, 1.05, 1] },
          transition: { duration: 1.0, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
        } as const;
      case 'succeeded':
        return {
          icon: { scale: [0.92, 1.06, 1], y: [6, 0, 0] },
          transition: { duration: 0.28, ease: 'easeOut' },
        } as const;
      default:
        return {
          icon: { scale: [1, 1.02, 1] },
          transition: { duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
        } as const;
    }
  }, [error, taskStatus]);

  const stageTone = useMemo(() => {
    if (error || taskStatus === 'failed') {
      return {
        chip: 'border-red-200 bg-red-50 text-red-700',
        subtle: 'text-red-700',
      } as const;
    }

    switch (taskStatus) {
      case 'queued':
        return {
          chip: 'border-sky-200 bg-sky-50 text-sky-700',
          subtle: 'text-sky-700',
        } as const;
      case 'ocr_processing':
        return {
          chip: 'border-amber-200 bg-amber-50 text-amber-800',
          subtle: 'text-amber-800',
        } as const;
      case 'analyzing':
        return {
          chip: 'border-teal-200 bg-teal-50 text-teal-800',
          subtle: 'text-teal-800',
        } as const;
      case 'canceled':
        return {
          chip: 'border-red-200 bg-red-50 text-red-700',
          subtle: 'text-red-700',
        } as const;
      case 'succeeded':
        return {
          chip: 'border-emerald-200 bg-emerald-50 text-emerald-800',
          subtle: 'text-emerald-800',
        } as const;
      default:
        return {
          chip: 'border-zinc-200 bg-zinc-50 text-zinc-600',
          subtle: 'text-zinc-600',
        } as const;
    }
  }, [error, taskStatus]);

  const stageLabel = useMemo(() => {
    if (error) {
      return 'Failed';
    }
    switch (taskStatus) {
      case 'queued':
        return 'Queued';
      case 'ocr_processing':
        return 'AI reading files';
      case 'analyzing':
        return 'AI building draft';
      case 'canceled':
        return 'Cancelled';
      case 'succeeded':
        return 'Ready';
      case 'failed':
        return 'Failed';
      default:
        return 'Ready';
    }
  }, [error, taskStatus]);

  const stageVisual = useMemo(() => {
    if (error || taskStatus === 'failed') {
      return {
        icon: AlertCircle,
        ring: 'from-red-200 via-rose-100 to-amber-100',
        ink: 'text-red-700',
        bar: 'bg-red-600',
      } as const;
    }

    switch (taskStatus) {
      case 'queued':
        return {
          icon: Sparkles,
          ring: 'from-zinc-200 via-zinc-100 to-sky-100',
          ink: 'text-zinc-800',
          bar: 'bg-zinc-950',
        } as const;
      case 'ocr_processing':
        return {
          icon: ScanText,
          ring: 'from-amber-200 via-orange-100 to-zinc-100',
          ink: 'text-amber-800',
          bar: 'bg-amber-600',
        } as const;
      case 'analyzing':
        return {
          icon: Wand2,
          ring: 'from-sky-200 via-teal-100 to-zinc-100',
          ink: 'text-sky-800',
          bar: 'bg-sky-600',
        } as const;
      case 'canceled':
        return {
          icon: CircleStop,
          ring: 'from-red-200 via-rose-100 to-zinc-100',
          ink: 'text-red-700',
          bar: 'bg-red-600',
        } as const;
      case 'succeeded':
        return {
          icon: CheckCircle2,
          ring: 'from-emerald-200 via-green-100 to-zinc-100',
          ink: 'text-emerald-700',
          bar: 'bg-emerald-600',
        } as const;
      default:
        return {
          icon: UploadCloud,
          ring: 'from-zinc-200 via-zinc-100 to-zinc-100',
          ink: 'text-zinc-700',
          bar: 'bg-zinc-950',
        } as const;
    }
  }, [error, taskStatus]);

  const downloadOriginalHref = safeExternalHref(earlyDownloadUrl || earlyExternalLink);

  const applyFile = useCallback((nextFile: File | null) => {
    if (!nextFile) {
      setFile(null);
      return;
    }

    if (!isSupportedFile(nextFile)) {
      toast.error('Only PDF, PNG, JPG, JPEG, and WEBP files are supported.');
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      toast.error('The file is too large. Upload a document under 15 MB.');
      return;
    }

    setError(null);
    setFile(nextFile);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (!isUploading) {
      setIsDragging(true);
    }
  }, [isUploading]);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (isUploading) {
      return;
    }

    const droppedFile = event.dataTransfer.files?.[0] ?? null;
    applyFile(droppedFile);
  }, [applyFile, isUploading]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    applyFile(selectedFile);
    event.target.value = '';
  };

  const handleUpload = async () => {
    if (!file || isUploading) {
      return;
    }

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
      const task = await createPurchaseInvoicePreviewTask(file, { signal: controller.signal });
      previewTaskIdRef.current = task.taskId;
      setTaskStatus(task.status);
      setProgress(24);

      const preview = await waitForPurchaseInvoicePreview(task.taskId, file.name, {
        signal: controller.signal,
        onProgress: (nextTask) => {
          setTaskStatus(nextTask.status);
          if (nextTask.file?.downloadUrl) {
            setEarlyDownloadUrl(nextTask.file.downloadUrl);
          }
          if (nextTask.externalLink) {
            setEarlyExternalLink(nextTask.externalLink);
          }
          if (nextTask.status === 'queued') {
            setProgress(24);
          } else if (nextTask.status === 'ocr_processing') {
            setProgress(52);
          } else if (nextTask.status === 'analyzing') {
            setProgress(82);
          } else if (nextTask.status === 'canceled') {
            setProgress(100);
          } else if (nextTask.status === 'succeeded') {
            setProgress(100);
          }
        },
      });

      setProgress(100);
      setTaskStatus('succeeded');
      window.setTimeout(() => {
        onSuccess(preview);
        setFile(null);
        setProgress(0);
        setIsUploading(false);
        setTaskStatus(null);
      }, 180);
    } catch (uploadError) {
      if (uploadError instanceof DOMException && uploadError.name === 'AbortError') {
        setIsUploading(false);
        setProgress(0);
        setTaskStatus(null);
        setError(null);
        if (!cancelHandledRef.current) {
          onClose();
          toast.message('Cancelled. You can upload a different invoice anytime.', {
            icon: <CircleStop size={18} className="text-red-500" />,
          });
        }
        return;
      }
      if (uploadError instanceof ApiRequestError && uploadError.status === 499) {
        setIsUploading(false);
        setProgress(0);
        setTaskStatus(null);
        setError(null);
        if (!cancelHandledRef.current) {
          onClose();
          toast.message('Cancelled. You can upload a different invoice anytime.', {
            icon: <CircleStop size={18} className="text-red-500" />,
          });
        }
        return;
      }

      setIsUploading(false);
      setProgress(0);
      setTaskStatus('failed');
      const message = getErrorMessage(uploadError, 'Preview failed. Please try another file.');
      setError(message);
      if (uploadError instanceof ApiRequestError && uploadError.status === 401) {
        toast.error('Session expired. Please sign in again.');
        onClose();
        return;
      }
      toast.error(message);
    } finally {
      uploadAbortRef.current = null;
    }
  };

  const handleCancelUpload = () => {
    cancelHandledRef.current = true;
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;

    const taskId = previewTaskIdRef.current;
    previewTaskIdRef.current = null;
    if (taskId) {
      // Best-effort: backend cancel. Even if it fails, we still close and stop polling.
      void cancelPurchaseInvoicePreviewTask(taskId).catch(() => null);
    }

    resetState();
    onClose();
    toast.message('Cancelled. You can upload again anytime.', {
      icon: <CircleStop size={18} className="text-red-500" />,
    });
  };

  const handleClose = useCallback(() => {
    if (isUploading) {
      return;
    }
    resetState();
    onClose();
  }, [isUploading, onClose, resetState]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      handleClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleClose, isOpen]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (isUploading) {
              return;
            }
            // Close only when clicking the backdrop itself (not inside the modal).
            if (event.target === event.currentTarget) {
              handleClose();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex w-full max-w-xl flex-col overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white"
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-700">
                  <Sparkles size={12} />
                  AI Preview
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={isUploading}
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <AnimatePresence mode="wait" initial={false}>
                {showStageCard ? (
                  <motion.div
                    key="stage-card"
                    initial={{ opacity: 0, y: 10, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.99 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="px-1"
                  >
                    <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5">Stage</span>
                      <div className="h-px flex-1 bg-zinc-200/70" />
                      <span className={`rounded-full border px-2 py-0.5 ${stageTone.chip}`}>{stageLabel}</span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Create Invoice</p>
                        <p className="mt-1 truncate text-sm font-semibold text-zinc-950">{file?.name || 'Invoice file'}</p>
                      </div>
                    </div>

                    <div className="mx-auto mt-5 flex max-w-md flex-col items-center text-center">
                      <div className={`relative mb-5 grid h-[96px] w-[96px] place-items-center rounded-[2rem] bg-gradient-to-br ${stageVisual.ring} shadow-sm`}>
                        <div className="absolute inset-[10px] rounded-[1.55rem] bg-white/80 backdrop-blur-sm" />
                        {taskStatus === 'ocr_processing' ? (
                          <div aria-hidden="true" className="absolute inset-[14px] overflow-hidden rounded-[1.45rem]">
                            <motion.div
                              className="absolute left-0 right-0 h-1.5 rounded-full bg-amber-500/50 blur-[0.5px]"
                              initial={{ top: 8 }}
                              animate={{ top: [8, 42, 8] }}
                              transition={{ duration: 1.15, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                            />
                          </div>
                        ) : null}
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.div
                            key={taskStatus || 'idle'}
                            initial={{ opacity: 0, y: 6, scale: 0.92 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.92 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className={`relative ${stageVisual.ink}`}
                          >
                            <motion.div
                              animate={stageIconAnimation.icon as any}
                              transition={stageIconAnimation.transition as any}
                            >
                              {React.createElement(stageVisual.icon, { size: 36 })}
                            </motion.div>
                          </motion.div>
                        </AnimatePresence>
                        {isUploading && !error ? (
                          <motion.div
                            className="absolute inset-0 rounded-[2rem] border border-white/60"
                            animate={{ opacity: [0.35, 0.7, 0.35] }}
                            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        ) : null}
                      </div>

                      <p className="text-lg font-semibold tracking-tight text-zinc-950">{error ? 'Preview failed' : stageCopy[0]}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">{error || stageCopy[1]}</p>

                      <div className="mt-6 w-full">
                        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          <span className={stageTone.subtle}>{stageLabel}</span>
                          <span>{isUploading ? `${progress}%` : '0%'}</span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-200">
                          <motion.div
                            className={`h-full rounded-full ${stageVisual.bar}`}
                            animate={{ width: `${isUploading ? progress : 0}%` }}
                            transition={{ ease: 'easeOut', duration: 0.25 }}
                          />
                        </div>
                      </div>

                      {downloadOriginalHref ? (
                        <a
                          href={downloadOriginalHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                        >
                          <Download size={14} className="text-zinc-600" />
                          Download original
                        </a>
                      ) : null}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="upload-ui"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="space-y-5"
                  >
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`relative overflow-hidden rounded-[1.5rem] border border-dashed px-6 py-10 transition-all ${
                        isDragging
                          ? 'border-zinc-900 bg-zinc-50'
                          : 'border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50/70'
                      }`}
                    >
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={handleFileSelect}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                          {file ? <FileText size={24} /> : <UploadCloud size={24} />}
                        </div>
                        <p className="text-sm font-semibold text-zinc-950">
                          {file ? file.name : 'Click to upload or drag a document here'}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">{fileDescription}</p>
                        {!file ? (
                          <p className="mt-3 text-[11px] text-zinc-400">Supported: PDF, PNG, JPG, JPEG, WEBP</p>
                        ) : null}
                      </div>
                    </div>

                    {error ? (
                      <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">Preview failed</p>
                          <p className="mt-1 text-red-600/90">{error}</p>
                        </div>
                      </div>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/70 px-6 py-4">
              <p className="text-xs text-zinc-500">Single file only. Session cookie is sent automatically.</p>
              <div className="flex items-center gap-3">
                {showStageCard ? (
                  <button
                    type="button"
                    onClick={handleCancelUpload}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-200/60 hover:text-zinc-900"
                  >
                    Cancel
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        handleClose();
                        toast.message('Cancelled. You can upload a different file anytime.', {
                          icon: <CircleStop size={18} className="text-red-500" />,
                        });
                      }}
                      disabled={isUploading}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-200/60 hover:text-zinc-900 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUpload()}
                      disabled={!file || isUploading}
                      className="inline-flex items-center gap-2 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          {stageCopy[0]}...
                        </>
                      ) : (
                        'Upload'
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

