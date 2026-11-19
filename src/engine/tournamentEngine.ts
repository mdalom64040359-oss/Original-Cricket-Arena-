import {
  computeMatchResult,
  computeTestMatchSituation,
  formatOvers,
  getTeamPlayingXI,
  isBowlerCreditedWicket,
  isLegalDelivery,
} from './scoringEngine';
import type {
  FixtureStage,
  Innings,
  Match,
  Player,
  Team,
  Tournament,
  TournamentFixture,
  TournamentFormatType,
  TournamentGroup,
} from '../types/cricket';
import {generateId} from '../utils/imageUtils';

export interface PointsTableRow {
  rank: number;
  teamId: string;
  teamName: string;
  shortName: string;
  logoDataUrl?: string;
  primaryColor: string;
  groupId?: string;
  groupName?: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  runsScored: number;
  ballsFaced: number;
  oversFacedFormatted: string;
  runsConceded: number;
  ballsBowled: number;
  oversBowledFormatted: string;
  nrr: number;
  nrrFormatted: string;
  isQualified: boolean;
}

export interface GroupStandings {
  groupId: string;
  groupName: string;
  qualifiersCount: number;
  rows: PointsTableRow[];
}

export interface TournamentBatterStat {
  playerId: string;
  playerName: string;
  teamId?: string;
  teamShortName: string;
  innings: number;
  notOuts: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  highScore: number;
  average: number;
  strikeRate: number;
}

export interface TournamentBowlerStat {
  playerId: string;
  playerName: string;
  teamId?: string;
  teamShortName: string;
  innings: number;
  legalBalls: number;
  oversFormatted: string;
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy: number;
  bestWickets: number;
  bestRuns: number;
}

export interface TournamentResultsAndStats {
  qualifiedTeams: Team[];
  semiFinalists: Team[];
  finalists: Team[];
  championTeam: Team | null;
  runnerUpTeam: Team | null;
  summary: {
    totalFixtures: number;
    completedMatches: number;
    liveMatches: number;
    upcomingMatches: number;
    abandonedMatches: number;
    totalRuns: number;
    totalWickets: number;
    totalFours: number;
    totalSixes: number;
    highestTeamTotal: {scoreText: string; teamName: string} | null;
  };
  topBatsmen: TournamentBatterStat[];
  topBowlers: TournamentBowlerStat[];
}

const KNOCKOUT_STAGES = new Set<FixtureStage>([
  'play-in',
  'round-of-64',
  'round-of-32',
  'round-of-16',
  'quarter-final',
  'semi-final',
  'final',
]);

export function isKnockoutStage(stage: FixtureStage): boolean {
  return KNOCKOUT_STAGES.has(stage);
}

export function resolveTournamentFormat(tournament: Pick<Tournament, 'tournamentFormat' | 'stageType'>): TournamentFormatType {
  if (tournament.tournamentFormat) {
    return tournament.tournamentFormat;
  }
  if (tournament.stageType === 'groups-knockout') return 'hybrid';
  if (tournament.stageType === 'knockout') return 'knockout';
  return 'league';
}

export function mapFormatToStageType(
  format: TournamentFormatType,
): Tournament['stageType'] {
  if (format === 'knockout') return 'knockout';
  if (format === 'hybrid' || format === 'groups') return 'groups-knockout';
  return 'league';
}

export function getRecommendedGroupCount(teamCount: number): number {
  if (teamCount < 6) return 1;
  if (teamCount <= 11) return 2;
  if (teamCount <= 27) return 4;
  if (teamCount <= 44) return 8;
  return Math.min(16, Math.max(8, Math.round(teamCount / 5)));
}

function getGroupLabel(index: number): string {
  if (index < 26) {
    return `Group ${String.fromCharCode(65 + index)}`;
  }
  const first = String.fromCharCode(65 + Math.floor(index / 26) - 1);
  const second = String.fromCharCode(65 + (index % 26));
  return `Group ${first}${second}`;
}

export function generateTournamentGroups(
  teamIds: string[],
  requestedGroupCount: number,
): TournamentGroup[] {
  const uniqueIds = Array.from(new Set(teamIds));
  const safeCount = Math.max(1, Math.min(requestedGroupCount, Math.max(1, Math.floor(uniqueIds.length / 2))));
  const groups: TournamentGroup[] = Array.from({length: safeCount}, (_, idx) => ({
    id: `grp_${idx + 1}`,
    name: getGroupLabel(idx),
    teamIds: [],
  }));

  // Snake seeding for balanced group distribution
  uniqueIds.forEach((teamId, idx) => {
    const cycle = Math.floor(idx / safeCount);
    const posInCycle = idx % safeCount;
    const targetGroupIdx = cycle % 2 === 0 ? posInCycle : safeCount - 1 - posInCycle;
    groups[targetGroupIdx].teamIds.push(teamId);
  });

  return groups;
}

export function generateRoundRobinPairings(
  teamIds: string[],
  roundsCount = 1,
): Array<{roundNumber: number; teamAId: string; teamBId: string}> {
  const uniqueIds = Array.from(new Set(teamIds));
  if (uniqueIds.length < 2) return [];

  const list: Array<string | null> = [...uniqueIds];
  if (list.length % 2 === 1) {
    list.push(null); // Bye sentinel
  }

  const n = list.length;
  const roundsPerCycle = n - 1;
  const half = n / 2;
  const pairings: Array<{roundNumber: number; teamAId: string; teamBId: string}> = [];

  for (let cycle = 0; cycle < roundsCount; cycle++) {
    const rotating = [...list];
    const seenPairs = new Set<string>();

    for (let r = 0; r < roundsPerCycle; r++) {
      const roundNumber = cycle * roundsPerCycle + r + 1;
      for (let i = 0; i < half; i++) {
        const t1 = rotating[i];
        const t2 = rotating[n - 1 - i];
        if (!t1 || !t2 || t1 === t2) continue;

        const canonical = t1 < t2 ? `${t1}|${t2}` : `${t2}|${t1}`;
        if (seenPairs.has(canonical)) continue;
        seenPairs.add(canonical);

        // Alternate home/away in second cycle
        if (cycle % 2 === 0) {
          pairings.push({roundNumber, teamAId: t1, teamBId: t2});
        } else {
          pairings.push({roundNumber, teamAId: t2, teamBId: t1});
        }
      }

      // Circle rotation keeping index 0 fixed
      const last = rotating.pop()!;
      rotating.splice(1, 0, last);
    }
  }

  return pairings;
}

