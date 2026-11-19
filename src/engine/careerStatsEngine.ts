import {
  formatOvers,
  getTeamPlayingXI,
  isBowlerCreditedWicket,
  isLegalDelivery,
  recalculateInnings,
} from './scoringEngine';
import type {
  CareerFormatKey,
  ExternalFormatCareerEntry,
  ExternalLeagueCareerEntry,
  Match,
  NullableBattingCareerStats,
  NullableBowlingCareerStats,
  NullableFieldingCareerStats,
  Player,
  Team,
} from '../types/cricket';
import {MAJOR_CRICKET_LEAGUES} from '../types/cricket';

export interface ResolvedCareerBucket {
  formatKey: CareerFormatKey;
  label: string;
  hasAnyData: boolean;
  batting: Required<NullableBattingCareerStats>;
  bowling: Required<NullableBowlingCareerStats>;
  fielding: Required<NullableFieldingCareerStats>;
  highestPartnershipRuns: number | null;
  highestPartnershipDetail: string | null;
  playerOfTheMatchCount: number | null;
  bestInningsFours: number | null;
  bestInningsSixes: number | null;
  highestInningsStrikeRate: number | null;
  source: string;
  lastUpdated: string | null;
}

export interface ResolvedLeagueRow {
  leagueName: string;
  hasData: boolean;
  batting: Required<NullableBattingCareerStats>;
  bowling: Required<NullableBowlingCareerStats>;
  fielding: Required<NullableFieldingCareerStats>;
  playerOfTheMatchCount: number | null;
  source: string;
  lastUpdated: string | null;
}

export interface PlayerLocalMatchLog {
  matchId: string;
  matchTitle: string;
  matchDate: string;
  formatLabel: string;
  tournamentName?: string;
  teamShortName: string;
  opponentShortName: string;
  resultSummary?: string;
  battingText: string | null;
  bowlingText: string | null;
  fieldingText: string | null;
  isPlayerOfTheMatch: boolean;
}

export interface ComputedPlayerCareerProfile {
  player: Player;
  currentTeamName: string | null;
  currentTeamShortName: string | null;
  buckets: Record<CareerFormatKey, ResolvedCareerBucket>;
  leagues: ResolvedLeagueRow[];
  localMatchLogs: PlayerLocalMatchLog[];
  overallSource: string;
  overallLastUpdated: string | null;
}

export const FORMAT_TAB_META: Array<{key: CareerFormatKey; label: string; shortLabel: string}> = [
  {key: 'all', label: 'All Format Career', shortLabel: 'All Formats'},
  {key: 'test', label: 'Test Career', shortLabel: 'Test'},
  {key: 'odi', label: 'ODI Career', shortLabel: 'ODI'},
  {key: 't20i', label: 'T20I Career', shortLabel: 'T20I'},
  {key: 't20-league', label: 'T20 League Career', shortLabel: 'T20 League'},
  {key: 'domestic', label: 'Domestic Career', shortLabel: 'Domestic'},
];

const EMPTY_BATTING: Required<NullableBattingCareerStats> = {
  matches: null,
  innings: null,
  runs: null,
  ballsFaced: null,
  highestScore: null,
  highestScoreIsNotOut: null,
  average: null,
  strikeRate: null,
  fours: null,
  sixes: null,
  hundreds: null,
  fifties: null,
  doubleHundreds: null,
  notOuts: null,
  ducks: null,
};

const EMPTY_BOWLING: Required<NullableBowlingCareerStats> = {
  matches: null,
  innings: null,
  balls: null,
  oversDisplay: null,
  wickets: null,
  runsConceded: null,
  average: null,
  economy: null,
  strikeRate: null,
  bestBowlingWickets: null,
  bestBowlingRuns: null,
  bestBowlingDisplay: null,
  fourWickets: null,
  fiveWickets: null,
  tenWickets: null,
};

const EMPTY_FIELDING: Required<NullableFieldingCareerStats> = {
  catches: null,
  runOuts: null,
  stumpings: null,
  totalDismissals: null,
};

export function formatStatNumber(
  value: number | null | undefined,
  decimals = 0,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'Not Available';
  }
  return decimals > 0 ? value.toFixed(decimals) : String(value);
}

export function formatStatText(value: string | null | undefined): string {
  if (!value || !value.trim()) return 'Not Available';
  return value.trim();
}

export function formatHighScore(
  score: number | null | undefined,
  isNotOut?: boolean | null,
): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return 'Not Available';
  }
  return `${score}${isNotOut ? '*' : ''}`;
}

