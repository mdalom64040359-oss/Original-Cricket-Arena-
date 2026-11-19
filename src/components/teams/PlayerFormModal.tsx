import React, {useEffect, useRef, useState} from 'react';
import {Camera, Trash2, User, X} from 'lucide-react';
import type {Player, PlayerRole, Team} from '../../types/cricket';
import {compressImageToDataUrl, generateId} from '../../utils/imageUtils';

interface PlayerFormModalProps {
  isOpen: boolean;
  editingPlayer: Player | null;
  defaultTeamId?: string;
  teams: Team[];
  existingPlayers: Player[];
  onSave: (
    player: Player,
    leadership: {makeCaptain?: boolean; makeViceCaptain?: boolean},
  ) => Promise<void>;
  onClose: () => void;
}

const ROLES: Array<{value: PlayerRole; label: string}> = [
  {value: 'batsman', label: 'Batter'},
  {value: 'bowler', label: 'Bowler'},
  {value: 'all-rounder', label: 'All-rounder'},
  {value: 'wicket-keeper', label: 'Wicketkeeper'},
];

const BOWLING_STYLES = [
  'None',
  'Right-arm Fast',
  'Right-arm Medium',
  'Right-arm Off-spin',
  'Right-arm Leg-spin',
  'Left-arm Fast',
  'Left-arm Medium',
  'Left-arm Orthodox',
  'Left-arm Wrist-spin',
];