function getStageForBracketSize(bracketSize: number): {stage: FixtureStage; prefix: string} {
  switch (bracketSize) {
    case 2:
      return {stage: 'final', prefix: 'Final'};
    case 4:
      return {stage: 'semi-final', prefix: 'Semi-Final'};
    case 8:
      return {stage: 'quarter-final', prefix: 'Quarter-Final'};
    case 16:
      return {stage: 'round-of-16', prefix: 'Round of 16'};
    case 32:
      return {stage: 'round-of-32', prefix: 'Round of 32'};
    default:
      return {stage: 'round-of-64', prefix: 'Round of 64'};
  }
}

export function generateKnockoutBracketFixtures(params: {
  teamIds?: string[];
  bracketTeamCount: number;
  startRoundNumber: number;
  startFixtureNumber: number;
  venue?: string;
}): TournamentFixture[] {
  const {teamIds, bracketTeamCount, startRoundNumber, startFixtureNumber, venue} = params;
  if (bracketTeamCount < 2) return [];

  const fixtures: TournamentFixture[] = [];
  let fixtureNum = startFixtureNumber;
  let roundNum = startRoundNumber;

  // Largest power of 2 <= bracketTeamCount
  let basePow = 2;
  while (basePow * 2 <= bracketTeamCount) {
    basePow *= 2;
  }

  const prelimMatchesCount = bracketTeamCount - basePow;
  const hasAssignedTeams = Boolean(teamIds && teamIds.length >= 2);
  const orderedTeams = hasAssignedTeams ? [...(teamIds ?? [])] : [];

  // Preliminary Play-In round if not exact power of 2 (e.g. 20, 24, 40, 50 teams)
  const playInFixtures: TournamentFixture[] = [];
  if (prelimMatchesCount > 0) {
    const byeCount = bracketTeamCount - prelimMatchesCount * 2;
    const playInTeams = orderedTeams.slice(byeCount);

    for (let i = 0; i < prelimMatchesCount; i++) {
      const f: TournamentFixture = {
        id: generateId('fix'),
        fixtureNumber: fixtureNum++,
        stage: 'play-in',
        roundNumber: roundNum,
        label: `Play-In ${i + 1}`,
        teamAId: hasAssignedTeams ? playInTeams[i * 2] : undefined,
        teamBId: hasAssignedTeams ? playInTeams[i * 2 + 1] : undefined,
        venue,
        status: 'upcoming',
      };
      playInFixtures.push(f);
      fixtures.push(f);
    }
    roundNum += 1;
  }

  // First main power-of-2 round (size = basePow, matches = basePow / 2)
  const firstMainCount = basePow / 2;
  const firstMainMeta = getStageForBracketSize(basePow);
  let previousRoundFixtures: TournamentFixture[] = [];

  if (hasAssignedTeams) {
    const byeTeams = orderedTeams.slice(0, bracketTeamCount - prelimMatchesCount * 2);
    // Build slots of length basePow: byes first, then playIn winners
    type Slot = {teamId?: string; sourceFixtureId?: string};
    const slots: Slot[] = [
      ...byeTeams.map((id) => ({teamId: id})),
      ...playInFixtures.map((f) => ({sourceFixtureId: f.id})),
    ];

    for (let i = 0; i < firstMainCount; i++) {
      const slotA = slots[i];
      const slotB = slots[basePow - 1 - i];
      const f: TournamentFixture = {
        id: generateId('fix'),
        fixtureNumber: fixtureNum++,
        stage: firstMainMeta.stage,
        roundNumber: roundNum,
        label:
          firstMainMeta.stage === 'final' ? 'Final' : `${firstMainMeta.prefix} ${i + 1}`,
        teamAId: slotA?.teamId,
        teamBId: slotB?.teamId,
        sourceFixtureAId: slotA?.sourceFixtureId,
        sourceFixtureBId: slotB?.sourceFixtureId,
        venue,
        status: 'upcoming',
      };
      previousRoundFixtures.push(f);
      fixtures.push(f);
    }
  } else {
    // Unassigned qualifiers (e.g. Hybrid Group -> QF/SF/Final)
    for (let i = 0; i < firstMainCount; i++) {
      const f: TournamentFixture = {
        id: generateId('fix'),
        fixtureNumber: fixtureNum++,
        stage: firstMainMeta.stage,
        roundNumber: roundNum,
        label:
          firstMainMeta.stage === 'final' ? 'Final' : `${firstMainMeta.prefix} ${i + 1}`,
        venue,
        status: 'upcoming',
      };
      previousRoundFixtures.push(f);
      fixtures.push(f);
    }
  }

  // Subsequent knockout rounds down to Final
  let currentSize = basePow / 2;
  while (currentSize >= 2) {
    roundNum += 1;
    const matchCount = currentSize / 2;
    const meta = getStageForBracketSize(currentSize);
    const nextRoundFixtures: TournamentFixture[] = [];

    for (let i = 0; i < matchCount; i++) {
      const sourceA = previousRoundFixtures[i * 2];
      const sourceB = previousRoundFixtures[i * 2 + 1];
      const f: TournamentFixture = {
        id: generateId('fix'),
        fixtureNumber: fixtureNum++,
        stage: meta.stage,
        roundNumber: roundNum,
        label: meta.stage === 'final' ? 'Final' : `${meta.prefix} ${i + 1}`,
        sourceFixtureAId: sourceA?.id,
        sourceFixtureBId: sourceB?.id,
        venue,
        status: 'upcoming',
      };
      nextRoundFixtures.push(f);
      fixtures.push(f);
    }

    previousRoundFixtures = nextRoundFixtures;
    currentSize = currentSize / 2;
  }

  return fixtures;
}

