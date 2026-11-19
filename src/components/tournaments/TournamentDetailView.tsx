import React, {useMemo, useState} from 'react';
import {
  ArrowLeft,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Edit3,
  GitBranch,
  MapPin,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Trophy,
} from 'lucide-react';
import {saveMatch, saveTournament} from '../../db/database';
import {formatOvers} from '../../engine/scoringEngine';
import {
  computeTournamentResultsAndStats,
  computeTournamentStandings,
  generateTournamentFixtures,
  isKnockoutStage,
  resolveTournamentFormat,
  seedKnockoutStageFromStandings,
} from '../../engine/tournamentEngine';
import type {
  AppView,
  Match,
  Player,
  Team,
  Tournament,
  TournamentFixture,
} from '../../types/cricket';
import {generateId} from '../../utils/imageUtils';
import {ConfirmDialog} from '../common/ConfirmDialog';
import {FixtureEditModal} from './FixtureEditModal';

interface TournamentDetailViewProps {
  tournament: Tournament;
  teams: Team[];
  players: Player[];
  matches: Match[];
  onBack: () => void;
  onEditTournament: (tournament: Tournament) => void;
  onDeleteTournament: (tournamentId: string) => Promise<void>;
  onTournamentUpdated: (updated: Tournament) => Promise<void>;
  onOpenMatch: (matchId: string) => void;
  onNavigate: (view: AppView) => void;
}

const FIXTURE_PAGE_SIZE = 30;

