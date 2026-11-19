import React, {useEffect, useMemo, useState} from 'react';
import {Check, CheckCircle2, Shield, Sparkles, Users} from 'lucide-react';
import {
  getAllPlayers,
  getAllTeams,
  getAllTournaments,
  saveMatch,
} from '../../db/database';
import type {
  AppView,
  DashboardSummary,
  Match,
  MatchFormat,
  MatchStatus,
  Player,
  Team,
  TossDecision,
  Tournament,
} from '../../types/cricket';
import {
  getFollowOnThreshold,
  validateFormatSettings,
} from '../../engine/scoringEngine';
import {generateId} from '../../utils/imageUtils';
import {EmptyState} from '../common/EmptyState';
import {PageHeader} from '../common/PageHeader';

interface CreateMatchViewProps {
  summary: DashboardSummary;
  editingMatch?: Match | null;
  onNavigate: (view: AppView) => void;
  onMatchSaved: (savedMatch: Match) => Promise<void>;
  onCancelEdit?: () => void;
}

const FORMAT_PRESETS: Array<{format: MatchFormat; label: string; defaultOvers: number}> = [
  {format: 'T10', label: 'T10', defaultOvers: 10},
  {format: 'T20', label: 'T20', defaultOvers: 20},
  {format: 'ODI', label: 'ODI', defaultOvers: 50},
  {format: 'TEST', label: 'Test', defaultOvers: 90},
  {format: 'CUSTOM', label: 'Custom', defaultOvers: 15},
];

const STATUS_OPTIONS: Array<{value: MatchStatus; label: string}> = [
  {value: 'upcoming', label: 'Upcoming'},
  {value: 'live', label: 'Live'},
  {value: 'completed', label: 'Completed'},
  {value: 'abandoned', label: 'Abandoned'},
];