function distributeFixtureDates(
  fixtures: TournamentFixture[],
  startDate?: string,
  endDate?: string,
): TournamentFixture[] {
  if (!startDate || fixtures.length === 0) return fixtures;

  const startMs = new Date(`${startDate}T00:00:00Z`).getTime();
  if (Number.isNaN(startMs)) return fixtures;

  const endMs = endDate ? new Date(`${endDate}T00:00:00Z`).getTime() : startMs;
  const maxRound = Math.max(...fixtures.map((f) => f.roundNumber), 1);
  const totalSpanDays =
    !Number.isNaN(endMs) && endMs > startMs
      ? Math.round((endMs - startMs) / (1000 * 60 * 60 * 24))
      : Math.max(0, maxRound - 1);

  return fixtures.map((fix) => {
    const ratio = maxRound > 1 ? (fix.roundNumber - 1) / (maxRound - 1) : 0;
    const offsetDays = Math.round(ratio * totalSpanDays);
    const d = new Date(startMs + offsetDays * 86400000);
    return {
      ...fix,
      scheduledDate: d.toISOString().slice(0, 10),
    };
  });
}

export function generateTournamentFixtures(tournament: Tournament): {
  groups: TournamentGroup[];
  fixtures: TournamentFixture[];
} {
  const formatType = resolveTournamentFormat(tournament);
  const teamIds = Array.from(new Set(tournament.teamIds));
  if (teamIds.length < 2) {
    return {groups: [], fixtures: []};
  }

  let groups: TournamentGroup[] = [];
  let fixtures: TournamentFixture[] = [];
  let fixtureNumber = 1;

  if (formatType === 'round-robin' || formatType === 'league') {
    const stage: FixtureStage = formatType === 'round-robin' ? 'round-robin' : 'league';
    const pairings = generateRoundRobinPairings(teamIds, 1);
    let maxRound = 1;

    pairings.forEach((p) => {
      if (p.roundNumber > maxRound) maxRound = p.roundNumber;
      fixtures.push({
        id: generateId('fix'),
        fixtureNumber: fixtureNumber++,
        stage,
        roundNumber: p.roundNumber,
        label: `Match ${fixtureNumber - 1}`,
        teamAId: p.teamAId,
        teamBId: p.teamBId,
        venue: tournament.location,
        status: 'upcoming',
      });
    });

    // For League, optionally add knockout finals for top qualifiers (default 4 if >= 6 teams, else 2)
    const qualifiersCount =
      formatType === 'league'
        ? Math.min(teamIds.length, tournament.qualifiersCount ?? (teamIds.length >= 6 ? 4 : 2))
        : 0;

    if (formatType === 'league' && qualifiersCount >= 2) {
      const koFixtures = generateKnockoutBracketFixtures({
        bracketTeamCount: qualifiersCount,
        startRoundNumber: maxRound + 1,
        startFixtureNumber: fixtureNumber,
        venue: tournament.location,
      });
      fixtures.push(...koFixtures);
    }
  } else if (formatType === 'groups' || formatType === 'hybrid') {
    const groupCount = tournament.groupCount ?? getRecommendedGroupCount(teamIds.length);
    groups = generateTournamentGroups(teamIds, groupCount);
    let maxRound = 1;

    groups.forEach((grp) => {
      const grpPairings = generateRoundRobinPairings(grp.teamIds, 1);
      grpPairings.forEach((p, idx) => {
        if (p.roundNumber > maxRound) maxRound = p.roundNumber;
        fixtures.push({
          id: generateId('fix'),
          fixtureNumber: fixtureNumber++,
          stage: 'group',
          roundNumber: p.roundNumber,
          label: `${grp.name} · M${idx + 1}`,
          groupId: grp.id,
          groupName: grp.name,
          teamAId: p.teamAId,
          teamBId: p.teamBId,
          venue: tournament.location,
          status: 'upcoming',
        });
      });
    });

    if (formatType === 'hybrid') {
      const perGroup = tournament.qualifiersPerGroup ?? 2;
      const totalQualifiers = Math.min(teamIds.length, groups.length * perGroup);
      if (totalQualifiers >= 2) {
        const koFixtures = generateKnockoutBracketFixtures({
          bracketTeamCount: totalQualifiers,
          startRoundNumber: maxRound + 1,
          startFixtureNumber: fixtureNumber,
          venue: tournament.location,
        });
        fixtures.push(...koFixtures);
      }
    }
  } else if (formatType === 'knockout') {
    fixtures = generateKnockoutBracketFixtures({
      teamIds,
      bracketTeamCount: teamIds.length,
      startRoundNumber: 1,
      startFixtureNumber: 1,
      venue: tournament.location,
    });
  }

  return {
    groups,
    fixtures: distributeFixtureDates(fixtures, tournament.startDate, tournament.endDate),
  };
}

export interface ResolvedMatchOutcome {
  status: Match['status'];
  winnerTeamId?: string;
  isTie: boolean;
  isNoResult: boolean;
  resultText?: string;
  innings: Innings[];
}

