import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertCircle,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  Cloud,
  CloudOff,
  Copy,
  Database,
  Download,
  Edit3,
  Globe,
  HardDrive,
  Heart,
  Lock,
  LogOut,
  MailCheck,
  RefreshCw,
  Save,
  ShieldCheck,
  Sliders,
  Smartphone,
  Trash2,
  Upload,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {useUser} from '../../contexts/UserContext';
import {
  exportDatabaseSnapshot,
  getAllMatches,
  getAllPlayers,
  getAllTeams,
  getAllTournaments,
  getStorageDiagnostics,
  importDatabaseSnapshot,
  requestPersistentStorage,
  validateBackupSnapshot,
  type BackupValidationResult,
  type RestoreMode,
  type StorageDiagnostics,
} from '../../db/database';
import {computePersonalMatchNotifications} from '../../engine/matchNotificationsEngine';
import {usePWAInstall} from '../../hooks/usePWAInstall';
import {triggerServiceWorkerRefresh, useServiceWorkerStatus} from '../../pwa/swStatus';
import type {
  AppView,
  DashboardSummary,
  Match,
  MatchFormat,
  Player,
  Team,
  Tournament,
} from '../../types/cricket';
import {formatShortUserId} from '../../types/user';
import {compressImageToDataUrl} from '../../utils/imageUtils';
import {PageHeader} from '../common/PageHeader';
import {PWAInstallButton} from '../common/PWAInstallButton';
import {AccountSecurityPanel} from '../profile/AccountSecurityPanel';
import {AuthPanel} from '../profile/AuthPanel';
import {FavouritesManager} from '../profile/FavouritesManager';
import {MatchNotificationsPanel} from '../profile/MatchNotificationsPanel';
import {RestoreConfirmModal} from '../profile/RestoreConfirmModal';

interface ProfileViewProps {
  summary: DashboardSummary;
  isOnline: boolean;
  onNavigate: (view: AppView) => void;
  onOpenMatch?: (matchId: string) => void;
  onDataChanged: () => Promise<void>;
}

type PanelSection =
  | 'overview'
  | 'edit'
  | 'favourites'
  | 'notifications'
  | 'settings'
  | 'data'
  | 'security';

