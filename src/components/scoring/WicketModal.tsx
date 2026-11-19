import React, {useEffect, useState} from 'react';
import {AlertCircle, X} from 'lucide-react';
import type {ExtraType, Player, WicketType} from '../../types/cricket';

interface WicketModalProps {
  isOpen: boolean;
  isFreeHit: boolean;
  striker?: Player;
  nonStriker?: Player;
  availableNextBatters: Player[];
  fieldingPlayers?: Player[];
  onConfirm: (payload: {
    wicketType: WicketType;
    dismissedPlayerId: string;
    incomingBatterId?: string;
    fielderId?: string;
    runsOffBat: number;
    extraType?: ExtraType;
    extras: number;
  }) => Promise<void>;
  onClose: () => void;
}

const ALL_WICKET_TYPES: Array<{value: WicketType; label: string}> = [
  {value: 'bowled', label: 'Bowled'},
  {value: 'caught', label: 'Caught'},
  {value: 'lbw', label: 'LBW'},
  {value: 'run-out', label: 'Run Out'},
  {value: 'stumped', label: 'Stumped'},
  {value: 'hit-wicket', label: 'Hit Wicket'},
];

export const WicketModal: React.FC<WicketModalProps> = ({
  isOpen,
  isFreeHit,
  striker,
  nonStriker,
  availableNextBatters,
  fieldingPlayers = [],
  onConfirm,
  onClose,
}) => {
  const [wicketType, setWicketType] = useState<WicketType>('caught');
  const [dismissedPlayerId, setDismissedPlayerId] = useState('');
  const [incomingBatterId, setIncomingBatterId] = useState('');
  const [fielderId, setFielderId] = useState('');
  const [runsCompleted, setRunsCompleted] = useState(0);
  const [extraMode, setExtraMode] = useState<'none' | 'wide' | 'no-ball'>('none');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setWicketType(isFreeHit ? 'run-out' : 'caught');
    setDismissedPlayerId(striker?.id ?? '');
    setIncomingBatterId(availableNextBatters[0]?.id ?? '');
    setFielderId('');
    setRunsCompleted(0);
    setExtraMode('none');
    setIsSaving(false);
  }, [isOpen, isFreeHit, striker?.id, availableNextBatters]);

  if (!isOpen || !striker || !nonStriker) return null;

  const allowedTypes = isFreeHit
    ? ALL_WICKET_TYPES.filter((t) => t.value === 'run-out')
    : ALL_WICKET_TYPES;

  const supportsFielder =
    wicketType === 'caught' || wicketType === 'run-out' || wicketType === 'stumped';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const isRunOut = wicketType === 'run-out';
      const runs = isRunOut ? runsCompleted : 0;
      const extras = extraMode === 'wide' ? 1 + runs : extraMode === 'no-ball' ? 1 : 0;
      const runsOffBat = extraMode === 'wide' ? 0 : runs;

      await onConfirm({
        wicketType,
        dismissedPlayerId: isRunOut ? dismissedPlayerId || striker.id : striker.id,
        incomingBatterId: incomingBatterId || undefined,
        fielderId: supportsFielder && fielderId ? fielderId : undefined,
        runsOffBat,
        extraType: extraMode === 'none' ? undefined : extraMode,
        extras,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wicket-modal-title"
    >
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#101713] border border-white/15 p-5 sm:p-6 text-white shadow-2xl space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="wicket-modal-title" className="font-display text-xl font-bold text-white">
            Record Wicket
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-[#8FA397] hover:text-white"
            aria-label="Close wicket dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isFreeHit && (
          <div className="rounded-xl bg-amber-500/15 border border-amber-500/30 p-3 flex items-start gap-2.5 text-xs text-amber-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Free Hit delivery: Only Run Out dismissals are permitted.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[#C8D6CE]">Dismissal Type</span>
            <div className="grid grid-cols-2 gap-2">
              {allowedTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setWicketType(type.value)}
                  className={`min-h-[44px] rounded-xl px-3 text-xs sm:text-sm font-semibold border transition-colors ${
                    wicketType === type.value
                      ? 'bg-rose-600/80 border-rose-400 text-white'
                      : 'bg-[#080C0A] border-white/15 text-[#9CB0A4] hover:text-white'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {wicketType === 'run-out' && (
            <>
              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-[#C8D6CE]">Who Was Run Out?</span>
                <div className="grid grid-cols-2 gap-2">
                  {[striker, nonStriker].map((batter) => (
                    <button
                      key={batter.id}
                      type="button"
                      onClick={() => setDismissedPlayerId(batter.id)}
                      className={`min-h-[44px] rounded-xl px-3 text-xs sm:text-sm font-semibold border truncate transition-colors ${
                        dismissedPlayerId === batter.id
                          ? 'bg-[#0D3B24] border-[#22C55E] text-white'
                          : 'bg-[#080C0A] border-white/15 text-[#9CB0A4]'
                      }`}
                    >
                      {batter.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-[#C8D6CE]">Runs Completed</span>
                  <select
                    value={runsCompleted}
                    onChange={(e) => setRunsCompleted(Number(e.target.value))}
                    className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
                  >
                    {[0, 1, 2, 3].map((r) => (
                      <option key={r} value={r}>
                        {r} run{r === 1 ? '' : 's'}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-[#C8D6CE]">Delivery Type</span>
                  <select
                    value={extraMode}
                    onChange={(e) => setExtraMode(e.target.value as 'none' | 'wide' | 'no-ball')}
                    className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
                  >
                    <option value="none">Legal Ball</option>
                    <option value="wide">Wide Ball</option>
                    <option value="no-ball">No-Ball</option>
                  </select>
                </label>
              </div>
            </>
          )}

          {supportsFielder && fieldingPlayers.length > 0 && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">
                Fielder (Optional — records{' '}
                {wicketType === 'caught'
                  ? 'Catch'
                  : wicketType === 'stumped'
                    ? 'Stumping'
                    : 'Run Out'}
                )
              </span>
              <select
                value={fielderId}
                onChange={(e) => setFielderId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
              >
                <option value="">Not specified</option>
                {fieldingPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {availableNextBatters.length > 0 && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">Incoming Batter</span>
              <select
                value={incomingBatterId}
                onChange={(e) => setIncomingBatterId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
              >
                <option value="">Select later</option>
                {availableNextBatters.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-[#161F19] border border-white/15 text-sm font-semibold text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-sm font-semibold text-white"
            >
              {isSaving ? 'Recording...' : 'Confirm Wicket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