export function resolveMatchOutcome(match: Match): ResolvedMatchOutcome {
  if (match.status === 'abandoned') {
    return {
      status: 'abandoned',
      isTie: false,
      isNoResult: true,
      resultText: match.resultSummary || 'Match Abandoned (No Result)',
      innings: match.innings,
    };
  }

  if (match.status !== 'completed') {
    return {
      status: match.status,
      isTie: false,
      isNoResult: false,
      resultText: match.resultSummary,
      innings: match.innings,
    };
  }

  if (match.format === 'TEST') {
    const sit = computeTestMatchSituation(match);
    const resultText = match.resultSummary || computeMatchResult(match);
    if (sit.inningsVictoryResult) {
      const winner =
        sit.inningsVictoryWinnerId ??
        (sit.inningsVictoryResult.startsWith(`${match.teamAName} won `)
          ? match.teamAId
          : match.teamBId);
      return {
        status: 'completed',
        winnerTeamId: winner,
        isTie: false,
        isNoResult: false,
        resultText,
        innings: match.innings,
      };
    }
    if (match.innings.length === 4 && match.innings[3].isCompleted) {
      if (sit.teamATotal === sit.teamBTotal) {
        return {
          status: 'completed',
          isTie: true,
          isNoResult: false,
          resultText: 'Match Tied',
          innings: match.innings,
        };
      }
      const winnerTeamId = sit.teamATotal > sit.teamBTotal ? match.teamAId : match.teamBId;
      return {
        status: 'completed',
        winnerTeamId,
        isTie: false,
        isNoResult: false,
        resultText,
        innings: match.innings,
      };
    }
    return {
      status: 'completed',
      isTie: true,
      isNoResult: false,
      resultText: resultText || 'Match Drawn',
      innings: match.innings,
    };
  }

  // Limited overs outcome
  if (match.innings.length >= 2) {
    const first = match.innings[0];
    const second = match.innings[1];
    const resultText = match.resultSummary || computeMatchResult(match);
    if (first.runs > second.runs) {
      return {
        status: 'completed',
        winnerTeamId: first.battingTeamId,
        isTie: false,
        isNoResult: false,
        resultText,
        innings: match.innings,
      };
    }
    if (second.runs > first.runs) {
      return {
        status: 'completed',
        winnerTeamId: second.battingTeamId,
        isTie: false,
        isNoResult: false,
        resultText,
        innings: match.innings,
      };
    }
    return {
      status: 'completed',
      isTie: true,
      isNoResult: false,
      resultText: resultText || 'Match Tied',
      innings: match.innings,
    };
  }

  // Completed with < 2 innings -> treat as No Result unless resultSummary specifies
  return {
    status: 'completed',
    isTie: false,
    isNoResult: true,
    resultText: match.resultSummary || 'No Result',
    innings: match.innings,
  };
}

/**
 * Official Cricket Net Run Rate (NRR) effective balls faced:
 * If a limited-overs team is bowled out (all out) before completing its overs quota,
 * NRR uses the FULL quota of overs (oversPerInnings * 6 balls).
 */
export function calculateEffectiveOversBalls(
  innings: Innings,
  oversPerInnings: number,
  battingXILength: number,
): number {
  const quotaBalls = Math.max(6, oversPerInnings * 6);
  const maxWickets = Math.max(1, battingXILength - 1);
  const isAllOut = innings.wickets >= maxWickets;
  if (isAllOut) {
    return quotaBalls;
  }
  return Math.min(quotaBalls, Math.max(0, innings.legalBalls));
}

export function formatNRR(nrr: number): string {
  const fixed = Math.abs(nrr) < 0.0005 ? 0 : nrr;
  if (fixed > 0) return `+${fixed.toFixed(3)}`;
  if (fixed < 0) return fixed.toFixed(3);
  return '0.000';
}

export function syncFixturesWithMatchesAndProgression(
  tournament: Tournament,
  allMatches: Match[],
): TournamentFixture[] {
  const matchById = new Map<string, Match>();
  allMatches.forEach((m) => matchById.set(m.id, m));

  const baseFixtures = (tournament.fixtures ?? []).map((f) => ({...f}));
  const fixtureById = new Map<string, TournamentFixture>();
  baseFixtures.forEach((f) => fixtureById.set(f.id, f));

  // Pass 1: sync match status & winners
  for (const fix of baseFixtures) {
    if (fix.matchId) {
      const linked = matchById.get(fix.matchId);
      if (linked) {
        const outcome = resolveMatchOutcome(linked);
        fix.status = outcome.status;
        fix.winnerTeamId = outcome.winnerTeamId;
        fix.isTie = outcome.isTie;
        fix.isNoResult = outcome.isNoResult;
        fix.resultText = outcome.resultText;
        fix.teamAId = fix.teamAId ?? linked.teamAId;
        fix.teamBId = fix.teamBId ?? linked.teamBId;
      }
    } else if (fix.isNoResult && fix.status === 'abandoned') {
      fix.resultText = fix.resultText || 'Abandoned (No Result)';
    }
  }

  // Pass 2: propagate winners down knockout bracket edges
  for (const fix of baseFixtures) {
    if (fix.sourceFixtureAId) {
      const srcA = fixtureById.get(fix.sourceFixtureAId);
      if (srcA?.winnerTeamId && !fix.teamAId) {
        fix.teamAId = srcA.winnerTeamId;
      }
    }
    if (fix.sourceFixtureBId) {
      const srcB = fixtureById.get(fix.sourceFixtureBId);
      if (srcB?.winnerTeamId && !fix.teamBId) {
        fix.teamBId = srcB.winnerTeamId;
      }
    }
  }

  return baseFixtures;
}

