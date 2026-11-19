import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  clearPersonalProfileCache,
  getStoredActiveUid,
  getStoredLanguage,
  loadPersonalProfileCache,
  loadReadNotificationIds,
  normalizePersonalState,
  savePersonalProfileCache,
  saveReadNotificationIds,
  setStoredActiveUid,
  setStoredLanguage,
} from '../db/userStorage';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
} from '../firebase';
import {getTranslations, type TranslationBundle} from '../i18n/translations';
import {
  createDefaultLocalPersonalState,
  type AppLanguage,
  type LocalPersonalState,
  type NotificationSettings,
  type PrivacySettings,
} from '../types/user';

export type CloudSyncState = 'offline' | 'pending' | 'syncing' | 'synced' | 'error';

export interface AuthActionError {
  code: string;
  message: string;
  needsConsoleProviderEnable?: boolean;
}

interface UserContextValue {
  firebaseUser: User | null;
  authReady: boolean;
  profile: LocalPersonalState;
  language: AppLanguage;
  t: TranslationBundle;
  syncState: CloudSyncState;
  lastSyncError: string | null;
  readNotificationIds: string[];
  setLanguage: (lang: AppLanguage) => Promise<void>;
  updatePersonalInfo: (
    patch: Partial<
      Pick<
        LocalPersonalState,
        'displayName' | 'photoDataUrl' | 'clubName' | 'city' | 'country' | 'bio' | 'phone'
      >
    >,
  ) => Promise<void>;
  updateAppSettings: (
    patch: Partial<
      Pick<
        LocalPersonalState,
        'language' | 'defaultFormat' | 'defaultOvers' | 'soundEffects' | 'compactScoreboard' | 'autoSync'
      >
    >,
  ) => Promise<void>;
  updateNotificationSettings: (patch: Partial<NotificationSettings>) => Promise<void>;
  updatePrivacySettings: (patch: Partial<PrivacySettings>) => Promise<void>;
  toggleFavouriteTeam: (teamId: string) => Promise<void>;
  toggleFavouritePlayer: (playerId: string) => Promise<void>;
  toggleFavouriteLeague: (league: string) => Promise<void>;
  toggleFavouriteMatch: (matchId: string) => Promise<void>;
  markNotificationsRead: (ids: string[]) => Promise<void>;
  syncNow: () => Promise<void>;
  signUpWithEmail: (params: {
    displayName: string;
    email: string;
    password: string;
    photoDataUrl?: string;
    clubName?: string;
    city?: string;
  }) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  sendForgotPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  changeUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteUserAccount: (currentPassword?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

function toFirestoreDocumentPayload(state: LocalPersonalState, uid: string, email: string) {
  return {
    uid,
    displayName: (state.displayName || 'Cricket Arena User').trim().slice(0, 80) || 'Cricket Arena User',
    email: (state.email || email || '').trim().slice(0, 160),
    photoDataUrl: (state.photoDataUrl || '').slice(0, 139000),
    clubName: (state.clubName || '').trim().slice(0, 100),
    city: (state.city || '').trim().slice(0, 80),
    country: (state.country || '').trim().slice(0, 80),
    bio: (state.bio || '').trim().slice(0, 300),
    phone: (state.phone || '').trim().slice(0, 30),
    language: state.language === 'bn' ? 'bn' : 'en',
    defaultFormat: state.defaultFormat,
    defaultOvers: Math.max(1, Math.min(450, Math.round(Number(state.defaultOvers) || 20))),
    soundEffects: Boolean(state.soundEffects),
    compactScoreboard: Boolean(state.compactScoreboard),
    autoSync: Boolean(state.autoSync),
    favouriteTeamIds: state.favouriteTeamIds.slice(0, 100),
    favouritePlayerIds: state.favouritePlayerIds.slice(0, 100),
    favouriteLeagues: state.favouriteLeagues.slice(0, 100),
    favouriteMatchIds: state.favouriteMatchIds.slice(0, 100),
    notificationSettings: {
      favTeams: Boolean(state.notificationSettings.favTeams),
      favPlayers: Boolean(state.notificationSettings.favPlayers),
      favLeagues: Boolean(state.notificationSettings.favLeagues),
      matchReminders: Boolean(state.notificationSettings.matchReminders),
      matchResults: Boolean(state.notificationSettings.matchResults),
      browserNotifications: Boolean(state.notificationSettings.browserNotifications),
    },
    privacySettings: {
      profileVisibility: 'only-me' as const,
      hideEmailOnScorecards: Boolean(state.privacySettings.hideEmailOnScorecards),
      shareScorerNameLocally: Boolean(state.privacySettings.shareScorerNameLocally),
      confirmBeforeBackupExport: Boolean(state.privacySettings.confirmBeforeBackupExport),
      clearCacheOnLogout: Boolean(state.privacySettings.clearCacheOnLogout),
    },
  };
}

function mapFirebaseAuthError(err: unknown, lang: AppLanguage): AuthActionError {
  const anyErr = err as {code?: string; message?: string};
  const code = anyErr?.code || 'auth/unknown';
  const msg = anyErr?.message || '';

  if (
    code === 'auth/operation-not-allowed' ||
    code === 'auth/configuration-not-found'
  ) {
    return {
      code,
      needsConsoleProviderEnable: true,
      message:
        lang === 'bn'
          ? 'Firebase Console-এ Email/Password লগইন এখনো চালু করা হয়নি। নিচের নির্দেশনা দেখে চালু করুন অথবা Google Sign-In ব্যবহার করুন।'
          : 'Email/Password sign-in is not yet enabled in Firebase Console. Follow the step below to enable it, or use Google Sign-In right now.',
    };
  }
  if (code === 'auth/email-already-in-use') {
    return {
      code,
      message:
        lang === 'bn'
          ? 'এই ইমেইল দিয়ে আগেই একটি অ্যাকাউন্ট তৈরি করা আছে। অনুগ্রহ করে লগইন করুন।'
          : 'An account already exists with this email address. Please sign in instead.',
    };
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return {
      code,
      message:
        lang === 'bn'
          ? 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।'
          : 'Invalid email or password.',
    };
  }
  if (code === 'auth/weak-password') {
    return {
      code,
      message:
        lang === 'bn'
          ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'
          : 'Password must be at least 6 characters long.',
    };
  }
  if (code === 'auth/network-request-failed') {
    return {
      code,
      message:
        lang === 'bn'
          ? 'ইন্টারনেট সংযোগ নেই। সংযোগ এলে আবার চেষ্টা করুন।'
          : 'Network error. Please check your internet connection and try again.',
    };
  }
  if (code === 'auth/popup-closed-by-user') {
    return {
      code,
      message:
        lang === 'bn'
          ? 'লগইন পপআপ বন্ধ করা হয়েছে।'
          : 'Sign-in popup was closed before completing login.',
    };
  }
  if (code === 'auth/requires-recent-login') {
    return {
      code,
      message:
        lang === 'bn'
          ? 'নিরাপত্তার জন্য আপনার বর্তমান পাসওয়ার্ড আবার যাচাই করুন।'
          : 'For your security, please verify your current credentials and try again.',
    };
  }
  return {
    code,
    message: msg || (lang === 'bn' ? 'অ্যাকাউন্ট ক্রিয়ায় সমস্যা হয়েছে।' : 'Authentication failed.'),
  };
}

export const UserProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<LocalPersonalState>(() =>
    createDefaultLocalPersonalState({uid: 'guest'}),
  );
  const [syncState, setSyncState] = useState<CloudSyncState>('offline');
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

  const profileRef = useRef(profile);
  profileRef.current = profile;
  const userRef = useRef(firebaseUser);
  userRef.current = firebaseUser;
  const remoteExistsRef = useRef<boolean | null>(null);
  const syncingRef = useRef(false);

  // Startup connection check & initial offline cache bootstrap
  useEffect(() => {
    void testConnection();
    let mounted = true;
    (async () => {
      const [storedUid, storedLang] = await Promise.all([
        getStoredActiveUid(),
        getStoredLanguage(),
      ]);
      const cached = await loadPersonalProfileCache(storedUid);
      const reads = await loadReadNotificationIds(storedUid);
      if (!mounted) return;
      if (cached) {
        setProfile({...cached, language: storedLang || cached.language});
        setSyncState(cached.pendingCloudSync ? 'pending' : 'offline');
      } else {
        setProfile(createDefaultLocalPersonalState({uid: storedUid, language: storedLang}));
      }
      setReadNotificationIds(reads);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const pushToCloud = useCallback(
    async (stateToPush: LocalPersonalState, user: User, createIfMissing = false) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncState('pending');
        return;
      }
      if (syncingRef.current) return;
      syncingRef.current = true;
      setSyncState('syncing');
      setLastSyncError(null);

      const userDocPath = `users/${user.uid}`;
      const ref = doc(db, 'users', user.uid);
      const payload = toFirestoreDocumentPayload(stateToPush, user.uid, user.email || '');

      try {
        if (remoteExistsRef.current === false || createIfMissing) {
          await setDoc(ref, {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          remoteExistsRef.current = true;
        } else {
          try {
            await updateDoc(ref, {
              ...payload,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : '';
            if (msg.includes('No document to update') || msg.includes('not-found')) {
              await setDoc(ref, {
                ...payload,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              remoteExistsRef.current = true;
            } else {
              throw err;
            }
          }
        }

        const nowIso = new Date().toISOString();
        const syncedState: LocalPersonalState = {
          ...stateToPush,
          uid: user.uid,
          pendingCloudSync: false,
          lastSyncedAt: nowIso,
        };
        setProfile(syncedState);
        await savePersonalProfileCache(syncedState);
        setSyncState('synced');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
          setSyncState('error');
          setLastSyncError(msg);
          handleFirestoreError(err, OperationType.WRITE, userDocPath);
        } else {
          // Offline or transient network error — keep safely queued locally
          setSyncState('pending');
          setLastSyncError(msg);
        }
      } finally {
        syncingRef.current = false;
      }
    },
    [],
  );

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      remoteExistsRef.current = null;

      if (!user) {
        await setStoredActiveUid('guest');
        const guestCache = await loadPersonalProfileCache('guest');
        const lang = await getStoredLanguage();
        const nextGuest = guestCache
          ? {...guestCache, language: lang}
          : createDefaultLocalPersonalState({uid: 'guest', language: lang});
        setProfile(nextGuest);
        setReadNotificationIds(await loadReadNotificationIds('guest'));
        setSyncState('offline');
        return;
      }

      await setStoredActiveUid(user.uid);
      const cached = await loadPersonalProfileCache(user.uid);
      const lang = await getStoredLanguage();
      const reads = await loadReadNotificationIds(user.uid);
      setReadNotificationIds(reads);

      if (cached) {
        const merged = {
          ...cached,
          uid: user.uid,
          displayName: cached.displayName || user.displayName || 'Cricket Arena User',
          email: cached.email || user.email || '',
        };
        setProfile(merged);
        setSyncState(merged.pendingCloudSync ? 'pending' : 'synced');
      } else {
        const fresh = createDefaultLocalPersonalState({
          uid: user.uid,
          displayName: user.displayName || 'Cricket Arena User',
          email: user.email || '',
          language: lang,
        });
        setProfile(fresh);
        await savePersonalProfileCache(fresh);
      }
    });

    return () => unsub();
  }, []);

  // Attach Firestore onSnapshot listener ONLY when authReady && authenticated
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const path = `users/${firebaseUser.uid}`;
    const docRef = doc(db, 'users', firebaseUser.uid);

    const unsub = onSnapshot(
      docRef,
      async (snap) => {
        if (!snap.exists()) {
          remoteExistsRef.current = false;
          const current = profileRef.current;
          const initial: LocalPersonalState = {
            ...current,
            uid: firebaseUser.uid,
            displayName:
              current.uid === firebaseUser.uid && current.displayName
                ? current.displayName
                : firebaseUser.displayName || current.displayName || 'Cricket Arena User',
            email: firebaseUser.email || current.email || '',
            pendingCloudSync: true,
          };
          await savePersonalProfileCache(initial);
          setProfile(initial);
          if (typeof navigator === 'undefined' || navigator.onLine) {
            void pushToCloud(initial, firebaseUser, true);
          }
          return;
        }

        remoteExistsRef.current = true;
        const data = snap.data() as Record<string, unknown>;
        const local = profileRef.current;

        // If user made offline edits while disconnected, push local edits instead of overwriting
        if (local.uid === firebaseUser.uid && local.pendingCloudSync && local.autoSync) {
          if (typeof navigator === 'undefined' || navigator.onLine) {
            void pushToCloud(local, firebaseUser, false);
          } else {
            setSyncState('pending');
          }
          return;
        }

        const createdAtTs = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : local.createdAtIso;
        const updatedAtTs = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date().toISOString();

        const remoteState = normalizePersonalState(
          {
            ...(data as Partial<LocalPersonalState>),
            uid: firebaseUser.uid,
            email: (typeof data.email === 'string' && data.email) || firebaseUser.email || '',
            pendingCloudSync: false,
            localUpdatedAt: updatedAtTs,
            lastSyncedAt: updatedAtTs,
            createdAtIso: createdAtTs,
          },
          firebaseUser.uid,
        );

        setProfile(remoteState);
        await savePersonalProfileCache(remoteState);
        setSyncState('synced');
      },
      (error) => {
        const msg = error?.message || '';
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
          handleFirestoreError(error, OperationType.GET, path);
        } else {
          setSyncState(profileRef.current.pendingCloudSync ? 'pending' : 'offline');
        }
      },
    );

    return () => unsub();
  }, [authReady, firebaseUser, pushToCloud]);

  // Auto-flush pending offline personal updates when internet returns
  useEffect(() => {
    const handleOnline = () => {
      const u = userRef.current;
      const p = profileRef.current;
      if (u && p.pendingCloudSync && p.autoSync) {
        void pushToCloud(p, u, remoteExistsRef.current === false);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [pushToCloud]);

  const commitLocalUpdate = useCallback(
    async (updater: (prev: LocalPersonalState) => LocalPersonalState) => {
      const next = updater(profileRef.current);
      const stamped: LocalPersonalState = {
        ...next,
        localUpdatedAt: new Date().toISOString(),
        pendingCloudSync: Boolean(userRef.current),
      };
      setProfile(stamped);
      profileRef.current = stamped;
      await savePersonalProfileCache(stamped);

      const u = userRef.current;
      if (!u) {
        setSyncState('offline');
        return;
      }

      if (stamped.autoSync && (typeof navigator === 'undefined' || navigator.onLine)) {
        await pushToCloud(stamped, u, remoteExistsRef.current === false);
      } else {
        setSyncState('pending');
      }
    },
    [pushToCloud],
  );

  const setLanguage = useCallback(
    async (lang: AppLanguage) => {
      await setStoredLanguage(lang);
      await commitLocalUpdate((prev) => ({...prev, language: lang}));
    },
    [commitLocalUpdate],
  );

  const updatePersonalInfo = useCallback(
    async (
      patch: Partial<
        Pick<
          LocalPersonalState,
          'displayName' | 'photoDataUrl' | 'clubName' | 'city' | 'country' | 'bio' | 'phone'
        >
      >,
    ) => {
      await commitLocalUpdate((prev) => ({...prev, ...patch}));
      if (userRef.current && patch.displayName && patch.displayName.trim()) {
        try {
          await updateProfile(userRef.current, {displayName: patch.displayName.trim().slice(0, 80)});
        } catch {
          // non-blocking
        }
      }
    },
    [commitLocalUpdate],
  );

  const updateAppSettings = useCallback(
    async (
      patch: Partial<
        Pick<
          LocalPersonalState,
          'language' | 'defaultFormat' | 'defaultOvers' | 'soundEffects' | 'compactScoreboard' | 'autoSync'
        >
      >,
    ) => {
      if (patch.language) {
        await setStoredLanguage(patch.language);
      }
      await commitLocalUpdate((prev) => ({...prev, ...patch}));
    },
    [commitLocalUpdate],
  );

  const updateNotificationSettings = useCallback(
    async (patch: Partial<NotificationSettings>) => {
      await commitLocalUpdate((prev) => ({
        ...prev,
        notificationSettings: {...prev.notificationSettings, ...patch},
      }));
    },
    [commitLocalUpdate],
  );

  const updatePrivacySettings = useCallback(
    async (patch: Partial<PrivacySettings>) => {
      await commitLocalUpdate((prev) => ({
        ...prev,
        privacySettings: {
          ...prev.privacySettings,
          ...patch,
          profileVisibility: 'only-me',
        },
      }));
    },
    [commitLocalUpdate],
  );

  const toggleIdInList = useCallback(
    async (
      field: 'favouriteTeamIds' | 'favouritePlayerIds' | 'favouriteLeagues' | 'favouriteMatchIds',
      value: string,
    ) => {
      await commitLocalUpdate((prev) => {
        const list = prev[field];
        const exists = list.includes(value);
        const nextList = exists
          ? list.filter((item) => item !== value)
          : [...list, value].slice(-100);
        return {...prev, [field]: nextList};
      });
    },
    [commitLocalUpdate],
  );

  const toggleFavouriteTeam = useCallback(
    (teamId: string) => toggleIdInList('favouriteTeamIds', teamId),
    [toggleIdInList],
  );
  const toggleFavouritePlayer = useCallback(
    (playerId: string) => toggleIdInList('favouritePlayerIds', playerId),
    [toggleIdInList],
  );
  const toggleFavouriteLeague = useCallback(
    (league: string) => toggleIdInList('favouriteLeagues', league),
    [toggleIdInList],
  );
  const toggleFavouriteMatch = useCallback(
    (matchId: string) => toggleIdInList('favouriteMatchIds', matchId),
    [toggleIdInList],
  );

  const markNotificationsRead = useCallback(async (ids: string[]) => {
    const uid = userRef.current?.uid || 'guest';
    setReadNotificationIds((prev) => {
      const merged = Array.from(new Set([...prev, ...ids])).slice(-200);
      void saveReadNotificationIds(uid, merged);
      return merged;
    });
  }, []);

  const syncNow = useCallback(async () => {
    const u = userRef.current;
    if (!u) return;
    await pushToCloud(profileRef.current, u, remoteExistsRef.current === false);
  }, [pushToCloud]);

  const signUpWithEmail = useCallback(
    async (params: {
      displayName: string;
      email: string;
      password: string;
      photoDataUrl?: string;
      clubName?: string;
      city?: string;
    }) => {
      try {
        const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
        const cleanName = params.displayName.trim().slice(0, 80) || 'Cricket Arena User';
        await updateProfile(cred.user, {displayName: cleanName});
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // non-blocking verification send
        }

        const initial = createDefaultLocalPersonalState({
          uid: cred.user.uid,
          displayName: cleanName,
          email: params.email.trim(),
          photoDataUrl: params.photoDataUrl || '',
          language: profileRef.current.language,
          clubName: params.clubName,
          city: params.city,
        });
        initial.pendingCloudSync = true;
        await setStoredActiveUid(cred.user.uid);
        await savePersonalProfileCache(initial);
        setProfile(initial);
        remoteExistsRef.current = false;
        await pushToCloud(initial, cred.user, true);
      } catch (err) {
        throw mapFirebaseAuthError(err, profileRef.current.language);
      }
    },
    [pushToCloud],
  );

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      throw mapFirebaseAuthError(err, profileRef.current.language);
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      throw mapFirebaseAuthError(err, profileRef.current.language);
    }
  }, []);

