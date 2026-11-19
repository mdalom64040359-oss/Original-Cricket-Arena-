import type {
  BallEvent,
  ExtraType,
  Innings,
  Match,
  MatchFormat,
  Player,
  WicketType,
} from '../types/cricket';

export interface ExtrasBreakdown {
  total: number;
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
  penalty: number;
}

export interface BatterScorecardRow {
  playerId: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  dismissalText: string;
  isAtCrease: boolean;
}

export interface BowlerScorecardRow {
  playerId: string;
  name: string;
  legalBalls: number;
  oversFormatted: string;
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy: number;
  wides: number;
  noBalls: number;
}

export interface FallOfWicketItem {
  wicketNumber: number;
  score: number;
  overs: string;
  playerId: string;
  playerName: string;
  dismissalText: string;
}

export interface PartnershipItem {
  index: number;
  batter1Id: string;
  batter1Name: string;
  batter2Id: string;
  batter2Name: string;
  runs: number;
  balls: number;
  isCurrent: boolean;
}

export interface CommentaryItem {
  id: string;
  overBallLabel: string;
  text: string;
  runsTotal: number;
  isWicket: boolean;
  isBoundary: boolean;
  isExtra: boolean;
  ball: BallEvent;
}

export interface RecalculatedInnings {
  runs: number;
  wickets: number;
  maxWickets: number;
  legalBalls: number;
  totalDeliveries: number;
  oversFormatted: string;
  extras: ExtrasBreakdown;
  battingRows: BatterScorecardRow[];
  bowlingRows: BowlerScorecardRow[];
  fallOfWickets: FallOfWicketItem[];
  partnerships: PartnershipItem[];
  currentPartnership: PartnershipItem | null;
  currentOverEvents: BallEvent[];
  commentary: CommentaryItem[];
  currentRunRate: number;
  targetRuns?: number;
  runsRemaining?: number;
  ballsRemaining?: number;
  requiredRunRate?: number;
  derivedStrikerId?: string;
  derivedNonStrikerId?: string;
  derivedBowlerId?: string;
  lastCompletedOverBowlerId?: string;
  overJustCompleted: boolean;
  nextBallIsFreeHit: boolean;
  needsNextBatter: boolean;
  isAllOut: boolean;
  isOversCompleted: boolean;
  isTargetReached: boolean;
  isInningsOver: boolean;
  availableNextBatters: string[];
}

export function formatOvers(legalBalls: number): string {
  const safeBalls = Math.max(0, Math.floor(legalBalls));
  const completedOvers = Math.floor(safeBalls / 6);
  const remainderBalls = safeBalls % 6;
  return `${completedOvers}.${remainderBalls}`;
}

export function isLegalDelivery(ball: BallEvent): boolean {
  if (ball.eventType === 'penalty' || ball.extraType === 'penalty') return false;
  return ball.extraType !== 'wide' && ball.extraType !== 'no-ball';
}

export function isFreeHitSupported(format: MatchFormat): boolean {
  return format !== 'TEST';
}

export function getBallTotalRuns(ball: BallEvent): number {
  return (ball.runsOffBat || 0) + (ball.extras || 0);
}

export function isBowlerCreditedWicket(wicketType?: WicketType): boolean {
  if (!wicketType) return false;
  return wicketType !== 'run-out';
}

export function formatBallBadge(ball: BallEvent): string {
  if (ball.eventType === 'penalty' || ball.extraType === 'penalty') {
    return `P+${ball.extras}`;
  }
  if (ball.isWicket) {
    const runs = getBallTotalRuns(ball);
    if (ball.extraType === 'wide') return `W+${runs}wd`;
    if (ball.extraType === 'no-ball') return `W+${runs}nb`;
    return runs > 0 ? `W+${runs}` : 'W';
  }
  if (ball.extraType === 'wide') {
    return ball.extras > 1 ? `${ball.extras}wd` : 'wd';
  }
  if (ball.extraType === 'no-ball') {
    const total = getBallTotalRuns(ball);
    return total > 1 ? `${total}nb` : 'nb';
  }
  if (ball.extraType === 'bye') {
    return `${ball.extras}b`;
  }
  if (ball.extraType === 'leg-bye') {
    return `${ball.extras}lb`;
  }
  return String(ball.runsOffBat);
}