export function seedKnockoutStageFromStandings(
  tournament: Tournament,
  groupStandings: GroupStandings[],
  overallStandings: PointsTableRow[],
): TournamentFixture[] {
  const formatType = resolveTournamentFormat(tournament);
  const fixtures = (tournament.fixtures ?? []).map((f) => ({...f}));

  let qualifiedOrdered: string[] = [];

  if (formatType === 'hybrid' && groupStandings.length > 0) {
    const perGroup = tournament.qualifiersPerGroup ?? 2;
    // Cross-seed: A1 vs B2, B1 vs A2, C1 vs D2, etc.
    const rankedByGroup = groupStandings.map((g) => g.rows.slice(0, perGroup).map((r) => r.teamId));
    if (rankedByGroup.length >= 2 && perGroup >= 2) {
      // Pair adjacent groups cross-over
      const seededPairs: string[] = [];
      for (let g = 0; g < rankedByGroup.length; g += 2) {
        const g1 = rankedByGroup[g] ?? [];
        const g2 = rankedByGroup[g + 1] ?? [];
        if (g2.length > 0) {
          for (let rank = 0; rank < perGroup; rank++) {
            const oppRank = perGroup - 1 - rank;
            if (g1[rank]) seededPairs.push(g1[rank]);
            if (g2[oppRank]) seededPairs.push(g2[oppRank]);
          }
        } else {
          seededPairs.push(...g1);
        }
      }
      qualifiedOrdered = seededPairs;
    } else {
      for (let rank = 0; rank < perGroup; rank++) {
        rankedByGroup.forEach((grp) => {
          if (grp[rank]) qualifiedOrdered.push(grp[rank]);
        });
      }
    }
  } else {
    const qCount = tournament.qualifiersCount ?? (overallStandings.length >= 6 ? 4 : 2);
    qualifiedOrdered = overallStandings.slice(0, qCount).map((r) => r.teamId);
  }

  if (qualifiedOrdered.length < 2) return fixtures;

  // Find first knockout round fixtures (no sourceFixtureAId/BId)
  const entryKnockoutFixtures = fixtures.filter(
    (f) => isKnockoutStage(f.stage) && !f.sourceFixtureAId && !f.sourceFixtureBId,
  );

  entryKnockoutFixtures.forEach((fix, idx) => {
    const teamAId = qualifiedOrdered[idx * 2];
    const teamBId = qualifiedOrdered[idx * 2 + 1];
    if (teamAId && teamBId && teamAId !== teamBId) {
      fix.teamAId = teamAId;
      fix.teamBId = teamBId;
    }
  });

  return fixtures;
}

function buildEmptyRow(team: Team, groupId?: string, groupName?: string): PointsTableRow {
  return {
    rank: 0,
    teamId: team.id,
    teamName: team.name,
    shortName: team.shortName,
    logoDataUrl: team.logoDataUrl,
    primaryColor: team.primaryColor,
    groupId,
    groupName,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    noResult: 0,
    points: 0,
    runsScored: 0,
    ballsFaced: 0,
    oversFacedFormatted: '0.0',
    runsConceded: 0,
    ballsBowled: 0,
    oversBowledFormatted: '0.0',
    nrr: 0,
    nrrFormatted: '0.000',
    isQualified: false,
  };
}

function finalizeStandingsRows(
  rows: PointsTableRow[],
  qualifiersCount: number,
): PointsTableRow[] {
  const finalized = rows.map((row) => {
    const runRateFor = row.ballsFaced > 0 ? (row.runsScored * 6) / row.ballsFaced : 0;
    const runRateAgainst = row.ballsBowled > 0 ? (row.runsConceded * 6) / row.ballsBowled : 0;
    const nrr =
      row.ballsFaced > 0 || row.ballsBowled > 0 ? runRateFor - runRateAgainst : 0;

    return {
      ...row,
      oversFacedFormatted: formatOvers(row.ballsFaced),
      oversBowledFormatted: formatOvers(row.ballsBowled),
      nrr,
      nrrFormatted: formatNRR(nrr),
    };
  });

  finalized.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.won !== a.won) return b.won - a.won;
    if (Math.abs(b.nrr - a.nrr) > 0.00001) return b.nrr - a.nrr;
    return a.teamName.localeCompare(b.teamName);
  });

  return finalized.map((row, idx) => ({
    ...row,
    rank: idx + 1,
    isQualified: qualifiersCount > 0 && idx < qualifiersCount && row.played > 0,
  }));
}

