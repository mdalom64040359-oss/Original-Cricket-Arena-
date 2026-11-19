import React, {useEffect, useRef, useState} from 'react';
import {Camera, Shield, Trash2, X} from 'lucide-react';
import type {Team} from '../../types/cricket';
import {compressImageToDataUrl, generateId} from '../../utils/imageUtils';

interface TeamFormModalProps {
  isOpen: boolean;
  editingTeam: Team | null;
  existingTeams: Team[];
  onSave: (team: Team) => Promise<void>;
  onClose: () => void;
}

const TEAM_COLORS = [
  {label: 'Turf Green', value: '#0D3B24'},
  {label: 'Emerald', value: '#15803D'},
  {label: 'Obsidian', value: '#18181B'},
  {label: 'Royal Navy', value: '#1E3A8A'},
  {label: 'Crimson', value: '#991B1B'},
  {label: 'Amber Gold', value: '#92400E'},
];

function buildShortCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 4)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export const TeamFormModal: React.FC<TeamFormModalProps> = ({
  isOpen,
  editingTeam,
  existingTeams,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [shortNameEdited, setShortNameEdited] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0D3B24');
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingTeam) {
      setName(editingTeam.name);
      setShortName(editingTeam.shortName);
      setShortNameEdited(true);
      setLocation(editingTeam.location ?? editingTeam.city ?? '');
      setDescription(editingTeam.description ?? '');
      setPrimaryColor(editingTeam.primaryColor || '#0D3B24');
      setLogoDataUrl(editingTeam.logoDataUrl);
    } else {
      setName('');
      setShortName('');
      setShortNameEdited(false);
      setLocation('');
      setDescription('');
      setPrimaryColor('#0D3B24');
      setLogoDataUrl(undefined);
    }
    setError(null);
    setIsSaving(false);
  }, [isOpen, editingTeam]);

  if (!isOpen) return null;

  const handleNameChange = (value: string) => {
    setName(value);
    if (!shortNameEdited) {
      setShortName(buildShortCode(value));
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const compressed = await compressImageToDataUrl(file, 256);
      setLogoDataUrl(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload team logo.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedShort = (shortName.trim() || buildShortCode(trimmedName)).slice(0, 5).toUpperCase();

    if (!trimmedName) {
      setError('Team name is required.');
      return;
    }

    if (trimmedName.length < 2) {
      setError('Team name must be at least 2 characters.');
      return;
    }

    if (!trimmedShort) {
      setError('Team short code is required (2–5 characters).');
      return;
    }

    const duplicateTeam = existingTeams.find(
      (t) =>
        t.id !== editingTeam?.id && t.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

    if (duplicateTeam) {
      setError(`A team named "${duplicateTeam.name}" already exists.`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const teamPayload: Team = {
        id: editingTeam?.id ?? generateId('team'),
        name: trimmedName,
        shortName: trimmedShort,
        location: location.trim() || undefined,
        city: location.trim() || undefined,
        description: description.trim() || undefined,
        logoDataUrl,
        primaryColor,
        playerIds: editingTeam?.playerIds ?? [],
        captainId: editingTeam?.captainId,
        viceCaptainId: editingTeam?.viceCaptainId,
        createdAt: editingTeam?.createdAt ?? now,
        updatedAt: now,
        sync: editingTeam?.sync ?? {syncStatus: 'local-only', version: 1},
      };

      await onSave(teamPayload);
      onClose();
    } catch {
      setError('Unable to save team to IndexedDB. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-form-title"
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#101713] border border-white/15 p-5 sm:p-6 text-white shadow-2xl space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h2 id="team-form-title" className="font-display text-xl font-bold text-white">
            {editingTeam ? 'Edit Team Details' : 'Create New Team'}
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
          {/* Logo Upload Row */}
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl border border-white/15 flex items-center justify-center overflow-hidden shrink-0"
              style={{backgroundColor: primaryColor}}
            >
              {logoDataUrl ? (
                <img
                  src={logoDataUrl}
                  alt="Team logo preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Shield className="w-7 h-7 text-white/90" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 px-3.5 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-white transition-colors"
              >
                <Camera className="w-4 h-4 text-[#22C55E]" />
                <span>{logoDataUrl ? 'Change Logo' : 'Upload Logo / Photo'}</span>
              </button>

              {logoDataUrl && (
                <button
                  type="button"
                  onClick={() => setLogoDataUrl(undefined)}
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
                  void handleLogoUpload(e);
                }}
                className="hidden"
                aria-label="Upload team logo or photo"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <label className="sm:col-span-2 block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">
                Team Name <span className="text-rose-400">*</span>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Dhaka Strikers"
                maxLength={50}
                required
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">
                Short Code <span className="text-rose-400">*</span>
              </span>
              <input
                type="text"
                value={shortName}
                onChange={(e) => {
                  setShortNameEdited(true);
                  setShortName(e.target.value.toUpperCase());
                }}
                placeholder="DHS"
                maxLength={5}
                required
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 font-mono text-sm uppercase text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#C8D6CE]">Team Location / Home Ground</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Mirpur, Dhaka"
              maxLength={60}
              className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#C8D6CE]">Team Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Club background, division, or squad notes..."
              rows={2}
              maxLength={240}
              className="w-full rounded-xl bg-[#080C0A] border border-white/15 p-3 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
            />
          </label>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-[#C8D6CE]">Team Crest Color</span>
            <div className="flex flex-wrap items-center gap-2.5">
              {TEAM_COLORS.map((swatch) => {
                const selected = primaryColor === swatch.value;
                return (
                  <button
                    key={swatch.value}
                    type="button"
                    onClick={() => setPrimaryColor(swatch.value)}
                    aria-label={swatch.label}
                    aria-pressed={selected}
                    className={`w-10 h-10 rounded-xl border-2 transition-transform ${
                      selected ? 'border-white scale-105' : 'border-white/20 hover:scale-105'
                    }`}
                    style={{backgroundColor: swatch.value}}
                  />
                );
              })}
            </div>
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
              {isSaving ? 'Saving...' : editingTeam ? 'Save Changes' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
