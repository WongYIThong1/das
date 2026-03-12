'use client';

import React, { useState } from 'react';
import { ArrowLeft, Save, Building2, Hash, Coins, Phone, MapPin, User, FileText, CheckCircle2, Activity } from 'lucide-react';

interface CreditorFormProps {
  initialData?: any;
  onBack: () => void;
}

export function CreditorForm({ initialData, onBack }: CreditorFormProps) {
  const isEditing = !!initialData;
  const [isActive, setIsActive] = useState(initialData?.active ?? true);

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
              {isEditing ? 'Edit Creditor' : 'Add New Creditor'}
              {isEditing && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                  {initialData.code}
                </span>
              )}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isEditing ? 'Update creditor information and settings.' : 'Create a new creditor profile in the system.'}
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
            {isEditing ? 'Save Changes' : 'Create Creditor'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          
          {/* Basic Information */}
          <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50">
              <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <Building2 size={16} className="text-zinc-400" />
                Basic Information
              </h2>
            </div>
            <div className="p-6 grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1">
                  Supplier Code <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type="text" 
                    defaultValue={initialData?.code || ''}
                    placeholder="e.g., C-0001"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type="text" 
                    defaultValue={initialData?.companyName || ''}
                    placeholder="e.g., Acme Supplies Ltd"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Additional Details */}
          <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50">
              <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <FileText size={16} className="text-zinc-400" />
                Additional Details
              </h2>
            </div>
            <div className="p-6 grid grid-cols-2 gap-6">
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Currency Code</label>
                <div className="relative">
                  <Coins size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <select 
                    defaultValue={initialData?.currency || 'USD'}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="CNY">CNY - Chinese Yuan</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                    <option value="MYR">MYR - Malaysian Ringgit</option>
                    <option value="SGD">SGD - Singapore Dollar</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Creditor Type</label>
                <select 
                  defaultValue={initialData?.creditorType || 'LOCAL'}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="LOCAL">Local Supplier</option>
                  <option value="OVERSEAS">Overseas Supplier</option>
                  <option value="CONTRACTOR">Contractor</option>
                  <option value="SERVICE">Service Provider</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Phone (Phon1)</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type="text" 
                    defaultValue={initialData?.phone || ''}
                    placeholder="+1 (555) 000-0000"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Area Code</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <select 
                    defaultValue={initialData?.area || 'NA'}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                  >
                    <option value="NA">North America (NA)</option>
                    <option value="EU">Europe (EU)</option>
                    <option value="AS">Asia (AS)</option>
                    <option value="SA">South America (SA)</option>
                    <option value="AF">Africa (AF)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Agent</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <select 
                    defaultValue={initialData?.agent || 'UNASSIGNED'}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                  >
                    <option value="UNASSIGNED">Unassigned</option>
                    <option value="A001">John Doe (A001)</option>
                    <option value="A002">Jane Smith (A002)</option>
                    <option value="A003">Mike Brown (A003)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Template Code</label>
                <select 
                  defaultValue={initialData?.templateCode || 'DEFAULT'}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="DEFAULT">Default Template</option>
                  <option value="TPL-01">Standard Goods (TPL-01)</option>
                  <option value="TPL-02">Services (TPL-02)</option>
                  <option value="TPL-03">Overseas Import (TPL-03)</option>
                </select>
              </div>

            </div>
          </section>

          {/* Status Settings */}
          <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50">
              <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <Activity size={16} className="text-zinc-400" />
                Status Settings
              </h2>
            </div>
            <div className="p-6">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <div className={`w-5 h-5 rounded border transition-colors flex items-center justify-center ${
                    isActive ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-zinc-300 group-hover:border-emerald-400'
                  }`}>
                    <CheckCircle2 size={14} className={`text-white transform transition-transform ${isActive ? 'scale-100' : 'scale-0'}`} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900">Active Creditor</p>
                  <p className="text-xs text-zinc-500 mt-0.5">When active, this creditor will be available for selection in purchase invoices and other transactions.</p>
                </div>
              </label>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