export function formatLastUpdatedDisplay(iso?: string | null): string {
  if (!iso || !iso.trim()) return 'Not Available';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function detectLeagueName(tournamentName?: string): string {
  if (!tournamentName || !tournamentName.trim()) {
    return 'Other Competitions';
  }
  const n = tournamentName.trim().toLowerCase();

  if (n.includes('ipl') || n.includes('indian premier')) return 'IPL';
  if (n.includes('bpl') || n.includes('bangladesh premier')) return 'BPL';
  if (n.includes('bbl') || n.includes('big bash')) return 'BBL';
  if (n.includes('psl') || n.includes('pakistan super')) return 'PSL';
  if (n.includes('cpl') || n.includes('caribbean premier')) return 'CPL';
  if (n.includes('lpl') || n.includes('lanka premier')) return 'LPL';
  if (n.includes('sa20')) return 'SA20';
  if (n.includes('ilt20') || n.includes('international league t20')) return 'ILT20';
  if (n.includes('global t20 canada') || n.includes('gt20')) return 'Global T20 Canada';
  if (n.includes('canada 60') || n.includes('canada60') || n.includes('super 60')) return 'Canada 60';
  if (n.includes('european cricket league') || /\becl\b/.test(n)) return 'European Cricket League';

  return 'Other Competitions';
}

export function resolveCompetitionDisplayName(tournamentName?: string): string | null {
  const trimmed = tournamentName?.trim();
  if (!trimmed) return null;
  const majorLeague = detectLeagueName(trimmed);
  if (majorLeague !== 'Other Competitions') return majorLeague;
  return trimmed;
}

export function resolveMatchCareerFormatKey(
  match: Match,
): Exclude<CareerFormatKey, 'all'> {
  if (match.format === 'TEST') return 'test';
  if (match.format === 'ODI') return 'odi';

  if (match.competitionCategory === 'international') return 't20i';
  if (match.competitionCategory === 't20-league') return 't20-league';
  if (match.competitionCategory === 'domestic') return 'domestic';

  const league = detectLeagueName(match.tournamentName);
  if (league !== 'Other Competitions') return 't20-league';

  const tName = (match.tournamentName || match.title || '').toLowerCase();
  if (/\bt20i\b|international/.test(tName)) return 't20i';
  if (/league|premier|super|t20|t10/.test(tName) && match.tournamentId) return 't20-league';
  return 'domestic';
}

interface LocalAccumulator {
  matchIds: Set<string>;
  battingInnings: number;
  runs: number;
  ballsFaced: number;
  hasBatEntry: boolean;
  highestScore: number;
  highestScoreIsNotOut: boolean;
  fours: number;
  sixes: number;
  hundreds: number;
  fifties: number;
  doubleHundreds: number;
  notOuts: number;
  ducks: number;
  bestInningsFours: number;
  bestInningsSixes: number;
  highestInningsSR: number;

  bowlingInnings: number;
  legalBalls: number;
  wickets: number;
  runsConceded: number;
  hasBowlEntry: boolean;
  bestBowlWkts: number;
  bestBowlRuns: number;
  fourWickets: number;
  fiveWickets: number;
  tenWickets: number;

  catches: number;
  runOuts: number;
  stumpings: number;
  anyFieldingRecordedInMatches: boolean;

  highestPartnershipRuns: number | null;
  highestPartnershipDetail: string | null;

  potmMatchesKnown: boolean;
  potmCount: number;
  latestUpdatedAt: string | null;
}

function createLocalAccumulator(): LocalAccumulator {
  return {
    matchIds: new Set(),
    battingInnings: 0,
    runs: 0,
    ballsFaced: 0,
    hasBatEntry: false,
    highestScore: 0,
    highestScoreIsNotOut: false,
    fours: 0,
    sixes: 0,
    hundreds: 0,
    fifties: 0,
    doubleHundreds: 0,
    notOuts: 0,
    ducks: 0,
    bestInningsFours: 0,
    bestInningsSixes: 0,
    highestInningsSR: 0,
    bowlingInnings: 0,
    legalBalls: 0,
    wickets: 0,
    runsConceded: 0,
    hasBowlEntry: false,
    bestBowlWkts: -1,
    bestBowlRuns: 99999,
    fourWickets: 0,
    fiveWickets: 0,
    tenWickets: 0,
    catches: 0,
    runOuts: 0,
    stumpings: 0,
    anyFieldingRecordedInMatches: false,
    highestPartnershipRuns: null,
    highestPartnershipDetail: null,
    potmMatchesKnown: false,
    potmCount: 0,
    latestUpdatedAt: null,
  };
}

function pickLatestIso(a?: string | null, b?: string | null): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
}

function addNullable(a: number | null | undefined, b: number | null | undefined): number | null {
  const hasA = a !== null && a !== undefined && Number.isFinite(a);
  const hasB = b !== null && b !== undefined && Number.isFinite(b);
  if (!hasA && !hasB) return null;
  return (hasA ? a! : 0) + (hasB ? b! : 0);
}

function pickHigherNullable(a: number | null | undefined, b: number | null | undefined): number | null {
  const hasA = a !== null && a !== undefined && Number.isFinite(a);
  const hasB = b !== null && b !== undefined && Number.isFinite(b);
  if (!hasA && !hasB) return null;
  if (!hasA) return b!;
  if (!hasB) return a!;
  return Math.max(a!, b!);
}

function isBetterBowling(
  wA: number,
  rA: number,
  wB: number,
  rB: number,
): boolean {
  return wA > wB || (wA === wB && rA < rB);
}