function formatWicketShort(wicketType?: WicketType, bowlerName?: string): string {
  switch (wicketType) {
    case 'bowled':
      return bowlerName ? `b ${bowlerName}` : 'bowled';
    case 'caught':
      return bowlerName ? `c & b / b ${bowlerName}` : 'caught';
    case 'lbw':
      return bowlerName ? `lbw b ${bowlerName}` : 'lbw';
    case 'stumped':
      return bowlerName ? `st b ${bowlerName}` : 'stumped';
    case 'hit-wicket':
      return bowlerName ? `hit wicket b ${bowlerName}` : 'hit wicket';
    case 'run-out':
      return 'run out';
    default:
      return 'out';
  }
}

export function getFirstBattingTeamId(match: Match): string {
  if (match.tossWinnerId && match.tossDecision) {
    if (match.tossDecision === 'bat') {
      return match.tossWinnerId;
    }
    return match.tossWinnerId === match.teamAId ? match.teamBId : match.teamAId;
  }
  return match.teamAId;
}

export function getTeamPlayingXI(match: Match, teamId: string): string[] {
  return teamId === match.teamAId ? match.teamAPlayingXI : match.teamBPlayingXI;
}

export function recalculateInnings(params: {
  innings: Innings;
  battingXI: string[];
  playerMap: Map<string, Player>;
  format: MatchFormat;
  oversPerInnings: number;
}): RecalculatedInnings {
  const {innings, battingXI, playerMap, format, oversPerInnings} = params;
  const maxWickets = Math.max(1, battingXI.length - 1);
  const freeHitEnabled = isFreeHitSupported(format);

  const getPlayerName = (id?: string): string => {
    if (!id) return 'Unknown';
    return playerMap.get(id)?.name ?? 'Player';
  };

  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;
  let totalDeliveries = 0;

  const extras: ExtrasBreakdown = {
    total: 0,
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0,
    penalty: 0,
  };

  const batterOrder: string[] = [];
  const batterStatsMap = new Map<
    string,
    {
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      isOut: boolean;
      dismissalText: string;
    }
  >();

  const ensureBatter = (id?: string) => {
    if (!id) return;
    if (!batterStatsMap.has(id)) {
      batterOrder.push(id);
      batterStatsMap.set(id, {
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
        dismissalText: 'not out',
      });
    }
  };

  ensureBatter(innings.openingStrikerId);
  ensureBatter(innings.openingNonStrikerId);

  const bowlerOrder: string[] = [];
  const bowlerStatsMap = new Map<
    string,
    {
      legalBalls: number;
      maidens: number;
      runsConceded: number;
      wickets: number;
      wides: number;
      noBalls: number;
    }
  >();

  const ensureBowler = (id?: string) => {
    if (!id) return;
    if (!bowlerStatsMap.has(id)) {
      bowlerOrder.push(id);
      bowlerStatsMap.set(id, {
        legalBalls: 0,
        maidens: 0,
        runsConceded: 0,
        wickets: 0,
        wides: 0,
        noBalls: 0,
      });
    }
  };

  const fallOfWickets: FallOfWicketItem[] = [];
  const partnerships: PartnershipItem[] = [];
  const commentary: CommentaryItem[] = [];

  let activeStrikerId = innings.openingStrikerId;
  let activeNonStrikerId = innings.openingNonStrikerId;
  let activeBowlerId = innings.openingBowlerId;
  let lastCompletedOverBowlerId: string | undefined;
  let overJustCompleted = false;
  let nextBallIsFreeHit = false;
  let needsNextBatter = false;

  // Maiden tracking per over number
  let currentOverConceded = 0;
  let currentOverBowlerId: string | undefined;
  let currentOverLegalCount = 0;

  // Partnership accumulator
  let currentPartnership: {
    batter1Id: string;
    batter2Id: string;
    runs: number;
    balls: number;
  } | null =
    innings.openingStrikerId && innings.openingNonStrikerId
      ? {
          batter1Id: innings.openingStrikerId,
          batter2Id: innings.openingNonStrikerId,
          runs: 0,
          balls: 0,
        }
      : null;

  for (const ball of innings.balls) {
    const isPenalty = ball.eventType === 'penalty' || ball.extraType === 'penalty';

    if (isPenalty) {
      runs += ball.extras;
      extras.total += ball.extras;
      extras.penalty += ball.extras;
      if (currentPartnership) {
        currentPartnership.runs += ball.extras;
      }

      commentary.unshift({
        id: ball.id,
        overBallLabel: formatOvers(legalBalls),
        text: `Penalty Runs: +${ball.extras} runs awarded to batting team.`,
        runsTotal: ball.extras,
        isWicket: false,
        isBoundary: false,
        isExtra: true,
        ball,
      });
      continue;
    }

    totalDeliveries += 1;
    ensureBatter(ball.strikerId);
    ensureBatter(ball.nonStrikerId);
    ensureBowler(ball.bowlerId);

    const legal = isLegalDelivery(ball);
    if (legal) {
      legalBalls += 1;
    }

    const ballTotal = getBallTotalRuns(ball);
    runs += ballTotal;
    extras.total += ball.extras;

    if (ball.extraType === 'wide') {
      extras.wides += ball.extras;
    } else if (ball.extraType === 'no-ball') {
      const subExtras = ball.noBallSubExtras ?? 0;
      const nbPenalty = Math.max(1, ball.extras - subExtras);
      extras.noBalls += nbPenalty;
      if (ball.noBallSubExtraType === 'bye') {
        extras.byes += subExtras;
      } else if (ball.noBallSubExtraType === 'leg-bye') {
        extras.legByes += subExtras;
      }
    } else if (ball.extraType === 'bye') {
      extras.byes += ball.extras;
    } else if (ball.extraType === 'leg-bye') {
      extras.legByes += ball.extras;
    }

    // Batter statistics
    const strikerStat = batterStatsMap.get(ball.strikerId);
    if (strikerStat) {
      if (ball.extraType !== 'wide') {
        strikerStat.balls += 1;
      }
      if (ball.runsOffBat > 0) {
        strikerStat.runs += ball.runsOffBat;
        if (ball.runsOffBat === 4) strikerStat.fours += 1;
        if (ball.runsOffBat === 6) strikerStat.sixes += 1;
      }
    }

    // Bowler statistics
    const bowlerStat = bowlerStatsMap.get(ball.bowlerId);
    let bowlerRunsThisBall = 0;
    if (bowlerStat) {
      if (legal) {
        bowlerStat.legalBalls += 1;
      }
      if (ball.extraType === 'wide') {
        bowlerStat.wides += ball.extras;
        bowlerRunsThisBall = ball.extras;
      } else if (ball.extraType === 'no-ball') {
        const subExtras = ball.noBallSubExtras ?? 0;
        const nbPenalty = Math.max(1, ball.extras - subExtras);
        bowlerStat.noBalls += nbPenalty;
        bowlerRunsThisBall = ball.runsOffBat + nbPenalty;
      } else if (ball.extraType === 'bye' || ball.extraType === 'leg-bye') {
        bowlerRunsThisBall = 0;
      } else {
        bowlerRunsThisBall = ball.runsOffBat;
      }
      bowlerStat.runsConceded += bowlerRunsThisBall;

      if (ball.isWicket && isBowlerCreditedWicket(ball.wicketType)) {
        bowlerStat.wickets += 1;
      }
    }

    // Maiden over check
    if (currentOverBowlerId && currentOverBowlerId !== ball.bowlerId && currentOverLegalCount === 0) {
      currentOverConceded = 0;
    }
    currentOverBowlerId = ball.bowlerId;
    currentOverConceded += bowlerRunsThisBall;
    if (legal) {
      currentOverLegalCount += 1;
      if (currentOverLegalCount === 6) {
        if (currentOverConceded === 0 && bowlerStat) {
          bowlerStat.maidens += 1;
        }
        currentOverConceded = 0;
        currentOverLegalCount = 0;
        currentOverBowlerId = undefined;
      }
    }

    // Partnership update
    if (!currentPartnership) {
      currentPartnership = {
        batter1Id: ball.strikerId,
        batter2Id: ball.nonStrikerId,
        runs: 0,
        balls: 0,
      };
    }
    currentPartnership.runs += ballTotal;
    if (ball.extraType !== 'wide') {
      currentPartnership.balls += 1;
    }

    // Strike rotation from runs crossed on this ball
    let crossingRuns = 0;
    if (ball.extraType === 'wide') {
      crossingRuns = Math.max(0, ball.extras - 1);
    } else if (ball.extraType === 'no-ball') {
      crossingRuns = ball.runsOffBat + (ball.noBallSubExtras ?? 0);
    } else if (ball.extraType === 'bye' || ball.extraType === 'leg-bye') {
      crossingRuns = ball.extras;
    } else {
      crossingRuns = ball.runsOffBat;
    }

    let nextStriker = ball.strikerId;
    let nextNonStriker = ball.nonStrikerId;
    if (crossingRuns % 2 === 1) {
      nextStriker = ball.nonStrikerId;
      nextNonStriker = ball.strikerId;
    }

    // Handle Wicket
    const bowlerName = getPlayerName(ball.bowlerId);
    const strikerName = getPlayerName(ball.strikerId);
    if (ball.isWicket) {
      wickets += 1;
      const outPlayerId = ball.dismissedPlayerId ?? ball.strikerId;
      const outBatterStat = batterStatsMap.get(outPlayerId);
      const dismissalText = formatWicketShort(ball.wicketType, bowlerName);
      if (outBatterStat) {
        outBatterStat.isOut = true;
        outBatterStat.dismissalText = dismissalText;
      }

      const oversAtWicket = formatOvers(legalBalls);
      fallOfWickets.push({
        wicketNumber: wickets,
        score: runs,
        overs: oversAtWicket,
        playerId: outPlayerId,
        playerName: getPlayerName(outPlayerId),
        dismissalText,
      });

      if (currentPartnership) {
        partnerships.push({
          index: partnerships.length + 1,
          batter1Id: currentPartnership.batter1Id,
          batter1Name: getPlayerName(currentPartnership.batter1Id),
          batter2Id: currentPartnership.batter2Id,
          batter2Name: getPlayerName(currentPartnership.batter2Id),
          runs: currentPartnership.runs,
          balls: currentPartnership.balls,
          isCurrent: false,
        });
        currentPartnership = null;
      }

      const survivingBatterId =
        outPlayerId === ball.strikerId ? ball.nonStrikerId : ball.strikerId;

      if (ball.incomingBatterId && wickets < maxWickets) {
        ensureBatter(ball.incomingBatterId);
        // If dismissed player was striker, incoming batter takes vacated end (or swapped if run-out crossed)
        if (outPlayerId === nextStriker) {
          nextStriker = ball.incomingBatterId;
          nextNonStriker = survivingBatterId;
        } else {
          nextNonStriker = ball.incomingBatterId;
          nextStriker = survivingBatterId;
        }
        currentPartnership = {
          batter1Id: nextStriker,
          batter2Id: nextNonStriker,
          runs: 0,
          balls: 0,
        };
        needsNextBatter = false;
      } else if (wickets < maxWickets) {
        needsNextBatter = true;
        nextStriker = survivingBatterId;
        nextNonStriker = survivingBatterId;
      } else {
        needsNextBatter = false;
      }
    } else {
      needsNextBatter = false;
    }

    // Over completion & end-of-over strike swap
    if (legal && legalBalls % 6 === 0) {
      overJustCompleted = true;
      lastCompletedOverBowlerId = ball.bowlerId;
      if (!needsNextBatter) {
        const temp = nextStriker;
        nextStriker = nextNonStriker;
        nextNonStriker = temp;
      }
    } else {
      overJustCompleted = false;
    }

    // Free Hit tracking
    if (freeHitEnabled) {
      if (ball.extraType === 'no-ball') {
        nextBallIsFreeHit = true;
      } else if (legal) {
        nextBallIsFreeHit = false;
      }
      // If wide, nextBallIsFreeHit stays whatever it was before!
    } else {
      nextBallIsFreeHit = false;
    }

    activeStrikerId = nextStriker;
    activeNonStrikerId = nextNonStriker;
    activeBowlerId = ball.bowlerId;

    // Commentary entry
    const overDisplay = legal
      ? `${Math.floor((legalBalls - 1) / 6)}.${((legalBalls - 1) % 6) + 1}`
      : `${Math.floor(legalBalls / 6)}.${(legalBalls % 6) + 1}*`;

    let commText = `${bowlerName} to ${strikerName}: `;
    if (ball.isWicket) {
      const outName = getPlayerName(ball.dismissedPlayerId ?? ball.strikerId);
      commText += `OUT (${(ball.wicketType ?? 'wicket').replace('-', ' ')})! ${outName} departs.`;
    } else if (ball.extraType === 'wide') {
      commText += ball.extras > 1 ? `WIDE + ${ball.extras - 1} run(s).` : 'WIDE ball.';
    } else if (ball.extraType === 'no-ball') {
      const freeHitNote = freeHitEnabled ? ' Free Hit next.' : '';
      commText +=
        ball.runsOffBat > 0
          ? `NO-BALL + ${ball.runsOffBat} off the bat!${freeHitNote}`
          : ball.noBallSubExtras
            ? `NO-BALL + ${ball.noBallSubExtras} ${ball.noBallSubExtraType ?? 'extra'}(s)!${freeHitNote}`
            : `NO-BALL!${freeHitNote}`;
    } else if (ball.extraType === 'bye') {
      commText += `${ball.extras} bye${ball.extras === 1 ? '' : 's'}.`;
    } else if (ball.extraType === 'leg-bye') {
      commText += `${ball.extras} leg bye${ball.extras === 1 ? '' : 's'}.`;
    } else if (ball.runsOffBat === 6) {
      commText += 'SIX! Cleared the boundary.';
    } else if (ball.runsOffBat === 4) {
      commText += 'FOUR! Cracked to the boundary.';
    } else if (ball.runsOffBat === 0) {
      commText += 'Dot ball, solid defense.';
    } else {
      commText += `${ball.runsOffBat} run${ball.runsOffBat === 1 ? '' : 's'}.`;
    }

    commentary.unshift({
      id: ball.id,
      overBallLabel: overDisplay,
      text: commText,
      runsTotal: ballTotal,
      isWicket: ball.isWicket,
      isBoundary: ball.runsOffBat === 4 || ball.runsOffBat === 6,
      isExtra: Boolean(ball.extraType),
      ball,
    });
  }

  // Respect explicit current overrides stored on innings (e.g., manual swap ends, incoming batter selected, or new bowler chosen)
  const lastBall = innings.balls[innings.balls.length - 1];
  const resolvedStrikerId =
    innings.currentStrikerId ?? activeStrikerId ?? innings.openingStrikerId;
  const resolvedNonStrikerId =
    innings.currentNonStrikerId ?? activeNonStrikerId ?? innings.openingNonStrikerId;
  const resolvedBowlerId = innings.currentBowlerId ?? activeBowlerId ?? innings.openingBowlerId;

  // Check if next batter was already chosen via innings override after a wicket
  const dismissedIds = new Set(
    innings.balls
      .filter((b) => b.isWicket)
      .map((b) => b.dismissedPlayerId ?? b.strikerId),
  );
  if (
    needsNextBatter &&
    resolvedStrikerId &&
    resolvedNonStrikerId &&
    resolvedStrikerId !== resolvedNonStrikerId &&
    !dismissedIds.has(resolvedStrikerId) &&
    !dismissedIds.has(resolvedNonStrikerId)
  ) {
    needsNextBatter = false;
  }

  if (resolvedStrikerId) ensureBatter(resolvedStrikerId);
  if (resolvedNonStrikerId) ensureBatter(resolvedNonStrikerId);

  if (
    !currentPartnership &&
    !needsNextBatter &&
    resolvedStrikerId &&
    resolvedNonStrikerId &&
    resolvedStrikerId !== resolvedNonStrikerId &&
    wickets < maxWickets
  ) {
    currentPartnership = {
      batter1Id: resolvedStrikerId,
      batter2Id: resolvedNonStrikerId,
      runs: 0,
      balls: 0,
    };
  }

  const activePartnershipItem: PartnershipItem | null = currentPartnership
    ? {
        index: partnerships.length + 1,
        batter1Id: currentPartnership.batter1Id,
        batter1Name: getPlayerName(currentPartnership.batter1Id),
        batter2Id: currentPartnership.batter2Id,
        batter2Name: getPlayerName(currentPartnership.batter2Id),
        runs: currentPartnership.runs,
        balls: currentPartnership.balls,
        isCurrent: true,
      }
    : null;

  const allPartnerships = activePartnershipItem
    ? [...partnerships, activePartnershipItem]
    : partnerships;

  const battingRows: BatterScorecardRow[] = batterOrder.map((id) => {
    const s = batterStatsMap.get(id)!;
    const isAtCrease = !s.isOut && (id === resolvedStrikerId || id === resolvedNonStrikerId);
    return {
      playerId: id,
      name: getPlayerName(id),
      runs: s.runs,
      balls: s.balls,
      fours: s.fours,
      sixes: s.sixes,
      strikeRate: s.balls > 0 ? Number(((s.runs * 100) / s.balls).toFixed(1)) : 0,
      isOut: s.isOut,
      dismissalText: s.isOut ? s.dismissalText : isAtCrease ? 'batting' : 'not out',
      isAtCrease,
    };
  });

  const bowlingRows: BowlerScorecardRow[] = bowlerOrder.map((id) => {
    const b = bowlerStatsMap.get(id)!;
    return {
      playerId: id,
      name: getPlayerName(id),
      legalBalls: b.legalBalls,
      oversFormatted: formatOvers(b.legalBalls),
      maidens: b.maidens,
      runsConceded: b.runsConceded,
      wickets: b.wickets,
      economy: b.legalBalls > 0 ? Number(((b.runsConceded * 6) / b.legalBalls).toFixed(2)) : 0,
      wides: b.wides,
      noBalls: b.noBalls,
    };
  });

  const currentOverNumber =
    overJustCompleted && lastBall
      ? Math.floor((legalBalls - 1) / 6)
      : Math.floor(legalBalls / 6);

  const currentOverEvents = innings.balls.filter(
    (b) => b.eventType !== 'penalty' && b.extraType !== 'penalty' && b.overNumber === currentOverNumber,
  );

  const currentRunRate = legalBalls > 0 ? Number(((runs * 6) / legalBalls).toFixed(2)) : 0;
  const targetRuns = innings.targetRuns;
  const isAllOut = wickets >= maxWickets;
  const isOversCompleted = format !== 'TEST' && legalBalls >= oversPerInnings * 6;
  const isTargetReached = targetRuns !== undefined && runs >= targetRuns;
  const isInningsOver =
    innings.isCompleted || Boolean(innings.declared) || isAllOut || isOversCompleted || isTargetReached;

  let runsRemaining: number | undefined;
  let ballsRemaining: number | undefined;
  let requiredRunRate: number | undefined;

  if (targetRuns !== undefined) {
    runsRemaining = Math.max(0, targetRuns - runs);
    if (format !== 'TEST') {
      ballsRemaining = Math.max(0, oversPerInnings * 6 - legalBalls);
      requiredRunRate =
        ballsRemaining > 0 && runsRemaining > 0
          ? Number(((runsRemaining * 6) / ballsRemaining).toFixed(2))
          : 0;
    }
  }

  const usedBatters = new Set<string>([...dismissedIds]);
  if (resolvedStrikerId) usedBatters.add(resolvedStrikerId);
  if (resolvedNonStrikerId) usedBatters.add(resolvedNonStrikerId);
  const availableNextBatters = battingXI.filter((id) => !usedBatters.has(id));

  return {
    runs,
    wickets,
    maxWickets,
    legalBalls,
    totalDeliveries,
    oversFormatted: formatOvers(legalBalls),
    extras,
    battingRows,
    bowlingRows,
    fallOfWickets,
    partnerships: allPartnerships,
    currentPartnership: activePartnershipItem,
    currentOverEvents,
    commentary,
    currentRunRate,
    targetRuns,
    runsRemaining,
    ballsRemaining,
    requiredRunRate,
    derivedStrikerId: resolvedStrikerId,
    derivedNonStrikerId: resolvedNonStrikerId,
    derivedBowlerId: resolvedBowlerId,
    lastCompletedOverBowlerId,
    overJustCompleted,
    nextBallIsFreeHit,
    needsNextBatter,
    isAllOut,
    isOversCompleted,
    isTargetReached,
    isInningsOver,
    availableNextBatters,
  };
}

