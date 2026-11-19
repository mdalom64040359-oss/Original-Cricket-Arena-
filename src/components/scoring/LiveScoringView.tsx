import React, {useMemo, useState} from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarClock,
  CheckCircle2,
  Edit3,
  Flag,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import {saveMatch} from '../../db/database';
import {
  computeMatchResult,
  computeTestMatchSituation,
  formatBallBadge,
  getFirstBattingTeamId,
  getFormatRules,
  getTeamPlayingXI,
  recalculateInnings,
} from '../../engine/scoringEngine';
import type {BallEvent, ExtraType, Innings, Match, Player, WicketType} from '../../types/cricket';
import {generateId} from '../../utils/imageUtils';
import {ConfirmDialog} from '../common/ConfirmDialog';
import {BallCorrectionModal, ExtrasModal} from './ExtrasAndCorrectionModal';
import {ScorecardPanel} from './ScorecardPanel';
import {WicketModal} from './WicketModal';

interface LiveScoringViewProps {
  match: Match;
  players: Player[];
  onMatchUpdated: (updated: Match) => Promise<void>;
  onBack: () => void;
}

export const LiveScoringView: React.FC<LiveScoringViewProps> = ({
  match,
  players,
  onMatchUpdated,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'pad' | 'scorecard' | 'commentary'>('pad');
  const [scorecardInningsIndex, setScorecardInningsIndex] = useState(
    Math.max(0, match.innings.length - 1),
  );

  // Opening players form state
  const firstBattingTeamId = getFirstBattingTeamId(match);
  const firstBowlingTeamId =
    firstBattingTeamId === match.teamAId ? match.teamBId : match.teamAId;

  const currentInnings: Innings = match.innings[match.currentInningsIndex] ?? {
    inningsNumber: 1,
    battingTeamId: firstBattingTeamId,
    bowlingTeamId: firstBowlingTeamId,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: 0,
    balls: [],
    isCompleted: false,
  };

  const battingXI = getTeamPlayingXI(match, currentInnings.battingTeamId);
  const bowlingXI = getTeamPlayingXI(match, currentInnings.bowlingTeamId);

  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach((p) => map.set(p.id, p));
    return map;
  }, [players]);

  const recalc = useMemo(
    () =>
      recalculateInnings({
        innings: currentInnings,
        battingXI,
        playerMap,
        format: match.format,
        oversPerInnings: match.oversPerInnings,
      }),
    [currentInnings, battingXI, playerMap, match.format, match.oversPerInnings],
  );

  const [openingStriker, setOpeningStriker] = useState(battingXI[0] ?? '');
  const [openingNonStriker, setOpeningNonStriker] = useState(battingXI[1] ?? '');
  const [openingBowler, setOpeningBowler] = useState(bowlingXI[0] ?? '');
  const [setupError, setSetupError] = useState<string | null>(null);

  const [extrasModalMode, setExtrasModalMode] = useState<
    'wide' | 'no-ball' | 'bye' | 'leg-bye' | 'penalty' | null
  >(null);
  const [wicketModalOpen, setWicketModalOpen] = useState(false);
  const [editingBall, setEditingBall] = useState<BallEvent | null>(null);
  const [confirmEndInnings, setConfirmEndInnings] = useState(false);
  const [confirmDeclareInnings, setConfirmDeclareInnings] = useState(false);
  const [confirmEndMatch, setConfirmEndMatch] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const formatRules = getFormatRules(match.format, match.testMaxDays);
  const isTestMatch = match.format === 'TEST';
  const testCurrentDay = match.testCurrentDay ?? 1;
  const testMaxDays = formatRules.maxDays;

  const liveMatchPreview: Match = useMemo(() => {
    const list = [...match.innings];
    const previewInnings: Innings = {
      ...currentInnings,
      runs: recalc.runs,
      wickets: recalc.wickets,
      legalBalls: recalc.legalBalls,
      extras: recalc.extras.total,
      isCompleted: recalc.isInningsOver,
    };
    if (list.length === 0) list.push(previewInnings);
    else list[match.currentInningsIndex] = previewInnings;
    return {...match, innings: list};
  }, [match, currentInnings, recalc.runs, recalc.wickets, recalc.legalBalls, recalc.extras.total, recalc.isInningsOver]);

  const testSituation = useMemo(
    () => (isTestMatch ? computeTestMatchSituation(liveMatchPreview) : null),
    [isTestMatch, liveMatchPreview],
  );

  const battingTeamName =
    currentInnings.battingTeamId === match.teamAId ? match.teamAName : match.teamBName;
  const battingTeamShort =
    currentInnings.battingTeamId === match.teamAId ? match.teamAShortName : match.teamBShortName;

  const needsOpeningSetup =
    !currentInnings.openingStrikerId ||
    !currentInnings.openingNonStrikerId ||
    !currentInnings.openingBowlerId;

  const needsNewBowler =
    !needsOpeningSetup &&
    !recalc.isInningsOver &&
    !recalc.needsNextBatter &&
    recalc.overJustCompleted &&
    !currentInnings.currentBowlerId;

  const persistInningsUpdate = async (
    nextInnings: Innings,
    extraMatchUpdates?: Partial<Match>,
  ) => {
    setIsSaving(true);
    try {
      const nextInningsList = [...match.innings];
      if (nextInningsList.length === 0) {
        nextInningsList.push(nextInnings);
      } else {
        nextInningsList[match.currentInningsIndex] = nextInnings;
      }

      const updatedMatch: Match = {
        ...match,
        innings: nextInningsList,
        updatedAt: new Date().toISOString(),
        ...extraMatchUpdates,
      };

      await saveMatch(updatedMatch);
      await onMatchUpdated(updatedMatch);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmOpeningSetup = async (event: React.FormEvent) => {
    event.preventDefault();
    setSetupError(null);

    if (!openingStriker || !openingNonStriker || !openingBowler) {
      setSetupError('Please select opening striker, non-striker, and bowler.');
      return;
    }

    if (openingStriker === openingNonStriker) {
      setSetupError('Striker and Non-Striker cannot be the same player.');
      return;
    }

    const initializedInnings: Innings = {
      ...currentInnings,
      openingStrikerId: openingStriker,
      openingNonStrikerId: openingNonStriker,
      openingBowlerId: openingBowler,
      currentStrikerId: openingStriker,
      currentNonStrikerId: openingNonStriker,
      currentBowlerId: openingBowler,
    };

    await persistInningsUpdate(initializedInnings, {
      status: match.status === 'upcoming' ? 'live' : match.status,
    });
  };

  const applyBallListAndSave = async (
    nextBalls: BallEvent[],
    options?: {isUndoOrEdit?: boolean},
  ) => {
    const cleanInnings: Innings = {
      ...currentInnings,
      currentStrikerId: undefined,
      currentNonStrikerId: undefined,
      currentBowlerId: undefined,
      balls: nextBalls,
      isCompleted: false,
    };

    const computed = recalculateInnings({
      innings: cleanInnings,
      battingXI,
      playerMap,
      format: match.format,
      oversPerInnings: match.oversPerInnings,
    });

    const keepBowler =
      computed.overJustCompleted && !computed.isInningsOver && bowlingXI.length > 1
        ? options?.isUndoOrEdit
          ? undefined
          : undefined
        : computed.derivedBowlerId ?? currentInnings.openingBowlerId;

    const finalizedInnings: Innings = {
      ...cleanInnings,
      runs: computed.runs,
      wickets: computed.wickets,
      legalBalls: computed.legalBalls,
      extras: computed.extras.total,
      currentStrikerId: computed.derivedStrikerId,
      currentNonStrikerId: computed.derivedNonStrikerId,
      currentBowlerId: keepBowler,
      isCompleted: computed.isInningsOver,
    };

    const nextMatchUpdates: Partial<Match> = {};
    const nextInningsList = [...match.innings];
    if (nextInningsList.length === 0) nextInningsList.push(finalizedInnings);
    else nextInningsList[match.currentInningsIndex] = finalizedInnings;
    const tempMatch: Match = {
      ...match,
      innings: nextInningsList,
    };

    if (computed.isInningsOver) {
      if (match.format === 'TEST') {
        const sit = computeTestMatchSituation(tempMatch);
        if (match.currentInningsIndex === 2 && sit.inningsVictoryResult) {
          nextMatchUpdates.status = 'completed';
          nextMatchUpdates.resultSummary = sit.inningsVictoryResult;
        } else if (match.currentInningsIndex >= 3) {
          nextMatchUpdates.status = 'completed';
          nextMatchUpdates.resultSummary = computeMatchResult(tempMatch);
        }
      } else if (match.currentInningsIndex >= formatRules.maxInnings - 1) {
        nextMatchUpdates.status = 'completed';
        nextMatchUpdates.resultSummary = computeMatchResult(tempMatch);
      }
    } else if (options?.isUndoOrEdit && match.status === 'completed') {
      nextMatchUpdates.status = 'live';
      nextMatchUpdates.resultSummary = undefined;
    }

    await persistInningsUpdate(finalizedInnings, nextMatchUpdates);
  };

  const recordEvent = async (payload: {
    eventType?: 'delivery' | 'penalty';
    runsOffBat: number;
    extras: number;
    extraType?: ExtraType;
    noBallSubExtraType?: 'bye' | 'leg-bye';
    noBallSubExtras?: number;
    isWicket?: boolean;
    wicketType?: WicketType;
    dismissedPlayerId?: string;
    fielderId?: string;
    incomingBatterId?: string;
  }) => {
    if (
      recalc.isInningsOver ||
      needsOpeningSetup ||
      recalc.needsNextBatter ||
      needsNewBowler ||
      !recalc.derivedStrikerId ||
      !recalc.derivedNonStrikerId ||
      !recalc.derivedBowlerId
    ) {
      return;
    }

    const ball: BallEvent = {
      id: generateId('ball'),
      eventType: payload.eventType ?? 'delivery',
      overNumber: Math.floor(recalc.legalBalls / 6),
      ballNumber: (recalc.legalBalls % 6) + 1,
      strikerId: recalc.derivedStrikerId,
      nonStrikerId: recalc.derivedNonStrikerId,
      bowlerId: recalc.derivedBowlerId,
      runsOffBat: payload.runsOffBat,
      extras: payload.extras,
      extraType: payload.extraType,
      noBallSubExtraType: payload.noBallSubExtraType,
      noBallSubExtras: payload.noBallSubExtras,
      isFreeHit: payload.eventType === 'penalty' ? false : recalc.nextBallIsFreeHit,
      isWicket: Boolean(payload.isWicket),
      wicketType: payload.wicketType,
      dismissedPlayerId: payload.dismissedPlayerId,
      fielderId: payload.fielderId,
      incomingBatterId: payload.incomingBatterId,
      timestamp: new Date().toISOString(),
    };

    await applyBallListAndSave([...currentInnings.balls, ball]);
  };

  const handleUndoLastBall = async () => {
    if (currentInnings.balls.length === 0 || isSaving) return;
    await applyBallListAndSave(currentInnings.balls.slice(0, -1), {isUndoOrEdit: true});
  };

  const handleSelectNextBatter = async (batterId: string) => {
    if (!batterId) return;
    const lastBall = currentInnings.balls[currentInnings.balls.length - 1];
    if (lastBall && lastBall.isWicket && !lastBall.incomingBatterId) {
      const updatedBalls = [
        ...currentInnings.balls.slice(0, -1),
        {...lastBall, incomingBatterId: batterId},
      ];
      await applyBallListAndSave(updatedBalls);
      return;
    }
    await persistInningsUpdate({
      ...currentInnings,
      currentNonStrikerId: batterId,
    });
  };

  const handleSelectNextBowler = async (bowlerId: string) => {
    if (!bowlerId) return;
    await persistInningsUpdate({
      ...currentInnings,
      currentBowlerId: bowlerId,
    });
  };

  const handleSwapStrike = async () => {
    if (!recalc.derivedStrikerId || !recalc.derivedNonStrikerId || isSaving) return;
    await persistInningsUpdate({
      ...currentInnings,
      currentStrikerId: recalc.derivedNonStrikerId,
      currentNonStrikerId: recalc.derivedStrikerId,
    });
  };

  const finalizeClosedInnings = async (declared: boolean) => {
    const closedInnings: Innings = {
      ...currentInnings,
      runs: recalc.runs,
      wickets: recalc.wickets,
      legalBalls: recalc.legalBalls,
      extras: recalc.extras.total,
      isCompleted: true,
      declared: declared ? true : currentInnings.declared,
    };

    const nextInningsList = [...match.innings];
    if (nextInningsList.length === 0) nextInningsList.push(closedInnings);
    else nextInningsList[match.currentInningsIndex] = closedInnings;
    const tempMatch: Match = {
      ...match,
      innings: nextInningsList,
    };

    const extraUpdates: Partial<Match> = {};
    if (match.format === 'TEST') {
      const sit = computeTestMatchSituation(tempMatch);
      if (match.currentInningsIndex === 2 && sit.inningsVictoryResult) {
        extraUpdates.status = 'completed';
        extraUpdates.resultSummary = sit.inningsVictoryResult;
      } else if (match.currentInningsIndex >= 3) {
        extraUpdates.status = 'completed';
        extraUpdates.resultSummary = computeMatchResult(tempMatch);
      }
    } else if (match.currentInningsIndex >= formatRules.maxInnings - 1) {
      extraUpdates.status = 'completed';
      extraUpdates.resultSummary = computeMatchResult(tempMatch);
    }

    await persistInningsUpdate(closedInnings, extraUpdates);
  };

  const handleEndInningsConfirmed = async () => {
    setConfirmEndInnings(false);
    await finalizeClosedInnings(false);
  };

  const handleDeclareInningsConfirmed = async () => {
    setConfirmDeclareInnings(false);
    await finalizeClosedInnings(true);
  };

  const handleStartNextInnings = async (enforceFollowOn = false) => {
    let nextBattingTeamId = firstBowlingTeamId;
    let nextBowlingTeamId = firstBattingTeamId;
    let nextTargetRuns: number | undefined;

    if (match.format === 'TEST') {
      const sit = computeTestMatchSituation(liveMatchPreview);
      if (!sit.nextInningsConfig) return;
      if (
        enforceFollowOn &&
        sit.canEnforceFollowOn &&
        sit.nextInningsConfig.followOnBattingTeamId &&
        sit.nextInningsConfig.followOnBowlingTeamId
      ) {
        nextBattingTeamId = sit.nextInningsConfig.followOnBattingTeamId;
        nextBowlingTeamId = sit.nextInningsConfig.followOnBowlingTeamId;
      } else {
        nextBattingTeamId = sit.nextInningsConfig.normalBattingTeamId;
        nextBowlingTeamId = sit.nextInningsConfig.normalBowlingTeamId;
        nextTargetRuns = sit.nextInningsConfig.targetRuns;
      }
    } else {
      const firstInnings = match.innings[0];
      if (!firstInnings) return;
      nextBattingTeamId = firstInnings.bowlingTeamId;
      nextBowlingTeamId = firstInnings.battingTeamId;
      nextTargetRuns = recalc.runs + 1;
    }

    const nextBattingXI = getTeamPlayingXI(match, nextBattingTeamId);
    const nextBowlingXI = getTeamPlayingXI(match, nextBowlingTeamId);
    const nextInningsIndex = match.innings.length;

    const nextInnings: Innings = {
      inningsNumber: nextInningsIndex + 1,
      battingTeamId: nextBattingTeamId,
      bowlingTeamId: nextBowlingTeamId,
      targetRuns: nextTargetRuns,
      followOnEnforced: enforceFollowOn ? true : undefined,
      runs: 0,
      wickets: 0,
      legalBalls: 0,
      extras: 0,
      balls: [],
      isCompleted: false,
    };

    setOpeningStriker(nextBattingXI[0] ?? '');
    setOpeningNonStriker(nextBattingXI[1] ?? '');
    setOpeningBowler(nextBowlingXI[0] ?? '');
    setScorecardInningsIndex(nextInningsIndex);

    const updatedMatch: Match = {
      ...match,
      currentInningsIndex: nextInningsIndex,
      innings: [...match.innings, nextInnings],
      updatedAt: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      await saveMatch(updatedMatch);
      await onMatchUpdated(updatedMatch);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdvanceTestDay = async () => {
    if (!isTestMatch || testCurrentDay >= testMaxDays || isSaving) return;
    setIsSaving(true);
    try {
      const updatedMatch: Match = {
        ...match,
        testCurrentDay: testCurrentDay + 1,
        updatedAt: new Date().toISOString(),
      };
      await saveMatch(updatedMatch);
      await onMatchUpdated(updatedMatch);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndMatchConfirmed = async () => {
    setConfirmEndMatch(false);
    const inningsNaturallyFinished = recalc.isInningsOver;
    const closedInnings: Innings = {
      ...currentInnings,
      runs: recalc.runs,
      wickets: recalc.wickets,
      legalBalls: recalc.legalBalls,
      extras: recalc.extras.total,
      isCompleted: isTestMatch ? inningsNaturallyFinished : true,
    };

    const updatedInningsList = [...match.innings];
    if (updatedInningsList.length === 0) updatedInningsList.push(closedInnings);
    else updatedInningsList[match.currentInningsIndex] = closedInnings;

    const tempMatch: Match = {...match, innings: updatedInningsList};
    const resultText =
      isTestMatch
        ? computeMatchResult(tempMatch)
        : updatedInningsList.length >= 2
          ? computeMatchResult(tempMatch)
          : `${battingTeamName} finished at ${recalc.runs}/${recalc.wickets} (${recalc.oversFormatted} ov)`;

    await persistInningsUpdate(closedInnings, {
      status: 'completed',
      resultSummary: resultText,
    });
  };

  const strikerPlayer = recalc.derivedStrikerId ? playerMap.get(recalc.derivedStrikerId) : undefined;
  const nonStrikerPlayer = recalc.derivedNonStrikerId
    ? playerMap.get(recalc.derivedNonStrikerId)
    : undefined;
  const bowlerPlayer = recalc.derivedBowlerId ? playerMap.get(recalc.derivedBowlerId) : undefined;

  const strikerRow = recalc.battingRows.find((r) => r.playerId === recalc.derivedStrikerId);
  const nonStrikerRow = recalc.battingRows.find((r) => r.playerId === recalc.derivedNonStrikerId);
  const bowlerRow = recalc.bowlingRows.find((r) => r.playerId === recalc.derivedBowlerId);

  const canScoreDelivery =
    match.status !== 'completed' &&
    match.status !== 'abandoned' &&
    !needsOpeningSetup &&
    !recalc.isInningsOver &&
    !recalc.needsNextBatter &&
    !needsNewBowler &&
    !isSaving;

  const availableBowlers =
    bowlingXI.length > 1 && recalc.lastCompletedOverBowlerId
      ? bowlingXI.filter((id) => id !== recalc.lastCompletedOverBowlerId)
      : bowlingXI;

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/10 px-3.5 py-2 min-h-[44px] text-sm font-medium text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Match Info</span>
        </button>

        <div className="flex items-center gap-2">
          {isTestMatch && match.status !== 'completed' && testCurrentDay < testMaxDays && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                void handleAdvanceTestDay();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/15 px-3 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-[#9AC2AA] hover:text-white transition-colors"
            >
              <CalendarClock className="w-4 h-4 text-[#22C55E]" />
              <span>Next Day (Day {testCurrentDay + 1})</span>
            </button>
          )}

          {match.status !== 'completed' && (
            <button
              type="button"
              onClick={() => setConfirmEndMatch(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 px-3.5 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-rose-200 transition-colors"
            >
              <Flag className="w-4 h-4" />
              <span>{isTestMatch ? 'End / Draw' : 'End Match'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Scoreboard Header */}
      <section className="rounded-2xl bg-gradient-to-br from-[#0D3B24] via-[#092818] to-[#0D1410] border border-[#22C55E]/30 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs text-[#B8D0C2]">
          <span className="truncate font-medium">
            {match.title} · Inn {currentInnings.inningsNumber}
            {currentInnings.followOnEnforced ? ' (f/o)' : ''}
          </span>
          <span className="font-mono text-[#4ADE80] shrink-0">
            {isTestMatch
              ? `TEST · Day ${testCurrentDay}/${testMaxDays}`
              : `${match.format} · ${match.oversPerInnings} Ov`}
          </span>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-[#9AC2AA]">{battingTeamName}</div>
            <div className="font-mono text-3xl sm:text-4xl font-bold text-white tabular-nums tracking-tight">
              {battingTeamShort} {recalc.runs}/{recalc.wickets}
              {currentInnings.declared ? 'd' : ''}
            </div>
          </div>

          <div className="text-right">
            <div className="font-mono text-lg sm:text-xl font-bold text-white tabular-nums">
              {recalc.oversFormatted}
              {formatRules.hasOversLimit ? ` / ${match.oversPerInnings}` : ''} Ov
            </div>
            <div className="font-mono text-xs text-[#B8D0C2] tabular-nums">
              CRR: {recalc.currentRunRate.toFixed(2)}
              {recalc.requiredRunRate !== undefined ? ` · RRR: ${recalc.requiredRunRate.toFixed(2)}` : ''}
            </div>
          </div>
        </div>

        {/* Test Cricket Lead / Deficit & Innings Scores */}
        {isTestMatch && testSituation && (
          <div className="rounded-xl bg-black/35 border border-white/10 px-3.5 py-2 text-xs sm:text-sm font-medium text-white flex flex-wrap items-center justify-between gap-2">
            <span className="text-[#4ADE80] font-semibold">{testSituation.leadDeficitText}</span>
            <span className="font-mono text-xs text-[#B8D0C2] tabular-nums">
              {match.teamAShortName} {testSituation.teamATotal} · {match.teamBShortName}{' '}
              {testSituation.teamBTotal}
            </span>
          </div>
        )}

        {/* Target / Chase Equation */}
        {recalc.targetRuns !== undefined && (
          <div className="rounded-xl bg-black/35 border border-white/10 px-3.5 py-2 text-xs sm:text-sm font-medium text-white flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono tabular-nums">Target: {recalc.targetRuns}</span>
            <span className="text-[#4ADE80] font-semibold font-mono tabular-nums">
              {recalc.isTargetReached
                ? 'Target Reached!'
                : isTestMatch
                  ? `Need ${recalc.runsRemaining} runs`
                  : `Need ${recalc.runsRemaining} off ${recalc.ballsRemaining} balls`}
            </span>
          </div>
        )}

        {/* Free Hit Banner (Limited Overs Only) */}
        {formatRules.freeHitEnabled && recalc.nextBallIsFreeHit && !recalc.isInningsOver && (
          <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-3.5 py-2 flex items-center gap-2 text-xs font-bold text-amber-200 uppercase tracking-wide">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Free Hit Active on Next Legal Ball</span>
          </div>
        )}

        {/* Completed Match Result */}
        {match.status === 'completed' && match.resultSummary && (
          <div className="rounded-xl bg-[#16A34A]/25 border border-[#22C55E]/40 px-3.5 py-2.5 flex items-center gap-2 text-sm font-semibold text-white">
            <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0" />
            <span>{match.resultSummary}</span>
          </div>
        )}
      </section>

      {/* Workspace Tabs */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl bg-[#101612] border border-white/10 w-full sm:w-fit"
        role="tablist"
      >
        {(
          [
            {id: 'pad', label: 'Live Scorer'},
            {id: 'scorecard', label: 'Scorecard'},
            {id: 'commentary', label: `Commentary (${recalc.commentary.length})`},
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 sm:flex-none px-4 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#0D3B24] text-white border border-[#22C55E]/30'
                : 'text-[#9CB0A4] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'pad' ? (
        <div className="space-y-4">
          {/* Case 1: Opening Setup */}
          {needsOpeningSetup ? (
            <form
              onSubmit={handleConfirmOpeningSetup}
              className="rounded-2xl bg-[#101612] border border-white/10 p-5 space-y-4"
            >
              <h2 className="font-display text-lg font-bold text-white">
                Start Innings {currentInnings.inningsNumber} — Select Opening Players
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-[#C8D6CE]">Opening Striker</span>
                  <select
                    value={openingStriker}
                    onChange={(e) => setOpeningStriker(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
                  >
                    {battingXI.map((id) => (
                      <option key={id} value={id}>
                        {playerMap.get(id)?.name ?? 'Player'}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-[#C8D6CE]">Opening Non-Striker</span>
                  <select
                    value={openingNonStriker}
                    onChange={(e) => setOpeningNonStriker(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
                  >
                    {battingXI.map((id) => (
                      <option key={id} value={id}>
                        {playerMap.get(id)?.name ?? 'Player'}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-[#C8D6CE]">Opening Bowler</span>
                  <select
                    value={openingBowler}
                    onChange={(e) => setOpeningBowler(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
                  >
                    {bowlingXI.map((id) => (
                      <option key={id} value={id}>
                        {playerMap.get(id)?.name ?? 'Player'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {setupError && <p className="text-xs font-medium text-rose-400">{setupError}</p>}

              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto min-h-[48px] px-6 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-sm font-semibold text-white transition-colors"
              >
                Begin Innings {currentInnings.inningsNumber}
              </button>
            </form>
          ) : (
            <>
              {/* Active Crease & Bowler Info */}
              <section className="rounded-2xl bg-[#101612] border border-white/10 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Batters at Crease */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#8FA397]">Batters at Crease</span>
                      <button
                        type="button"
                        onClick={() => {
                          void handleSwapStrike();
                        }}
                        disabled={!canScoreDelivery}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#4ADE80] hover:text-white disabled:opacity-40 py-1 px-2 rounded-lg"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>Swap Ends</span>
                      </button>
                    </div>

                    <div className="rounded-xl bg-[#0B100D] border border-[#22C55E]/30 px-3 py-2 flex items-center justify-between text-sm">
                      <span className="font-semibold text-white truncate">
                        {strikerPlayer?.name ?? 'Select Batter'} *
                      </span>
                      <span className="font-mono text-white tabular-nums shrink-0">
                        {strikerRow?.runs ?? 0} ({strikerRow?.balls ?? 0})
                      </span>
                    </div>

                    <div className="rounded-xl bg-[#0B100D] border border-white/10 px-3 py-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-[#C8D6CE] truncate">
                        {nonStrikerPlayer?.name ?? 'Select Batter'}
                      </span>
                      <span className="font-mono text-[#C8D6CE] tabular-nums shrink-0">
                        {nonStrikerRow?.runs ?? 0} ({nonStrikerRow?.balls ?? 0})
                      </span>
                    </div>
                  </div>

                  {/* Current Bowler & Partnership */}
                  <div className="space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-medium text-[#8FA397] mb-1.5">Current Bowler</div>
                      <div className="rounded-xl bg-[#0B100D] border border-white/10 px-3 py-2.5 flex items-center justify-between text-sm">
                        <span className="font-semibold text-white truncate">
                          {bowlerPlayer?.name ?? 'Select Next Bowler'}
                        </span>
                        <span className="font-mono text-xs text-[#9AC2AA] tabular-nums shrink-0">
                          {bowlerRow
                            ? `${bowlerRow.oversFormatted}-${bowlerRow.maidens}-${bowlerRow.runsConceded}-${bowlerRow.wickets}`
                            : '0.0-0-0-0'}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#0B100D] border border-white/10 px-3 py-2 flex items-center justify-between text-xs">
                      <span className="text-[#8FA397]">Partnership</span>
                      <span className="font-mono font-semibold text-white tabular-nums">
                        {recalc.currentPartnership
                          ? `${recalc.currentPartnership.runs} (${recalc.currentPartnership.balls})`
                          : '0 (0)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* This Over Balls */}
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-[#8FA397] mr-1">This Over:</span>
                  {recalc.currentOverEvents.length === 0 ? (
                    <span className="text-xs text-[#6E8276]">No balls bowled yet</span>
                  ) : (
                    recalc.currentOverEvents.map((ball) => (
                      <span
                        key={ball.id}
                        className={`inline-flex items-center justify-center min-w-[32px] h-8 px-2 rounded-lg font-mono text-xs font-bold border ${
                          ball.isWicket
                            ? 'bg-rose-600/30 border-rose-400/50 text-rose-200'
                            : ball.runsOffBat === 4 || ball.runsOffBat === 6
                              ? 'bg-[#16A34A]/30 border-[#22C55E]/50 text-[#4ADE80]'
                              : ball.extraType
                                ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                                : 'bg-[#080C0A] border-white/15 text-white'
                        }`}
                      >
                        {formatBallBadge(ball)}
                      </span>
                    ))
                  )}
                </div>
              </section>

              {/* Innings Over / Innings Break / Next Innings Transition */}
              {recalc.isInningsOver ? (
                <section className="rounded-2xl bg-[#0D3B24]/50 border border-[#22C55E]/35 p-5 space-y-3">
                  <h2 className="font-display text-lg font-bold text-white">
                    {match.status === 'completed'
                      ? 'Match Completed'
                      : isTestMatch
                        ? `Innings ${currentInnings.inningsNumber} Complete — Innings Break`
                        : `Innings ${currentInnings.inningsNumber} Complete`}
                  </h2>
                  <p className="text-sm text-[#D7E4DC]">
                    {battingTeamName} {currentInnings.declared ? 'declared' : 'finished'} at{' '}
                    <strong className="font-mono text-white">
                      {recalc.runs}/{recalc.wickets}
                      {currentInnings.declared ? 'd' : ''}
                    </strong>{' '}
                    in <strong className="font-mono text-white">{recalc.oversFormatted}</strong> overs.
                  </p>

                  {isTestMatch &&
                    testSituation &&
                    match.status !== 'completed' &&
                    testSituation.nextInningsConfig && (
                      <div className="space-y-3 pt-1">
                        {testSituation.canEnforceFollowOn &&
                        testSituation.nextInningsConfig.followOnBattingTeamId ? (
                          <div className="space-y-2.5">
                            <p className="text-xs text-[#9AC2AA]">
                              Follow-on threshold ({testSituation.followOnThreshold} runs) reached.{' '}
                              {testSituation.leadDeficitText}. Choose whether to enforce the
                              follow-on or bat again:
                            </p>
                            <div className="flex flex-wrap gap-2.5">
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => {
                                  void handleStartNextInnings(true);
                                }}
                                className="w-full sm:w-auto min-h-[48px] px-5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-sm font-semibold text-white transition-colors"
                              >
                                Enforce Follow-On (
                                {testSituation.nextInningsConfig.followOnBattingTeamId ===
                                match.teamAId
                                  ? match.teamAShortName
                                  : match.teamBShortName}{' '}
                                Bats)
                              </button>
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => {
                                  void handleStartNextInnings(false);
                                }}
                                className="w-full sm:w-auto min-h-[48px] px-5 rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/15 text-sm font-semibold text-white transition-colors"
                              >
                                Bat Again (
                                {testSituation.nextInningsConfig.normalBattingTeamId ===
                                match.teamAId
                                  ? match.teamAShortName
                                  : match.teamBShortName}
                                )
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => {
                              void handleStartNextInnings(false);
                            }}
                            className="w-full sm:w-auto min-h-[48px] px-6 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-sm font-semibold text-white transition-colors"
                          >
                            Start Innings {currentInnings.inningsNumber + 1}
                            {testSituation.nextInningsConfig.targetRuns !== undefined
                              ? ` (Target: ${testSituation.nextInningsConfig.targetRuns})`
                              : ''}
                          </button>
                        )}
                      </div>
                    )}

                  {!isTestMatch &&
                    match.currentInningsIndex === 0 &&
                    match.status !== 'completed' && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          void handleStartNextInnings(false);
                        }}
                        className="w-full sm:w-auto min-h-[48px] px-6 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-sm font-semibold text-white transition-colors"
                      >
                        Start 2nd Innings (Target: {recalc.runs + 1})
                      </button>
                    )}

                  {currentInnings.balls.length > 0 && !currentInnings.declared && (
                    <div className="pt-1">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          void handleUndoLastBall();
                        }}
                        className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#0B100D] hover:bg-[#161F19] border border-white/15 text-xs font-semibold text-white"
                      >
                        <RotateCcw className="w-4 h-4 text-[#22C55E]" />
                        <span>
                          {match.status === 'completed'
                            ? 'Reopen & Undo Last Ball'
                            : 'Undo Last Ball'}
                        </span>
                      </button>
                    </div>
                  )}
                </section>
              ) : recalc.needsNextBatter ? (
                /* Next Batter Prompt after Wicket */
                <section className="rounded-2xl bg-[#101612] border border-amber-500/40 p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-base font-bold text-white">
                      Select Incoming Batter
                    </h2>
                    {currentInnings.balls.length > 0 && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          void handleUndoLastBall();
                        }}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-[#0B100D] hover:bg-[#161F19] border border-white/15 text-xs font-semibold text-white"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#22C55E]" />
                        <span>Undo Wicket</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#9CB0A4]">
                    Choose the next batter before recording the next delivery.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {recalc.availableNextBatters.map((id) => (
                      <button
                        key={id}
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          void handleSelectNextBatter(id);
                        }}
                        className="min-h-[44px] rounded-xl bg-[#0B100D] hover:bg-[#0D3B24] border border-white/15 px-4 text-left text-sm font-semibold text-white transition-colors"
                      >
                        {playerMap.get(id)?.name ?? 'Player'}
                      </button>
                    ))}
                  </div>
                </section>
              ) : needsNewBowler ? (
                /* Next Bowler Prompt after Over Complete */
                <section className="rounded-2xl bg-[#101612] border border-[#22C55E]/40 p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-base font-bold text-white">
                      Over Complete — Select Next Bowler
                    </h2>
                    {currentInnings.balls.length > 0 && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          void handleUndoLastBall();
                        }}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-[#0B100D] hover:bg-[#161F19] border border-white/15 text-xs font-semibold text-white"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#22C55E]" />
                        <span>Undo Last Ball</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#9CB0A4]">
                    {recalc.oversFormatted} overs completed. Select a bowler for the new over.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableBowlers.map((id) => (
                      <button
                        key={id}
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          void handleSelectNextBowler(id);
                        }}
                        className="min-h-[44px] rounded-xl bg-[#0B100D] hover:bg-[#0D3B24] border border-white/15 px-4 text-left text-sm font-semibold text-white transition-colors"
                      >
                        {playerMap.get(id)?.name ?? 'Player'}
                      </button>
                    ))}
                  </div>
                </section>
              ) : (
                /* Ball-by-Ball Scoring Keypad */
                <section className="rounded-2xl bg-[#101612] border border-white/10 p-4 sm:p-5 space-y-4">
                  {/* Runs 0 to 6 */}
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {[0, 1, 2, 3, 4, 5, 6].map((run) => (
                      <button
                        key={run}
                        type="button"
                        disabled={!canScoreDelivery}
                        onClick={() => {
                          void recordEvent({runsOffBat: run, extras: 0});
                        }}
                        className={`min-h-[54px] rounded-xl font-mono text-xl font-bold border active:scale-[0.97] transition-all disabled:opacity-40 ${
                          run === 4 || run === 6
                            ? 'bg-[#0D3B24] hover:bg-[#145233] border-[#22C55E]/50 text-[#4ADE80]'
                            : 'bg-[#080C0A] hover:bg-[#161F19] border-white/15 text-white'
                        }`}
                      >
                        {run}
                      </button>
                    ))}
                  </div>

                  {/* Extras & Wicket */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <button
                      type="button"
                      disabled={!canScoreDelivery}
                      onClick={() => setExtrasModalMode('wide')}
                      className="min-h-[48px] rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 text-xs sm:text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Wide
                    </button>
                    <button
                      type="button"
                      disabled={!canScoreDelivery}
                      onClick={() => setExtrasModalMode('no-ball')}
                      className="min-h-[48px] rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 text-xs sm:text-sm font-semibold text-white disabled:opacity-40"
                    >
                      No-Ball
                    </button>
                    <button
                      type="button"
                      disabled={!canScoreDelivery}
                      onClick={() => setExtrasModalMode('bye')}
                      className="min-h-[48px] rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 text-xs sm:text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Bye
                    </button>
                    <button
                      type="button"
                      disabled={!canScoreDelivery}
                      onClick={() => setExtrasModalMode('leg-bye')}
                      className="min-h-[48px] rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 text-xs sm:text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Leg-Bye
                    </button>
                    <button
                      type="button"
                      disabled={!canScoreDelivery}
                      onClick={() => setExtrasModalMode('penalty')}
                      className="min-h-[48px] rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 text-xs sm:text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Penalty
                    </button>
                    <button
                      type="button"
                      disabled={!canScoreDelivery}
                      onClick={() => setWicketModalOpen(true)}
                      className="min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-700 text-xs sm:text-sm font-bold text-white disabled:opacity-40"
                    >
                      Wicket
                    </button>
                  </div>

                  {/* Undo & Innings Actions */}
                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5">
                    <button
                      type="button"
                      disabled={currentInnings.balls.length === 0 || isSaving}
                      onClick={() => {
                        void handleUndoLastBall();
                      }}
                      className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#0B100D] hover:bg-[#161F19] border border-white/15 text-xs sm:text-sm font-semibold text-white disabled:opacity-40"
                    >
                      <RotateCcw className="w-4 h-4 text-[#22C55E]" />
                      <span>Undo Last Ball</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      {isTestMatch && match.status !== 'completed' && !recalc.isInningsOver && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => setConfirmDeclareInnings(true)}
                          className="min-h-[44px] px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-xs sm:text-sm font-semibold text-amber-200"
                        >
                          Declare Innings
                        </button>
                      )}

                      {match.status !== 'completed' && !recalc.isInningsOver && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => setConfirmEndInnings(true)}
                          className="min-h-[44px] px-4 rounded-xl bg-[#0D3B24] hover:bg-[#145233] border border-[#22C55E]/35 text-xs sm:text-sm font-semibold text-white"
                        >
                          End Innings {currentInnings.inningsNumber}
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      ) : activeTab === 'scorecard' ? (
        <ScorecardPanel
          match={match}
          innings={
            match.innings[
              Math.min(scorecardInningsIndex, Math.max(0, match.innings.length - 1))
            ] ?? currentInnings
          }
          playerMap={playerMap}
          activeInningsTab={Math.min(
            scorecardInningsIndex,
            Math.max(0, match.innings.length - 1),
          )}
          onSelectInningsTab={setScorecardInningsIndex}
        />
      ) : (
        /* Ball-by-Ball Commentary & Correction */
        <section className="rounded-2xl bg-[#101612] border border-white/10 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-white">
              Ball-by-Ball Commentary
            </h2>
            <span className="text-xs text-[#8FA397]">Tap edit to correct any ball</span>
          </div>

          {recalc.commentary.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#8FA397]">
              No deliveries recorded in this innings yet.
            </p>
          ) : (
            <div className="space-y-2">
              {recalc.commentary.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-[#0B100D] border border-white/10 p-3 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="font-mono text-xs font-bold text-[#4ADE80] tabular-nums shrink-0 mt-0.5">
                      {item.overBallLabel}
                    </span>
                    <p className="text-xs sm:text-sm text-[#D7E4DC] leading-relaxed">{item.text}</p>
                  </div>

                  {match.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => setEditingBall(item.ball)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#8FA397] hover:text-white hover:bg-white/5 shrink-0"
                      aria-label={`Correct ball ${item.overBallLabel}`}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Modals */}
      <ExtrasModal
        mode={extrasModalMode}
        onSubmit={async (payload) => {
          await recordEvent(payload);
        }}
        onClose={() => setExtrasModalMode(null)}
      />

      <WicketModal
        isOpen={wicketModalOpen}
        isFreeHit={recalc.nextBallIsFreeHit}
        striker={strikerPlayer}
        nonStriker={nonStrikerPlayer}
        availableNextBatters={recalc.availableNextBatters
          .map((id) => playerMap.get(id))
          .filter((p): p is Player => Boolean(p))}
        fieldingPlayers={bowlingXI
          .map((id) => playerMap.get(id))
          .filter((p): p is Player => Boolean(p))}
        onConfirm={async (payload) => {
          await recordEvent({
            isWicket: true,
            wicketType: payload.wicketType,
            dismissedPlayerId: payload.dismissedPlayerId,
            incomingBatterId: payload.incomingBatterId,
            fielderId: payload.fielderId,
            runsOffBat: payload.runsOffBat,
            extraType: payload.extraType,
            extras: payload.extras,
          });
        }}
        onClose={() => setWicketModalOpen(false)}
      />

      <BallCorrectionModal
        ball={editingBall}
        onSaveEdit={async (updatedBall) => {
          const nextBalls = currentInnings.balls.map((b) =>
            b.id === updatedBall.id ? updatedBall : b,
          );
          await applyBallListAndSave(nextBalls, {isUndoOrEdit: true});
        }}
        onDeleteBall={async (ballId) => {
          const nextBalls = currentInnings.balls.filter((b) => b.id !== ballId);
          await applyBallListAndSave(nextBalls, {isUndoOrEdit: true});
        }}
        onClose={() => setEditingBall(null)}
      />

      <ConfirmDialog
        isOpen={confirmEndInnings}
        title={`End Innings ${currentInnings.inningsNumber}?`}
        description={`Close ${battingTeamName}'s innings at ${recalc.runs}/${recalc.wickets} (${recalc.oversFormatted} overs).`}
        confirmLabel="End Innings"
        isDanger={false}
        isBusy={isSaving}
        onConfirm={() => {
          void handleEndInningsConfirmed();
        }}
        onCancel={() => setConfirmEndInnings(false)}
      />

      <ConfirmDialog
        isOpen={confirmDeclareInnings}
        title={`Declare Innings ${currentInnings.inningsNumber}?`}
        description={`${battingTeamName} will declare at ${recalc.runs}/${recalc.wickets} (${recalc.oversFormatted} overs).`}
        confirmLabel="Declare Innings"
        isDanger={false}
        isBusy={isSaving}
        onConfirm={() => {
          void handleDeclareInningsConfirmed();
        }}
        onCancel={() => setConfirmDeclareInnings(false)}
      />

      <ConfirmDialog
        isOpen={confirmEndMatch}
        title={isTestMatch ? 'End Test Match / Record Draw?' : 'End Match Now?'}
        description={
          isTestMatch
            ? 'This will complete the Test match and record the official result (or Match Drawn if play concludes without a winner).'
            : 'This will mark the match as Completed and finalize the scorecard and match summary.'
        }
        confirmLabel={isTestMatch ? 'Complete Match' : 'End Match'}
        isDanger={true}
        isBusy={isSaving}
        onConfirm={() => {
          void handleEndMatchConfirmed();
        }}
        onCancel={() => setConfirmEndMatch(false)}
      />
    </div>
  );
};
