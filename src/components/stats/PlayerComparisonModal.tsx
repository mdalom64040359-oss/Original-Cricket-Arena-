import React, {useEffect, useMemo, useState} from 'react';
import {ArrowLeftRight, User, X} from 'lucide-react';
import {useUser} from '../../contexts/UserContext';
import {
  computePlayerCareerProfile,
  FORMAT_TAB_META,
  formatHighScore,
  formatLastUpdatedDisplay,
  formatStatNumber,
  formatStatText,
} from '../../engine/careerStatsEngine';
import type {CareerFormatKey, Match, Player, Team} from '../../types/cricket';
import {MAJOR_CRICKET_LEAGUES} from '../../types/cricket';

interface PlayerComparisonModalProps {
  isOpen: boolean;
  players: Player[];
  teams: Team[];
  matches: Match[];
  initialPlayerAId?: string | null;
  onClose: () => void;
}

type CompareMode = 'format' | 'league';

interface CompareRowDef {
  label: string;
  valA: string;
  valB: string;
  numA: number | null;
  numB: number | null;
  lowerIsBetter?: boolean;
}

const FORMAT_LABELS_BN: Record<CareerFormatKey, string> = {
  all: 'সব ফরম্যাট',
  test: 'টেস্ট ক্যারিয়ার',
  odi: 'ওয়ানডে ক্যারিয়ার',
  t20i: 'টি২০ আন্তর্জাতিক',
  't20-league': 'টি২০ লিগ',
  domestic: 'ঘরোয়া ক্যারিয়ার',
};