export const CreateMatchView: React.FC<CreateMatchViewProps> = ({
  editingMatch,
  onNavigate,
  onMatchSaved,
  onCancelEdit,
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [format, setFormat] = useState<MatchFormat>('T20');
  const [customOvers, setCustomOvers] = useState('15');
  const [testMaxDays, setTestMaxDays] = useState<number>(5);
  const [testDailyOvers, setTestDailyOvers] = useState('90');
  const [matchDate, setMatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [venue, setVenue] = useState('');
  const [tournamentId, setTournamentId] = useState('');
  const [competitionCategory, setCompetitionCategory] = useState<
    '' | 'international' | 't20-league' | 'domestic'
  >('');
  const [status, setStatus] = useState<MatchStatus>('upcoming');

  const [teamAXI, setTeamAXI] = useState<string[]>([]);
  const [teamBXI, setTeamBXI] = useState<string[]>([]);
  const [teamACaptainId, setTeamACaptainId] = useState('');
  const [teamBCaptainId, setTeamBCaptainId] = useState('');
  const [teamAWKId, setTeamAWKId] = useState('');
  const [teamBWKId, setTeamBWKId] = useState('');

  const [tossWinnerId, setTossWinnerId] = useState('');
  const [tossDecision, setTossDecision] = useState<TossDecision>('bat');

  const [activeTeamTab, setActiveTeamTab] = useState<'teamA' | 'teamB'>('teamA');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getAllTeams(), getAllPlayers(), getAllTournaments()])
      .then(([teamList, playerList, tournamentList]) => {
        if (!active) return;
        const sortedTeams = [...teamList].sort((a, b) => a.name.localeCompare(b.name));
        setTeams(sortedTeams);
        setPlayers(playerList);
        setTournaments(tournamentList);

        if (editingMatch) {
          setTeamAId(editingMatch.teamAId);
          setTeamBId(editingMatch.teamBId);
          setFormat(editingMatch.format);
          setCustomOvers(
            editingMatch.format === 'CUSTOM' ? String(editingMatch.oversPerInnings) : '15',
          );
          setTestMaxDays(editingMatch.testMaxDays ?? 5);
          setTestDailyOvers(
            editingMatch.format === 'TEST' ? String(editingMatch.oversPerInnings) : '90',
          );
          setMatchDate(editingMatch.matchDate || new Date().toISOString().slice(0, 10));
          setVenue(editingMatch.venue ?? '');
          setTournamentId(editingMatch.tournamentId ?? '');
          setCompetitionCategory(editingMatch.competitionCategory ?? '');
          setStatus(editingMatch.status);
          setTeamAXI(editingMatch.teamAPlayingXI ?? []);
          setTeamBXI(editingMatch.teamBPlayingXI ?? []);
          setTeamACaptainId(editingMatch.teamACaptainId ?? '');
          setTeamBCaptainId(editingMatch.teamBCaptainId ?? '');
          setTeamAWKId(editingMatch.teamAWicketkeeperId ?? '');
          setTeamBWKId(editingMatch.teamBWicketkeeperId ?? '');
          setTossWinnerId(editingMatch.tossWinnerId ?? '');
          setTossDecision(editingMatch.tossDecision ?? 'bat');
        } else if (sortedTeams.length >= 2) {
          const tA = sortedTeams[0];
          const tB = sortedTeams[1];
          setTeamAId(tA.id);
          setTeamBId(tB.id);
          setVenue(tA.location ?? tA.city ?? '');
        } else if (sortedTeams.length === 1) {
          setTeamAId(sortedTeams[0].id);
        }

        setIsLoading(false);
      })
      .catch(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [editingMatch]);

  const teamA = useMemo(() => teams.find((t) => t.id === teamAId), [teams, teamAId]);
  const teamB = useMemo(() => teams.find((t) => t.id === teamBId), [teams, teamBId]);

  const teamASquad = useMemo(
    () => players.filter((p) => p.teamId === teamAId).sort((a, b) => a.name.localeCompare(b.name)),
    [players, teamAId],
  );
  const teamBSquad = useMemo(
    () => players.filter((p) => p.teamId === teamBId).sort((a, b) => a.name.localeCompare(b.name)),
    [players, teamBId],
  );

  // Auto-initialize Playing XI defaults when team selection changes for new matches
  const applyDefaultSelection = (
    team: Team | undefined,
    squad: Player[],
    setXI: React.Dispatch<React.SetStateAction<string[]>>,
    setCap: React.Dispatch<React.SetStateAction<string>>,
    setWK: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    const initialIds = squad.slice(0, 11).map((p) => p.id);
    setXI(initialIds);
    const defaultCap =
      team?.captainId && initialIds.includes(team.captainId)
        ? team.captainId
        : (initialIds[0] ?? '');
    const defaultWK =
      squad.find((p) => p.role === 'wicket-keeper' && initialIds.includes(p.id))?.id ??
      initialIds[0] ??
      '';
    setCap(defaultCap);
    setWK(defaultWK);
  };

  useEffect(() => {
    if (editingMatch || isLoading) return;
    applyDefaultSelection(teamA, teamASquad, setTeamAXI, setTeamACaptainId, setTeamAWKId);
  }, [teamAId, teamASquad.length, editingMatch, isLoading]);

  useEffect(() => {
    if (editingMatch || isLoading) return;
    applyDefaultSelection(teamB, teamBSquad, setTeamBXI, setTeamBCaptainId, setTeamBWKId);
  }, [teamBId, teamBSquad.length, editingMatch, isLoading]);

  const handleTeamAChange = (nextId: string) => {
    setTeamAId(nextId);
    if (tossWinnerId === teamAId) setTossWinnerId('');
    const picked = teams.find((t) => t.id === nextId);
    if (!venue && picked) {
      setVenue(picked.location ?? picked.city ?? '');
    }
  };

  const handleTeamBChange = (nextId: string) => {
    setTeamBId(nextId);
    if (tossWinnerId === teamBId) setTossWinnerId('');
  };

  const togglePlayerInXI = (
    playerId: string,
    currentXI: string[],
    setXI: React.Dispatch<React.SetStateAction<string[]>>,
    captainId: string,
    setCaptainId: React.Dispatch<React.SetStateAction<string>>,
    wkId: string,
    setWKId: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    setError(null);
    if (currentXI.includes(playerId)) {
      const next = currentXI.filter((id) => id !== playerId);
      setXI(next);
      if (captainId === playerId) setCaptainId(next[0] ?? '');
      if (wkId === playerId) setWKId(next[0] ?? '');
      return;
    }

    if (currentXI.length >= 11) {
      setError('A Playing XI can contain at most 11 players.');
      return;
    }

    const next = [...currentXI, playerId];
    setXI(next);
    if (!captainId) setCaptainId(playerId);
    if (!wkId) setWKId(playerId);
  };

  const getEffectiveOvers = (): number => {
    if (format === 'CUSTOM') {
      return Number(customOvers);
    }
    if (format === 'TEST') {
      return Number(testDailyOvers);
    }
    const preset = FORMAT_PRESETS.find((p) => p.format === format);
    return preset?.defaultOvers ?? 20;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!teamA || !teamB) {
      setError('Please select both Team A and Team B.');
      return;
    }

    if (teamA.id === teamB.id) {
      setError('A team cannot play against itself. Please choose two different teams.');
      return;
    }

    const overs = getEffectiveOvers();
    const formatValidationError = validateFormatSettings(format, overs, testMaxDays);
    if (formatValidationError) {
      setError(formatValidationError);
      return;
    }

    if (!matchDate) {
      setError('Please select a match date.');
      return;
    }

    if (teamAXI.length < 2 || teamAXI.length > 11) {
      setError(`${teamA.name} must have between 2 and 11 players in the Playing XI.`);
      setActiveTeamTab('teamA');
      return;
    }

    if (teamBXI.length < 2 || teamBXI.length > 11) {
      setError(`${teamB.name} must have between 2 and 11 players in the Playing XI.`);
      setActiveTeamTab('teamB');
      return;
    }

    if (!teamACaptainId || !teamAXI.includes(teamACaptainId)) {
      setError(`Select a Captain from ${teamA.name}'s Playing XI.`);
      setActiveTeamTab('teamA');
      return;
    }

    if (!teamAWKId || !teamAXI.includes(teamAWKId)) {
      setError(`Select a Wicketkeeper from ${teamA.name}'s Playing XI.`);
      setActiveTeamTab('teamA');
      return;
    }

    if (!teamBCaptainId || !teamBXI.includes(teamBCaptainId)) {
      setError(`Select a Captain from ${teamB.name}'s Playing XI.`);
      setActiveTeamTab('teamB');
      return;
    }

    if (!teamBWKId || !teamBXI.includes(teamBWKId)) {
      setError(`Select a Wicketkeeper from ${teamB.name}'s Playing XI.`);
      setActiveTeamTab('teamB');
      return;
    }

    if ((status === 'live' || status === 'completed') && !tossWinnerId) {
      setError('Please select the Toss Winner for a Live or Completed match.');
      return;
    }

    if (tossWinnerId && tossWinnerId !== teamA.id && tossWinnerId !== teamB.id) {
      setError('Toss winner must be one of the two competing teams.');
      return;
    }

    const selectedTournament = tournaments.find((t) => t.id === tournamentId);
    const now = new Date().toISOString();

    const matchPayload: Match = {
      id: editingMatch?.id ?? generateId('match'),
      title: `${teamA.name} vs ${teamB.name}`,
      format,
      oversPerInnings: overs,
      testCurrentDay: format === 'TEST' ? (editingMatch?.testCurrentDay ?? 1) : undefined,
      testMaxDays: format === 'TEST' ? testMaxDays : undefined,
      matchDate,
      teamAId: teamA.id,
      teamBId: teamB.id,
      teamAName: teamA.name,
      teamBName: teamB.name,
      teamAShortName: teamA.shortName,
      teamBShortName: teamB.shortName,
      teamAPlayingXI: teamAXI,
      teamBPlayingXI: teamBXI,
      teamACaptainId,
      teamBCaptainId,
      teamAWicketkeeperId: teamAWKId,
      teamBWicketkeeperId: teamBWKId,
      tossWinnerId: tossWinnerId || undefined,
      tossDecision: tossWinnerId ? tossDecision : undefined,
      venue: venue.trim() || undefined,
      tournamentId: selectedTournament?.id,
      tournamentName: selectedTournament?.name,
      competitionCategory: competitionCategory || undefined,
      playerOfTheMatchId: editingMatch?.playerOfTheMatchId,
      status,
      currentInningsIndex: editingMatch?.currentInningsIndex ?? 0,
      innings: editingMatch?.innings ?? [],
      resultSummary: editingMatch?.resultSummary,
      createdAt: editingMatch?.createdAt ?? now,
      updatedAt: now,
      sync: editingMatch?.sync ?? {syncStatus: 'local-only', version: 1},
    };

    setIsSaving(true);
    try {
      await saveMatch(matchPayload);
      await onMatchSaved(matchPayload);
    } catch {
      setError('Failed to save match in IndexedDB. Please try again.');
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Create Match" onBackHome={() => onNavigate('home')} />
        <div className="rounded-2xl bg-[#101612] border border-white/10 p-6 text-sm text-[#9CB0A4]">
          Loading teams and tournaments from local storage...
        </div>
      </div>
    );
  }

  if (teams.length < 2) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Create Match"
          subtitle="Select two teams to start configuring a match"
          onBackHome={() => onNavigate('home')}
        />
        <EmptyState
          icon={Shield}
          title="At least 2 teams are required"
          description={`You currently have ${teams.length} team${teams.length === 1 ? '' : 's'} saved. Create at least two teams with squad players before creating a match.`}
          primaryActionLabel="Go to Teams"
          onPrimaryAction={() => onNavigate('teams')}
          secondaryActionLabel="View Matches"
          onSecondaryAction={() => onNavigate('matches')}
        />
      </div>
    );
  }

  const renderPlayingXISection = (
    team: Team | undefined,
    squad: Player[],
    selectedXI: string[],
    setXI: React.Dispatch<React.SetStateAction<string[]>>,
    captainId: string,
    setCaptainId: React.Dispatch<React.SetStateAction<string>>,
    wkId: string,
    setWKId: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    if (!team) return null;
    const selectedPlayers = squad.filter((p) => selectedXI.includes(p.id));

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-bold text-white">{team.name} Playing XI</h3>
            <p className="text-xs text-[#9CB0A4] font-mono tabular-nums">
              Selected: {selectedXI.length} / 11 · Squad size: {squad.length}
            </p>
          </div>

          {squad.length > 0 && (
            <button
              type="button"
              onClick={() => applyDefaultSelection(team, squad, setXI, setCaptainId, setWKId)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 px-3 py-2 min-h-[40px] text-xs font-semibold text-white transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Auto-Select XI</span>
            </button>
          )}
        </div>

        {squad.length < 2 ? (
          <div className="rounded-xl bg-[#0B100D] border border-amber-500/30 p-4 space-y-2.5">
            <p className="text-sm font-medium text-amber-200">
              {team.name} has {squad.length} player{squad.length === 1 ? '' : 's'} registered.
            </p>
            <p className="text-xs text-[#9CB0A4]">
              Add at least 2 players to {team.name} in Team Management before saving this match.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('teams')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D3B24] hover:bg-[#145233] px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Manage {team.shortName} Squad</span>
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {squad.map((player) => {
                const checked = selectedXI.includes(player.id);
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() =>
                      togglePlayerInXI(
                        player.id,
                        selectedXI,
                        setXI,
                        captainId,
                        setCaptainId,
                        wkId,
                        setWKId,
                      )
                    }
                    className={`flex items-center justify-between gap-2.5 rounded-xl p-3 min-h-[48px] border text-left transition-colors ${
                      checked
                        ? 'bg-[#0D3B24]/80 border-[#22C55E]/60 text-white'
                        : 'bg-[#080C0A] border-white/10 text-[#9CB0A4] hover:border-white/25'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {player.name}
                        {player.jerseyNumber !== undefined ? ` #${player.jerseyNumber}` : ''}
                      </div>
                      <div className="text-[11px] text-[#8FA397] capitalize">
                        {player.role.replace('-', ' ')}
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                        checked
                          ? 'bg-[#16A34A] border-[#22C55E] text-white'
                          : 'border-white/25 bg-transparent'
                      }`}
                    >
                      {checked && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedPlayers.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-[#9AC2AA]">
                    Captain <span className="text-rose-400">*</span>
                  </span>
                  <select
                    value={captainId}
                    onChange={(e) => setCaptainId(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
                  >
                    <option value="">Select Captain</option>
                    {selectedPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-[#9AC2AA]">
                    Wicketkeeper <span className="text-rose-400">*</span>
                  </span>
                  <select
                    value={wkId}
                    onChange={(e) => setWKId(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
                  >
                    <option value="">Select Wicketkeeper</option>
                    {selectedPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={editingMatch ? 'Edit Match' : 'Create Match'}
        subtitle="Configure teams, overs, Playing XI, captains, wicketkeepers & toss"
        onBackHome={() => (onCancelEdit ? onCancelEdit() : onNavigate('home'))}
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1: Select Competing Teams */}
        <section className="rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-white">1. Select Teams</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">
                Team A (Home) <span className="text-rose-400">*</span>
              </span>
              <select
                value={teamAId}
                onChange={(e) => handleTeamAChange(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortName})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">
                Team B (Away) <span className="text-rose-400">*</span>
              </span>
              <select
                value={teamBId}
                onChange={(e) => handleTeamBChange(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortName})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {teamAId && teamBId && teamAId === teamBId && (
            <p className="text-xs font-medium text-rose-400">
              Team A and Team B cannot be the same team.
            </p>
          )}
        </section>

        {/* Step 2: Format, Overs, Date, Venue, Tournament & Status */}
        <section className="rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-white">2. Format &amp; Details</h2>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-[#C8D6CE]">Match Format</span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {FORMAT_PRESETS.map((item) => {
                const active = format === item.format;
                return (
                  <button
                    key={item.format}
                    type="button"
                    onClick={() => setFormat(item.format)}
                    className={`min-h-[48px] rounded-xl px-3 py-2 text-center border transition-colors ${
                      active
                        ? 'bg-[#0D3B24] border-[#22C55E]/60 text-white'
                        : 'bg-[#080C0A] border-white/15 text-[#9CB0A4] hover:text-white'
                    }`}
                  >
                    <div className="font-display text-sm font-bold">{item.label}</div>
                    <div className="font-mono text-[11px] text-[#9AC2AA]">
                      {item.format === 'CUSTOM'
                        ? 'Custom'
                        : item.format === 'TEST'
                          ? '90/day'
                          : `${item.defaultOvers} ov`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {format === 'CUSTOM' && (
            <div className="space-y-2">
              <label className="block space-y-1.5 max-w-xs">
                <span className="text-xs font-medium text-[#C8D6CE]">
                  Number of Overs per Innings <span className="text-rose-400">*</span>
                </span>
                <input
                  type="number"
                  min={1}
                  max={450}
                  value={customOvers}
                  onChange={(e) => setCustomOvers(e.target.value)}
                  required
                  className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 font-mono text-sm text-white focus:outline-none focus:border-[#22C55E]"
                />
              </label>
              <p className="text-xs text-[#9CB0A4]">
                Limited-overs rules · 2 innings · Free Hits on no-balls · Target &amp; RRR enabled
              </p>
            </div>
          )}

          {format === 'TEST' && (
            <div className="rounded-xl bg-[#080C0A] border border-white/10 p-4 space-y-4">
              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-[#C8D6CE]">
                  Test Match Duration (Days)
                </span>
                <div className="grid grid-cols-5 gap-2 max-w-md">
                  {[1, 2, 3, 4, 5].map((days) => {
                    const active = testMaxDays === days;
                    return (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setTestMaxDays(days)}
                        className={`min-h-[44px] rounded-xl px-2 text-xs sm:text-sm font-semibold border transition-colors ${
                          active
                            ? 'bg-[#0D3B24] border-[#22C55E]/60 text-white'
                            : 'bg-[#101612] border-white/15 text-[#9CB0A4] hover:text-white'
                        }`}
                      >
                        {days} {days === 1 ? 'Day' : 'Days'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block space-y-1.5 max-w-xs">
                <span className="text-xs font-medium text-[#C8D6CE]">
                  Daily Overs Quota (Min. 10 – 150)
                </span>
                <input
                  type="number"
                  min={10}
                  max={150}
                  value={testDailyOvers}
                  onChange={(e) => setTestDailyOvers(e.target.value)}
                  required
                  className="w-full min-h-[44px] rounded-xl bg-[#101612] border border-white/15 px-3.5 font-mono text-sm text-white focus:outline-none focus:border-[#22C55E]"
                />
              </label>

              <p className="text-xs text-[#9AC2AA]">
                Up to 4 innings (2 per team) · Follow-on at{' '}
                {getFollowOnThreshold(testMaxDays)}-run lead · Declarations &amp; Draw enabled ·
                No per-innings over limit · Free Hits disabled
              </p>
            </div>
          )}

          {(format === 'T10' || format === 'T20' || format === 'ODI') && (
            <p className="text-xs text-[#9AC2AA]">
              {getEffectiveOvers()} overs per innings · 2 innings · Free Hits on no-balls ·
              Target &amp; Required Run Rate enabled
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">
                Match Date <span className="text-rose-400">*</span>
              </span>
              <input
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                required
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">Venue / Ground</span>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. National Stadium Ground"
                maxLength={80}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">Tournament (Optional)</span>
              <select
                value={tournamentId}
                onChange={(e) => setTournamentId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                <option value="">Standalone / Friendly Match</option>
                {tournaments.map((tourney) => (
                  <option key={tourney.id} value={tourney.id}>
                    {tourney.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">Match Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MatchStatus)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-[#C8D6CE]">
                Career Classification (Optional)
              </span>
              <select
                value={competitionCategory}
                onChange={(e) =>
                  setCompetitionCategory(
                    e.target.value as '' | 'international' | 't20-league' | 'domestic',
                  )
                }
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                <option value="">Auto-detect from Format / Tournament</option>
                <option value="international">International (Test / ODI / T20I)</option>
                <option value="t20-league">T20 League (IPL, BPL, BBL, PSL, CPL, etc.)</option>
                <option value="domestic">Domestic / Club Match</option>
              </select>
            </label>
          </div>
        </section>

        {/* Step 3: Playing XI, Captain & Wicketkeeper */}
        <section className="rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-white">
              3. Playing XI, Captain &amp; Keeper
            </h2>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#080C0A] border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTeamTab('teamA')}
                className={`flex-1 sm:flex-none px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeTeamTab === 'teamA' ? 'bg-[#0D3B24] text-white' : 'text-[#9CB0A4]'
                }`}
              >
                {teamA?.shortName ?? 'Team A'} ({teamAXI.length}/11)
              </button>
              <button
                type="button"
                onClick={() => setActiveTeamTab('teamB')}
                className={`flex-1 sm:flex-none px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeTeamTab === 'teamB' ? 'bg-[#0D3B24] text-white' : 'text-[#9CB0A4]'
                }`}
              >
                {teamB?.shortName ?? 'Team B'} ({teamBXI.length}/11)
              </button>
            </div>
          </div>

          {activeTeamTab === 'teamA'
            ? renderPlayingXISection(
                teamA,
                teamASquad,
                teamAXI,
                setTeamAXI,
                teamACaptainId,
                setTeamACaptainId,
                teamAWKId,
                setTeamAWKId,
              )
            : renderPlayingXISection(
                teamB,
                teamBSquad,
                teamBXI,
                setTeamBXI,
                teamBCaptainId,
                setTeamBCaptainId,
                teamBWKId,
                setTeamBWKId,
              )}
        </section>

        {/* Step 4: Toss Details */}
        <section className="rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-white">4. Toss Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">
                Toss Winner{' '}
                {(status === 'live' || status === 'completed') && (
                  <span className="text-rose-400">*</span>
                )}
              </span>
              <select
                value={tossWinnerId}
                onChange={(e) => setTossWinnerId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                <option value="">Toss Pending / Not Decided</option>
                {teamA && <option value={teamA.id}>{teamA.name}</option>}
                {teamB && teamB.id !== teamA?.id && <option value={teamB.id}>{teamB.name}</option>}
              </select>
            </label>

            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-[#C8D6CE]">Toss Decision</span>
              <div className="grid grid-cols-2 gap-2">
                {(['bat', 'bowl'] as const).map((decision) => {
                  const active = tossDecision === decision;
                  return (
                    <button
                      key={decision}
                      type="button"
                      disabled={!tossWinnerId}
                      onClick={() => setTossDecision(decision)}
                      className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold capitalize border transition-colors disabled:opacity-40 ${
                        active && tossWinnerId
                          ? 'bg-[#0D3B24] border-[#22C55E]/60 text-white'
                          : 'bg-[#080C0A] border-white/15 text-[#9CB0A4]'
                      }`}
                    >
                      {decision === 'bat' ? 'Bat First' : 'Bowl First'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm font-medium text-rose-300">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={() => (onCancelEdit ? onCancelEdit() : onNavigate('matches'))}
            className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 text-sm font-semibold text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 text-sm sm:text-base font-semibold text-white transition-colors"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{isSaving ? 'Saving Match...' : editingMatch ? 'Save Match Changes' : 'Create Match'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
