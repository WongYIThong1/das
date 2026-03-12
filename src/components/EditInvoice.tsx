'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  MapPin, 
  FileText, 
  User, 
  Save, 
  Plus,
  Trash2,
  ChevronDown,
  Check,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Invoice {
  id: string;
  docNo: string;
  creditorName: string;
  purchaseAgent: string;
  currency: string;
  docDate: string;
  amount: number;
  netTotal: number;
  supplierInvoice: string;
}

interface EditInvoiceProps {
  invoice: Invoice;
  onBack: () => void;
}

export function EditInvoice({ invoice, onBack }: EditInvoiceProps) {
  const [isSupplierOpen, setIsSupplierOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('S-1042');
  const supplierRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (supplierRef.current && !supplierRef.current.contains(event.target as Node)) {
        setIsSupplierOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const suppliers = [
    { code: 'S-1042', name: 'Acme Supplies Ltd' },
    { code: 'S-2055', name: 'Global Tech Solutions' },
    { code: 'S-3091', name: 'Office Depot Inc.' },
    { code: 'S-4012', name: 'Logistics Pro' }
  ];

  // Generate mock items based on the invoice netTotal to make it look realistic
  const [lineItems, setLineItems] = useState(
    Array.from({ length: 5 }).map((_, i) => ({
      id: i + 1,
      item: i === 0 ? 'Office Supplies' : i === 1 ? 'Printer Ink' : `Standard Item ${i + 1}`,
      qty: i === 0 ? 2 : 1,
      price: (invoice.netTotal / 6), // Just a mock calculation to make totals somewhat match
      tax: 'TX1',
      account: '6000'
    }))
  );

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + (item.qty * item.price), 0);
  const tax = subtotal * 0.1; // 10% mock tax
  const total = subtotal + tax;

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
              Edit Invoice {invoice.docNo}
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                Draft
              </span>
            </h1>
            <div className="flex items-center gap-4 text-xs text-zinc-500 mt-1">
              <span className="flex items-center gap-1 font-mono">
                <FileText size={12} />
                Original ID: {invoice.id}
              </span>
            </div>
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
            Save Changes
          </button>
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex-1 overflow-hidden flex">
        
        {/* Left Panel - AI Context & Validation (Read Only) */}
        <div className="w-[400px] bg-zinc-50 border-r border-zinc-200 flex flex-col overflow-y-auto shrink-0">
          <div className="p-6 space-y-6">
            
            {/* Original Document Context */}
            <section>
              <h2 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Original Document Context
              </h2>
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="p-4 space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                      <Building2 size={12} /> Company Name
                    </label>
                    <p className="text-sm font-medium text-zinc-900">{invoice.creditorName}</p>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                      <MapPin size={12} /> Address
                    </label>
                    <p className="text-sm text-zinc-700 leading-relaxed">
                      123 Business Park Drive<br/>
                      Suite 400<br/>
                      Tech City, TC 90210
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                        <FileText size={12} /> Invoice No
                      </label>
                      <p className="text-sm font-mono text-zinc-900">{invoice.supplierInvoice}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                        <User size={12} /> Purchaser
                      </label>
                      <p className="text-sm text-zinc-900">{invoice.purchaseAgent}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Attached Document */}
            <section>
              <h2 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Source Document
              </h2>
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 flex items-center justify-between group cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">inv_{invoice.supplierInvoice.toLowerCase()}.pdf</p>
                    <p className="text-xs text-zinc-500">2.4 MB • PDF Document</p>
                  </div>
                </div>
                <button className="text-zinc-400 group-hover:text-indigo-600 transition-colors shrink-0 ml-2">
                  <Eye size={18} />
                </button>
              </div>
            </section>

            {/* Audit Trail / History */}
            <section>
              <h2 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                Activity History
              </h2>
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
                <div className="relative border-l-2 border-zinc-100 ml-2 space-y-6">
                  
                  <div className="relative pl-5">
                    <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-white border-2 border-orange-500"></div>
                    <p className="text-xs text-zinc-500 mb-0.5">Just now</p>
                    <p className="text-sm font-medium text-zinc-900">Opened for editing</p>
                    <p className="text-xs text-zinc-600 mt-1">By Current User</p>
                  </div>

                  <div className="relative pl-5">
                    <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-white border-2 border-zinc-300"></div>
                    <p className="text-xs text-zinc-500 mb-0.5">Yesterday, 14:20 PM</p>
                    <p className="text-sm font-medium text-zinc-900">AI Extraction Completed</p>
                    <p className="text-xs text-zinc-600 mt-1">System auto-processed via email</p>
                  </div>

                  <div className="relative pl-5">
                    <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-white border-2 border-emerald-500"></div>
                    <p className="text-xs text-zinc-500 mb-0.5">Yesterday, 14:18 PM</p>
                    <p className="text-sm font-medium text-zinc-900">Document Received</p>
                    <p className="text-xs text-zinc-600 mt-1">From: billing@supplier.com</p>
                  </div>

                </div>
              </div>
            </section>

          </div>
        </div>

        {/* Right Panel - Editable Draft */}
        <div className="flex-1 bg-white flex flex-col overflow-hidden">
          <div className="p-6 lg:p-8 max-w-5xl mx-auto w-full flex flex-col h-full">
            
            {/* Form Header & Fields (shrink-0) */}
            <div className="shrink-0 space-y-6 mb-6">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 mb-1">Invoice Details</h2>
                <p className="text-sm text-zinc-500">Review and edit the invoice information.</p>
              </div>

              {/* Main Form Fields */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5" ref={supplierRef}>
                  <label className="text-xs font-semibold text-zinc-700">Supplier Code</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsSupplierOpen(!isSupplierOpen)}
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-sm text-left flex items-center justify-between transition-all font-mono ${
                        isSupplierOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-zinc-300 hover:border-zinc-400'
                      }`}
                    >
                      <span className="truncate">
                        <span className="font-semibold text-zinc-900">{selectedSupplier}</span>
                        <span className="text-zinc-500 ml-2 font-sans">{suppliers.find(s => s.code === selectedSupplier)?.name}</span>
                      </span>
                      <ChevronDown size={14} className={`text-zinc-400 transition-transform duration-200 ${isSupplierOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isSupplierOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -5, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -5, scale: 0.98 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className="absolute z-30 w-full mt-1.5 bg-white border border-zinc-200 rounded-lg shadow-lg overflow-hidden origin-top"
                        >
                          <div className="max-h-60 overflow-y-auto py-1">
                            {suppliers.map((supplier) => (
                              <button
                                key={supplier.code}
                                type="button"
                                onClick={() => {
                                  setSelectedSupplier(supplier.code);
                                  setIsSupplierOpen(false);
                                }}
                                className="w-full px-3 py-2.5 text-left text-sm flex items-center justify-between hover:bg-zinc-50 transition-colors"
                              >
                                <span className="font-mono truncate">
                                  <span className={`font-semibold ${selectedSupplier === supplier.code ? 'text-blue-600' : 'text-zinc-900'}`}>{supplier.code}</span>
                                  <span className={`ml-2 font-sans ${selectedSupplier === supplier.code ? 'text-blue-500/80' : 'text-zinc-500'}`}>{supplier.name}</span>
                                </span>
                                {selectedSupplier === supplier.code && (
                                  <Check size={14} className="text-blue-600 shrink-0 ml-2" />
                                )}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Supplier Invoice No</label>
                  <input 
                    type="text" 
                    defaultValue={invoice.supplierInvoice}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Purchaser</label>
                  <input 
                    type="text" 
                    defaultValue={invoice.purchaseAgent}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Remarks</label>
                  <input 
                    type="text" 
                    placeholder="Add any internal notes..."
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Line Items Section (flex-1 min-h-0 flex flex-col) */}
            <div className="flex-1 min-h-0 flex flex-col border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm">
              
              {/* Table Header Actions */}
              <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between shrink-0">
                <h2 className="text-sm font-bold text-zinc-900">Line Items <span className="text-zinc-500 font-normal ml-1">({lineItems.length})</span></h2>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-white border border-zinc-200 rounded-md hover:bg-blue-50 hover:border-blue-200 transition-colors shadow-sm">
                  <Plus size={14} /> Add Line
                </button>
              </div>

              {/* Scrollable Table Body */}
              <div className="flex-1 overflow-y-auto relative">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-zinc-50 sticky top-0 z-10 shadow-sm ring-1 ring-zinc-200">
                    <tr>
                      <th className="px-4 py-2 font-semibold text-zinc-600 w-12 text-center">#</th>
                      <th className="px-4 py-2 font-semibold text-zinc-600 min-w-[200px]">Item Description</th>
                      <th className="px-4 py-2 font-semibold text-zinc-600 w-24">Qty</th>
                      <th className="px-4 py-2 font-semibold text-zinc-600 w-32">Unit Price</th>
                      <th className="px-4 py-2 font-semibold text-zinc-600 w-24">Tax Code</th>
                      <th className="px-4 py-2 font-semibold text-zinc-600 w-32">Account</th>
                      <th className="px-4 py-2 font-semibold text-zinc-600 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {lineItems.map((item, index) => (
                      <tr key={item.id} className="group hover:bg-zinc-50/80 transition-colors">
                        <td className="px-4 py-1.5 text-xs text-zinc-400 text-center font-mono">{index + 1}</td>
                        <td className="p-1.5">
                          <input type="text" defaultValue={item.item} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-300 focus:border-blue-500 focus:bg-white rounded transition-all outline-none" />
                        </td>
                        <td className="p-1.5">
                          <input type="number" defaultValue={item.qty} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-300 focus:border-blue-500 focus:bg-white rounded transition-all outline-none tabular-nums" />
                        </td>
                        <td className="p-1.5">
                          <input type="number" defaultValue={item.price.toFixed(2)} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-300 focus:border-blue-500 focus:bg-white rounded transition-all outline-none tabular-nums" />
                        </td>
                        <td className="p-1.5">
                          <input type="text" defaultValue={item.tax} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-300 focus:border-blue-500 focus:bg-white rounded transition-all outline-none uppercase" />
                        </td>
                        <td className="p-1.5">
                          <input type="text" defaultValue={item.account} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-zinc-300 focus:border-blue-500 focus:bg-white rounded transition-all outline-none font-mono" />
                        </td>
                        <td className="p-1.5 text-center">
                          <button className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Totals Footer (shrink-0) */}
              <div className="bg-zinc-50 border-t border-zinc-200 p-4 shrink-0 flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>Subtotal</span>
                    <span className="tabular-nums font-medium">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>Tax (10%)</span>
                    <span className="tabular-nums font-medium">${tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-zinc-900 pt-2 border-t border-zinc-200">
                    <span>Total</span>
                    <span className="tabular-nums">${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