function localAccToBucket(
  formatKey: CareerFormatKey,
  label: string,
  acc: LocalAccumulator,
): ResolvedCareerBucket {
  const matchCount = acc.matchIds.size;
  if (matchCount === 0) {
    return {
      formatKey,
      label,
      hasAnyData: false,
      batting: {...EMPTY_BATTING},
      bowling: {...EMPTY_BOWLING},
      fielding: {...EMPTY_FIELDING},
      highestPartnershipRuns: null,
      highestPartnershipDetail: null,
      playerOfTheMatchCount: null,
      bestInningsFours: null,
      bestInningsSixes: null,
      highestInningsStrikeRate: null,
      source: 'No Data Recorded',
      lastUpdated: null,
    };
  }

  const dismissals = acc.battingInnings - acc.notOuts;
  const batAvg =
    acc.hasBatEntry && dismissals > 0
      ? Number((acc.runs / dismissals).toFixed(2))
      : null;
  const batSR =
    acc.hasBatEntry && acc.ballsFaced > 0
      ? Number(((acc.runs * 100) / acc.ballsFaced).toFixed(2))
      : null;

  const bowlAvg =
    acc.hasBowlEntry && acc.wickets > 0
      ? Number((acc.runsConceded / acc.wickets).toFixed(2))
      : null;
  const bowlEcon =
    acc.hasBowlEntry && acc.legalBalls > 0
      ? Number(((acc.runsConceded * 6) / acc.legalBalls).toFixed(2))
      : null;
  const bowlSR =
    acc.hasBowlEntry && acc.wickets > 0
      ? Number((acc.legalBalls / acc.wickets).toFixed(2))
      : null;

  const hasFieldingData = acc.anyFieldingRecordedInMatches;
  const totalDismissals = hasFieldingData ? acc.catches + acc.runOuts + acc.stumpings : null;

  return {
    formatKey,
    label,
    hasAnyData: true,
    batting: {
      matches: matchCount,
      innings: acc.hasBatEntry ? acc.battingInnings : null,
      runs: acc.hasBatEntry ? acc.runs : null,
      ballsFaced: acc.hasBatEntry ? acc.ballsFaced : null,
      highestScore: acc.hasBatEntry ? acc.highestScore : null,
      highestScoreIsNotOut: acc.hasBatEntry ? acc.highestScoreIsNotOut : null,
      average: batAvg,
      strikeRate: batSR,
      fours: acc.hasBatEntry ? acc.fours : null,
      sixes: acc.hasBatEntry ? acc.sixes : null,
      hundreds: acc.hasBatEntry ? acc.hundreds : null,
      fifties: acc.hasBatEntry ? acc.fifties : null,
      doubleHundreds: acc.hasBatEntry ? acc.doubleHundreds : null,
      notOuts: acc.hasBatEntry ? acc.notOuts : null,
      ducks: acc.hasBatEntry ? acc.ducks : null,
    },
    bowling: {
      matches: matchCount,
      innings: acc.hasBowlEntry ? acc.bowlingInnings : null,
      balls: acc.hasBowlEntry ? acc.legalBalls : null,
      oversDisplay: acc.hasBowlEntry ? formatOvers(acc.legalBalls) : null,
      wickets: acc.hasBowlEntry ? acc.wickets : null,
      runsConceded: acc.hasBowlEntry ? acc.runsConceded : null,
      average: bowlAvg,
      economy: bowlEcon,
      strikeRate: bowlSR,
      bestBowlingWickets: acc.hasBowlEntry && acc.bestBowlWkts >= 0 ? acc.bestBowlWkts : null,
      bestBowlingRuns: acc.hasBowlEntry && acc.bestBowlWkts >= 0 ? acc.bestBowlRuns : null,
      bestBowlingDisplay:
        acc.hasBowlEntry && acc.bestBowlWkts >= 0
          ? `${acc.bestBowlWkts}/${acc.bestBowlRuns}`
          : null,
      fourWickets: acc.hasBowlEntry ? acc.fourWickets : null,
      fiveWickets: acc.hasBowlEntry ? acc.fiveWickets : null,
      tenWickets: acc.hasBowlEntry ? acc.tenWickets : null,
    },
    fielding: {
      catches: hasFieldingData ? acc.catches : null,
      runOuts: hasFieldingData ? acc.runOuts : null,
      stumpings: hasFieldingData ? acc.stumpings : null,
      totalDismissals,
    },
    highestPartnershipRuns: acc.highestPartnershipRuns,
    highestPartnershipDetail: acc.highestPartnershipDetail,
    playerOfTheMatchCount: acc.potmMatchesKnown ? acc.potmCount : null,
    bestInningsFours: acc.hasBatEntry ? acc.bestInningsFours : null,
    bestInningsSixes: acc.hasBatEntry ? acc.bestInningsSixes : null,
    highestInningsStrikeRate:
      acc.hasBatEntry && acc.highestInningsSR > 0 ? acc.highestInningsSR : null,
    source: 'Local Match Records',
    lastUpdated: acc.latestUpdatedAt,
  };
}