export const TournamentDetailView: React.FC<TournamentDetailViewProps> = ({
  tournament,
  teams,
  players,
  matches,
  onBack,
  onEditTournament,
  onDeleteTournament,
  onTournamentUpdated,
  onOpenMatch,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'fixtures' | 'points' | 'stats'>(
    'points',
  );
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [fixtureSearch, setFixtureSearch] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(FIXTURE_PAGE_SIZE);

  const [fixtureModalOpen, setFixtureModalOpen] = useState(false);
  const [editingFixture, setEditingFixture] = useState<TournamentFixture | null>(null);
  const [confirmDeleteTournament, setConfirmDeleteTournament] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [deletingFixture, setDeletingFixture] = useState<TournamentFixture | null>(null);
  const [feedback, setFeedback] = useState<{type: 'ok' | 'err'; text: string} | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const teamMap = useMemo(() => {
    const m = new Map<string, Team>();
    teams.forEach((t) => m.set(t.id, t));
    return m;
  }, [teams]);

  const matchMap = useMemo(() => {
    const m = new Map<string, Match>();
    matches.forEach((mt) => m.set(mt.id, mt));
    return m;
  }, [matches]);

  const {overallRows, groupStandings, syncedFixtures} = useMemo(
    () => computeTournamentStandings(tournament, teams, matches),
    [tournament, teams, matches],
  );

  const resultsAndStats = useMemo(
    () => computeTournamentResultsAndStats(tournament, teams, players, matches),
    [tournament, teams, players, matches],
  );

  const formatType = resolveTournamentFormat(tournament);
  const tournamentTeams = useMemo(() => {
    const idSet = new Set(tournament.teamIds);
    return teams.filter((t) => idSet.has(t.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, tournament.teamIds]);

  const stageFilterOptions = useMemo(() => {
    const options: Array<{value: string; label: string}> = [{value: 'all', label: 'All Fixtures'}];
    (tournament.groups ?? []).forEach((g) => {
      options.push({value: `group:${g.id}`, label: g.name});
    });
    const koStages = Array.from(
      new Set(syncedFixtures.filter((f) => isKnockoutStage(f.stage)).map((f) => f.stage)),
    );
    koStages.forEach((st) => {
      options.push({
        value: `stage:${st}`,
        label: st.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      });
    });
    return options;
  }, [tournament.groups, syncedFixtures]);

  const filteredFixtures = useMemo(() => {
    const q = fixtureSearch.trim().toLowerCase();
    return syncedFixtures.filter((f) => {
      if (stageFilter.startsWith('group:')) {
        if (f.groupId !== stageFilter.slice(6)) return false;
      } else if (stageFilter.startsWith('stage:')) {
        if (f.stage !== stageFilter.slice(6)) return false;
      }

      if (!q) return true;
      const tA = f.teamAId ? teamMap.get(f.teamAId) : undefined;
      const tB = f.teamBId ? teamMap.get(f.teamBId) : undefined;
      return (
        f.label.toLowerCase().includes(q) ||
        (tA?.name.toLowerCase().includes(q) ?? false) ||
        (tA?.shortName.toLowerCase().includes(q) ?? false) ||
        (tB?.name.toLowerCase().includes(q) ?? false) ||
        (tB?.shortName.toLowerCase().includes(q) ?? false) ||
        (f.groupName ?? '').toLowerCase().includes(q)
      );
    });
  }, [syncedFixtures, stageFilter, fixtureSearch, teamMap]);

  const showNotice = (type: 'ok' | 'err', text: string) => {
    setFeedback({type, text});
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleSaveFixture = async (fixturePayload: TournamentFixture) => {
    const base = tournament.fixtures ?? syncedFixtures;
    const exists = base.some((f) => f.id === fixturePayload.id);
    const nextFixtures = exists
      ? base.map((f) => (f.id === fixturePayload.id ? fixturePayload : f))
      : [...base, fixturePayload];

    const updated: Tournament = {
      ...tournament,
      fixtures: nextFixtures,
      updatedAt: new Date().toISOString(),
    };
    await saveTournament(updated);
    await onTournamentUpdated(updated);
    showNotice('ok', exists ? 'Fixture updated.' : 'Manual fixture added.');
  };

  const handleDeleteFixture = async () => {
    if (!deletingFixture) return;
    setIsBusy(true);
    try {
      const nextFixtures = (tournament.fixtures ?? syncedFixtures).filter(
        (f) => f.id !== deletingFixture.id,
      );
      const updated: Tournament = {
        ...tournament,
        fixtures: nextFixtures,
        updatedAt: new Date().toISOString(),
      };
      await saveTournament(updated);
      await onTournamentUpdated(updated);
      setDeletingFixture(null);
      showNotice('ok', 'Fixture removed.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRegenerateFixtures = async () => {
    setIsBusy(true);
    try {
      const {groups, fixtures} = generateTournamentFixtures(tournament);
      const updated: Tournament = {
        ...tournament,
        groups,
        fixtures,
        updatedAt: new Date().toISOString(),
      };
      await saveTournament(updated);
      await onTournamentUpdated(updated);
      setConfirmRegenerate(false);
      showNotice('ok', `Generated ${fixtures.length} fixtures cleanly.`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSeedKnockouts = async () => {
    setIsBusy(true);
    try {
      const seededFixtures = seedKnockoutStageFromStandings(
        {...tournament, fixtures: syncedFixtures},
        groupStandings,
        overallRows,
      );
      const updated: Tournament = {
        ...tournament,
        fixtures: seededFixtures,
        updatedAt: new Date().toISOString(),
      };
      await saveTournament(updated);
      await onTournamentUpdated(updated);
      showNotice('ok', 'Top ranked teams seeded into Knockout fixtures.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleStatusChange = async (nextStatus: Tournament['status']) => {
    if (nextStatus === tournament.status || isBusy) return;
    setIsBusy(true);
    try {
      const updated: Tournament = {
        ...tournament,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
      await saveTournament(updated);
      await onTournamentUpdated(updated);
      showNotice('ok', `Tournament marked as ${nextStatus}.`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleLaunchFixtureMatch = async (fixture: TournamentFixture) => {
    if (fixture.matchId && matchMap.has(fixture.matchId)) {
      onOpenMatch(fixture.matchId);
      return;
    }

    if (!fixture.teamAId || !fixture.teamBId) {
      showNotice('err', 'Assign both Team A and Team B before starting this match.');
      return;
    }

    if (fixture.teamAId === fixture.teamBId) {
      showNotice('err', 'A team cannot play against itself.');
      return;
    }

    const teamA = teamMap.get(fixture.teamAId);
    const teamB = teamMap.get(fixture.teamBId);
    if (!teamA || !teamB) {
      showNotice('err', 'One of the selected teams no longer exists.');
      return;
    }

    const squadA = players.filter((p) => p.teamId === teamA.id);
    const squadB = players.filter((p) => p.teamId === teamB.id);

    if (squadA.length < 2 || squadB.length < 2) {
      showNotice(
        'err',
        `Both ${teamA.shortName} (${squadA.length}) and ${teamB.shortName} (${squadB.length}) need at least 2 players in their squad before scoring.`,
      );
      return;
    }

    const xiA = squadA.slice(0, 11).map((p) => p.id);
    const xiB = squadB.slice(0, 11).map((p) => p.id);
    const capA = teamA.captainId && xiA.includes(teamA.captainId) ? teamA.captainId : xiA[0];
    const capB = teamB.captainId && xiB.includes(teamB.captainId) ? teamB.captainId : xiB[0];
    const wkA =
      squadA.find((p) => p.role === 'wicket-keeper' && xiA.includes(p.id))?.id ?? xiA[0];
    const wkB =
      squadB.find((p) => p.role === 'wicket-keeper' && xiB.includes(p.id))?.id ?? xiB[0];

    const now = new Date().toISOString();
    const newMatch: Match = {
      id: generateId('match'),
      title: `${teamA.name} vs ${teamB.name}`,
      format: tournament.format,
      oversPerInnings: tournament.oversPerInnings,
      testCurrentDay: tournament.format === 'TEST' ? 1 : undefined,
      testMaxDays: tournament.format === 'TEST' ? 5 : undefined,
      matchDate: fixture.scheduledDate || tournament.startDate || now.slice(0, 10),
      teamAId: teamA.id,
      teamBId: teamB.id,
      teamAName: teamA.name,
      teamBName: teamB.name,
      teamAShortName: teamA.shortName,
      teamBShortName: teamB.shortName,
      teamAPlayingXI: xiA,
      teamBPlayingXI: xiB,
      teamACaptainId: capA,
      teamBCaptainId: capB,
      teamAWicketkeeperId: wkA,
      teamBWicketkeeperId: wkB,
      tossWinnerId: teamA.id,
      tossDecision: 'bat',
      venue: fixture.venue || tournament.location,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      status: 'upcoming',
      currentInningsIndex: 0,
      innings: [],
      createdAt: now,
      updatedAt: now,
      sync: {syncStatus: 'local-only', version: 1},
    };

    setIsBusy(true);
    try {
      await saveMatch(newMatch);
      const nextFixtures = (tournament.fixtures ?? syncedFixtures).map((f) =>
        f.id === fixture.id ? {...f, matchId: newMatch.id} : f,
      );
      const updatedTournament: Tournament = {
        ...tournament,
        status: tournament.status === 'upcoming' ? 'active' : tournament.status,
        fixtures: nextFixtures,
        updatedAt: now,
      };
      await saveTournament(updatedTournament);
      await onTournamentUpdated(updatedTournament);
      onOpenMatch(newMatch.id);
    } finally {
      setIsBusy(false);
    }
  };

  const renderPointsTable = (rows: typeof overallRows, title?: string) => (
    <section
      key={title ?? 'overall'}
      className="rounded-2xl bg-[#101612] border border-white/10 overflow-hidden"
    >
      {title && (
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-white">{title}</h3>
          <span className="text-xs text-[#9AC2AA]">{rows.length} Teams</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[#8FA397] text-xs">
              <th className="py-2.5 pl-4 pr-2 font-medium">#</th>
              <th className="py-2.5 px-2 font-medium">Team</th>
              <th className="py-2.5 px-2 text-right font-medium">M</th>
              <th className="py-2.5 px-2 text-right font-medium">W</th>
              <th className="py-2.5 px-2 text-right font-medium">L</th>
              <th className="py-2.5 px-2 text-right font-medium">T</th>
              <th className="py-2.5 px-2 text-right font-medium">NR</th>
              <th className="py-2.5 px-2 text-right font-medium text-white">Pts</th>
              <th className="py-2.5 px-2 text-right font-medium">For</th>
              <th className="py-2.5 px-2 text-right font-medium">Against</th>
              <th className="py-2.5 pl-2 pr-4 text-right font-medium">NRR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-6 px-4 text-center text-xs text-[#8FA397]">
                  No teams assigned to this table yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.teamId} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 pl-4 pr-2 font-mono text-xs text-[#8FA397] tabular-nums">
                    {row.rank}
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <span className="font-semibold text-white truncate">{row.teamName}</span>
                      {row.isQualified && (
                        <span className="font-mono text-[11px] font-bold text-[#4ADE80] shrink-0">
                          Q
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-[#C8D6CE] tabular-nums">
                    {row.played}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-white tabular-nums">
                    {row.won}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-[#9CB0A4] tabular-nums">
                    {row.lost}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-[#9CB0A4] tabular-nums">
                    {row.tied}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-[#9CB0A4] tabular-nums">
                    {row.noResult}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-bold text-[#4ADE80] tabular-nums">
                    {row.points}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-xs text-[#C8D6CE] tabular-nums whitespace-nowrap">
                    {row.runsScored}/{row.oversFacedFormatted}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-xs text-[#9CB0A4] tabular-nums whitespace-nowrap">
                    {row.runsConceded}/{row.oversBowledFormatted}
                  </td>
                  <td
                    className={`py-2.5 pl-2 pr-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                      row.nrr > 0
                        ? 'text-[#4ADE80]'
                        : row.nrr < 0
                          ? 'text-rose-300'
                          : 'text-[#9CB0A4]'
                    }`}
                  >
                    {row.nrrFormatted}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  const hasKnockoutStages = syncedFixtures.some((f) => isKnockoutStage(f.stage));

  return (
    <div className="space-y-5">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/10 px-3.5 py-2 min-h-[44px] text-sm font-medium text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Tournaments</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEditTournament(tournament)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/15 px-3.5 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-white transition-colors"
          >
            <Edit3 className="w-4 h-4 text-[#22C55E]" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteTournament(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 px-3.5 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-rose-300 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Tournament Hero Card */}
      <section className="rounded-2xl bg-gradient-to-br from-[#0D3B24]/75 via-[#101612] to-[#0B100D] border border-[#22C55E]/25 p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#0D3B24] border border-[#22C55E]/30 flex items-center justify-center overflow-hidden shrink-0">
            {tournament.logoDataUrl ? (
              <img
                src={tournament.logoDataUrl}
                alt={tournament.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Trophy className="w-7 h-7 text-[#4ADE80]" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs font-mono text-[#4ADE80] uppercase">
              <span>{tournament.format}</span>
              <span aria-hidden="true">·</span>
              <span>{tournament.oversPerInnings} Ov</span>
              <span aria-hidden="true">·</span>
              <span>{formatType.replace('-', ' ')}</span>
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-white text-balance">
              {tournament.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#C8D6CE]">
              <span className="font-mono tabular-nums">
                {tournament.teamIds.length} / {tournament.maxTeams} Teams
              </span>
              {tournament.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span>{tournament.location}</span>
                </span>
              )}
              {(tournament.startDate || tournament.endDate) && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span>
                    {tournament.startDate || 'TBD'}
                    {tournament.endDate ? ` to ${tournament.endDate}` : ''}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Champion Spotlight if decided */}
        {resultsAndStats.championTeam && (
          <div className="rounded-xl bg-[#16A34A]/20 border border-[#22C55E]/40 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Award className="w-5 h-5 text-[#4ADE80] shrink-0" />
              <span className="text-sm font-bold text-white">
                Champion: {resultsAndStats.championTeam.name}
              </span>
            </div>
            {resultsAndStats.runnerUpTeam && (
              <span className="text-xs text-[#C8D6CE]">
                Runner-Up: {resultsAndStats.runnerUpTeam.name}
              </span>
            )}
          </div>
        )}

        {/* Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
          <div className="flex items-center gap-2">
            {(['upcoming', 'active', 'completed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                disabled={isBusy}
                onClick={() => {
                  void handleStatusChange(st);
                }}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold capitalize border transition-colors ${
                  tournament.status === st
                    ? 'bg-[#16A34A] border-[#22C55E] text-white'
                    : 'bg-[#0B100D] border-white/10 text-[#9CB0A4] hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <span className="text-xs font-mono text-[#9CB0A4] tabular-nums">
            {resultsAndStats.summary.completedMatches} / {resultsAndStats.summary.totalFixtures}{' '}
            Matches Completed
          </span>
        </div>
      </section>

      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center justify-between gap-3 border ${
            feedback.type === 'ok'
              ? 'bg-[#0D3B24]/80 border-[#22C55E]/40 text-white'
              : 'bg-rose-500/15 border-rose-500/35 text-rose-200'
          }`}
        >
          <span>{feedback.text}</span>
          {feedback.type === 'err' && feedback.text.includes('squad') && (
            <button
              type="button"
              onClick={() => onNavigate('teams')}
              className="shrink-0 rounded-lg bg-[#0D3B24] border border-[#22C55E]/40 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Go to Teams
            </button>
          )}
        </div>
      )}

      {/* Workspace Tabs */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl bg-[#101612] border border-white/10 w-full sm:w-fit overflow-x-auto"
        role="tablist"
      >
        {(
          [
            {id: 'points', label: 'Points Table'},
            {id: 'fixtures', label: `Fixtures (${syncedFixtures.length})`},
            {id: 'overview', label: 'Results & Bracket'},
            {id: 'stats', label: 'Statistics'},
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 sm:flex-none px-4 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-[#0D3B24] text-white border border-[#22C55E]/30'
                : 'text-[#9CB0A4] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: POINTS TABLE & NRR */}
      {activeTab === 'points' && (
        <div className="space-y-4">
          {groupStandings.length > 0 ? (
            groupStandings.map((gs) => renderPointsTable(gs.rows, gs.groupName))
          ) : (
            renderPointsTable(overallRows, 'Tournament Standings')
          )}

          <p className="text-xs text-[#8FA397] leading-relaxed">
            Q = Qualification spot · NRR uses official cricket rules (all-out innings count full{' '}
            {tournament.oversPerInnings} overs; abandoned/no-result matches award{' '}
            {tournament.pointsConfig?.noResult ?? 1} pt each and are excluded from NRR).
          </p>
        </div>
      )}

      {/* TAB 2: FIXTURES */}
      {activeTab === 'fixtures' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingFixture(null);
                  setFixtureModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-xs sm:text-sm font-semibold text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Fixture</span>
              </button>

              {hasKnockoutStages && formatType !== 'knockout' && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    void handleSeedKnockouts();
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-[#0D3B24] hover:bg-[#145233] border border-[#22C55E]/35 text-xs sm:text-sm font-semibold text-white transition-colors"
                >
                  <GitBranch className="w-4 h-4 text-[#4ADE80]" />
                  <span>Seed Knockouts</span>
                </button>
              )}

              <button
                type="button"
                disabled={isBusy}
                onClick={() => setConfirmRegenerate(true)}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/15 text-xs font-semibold text-[#C8D6CE] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#22C55E]" />
                <span>Regenerate</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setVisibleLimit(FIXTURE_PAGE_SIZE);
              }}
              className="min-h-[44px] rounded-xl bg-[#101612] border border-white/10 px-3.5 text-sm text-white"
              aria-label="Filter fixtures by stage or group"
            >
              {stageFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <input
              type="search"
              value={fixtureSearch}
              onChange={(e) => {
                setFixtureSearch(e.target.value);
                setVisibleLimit(FIXTURE_PAGE_SIZE);
              }}
              placeholder="Search fixture by team name or match..."
              className="min-h-[44px] rounded-xl bg-[#101612] border border-white/10 px-3.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
            />
          </div>

          {filteredFixtures.length === 0 ? (
            <div className="rounded-2xl bg-[#101612] border border-white/10 p-6 text-center space-y-3">
              <p className="text-sm text-[#9CB0A4]">No fixtures match this filter.</p>
              <button
                type="button"
                onClick={() => setConfirmRegenerate(true)}
                className="min-h-[44px] px-4 rounded-xl bg-[#0D3B24] text-xs font-semibold text-white"
              >
                Generate Fixtures
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredFixtures.slice(0, visibleLimit).map((fix) => {
                const tA = fix.teamAId ? teamMap.get(fix.teamAId) : undefined;
                const tB = fix.teamBId ? teamMap.get(fix.teamBId) : undefined;
                const linkedMatch = fix.matchId ? matchMap.get(fix.matchId) : undefined;

                return (
                  <div
                    key={fix.id}
                    className="rounded-2xl bg-[#101612] border border-white/10 p-4 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-[#4ADE80]">
                        #{fix.fixtureNumber} · {fix.label}
                        {fix.scheduledDate ? ` · ${fix.scheduledDate}` : ''}
                      </span>
                      <span className="capitalize font-semibold text-[#C8D6CE]">
                        {fix.status}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="font-display text-base font-bold text-white truncate">
                          {tA ? tA.name : 'TBD'} <span className="text-[#8FA397]">vs</span>{' '}
                          {tB ? tB.name : 'TBD'}
                        </div>

                        {linkedMatch && linkedMatch.innings.length > 0 && (
                          <p className="font-mono text-xs text-[#C8D6CE] tabular-nums">
                            {linkedMatch.innings
                              .map((inn) => {
                                const short =
                                  inn.battingTeamId === linkedMatch.teamAId
                                    ? linkedMatch.teamAShortName
                                    : linkedMatch.teamBShortName;
                                return `${short} ${inn.runs}/${inn.wickets} (${formatOvers(inn.legalBalls)})`;
                              })
                              .join(' · ')}
                          </p>
                        )}

                        {fix.resultText && (
                          <p className="text-xs font-medium text-[#4ADE80]">{fix.resultText}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {tA && tB && fix.status !== 'abandoned' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              void handleLaunchFixtureMatch(fix);
                            }}
                            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-xs font-semibold text-white"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>
                              {linkedMatch
                                ? linkedMatch.status === 'completed'
                                  ? 'Scorecard'
                                  : 'Resume'
                                : 'Score Match'}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setEditingFixture(fix);
                            setFixtureModalOpen(true);
                          }}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[#0B100D] hover:bg-[#161F19] border border-white/10 text-[#C8D6CE]"
                          aria-label={`Edit fixture ${fix.label}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingFixture(fix)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300"
                          aria-label={`Delete fixture ${fix.label}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredFixtures.length > visibleLimit && (
                <button
                  type="button"
                  onClick={() => setVisibleLimit((prev) => prev + FIXTURE_PAGE_SIZE)}
                  className="w-full min-h-[44px] rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/15 text-xs sm:text-sm font-semibold text-white"
                >
                  Show More Fixtures ({filteredFixtures.length - visibleLimit} remaining)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TOURNAMENT RESULTS & OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Podium & Progression */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="rounded-2xl bg-[#101612] border border-white/10 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#4ADE80]" />
                <h2 className="font-display text-base font-bold text-white">
                  Champion &amp; Finalists
                </h2>
              </div>

              <div className="space-y-2 text-sm">
                <div className="rounded-xl bg-[#0B100D] border border-white/10 p-3 flex items-center justify-between">
                  <span className="text-[#9CB0A4]">Champion</span>
                  <span className="font-semibold text-[#4ADE80]">
                    {resultsAndStats.championTeam?.name ?? 'Pending Final'}
                  </span>
                </div>
                <div className="rounded-xl bg-[#0B100D] border border-white/10 p-3 flex items-center justify-between">
                  <span className="text-[#9CB0A4]">Finalists</span>
                  <span className="font-semibold text-white text-right">
                    {resultsAndStats.finalists.length > 0
                      ? resultsAndStats.finalists.map((t) => t.shortName).join(' vs ')
                      : 'TBD'}
                  </span>
                </div>
                <div className="rounded-xl bg-[#0B100D] border border-white/10 p-3 flex items-center justify-between gap-3">
                  <span className="text-[#9CB0A4] shrink-0">Semi-Finalists</span>
                  <span className="font-semibold text-white text-right">
                    {resultsAndStats.semiFinalists.length > 0
                      ? resultsAndStats.semiFinalists.map((t) => t.shortName).join(', ')
                      : 'TBD'}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-[#101612] border border-white/10 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
                <h2 className="font-display text-base font-bold text-white">Qualified Teams</h2>
              </div>

              {resultsAndStats.qualifiedTeams.length === 0 ? (
                <p className="text-xs sm:text-sm text-[#9CB0A4]">
                  Qualified teams appear automatically once group/league matches are completed.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {resultsAndStats.qualifiedTeams.map((team) => (
                    <div
                      key={team.id}
                      className="rounded-xl bg-[#0D3B24]/50 border border-[#22C55E]/30 px-3 py-2 flex items-center gap-2 text-xs font-semibold text-white"
                    >
                      <Shield className="w-3.5 h-3.5 text-[#4ADE80] shrink-0" />
                      <span className="truncate">{team.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Knockout Bracket Summary if Knockout Matches Exist */}
          {hasKnockoutStages && (
            <section className="rounded-2xl bg-[#101612] border border-white/10 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-white">Knockout Bracket</h2>
                {formatType !== 'knockout' && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      void handleSeedKnockouts();
                    }}
                    className="min-h-[38px] px-3 rounded-lg bg-[#0D3B24] border border-[#22C55E]/35 text-xs font-semibold text-white"
                  >
                    Seed Standings Qualifiers
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {syncedFixtures
                  .filter((f) => isKnockoutStage(f.stage))
                  .map((fix) => {
                    const tA = fix.teamAId ? teamMap.get(fix.teamAId) : undefined;
                    const tB = fix.teamBId ? teamMap.get(fix.teamBId) : undefined;
                    return (
                      <div
                        key={fix.id}
                        className="rounded-xl bg-[#0B100D] border border-white/10 p-3.5 space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs font-mono text-[#4ADE80]">
                          <span>{fix.label}</span>
                          <span className="capitalize text-[#9CB0A4]">{fix.status}</span>
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {tA?.name ?? 'TBD'} vs {tB?.name ?? 'TBD'}
                        </div>
                        {fix.resultText && (
                          <div className="text-xs text-[#9AC2AA]">{fix.resultText}</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 4: TOURNAMENT STATISTICS */}
      {activeTab === 'stats' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-[#101612] border border-white/10 p-4">
              <div className="text-xs text-[#8FA397]">Total Runs</div>
              <div className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
                {resultsAndStats.summary.totalRuns}
              </div>
            </div>
            <div className="rounded-2xl bg-[#101612] border border-white/10 p-4">
              <div className="text-xs text-[#8FA397]">Total Wickets</div>
              <div className="mt-1 font-mono text-2xl font-bold text-[#4ADE80] tabular-nums">
                {resultsAndStats.summary.totalWickets}
              </div>
            </div>
            <div className="rounded-2xl bg-[#101612] border border-white/10 p-4">
              <div className="text-xs text-[#8FA397]">Fours / Sixes</div>
              <div className="mt-1 font-mono text-xl font-bold text-white tabular-nums">
                {resultsAndStats.summary.totalFours} / {resultsAndStats.summary.totalSixes}
              </div>
            </div>
            <div className="rounded-2xl bg-[#101612] border border-white/10 p-4">
              <div className="text-xs text-[#8FA397]">Highest Total</div>
              <div className="mt-1 font-mono text-sm font-bold text-white tabular-nums">
                {resultsAndStats.summary.highestTeamTotal
                  ? `${resultsAndStats.summary.highestTeamTotal.scoreText}`
                  : '—'}
              </div>
              {resultsAndStats.summary.highestTeamTotal && (
                <div className="text-[11px] text-[#9AC2AA] truncate">
                  {resultsAndStats.summary.highestTeamTotal.teamName}
                </div>
              )}
            </div>
          </div>

          {resultsAndStats.topBatsmen.length === 0 && resultsAndStats.topBowlers.length === 0 ? (
            <div className="rounded-2xl bg-[#101612] border border-white/10 p-6 text-center space-y-2">
              <BarChart3 className="w-8 h-8 text-[#22C55E] mx-auto" />
              <p className="text-sm font-semibold text-white">No player statistics recorded yet</p>
              <p className="text-xs text-[#9CB0A4]">
                Score tournament matches from the Fixtures tab to populate batting and bowling
                leaderboards automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Run Scorers */}
              <section className="rounded-2xl bg-[#101612] border border-white/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10">
                  <h3 className="font-display text-base font-bold text-white">Top Run Scorers</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[#8FA397]">
                        <th className="py-2.5 px-4 font-medium">Batter</th>
                        <th className="py-2.5 px-2 text-right font-medium">Inn</th>
                        <th className="py-2.5 px-2 text-right font-medium">Runs</th>
                        <th className="py-2.5 px-2 text-right font-medium">Avg</th>
                        <th className="py-2.5 px-2 text-right font-medium">SR</th>
                        <th className="py-2.5 px-4 text-right font-medium">HS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {resultsAndStats.topBatsmen.map((b) => (
                        <tr key={b.playerId}>
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-white">{b.playerName}</div>
                            <div className="text-[11px] text-[#8FA397]">{b.teamShortName}</div>
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#C8D6CE]">
                            {b.innings}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold tabular-nums text-[#4ADE80]">
                            {b.runs}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#C8D6CE]">
                            {b.average.toFixed(1)}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#9CB0A4]">
                            {b.strikeRate.toFixed(1)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-white">
                            {b.highScore}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Top Wicket Takers */}
              <section className="rounded-2xl bg-[#101612] border border-white/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10">
                  <h3 className="font-display text-base font-bold text-white">Top Wicket Takers</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[#8FA397]">
                        <th className="py-2.5 px-4 font-medium">Bowler</th>
                        <th className="py-2.5 px-2 text-right font-medium">Ov</th>
                        <th className="py-2.5 px-2 text-right font-medium">Runs</th>
                        <th className="py-2.5 px-2 text-right font-medium">Wkts</th>
                        <th className="py-2.5 px-2 text-right font-medium">Econ</th>
                        <th className="py-2.5 px-4 text-right font-medium">Best</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {resultsAndStats.topBowlers.map((bw) => (
                        <tr key={bw.playerId}>
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-white">{bw.playerName}</div>
                            <div className="text-[11px] text-[#8FA397]">{bw.teamShortName}</div>
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#C8D6CE]">
                            {bw.oversFormatted}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#9CB0A4]">
                            {bw.runsConceded}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold tabular-nums text-[#4ADE80]">
                            {bw.wickets}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#C8D6CE]">
                            {bw.economy.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-white">
                            {bw.bestWickets}/{bw.bestRuns}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      {/* Modals & Confirmations */}
      <FixtureEditModal
        isOpen={fixtureModalOpen}
        editingFixture={editingFixture}
        existingFixtures={syncedFixtures}
        teams={tournamentTeams.length >= 2 ? tournamentTeams : teams}
        groups={tournament.groups ?? []}
        defaultVenue={tournament.location}
        onSave={handleSaveFixture}
        onClose={() => {
          setFixtureModalOpen(false);
          setEditingFixture(null);
        }}
      />

      <ConfirmDialog
        isOpen={confirmDeleteTournament}
        title={`Delete "${tournament.name}"?`}
        description="This removes the tournament, its fixtures, and standings from local storage. Existing match records remain preserved in Matches."
        confirmLabel="Delete Tournament"
        isDanger={true}
        isBusy={isBusy}
        onConfirm={async () => {
          setIsBusy(true);
          try {
            await onDeleteTournament(tournament.id);
            setConfirmDeleteTournament(false);
          } finally {
            setIsBusy(false);
          }
        }}
        onCancel={() => setConfirmDeleteTournament(false)}
      />

      <ConfirmDialog
        isOpen={confirmRegenerate}
        title="Regenerate Tournament Fixtures?"
        description="This will replace the current fixture list with freshly generated fixtures based on your tournament format and participating teams."
        confirmLabel="Regenerate Fixtures"
        isDanger={false}
        isBusy={isBusy}
        onConfirm={() => {
          void handleRegenerateFixtures();
        }}
        onCancel={() => setConfirmRegenerate(false)}
      />

      <ConfirmDialog
        isOpen={Boolean(deletingFixture)}
        title={`Delete "${deletingFixture?.label ?? 'fixture'}"?`}
        description="This removes the fixture from this tournament's schedule."
        confirmLabel="Delete Fixture"
        isDanger={true}
        isBusy={isBusy}
        onConfirm={() => {
          void handleDeleteFixture();
        }}
        onCancel={() => setDeletingFixture(null)}
      />
    </div>
  );
};