export const PlayerFormModal: React.FC<PlayerFormModalProps> = ({
  isOpen,
  editingPlayer,
  defaultTeamId,
  teams,
  existingPlayers,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [teamId, setTeamId] = useState<string>('');
  const [previousTeamsText, setPreviousTeamsText] = useState('');
  const [internationalCareerInfo, setInternationalCareerInfo] = useState('');
  const [domesticCareerInfo, setDomesticCareerInfo] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState<string>('');
  const [role, setRole] = useState<PlayerRole>('batsman');
  const [battingStyle, setBattingStyle] = useState<'right-hand' | 'left-hand'>('right-hand');
  const [bowlingStyle, setBowlingStyle] = useState('None');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [leadership, setLeadership] = useState<'none' | 'captain' | 'vice-captain'>('none');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const targetTeamId = editingPlayer?.teamId ?? defaultTeamId ?? teams[0]?.id ?? '';
    const activeTeam = teams.find((t) => t.id === targetTeamId);

    if (editingPlayer) {
      setName(editingPlayer.name);
      setCountry(editingPlayer.country ?? '');
      setDateOfBirth(editingPlayer.dateOfBirth ?? '');
      setTeamId(targetTeamId);
      setPreviousTeamsText((editingPlayer.previousTeams ?? []).join(', '));
      setInternationalCareerInfo(editingPlayer.internationalCareerInfo ?? '');
      setDomesticCareerInfo(editingPlayer.domesticCareerInfo ?? '');
      setJerseyNumber(
        editingPlayer.jerseyNumber !== undefined ? String(editingPlayer.jerseyNumber) : '',
      );
      setRole(editingPlayer.role);
      setBattingStyle(editingPlayer.battingStyle);
      setBowlingStyle(editingPlayer.bowlingStyle || 'None');
      setPhotoDataUrl(editingPlayer.photoDataUrl);
      if (activeTeam?.captainId === editingPlayer.id) {
        setLeadership('captain');
      } else if (activeTeam?.viceCaptainId === editingPlayer.id) {
        setLeadership('vice-captain');
      } else {
        setLeadership('none');
      }
    } else {
      setName('');
      setCountry('');
      setDateOfBirth('');
      setTeamId(targetTeamId);
      setPreviousTeamsText('');
      setInternationalCareerInfo('');
      setDomesticCareerInfo('');
      setJerseyNumber('');
      setRole('batsman');
      setBattingStyle('right-hand');
      setBowlingStyle('None');
      setPhotoDataUrl(undefined);
      setLeadership('none');
    }
    setError(null);
    setIsSaving(false);
  }, [isOpen, editingPlayer, defaultTeamId, teams]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const compressed = await compressImageToDataUrl(file, 256);
      setPhotoDataUrl(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload player photo.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Player full name is required.');
      return;
    }

    if (!teamId) {
      setError('Please select a team for this player.');
      return;
    }

    const parsedJersey = jerseyNumber.trim() !== '' ? Number(jerseyNumber.trim()) : undefined;
    if (
      parsedJersey !== undefined &&
      (!Number.isInteger(parsedJersey) || parsedJersey < 0 || parsedJersey > 999)
    ) {
      setError('Jersey number must be a whole number between 0 and 999.');
      return;
    }

    const teamPeers = existingPlayers.filter(
      (p) => p.teamId === teamId && p.id !== editingPlayer?.id,
    );

    const duplicateName = teamPeers.find(
      (p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );
    if (duplicateName) {
      setError(`"${duplicateName.name}" is already registered in this team.`);
      return;
    }

    if (parsedJersey !== undefined) {
      const duplicateJersey = teamPeers.find((p) => p.jerseyNumber === parsedJersey);
      if (duplicateJersey) {
        setError(
          `Jersey #${parsedJersey} is already assigned to ${duplicateJersey.name} in this team.`,
        );
        return;
      }
    }

    const parsedPreviousTeams = previousTeamsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setIsSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const playerPayload: Player = {
        id: editingPlayer?.id ?? generateId('player'),
        name: trimmedName,
        photoDataUrl,
        country: country.trim() || undefined,
        dateOfBirth: dateOfBirth.trim() || undefined,
        role,
        battingStyle,
        bowlingStyle: bowlingStyle === 'None' ? undefined : bowlingStyle,
        teamId,
        previousTeams: parsedPreviousTeams.length > 0 ? parsedPreviousTeams : undefined,
        internationalCareerInfo: internationalCareerInfo.trim() || undefined,
        domesticCareerInfo: domesticCareerInfo.trim() || undefined,
        jerseyNumber: parsedJersey,
        careerProfile: editingPlayer?.careerProfile,
        createdAt: editingPlayer?.createdAt ?? now,
        updatedAt: now,
        sync: editingPlayer?.sync ?? {syncStatus: 'local-only', version: 1},
      };

      await onSave(playerPayload, {
        makeCaptain: leadership === 'captain',
        makeViceCaptain: leadership === 'vice-captain',
      });
      onClose();
    } catch {
      setError('Unable to save player to IndexedDB. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-form-title"
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#101713] border border-white/15 p-5 sm:p-6 text-white shadow-2xl space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h2 id="player-form-title" className="font-display text-xl font-bold text-white">
            {editingPlayer ? 'Edit Player' : 'Add Player to Squad'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-[#8FA397] hover:text-white hover:bg-white/5"
            aria-label="Close form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Player Photo Upload */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#0D3B24] border border-white/15 flex items-center justify-center overflow-hidden shrink-0">
              {photoDataUrl ? (
                <img
                  src={photoDataUrl}
                  alt="Player portrait preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-7 h-7 text-[#4ADE80]" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 px-3.5 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-white transition-colors"
              >
                <Camera className="w-4 h-4 text-[#22C55E]" />
                <span>{photoDataUrl ? 'Change Photo' : 'Upload Player Photo'}</span>
              </button>

              {photoDataUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl(undefined)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 px-3 py-2 min-h-[44px] text-xs font-medium text-rose-300 transition-colors"
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
                  void handlePhotoUpload(e);
                }}
                className="hidden"
                aria-label="Upload player photo"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <label className="sm:col-span-2 block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">
                Player Full Name <span className="text-rose-400">*</span>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Shakib Al Hasan"
                maxLength={60}
                required
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">Jersey #</span>
              <input
                type="number"
                min={0}
                max={999}
                value={jerseyNumber}
                onChange={(e) => setJerseyNumber(e.target.value)}
                placeholder="75"
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 font-mono text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">Country</span>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Bangladesh"
                maxLength={50}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">Date of Birth</span>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              />
            </label>
          </div>

          {!defaultTeamId && teams.length > 0 && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">
                Current Team <span className="text-rose-400">*</span>
              </span>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortName})
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Role Selection */}
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[#C8D6CE]">Player Role</span>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((item) => {
                const active = role === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setRole(item.value)}
                    className={`min-h-[44px] rounded-xl px-3 text-xs sm:text-sm font-semibold border transition-colors ${
                      active
                        ? 'bg-[#0D3B24] border-[#22C55E]/60 text-white'
                        : 'bg-[#080C0A] border-white/15 text-[#9CB0A4] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">Batting Style</span>
              <select
                value={battingStyle}
                onChange={(e) => setBattingStyle(e.target.value as 'right-hand' | 'left-hand')}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                <option value="right-hand">Right-hand Bat</option>
                <option value="left-hand">Left-hand Bat</option>
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">Bowling Style</span>
              <select
                value={bowlingStyle}
                onChange={(e) => setBowlingStyle(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              >
                {BOWLING_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Captain / Vice-Captain assignment */}
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[#C8D6CE]">Squad Leadership Role</span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {id: 'none', label: 'Player'},
                  {id: 'captain', label: 'Captain'},
                  {id: 'vice-captain', label: 'Vice-Captain'},
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLeadership(item.id)}
                  className={`min-h-[44px] rounded-xl px-2 text-xs sm:text-sm font-semibold border transition-colors ${
                    leadership === item.id
                      ? 'bg-[#0D3B24] border-[#22C55E]/60 text-white'
                      : 'bg-[#080C0A] border-white/15 text-[#9CB0A4] hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Career Bio & Previous Teams */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">
                Previous Teams <span className="text-[#8FA397]">(comma separated)</span>
              </span>
              <input
                type="text"
                value={previousTeamsText}
                onChange={(e) => setPreviousTeamsText(e.target.value)}
                placeholder="e.g. Dhaka Dynamites, Kolkata Knight Riders"
                maxLength={160}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">International Career Info</span>
              <textarea
                rows={2}
                value={internationalCareerInfo}
                onChange={(e) => setInternationalCareerInfo(e.target.value)}
                placeholder="e.g. Debuted 2006 (ODI), 2007 (Test); all-format international representative"
                maxLength={280}
                className="w-full rounded-xl bg-[#080C0A] border border-white/15 px-3.5 py-2.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">Domestic &amp; League Career Info</span>
              <textarea
                rows={2}
                value={domesticCareerInfo}
                onChange={(e) => setDomesticCareerInfo(e.target.value)}
                placeholder="e.g. First-Class & List-A domestic clubs, BPL/IPL franchise appearances"
                maxLength={280}
                className="w-full rounded-xl bg-[#080C0A] border border-white/15 px-3.5 py-2.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
              />
            </label>
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 text-sm font-semibold text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 text-sm font-semibold text-white transition-colors"
            >
              {isSaving ? 'Saving...' : editingPlayer ? 'Save Player' : 'Add Player'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