function externalEntryToBucket(
  formatKey: CareerFormatKey,
  label: string,
  entry: ExternalFormatCareerEntry | ExternalLeagueCareerEntry,
): ResolvedCareerBucket {
  const b = entry.batting ?? {};
  const bw = entry.bowling ?? {};
  const fl = entry.fielding ?? {};

  const catches = fl.catches ?? null;
  const runOuts = fl.runOuts ?? null;
  const stumpings = fl.stumpings ?? null;
  const derivedTotalDismissals =
    fl.totalDismissals !== undefined && fl.totalDismissals !== null
      ? fl.totalDismissals
      : catches !== null || runOuts !== null || stumpings !== null
        ? (catches ?? 0) + (runOuts ?? 0) + (stumpings ?? 0)
        : null;

  const ballsBowled = bw.balls ?? null;
  const oversDisplay =
    bw.oversDisplay ?? (ballsBowled !== null ? formatOvers(ballsBowled) : null);

  let bestDisplay = bw.bestBowlingDisplay ?? null;
  if (
    !bestDisplay &&
    bw.bestBowlingWickets !== null &&
    bw.bestBowlingWickets !== undefined &&
    bw.bestBowlingRuns !== null &&
    bw.bestBowlingRuns !== undefined
  ) {
    bestDisplay = `${bw.bestBowlingWickets}/${bw.bestBowlingRuns}`;
  }

  const derivedBatAvg =
    b.average !== undefined && b.average !== null
      ? b.average
      : b.runs !== null &&
          b.runs !== undefined &&
          b.innings !== null &&
          b.innings !== undefined &&
          b.notOuts !== null &&
          b.notOuts !== undefined &&
          b.innings - b.notOuts > 0
        ? Number((b.runs / (b.innings - b.notOuts)).toFixed(2))
        : null;

  const derivedBatSR =
    b.strikeRate !== undefined && b.strikeRate !== null
      ? b.strikeRate
      : b.runs !== null &&
          b.runs !== undefined &&
          b.ballsFaced !== null &&
          b.ballsFaced !== undefined &&
          b.ballsFaced > 0
        ? Number(((b.runs * 100) / b.ballsFaced).toFixed(2))
        : null;

  const derivedBowlAvg =
    bw.average !== undefined && bw.average !== null
      ? bw.average
      : bw.runsConceded !== null &&
          bw.runsConceded !== undefined &&
          bw.wickets !== null &&
          bw.wickets !== undefined &&
          bw.wickets > 0
        ? Number((bw.runsConceded / bw.wickets).toFixed(2))
        : null;

  const derivedBowlEcon =
    bw.economy !== undefined && bw.economy !== null
      ? bw.economy
      : bw.runsConceded !== null &&
          bw.runsConceded !== undefined &&
          ballsBowled !== null &&
          ballsBowled > 0
        ? Number(((bw.runsConceded * 6) / ballsBowled).toFixed(2))
        : null;

  const derivedBowlSR =
    bw.strikeRate !== undefined && bw.strikeRate !== null
      ? bw.strikeRate
      : ballsBowled !== null &&
          bw.wickets !== null &&
          bw.wickets !== undefined &&
          bw.wickets > 0
        ? Number((ballsBowled / bw.wickets).toFixed(2))
        : null;

  const records = 'records' in entry ? entry.records : undefined;
  const potm =
    'playerOfTheMatchCount' in entry
      ? entry.playerOfTheMatchCount ?? null
      : records?.playerOfTheMatchCount ?? null;

  return {
    formatKey,
    label,
    hasAnyData: true,
    batting: {
      matches: b.matches ?? null,
      innings: b.innings ?? null,
      runs: b.runs ?? null,
      ballsFaced: b.ballsFaced ?? null,
      highestScore: b.highestScore ?? null,
      highestScoreIsNotOut: b.highestScoreIsNotOut ?? null,
      average: derivedBatAvg,
      strikeRate: derivedBatSR,
      fours: b.fours ?? null,
      sixes: b.sixes ?? null,
      hundreds: b.hundreds ?? null,
      fifties: b.fifties ?? null,
      doubleHundreds: b.doubleHundreds ?? null,
      notOuts: b.notOuts ?? null,
      ducks: b.ducks ?? null,
    },
    bowling: {
      matches: bw.matches ?? b.matches ?? null,
      innings: bw.innings ?? null,
      balls: ballsBowled,
      oversDisplay,
      wickets: bw.wickets ?? null,
      runsConceded: bw.runsConceded ?? null,
      average: derivedBowlAvg,
      economy: derivedBowlEcon,
      strikeRate: derivedBowlSR,
      bestBowlingWickets: bw.bestBowlingWickets ?? null,
      bestBowlingRuns: bw.bestBowlingRuns ?? null,
      bestBowlingDisplay: bestDisplay,
      fourWickets: bw.fourWickets ?? null,
      fiveWickets: bw.fiveWickets ?? null,
      tenWickets: bw.tenWickets ?? null,
    },
    fielding: {
      catches,
      runOuts,
      stumpings,
      totalDismissals: derivedTotalDismissals,
    },
    highestPartnershipRuns: records?.highestPartnershipRuns ?? null,
    highestPartnershipDetail: records?.highestPartnershipDetail ?? null,
    playerOfTheMatchCount: potm,
    bestInningsFours: records?.bestInningsFours ?? null,
    bestInningsSixes: records?.bestInningsSixes ?? null,
    highestInningsStrikeRate: records?.highestInningsStrikeRate ?? null,
    source: entry.source || 'Manual Career Entry',
    lastUpdated: entry.lastUpdated || null,
  };
}

