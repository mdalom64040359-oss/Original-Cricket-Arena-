import {
  formatOvers,
  isBowlerCreditedWicket,
  isLegalDelivery,
} from './scoringEngine';
import {
  calculateEffectiveOversBalls,
  formatNRR,
  resolveMatchOutcome,
} from './tournamentEngine';
import type {
  Match,
  MatchFormat,
  Player,
  Team,
  Tournament,
} from '../types/cricket';

export interface StatsFilterOptions {
  format: 'all' | MatchFormat;
  tournamentId: 'all' | string;
  teamId: 'all' | string;
  dateFrom: string;
  dateTo: string;
}

export interface PlayerBattingInningsPerf {
  playerId: string;
  playerName: string;
  matchId: string;
  matchTitle: string;
  matchDate: string;
  format: MatchFormat;
  tournamentId?: string;
  tournamentName?: string;
  teamId: string;
  teamShortName: string;
  opponentId: string;
  opponentShortName: string;
  inningsNumber: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  dismissalText: string;
}

export interface PlayerBowlingInningsPerf {
  playerId: string;
  playerName: string;
  matchId: string;
  matchTitle: string;
  matchDate: string;
  format: MatchFormat;
  tournamentId?: string;
  tournamentName?: string;
  teamId: string;
  teamShortName: string;
  opponentId: string;
  opponentShortName: string;
  inningsNumber: number;
  legalBalls: number;
  oversFormatted: string;
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy: number;
}

export interface PlayerMatchPerformance {
  matchId: string;
  matchTitle: string;
  matchDate: string;
  format: MatchFormat;
  tournamentName?: string;
  teamShortName: string;
  opponentShortName: string;
  resultSummary?: string;
  battingEntries: PlayerBattingInningsPerf[];
  bowlingEntries: PlayerBowlingInningsPerf[];
}

export interface PlayerFormatBreakdown {
  format: MatchFormat;
  matches: number;
  innings: number;
  runs: number;
  highestScoreFormatted: string;
  average: number | null;
  strikeRate: number;
  wickets: number;
  economy: number;
  bestBowlingFormatted: string;
}

export interface PlayerStatsRecord {
  playerId: string;
  playerName: string;
  photoDataUrl?: string;
  jerseyNumber?: number;
  role: Player['role'];
  battingStyle: Player['battingStyle'];
  bowlingStyle?: string;
  teamId?: string;
  teamName: string;
  teamShortName: string;
  matches: number;

  // Batting
  battingInnings: number;
  notOuts: number;
  runs: number;
  ballsFaced: number;
  highestScore: number;
  highestScoreIsNotOut: boolean;
  highestScoreFormatted: string;
  battingAverage: number | null;
  strikeRate: number;
  fours: number;
  sixes: number;
  boundaries: number;
  fifties: number;
  hundreds: number;
  ducks: number;

  // Bowling
  bowlingInnings: number;
  legalBallsBowled: number;
  oversBowledFormatted: string;
  maidens: number;
  runsConceded: number;
  wickets: number;
  bowlingAverage: number | null;
  economy: number;
  bowlingStrikeRate: number | null;
  bestBowlingWickets: number;
  bestBowlingRuns: number;
  bestBowlingFormatted: string;

  // Logs & breakdowns
  matchPerformances: PlayerMatchPerformance[];
  formatBreakdown: PlayerFormatBreakdown[];
}

export interface TeamStatsRecord {
  teamId: string;
  teamName: string;
  shortName: string;
  logoDataUrl?: string;
  primaryColor: string;
  matches: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  winPercentage: number;
  runsScored: number;
  ballsFaced: number;
  oversFacedFormatted: string;
  runsConceded: number;
  ballsBowled: number;
  oversBowledFormatted: string;
  nrr: number;
  nrrFormatted: string;
  highestTotal: number;
  lowestTotal: number | null;
  totalFours: number;
  totalSixes: number;
  totalWicketsTaken: number;
}

