'use client';

import React, { useEffect, useState } from 'react';
import { X, LoaderCircle, AlertCircle, Building2 } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface CreditorDetailModalProps {
  isOpen: boolean;
  code: string;
  onClose: () => void;
}

type CreditorDetail = {
  code?: string;
  companyName?: string;
  desc2?: string;
  taxCode?: string;
  displayTerm?: string;
  purchaseAgent?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  address4?: string;
  postCode?: string;
  deliverAddr1?: string;
  deliverAddr2?: string;
  deliverAddr3?: string;
  deliverAddr4?: string;
  deliverPostCode?: string;
  attention?: string;
  phone1?: string;
  phone2?: string;
  fax1?: string;
  fax2?: string;
  areaCode?: string;
  creditorType?: string;
  currencyCode?: string;
  currencyRate?: number;
  discountPercent?: number;
  active?: boolean;
};

type DetailPayload = {
  creditor?: CreditorDetail;
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">{children}</p>
  );
}

export default function CreditorDetailModal({ isOpen, code, onClose }: CreditorDetailModalProps) {
  const { profile, accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<CreditorDetail | null>(null);

  useEffect(() => {
    if (!isOpen || !code || !accessToken || !profile) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);

    fetch(`/api/creditor/detail?code=${encodeURIComponent(code)}`, {
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
          setError('Failed to load creditor details.');
        } else {
          setData(json?.creditor ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load creditor details.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, code, accessToken, profile]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-zinc-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <Building2 size={16} className="text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Creditor Detail</p>
              <h2 className="mt-0.5 text-base font-bold text-zinc-900">{data?.companyName ?? code}</h2>
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
                <SectionLabel>Basic Information</SectionLabel>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <Field label="Code" value={data.code} />
                  <Field label="Company Name" value={data.companyName} />
                  <Field label="Description 2" value={data.desc2} />
                  <Field label="Creditor Type" value={data.creditorType} />
                  <Field label="Currency" value={data.currencyCode} />
                  <Field label="Currency Rate" value={data.currencyRate} />
                  <Field label="Tax Code" value={data.taxCode} />
                  <Field label="Payment Term" value={data.displayTerm} />
                  <Field label="Purchase Agent" value={data.purchaseAgent} />
                  <Field label="Discount %" value={data.discountPercent} />
                  <Field label="Area Code" value={data.areaCode} />
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

              {/* Contact */}
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                <SectionLabel>Contact</SectionLabel>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <Field label="Phone 1" value={data.phone1} />
                  <Field label="Phone 2" value={data.phone2} />
                  <Field label="Fax 1" value={data.fax1} />
                  <Field label="Fax 2" value={data.fax2} />
                  <Field label="Attention" value={data.attention} />
                </div>
              </div>

              {/* Address */}
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                <SectionLabel>Address</SectionLabel>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Billing Address</span>
                    <span className="text-[13px] leading-5 text-zinc-800">
                      {[data.address1, data.address2, data.address3, data.address4].filter(Boolean).join(', ') || '—'}
                      {data.postCode ? ` ${data.postCode}` : ''}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Delivery Address</span>
                    <span className="text-[13px] leading-5 text-zinc-800">
                      {[data.deliverAddr1, data.deliverAddr2, data.deliverAddr3, data.deliverAddr4].filter(Boolean).join(', ') || '—'}
                      {data.deliverPostCode ? ` ${data.deliverPostCode}` : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
