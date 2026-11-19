import {
  computeStatisticsBundle,
  type ComputedStatisticsBundle,
} from '../engine/statisticsEngine';
import type {
  DashboardSummary,
  Match,
  OrganizerProfile,
  Player,
  Team,
  Tournament,
} from '../types/cricket';

const DB_NAME = 'CricketArenaDB';
const DB_VERSION = 1;

export const STORES = {
  TEAMS: 'teams',
  PLAYERS: 'players',
  MATCHES: 'matches',
  TOURNAMENTS: 'tournaments',
  META: 'meta',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

export function openDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(new Error('IndexedDB is not supported in this browser environment.'));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.TEAMS)) {
        const teamStore = db.createObjectStore(STORES.TEAMS, {keyPath: 'id'});
        teamStore.createIndex('name', 'name', {unique: false});
        teamStore.createIndex('updatedAt', 'updatedAt', {unique: false});
      }

      if (!db.objectStoreNames.contains(STORES.PLAYERS)) {
        const playerStore = db.createObjectStore(STORES.PLAYERS, {keyPath: 'id'});
        playerStore.createIndex('name', 'name', {unique: false});
        playerStore.createIndex('teamId', 'teamId', {unique: false});
      }

      if (!db.objectStoreNames.contains(STORES.MATCHES)) {
        const matchStore = db.createObjectStore(STORES.MATCHES, {keyPath: 'id'});
        matchStore.createIndex('status', 'status', {unique: false});
        matchStore.createIndex('tournamentId', 'tournamentId', {unique: false});
        matchStore.createIndex('updatedAt', 'updatedAt', {unique: false});
      }

      if (!db.objectStoreNames.contains(STORES.TOURNAMENTS)) {
        const tournamentStore = db.createObjectStore(STORES.TOURNAMENTS, {keyPath: 'id'});
        tournamentStore.createIndex('status', 'status', {unique: false});
      }

      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, {keyPath: 'key'});
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('Failed to open CricketArenaDB'));
    };
  });

  return dbPromise;
}

export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve((request.result as T[]) ?? []);
    request.onerror = () => reject(request.error ?? new Error(`Failed reading ${storeName}`));
  });
}

export async function getFromStoreByKey<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve((request.result as T) ?? null);
    request.onerror = () => reject(request.error ?? new Error(`Failed reading key from ${storeName}`));
  });
}

export async function putInStore<T>(storeName: string, value: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Failed writing to ${storeName}`));
  });
}

export async function deleteFromStore(storeName: string, id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Failed deleting from ${storeName}`));
  });
}

export const getAllTeams = (): Promise<Team[]> => getAllFromStore<Team>(STORES.TEAMS);
export const getAllPlayers = (): Promise<Player[]> => getAllFromStore<Player>(STORES.PLAYERS);
export const getAllMatches = (): Promise<Match[]> => getAllFromStore<Match>(STORES.MATCHES);
export const getAllTournaments = (): Promise<Tournament[]> =>
  getAllFromStore<Tournament>(STORES.TOURNAMENTS);

export async function saveTeam(team: Team): Promise<void> {
  await putInStore<Team>(STORES.TEAMS, team);
}

export async function deleteTeamWithPlayers(teamId: string): Promise<void> {
  const db = await openDatabase();
  const allPlayers = await getAllPlayers();
  const teamPlayers = allPlayers.filter((p) => p.teamId === teamId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.TEAMS, STORES.PLAYERS], 'readwrite');
    tx.objectStore(STORES.TEAMS).delete(teamId);
    const playerStore = tx.objectStore(STORES.PLAYERS);
    teamPlayers.forEach((p) => playerStore.delete(p.id));

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete team.'));
  });
}

