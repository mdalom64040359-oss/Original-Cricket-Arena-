import {getFromStoreByKey, putInStore, deleteFromStore, STORES, saveOrganizerProfile, getOrganizerProfile} from './database';
import {
  createDefaultLocalPersonalState,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_PRIVACY_SETTINGS,
  type AppLanguage,
  type LocalPersonalState,
} from '../types/user';

const ACTIVE_UID_META_KEY = 'active_personal_uid';
const LANGUAGE_META_KEY = 'personal_language';

function profileMetaKey(uid: string): string {
  return `personal_profile_${uid || 'guest'}`;
}

function readNotifMetaKey(uid: string): string {
  return `personal_notifications_read_${uid || 'guest'}`;
}

export async function getStoredActiveUid(): Promise<string> {
  try {
    const rec = await getFromStoreByKey<{key: string; value: string}>(
      STORES.META,
      ACTIVE_UID_META_KEY,
    );
    return rec?.value || 'guest';
  } catch {
    return 'guest';
  }
}

export async function setStoredActiveUid(uid: string): Promise<void> {
  try {
    await putInStore(STORES.META, {key: ACTIVE_UID_META_KEY, value: uid || 'guest'});
  } catch {
    // Non-blocking fallback
  }
}

export async function getStoredLanguage(): Promise<AppLanguage> {
  try {
    const rec = await getFromStoreByKey<{key: string; value: AppLanguage}>(
      STORES.META,
      LANGUAGE_META_KEY,
    );
    if (rec?.value === 'bn' || rec?.value === 'en') {
      return rec.value;
    }
  } catch {
    // ignore
  }
  try {
    const ls = typeof localStorage !== 'undefined' ? localStorage.getItem('ca_language') : null;
    if (ls === 'bn' || ls === 'en') return ls;
  } catch {
    // ignore
  }
  return 'en';
}

export async function setStoredLanguage(lang: AppLanguage): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ca_language', lang);
    }
  } catch {
    // ignore
  }
  try {
    await putInStore(STORES.META, {key: LANGUAGE_META_KEY, value: lang});
  } catch {
    // ignore
  }
}

export function normalizePersonalState(
  raw: Partial<LocalPersonalState> | null | undefined,
  uid: string,
): LocalPersonalState {
  const base = createDefaultLocalPersonalState({uid});
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    uid,
    language: raw.language === 'bn' ? 'bn' : 'en',
    favouriteTeamIds: Array.isArray(raw.favouriteTeamIds) ? raw.favouriteTeamIds.slice(0, 100) : [],
    favouritePlayerIds: Array.isArray(raw.favouritePlayerIds) ? raw.favouritePlayerIds.slice(0, 100) : [],
    favouriteLeagues: Array.isArray(raw.favouriteLeagues) ? raw.favouriteLeagues.slice(0, 100) : [],
    favouriteMatchIds: Array.isArray(raw.favouriteMatchIds) ? raw.favouriteMatchIds.slice(0, 100) : [],
    notificationSettings: {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(raw.notificationSettings ?? {}),
    },
    privacySettings: {
      ...DEFAULT_PRIVACY_SETTINGS,
      ...(raw.privacySettings ?? {}),
      profileVisibility: 'only-me',
    },
  };
}

export async function loadPersonalProfileCache(uid: string): Promise<LocalPersonalState | null> {
  try {
    const rec = await getFromStoreByKey<{key: string; value: LocalPersonalState}>(
      STORES.META,
      profileMetaKey(uid),
    );
    if (rec?.value) {
      return normalizePersonalState(rec.value, uid);
    }
    if (uid === 'guest') {
      const organizer = await getOrganizerProfile();
      const lang = await getStoredLanguage();
      const seeded = createDefaultLocalPersonalState({
        uid: 'guest',
        displayName: organizer.displayName,
        clubName: organizer.clubName,
        language: lang,
      });
      seeded.defaultFormat = organizer.defaultFormat;
      seeded.defaultOvers = organizer.defaultOvers;
      return seeded;
    }
    return null;
  } catch {
    return null;
  }
}

export async function savePersonalProfileCache(state: LocalPersonalState): Promise<void> {
  const normalized = normalizePersonalState(state, state.uid);
  await setStoredLanguage(normalized.language);
  await putInStore(STORES.META, {
    key: profileMetaKey(normalized.uid),
    value: normalized,
  });
  // Keep organizer_profile synced for CreateMatchView defaults
  try {
    await saveOrganizerProfile({
      displayName: normalized.privacySettings.shareScorerNameLocally
        ? normalized.displayName
        : 'Local Scorer',
      clubName: normalized.clubName || 'Cricket Arena Club',
      defaultFormat: normalized.defaultFormat,
      defaultOvers: normalized.defaultOvers,
      updatedAt: normalized.localUpdatedAt,
    });
  } catch {
    // Non-blocking
  }
}

export async function clearPersonalProfileCache(uid: string): Promise<void> {
  try {
    await deleteFromStore(STORES.META, profileMetaKey(uid));
    await deleteFromStore(STORES.META, readNotifMetaKey(uid));
  } catch {
    // ignore
  }
}

export async function loadReadNotificationIds(uid: string): Promise<string[]> {
  try {
    const rec = await getFromStoreByKey<{key: string; value: string[]}>(
      STORES.META,
      readNotifMetaKey(uid),
    );
    return Array.isArray(rec?.value) ? rec.value : [];
  } catch {
    return [];
  }
}

export async function saveReadNotificationIds(uid: string, ids: string[]): Promise<void> {
  try {
    await putInStore(STORES.META, {
      key: readNotifMetaKey(uid),
      value: ids.slice(-200),
    });
  } catch {
    // ignore
  }
}
