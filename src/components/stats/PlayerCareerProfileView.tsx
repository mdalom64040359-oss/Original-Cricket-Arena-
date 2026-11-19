import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Award,
  Calendar,
  ChevronRight,
  Database,
  Edit3,
  Globe,
  Heart,
  Shield,
  Trophy,
  User,
} from 'lucide-react';
import {useUser} from '../../contexts/UserContext';
import {
  getAllMatches,
  getAllPlayers,
  getAllTeams,
  savePlayerAndLinkTeam,
} from '../../db/database';
import {
  computePlayerCareerProfile,
  FORMAT_TAB_META,
  formatHighScore,
  formatLastUpdatedDisplay,
  formatStatNumber,
  formatStatText,
} from '../../engine/careerStatsEngine';
import type {CareerFormatKey, Match, Player, PlayerRole, Team} from '../../types/cricket';
import {PlayerFormModal} from '../teams/PlayerFormModal';
import {AdminCareerDataModal} from './AdminCareerDataModal';
import {PlayerComparisonModal} from './PlayerComparisonModal';

interface PlayerCareerProfileViewProps {
  playerId: string;
  onBack: () => void;
  onOpenMatch: (matchId: string) => void;
  onDataChanged: () => Promise<void>;
}

const ROLE_LABELS_EN: Record<PlayerRole, string> = {
  batsman: 'Batter',
  bowler: 'Bowler',
  'all-rounder': 'All-rounder',
  'wicket-keeper': 'Wicketkeeper',
};

const ROLE_LABELS_BN: Record<PlayerRole, string> = {
  batsman: 'ব্যাটার',
  bowler: 'বোলার',
  'all-rounder': 'অল-রাউন্ডার',
  'wicket-keeper': 'উইকেটরক্ষক',
};

const FORMAT_LABELS_BN: Record<CareerFormatKey, string> = {
  test: 'টেস্ট ক্যারিয়ার',
  odi: 'ওয়ানডে ক্যারিয়ার',
  t20i: 'টি২০ আন্তর্জাতিক',
  't20-league': 'টি২০ লিগ',
  domestic: 'ঘরোয়া ক্যারিয়ার',
  all: 'সব ফরম্যাট',
};

const DISPLAY_FORMAT_TABS: Array<{key: CareerFormatKey; label: string; shortLabel: string}> = [
  FORMAT_TAB_META.find((t) => t.key === 'test')!,
  FORMAT_TAB_META.find((t) => t.key === 'odi')!,
  FORMAT_TAB_META.find((t) => t.key === 't20i')!,
  FORMAT_TAB_META.find((t) => t.key === 't20-league')!,
  FORMAT_TAB_META.find((t) => t.key === 'domestic')!,
  FORMAT_TAB_META.find((t) => t.key === 'all')!,
];