export interface TournamentStatsSummaryRecord {
  tournamentId: string;
  tournamentName: string;
  format: MatchFormat;
  matchesCount: number;
  completedCount: number;
  totalRuns: number;
  totalWickets: number;
  totalFours: number;
  totalSixes: number;
  highestScoreText: string;
  topScorer: {name: string; runs: number} | null;
  topWicketTaker: {name: string; wickets: number} | null;
}

export interface ComputedStatisticsBundle {
  filteredMatchesCount: number;
  completedMatchesCount: number;
  totalRuns: number;
  totalWickets: number;
  totalFours: number;
  totalSixes: number;
  playerStats: PlayerStatsRecord[];
  teamStats: TeamStatsRecord[];
  tournamentStats: TournamentStatsSummaryRecord[];
  leaderboards: {
    mostRuns: PlayerStatsRecord[];
    highestScores: PlayerBattingInningsPerf[];
    bestAverage: PlayerStatsRecord[];
    bestStrikeRate: PlayerStatsRecord[];
    mostWickets: PlayerStatsRecord[];
    bestBowlingFigures: PlayerBowlingInningsPerf[];
    bestEconomy: PlayerStatsRecord[];
    mostBoundaries: PlayerStatsRecord[];
    mostFours: PlayerStatsRecord[];
    mostSixes: PlayerStatsRecord[];
  };
}

export const DEFAULT_STATS_FILTER: StatsFilterOptions = {
  format: 'all',
  tournamentId: 'all',
  teamId: 'all',
  dateFrom: '',
  dateTo: '',
};

export function filterMatchesForStats(
  matches: Match[],
  filter: StatsFilterOptions,
): Match[] {
  const seenIds = new Set<string>();
  const result: Match[] = [];

  for (const m of matches) {
    if (seenIds.has(m.id)) continue;
    seenIds.add(m.id);

    if (filter.format !== 'all' && m.format !== filter.format) continue;
    if (filter.tournamentId !== 'all' && m.tournamentId !== filter.tournamentId) continue;
    if (
      filter.teamId !== 'all' &&
      m.teamAId !== filter.teamId &&
      m.teamBId !== filter.teamId
    ) {
      continue;
    }

    const matchDate = m.matchDate || m.createdAt.slice(0, 10);
    if (filter.dateFrom && matchDate < filter.dateFrom) continue;
    if (filter.dateTo && matchDate > filter.dateTo) continue;

    result.push(m);
  }

  return result.sort((a, b) => (b.matchDate || b.updatedAt).localeCompare(a.matchDate || a.updatedAt));
}

function formatDismissal(wicketType?: string): string {
  if (!wicketType) return 'out';
  return wicketType.replace('-', ' ');
}

