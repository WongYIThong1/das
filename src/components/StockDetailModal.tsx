'use client';

import React, { useEffect, useState } from 'react';
import { X, LoaderCircle, AlertCircle, Package } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface StockDetailModalProps {
  isOpen: boolean;
  itemCode: string;
  onClose: () => void;
}

type StockDetail = {
  itemCode?: string;
  description?: string;
  description2?: string;
  itemGroup?: string;
  itemGroupDescription?: string;
  itemGroupShortCode?: string;
  purchaseCode?: string;
  itemType?: string;
  control?: boolean;
  taxCode?: string;
  purchaseTaxCode?: string;
  salesUOM?: string;
  purchaseUOM?: string;
  reportUOM?: string;
  baseUOM?: string;
  active?: boolean;
};

type DetailPayload = {
  stock?: StockDetail;
};

function Field({ label, value }: { label: string; value?: string | number | boolean | null }) {
  const display =
    value === undefined || value === null || value === ''
      ? '—'
      : typeof value === 'boolean'
      ? value
        ? 'Yes'
        : 'No'
      : String(value);

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      <span className="text-[13px] text-zinc-800">{display}</span>
    </div>
  );
}

export default function StockDetailModal({ isOpen, itemCode, onClose }: StockDetailModalProps) {
  const { profile, accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<StockDetail | null>(null);

  useEffect(() => {
    if (!isOpen || !itemCode || !accessToken || !profile) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);

    fetch(`/api/stock-manage/detail?itemCode=${encodeURIComponent(itemCode)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Book-Id': profile.bookId,
      },
      cache: 'no-store',
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as DetailPayload | null;
        if (cancelled) return;
        if (!res.ok) {
          setError('Failed to load item details.');
        } else {
          setData(json?.stock ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load item details.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, itemCode, accessToken, profile]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
              <Package size={16} className="text-zinc-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Stock Item Detail</p>
              <h2 className="mt-0.5 font-mono text-base font-bold text-zinc-900">{data?.description ?? itemCode}</h2>
            </div>
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
              {/* Basic Info */}
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Basic Information</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <Field label="Item Code" value={data.itemCode} />
                  <Field label="Description" value={data.description} />
                  <Field label="Description 2" value={data.description2} />
                  <Field label="Item Group" value={data.itemGroup} />
                  <Field label="Group Description" value={data.itemGroupDescription} />
                  <Field label="Group Short Code" value={data.itemGroupShortCode} />
                  <Field label="Item Type" value={data.itemType} />
                  <Field label="Purchase Code" value={data.purchaseCode} />
                </div>
              </div>

              {/* Tax & Control */}
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Tax & Control</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <Field label="Tax Code" value={data.taxCode} />
                  <Field label="Purchase Tax Code" value={data.purchaseTaxCode} />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Control</span>
                    <span
                      className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        data.control
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-zinc-200 bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {data.control ? 'Controlled' : 'Open'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Status</span>
                    <span
                      className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        data.active
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                          : 'border-zinc-200 bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {data.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* UOM */}
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Units of Measure</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  <Field label="Base UOM" value={data.baseUOM} />
                  <Field label="Sales UOM" value={data.salesUOM} />
                  <Field label="Purchase UOM" value={data.purchaseUOM} />
                  <Field label="Report UOM" value={data.reportUOM} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
