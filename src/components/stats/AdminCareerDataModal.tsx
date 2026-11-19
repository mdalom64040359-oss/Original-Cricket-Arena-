import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  CheckCircle2,
  Database,
  FileJson,
  Globe,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {putInStore, STORES} from '../../db/database';
import {FORMAT_TAB_META} from '../../engine/careerStatsEngine';
import type {
  CareerFormatKey,
  CareerRecordOverrides,
  ExternalFormatCareerEntry,
  ExternalLeagueCareerEntry,
  Match,
  NullableBattingCareerStats,
  NullableBowlingCareerStats,
  NullableFieldingCareerStats,
  Player,
  PlayerExternalCareerProfile,
} from '../../types/cricket';
import {MAJOR_CRICKET_LEAGUES} from '../../types/cricket';

interface AdminCareerDataModalProps {
  isOpen: boolean;
  player: Player;
  matches: Match[];
  initialScopeType?: 'format' | 'league';
  initialFormatKey?: Exclude<CareerFormatKey, 'all'>;
  initialLeagueName?: string;
  onPlayerUpdated: (updated: Player) => Promise<void>;
  onClose: () => void;
}

type AdminTab = 'manual' | 'json' | 'api';
type FormatScopeKey = Exclude<CareerFormatKey, 'all'>;

const FORMAT_SCOPE_OPTIONS: Array<{key: FormatScopeKey; label: string}> = FORMAT_TAB_META.filter(
  (f): f is {key: FormatScopeKey; label: string; shortLabel: string} => f.key !== 'all',
).map((f) => ({key: f.key, label: f.label}));

interface ApiSearchItem {
  id: string;
  name: string;
  country?: string;
}

interface ApiPlayerPreview {
  externalId?: string;
  name?: string;
  country?: string;
  dateOfBirth?: string;
  roleText?: string;
  battingStyleText?: string;
  bowlingStyleText?: string;
  formats: ExternalFormatCareerEntry[];
}

function toInputStr(val: number | null | undefined): string {
  return val !== null && val !== undefined && Number.isFinite(val) ? String(val) : '';
}

function parseOptionalNum(str: string): number | null {
  const trimmed = str.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

function parseOptionalInt(str: string): number | null {
  const num = parseOptionalNum(str);
  return num !== null ? Math.floor(num) : null;
}

function cleanNullableRecord<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v !== null && v !== undefined && v !== '') {
      out[k] = v;
    }
  }
  return out as Partial<T>;
}

const SAMPLE_JSON_TEMPLATE = {
  formats: {
    odi: {
      batting: {
        matches: 247,
        innings: 234,
        runs: 7570,
        ballsFaced: 9140,
        highestScore: 134,
        highestScoreIsNotOut: true,
        fours: 686,
        sixes: 52,
        hundreds: 9,
        fifties: 56,
        doubleHundreds: 0,
        notOuts: 31,
        ducks: 12,
      },
      bowling: {
        matches: 247,
        innings: 241,
        balls: 12575,
        wickets: 317,
        runsConceded: 9360,
        bestBowlingWickets: 5,
        bestBowlingRuns: 29,
        fourWickets: 12,
        fiveWickets: 4,
        tenWickets: 0,
      },
      fielding: {
        catches: 62,
        runOuts: 11,
        stumpings: 0,
      },
      records: {
        highestPartnershipRuns: 224,
        highestPartnershipDetail: '224 with Mahmudullah vs New Zealand',
        playerOfTheMatchCount: 27,
      },
    },
  },
  leagues: {
    BPL: {
      batting: {matches: 112, innings: 103, runs: 2510, highestScore: 89},
      bowling: {wickets: 149, bestBowlingWickets: 5, bestBowlingRuns: 16},
      fielding: {catches: 40},
      playerOfTheMatchCount: 15,
    },
  },
};