export const PlayerCareerProfileView: React.FC<PlayerCareerProfileViewProps> = ({
  playerId,
  onBack,
  onOpenMatch,
  onDataChanged,
}) => {
  const {language, profile: userProfile, toggleFavouritePlayer} = useUser();
  const isBn = language === 'bn';

  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeFormat, setActiveFormat] = useState<CareerFormatKey>('all');
  const [showAllLeagues, setShowAllLeagues] = useState(true);

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [careerDataModalOpen, setCareerDataModalOpen] = useState(false);
  const [careerDataScope, setCareerDataScope] = useState<{
    scopeType: 'format' | 'league';
    formatKey: Exclude<CareerFormatKey, 'all'>;
    leagueName: string;
  }>({scopeType: 'format', formatKey: 't20i', leagueName: 'IPL'});
  const [compareOpen, setCompareOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [pList, tList, mList] = await Promise.all([
        getAllPlayers(),
        getAllTeams(),
        getAllMatches(),
      ]);
      setPlayers(pList);
      setTeams(tList);
      setMatches(mList);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const targetPlayer = useMemo(
    () => players.find((p) => p.id === playerId) ?? null,
    [players, playerId],
  );

  const profile = useMemo(() => {
    if (!targetPlayer) return null;
    return computePlayerCareerProfile({
      player: targetPlayer,
      players,
      teams,
      matches,
    });
  }, [targetPlayer, players, teams, matches]);

  const handleSaveBio = async (
    updated: Player,
    leadership: {makeCaptain?: boolean; makeViceCaptain?: boolean},
  ) => {
    await savePlayerAndLinkTeam(updated, leadership);
    await loadData();
    await onDataChanged();
  };

  const handleCareerUpdated = async () => {
    await loadData();
    await onDataChanged();
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#101612] border border-white/10 p-6 text-sm text-[#9CB0A4]">
        {isBn
          ? 'লোকাল স্টোরেজ থেকে খেলোয়াড়ের ক্যারিয়ার প্রোফাইল লোড হচ্ছে...'
          : 'Loading player career profile from local storage...'}
      </div>
    );
  }

  if (!targetPlayer || !profile) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/10 px-3.5 py-2 min-h-[44px] text-sm font-medium text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isBn ? 'ফিরে যান' : 'Back'}</span>
        </button>
        <div className="rounded-2xl bg-[#101612] border border-white/10 p-6 text-sm text-[#9CB0A4]">
          {isBn
            ? 'লোকাল ডেটাবেসে এই খেলোয়াড়ের তথ্য পাওয়া যায়নি।'
            : 'Player record not found in local database.'}
        </div>
      </div>
    );
  }

  const bucket = profile.buckets[activeFormat];
  const allBucket = profile.buckets.all;
  const isFav = userProfile.favouritePlayerIds.includes(targetPlayer.id);
  const naText = isBn ? 'তথ্য নেই' : 'Not Available';

  const fmtNum = (val: number | null | undefined, decimals = 0) => {
    const out = formatStatNumber(val, decimals);
    return out === 'Not Available' ? naText : out;
  };

  const fmtText = (val: string | null | undefined) => {
    const out = formatStatText(val);
    return out === 'Not Available' ? naText : out;
  };

  const fmtHS = (score: number | null | undefined, isNotOut?: boolean | null) => {
    const out = formatHighScore(score, isNotOut);
    return out === 'Not Available' ? naText : out;
  };

  const formatOversWithBalls = (oversDisplay: string | null, balls: number | null): string => {
    if (!oversDisplay && balls === null) return naText;
    if (oversDisplay && balls !== null) return `${oversDisplay} (${balls}b)`;
    return oversDisplay ?? `${balls} balls`;
  };

  const visibleLeagues = showAllLeagues
    ? profile.leagues
    : profile.leagues.filter((l) => l.hasData);

  const formattedDob = targetPlayer.dateOfBirth
    ? (() => {
        const d = new Date(`${targetPlayer.dateOfBirth}T00:00:00`);
        return Number.isNaN(d.getTime())
          ? targetPlayer.dateOfBirth
          : d.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'});
      })()
    : naText;

  const activeFormatLabel = isBn ? FORMAT_LABELS_BN[activeFormat] : bucket.label;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/10 px-3.5 py-2 min-h-[44px] text-sm font-medium text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isBn ? 'ফিরে যান' : 'Back'}</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void toggleFavouritePlayer(targetPlayer.id)}
            aria-pressed={isFav}
            aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 min-h-[44px] text-xs sm:text-sm font-semibold transition-colors ${
              isFav
                ? 'bg-[#0D3B24] border-[#22C55E]/60 text-[#4ADE80]'
                : 'bg-[#101612] hover:bg-[#17211B] border-white/15 text-white'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-[#4ADE80]' : ''}`} />
            <span>{isFav ? (isBn ? 'প্রিয় খেলোয়াড়' : 'Favourited') : isBn ? 'প্রিয়তে রাখুন' : 'Favourite'}</span>
          </button>

          {players.length >= 2 && (
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/15 px-3.5 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-white transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4 text-[#4ADE80]" />
              <span>{isBn ? 'তুলনা করুন' : 'Compare Player'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditProfileOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/15 px-3.5 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-white transition-colors"
          >
            <Edit3 className="w-4 h-4 text-[#22C55E]" />
            <span>{isBn ? 'প্রোফাইল এডিট' : 'Edit Bio'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCareerDataScope({
                scopeType: 'format',
                formatKey: activeFormat === 'all' ? 't20i' : activeFormat,
                leagueName: 'IPL',
              });
              setCareerDataModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] px-3.5 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-white transition-colors"
          >
            <Database className="w-4 h-4" />
            <span>{isBn ? 'ক্যারিয়ার ডেটা / ইম্পোর্ট' : 'Career Data / Import'}</span>
          </button>
        </div>
      </div>

      {/* 1. PLAYER PROFILE HERO CARD */}
      <section className="rounded-2xl bg-gradient-to-br from-[#0D3B24]/75 via-[#101612] to-[#0B100D] border border-[#22C55E]/25 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#0D3B24] border border-white/15 flex items-center justify-center overflow-hidden shrink-0">
            {targetPlayer.photoDataUrl ? (
              <img
                src={targetPlayer.photoDataUrl}
                alt={targetPlayer.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-10 h-10 text-[#4ADE80]" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {targetPlayer.name}
              </h1>
              {targetPlayer.jerseyNumber !== undefined && (
                <span className="font-mono text-sm font-bold text-[#4ADE80] tabular-nums">
                  #{targetPlayer.jerseyNumber}
                </span>
              )}
              <span className="text-xs font-medium text-[#9AC2AA]">
                · {isBn ? ROLE_LABELS_BN[targetPlayer.role] : ROLE_LABELS_EN[targetPlayer.role]}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5 text-xs sm:text-sm text-[#D7E4DC]">
              <div>
                <span className="text-[#8FA397]">{isBn ? 'দেশ: ' : 'Country: '}</span>
                <span className="font-medium text-white">{fmtText(targetPlayer.country)}</span>
              </div>
              <div>
                <span className="text-[#8FA397]">{isBn ? 'জন্মতারিখ: ' : 'Date of Birth: '}</span>
                <span className="font-medium text-white">{formattedDob}</span>
              </div>
              <div>
                <span className="text-[#8FA397]">{isBn ? 'বর্তমান দল: ' : 'Current Team: '}</span>
                <span className="font-medium text-[#4ADE80]">
                  {profile.currentTeamName ?? naText}
                </span>
              </div>
              <div>
                <span className="text-[#8FA397]">
                  {isBn ? 'ব্যাটিং স্টাইল: ' : 'Batting Style: '}
                </span>
                <span className="font-medium text-white">
                  {targetPlayer.battingStyle === 'right-hand'
                    ? isBn
                      ? 'ডানহাতি ব্যাটার'
                      : 'Right-hand Bat'
                    : isBn
                      ? 'বাঁহাতি ব্যাটার'
                      : 'Left-hand Bat'}
                </span>
              </div>
              <div>
                <span className="text-[#8FA397]">
                  {isBn ? 'বোলিং স্টাইল: ' : 'Bowling Style: '}
                </span>
                <span className="font-medium text-white">{fmtText(targetPlayer.bowlingStyle)}</span>
              </div>
              <div>
                <span className="text-[#8FA397]">{isBn ? 'ভূমিকা: ' : 'Role: '}</span>
                <span className="font-medium text-white">
                  {isBn ? ROLE_LABELS_BN[targetPlayer.role] : ROLE_LABELS_EN[targetPlayer.role]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* All-Format Career Snapshot Strip */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 pt-4 border-t border-white/10">
          <HeroMiniStat
            label={isBn ? 'মোট ম্যাচ' : 'Matches'}
            value={fmtNum(allBucket.batting.matches)}
          />
          <HeroMiniStat
            label={isBn ? 'মোট রান' : 'Runs'}
            value={fmtNum(allBucket.batting.runs)}
            accent
          />
          <HeroMiniStat
            label={isBn ? 'সর্বোচ্চ' : 'High Score'}
            value={fmtHS(allBucket.batting.highestScore, allBucket.batting.highestScoreIsNotOut)}
          />
          <HeroMiniStat
            label={isBn ? 'মোট উইকেট' : 'Wickets'}
            value={fmtNum(allBucket.bowling.wickets)}
            accent
          />
          <HeroMiniStat
            label={isBn ? 'সেরা বোলিং' : 'Best Bowl'}
            value={fmtText(allBucket.bowling.bestBowlingDisplay)}
          />
          <HeroMiniStat
            label={isBn ? 'ডিসমিসাল' : 'Dismissals'}
            value={fmtNum(allBucket.fielding.totalDismissals)}
          />
        </div>

        {/* Previous Teams & International / Domestic Career Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-white/10 text-xs">
          <div className="rounded-xl bg-[#080C0A]/80 border border-white/10 p-3.5 space-y-1">
            <div className="font-semibold text-[#9AC2AA] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>{isBn ? 'পূর্বের দলসমূহ' : 'Previous Teams'}</span>
            </div>
            <p className="text-[#D7E4DC] leading-relaxed">
              {targetPlayer.previousTeams && targetPlayer.previousTeams.length > 0
                ? targetPlayer.previousTeams.join(', ')
                : naText}
            </p>
          </div>

          <div className="rounded-xl bg-[#080C0A]/80 border border-white/10 p-3.5 space-y-1">
            <div className="font-semibold text-[#9AC2AA] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>{isBn ? 'আন্তর্জাতিক ক্যারিয়ার' : 'International Career'}</span>
            </div>
            <p className="text-[#D7E4DC] leading-relaxed">
              {fmtText(targetPlayer.internationalCareerInfo)}
            </p>
          </div>

          <div className="rounded-xl bg-[#080C0A]/80 border border-white/10 p-3.5 space-y-1">
            <div className="font-semibold text-[#9AC2AA] flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>{isBn ? 'ঘরোয়া ও লিগ ক্যারিয়ার' : 'Domestic & League Career'}</span>
            </div>
            <p className="text-[#D7E4DC] leading-relaxed">
              {fmtText(targetPlayer.domesticCareerInfo)}
            </p>
          </div>
        </div>

        {/* Overall Data Provenance Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#9CB0A4] pt-2 border-t border-white/10">
          <span>
            {isBn ? 'তথ্যের উৎস: ' : 'Source: '}
            <strong className="text-white">{profile.overallSource}</strong>
          </span>
          <span>
            {isBn ? 'সর্বশেষ আপডেট: ' : 'Last Updated: '}
            <strong className="text-white">
              {formatLastUpdatedDisplay(profile.overallLastUpdated)}
            </strong>
          </span>
        </div>
      </section>

      {/* QUICK ALL-FORMAT COMPARISON MATRIX */}
      <section
        className="rounded-2xl bg-[#101612] border border-white/10 p-4 sm:p-5 space-y-3"
        aria-label={isBn ? 'সব ফরম্যাটের সংক্ষিপ্ত পরিসংখ্যান' : 'All format quick overview'}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base sm:text-lg font-bold text-white">
            {isBn ? 'ফরম্যাট অনুযায়ী একনজরে পরিসংখ্যান' : 'Format Summary Matrix'}
          </h2>
          <span className="text-xs text-[#8FA397]">
            {isBn ? 'বিস্তারিত দেখতে যেকোনো ফরম্যাটে ট্যাপ করুন' : 'Tap any row to switch format view'}
          </span>
        </div>

        <div className="rounded-xl bg-[#0B100D] border border-white/10 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[#8FA397]">
                <th className="py-2.5 px-3 font-medium">{isBn ? 'ফরম্যাট' : 'Format'}</th>
                <th className="py-2.5 px-2 text-right font-medium">{isBn ? 'ম্যাচ' : 'M'}</th>
                <th className="py-2.5 px-2 text-right font-medium">{isBn ? 'রান' : 'Runs'}</th>
                <th className="py-2.5 px-2 text-right font-medium">{isBn ? 'সর্বোচ্চ' : 'HS'}</th>
                <th className="py-2.5 px-2 text-right font-medium">{isBn ? 'গড়' : 'Avg'}</th>
                <th className="py-2.5 px-2 text-right font-medium">SR</th>
                <th className="py-2.5 px-2 text-right font-medium">100/50</th>
                <th className="py-2.5 px-2 text-right font-medium">{isBn ? 'উইকেট' : 'Wkts'}</th>
                <th className="py-2.5 px-2 text-right font-medium">{isBn ? 'সেরা' : 'Best'}</th>
                <th className="py-2.5 px-2 text-right font-medium">Econ</th>
                <th className="py-2.5 px-3 text-right font-medium">{isBn ? 'ক্যাচ' : 'Ct'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono tabular-nums">
              {DISPLAY_FORMAT_TABS.map((tab) => {
                const rowBucket = profile.buckets[tab.key];
                const isSelected = activeFormat === tab.key;
                const na = !rowBucket.hasAnyData;
                return (
                  <tr
                    key={tab.key}
                    onClick={() => setActiveFormat(tab.key)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#0D3B24]/60' : 'hover:bg-white/5'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-sans font-semibold text-white whitespace-nowrap">
                      <span className={isSelected ? 'text-[#4ADE80]' : 'text-white'}>
                        {isBn ? FORMAT_LABELS_BN[tab.key] : tab.shortLabel}
                      </span>
                    </td>
                    <td className={`py-2.5 px-2 text-right ${na ? 'text-[#6E8276] font-sans' : 'text-[#D7E4DC]'}`}>
                      {fmtNum(rowBucket.batting.matches)}
                    </td>
                    <td className={`py-2.5 px-2 text-right ${rowBucket.batting.runs !== null ? 'font-bold text-[#4ADE80]' : 'text-[#6E8276] font-sans'}`}>
                      {fmtNum(rowBucket.batting.runs)}
                    </td>
                    <td className={`py-2.5 px-2 text-right ${rowBucket.batting.highestScore !== null ? 'text-white' : 'text-[#6E8276] font-sans'}`}>
                      {fmtHS(rowBucket.batting.highestScore, rowBucket.batting.highestScoreIsNotOut)}
                    </td>
                    <td className={`py-2.5 px-2 text-right ${rowBucket.batting.average !== null ? 'text-[#D7E4DC]' : 'text-[#6E8276] font-sans'}`}>
                      {fmtNum(rowBucket.batting.average, 2)}
                    </td>
                    <td className={`py-2.5 px-2 text-right ${rowBucket.batting.strikeRate !== null ? 'text-[#D7E4DC]' : 'text-[#6E8276] font-sans'}`}>
                      {fmtNum(rowBucket.batting.strikeRate, 1)}
                    </td>
                    <td className={`py-2.5 px-2 text-right ${rowBucket.batting.hundreds !== null || rowBucket.batting.fifties !== null ? 'text-[#D7E4DC]' : 'text-[#6E8276] font-sans'}`}>
                      {rowBucket.batting.hundreds !== null || rowBucket.batting.fifties !== null
                        ? `${fmtNum(rowBucket.batting.hundreds)}/${fmtNum(rowBucket.batting.fifties)}`
                        : naText}
                    </td>
                    <td className={`py-2.5 px-2 text-right ${rowBucket.bowling.wickets !== null ? 'font-bold text-white' : 'text-[#6E8276] font-sans'}`}>
                      {fmtNum(rowBucket.bowling.wickets)}
                    </td>
                    <td className={`py-2.5 px-2 text-right ${rowBucket.bowling.bestBowlingDisplay ? 'text-[#D7E4DC]' : 'text-[#6E8276] font-sans'}`}>
                      {fmtText(rowBucket.bowling.bestBowlingDisplay)}
                    </td>
                    <td className={`py-2.5 px-2 text-right ${rowBucket.bowling.economy !== null ? 'text-[#D7E4DC]' : 'text-[#6E8276] font-sans'}`}>
                      {fmtNum(rowBucket.bowling.economy, 2)}
                    </td>
                    <td className={`py-2.5 px-3 text-right ${rowBucket.fielding.catches !== null ? 'text-[#D7E4DC]' : 'text-[#6E8276] font-sans'}`}>
                      {fmtNum(rowBucket.fielding.catches)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. FORMAT CAREER TABS */}
      <section className="space-y-4" aria-label="Career statistics by format">
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 rounded-2xl bg-[#0D130F] border border-white/10 p-1.5"
          role="tablist"
          aria-label="Career format tabs"
        >
          {DISPLAY_FORMAT_TABS.map((tab) => {
            const active = activeFormat === tab.key;
            const tabHasData = profile.buckets[tab.key].hasAnyData;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveFormat(tab.key)}
                className={`min-h-[44px] rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors flex flex-col items-center justify-center ${
                  active
                    ? 'bg-[#16A34A] text-white'
                    : tabHasData
                      ? 'text-white hover:bg-white/5'
                      : 'text-[#8FA397] hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="truncate">
                  {isBn ? FORMAT_LABELS_BN[tab.key] : tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Format Provenance Banner */}
        <div className="rounded-xl bg-[#101612] border border-white/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[#C8D6CE]">
            <strong className="text-white">{activeFormatLabel}</strong> ·{' '}
            {isBn ? 'উৎস: ' : 'Source: '}
            <span className="text-[#4ADE80]">{bucket.source}</span>
          </span>
          <span className="text-[#8FA397]">
            {isBn ? 'সর্বশেষ আপডেট: ' : 'Last Updated: '}
            {formatLastUpdatedDisplay(bucket.lastUpdated)}
          </span>
        </div>

        {/* 2. BATTING CAREER STATISTICS */}
        <section className="rounded-2xl bg-[#101612] border border-white/10 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base sm:text-lg font-bold text-white">
              {isBn ? 'ব্যাটিং ক্যারিয়ার পরিসংখ্যান' : 'Batting Career Statistics'}
            </h2>
            <span className="text-xs text-[#8FA397]">{activeFormatLabel}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            <MetricCard label={isBn ? 'মোট ম্যাচ' : 'Matches'} value={fmtNum(bucket.batting.matches)} />
            <MetricCard label={isBn ? 'মোট ইনিংস' : 'Innings'} value={fmtNum(bucket.batting.innings)} />
            <MetricCard label={isBn ? 'মোট রান' : 'Runs'} value={fmtNum(bucket.batting.runs)} accent />
            <MetricCard label={isBn ? 'মোট বল খেলা' : 'Balls Faced'} value={fmtNum(bucket.batting.ballsFaced)} />
            <MetricCard
              label={isBn ? 'সর্বোচ্চ রান' : 'Highest Score'}
              value={fmtHS(bucket.batting.highestScore, bucket.batting.highestScoreIsNotOut)}
            />
            <MetricCard label={isBn ? 'ব্যাটিং গড়' : 'Average'} value={fmtNum(bucket.batting.average, 2)} />
            <MetricCard label={isBn ? 'স্ট্রাইক রেট' : 'Strike Rate'} value={fmtNum(bucket.batting.strikeRate, 2)} />
            <MetricCard label={isBn ? 'মোট চার (4s)' : '4s'} value={fmtNum(bucket.batting.fours)} />
            <MetricCard label={isBn ? 'মোট ছয় (6s)' : '6s'} value={fmtNum(bucket.batting.sixes)} />
            <MetricCard label={isBn ? 'সেঞ্চুরি (100s)' : '100s'} value={fmtNum(bucket.batting.hundreds)} />
            <MetricCard label={isBn ? 'হাফ সেঞ্চুরি (50s)' : '50s'} value={fmtNum(bucket.batting.fifties)} />
            <MetricCard label={isBn ? 'ডাবল সেঞ্চুরি (200s)' : '200s'} value={fmtNum(bucket.batting.doubleHundreds)} />
            <MetricCard label={isBn ? 'অপরাজিত ইনিংস' : 'Not Outs'} value={fmtNum(bucket.batting.notOuts)} />
            <MetricCard label={isBn ? 'ডাক (Duck)' : 'Ducks'} value={fmtNum(bucket.batting.ducks)} />
          </div>
        </section>

        {/* 3. BOWLING CAREER STATISTICS */}
        <section className="rounded-2xl bg-[#101612] border border-white/10 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base sm:text-lg font-bold text-white">
              {isBn ? 'বোলিং ক্যারিয়ার পরিসংখ্যান' : 'Bowling Career Statistics'}
            </h2>
            <span className="text-xs text-[#8FA397]">{activeFormatLabel}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
            <MetricCard label={isBn ? 'মোট ম্যাচ' : 'Matches'} value={fmtNum(bucket.bowling.matches)} />
            <MetricCard label={isBn ? 'মোট ইনিংস' : 'Innings'} value={fmtNum(bucket.bowling.innings)} />
            <MetricCard
              label={isBn ? 'মোট ওভার ও বল' : 'Overs (Balls)'}
              value={formatOversWithBalls(bucket.bowling.oversDisplay, bucket.bowling.balls)}
            />
            <MetricCard label={isBn ? 'মোট উইকেট' : 'Wickets'} value={fmtNum(bucket.bowling.wickets)} accent />
            <MetricCard
              label={isBn ? 'মোট রান দেওয়া' : 'Runs Conceded'}
              value={fmtNum(bucket.bowling.runsConceded)}
            />
            <MetricCard label={isBn ? 'বোলিং গড়' : 'Bowling Avg'} value={fmtNum(bucket.bowling.average, 2)} />
            <MetricCard label={isBn ? 'ইকোনমি রেট' : 'Economy Rate'} value={fmtNum(bucket.bowling.economy, 2)} />
            <MetricCard label={isBn ? 'বোলিং স্ট্রাইক রেট' : 'Strike Rate'} value={fmtNum(bucket.bowling.strikeRate, 2)} />
            <MetricCard label={isBn ? 'সেরা বোলিং ফিগার' : 'Best Bowling'} value={fmtText(bucket.bowling.bestBowlingDisplay)} />
            <MetricCard label={isBn ? '৪ উইকেট (4W)' : '4-Wicket Hauls'} value={fmtNum(bucket.bowling.fourWickets)} />
            <MetricCard label={isBn ? '৫ উইকেট (5W)' : '5-Wicket Hauls'} value={fmtNum(bucket.bowling.fiveWickets)} />
            <MetricCard label={isBn ? '১০ উইকেটের ম্যাচ' : '10W Matches'} value={fmtNum(bucket.bowling.tenWickets)} />
          </div>
        </section>

        {/* 4. FIELDING STATISTICS */}
        <section className="rounded-2xl bg-[#101612] border border-white/10 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base sm:text-lg font-bold text-white">
              {isBn ? 'ফিল্ডিং পরিসংখ্যান' : 'Fielding Statistics'}
            </h2>
            <span className="text-xs text-[#8FA397]">{activeFormatLabel}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <MetricCard label={isBn ? 'মোট ক্যাচ' : 'Catches'} value={fmtNum(bucket.fielding.catches)} />
            <MetricCard label={isBn ? 'রান আউট' : 'Run Outs'} value={fmtNum(bucket.fielding.runOuts)} />
            <MetricCard label={isBn ? 'স্টাম্পিং' : 'Stumpings'} value={fmtNum(bucket.fielding.stumpings)} />
            <MetricCard
              label={isBn ? 'মোট ডিসমিসাল' : 'Total Dismissals'}
              value={fmtNum(bucket.fielding.totalDismissals)}
              accent
            />
          </div>
        </section>
      </section>

      {/* 7. CAREER RECORDS */}
      <section className="rounded-2xl bg-[#101612] border border-white/10 p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#22C55E]" />
            <h2 className="font-display text-base sm:text-lg font-bold text-white">
              {isBn ? `ক্যারিয়ার রেকর্ডস (${activeFormatLabel})` : `Career Records (${bucket.label})`}
            </h2>
          </div>
          <span className="text-xs text-[#8FA397]">
            {isBn ? 'সব ফরম্যাট সেরা: ' : 'All-Format Best: '}
            {fmtHS(allBucket.batting.highestScore, allBucket.batting.highestScoreIsNotOut)} HS ·{' '}
            {fmtNum(allBucket.bowling.wickets)} {isBn ? 'উইকেট' : 'Wkts'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <MetricCard
            label={isBn ? 'সর্বোচ্চ ও মোট রান' : 'Highest Runs (HS / Total)'}
            value={
              bucket.batting.highestScore !== null
                ? `${fmtHS(bucket.batting.highestScore, bucket.batting.highestScoreIsNotOut)} (${fmtNum(bucket.batting.runs)} ${isBn ? 'মোট' : 'career'})`
                : fmtNum(bucket.batting.runs)
            }
          />
          <MetricCard
            label={isBn ? 'সর্বাধিক ছয় ও চার' : 'Most 6s & 4s'}
            value={
              bucket.batting.sixes !== null || bucket.batting.fours !== null
                ? `${fmtNum(bucket.batting.sixes)}×6 · ${fmtNum(bucket.batting.fours)}×4`
                : naText
            }
            sub={
              bucket.bestInningsSixes !== null || bucket.bestInningsFours !== null
                ? `${isBn ? 'এক ইনিংসে সেরা' : 'Best Inn'}: ${fmtNum(bucket.bestInningsSixes)}×6, ${fmtNum(bucket.bestInningsFours)}×4`
                : undefined
            }
          />
          <MetricCard
            label={isBn ? 'সর্বাধিক সেঞ্চুরি (100 / 200)' : 'Most Centuries (100s / 200s)'}
            value={
              bucket.batting.hundreds !== null || bucket.batting.doubleHundreds !== null
                ? `${fmtNum(bucket.batting.hundreds)} (100s) · ${fmtNum(bucket.batting.doubleHundreds)} (200s)`
                : naText
            }
          />
          <MetricCard
            label={isBn ? 'সর্বাধিক উইকেট ও সেরা বোলিং' : 'Most Wickets & Best Bowling'}
            value={
              bucket.bowling.wickets !== null || bucket.bowling.bestBowlingDisplay
                ? `${fmtNum(bucket.bowling.wickets)} ${isBn ? 'উইকেট' : 'wkts'} (${fmtText(bucket.bowling.bestBowlingDisplay)})`
                : naText
            }
          />
          <MetricCard
            label={isBn ? 'সর্বোচ্চ স্ট্রাইক রেট' : 'Highest Strike Rate'}
            value={fmtNum(bucket.highestInningsStrikeRate ?? bucket.batting.strikeRate, 2)}
            sub={
              bucket.highestInningsStrikeRate !== null && bucket.batting.strikeRate !== null
                ? `${isBn ? 'ক্যারিয়ার SR' : 'Career SR'}: ${bucket.batting.strikeRate.toFixed(2)}`
                : undefined
            }
          />
          <MetricCard
            label={isBn ? 'সর্বোচ্চ পার্টনারশিপ' : 'Highest Partnership'}
            value={fmtNum(bucket.highestPartnershipRuns)}
            sub={bucket.highestPartnershipDetail ?? undefined}
          />
          <MetricCard
            label={isBn ? 'ম্যাচসেরা পুরস্কার (POTM)' : 'Player of the Match Awards'}
            value={fmtNum(bucket.playerOfTheMatchCount)}
            accent={bucket.playerOfTheMatchCount !== null && bucket.playerOfTheMatchCount > 0}
          />
          <MetricCard
            label={isBn ? '৪ / ৫ / ১০ উইকেট হল' : '4W / 5W / 10W Hauls'}
            value={
              bucket.bowling.fourWickets !== null ||
              bucket.bowling.fiveWickets !== null ||
              bucket.bowling.tenWickets !== null
                ? `${fmtNum(bucket.bowling.fourWickets)} / ${fmtNum(bucket.bowling.fiveWickets)} / ${fmtNum(bucket.bowling.tenWickets)}`
                : naText
            }
          />
        </div>
      </section>

      {/* 6. TOURNAMENT & LEAGUE STATISTICS */}
      <section className="rounded-2xl bg-[#101612] border border-white/10 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-white">
              {isBn ? 'টুর্নামেন্ট ও লিগ পরিসংখ্যান' : 'Tournament & League Statistics'}
            </h2>
            <p className="text-xs text-[#8FA397]">
              {isBn
                ? 'IPL, BPL, BBL, PSL, CPL, LPL, SA20, ILT20, Global T20 Canada, Canada 60, European Cricket League এবং প্রতিটি আলাদা টুর্নামেন্ট'
                : 'IPL, BPL, BBL, PSL, CPL, LPL, SA20, ILT20, Global T20 Canada, Canada 60, European Cricket League & individual competitions'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAllLeagues((prev) => !prev)}
            className="min-h-[40px] px-3.5 rounded-xl bg-[#0A100C] hover:bg-[#152019] border border-white/15 text-xs font-semibold text-[#9AC2AA] shrink-0"
          >
            {showAllLeagues
              ? isBn
                ? 'শুধু ডেটা থাকা লিগ দেখান'
                : 'Show Active Only'
              : isBn
                ? `সব দেখান (${profile.leagues.length})`
                : `Show All (${profile.leagues.length})`}
          </button>
        </div>

        {visibleLeagues.length === 0 ? (
          <div className="rounded-xl bg-[#0A100C] border border-white/10 p-4 text-xs text-[#8FA397]">
            {isBn
              ? 'এখনো কোনো লিগ বা টুর্নামেন্টের পরিসংখ্যান নেই। ম্যাচ স্কোর করুন অথবা Career Data / Import থেকে যুক্ত করুন।'
              : 'No league or tournament statistics recorded yet. Score a tournament match or use Career Data / Import to add verified league figures.'}
          </div>
        ) : (
          <div className="rounded-xl bg-[#0B100D] border border-white/10 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[#8FA397]">
                  <th className="py-3 px-3 font-medium">{isBn ? 'লিগ / টুর্নামেন্ট' : 'Competition'}</th>
                  <th className="py-3 px-2 text-right font-medium">{isBn ? 'ম্যাচ' : 'M'}</th>
                  <th className="py-3 px-2 text-right font-medium">{isBn ? 'রান' : 'Runs'}</th>
                  <th className="py-3 px-2 text-right font-medium">{isBn ? 'সর্বোচ্চ' : 'HS'}</th>
                  <th className="py-3 px-2 text-right font-medium">{isBn ? 'গড়' : 'Avg'}</th>
                  <th className="py-3 px-2 text-right font-medium">SR</th>
                  <th className="py-3 px-2 text-right font-medium">{isBn ? 'উইকেট' : 'Wkts'}</th>
                  <th className="py-3 px-2 text-right font-medium">{isBn ? 'সেরা' : 'Best'}</th>
                  <th className="py-3 px-2 text-right font-medium">Econ</th>
                  <th className="py-3 px-2 text-right font-medium">{isBn ? 'ক্যাচ' : 'Catches'}</th>
                  <th className="py-3 px-2 text-right font-medium">POTM</th>
                  <th className="py-3 px-3 font-medium">{isBn ? 'উৎস ও আপডেট' : 'Source & Updated'}</th>
                  <th className="py-3 px-2 text-right font-medium">{isBn ? 'এডিট' : 'Edit'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono tabular-nums">
                {visibleLeagues.map((lg) => {
                  const na = !lg.hasData;
                  return (
                    <tr key={lg.leagueName} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-sans font-semibold text-white whitespace-nowrap">
                        {lg.leagueName}
                      </td>
                      <td className={`py-3 px-2 text-right ${na ? 'text-[#6E8276] font-sans' : 'text-[#D7E4DC]'}`}>
                        {fmtNum(lg.batting.matches)}
                      </td>
                      <td className={`py-3 px-2 text-right ${lg.batting.runs !== null ? 'font-bold text-[#4ADE80]' : 'text-[#6E8276] font-sans'}`}>
                        {fmtNum(lg.batting.runs)}
                      </td>
                      <td className={`py-3 px-2 text-right ${lg.batting.highestScore !== null ? 'text-white' : 'text-[#6E8276] font-sans'}`}>
                        {fmtHS(lg.batting.highestScore, lg.batting.highestScoreIsNotOut)}
                      </td>
                      <td className={`py-3 px-2 text-right ${lg.batting.average !== null ? 'text-[#D7E4DC]' : 'text-[#6E8276] font-sans'}`}>
                        {fmtNum(lg.batting.average, 2)}
                      </td>
                      <td className={`py-3 px-2 text-right ${lg.batting.strikeRate !== null ? 'text-[#D7E4DC]' : 'text-[#6E8276] font-sans'}`}>
                        {fmtNum(lg.batting.strikeRate, 2)}
                      </td>
                      <td className={`py-3 px-2 text-right ${lg.bowling.wickets !== null ? 'font-bold text-white' : 'text-[#6E8276] font-sans'}`}>
                        {fmtNum(lg.bowling.wickets)}
                      </td>
                      <td className={`py-3 px-2 text-right ${lg.bowling.bestBowlingDisplay ? 'text-[#D7E4DC]' : 'text-[#6E8276] font-sans'}`}>
                        {fmtText(lg.bowling.bestBowlingDisplay)}
                      </td>
                      <td className={`py-3 px-2 text-right ${lg.bowling.economy !== null ? 'text-[#D7E4DC]' : 'text-[#6E8276] font-sans'}`}>
                        {fmtNum(lg.bowling.economy, 2)}
                      </td>
                      <td className={`py-3 px-2 text-right ${lg.fielding.catches !== null ? 'text-[#D7E4DC]' : 'text-[#6E8276] font-sans'}`}>
                        {fmtNum(lg.fielding.catches)}
                      </td>
                      <td className={`py-3 px-2 text-right ${lg.playerOfTheMatchCount !== null ? 'text-[#D7E4DC]' : 'text-[#6E8276] font-sans'}`}>
                        {fmtNum(lg.playerOfTheMatchCount)}
                      </td>
                      <td className="py-3 px-3 font-sans text-[11px] text-[#8FA397] whitespace-nowrap">
                        <div>{lg.source}</div>
                        {lg.lastUpdated && (
                          <div className="text-[#6E8276]">
                            {formatLastUpdatedDisplay(lg.lastUpdated)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setCareerDataScope({
                              scopeType: 'league',
                              formatKey: 't20-league',
                              leagueName: lg.leagueName,
                            });
                            setCareerDataModalOpen(true);
                          }}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-[#9AC2AA] hover:text-white hover:bg-white/10"
                          aria-label={`Edit ${lg.leagueName} stats`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* LOCAL MATCH-BY-MATCH PERFORMANCE LOG */}
      <section className="rounded-2xl bg-[#101612] border border-white/10 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base sm:text-lg font-bold text-white">
            {isBn
              ? `লোকাল ম্যাচ-বাই-ম্যাচ পারফরম্যান্স (${profile.localMatchLogs.length})`
              : `Local Match-by-Match Performances (${profile.localMatchLogs.length})`}
          </h2>
          <span className="text-xs text-[#8FA397]">
            {isBn ? 'উৎস: লোকাল ম্যাচ রেকর্ড' : 'Source: Local Match Records'}
          </span>
        </div>

        {profile.localMatchLogs.length === 0 ? (
          <div className="rounded-xl bg-[#0A100C] border border-white/10 p-4 text-xs text-[#8FA397]">
            {isBn
              ? `${targetPlayer.name}-এর জন্য এখনো কোনো লোকাল স্কোর করা ম্যাচ নেই।`
              : `No local scored matches recorded for ${targetPlayer.name} yet.`}
          </div>
        ) : (
          <div className="space-y-2">
            {profile.localMatchLogs.map((log) => (
              <button
                key={log.matchId}
                type="button"
                onClick={() => onOpenMatch(log.matchId)}
                className="w-full text-left rounded-xl bg-[#0A100C] hover:bg-[#141E18] border border-white/10 p-3.5 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#9CB0A4]">
                    <span className="font-semibold text-white">
                      {log.teamShortName} vs {log.opponentShortName}
                    </span>
                    <span>· {log.formatLabel}</span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <Calendar className="w-3 h-3" />
                      {log.matchDate}
                    </span>
                    {log.tournamentName && (
                      <span className="text-[#9AC2AA] truncate">· {log.tournamentName}</span>
                    )}
                    {log.isPlayerOfTheMatch && (
                      <span className="font-semibold text-[#4ADE80]">
                        · {isBn ? 'ম্যাচসেরা (POTM)' : 'Player of Match'}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono tabular-nums text-[#E2ECE6]">
                    {log.battingText && <span>Bat: {log.battingText}</span>}
                    {log.bowlingText && (
                      <span className="text-[#4ADE80]">Bowl: {log.bowlingText}</span>
                    )}
                    {log.fieldingText && <span>Field: {log.fieldingText}</span>}
                  </div>

                  {log.resultSummary && (
                    <p className="text-[11px] text-[#8FA397] truncate">{log.resultSummary}</p>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-[#6E8276] shrink-0" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Modals */}
      <PlayerFormModal
        isOpen={editProfileOpen}
        editingPlayer={targetPlayer}
        teams={teams}
        existingPlayers={players}
        onSave={handleSaveBio}
        onClose={() => setEditProfileOpen(false)}
      />

      <AdminCareerDataModal
        isOpen={careerDataModalOpen}
        player={targetPlayer}
        matches={matches}
        initialScopeType={careerDataScope.scopeType}
        initialFormatKey={careerDataScope.formatKey}
        initialLeagueName={careerDataScope.leagueName}
        onPlayerUpdated={handleCareerUpdated}
        onClose={() => setCareerDataModalOpen(false)}
      />

      <PlayerComparisonModal
        isOpen={compareOpen}
        players={players}
        teams={teams}
        matches={matches}
        initialPlayerAId={targetPlayer.id}
        onClose={() => setCompareOpen(false)}
      />
    </div>
  );
};

const HeroMiniStat: React.FC<{label: string; value: string; accent?: boolean}> = ({
  label,
  value,
  accent,
}) => {
  const isNA = value === 'Not Available' || value === 'তথ্য নেই';
  return (
    <div className="rounded-xl bg-[#080C0A]/75 border border-white/10 px-3 py-2.5">
      <div className="text-[11px] text-[#8FA397] truncate">{label}</div>
      <div
        className={`mt-0.5 tabular-nums truncate ${
          isNA
            ? 'text-xs font-medium text-[#6E8276]'
            : accent
              ? 'font-mono text-sm sm:text-base font-bold text-[#4ADE80]'
              : 'font-mono text-sm sm:text-base font-bold text-white'
        }`}
      >
        {value}
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}> = ({label, value, sub, accent}) => {
  const isNA = value === 'Not Available' || value === 'তথ্য নেই';
  return (
    <div className="rounded-xl bg-[#0A100C] border border-white/10 p-3">
      <div className="text-[11px] text-[#8FA397] truncate">{label}</div>
      <div
        className={`mt-1 tabular-nums ${
          isNA
            ? 'text-xs font-medium text-[#6E8276]'
            : accent
              ? 'font-mono text-base sm:text-lg font-bold text-[#4ADE80]'
              : 'font-mono text-base sm:text-lg font-bold text-white'
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-[#9CB0A4] truncate">{sub}</div>}
    </div>
  );
};
