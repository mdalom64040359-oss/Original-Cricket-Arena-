import React, {useState} from 'react';
import {Calendar, ChevronRight, User, X} from 'lucide-react';
import type {PlayerStatsRecord} from '../../engine/statisticsEngine';
import type {MatchFormat, PlayerRole} from '../../types/cricket';

interface PlayerProfileModalProps {
  filteredStats: PlayerStatsRecord | null;
  careerStats: PlayerStatsRecord | null;
  hasActiveFilter: boolean;
  onClose: () => void;
  onOpenMatch: (matchId: string) => void;
  onOpenFullCareerProfile?: (playerId: string) => void;
}

const ROLE_LABELS: Record<PlayerRole, string> = {
  batsman: 'Batter',
  bowler: 'Bowler',
  'all-rounder': 'All-rounder',
  'wicket-keeper': 'Wicketkeeper',
};

const FORMAT_LABELS: Record<MatchFormat, string> = {
  T10: 'T10',
  T20: 'T20',
  ODI: 'ODI',
  TEST: 'Test',
  CUSTOM: 'Custom',
};

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  filteredStats,
  careerStats,
  hasActiveFilter,
  onClose,
  onOpenMatch,
  onOpenFullCareerProfile,
}) => {
  const [scope, setScope] = useState<'filtered' | 'career'>(
    hasActiveFilter ? 'filtered' : 'career',
  );

  const active =
    scope === 'career'
      ? (careerStats ?? filteredStats)
      : (filteredStats ?? careerStats);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-profile-title"
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] rounded-t-2xl sm:rounded-2xl bg-[#0D130F] border border-white/15 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-6 border-b border-white/10 bg-[#0A100C]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-14 h-14 rounded-xl bg-[#0D3B24] border border-white/15 flex items-center justify-center overflow-hidden shrink-0">
              {active.photoDataUrl ? (
                <img
                  src={active.photoDataUrl}
                  alt={active.playerName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-6 h-6 text-[#4ADE80]" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <h2
                  id="player-profile-title"
                  className="font-display text-lg sm:text-xl font-bold text-white truncate"
                >
                  {active.playerName}
                </h2>
                {active.jerseyNumber !== undefined && (
                  <span className="font-mono text-xs text-[#4ADE80] tabular-nums">
                    #{active.jerseyNumber}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-[#9CB0A4] truncate">
                {active.teamName} · {ROLE_LABELS[active.role]} ·{' '}
                {active.battingStyle === 'right-hand' ? 'Right-hand bat' : 'Left-hand bat'}
                {active.bowlingStyle ? ` · ${active.bowlingStyle}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenFullCareerProfile && (
              <button
                type="button"
                onClick={() => onOpenFullCareerProfile(active.playerId)}
                className="min-h-[40px] px-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-xs font-semibold text-white transition-colors whitespace-nowrap"
              >
                Full Career Profile
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close player profile"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#9CB0A4] hover:text-white hover:bg-white/5 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Career vs Filtered toggle */}
        {hasActiveFilter && careerStats && filteredStats && (
          <div className="px-4 sm:px-6 pt-3 pb-1 border-b border-white/5 bg-[#0A100C]">
            <div className="inline-grid grid-cols-2 rounded-xl bg-[#111914] p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setScope('filtered')}
                className={`px-3.5 py-1.5 min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                  scope === 'filtered'
                    ? 'bg-[#16A34A] text-white'
                    : 'text-[#9CB0A4] hover:text-white'
                }`}
              >
                Filtered Stats ({filteredStats.matches}M)
              </button>
              <button
                type="button"
                onClick={() => setScope('career')}
                className={`px-3.5 py-1.5 min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                  scope === 'career'
                    ? 'bg-[#16A34A] text-white'
                    : 'text-[#9CB0A4] hover:text-white'
                }`}
              >
                Career Total ({careerStats.matches}M)
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-5">
          {/* Batting Card */}
          <section aria-label="Batting statistics">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9AC2AA]">
                Batting Statistics
              </h3>
              <span className="font-mono text-xs text-[#8FA397] tabular-nums">
                {active.matches} {active.matches === 1 ? 'Match' : 'Matches'}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              <StatTile label="Runs" value={String(active.runs)} accent />
              <StatTile label="Innings" value={String(active.battingInnings)} />
              <StatTile label="Not Outs" value={String(active.notOuts)} />
              <StatTile label="High Score" value={active.highestScoreFormatted} />
              <StatTile
                label="Average"
                value={
                  active.battingAverage !== null ? active.battingAverage.toFixed(2) : '—'
                }
              />
              <StatTile label="Strike Rate" value={active.strikeRate.toFixed(1)} />
              <StatTile label="100s" value={String(active.hundreds)} />
              <StatTile label="50s" value={String(active.fifties)} />
              <StatTile label="4s" value={String(active.fours)} />
              <StatTile label="6s" value={String(active.sixes)} />
            </div>
          </section>

          {/* Bowling Card */}
          <section aria-label="Bowling statistics">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9AC2AA] mb-2.5">
              Bowling Statistics
            </h3>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              <StatTile label="Wickets" value={String(active.wickets)} accent />
              <StatTile label="Innings" value={String(active.bowlingInnings)} />
              <StatTile label="Overs" value={active.oversBowledFormatted} />
              <StatTile label="Maidens" value={String(active.maidens)} />
              <StatTile label="Runs" value={String(active.runsConceded)} />
              <StatTile label="Best" value={active.bestBowlingFormatted} />
              <StatTile
                label="Economy"
                value={active.bowlingInnings > 0 ? active.economy.toFixed(2) : '—'}
              />
              <StatTile
                label="Average"
                value={
                  active.bowlingAverage !== null ? active.bowlingAverage.toFixed(2) : '—'
                }
              />
              <StatTile
                label="Strike Rate"
                value={
                  active.bowlingStrikeRate !== null
                    ? active.bowlingStrikeRate.toFixed(1)
                    : '—'
                }
              />
              <StatTile label="Ducks" value={String(active.ducks)} />
            </div>
          </section>

          {/* Format Breakdown */}
          {active.formatBreakdown.length > 0 && (
            <section aria-label="Format breakdown">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9AC2AA] mb-2.5">
                By Match Format
              </h3>
              <div className="rounded-xl bg-[#101612] border border-white/10 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[#8FA397]">
                      <th className="py-2.5 px-3 font-medium">Fmt</th>
                      <th className="py-2.5 px-2 text-right font-medium">M</th>
                      <th className="py-2.5 px-2 text-right font-medium">Runs</th>
                      <th className="py-2.5 px-2 text-right font-medium">HS</th>
                      <th className="py-2.5 px-2 text-right font-medium">Avg</th>
                      <th className="py-2.5 px-2 text-right font-medium">SR</th>
                      <th className="py-2.5 px-2 text-right font-medium">Wkts</th>
                      <th className="py-2.5 px-2 text-right font-medium">Econ</th>
                      <th className="py-2.5 px-3 text-right font-medium">Best</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono tabular-nums">
                    {active.formatBreakdown.map((fb) => (
                      <tr key={fb.format} className="text-[#D7E4DC]">
                        <td className="py-2.5 px-3 font-sans font-semibold text-white">
                          {FORMAT_LABELS[fb.format]}
                        </td>
                        <td className="py-2.5 px-2 text-right">{fb.matches}</td>
                        <td className="py-2.5 px-2 text-right font-semibold text-white">
                          {fb.runs}
                        </td>
                        <td className="py-2.5 px-2 text-right">{fb.highestScoreFormatted}</td>
                        <td className="py-2.5 px-2 text-right">
                          {fb.average !== null ? fb.average.toFixed(1) : '—'}
                        </td>
                        <td className="py-2.5 px-2 text-right">{fb.strikeRate.toFixed(1)}</td>
                        <td className="py-2.5 px-2 text-right font-semibold text-[#4ADE80]">
                          {fb.wickets}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          {fb.bestBowlingFormatted !== '—' ? fb.economy.toFixed(2) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">{fb.bestBowlingFormatted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Match-by-Match Performance */}
          <section aria-label="Match-by-match performance">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9AC2AA] mb-2.5">
              Match-by-Match Performance ({active.matchPerformances.length})
            </h3>

            {active.matchPerformances.length === 0 ? (
              <div className="rounded-xl bg-[#101612] border border-white/10 p-4 text-xs text-[#8FA397]">
                No innings recorded under the selected filter.
              </div>
            ) : (
              <div className="space-y-2.5">
                {active.matchPerformances.map((mp) => (
                  <button
                    key={mp.matchId}
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenMatch(mp.matchId);
                    }}
                    className="w-full text-left rounded-xl bg-[#101612] hover:bg-[#152019] border border-white/10 p-3.5 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#9CB0A4]">
                        <span className="font-semibold text-white">
                          {mp.teamShortName} vs {mp.opponentShortName}
                        </span>
                        <span>· {FORMAT_LABELS[mp.format]}</span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <Calendar className="w-3 h-3" />
                          {mp.matchDate}
                        </span>
                        {mp.tournamentName && (
                          <span className="text-[#9AC2AA] truncate">
                            · {mp.tournamentName}
                          </span>
                        )}
                      </div>

                      {mp.battingEntries.length > 0 && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          {mp.battingEntries.map((be) => (
                            <span
                              key={`bat-${be.inningsNumber}`}
                              className="font-mono tabular-nums text-[#E2ECE6]"
                            >
                              <span className="text-[#8FA397]">
                                Bat{mp.battingEntries.length > 1 ? ` (Inn ${be.inningsNumber})` : ''}:{' '}
                              </span>
                              <span className="font-bold text-white">
                                {be.runs}
                                {be.isOut ? '' : '*'}
                              </span>{' '}
                              <span className="text-[#9CB0A4]">({be.balls})</span>
                              {(be.fours > 0 || be.sixes > 0) && (
                                <span className="text-[#8FA397]">
                                  {' '}
                                  · {be.fours}×4, {be.sixes}×6
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {mp.bowlingEntries.length > 0 && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          {mp.bowlingEntries.map((bw) => (
                            <span
                              key={`bowl-${bw.inningsNumber}`}
                              className="font-mono tabular-nums text-[#E2ECE6]"
                            >
                              <span className="text-[#8FA397]">
                                Bowl{mp.bowlingEntries.length > 1 ? ` (Inn ${bw.inningsNumber})` : ''}:{' '}
                              </span>
                              <span className="font-bold text-[#4ADE80]">
                                {bw.wickets}/{bw.runsConceded}
                              </span>{' '}
                              <span className="text-[#9CB0A4]">
                                ({bw.oversFormatted} ov · Econ {bw.economy.toFixed(2)})
                              </span>
                            </span>
                          ))}
                        </div>
                      )}

                      {mp.resultSummary && (
                        <p className="text-[11px] text-[#8FA397] truncate">{mp.resultSummary}</p>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-[#6E8276] shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

interface StatTileProps {
  label: string;
  value: string;
  accent?: boolean;
}

const StatTile: React.FC<StatTileProps> = ({label, value, accent}) => (
  <div className="rounded-xl bg-[#101612] border border-white/10 p-2.5 sm:p-3">
    <div className="text-[11px] text-[#8FA397] truncate">{label}</div>
    <div
      className={`mt-0.5 font-mono text-base sm:text-lg font-bold tabular-nums ${
        accent ? 'text-[#4ADE80]' : 'text-white'
      }`}
    >
      {value}
    </div>
  </div>
);
