'use client';

import React, { useEffect, useState } from 'react';
import { X, LoaderCircle, AlertCircle } from 'lucide-react';
import { authFetch } from '../lib/auth-fetch';

interface InvoiceDetailModalProps {
  isOpen: boolean;
  docKey: string;
  onClose: () => void;
}

type InvoiceHeader = {
  invoiceNo?: string;
  supplierInvoiceNo?: string;
  supplier?: string;
  agent?: string;
  currency?: string;
  date?: string;
  grandTotal?: number | string;
  amount?: number | string;
};

type InvoiceDetail = {
  itemCode?: string;
  description?: string;
  uom?: string;
  qty?: number | string;
  unitPrice?: number | string;
  amount?: number | string;
  taxCode?: string;
  accNo?: string;
};

type DetailPayload = {
  header?: InvoiceHeader;
  details?: InvoiceDetail[];
};

function formatMoney(value: number | string | undefined) {
  if (value === undefined || value === null || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      <span className="text-[13px] text-zinc-800">{value ?? '—'}</span>
    </div>
  );
}

export default function InvoiceDetailModal({ isOpen, docKey, onClose }: InvoiceDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<DetailPayload | null>(null);

  useEffect(() => {
    if (!isOpen || !docKey) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);

    authFetch(`/api/purchase-invoice/detail?docKey=${encodeURIComponent(docKey)}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as DetailPayload | null;
        if (cancelled) return;
        if (!res.ok) {
          setError('Failed to load invoice details.');
        } else {
          setData(json);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load invoice details.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, docKey]);

  if (!isOpen) return null;

  const header = data?.header ?? {};
  const details = data?.details ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-zinc-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Purchase Invoice</p>
            <h2 className="mt-0.5 text-base font-bold text-zinc-900">
              {header.invoiceNo ?? docKey}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex items-center justify-center py-16 text-zinc-400">
              <LoaderCircle size={22} className="animate-spin" />
              <span className="ml-2 text-sm">Loading…</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-6">
              {/* Header card */}
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Invoice Details</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  <Field label="Invoice No" value={header.invoiceNo} />
                  <Field label="Supplier Invoice No" value={header.supplierInvoiceNo} />
                  <Field label="Supplier" value={header.supplier} />
                  <Field label="Agent" value={header.agent} />
                  <Field label="Currency" value={header.currency} />
                  <Field label="Date" value={header.date} />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Grand Total</span>
                    <span className="text-[14px] font-bold text-emerald-600">{formatMoney(header.grandTotal)}</span>
                  </div>
                  <Field label="Amount" value={formatMoney(header.amount)} />
                </div>
              </div>

              {/* Line items */}
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Line Items</p>
                {details.length === 0 ? (
                  <p className="py-4 text-center text-sm text-zinc-400">No line items.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-zinc-100">
                    <table className="w-full table-fixed text-[12px]">
                      <thead>
                        <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                          <th className="w-24 px-3 py-2 font-semibold text-zinc-500">Item Code</th>
                          <th className="px-3 py-2 font-semibold text-zinc-500">Description</th>
                          <th className="w-16 px-3 py-2 font-semibold text-zinc-500">UOM</th>
                          <th className="w-16 px-3 py-2 text-right font-semibold text-zinc-500">Qty</th>
                          <th className="w-24 px-3 py-2 text-right font-semibold text-zinc-500">Unit Price</th>
                          <th className="w-24 px-3 py-2 text-right font-semibold text-zinc-500">Amount</th>
                          <th className="w-20 px-3 py-2 font-semibold text-zinc-500">Tax Code</th>
                          <th className="w-24 px-3 py-2 font-semibold text-zinc-500">Acc No</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.map((row, i) => (
                          <tr key={i} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                            <td className="px-3 py-2 font-mono text-zinc-700">{row.itemCode ?? '—'}</td>
                            <td className="px-3 py-2 text-zinc-700">{row.description ?? '—'}</td>
                            <td className="px-3 py-2 text-zinc-500">{row.uom ?? '—'}</td>
                            <td className="px-3 py-2 text-right text-zinc-700">{row.qty ?? '—'}</td>
                            <td className="px-3 py-2 text-right text-zinc-700">{formatMoney(row.unitPrice)}</td>
                            <td className="px-3 py-2 text-right text-zinc-700">{formatMoney(row.amount)}</td>
                            <td className="px-3 py-2 text-zinc-500">{row.taxCode ?? '—'}</td>
                            <td className="px-3 py-2 font-mono text-zinc-500">{row.accNo ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
