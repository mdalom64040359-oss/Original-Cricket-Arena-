import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ArrowLeftRight,
  Award,
  BarChart3,
  Filter,
  RotateCcw,
  Search,
  Shield,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import {
  getAllMatches,
  getAllPlayers,
  getAllTeams,
  getAllTournaments,
} from '../../db/database';
import {
  computeStatisticsBundle,
  DEFAULT_STATS_FILTER,
  type PlayerStatsRecord,
  type StatsFilterOptions,
} from '../../engine/statisticsEngine';
import type {
  AppView,
  DashboardSummary,
  Match,
  MatchFormat,
  Player,
  Team,
  Tournament,
} from '../../types/cricket';
import {EmptyState} from '../common/EmptyState';
import {PageHeader} from '../common/PageHeader';
import {PlayerComparisonModal} from '../stats/PlayerComparisonModal';
import {PlayerProfileModal} from '../stats/PlayerProfileModal';

interface StatisticsViewProps {
  summary: DashboardSummary;
  onNavigate: (view: AppView) => void;
  onOpenMatch: (matchId: string) => void;
  onOpenPlayerProfile?: (playerId: string) => void;
}

type StatsWorkspaceTab = 'leaderboards' | 'players' | 'teams' | 'tournaments';
type LeaderboardKey =
  | 'mostRuns'
  | 'highestScores'
  | 'bestAverage'
  | 'bestStrikeRate'
  | 'mostWickets'
  | 'bestBowlingFigures'
  | 'bestEconomy'
  | 'mostBoundaries';

type BoundarySubMode = 'combined' | 'fours' | 'sixes';

const LEADERBOARD_OPTIONS: Array<{key: LeaderboardKey; label: string; group: 'bat' | 'bowl'}> = [
  {key: 'mostRuns', label: 'Most Runs', group: 'bat'},
  {key: 'highestScores', label: 'Highest Score', group: 'bat'},
  {key: 'bestAverage', label: 'Best Batting Avg', group: 'bat'},
  {key: 'bestStrikeRate', label: 'Best Strike Rate', group: 'bat'},
  {key: 'mostWickets', label: 'Most Wickets', group: 'bowl'},
  {key: 'bestBowlingFigures', label: 'Best Bowling', group: 'bowl'},
  {key: 'bestEconomy', label: 'Best Economy', group: 'bowl'},
  {key: 'mostBoundaries', label: 'Most 4s & 6s', group: 'bat'},
];

const FORMAT_LABELS: Record<MatchFormat, string> = {
  T10: 'T10',
  T20: 'T20',
  ODI: 'ODI',
  TEST: 'Test',
  CUSTOM: 'Custom',
};

