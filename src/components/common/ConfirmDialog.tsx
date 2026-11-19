import React from 'react';
import {AlertTriangle, X} from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDanger = true,
  isBusy = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#101713] border border-white/15 p-5 sm:p-6 text-white shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isDanger
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : 'bg-[#0D3B24] text-[#4ADE80] border border-[#22C55E]/30'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 id="confirm-dialog-title" className="font-display text-lg font-bold text-white">
                {title}
              </h2>
              <p className="mt-1 text-sm text-[#B8C7BE] leading-relaxed">{description}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="min-h-[44px] min-w-[44px] -mt-2 -mr-2 flex items-center justify-center rounded-xl text-[#8FA397] hover:text-white hover:bg-white/5"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 text-sm font-semibold text-white transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className={`w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700 disabled:opacity-60'
                : 'bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60'
            }`}
          >
            {isBusy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
