import React, {useState} from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Edit3,
  MapPin,
  Play,
  Shield,
  Trash2,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import {computeTestMatchSituation, formatOvers} from '../../engine/scoringEngine';
import type {AppView, Match, MatchStatus, Player, PlayerRole, Team} from '../../types/cricket';
import {ConfirmDialog} from '../common/ConfirmDialog';
import {ScorecardPanel} from '../scoring/ScorecardPanel';

interface MatchDetailViewProps {
  match: Match;
  teams: Team[];
  players: Player[];
  onBack: () => void;
  onEditMatch: (match: Match) => void;
  onUpdateStatus: (match: Match, nextStatus: MatchStatus) => Promise<void>;
  onUpdateMatch?: (updatedMatch: Match) => Promise<void>;
  onDeleteMatch: (matchId: string) => Promise<void>;
  onOpenLiveScoring: () => void;
  onNavigate: (view: AppView) => void;
  onOpenPlayerProfile?: (playerId: string) => void;
}

const STATUS_OPTIONS: Array<{value: MatchStatus; label: string}> = [
  {value: 'upcoming', label: 'Upcoming'},
  {value: 'live', label: 'Live'},
  {value: 'completed', label: 'Completed'},
  {value: 'abandoned', label: 'Abandoned'},
];

const ROLE_LABELS: Record<PlayerRole, string> = {
  batsman: 'Batter',
  bowler: 'Bowler',
  'all-rounder': 'All-rounder',
  'wicket-keeper': 'Wicketkeeper',
};

