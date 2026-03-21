'use client';

import React from 'react';
import { X, Layers } from 'lucide-react';

export type StockGroupListItem = {
  itemGroup: string;
  description: string;
  shortCode: string;
  purchaseCode: string;
  itemCount: number;
  generatedItemCode: string;
};

interface StockGroupDetailModalProps {
  isOpen: boolean;
  item: StockGroupListItem | null;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      <span className="text-[13px] text-zinc-800">{value === undefined || value === null || value === '' ? '—' : String(value)}</span>
    </div>
  );
}

export default function StockGroupDetailModal({ isOpen, item, onClose }: StockGroupDetailModalProps) {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-zinc-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
              <Layers size={16} className="text-zinc-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Stock Group Detail</p>
              <h2 className="mt-0.5 text-base font-bold text-zinc-900">{item.description || item.itemGroup}</h2>
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
        <div className="overflow-y-auto px-6 py-5">
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Group Information</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Item Group" value={item.itemGroup} />
              <Field label="Short Code" value={item.shortCode} />
              <Field label="Description" value={item.description} />
              <Field label="Purchase Code" value={item.purchaseCode} />
              <Field label="Item Count" value={item.itemCount} />
              <Field label="Generated Item Code" value={item.generatedItemCode} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
