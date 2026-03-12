'use client';

import React, { useState } from 'react';
import { ArrowLeft, Save, Package, Hash, FileText, Layers, Tag, Scale, Calculator, ShieldAlert, CheckCircle2, Activity, Truck, CircleDollarSign } from 'lucide-react';

interface StockFormProps {
  initialData?: any;
  onBack: () => void;
}

export function StockForm({ initialData, onBack }: StockFormProps) {
  const isEditing = !!initialData;
  
  // State for checkboxes
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [isSalesItem, setIsSalesItem] = useState(initialData?.isSalesItem ?? true);
  const [isPurchaseItem, setIsPurchaseItem] = useState(initialData?.isPurchaseItem ?? true);
  const [isPosItem, setIsPosItem] = useState(initialData?.isPosItem ?? false);
  const [hasSerialNo, setHasSerialNo] = useState(initialData?.hasSerialNo ?? false);
  const [hasBatchNo, setHasBatchNo] = useState(initialData?.hasBatchNo ?? false);

  const CheckboxField = ({ label, description, checked, onChange }: any) => (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative flex items-center justify-center mt-0.5">
        <input 
          type="checkbox" 
          className="sr-only" 
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className={`w-5 h-5 rounded border transition-colors flex items-center justify-center ${
          checked ? 'bg-blue-600 border-blue-600' : 'bg-white border-zinc-300 group-hover:border-blue-400'
        }`}>
          <CheckCircle2 size={14} className={`text-white transform transition-transform ${checked ? 'scale-100' : 'scale-0'}`} />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-900">{label}</p>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
    </label>
  );

  return (
    <div className="flex flex-col h-full bg-zinc-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-zinc-100 rounded-md transition-colors text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              {isEditing ? 'Edit Stock Item' : 'Add New Stock Item'}
              {isEditing && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                  {initialData.itemCode}
                </span>
              )}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isEditing ? 'Update inventory item details and settings.' : 'Create a new inventory item in the system.'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors shadow-sm">
            <Save size={16} />
            {isEditing ? 'Save Changes' : 'Create Item'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Basic Information */}
          <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50">
              <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <Package size={16} className="text-zinc-400" />
                Basic Information
              </h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1">
                  Item Code <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type="text" 
                    defaultValue={initialData?.itemCode || ''}
                    placeholder="e.g., ITM-0001"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type="text" 
                    defaultValue={initialData?.description || ''}
                    placeholder="Main item description"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-zinc-700">Description 2 (Optional)</label>
                <div className="relative">
                  <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type="text" 
                    defaultValue={initialData?.desc2 || ''}
                    placeholder="Secondary description or foreign language"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-zinc-700">Further Description</label>
                <textarea 
                  defaultValue={initialData?.furtherDescription || ''}
                  placeholder="Detailed specifications or notes..."
                  rows={3}
                  className="w-full p-3 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                />
              </div>
            </div>
          </section>

          {/* Classification & Control */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50">
                <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Layers size={16} className="text-zinc-400" />
                  Classification
                </h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Item Group</label>
                  <select 
                    defaultValue={initialData?.itemGroup || 'DEFAULT'}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  >
                    <option value="DEFAULT">Default Group</option>
                    <option value="RAW_MATERIALS">Raw Materials</option>
                    <option value="FINISHED_GOODS">Finished Goods</option>
                    <option value="CONSUMABLES">Consumables</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Item Type</label>
                  <select 
                    defaultValue={initialData?.itemType || 'INVENTORY'}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  >
                    <option value="INVENTORY">Inventory Item</option>
                    <option value="NON_INVENTORY">Non-Inventory Item</option>
                    <option value="SERVICE">Service</option>
                    <option value="ASSEMBLY">Assembly</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Stock Control</label>
                  <select 
                    defaultValue={initialData?.stockControl || 'FIFO'}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  >
                    <option value="FIFO">FIFO (First In First Out)</option>
                    <option value="LIFO">LIFO (Last In First Out)</option>
                    <option value="WEIGHTED_AVERAGE">Weighted Average</option>
                    <option value="STANDARD_COST">Standard Cost</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50">
                <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Scale size={16} className="text-zinc-400" />
                  Units of Measurement (UOM)
                </h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Base UOM</label>
                  <input 
                    type="text" 
                    defaultValue={initialData?.baseUom || 'PCS'}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Sales UOM</label>
                  <input 
                    type="text" 
                    defaultValue={initialData?.salesUom || 'PCS'}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700">Purchase UOM</label>
                    <input 
                      type="text" 
                      defaultValue={initialData?.purchaseUom || 'BOX'}
                      className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700">Report UOM</label>
                    <input 
                      type="text" 
                      defaultValue={initialData?.reportUom || 'PCS'}
                      className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Financials & Tracking */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50">
                <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Calculator size={16} className="text-zinc-400" />
                  Financial & Supplier
                </h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700">Sales Tax Code</label>
                    <select 
                      defaultValue={initialData?.taxCode || 'SR'}
                      className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="SR">SR (Standard Rate)</option>
                      <option value="ZR">ZR (Zero Rate)</option>
                      <option value="EX">EX (Exempt)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700">Purchase Tax Code</label>
                    <select 
                      defaultValue={initialData?.purchaseTaxCode || 'TX'}
                      className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="TX">TX (Standard Purchase)</option>
                      <option value="ZP">ZP (Zero Purchase)</option>
                      <option value="EP">EP (Exempt Purchase)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Main Supplier</label>
                  <div className="relative">
                    <Truck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <select 
                      defaultValue={initialData?.mainSupplier || ''}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="">Select Supplier...</option>
                      <option value="C-0001">Acme Supplies Ltd (C-0001)</option>
                      <option value="C-0002">Global Tech Solutions (C-0002)</option>
                      <option value="C-0003">Office Depot Inc. (C-0003)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Assembly Cost</label>
                  <div className="relative">
                    <CircleDollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input 
                      type="number" 
                      step="0.01"
                      defaultValue={initialData?.assemblyCost || '0.00'}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50">
                <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <ShieldAlert size={16} className="text-zinc-400" />
                  Tracking & Status
                </h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tracking</h3>
                  <CheckboxField 
                    label="Has Serial Number" 
                    description="Require serial number tracking for this item"
                    checked={hasSerialNo} 
                    onChange={setHasSerialNo} 
                  />
                  <CheckboxField 
                    label="Has Batch Number" 
                    description="Require batch/lot tracking for this item"
                    checked={hasBatchNo} 
                    onChange={setHasBatchNo} 
                  />
                </div>

                <div className="pt-4 border-t border-zinc-100 space-y-4">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Status Flags</h3>
                  <CheckboxField 
                    label="Active Item" 
                    checked={isActive} 
                    onChange={setIsActive} 
                  />
                  <CheckboxField 
                    label="Is Sales Item" 
                    checked={isSalesItem} 
                    onChange={setIsSalesItem} 
                  />
                  <CheckboxField 
                    label="Is Purchase Item" 
                    checked={isPurchaseItem} 
                    onChange={setIsPurchaseItem} 
                  />
                  <CheckboxField 
                    label="Is POS Item" 
                    checked={isPosItem} 
                    onChange={setIsPosItem} 
                  />
                </div>
              </div>
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}
