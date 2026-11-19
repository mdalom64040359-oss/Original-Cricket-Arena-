import React, {useEffect, useMemo, useState} from 'react';
import {
  ArrowLeft,
  Calendar,
  Edit3,
  MapPin,
  Plus,
  Radio,
  Search,
  Shield,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import {getMatchesByTeam} from '../../db/database';
import type {AppView, Match, Player, PlayerRole, Team} from '../../types/cricket';
import {ConfirmDialog} from '../common/ConfirmDialog';
import {EmptyState} from '../common/EmptyState';

interface TeamDetailViewProps {
  team: Team;
  allTeams: Team[];
  players: Player[];
  onBack: () => void;
  onEditTeam: (team: Team) => void;
  onDeleteTeam: (teamId: string) => Promise<void>;
  onSaveTeamLeadership: (team: Team) => Promise<void>;
  onSavePlayer: (
    player: Player,
    leadership: {makeCaptain?: boolean; makeViceCaptain?: boolean},
  ) => Promise<void>;
  onDeletePlayer: (playerId: string) => Promise<void>;
  onNavigate: (view: AppView) => void;
  onOpenMatch?: (matchId: string) => void;
  onOpenPlayerProfile?: (playerId: string) => void;
  onOpenPlayerModal: (player: Player | null) => void;
}

const ROLE_LABELS: Record<PlayerRole, string> = {
  batsman: 'Batter',
  bowler: 'Bowler',
  'all-rounder': 'All-rounder',
  'wicket-keeper': 'Wicketkeeper',
};

export const TeamDetailView: React.FC<TeamDetailViewProps> = ({
  team,
  players,
  onBack,
  onEditTeam,
  onDeleteTeam,
  onSaveTeamLeadership,
  onDeletePlayer,
  onNavigate,
  onOpenMatch,
  onOpenPlayerProfile,
  onOpenPlayerModal,
}) => {
  const [activeTab, setActiveTab] = useState<'players' | 'matches'>('players');
  const [playerQuery, setPlayerQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | PlayerRole>('all');
  const [teamMatches, setTeamMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingMatches(true);
    getMatchesByTeam(team.id)
      .then((records) => {
        if (active) {
          setTeamMatches(records);
          setLoadingMatches(false);
        }
      })
      .catch(() => {
        if (active) setLoadingMatches(false);
      });
    return () => {
      active = false;
    };
  }, [team.id]);

  const filteredPlayers = useMemo(() => {
    const q = playerQuery.trim().toLowerCase();
    return players
      .filter((p) => {
        if (roleFilter !== 'all' && p.role !== roleFilter) return false;
        if (!q) return true;
        const jerseyText = p.jerseyNumber !== undefined ? String(p.jerseyNumber) : '';
        return p.name.toLowerCase().includes(q) || jerseyText.includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, playerQuery, roleFilter]);

  const captain = players.find((p) => p.id === team.captainId);
  const viceCaptain = players.find((p) => p.id === team.viceCaptainId);

  const handleCaptainChange = async (newCaptainId: string) => {
    await onSaveTeamLeadership({
      ...team,
      captainId: newCaptainId || undefined,
      viceCaptainId: newCaptainId && team.viceCaptainId === newCaptainId ? undefined : team.viceCaptainId,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleViceCaptainChange = async (newViceId: string) => {
    await onSaveTeamLeadership({
      ...team,
      viceCaptainId: newViceId || undefined,
      captainId: newViceId && team.captainId === newViceId ? undefined : team.captainId,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleConfirmDeleteTeam = async () => {
    setIsDeleting(true);
    try {
      await onDeleteTeam(team.id);
      setConfirmDeleteTeam(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeletePlayer = async () => {
    if (!playerToDelete) return;
    setIsDeleting(true);
    try {
      await onDeletePlayer(playerToDelete.id);
      setPlayerToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const createdDateFormatted = new Date(team.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="space-y-5">
      {/* Top Action Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/10 px-3.5 py-2 min-h-[44px] text-sm font-medium text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Teams</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEditTeam(team)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/15 px-3.5 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-white transition-colors"
          >
            <Edit3 className="w-4 h-4 text-[#22C55E]" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteTeam(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 px-3.5 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-rose-300 transition-colors"
            aria-label={`Delete ${team.name}`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Team Profile Banner */}
      <section className="rounded-2xl bg-gradient-to-br from-[#0D3B24]/70 via-[#101612] to-[#0B100D] border border-white/10 p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border border-white/15 flex items-center justify-center overflow-hidden shrink-0"
            style={{backgroundColor: team.primaryColor || '#0D3B24'}}
          >
            {team.logoDataUrl ? (
              <img
                src={team.logoDataUrl}
                alt={`${team.name} logo`}
                className="w-full h-full object-cover"
              />
            ) : (
              <Shield className="w-8 h-8 text-white" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h1 className="font-display text-2xl font-bold text-white tracking-tight">
                {team.name}
              </h1>
              <span className="font-mono text-xs font-semibold text-[#4ADE80]">
                {team.shortName}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#B8C7BE]">
              {(team.location || team.city) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span>{team.location ?? team.city}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#22C55E]" />
                <span>Created {createdDateFormatted}</span>
              </span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Users className="w-3.5 h-3.5 text-[#22C55E]" />
                <span>{players.length} Players</span>
              </span>
            </div>

            {team.description && (
              <p className="text-sm text-[#D7E4DC] leading-relaxed pt-1">{team.description}</p>
            )}
          </div>
        </div>

        {/* Captain & Vice-Captain Controls */}
        {players.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/10">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#9AC2AA]">Captain (C)</span>
              <select
                value={team.captainId ?? ''}
                onChange={(e) => {
                  void handleCaptainChange(e.target.value);
                }}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                <option value="">Not assigned</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.jerseyNumber !== undefined ? ` (#${p.jerseyNumber})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#9AC2AA]">Vice-Captain (VC)</span>
              <select
                value={team.viceCaptainId ?? ''}
                onChange={(e) => {
                  void handleViceCaptainChange(e.target.value);
                }}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                <option value="">Not assigned</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.jerseyNumber !== undefined ? ` (#${p.jerseyNumber})` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </section>

      {/* Section Tabs: Squad Players vs Match History */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          className="flex items-center gap-1 p-1 rounded-xl bg-[#101612] border border-white/10 w-full sm:w-fit"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'players'}
            onClick={() => setActiveTab('players')}
            className={`flex-1 sm:flex-none px-4 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'players'
                ? 'bg-[#0D3B24] text-white border border-[#22C55E]/30'
                : 'text-[#9CB0A4] hover:text-white'
            }`}
          >
            Squad ({players.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'matches'}
            onClick={() => setActiveTab('matches')}
            className={`flex-1 sm:flex-none px-4 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'matches'
                ? 'bg-[#0D3B24] text-white border border-[#22C55E]/30'
                : 'text-[#9CB0A4] hover:text-white'
            }`}
          >
            Match History ({teamMatches.length})
          </button>
        </div>

        {activeTab === 'players' && (
          <button
            type="button"
            onClick={() => onOpenPlayerModal(null)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Player</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'players' ? (
        <div className="space-y-4">
          {players.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#8FA397] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={playerQuery}
                  onChange={(e) => setPlayerQuery(e.target.value)}
                  placeholder="Search squad by player name or jersey #..."
                  className="w-full min-h-[44px] rounded-xl bg-[#101612] border border-white/10 pl-10 pr-4 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'all' | PlayerRole)}
                aria-label="Filter squad by role"
                className="min-h-[44px] rounded-xl bg-[#101612] border border-white/10 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                <option value="all">All Roles</option>
                <option value="batsman">Batter</option>
                <option value="bowler">Bowler</option>
                <option value="all-rounder">All-rounder</option>
                <option value="wicket-keeper">Wicketkeeper</option>
              </select>
            </div>
          )}

          {players.length === 0 ? (
            <EmptyState
              icon={Users}
              title={`No players in ${team.name} yet`}
              description="Add squad members with their jersey numbers, batting/bowling styles, and select your Captain and Vice-Captain."
              primaryActionLabel="Add First Player"
              onPrimaryAction={() => onOpenPlayerModal(null)}
            />
          ) : filteredPlayers.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching squad players"
              description="Try clearing your search or selecting All Roles."
              primaryActionLabel="Reset Filters"
              onPrimaryAction={() => {
                setPlayerQuery('');
                setRoleFilter('all');
              }}
            />
          ) : (
            <div className="space-y-2.5">
              {filteredPlayers.map((player) => {
                const isCaptain = captain?.id === player.id;
                const isViceCaptain = viceCaptain?.id === player.id;
                return (
                  <article
                    key={player.id}
                    className="rounded-2xl bg-[#101612] border border-white/10 p-3.5 sm:p-4 flex items-center justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenPlayerProfile?.(player.id)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-xl hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
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

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <h3 className="font-display text-sm sm:text-base font-bold text-white truncate">
                            {player.name}
                          </h3>
                          {player.jerseyNumber !== undefined && (
                            <span className="font-mono text-xs text-[#9AC2AA] tabular-nums">
                              #{player.jerseyNumber}
                            </span>
                          )}
                          {isCaptain && (
                            <span className="font-mono text-xs font-bold text-[#4ADE80]">
                              · Captain
                            </span>
                          )}
                          {isViceCaptain && (
                            <span className="font-mono text-xs font-bold text-[#9AC2AA]">
                              · Vice-Captain
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-[#9CB0A4] truncate">
                          {ROLE_LABELS[player.role]} ·{' '}
                          {player.battingStyle === 'right-hand' ? 'RHB' : 'LHB'}
                          {player.bowlingStyle ? ` · ${player.bowlingStyle}` : ''}
                          {onOpenPlayerProfile ? ' · Tap for Career Profile' : ''}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenPlayerModal(player)}
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
        </div>
      ) : loadingMatches ? (
        <div className="rounded-2xl bg-[#101612] border border-white/10 p-6 text-sm text-[#9CB0A4]">
          Loading team match history...
        </div>
      ) : teamMatches.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No matches played yet"
          description={`Matches scored with ${team.name} will appear here automatically with full results and scorecards.`}
          primaryActionLabel="Create Match"
          onPrimaryAction={() => onNavigate('create-match')}
        />
      ) : (
        <div className="space-y-3">
          {teamMatches.map((match) => (
            <button
              key={match.id}
              type="button"
              onClick={() => (onOpenMatch ? onOpenMatch(match.id) : onNavigate('matches'))}
              className="w-full text-left rounded-2xl bg-[#101612] hover:bg-[#141D17] border border-white/10 hover:border-[#22C55E]/40 p-4 space-y-1.5 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono text-[#4ADE80]">
                  {match.format} · {match.oversPerInnings} Overs
                </span>
                <span className="capitalize text-[#9CB0A4]">{match.status}</span>
              </div>
              <h3 className="font-display text-base font-bold text-white">{match.title}</h3>
              <p className="text-xs text-[#D7E4DC]">
                {match.teamAName} vs {match.teamBName}
              </p>
              {match.resultSummary && (
                <p className="text-xs text-[#9AC2AA] pt-1">{match.resultSummary}</p>
              )}
            </button>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDeleteTeam}
        title={`Delete ${team.name}?`}
        description={`This will permanently remove ${team.name} and its ${players.length} squad player${players.length === 1 ? '' : 's'} from local device storage.`}
        confirmLabel="Delete Team"
        isBusy={isDeleting}
        onConfirm={() => {
          void handleConfirmDeleteTeam();
        }}
        onCancel={() => setConfirmDeleteTeam(false)}
      />

      <ConfirmDialog
        isOpen={!!playerToDelete}
        title={`Remove ${playerToDelete?.name ?? 'Player'}?`}
        description="This will remove the player from this squad and local storage."
        confirmLabel="Remove Player"
        isBusy={isDeleting}
        onConfirm={() => {
          void handleConfirmDeletePlayer();
        }}
        onCancel={() => setPlayerToDelete(null)}
      />
    </div>
  );
};