export const PlayerComparisonModal: React.FC<PlayerComparisonModalProps> = ({
  isOpen,
  players,
  teams,
  matches,
  initialPlayerAId,
  onClose,
}) => {
  const {language} = useUser();
  const isBn = language === 'bn';

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name)),
    [players],
  );

  const defaultA =
    initialPlayerAId && players.some((p) => p.id === initialPlayerAId)
      ? initialPlayerAId
      : sortedPlayers[0]?.id ?? '';
  const defaultB =
    sortedPlayers.find((p) => p.id !== defaultA)?.id ?? sortedPlayers[0]?.id ?? '';

  const [playerAId, setPlayerAId] = useState<string>(defaultA);
  const [playerBId, setPlayerBId] = useState<string>(defaultB);
  const [compareMode, setCompareMode] = useState<CompareMode>('format');
  const [selectedFormat, setSelectedFormat] = useState<CareerFormatKey>('all');
  const [selectedLeague, setSelectedLeague] = useState<string>('IPL');

  // Sync Player A/B cleanly whenever modal opens or initialPlayerAId changes
  useEffect(() => {
    if (!isOpen) return;
    const nextA =
      initialPlayerAId && players.some((p) => p.id === initialPlayerAId)
        ? initialPlayerAId
        : sortedPlayers[0]?.id ?? '';
    setPlayerAId(nextA);
    setPlayerBId((prevB) => {
      if (prevB && prevB !== nextA && players.some((p) => p.id === prevB)) {
        return prevB;
      }
      return sortedPlayers.find((p) => p.id !== nextA)?.id ?? nextA;
    });
  }, [isOpen, initialPlayerAId, players, sortedPlayers]);

  const effectiveAId = players.some((p) => p.id === playerAId) ? playerAId : defaultA;
  const effectiveBId = players.some((p) => p.id === playerBId) ? playerBId : defaultB;

  const playerA = useMemo(
    () => players.find((p) => p.id === effectiveAId) ?? null,
    [players, effectiveAId],
  );
  const playerB = useMemo(
    () => players.find((p) => p.id === effectiveBId) ?? null,
    [players, effectiveBId],
  );

  const profileA = useMemo(
    () =>
      playerA
        ? computePlayerCareerProfile({player: playerA, players, teams, matches})
        : null,
    [playerA, players, teams, matches],
  );
  const profileB = useMemo(
    () =>
      playerB
        ? computePlayerCareerProfile({player: playerB, players, teams, matches})
        : null,
    [playerB, players, teams, matches],
  );

  const availableLeagues = useMemo(() => {
    const names = new Set<string>([...MAJOR_CRICKET_LEAGUES]);
    profileA?.leagues.forEach((l) => names.add(l.leagueName));
    profileB?.leagues.forEach((l) => names.add(l.leagueName));
    return Array.from(names);
  }, [profileA, profileB]);

  if (!isOpen) return null;

  const naLabel = isBn ? 'তথ্য নেই' : 'Not Available';
  const formatDisplayVal = (val: string) =>
    val === 'Not Available' ? naLabel : val;

  const bucketA =
    profileA && compareMode === 'format'
      ? profileA.buckets[selectedFormat]
      : profileA?.leagues.find((l) => l.leagueName === selectedLeague) ?? null;
  const bucketB =
    profileB && compareMode === 'format'
      ? profileB.buckets[selectedFormat]
      : profileB?.leagues.find((l) => l.leagueName === selectedLeague) ?? null;

  const formatOversWithBalls = (oversDisp: string | null, balls: number | null) => {
    if (!oversDisp && balls === null) return naLabel;
    if (oversDisp && balls !== null) return `${oversDisp} (${balls}b)`;
    return oversDisp ?? `${balls} balls`;
  };

  const handleSwapPlayers = () => {
    setPlayerAId(effectiveBId);
    setPlayerBId(effectiveAId);
  };

  const battingRows: CompareRowDef[] =
    bucketA && bucketB
      ? [
          {
            label: isBn ? 'ম্যাচ' : 'Matches',
            valA: formatDisplayVal(formatStatNumber(bucketA.batting.matches)),
            valB: formatDisplayVal(formatStatNumber(bucketB.batting.matches)),
            numA: bucketA.batting.matches,
            numB: bucketB.batting.matches,
          },
          {
            label: isBn ? 'ইনিংস' : 'Innings',
            valA: formatDisplayVal(formatStatNumber(bucketA.batting.innings)),
            valB: formatDisplayVal(formatStatNumber(bucketB.batting.innings)),
            numA: bucketA.batting.innings,
            numB: bucketB.batting.innings,
          },
          {
            label: isBn ? 'মোট রান' : 'Runs',
            valA: formatDisplayVal(formatStatNumber(bucketA.batting.runs)),
            valB: formatDisplayVal(formatStatNumber(bucketB.batting.runs)),
            numA: bucketA.batting.runs,
            numB: bucketB.batting.runs,
          },
          {
            label: isBn ? 'বল খেলা' : 'Balls Faced',
            valA: formatDisplayVal(formatStatNumber(bucketA.batting.ballsFaced)),
            valB: formatDisplayVal(formatStatNumber(bucketB.batting.ballsFaced)),
            numA: bucketA.batting.ballsFaced,
            numB: bucketB.batting.ballsFaced,
          },
          {
            label: isBn ? 'সর্বোচ্চ রান' : 'Highest Score',
            valA: formatDisplayVal(
              formatHighScore(
                bucketA.batting.highestScore,
                bucketA.batting.highestScoreIsNotOut,
              ),
            ),
            valB: formatDisplayVal(
              formatHighScore(
                bucketB.batting.highestScore,
                bucketB.batting.highestScoreIsNotOut,
              ),
            ),
            numA: bucketA.batting.highestScore,
            numB: bucketB.batting.highestScore,
          },
          {
            label: isBn ? 'ব্যাটিং গড়' : 'Batting Average',
            valA: formatDisplayVal(formatStatNumber(bucketA.batting.average, 2)),
            valB: formatDisplayVal(formatStatNumber(bucketB.batting.average, 2)),
            numA: bucketA.batting.average,
            numB: bucketB.batting.average,
          },
          {
            label: isBn ? 'স্ট্রাইক রেট' : 'Strike Rate',
            valA: formatDisplayVal(formatStatNumber(bucketA.batting.strikeRate, 2)),
            valB: formatDisplayVal(formatStatNumber(bucketB.batting.strikeRate, 2)),
            numA: bucketA.batting.strikeRate,
            numB: bucketB.batting.strikeRate,
          },
          {
            label: isBn ? 'মোট চার (4s)' : 'Fours (4s)',
            valA: formatDisplayVal(formatStatNumber(bucketA.batting.fours)),
            valB: formatDisplayVal(formatStatNumber(bucketB.batting.fours)),
            numA: bucketA.batting.fours,
            numB: bucketB.batting.fours,
          },
          {
            label: isBn ? 'মোট ছয় (6s)' : 'Sixes (6s)',
            valA: formatDisplayVal(formatStatNumber(bucketA.batting.sixes)),
            valB: formatDisplayVal(formatStatNumber(bucketB.batting.sixes)),
            numA: bucketA.batting.sixes,
            numB: bucketB.batting.sixes,
          },
          {
            label: '100s / 50s / 200s',
            valA:
              bucketA.batting.hundreds !== null || bucketA.batting.fifties !== null
                ? `${formatDisplayVal(formatStatNumber(bucketA.batting.hundreds))} / ${formatDisplayVal(formatStatNumber(bucketA.batting.fifties))} / ${formatDisplayVal(formatStatNumber(bucketA.batting.doubleHundreds))}`
                : naLabel,
            valB:
              bucketB.batting.hundreds !== null || bucketB.batting.fifties !== null
                ? `${formatDisplayVal(formatStatNumber(bucketB.batting.hundreds))} / ${formatDisplayVal(formatStatNumber(bucketB.batting.fifties))} / ${formatDisplayVal(formatStatNumber(bucketB.batting.doubleHundreds))}`
                : naLabel,
            numA: bucketA.batting.hundreds,
            numB: bucketB.batting.hundreds,
          },
          {
            label: isBn ? 'অপরাজিত / ডাক' : 'Not Outs / Ducks',
            valA:
              bucketA.batting.notOuts !== null || bucketA.batting.ducks !== null
                ? `${formatDisplayVal(formatStatNumber(bucketA.batting.notOuts))} NO · ${formatDisplayVal(formatStatNumber(bucketA.batting.ducks))} ducks`
                : naLabel,
            valB:
              bucketB.batting.notOuts !== null || bucketB.batting.ducks !== null
                ? `${formatDisplayVal(formatStatNumber(bucketB.batting.notOuts))} NO · ${formatDisplayVal(formatStatNumber(bucketB.batting.ducks))} ducks`
                : naLabel,
            numA: null,
            numB: null,
          },
        ]
      : [];

  const bowlingRows: CompareRowDef[] =
    bucketA && bucketB
      ? [
          {
            label: isBn ? 'বোলিং ম্যাচ / ইনিংস' : 'Bowling Matches / Inn',
            valA:
              bucketA.bowling.matches !== null || bucketA.bowling.innings !== null
                ? `${formatDisplayVal(formatStatNumber(bucketA.bowling.matches))} / ${formatDisplayVal(formatStatNumber(bucketA.bowling.innings))}`
                : naLabel,
            valB:
              bucketB.bowling.matches !== null || bucketB.bowling.innings !== null
                ? `${formatDisplayVal(formatStatNumber(bucketB.bowling.matches))} / ${formatDisplayVal(formatStatNumber(bucketB.bowling.innings))}`
                : naLabel,
            numA: bucketA.bowling.innings,
            numB: bucketB.bowling.innings,
          },
          {
            label: isBn ? 'ওভার (বল)' : 'Overs (Balls)',
            valA: formatOversWithBalls(bucketA.bowling.oversDisplay, bucketA.bowling.balls),
            valB: formatOversWithBalls(bucketB.bowling.oversDisplay, bucketB.bowling.balls),
            numA: bucketA.bowling.balls,
            numB: bucketB.bowling.balls,
          },
          {
            label: isBn ? 'মোট উইকেট' : 'Wickets',
            valA: formatDisplayVal(formatStatNumber(bucketA.bowling.wickets)),
            valB: formatDisplayVal(formatStatNumber(bucketB.bowling.wickets)),
            numA: bucketA.bowling.wickets,
            numB: bucketB.bowling.wickets,
          },
          {
            label: isBn ? 'রান দেওয়া' : 'Runs Conceded',
            valA: formatDisplayVal(formatStatNumber(bucketA.bowling.runsConceded)),
            valB: formatDisplayVal(formatStatNumber(bucketB.bowling.runsConceded)),
            numA: null,
            numB: null,
          },
          {
            label: isBn ? 'বোলিং গড়' : 'Bowling Average',
            valA: formatDisplayVal(formatStatNumber(bucketA.bowling.average, 2)),
            valB: formatDisplayVal(formatStatNumber(bucketB.bowling.average, 2)),
            numA: bucketA.bowling.average,
            numB: bucketB.bowling.average,
            lowerIsBetter: true,
          },
          {
            label: isBn ? 'ইকোনমি রেট' : 'Economy Rate',
            valA: formatDisplayVal(formatStatNumber(bucketA.bowling.economy, 2)),
            valB: formatDisplayVal(formatStatNumber(bucketB.bowling.economy, 2)),
            numA: bucketA.bowling.economy,
            numB: bucketB.bowling.economy,
            lowerIsBetter: true,
          },
          {
            label: isBn ? 'বোলিং স্ট্রাইক রেট' : 'Bowling Strike Rate',
            valA: formatDisplayVal(formatStatNumber(bucketA.bowling.strikeRate, 2)),
            valB: formatDisplayVal(formatStatNumber(bucketB.bowling.strikeRate, 2)),
            numA: bucketA.bowling.strikeRate,
            numB: bucketB.bowling.strikeRate,
            lowerIsBetter: true,
          },
          {
            label: isBn ? 'সেরা বোলিং' : 'Best Bowling',
            valA: formatDisplayVal(formatStatText(bucketA.bowling.bestBowlingDisplay)),
            valB: formatDisplayVal(formatStatText(bucketB.bowling.bestBowlingDisplay)),
            numA: bucketA.bowling.bestBowlingWickets,
            numB: bucketB.bowling.bestBowlingWickets,
          },
          {
            label: '4W / 5W / 10W',
            valA:
              bucketA.bowling.fourWickets !== null ||
              bucketA.bowling.fiveWickets !== null ||
              bucketA.bowling.tenWickets !== null
                ? `${formatDisplayVal(formatStatNumber(bucketA.bowling.fourWickets))} / ${formatDisplayVal(formatStatNumber(bucketA.bowling.fiveWickets))} / ${formatDisplayVal(formatStatNumber(bucketA.bowling.tenWickets))}`
                : naLabel,
            valB:
              bucketB.bowling.fourWickets !== null ||
              bucketB.bowling.fiveWickets !== null ||
              bucketB.bowling.tenWickets !== null
                ? `${formatDisplayVal(formatStatNumber(bucketB.bowling.fourWickets))} / ${formatDisplayVal(formatStatNumber(bucketB.bowling.fiveWickets))} / ${formatDisplayVal(formatStatNumber(bucketB.bowling.tenWickets))}`
                : naLabel,
            numA: bucketA.bowling.fiveWickets,
            numB: bucketB.bowling.fiveWickets,
          },
        ]
      : [];

  const fieldingAndRecordRows: CompareRowDef[] =
    bucketA && bucketB
      ? [
          {
            label: isBn ? 'ক্যাচ' : 'Catches',
            valA: formatDisplayVal(formatStatNumber(bucketA.fielding.catches)),
            valB: formatDisplayVal(formatStatNumber(bucketB.fielding.catches)),
            numA: bucketA.fielding.catches,
            numB: bucketB.fielding.catches,
          },
          {
            label: isBn ? 'রান আউট' : 'Run Outs',
            valA: formatDisplayVal(formatStatNumber(bucketA.fielding.runOuts)),
            valB: formatDisplayVal(formatStatNumber(bucketB.fielding.runOuts)),
            numA: bucketA.fielding.runOuts,
            numB: bucketB.fielding.runOuts,
          },
          {
            label: isBn ? 'স্টাম্পিং' : 'Stumpings',
            valA: formatDisplayVal(formatStatNumber(bucketA.fielding.stumpings)),
            valB: formatDisplayVal(formatStatNumber(bucketB.fielding.stumpings)),
            numA: bucketA.fielding.stumpings,
            numB: bucketB.fielding.stumpings,
          },
          {
            label: isBn ? 'মোট ডিসমিসাল' : 'Total Dismissals',
            valA: formatDisplayVal(formatStatNumber(bucketA.fielding.totalDismissals)),
            valB: formatDisplayVal(formatStatNumber(bucketB.fielding.totalDismissals)),
            numA: bucketA.fielding.totalDismissals,
            numB: bucketB.fielding.totalDismissals,
          },
          {
            label: isBn ? 'ম্যাচসেরা (POTM)' : 'Player of the Match',
            valA: formatDisplayVal(formatStatNumber(bucketA.playerOfTheMatchCount)),
            valB: formatDisplayVal(formatStatNumber(bucketB.playerOfTheMatchCount)),
            numA: bucketA.playerOfTheMatchCount,
            numB: bucketB.playerOfTheMatchCount,
          },
          ...(compareMode === 'format' &&
          'highestPartnershipRuns' in bucketA &&
          'highestPartnershipRuns' in bucketB
            ? [
                {
                  label: isBn ? 'সর্বোচ্চ পার্টনারশিপ' : 'Highest Partnership',
                  valA: formatDisplayVal(formatStatNumber(bucketA.highestPartnershipRuns)),
                  valB: formatDisplayVal(formatStatNumber(bucketB.highestPartnershipRuns)),
                  numA: bucketA.highestPartnershipRuns,
                  numB: bucketB.highestPartnershipRuns,
                },
              ]
            : []),
        ]
      : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-compare-title"
    >
      <div className="w-full sm:max-w-4xl max-h-[93vh] rounded-t-3xl sm:rounded-2xl bg-[#0D130F] border border-white/15 flex flex-col overflow-hidden text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10 bg-[#0A100C]">
          <div className="flex items-center gap-2.5">
            <ArrowLeftRight className="w-5 h-5 text-[#22C55E]" />
            <div>
              <h2 id="player-compare-title" className="font-display text-lg sm:text-xl font-bold">
                {isBn ? 'খেলোয়াড় তুলনা (Player Comparison)' : 'Player Career Comparison'}
              </h2>
              <p className="text-xs text-[#8FA397]">
                {isBn
                  ? 'যেকোনো দুই খেলোয়াড়ের ফরম্যাট ও লিগভিত্তিক পরিসংখ্যানের তুলনা'
                  : 'Side-by-side batting, bowling, fielding & competition breakdown'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isBn ? 'তুলনা বন্ধ করুন' : 'Close comparison'}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#8FA397] hover:text-white hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {players.length < 2 ? (
            <div className="rounded-xl bg-[#101612] border border-white/10 p-6 text-sm text-[#9CB0A4] text-center">
              {isBn
                ? 'পাশাপাশি তুলনা করতে কমপক্ষে ২ জন খেলোয়াড় নিবন্ধন করুন।'
                : 'Register at least 2 players to compare their career statistics side by side.'}
            </div>
          ) : (
            <>
              {/* Select Players & Swap */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                <PlayerPickerCard
                  label={isBn ? 'খেলোয়াড় ক' : 'Player A'}
                  selectedId={effectiveAId}
                  onChange={setPlayerAId}
                  players={sortedPlayers}
                  profile={profileA}
                  isBn={isBn}
                />

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleSwapPlayers}
                    title={isBn ? 'খেলোয়াড় অদলবদল করুন' : 'Swap Players'}
                    aria-label={isBn ? 'খেলোয়াড় অদলবদল করুন' : 'Swap Player A and Player B'}
                    className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[#101612] hover:bg-[#17211B] border border-white/15 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#4ADE80] transition-colors"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span className="md:hidden">{isBn ? 'অদলবদল' : 'Swap'}</span>
                  </button>
                </div>

                <PlayerPickerCard
                  label={isBn ? 'খেলোয়াড় খ' : 'Player B'}
                  selectedId={effectiveBId}
                  onChange={setPlayerBId}
                  players={sortedPlayers}
                  profile={profileB}
                  isBn={isBn}
                />
              </div>

              {/* Format vs League Toggle */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-grid grid-cols-2 rounded-xl bg-[#101612] border border-white/10 p-1">
                    <button
                      type="button"
                      onClick={() => setCompareMode('format')}
                      className={`min-h-[38px] px-4 rounded-lg text-xs font-semibold transition-colors ${
                        compareMode === 'format'
                          ? 'bg-[#16A34A] text-white'
                          : 'text-[#9CB0A4] hover:text-white'
                      }`}
                    >
                      {isBn ? 'ফরম্যাট অনুযায়ী' : 'Format Career'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompareMode('league')}
                      className={`min-h-[38px] px-4 rounded-lg text-xs font-semibold transition-colors ${
                        compareMode === 'league'
                          ? 'bg-[#16A34A] text-white'
                          : 'text-[#9CB0A4] hover:text-white'
                      }`}
                    >
                      {isBn ? 'লিগ / টুর্নামেন্ট' : 'League / Tournament'}
                    </button>
                  </div>

                  {compareMode === 'league' && (
                    <select
                      value={selectedLeague}
                      onChange={(e) => setSelectedLeague(e.target.value)}
                      aria-label={isBn ? 'লিগ বা টুর্নামেন্ট নির্বাচন করুন' : 'Select league or tournament'}
                      className="min-h-[42px] rounded-xl bg-[#101612] border border-white/15 px-3 text-xs sm:text-sm text-white"
                    >
                      {availableLeagues.map((lg) => (
                        <option key={lg} value={lg}>
                          {lg}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {compareMode === 'format' && (
                  <div className="flex flex-wrap gap-1.5">
                    {FORMAT_TAB_META.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setSelectedFormat(tab.key)}
                        className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold border transition-colors ${
                          selectedFormat === tab.key
                            ? 'bg-[#0D3B24] border-[#22C55E] text-white'
                            : 'bg-[#101612] border-white/10 text-[#9CB0A4] hover:text-white'
                        }`}
                      >
                        {isBn ? FORMAT_LABELS_BN[tab.key] : tab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Comparison Tables */}
              {profileA && profileB && bucketA && bucketB && (
                <div className="space-y-4">
                  <CompareSection
                    title={isBn ? 'ব্যাটিং পরিসংখ্যান তুলনা' : 'Batting Career Comparison'}
                    nameA={profileA.player.name}
                    nameB={profileB.player.name}
                    metricHeading={isBn ? 'পরিসংখ্যান' : 'Metric'}
                    rows={battingRows}
                    naLabel={naLabel}
                  />
                  <CompareSection
                    title={isBn ? 'বোলিং পরিসংখ্যান তুলনা' : 'Bowling Career Comparison'}
                    nameA={profileA.player.name}
                    nameB={profileB.player.name}
                    metricHeading={isBn ? 'পরিসংখ্যান' : 'Metric'}
                    rows={bowlingRows}
                    naLabel={naLabel}
                  />
                  <CompareSection
                    title={isBn ? 'ফিল্ডিং ও পুরস্কার তুলনা' : 'Fielding & Career Awards'}
                    nameA={profileA.player.name}
                    nameB={profileB.player.name}
                    metricHeading={isBn ? 'পরিসংখ্যান' : 'Metric'}
                    rows={fieldingAndRecordRows}
                    naLabel={naLabel}
                  />

                  {/* Data Provenance Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs rounded-xl bg-[#101612] border border-white/10 p-3.5">
                    <div>
                      <div className="font-semibold text-white">
                        {profileA.player.name} — {isBn ? 'উৎস' : 'Source'}
                      </div>
                      <div className="text-[#9AC2AA] mt-0.5">{bucketA.source}</div>
                      <div className="text-[#8FA397] mt-0.5">
                        {isBn ? 'আপডেট' : 'Updated'}: {formatLastUpdatedDisplay(bucketA.lastUpdated)}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {profileB.player.name} — {isBn ? 'উৎস' : 'Source'}
                      </div>
                      <div className="text-[#9AC2AA] mt-0.5">{bucketB.source}</div>
                      <div className="text-[#8FA397] mt-0.5">
                        {isBn ? 'আপডেট' : 'Updated'}: {formatLastUpdatedDisplay(bucketB.lastUpdated)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const PlayerPickerCard: React.FC<{
  label: string;
  selectedId: string;
  onChange: (id: string) => void;
  players: Player[];
  profile: ReturnType<typeof computePlayerCareerProfile> | null;
  isBn: boolean;
}> = ({label, selectedId, onChange, players, profile, isBn}) => (
  <div className="rounded-2xl bg-[#101612] border border-white/10 p-3.5 space-y-2.5">
    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9AC2AA]">
      {label}
    </span>
    <select
      value={selectedId}
      onChange={(e) => onChange(e.target.value)}
      aria-label={`Select ${label}`}
      className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm font-semibold text-white"
    >
      {players.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {p.country ? ` (${p.country})` : ''}
        </option>
      ))}
    </select>
    {profile && (
      <div className="flex items-center gap-3 text-xs text-[#9CB0A4]">
        <div className="w-10 h-10 rounded-xl bg-[#0D3B24] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
          {profile.player.photoDataUrl ? (
            <img
              src={profile.player.photoDataUrl}
              alt={profile.player.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-4 h-4 text-[#4ADE80]" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-white font-semibold truncate">
            {profile.currentTeamName ?? (isBn ? 'দল নির্ধারিত নয়' : 'Unassigned Team')}
          </div>
          <div className="truncate">
            {profile.player.country || (isBn ? 'দেশ: তথ্য নেই' : 'Country N/A')} ·{' '}
            {profile.player.battingStyle === 'right-hand' ? 'RHB' : 'LHB'}
          </div>
        </div>
      </div>
    )}
  </div>
);

const CompareSection: React.FC<{
  title: string;
  nameA: string;
  nameB: string;
  metricHeading: string;
  rows: CompareRowDef[];
  naLabel: string;
}> = ({title, nameA, nameB, metricHeading, rows, naLabel}) => (
  <section className="rounded-2xl bg-[#101612] border border-white/10 overflow-hidden">
    <div className="px-4 py-2.5 bg-[#0A100C] border-b border-white/10 flex items-center justify-between text-xs font-semibold">
      <span className="text-[#9AC2AA] uppercase tracking-wider">{title}</span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-white/10 text-[#8FA397] text-xs">
            <th className="py-2.5 px-3 text-right font-medium w-[34%] truncate">{nameA}</th>
            <th className="py-2.5 px-2 text-center font-medium w-[32%]">{metricHeading}</th>
            <th className="py-2.5 px-3 text-left font-medium w-[34%] truncate">{nameB}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((row) => {
            const bothNum = row.numA !== null && row.numB !== null && row.numA !== row.numB;
            const aLeads =
              bothNum && (row.lowerIsBetter ? row.numA! < row.numB! : row.numA! > row.numB!);
            const bLeads =
              bothNum && (row.lowerIsBetter ? row.numB! < row.numA! : row.numB! > row.numA!);
            const aNA = row.valA === naLabel || row.valA === 'Not Available';
            const bNA = row.valB === naLabel || row.valB === 'Not Available';

            return (
              <tr key={row.label}>
                <td
                  className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                    aNA
                      ? 'text-[#6E8276] font-sans text-xs'
                      : aLeads
                        ? 'text-[#4ADE80] font-bold bg-[#16A34A]/5'
                        : 'text-white'
                  }`}
                >
                  {row.valA}
                </td>
                <td className="py-2.5 px-2 text-center text-xs text-[#9CB0A4]">{row.label}</td>
                <td
                  className={`py-2.5 px-3 text-left font-mono tabular-nums ${
                    bNA
                      ? 'text-[#6E8276] font-sans text-xs'
                      : bLeads
                        ? 'text-[#4ADE80] font-bold bg-[#16A34A]/5'
                        : 'text-white'
                  }`}
                >
                  {row.valB}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </section>
);