  const sendForgotPassword = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      throw mapFirebaseAuthError(err, profileRef.current.language);
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      throw mapFirebaseAuthError(err, profileRef.current.language);
    }
  }, []);

  const changeUserPassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw {
        code: 'auth/no-current-user',
        message: 'No active email/password account signed in.',
      } satisfies AuthActionError;
    }
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
    } catch (err) {
      throw mapFirebaseAuthError(err, profileRef.current.language);
    }
  }, []);

  const deleteUserAccount = useCallback(async (currentPassword?: string) => {
    const user = auth.currentUser;
    if (!user) return;
    const uid = user.uid;
    const path = `users/${uid}`;

    try {
      const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
      if (hasPasswordProvider) {
        if (!currentPassword || !user.email) {
          throw {
            code: 'auth/requires-recent-login',
            message:
              profileRef.current.language === 'bn'
                ? 'অ্যাকাউন্ট মুছে ফেলতে আপনার বর্তমান পাসওয়ার্ড দিন।'
                : 'Please enter your current password to delete your account.',
          } satisfies AuthActionError;
        }
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
      } else {
        await reauthenticateWithPopup(user, googleProvider);
      }

      // Delete Firestore document first while still authenticated
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.DELETE, path);
      }

      await deleteUser(user);
      await clearPersonalProfileCache(uid);
      await setStoredActiveUid('guest');
      const lang = await getStoredLanguage();
      setProfile(createDefaultLocalPersonalState({uid: 'guest', language: lang}));
      setSyncState('offline');
    } catch (err) {
      if ((err as AuthActionError)?.code) {
        throw err;
      }
      throw mapFirebaseAuthError(err, profileRef.current.language);
    }
  }, []);

  const logout = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    const shouldClear = profileRef.current.privacySettings.clearCacheOnLogout;
    await signOut(auth);
    if (uid && shouldClear) {
      await clearPersonalProfileCache(uid);
    }
    await setStoredActiveUid('guest');
  }, []);

  const language: AppLanguage = profile.language === 'bn' ? 'bn' : 'en';
  const t = useMemo(() => getTranslations(language), [language]);

  const value = useMemo<UserContextValue>(
    () => ({
      firebaseUser,
      authReady,
      profile,
      language,
      t,
      syncState,
      lastSyncError,
      readNotificationIds,
      setLanguage,
      updatePersonalInfo,
      updateAppSettings,
      updateNotificationSettings,
      updatePrivacySettings,
      toggleFavouriteTeam,
      toggleFavouritePlayer,
      toggleFavouriteLeague,
      toggleFavouriteMatch,
      markNotificationsRead,
      syncNow,
      signUpWithEmail,
      loginWithEmail,
      loginWithGoogle,
      sendForgotPassword,
      resendVerificationEmail,
      changeUserPassword,
      deleteUserAccount,
      logout,
    }),
    [
      firebaseUser,
      authReady,
      profile,
      language,
      t,
      syncState,
      lastSyncError,
      readNotificationIds,
      setLanguage,
      updatePersonalInfo,
      updateAppSettings,
      updateNotificationSettings,
      updatePrivacySettings,
      toggleFavouriteTeam,
      toggleFavouritePlayer,
      toggleFavouriteLeague,
      toggleFavouriteMatch,
      markNotificationsRead,
      syncNow,
      signUpWithEmail,
      loginWithEmail,
      loginWithGoogle,
      sendForgotPassword,
      resendVerificationEmail,
      changeUserPassword,
      deleteUserAccount,
      logout,
    ],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within UserProvider');
  }
  return ctx;
}