export const MatchDetailView: React.FC<MatchDetailViewProps> = ({
  match,
  teams,
  players,
  onBack,
  onEditMatch,
  onUpdateStatus,
  onUpdateMatch,
  onDeleteMatch,
  onOpenLiveScoring,
  onOpenPlayerProfile,
}) => {
  const [activeSquadTab, setActiveSquadTab] = useState<'teamA' | 'teamB'>('teamA');
  const [detailSectionTab, setDetailSectionTab] = useState<'squads' | 'scorecard'>(
    match.innings.length > 0 ? 'scorecard' : 'squads',
  );
  const [scorecardInningsIndex, setScorecardInningsIndex] = useState(
    Math.max(0, match.innings.length - 1),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const teamA = teams.find((t) => t.id === match.teamAId);
  const teamB = teams.find((t) => t.id === match.teamBId);

  const playerMap = new Map<string, Player>();
  players.forEach((p) => playerMap.set(p.id, p));

  const teamAXI = (match.teamAPlayingXI ?? [])
    .map((id) => playerMap.get(id))
    .filter((p): p is Player => Boolean(p));

  const teamBXI = (match.teamBPlayingXI ?? [])
    .map((id) => playerMap.get(id))
    .filter((p): p is Player => Boolean(p));

  const tossWinnerName =
    match.tossWinnerId === match.teamAId
      ? match.teamAName
      : match.tossWinnerId === match.teamBId
        ? match.teamBName
        : null;

  const formattedDate = match.matchDate
    ? new Date(`${match.matchDate}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : new Date(match.createdAt).toLocaleDateString();

  const handleStatusChange = async (nextStatus: MatchStatus) => {
    if (nextStatus === match.status) return;
    setIsBusy(true);
    try {
      await onUpdateStatus(match, nextStatus);
      setStatusFeedback(`Match status updated to ${nextStatus}.`);
      setTimeout(() => setStatusFeedback(null), 3000);
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsBusy(true);
    try {
      await onDeleteMatch(match.id);
      setConfirmDelete(false);
    } finally {
      setIsBusy(false);
    }
  };

  const renderSquadList = (
    squad: Player[],
    captainId?: string,
    wicketkeeperId?: string,
    teamLabel?: string,
  ) => {
    if (squad.length === 0) {
      return (
        <div className="rounded-xl bg-[#0B100D] border border-white/10 p-4 text-sm text-[#9CB0A4]">
          No Playing XI players recorded for {teamLabel}.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {squad.map((player, index) => {
          const isCaptain = captainId === player.id;
          const isWK = wicketkeeperId === player.id;
          return (
            <button
              key={player.id}
              type="button"
              disabled={!onOpenPlayerProfile}
              onClick={() => onOpenPlayerProfile?.(player.id)}
              className="w-full text-left rounded-xl bg-[#0B100D] hover:bg-[#131C17] disabled:hover:bg-[#0B100D] border border-white/10 hover:border-[#22C55E]/35 p-3 flex items-center justify-between gap-3 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs text-[#6E8276] w-5 tabular-nums shrink-0">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="w-9 h-9 rounded-lg bg-[#0D3B24]/80 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                  {player.photoDataUrl ? (
                    <img
                      src={player.photoDataUrl}
                      alt={player.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-4 h-4 text-[#4ADE80]" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold text-white truncate">{player.name}</span>
                    {player.jerseyNumber !== undefined && (
                      <span className="font-mono text-xs text-[#8FA397] tabular-nums">
                        #{player.jerseyNumber}
                      </span>
                    )}
                    {isCaptain && (
                      <span className="font-mono text-xs font-bold text-[#4ADE80]">· C</span>
                    )}
                    {isWK && (
                      <span className="font-mono text-xs font-bold text-[#9AC2AA]">· WK</span>
                    )}
                  </div>
                  <p className="text-xs text-[#9CB0A4] truncate">
                    {ROLE_LABELS[player.role]} ·{' '}
                    {player.battingStyle === 'right-hand' ? 'RHB' : 'LHB'}
                  </p>
                </div>
              </div>
              {onOpenPlayerProfile && (
                <span className="text-[11px] font-medium text-[#4ADE80] shrink-0">Career →</span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

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
          <span>All Matches</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEditMatch(match)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/15 px-3.5 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-white transition-colors"
          >
            <Edit3 className="w-4 h-4 text-[#22C55E]" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 px-3.5 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-rose-300 transition-colors"
            aria-label="Delete Match"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Match Header Card */}
      <section className="rounded-2xl bg-gradient-to-br from-[#0D3B24]/75 via-[#101612] to-[#0B100D] border border-[#22C55E]/25 p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-mono font-semibold text-[#4ADE80] uppercase tracking-wide">
            {match.format === 'TEST'
              ? `TEST · Day ${match.testCurrentDay ?? 1} of ${match.testMaxDays ?? 5}`
              : `${match.format} · ${match.oversPerInnings} Overs`}
          </span>
          <span className="font-mono font-semibold capitalize text-white">
            Status: {match.status}
          </span>
        </div>

        {/* Teams Matchup Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-11 items-center gap-3 py-1">
          <div className="sm:col-span-5 flex items-center gap-3 min-w-0">
            <div
              className="w-12 h-12 rounded-xl border border-white/15 flex items-center justify-center overflow-hidden shrink-0"
              style={{backgroundColor: teamA?.primaryColor || '#0D3B24'}}
            >
              {teamA?.logoDataUrl ? (
                <img
                  src={teamA.logoDataUrl}
                  alt={match.teamAName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Shield className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-bold text-white truncate">
                {match.teamAName}
              </h1>
              <p className="font-mono text-xs text-[#9AC2AA]">
                {match.teamAShortName} · {teamAXI.length} Players
              </p>
            </div>
          </div>

          <div className="sm:col-span-1 text-left sm:text-center font-mono text-xs font-bold text-[#8FA397]">
            VS
          </div>

          <div className="sm:col-span-5 flex items-center sm:justify-end gap-3 min-w-0">
            <div className="min-w-0 sm:text-right order-2 sm:order-1">
              <div className="font-display text-lg sm:text-xl font-bold text-white truncate">
                {match.teamBName}
              </div>
              <p className="font-mono text-xs text-[#9AC2AA]">
                {match.teamBShortName} · {teamBXI.length} Players
              </p>
            </div>
            <div
              className="w-12 h-12 rounded-xl border border-white/15 flex items-center justify-center overflow-hidden shrink-0 order-1 sm:order-2"
              style={{backgroundColor: teamB?.primaryColor || '#18181B'}}
            >
              {teamB?.logoDataUrl ? (
                <img
                  src={teamB.logoDataUrl}
                  alt={match.teamBName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Shield className="w-5 h-5 text-white" />
              )}
            </div>
          </div>
        </div>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#D7E4DC] pt-3 border-t border-white/10">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>{formattedDate}</span>
          </span>
          {match.venue && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>{match.venue}</span>
            </span>
          )}
          {match.tournamentName && (
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>{match.tournamentName}</span>
            </span>
          )}
        </div>

        {/* Toss Information */}
        <div className="rounded-xl bg-[#080C0A]/80 border border-white/10 p-3.5 text-xs sm:text-sm text-[#D7E4DC]">
          {tossWinnerName && match.tossDecision ? (
            <span>
              <strong className="text-white">{tossWinnerName}</strong> won the toss and elected to{' '}
              <strong className="text-[#4ADE80]">{match.tossDecision}</strong> first.
            </span>
          ) : (
            <span className="text-[#9CB0A4]">Toss has not been decided yet.</span>
          )}
        </div>

        {/* Live Innings Score Summary */}
        {match.innings.length > 0 && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {match.innings.map((inn) => {
                const name =
                  inn.battingTeamId === match.teamAId ? match.teamAShortName : match.teamBShortName;
                return (
                  <div
                    key={inn.inningsNumber}
                    className="rounded-xl bg-[#080C0A] border border-white/10 px-3.5 py-2.5 flex items-center justify-between text-sm"
                  >
                    <span className="font-semibold text-[#C8D6CE]">
                      Inn {inn.inningsNumber} · {name}
                      {inn.followOnEnforced ? ' (f/o)' : ''}
                    </span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {inn.runs}/{inn.wickets}
                      {inn.declared ? 'd' : ''} ({formatOvers(inn.legalBalls)} ov)
                    </span>
                  </div>
                );
              })}
            </div>

            {match.resultSummary ? (
              <div className="rounded-xl bg-[#16A34A]/20 border border-[#22C55E]/40 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#4ADE80]">
                {match.resultSummary}
              </div>
            ) : match.format === 'TEST' ? (
              <div className="rounded-xl bg-[#080C0A] border border-white/10 px-3.5 py-2 text-xs font-medium text-[#9AC2AA]">
                {computeTestMatchSituation(match).leadDeficitText}
              </div>
            ) : null}
          </div>
        )}

        {/* Primary Live Scoring CTA */}
        {match.status !== 'abandoned' && (
          <div className="pt-1">
            <button
              type="button"
              onClick={onOpenLiveScoring}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] active:scale-[0.98] px-6 py-3 min-h-[48px] text-sm sm:text-base font-semibold text-white transition-all whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                {match.status === 'completed'
                  ? 'View Full Scoring Log'
                  : match.innings.length > 0
                    ? 'Resume Live Scoring'
                    : 'Start Live Scoring'}
              </span>
            </button>
          </div>
        )}

        {/* Interactive Status Switcher */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#9AC2AA]">Update Match Status</span>
            {statusFeedback && (
              <span className="inline-flex items-center gap-1 text-xs text-[#4ADE80]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{statusFeedback}</span>
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STATUS_OPTIONS.map((opt) => {
              const active = match.status === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    void handleStatusChange(opt.value);
                  }}
                  className={`min-h-[44px] rounded-xl px-3 text-xs sm:text-sm font-semibold border transition-colors ${
                    active
                      ? 'bg-[#16A34A] border-[#22C55E] text-white'
                      : 'bg-[#0B100D] border-white/10 text-[#9CB0A4] hover:text-white hover:border-white/25'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {onUpdateMatch && (teamAXI.length > 0 || teamBXI.length > 0) && (
            <label className="block space-y-1.5 pt-2">
              <span className="text-xs font-medium text-[#9AC2AA]">
                Player of the Match (Optional — updates career POTM awards)
              </span>
              <select
                value={match.playerOfTheMatchId ?? ''}
                disabled={isBusy}
                onChange={(e) => {
                  const nextPotm = e.target.value || undefined;
                  setIsBusy(true);
                  void onUpdateMatch({
                    ...match,
                    playerOfTheMatchId: nextPotm,
                    updatedAt: new Date().toISOString(),
                  }).finally(() => setIsBusy(false));
                }}
                className="w-full min-h-[44px] rounded-xl bg-[#0B100D] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                <option value="">Not Assigned</option>
                {teamAXI.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({match.teamAShortName})
                  </option>
                ))}
                {teamBXI.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({match.teamBShortName})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>

      {/* Section Switcher: Scorecard vs Playing XI */}
      {match.innings.length > 0 && (
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#101612] border border-white/10 w-full sm:w-fit">
          <button
            type="button"
            onClick={() => setDetailSectionTab('scorecard')}
            className={`flex-1 sm:flex-none px-4 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
              detailSectionTab === 'scorecard'
                ? 'bg-[#0D3B24] text-white border border-[#22C55E]/30'
                : 'text-[#9CB0A4] hover:text-white'
            }`}
          >
            Scorecard
          </button>
          <button
            type="button"
            onClick={() => setDetailSectionTab('squads')}
            className={`flex-1 sm:flex-none px-4 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
              detailSectionTab === 'squads'
                ? 'bg-[#0D3B24] text-white border border-[#22C55E]/30'
                : 'text-[#9CB0A4] hover:text-white'
            }`}
          >
            Playing XI
          </button>
        </div>
      )}

      {detailSectionTab === 'scorecard' && match.innings.length > 0 ? (
        <ScorecardPanel
          match={match}
          innings={
            match.innings[Math.min(scorecardInningsIndex, match.innings.length - 1)] ??
            match.innings[0]
          }
          playerMap={playerMap}
          activeInningsTab={Math.min(scorecardInningsIndex, match.innings.length - 1)}
          onSelectInningsTab={setScorecardInningsIndex}
        />
      ) : (
        /* Playing XI Comparison */
        <section className="rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#22C55E]" />
            <h2 className="font-display text-lg font-bold text-white">Playing XI Squads</h2>
          </div>

          <div className="flex lg:hidden items-center gap-1 p-1 rounded-xl bg-[#080C0A] border border-white/10">
            <button
              type="button"
              onClick={() => setActiveSquadTab('teamA')}
              className={`flex-1 px-3 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors truncate ${
                activeSquadTab === 'teamA' ? 'bg-[#0D3B24] text-white' : 'text-[#9CB0A4]'
              }`}
            >
              {match.teamAShortName} ({teamAXI.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSquadTab('teamB')}
              className={`flex-1 px-3 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors truncate ${
                activeSquadTab === 'teamB' ? 'bg-[#0D3B24] text-white' : 'text-[#9CB0A4]'
              }`}
            >
              {match.teamBShortName} ({teamBXI.length})
            </button>
          </div>
        </div>

        {/* Mobile Tabbed View */}
        <div className="lg:hidden">
          {activeSquadTab === 'teamA'
            ? renderSquadList(
                teamAXI,
                match.teamACaptainId,
                match.teamAWicketkeeperId,
                match.teamAName,
              )
            : renderSquadList(
                teamBXI,
                match.teamBCaptainId,
                match.teamBWicketkeeperId,
                match.teamBName,
              )}
        </div>

        {/* Desktop Split View */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-display text-base font-bold text-white">
              {match.teamAName} ({teamAXI.length})
            </h3>
            {renderSquadList(
              teamAXI,
              match.teamACaptainId,
              match.teamAWicketkeeperId,
              match.teamAName,
            )}
          </div>
          <div className="space-y-3">
            <h3 className="font-display text-base font-bold text-white">
              {match.teamBName} ({teamBXI.length})
            </h3>
            {renderSquadList(
              teamBXI,
              match.teamBCaptainId,
              match.teamBWicketkeeperId,
              match.teamBName,
            )}
          </div>
        </div>
      </section>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete this match?"
        description={`This will permanently remove "${match.title}" from local device storage.`}
        confirmLabel="Delete Match"
        isBusy={isBusy}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};
