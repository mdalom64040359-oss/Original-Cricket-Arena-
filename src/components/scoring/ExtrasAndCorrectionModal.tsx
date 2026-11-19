import React, {useEffect, useState} from 'react';
import {Trash2, X} from 'lucide-react';
import type {BallEvent, ExtraType} from '../../types/cricket';

interface ExtrasModalProps {
  mode: 'wide' | 'no-ball' | 'bye' | 'leg-bye' | 'penalty' | null;
  onSubmit: (payload: {
    eventType: 'delivery' | 'penalty';
    runsOffBat: number;
    extras: number;
    extraType: ExtraType;
    noBallSubExtraType?: 'bye' | 'leg-bye';
    noBallSubExtras?: number;
  }) => Promise<void>;
  onClose: () => void;
}

export const ExtrasModal: React.FC<ExtrasModalProps> = ({mode, onSubmit, onClose}) => {
  const [additionalRuns, setAdditionalRuns] = useState(0);
  const [noBallSubType, setNoBallSubType] = useState<'bat' | 'bye' | 'leg-bye'>('bat');
  const [penaltyRuns, setPenaltyRuns] = useState(5);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setAdditionalRuns(mode === 'bye' || mode === 'leg-bye' ? 1 : 0);
    setNoBallSubType('bat');
    setPenaltyRuns(5);
    setIsSaving(false);
  }, [mode]);

  if (!mode) return null;

  const titleMap: Record<NonNullable<typeof mode>, string> = {
    wide: 'Record Wide Ball',
    'no-ball': 'Record No-Ball',
    bye: 'Record Byes',
    'leg-bye': 'Record Leg-Byes',
    penalty: 'Award Penalty Runs',
  };

  const handleConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      if (mode === 'penalty') {
        await onSubmit({
          eventType: 'penalty',
          runsOffBat: 0,
          extras: Math.max(1, penaltyRuns),
          extraType: 'penalty',
        });
      } else if (mode === 'wide') {
        await onSubmit({
          eventType: 'delivery',
          runsOffBat: 0,
          extras: 1 + additionalRuns,
          extraType: 'wide',
        });
      } else if (mode === 'no-ball') {
        if (noBallSubType === 'bat') {
          await onSubmit({
            eventType: 'delivery',
            runsOffBat: additionalRuns,
            extras: 1,
            extraType: 'no-ball',
          });
        } else {
          await onSubmit({
            eventType: 'delivery',
            runsOffBat: 0,
            extras: 1 + additionalRuns,
            extraType: 'no-ball',
            noBallSubExtraType: noBallSubType,
            noBallSubExtras: additionalRuns,
          });
        }
      } else {
        await onSubmit({
          eventType: 'delivery',
          runsOffBat: 0,
          extras: Math.max(1, additionalRuns),
          extraType: mode,
        });
      }
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
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[#101713] border border-white/15 p-5 sm:p-6 text-white shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-white">{titleMap[mode]}</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-[#8FA397] hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="space-y-4">
          {mode === 'penalty' ? (
            <div className="space-y-2">
              <span className="block text-xs font-medium text-[#C8D6CE]">
                Penalty Runs Awarded (No delivery counted)
              </span>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 5, 10].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPenaltyRuns(val)}
                    className={`min-h-[44px] rounded-xl font-mono text-sm font-bold border ${
                      penaltyRuns === val
                        ? 'bg-[#0D3B24] border-[#22C55E] text-white'
                        : 'bg-[#080C0A] border-white/15 text-[#9CB0A4]'
                    }`}
                  >
                    +{val}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {mode === 'no-ball' && (
                <div className="space-y-1.5">
                  <span className="block text-xs font-medium text-[#C8D6CE]">
                    Additional Runs Source (+1 NB penalty included)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        {id: 'bat', label: 'Off Bat'},
                        {id: 'bye', label: 'Byes'},
                        {id: 'leg-bye', label: 'Leg-Byes'},
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setNoBallSubType(opt.id)}
                        className={`min-h-[44px] rounded-xl text-xs font-semibold border ${
                          noBallSubType === opt.id
                            ? 'bg-[#0D3B24] border-[#22C55E] text-white'
                            : 'bg-[#080C0A] border-white/15 text-[#9CB0A4]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-[#C8D6CE]">
                  {mode === 'wide'
                    ? 'Additional Runs Crossed (+1 Wide included)'
                    : mode === 'no-ball'
                      ? 'Additional Runs Scored'
                      : 'Runs Scored'}
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {(mode === 'bye' || mode === 'leg-bye'
                    ? [1, 2, 3, 4]
                    : [0, 1, 2, 3, 4, 6]
                  ).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAdditionalRuns(val)}
                      className={`min-h-[44px] rounded-xl font-mono text-sm font-bold border ${
                        additionalRuns === val
                          ? 'bg-[#0D3B24] border-[#22C55E] text-white'
                          : 'bg-[#080C0A] border-white/15 text-[#9CB0A4]'
                      }`}
                    >
                      {mode === 'wide'
                        ? `wd+${val}`
                        : mode === 'no-ball'
                          ? `nb+${val}`
                          : `+${val}`}
                    </button>
                  ))}
                </div>
              </div>
            </>
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
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-sm font-semibold text-white"
            >
              {isSaving ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface BallCorrectionModalProps {
  ball: BallEvent | null;
  onSaveEdit: (updated: BallEvent) => Promise<void>;
  onDeleteBall: (ballId: string) => Promise<void>;
  onClose: () => void;
}

export const BallCorrectionModal: React.FC<BallCorrectionModalProps> = ({
  ball,
  onSaveEdit,
  onDeleteBall,
  onClose,
}) => {
  const [runsOffBat, setRunsOffBat] = useState(0);
  const [extras, setExtras] = useState(0);
  const [extraType, setExtraType] = useState<ExtraType | 'none'>('none');
  const [noBallSubType, setNoBallSubType] = useState<'bat' | 'bye' | 'leg-bye'>('bat');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!ball) return;
    setRunsOffBat(ball.runsOffBat);
    setExtras(ball.extras);
    setExtraType(ball.extraType ?? 'none');
    setNoBallSubType(ball.noBallSubExtraType ?? 'bat');
    setIsSaving(false);
  }, [ball]);

  if (!ball) return null;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const nextExtraType = extraType === 'none' ? undefined : extraType;
      const isNoBallWithSubExtras =
        nextExtraType === 'no-ball' && (noBallSubType === 'bye' || noBallSubType === 'leg-bye');

      const nextExtras = !nextExtraType
        ? 0
        : nextExtraType === 'no-ball' && !isNoBallWithSubExtras
          ? 1
          : Math.max(1, extras);

      const nextRunsOffBat =
        nextExtraType === 'wide' ||
        nextExtraType === 'bye' ||
        nextExtraType === 'leg-bye' ||
        nextExtraType === 'penalty' ||
        isNoBallWithSubExtras
          ? 0
          : runsOffBat;

      const nextNoBallSubExtraType = isNoBallWithSubExtras ? noBallSubType : undefined;
      const nextNoBallSubExtras = isNoBallWithSubExtras ? Math.max(0, nextExtras - 1) : undefined;

      await onSaveEdit({
        ...ball,
        eventType: nextExtraType === 'penalty' ? 'penalty' : 'delivery',
        runsOffBat: nextRunsOffBat,
        extras: nextExtras,
        extraType: nextExtraType,
        noBallSubExtraType: nextNoBallSubExtraType,
        noBallSubExtras: nextNoBallSubExtras,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const isNoBallSubExtraMode = extraType === 'no-ball' && noBallSubType !== 'bat';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[#101713] border border-white/15 p-5 sm:p-6 text-white shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white">Correct Ball Event</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-[#8FA397] hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#C8D6CE]">Delivery / Extra Type</span>
              <select
                value={extraType}
                onChange={(e) => {
                  const val = e.target.value as ExtraType | 'none';
                  setExtraType(val);
                  if (val === 'none') {
                    setExtras(0);
                    setNoBallSubType('bat');
                  } else if (val === 'no-ball') {
                    setNoBallSubType('bat');
                    setExtras(1);
                  } else if (extras === 0) {
                    setExtras(1);
                  }
                }}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
              >
                <option value="none">Normal Delivery</option>
                <option value="wide">Wide</option>
                <option value="no-ball">No-Ball</option>
                <option value="bye">Bye</option>
                <option value="leg-bye">Leg-Bye</option>
                <option value="penalty">Penalty</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#C8D6CE]">Runs Off Bat</span>
              <input
                type="number"
                min={0}
                max={6}
                disabled={
                  extraType === 'wide' ||
                  extraType === 'bye' ||
                  extraType === 'leg-bye' ||
                  extraType === 'penalty' ||
                  isNoBallSubExtraMode
                }
                value={isNoBallSubExtraMode ? 0 : runsOffBat}
                onChange={(e) => setRunsOffBat(Math.min(6, Math.max(0, Number(e.target.value) || 0)))}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 font-mono text-sm text-white disabled:opacity-40"
              />
            </label>
          </div>

          {extraType === 'no-ball' && (
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-[#C8D6CE]">No-Ball Runs Source</span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    {id: 'bat', label: 'Off Bat'},
                    {id: 'bye', label: 'Byes'},
                    {id: 'leg-bye', label: 'Leg-Byes'},
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setNoBallSubType(opt.id);
                      if (opt.id === 'bat') {
                        setExtras(1);
                      } else if (extras < 1) {
                        setExtras(1);
                      }
                    }}
                    className={`min-h-[40px] rounded-xl text-xs font-semibold border ${
                      noBallSubType === opt.id
                        ? 'bg-[#0D3B24] border-[#22C55E] text-white'
                        : 'bg-[#080C0A] border-white/15 text-[#9CB0A4]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {extraType !== 'none' && (extraType !== 'no-ball' || isNoBallSubExtraMode) && (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#C8D6CE]">
                {isNoBallSubExtraMode ? 'Total Extra Runs (1 NB + Byes/LB)' : 'Total Extra Runs'}
              </span>
              <input
                type="number"
                min={1}
                max={20}
                value={extras}
                onChange={(e) => setExtras(Math.max(1, Number(e.target.value) || 1))}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 font-mono text-sm text-white"
              />
            </label>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                setIsSaving(true);
                void onDeleteBall(ball.id).finally(() => onClose());
              }}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-semibold text-rose-300"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Event</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-xl bg-[#161F19] border border-white/15 text-sm font-semibold text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="min-h-[44px] px-5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-sm font-semibold text-white"
              >
                Save Fix
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
