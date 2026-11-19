import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Camera, Check, Search, Shield, Trash2, Trophy, X} from 'lucide-react';
import {
  generateTournamentFixtures,
  getRecommendedGroupCount,
  mapFormatToStageType,
  resolveTournamentFormat,
} from '../../engine/tournamentEngine';
import type {
  MatchFormat,
  Team,
  Tournament,
  TournamentFormatType,
} from '../../types/cricket';
import {compressImageToDataUrl, generateId} from '../../utils/imageUtils';

interface TournamentFormModalProps {
  isOpen: boolean;
  editingTournament: Tournament | null;
  availableTeams: Team[];
  onSave: (tournament: Tournament) => Promise<void>;
  onClose: () => void;
  onGoToTeams: () => void;
}

const TOURNAMENT_FORMATS: Array<{
  value: TournamentFormatType;
  label: string;
  desc: string;
}> = [
  {value: 'round-robin', label: 'Round Robin', desc: 'Every team plays every other team'},
  {value: 'groups', label: 'Groups', desc: 'Balanced groups with group standings'},
  {value: 'league', label: 'League', desc: 'League table + optional top playoffs'},
  {value: 'knockout', label: 'Knockout', desc: 'Direct elimination bracket to Final'},
  {value: 'hybrid', label: 'Hybrid', desc: 'Group stage + QF / SF / Final knockouts'},
];

const TEAM_COUNT_PRESETS = [20, 24, 32, 40, 50];

const CRICKET_FORMATS: Array<{format: MatchFormat; label: string; overs: number}> = [
  {format: 'T10', label: 'T10', overs: 10},
  {format: 'T20', label: 'T20', overs: 20},
  {format: 'ODI', label: 'ODI', overs: 50},
  {format: 'TEST', label: 'Test', overs: 90},
  {format: 'CUSTOM', label: 'Custom', overs: 15},
];

