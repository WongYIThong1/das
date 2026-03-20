'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, ChevronDownIcon, Download, FileText, LoaderCircle, Plus, Save, Search, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DeleteConfirmModal from './DeleteConfirmModal';
import { Input } from './ui/input';
import { ApiRequestError } from '../lib/auth-api';
import { safeExternalHref } from '@/lib/safe-url';
import type { PreviewMatch, PreviewMatchStatus, PreviewProposedNewItem, PreviewWarningCode, PurchaseInvoicePreviewDetail, PurchaseInvoicePreviewPayload, PurchaseInvoicePreviewResponse } from '../lib/purchase-invoice-create-api';
import { getPurchaseInvoiceAgentOptions, getPurchaseInvoiceCreditorOptions, getPurchaseInvoiceStockOptions, type PurchaseInvoiceAgentOption, type PurchaseInvoiceCreditorOption, type PurchaseInvoiceStockOption } from '../lib/purchase-invoice-picker-api';
import {
  submitPurchaseInvoice,
  waitForPurchaseInvoiceSubmit,
  type PurchaseInvoiceCreateMissingItemPayload,
  type PurchaseInvoiceSubmitEnvelope,
  type PurchaseInvoiceSubmitPayload,
  type PurchaseInvoiceSubmitRequestLegacy,
} from '../lib/purchase-invoice-submit-api';

interface CreateInvoiceProps {
  preview: PurchaseInvoicePreviewResponse;
  onBack: () => void;
  onSubmitted: () => Promise<void> | void;
}

type DraftDetail = PurchaseInvoicePreviewDetail & { id: string };
type DraftPayload = Omit<PurchaseInvoicePreviewPayload, 'details'> & {
  details: DraftDetail[];
  invoiceNo: string;
};

type FieldOption = {
  value: string;
  label: string;
  meta?: string;
};

const BLOCKING_WARNINGS = new Set<PreviewWarningCode>(['creditor_not_matched', 'missing_invoice_number', 'missing_invoice_date', 'missing_items']);
const WARNING_COPY: Record<string, string> = {
  missing_invoice_number: 'Invoice number is missing',
  missing_invoice_date: 'Invoice date is missing',
  missing_items: 'No line items were extracted',
  creditor_not_matched: 'Creditor was not matched',
  creditor_needs_review: 'Creditor needs review',
  agent_not_matched: 'Purchase agent was not matched',
  agent_needs_review: 'Purchase agent needs review',
  item_not_matched: 'One or more items were not matched',
  item_needs_review: 'One or more items need review',
};

function normalizeWarningCode(warning: unknown) {
  if (typeof warning === 'string') return warning;
  if (warning && typeof warning === 'object') {
    const record = warning as Record<string, unknown>;
    const candidate = record.code || record.warning || record.type || record.message || record.reason;
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  if (warning == null) return 'unknown_warning';
  return String(warning);
}

function createDraft(payload: PurchaseInvoicePreviewPayload): DraftPayload {
  return {
    creditorCode: payload.creditorCode ?? '',
    purchaseAgent: payload.purchaseAgent ?? '',
    supplierInvoiceNo: payload.supplierInvoiceNo ?? '',
    invoiceNo: payload.supplierInvoiceNo ?? '',
    docDate: payload.docDate ?? '',
    currencyCode: payload.currencyCode ?? '',
    currencyRate: payload.currencyRate ?? '',
    displayTerm: payload.displayTerm ?? '',
    purchaseLocation: payload.purchaseLocation ?? '',
    description: payload.description ?? '',
    creditorAddressLines: Array.isArray(payload.creditorAddressLines) ? payload.creditorAddressLines : [],
    details: Array.isArray(payload.details)
      ? payload.details.map((detail, index) => ({ id: `detail-${index + 1}`, itemCode: detail.itemCode ?? '', description: detail.description ?? '', desc2: detail.desc2 ?? '', qty: detail.qty ?? '', unitPrice: detail.unitPrice ?? '', amount: detail.amount ?? '', uom: detail.uom ?? '', taxCode: detail.taxCode ?? '', accNo: detail.accNo ?? '', itemGroup: detail.itemGroup ?? '' }))
      : [],
  };
}

function getStatusMeta(status?: PreviewMatchStatus) {
  if (status === 'matched') return ['Matched', 'border-emerald-200 bg-emerald-50 text-emerald-700', false] as const;
  if (status === 'review') return ['Review', 'border-amber-200 bg-amber-50 text-amber-700', true] as const;
  return ['Unmatched', 'border-red-200 bg-red-50 text-red-700', true] as const;
}

function formatCandidate(match?: PreviewMatch) {
  const candidate = match?.candidate;
  if (!candidate) return '';
  return String(candidate.companyName || candidate.description || candidate.name || candidate.itemCode || candidate.code || candidate.itemGroup || '');
}

function formatExtractedValue(match: PreviewMatch | undefined, fallback?: unknown) {
  if (typeof match?.extractedValue === 'string' && match.extractedValue.trim()) {
    return match.extractedValue;
  }
  if (typeof fallback === 'string' && fallback.trim()) {
    return fallback;
  }
  return 'Not returned';
}

function formatConfidence(confidence?: number) {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) return 'N/A';
  const value = confidence <= 1 ? confidence * 100 : confidence;
  return `${Math.round(value)}%`;
}

function formatMoney(value: number | string) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return '0.00';
  return parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseDraftDate(value: string) {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatDraftDate(value: string) {
  const parsed = parseDraftDate(value);
  return parsed ? format(parsed, 'PPP') : '';
}

function rowInputClass(highlighted: boolean) {
  return `w-full rounded-lg border px-2.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/5 ${highlighted ? 'border-amber-200 bg-amber-50/40' : 'border-transparent bg-transparent hover:border-zinc-200 focus:bg-white'}`;
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value: number | string) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

function fillItemFromCandidate(detail: DraftDetail, candidate: Record<string, unknown>) {
  return {
    ...detail,
    itemCode: normalizeString(candidate.itemCode) || detail.itemCode,
    description: normalizeString(candidate.description) || detail.description,
    itemGroup: normalizeString(candidate.itemGroup) || detail.itemGroup,
    uom: normalizeString(candidate.purchaseUom) || normalizeString(candidate.salesUom) || normalizeString(candidate.reportUom) || detail.uom,
    taxCode: normalizeString(candidate.purchaseTaxCode) || normalizeString(candidate.taxCode) || detail.taxCode,
  };
}

function makeCodeFromText(value: string, prefix: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12);
  return normalized ? `${prefix}-${normalized}` : `${prefix}-${Date.now().toString().slice(-6)}`;
}