export function computeTournamentStandings(
  tournament: Tournament,
  teams: Team[],
  allMatches: Match[],
): {
  overallRows: PointsTableRow[];
  groupStandings: GroupStandings[];
  syncedFixtures: TournamentFixture[];
} {
  const formatType = resolveTournamentFormat(tournament);
  const teamMap = new Map<string, Team>();
  teams.forEach((t) => teamMap.set(t.id, t));

  const pointsCfg = tournament.pointsConfig ?? {
    win: 2,
    tie: 1,
    noResult: 1,
    loss: 0,
  };

  const syncedFixtures = syncFixturesWithMatchesAndProgression(tournament, allMatches);
  const matchById = new Map<string, Match>();
  allMatches.forEach((m) => matchById.set(m.id, m));

  const participatingIds = Array.from(new Set(tournament.teamIds));
  const rowMap = new Map<string, PointsTableRow>();

  // Assign group metadata if available
  const teamGroupLookup = new Map<string, {id: string; name: string}>();
  (tournament.groups ?? []).forEach((g) => {
    g.teamIds.forEach((tid) => teamGroupLookup.set(tid, {id: g.id, name: g.name}));
  });

  participatingIds.forEach((tid) => {
    const team = teamMap.get(tid);
    if (!team) return;
    const grp = teamGroupLookup.get(tid);
    rowMap.set(tid, buildEmptyRow(team, grp?.id, grp?.name));
  });

  // Track which matches were already processed via fixtures to avoid double counting
  const processedMatchIds = new Set<string>();

  const applyOutcomeToRows = (params: {
    teamAId: string;
    teamBId: string;
    outcome: ResolvedMatchOutcome;
    matchObj?: Match;
  }) => {
    const {teamAId, teamBId, outcome, matchObj} = params;
    if (outcome.status !== 'completed' && outcome.status !== 'abandoned') return;

    // Ensure row exists even if an external match added a team
    [teamAId, teamBId].forEach((tid) => {
      if (!rowMap.has(tid) && teamMap.has(tid)) {
        const grp = teamGroupLookup.get(tid);
        rowMap.set(tid, buildEmptyRow(teamMap.get(tid)!, grp?.id, grp?.name));
      }
    });

    const rowA = rowMap.get(teamAId);
    const rowB = rowMap.get(teamBId);
    if (!rowA || !rowB) return;

    rowA.played += 1;
    rowB.played += 1;

    if (outcome.isNoResult || outcome.status === 'abandoned') {
      rowA.noResult += 1;
      rowB.noResult += 1;
      rowA.points += pointsCfg.noResult;
      rowB.points += pointsCfg.noResult;
      return;
    }

    if (outcome.isTie) {
      rowA.tied += 1;
      rowB.tied += 1;
      rowA.points += pointsCfg.tie;
      rowB.points += pointsCfg.tie;
    } else if (outcome.winnerTeamId === teamAId) {
      rowA.won += 1;
      rowA.points += pointsCfg.win;
      rowB.lost += 1;
      rowB.points += pointsCfg.loss;
    } else if (outcome.winnerTeamId === teamBId) {
      rowB.won += 1;
      rowB.points += pointsCfg.win;
      rowA.lost += 1;
      rowA.points += pointsCfg.loss;
    }

    // Apply NRR runs & overs from actual limited-overs Match innings
    if (matchObj && matchObj.format !== 'TEST' && matchObj.innings.length >= 2) {
      matchObj.innings.slice(0, 2).forEach((inn) => {
        const batRow = rowMap.get(inn.battingTeamId);
        const bowlRow = rowMap.get(inn.bowlingTeamId);
        if (!batRow || !bowlRow) return;

        const xiLen = Math.max(2, getTeamPlayingXI(matchObj, inn.battingTeamId).length);
        const effectiveBalls = calculateEffectiveOversBalls(
          inn,
          matchObj.oversPerInnings,
          xiLen,
        );

        batRow.runsScored += inn.runs;
        batRow.ballsFaced += effectiveBalls;
        bowlRow.runsConceded += inn.runs;
        bowlRow.ballsBowled += effectiveBalls;
      });
    }
  };

  // Process tournament fixtures (standings count league/group/round-robin matches, or all matches in pure knockout)
  syncedFixtures.forEach((fix) => {
    if (formatType !== 'knockout' && isKnockoutStage(fix.stage)) {
      if (fix.matchId) processedMatchIds.add(fix.matchId);
      return;
    }

    if (fix.matchId && matchById.has(fix.matchId)) {
      processedMatchIds.add(fix.matchId);
      const linked = matchById.get(fix.matchId)!;
      const outcome = resolveMatchOutcome(linked);
      applyOutcomeToRows({
        teamAId: linked.teamAId,
        teamBId: linked.teamBId,
        outcome,
        matchObj: linked,
      });
    } else if (
      (fix.status === 'abandoned' || fix.isNoResult) &&
      fix.teamAId &&
      fix.teamBId
    ) {
      applyOutcomeToRows({
        teamAId: fix.teamAId,
        teamBId: fix.teamBId,
        outcome: {
          status: 'abandoned',
          isTie: false,
          isNoResult: true,
          innings: [],
        },
      });
    }
  });

  // Also include any standalone matches tagged with this tournamentId that aren't already linked to a fixture
  allMatches.forEach((m) => {
    if (m.tournamentId === tournament.id && !processedMatchIds.has(m.id)) {
      processedMatchIds.add(m.id);
      const outcome = resolveMatchOutcome(m);
      applyOutcomeToRows({
        teamAId: m.teamAId,
        teamBId: m.teamBId,
        outcome,
        matchObj: m,
      });
    }
  });

  const qualifiersPerGroup = tournament.qualifiersPerGroup ?? 2;
  const groupStandings: GroupStandings[] = (tournament.groups ?? []).map((grp) => {
    const grpRows = grp.teamIds
      .map((tid) => rowMap.get(tid))
      .filter((r): r is PointsTableRow => Boolean(r));
    return {
      groupId: grp.id,
      groupName: grp.name,
      qualifiersCount: formatType === 'hybrid' ? qualifiersPerGroup : 1,
      rows: finalizeStandingsRows(grpRows, formatType === 'hybrid' ? qualifiersPerGroup : 1),
    };
  });

  const overallQualifiersCount =
    formatType === 'knockout'
      ? 1
      : formatType === 'round-robin'
        ? 1
        : formatType === 'league'
          ? (tournament.qualifiersCount ?? (participatingIds.length >= 6 ? 4 : 2))
          : (tournament.groups?.length ?? 1) * qualifiersPerGroup;

  const overallRows = finalizeStandingsRows(
    Array.from(rowMap.values()),
    overallQualifiersCount,
  );

  // Sync group qualification flags onto overallRows when groups exist
  if (groupStandings.length > 0) {
    const qualifiedSet = new Set<string>();
    groupStandings.forEach((gs) =>
      gs.rows.forEach((r) => {
        if (r.isQualified) qualifiedSet.add(r.teamId);
      }),
    );
    overallRows.forEach((r) => {
      r.isQualified = qualifiedSet.has(r.teamId);
    });
  }

  return {overallRows, groupStandings, syncedFixtures};
}