export const AdminCareerDataModal: React.FC<AdminCareerDataModalProps> = ({
  isOpen,
  player,
  matches,
  initialScopeType = 'format',
  initialFormatKey = 't20i',
  initialLeagueName = 'IPL',
  onPlayerUpdated,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('manual');

  // Manual Entry State
  const [scopeType, setScopeType] = useState<'format' | 'league'>(initialScopeType);
  const [formatKey, setFormatKey] = useState<FormatScopeKey>(initialFormatKey);
  const [leagueChoice, setLeagueChoice] = useState<string>(initialLeagueName);
  const [customLeagueName, setCustomLeagueName] = useState('');
  const [sourceLabel, setSourceLabel] = useState('Manual Career Entry');
  const [includedMatchIds, setIncludedMatchIds] = useState<string[]>([]);

  // Batting fields
  const [batM, setBatM] = useState('');
  const [batInn, setBatInn] = useState('');
  const [batRuns, setBatRuns] = useState('');
  const [batBalls, setBatBalls] = useState('');
  const [batHS, setBatHS] = useState('');
  const [batHSNotOut, setBatHSNotOut] = useState(false);
  const [batAvg, setBatAvg] = useState('');
  const [batSR, setBatSR] = useState('');
  const [bat4s, setBat4s] = useState('');
  const [bat6s, setBat6s] = useState('');
  const [bat100s, setBat100s] = useState('');
  const [bat50s, setBat50s] = useState('');
  const [bat200s, setBat200s] = useState('');
  const [batNO, setBatNO] = useState('');
  const [batDucks, setBatDucks] = useState('');

  // Bowling fields
  const [bowlM, setBowlM] = useState('');
  const [bowlInn, setBowlInn] = useState('');
  const [bowlBalls, setBowlBalls] = useState('');
  const [bowlWkts, setBowlWkts] = useState('');
  const [bowlRuns, setBowlRuns] = useState('');
  const [bowlAvg, setBowlAvg] = useState('');
  const [bowlEcon, setBowlEcon] = useState('');
  const [bowlSR, setBowlSR] = useState('');
  const [bowlBestW, setBowlBestW] = useState('');
  const [bowlBestR, setBowlBestR] = useState('');
  const [bowl4W, setBowl4W] = useState('');
  const [bowl5W, setBowl5W] = useState('');
  const [bowl10W, setBowl10W] = useState('');

  // Fielding fields
  const [fldCatches, setFldCatches] = useState('');
  const [fldRunOuts, setFldRunOuts] = useState('');
  const [fldStumpings, setFldStumpings] = useState('');

  // Records fields
  const [recPotm, setRecPotm] = useState('');
  const [recHighPartnerRuns, setRecHighPartnerRuns] = useState('');
  const [recHighPartnerDetail, setRecHighPartnerDetail] = useState('');
  const [recBest4s, setRecBest4s] = useState('');
  const [recBest6s, setRecBest6s] = useState('');
  const [recHighInnSR, setRecHighInnSR] = useState('');

  // JSON Import state
  const [jsonText, setJsonText] = useState('');
  const [jsonPreview, setJsonPreview] = useState<string | null>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);

  // API Sync state
  const [apiStatus, setApiStatus] = useState<{
    checked: boolean;
    configured: boolean;
    message: string;
  }>({checked: false, configured: false, message: ''});
  const [apiSearchQuery, setApiSearchQuery] = useState(player.name);
  const [apiSearchResults, setApiSearchResults] = useState<ApiSearchItem[]>([]);
  const [apiSelectedPreview, setApiSelectedPreview] = useState<ApiPlayerPreview | null>(null);
  const [apiBusy, setApiBusy] = useState(false);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const effectiveLeagueName =
    leagueChoice === '__custom__' ? customLeagueName.trim() : leagueChoice;

  const playerMatches = useMemo(() => {
    return matches
      .filter(
        (m) =>
          m.status !== 'abandoned' &&
          (m.teamAPlayingXI.includes(player.id) ||
            m.teamBPlayingXI.includes(player.id) ||
            m.innings.some((inn) =>
              inn.balls.some(
                (b) => b.strikerId === player.id || b.bowlerId === player.id || b.fielderId === player.id,
              ),
            )),
      )
      .sort((a, b) => (b.matchDate || b.updatedAt).localeCompare(a.matchDate || a.updatedAt));
  }, [matches, player.id]);

  useEffect(() => {
    if (!isOpen) return;
    setScopeType(initialScopeType);
    setFormatKey(initialFormatKey);
    const isMajor = (MAJOR_CRICKET_LEAGUES as readonly string[]).includes(initialLeagueName);
    if (isMajor) {
      setLeagueChoice(initialLeagueName);
      setCustomLeagueName('');
    } else if (initialLeagueName) {
      setLeagueChoice('__custom__');
      setCustomLeagueName(initialLeagueName);
    }
  }, [isOpen, initialScopeType, initialFormatKey, initialLeagueName]);

  // Populate Manual fields whenever modal opens or scope changes
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setFeedback(null);

    const ext = player.careerProfile;
    const entry =
      scopeType === 'format'
        ? ext?.formats?.[formatKey]
        : effectiveLeagueName
          ? ext?.leagues?.[effectiveLeagueName]
          : undefined;

    const bat = entry?.batting ?? {};
    const bw = entry?.bowling ?? {};
    const fld = entry?.fielding ?? {};
    const recs = entry && 'records' in entry ? entry.records : undefined;

    setSourceLabel(entry?.source || 'Manual Career Entry');
    setIncludedMatchIds(entry?.includedMatchIds ?? []);

    setBatM(toInputStr(bat.matches));
    setBatInn(toInputStr(bat.innings));
    setBatRuns(toInputStr(bat.runs));
    setBatBalls(toInputStr(bat.ballsFaced));
    setBatHS(toInputStr(bat.highestScore));
    setBatHSNotOut(Boolean(bat.highestScoreIsNotOut));
    setBatAvg(toInputStr(bat.average));
    setBatSR(toInputStr(bat.strikeRate));
    setBat4s(toInputStr(bat.fours));
    setBat6s(toInputStr(bat.sixes));
    setBat100s(toInputStr(bat.hundreds));
    setBat50s(toInputStr(bat.fifties));
    setBat200s(toInputStr(bat.doubleHundreds));
    setBatNO(toInputStr(bat.notOuts));
    setBatDucks(toInputStr(bat.ducks));

    setBowlM(toInputStr(bw.matches));
    setBowlInn(toInputStr(bw.innings));
    setBowlBalls(toInputStr(bw.balls));
    setBowlWkts(toInputStr(bw.wickets));
    setBowlRuns(toInputStr(bw.runsConceded));
    setBowlAvg(toInputStr(bw.average));
    setBowlEcon(toInputStr(bw.economy));
    setBowlSR(toInputStr(bw.strikeRate));
    setBowlBestW(toInputStr(bw.bestBowlingWickets));
    setBowlBestR(toInputStr(bw.bestBowlingRuns));
    setBowl4W(toInputStr(bw.fourWickets));
    setBowl5W(toInputStr(bw.fiveWickets));
    setBowl10W(toInputStr(bw.tenWickets));

    setFldCatches(toInputStr(fld.catches));
    setFldRunOuts(toInputStr(fld.runOuts));
    setFldStumpings(toInputStr(fld.stumpings));

    const potmVal =
      entry && 'playerOfTheMatchCount' in entry
        ? entry.playerOfTheMatchCount
        : recs?.playerOfTheMatchCount ?? ext?.records?.playerOfTheMatchCount;
    setRecPotm(toInputStr(potmVal));
    setRecHighPartnerRuns(
      toInputStr(recs?.highestPartnershipRuns ?? ext?.records?.highestPartnershipRuns),
    );
    setRecHighPartnerDetail(
      recs?.highestPartnershipDetail ?? ext?.records?.highestPartnershipDetail ?? '',
    );
    setRecBest4s(toInputStr(recs?.bestInningsFours ?? ext?.records?.bestInningsFours));
    setRecBest6s(toInputStr(recs?.bestInningsSixes ?? ext?.records?.bestInningsSixes));
    setRecHighInnSR(
      toInputStr(recs?.highestInningsStrikeRate ?? ext?.records?.highestInningsStrikeRate),
    );
  }, [isOpen, player, scopeType, formatKey, effectiveLeagueName]);

  // Check API status when switching to API tab
  useEffect(() => {
    if (!isOpen || activeTab !== 'api' || apiStatus.checked) return;
    let cancelled = false;
    fetch('/api/cricket/status')
      .then(async (res) => {
        if (!res.ok) throw new Error('Server API proxy not available');
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Static host mode (no backend server)');
        }
        return (await res.json()) as {configured?: boolean; message?: string};
      })
      .then((data) => {
        if (cancelled) return;
        setApiStatus({
          checked: true,
          configured: Boolean(data.configured),
          message: data.message || '',
        });
      })
      .catch(() => {
        if (cancelled) return;
        setApiStatus({
          checked: true,
          configured: false,
          message:
            'Approved Cricket API proxy is offline or unavailable in static/APK mode. Use Manual Entry or JSON Import — both work 100% offline.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab, apiStatus.checked]);

  if (!isOpen) return null;

  const toggleIncludedMatch = (matchId: string) => {
    setIncludedMatchIds((prev) =>
      prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId],
    );
  };

  const persistCareerProfile = async (
    nextProfile: PlayerExternalCareerProfile,
    extraBio?: Partial<Player>,
    successMsg = 'Career data saved to IndexedDB.',
  ) => {
    setIsSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const now = new Date().toISOString();
      const updatedPlayer: Player = {
        ...player,
        ...extraBio,
        careerProfile: nextProfile,
        updatedAt: now,
      };
      await putInStore<Player>(STORES.PLAYERS, updatedPlayer);
      await onPlayerUpdated(updatedPlayer);
      setFeedback(successMsg);
    } catch {
      setError('Failed to save career data to local storage.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);

    if (scopeType === 'league' && !effectiveLeagueName) {
      setError('Please enter a tournament or league name.');
      return;
    }

    const bestW = parseOptionalInt(bowlBestW);
    const bestR = parseOptionalInt(bowlBestR);

    const batting: NullableBattingCareerStats = cleanNullableRecord<NullableBattingCareerStats>({
      matches: parseOptionalInt(batM),
      innings: parseOptionalInt(batInn),
      runs: parseOptionalInt(batRuns),
      ballsFaced: parseOptionalInt(batBalls),
      highestScore: parseOptionalInt(batHS),
      highestScoreIsNotOut: batHS.trim() ? batHSNotOut : undefined,
      average: parseOptionalNum(batAvg),
      strikeRate: parseOptionalNum(batSR),
      fours: parseOptionalInt(bat4s),
      sixes: parseOptionalInt(bat6s),
      hundreds: parseOptionalInt(bat100s),
      fifties: parseOptionalInt(bat50s),
      doubleHundreds: parseOptionalInt(bat200s),
      notOuts: parseOptionalInt(batNO),
      ducks: parseOptionalInt(batDucks),
    });

    const bowling: NullableBowlingCareerStats = cleanNullableRecord<NullableBowlingCareerStats>({
      matches: parseOptionalInt(bowlM),
      innings: parseOptionalInt(bowlInn),
      balls: parseOptionalInt(bowlBalls),
      wickets: parseOptionalInt(bowlWkts),
      runsConceded: parseOptionalInt(bowlRuns),
      average: parseOptionalNum(bowlAvg),
      economy: parseOptionalNum(bowlEcon),
      strikeRate: parseOptionalNum(bowlSR),
      bestBowlingWickets: bestW,
      bestBowlingRuns: bestR,
      bestBowlingDisplay: bestW !== null && bestR !== null ? `${bestW}/${bestR}` : undefined,
      fourWickets: parseOptionalInt(bowl4W),
      fiveWickets: parseOptionalInt(bowl5W),
      tenWickets: parseOptionalInt(bowl10W),
    });

    const fielding: NullableFieldingCareerStats = cleanNullableRecord<NullableFieldingCareerStats>({
      catches: parseOptionalInt(fldCatches),
      runOuts: parseOptionalInt(fldRunOuts),
      stumpings: parseOptionalInt(fldStumpings),
    });

    const records: CareerRecordOverrides = cleanNullableRecord<CareerRecordOverrides>({
      playerOfTheMatchCount: parseOptionalInt(recPotm),
      highestPartnershipRuns: parseOptionalInt(recHighPartnerRuns),
      highestPartnershipDetail: recHighPartnerDetail.trim() || undefined,
      bestInningsFours: parseOptionalInt(recBest4s),
      bestInningsSixes: parseOptionalInt(recBest6s),
      highestInningsStrikeRate: parseOptionalNum(recHighInnSR),
    });

    const hasAnyValues =
      Object.keys(batting).length > 0 ||
      Object.keys(bowling).length > 0 ||
      Object.keys(fielding).length > 0 ||
      Object.keys(records).length > 0;

    if (!hasAnyValues) {
      setError('Enter at least one metric to save, or use "Clear Scope" to remove existing data.');
      return;
    }

    const now = new Date().toISOString();
    const existingProfile: PlayerExternalCareerProfile = player.careerProfile ?? {
      formats: {},
      leagues: {},
    };
    const chosenSource = sourceLabel.trim() || 'Manual Career Entry';

    if (scopeType === 'format') {
      const entry: ExternalFormatCareerEntry = {
        formatKey,
        batting,
        bowling,
        fielding,
        records: Object.keys(records).length > 0 ? records : undefined,
        includedMatchIds: includedMatchIds.length > 0 ? includedMatchIds : undefined,
        source: chosenSource,
        lastUpdated: now,
      };
      await persistCareerProfile(
        {
          ...existingProfile,
          formats: {
            ...existingProfile.formats,
            [formatKey]: entry,
          },
          records: Object.keys(records).length > 0 ? {...existingProfile.records, ...records} : existingProfile.records,
          source: chosenSource,
          lastUpdated: now,
        },
        undefined,
        `Saved ${formatKey.toUpperCase()} career stats.`,
      );
    } else {
      const entry: ExternalLeagueCareerEntry = {
        leagueName: effectiveLeagueName,
        batting,
        bowling,
        fielding,
        playerOfTheMatchCount: parseOptionalInt(recPotm),
        includedMatchIds: includedMatchIds.length > 0 ? includedMatchIds : undefined,
        source: chosenSource,
        lastUpdated: now,
      };
      await persistCareerProfile(
        {
          ...existingProfile,
          leagues: {
            ...existingProfile.leagues,
            [effectiveLeagueName]: entry,
          },
          source: chosenSource,
          lastUpdated: now,
        },
        undefined,
        `Saved ${effectiveLeagueName} statistics.`,
      );
    }
  };

  const handleClearScope = async () => {
    const existingProfile = player.careerProfile;
    if (!existingProfile) return;
    const now = new Date().toISOString();

    if (scopeType === 'format') {
      const nextFormats = {...existingProfile.formats};
      delete nextFormats[formatKey];
      await persistCareerProfile(
        {...existingProfile, formats: nextFormats, lastUpdated: now},
        undefined,
        `Cleared manual/imported data for ${formatKey.toUpperCase()}.`,
      );
    } else if (effectiveLeagueName) {
      const nextLeagues = {...existingProfile.leagues};
      delete nextLeagues[effectiveLeagueName];
      await persistCareerProfile(
        {...existingProfile, leagues: nextLeagues, lastUpdated: now},
        undefined,
        `Cleared manual/imported data for ${effectiveLeagueName}.`,
      );
    }
  };

  const validateAndParseJson = (raw: string): {
    profile: PlayerExternalCareerProfile;
    bioUpdates: Partial<Player>;
    summaryText: string;
  } => {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('JSON must be an object containing "formats" and/or "leagues".');
    }

    const now = new Date().toISOString();
    const existingProfile: PlayerExternalCareerProfile = player.careerProfile ?? {
      formats: {},
      leagues: {},
    };
    const nextFormats = {...existingProfile.formats};
    const nextLeagues = {...existingProfile.leagues};
    let nextRecords = existingProfile.records ? {...existingProfile.records} : undefined;
    let formatCount = 0;
    let leagueCount = 0;

    if (parsed.formats && typeof parsed.formats === 'object' && !Array.isArray(parsed.formats)) {
      const validKeys = new Set<FormatScopeKey>(['test', 'odi', 't20i', 't20-league', 'domestic']);
      for (const [fk, rawEntry] of Object.entries(parsed.formats as Record<string, unknown>)) {
        if (!validKeys.has(fk as FormatScopeKey) || !rawEntry || typeof rawEntry !== 'object') {
          continue;
        }
        const obj = rawEntry as Partial<ExternalFormatCareerEntry>;
        nextFormats[fk as FormatScopeKey] = {
          formatKey: fk as FormatScopeKey,
          batting: (obj.batting ?? {}) as NullableBattingCareerStats,
          bowling: (obj.bowling ?? {}) as NullableBowlingCareerStats,
          fielding: (obj.fielding ?? {}) as NullableFieldingCareerStats,
          records: obj.records,
          includedMatchIds: Array.isArray(obj.includedMatchIds) ? obj.includedMatchIds : undefined,
          source: typeof obj.source === 'string' && obj.source.trim() ? obj.source : 'JSON Import',
          lastUpdated: typeof obj.lastUpdated === 'string' && obj.lastUpdated ? obj.lastUpdated : now,
        };
        formatCount += 1;
      }
    }

    if (parsed.leagues && typeof parsed.leagues === 'object' && !Array.isArray(parsed.leagues)) {
      for (const [lgName, rawEntry] of Object.entries(parsed.leagues as Record<string, unknown>)) {
        if (!lgName.trim() || !rawEntry || typeof rawEntry !== 'object') continue;
        const obj = rawEntry as Partial<ExternalLeagueCareerEntry>;
        nextLeagues[lgName.trim()] = {
          leagueName: lgName.trim(),
          batting: (obj.batting ?? {}) as NullableBattingCareerStats,
          bowling: (obj.bowling ?? {}) as NullableBowlingCareerStats,
          fielding: (obj.fielding ?? {}) as NullableFieldingCareerStats,
          playerOfTheMatchCount:
            typeof obj.playerOfTheMatchCount === 'number' ? obj.playerOfTheMatchCount : null,
          includedMatchIds: Array.isArray(obj.includedMatchIds) ? obj.includedMatchIds : undefined,
          source: typeof obj.source === 'string' && obj.source.trim() ? obj.source : 'JSON Import',
          lastUpdated: typeof obj.lastUpdated === 'string' && obj.lastUpdated ? obj.lastUpdated : now,
        };
        leagueCount += 1;
      }
    }

    if (parsed.records && typeof parsed.records === 'object' && !Array.isArray(parsed.records)) {
      nextRecords = {...nextRecords, ...(parsed.records as CareerRecordOverrides)};
    }

    if (formatCount === 0 && leagueCount === 0 && !parsed.records) {
      throw new Error(
        'No recognized "formats", "leagues", or "records" sections were found in this JSON.',
      );
    }

    const bioUpdates: Partial<Player> = {};
    if (typeof parsed.country === 'string' && parsed.country.trim()) {
      bioUpdates.country = parsed.country.trim();
    }
    if (typeof parsed.dateOfBirth === 'string' && parsed.dateOfBirth.trim()) {
      bioUpdates.dateOfBirth = parsed.dateOfBirth.trim();
    }
    if (Array.isArray(parsed.previousTeams)) {
      bioUpdates.previousTeams = parsed.previousTeams
        .map((t) => String(t).trim())
        .filter(Boolean);
    }

    return {
      profile: {
        ...existingProfile,
        formats: nextFormats,
        leagues: nextLeagues,
        records: nextRecords,
        source: 'JSON Import',
        lastUpdated: now,
      },
      bioUpdates,
      summaryText: `Valid JSON: ${formatCount} format block(s) and ${leagueCount} league block(s) ready to import.`,
    };
  };

  const handleJsonUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setJsonPreview(null);
    try {
      const content = await file.text();
      setJsonText(content);
      const result = validateAndParseJson(content);
      setJsonPreview(result.summaryText);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON file.');
    } finally {
      if (jsonFileRef.current) jsonFileRef.current.value = '';
    }
  };

  const handleImportJsonSubmit = async () => {
    setError(null);
    setFeedback(null);
    try {
      const result = validateAndParseJson(jsonText);
      await persistCareerProfile(
        result.profile,
        result.bioUpdates,
        `Imported career statistics (${result.summaryText})`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse JSON career payload.');
    }
  };

  const handleApiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setApiSelectedPreview(null);
    const q = apiSearchQuery.trim();
    if (q.length < 2) {
      setError('Enter at least 2 characters to search.');
      return;
    }
    setApiBusy(true);
    try {
      const res = await fetch(`/api/cricket/players?search=${encodeURIComponent(q)}`);
      const data = (await res.json()) as {
        configured?: boolean;
        players?: ApiSearchItem[];
        message?: string;
      };
      if (!res.ok || !data.configured) {
        setError(data.message || 'API search could not complete.');
        setApiSearchResults([]);
        return;
      }
      setApiSearchResults(data.players ?? []);
      if ((data.players ?? []).length === 0) {
        setFeedback('No matching players returned by the Approved Cricket API.');
      }
    } catch {
      setError('Network or server error while querying the Approved Cricket API.');
    } finally {
      setApiBusy(false);
    }
  };

  const handleApiSelectPlayer = async (externalId: string) => {
    setError(null);
    setFeedback(null);
    setApiBusy(true);
    try {
      const res = await fetch(`/api/cricket/player-info?id=${encodeURIComponent(externalId)}`);
      const data = (await res.json()) as {
        configured?: boolean;
        profile?: ApiPlayerPreview | null;
        message?: string;
      };
      if (!res.ok || !data.profile) {
        setError(data.message || 'Unable to load player career stats from API.');
        return;
      }
      setApiSelectedPreview(data.profile);
    } catch {
      setError('Failed to fetch player details from Approved Cricket API.');
    } finally {
      setApiBusy(false);
    }
  };

  const handleApplyApiPreview = async () => {
    if (!apiSelectedPreview) return;
    const now = new Date().toISOString();
    const existingProfile: PlayerExternalCareerProfile = player.careerProfile ?? {
      formats: {},
      leagues: {},
    };
    const nextFormats = {...existingProfile.formats};
    for (const fmtEntry of apiSelectedPreview.formats) {
      nextFormats[fmtEntry.formatKey] = {
        ...fmtEntry,
        source: fmtEntry.source || 'Approved Cricket API',
        lastUpdated: fmtEntry.lastUpdated || now,
      };
    }

    const extraBio: Partial<Player> = {};
    if (apiSelectedPreview.country && !player.country) {
      extraBio.country = apiSelectedPreview.country;
    }
    if (apiSelectedPreview.dateOfBirth && !player.dateOfBirth) {
      extraBio.dateOfBirth = apiSelectedPreview.dateOfBirth;
    }

    await persistCareerProfile(
      {
        ...existingProfile,
        formats: nextFormats,
        apiPlayerId: apiSelectedPreview.externalId,
        source: 'Approved Cricket API',
        lastUpdated: now,
      },
      extraBio,
      'Verified API statistics applied. Unavailable metrics remain Not Available.',
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-career-title"
    >
      <div className="w-full sm:max-w-3xl max-h-[93vh] rounded-t-3xl sm:rounded-2xl bg-[#0E1511] border border-white/15 flex flex-col overflow-hidden text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10 bg-[#0A100C]">
          <div>
            <h2 id="admin-career-title" className="font-display text-lg sm:text-xl font-bold">
              Manage Career Data — {player.name}
            </h2>
            <p className="text-xs text-[#8FA397]">
              Blank metrics remain &ldquo;Not Available&rdquo; (never defaulted to 0).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close career data manager"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#8FA397] hover:text-white hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Mode Tabs */}
        <div className="px-5 pt-3 pb-2 bg-[#0A100C] border-b border-white/10">
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#101713] p-1 border border-white/10">
            {(
              [
                {key: 'manual', label: 'Manual Entry', icon: Database},
                {key: 'json', label: 'JSON Import', icon: FileJson},
                {key: 'api', label: 'Cricket API', icon: Globe},
              ] as const
            ).map(({key, label, icon: Icon}) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveTab(key);
                  setError(null);
                  setFeedback(null);
                }}
                className={`min-h-[40px] rounded-lg px-2 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === key
                    ? 'bg-[#16A34A] text-white'
                    : 'text-[#9CB0A4] hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-xs sm:text-sm text-rose-300">
              {error}
            </div>
          )}
          {feedback && (
            <div className="rounded-xl bg-[#16A34A]/15 border border-[#22C55E]/40 px-4 py-3 text-xs sm:text-sm text-[#4ADE80] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {/* TAB 1: MANUAL ENTRY */}
          {activeTab === 'manual' && (
            <form onSubmit={handleSaveManual} className="space-y-5">
              {/* Target Scope Picker */}
              <div className="rounded-2xl bg-[#111914] border border-white/10 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScopeType('format')}
                    className={`min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold border transition-colors ${
                      scopeType === 'format'
                        ? 'bg-[#0D3B24] border-[#22C55E]/60 text-white'
                        : 'bg-[#080C0A] border-white/10 text-[#9CB0A4]'
                    }`}
                  >
                    By Match Format
                  </button>
                  <button
                    type="button"
                    onClick={() => setScopeType('league')}
                    className={`min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold border transition-colors ${
                      scopeType === 'league'
                        ? 'bg-[#0D3B24] border-[#22C55E]/60 text-white'
                        : 'bg-[#080C0A] border-white/10 text-[#9CB0A4]'
                    }`}
                  >
                    By Tournament / League
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {scopeType === 'format' ? (
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-[#C8D6CE]">Format Category</span>
                      <select
                        value={formatKey}
                        onChange={(e) => setFormatKey(e.target.value as FormatScopeKey)}
                        className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
                      >
                        {FORMAT_SCOPE_OPTIONS.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-[#C8D6CE]">
                          Tournament / League
                        </span>
                        <select
                          value={leagueChoice}
                          onChange={(e) => setLeagueChoice(e.target.value)}
                          className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
                        >
                          {MAJOR_CRICKET_LEAGUES.map((lg) => (
                            <option key={lg} value={lg}>
                              {lg}
                            </option>
                          ))}
                          <option value="__custom__">Custom Competition Name...</option>
                        </select>
                      </label>

                      {leagueChoice === '__custom__' && (
                        <label className="block space-y-1">
                          <span className="text-xs font-medium text-[#C8D6CE]">
                            Custom League Name
                          </span>
                          <input
                            type="text"
                            value={customLeagueName}
                            onChange={(e) => setCustomLeagueName(e.target.value)}
                            placeholder="e.g. Dhaka Premier League"
                            className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
                          />
                        </label>
                      )}
                    </>
                  )}

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-[#C8D6CE]">Data Source Label</span>
                    <input
                      type="text"
                      value={sourceLabel}
                      onChange={(e) => setSourceLabel(e.target.value)}
                      placeholder="Manual Career Entry"
                      maxLength={60}
                      className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white"
                    />
                  </label>
                </div>
              </div>

              {/* Batting Inputs */}
              <section className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9AC2AA]">
                  Batting Career Statistics
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <NumField label="Matches" value={batM} onChange={setBatM} />
                  <NumField label="Innings" value={batInn} onChange={setBatInn} />
                  <NumField label="Runs" value={batRuns} onChange={setBatRuns} />
                  <NumField label="Balls Faced" value={batBalls} onChange={setBatBalls} />
                  <NumField label="High Score" value={batHS} onChange={setBatHS} />
                  <label className="flex items-center gap-2 rounded-xl bg-[#080C0A] border border-white/15 px-3 min-h-[44px] text-xs text-[#D7E4DC] cursor-pointer mt-5">
                    <input
                      type="checkbox"
                      checked={batHSNotOut}
                      onChange={(e) => setBatHSNotOut(e.target.checked)}
                      className="w-4 h-4 accent-[#16A34A]"
                    />
                    <span>HS Not Out (*)</span>
                  </label>
                  <NumField label="Average (opt)" value={batAvg} onChange={setBatAvg} decimal />
                  <NumField label="Strike Rate (opt)" value={batSR} onChange={setBatSR} decimal />
                  <NumField label="4s" value={bat4s} onChange={setBat4s} />
                  <NumField label="6s" value={bat6s} onChange={setBat6s} />
                  <NumField label="100s" value={bat100s} onChange={setBat100s} />
                  <NumField label="50s" value={bat50s} onChange={setBat50s} />
                  <NumField label="200s" value={bat200s} onChange={setBat200s} />
                  <NumField label="Not Outs" value={batNO} onChange={setBatNO} />
                  <NumField label="Ducks (0s)" value={batDucks} onChange={setBatDucks} />
                </div>
              </section>

              {/* Bowling Inputs */}
              <section className="space-y-2.5 pt-2 border-t border-white/10">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9AC2AA]">
                  Bowling Career Statistics
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <NumField label="Matches" value={bowlM} onChange={setBowlM} />
                  <NumField label="Innings" value={bowlInn} onChange={setBowlInn} />
                  <NumField label="Total Balls Bowled" value={bowlBalls} onChange={setBowlBalls} />
                  <NumField label="Wickets" value={bowlWkts} onChange={setBowlWkts} />
                  <NumField label="Runs Conceded" value={bowlRuns} onChange={setBowlRuns} />
                  <NumField label="Bowl Avg (opt)" value={bowlAvg} onChange={setBowlAvg} decimal />
                  <NumField label="Economy (opt)" value={bowlEcon} onChange={setBowlEcon} decimal />
                  <NumField label="Bowl SR (opt)" value={bowlSR} onChange={setBowlSR} decimal />
                  <NumField label="Best Bowl Wkts" value={bowlBestW} onChange={setBowlBestW} />
                  <NumField label="Best Bowl Runs" value={bowlBestR} onChange={setBowlBestR} />
                  <NumField label="4-Wicket Hauls" value={bowl4W} onChange={setBowl4W} />
                  <NumField label="5-Wicket Hauls" value={bowl5W} onChange={setBowl5W} />
                  <NumField label="10-Wicket Matches" value={bowl10W} onChange={setBowl10W} />
                </div>
              </section>

              {/* Fielding & Records */}
              <section className="space-y-2.5 pt-2 border-t border-white/10">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9AC2AA]">
                  Fielding &amp; Career Records
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <NumField label="Catches" value={fldCatches} onChange={setFldCatches} />
                  <NumField label="Run Outs" value={fldRunOuts} onChange={setFldRunOuts} />
                  <NumField label="Stumpings" value={fldStumpings} onChange={setFldStumpings} />
                  <NumField label="Player of Match" value={recPotm} onChange={setRecPotm} />
                  <NumField
                    label="Highest Partnership"
                    value={recHighPartnerRuns}
                    onChange={setRecHighPartnerRuns}
                  />
                  <label className="sm:col-span-3 block space-y-1">
                    <span className="text-[11px] font-medium text-[#C8D6CE]">
                      Highest Partnership Detail (Partner &amp; Opponent)
                    </span>
                    <input
                      type="text"
                      value={recHighPartnerDetail}
                      onChange={(e) => setRecHighPartnerDetail(e.target.value)}
                      placeholder="e.g. 224 runs with Mahmudullah vs NZ"
                      className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-xs text-white"
                    />
                  </label>
                  <NumField label="Best Innings 4s" value={recBest4s} onChange={setRecBest4s} />
                  <NumField label="Best Innings 6s" value={recBest6s} onChange={setRecBest6s} />
                  <NumField
                    label="Best Innings SR"
                    value={recHighInnSR}
                    onChange={setRecHighInnSR}
                    decimal
                  />
                </div>
              </section>

              {/* Double-Count Guard */}
              {playerMatches.length > 0 && (
                <section className="space-y-2 pt-2 border-t border-white/10">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9AC2AA]">
                    Double-Count Protection (Optional)
                  </h3>
                  <p className="text-xs text-[#8FA397]">
                    Check any local matches below that are ALREADY counted inside these manual
                    totals so the system does not add them twice:
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-xl bg-[#080C0A] border border-white/10 p-2.5">
                    {playerMatches.map((m) => (
                      <label
                        key={m.id}
                        className="flex items-center gap-2.5 text-xs text-[#D7E4DC] cursor-pointer py-1"
                      >
                        <input
                          type="checkbox"
                          checked={includedMatchIds.includes(m.id)}
                          onChange={() => toggleIncludedMatch(m.id)}
                          className="w-4 h-4 accent-[#16A34A]"
                        />
                        <span className="truncate">
                          {m.title} ({m.format} · {m.matchDate})
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    void handleClearScope();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-xs font-semibold text-rose-300"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear This Scope</span>
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 text-sm font-semibold text-white"
                >
                  {isSaving ? 'Saving...' : 'Save Career Data'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: JSON IMPORT */}
          {activeTab === 'json' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-[#111914] border border-white/10 p-4 space-y-2 text-xs text-[#C8D6CE]">
                <p className="font-semibold text-white">Import Verified Career JSON</p>
                <p>
                  Upload or paste a JSON file with <code className="text-[#4ADE80]">formats</code>{' '}
                  (<code className="text-[#4ADE80]">test</code>,{' '}
                  <code className="text-[#4ADE80]">odi</code>,{' '}
                  <code className="text-[#4ADE80]">t20i</code>,{' '}
                  <code className="text-[#4ADE80]">t20-league</code>,{' '}
                  <code className="text-[#4ADE80]">domestic</code>) and/or{' '}
                  <code className="text-[#4ADE80]">leagues</code> (IPL, BPL, BBL, PSL, CPL, etc.).
                  Unprovided fields remain &ldquo;Not Available&rdquo;.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => jsonFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 text-xs font-semibold text-white"
                  >
                    <Upload className="w-4 h-4 text-[#22C55E]" />
                    <span>Choose .json File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const sample = JSON.stringify(SAMPLE_JSON_TEMPLATE, null, 2);
                      setJsonText(sample);
                      try {
                        setJsonPreview(validateAndParseJson(sample).summaryText);
                        setError(null);
                      } catch {
                        // ignore
                      }
                    }}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 text-xs font-semibold text-[#9AC2AA]"
                  >
                    <FileJson className="w-4 h-4" />
                    <span>Load JSON Format Example</span>
                  </button>
                  <input
                    ref={jsonFileRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => {
                      void handleJsonUploadFile(e);
                    }}
                    className="hidden"
                  />
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#C8D6CE]">JSON Payload</span>
                <textarea
                  rows={10}
                  value={jsonText}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    setJsonPreview(null);
                  }}
                  placeholder='{"formats": {"odi": {"batting": {"matches": 50, "runs": 1850}}}}'
                  className="w-full rounded-xl bg-[#080C0A] border border-white/15 p-3 font-mono text-xs text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
                />
              </label>

              {jsonPreview && (
                <div className="rounded-xl bg-[#0D3B24]/60 border border-[#22C55E]/40 px-3.5 py-2.5 text-xs text-[#4ADE80]">
                  {jsonPreview}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    try {
                      const res = validateAndParseJson(jsonText);
                      setJsonPreview(res.summaryText);
                    } catch (err) {
                      setJsonPreview(null);
                      setError(err instanceof Error ? err.message : 'Invalid JSON format.');
                    }
                  }}
                  className="min-h-[44px] px-4 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 text-xs sm:text-sm font-semibold text-white"
                >
                  Validate JSON
                </button>
                <button
                  type="button"
                  disabled={!jsonText.trim() || isSaving}
                  onClick={() => {
                    void handleImportJsonSubmit();
                  }}
                  className="min-h-[44px] px-5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-xs sm:text-sm font-semibold text-white"
                >
                  {isSaving ? 'Importing...' : 'Import into Player Profile'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: APPROVED CRICKET API SYNC */}
          {activeTab === 'api' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-[#111914] border border-white/10 p-4 space-y-1.5 text-xs">
                <div className="font-semibold text-white">
                  Approved Cricket API Status:{' '}
                  <span className={apiStatus.configured ? 'text-[#4ADE80]' : 'text-amber-300'}>
                    {!apiStatus.checked
                      ? 'Checking server...'
                      : apiStatus.configured
                        ? 'Configured'
                        : 'Not Configured / Offline'}
                  </span>
                </div>
                <p className="text-[#9CB0A4] leading-relaxed">{apiStatus.message}</p>
              </div>

              {apiStatus.configured && (
                <>
                  <form onSubmit={handleApiSearch} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-[#8FA397] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="search"
                        value={apiSearchQuery}
                        onChange={(e) => setApiSearchQuery(e.target.value)}
                        placeholder="Search player name via Approved API..."
                        className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 pl-9 pr-3 text-sm text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={apiBusy}
                      className="min-h-[44px] px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 text-sm font-semibold text-white"
                    >
                      {apiBusy ? 'Searching...' : 'Search'}
                    </button>
                  </form>

                  {apiSearchResults.length > 0 && (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-xl bg-[#080C0A] border border-white/10 p-2">
                      {apiSearchResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            void handleApiSelectPlayer(item.id);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 flex items-center justify-between text-xs sm:text-sm"
                        >
                          <span className="font-semibold text-white">{item.name}</span>
                          <span className="text-[#8FA397]">{item.country || 'Country N/A'}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {apiSelectedPreview && (
                    <div className="rounded-xl bg-[#0D3B24]/40 border border-[#22C55E]/40 p-4 space-y-3">
                      <div>
                        <h4 className="font-display text-base font-bold text-white">
                          {apiSelectedPreview.name}
                        </h4>
                        <p className="text-xs text-[#9AC2AA]">
                          {apiSelectedPreview.country || 'Country Not Available'} ·{' '}
                          {apiSelectedPreview.formats.length} format dataset(s) returned
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          void handleApplyApiPreview();
                        }}
                        className="min-h-[44px] px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-xs sm:text-sm font-semibold text-white"
                      >
                        {isSaving ? 'Applying...' : 'Apply Verified API Data'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const NumField: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
  decimal?: boolean;
}> = ({label, value, onChange, decimal}) => (
  <label className="block space-y-1">
    <span className="text-[11px] font-medium text-[#C8D6CE] truncate block">{label}</span>
    <input
      type="number"
      min={0}
      step={decimal ? '0.01' : '1'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="N/A"
      className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 font-mono text-xs sm:text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
    />
  </label>
);
