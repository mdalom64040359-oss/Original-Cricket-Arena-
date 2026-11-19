import {formatOvers} from './scoringEngine';
import type {Match, Player, Team, Tournament} from '../types/cricket';
import type {LocalPersonalState, MatchNotificationItem} from '../types/user';

function matchInvolvesPlayer(match: Match, playerId: string): boolean {
  if (match.teamAPlayingXI.includes(playerId) || match.teamBPlayingXI.includes(playerId)) {
    return true;
  }
  if (match.playerOfTheMatchId === playerId) return true;
  return match.innings.some((inn) =>
    inn.balls.some(
      (b) =>
        b.strikerId === playerId ||
        b.nonStrikerId === playerId ||
        b.bowlerId === playerId ||
        b.dismissedPlayerId === playerId ||
        b.fielderId === playerId,
    ),
  );
}

function summarizeMatchScore(match: Match): string {
  if (match.resultSummary) return match.resultSummary;
  if (match.innings.length === 0) {
    return `${match.teamAName} vs ${match.teamBName} · ${match.format}`;
  }
  return match.innings
    .map((inn) => {
      const code =
        inn.battingTeamId === match.teamAId ? match.teamAShortName : match.teamBShortName;
      return `${code} ${inn.runs}/${inn.wickets} (${formatOvers(inn.legalBalls)})`;
    })
    .join(' · ');
}

export function computePersonalMatchNotifications(params: {
  profile: LocalPersonalState;
  matches: Match[];
  teams: Team[];
  players: Player[];
  tournaments: Tournament[];
}): MatchNotificationItem[] {
  const {profile, matches, teams, players, tournaments} = params;
  const ns = profile.notificationSettings;

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const tournamentMap = new Map(tournaments.map((t) => [t.id, t]));

  const favTeamSet = new Set(profile.favouriteTeamIds);
  const favPlayerSet = new Set(profile.favouritePlayerIds);
  const favLeagueSet = new Set(profile.favouriteLeagues.map((l) => l.toLowerCase()));
  const favMatchSet = new Set(profile.favouriteMatchIds);

  const items: MatchNotificationItem[] = [];
  const seen = new Set<string>();

  const statusAllowed = (status: Match['status']) => {
    if (status === 'abandoned') return false;
    if (status === 'upcoming' && !ns.matchReminders) return false;
    if (status === 'completed' && !ns.matchResults) return false;
    return true;
  };

  const sortedMatches = [...matches].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  for (const match of sortedMatches) {
    if (!statusAllowed(match.status)) continue;

    const status = match.status === 'abandoned' ? 'completed' : match.status;
    const scoreLine = summarizeMatchScore(match);

    // 1. Explicitly favourited match
    if (favMatchSet.has(match.id)) {
      const id = `match_${match.id}_${match.status}`;
      if (!seen.has(id)) {
        seen.add(id);
        items.push({
          id,
          category: 'match',
          status,
          titleEn:
            status === 'live'
              ? `Live Favourite Match: ${match.title}`
              : status === 'upcoming'
                ? `Upcoming Match: ${match.title}`
                : `Final Result: ${match.title}`,
          titleBn:
            status === 'live'
              ? `লাইভ প্রিয় ম্যাচ: ${match.title}`
              : status === 'upcoming'
                ? `আসন্ন প্রিয় ম্যাচ: ${match.title}`
                : `ম্যাচের ফলাফল: ${match.title}`,
          detailEn: scoreLine,
          detailBn: scoreLine,
          timestamp: match.updatedAt,
          matchId: match.id,
        });
      }
    }

    // 2. Favourite teams
    if (ns.favTeams) {
      const matchedTeamId = favTeamSet.has(match.teamAId)
        ? match.teamAId
        : favTeamSet.has(match.teamBId)
          ? match.teamBId
          : null;
      if (matchedTeamId) {
        const team = teamMap.get(matchedTeamId);
        const teamName = team?.name ?? (matchedTeamId === match.teamAId ? match.teamAName : match.teamBName);
        const id = `team_${matchedTeamId}_${match.id}_${match.status}`;
        if (!seen.has(id)) {
          seen.add(id);
          items.push({
            id,
            category: 'team',
            status,
            titleEn: `${teamName} — ${match.title}`,
            titleBn: `${teamName} — ${match.title}`,
            detailEn: scoreLine,
            detailBn: scoreLine,
            timestamp: match.updatedAt,
            matchId: match.id,
          });
        }
      }
    }

    // 3. Favourite players
    if (ns.favPlayers && favPlayerSet.size > 0) {
      for (const pid of favPlayerSet) {
        if (!matchInvolvesPlayer(match, pid)) continue;
        const player = playerMap.get(pid);
        if (!player) continue;
        const id = `player_${pid}_${match.id}_${match.status}`;
        if (!seen.has(id)) {
          seen.add(id);
          items.push({
            id,
            category: 'player',
            status,
            titleEn: `${player.name} in ${match.teamAShortName} vs ${match.teamBShortName}`,
            titleBn: `${player.name} খেলছেন: ${match.teamAShortName} বনাম ${match.teamBShortName}`,
            detailEn: scoreLine,
            detailBn: scoreLine,
            timestamp: match.updatedAt,
            matchId: match.id,
            playerId: pid,
          });
        }
      }
    }

    // 4. Favourite leagues / tournaments
    if (ns.favLeagues && favLeagueSet.size > 0) {
      const tObj = match.tournamentId ? tournamentMap.get(match.tournamentId) : undefined;
      const tName = (match.tournamentName ?? tObj?.name ?? '').trim();
      const matchedLeague =
        (match.tournamentId && favLeagueSet.has(match.tournamentId.toLowerCase())) ||
        (tName && favLeagueSet.has(tName.toLowerCase()));
      if (matchedLeague) {
        const id = `league_${match.id}_${match.status}`;
        if (!seen.has(id)) {
          seen.add(id);
          items.push({
            id,
            category: 'league',
            status,
            titleEn: `${tName || 'League'} · ${match.title}`,
            titleBn: `${tName || 'লিগ'} · ${match.title}`,
            detailEn: scoreLine,
            detailBn: scoreLine,
            timestamp: match.updatedAt,
            matchId: match.id,
          });
        }
      }
    }
  }

  return items.slice(0, 40);
}