export function computeTournamentResultsAndStats(
  tournament: Tournament,
  teams: Team[],
  players: Player[],
  allMatches: Match[],
): TournamentResultsAndStats {
  const teamMap = new Map<string, Team>();
  teams.forEach((t) => teamMap.set(t.id, t));
  const playerMap = new Map<string, Player>();
  players.forEach((p) => playerMap.set(p.id, p));

  const {overallRows, syncedFixtures} = computeTournamentStandings(
    tournament,
    teams,
    allMatches,
  );

  const qualifiedTeams = overallRows
    .filter((r) => r.isQualified)
    .map((r) => teamMap.get(r.teamId))
    .filter((t): t is Team => Boolean(t));

  const semiTeamIds = new Set<string>();
  const finalTeamIds = new Set<string>();
  let championTeam: Team | null = null;
  let runnerUpTeam: Team | null = null;

  syncedFixtures.forEach((fix) => {
    if (fix.stage === 'semi-final') {
      if (fix.teamAId) semiTeamIds.add(fix.teamAId);
      if (fix.teamBId) semiTeamIds.add(fix.teamBId);
    }
    if (fix.stage === 'final') {
      if (fix.teamAId) finalTeamIds.add(fix.teamAId);
      if (fix.teamBId) finalTeamIds.add(fix.teamBId);
      if (fix.winnerTeamId) {
        championTeam = teamMap.get(fix.winnerTeamId) ?? null;
        const runnerId = fix.winnerTeamId === fix.teamAId ? fix.teamBId : fix.teamAId;
        runnerUpTeam = runnerId ? (teamMap.get(runnerId) ?? null) : null;
      }
    }
  });

  if (!championTeam && tournament.championTeamId) {
    championTeam = teamMap.get(tournament.championTeamId) ?? null;
  }

  // For Round Robin / pure Groups with all matches complete and no Final fixture, #1 rank is champion
  const formatType = resolveTournamentFormat(tournament);
  if (
    !championTeam &&
    (formatType === 'round-robin' || formatType === 'groups') &&
    syncedFixtures.length > 0 &&
    syncedFixtures.every((f) => f.status === 'completed' || f.status === 'abandoned') &&
    overallRows[0]
  ) {
    championTeam = teamMap.get(overallRows[0].teamId) ?? null;
    if (overallRows[1]) {
      runnerUpTeam = teamMap.get(overallRows[1].teamId) ?? null;
    }
  }

  const semiFinalists = Array.from(semiTeamIds)
    .map((id) => teamMap.get(id))
    .filter((t): t is Team => Boolean(t));
  const finalists = Array.from(finalTeamIds)
    .map((id) => teamMap.get(id))
    .filter((t): t is Team => Boolean(t));

  // Collect all unique Match records belonging to this tournament
  const fixtureMatchIds = new Set(
    syncedFixtures.map((f) => f.matchId).filter((id): id is string => Boolean(id)),
  );
  const tournamentMatches = allMatches.filter(
    (m) => m.tournamentId === tournament.id || fixtureMatchIds.has(m.id),
  );

  let totalRuns = 0;
  let totalWickets = 0;
  let totalFours = 0;
  let totalSixes = 0;
  let highestTeamTotal: {scoreText: string; teamName: string} | null = null;
  let highestRuns = -1;

  const batterAccum = new Map<
    string,
    {
      teamId?: string;
      innings: number;
      notOuts: number;
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      fifties: number;
      hundreds: number;
      highScore: number;
    }
  >();

  const bowlerAccum = new Map<
    string,
    {
      teamId?: string;
      innings: number;
      legalBalls: number;
      maidens: number;
      runsConceded: number;
      wickets: number;
      bestWickets: number;
      bestRuns: number;
    }
  >();

  tournamentMatches.forEach((m) => {
    if (m.status === 'abandoned') return;
    m.innings.forEach((inn) => {
      totalRuns += inn.runs;
      totalWickets += inn.wickets;

      if (inn.runs > highestRuns && (inn.runs > 0 || inn.balls.length > 0)) {
        highestRuns = inn.runs;
        const tName = inn.battingTeamId === m.teamAId ? m.teamAName : m.teamBName;
        highestTeamTotal = {
          scoreText: `${inn.runs}/${inn.wickets} (${formatOvers(inn.legalBalls)} ov)`,
          teamName: tName,
        };
      }

      const innBatters = new Map<string, {runs: number; balls: number; fours: number; sixes: number; isOut: boolean}>();
      const ensureInnBat = (pid?: string) => {
        if (!pid) return;
        if (!innBatters.has(pid)) {
          innBatters.set(pid, {runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false});
        }
      };

      if (inn.balls.length > 0) {
        ensureInnBat(inn.openingStrikerId);
        ensureInnBat(inn.openingNonStrikerId);
      }

      const innBowlers = new Map<string, {legalBalls: number; maidens: number; runsConceded: number; wickets: number}>();
      const ensureInnBowl = (pid?: string) => {
        if (!pid) return;
        if (!innBowlers.has(pid)) {
          innBowlers.set(pid, {legalBalls: 0, maidens: 0, runsConceded: 0, wickets: 0});
        }
      };

      let overConceded = 0;
      let overLegal = 0;
      let overBowler: string | undefined;

      inn.balls.forEach((ball) => {
        if (ball.eventType === 'penalty' || ball.extraType === 'penalty') return;
        ensureInnBat(ball.strikerId);
        ensureInnBat(ball.nonStrikerId);
        ensureInnBowl(ball.bowlerId);

        const bat = innBatters.get(ball.strikerId);
        if (bat) {
          if (ball.extraType !== 'wide') bat.balls += 1;
          if (ball.runsOffBat > 0) {
            bat.runs += ball.runsOffBat;
            if (ball.runsOffBat === 4) {
              bat.fours += 1;
              totalFours += 1;
            }
            if (ball.runsOffBat === 6) {
              bat.sixes += 1;
              totalSixes += 1;
            }
          }
        }

        if (ball.isWicket) {
          const outId = ball.dismissedPlayerId ?? ball.strikerId;
          ensureInnBat(outId);
          const outBat = innBatters.get(outId);
          if (outBat) outBat.isOut = true;
        }

        const bowl = innBowlers.get(ball.bowlerId);
        const legal = isLegalDelivery(ball);
        let bowlerRuns = 0;
        if (ball.extraType === 'wide') {
          bowlerRuns = ball.extras;
        } else if (ball.extraType === 'no-ball') {
          const sub = ball.noBallSubExtras ?? 0;
          bowlerRuns = ball.runsOffBat + Math.max(1, ball.extras - sub);
        } else if (ball.extraType !== 'bye' && ball.extraType !== 'leg-bye') {
          bowlerRuns = ball.runsOffBat;
        }

        if (bowl) {
          if (legal) bowl.legalBalls += 1;
          bowl.runsConceded += bowlerRuns;
          if (ball.isWicket && isBowlerCreditedWicket(ball.wicketType)) {
            bowl.wickets += 1;
          }
        }

        if (overBowler && overBowler !== ball.bowlerId && overLegal === 0) {
          overConceded = 0;
        }
        overBowler = ball.bowlerId;
        overConceded += bowlerRuns;
        if (legal) {
          overLegal += 1;
          if (overLegal === 6) {
            if (overConceded === 0 && bowl) bowl.maidens += 1;
            overConceded = 0;
            overLegal = 0;
            overBowler = undefined;
          }
        }
      });

      innBatters.forEach((bStat, pid) => {
        const cur = batterAccum.get(pid) ?? {
          teamId: inn.battingTeamId,
          innings: 0,
          notOuts: 0,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          fifties: 0,
          hundreds: 0,
          highScore: 0,
        };
        cur.innings += 1;
        if (!bStat.isOut) cur.notOuts += 1;
        cur.runs += bStat.runs;
        cur.balls += bStat.balls;
        cur.fours += bStat.fours;
        cur.sixes += bStat.sixes;
        if (bStat.runs >= 100) cur.hundreds += 1;
        else if (bStat.runs >= 50) cur.fifties += 1;
        if (bStat.runs > cur.highScore) cur.highScore = bStat.runs;
        batterAccum.set(pid, cur);
      });

      innBowlers.forEach((bwStat, pid) => {
        const cur = bowlerAccum.get(pid) ?? {
          teamId: inn.bowlingTeamId,
          innings: 0,
          legalBalls: 0,
          maidens: 0,
          runsConceded: 0,
          wickets: 0,
          bestWickets: -1,
          bestRuns: 9999,
        };
        cur.innings += 1;
        cur.legalBalls += bwStat.legalBalls;
        cur.maidens += bwStat.maidens;
        cur.runsConceded += bwStat.runsConceded;
        cur.wickets += bwStat.wickets;
        if (
          bwStat.wickets > cur.bestWickets ||
          (bwStat.wickets === cur.bestWickets && bwStat.runsConceded < cur.bestRuns)
        ) {
          cur.bestWickets = bwStat.wickets;
          cur.bestRuns = bwStat.runsConceded;
        }
        bowlerAccum.set(pid, cur);
      });
    });
  });

  const topBatsmen: TournamentBatterStat[] = Array.from(batterAccum.entries())
    .map(([pid, s]) => {
      const player = playerMap.get(pid);
      const team = teamMap.get(s.teamId ?? player?.teamId ?? '');
      const dismissals = s.innings - s.notOuts;
      return {
        playerId: pid,
        playerName: player?.name ?? 'Player',
        teamId: team?.id,
        teamShortName: team?.shortName ?? 'TM',
        innings: s.innings,
        notOuts: s.notOuts,
        runs: s.runs,
        balls: s.balls,
        fours: s.fours,
        sixes: s.sixes,
        fifties: s.fifties,
        hundreds: s.hundreds,
        highScore: s.highScore,
        average: dismissals > 0 ? Number((s.runs / dismissals).toFixed(2)) : s.runs,
        strikeRate: s.balls > 0 ? Number(((s.runs * 100) / s.balls).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate)
    .slice(0, 15);

  const topBowlers: TournamentBowlerStat[] = Array.from(bowlerAccum.entries())
    .map(([pid, s]) => {
      const player = playerMap.get(pid);
      const team = teamMap.get(s.teamId ?? player?.teamId ?? '');
      return {
        playerId: pid,
        playerName: player?.name ?? 'Bowler',
        teamId: team?.id,
        teamShortName: team?.shortName ?? 'TM',
        innings: s.innings,
        legalBalls: s.legalBalls,
        oversFormatted: formatOvers(s.legalBalls),
        maidens: s.maidens,
        runsConceded: s.runsConceded,
        wickets: s.wickets,
        economy: s.legalBalls > 0 ? Number(((s.runsConceded * 6) / s.legalBalls).toFixed(2)) : 0,
        bestWickets: Math.max(0, s.bestWickets),
        bestRuns: s.bestRuns === 9999 ? 0 : s.bestRuns,
      };
    })
    .sort((a, b) => b.wickets - a.wickets || a.economy - b.economy)
    .slice(0, 15);

  const completedMatches = syncedFixtures.filter((f) => f.status === 'completed').length;
  const liveMatches = syncedFixtures.filter((f) => f.status === 'live').length;
  const abandonedMatches = syncedFixtures.filter((f) => f.status === 'abandoned').length;
  const upcomingMatches = syncedFixtures.filter((f) => f.status === 'upcoming').length;

  return {
    qualifiedTeams,
    semiFinalists,
    finalists,
    championTeam,
    runnerUpTeam,
    summary: {
      totalFixtures: syncedFixtures.length,
      completedMatches,
      liveMatches,
      upcomingMatches,
      abandonedMatches,
      totalRuns,
      totalWickets,
      totalFours,
      totalSixes,
      highestTeamTotal,
    },
    topBatsmen,
    topBowlers,
  };
}

export function checkDuplicateGroupPairing(
  fixtures: TournamentFixture[],
  candidate: {
    id?: string;
    stage: FixtureStage;
    groupId?: string;
    teamAId?: string;
    teamBId?: string;
  },
): boolean {
  if (!candidate.teamAId || !candidate.teamBId || isKnockoutStage(candidate.stage)) {
    return false;
  }
  const canonical =
    candidate.teamAId < candidate.teamBId
      ? `${candidate.teamAId}|${candidate.teamBId}`
      : `${candidate.teamBId}|${candidate.teamAId}`;

  return fixtures.some((f) => {
    if (f.id === candidate.id || !f.teamAId || !f.teamBId) return false;
    if (f.stage !== candidate.stage) return false;
    if (candidate.groupId && f.groupId !== candidate.groupId) return false;
    const fCanon = f.teamAId < f.teamBId ? `${f.teamAId}|${f.teamBId}` : `${f.teamBId}|${f.teamAId}`;
    return fCanon === canonical;
  });
}
