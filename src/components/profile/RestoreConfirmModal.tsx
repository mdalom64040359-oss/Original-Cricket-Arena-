import React, {useState} from 'react';
import {AlertTriangle, CheckCircle2, Download, ShieldAlert, X} from 'lucide-react';
import type {BackupValidationResult, RestoreMode} from '../../db/database';
import type {DashboardSummary} from '../../types/cricket';

interface RestoreConfirmModalProps {
  validation: BackupValidationResult;
  fileName: string;
  currentSummary: DashboardSummary;
  isRestoring: boolean;
  onExportCurrentFirst: () => Promise<void>;
  onConfirm: (mode: RestoreMode) => void;
  onCancel: () => void;
}

export const RestoreConfirmModal: React.FC<RestoreConfirmModalProps> = ({
  validation,
  fileName,
  currentSummary,
  isRestoring,
  onExportCurrentFirst,
  onConfirm,
  onCancel,
}) => {
  const [mode, setMode] = useState<RestoreMode>('replace');
  const [exportedSafetyCopy, setExportedSafetyCopy] = useState(false);

  if (!validation.valid || !validation.summary) return null;

  const s = validation.summary;
  const formattedExportDate =
    s.exportedAt !== 'Unknown date' && !Number.isNaN(Date.parse(s.exportedAt))
      ? new Date(s.exportedAt).toLocaleString()
      : s.exportedAt;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="restore-confirm-title"
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] rounded-t-2xl sm:rounded-2xl bg-[#0D130F] border border-white/15 flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10 bg-[#0A100C]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#0D3B24] border border-[#22C55E]/30 flex items-center justify-center text-[#4ADE80] shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="restore-confirm-title"
                className="font-display text-base sm:text-lg font-bold text-white truncate"
              >
                Confirm Backup Restore
              </h2>
              <p className="text-xs text-[#9CB0A4] truncate">{fileName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isRestoring}
            aria-label="Cancel restore"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#9CB0A4] hover:text-white hover:bg-white/5 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Backup metadata */}
          <div className="rounded-xl bg-[#101612] border border-white/10 p-3.5 space-y-2 text-xs">
            <div className="flex justify-between gap-2 text-[#9CB0A4]">
              <span>Backup Version</span>
              <span className="font-mono text-white">
                v{s.backupFormatVersion} (DB v{s.schemaVersion})
              </span>
            </div>
            <div className="flex justify-between gap-2 text-[#9CB0A4]">
              <span>Exported</span>
              <span className="font-mono text-white text-right">{formattedExportDate}</span>
            </div>
          </div>

          {/* Comparison Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-[#101612] border border-[#22C55E]/30 p-3 space-y-1.5">
              <div className="font-semibold text-[#4ADE80]">Inside Backup</div>
              <div className="space-y-0.5 font-mono tabular-nums text-[#D7E4DC]">
                <div className="flex justify-between">
                  <span className="font-sans text-[#8FA397]">Teams</span>
                  <span>{s.teamsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[#8FA397]">Players</span>
                  <span>{s.playersCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[#8FA397]">Matches</span>
                  <span>{s.matchesCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[#8FA397]">Ball Events</span>
                  <span>{s.ballEventsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[#8FA397]">Tournaments</span>
                  <span>{s.tournamentsCount}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[#101612] border border-white/10 p-3 space-y-1.5">
              <div className="font-semibold text-white">On This Device</div>
              <div className="space-y-0.5 font-mono tabular-nums text-[#D7E4DC]">
                <div className="flex justify-between">
                  <span className="font-sans text-[#8FA397]">Teams</span>
                  <span>{currentSummary.teamsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[#8FA397]">Players</span>
                  <span>{currentSummary.playersCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[#8FA397]">Matches</span>
                  <span>{currentSummary.matchesCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[#8FA397]">Tournaments</span>
                  <span>{currentSummary.tournamentsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[#8FA397]">Total</span>
                  <span>{currentSummary.totalRecords}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Warnings if any */}
          {validation.warnings.length > 0 && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 space-y-1 text-xs text-amber-200">
              {validation.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Restore Mode Choice */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#9AC2AA]">
              Restore Method
            </div>

            <label
              className={`block rounded-xl border p-3.5 cursor-pointer transition-colors ${
                mode === 'replace'
                  ? 'bg-[#19110D] border-amber-500/50'
                  : 'bg-[#101612] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="restore-mode"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                  className="mt-1 accent-[#16A34A]"
                />
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-white">
                    Replace Existing Data
                  </div>
                  <p className="text-xs text-[#9CB0A4]">
                    Clears current device teams, players, matches, and tournaments, then restores
                    exactly what is in this backup.
                  </p>
                </div>
              </div>
            </label>

            <label
              className={`block rounded-xl border p-3.5 cursor-pointer transition-colors ${
                mode === 'merge'
                  ? 'bg-[#0D2116] border-[#22C55E]'
                  : 'bg-[#101612] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="restore-mode"
                  checked={mode === 'merge'}
                  onChange={() => setMode('merge')}
                  className="mt-1 accent-[#16A34A]"
                />
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-white">
                    Merge With Existing Data
                  </div>
                  <p className="text-xs text-[#9CB0A4]">
                    Keeps your current device records, adds missing items from the backup, and
                    updates matching IDs.
                  </p>
                </div>
              </div>
            </label>
          </div>

          {/* Safety warning + Download current copy */}
          {mode === 'replace' && currentSummary.totalRecords > 0 && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 space-y-2.5">
              <div className="flex items-start gap-2 text-xs text-rose-200">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>
                  Replacing will overwrite your {currentSummary.totalRecords} existing local
                  records on this device. This cannot be undone.
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onExportCurrentFirst();
                  setExportedSafetyCopy(true);
                }}
                className="w-full min-h-[40px] rounded-lg bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 px-3 py-2 text-xs font-semibold text-white inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#4ADE80]" />
                <span>
                  {exportedSafetyCopy
                    ? 'Current Backup Downloaded'
                    : 'Download Current Data First'}
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-white/10 bg-[#0A100C] flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isRestoring}
            className="w-full sm:w-auto min-h-[44px] rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(mode)}
            disabled={isRestoring}
            className={`w-full sm:w-auto min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors ${
              mode === 'replace'
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-[#16A34A] hover:bg-[#15803D]'
            }`}
          >
            {isRestoring
              ? 'Restoring...'
              : mode === 'replace'
                ? 'Confirm Replace & Restore'
                : 'Confirm Merge Restore'}
          </button>
        </div>
      </div>
    </div>
  );
};