export function computeLimitedOversResult(match: Match): string {
  if (match.innings.length < 2) {
    return 'Match ended.';
  }
  const first = match.innings[0];
  const second = match.innings[1];
  const firstName = first.battingTeamId === match.teamAId ? match.teamAName : match.teamBName;
  const secondName = second.battingTeamId === match.teamAId ? match.teamAName : match.teamBName;
  const secondXI = getTeamPlayingXI(match, second.battingTeamId);
  const maxWickets = Math.max(1, secondXI.length - 1);

  if (second.runs > first.runs) {
    const remainingWickets = Math.max(1, maxWickets - second.wickets);
    return `${secondName} won by ${remainingWickets} wicket${remainingWickets === 1 ? '' : 's'}`;
  }
  if (first.runs > second.runs) {
    const diff = first.runs - second.runs;
    return `${firstName} won by ${diff} run${diff === 1 ? '' : 's'}`;
  }
  return 'Match Tied';
}

export interface FormatRules {
  format: MatchFormat;
  maxInnings: number;
  hasOversLimit: boolean;
  freeHitEnabled: boolean;
  maxDays: number;
}

export function getFormatRules(format: MatchFormat, testMaxDays = 5): FormatRules {
  if (format === 'TEST') {
    return {
      format,
      maxInnings: 4,
      hasOversLimit: false,
      freeHitEnabled: false,
      maxDays: Math.min(5, Math.max(1, testMaxDays)),
    };
  }
  return {
    format,
    maxInnings: 2,
    hasOversLimit: true,
    freeHitEnabled: true,
    maxDays: 1,
  };
}

