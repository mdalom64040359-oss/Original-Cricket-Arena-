import type {MatchFormat} from './cricket';

export type AppLanguage = 'en' | 'bn';

export interface NotificationSettings {
  favTeams: boolean;
  favPlayers: boolean;
  favLeagues: boolean;
  matchReminders: boolean;
  matchResults: boolean;
  browserNotifications: boolean;
}

export interface PrivacySettings {
  profileVisibility: 'only-me';
  hideEmailOnScorecards: boolean;
  shareScorerNameLocally: boolean;
  confirmBeforeBackupExport: boolean;
  clearCacheOnLogout: boolean;
}

export interface UserPersonalProfile {
  uid: string;
  displayName: string;
  email: string;
  photoDataUrl: string;
  clubName: string;
  city: string;
  country: string;
  bio: string;
  phone: string;
  language: AppLanguage;
  defaultFormat: MatchFormat;
  defaultOvers: number;
  soundEffects: boolean;
  compactScoreboard: boolean;
  autoSync: boolean;
  favouriteTeamIds: string[];
  favouritePlayerIds: string[];
  favouriteLeagues: string[];
  favouriteMatchIds: string[];
  notificationSettings: NotificationSettings;
  privacySettings: PrivacySettings;
}

export interface LocalPersonalState extends UserPersonalProfile {
  pendingCloudSync: boolean;
  localUpdatedAt: string;
  lastSyncedAt?: string;
  createdAtIso?: string;
}

export interface MatchNotificationItem {
  id: string;
  category: 'team' | 'player' | 'league' | 'match';
  status: 'live' | 'upcoming' | 'completed';
  titleEn: string;
  titleBn: string;
  detailEn: string;
  detailBn: string;
  timestamp: string;
  matchId?: string;
  playerId?: string;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  favTeams: true,
  favPlayers: true,
  favLeagues: true,
  matchReminders: true,
  matchResults: true,
  browserNotifications: false,
};

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  profileVisibility: 'only-me',
  hideEmailOnScorecards: true,
  shareScorerNameLocally: true,
  confirmBeforeBackupExport: false,
  clearCacheOnLogout: false,
};

export function formatShortUserId(uid: string): string {
  if (!uid || uid === 'guest') return 'CA-OFFLINE';
  const clean = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `CA-${clean.slice(0, 8)}`;
}

export function createDefaultLocalPersonalState(params?: {
  uid?: string;
  displayName?: string;
  email?: string;
  photoDataUrl?: string;
  language?: AppLanguage;
  clubName?: string;
  city?: string;
  country?: string;
}): LocalPersonalState {
  const now = new Date().toISOString();
  return {
    uid: params?.uid ?? 'guest',
    displayName: params?.displayName?.trim() || 'Cricket Arena User',
    email: params?.email?.trim() || '',
    photoDataUrl: params?.photoDataUrl ?? '',
    clubName: params?.clubName?.trim() || 'Cricket Arena Club',
    city: params?.city?.trim() || '',
    country: params?.country?.trim() || '',
    bio: '',
    phone: '',
    language: params?.language ?? 'en',
    defaultFormat: 'T20',
    defaultOvers: 20,
    soundEffects: true,
    compactScoreboard: false,
    autoSync: true,
    favouriteTeamIds: [],
    favouritePlayerIds: [],
    favouriteLeagues: [],
    favouriteMatchIds: [],
    notificationSettings: {...DEFAULT_NOTIFICATION_SETTINGS},
    privacySettings: {...DEFAULT_PRIVACY_SETTINGS},
    pendingCloudSync: false,
    localUpdatedAt: now,
    createdAtIso: now,
  };
}