export const TournamentFormModal: React.FC<TournamentFormModalProps> = ({
  isOpen,
  editingTournament,
  availableTeams,
  onSave,
  onClose,
  onGoToTeams,
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(undefined);

  const [matchFormat, setMatchFormat] = useState<MatchFormat>('T20');
  const [customOvers, setCustomOvers] = useState('15');
  const [tournamentFormat, setTournamentFormat] = useState<TournamentFormatType>('hybrid');

  const [maxTeamsInput, setMaxTeamsInput] = useState('20');
  const [groupCountInput, setGroupCountInput] = useState('4');
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState('2');
  const [leagueQualifiers, setLeagueQualifiers] = useState('4');

  const [winPoints, setWinPoints] = useState('2');
  const [tiePoints, setTiePoints] = useState('1');
  const [noResultPoints, setNoResultPoints] = useState('1');

  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [regenerateFixtures, setRegenerateFixtures] = useState(true);
  const [status, setStatus] = useState<Tournament['status']>('upcoming');

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingTournament) {
      setName(editingTournament.name);
      setLocation(editingTournament.location ?? '');
      setStartDate(editingTournament.startDate ?? new Date().toISOString().slice(0, 10));
      setEndDate(editingTournament.endDate ?? '');
      setLogoDataUrl(editingTournament.logoDataUrl);
      setMatchFormat(editingTournament.format);
      setCustomOvers(String(editingTournament.oversPerInnings));
      const resolvedFmt = resolveTournamentFormat(editingTournament);
      setTournamentFormat(resolvedFmt);
      setMaxTeamsInput(String(editingTournament.maxTeams || 20));
      setGroupCountInput(
        String(
          editingTournament.groupCount ??
            getRecommendedGroupCount(editingTournament.teamIds.length || 20),
        ),
      );
      setQualifiersPerGroup(String(editingTournament.qualifiersPerGroup ?? 2));
      setLeagueQualifiers(String(editingTournament.qualifiersCount ?? 4));
      setWinPoints(String(editingTournament.pointsConfig?.win ?? 2));
      setTiePoints(String(editingTournament.pointsConfig?.tie ?? 1));
      setNoResultPoints(String(editingTournament.pointsConfig?.noResult ?? 1));
      setSelectedTeamIds(editingTournament.teamIds);
      setStatus(editingTournament.status);
      setRegenerateFixtures(false);
    } else {
      setName('');
      setLocation('');
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate('');
      setLogoDataUrl(undefined);
      setMatchFormat('T20');
      setCustomOvers('15');
      setTournamentFormat('hybrid');
      setMaxTeamsInput('20');
      setGroupCountInput('4');
      setQualifiersPerGroup('2');
      setLeagueQualifiers('4');
      setWinPoints('2');
      setTiePoints('1');
      setNoResultPoints('1');
      setSelectedTeamIds(availableTeams.slice(0, 20).map((t) => t.id));
      setStatus('upcoming');
      setRegenerateFixtures(true);
    }
    setTeamSearch('');
    setError(null);
    setIsSaving(false);
  }, [isOpen, editingTournament, availableTeams]);

  const sortedTeams = useMemo(
    () => [...availableTeams].sort((a, b) => a.name.localeCompare(b.name)),
    [availableTeams],
  );

  const filteredTeams = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return sortedTeams;
    return sortedTeams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.shortName.toLowerCase().includes(q) ||
        (t.location ?? '').toLowerCase().includes(q),
    );
  }, [sortedTeams, teamSearch]);

  if (!isOpen) return null;

  const parsedMaxTeams = Math.max(2, Number(maxTeamsInput) || 20);

  const handlePresetTeamCount = (count: number) => {
    setMaxTeamsInput(String(count));
    setGroupCountInput(String(getRecommendedGroupCount(count)));
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const compressed = await compressImageToDataUrl(file, 256);
      setLogoDataUrl(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload tournament logo.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    );
  };

  const handleSelectUpToTarget = () => {
    setSelectedTeamIds(sortedTeams.slice(0, parsedMaxTeams).map((t) => t.id));
  };

  const handleSelectAll = () => {
    const allIds = sortedTeams.map((t) => t.id);
    setSelectedTeamIds(allIds);
    if (allIds.length > parsedMaxTeams) {
      setMaxTeamsInput(String(allIds.length));
    }
  };

  const getEffectiveOvers = (): number => {
    if (matchFormat === 'CUSTOM') return Number(customOvers);
    return CRICKET_FORMATS.find((f) => f.format === matchFormat)?.overs ?? 20;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError('Tournament name must be at least 2 characters.');
      return;
    }

    if (startDate && endDate && endDate < startDate) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    const overs = getEffectiveOvers();
    if (!Number.isInteger(overs) || overs < 1 || overs > 450) {
      setError('Overs per innings must be a whole number between 1 and 450.');
      return;
    }

    const targetTeams = Math.max(selectedTeamIds.length, Number(maxTeamsInput) || 0);
    if (!Number.isInteger(targetTeams) || targetTeams < 2 || targetTeams > 256) {
      setError('Target team count must be a whole number between 2 and 256.');
      return;
    }

    if (selectedTeamIds.length < 2) {
      setError('Select at least 2 participating teams to create a tournament.');
      return;
    }

    const parsedGroupCount = Math.max(1, Number(groupCountInput) || 2);
    const parsedQualPerGroup = Math.max(1, Number(qualifiersPerGroup) || 2);
    const parsedLeagueQual = Math.max(0, Number(leagueQualifiers) || 0);

    const now = new Date().toISOString();
    const baseTournament: Tournament = {
      id: editingTournament?.id ?? generateId('tour'),
      name: trimmedName,
      logoDataUrl,
      location: location.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      format: matchFormat,
      oversPerInnings: overs,
      teamIds: selectedTeamIds,
      maxTeams: targetTeams,
      tournamentFormat,
      stageType: mapFormatToStageType(tournamentFormat),
      groupCount:
        tournamentFormat === 'groups' || tournamentFormat === 'hybrid'
          ? parsedGroupCount
          : undefined,
      qualifiersPerGroup: tournamentFormat === 'hybrid' ? parsedQualPerGroup : undefined,
      qualifiersCount: tournamentFormat === 'league' ? parsedLeagueQual : undefined,
      pointsConfig: {
        win: Math.max(1, Number(winPoints) || 2),
        tie: Math.max(0, Number(tiePoints) || 1),
        noResult: Math.max(0, Number(noResultPoints) || 1),
        loss: 0,
      },
      groups: editingTournament?.groups,
      fixtures: editingTournament?.fixtures,
      championTeamId: editingTournament?.championTeamId,
      status,
      createdAt: editingTournament?.createdAt ?? now,
      updatedAt: now,
      sync: editingTournament?.sync ?? {syncStatus: 'local-only', version: 1},
    };

    if (regenerateFixtures || !editingTournament?.fixtures) {
      const generated = generateTournamentFixtures(baseTournament);
      baseTournament.groups = generated.groups;
      baseTournament.fixtures = generated.fixtures;
    }

    setIsSaving(true);
    try {
      await onSave(baseTournament);
      onClose();
    } catch {
      setError('Failed to save tournament in IndexedDB.');
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tournament-form-title"
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#101713] border border-white/15 p-5 sm:p-6 text-white shadow-2xl space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h2 id="tournament-form-title" className="font-display text-xl font-bold text-white">
            {editingTournament ? 'Edit Tournament' : 'Create Tournament'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-[#8FA397] hover:text-white hover:bg-white/5"
            aria-label="Close tournament form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Logo Upload & Basic Info */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#0D3B24] border border-[#22C55E]/30 flex items-center justify-center overflow-hidden shrink-0">
              {logoDataUrl ? (
                <img
                  src={logoDataUrl}
                  alt="Tournament logo preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Trophy className="w-7 h-7 text-[#4ADE80]" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 px-3.5 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-white transition-colors"
              >
                <Camera className="w-4 h-4 text-[#22C55E]" />
                <span>{logoDataUrl ? 'Change Logo' : 'Upload Logo'}</span>
              </button>

              {logoDataUrl && (
                <button
                  type="button"
                  onClick={() => setLogoDataUrl(undefined)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 px-3 py-2 min-h-[44px] text-xs font-medium text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  void handleLogoUpload(e);
                }}
                className="hidden"
                aria-label="Upload tournament logo"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-[#C8D6CE]">
                Tournament Name <span className="text-rose-400">*</span>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Premier Champions Cup 2026"
                maxLength={70}
                required
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">Location / Host City</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Dhaka National Complex"
                maxLength={70}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">Tournament Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Tournament['status'])}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              />
            </label>
          </div>

          {/* Match Format & Overs */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-[#C8D6CE]">Match Format</span>
            <div className="grid grid-cols-5 gap-2">
              {CRICKET_FORMATS.map((item) => {
                const active = matchFormat === item.format;
                return (
                  <button
                    key={item.format}
                    type="button"
                    onClick={() => setMatchFormat(item.format)}
                    className={`min-h-[44px] rounded-xl px-2 py-1.5 text-center border transition-colors ${
                      active
                        ? 'bg-[#0D3B24] border-[#22C55E]/60 text-white'
                        : 'bg-[#080C0A] border-white/15 text-[#9CB0A4] hover:text-white'
                    }`}
                  >
                    <div className="font-display text-xs sm:text-sm font-bold">{item.label}</div>
                    <div className="font-mono text-[10px] text-[#9AC2AA]">
                      {item.format === 'CUSTOM' ? 'Custom' : `${item.overs} ov`}
                    </div>
                  </button>
                );
              })}
            </div>

            {matchFormat === 'CUSTOM' && (
              <label className="block space-y-1 max-w-[200px] pt-1">
                <span className="text-xs font-medium text-[#9AC2AA]">Overs per Innings</span>
                <input
                  type="number"
                  min={1}
                  max={450}
                  value={customOvers}
                  onChange={(e) => setCustomOvers(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 font-mono text-sm text-white"
                />
              </label>
            )}
          </div>

          {/* Tournament Format */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-[#C8D6CE]">Tournament Format</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TOURNAMENT_FORMATS.map((fmt) => {
                const active = tournamentFormat === fmt.value;
                return (
                  <button
                    key={fmt.value}
                    type="button"
                    onClick={() => setTournamentFormat(fmt.value)}
                    className={`rounded-xl p-3 text-left border transition-colors min-h-[56px] ${
                      active
                        ? 'bg-[#0D3B24] border-[#22C55E]/60 text-white'
                        : 'bg-[#080C0A] border-white/15 text-[#9CB0A4] hover:text-white'
                    }`}
                  >
                    <div className="font-display text-sm font-bold text-white">{fmt.label}</div>
                    <div className="text-[11px] text-[#9AC2AA]">{fmt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Team Capacity (20, 24, 32, 40, 50+ or Custom) */}
          <div className="rounded-xl bg-[#080C0A] border border-white/10 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#C8D6CE]">
                Tournament Team Capacity (20, 24, 32, 40, 50+ or Custom)
              </span>
              <span className="font-mono text-xs text-[#4ADE80] tabular-nums">
                Target: {parsedMaxTeams} Teams
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {TEAM_COUNT_PRESETS.map((count) => {
                const active = Number(maxTeamsInput) === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => handlePresetTeamCount(count)}
                    className={`min-h-[40px] px-3.5 rounded-lg font-mono text-xs font-bold border transition-colors ${
                      active
                        ? 'bg-[#0D3B24] border-[#22C55E]/60 text-white'
                        : 'bg-[#101612] border-white/15 text-[#9CB0A4] hover:text-white'
                    }`}
                  >
                    {count} Teams
                  </button>
                );
              })}

              <label className="inline-flex items-center gap-2">
                <span className="text-xs text-[#9CB0A4]">Custom:</span>
                <input
                  type="number"
                  min={2}
                  max={256}
                  value={maxTeamsInput}
                  onChange={(e) => {
                    setMaxTeamsInput(e.target.value);
                    const n = Number(e.target.value);
                    if (n >= 2) {
                      setGroupCountInput(String(getRecommendedGroupCount(n)));
                    }
                  }}
                  className="w-20 min-h-[40px] rounded-lg bg-[#101612] border border-white/15 px-2.5 font-mono text-xs text-white focus:outline-none focus:border-[#22C55E]"
                  aria-label="Custom team capacity"
                />
              </label>
            </div>

            {/* Group & Qualifier Settings */}
            {(tournamentFormat === 'groups' || tournamentFormat === 'hybrid') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
                <label className="block space-y-1">
                  <span className="text-xs text-[#9AC2AA]">Number of Groups</span>
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={groupCountInput}
                    onChange={(e) => setGroupCountInput(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl bg-[#101612] border border-white/15 px-3 font-mono text-sm text-white"
                  />
                </label>

                {tournamentFormat === 'hybrid' && (
                  <label className="block space-y-1">
                    <span className="text-xs text-[#9AC2AA]">Qualifiers per Group</span>
                    <select
                      value={qualifiersPerGroup}
                      onChange={(e) => setQualifiersPerGroup(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl bg-[#101612] border border-white/15 px-3 text-sm text-white"
                    >
                      <option value="1">Top 1 per group</option>
                      <option value="2">Top 2 per group</option>
                      <option value="3">Top 3 per group</option>
                      <option value="4">Top 4 per group</option>
                    </select>
                  </label>
                )}
              </div>
            )}

            {tournamentFormat === 'league' && (
              <label className="block space-y-1 pt-2 border-t border-white/10 max-w-xs">
                <span className="text-xs text-[#9AC2AA]">Knockout Qualifiers After League</span>
                <select
                  value={leagueQualifiers}
                  onChange={(e) => setLeagueQualifiers(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl bg-[#101612] border border-white/15 px-3 text-sm text-white"
                >
                  <option value="0">None (Table Topper Wins)</option>
                  <option value="2">Top 2 (Direct Final)</option>
                  <option value="4">Top 4 (Semi-Finals + Final)</option>
                  <option value="8">Top 8 (QF + SF + Final)</option>
                </select>
              </label>
            )}

            {/* Points System */}
            <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-white/10">
              <label className="block space-y-1">
                <span className="text-[11px] text-[#9CB0A4]">Win Pts</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={winPoints}
                  onChange={(e) => setWinPoints(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg bg-[#101612] border border-white/15 px-2.5 font-mono text-xs text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] text-[#9CB0A4]">Tie Pts</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={tiePoints}
                  onChange={(e) => setTiePoints(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg bg-[#101612] border border-white/15 px-2.5 font-mono text-xs text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] text-[#9CB0A4]">No Result Pts</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={noResultPoints}
                  onChange={(e) => setNoResultPoints(e.target.value)}
                  className="w-full min-h-[40px] rounded-lg bg-[#101612] border border-white/15 px-2.5 font-mono text-xs text-white"
                />
              </label>
            </div>
          </div>

          {/* Participating Teams Selector */}
          <div className="rounded-xl bg-[#080C0A] border border-white/10 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="block text-sm font-semibold text-white">
                  Participating Teams ({selectedTeamIds.length} Selected)
                </span>
                <span className="text-xs text-[#9CB0A4]">
                  {availableTeams.length} teams available in local storage
                </span>
              </div>

              {availableTeams.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={handleSelectUpToTarget}
                    className="min-h-[36px] px-2.5 rounded-lg bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 text-[11px] font-semibold text-[#4ADE80]"
                  >
                    Pick {Math.min(parsedMaxTeams, availableTeams.length)}
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="min-h-[36px] px-2.5 rounded-lg bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 text-[11px] font-semibold text-white"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTeamIds([])}
                    className="min-h-[36px] px-2.5 rounded-lg bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 text-[11px] font-semibold text-[#9CB0A4]"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {availableTeams.length < 2 ? (
              <div className="rounded-xl bg-[#101612] border border-amber-500/30 p-3.5 space-y-2">
                <p className="text-xs text-amber-200">
                  At least 2 teams are required to run a tournament. Create teams in Team Management
                  first.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onGoToTeams();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D3B24] px-3 py-2 min-h-[40px] text-xs font-semibold text-white"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Go to Teams</span>
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 text-[#8FA397] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    placeholder="Filter teams..."
                    className="w-full min-h-[40px] rounded-xl bg-[#101612] border border-white/10 pl-9 pr-3 text-xs text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {filteredTeams.map((team) => {
                    const checked = selectedTeamIds.includes(team.id);
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => toggleTeam(team.id)}
                        className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 min-h-[44px] border text-left transition-colors ${
                          checked
                            ? 'bg-[#0D3B24]/80 border-[#22C55E]/60 text-white'
                            : 'bg-[#101612] border-white/10 text-[#9CB0A4] hover:border-white/25'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{team.name}</div>
                          <div className="font-mono text-[10px] text-[#8FA397]">
                            {team.shortName} · {team.playerIds.length} players
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                            checked
                              ? 'bg-[#16A34A] border-[#22C55E] text-white'
                              : 'border-white/25'
                          }`}
                        >
                          {checked && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {editingTournament && (
            <label className="flex items-center gap-3 rounded-xl bg-[#080C0A] border border-white/10 p-3.5 cursor-pointer min-h-[48px]">
              <input
                type="checkbox"
                checked={regenerateFixtures}
                onChange={(e) => setRegenerateFixtures(e.target.checked)}
                className="w-4 h-4 accent-[#16A34A]"
              />
              <div className="text-xs text-[#D7E4DC]">
                <span className="font-semibold text-white">
                  Regenerate groups &amp; fixtures on save
                </span>
                <p className="text-[11px] text-[#8FA397]">
                  Leave unchecked to preserve existing fixture schedules and linked match scores.
                </p>
              </div>
            </label>
          )}

          {error && (
            <p className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 text-sm font-semibold text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 text-sm font-semibold text-white"
            >
              {isSaving
                ? 'Saving...'
                : editingTournament
                  ? 'Save Tournament'
                  : 'Create & Generate Fixtures'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