export function getFollowOnThreshold(testMaxDays = 5): number {
  if (testMaxDays >= 5) return 200;
  if (testMaxDays >= 3) return 150;
  if (testMaxDays === 2) return 100;
  return 75;
}

export interface TestMatchSituation {
  teamATotal: number;
  teamBTotal: number;
  leadDeficitText: string;
  followOnThreshold: number;
  canEnforceFollowOn: boolean;
  inningsVictoryResult: string | null;
  inningsVictoryWinnerId?: string;
  nextInningsConfig: {
    normalBattingTeamId: string;
    normalBowlingTeamId: string;
    followOnBattingTeamId?: string;
    followOnBowlingTeamId?: string;
    targetRuns?: number;
  } | null;
}

export function computeTestMatchSituation(match: Match): TestMatchSituation {
  const maxDays = match.testMaxDays ?? 5;
  const followOnThreshold = getFollowOnThreshold(maxDays);

  const getTeamName = (id: string) => (id === match.teamAId ? match.teamAName : match.teamBName);

  let teamATotal = 0;
  let teamBTotal = 0;
  match.innings.forEach((inn) => {
    if (inn.battingTeamId === match.teamAId) teamATotal += inn.runs;
    else teamBTotal += inn.runs;
  });

  const current = match.innings[match.currentInningsIndex];
  let leadDeficitText = `Day ${match.testCurrentDay ?? 1} of ${maxDays}`;

  if (current) {
    const batTeamId = current.battingTeamId;
    const batTotal = batTeamId === match.teamAId ? teamATotal : teamBTotal;
    const bowlTotal = batTeamId === match.teamAId ? teamBTotal : teamATotal;
    const batName = getTeamName(batTeamId);
    const diff = batTotal - bowlTotal;

    if (match.innings.length === 1) {
      leadDeficitText = `${batName} 1st Innings`;
    } else if (current.targetRuns !== undefined) {
      const remaining = Math.max(0, current.targetRuns - current.runs);
      leadDeficitText =
        remaining === 0 ? `${batName} reached target` : `${batName} need ${remaining} runs to win`;
    } else if (diff > 0) {
      leadDeficitText = `${batName} lead by ${diff} run${diff === 1 ? '' : 's'}`;
    } else if (diff < 0) {
      const trail = Math.abs(diff);
      leadDeficitText = `${batName} trail by ${trail} run${trail === 1 ? '' : 's'}`;
    } else {
      leadDeficitText = 'Scores level';
    }
  }

  let canEnforceFollowOn = false;
  let inningsVictoryResult: string | null = null;
  let inningsVictoryWinnerId: string | undefined;
  let nextInningsConfig: TestMatchSituation['nextInningsConfig'] = null;

  if (match.innings.length === 1 && match.innings[0].isCompleted) {
    const first = match.innings[0];
    nextInningsConfig = {
      normalBattingTeamId: first.bowlingTeamId,
      normalBowlingTeamId: first.battingTeamId,
    };
  } else if (match.innings.length === 2 && match.innings[1].isCompleted) {
    const inn1 = match.innings[0];
    const inn2 = match.innings[1];
    const lead = inn1.runs - inn2.runs;
    canEnforceFollowOn = lead >= followOnThreshold;
    nextInningsConfig = {
      normalBattingTeamId: inn1.battingTeamId,
      normalBowlingTeamId: inn1.bowlingTeamId,
      followOnBattingTeamId: canEnforceFollowOn ? inn2.battingTeamId : undefined,
      followOnBowlingTeamId: canEnforceFollowOn ? inn2.bowlingTeamId : undefined,
    };
  } else if (match.innings.length === 3 && match.innings[2].isCompleted) {
    // Determine which team batted twice vs once across innings 1..3
    const counts = new Map<string, number>();
    const totals = new Map<string, number>();
    match.innings.forEach((inn) => {
      counts.set(inn.battingTeamId, (counts.get(inn.battingTeamId) ?? 0) + 1);
      totals.set(inn.battingTeamId, (totals.get(inn.battingTeamId) ?? 0) + inn.runs);
    });

    let twiceTeamId = match.teamAId;
    let onceTeamId = match.teamBId;
    if ((counts.get(match.teamBId) ?? 0) === 2) {
      twiceTeamId = match.teamBId;
      onceTeamId = match.teamAId;
    }

    const twiceTotal = totals.get(twiceTeamId) ?? 0;
    const onceTotal = totals.get(onceTeamId) ?? 0;

    if (twiceTotal < onceTotal) {
      const margin = onceTotal - twiceTotal;
      inningsVictoryWinnerId = onceTeamId;
      inningsVictoryResult = `${getTeamName(onceTeamId)} won by an innings and ${margin} run${margin === 1 ? '' : 's'}`;
    } else {
      const targetRuns = twiceTotal - onceTotal + 1;
      nextInningsConfig = {
        normalBattingTeamId: onceTeamId,
        normalBowlingTeamId: twiceTeamId,
        targetRuns,
      };
    }
  }

  return {
    teamATotal,
    teamBTotal,
    leadDeficitText,
    followOnThreshold,
    canEnforceFollowOn,
    inningsVictoryResult,
    inningsVictoryWinnerId,
    nextInningsConfig,
  };
}