function buildSubmitRequestId() {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `submit-${stamp}-${suffix}`;
}

function buildFinalPayload(draft: DraftPayload): PurchaseInvoiceSubmitPayload {
  return {
    creditorCode: draft.creditorCode.trim(),
    purchaseAgent: draft.purchaseAgent.trim(),
    supplierInvoiceNo: draft.supplierInvoiceNo.trim(),
    docDate: draft.docDate,
    currencyCode: draft.currencyCode.trim(),
    currencyRate: normalizeNumber(draft.currencyRate),
    displayTerm: draft.displayTerm.trim(),
    purchaseLocation: draft.purchaseLocation.trim(),
    description: draft.description.trim(),
    details: draft.details.map((detail) => ({
      itemCode: detail.itemCode.trim(),
      description: detail.description.trim(),
      desc2: detail.desc2.trim(),
      qty: normalizeNumber(detail.qty),
      unitPrice: normalizeNumber(detail.unitPrice),
      amount: normalizeNumber(detail.amount),
      uom: detail.uom.trim(),
      taxCode: detail.taxCode.trim(),
      accNo: detail.accNo.trim(),
      itemGroup: detail.itemGroup.trim(),
    })),
  };
}


function buildItemCreatePayload(detail: DraftDetail, match: PreviewMatch | undefined, line: number): PurchaseInvoiceCreateMissingItemPayload {
  const proposed = (match?.proposedNewItem ?? {}) as PreviewProposedNewItem;
  const candidate = (match?.candidate ?? {}) as Record<string, unknown>;
  const description = normalizeString(proposed.description) || normalizeString(candidate.description) || detail.description.trim();
  const itemGroup = normalizeString(proposed.itemGroup) || normalizeString(candidate.itemGroup) || detail.itemGroup.trim();
  const purchaseUom = normalizeString(proposed.purchaseUom) || normalizeString(proposed.baseUom) || normalizeString(candidate.purchaseUom) || detail.uom.trim() || 'UNIT';
  const salesUom = normalizeString(proposed.salesUom) || purchaseUom;
  const reportUom = normalizeString(proposed.reportUom) || purchaseUom;

  return {
    itemCode: normalizeString(proposed.itemCodeSuggestion) || normalizeString(candidate.itemCode) || makeCodeFromText(itemGroup || description || `ITEM${line}`, 'IT'),
    description,
    itemGroup,
    itemType: normalizeString(proposed.itemType) || normalizeString(candidate.itemType),
    salesUom,
    purchaseUom,
    reportUom,
    stockControl: normalizeBoolean(proposed.stockControl ?? candidate.stockControl, false),
    hasSerialNo: normalizeBoolean(proposed.hasSerialNo ?? candidate.hasSerialNo, false),
    hasBatchNo: normalizeBoolean(proposed.hasBatchNo ?? candidate.hasBatchNo, false),
    isActive: normalizeBoolean(proposed.active ?? candidate.isActive, true),
    taxCode: normalizeString(proposed.taxCode) || normalizeString(candidate.taxCode),
    purchaseTaxCode: normalizeString(proposed.purchaseTaxCode) || normalizeString(candidate.purchaseTaxCode) || detail.taxCode.trim(),
    uomConfirmed: true,
  };
}