export async function savePlayerAndLinkTeam(
  player: Player,
  options?: {makeCaptain?: boolean; makeViceCaptain?: boolean},
): Promise<void> {
  const db = await openDatabase();
  const teams = await getAllTeams();
  const targetTeam = player.teamId ? teams.find((t) => t.id === player.teamId) : undefined;

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.PLAYERS, STORES.TEAMS], 'readwrite');
    tx.objectStore(STORES.PLAYERS).put(player);

    if (targetTeam) {
      const nextPlayerIds = targetTeam.playerIds.includes(player.id)
        ? targetTeam.playerIds
        : [...targetTeam.playerIds, player.id];

      const nextTeam: Team = {
        ...targetTeam,
        playerIds: nextPlayerIds,
        captainId: options?.makeCaptain
          ? player.id
          : targetTeam.captainId === player.id && options?.makeCaptain === false
            ? undefined
            : targetTeam.captainId,
        viceCaptainId: options?.makeViceCaptain
          ? player.id
          : targetTeam.viceCaptainId === player.id && options?.makeViceCaptain === false
            ? undefined
            : targetTeam.viceCaptainId,
        updatedAt: new Date().toISOString(),
      };

      // A player cannot be both captain and vice-captain simultaneously
      if (options?.makeCaptain && nextTeam.viceCaptainId === player.id) {
        nextTeam.viceCaptainId = undefined;
      }
      if (options?.makeViceCaptain && nextTeam.captainId === player.id) {
        nextTeam.captainId = undefined;
      }

      tx.objectStore(STORES.TEAMS).put(nextTeam);
    }

    // Remove player from any previous team if reassigned
    teams.forEach((t) => {
      if (t.id !== player.teamId && t.playerIds.includes(player.id)) {
        tx.objectStore(STORES.TEAMS).put({
          ...t,
          playerIds: t.playerIds.filter((id) => id !== player.id),
          captainId: t.captainId === player.id ? undefined : t.captainId,
          viceCaptainId: t.viceCaptainId === player.id ? undefined : t.viceCaptainId,
          updatedAt: new Date().toISOString(),
        });
      }
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save player.'));
  });
}

export async function deletePlayerAndUnlink(playerId: string): Promise<void> {
  const db = await openDatabase();
  const teams = await getAllTeams();
  const affectedTeams = teams.filter(
    (t) =>
      t.playerIds.includes(playerId) ||
      t.captainId === playerId ||
      t.viceCaptainId === playerId,
  );

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.PLAYERS, STORES.TEAMS], 'readwrite');
    tx.objectStore(STORES.PLAYERS).delete(playerId);
    const teamStore = tx.objectStore(STORES.TEAMS);

    affectedTeams.forEach((team) => {
      teamStore.put({
        ...team,
        playerIds: team.playerIds.filter((id) => id !== playerId),
        captainId: team.captainId === playerId ? undefined : team.captainId,
        viceCaptainId: team.viceCaptainId === playerId ? undefined : team.viceCaptainId,
        updatedAt: new Date().toISOString(),
      });
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete player.'));
  });
}