export function computeTestMatchResult(match: Match): string {
  const situation = computeTestMatchSituation(match);
  if (situation.inningsVictoryResult) {
    return situation.inningsVictoryResult;
  }

  if (match.innings.length === 4) {
    const fourth = match.innings[3];
    const chasingTeamId = fourth.battingTeamId;
    const defendingTeamId = fourth.bowlingTeamId;
    const chasingName = chasingTeamId === match.teamAId ? match.teamAName : match.teamBName;
    const defendingName = defendingTeamId === match.teamAId ? match.teamAName : match.teamBName;

    const chasingTotal = chasingTeamId === match.teamAId ? situation.teamATotal : situation.teamBTotal;
    const defendingTotal =
      defendingTeamId === match.teamAId ? situation.teamATotal : situation.teamBTotal;

    const chasingXI = getTeamPlayingXI(match, chasingTeamId);
    const maxWickets = Math.max(1, chasingXI.length - 1);

    if (chasingTotal > defendingTotal) {
      const remainingWickets = Math.max(1, maxWickets - fourth.wickets);
      return `${chasingName} won by ${remainingWickets} wicket${remainingWickets === 1 ? '' : 's'}`;
    }

    if (fourth.isCompleted) {
      if (chasingTotal === defendingTotal) {
        return 'Match Tied';
      }
      const runMargin = defendingTotal - chasingTotal;
      return `${defendingName} won by ${runMargin} run${runMargin === 1 ? '' : 's'}`;
    }
  }

  return 'Match Drawn';
}