const DEFAULT_OVERS_FOR_FORMAT: Record<MatchFormat, number> = {
  T10: 10,
  T20: 20,
  ODI: 50,
  TEST: 90,
  CUSTOM: 15,
};

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  summary,
  isOnline,
  onNavigate,
  onOpenMatch,
  onDataChanged,
}) => {
  const {
    firebaseUser,
    profile,
    language,
    t,
    syncState,
    readNotificationIds,
    setLanguage,
    updatePersonalInfo,
    updateAppSettings,
    resendVerificationEmail,
    syncNow,
    logout,
  } = useUser();

  const [activeSection, setActiveSection] = useState<PanelSection>('overview');
  const [copiedId, setCopiedId] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);

  // Edit profile local form draft
  const [editDraft, setEditDraft] = useState({
    displayName: profile.displayName,
    clubName: profile.clubName,
    city: profile.city,
    country: profile.country,
    bio: profile.bio,
    phone: profile.phone,
    photoDataUrl: profile.photoDataUrl,
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Domain records for Favourites & Match Notifications
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  // Backup & Diagnostics
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupErrors, setBackupErrors] = useState<string[]>([]);
  const [diagnostics, setDiagnostics] = useState<StorageDiagnostics>({
    indexedDBReady: summary.storageReady,
    persisted: null,
    usageBytes: null,
    quotaBytes: null,
  });
  const [pendingRestore, setPendingRestore] = useState<{
    validation: BackupValidationResult;
    fileName: string;
  } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const swStatus = useServiceWorkerStatus();
  const {isInstallable, isInstalled, isIOS} = usePWAInstall();

  useEffect(() => {
    setEditDraft({
      displayName: profile.displayName,
      clubName: profile.clubName,
      city: profile.city,
      country: profile.country,
      bio: profile.bio,
      phone: profile.phone,
      photoDataUrl: profile.photoDataUrl,
    });
  }, [
    profile.uid,
    profile.displayName,
    profile.clubName,
    profile.city,
    profile.country,
    profile.bio,
    profile.phone,
    profile.photoDataUrl,
  ]);

  const refreshDiagnostics = useCallback(async () => {
    const diag = await getStorageDiagnostics();
    setDiagnostics(diag);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getAllTeams(), getAllPlayers(), getAllMatches(), getAllTournaments()]).then(
      ([tm, pl, mt, tr]) => {
        if (!active) return;
        setTeams(tm);
        setPlayers(pl);
        setMatches(mt);
        setTournaments(tr);
      },
    );
    void refreshDiagnostics();
    return () => {
      active = false;
    };
  }, [refreshDiagnostics, summary.totalRecords]);

  const notifications = useMemo(
    () =>
      computePersonalMatchNotifications({
        profile,
        matches,
        teams,
        players,
        tournaments,
      }),
    [profile, matches, teams, players, tournaments],
  );

  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !readNotificationIds.includes(n.id)).length,
    [notifications, readNotificationIds],
  );

  const handleCopyUserId = async () => {
    try {
      await navigator.clipboard.writeText(profile.uid);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // ignore clipboard restriction
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    try {
      const compressed = await compressImageToDataUrl(file, 128);
      setEditDraft((prev) => ({...prev, photoDataUrl: compressed}));
      await updatePersonalInfo({photoDataUrl: compressed});
      setSaveMessage(t.panel.savedSuccess);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Failed to update profile picture.');
    } finally {
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleSaveProfileForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await updatePersonalInfo(editDraft);
    setSaveMessage(t.panel.savedSuccess);
    setTimeout(() => setSaveMessage(null), 3500);
  };

  const handleSaveAppSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateAppSettings({
      defaultFormat: profile.defaultFormat,
      defaultOvers: profile.defaultOvers,
      soundEffects: profile.soundEffects,
      compactScoreboard: profile.compactScoreboard,
      autoSync: profile.autoSync,
    });
    setSettingsSavedMsg(t.panel.savedSuccess);
    setTimeout(() => setSettingsSavedMsg(null), 3000);
  };

  const handleRequestPersistence = async () => {
    const granted = await requestPersistentStorage();
    await refreshDiagnostics();
    if (granted === true) {
      setBackupMessage(
        language === 'bn'
          ? 'ব্রাউজার স্থায়ী স্টোরেজ সুরক্ষা চালু করেছে।'
          : 'Persistent device storage granted by browser.',
      );
      setBackupErrors([]);
    } else if (granted === false) {
      setBackupMessage(
        language === 'bn'
          ? 'অ্যাপটি Home Screen-এ ইনস্টল করলে ডেটা আরও নিরাপদ থাকবে।'
          : 'Installing the app to your Home Screen improves offline storage retention.',
      );
    }
  };

  const handleExportBackup = async () => {
    setBackupErrors([]);
    setBackupMessage(null);
    try {
      const snapshot = await exportDatabaseSnapshot();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `cricket-arena-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      const c = snapshot.counts;
      setBackupMessage(
        c
          ? `Backup downloaded: ${c.matches} matches (${c.ballEvents} ball events), ${c.teams} teams, ${c.players} players, ${c.tournaments} tournaments.`
          : 'Backup JSON downloaded.',
      );
    } catch {
      setBackupErrors(['Could not export local IndexedDB database.']);
    }
  };

  const handleRestoreFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBackupErrors([]);
    setBackupMessage(null);

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setBackupErrors(['Selected file is not valid JSON. Existing device data was preserved.']);
        return;
      }

      const validation = validateBackupSnapshot(parsed);
      if (!validation.valid) {
        setBackupErrors([...validation.errors, 'Existing device data was preserved safely.']);
        return;
      }
      setPendingRestore({validation, fileName: file.name});
    } catch {
      setBackupErrors(['Could not read the selected backup file.']);
    } finally {
      if (backupFileInputRef.current) backupFileInputRef.current.value = '';
    }
  };

  const handleConfirmRestore = async (mode: RestoreMode) => {
    if (!pendingRestore?.validation.snapshot) return;
    setIsRestoring(true);
    setBackupErrors([]);
    try {
      const count = await importDatabaseSnapshot(pendingRestore.validation.snapshot, mode);
      await onDataChanged();
      await refreshDiagnostics();
      const [tm, pl, mt, tr] = await Promise.all([
        getAllTeams(),
        getAllPlayers(),
        getAllMatches(),
        getAllTournaments(),
      ]);
      setTeams(tm);
      setPlayers(pl);
      setMatches(mt);
      setTournaments(tr);
      setBackupMessage(
        mode === 'replace'
          ? `Restored ${count} records cleanly.`
          : `Merged ${count} records into local IndexedDB storage.`,
      );
      setPendingRestore(null);
    } catch (err) {
      setBackupErrors([err instanceof Error ? err.message : 'Failed to restore backup.']);
    } finally {
      setIsRestoring(false);
    }
  };

  const totalFavourites =
    profile.favouriteTeamIds.length +
    profile.favouritePlayerIds.length +
    profile.favouriteLeagues.length +
    profile.favouriteMatchIds.length;

  const syncLabel = !firebaseUser
    ? t.panel.syncLocal
    : syncState === 'syncing'
      ? t.panel.syncing
      : syncState === 'synced'
        ? t.panel.syncSynced
        : syncState === 'pending'
          ? t.panel.syncPending
          : t.panel.syncLocal;

  const sectionTabs: Array<{
    id: PanelSection;
    label: string;
    icon: React.ComponentType<{className?: string}>;
    badge?: number;
  }> = [
    {id: 'overview', label: t.panel.tabs.overview, icon: User},
    {id: 'edit', label: t.panel.tabs.edit, icon: Edit3},
    {id: 'favourites', label: t.panel.tabs.favourites, icon: Heart, badge: totalFavourites},
    {id: 'notifications', label: t.panel.tabs.notifications, icon: Bell, badge: unreadNotifCount},
    {id: 'settings', label: t.panel.tabs.settings, icon: Sliders},
    {id: 'data', label: t.panel.tabs.data, icon: Database},
    {id: 'security', label: t.panel.tabs.security, icon: Lock},
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.panel.headerTitle}
        subtitle={t.panel.headerSubtitle}
        onBackHome={() => onNavigate('home')}
        action={
          <div className="flex items-center gap-2">
            {/* Instant Language Switcher */}
            <div className="inline-flex rounded-xl bg-[#101612] border border-white/15 p-1">
              <button
                type="button"
                onClick={() => void setLanguage('en')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  language === 'en' ? 'bg-[#16A34A] text-white' : 'text-[#9CB0A4] hover:text-white'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => void setLanguage('bn')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  language === 'bn' ? 'bg-[#16A34A] text-white' : 'text-[#9CB0A4] hover:text-white'
                }`}
              >
                বাংলা
              </button>
            </div>
            <PWAInstallButton />
          </div>
        }
      />

      {/* Top User Identity Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0D3B24]/70 via-[#101612] to-[#0B100D] border border-[#22C55E]/25 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-[#0D3B24] border border-[#22C55E]/40 flex items-center justify-center overflow-hidden">
              {profile.photoDataUrl ? (
                <img
                  src={profile.photoDataUrl}
                  alt={profile.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-7 h-7 text-[#4ADE80]" />
              )}
            </div>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              aria-label={t.panel.changePhoto}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg bg-[#16A34A] hover:bg-[#15803D] border border-[#070A08] flex items-center justify-center text-white shadow"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handlePhotoUpload(e)}
              className="hidden"
            />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg sm:text-xl font-bold text-white truncate">
                {profile.displayName}
              </h2>
              <span className="font-mono text-[11px] font-semibold text-[#4ADE80] bg-[#0D3B24] border border-[#22C55E]/35 rounded-md px-2 py-0.5">
                {formatShortUserId(profile.uid)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9CB0A4]">
              {firebaseUser ? (
                <span>{firebaseUser.email || profile.email}</span>
              ) : (
                <span>{t.panel.guestTitle}</span>
              )}
              <span className="inline-flex items-center gap-1 font-mono text-[#C8D6CE]">
                <span>ID: {profile.uid.slice(0, 14)}{profile.uid.length > 14 ? '…' : ''}</span>
                <button
                  type="button"
                  onClick={() => void handleCopyUserId()}
                  className="inline-flex items-center gap-1 text-[#4ADE80] hover:text-white ml-1"
                  title={t.panel.copyId}
                >
                  {copiedId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId ? t.panel.copied : t.panel.copyId}</span>
                </button>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs pt-0.5">
              <span className="inline-flex items-center gap-1.5 text-[#C8D6CE]">
                {syncState === 'synced' ? (
                  <Cloud className="w-3.5 h-3.5 text-[#4ADE80]" />
                ) : (
                  <CloudOff className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>{syncLabel}</span>
              </span>

              {firebaseUser && firebaseUser.email && (
                <span
                  className={`inline-flex items-center gap-1 ${
                    firebaseUser.emailVerified ? 'text-[#4ADE80]' : 'text-amber-300'
                  }`}
                >
                  <MailCheck className="w-3.5 h-3.5" />
                  <span>{firebaseUser.emailVerified ? t.panel.verified : t.panel.unverified}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {firebaseUser && isOnline && (
            <button
              type="button"
              onClick={() => void syncNow()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#4ADE80] ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
              <span>{t.panel.syncNow}</span>
            </button>
          )}
          {firebaseUser && (
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>{t.panel.logout}</span>
            </button>
          )}
        </div>
      </div>

      {photoError && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
          {photoError}
        </div>
      )}

      {/* Auth Panel when signed out */}
      {!firebaseUser && <AuthPanel isOnline={isOnline} />}

      {/* Personal Control Panel Section Navigation */}
      <nav
        aria-label={t.panel.headerTitle}
        className="flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-2xl bg-[#101612] border border-white/10"
      >
        {sectionTabs.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 min-h-[40px] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? 'bg-[#0D3B24] text-white border border-[#22C55E]/40'
                  : 'text-[#9CB0A4] hover:text-white border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-[#4ADE80]" />
              <span>{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="font-mono text-[11px] text-[#4ADE80]">({item.badge})</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* SECTION 1: MY PROFILE OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-white">{t.panel.myProfileInfo}</h3>
              <button
                type="button"
                onClick={() => setActiveSection('edit')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4ADE80] hover:text-white"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{t.panel.tabs.edit}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-[#0B100D] border border-white/10 p-3.5">
                <div className="text-[#8FA397]">{t.panel.userIdLabel}</div>
                <div className="mt-1 font-mono text-sm text-white break-all">{profile.uid}</div>
              </div>
              <div className="rounded-xl bg-[#0B100D] border border-white/10 p-3.5">
                <div className="text-[#8FA397]">{t.auth.email}</div>
                <div className="mt-1 text-sm text-white truncate">
                  {profile.email || (language === 'bn' ? 'অফলাইন অ্যাকাউন্ট' : 'Offline Profile')}
                </div>
              </div>
              <div className="rounded-xl bg-[#0B100D] border border-white/10 p-3.5">
                <div className="text-[#8FA397]">{t.auth.clubOptional}</div>
                <div className="mt-1 text-sm text-white truncate">{profile.clubName || '—'}</div>
              </div>
              <div className="rounded-xl bg-[#0B100D] border border-white/10 p-3.5">
                <div className="text-[#8FA397]">
                  {language === 'bn' ? 'শহর ও দেশ' : 'City & Country'}
                </div>
                <div className="mt-1 text-sm text-white truncate">
                  {[profile.city, profile.country].filter(Boolean).join(', ') || '—'}
                </div>
              </div>
            </div>

            {profile.bio && (
              <div className="rounded-xl bg-[#0B100D] border border-white/10 p-3.5 text-xs">
                <div className="text-[#8FA397]">{t.panel.bioLabel}</div>
                <p className="mt-1 text-sm text-[#D7E4DC]">{profile.bio}</p>
              </div>
            )}

            {firebaseUser && !firebaseUser.emailVerified && firebaseUser.email && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-200">
                <span>{t.panel.unverified}</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await resendVerificationEmail();
                      setVerificationNotice(t.panel.verificationSent);
                    } catch {
                      // ignore rate limit silently or show notice
                    }
                  }}
                  className="font-semibold text-amber-300 underline underline-offset-2 text-left sm:text-right"
                >
                  {t.panel.resendVerification}
                </button>
              </div>
            )}
            {verificationNotice && (
              <p className="text-xs text-[#4ADE80]">{verificationNotice}</p>
            )}
          </div>

          <div className="lg:col-span-5 rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-white">{t.panel.quickShortcuts}</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                {sec: 'favourites' as const, label: t.panel.favTeams, val: profile.favouriteTeamIds.length},
                {sec: 'favourites' as const, label: t.panel.favPlayers, val: profile.favouritePlayerIds.length},
                {sec: 'favourites' as const, label: t.panel.favLeagues, val: profile.favouriteLeagues.length},
                {sec: 'notifications' as const, label: t.panel.matchNotifsTitle, val: notifications.length},
              ].map((card, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveSection(card.sec)}
                  className="rounded-xl bg-[#0B100D] hover:bg-[#141D17] border border-white/10 p-3.5 text-left transition-colors"
                >
                  <div className="text-xs text-[#8FA397] truncate">{card.label}</div>
                  <div className="mt-1 font-mono text-xl font-bold text-white tabular-nums">
                    {card.val}
                  </div>
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-white/10 space-y-2 text-xs text-[#9CB0A4]">
              <p>{t.panel.personalIsolationNote}</p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: EDIT PROFILE & PICTURE */}
      {activeSection === 'edit' && (
        <form
          onSubmit={handleSaveProfileForm}
          className="rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-16 rounded-2xl bg-[#0D3B24] border border-[#22C55E]/30 flex items-center justify-center overflow-hidden shrink-0">
                {editDraft.photoDataUrl ? (
                  <img
                    src={editDraft.photoDataUrl}
                    alt={editDraft.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-6 h-6 text-[#4ADE80]" />
                )}
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  {t.panel.editProfileTitle}
                </h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#4ADE80]" />
                    <span>{t.panel.changePhoto}</span>
                  </button>
                  {editDraft.photoDataUrl && (
                    <button
                      type="button"
                      onClick={async () => {
                        setEditDraft((prev) => ({...prev, photoDataUrl: ''}));
                        await updatePersonalInfo({photoDataUrl: ''});
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t.auth.removePhoto}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">{t.auth.fullName}</span>
              <input
                type="text"
                required
                maxLength={80}
                value={editDraft.displayName}
                onChange={(e) => setEditDraft({...editDraft, displayName: e.target.value})}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">{t.auth.clubOptional}</span>
              <input
                type="text"
                maxLength={100}
                value={editDraft.clubName}
                onChange={(e) => setEditDraft({...editDraft, clubName: e.target.value})}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">{t.auth.cityOptional}</span>
              <input
                type="text"
                maxLength={80}
                value={editDraft.city}
                onChange={(e) => setEditDraft({...editDraft, city: e.target.value})}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">{t.panel.countryLabel}</span>
              <input
                type="text"
                maxLength={80}
                value={editDraft.country}
                onChange={(e) => setEditDraft({...editDraft, country: e.target.value})}
                placeholder={language === 'bn' ? 'যেমন: বাংলাদেশ' : 'e.g. Bangladesh'}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">{t.panel.phoneLabel}</span>
              <input
                type="tel"
                maxLength={30}
                value={editDraft.phone}
                onChange={(e) => setEditDraft({...editDraft, phone: e.target.value})}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              />
            </label>

            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-[#C8D6CE]">{t.panel.bioLabel}</span>
              <textarea
                rows={3}
                maxLength={300}
                value={editDraft.bio}
                onChange={(e) => setEditDraft({...editDraft, bio: e.target.value})}
                placeholder={t.panel.bioPlaceholder}
                className="w-full rounded-xl bg-[#080C0A] border border-white/15 p-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
              />
            </label>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            {saveMessage ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4ADE80]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{saveMessage}</span>
              </span>
            ) : (
              <span className="text-xs text-[#8FA397]">
                {language === 'bn'
                  ? 'অফলাইনেও সেভ থাকে ও ইন্টারনেট এলে সিঙ্ক হয়।'
                  : 'Saves locally right away and syncs when online.'}
              </span>
            )}
            <button
              type="submit"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] px-5 py-2.5 min-h-[44px] text-sm font-semibold text-white"
            >
              <Save className="w-4 h-4" />
              <span>{t.panel.saveChanges}</span>
            </button>
          </div>
        </form>
      )}

      {/* SECTION 3: FAVOURITES */}
      {activeSection === 'favourites' && (
        <FavouritesManager
          teams={teams}
          players={players}
          matches={matches}
          tournaments={tournaments}
          onNavigate={onNavigate}
          onOpenMatch={onOpenMatch}
        />
      )}

      {/* SECTION 4: MATCH NOTIFICATIONS & NOTIFICATION SETTINGS */}
      {activeSection === 'notifications' && (
        <MatchNotificationsPanel notifications={notifications} onOpenMatch={onOpenMatch} />
      )}

      {/* SECTION 5: APP SETTINGS & LANGUAGE SETTINGS */}
      {activeSection === 'settings' && (
        <div className="space-y-5">
          {/* Language Settings */}
          <div className="rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0D3B24] border border-[#22C55E]/30 flex items-center justify-center text-[#4ADE80] shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  {t.panel.languageTitle}
                </h3>
                <p className="text-xs text-[#9CB0A4]">{t.panel.languageDesc}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void setLanguage('en')}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  language === 'en'
                    ? 'bg-[#0D3B24] border-[#22C55E]/50 text-white'
                    : 'bg-[#0B100D] border-white/10 text-[#9CB0A4] hover:text-white'
                }`}
              >
                <div className="font-display text-base font-bold text-white">English</div>
                <div className="text-xs text-[#9CB0A4] mt-0.5">Default Cricket Terminology</div>
              </button>
              <button
                type="button"
                onClick={() => void setLanguage('bn')}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  language === 'bn'
                    ? 'bg-[#0D3B24] border-[#22C55E]/50 text-white'
                    : 'bg-[#0B100D] border-white/10 text-[#9CB0A4] hover:text-white'
                }`}
              >
                <div className="font-display text-base font-bold text-white">বাংলা</div>
                <div className="text-xs text-[#9CB0A4] mt-0.5">সহজ বাংলা ইন্টারফেস</div>
              </button>
            </div>
          </div>

          {/* App Settings */}
          <form
            onSubmit={handleSaveAppSettings}
            className="rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-white">{t.panel.appSettingsTitle}</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#C8D6CE]">{t.panel.preferredFormat}</span>
                <select
                  value={profile.defaultFormat}
                  onChange={(e) => {
                    const nextFormat = e.target.value as MatchFormat;
                    void updateAppSettings({
                      defaultFormat: nextFormat,
                      defaultOvers: DEFAULT_OVERS_FOR_FORMAT[nextFormat],
                    });
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
                >
                  <option value="T10">T10 (10 Overs)</option>
                  <option value="T20">T20 (20 Overs)</option>
                  <option value="ODI">ODI (50 Overs)</option>
                  <option value="TEST">Test Match</option>
                  <option value="CUSTOM">Custom Overs</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#C8D6CE]">{t.panel.defaultOvers}</span>
                <input
                  type="number"
                  min={1}
                  max={450}
                  value={profile.defaultOvers}
                  onChange={(e) =>
                    void updateAppSettings({
                      defaultOvers: Math.max(1, Math.min(450, Number(e.target.value) || 20)),
                    })
                  }
                  className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 font-mono text-sm text-white focus:outline-none focus:border-[#22C55E]"
                />
              </label>
            </div>

            <div className="space-y-2.5 pt-1">
              {[
                {key: 'soundEffects' as const, label: t.panel.soundEffects},
                {key: 'compactScoreboard' as const, label: t.panel.compactScoreboard},
                {key: 'autoSync' as const, label: t.panel.autoSync},
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#0B100D] border border-white/10 p-3.5 cursor-pointer"
                >
                  <span className="text-xs sm:text-sm text-white">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={profile[item.key]}
                    onChange={() => void updateAppSettings({[item.key]: !profile[item.key]})}
                    className="h-5 w-5 rounded border-white/25 bg-[#080C0A] accent-[#16A34A] shrink-0"
                  />
                </label>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              {settingsSavedMsg ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4ADE80]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{settingsSavedMsg}</span>
                </span>
              ) : (
                <span className="text-xs text-[#8FA397]">
                  {language === 'bn' ? 'পরিবর্তন সাথে সাথে সেভ হয়।' : 'Settings persist offline across restarts.'}
                </span>
              )}
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] px-5 py-2.5 min-h-[42px] text-sm font-semibold text-white"
              >
                <Save className="w-4 h-4" />
                <span>{t.panel.saveChanges}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECTION 6: MY SAVED DATA & BACKUP/RESTORE */}
      {activeSection === 'data' && (
        <div className="rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#141E18] border border-white/10 flex items-center justify-center text-[#22C55E] shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-white">{t.panel.savedDataTitle}</h3>
                <p className="text-xs text-[#9CB0A4]">
                  {diagnostics.indexedDBReady ? 'IndexedDB Active' : 'Initializing Storage'} · {syncLabel}
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B8C7BE]">
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span>{t.onlineLabel}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-300">{t.offlineLabel}</span>
                </>
              )}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-[#0B100D] border border-white/10 p-3">
              <div className="text-xs text-[#8FA397]">{t.nav.matches}</div>
              <div className="mt-1 font-mono text-lg font-bold text-white tabular-nums">
                {summary.matchesCount}
              </div>
            </div>
            <div className="rounded-xl bg-[#0B100D] border border-white/10 p-3">
              <div className="text-xs text-[#8FA397]">{t.nav.teams}</div>
              <div className="mt-1 font-mono text-lg font-bold text-white tabular-nums">
                {summary.teamsCount}
              </div>
            </div>
            <div className="rounded-xl bg-[#0B100D] border border-white/10 p-3">
              <div className="text-xs text-[#8FA397]">{t.home.cards.players}</div>
              <div className="mt-1 font-mono text-lg font-bold text-white tabular-nums">
                {summary.playersCount}
              </div>
            </div>
            <div className="rounded-xl bg-[#0B100D] border border-white/10 p-3">
              <div className="text-xs text-[#8FA397]">{t.nav.tournaments}</div>
              <div className="mt-1 font-mono text-lg font-bold text-white tabular-nums">
                {summary.tournamentsCount}
              </div>
            </div>
            <div className="rounded-xl bg-[#0B100D] border border-white/10 p-3">
              <div className="text-xs text-[#8FA397]">{t.panel.tabs.favourites}</div>
              <div className="mt-1 font-mono text-lg font-bold text-[#4ADE80] tabular-nums">
                {totalFavourites}
              </div>
            </div>
            <div className="rounded-xl bg-[#0B100D] border border-white/10 p-3">
              <div className="text-xs text-[#8FA397]">{t.panel.matchNotifsTitle}</div>
              <div className="mt-1 font-mono text-lg font-bold text-white tabular-nums">
                {notifications.length}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#0B100D] border border-white/10 p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[#9CB0A4]">
                <HardDrive className="w-3.5 h-3.5 text-[#22C55E]" />
                <span>{language === 'bn' ? 'অফলাইন অ্যাপ ক্যাশ' : 'Offline App Cache'}</span>
              </span>
              <span
                className={`font-mono font-semibold ${
                  swStatus.offlineReady
                    ? 'text-[#4ADE80]'
                    : swStatus.error
                      ? 'text-amber-300'
                      : 'text-[#D7E4DC]'
                }`}
              >
                {swStatus.offlineReady
                  ? language === 'bn'
                    ? 'অফলাইনে প্রস্তুত'
                    : 'Ready Offline'
                  : swStatus.registered
                    ? language === 'bn'
                      ? 'ক্যাশ হচ্ছে...'
                      : 'Caching...'
                    : swStatus.supported
                      ? language === 'bn'
                        ? 'চালু হচ্ছে'
                        : 'Initializing'
                      : language === 'bn'
                        ? 'সমর্থিত নয়'
                        : 'Unsupported'}
              </span>
            </div>

            {diagnostics.usageBytes !== null && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#9CB0A4]">
                  {language === 'bn' ? 'ডিভাইস স্টোরেজ ব্যবহৃত' : 'Device Storage Used'}
                </span>
                <span className="font-mono text-[#D7E4DC] tabular-nums">
                  {formatBytes(diagnostics.usageBytes)}
                  {diagnostics.quotaBytes ? ` / ${formatBytes(diagnostics.quotaBytes)}` : ''}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[#9CB0A4]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
                <span>{language === 'bn' ? 'ডেটা সুরক্ষা (Eviction)' : 'Eviction Protection'}</span>
              </span>
              {diagnostics.persisted === true ? (
                <span className="font-mono font-semibold text-[#4ADE80]">
                  {language === 'bn' ? 'স্থায়ী (Persistent)' : 'Persistent'}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleRequestPersistence()}
                  className="font-semibold text-[#4ADE80] hover:text-white underline underline-offset-2"
                >
                  {language === 'bn' ? 'সুরক্ষা চালু করুন' : 'Enable Protection'}
                </button>
              )}
            </div>

            {swStatus.needRefresh && (
              <button
                type="button"
                onClick={() => void triggerServiceWorkerRefresh()}
                className="w-full min-h-[38px] mt-1 rounded-lg bg-[#0D3B24] hover:bg-[#145334] border border-[#22C55E]/40 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#4ADE80]" />
                <span>
                  {language === 'bn' ? 'অফলাইন ক্যাশ আপডেট করুন' : 'Update Offline App Cache'}
                </span>
              </button>
            )}
          </div>

          {!isInstalled && (
            <div className="rounded-xl bg-[#0B100D] border border-white/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#9CB0A4]">
              <div className="flex items-start gap-2.5">
                <Smartphone className="w-4 h-4 text-[#4ADE80] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">
                    {language === 'bn' ? 'অ্যান্ড্রয়েড ও ডেস্কটপে ইনস্টল করুন' : 'Install as App (Android & Desktop)'}
                  </div>
                  <p className="mt-0.5 leading-relaxed">
                    {isInstallable
                      ? language === 'bn'
                        ? 'এক ক্লিকেই আপনার ফোনের হোম স্ক্রিনে Cricket Arena ইনস্টল করুন এবং ইন্টারনেট ছাড়াই চালু করুন।'
                        : 'Install Cricket Arena directly for a launcher icon, splash screen, and instant offline startup.'
                      : isIOS
                        ? language === 'bn'
                          ? 'Safari-তে Share আইকন থেকে Add to Home Screen নির্বাচন করুন।'
                          : 'Use Safari Share → Add to Home Screen for full-screen offline access.'
                        : language === 'bn'
                          ? 'Chrome মেনু (⋮) থেকে Install app বা Add to Home screen নির্বাচন করুন।'
                          : 'Use Android Chrome menu (⋮) → Install app or open standalone URL to install.'}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <PWAInstallButton compact showFallbackGuide />
              </div>
            </div>
          )}

          {/* Backup & Restore */}
          <div className="pt-3 border-t border-white/10 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-white">Backup &amp; Restore</h4>
              <p className="text-xs text-[#8FA397] mt-0.5">
                {language === 'bn'
                  ? 'দলের তথ্য, খেলোয়াড়, ম্যাচ, বল-বাই-বল রেকর্ড, টুর্নামেন্ট ও পরিসংখ্যান JSON ফাইল হিসেবে সংরক্ষণ বা রিস্টোর করুন।'
                  : 'Exports teams, players, matches, ball events, tournaments & statistics as a versioned JSON file.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => void handleExportBackup()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] px-4 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>{language === 'bn' ? 'ব্যাকআপ ডাউনলোড' : 'Export Backup'}</span>
              </button>

              <button
                type="button"
                onClick={() => backupFileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 px-4 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap"
              >
                <Upload className="w-4 h-4 text-[#22C55E]" />
                <span>{language === 'bn' ? 'ব্যাকআপ রিস্টোর' : 'Restore Backup'}</span>
              </button>
              <input
                ref={backupFileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={(e) => void handleRestoreFileSelected(e)}
                className="hidden"
                aria-label="Restore Cricket Arena backup JSON file"
              />
            </div>

            {backupMessage && (
              <div className="rounded-xl bg-[#0D3B24]/60 border border-[#22C55E]/30 p-3 flex items-start gap-2 text-xs text-[#4ADE80]">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{backupMessage}</span>
              </div>
            )}

            {backupErrors.length > 0 && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 space-y-1 text-xs text-rose-300">
                {backupErrors.map((err, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 7: PRIVACY, CHANGE PASSWORD, DELETE ACCOUNT & LOGOUT */}
      {activeSection === 'security' && <AccountSecurityPanel />}

      {pendingRestore && (
        <RestoreConfirmModal
          validation={pendingRestore.validation}
          fileName={pendingRestore.fileName}
          currentSummary={summary}
          isRestoring={isRestoring}
          onExportCurrentFirst={handleExportBackup}
          onConfirm={(mode) => void handleConfirmRestore(mode)}
          onCancel={() => {
            if (!isRestoring) setPendingRestore(null);
          }}
        />
      )}
    </div>
  );
};
