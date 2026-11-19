import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ArrowLeftRight,
  ChevronRight,
  Edit3,
  Heart,
  Plus,
  Search,
  Shield,
  Trash2,
  User,
  UserCheck,
} from 'lucide-react';
import {useUser} from '../../contexts/UserContext';
import {
  deletePlayerAndUnlink,
  getAllMatches,
  getAllPlayers,
  getAllTeams,
  savePlayerAndLinkTeam,
} from '../../db/database';
import type {AppView, Match, Player, PlayerRole, Team} from '../../types/cricket';
import {ConfirmDialog} from '../common/ConfirmDialog';
import {EmptyState} from '../common/EmptyState';
import {PageHeader} from '../common/PageHeader';
import {PlayerComparisonModal} from '../stats/PlayerComparisonModal';
import {PlayerFormModal} from '../teams/PlayerFormModal';

interface PlayersViewProps {
  onNavigate: (view: AppView) => void;
  onOpenPlayerProfile?: (playerId: string) => void;
  onDataChanged: () => Promise<void>;
}

const ROLE_LABELS: Record<PlayerRole, string> = {
  batsman: 'Batter',
  bowler: 'Bowler',
  'all-rounder': 'All-rounder',
  'wicket-keeper': 'Wicketkeeper',
};

export const PlayersView: React.FC<PlayersViewProps> = ({
  onNavigate,
  onOpenPlayerProfile,
  onDataChanged,
}) => {
  const {profile, toggleFavouritePlayer} = useUser();
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | PlayerRole>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');

  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [playerList, teamList, matchList] = await Promise.all([
        getAllPlayers(),
        getAllTeams(),
        getAllMatches(),
      ]);
      setPlayers(playerList);
      setTeams(teamList);
      setMatches(matchList);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const teamMap = useMemo(() => {
    const map = new Map<string, Team>();
    teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);

  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return players
      .filter((p) => {
        if (roleFilter !== 'all' && p.role !== roleFilter) return false;
        if (teamFilter !== 'all' && p.teamId !== teamFilter) return false;
        if (!q) return true;
        const jerseyText = p.jerseyNumber !== undefined ? String(p.jerseyNumber) : '';
        const teamName = p.teamId ? (teamMap.get(p.teamId)?.name.toLowerCase() ?? '') : '';
        return (
          p.name.toLowerCase().includes(q) ||
          jerseyText.includes(q) ||
          teamName.includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, roleFilter, teamFilter, searchQuery, teamMap]);

  const handleSavePlayer = async (
    player: Player,
    leadership: {makeCaptain?: boolean; makeViceCaptain?: boolean},
  ) => {
    await savePlayerAndLinkTeam(player, leadership);
    await loadData();
    await onDataChanged();
  };

  const handleConfirmDeletePlayer = async () => {
    if (!playerToDelete) return;
    setIsDeleting(true);
    try {
      await deletePlayerAndUnlink(playerToDelete.id);
      setPlayerToDelete(null);
      await loadData();
      await onDataChanged();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Players"
        subtitle="Batter, bowler & wicketkeeper profiles across all teams"
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
                <span>Compare</span>
              </button>
            )}
            {teams.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setEditingPlayer(null);
                  setPlayerModalOpen(true);
                }}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Add Player</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('teams')}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/15 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white transition-colors whitespace-nowrap"
              >
                <Shield className="w-4 h-4 text-[#22C55E]" />
                <span>Create Team First</span>
              </button>
            )}
          </div>
        }
      />

      {players.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8FA397] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players by name, jersey #, or team..."
              className="w-full min-h-[44px] rounded-xl bg-[#101612] border border-white/10 pl-10 pr-4 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
            />
          </div>

          <div className="grid grid-cols-2 sm:flex gap-2.5">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | PlayerRole)}
              aria-label="Filter players by role"
              className="min-h-[44px] rounded-xl bg-[#101612] border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
            >
              <option value="all">All Roles</option>
              <option value="batsman">Batter</option>
              <option value="bowler">Bowler</option>
              <option value="all-rounder">All-rounder</option>
              <option value="wicket-keeper">Wicketkeeper</option>
            </select>

            {teams.length > 0 && (
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                aria-label="Filter players by team"
                className="min-h-[44px] rounded-xl bg-[#101612] border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                <option value="all">All Teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl bg-[#101612] border border-white/10 p-6 text-sm text-[#9CB0A4]">
          Loading players from device storage...
        </div>
      ) : players.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No players registered yet"
          description={
            teams.length === 0
              ? 'Create a team first, then add players with photos, jersey numbers, batting/bowling styles, and captain roles.'
              : 'Add your first squad player and assign their role, jersey number, and batting/bowling style.'
          }
          primaryActionLabel={teams.length === 0 ? 'Go to Teams' : 'Add First Player'}
          onPrimaryAction={() => {
            if (teams.length === 0) {
              onNavigate('teams');
            } else {
              setEditingPlayer(null);
              setPlayerModalOpen(true);
            }
          }}
          secondaryActionLabel="Back to Home"
          onSecondaryAction={() => onNavigate('home')}
        />
      ) : filteredPlayers.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching players found"
          description="Try clearing your search or changing the role and team filters."
          primaryActionLabel="Reset Filters"
          onPrimaryAction={() => {
            setSearchQuery('');
            setRoleFilter('all');
            setTeamFilter('all');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredPlayers.map((player) => {
            const team = player.teamId ? teamMap.get(player.teamId) : undefined;
            const isCaptain = team?.captainId === player.id;
            const isViceCaptain = team?.viceCaptainId === player.id;

            return (
              <article
                key={player.id}
                className="rounded-2xl bg-[#101612] border border-white/10 hover:border-[#22C55E]/35 p-4 flex items-center justify-between gap-3 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onOpenPlayerProfile?.(player.id)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#0D3B24]/80 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    {player.photoDataUrl ? (
                      <img
                        src={player.photoDataUrl}
                        alt={player.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-[#4ADE80]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <h2 className="font-display text-base font-bold text-white truncate">
                        {player.name}
                      </h2>
                      {player.jerseyNumber !== undefined && (
                        <span className="font-mono text-xs text-[#9AC2AA] tabular-nums">
                          #{player.jerseyNumber}
                        </span>
                      )}
                      {isCaptain && (
                        <span className="font-mono text-xs font-bold text-[#4ADE80]">· C</span>
                      )}
                      {isViceCaptain && (
                        <span className="font-mono text-xs font-bold text-[#9AC2AA]">· VC</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#9CB0A4] truncate">
                      {team ? `${team.shortName} · ` : ''}
                      {player.country ? `${player.country} · ` : ''}
                      {ROLE_LABELS[player.role]} ·{' '}
                      {player.battingStyle === 'right-hand' ? 'RHB' : 'LHB'}
                      {player.bowlingStyle ? ` · ${player.bowlingStyle}` : ''}
                    </p>
                  </div>

                  {onOpenPlayerProfile && (
                    <ChevronRight className="w-4 h-4 text-[#6E8276] shrink-0" />
                  )}
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => void toggleFavouritePlayer(player.id)}
                    aria-pressed={profile.favouritePlayerIds.includes(player.id)}
                    aria-label={`Favourite ${player.name}`}
                    className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors ${
                      profile.favouritePlayerIds.includes(player.id)
                        ? 'text-[#4ADE80] bg-[#0D3B24]'
                        : 'text-[#8FA397] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        profile.favouritePlayerIds.includes(player.id) ? 'fill-[#4ADE80]' : ''
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPlayer(player);
                      setPlayerModalOpen(true);
                    }}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#B8C7BE] hover:text-white hover:bg-white/5 transition-colors"
                    aria-label={`Edit ${player.name}`}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayerToDelete(player)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                    aria-label={`Remove ${player.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <PlayerFormModal
        isOpen={playerModalOpen}
        editingPlayer={editingPlayer}
        teams={teams}
        existingPlayers={players}
        onSave={handleSavePlayer}
        onClose={() => {
          setPlayerModalOpen(false);
          setEditingPlayer(null);
        }}
      />

      <ConfirmDialog
        isOpen={!!playerToDelete}
        title={`Remove ${playerToDelete?.name ?? 'Player'}?`}
        description="This will remove the player from their team roster and local device storage."
        confirmLabel="Remove Player"
        isBusy={isDeleting}
        onConfirm={() => {
          void handleConfirmDeletePlayer();
        }}
        onCancel={() => setPlayerToDelete(null)}
      />

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