export function computeMatchResult(match: Match): string {
  if (match.format === 'TEST') {
    return computeTestMatchResult(match);
  }
  return computeLimitedOversResult(match);
}

export function validateFormatSettings(
  format: MatchFormat,
  oversPerInnings: number,
  testMaxDays = 5,
): string | null {
  if (format === 'T10' && oversPerInnings !== 10) {
    return 'T10 matches must have exactly 10 overs per innings.';
  }
  if (format === 'T20' && oversPerInnings !== 20) {
    return 'T20 matches must have exactly 20 overs per innings.';
  }
  if (format === 'ODI' && oversPerInnings !== 50) {
    return 'ODI matches must have exactly 50 overs per innings.';
  }
  if (format === 'CUSTOM') {
    if (!Number.isInteger(oversPerInnings) || oversPerInnings < 1 || oversPerInnings > 450) {
      return 'Custom Overs must be a whole number between 1 and 450.';
    }
  }
  if (format === 'TEST') {
    if (!Number.isInteger(testMaxDays) || testMaxDays < 1 || testMaxDays > 5) {
      return 'Test match duration must be between 1 and 5 days.';
    }
    if (!Number.isInteger(oversPerInnings) || oversPerInnings < 10 || oversPerInnings > 150) {
      return 'Daily overs quota for Test cricket must be between 10 and 150.';
    }
  }
  return null;
}