export const StatisticsView: React.FC<StatisticsViewProps> = ({
  summary,
  onNavigate,
  onOpenMatch,
  onOpenPlayerProfile,
}) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filter, setFilter] = useState<StatsFilterOptions>(DEFAULT_STATS_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<StatsWorkspaceTab>('leaderboards');
  const [activeBoard, setActiveBoard] = useState<LeaderboardKey>('mostRuns');
  const [boundaryMode, setBoundaryMode] = useState<BoundarySubMode>('combined');
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerStatView, setPlayerStatView] = useState<'batting' | 'bowling'>('batting');

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [mList, pList, tList, trList] = await Promise.all([
        getAllMatches(),
        getAllPlayers(),
        getAllTeams(),
        getAllTournaments(),
      ]);
      setMatches(mList);
      setPlayers(pList);
      setTeams(tList);
      setTournaments(trList);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const hasActiveFilter =
    filter.format !== 'all' ||
    filter.tournamentId !== 'all' ||
    filter.teamId !== 'all' ||
    filter.dateFrom !== '' ||
    filter.dateTo !== '';

  const careerBundle = useMemo(
    () =>
      computeStatisticsBundle({
        matches,
        players,
        teams,
        tournaments,
        filter: DEFAULT_STATS_FILTER,
      }),
    [matches, players, teams, tournaments],
  );

  const bundle = useMemo(
    () =>
      hasActiveFilter
        ? computeStatisticsBundle({
            matches,
            players,
            teams,
            tournaments,
            filter,
          })
        : careerBundle,
    [hasActiveFilter, careerBundle, matches, players, teams, tournaments, filter],
  );

  const selectedPlayerFiltered = useMemo(
    () => bundle.playerStats.find((p) => p.playerId === selectedPlayerId) ?? null,
    [bundle.playerStats, selectedPlayerId],
  );

  const selectedPlayerCareer = useMemo(
    () => careerBundle.playerStats.find((p) => p.playerId === selectedPlayerId) ?? null,
    [careerBundle.playerStats, selectedPlayerId],
  );

  const filteredPlayerDirectory = useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    const list = [...bundle.playerStats].sort((a, b) =>
      playerStatView === 'batting'
        ? b.runs - a.runs || a.playerName.localeCompare(b.playerName)
        : b.wickets - a.wickets || a.economy - b.economy || a.playerName.localeCompare(b.playerName),
    );
    if (!q) return list;
    return list.filter(
      (p) =>
        p.playerName.toLowerCase().includes(q) ||
        p.teamName.toLowerCase().includes(q) ||
        p.teamShortName.toLowerCase().includes(q),
    );
  }, [bundle.playerStats, playerSearch, playerStatView]);

  const resetFilters = () => {
    setFilter(DEFAULT_STATS_FILTER);
  };

  const hasAnyScoredPlay = careerBundle.playerStats.length > 0 || careerBundle.totalRuns > 0 || careerBundle.totalWickets > 0;

  const handlePlayerPicked = (pid: string) => {
    if (!hasActiveFilter && onOpenPlayerProfile) {
      onOpenPlayerProfile(pid);
      return;
    }
    setSelectedPlayerId(pid);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Statistics"
        subtitle="Career stats, 8 leaderboards, team NRR & match logs"
        onBackHome={() => onNavigate('home')}
        action={
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {players.length >= 2 && (
              <button
                type="button"
                onClick={() => setCompareOpen(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/15 px-3.5 py-2.5 min-h-[44px] text-sm font-semibold text-white transition-colors whitespace-nowrap"
              >
                <ArrowLeftRight className="w-4 h-4 text-[#4ADE80]" />
                <span>Compare Players</span>
              </button>
            )}
            {matches.length > 0 && (
              <button
                type="button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 min-h-[44px] text-sm font-semibold transition-colors whitespace-nowrap ${
                  hasActiveFilter || filtersOpen
                    ? 'bg-[#0D3B24] border-[#22C55E]/50 text-[#4ADE80]'
                    : 'bg-[#101612] hover:bg-[#17211B] border-white/15 text-white'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>{hasActiveFilter ? 'Filters Active' : 'Filter Stats'}</span>
              </button>
            )}
          </div>
        }
      />

      {/* Filter Drawer / Bar */}
      {filtersOpen && matches.length > 0 && (
        <section
          aria-label="Statistics filters"
          className="rounded-2xl bg-[#101612] border border-white/15 p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#9AC2AA]">
              Filter by Format, Tournament, Team & Date
            </h2>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4ADE80] hover:text-white min-h-[36px] px-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <label className="block space-y-1">
              <span className="text-[11px] text-[#8FA397]">Format</span>
              <select
                value={filter.format}
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    format: e.target.value as StatsFilterOptions['format'],
                  }))
                }
                className="w-full min-h-[44px] rounded-xl bg-[#0A100C] border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                <option value="all">All Formats</option>
                <option value="T10">T10</option>
                <option value="T20">T20</option>
                <option value="ODI">ODI</option>
                <option value="TEST">Test Cricket</option>
                <option value="CUSTOM">Custom Overs</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] text-[#8FA397]">Tournament</span>
              <select
                value={filter.tournamentId}
                onChange={(e) =>
                  setFilter((prev) => ({...prev, tournamentId: e.target.value}))
                }
                className="w-full min-h-[44px] rounded-xl bg-[#0A100C] border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                <option value="all">All Tournaments</option>
                {tournaments.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] text-[#8FA397]">Team</span>
              <select
                value={filter.teamId}
                onChange={(e) => setFilter((prev) => ({...prev, teamId: e.target.value}))}
                className="w-full min-h-[44px] rounded-xl bg-[#0A100C] border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                <option value="all">All Teams</option>
                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] text-[#8FA397]">From Date</span>
              <input
                type="date"
                value={filter.dateFrom}
                onChange={(e) => setFilter((prev) => ({...prev, dateFrom: e.target.value}))}
                className="w-full min-h-[44px] rounded-xl bg-[#0A100C] border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] text-[#8FA397]">To Date</span>
              <input
                type="date"
                value={filter.dateTo}
                onChange={(e) => setFilter((prev) => ({...prev, dateTo: e.target.value}))}
                className="w-full min-h-[44px] rounded-xl bg-[#0A100C] border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              />
            </label>
          </div>
        </section>
      )}

      {/* Top KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-[#101612] border border-white/10 p-4">
          <div className="text-xs text-[#8FA397]">
            {hasActiveFilter ? 'Filtered Matches' : 'Matches'}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
            {bundle.filteredMatchesCount}
          </div>
          <div className="mt-0.5 text-[11px] text-[#8FA397] font-mono tabular-nums">
            {bundle.completedMatchesCount} completed
          </div>
        </div>

        <div className="rounded-2xl bg-[#101612] border border-white/10 p-4">
          <div className="text-xs text-[#8FA397]">Total Runs</div>
          <div className="mt-1 font-mono text-2xl font-bold text-[#4ADE80] tabular-nums">
            {bundle.totalRuns}
          </div>
          <div className="mt-0.5 text-[11px] text-[#8FA397] font-mono tabular-nums">
            {bundle.totalFours} fours · {bundle.totalSixes} sixes
          </div>
        </div>

        <div className="rounded-2xl bg-[#101612] border border-white/10 p-4">
          <div className="text-xs text-[#8FA397]">Total Wickets</div>
          <div className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
            {bundle.totalWickets}
          </div>
          <div className="mt-0.5 text-[11px] text-[#8FA397] font-mono tabular-nums">
            {bundle.playerStats.length} active players
          </div>
        </div>

        <div className="rounded-2xl bg-[#101612] border border-white/10 p-4">
          <div className="text-xs text-[#8FA397]">Teams & Squads</div>
          <div className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
            {summary.teamsCount}
          </div>
          <div className="mt-0.5 text-[11px] text-[#8FA397] font-mono tabular-nums">
            {summary.playersCount} registered players
          </div>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="rounded-2xl bg-[#101612] border border-white/10 p-6 text-sm text-[#9CB0A4]">
          Computing match statistics and leaderboards...
        </div>
      ) : !hasAnyScoredPlay ? (
        <EmptyState
          icon={BarChart3}
          title="No match statistics available yet"
          description="Batting averages, strike rates, bowling figures, tournament records, and all 8 leaderboards compute automatically from your live and completed match scorecards."
          primaryActionLabel="Create Match"
          onPrimaryAction={() => onNavigate('create-match')}
          secondaryActionLabel="View Matches"
          onSecondaryAction={() => onNavigate('matches')}
        />
      ) : bundle.playerStats.length === 0 && bundle.teamStats.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No statistics match your filters"
          description="Try widening the date range or clearing the format, tournament, and team filters."
          primaryActionLabel="Reset Filters"
          onPrimaryAction={resetFilters}
        />
      ) : (
        <div className="space-y-4">
          {/* Workspace Navigation Tabs */}
          <div
            className="grid grid-cols-4 gap-1.5 rounded-2xl bg-[#0D130F] border border-white/10 p-1.5"
            role="tablist"
            aria-label="Statistics sections"
          >
            {(
              [
                {key: 'leaderboards', label: 'Leaders', icon: Award},
                {key: 'players', label: 'Players', icon: Users},
                {key: 'teams', label: 'Teams', icon: Shield},
                {key: 'tournaments', label: 'Events', icon: Trophy},
              ] as const
            ).map(({key, label, icon: Icon}) => {
              const isSelected = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveTab(key)}
                  className={`min-h-[44px] rounded-xl px-2 py-2 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold transition-colors ${
                    isSelected
                      ? 'bg-[#16A34A] text-white'
                      : 'text-[#9CB0A4] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: LEADERBOARDS */}
          {activeTab === 'leaderboards' && (
            <div className="space-y-4">
              {/* 8 Leaderboard Switcher Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {LEADERBOARD_OPTIONS.map((opt) => {
                  const selected = activeBoard === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setActiveBoard(opt.key)}
                      className={`min-h-[44px] rounded-xl px-3 py-2 text-left text-xs font-semibold border transition-colors ${
                        selected
                          ? 'bg-[#0D3B24] border-[#22C55E] text-white'
                          : 'bg-[#101612] border-white/10 text-[#9CB0A4] hover:text-white hover:border-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Boundary sub-toggle when Most 4s & 6s is active */}
              {activeBoard === 'mostBoundaries' && (
                <div className="inline-grid grid-cols-3 rounded-xl bg-[#101612] border border-white/10 p-1">
                  {(
                    [
                      {key: 'combined', label: 'Combined'},
                      {key: 'fours', label: 'Most 4s'},
                      {key: 'sixes', label: 'Most 6s'},
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setBoundaryMode(item.key)}
                      className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold transition-colors ${
                        boundaryMode === item.key
                          ? 'bg-[#16A34A] text-white'
                          : 'text-[#9CB0A4] hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Active Leaderboard Card */}
              <LeaderboardPanel
                boardKey={activeBoard}
                boundaryMode={boundaryMode}
                leaderboards={bundle.leaderboards}
                onSelectPlayer={handlePlayerPicked}
              />
            </div>
          )}

          {/* TAB 2: PLAYERS DIRECTORY & STATS */}
          {activeTab === 'players' && (
            <div className="space-y-3.5">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#8FA397] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    placeholder="Search players or teams..."
                    className="w-full min-h-[44px] rounded-xl bg-[#101612] border border-white/10 pl-10 pr-4 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
                  />
                </div>

                <div className="grid grid-cols-2 rounded-xl bg-[#101612] border border-white/10 p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPlayerStatView('batting')}
                    className={`min-h-[36px] px-3.5 rounded-lg text-xs font-semibold transition-colors ${
                      playerStatView === 'batting'
                        ? 'bg-[#16A34A] text-white'
                        : 'text-[#9CB0A4] hover:text-white'
                    }`}
                  >
                    Batting
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayerStatView('bowling')}
                    className={`min-h-[36px] px-3.5 rounded-lg text-xs font-semibold transition-colors ${
                      playerStatView === 'bowling'
                        ? 'bg-[#16A34A] text-white'
                        : 'text-[#9CB0A4] hover:text-white'
                    }`}
                  >
                    Bowling
                  </button>
                </div>
              </div>

              {filteredPlayerDirectory.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No matching players"
                  description="Clear the player search or adjust active statistics filters."
                  primaryActionLabel="Clear Search"
                  onPrimaryAction={() => setPlayerSearch('')}
                />
              ) : (
                <div className="rounded-2xl bg-[#101612] border border-white/10 overflow-x-auto">
                  {playerStatView === 'batting' ? (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-[#8FA397]">
                          <th className="py-3 px-3 font-medium">Player</th>
                          <th className="py-3 px-2 text-right font-medium">M</th>
                          <th className="py-3 px-2 text-right font-medium">Inn</th>
                          <th className="py-3 px-2 text-right font-medium">NO</th>
                          <th className="py-3 px-2 text-right font-medium">Runs</th>
                          <th className="py-3 px-2 text-right font-medium">HS</th>
                          <th className="py-3 px-2 text-right font-medium">Avg</th>
                          <th className="py-3 px-2 text-right font-medium">SR</th>
                          <th className="py-3 px-2 text-right font-medium">4s/6s</th>
                          <th className="py-3 px-3 text-right font-medium">100/50</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono tabular-nums">
                        {filteredPlayerDirectory.map((p) => (
                          <tr
                            key={p.playerId}
                            onClick={() => handlePlayerPicked(p.playerId)}
                            className="hover:bg-white/5 cursor-pointer transition-colors"
                          >
                            <td className="py-3 px-3 font-sans">
                              <div className="font-semibold text-white whitespace-nowrap">
                                {p.playerName}
                              </div>
                              <div className="text-[11px] text-[#8FA397]">
                                {p.teamShortName}
                              </div>
                            </td>
                            <td className="py-3 px-2 text-right text-[#D7E4DC]">{p.matches}</td>
                            <td className="py-3 px-2 text-right text-[#D7E4DC]">
                              {p.battingInnings}
                            </td>
                            <td className="py-3 px-2 text-right text-[#D7E4DC]">{p.notOuts}</td>
                            <td className="py-3 px-2 text-right font-bold text-[#4ADE80]">
                              {p.runs}
                            </td>
                            <td className="py-3 px-2 text-right text-white">
                              {p.highestScoreFormatted}
                            </td>
                            <td className="py-3 px-2 text-right text-[#D7E4DC]">
                              {p.battingAverage !== null ? p.battingAverage.toFixed(1) : '—'}
                            </td>
                            <td className="py-3 px-2 text-right text-[#D7E4DC]">
                              {p.strikeRate.toFixed(1)}
                            </td>
                            <td className="py-3 px-2 text-right text-[#D7E4DC] whitespace-nowrap">
                              {p.fours}/{p.sixes}
                            </td>
                            <td className="py-3 px-3 text-right text-[#D7E4DC] whitespace-nowrap">
                              {p.hundreds}/{p.fifties}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-[#8FA397]">
                          <th className="py-3 px-3 font-medium">Player</th>
                          <th className="py-3 px-2 text-right font-medium">M</th>
                          <th className="py-3 px-2 text-right font-medium">Inn</th>
                          <th className="py-3 px-2 text-right font-medium">Ov</th>
                          <th className="py-3 px-2 text-right font-medium">Mdn</th>
                          <th className="py-3 px-2 text-right font-medium">Runs</th>
                          <th className="py-3 px-2 text-right font-medium">Wkts</th>
                          <th className="py-3 px-2 text-right font-medium">Best</th>
                          <th className="py-3 px-2 text-right font-medium">Econ</th>
                          <th className="py-3 px-2 text-right font-medium">Avg</th>
                          <th className="py-3 px-3 text-right font-medium">SR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono tabular-nums">
                        {filteredPlayerDirectory.map((p) => (
                          <tr
                            key={p.playerId}
                            onClick={() => handlePlayerPicked(p.playerId)}
                            className="hover:bg-white/5 cursor-pointer transition-colors"
                          >
                            <td className="py-3 px-3 font-sans">
                              <div className="font-semibold text-white whitespace-nowrap">
                                {p.playerName}
                              </div>
                              <div className="text-[11px] text-[#8FA397]">
                                {p.teamShortName}
                              </div>
                            </td>
                            <td className="py-3 px-2 text-right text-[#D7E4DC]">{p.matches}</td>
                            <td className="py-3 px-2 text-right text-[#D7E4DC]">
                              {p.bowlingInnings}
                            </td>
                            <td className="py-3 px-2 text-right text-[#D7E4DC]">
                              {p.oversBowledFormatted}
                            </td>
                            <td className="py-3 px-2 text-right text-[#D7E4DC]">{p.maidens}</td>
                            <td className="py-3 px-2 text-right text-[#D7E4DC]">
                              {p.runsConceded}
                            </td>
                            <td className="py-3 px-2 text-right font-bold text-[#4ADE80]">
                              {p.wickets}
                            </td>
                            <td className="py-3 px-2 text-right text-white">
                              {p.bestBowlingFormatted}
                            </td>
                            <td className="py-3 px-2 text-right text-[#D7E4DC]">
                              {p.bowlingInnings > 0 ? p.economy.toFixed(2) : '—'}
                            </td>
                            <td className="py-3 px-2 text-right text-[#D7E4DC]">
                              {p.bowlingAverage !== null ? p.bowlingAverage.toFixed(1) : '—'}
                            </td>
                            <td className="py-3 px-3 text-right text-[#D7E4DC]">
                              {p.bowlingStrikeRate !== null ? p.bowlingStrikeRate.toFixed(1) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              <p className="text-xs text-[#8FA397]">
                Tap any player row to open their full Career Profile & Match-by-Match performance log.
              </p>
            </div>
          )}

          {/* TAB 3: TEAM STATISTICS */}
          {activeTab === 'teams' && (
            <div className="space-y-3">
              {bundle.teamStats.length === 0 ? (
                <EmptyState
                  icon={Shield}
                  title="No team match statistics yet"
                  description="Team win records, highest totals, and Net Run Rate appear once matches are played."
                />
              ) : (
                <div className="rounded-2xl bg-[#101612] border border-white/10 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[#8FA397]">
                        <th className="py-3 px-3 font-medium">Team</th>
                        <th className="py-3 px-2 text-right font-medium">M</th>
                        <th className="py-3 px-2 text-right font-medium">W</th>
                        <th className="py-3 px-2 text-right font-medium">L</th>
                        <th className="py-3 px-2 text-right font-medium">T</th>
                        <th className="py-3 px-2 text-right font-medium">NR</th>
                        <th className="py-3 px-2 text-right font-medium">Win%</th>
                        <th className="py-3 px-2 text-right font-medium">NRR</th>
                        <th className="py-3 px-2 text-right font-medium">HS</th>
                        <th className="py-3 px-2 text-right font-medium">4s/6s</th>
                        <th className="py-3 px-3 text-right font-medium">Wkts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono tabular-nums">
                      {bundle.teamStats.map((ts) => (
                        <tr key={ts.teamId} className="text-[#D7E4DC]">
                          <td className="py-3 px-3 font-sans">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-sm shrink-0"
                                style={{backgroundColor: ts.primaryColor}}
                              />
                              <div>
                                <div className="font-semibold text-white whitespace-nowrap">
                                  {ts.teamName}
                                </div>
                                <div className="text-[11px] text-[#8FA397]">{ts.shortName}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right">{ts.matches}</td>
                          <td className="py-3 px-2 text-right font-semibold text-[#4ADE80]">
                            {ts.won}
                          </td>
                          <td className="py-3 px-2 text-right">{ts.lost}</td>
                          <td className="py-3 px-2 text-right">{ts.tied}</td>
                          <td className="py-3 px-2 text-right">{ts.noResult}</td>
                          <td className="py-3 px-2 text-right">{ts.winPercentage.toFixed(1)}%</td>
                          <td className="py-3 px-2 text-right font-semibold text-white">
                            {ts.nrrFormatted}
                          </td>
                          <td className="py-3 px-2 text-right">{ts.highestTotal}</td>
                          <td className="py-3 px-2 text-right whitespace-nowrap">
                            {ts.totalFours}/{ts.totalSixes}
                          </td>
                          <td className="py-3 px-3 text-right">{ts.totalWicketsTaken}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TOURNAMENT STATISTICS */}
          {activeTab === 'tournaments' && (
            <div className="space-y-3">
              {bundle.tournamentStats.length === 0 ? (
                <EmptyState
                  icon={Trophy}
                  title="No tournament match stats yet"
                  description="Link matches to a tournament or score tournament fixtures to see tournament-wide totals, highest innings, and top performers."
                  primaryActionLabel="Go to Tournaments"
                  onPrimaryAction={() => onNavigate('tournaments')}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {bundle.tournamentStats.map((tr) => (
                    <article
                      key={tr.tournamentId}
                      className="rounded-2xl bg-[#101612] border border-white/10 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-display text-base font-bold text-white">
                            {tr.tournamentName}
                          </h3>
                          <p className="mt-0.5 text-xs text-[#9CB0A4] font-mono tabular-nums">
                            {FORMAT_LABELS[tr.format]} · {tr.completedCount}/{tr.matchesCount} matches
                            completed
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFilter((prev) => ({
                              ...prev,
                              tournamentId: tr.tournamentId,
                            }))
                          }
                          className="min-h-[36px] px-3 rounded-lg bg-[#0D3B24] hover:bg-[#145334] text-xs font-semibold text-[#4ADE80] transition-colors shrink-0"
                        >
                          Filter Players
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-xl bg-[#0A100C] border border-white/5 p-2.5">
                          <div className="text-[11px] text-[#8FA397]">Runs</div>
                          <div className="mt-0.5 font-mono font-bold text-white tabular-nums">
                            {tr.totalRuns}
                          </div>
                        </div>
                        <div className="rounded-xl bg-[#0A100C] border border-white/5 p-2.5">
                          <div className="text-[11px] text-[#8FA397]">Wickets</div>
                          <div className="mt-0.5 font-mono font-bold text-[#4ADE80] tabular-nums">
                            {tr.totalWickets}
                          </div>
                        </div>
                        <div className="rounded-xl bg-[#0A100C] border border-white/5 p-2.5">
                          <div className="text-[11px] text-[#8FA397]">4s / 6s</div>
                          <div className="mt-0.5 font-mono font-bold text-white tabular-nums">
                            {tr.totalFours}/{tr.totalSixes}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-[#D7E4DC] pt-1 border-t border-white/5">
                        <div className="flex justify-between gap-2">
                          <span className="text-[#8FA397]">Highest Team Score</span>
                          <span className="font-mono font-semibold text-white tabular-nums">
                            {tr.highestScoreText}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-[#8FA397]">Top Scorer</span>
                          <span className="font-semibold text-white truncate">
                            {tr.topScorer
                              ? `${tr.topScorer.name} (${tr.topScorer.runs})`
                              : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-[#8FA397]">Top Wicket Taker</span>
                          <span className="font-semibold text-[#4ADE80] truncate">
                            {tr.topWicketTaker
                              ? `${tr.topWicketTaker.name} (${tr.topWicketTaker.wickets})`
                              : '—'}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Player Career & Filtered Profile Modal */}
      {selectedPlayerId && (
        <PlayerProfileModal
          filteredStats={selectedPlayerFiltered}
          careerStats={selectedPlayerCareer}
          hasActiveFilter={hasActiveFilter}
          onClose={() => setSelectedPlayerId(null)}
          onOpenMatch={onOpenMatch}
          onOpenFullCareerProfile={
            onOpenPlayerProfile
              ? (pid) => {
                  setSelectedPlayerId(null);
                  onOpenPlayerProfile(pid);
                }
              : undefined
          }
        />
      )}

      <PlayerComparisonModal
        isOpen={compareOpen}
        players={players}
        teams={teams}
        matches={matches}
        onClose={() => setCompareOpen(false)}
      />
    </div>
  );
};

interface LeaderboardPanelProps {
  boardKey: LeaderboardKey;
  boundaryMode: BoundarySubMode;
  leaderboards: ReturnType<typeof computeStatisticsBundle>['leaderboards'];
  onSelectPlayer: (playerId: string) => void;
}

const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  boardKey,
  boundaryMode,
  leaderboards,
  onSelectPlayer,
}) => {
  if (boardKey === 'highestScores') {
    const rows = leaderboards.highestScores.slice(0, 25);
    return (
      <LeaderboardShell
        title="Highest Individual Scores"
        subtitle="Top single-innings batting knocks"
        isEmpty={rows.length === 0}
      >
        {rows.map((item, idx) => (
          <InningsLeaderRow
            key={`${item.matchId}-${item.inningsNumber}-${item.playerId}`}
            rank={idx + 1}
            name={item.playerName}
            meta={`${item.teamShortName} vs ${item.opponentShortName} · ${FORMAT_LABELS[item.format]} · ${item.matchDate}`}
            primary={`${item.runs}${item.isOut ? '' : '*'}`}
            secondary={`${item.balls}b · ${item.fours}×4, ${item.sixes}×6`}
            onClick={() => onSelectPlayer(item.playerId)}
          />
        ))}
      </LeaderboardShell>
    );
  }

  if (boardKey === 'bestBowlingFigures') {
    const rows = leaderboards.bestBowlingFigures.slice(0, 25);
    return (
      <LeaderboardShell
        title="Best Bowling Figures"
        subtitle="Top single-innings spells (wickets / runs)"
        isEmpty={rows.length === 0}
      >
        {rows.map((item, idx) => (
          <InningsLeaderRow
            key={`${item.matchId}-${item.inningsNumber}-${item.playerId}`}
            rank={idx + 1}
            name={item.playerName}
            meta={`${item.teamShortName} vs ${item.opponentShortName} · ${FORMAT_LABELS[item.format]} · ${item.matchDate}`}
            primary={`${item.wickets}/${item.runsConceded}`}
            secondary={`${item.oversFormatted} ov · ${item.maidens}m · Econ ${item.economy.toFixed(2)}`}
            accent
            onClick={() => onSelectPlayer(item.playerId)}
          />
        ))}
      </LeaderboardShell>
    );
  }

  const getPlayerListAndDisplay = (): {
    title: string;
    subtitle: string;
    items: PlayerStatsRecord[];
    formatRow: (p: PlayerStatsRecord) => {primary: string; secondary: string; accent?: boolean};
  } => {
    switch (boardKey) {
      case 'mostRuns':
        return {
          title: 'Most Runs',
          subtitle: 'Leading run scorers',
          items: leaderboards.mostRuns,
          formatRow: (p) => ({
            primary: String(p.runs),
            secondary: `${p.battingInnings} inn · HS ${p.highestScoreFormatted} · SR ${p.strikeRate.toFixed(1)}`,
          }),
        };
      case 'bestAverage':
        return {
          title: 'Best Batting Average',
          subtitle: 'Runs per dismissal (at least 1 dismissal)',
          items: leaderboards.bestAverage,
          formatRow: (p) => ({
            primary: p.battingAverage !== null ? p.battingAverage.toFixed(2) : '—',
            secondary: `${p.runs} runs · ${p.battingInnings} inn (${p.notOuts} NO)`,
          }),
        };
      case 'bestStrikeRate':
        return {
          title: 'Best Strike Rate',
          subtitle: 'Runs per 100 balls faced',
          items: leaderboards.bestStrikeRate,
          formatRow: (p) => ({
            primary: p.strikeRate.toFixed(1),
            secondary: `${p.runs} runs (${p.ballsFaced} balls)`,
          }),
        };
      case 'mostWickets':
        return {
          title: 'Most Wickets',
          subtitle: 'Leading wicket takers (bowler-credited dismissals)',
          items: leaderboards.mostWickets,
          formatRow: (p) => ({
            primary: String(p.wickets),
            secondary: `${p.oversBowledFormatted} ov · Best ${p.bestBowlingFormatted} · Econ ${p.economy.toFixed(2)}`,
            accent: true,
          }),
        };
      case 'bestEconomy':
        return {
          title: 'Best Economy Rate',
          subtitle: 'Lowest runs conceded per over',
          items: leaderboards.bestEconomy,
          formatRow: (p) => ({
            primary: p.economy.toFixed(2),
            secondary: `${p.oversBowledFormatted} ov · ${p.runsConceded} runs · ${p.wickets} wkts`,
            accent: true,
          }),
        };
      case 'mostBoundaries': {
        const items =
          boundaryMode === 'fours'
            ? leaderboards.mostFours
            : boundaryMode === 'sixes'
              ? leaderboards.mostSixes
              : leaderboards.mostBoundaries;
        return {
          title:
            boundaryMode === 'fours'
              ? 'Most Fours'
              : boundaryMode === 'sixes'
                ? 'Most Sixes'
                : 'Most Fours & Sixes',
          subtitle: 'Boundary hitters across innings',
          items,
          formatRow: (p) => ({
            primary:
              boundaryMode === 'fours'
                ? String(p.fours)
                : boundaryMode === 'sixes'
                  ? String(p.sixes)
                  : String(p.boundaries),
            secondary: `${p.fours}×4 · ${p.sixes}×6 · ${p.runs} runs`,
          }),
        };
      }
    }
  };

  const config = getPlayerListAndDisplay();
  const sliced = config.items.slice(0, 25);

  return (
    <LeaderboardShell
      title={config.title}
      subtitle={config.subtitle}
      isEmpty={sliced.length === 0}
    >
      {sliced.map((p, idx) => {
        const display = config.formatRow(p);
        return (
          <button
            key={p.playerId}
            type="button"
            onClick={() => onSelectPlayer(p.playerId)}
            className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`w-6 text-center font-mono text-xs font-bold tabular-nums shrink-0 ${
                  idx === 0 ? 'text-[#4ADE80]' : 'text-[#8FA397]'
                }`}
              >
                {idx + 1}
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#0D3B24]/70 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                {p.photoDataUrl ? (
                  <img
                    src={p.photoDataUrl}
                    alt={p.playerName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-[#4ADE80]" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {p.playerName}
                </div>
                <div className="text-[11px] text-[#8FA397] truncate">
                  {p.teamShortName} · {p.matches}M
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div
                className={`font-mono text-base font-bold tabular-nums ${
                  display.accent ? 'text-[#4ADE80]' : 'text-white'
                }`}
              >
                {display.primary}
              </div>
              <div className="font-mono text-[11px] text-[#8FA397] tabular-nums">
                {display.secondary}
              </div>
            </div>
          </button>
        );
      })}
    </LeaderboardShell>
  );
};

const LeaderboardShell: React.FC<{
  title: string;
  subtitle: string;
  isEmpty: boolean;
  children: React.ReactNode;
}> = ({title, subtitle, isEmpty, children}) => (
  <div className="rounded-2xl bg-[#101612] border border-white/10 overflow-hidden">
    <div className="px-4 py-3.5 border-b border-white/10 bg-[#0D130F]">
      <h2 className="font-display text-base font-bold text-white">{title}</h2>
      <p className="text-xs text-[#8FA397] mt-0.5">{subtitle}</p>
    </div>
    {isEmpty ? (
      <div className="p-6 text-sm text-[#8FA397] text-center">
        No qualifying performances recorded for this leaderboard yet.
      </div>
    ) : (
      <div className="divide-y divide-white/5">{children}</div>
    )}
  </div>
);

const InningsLeaderRow: React.FC<{
  rank: number;
  name: string;
  meta: string;
  primary: string;
  secondary: string;
  accent?: boolean;
  onClick: () => void;
}> = ({rank, name, meta, primary, secondary, accent, onClick}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-center justify-between gap-3"
  >
    <div className="flex items-center gap-3 min-w-0">
      <span
        className={`w-6 text-center font-mono text-xs font-bold tabular-nums shrink-0 ${
          rank === 1 ? 'text-[#4ADE80]' : 'text-[#8FA397]'
        }`}
      >
        {rank}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white truncate">{name}</div>
        <div className="text-[11px] text-[#8FA397] truncate">{meta}</div>
      </div>
    </div>

    <div className="text-right shrink-0">
      <div
        className={`font-mono text-base font-bold tabular-nums ${
          accent ? 'text-[#4ADE80]' : 'text-white'
        }`}
      >
        {primary}
      </div>
      <div className="font-mono text-[11px] text-[#8FA397] tabular-nums">{secondary}</div>
    </div>
  </button>
);