function mergeTwoBuckets(
  formatKey: CareerFormatKey,
  label: string,
  a: ResolvedCareerBucket,
  b: ResolvedCareerBucket,
  forceCombinedSource?: string,
): ResolvedCareerBucket {
  if (!a.hasAnyData) return {...b, formatKey, label};
  if (!b.hasAnyData) return {...a, formatKey, label};

  const runs = addNullable(a.batting.runs, b.batting.runs);
  const innings = addNullable(a.batting.innings, b.batting.innings);
  const notOuts = addNullable(a.batting.notOuts, b.batting.notOuts);
  const ballsFaced = addNullable(a.batting.ballsFaced, b.batting.ballsFaced);

  let highestScore = a.batting.highestScore;
  let highestScoreIsNotOut = a.batting.highestScoreIsNotOut;
  if (
    b.batting.highestScore !== null &&
    (highestScore === null ||
      b.batting.highestScore > highestScore ||
      (b.batting.highestScore === highestScore &&
        b.batting.highestScoreIsNotOut &&
        !highestScoreIsNotOut))
  ) {
    highestScore = b.batting.highestScore;
    highestScoreIsNotOut = b.batting.highestScoreIsNotOut;
  }

  let batAverage: number | null = null;
  if (runs !== null && innings !== null && notOuts !== null) {
    const dis = innings - notOuts;
    if (dis > 0) batAverage = Number((runs / dis).toFixed(2));
  } else if (a.batting.average !== null && b.batting.average === null) {
    batAverage = a.batting.average;
  } else if (b.batting.average !== null && a.batting.average === null) {
    batAverage = b.batting.average;
  }

  let batSR: number | null = null;
  if (runs !== null && ballsFaced !== null && ballsFaced > 0) {
    batSR = Number(((runs * 100) / ballsFaced).toFixed(2));
  } else if (a.batting.strikeRate !== null && b.batting.strikeRate === null) {
    batSR = a.batting.strikeRate;
  } else if (b.batting.strikeRate !== null && a.batting.strikeRate === null) {
    batSR = b.batting.strikeRate;
  }

  const bowlRuns = addNullable(a.bowling.runsConceded, b.bowling.runsConceded);
  const bowlWkts = addNullable(a.bowling.wickets, b.bowling.wickets);
  const bowlBalls = addNullable(a.bowling.balls, b.bowling.balls);

  let bestW = a.bowling.bestBowlingWickets;
  let bestR = a.bowling.bestBowlingRuns;
  let bestDisp = a.bowling.bestBowlingDisplay;
  if (b.bowling.bestBowlingWickets !== null && b.bowling.bestBowlingRuns !== null) {
    if (
      bestW === null ||
      bestR === null ||
      isBetterBowling(b.bowling.bestBowlingWickets, b.bowling.bestBowlingRuns, bestW, bestR)
    ) {
      bestW = b.bowling.bestBowlingWickets;
      bestR = b.bowling.bestBowlingRuns;
      bestDisp = `${bestW}/${bestR}`;
    }
  } else if (!bestDisp && b.bowling.bestBowlingDisplay) {
    bestDisp = b.bowling.bestBowlingDisplay;
  }

  const bowlAvg =
    bowlRuns !== null && bowlWkts !== null && bowlWkts > 0
      ? Number((bowlRuns / bowlWkts).toFixed(2))
      : a.bowling.average ?? b.bowling.average;

  const bowlEcon =
    bowlRuns !== null && bowlBalls !== null && bowlBalls > 0
      ? Number(((bowlRuns * 6) / bowlBalls).toFixed(2))
      : a.bowling.economy ?? b.bowling.economy;

  const bowlSR =
    bowlBalls !== null && bowlWkts !== null && bowlWkts > 0
      ? Number((bowlBalls / bowlWkts).toFixed(2))
      : a.bowling.strikeRate ?? b.bowling.strikeRate;

  const catches = addNullable(a.fielding.catches, b.fielding.catches);
  const runOuts = addNullable(a.fielding.runOuts, b.fielding.runOuts);
  const stumpings = addNullable(a.fielding.stumpings, b.fielding.stumpings);
  const totalDismissals =
    catches !== null || runOuts !== null || stumpings !== null
      ? (catches ?? 0) + (runOuts ?? 0) + (stumpings ?? 0)
      : addNullable(a.fielding.totalDismissals, b.fielding.totalDismissals);

  let hpRuns = a.highestPartnershipRuns;
  let hpDetail = a.highestPartnershipDetail;
  if (
    b.highestPartnershipRuns !== null &&
    (hpRuns === null || b.highestPartnershipRuns > hpRuns)
  ) {
    hpRuns = b.highestPartnershipRuns;
    hpDetail = b.highestPartnershipDetail ?? hpDetail;
  }

  const sourceLabel =
    forceCombinedSource ??
    (a.source === b.source ? a.source : 'Combined (Local + Verified)');

  return {
    formatKey,
    label,
    hasAnyData: true,
    batting: {
      matches: addNullable(a.batting.matches, b.batting.matches),
      innings,
      runs,
      ballsFaced,
      highestScore,
      highestScoreIsNotOut,
      average: batAverage,
      strikeRate: batSR,
      fours: addNullable(a.batting.fours, b.batting.fours),
      sixes: addNullable(a.batting.sixes, b.batting.sixes),
      hundreds: addNullable(a.batting.hundreds, b.batting.hundreds),
      fifties: addNullable(a.batting.fifties, b.batting.fifties),
      doubleHundreds: addNullable(a.batting.doubleHundreds, b.batting.doubleHundreds),
      notOuts,
      ducks: addNullable(a.batting.ducks, b.batting.ducks),
    },
    bowling: {
      matches: addNullable(a.bowling.matches, b.bowling.matches),
      innings: addNullable(a.bowling.innings, b.bowling.innings),
      balls: bowlBalls,
      oversDisplay: bowlBalls !== null ? formatOvers(bowlBalls) : a.bowling.oversDisplay ?? b.bowling.oversDisplay,
      wickets: bowlWkts,
      runsConceded: bowlRuns,
      average: bowlAvg,
      economy: bowlEcon,
      strikeRate: bowlSR,
      bestBowlingWickets: bestW,
      bestBowlingRuns: bestR,
      bestBowlingDisplay: bestDisp,
      fourWickets: addNullable(a.bowling.fourWickets, b.bowling.fourWickets),
      fiveWickets: addNullable(a.bowling.fiveWickets, b.bowling.fiveWickets),
      tenWickets: addNullable(a.bowling.tenWickets, b.bowling.tenWickets),
    },
    fielding: {
      catches,
      runOuts,
      stumpings,
      totalDismissals,
    },
    highestPartnershipRuns: hpRuns,
    highestPartnershipDetail: hpDetail,
    playerOfTheMatchCount: addNullable(a.playerOfTheMatchCount, b.playerOfTheMatchCount),
    bestInningsFours: pickHigherNullable(a.bestInningsFours, b.bestInningsFours),
    bestInningsSixes: pickHigherNullable(a.bestInningsSixes, b.bestInningsSixes),
    highestInningsStrikeRate: pickHigherNullable(
      a.highestInningsStrikeRate,
      b.highestInningsStrikeRate,
    ),
    source: sourceLabel,
    lastUpdated: pickLatestIso(a.lastUpdated, b.lastUpdated),
  };
}

