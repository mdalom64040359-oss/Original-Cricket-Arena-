import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ArrowRight, Calendar, Heart, MapPin, Plus, Radio, Search} from 'lucide-react';
import {useUser} from '../../contexts/UserContext';
import {
  deleteMatch,
  getAllMatches,
  getAllPlayers,
  getAllTeams,
  saveMatch,
} from '../../db/database';
import {formatOvers} from '../../engine/scoringEngine';
import type {AppView, Match, MatchStatus, Player, Team} from '../../types/cricket';
import {EmptyState} from '../common/EmptyState';
import {PageHeader} from '../common/PageHeader';
import {MatchDetailView} from '../matches/MatchDetailView';
import {LiveScoringView} from '../scoring/LiveScoringView';

interface MatchesViewProps {
  selectedMatchId: string | null;
  onSelectMatch: (matchId: string | null) => void;
  onEditMatch: (match: Match) => void;
  onNavigate: (view: AppView) => void;
  onDataChanged: () => Promise<void>;
  onOpenPlayerProfile?: (playerId: string) => void;
}

type MatchFilter = 'all' | MatchStatus;

export const MatchesView: React.FC<MatchesViewProps> = ({
  selectedMatchId,
  onSelectMatch,
  onEditMatch,
  onNavigate,
  onDataChanged,
  onOpenPlayerProfile,
}) => {
  const {profile, toggleFavouriteMatch} = useUser();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [filter, setFilter] = useState<MatchFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isScoringMode, setIsScoringMode] = useState(false);

  useEffect(() => {
    setIsScoringMode(false);
  }, [selectedMatchId]);

  const loadData = useCallback(async () => {
    try {
      const [matchList, teamList, playerList] = await Promise.all([
        getAllMatches(),
        getAllTeams(),
        getAllPlayers(),
      ]);
      setMatches(matchList.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setTeams(teamList);
      setPlayers(playerList);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return matches.filter((match) => {
      if (filter !== 'all' && match.status !== filter) return false;
      if (!q) return true;
      return (
        match.title.toLowerCase().includes(q) ||
        match.teamAName.toLowerCase().includes(q) ||
        match.teamBName.toLowerCase().includes(q) ||
        (match.venue ?? '').toLowerCase().includes(q) ||
        (match.tournamentName ?? '').toLowerCase().includes(q)
      );
    });
  }, [matches, filter, searchQuery]);

  const selectedMatch = matches.find((m) => m.id === selectedMatchId) ?? null;

  const handleUpdateStatus = async (match: Match, nextStatus: MatchStatus) => {
    const updated: Match = {
      ...match,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    await saveMatch(updated);
    await loadData();
    await onDataChanged();
  };

  const handleUpdateMatch = async (updatedMatch: Match) => {
    await saveMatch(updatedMatch);
    await loadData();
    await onDataChanged();
  };

  const handleDeleteMatch = async (matchId: string) => {
    await deleteMatch(matchId);
    onSelectMatch(null);
    await loadData();
    await onDataChanged();
  };

  if (selectedMatch && isScoringMode) {
    return (
      <LiveScoringView
        key={selectedMatch.id}
        match={selectedMatch}
        players={players}
        onMatchUpdated={async () => {
          await loadData();
          await onDataChanged();
        }}
        onBack={() => setIsScoringMode(false)}
      />
    );
  }

  if (selectedMatch) {
    return (
      <MatchDetailView
        key={selectedMatch.id}
        match={selectedMatch}
        teams={teams}
        players={players}
        onBack={() => onSelectMatch(null)}
        onEditMatch={onEditMatch}
        onUpdateStatus={handleUpdateStatus}
        onUpdateMatch={handleUpdateMatch}
        onDeleteMatch={handleDeleteMatch}
        onOpenLiveScoring={() => setIsScoringMode(true)}
        onNavigate={onNavigate}
        onOpenPlayerProfile={onOpenPlayerProfile}
      />
    );
  }

  const filterTabs: Array<{id: MatchFilter; label: string}> = [
    {id: 'all', label: 'All'},
    {id: 'live', label: 'Live'},
    {id: 'upcoming', label: 'Upcoming'},
    {id: 'completed', label: 'Completed'},
    {id: 'abandoned', label: 'Abandoned'},
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Matches"
        subtitle="Live, upcoming, completed & abandoned local scorecards"
        onBackHome={() => onNavigate('home')}
        action={
          <button
            type="button"
            onClick={() => onNavigate('create-match')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create Match</span>
          </button>
        }
      />

      {matches.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-[#8FA397] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search matches by team, venue, or tournament..."
            className="w-full min-h-[44px] rounded-xl bg-[#101612] border border-white/10 pl-10 pr-4 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
          />
        </div>
      )}

      <div
        className="flex items-center gap-1 p-1 rounded-xl bg-[#101612] border border-white/10 w-full sm:w-fit overflow-x-auto"
        role="tablist"
        aria-label="Filter matches by status"
      >
        {filterTabs.map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(tab.id)}
              className={`flex-1 sm:flex-none px-3.5 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[#0D3B24] text-white border border-[#22C55E]/30'
                  : 'text-[#9CB0A4] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="rounded-2xl bg-[#101612] border border-white/10 p-6 text-sm text-[#9CB0A4]">
          Loading local matches from device storage...
        </div>
      ) : filteredMatches.length === 0 ? (
        <EmptyState
          icon={Radio}
          title={
            matches.length === 0
              ? 'No matches recorded yet'
              : filter === 'all'
                ? 'No matching matches found'
                : `No ${filter} matches`
          }
          description="Create your first local T10, T20, ODI, Test, or custom overs match with Playing XI squads and toss details."
          primaryActionLabel="Create Match"
          onPrimaryAction={() => onNavigate('create-match')}
          secondaryActionLabel={
            filter !== 'all' || searchQuery ? 'Show All Matches' : 'View Teams'
          }
          onSecondaryAction={() => {
            if (filter !== 'all' || searchQuery) {
              setFilter('all');
              setSearchQuery('');
            } else {
              onNavigate('teams');
            }
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMatches.map((match) => {
            const isFav = profile.favouriteMatchIds.includes(match.id);
            return (
            <div
              key={match.id}
              className="group rounded-2xl bg-[#101612] hover:bg-[#141D17] border border-white/10 hover:border-[#22C55E]/40 p-5 space-y-3 transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-mono text-[#4ADE80] uppercase tracking-wide">
                  {match.format === 'TEST'
                    ? `TEST · Day ${match.testCurrentDay ?? 1}/${match.testMaxDays ?? 5}`
                    : `${match.format} · ${match.oversPerInnings} Overs`}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#C8D6CE] capitalize">
                    {match.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => void toggleFavouriteMatch(match.id)}
                    aria-pressed={isFav}
                    aria-label={`Favourite ${match.title}`}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      isFav
                        ? 'text-[#4ADE80] bg-[#0D3B24]'
                        : 'text-[#8FA397] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-[#4ADE80]' : ''}`} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectMatch(match.id)}
                className="w-full text-left flex items-start justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] rounded-lg"
              >
                <h2 className="font-display text-base sm:text-lg font-bold text-white">
                  {match.title}
                </h2>
                <ArrowRight className="w-4 h-4 text-[#8FA397] group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
              </button>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9CB0A4]">
                {match.matchDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#22C55E]" />
                    <span>{match.matchDate}</span>
                  </span>
                )}
                {match.venue && (
                  <span className="inline-flex items-center gap-1 truncate max-w-[180px]">
                    <MapPin className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                    <span className="truncate">{match.venue}</span>
                  </span>
                )}
              </div>

              {match.innings.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-white tabular-nums pt-1">
                  {match.innings.map((inn) => {
                    const short =
                      inn.battingTeamId === match.teamAId
                        ? match.teamAShortName
                        : match.teamBShortName;
                    return (
                      <span key={inn.inningsNumber}>
                        {short}: {inn.runs}/{inn.wickets}
                        {inn.declared ? 'd' : ''} ({formatOvers(inn.legalBalls)})
                      </span>
                    );
                  })}
                </div>
              )}

              {match.resultSummary && (
                <p className="text-xs text-[#9AC2AA] pt-2 border-t border-white/10">
                  {match.resultSummary}
                </p>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