export function computeStatisticsBundle(params: {
  matches: Match[];
  players: Player[];
  teams: Team[];
  tournaments: Tournament[];
  filter?: StatsFilterOptions;
}): ComputedStatisticsBundle {
  const {matches, players, teams, tournaments, filter = DEFAULT_STATS_FILTER} = params;

  const teamMap = new Map<string, Team>();
  teams.forEach((t) => teamMap.set(t.id, t));

  const playerMap = new Map<string, Player>();
  players.forEach((p) => playerMap.set(p.id, p));

  const tournamentMap = new Map<string, Tournament>();
  tournaments.forEach((t) => tournamentMap.set(t.id, t));

  const filteredMatches = filterMatchesForStats(matches, filter);

  let totalRuns = 0;
  let totalWickets = 0;
  let totalFours = 0;
  let totalSixes = 0;

  const allBattingInningsPerfs: PlayerBattingInningsPerf[] = [];
  const allBowlingInningsPerfs: PlayerBowlingInningsPerf[] = [];

  // Team accumulators
  const teamAccMap = new Map<string, TeamStatsRecord>();
  const ensureTeamAcc = (teamId: string, fallbackName?: string, fallbackShort?: string): TeamStatsRecord => {
    const existing = teamAccMap.get(teamId);
    if (existing) return existing;
    const t = teamMap.get(teamId);
    const created: TeamStatsRecord = {
      teamId,
      teamName: t?.name ?? fallbackName ?? 'Team',
      shortName: t?.shortName ?? fallbackShort ?? 'TM',
      logoDataUrl: t?.logoDataUrl,
      primaryColor: t?.primaryColor ?? '#0D3B24',
      matches: 0,
      won: 0,
      lost: 0,
      tied: 0,
      noResult: 0,
      winPercentage: 0,
      runsScored: 0,
      ballsFaced: 0,
      oversFacedFormatted: '0.0',
      runsConceded: 0,
      ballsBowled: 0,
      oversBowledFormatted: '0.0',
      nrr: 0,
      nrrFormatted: '0.000',
      highestTotal: 0,
      lowestTotal: null,
      totalFours: 0,
      totalSixes: 0,
      totalWicketsTaken: 0,
    };
    teamAccMap.set(teamId, created);
    return created;
  };

  // Player match-by-match accumulators
  const playerMatchMap = new Map<string, Map<string, PlayerMatchPerformance>>();
  const ensurePlayerMatchPerf = (
    playerId: string,
    match: Match,
    teamId: string,
    teamShort: string,
    opponentShort: string,
  ): PlayerMatchPerformance => {
    let byMatch = playerMatchMap.get(playerId);
    if (!byMatch) {
      byMatch = new Map();
      playerMatchMap.set(playerId, byMatch);
    }
    let entry = byMatch.get(match.id);
    if (!entry) {
      entry = {
        matchId: match.id,
        matchTitle: match.title,
        matchDate: match.matchDate || match.createdAt.slice(0, 10),
        format: match.format,
        tournamentName: match.tournamentName,
        teamShortName: teamShort,
        opponentShortName: opponentShort,
        resultSummary: match.resultSummary,
        battingEntries: [],
        bowlingEntries: [],
      };
      byMatch.set(match.id, entry);
    }
    void teamId;
    return entry;
  };

  // Deduplicate innings per match
  const seenMatchInnings = new Set<string>();

  for (const match of filteredMatches) {
    const tA = ensureTeamAcc(match.teamAId, match.teamAName, match.teamAShortName);
    const tB = ensureTeamAcc(match.teamBId, match.teamBName, match.teamBShortName);

    const outcome = resolveMatchOutcome(match);
    if (match.status === 'completed' || match.status === 'abandoned') {
      tA.matches += 1;
      tB.matches += 1;
      if (outcome.isNoResult || match.status === 'abandoned') {
        tA.noResult += 1;
        tB.noResult += 1;
      } else if (outcome.isTie) {
        tA.tied += 1;
        tB.tied += 1;
      } else if (outcome.winnerTeamId === match.teamAId) {
        tA.won += 1;
        tB.lost += 1;
      } else if (outcome.winnerTeamId === match.teamBId) {
        tB.won += 1;
        tA.lost += 1;
      }
    }

    if (match.status === 'abandoned') continue;

    // NRR runs/balls for completed limited-overs matches
    if (match.status === 'completed' && match.format !== 'TEST' && match.innings.length >= 2) {
      match.innings.slice(0, 2).forEach((inn) => {
        const batTeamAcc = ensureTeamAcc(inn.battingTeamId);
        const bowlTeamAcc = ensureTeamAcc(inn.bowlingTeamId);
        const xiLen = Math.max(
          2,
          (inn.battingTeamId === match.teamAId ? match.teamAPlayingXI : match.teamBPlayingXI).length,
        );
        const effectiveBalls = calculateEffectiveOversBalls(
          inn,
          match.oversPerInnings,
          xiLen,
        );
        batTeamAcc.runsScored += inn.runs;
        batTeamAcc.ballsFaced += effectiveBalls;
        bowlTeamAcc.runsConceded += inn.runs;
        bowlTeamAcc.ballsBowled += effectiveBalls;
      });
    }

    const matchDate = match.matchDate || match.createdAt.slice(0, 10);

    for (const inn of match.innings) {
      const innKey = `${match.id}#${inn.inningsNumber}`;
      if (seenMatchInnings.has(innKey)) continue;
      seenMatchInnings.add(innKey);

      const hasPlay = inn.balls.length > 0 || inn.runs > 0 || inn.wickets > 0;
      if (!hasPlay) continue;

      const batTeamId = inn.battingTeamId;
      const bowlTeamId = inn.bowlingTeamId;
      const batTeamShort =
        batTeamId === match.teamAId ? match.teamAShortName : match.teamBShortName;
      const bowlTeamShort =
        bowlTeamId === match.teamAId ? match.teamAShortName : match.teamBShortName;

      const batTeamAcc = ensureTeamAcc(batTeamId);
      const bowlTeamAcc = ensureTeamAcc(bowlTeamId);

      totalRuns += inn.runs;
      totalWickets += inn.wickets;
      bowlTeamAcc.totalWicketsTaken += inn.wickets;

      if (inn.runs > batTeamAcc.highestTotal) {
        batTeamAcc.highestTotal = inn.runs;
      }
      if (
        (inn.isCompleted || match.status === 'completed') &&
        (batTeamAcc.lowestTotal === null || inn.runs < batTeamAcc.lowestTotal)
      ) {
        batTeamAcc.lowestTotal = inn.runs;
      }

      const innBatMap = new Map<
        string,
        {runs: number; balls: number; fours: number; sixes: number; isOut: boolean; dismissalText: string}
      >();
      const ensureInnBat = (pid?: string) => {
        if (!pid) return;
        if (!innBatMap.has(pid)) {
          innBatMap.set(pid, {
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            isOut: false,
            dismissalText: 'not out',
          });
        }
      };

      const innBowlMap = new Map<
        string,
        {legalBalls: number; maidens: number; runsConceded: number; wickets: number}
      >();
      const ensureInnBowl = (pid?: string) => {
        if (!pid) return;
        if (!innBowlMap.has(pid)) {
          innBowlMap.set(pid, {
            legalBalls: 0,
            maidens: 0,
            runsConceded: 0,
            wickets: 0,
          });
        }
      };

      let overConceded = 0;
      let overLegal = 0;
      let overBowler: string | undefined;

      for (const ball of inn.balls) {
        if (ball.eventType === 'penalty' || ball.extraType === 'penalty') continue;

        ensureInnBat(ball.strikerId);
        ensureInnBat(ball.nonStrikerId);
        ensureInnBowl(ball.bowlerId);

        const batStat = innBatMap.get(ball.strikerId);
        if (batStat) {
          if (ball.extraType !== 'wide') {
            batStat.balls += 1;
          }
          if (ball.runsOffBat > 0) {
            batStat.runs += ball.runsOffBat;
            if (ball.runsOffBat === 4) {
              batStat.fours += 1;
              totalFours += 1;
              batTeamAcc.totalFours += 1;
            }
            if (ball.runsOffBat === 6) {
              batStat.sixes += 1;
              totalSixes += 1;
              batTeamAcc.totalSixes += 1;
            }
          }
        }

        if (ball.isWicket) {
          const outId = ball.dismissedPlayerId ?? ball.strikerId;
          ensureInnBat(outId);
          const outStat = innBatMap.get(outId);
          if (outStat) {
            outStat.isOut = true;
            outStat.dismissalText = formatDismissal(ball.wicketType);
          }
        }

        const bowlStat = innBowlMap.get(ball.bowlerId);
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

        if (bowlStat) {
          if (legal) bowlStat.legalBalls += 1;
          bowlStat.runsConceded += bowlerRuns;
          if (ball.isWicket && isBowlerCreditedWicket(ball.wicketType)) {
            bowlStat.wickets += 1;
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
            if (overConceded === 0 && bowlStat) {
              bowlStat.maidens += 1;
            }
            overConceded = 0;
            overLegal = 0;
            overBowler = undefined;
          }
        }
      }

      // Record batting innings entries (respect team filter if active)
      if (filter.teamId === 'all' || filter.teamId === batTeamId) {
        innBatMap.forEach((b, pid) => {
          const perf: PlayerBattingInningsPerf = {
            playerId: pid,
            playerName: playerMap.get(pid)?.name ?? 'Player',
            matchId: match.id,
            matchTitle: match.title,
            matchDate,
            format: match.format,
            tournamentId: match.tournamentId,
            tournamentName: match.tournamentName,
            teamId: batTeamId,
            teamShortName: batTeamShort,
            opponentId: bowlTeamId,
            opponentShortName: bowlTeamShort,
            inningsNumber: inn.inningsNumber,
            runs: b.runs,
            balls: b.balls,
            fours: b.fours,
            sixes: b.sixes,
            strikeRate: b.balls > 0 ? Number(((b.runs * 100) / b.balls).toFixed(2)) : 0,
            isOut: b.isOut,
            dismissalText: b.dismissalText,
          };
          allBattingInningsPerfs.push(perf);
          const pm = ensurePlayerMatchPerf(pid, match, batTeamId, batTeamShort, bowlTeamShort);
          pm.battingEntries.push(perf);
        });
      }

      // Record bowling innings entries (respect team filter if active)
      if (filter.teamId === 'all' || filter.teamId === bowlTeamId) {
        innBowlMap.forEach((bw, pid) => {
          const perf: PlayerBowlingInningsPerf = {
            playerId: pid,
            playerName: playerMap.get(pid)?.name ?? 'Bowler',
            matchId: match.id,
            matchTitle: match.title,
            matchDate,
            format: match.format,
            tournamentId: match.tournamentId,
            tournamentName: match.tournamentName,
            teamId: bowlTeamId,
            teamShortName: bowlTeamShort,
            opponentId: batTeamId,
            opponentShortName: batTeamShort,
            inningsNumber: inn.inningsNumber,
            legalBalls: bw.legalBalls,
            oversFormatted: formatOvers(bw.legalBalls),
            maidens: bw.maidens,
            runsConceded: bw.runsConceded,
            wickets: bw.wickets,
            economy:
              bw.legalBalls > 0 ? Number(((bw.runsConceded * 6) / bw.legalBalls).toFixed(2)) : 0,
          };
          allBowlingInningsPerfs.push(perf);
          const pm = ensurePlayerMatchPerf(pid, match, bowlTeamId, bowlTeamShort, batTeamShort);
          pm.bowlingEntries.push(perf);
        });
      }
    }
  }

  // Aggregate PlayerStatsRecord for every player who appeared in filtered matches
  const playerIdsWithStats = new Set<string>(playerMatchMap.keys());
  const playerStats: PlayerStatsRecord[] = [];

  playerIdsWithStats.forEach((pid) => {
    const player = playerMap.get(pid);
    const matchPerfMap = playerMatchMap.get(pid)!;
    const matchPerformances = Array.from(matchPerfMap.values()).sort((a, b) =>
      b.matchDate.localeCompare(a.matchDate),
    );

    const batPerfs = matchPerformances.flatMap((mp) => mp.battingEntries);
    const bowlPerfs = matchPerformances.flatMap((mp) => mp.bowlingEntries);

    const battingInnings = batPerfs.length;
    const notOuts = batPerfs.filter((b) => !b.isOut).length;
    const dismissals = battingInnings - notOuts;
    const runs = batPerfs.reduce((s, b) => s + b.runs, 0);
    const ballsFaced = batPerfs.reduce((s, b) => s + b.balls, 0);
    const fours = batPerfs.reduce((s, b) => s + b.fours, 0);
    const sixes = batPerfs.reduce((s, b) => s + b.sixes, 0);
    const fifties = batPerfs.filter((b) => b.runs >= 50 && b.runs < 100).length;
    const hundreds = batPerfs.filter((b) => b.runs >= 100).length;
    const ducks = batPerfs.filter((b) => b.runs === 0 && b.isOut).length;

    let highestScore = 0;
    let highestScoreIsNotOut = false;
    batPerfs.forEach((b) => {
      if (
        b.runs > highestScore ||
        (b.runs === highestScore && !b.isOut && highestScoreIsNotOut === false)
      ) {
        highestScore = b.runs;
        highestScoreIsNotOut = !b.isOut;
      }
    });

    const bowlingInnings = bowlPerfs.length;
    const legalBallsBowled = bowlPerfs.reduce((s, bw) => s + bw.legalBalls, 0);
    const maidens = bowlPerfs.reduce((s, bw) => s + bw.maidens, 0);
    const runsConceded = bowlPerfs.reduce((s, bw) => s + bw.runsConceded, 0);
    const wickets = bowlPerfs.reduce((s, bw) => s + bw.wickets, 0);

    let bestBowlingWickets = -1;
    let bestBowlingRuns = 99999;
    bowlPerfs.forEach((bw) => {
      if (
        bw.wickets > bestBowlingWickets ||
        (bw.wickets === bestBowlingWickets && bw.runsConceded < bestBowlingRuns)
      ) {
        bestBowlingWickets = bw.wickets;
        bestBowlingRuns = bw.runsConceded;
      }
    });

    // Format breakdown per player
    const formatsSeen = Array.from(new Set(matchPerformances.map((mp) => mp.format)));
    const formatBreakdown: PlayerFormatBreakdown[] = formatsSeen.map((fmt) => {
      const fmtMatches = matchPerformances.filter((mp) => mp.format === fmt);
      const fmtBat = fmtMatches.flatMap((mp) => mp.battingEntries);
      const fmtBowl = fmtMatches.flatMap((mp) => mp.bowlingEntries);

      const fRuns = fmtBat.reduce((s, b) => s + b.runs, 0);
      const fBalls = fmtBat.reduce((s, b) => s + b.balls, 0);
      const fNotOuts = fmtBat.filter((b) => !b.isOut).length;
      const fDis = fmtBat.length - fNotOuts;
      let fHS = 0;
      let fHSNO = false;
      fmtBat.forEach((b) => {
        if (b.runs > fHS || (b.runs === fHS && !b.isOut)) {
          fHS = b.runs;
          fHSNO = !b.isOut;
        }
      });

      const fBowlBalls = fmtBowl.reduce((s, bw) => s + bw.legalBalls, 0);
      const fBowlRuns = fmtBowl.reduce((s, bw) => s + bw.runsConceded, 0);
      const fWkts = fmtBowl.reduce((s, bw) => s + bw.wickets, 0);
      let fBestW = -1;
      let fBestR = 99999;
      fmtBowl.forEach((bw) => {
        if (bw.wickets > fBestW || (bw.wickets === fBestW && bw.runsConceded < fBestR)) {
          fBestW = bw.wickets;
          fBestR = bw.runsConceded;
        }
      });

      return {
        format: fmt,
        matches: fmtMatches.length,
        innings: fmtBat.length,
        runs: fRuns,
        highestScoreFormatted: fmtBat.length > 0 ? `${fHS}${fHSNO ? '*' : ''}` : '—',
        average: fDis > 0 ? Number((fRuns / fDis).toFixed(2)) : null,
        strikeRate: fBalls > 0 ? Number(((fRuns * 100) / fBalls).toFixed(1)) : 0,
        wickets: fWkts,
        economy: fBowlBalls > 0 ? Number(((fBowlRuns * 6) / fBowlBalls).toFixed(2)) : 0,
        bestBowlingFormatted: fmtBowl.length > 0 ? `${fBestW}/${fBestR}` : '—',
      };
    });

    const latestTeamId =
      player?.teamId ?? batPerfs[0]?.teamId ?? bowlPerfs[0]?.teamId;
    const team = latestTeamId ? teamMap.get(latestTeamId) : undefined;

    playerStats.push({
      playerId: pid,
      playerName: player?.name ?? 'Player',
      photoDataUrl: player?.photoDataUrl,
      jerseyNumber: player?.jerseyNumber,
      role: player?.role ?? 'all-rounder',
      battingStyle: player?.battingStyle ?? 'right-hand',
      bowlingStyle: player?.bowlingStyle,
      teamId: latestTeamId,
      teamName: team?.name ?? batPerfs[0]?.teamShortName ?? bowlPerfs[0]?.teamShortName ?? 'Club',
      teamShortName:
        team?.shortName ?? batPerfs[0]?.teamShortName ?? bowlPerfs[0]?.teamShortName ?? 'TM',
      matches: matchPerformances.length,
      battingInnings,
      notOuts,
      runs,
      ballsFaced,
      highestScore,
      highestScoreIsNotOut,
      highestScoreFormatted:
        battingInnings > 0 ? `${highestScore}${highestScoreIsNotOut ? '*' : ''}` : '—',
      battingAverage: dismissals > 0 ? Number((runs / dismissals).toFixed(2)) : null,
      strikeRate: ballsFaced > 0 ? Number(((runs * 100) / ballsFaced).toFixed(2)) : 0,
      fours,
      sixes,
      boundaries: fours + sixes,
      fifties,
      hundreds,
      ducks,
      bowlingInnings,
      legalBallsBowled,
      oversBowledFormatted: formatOvers(legalBallsBowled),
      maidens,
      runsConceded,
      wickets,
      bowlingAverage: wickets > 0 ? Number((runsConceded / wickets).toFixed(2)) : null,
      economy:
        legalBallsBowled > 0 ? Number(((runsConceded * 6) / legalBallsBowled).toFixed(2)) : 0,
      bowlingStrikeRate: wickets > 0 ? Number((legalBallsBowled / wickets).toFixed(1)) : null,
      bestBowlingWickets: Math.max(0, bestBowlingWickets),
      bestBowlingRuns: bestBowlingRuns === 99999 ? 0 : bestBowlingRuns,
      bestBowlingFormatted:
        bowlingInnings > 0 ? `${Math.max(0, bestBowlingWickets)}/${bestBowlingRuns}` : '—',
      matchPerformances,
      formatBreakdown,
    });
  });

  // Finalize TeamStatsRecord
  const teamStats = Array.from(teamAccMap.values())
    .filter((ts) => filter.teamId === 'all' || ts.teamId === filter.teamId)
    .map((ts) => {
      const decided = ts.won + ts.lost;
      const rrFor = ts.ballsFaced > 0 ? (ts.runsScored * 6) / ts.ballsFaced : 0;
      const rrAgainst = ts.ballsBowled > 0 ? (ts.runsConceded * 6) / ts.ballsBowled : 0;
      const nrr = ts.ballsFaced > 0 || ts.ballsBowled > 0 ? rrFor - rrAgainst : 0;
      return {
        ...ts,
        winPercentage: decided > 0 ? Number(((ts.won * 100) / decided).toFixed(1)) : 0,
        oversFacedFormatted: formatOvers(ts.ballsFaced),
        oversBowledFormatted: formatOvers(ts.ballsBowled),
        nrr,
        nrrFormatted: formatNRR(nrr),
      };
    })
    .sort((a, b) => b.won - a.won || b.nrr - a.nrr || a.teamName.localeCompare(b.teamName));

  // Tournament stats summary from filtered matches
  const tourMatchesMap = new Map<string, Match[]>();
  filteredMatches.forEach((m) => {
    if (!m.tournamentId) return;
    const list = tourMatchesMap.get(m.tournamentId) ?? [];
    list.push(m);
    tourMatchesMap.set(m.tournamentId, list);
  });

  const tournamentStats: TournamentStatsSummaryRecord[] = Array.from(tourMatchesMap.entries()).map(
    ([tid, tMatches]) => {
      const tObj = tournamentMap.get(tid);
      let tRuns = 0;
      let tWkts = 0;
      let tFours = 0;
      let tSixes = 0;
      let highRuns = -1;
      let highText = '—';
      const batRunMap = new Map<string, number>();
      const bowlWktMap = new Map<string, number>();

      tMatches.forEach((m) => {
        if (m.status === 'abandoned') return;
        m.innings.forEach((inn) => {
          tRuns += inn.runs;
          tWkts += inn.wickets;
          if (inn.runs > highRuns && (inn.runs > 0 || inn.balls.length > 0)) {
            highRuns = inn.runs;
            const sName = inn.battingTeamId === m.teamAId ? m.teamAShortName : m.teamBShortName;
            highText = `${sName} ${inn.runs}/${inn.wickets}`;
          }
          inn.balls.forEach((b) => {
            if (b.eventType === 'penalty' || b.extraType === 'penalty') return;
            if (b.runsOffBat === 4) tFours += 1;
            if (b.runsOffBat === 6) tSixes += 1;
            if (b.runsOffBat > 0) {
              batRunMap.set(b.strikerId, (batRunMap.get(b.strikerId) ?? 0) + b.runsOffBat);
            }
            if (b.isWicket && isBowlerCreditedWicket(b.wicketType)) {
              bowlWktMap.set(b.bowlerId, (bowlWktMap.get(b.bowlerId) ?? 0) + 1);
            }
          });
        });
      });

      let topScorer: {name: string; runs: number} | null = null;
      batRunMap.forEach((r, pid) => {
        if (!topScorer || r > topScorer.runs) {
          topScorer = {name: playerMap.get(pid)?.name ?? 'Player', runs: r};
        }
      });

      let topWicketTaker: {name: string; wickets: number} | null = null;
      bowlWktMap.forEach((w, pid) => {
        if (!topWicketTaker || w > topWicketTaker.wickets) {
          topWicketTaker = {name: playerMap.get(pid)?.name ?? 'Bowler', wickets: w};
        }
      });

      return {
        tournamentId: tid,
        tournamentName: tObj?.name ?? tMatches[0]?.tournamentName ?? 'Tournament',
        format: tObj?.format ?? tMatches[0]?.format ?? 'T20',
        matchesCount: tMatches.length,
        completedCount: tMatches.filter((m) => m.status === 'completed').length,
        totalRuns: tRuns,
        totalWickets: tWkts,
        totalFours: tFours,
        totalSixes: tSixes,
        highestScoreText: highText,
        topScorer,
        topWicketTaker,
      };
    },
  );

  // Leaderboards
  const mostRuns = [...playerStats]
    .filter((p) => p.battingInnings > 0)
    .sort((a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate);

  const highestScores = [...allBattingInningsPerfs].sort(
    (a, b) =>
      b.runs - a.runs ||
      Number(!b.isOut) - Number(!a.isOut) ||
      a.balls - b.balls,
  );

  const bestAverage = [...playerStats]
    .filter((p) => p.battingAverage !== null)
    .sort((a, b) => (b.battingAverage ?? 0) - (a.battingAverage ?? 0) || b.runs - a.runs);

  const bestStrikeRate = [...playerStats]
    .filter((p) => p.ballsFaced > 0)
    .sort((a, b) => b.strikeRate - a.strikeRate || b.runs - a.runs);

  const mostWickets = [...playerStats]
    .filter((p) => p.bowlingInnings > 0)
    .sort((a, b) => b.wickets - a.wickets || a.economy - b.economy);

  const bestBowlingFigures = [...allBowlingInningsPerfs].sort(
    (a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded,
  );

  const bestEconomy = [...playerStats]
    .filter((p) => p.legalBallsBowled > 0)
    .sort((a, b) => a.economy - b.economy || b.wickets - a.wickets);

  const mostBoundaries = [...playerStats]
    .filter((p) => p.boundaries > 0)
    .sort((a, b) => b.boundaries - a.boundaries || b.sixes - a.sixes || b.runs - a.runs);

  const mostFours = [...playerStats]
    .filter((p) => p.fours > 0)
    .sort((a, b) => b.fours - a.fours || b.runs - a.runs);

  const mostSixes = [...playerStats]
    .filter((p) => p.sixes > 0)
    .sort((a, b) => b.sixes - a.sixes || b.runs - a.runs);

  return {
    filteredMatchesCount: filteredMatches.length,
    completedMatchesCount: filteredMatches.filter((m) => m.status === 'completed').length,
    totalRuns,
    totalWickets,
    totalFours,
    totalSixes,
    playerStats,
    teamStats,
    tournamentStats,
    leaderboards: {
      mostRuns,
      highestScores,
      bestAverage,
      bestStrikeRate,
      mostWickets,
      bestBowlingFigures,
      bestEconomy,
      mostBoundaries,
      mostFours,
      mostSixes,
    },
  };
}