export async function getMatchesByTeam(teamId: string): Promise<Match[]> {
  const matches = await getAllMatches();
  return matches
    .filter((m) => m.teamAId === teamId || m.teamBId === teamId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveMatch(match: Match): Promise<void> {
  await putInStore<Match>(STORES.MATCHES, match);
}

export async function getMatchById(matchId: string): Promise<Match | null> {
  return getFromStoreByKey<Match>(STORES.MATCHES, matchId);
}

export async function deleteMatch(matchId: string): Promise<void> {
  await deleteFromStore(STORES.MATCHES, matchId);
}

export async function saveTournament(tournament: Tournament): Promise<void> {
  await putInStore<Tournament>(STORES.TOURNAMENTS, tournament);
}

export async function getTournamentById(tournamentId: string): Promise<Tournament | null> {
  return getFromStoreByKey<Tournament>(STORES.TOURNAMENTS, tournamentId);
}

export async function deleteTournament(tournamentId: string): Promise<void> {
  await deleteFromStore(STORES.TOURNAMENTS, tournamentId);
}

const DEFAULT_PROFILE: OrganizerProfile = {
  displayName: 'Local Scorer',
  clubName: 'Cricket Arena Club',
  defaultFormat: 'T20',
  defaultOvers: 20,
  updatedAt: '',
};

export async function getOrganizerProfile(): Promise<OrganizerProfile> {
  try {
    const record = await getFromStoreByKey<{key: string; value: OrganizerProfile}>(
      STORES.META,
      'organizer_profile',
    );
    return record?.value ?? DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function saveOrganizerProfile(profile: OrganizerProfile): Promise<void> {
  await putInStore(STORES.META, {
    key: 'organizer_profile',
    value: {
      ...profile,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  try {
    const [teams, players, matches, tournaments] = await Promise.all([
      getAllTeams(),
      getAllPlayers(),
      getAllMatches(),
      getAllTournaments(),
    ]);

    const liveMatches = matches
      .filter((m) => m.status === 'live')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const completedMatchesCount = matches.filter((m) => m.status === 'completed').length;

    return {
      teamsCount: teams.length,
      playersCount: players.length,
      matchesCount: matches.length,
      liveMatches,
      completedMatchesCount,
      tournamentsCount: tournaments.length,
      totalRecords: teams.length + players.length + matches.length + tournaments.length,
      storageReady: true,
    };
  } catch {
    return {
      teamsCount: 0,
      playersCount: 0,
      matchesCount: 0,
      liveMatches: [],
      completedMatchesCount: 0,
      tournamentsCount: 0,
      totalRecords: 0,
      storageReady: false,
    };
  }
}

export interface StorageDiagnostics {
  indexedDBReady: boolean;
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
}

export async function requestPersistentStorage(): Promise<boolean | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return null;
  }
  try {
    const already = await navigator.storage.persisted?.();
    if (already) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function getStorageDiagnostics(): Promise<StorageDiagnostics> {
  let indexedDBReady = false;
  try {
    await openDatabase();
    indexedDBReady = true;
  } catch {
    indexedDBReady = false;
  }

  let persisted: boolean | null = null;
  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;

  if (typeof navigator !== 'undefined' && navigator.storage) {
    try {
      if (navigator.storage.persisted) {
        persisted = await navigator.storage.persisted();
      }
      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        usageBytes = typeof estimate.usage === 'number' ? estimate.usage : null;
        quotaBytes = typeof estimate.quota === 'number' ? estimate.quota : null;
      }
    } catch {
      // StorageManager API optional
    }
  }

  return {indexedDBReady, persisted, usageBytes, quotaBytes};
}

export const BACKUP_FORMAT_VERSION = 2;

export interface BackupCounts {
  teams: number;
  players: number;
  matches: number;
  ballEvents: number;
  tournaments: number;
}

export interface DatabaseBackupSnapshot {
  app: 'Cricket Arena';
  backupFormatVersion?: number;
  schemaVersion: number;
  exportedAt: string;
  counts?: BackupCounts;
  data: {
    teams: Team[];
    players: Player[];
    matches: Match[];
    tournaments: Tournament[];
    organizerProfile?: OrganizerProfile;
  };
  statistics?: ComputedStatisticsBundle;
}

export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  snapshot: DatabaseBackupSnapshot | null;
  summary: {
    backupFormatVersion: number;
    schemaVersion: number;
    exportedAt: string;
    teamsCount: number;
    playersCount: number;
    matchesCount: number;
    ballEventsCount: number;
    tournamentsCount: number;
    hasOrganizerProfile: boolean;
    hasStatistics: boolean;
  } | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasNonEmptyId(value: unknown): value is {id: string} {
  return isPlainObject(value) && typeof value.id === 'string' && value.id.trim().length > 0;
}

function countMatchBallEvents(matches: Match[]): number {
  let count = 0;
  for (const m of matches) {
    if (!Array.isArray(m.innings)) continue;
    for (const inn of m.innings) {
      if (Array.isArray(inn.balls)) {
        count += inn.balls.length;
      }
    }
  }
  return count;
}

function dedupeById<T extends {id: string}>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

export function validateBackupSnapshot(raw: unknown): BackupValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(raw)) {
    return {
      valid: false,
      errors: ['Backup file must contain a JSON object.'],
      warnings,
      snapshot: null,
      summary: null,
    };
  }

  if (raw.app !== 'Cricket Arena') {
    errors.push('File is not a valid Cricket Arena backup (missing "Cricket Arena" app identifier).');
  }

  const schemaVersion = raw.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    errors.push('Backup schemaVersion is missing or invalid.');
  } else if (schemaVersion > DB_VERSION) {
    errors.push(
      `Backup schemaVersion (${schemaVersion}) is newer than this app version (${DB_VERSION}). Please update Cricket Arena first.`,
    );
  }

  if (!isPlainObject(raw.data)) {
    errors.push('Backup file is incomplete: missing "data" payload.');
    return {
      valid: false,
      errors,
      warnings,
      snapshot: null,
      summary: null,
    };
  }

  const data = raw.data;

  if (!Array.isArray(data.teams)) {
    errors.push('Backup "data.teams" must be an array.');
  }
  if (!Array.isArray(data.players)) {
    errors.push('Backup "data.players" must be an array.');
  }
  if (!Array.isArray(data.matches)) {
    errors.push('Backup "data.matches" must be an array.');
  }
  if (!Array.isArray(data.tournaments)) {
    errors.push('Backup "data.tournaments" must be an array.');
  }

  if (errors.length > 0) {
    return {valid: false, errors, warnings, snapshot: null, summary: null};
  }

  const rawTeams = data.teams as unknown[];
  const rawPlayers = data.players as unknown[];
  const rawMatches = data.matches as unknown[];
  const rawTournaments = data.tournaments as unknown[];

  const validTeams: Team[] = [];
  rawTeams.forEach((item, idx) => {
    if (!hasNonEmptyId(item) || typeof (item as Team).name !== 'string') {
      errors.push(`Team record at index ${idx} is missing a valid id or name.`);
    } else {
      validTeams.push(item as Team);
    }
  });

  const validPlayers: Player[] = [];
  rawPlayers.forEach((item, idx) => {
    if (!hasNonEmptyId(item) || typeof (item as Player).name !== 'string') {
      errors.push(`Player record at index ${idx} is missing a valid id or name.`);
    } else {
      validPlayers.push(item as Player);
    }
  });

  const validMatches: Match[] = [];
  rawMatches.forEach((item, idx) => {
    if (!hasNonEmptyId(item)) {
      errors.push(`Match record at index ${idx} is missing a valid id.`);
      return;
    }
    const m = item as Partial<Match>;
    if (typeof m.teamAId !== 'string' || typeof m.teamBId !== 'string') {
      errors.push(`Match "${m.id}" is missing teamAId or teamBId.`);
      return;
    }
    if (!Array.isArray(m.innings)) {
      errors.push(`Match "${m.id}" is missing innings array.`);
      return;
    }
    const hasValidInnings = m.innings.every(
      (inn) =>
        isPlainObject(inn) &&
        typeof inn.inningsNumber === 'number' &&
        Array.isArray(inn.balls),
    );
    if (!hasValidInnings) {
      errors.push(`Match "${m.id}" has malformed innings or ball events.`);
      return;
    }
    validMatches.push(item as Match);
  });

  const validTournaments: Tournament[] = [];
  rawTournaments.forEach((item, idx) => {
    if (
      !hasNonEmptyId(item) ||
      typeof (item as Tournament).name !== 'string' ||
      !Array.isArray((item as Tournament).teamIds)
    ) {
      errors.push(`Tournament record at index ${idx} is missing a valid id, name, or teamIds.`);
    } else {
      validTournaments.push(item as Tournament);
    }
  });

  let organizerProfile: OrganizerProfile | undefined;
  if (data.organizerProfile !== undefined) {
    if (
      isPlainObject(data.organizerProfile) &&
      typeof data.organizerProfile.displayName === 'string' &&
      typeof data.organizerProfile.clubName === 'string'
    ) {
      organizerProfile = data.organizerProfile as unknown as OrganizerProfile;
    } else {
      warnings.push('Organizer profile section was malformed and will be skipped.');
    }
  }

  if (errors.length > 0) {
    return {valid: false, errors, warnings, snapshot: null, summary: null};
  }

  const dedupedTeams = dedupeById(validTeams);
  const dedupedPlayers = dedupeById(validPlayers);
  const dedupedMatches = dedupeById(validMatches);
  const dedupedTournaments = dedupeById(validTournaments);

  if (
    dedupedTeams.length !== validTeams.length ||
    dedupedPlayers.length !== validPlayers.length ||
    dedupedMatches.length !== validMatches.length ||
    dedupedTournaments.length !== validTournaments.length
  ) {
    warnings.push('Duplicate IDs in the backup were automatically deduplicated.');
  }

  const backupFormatVersion =
    typeof raw.backupFormatVersion === 'number' ? raw.backupFormatVersion : 1;
  const exportedAt =
    typeof raw.exportedAt === 'string' && raw.exportedAt.trim()
      ? raw.exportedAt
      : 'Unknown date';

  if (backupFormatVersion < BACKUP_FORMAT_VERSION) {
    warnings.push('Older backup format (v1) detected — compatible for full restore.');
  }

  const ballEventsCount = countMatchBallEvents(dedupedMatches);

  const normalizedSnapshot: DatabaseBackupSnapshot = {
    app: 'Cricket Arena',
    backupFormatVersion,
    schemaVersion: schemaVersion as number,
    exportedAt,
    counts: {
      teams: dedupedTeams.length,
      players: dedupedPlayers.length,
      matches: dedupedMatches.length,
      ballEvents: ballEventsCount,
      tournaments: dedupedTournaments.length,
    },
    data: {
      teams: dedupedTeams,
      players: dedupedPlayers,
      matches: dedupedMatches,
      tournaments: dedupedTournaments,
      ...(organizerProfile ? {organizerProfile} : {}),
    },
  };

  return {
    valid: true,
    errors: [],
    warnings,
    snapshot: normalizedSnapshot,
    summary: {
      backupFormatVersion,
      schemaVersion: schemaVersion as number,
      exportedAt,
      teamsCount: dedupedTeams.length,
      playersCount: dedupedPlayers.length,
      matchesCount: dedupedMatches.length,
      ballEventsCount,
      tournamentsCount: dedupedTournaments.length,
      hasOrganizerProfile: Boolean(organizerProfile),
      hasStatistics: isPlainObject(raw.statistics),
    },
  };
}

export async function exportDatabaseSnapshot(): Promise<DatabaseBackupSnapshot> {
  const [teams, players, matches, tournaments, organizerProfile] = await Promise.all([
    getAllTeams(),
    getAllPlayers(),
    getAllMatches(),
    getAllTournaments(),
    getOrganizerProfile(),
  ]);

  const statistics = computeStatisticsBundle({
    matches,
    players,
    teams,
    tournaments,
  });

  return {
    app: 'Cricket Arena',
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: DB_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      teams: teams.length,
      players: players.length,
      matches: matches.length,
      ballEvents: countMatchBallEvents(matches),
      tournaments: tournaments.length,
    },
    data: {
      teams,
      players,
      matches,
      tournaments,
      organizerProfile,
    },
    statistics,
  };
}

export type RestoreMode = 'replace' | 'merge';

export async function importDatabaseSnapshot(
  snapshot: unknown,
  mode: RestoreMode = 'replace',
): Promise<number> {
  const validation = validateBackupSnapshot(snapshot);
  if (!validation.valid || !validation.snapshot) {
    throw new Error(validation.errors[0] ?? 'Invalid Cricket Arena backup file.');
  }

  const verified = validation.snapshot;
  const db = await openDatabase();
  const {teams, players, matches, tournaments, organizerProfile} = verified.data;

  return new Promise((resolve, reject) => {
    const storeNames = [
      STORES.TEAMS,
      STORES.PLAYERS,
      STORES.MATCHES,
      STORES.TOURNAMENTS,
      STORES.META,
    ];
    const tx = db.transaction(storeNames, 'readwrite');

    const teamStore = tx.objectStore(STORES.TEAMS);
    const playerStore = tx.objectStore(STORES.PLAYERS);
    const matchStore = tx.objectStore(STORES.MATCHES);
    const tournamentStore = tx.objectStore(STORES.TOURNAMENTS);
    const metaStore = tx.objectStore(STORES.META);

    if (mode === 'replace') {
      teamStore.clear();
      playerStore.clear();
      matchStore.clear();
      tournamentStore.clear();
    }

    teams.forEach((item) => teamStore.put(item));
    players.forEach((item) => playerStore.put(item));
    matches.forEach((item) => matchStore.put(item));
    tournaments.forEach((item) => tournamentStore.put(item));

    if (organizerProfile) {
      metaStore.put({
        key: 'organizer_profile',
        value: organizerProfile,
      });
    }

    tx.oncomplete = () =>
      resolve(teams.length + players.length + matches.length + tournaments.length);
    tx.onerror = () => reject(tx.error ?? new Error('Failed to restore backup snapshot.'));
    tx.onabort = () => reject(tx.error ?? new Error('Restore aborted; existing data preserved.'));
  });
}
