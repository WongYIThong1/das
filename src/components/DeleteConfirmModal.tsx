import { X, AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  itemName?: string;
  message?: string;
}

export default function DeleteConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  title = 'Delete',
  itemName,
  message = 'You will need to recreate this item if you want to use it again.'
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="text-xl font-bold text-zinc-900">{title}</h2>
          <button 
            onClick={onClose} 
            className="text-zinc-400 hover:text-zinc-600 transition-colors p-1 hover:bg-zinc-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="px-5 py-6">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
            <div className="flex-1 pt-0.5">
              <h3 className="text-lg font-semibold text-zinc-900 mb-1.5">
                Are you sure you want to delete?
              </h3>
              {itemName && (
                <p className="text-sm font-medium text-zinc-700 mb-2">
                  {itemName}
                </p>
              )}
              <p className="text-sm text-zinc-500 leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 bg-zinc-50 border-t border-zinc-100 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all shadow-sm flex items-center gap-2"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