export function computePlayerCareerProfile(params: {
  player: Player;
  players: Player[];
  teams: Team[];
  matches: Match[];
}): ComputedPlayerCareerProfile {
  const {player, players, teams, matches} = params;

  const teamMap = new Map<string, Team>();
  teams.forEach((t) => teamMap.set(t.id, t));

  const playerMap = new Map<string, Player>();
  players.forEach((p) => playerMap.set(p.id, p));

  const currentTeam = player.teamId ? teamMap.get(player.teamId) : undefined;

  const localFormatAccs: Record<Exclude<CareerFormatKey, 'all'>, LocalAccumulator> = {
    test: createLocalAccumulator(),
    odi: createLocalAccumulator(),
    t20i: createLocalAccumulator(),
    't20-league': createLocalAccumulator(),
    domestic: createLocalAccumulator(),
  };
  const localLeagueAccs = new Map<string, LocalAccumulator>();

  const ensureLeagueAcc = (name: string): LocalAccumulator => {
    let acc = localLeagueAccs.get(name);
    if (!acc) {
      acc = createLocalAccumulator();
      localLeagueAccs.set(name, acc);
    }
    return acc;
  };

  // Deduplicate matches strictly by match.id
  const seenMatches = new Set<string>();
  const localMatchLogs: PlayerLocalMatchLog[] = [];

  const extFormats = player.careerProfile?.formats ?? {};
  const extLeagues = player.careerProfile?.leagues ?? {};

  const sortedMatches = [...matches].sort((a, b) =>
    (b.matchDate || b.updatedAt).localeCompare(a.matchDate || a.updatedAt),
  );

  for (const match of sortedMatches) {
    if (seenMatches.has(match.id)) continue;
    seenMatches.add(match.id);
    if (match.status === 'abandoned') continue;

    const formatKey = resolveMatchCareerFormatKey(match);
    const leagueName = match.tournamentName
      ? resolveCompetitionDisplayName(match.tournamentName)
      : null;

    // Prevent double-counting matches already declared as included in imported/manual entries
    const excludedFromFormatLocal = Boolean(
      extFormats[formatKey]?.includedMatchIds?.includes(match.id),
    );
    const excludedFromLeagueLocal = Boolean(
      leagueName && extLeagues[leagueName]?.includedMatchIds?.includes(match.id),
    );

    const fmtAcc = localFormatAccs[formatKey];
    const lgAcc = leagueName ? ensureLeagueAcc(leagueName) : null;

    let playerAppearedInMatch =
      match.teamAPlayingXI.includes(player.id) || match.teamBPlayingXI.includes(player.id);

    let matchBowlWkts = 0;
    const matchBatTexts: string[] = [];
    const matchBowlTexts: string[] = [];
    let matchCatches = 0;
    let matchRunOuts = 0;
    let matchStumpings = 0;

    const seenInnings = new Set<string>();
    let matchHadAnyPlay = false;

    const applyToAccs = (fn: (acc: LocalAccumulator) => void) => {
      if (!excludedFromFormatLocal) fn(fmtAcc);
      if (lgAcc && !excludedFromLeagueLocal) fn(lgAcc);
    };

    for (const inn of match.innings) {
      const innKey = `${match.id}#${inn.inningsNumber}`;
      if (seenInnings.has(innKey)) continue;
      seenInnings.add(innKey);

      const hasPlay = inn.balls.length > 0 || inn.runs > 0 || inn.wickets > 0;
      if (!hasPlay) continue;
      matchHadAnyPlay = true;

      const recalc = recalculateInnings({
        innings: inn,
        battingXI: getTeamPlayingXI(match, inn.battingTeamId),
        playerMap,
        format: match.format,
        oversPerInnings: match.oversPerInnings,
      });

      const batRow = recalc.battingRows.find((r) => r.playerId === player.id);
      if (batRow) {
        playerAppearedInMatch = true;
        matchBatTexts.push(`${batRow.runs}${batRow.isOut ? '' : '*'} (${batRow.balls})`);

        const innSR = batRow.balls > 0 ? Number(((batRow.runs * 100) / batRow.balls).toFixed(2)) : 0;

        applyToAccs((acc) => {
          acc.hasBatEntry = true;
          acc.battingInnings += 1;
          acc.runs += batRow.runs;
          acc.ballsFaced += batRow.balls;
          acc.fours += batRow.fours;
          acc.sixes += batRow.sixes;
          if (!batRow.isOut) acc.notOuts += 1;
          if (batRow.runs === 0 && batRow.isOut) acc.ducks += 1;
          if (batRow.runs >= 200) acc.doubleHundreds += 1;
          if (batRow.runs >= 100) acc.hundreds += 1;
          else if (batRow.runs >= 50) acc.fifties += 1;

          if (
            batRow.runs > acc.highestScore ||
            (batRow.runs === acc.highestScore && !batRow.isOut && !acc.highestScoreIsNotOut)
          ) {
            acc.highestScore = batRow.runs;
            acc.highestScoreIsNotOut = !batRow.isOut;
          }
          if (batRow.fours > acc.bestInningsFours) acc.bestInningsFours = batRow.fours;
          if (batRow.sixes > acc.bestInningsSixes) acc.bestInningsSixes = batRow.sixes;
          if (batRow.balls >= 5 && innSR > acc.highestInningsSR) acc.highestInningsSR = innSR;
        });
      }

      // Partnerships in which player participated
      for (const pship of recalc.partnerships) {
        if (pship.batter1Id === player.id || pship.batter2Id === player.id) {
          const partnerName =
            pship.batter1Id === player.id ? pship.batter2Name : pship.batter1Name;
          applyToAccs((acc) => {
            if (
              acc.highestPartnershipRuns === null ||
              pship.runs > acc.highestPartnershipRuns
            ) {
              acc.highestPartnershipRuns = pship.runs;
              acc.highestPartnershipDetail = `${pship.runs} runs (${pship.balls} balls) with ${partnerName} vs ${
                inn.bowlingTeamId === match.teamAId ? match.teamAShortName : match.teamBShortName
              }`;
            }
          });
        }
      }

      const bowlRow = recalc.bowlingRows.find((r) => r.playerId === player.id);
      if (bowlRow) {
        playerAppearedInMatch = true;
        matchBowlWkts += bowlRow.wickets;
        matchBowlTexts.push(
          `${bowlRow.wickets}/${bowlRow.runsConceded} (${bowlRow.oversFormatted} ov)`,
        );

        applyToAccs((acc) => {
          acc.hasBowlEntry = true;
          acc.bowlingInnings += 1;
          acc.legalBalls += bowlRow.legalBalls;
          acc.wickets += bowlRow.wickets;
          acc.runsConceded += bowlRow.runsConceded;
          if (bowlRow.wickets === 4) acc.fourWickets += 1;
          if (bowlRow.wickets >= 5) acc.fiveWickets += 1;
          if (
            acc.bestBowlWkts < 0 ||
            isBetterBowling(bowlRow.wickets, bowlRow.runsConceded, acc.bestBowlWkts, acc.bestBowlRuns)
          ) {
            acc.bestBowlWkts = bowlRow.wickets;
            acc.bestBowlRuns = bowlRow.runsConceded;
          }
        });
      }

      // Fielding stats from BallEvent (deduplicated per ball id)
      const seenBalls = new Set<string>();
      for (const ball of inn.balls) {
        if (seenBalls.has(ball.id)) continue;
        seenBalls.add(ball.id);
        if (!ball.isWicket) continue;
        if (ball.fielderId) {
          applyToAccs((acc) => {
            acc.anyFieldingRecordedInMatches = true;
          });
        }
        if (ball.fielderId === player.id) {
          playerAppearedInMatch = true;
          if (ball.wicketType === 'caught') {
            matchCatches += 1;
            applyToAccs((acc) => {
              acc.anyFieldingRecordedInMatches = true;
              acc.catches += 1;
            });
          } else if (ball.wicketType === 'run-out') {
            matchRunOuts += 1;
            applyToAccs((acc) => {
              acc.anyFieldingRecordedInMatches = true;
              acc.runOuts += 1;
            });
          } else if (ball.wicketType === 'stumped') {
            matchStumpings += 1;
            applyToAccs((acc) => {
              acc.anyFieldingRecordedInMatches = true;
              acc.stumpings += 1;
            });
          }
        }
      }
    }

    if (playerAppearedInMatch && matchHadAnyPlay) {
      applyToAccs((acc) => {
        acc.matchIds.add(match.id);
        acc.latestUpdatedAt = pickLatestIso(acc.latestUpdatedAt, match.updatedAt);
        if (matchBowlWkts >= 10) {
          acc.tenWickets += 1;
        }
        if (match.playerOfTheMatchId) {
          acc.potmMatchesKnown = true;
          if (match.playerOfTheMatchId === player.id) {
            acc.potmCount += 1;
          }
        }
      });

      const inTeamA = match.teamAPlayingXI.includes(player.id) || player.teamId === match.teamAId;
      const fieldingParts: string[] = [];
      if (matchCatches > 0) fieldingParts.push(`${matchCatches}c`);
      if (matchRunOuts > 0) fieldingParts.push(`${matchRunOuts}ro`);
      if (matchStumpings > 0) fieldingParts.push(`${matchStumpings}st`);

      localMatchLogs.push({
        matchId: match.id,
        matchTitle: match.title,
        matchDate: match.matchDate || match.createdAt.slice(0, 10),
        formatLabel: match.format,
        tournamentName: match.tournamentName,
        teamShortName: inTeamA ? match.teamAShortName : match.teamBShortName,
        opponentShortName: inTeamA ? match.teamBShortName : match.teamAShortName,
        resultSummary: match.resultSummary,
        battingText: matchBatTexts.length > 0 ? matchBatTexts.join(' & ') : null,
        bowlingText: matchBowlTexts.length > 0 ? matchBowlTexts.join(' & ') : null,
        fieldingText: fieldingParts.length > 0 ? fieldingParts.join(' · ') : null,
        isPlayerOfTheMatch: match.playerOfTheMatchId === player.id,
      });
    }
  }

  // Also ensure we inspect whether ANY ball event in format had fielderId vs none
  const formatKeys: Array<Exclude<CareerFormatKey, 'all'>> = [
    'test',
    'odi',
    't20i',
    't20-league',
    'domestic',
  ];

  const buckets = {} as Record<CareerFormatKey, ResolvedCareerBucket>;

  for (const fk of formatKeys) {
    const meta = FORMAT_TAB_META.find((m) => m.key === fk)!;
    const localBucket = localAccToBucket(fk, meta.label, localFormatAccs[fk]);
    const extEntry = extFormats[fk];
    const extBucket = extEntry ? externalEntryToBucket(fk, meta.label, extEntry) : null;

    if (extBucket && localBucket.hasAnyData) {
      buckets[fk] = mergeTwoBuckets(fk, meta.label, extBucket, localBucket);
    } else if (extBucket) {
      buckets[fk] = extBucket;
    } else {
      buckets[fk] = localBucket;
    }
  }

  // Merge all 5 format buckets into 'all' without double counting
  let allBucket = localAccToBucket('all', 'All Format Career', createLocalAccumulator());
  const usedSources = new Set<string>();
  for (const fk of formatKeys) {
    const b = buckets[fk];
    if (!b.hasAnyData) continue;
    usedSources.add(b.source);
    allBucket = mergeTwoBuckets('all', 'All Format Career', allBucket, b);
  }

  // Apply global career record overrides if Admin set them explicitly
  const globalRecords = player.careerProfile?.records;
  if (globalRecords && allBucket.hasAnyData) {
    if (
      globalRecords.highestPartnershipRuns !== null &&
      globalRecords.highestPartnershipRuns !== undefined &&
      (allBucket.highestPartnershipRuns === null ||
        globalRecords.highestPartnershipRuns > allBucket.highestPartnershipRuns)
    ) {
      allBucket.highestPartnershipRuns = globalRecords.highestPartnershipRuns;
      allBucket.highestPartnershipDetail =
        globalRecords.highestPartnershipDetail ?? allBucket.highestPartnershipDetail;
    }
    if (
      globalRecords.playerOfTheMatchCount !== null &&
      globalRecords.playerOfTheMatchCount !== undefined
    ) {
      allBucket.playerOfTheMatchCount =
        allBucket.playerOfTheMatchCount !== null
          ? Math.max(allBucket.playerOfTheMatchCount, globalRecords.playerOfTheMatchCount)
          : globalRecords.playerOfTheMatchCount;
    }
    allBucket.bestInningsFours = pickHigherNullable(
      allBucket.bestInningsFours,
      globalRecords.bestInningsFours,
    );
    allBucket.bestInningsSixes = pickHigherNullable(
      allBucket.bestInningsSixes,
      globalRecords.bestInningsSixes,
    );
    allBucket.highestInningsStrikeRate = pickHigherNullable(
      allBucket.highestInningsStrikeRate,
      globalRecords.highestInningsStrikeRate,
    );
  }

  if (usedSources.size === 1) {
    allBucket.source = Array.from(usedSources)[0];
  } else if (usedSources.size > 1) {
    allBucket.source = 'Combined (Local + Verified)';
  }
  buckets.all = allBucket;

  // Build League rows (all 12 defined leagues + any custom leagues added by admin)
  const leagueNames = Array.from(
    new Set([
      ...MAJOR_CRICKET_LEAGUES,
      ...Array.from(localLeagueAccs.keys()),
      ...Object.keys(extLeagues),
    ]),
  );

  const leagues: ResolvedLeagueRow[] = leagueNames.map((leagueName) => {
    const lAcc = localLeagueAccs.get(leagueName);
    const localB = lAcc
      ? localAccToBucket('t20-league', leagueName, lAcc)
      : localAccToBucket('t20-league', leagueName, createLocalAccumulator());
    const extL = extLeagues[leagueName];
    const extB = extL ? externalEntryToBucket('t20-league', leagueName, extL) : null;

    const merged =
      extB && localB.hasAnyData
        ? mergeTwoBuckets('t20-league', leagueName, extB, localB)
        : extB ?? localB;

    return {
      leagueName,
      hasData: merged.hasAnyData,
      batting: merged.batting,
      bowling: merged.bowling,
      fielding: merged.fielding,
      playerOfTheMatchCount: merged.playerOfTheMatchCount,
      source: merged.hasAnyData ? merged.source : 'No Data Recorded',
      lastUpdated: merged.lastUpdated,
    };
  });

  const overallLastUpdated =
    pickLatestIso(allBucket.lastUpdated, player.careerProfile?.lastUpdated) ??
    pickLatestIso(player.updatedAt, null);

  return {
    player,
    currentTeamName: currentTeam?.name ?? null,
    currentTeamShortName: currentTeam?.shortName ?? null,
    buckets,
    leagues,
    localMatchLogs,
    overallSource: allBucket.hasAnyData
      ? allBucket.source
      : player.careerProfile?.source ?? 'Local Player Roster (No Match Stats Yet)',
    overallLastUpdated,
  };
}
