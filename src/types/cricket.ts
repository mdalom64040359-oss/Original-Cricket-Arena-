export type AppView =
  | 'home'
  | 'matches'
  | 'create-match'
  | 'teams'
  | 'players'
  | 'player-profile'
  | 'tournaments'
  | 'statistics'
  | 'profile';

export interface OrganizerProfile {
  displayName: string;
  clubName: string;
  defaultFormat: MatchFormat;
  defaultOvers: number;
  updatedAt: string;
}

export type MatchFormat = 'T10' | 'T20' | 'ODI' | 'TEST' | 'CUSTOM';

export type MatchStatus = 'upcoming' | 'live' | 'completed' | 'abandoned';

export type TossDecision = 'bat' | 'bowl';

export type PlayerRole = 'batsman' | 'bowler' | 'all-rounder' | 'wicket-keeper';

export type SyncStatus = 'local-only' | 'pending-sync' | 'synced';

export interface SyncMetadata {
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  remoteId?: string;
  version: number;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  location?: string;
  city?: string;
  description?: string;
  logoDataUrl?: string;
  primaryColor: string;
  playerIds: string[];
  captainId?: string;
  viceCaptainId?: string;
  createdAt: string;
  updatedAt: string;
  sync?: SyncMetadata;
}

export type CareerFormatKey =
  | 'all'
  | 'test'
  | 'odi'
  | 't20i'
  | 't20-league'
  | 'domestic';

export const MAJOR_CRICKET_LEAGUES = [
  'IPL',
  'BPL',
  'BBL',
  'PSL',
  'CPL',
  'LPL',
  'SA20',
  'ILT20',
  'Global T20 Canada',
  'Canada 60',
  'European Cricket League',
  'Other Competitions',
] as const;

export type CricketLeagueName = (typeof MAJOR_CRICKET_LEAGUES)[number] | string;

export type CareerDataSource =
  | 'Local Match Records'
  | 'Approved Cricket API'
  | 'Manual Admin Entry'
  | 'JSON Import'
  | 'Combined (Local + Verified)';

export interface NullableBattingCareerStats {
  matches?: number | null;
  innings?: number | null;
  runs?: number | null;
  ballsFaced?: number | null;
  highestScore?: number | null;
  highestScoreIsNotOut?: boolean | null;
  average?: number | null;
  strikeRate?: number | null;
  fours?: number | null;
  sixes?: number | null;
  hundreds?: number | null;
  fifties?: number | null;
  doubleHundreds?: number | null;
  notOuts?: number | null;
  ducks?: number | null;
}

export interface NullableBowlingCareerStats {
  matches?: number | null;
  innings?: number | null;
  balls?: number | null;
  oversDisplay?: string | null;
  wickets?: number | null;
  runsConceded?: number | null;
  average?: number | null;
  economy?: number | null;
  strikeRate?: number | null;
  bestBowlingWickets?: number | null;
  bestBowlingRuns?: number | null;
  bestBowlingDisplay?: string | null;
  fourWickets?: number | null;
  fiveWickets?: number | null;
  tenWickets?: number | null;
}

export interface NullableFieldingCareerStats {
  catches?: number | null;
  runOuts?: number | null;
  stumpings?: number | null;
  totalDismissals?: number | null;
}

export interface CareerRecordOverrides {
  highestPartnershipRuns?: number | null;
  highestPartnershipDetail?: string | null;
  playerOfTheMatchCount?: number | null;
  bestInningsFours?: number | null;
  bestInningsSixes?: number | null;
  highestInningsStrikeRate?: number | null;
}

export interface ExternalFormatCareerEntry {
  formatKey: Exclude<CareerFormatKey, 'all'>;
  batting: NullableBattingCareerStats;
  bowling: NullableBowlingCareerStats;
  fielding: NullableFieldingCareerStats;
  records?: CareerRecordOverrides;
  includedMatchIds?: string[];
  source: CareerDataSource | string;
  lastUpdated: string;
}

export interface ExternalLeagueCareerEntry {
  leagueName: string;
  batting: NullableBattingCareerStats;
  bowling: NullableBowlingCareerStats;
  fielding: NullableFieldingCareerStats;
  playerOfTheMatchCount?: number | null;
  includedMatchIds?: string[];
  source: CareerDataSource | string;
  lastUpdated: string;
}

export interface PlayerExternalCareerProfile {
  formats: Partial<Record<Exclude<CareerFormatKey, 'all'>, ExternalFormatCareerEntry>>;
  leagues: Record<string, ExternalLeagueCareerEntry>;
  records?: CareerRecordOverrides;
  apiPlayerId?: string;
  source?: string;
  lastUpdated?: string;
}

