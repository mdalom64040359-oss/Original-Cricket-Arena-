import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ArrowRight, Heart, MapPin, Plus, Search, Shield, Users} from 'lucide-react';
import {useUser} from '../../contexts/UserContext';
import {
  deletePlayerAndUnlink,
  deleteTeamWithPlayers,
  getAllPlayers,
  getAllTeams,
  savePlayerAndLinkTeam,
  saveTeam,
} from '../../db/database';
import type {AppView, Player, Team} from '../../types/cricket';
import {EmptyState} from '../common/EmptyState';
import {PageHeader} from '../common/PageHeader';
import {PlayerFormModal} from '../teams/PlayerFormModal';
import {TeamDetailView} from '../teams/TeamDetailView';
import {TeamFormModal} from '../teams/TeamFormModal';

interface TeamsViewProps {
  onNavigate: (view: AppView) => void;
  onOpenMatch?: (matchId: string) => void;
  onOpenPlayerProfile?: (playerId: string) => void;
  onDataChanged: () => Promise<void>;
}

export const TeamsView: React.FC<TeamsViewProps> = ({
  onNavigate,
  onOpenMatch,
  onOpenPlayerProfile,
  onDataChanged,
}) => {
  const {profile, toggleFavouriteTeam} = useUser();
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'players'>('newest');

  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [teamList, playerList] = await Promise.all([getAllTeams(), getAllPlayers()]);
      setTeams(teamList);
      setPlayers(playerList);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const locations = useMemo(() => {
    const unique = new Set<string>();
    teams.forEach((t) => {
      const loc = (t.location ?? t.city ?? '').trim();
      if (loc) unique.add(loc);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [teams]);

  const playerCountByTeam = useMemo(() => {
    const map = new Map<string, number>();
    players.forEach((p) => {
      if (p.teamId) {
        map.set(p.teamId, (map.get(p.teamId) ?? 0) + 1);
      }
    });
    return map;
  }, [players]);

  const filteredTeams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = teams.filter((team) => {
      const loc = (team.location ?? team.city ?? '').trim();
      if (locationFilter !== 'all' && loc !== locationFilter) return false;
      if (!q) return true;
      return (
        team.name.toLowerCase().includes(q) ||
        team.shortName.toLowerCase().includes(q) ||
        loc.toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'players') {
        return (playerCountByTeam.get(b.id) ?? 0) - (playerCountByTeam.get(a.id) ?? 0);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [teams, searchQuery, locationFilter, sortBy, playerCountByTeam]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null;

  const handleSaveTeam = async (team: Team) => {
    await saveTeam(team);
    await loadData();
    await onDataChanged();
  };

  const handleDeleteTeam = async (teamId: string) => {
    await deleteTeamWithPlayers(teamId);
    setSelectedTeamId(null);
    await loadData();
    await onDataChanged();
  };

  const handleSavePlayer = async (
    player: Player,
    leadership: {makeCaptain?: boolean; makeViceCaptain?: boolean},
  ) => {
    await savePlayerAndLinkTeam(player, leadership);
    await loadData();
    await onDataChanged();
  };

  const handleDeletePlayer = async (playerId: string) => {
    await deletePlayerAndUnlink(playerId);
    await loadData();
    await onDataChanged();
  };

  if (selectedTeam) {
    const squad = players.filter((p) => p.teamId === selectedTeam.id);
    return (
      <>
        <TeamDetailView
          team={selectedTeam}
          allTeams={teams}
          players={squad}
          onBack={() => setSelectedTeamId(null)}
          onEditTeam={(t) => {
            setEditingTeam(t);
            setTeamModalOpen(true);
          }}
          onDeleteTeam={handleDeleteTeam}
          onSaveTeamLeadership={handleSaveTeam}
          onSavePlayer={handleSavePlayer}
          onDeletePlayer={handleDeletePlayer}
          onNavigate={onNavigate}
          onOpenMatch={onOpenMatch}
          onOpenPlayerProfile={onOpenPlayerProfile}
          onOpenPlayerModal={(p) => {
            setEditingPlayer(p);
            setPlayerModalOpen(true);
          }}
        />

        <TeamFormModal
          isOpen={teamModalOpen}
          editingTeam={editingTeam}
          existingTeams={teams}
          onSave={handleSaveTeam}
          onClose={() => {
            setTeamModalOpen(false);
            setEditingTeam(null);
          }}
        />

        <PlayerFormModal
          isOpen={playerModalOpen}
          editingPlayer={editingPlayer}
          defaultTeamId={selectedTeam.id}
          teams={teams}
          existingPlayers={players}
          onSave={handleSavePlayer}
          onClose={() => {
            setPlayerModalOpen(false);
            setEditingPlayer(null);
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Teams"
        subtitle="Create squads, assign captains & manage player rosters"
        onBackHome={() => onNavigate('home')}
        action={
          <button
            type="button"
            onClick={() => {
              setEditingTeam(null);
              setTeamModalOpen(true);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] active:scale-[0.98] px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create Team</span>
          </button>
        }
      />

      {teams.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8FA397] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teams by name, code, or location..."
              className="w-full min-h-[44px] rounded-xl bg-[#101612] border border-white/10 pl-10 pr-4 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
            />
          </div>

          <div className="grid grid-cols-2 sm:flex gap-2.5">
            {locations.length > 0 && (
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                aria-label="Filter teams by location"
                className="min-h-[44px] rounded-xl bg-[#101612] border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                <option value="all">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            )}

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'name' | 'players')}
              aria-label="Sort teams"
              className="min-h-[44px] rounded-xl bg-[#101612] border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
            >
              <option value="newest">Newest First</option>
              <option value="name">Name (A–Z)</option>
              <option value="players">Squad Size</option>
            </select>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl bg-[#101612] border border-white/10 p-6 text-sm text-[#9CB0A4]">
          Loading teams from device storage...
        </div>
      ) : teams.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No teams created yet"
          description="Create your first cricket team with a logo, home ground, and squad players. Everything saves offline on your device."
          primaryActionLabel="Create First Team"
          onPrimaryAction={() => {
            setEditingTeam(null);
            setTeamModalOpen(true);
          }}
          secondaryActionLabel="Back to Home"
          onSecondaryAction={() => onNavigate('home')}
        />
      ) : filteredTeams.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching teams found"
          description="Try a different search term or reset your location filter."
          primaryActionLabel="Clear Search & Filters"
          onPrimaryAction={() => {
            setSearchQuery('');
            setLocationFilter('all');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => {
            const count = playerCountByTeam.get(team.id) ?? 0;
            const loc = team.location ?? team.city;
            const isFav = profile.favouriteTeamIds.includes(team.id);
            return (
              <div
                key={team.id}
                className="group rounded-2xl bg-[#101612] hover:bg-[#141D17] border border-white/10 hover:border-[#22C55E]/40 p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedTeamId(team.id)}
                    className="flex items-center gap-3.5 min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] rounded-lg"
                  >
                    <div
                      className="w-12 h-12 rounded-xl border border-white/15 flex items-center justify-center overflow-hidden shrink-0"
                      style={{backgroundColor: team.primaryColor || '#0D3B24'}}
                    >
                      {team.logoDataUrl ? (
                        <img
                          src={team.logoDataUrl}
                          alt={`${team.name} logo`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-mono text-xs font-bold text-white">
                          {team.shortName}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <h2 className="font-display text-base font-bold text-white truncate">
                        {team.name}
                      </h2>
                      <p className="mt-0.5 text-xs text-[#9CB0A4] truncate">
                        {team.shortName}
                        {loc ? ` · ${loc}` : ''}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void toggleFavouriteTeam(team.id)}
                      aria-pressed={isFav}
                      aria-label={`Favourite ${team.name}`}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                        isFav
                          ? 'text-[#4ADE80] bg-[#0D3B24]'
                          : 'text-[#8FA397] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-[#4ADE80]' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTeamId(team.id)}
                      aria-label={`Open ${team.name}`}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-[#8FA397] group-hover:text-white"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {team.description && (
                  <p className="text-xs text-[#B8C7BE] line-clamp-2 leading-relaxed">
                    {team.description}
                  </p>
                )}

                <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-xs text-[#9AC2AA]">
                  <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                    <Users className="w-3.5 h-3.5 text-[#22C55E]" />
                    <span>
                      {count} {count === 1 ? 'Player' : 'Players'}
                    </span>
                  </span>

                  {loc ? (
                    <span className="inline-flex items-center gap-1 text-[#8FA397] truncate max-w-[130px]">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{loc}</span>
                    </span>
                  ) : (
                    <span className="text-[#8FA397]">Tap to manage</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TeamFormModal
        isOpen={teamModalOpen}
        editingTeam={editingTeam}
        existingTeams={teams}
        onSave={handleSaveTeam}
        onClose={() => {
          setTeamModalOpen(false);
          setEditingTeam(null);
        }}
      />
    </div>
  );
};
