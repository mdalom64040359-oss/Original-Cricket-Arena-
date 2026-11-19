import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ArrowRight, Calendar, Heart, MapPin, Plus, Search, Trophy} from 'lucide-react';
import {useUser} from '../../contexts/UserContext';
import {
  deleteTournament,
  getAllMatches,
  getAllPlayers,
  getAllTeams,
  getAllTournaments,
  saveTournament,
} from '../../db/database';
import {resolveTournamentFormat} from '../../engine/tournamentEngine';
import type {AppView, Match, Player, Team, Tournament} from '../../types/cricket';
import {EmptyState} from '../common/EmptyState';
import {PageHeader} from '../common/PageHeader';
import {TournamentDetailView} from '../tournaments/TournamentDetailView';
import {TournamentFormModal} from '../tournaments/TournamentFormModal';

interface TournamentsViewProps {
  onNavigate: (view: AppView) => void;
  onOpenMatch: (matchId: string) => void;
  onDataChanged: () => Promise<void>;
}

type TournamentFilter = 'all' | Tournament['status'];

export const TournamentsView: React.FC<TournamentsViewProps> = ({
  onNavigate,
  onOpenMatch,
  onDataChanged,
}) => {
  const {profile, toggleFavouriteLeague} = useUser();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);

  const [filter, setFilter] = useState<TournamentFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [tourList, teamList, playerList, matchList] = await Promise.all([
        getAllTournaments(),
        getAllTeams(),
        getAllPlayers(),
        getAllMatches(),
      ]);
      setTournaments(tourList.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setTeams(teamList);
      setPlayers(playerList);
      setMatches(matchList);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredTournaments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tournaments.filter((t) => {
      if (filter !== 'all' && t.status !== filter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.location ?? '').toLowerCase().includes(q) ||
        resolveTournamentFormat(t).toLowerCase().includes(q)
      );
    });
  }, [tournaments, filter, searchQuery]);

  const selectedTournament =
    tournaments.find((t) => t.id === selectedTournamentId) ?? null;

  const handleSaveTournament = async (tournamentPayload: Tournament) => {
    await saveTournament(tournamentPayload);
    await loadData();
    await onDataChanged();
    setSelectedTournamentId(tournamentPayload.id);
  };

  const handleDeleteTournament = async (tournamentId: string) => {
    await deleteTournament(tournamentId);
    setSelectedTournamentId(null);
    await loadData();
    await onDataChanged();
  };

  if (selectedTournament) {
    return (
      <>
        <TournamentDetailView
          tournament={selectedTournament}
          teams={teams}
          players={players}
          matches={matches}
          onBack={() => setSelectedTournamentId(null)}
          onEditTournament={(tour) => {
            setEditingTournament(tour);
            setFormOpen(true);
          }}
          onDeleteTournament={handleDeleteTournament}
          onTournamentUpdated={async () => {
            await loadData();
            await onDataChanged();
          }}
          onOpenMatch={onOpenMatch}
          onNavigate={onNavigate}
        />

        <TournamentFormModal
          isOpen={formOpen}
          editingTournament={editingTournament}
          availableTeams={teams}
          onSave={handleSaveTournament}
          onClose={() => {
            setFormOpen(false);
            setEditingTournament(null);
          }}
          onGoToTeams={() => onNavigate('teams')}
        />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tournaments"
        subtitle="Round Robin, Groups, League, Knockout & Hybrid competitions for 20 to 50+ teams"
        onBackHome={() => onNavigate('home')}
        action={
          <button
            type="button"
            onClick={() => {
              setEditingTournament(null);
              setFormOpen(true);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create Tournament</span>
          </button>
        }
      />

      {tournaments.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8FA397] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tournaments by name, location, or format..."
              className="w-full min-h-[44px] rounded-xl bg-[#101612] border border-white/10 pl-10 pr-4 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
            />
          </div>

          <div
            className="flex items-center gap-1 p-1 rounded-xl bg-[#101612] border border-white/10 w-full sm:w-fit overflow-x-auto"
            role="tablist"
          >
            {(['all', 'upcoming', 'active', 'completed'] as const).map((tab) => {
              const active = filter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(tab)}
                  className={`flex-1 sm:flex-none px-3.5 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-medium capitalize transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#0D3B24] text-white border border-[#22C55E]/30'
                      : 'text-[#9CB0A4] hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl bg-[#101612] border border-white/10 p-6 text-sm text-[#9CB0A4]">
          Loading tournaments from local storage...
        </div>
      ) : filteredTournaments.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={
            tournaments.length === 0 ? 'No tournaments created yet' : 'No matching tournaments'
          }
          description="Organize tournaments for 20, 24, 32, 40, 50 or more teams with automated fixtures, group stages, knockouts, points tables, and Net Run Rate."
          primaryActionLabel="Create Tournament"
          onPrimaryAction={() => {
            setEditingTournament(null);
            setFormOpen(true);
          }}
          secondaryActionLabel={tournaments.length === 0 ? 'Manage Teams' : 'Show All'}
          onSecondaryAction={() => {
            if (tournaments.length === 0) {
              onNavigate('teams');
            } else {
              setFilter('all');
              setSearchQuery('');
            }
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTournaments.map((tournament) => {
            const fmt = resolveTournamentFormat(tournament);
            const fixtureCount = tournament.fixtures?.length ?? 0;
            const isFav = profile.favouriteLeagues.includes(tournament.name);

            return (
              <div
                key={tournament.id}
                className="group rounded-2xl bg-[#101612] hover:bg-[#141D17] border border-white/10 hover:border-[#22C55E]/40 p-5 space-y-3 transition-all"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-[#4ADE80] uppercase">
                    {tournament.format} · {tournament.oversPerInnings} Ov · {fmt.replace('-', ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#C8D6CE] font-semibold capitalize">
                      {tournament.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => void toggleFavouriteLeague(tournament.name)}
                      aria-pressed={isFav}
                      aria-label={`Favourite ${tournament.name}`}
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
                  onClick={() => setSelectedTournamentId(tournament.id)}
                  className="w-full text-left flex items-center gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] rounded-lg"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#0D3B24] border border-[#22C55E]/25 flex items-center justify-center overflow-hidden shrink-0">
                    {tournament.logoDataUrl ? (
                      <img
                        src={tournament.logoDataUrl}
                        alt={tournament.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Trophy className="w-5 h-5 text-[#4ADE80]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-base sm:text-lg font-bold text-white truncate">
                      {tournament.name}
                    </h2>
                    <p className="font-mono text-xs text-[#9CB0A4] tabular-nums">
                      {tournament.teamIds.length} / {tournament.maxTeams} Teams · {fixtureCount}{' '}
                      Fixtures
                    </p>
                  </div>

                  <ArrowRight className="w-4 h-4 text-[#8FA397] group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>

                {(tournament.location || tournament.startDate) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8FA397] pt-1 border-t border-white/5">
                    {tournament.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#22C55E]" />
                        <span>{tournament.location}</span>
                      </span>
                    )}
                    {tournament.startDate && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#22C55E]" />
                        <span>{tournament.startDate}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TournamentFormModal
        isOpen={formOpen}
        editingTournament={editingTournament}
        availableTeams={teams}
        onSave={handleSaveTournament}
        onClose={() => {
          setFormOpen(false);
          setEditingTournament(null);
        }}
        onGoToTeams={() => onNavigate('teams')}
      />
    </div>
  );
};