function buildSubmitRequest(preview: PurchaseInvoicePreviewResponse, draft: DraftPayload, requestId: string): PurchaseInvoiceSubmitRequestLegacy {
  const payload = buildFinalPayload(draft);
  const createMissing: NonNullable<PurchaseInvoiceSubmitRequestLegacy['createMissing']> = {};



  const itemCreates = payload.details
    .map((detail, index) => {
      if (detail.itemCode) {
        return null;
      }

      return {
        line: index + 1,
        enabled: true,
        payload: buildItemCreatePayload(draft.details[index], preview.matches?.items?.[index], index + 1),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (itemCreates.length > 0) {
    createMissing.items = itemCreates;
  }

  return {
    requestId,
    previewTaskId: preview.taskId?.trim() || '',
    payload,
    createMissing,
  };
}

function getSubmitResultTone(status: number | null, success: boolean | undefined) {
  if (status === 201 && success) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 202) return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function mergeFieldOptions(primary: FieldOption[], secondary: FieldOption[]) {
  const seen = new Set<string>();
  return primary.concat(secondary).filter((option) => {
    const key = `${option.value}::${option.label}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mapCreditorOption(option: PurchaseInvoiceCreditorOption): FieldOption {
  return {
    value: option.accNo,
    label: option.companyName,
    meta: option.currency,
  };
}

function mapAgentOption(option: PurchaseInvoiceAgentOption): FieldOption {
  return {
    value: option.code,
    label: option.description || option.code,
    meta: option.code,
  };
}

function mapStockOption(option: PurchaseInvoiceStockOption): FieldOption {
  return {
    value: option.itemCode,
    label: option.description || option.itemCode,
    meta: option.group,
  };
}

async function loadCreditorFieldOptions(search: string) {
  const response = await getPurchaseInvoiceCreditorOptions({ page: 1, pageSize: 20, search });
  return response.items.map(mapCreditorOption);
}

async function loadAgentFieldOptions(search: string) {
  const response = await getPurchaseInvoiceAgentOptions({ page: 1, pageSize: 20, search });
  return response.items.map(mapAgentOption);
}

async function loadStockFieldOptions(search: string) {
  const response = await getPurchaseInvoiceStockOptions({ page: 1, pageSize: 20, search });
  return response.items.map(mapStockOption);
}

function deriveCreditorFieldOption(preview: PurchaseInvoicePreviewResponse, payload: DraftPayload): FieldOption | null {
  const candidate = preview.matches?.creditor?.candidate as Record<string, unknown> | null | undefined;
  const code = payload.creditorCode.trim() || normalizeString(candidate?.code);
  const label =
    normalizeString(candidate?.companyName) ||
    normalizeString(preview.extracted?.creditorName) ||
    (code ? `Creditor ${code}` : '');

  if (!code && !label) {
    return null;
  }

  return {
    value: code || label,
    label: label || code,
    meta: normalizeString(candidate?.currency) || payload.currencyCode.trim() || undefined,
  };
}

function deriveAgentFieldOption(preview: PurchaseInvoicePreviewResponse, payload: DraftPayload): FieldOption | null {
  const candidate = preview.matches?.agent?.candidate as Record<string, unknown> | null | undefined;
  const code = payload.purchaseAgent.trim() || normalizeString(candidate?.code);
  const label =
    normalizeString(candidate?.description) ||
    normalizeString(candidate?.name) ||
    normalizeString(preview.extracted?.agentName) ||
    code;

  if (!code && !label) {
    return null;
  }

  return {
    value: code || label,
    label: label || code,
    meta: code || undefined,
  };
}

function SearchableField({
  label,
  placeholder,
  value,
  selectedOption,
  onSelect,
  loadOptions,
  emptyLabel = 'No matches found.',
  allowClear = false,
  clearLabel = 'Leave empty',
}: {
  label: string;
  placeholder: string;
  value: string;
  selectedOption: FieldOption | null;
  onSelect: (option: FieldOption) => void;
  loadOptions: (query: string) => Promise<FieldOption[]>;
  emptyLabel?: string;
  allowClear?: boolean;
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<FieldOption[]>(selectedOption ? [selectedOption] : []);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const visibleOptions = useMemo(
    () => mergeFieldOptions(selectedOption ? [selectedOption] : [], options),
    [options, selectedOption]
  );

  useEffect(() => {
    if (!open) {
      setQuery('');
      setLoadError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const nextOptions = await loadOptions(query.trim());
        if (!cancelled) {
          setOptions(nextOptions);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error && error.message ? error.message : `Failed to load ${label.toLowerCase()} options.`;
          setLoadError(message);
          setOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [label, loadOptions, open, query]);

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full justify-between rounded-xl border-zinc-200 bg-white px-3 text-left font-normal text-zinc-900 hover:bg-zinc-50"
          >
            <span className={selectedOption ? 'truncate' : 'truncate text-zinc-400'}>
              {selectedOption ? `${selectedOption.label} ${selectedOption.meta ? `· ${selectedOption.meta}` : ''}` : placeholder}
            </span>
            <ChevronDownIcon size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="border-b border-zinc-200 p-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}`}
                className="h-10 rounded-lg bg-zinc-50 pl-9"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-auto p-1.5">
            {allowClear ? (
              <button
                type="button"
                onClick={() => {
                  onSelect({ value: '', label: '' });
                  setOpen(false);
                }}
                className={`mb-1 w-full rounded-lg border border-dashed px-3 py-2 text-left transition hover:bg-zinc-50 ${value === '' ? 'border-zinc-300 bg-zinc-50' : 'border-zinc-200 text-zinc-600'}`}
              >
                <p className="text-sm font-medium">{clearLabel}</p>
                <p className="mt-0.5 text-xs text-zinc-500">No internal owner assigned</p>
              </button>
            ) : null}
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-5 text-sm text-zinc-500">
                <LoaderCircle size={15} className="animate-spin" />
                Loading options...
              </div>
            ) : null}
            {!loading && visibleOptions.map((option) => (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                onClick={() => {
                  onSelect(option);
                  setOpen(false);
                }}
                className={`w-full rounded-lg px-3 py-2 text-left transition hover:bg-zinc-50 ${value === option.value ? 'bg-zinc-100' : ''}`}
              >
                <p className="text-sm font-medium text-zinc-900">{option.label}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {option.value}
                  {option.meta ? ` · ${option.meta}` : ''}
                </p>
              </button>
            ))}
            {!loading && loadError ? (
              <div className="px-3 py-5 text-center text-sm text-red-600">{loadError}</div>
            ) : null}
            {!loading && !loadError && visibleOptions.length === 0 ? (
              <div className="px-3 py-5 text-center text-sm text-zinc-500">{emptyLabel}</div>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function CreateInvoice({ preview, onBack, onSubmitted }: CreateInvoiceProps) {
  const [draft, setDraft] = useState<DraftPayload>(() => createDraft(preview.payload));
  const [submitRequestId, setSubmitRequestId] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<PurchaseInvoiceSubmitEnvelope | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteLineId, setDeleteLineId] = useState<string | null>(null);
  const [selectedCreditorOption, setSelectedCreditorOption] = useState<FieldOption | null>(() => deriveCreditorFieldOption(preview, createDraft(preview.payload)));
  const [selectedAgentOption, setSelectedAgentOption] = useState<FieldOption | null>(() => deriveAgentFieldOption(preview, createDraft(preview.payload)));

  useEffect(() => {
    const nextDraft = createDraft(preview.payload);
    setDraft(nextDraft);
    setSubmitRequestId(null);
    setSubmitResult(null);
    setDeleteLineId(null);
    setSelectedCreditorOption(deriveCreditorFieldOption(preview, nextDraft));
    setSelectedAgentOption(deriveAgentFieldOption(preview, nextDraft));
  }, [preview]);

  const warnings = (preview.warnings ?? []).map(normalizeWarningCode);
  const blockingWarnings = warnings.filter((warning) => BLOCKING_WARNINGS.has(warning));
  const canContinue = blockingWarnings.length === 0;
  const itemMatches = preview.matches?.items ?? [];
  const originalHref = useMemo(() => safeExternalHref(preview.file?.downloadUrl || preview.payload.externalLink), [preview.file?.downloadUrl, preview.payload.externalLink]);
  const selectedDocDate = useMemo(() => parseDraftDate(draft.docDate), [draft.docDate]);
  const subtotal = useMemo(() => draft.details.reduce((sum, detail) => {
    const amount = Number(detail.amount);
    const fallback = Number(detail.qty) * Number(detail.unitPrice);
    return sum + (Number.isFinite(amount) ? amount : Number.isFinite(fallback) ? fallback : 0);
  }, 0), [draft.details]);
  const taxTotal = useMemo(() => 0, []);
  const netTotal = useMemo(() => subtotal + taxTotal, [subtotal, taxTotal]);
  const displayAddressLines = useMemo(() => {
    const fromDraft = draft.creditorAddressLines.filter((line) => line.trim());
    if (fromDraft.length > 0) {
      return fromDraft;
    }

    return Array.isArray(preview.extracted?.creditorAddressLines)
      ? preview.extracted.creditorAddressLines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
      : [];
  }, [draft.creditorAddressLines, preview.extracted?.creditorAddressLines]);
  const missingAccountLines = useMemo(
    () => draft.details.flatMap((detail, index) => (detail.accNo.trim() ? [] : [index + 1])),
    [draft.details]
  );
  const missingCreateSupportLines = useMemo(
    () =>
      draft.details.flatMap((detail, index) => {
        if (detail.itemCode.trim()) {
          return [];
        }
        return !detail.itemGroup.trim() || !detail.uom.trim() ? [index + 1] : [];
      }),
    [draft.details]
  );
  const submitPlan = useMemo(() => buildSubmitRequest(preview, draft, submitRequestId ?? 'preview-plan'), [draft, preview, submitRequestId]);
  const missingItemCount = submitPlan.createMissing?.items?.length ?? 0;
  const willCreateCreditor = false;
  const localBlockingCount = missingAccountLines.length + missingCreateSupportLines.length;
  const canSubmit = canContinue && localBlockingCount === 0;
  const readinessScore = useMemo(() => {
    const penalties = blockingWarnings.length * 35 + localBlockingCount * 12 + Math.max(0, warnings.length - blockingWarnings.length) * 8;
    return Math.max(0, Math.min(100, 100 - penalties));
  }, [blockingWarnings.length, localBlockingCount, warnings.length]);
  const reviewSummary = useMemo(
    () => [
      { label: 'Creditor', match: preview.matches?.creditor, extracted: preview.extracted?.creditorName },
      { label: 'Purchase Agent', match: preview.matches?.agent, extracted: preview.extracted?.agentName },
    ],
    [preview.extracted?.agentName, preview.extracted?.creditorName, preview.matches?.agent, preview.matches?.creditor]
  );

  const invalidateSubmitState = () => {
    setSubmitRequestId(null);
    setSubmitResult(null);
  };
  const updateField = <K extends keyof DraftPayload>(key: K, value: DraftPayload[K]) => {
    invalidateSubmitState();
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const updateDetail = (id: string, key: keyof PurchaseInvoicePreviewDetail, value: string) => {
    invalidateSubmitState();
    setDraft((current) => ({ ...current, details: current.details.map((detail) => (detail.id === id ? { ...detail, [key]: value } : detail)) }));
  };
  const selectCreditor = (option: FieldOption) => {
    invalidateSubmitState();
    setSelectedCreditorOption(option);
    setDraft((current) => ({ ...current, creditorCode: option.value, currencyCode: current.currencyCode || option.meta || current.currencyCode }));
  };
  const selectAgent = (option: FieldOption) => {
    invalidateSubmitState();
    setSelectedAgentOption(option.value ? option : null);
    setDraft((current) => ({ ...current, purchaseAgent: option.value }));
  };
  const selectStockOption = (id: string, option: FieldOption) => {
    invalidateSubmitState();
    setDraft((current) => ({
      ...current,
      details: current.details.map((detail) =>
        detail.id === id
          ? {
              ...detail,
              itemCode: option.value,
              description: detail.description.trim() ? detail.description : option.label,
              itemGroup: option.meta || detail.itemGroup,
            }
          : detail
      ),
    }));
  };
  const applyExistingItemCandidate = (id: string, candidate: Record<string, unknown>) => {
    invalidateSubmitState();
    setDraft((current) => ({
      ...current,
      details: current.details.map((detail) => (detail.id === id ? fillItemFromCandidate(detail, candidate) : detail)),
    }));
  };
  const applyProposedNewItem = (id: string, match: PreviewMatch | undefined) => {
    if (!match?.proposedNewItem) {
      return;
    }

    invalidateSubmitState();
    setDraft((current) => ({
      ...current,
      details: current.details.map((detail) =>
        detail.id === id
          ? {
              ...detail,
              itemCode: '',
              description: normalizeString(match.proposedNewItem?.description) || detail.description,
              desc2: normalizeString(match.proposedNewItem?.desc2) || detail.desc2,
              itemGroup: normalizeString(match.proposedNewItem?.itemGroup) || detail.itemGroup,
              uom: normalizeString(match.proposedNewItem?.purchaseUom) || normalizeString(match.proposedNewItem?.baseUom) || detail.uom,
              taxCode: normalizeString(match.proposedNewItem?.purchaseTaxCode) || normalizeString(match.proposedNewItem?.taxCode) || detail.taxCode,
            }
          : detail
      ),
    }));
  };
  const addLine = () => {
    invalidateSubmitState();
    setDraft((current) => ({ ...current, details: current.details.concat({ id: `detail-${Date.now()}`, itemCode: '', description: '', desc2: '', qty: '', unitPrice: '', amount: '', uom: '', taxCode: '', accNo: '', itemGroup: '' }) }));
  };
  const removeLine = (id: string) => {
    invalidateSubmitState();
    setDraft((current) => ({ ...current, details: current.details.filter((detail) => detail.id !== id) }));
  };
  const pendingDeleteLine = useMemo(() => draft.details.find((detail) => detail.id === deleteLineId) ?? null, [deleteLineId, draft.details]);
  const handleSubmit = async () => {
    if (!canContinue) {
      toast.error('Resolve the highlighted blocking warnings before submitting.');
      return;
    }
    if (!preview.taskId?.trim()) {
      toast.error('Preview task ID is missing. Re-upload the invoice and wait for preview to finish again.');
      return;
    }
    if (missingAccountLines.length > 0) {
      toast.error(`Account code is required for line ${missingAccountLines.join(', ')}.`);
      return;
    }
    if (missingCreateSupportLines.length > 0) {
      toast.error(`Lines ${missingCreateSupportLines.join(', ')} need item group and UOM before a missing stock item can be created.`);
      return;
    }

    const requestId = submitRequestId ?? buildSubmitRequestId();
    const request = buildSubmitRequest(preview, draft, requestId);

    if (!request.payload.supplierInvoiceNo) {
      toast.error('Supplier invoice number is required before submit.');
      return;
    }
    if (!request.payload.docDate) {
      toast.error('Invoice date is required before submit.');
      return;
    }
    if (request.payload.details.length === 0) {
      toast.error('At least one invoice line is required before submit.');
      return;
    }
    if (!request.payload.creditorCode) {
      toast.error('Creditor code is empty.');
      return;
    }

    setIsSubmitting(true);
    setSubmitRequestId(requestId);

    const handleResolvedSubmit = async (result: PurchaseInvoiceSubmitEnvelope) => {
      setSubmitResult(result);

      const purchaseInvoiceCreated = Boolean(result.success || result.purchaseInvoice?.success);

      if (purchaseInvoiceCreated) {
        toast.success(result.purchaseInvoice?.message || result.message || 'Purchase invoice created successfully.');
        await onSubmitted();
        return;
      }

      if (result.httpStatus === 202) {
        const taskId = (result as unknown as { taskId?: string }).taskId;
        if (!taskId) {
          toast.message(result.message || 'The submit request is still processing. You can retry with the same request ID later.');
          return;
        }

        toast.message('Submit queued. Waiting for completion...');
        const finalResult = await waitForPurchaseInvoiceSubmit(taskId);
        setSubmitResult(finalResult);

        const created = Boolean(finalResult.success || finalResult.purchaseInvoice?.success);
        if (created) {
          toast.success(finalResult.purchaseInvoice?.message || finalResult.message || 'Purchase invoice created successfully.');
          await onSubmitted();
        } else {
          toast.error(finalResult.purchaseInvoice?.message || finalResult.message || 'Purchase invoice submit failed.');
        }
        return;
      }

      const stockSuccessCount = result.stockCreates?.filter((entry) => entry.success).length ?? 0;
      const creditorCreated = Boolean(result.creditorCreate?.success);
      if (stockSuccessCount > 0 || creditorCreated) {
        toast.error(result.message || 'Master data was created, but purchase invoice creation did not finish.');
      } else {
        toast.error(result.purchaseInvoice?.message || result.message || 'Purchase invoice submit failed.');
      }
    };

    try {
      const result = await submitPurchaseInvoice(request);
      await handleResolvedSubmit(result);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 502) {
        toast.message('Submit response was interrupted. Confirming the result with the same request ID...');

        try {
          const retriedResult = await submitPurchaseInvoice(request);
          await handleResolvedSubmit(retriedResult);
          return;
        } catch (retryError) {
          const retryMessage = retryError instanceof Error && retryError.message ? retryError.message : 'Purchase invoice submit retry failed.';
          console.error('[purchase-invoice-submit] retry failed', {
            requestId,
            previewTaskId: request.previewTaskId,
            message: retryMessage,
            error: retryError,
          });
          toast.error(retryMessage);
          return;
        }
      }

      const message = error instanceof Error && error.message ? error.message : 'Purchase invoice submit failed.';
      console.error('[purchase-invoice-submit] failed', {
        requestId,
        previewTaskId: request.previewTaskId,
        message,
        error,
      });
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top,#f7f7f5_0%,#f1f1ed_48%,#ecece7_100%)] font-sans text-zinc-900">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200/80 bg-white/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-start gap-4">
          <button type="button" onClick={onBack} className="rounded-xl border border-transparent p-2 text-zinc-500 transition hover:border-zinc-200 hover:bg-white hover:text-zinc-900">
            <ArrowLeft size={18} />
          </button>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              <Sparkles size={12} />
              Preview Ready
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950">Purchase invoice review draft</h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1.5"><FileText size={12} />{preview.sourceFileName || 'Uploaded invoice'}</span>
{originalHref ? (
  <a
    href={originalHref}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 text-zinc-500 transition hover:text-zinc-900"
  >
    <Download size={12} />
    <span>Open original</span>
    <ArrowUpRight size={12} />
  </a>
) : null}
{preview.file?.status ? (
  <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
    File: {preview.file.status}
  </span>
) : null}
              {preview.provider ? <span>Provider: {preview.provider}</span> : null}
              <span>{draft.details.length} line items</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-white hover:text-zinc-900">Back</button>
          <button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit || isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400">
            {isSubmitting ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
            {isSubmitting ? 'Submitting...' : 'Submit Purchase Invoice'}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto grid max-w-[1680px] gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <section className="min-w-0 xl:order-2">
            {!canContinue ? <div className="mb-4 rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Resolve the highlighted invoice number, date, creditor, or item fields before submitting.</div> : null}
            {localBlockingCount > 0 ? <div className="mb-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">Final submit still needs manual completion for account code and missing stock-create support fields.</div> : null}

            <div className="overflow-hidden rounded-[2.25rem] border border-zinc-200/80 bg-white shadow-[0_28px_80px_rgba(24,24,27,0.08)]">
              <div className="border-b border-zinc-200 bg-[linear-gradient(180deg,#fffef9_0%,#faf8f2_100%)] px-8 py-8 sm:px-10">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Purchase Invoice</p>
                    <h2 className="text-3xl font-semibold tracking-tight text-zinc-950">{draft.supplierInvoiceNo.trim() || 'Draft invoice'}</h2>
                    <p className="max-w-2xl text-sm leading-6 text-zinc-500">Confirm the extracted supplier invoice, adjust master data matches, and prepare the final payload for submit.</p>
                  </div>
                  <div className="grid gap-3 text-sm text-zinc-600 sm:grid-cols-3">
                    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Source File</p>
                      <p className="mt-2 font-medium text-zinc-900">{preview.sourceFileName || 'Uploaded invoice'}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Currency</p>
                      <p className="mt-2 font-medium text-zinc-900">{draft.currencyCode || 'MYR'} <span className="font-normal text-zinc-500">x {draft.currencyRate || '1'}</span></p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Net Total</p>
                      <p className="mt-2 font-medium text-zinc-900">{draft.currencyCode || 'MYR'} {formatMoney(netTotal)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-8 py-8 sm:px-10">
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
                  <div className="space-y-8">
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="space-y-5 rounded-[1.75rem] border border-zinc-200 bg-zinc-50/70 px-6 py-6">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Pay To</p>
                            <p className="mt-1 text-sm text-zinc-500">Choose the ledger creditor and verify the remittance details.</p>
                          </div>
                          <div className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Creditor</div>
                        </div>
                        <SearchableField
                          label="Creditor"
                          placeholder="Select creditor"
                          value={draft.creditorCode}
                          selectedOption={selectedCreditorOption}
                          onSelect={selectCreditor}
                          loadOptions={loadCreditorFieldOptions}
                          emptyLabel="No creditors found in this ledger."
                        />
                        <div className="rounded-[1.4rem] border border-zinc-200 bg-white px-5 py-5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Address</p>
                          <div className="mt-3 space-y-1 text-[15px] leading-7 text-zinc-800">
                            {displayAddressLines.length > 0 ? displayAddressLines.map((line) => <p key={line}>{line}</p>) : <p className="text-zinc-400">Select a creditor or wait for the extracted address to appear.</p>}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-5 rounded-[1.75rem] border border-zinc-200 bg-zinc-50/70 px-6 py-6">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Assignment</p>
                            <p className="mt-1 text-sm text-zinc-500">Operational owner, internal number, and document timing.</p>
                          </div>
                          <div className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Control</div>
                        </div>
                        <SearchableField
                          label="Agent"
                          placeholder="Select purchase agent"
                          value={draft.purchaseAgent}
                          selectedOption={selectedAgentOption}
                          onSelect={selectAgent}
                          loadOptions={loadAgentFieldOptions}
                          emptyLabel="No agents found in this ledger."
                          allowClear
                          clearLabel="Leave agent empty"
                        />
                        <div className="rounded-[1.4rem] border border-zinc-200 bg-white px-5 py-5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Assigned Agent</p>
                          <p className="mt-3 text-[15px] font-medium text-zinc-900">{selectedAgentOption?.label || formatExtractedValue(preview.matches?.agent, preview.extracted?.agentName) || 'No mapped agent selected'}</p>
                          <p className="mt-1 text-sm text-zinc-500">{selectedAgentOption?.meta || preview.matches?.agent?.reason || 'Select an internal owner before submit.'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.9rem] border border-zinc-200 bg-white px-6 py-6">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Document Header</p>
                          <p className="mt-1 text-sm text-zinc-500">Numbers, dates, and payment terms the ledger will post against.</p>
                        </div>
                        <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Header</div>
                      </div>

                      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Supplier IV No</label>
                          <Input value={draft.supplierInvoiceNo} onChange={(event) => updateField('supplierInvoiceNo', event.target.value)} placeholder="Supplier invoice number" className="h-11 rounded-xl bg-white" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Invoice No</label>
                          <Input value={draft.invoiceNo} onChange={(event) => updateField('invoiceNo', event.target.value)} placeholder="Internal invoice number" className="h-11 rounded-xl bg-white" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Term</label>
                          <Input value={draft.displayTerm} onChange={(event) => updateField('displayTerm', event.target.value)} placeholder="C.O.D." className="h-11 rounded-xl bg-white" />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Invoice Date</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" className="h-11 w-full justify-between rounded-xl border-zinc-200 bg-white px-3 text-left font-normal text-zinc-900 hover:bg-zinc-50">
                                <span className={selectedDocDate ? '' : 'text-zinc-400'}>{selectedDocDate ? formatDraftDate(draft.docDate) : 'Pick invoice date'}</span>
                                <CalendarDays size={16} />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={selectedDocDate} onSelect={(date) => updateField('docDate', date ? format(date, 'yyyy-MM-dd') : '')} defaultMonth={selectedDocDate} />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Location</label>
                          <Input value={draft.purchaseLocation} onChange={(event) => updateField('purchaseLocation', event.target.value)} placeholder="HQ" className="h-11 rounded-xl bg-white" />
                        </div>
                      </div>

                      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_160px_160px]">
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Description & Notes</label>
                          <Input value={draft.description} onChange={(event) => updateField('description', event.target.value)} placeholder="PURCHASE INVOICE" className="h-11 rounded-xl bg-white" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Currency</label>
                          <Input value={draft.currencyCode} onChange={(event) => updateField('currencyCode', event.target.value)} placeholder="MYR" className="h-11 rounded-xl bg-white" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Rate</label>
                          <Input value={String(draft.currencyRate)} onChange={(event) => updateField('currencyRate', event.target.value)} placeholder="1" className="h-11 rounded-xl bg-white" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-[1.75rem] border border-zinc-200 bg-zinc-50/80 px-6 py-6">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Extracted Context</p>
                      <div className="mt-5 space-y-4 text-sm">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Extracted Supplier</p>
                          <p className="mt-1 text-zinc-900">{formatExtractedValue(preview.matches?.creditor, preview.extracted?.creditorName)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Extracted Agent</p>
                          <p className="mt-1 text-zinc-900">{formatExtractedValue(preview.matches?.agent, preview.extracted?.agentName)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Provider</p>
                          <p className="mt-1 text-zinc-900">{preview.provider || 'gpt-5.4'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Source File</p>
                          <p className="mt-1 text-zinc-900">{preview.sourceFileName || 'Uploaded invoice'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-zinc-200 bg-zinc-950 px-6 py-6 text-white">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Financial Summary</p>
                      <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between text-sm text-zinc-300"><span>Subtotal</span><span className="font-medium text-white">{draft.currencyCode || 'MYR'} {formatMoney(subtotal)}</span></div>
                        <div className="flex items-center justify-between text-sm text-zinc-300"><span>Tax</span><span className="font-medium text-white">{draft.currencyCode || 'MYR'} {formatMoney(taxTotal)}</span></div>
                        <div className="flex items-center justify-between border-t border-white/10 pt-4 text-base font-semibold text-white"><span>Net Total</span><span>{draft.currencyCode || 'MYR'} {formatMoney(netTotal)}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-t border-zinc-200 bg-zinc-50/50">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="flex shrink-0 items-center justify-between px-10 py-5">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Invoice Lines</p>
                        <p className="mt-1 text-sm text-zinc-500">Review extracted descriptions, fill account code, and confirm stock matching before post.</p>
                      </div>
                      <button type="button" onClick={addLine} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"><Plus size={16} />Add Line</button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-x-hidden border-t border-zinc-200 bg-white">
                      <table className="w-full table-fixed border-separate border-spacing-0 text-left">
                        <thead className="sticky top-0 z-10 bg-white">
                          <tr className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 shadow-[inset_0_-1px_0_0_rgb(228,228,231)]">
                            <th className="w-12 px-3 py-3">Line</th>
                            <th className="w-32 px-3 py-3">Account</th>
                            <th className="w-[34%] px-3 py-3">Item &amp; Description</th>
                            <th className="w-20 px-3 py-3">Rate</th>
                            <th className="w-28 px-3 py-3">Amount</th>
                            <th className="w-24 px-3 py-3">Tax</th>
                            <th className="w-28 px-3 py-3">Taxable</th>
                            <th className="w-[22%] px-3 py-3">Review</th>
                            <th className="w-12 px-3 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {draft.details.map((detail, index) => {
                            const match = itemMatches[index];
                            const [statusLabel, badgeClass, highlighted] = getStatusMeta(match?.status);
                            const missingAccNo = !detail.accNo.trim();
                            const missingCreateSupport = !detail.itemCode.trim() && (!detail.itemGroup.trim() || !detail.uom.trim());
                            const numericAmount = Number(detail.amount);
                            const fallbackAmount = Number(detail.qty) * Number(detail.unitPrice);
                            const taxableAmount = Number.isFinite(numericAmount) ? numericAmount : Number.isFinite(fallbackAmount) ? fallbackAmount : 0;
                            return (
                              <tr key={detail.id} className="align-top shadow-[inset_0_-1px_0_0_rgb(244,244,245)]">
                                <td className="px-4 py-4 text-xs font-medium text-zinc-400">{index + 1}</td>
                                <td className="px-3 py-4 align-top">
                                  <input type="text" value={detail.accNo} onChange={(event) => updateDetail(detail.id, 'accNo', event.target.value)} className={rowInputClass(missingAccNo)} placeholder="610-0000" />
                                </td>
                                <td className="px-3 py-4 align-top">
                                  <div className="space-y-2.5">
                                    <input type="text" value={detail.description} onChange={(event) => updateDetail(detail.id, 'description', event.target.value)} className={`${rowInputClass(highlighted)} break-words`} placeholder="Item description" />
                                    <input type="text" value={detail.desc2} onChange={(event) => updateDetail(detail.id, 'desc2', event.target.value)} placeholder="Desc2" className={rowInputClass(false)} />
                                    <div className="grid gap-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Item Code</p>
                                        <SearchableField
                                          label="Item Code"
                                          placeholder="Search stock item"
                                          value={detail.itemCode}
                                          selectedOption={
                                            detail.itemCode || detail.description || detail.itemGroup
                                              ? {
                                                  value: detail.itemCode || 'UNMATCHED',
                                                  label: detail.description || detail.itemCode || 'Unmatched item',
                                                  meta: detail.itemGroup || undefined,
                                                }
                                              : null
                                          }
                                          onSelect={(option) => selectStockOption(detail.id, option)}
                                          loadOptions={loadStockFieldOptions}
                                          emptyLabel="No stock items found."
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Item Group</p>
                                        <input type="text" value={detail.itemGroup} onChange={(event) => updateDetail(detail.id, 'itemGroup', event.target.value)} placeholder="Item group" className={rowInputClass(highlighted || missingCreateSupport)} />
                                      </div>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">UOM</p>
                                        <input type="text" value={detail.uom} onChange={(event) => updateDetail(detail.id, 'uom', event.target.value)} placeholder="UNIT" className={rowInputClass(missingCreateSupport)} />
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Qty</p>
                                        <input type="text" value={String(detail.qty)} onChange={(event) => updateDetail(detail.id, 'qty', event.target.value)} placeholder="0" className={rowInputClass(false)} />
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Unit Price</p>
                                        <input type="text" value={String(detail.unitPrice)} onChange={(event) => updateDetail(detail.id, 'unitPrice', event.target.value)} placeholder="0.00" className={rowInputClass(false)} />
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-4">
                                  <div className="flex h-11 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-900">
                                    {draft.currencyRate || '1'}
                                  </div>
                                </td>
                                <td className="px-3 py-4">
                                  <input type="text" value={String(detail.amount)} onChange={(event) => updateDetail(detail.id, 'amount', event.target.value)} className={rowInputClass(false)} />
                                </td>
                                <td className="px-3 py-4">
                                  <input type="text" value={detail.taxCode} onChange={(event) => updateDetail(detail.id, 'taxCode', event.target.value)} className={rowInputClass(false)} placeholder="[Blank]" />
                                </td>
                                <td className="px-3 py-4">
                                  <div className="flex h-11 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-900">
                                    {formatMoney(taxableAmount)}
                                  </div>
                                </td>
                                <td className="px-3 py-4 align-top">
                                  <div className="max-w-full space-y-2">
                                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${badgeClass}`}>{statusLabel}</span>
                                    <p className="break-words text-[11px] leading-5 text-zinc-500">{formatCandidate(match) || 'No mapped item yet'}</p>
                                    {match?.reason ? <p className="line-clamp-3 break-words text-[11px] leading-5 text-zinc-400">{match.reason}</p> : null}
                                    {Array.isArray(match?.topCandidates) && match.topCandidates.length > 0 ? (
                                      <div className="flex flex-wrap gap-1.5">
                                        {match.topCandidates.slice(0, 2).map((candidate, candidateIndex) => (
                                          <button
                                            key={`${detail.id}-candidate-${candidateIndex}`}
                                            type="button"
                                            onClick={() => applyExistingItemCandidate(detail.id, candidate)}
                                            className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600 transition hover:border-zinc-300 hover:bg-white"
                                          >
                                            {String(candidate.itemCode || candidate.description || candidate.companyName || candidate.name || 'Candidate')}
                                          </button>
                                        ))}
                                      </div>
                                    ) : null}
                                    {!match?.candidate && match?.proposedNewItem ? (
                                      <button
                                        type="button"
                                        onClick={() => applyProposedNewItem(detail.id, match)}
                                        className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-2.5 py-2 text-left text-[11px] text-zinc-600 transition hover:border-zinc-400 hover:bg-white"
                                      >
                                        Suggested new item: {String(match.proposedNewItem.itemCodeSuggestion || match.proposedNewItem.description || 'Use AI proposal')}
                                      </button>
                                    ) : null}
                                    <p className="text-[11px] text-zinc-400">Confidence {formatConfidence(match?.confidence)}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-4"><button type="button" onClick={() => setDeleteLineId(detail.id)} className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid shrink-0 gap-5 border-t border-zinc-200 bg-zinc-50/60 px-10 py-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                      <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Posting Guidance</p>
                        <p className="mt-4 text-sm leading-7 text-zinc-600">Matched rows can usually stay as-is. Review and unmatched rows should be corrected using the suggestions shown in the review column before final submit.</p>
                      </div>
                      <div className="rounded-[1.5rem] border border-zinc-200 bg-white px-6 py-5">
                        <div className="flex items-center justify-between text-sm text-zinc-500"><span>Subtotal</span><span className="font-medium text-zinc-900">{draft.currencyCode || 'MYR'} {formatMoney(subtotal)}</span></div>
                        <div className="mt-3 flex items-center justify-between text-sm text-zinc-500"><span>Tax</span><span className="font-medium text-zinc-900">{draft.currencyCode || 'MYR'} {formatMoney(taxTotal)}</span></div>
                        <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-3 text-base font-semibold text-zinc-950"><span>Net Total</span><span>{draft.currencyCode || 'MYR'} {formatMoney(netTotal)}</span></div>
                      </div>
                    </div>
                </div>
              </div>
            </div>
            <DeleteConfirmModal
              isOpen={Boolean(deleteLineId)}
              onClose={() => setDeleteLineId(null)}
              onConfirm={() => {
                if (deleteLineId) {
                  removeLine(deleteLineId);
                }
              }}
              title="Delete Invoice Line"
              itemName={pendingDeleteLine?.description || pendingDeleteLine?.itemCode || `Line ${draft.details.findIndex((detail) => detail.id === deleteLineId) + 1}`}
              message="This invoice line will be removed from the draft before submit."
            />
          </section>

          <aside className="space-y-4 xl:order-1 xl:sticky xl:top-6 xl:h-fit">
            <div className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white shadow-[0_18px_40px_rgba(24,24,27,0.06)]">
              <div className="border-b border-zinc-200 bg-[linear-gradient(135deg,#fafaf9_0%,#f4f4f3_100%)] px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Review Status</p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-3xl font-semibold tracking-tight text-zinc-950">{readinessScore}%</p>
                    <p className="mt-1 text-sm text-zinc-500">Submission readiness</p>
                  </div>
                  <div className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{canSubmit ? 'Ready' : 'Needs review'}</div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200">
                  <div className="h-full rounded-full bg-zinc-900 transition-[width] duration-500" style={{ width: `${readinessScore}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-zinc-200">
                <div className="bg-white px-5 py-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Blocking</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-950">{blockingWarnings.length}</p>
                </div>
                <div className="bg-white px-5 py-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Local Checks</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-950">{localBlockingCount}</p>
                </div>
                <div className="bg-white px-5 py-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Warnings</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-950">{warnings.length}</p>
                </div>
                <div className="bg-white px-5 py-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Lines</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-950">{draft.details.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-zinc-200/80 bg-white px-5 py-5 shadow-[0_18px_40px_rgba(24,24,27,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Submit Plan</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">Create creditor</span><span className="font-semibold text-zinc-950">{willCreateCreditor ? 'Yes' : 'No'}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">Create missing items</span><span className="font-semibold text-zinc-950">{missingItemCount}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">Request ID</span><span className="max-w-[140px] truncate font-semibold text-zinc-950" title={submitRequestId ?? 'Generated on submit'}>{submitRequestId ?? 'Generated on submit'}</span></div>
              </div>
              <p className="mt-4 text-xs leading-5 text-zinc-500">Missing stock and creditor records will be included in the submit request when the final payload still has empty codes. Agent, item group, UOM, and account code still need to be valid before submit can pass.</p>
            </div>

            <div className="rounded-[2rem] border border-zinc-200/80 bg-white px-5 py-5 shadow-[0_18px_40px_rgba(24,24,27,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Warnings</p>
              {warnings.length === 0 ? (
                <div className="mt-4 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                  <div className="flex items-start gap-3"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /><div><p className="font-medium">No blocking issues found</p><p className="mt-1 text-xs leading-5 text-emerald-700/90">The preview can move forward after your review.</p></div></div>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {warnings.map((warning) => {
                    const critical = BLOCKING_WARNINGS.has(warning);
                    return <div key={warning} className={`rounded-[1.5rem] border px-4 py-4 text-sm ${critical ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}><div className="flex items-start gap-3">{critical ? <ShieldAlert size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}<div><p className="font-medium">{WARNING_COPY[warning] ?? warning}</p><p className="mt-1 text-xs leading-5 opacity-90">{critical ? 'This must be fixed before final create.' : 'Please verify this field before accepting the preview.'}</p></div></div></div>;
                  })}
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-zinc-200/80 bg-white px-5 py-5 shadow-[0_18px_40px_rgba(24,24,27,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Match Notes</p>
              <div className="mt-4 space-y-3">
                {reviewSummary.map(({ label, match, extracted }) => {
                  const [statusLabel, badgeClass] = getStatusMeta(match?.status);
                  return (
                    <div key={label} className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50/80 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-950">{label}</p>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${badgeClass}`}>{statusLabel}</span>
                      </div>
                      <div className="mt-3 space-y-3 text-sm">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Candidate</p>
                          <p className="mt-1 text-zinc-900">{formatCandidate(match) || 'No suggestion returned'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Extracted</p>
                          <p className="mt-1 text-zinc-700">{formatExtractedValue(match, extracted)}</p>
                        </div>
                      </div>
                      {match?.reason ? <p className="mt-3 text-xs leading-5 text-zinc-500">{match.reason}</p> : null}
                      {Array.isArray(match?.topCandidates) && match.topCandidates.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {match.topCandidates.slice(0, 3).map((candidate, candidateIndex) => (
                            <span key={`${label}-candidate-${candidateIndex}`} className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-600">{String(candidate.companyName || candidate.name || candidate.code || 'Candidate')}</span>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-3 text-xs text-zinc-500">Confidence {formatConfidence(match?.confidence)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {submitResult ? (
              <div className="rounded-[2rem] border border-zinc-200/80 bg-white px-5 py-5 shadow-[0_18px_40px_rgba(24,24,27,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Submit Result</p>
                <div className={`mt-4 rounded-[1.5rem] border px-4 py-4 text-sm ${getSubmitResultTone(submitResult.httpStatus, submitResult.success)}`}>
                  <p className="font-medium">{submitResult.message || (submitResult.success ? 'Purchase invoice submit completed.' : 'Purchase invoice submit needs attention.')}</p>
                  <p className="mt-1 text-xs opacity-90">Request ID: {submitResult.requestId}</p>
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">HTTP status</span><span className="font-semibold text-zinc-950">{submitResult.httpStatus}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">Stock creates</span><span className="font-semibold text-zinc-950">{submitResult.stockCreates?.filter((entry) => entry.success).length ?? 0}/{submitResult.stockCreates?.length ?? 0}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">Creditor create</span><span className="font-semibold text-zinc-950">{submitResult.creditorCreate?.success ? 'Success' : submitResult.creditorCreate ? 'Failed' : 'Skipped'}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">Purchase invoice</span><span className="font-semibold text-zinc-950">{submitResult.purchaseInvoice?.success ? 'Success' : submitResult.purchaseInvoice ? 'Failed' : 'Pending'}</span></div>
                </div>
                {submitResult.purchaseInvoice?.message ? <p className="mt-4 text-xs leading-5 text-zinc-500">{submitResult.purchaseInvoice.message}</p> : null}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
