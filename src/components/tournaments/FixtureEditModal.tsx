import React, {useEffect, useState} from 'react';
import {X} from 'lucide-react';
import {checkDuplicateGroupPairing} from '../../engine/tournamentEngine';
import type {
  FixtureStage,
  MatchStatus,
  Team,
  TournamentFixture,
  TournamentGroup,
} from '../../types/cricket';
import {generateId} from '../../utils/imageUtils';

interface FixtureEditModalProps {
  isOpen: boolean;
  editingFixture: TournamentFixture | null;
  existingFixtures: TournamentFixture[];
  teams: Team[];
  groups: TournamentGroup[];
  defaultVenue?: string;
  onSave: (fixture: TournamentFixture) => Promise<void>;
  onClose: () => void;
}

const STAGE_OPTIONS: Array<{value: FixtureStage; label: string}> = [
  {value: 'group', label: 'Group Stage'},
  {value: 'round-robin', label: 'Round Robin'},
  {value: 'league', label: 'League Stage'},
  {value: 'play-in', label: 'Play-In'},
  {value: 'round-of-64', label: 'Round of 64'},
  {value: 'round-of-32', label: 'Round of 32'},
  {value: 'round-of-16', label: 'Round of 16'},
  {value: 'quarter-final', label: 'Quarter-Final'},
  {value: 'semi-final', label: 'Semi-Final'},
  {value: 'final', label: 'Final'},
];

export const FixtureEditModal: React.FC<FixtureEditModalProps> = ({
  isOpen,
  editingFixture,
  existingFixtures,
  teams,
  groups,
  defaultVenue,
  onSave,
  onClose,
}) => {
  const [label, setLabel] = useState('');
  const [stage, setStage] = useState<FixtureStage>('group');
  const [roundNumber, setRoundNumber] = useState('1');
  const [groupId, setGroupId] = useState('');
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [venue, setVenue] = useState('');
  const [status, setStatus] = useState<MatchStatus>('upcoming');
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingFixture) {
      setLabel(editingFixture.label);
      setStage(editingFixture.stage);
      setRoundNumber(String(editingFixture.roundNumber));
      setGroupId(editingFixture.groupId ?? '');
      setTeamAId(editingFixture.teamAId ?? '');
      setTeamBId(editingFixture.teamBId ?? '');
      setScheduledDate(editingFixture.scheduledDate ?? '');
      setVenue(editingFixture.venue ?? defaultVenue ?? '');
      setStatus(editingFixture.status);
    } else {
      const nextNum =
        existingFixtures.reduce((max, f) => Math.max(max, f.fixtureNumber), 0) + 1;
      setLabel(`Match ${nextNum}`);
      setStage(groups.length > 0 ? 'group' : 'league');
      setRoundNumber('1');
      setGroupId(groups[0]?.id ?? '');
      setTeamAId(teams[0]?.id ?? '');
      setTeamBId(teams[1]?.id ?? '');
      setScheduledDate(new Date().toISOString().slice(0, 10));
      setVenue(defaultVenue ?? '');
      setStatus('upcoming');
    }
    setAllowDuplicate(false);
    setError(null);
    setIsSaving(false);
  }, [isOpen, editingFixture, existingFixtures, groups, teams, defaultVenue]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (teamAId && teamBId && teamAId === teamBId) {
      setError('Team A and Team B cannot be the same team.');
      return;
    }

    const selectedGroup = groups.find((g) => g.id === groupId);
    const hasDuplicate = checkDuplicateGroupPairing(existingFixtures, {
      id: editingFixture?.id,
      stage,
      groupId: stage === 'group' ? selectedGroup?.id : undefined,
      teamAId: teamAId || undefined,
      teamBId: teamBId || undefined,
    });

    if (hasDuplicate && !allowDuplicate) {
      setError(
        'This matchup already exists in the same stage/group. Choose different teams or check "Allow rematch" below.',
      );
      return;
    }

    const nextNum =
      editingFixture?.fixtureNumber ??
      existingFixtures.reduce((max, f) => Math.max(max, f.fixtureNumber), 0) + 1;

    const payload: TournamentFixture = {
      ...(editingFixture ?? {}),
      id: editingFixture?.id ?? generateId('fix'),
      fixtureNumber: nextNum,
      stage,
      roundNumber: Math.max(1, Number(roundNumber) || 1),
      label: label.trim() || `Match ${nextNum}`,
      groupId: stage === 'group' ? selectedGroup?.id : undefined,
      groupName: stage === 'group' ? selectedGroup?.name : undefined,
      teamAId: teamAId || undefined,
      teamBId: teamBId || undefined,
      scheduledDate: scheduledDate || undefined,
      venue: venue.trim() || undefined,
      status,
      isNoResult: status === 'abandoned' ? true : editingFixture?.isNoResult,
      resultText:
        status === 'abandoned'
          ? editingFixture?.resultText || 'Abandoned (No Result)'
          : editingFixture?.resultText,
    };

    setIsSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch {
      setError('Failed to save fixture.');
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fixture-edit-title"
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#101713] border border-white/15 p-5 sm:p-6 text-white shadow-2xl space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="fixture-edit-title" className="font-display text-lg font-bold text-white">
            {editingFixture ? 'Edit Fixture' : 'Add Manual Fixture'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-[#8FA397] hover:text-white hover:bg-white/5"
            aria-label="Close fixture modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#C8D6CE]">Fixture Label</span>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Semi-Final 1"
                maxLength={50}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#C8D6CE]">Stage</span>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as FixtureStage)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
              >
                {STAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {stage === 'group' && groups.length > 0 && (
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[#C8D6CE]">Group</span>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#C8D6CE]">Round Number</span>
              <input
                type="number"
                min={1}
                max={100}
                value={roundNumber}
                onChange={(e) => setRoundNumber(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 font-mono text-sm text-white"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#C8D6CE]">Team A</span>
              <select
                value={teamAId}
                onChange={(e) => setTeamAId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
              >
                <option value="">TBD (To Be Decided)</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortName})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#C8D6CE]">Team B</span>
              <select
                value={teamBId}
                onChange={(e) => setTeamBId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
              >
                <option value="">TBD (To Be Decided)</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortName})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#C8D6CE]">Scheduled Date</span>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#C8D6CE]">Fixture Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MatchStatus)}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
              >
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
                <option value="abandoned">Abandoned (No Result)</option>
              </select>
            </label>

            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-medium text-[#C8D6CE]">Venue / Ground</span>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Match ground"
                maxLength={70}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
              />
            </label>
          </div>

          {error && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-xl px-3.5 py-2.5">
                {error}
              </p>
              {error.includes('Allow rematch') && (
                <label className="flex items-center gap-2 text-xs text-[#D7E4DC]">
                  <input
                    type="checkbox"
                    checked={allowDuplicate}
                    onChange={(e) => setAllowDuplicate(e.target.checked)}
                    className="w-4 h-4 accent-[#16A34A]"
                  />
                  <span>Allow rematch between these teams in the same stage</span>
                </label>
              )}
            </div>
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
              {isSaving ? 'Saving...' : 'Save Fixture'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