export interface Player {
  id: string;
  name: string;
  photoDataUrl?: string;
  country?: string;
  dateOfBirth?: string;
  role: PlayerRole;
  battingStyle: 'right-hand' | 'left-hand';
  bowlingStyle?: string;
  teamId?: string;
  previousTeams?: string[];
  internationalCareerInfo?: string;
  domesticCareerInfo?: string;
  jerseyNumber?: number;
  careerProfile?: PlayerExternalCareerProfile;
  createdAt: string;
  updatedAt: string;
  sync?: SyncMetadata;
}

export type WicketType = 'bowled' | 'caught' | 'lbw' | 'run-out' | 'stumped' | 'hit-wicket';

export type ExtraType = 'wide' | 'no-ball' | 'bye' | 'leg-bye' | 'penalty';

export interface BallEvent {
  id: string;
  eventType?: 'delivery' | 'penalty';
  overNumber: number;
  ballNumber: number;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  runsOffBat: number;
  extras: number;
  extraType?: ExtraType;
  noBallSubExtraType?: 'bye' | 'leg-bye';
  noBallSubExtras?: number;
  isFreeHit?: boolean;
  isWicket: boolean;
  wicketType?: WicketType;
  dismissedPlayerId?: string;
  incomingBatterId?: string;
  fielderId?: string;
  timestamp: string;
}

export interface Innings {
  inningsNumber: number;
  battingTeamId: string;
  bowlingTeamId: string;
  openingStrikerId?: string;
  openingNonStrikerId?: string;
  openingBowlerId?: string;
  currentStrikerId?: string;
  currentNonStrikerId?: string;
  currentBowlerId?: string;
  targetRuns?: number;
  runs: number;
  wickets: number;
  legalBalls: number;
  extras: number;
  balls: BallEvent[];
  isCompleted: boolean;
  declared?: boolean;
  followOnEnforced?: boolean;
}

export interface Match {
  id: string;
  title: string;
  format: MatchFormat;
  oversPerInnings: number;
  testCurrentDay?: number;
  testMaxDays?: number;
  matchDate: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  teamAShortName: string;
  teamBShortName: string;
  teamAPlayingXI: string[];
  teamBPlayingXI: string[];
  teamACaptainId?: string;
  teamBCaptainId?: string;
  teamAWicketkeeperId?: string;
  teamBWicketkeeperId?: string;
  tossWinnerId?: string;
  tossDecision?: TossDecision;
  venue?: string;
  tournamentId?: string;
  tournamentName?: string;
  competitionCategory?: 'international' | 't20-league' | 'domestic';
  playerOfTheMatchId?: string;
  status: MatchStatus;
  currentInningsIndex: number;
  innings: Innings[];
  resultSummary?: string;
  createdAt: string;
  updatedAt: string;
  sync?: SyncMetadata;
}

export type TournamentFormatType = 'round-robin' | 'groups' | 'league' | 'knockout' | 'hybrid';

export type FixtureStage =
  | 'group'
  | 'league'
  | 'round-robin'
  | 'play-in'
  | 'round-of-64'
  | 'round-of-32'
  | 'round-of-16'
  | 'quarter-final'
  | 'semi-final'
  | 'final';

export interface TournamentGroup {
  id: string;
  name: string;
  teamIds: string[];
}

export interface TournamentFixture {
  id: string;
  fixtureNumber: number;
  stage: FixtureStage;
  roundNumber: number;
  label: string;
  groupId?: string;
  groupName?: string;
  teamAId?: string;
  teamBId?: string;
  scheduledDate?: string;
  venue?: string;
  matchId?: string;
  status: MatchStatus;
  winnerTeamId?: string;
  isTie?: boolean;
  isNoResult?: boolean;
  resultText?: string;
  sourceFixtureAId?: string;
  sourceFixtureBId?: string;
}

export interface Tournament {
  id: string;
  name: string;
  logoDataUrl?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  format: MatchFormat;
  oversPerInnings: number;
  teamIds: string[];
  maxTeams: number;
  tournamentFormat?: TournamentFormatType;
  stageType: 'league' | 'groups-knockout' | 'knockout';
  groupCount?: number;
  qualifiersPerGroup?: number;
  qualifiersCount?: number;
  groups?: TournamentGroup[];
  fixtures?: TournamentFixture[];
  pointsConfig?: {
    win: number;
    tie: number;
    noResult: number;
    loss: number;
  };
  championTeamId?: string;
  status: 'upcoming' | 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
  sync?: SyncMetadata;
}

export interface DashboardSummary {
  teamsCount: number;
  playersCount: number;
  matchesCount: number;
  liveMatches: Match[];
  completedMatchesCount: number;
  tournamentsCount: number;
  totalRecords: number;
  storageReady: boolean;
}
