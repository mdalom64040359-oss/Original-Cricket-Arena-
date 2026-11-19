import React from 'react';
import type {Innings, Match, Player} from '../../types/cricket';
import {
  computeMatchResult,
  computeTestMatchSituation,
  getTeamPlayingXI,
  recalculateInnings,
} from '../../engine/scoringEngine';

interface ScorecardPanelProps {
  match: Match;
  innings: Innings;
  playerMap: Map<string, Player>;
  activeInningsTab?: number;
  onSelectInningsTab?: (index: number) => void;
}

export const ScorecardPanel: React.FC<ScorecardPanelProps> = ({
  match,
  innings,
  playerMap,
  activeInningsTab,
  onSelectInningsTab,
}) => {
  const battingXI = getTeamPlayingXI(match, innings.battingTeamId);
  const battingTeamName =
    innings.battingTeamId === match.teamAId ? match.teamAName : match.teamBName;

  const recalc = recalculateInnings({
    innings,
    battingXI,
    playerMap,
    format: match.format,
    oversPerInnings: match.oversPerInnings,
  });

  const battedIds = new Set(recalc.battingRows.map((r) => r.playerId));
  const yetToBat = battingXI
    .filter((id) => !battedIds.has(id))
    .map((id) => playerMap.get(id)?.name ?? 'Player');

  const isTestMatch = match.format === 'TEST';
  const testSituation = isTestMatch ? computeTestMatchSituation(match) : null;

  return (
    <div className="space-y-4">
      {/* Innings Switcher if multiple innings exist */}
      {match.innings.length > 1 && onSelectInningsTab && activeInningsTab !== undefined && (
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#080C0A] border border-white/10 w-full sm:w-fit overflow-x-auto">
          {match.innings.map((inn, idx) => {
            const label =
              inn.battingTeamId === match.teamAId ? match.teamAShortName : match.teamBShortName;
            const active = activeInningsTab === idx;
            return (
              <button
                key={inn.inningsNumber}
                type="button"
                onClick={() => onSelectInningsTab(idx)}
                className={`flex-1 sm:flex-none px-4 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active ? 'bg-[#0D3B24] text-white' : 'text-[#9CB0A4] hover:text-white'
                }`}
              >
                Inn {inn.inningsNumber}: {label}
                {inn.declared ? ' (d)' : ''}
                {inn.followOnEnforced ? ' (f/o)' : ''}
              </button>
            );
          })}
        </div>
      )}

      {/* Match Summary Banner */}
      <div className="rounded-2xl bg-[#0D3B24]/50 border border-[#22C55E]/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-[#9AC2AA]">
            {battingTeamName} · Innings {innings.inningsNumber}
            {innings.declared ? ' · Declared' : ''}
            {innings.followOnEnforced ? ' · Follow-On' : ''}
          </div>
          <div className="mt-0.5 font-mono text-2xl font-bold text-white tabular-nums">
            {recalc.runs}/{recalc.wickets}
            {innings.declared ? 'd' : ''}{' '}
            <span className="text-sm font-normal text-[#C8D6CE]">
              ({recalc.oversFormatted} Ov · CRR {recalc.currentRunRate.toFixed(2)})
            </span>
          </div>
        </div>

        <div className="text-xs sm:text-sm font-semibold text-[#4ADE80]">
          {match.status === 'completed'
            ? match.resultSummary || computeMatchResult(match)
            : isTestMatch && testSituation
              ? `Day ${match.testCurrentDay ?? 1}/${match.testMaxDays ?? 5} · ${testSituation.leadDeficitText}`
              : recalc.targetRuns !== undefined
                ? `Target ${recalc.targetRuns} · Need ${recalc.runsRemaining} runs`
                : `${match.format} · ${match.oversPerInnings} Overs`}
        </div>
      </div>

      {/* Batting Scorecard */}
      <section className="rounded-2xl bg-[#101612] border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-white">Batting Scorecard</h3>
          <span className="text-xs font-mono text-[#9CB0A4] tabular-nums">
            {recalc.totalDeliveries} Deliveries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[#8FA397] text-xs">
                <th className="py-2.5 px-4 font-medium">Batter</th>
                <th className="py-2.5 px-2 text-right font-medium">R</th>
                <th className="py-2.5 px-2 text-right font-medium">B</th>
                <th className="py-2.5 px-2 text-right font-medium">4s</th>
                <th className="py-2.5 px-2 text-right font-medium">6s</th>
                <th className="py-2.5 px-4 text-right font-medium">SR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recalc.battingRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-center text-xs text-[#8FA397]">
                    No deliveries faced in this innings yet.
                  </td>
                </tr>
              ) : (
                recalc.battingRows.map((row) => (
                  <tr key={row.playerId} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-white">
                        {row.name}
                        {row.playerId === recalc.derivedStrikerId && !row.isOut ? ' *' : ''}
                      </div>
                      <div className="text-[11px] text-[#8FA397]">{row.dismissalText}</div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-white tabular-nums">
                      {row.runs}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-[#C8D6CE] tabular-nums">
                      {row.balls}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-[#9CB0A4] tabular-nums">
                      {row.fours}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-[#9CB0A4] tabular-nums">
                      {row.sixes}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-[#9AC2AA] tabular-nums">
                      {row.strikeRate.toFixed(1)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Extras Breakdown */}
        <div className="px-4 py-3 border-t border-white/10 bg-[#0B100D] flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-[#C8D6CE]">Extras</span>
          <span className="font-mono text-white tabular-nums">
            {recalc.extras.total}{' '}
            <span className="text-[#8FA397]">
              (wd {recalc.extras.wides}, nb {recalc.extras.noBalls}, b {recalc.extras.byes}, lb{' '}
              {recalc.extras.legByes}
              {recalc.extras.penalty > 0 ? `, pen ${recalc.extras.penalty}` : ''})
            </span>
          </span>
        </div>

        {yetToBat.length > 0 && (
          <div className="px-4 py-3 border-t border-white/10 text-xs text-[#9CB0A4]">
            <span className="font-semibold text-[#C8D6CE]">Yet to Bat: </span>
            <span>{yetToBat.join(', ')}</span>
          </div>
        )}
      </section>

      {/* Bowling Scorecard */}
      <section className="rounded-2xl bg-[#101612] border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="font-display text-base font-bold text-white">Bowling Scorecard</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[#8FA397] text-xs">
                <th className="py-2.5 px-4 font-medium">Bowler</th>
                <th className="py-2.5 px-2 text-right font-medium">O</th>
                <th className="py-2.5 px-2 text-right font-medium">M</th>
                <th className="py-2.5 px-2 text-right font-medium">R</th>
                <th className="py-2.5 px-2 text-right font-medium">W</th>
                <th className="py-2.5 px-4 text-right font-medium">Econ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recalc.bowlingRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-center text-xs text-[#8FA397]">
                    No overs bowled in this innings yet.
                  </td>
                </tr>
              ) : (
                recalc.bowlingRows.map((row) => (
                  <tr key={row.playerId} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 px-4 font-semibold text-white">
                      {row.name}
                      {row.playerId === recalc.derivedBowlerId ? ' *' : ''}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-[#C8D6CE] tabular-nums">
                      {row.oversFormatted}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-[#9CB0A4] tabular-nums">
                      {row.maidens}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-white tabular-nums">
                      {row.runsConceded}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-[#4ADE80] tabular-nums">
                      {row.wickets}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-[#9AC2AA] tabular-nums">
                      {row.economy.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Fall of Wickets & Partnerships */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl bg-[#101612] border border-white/10 p-4 space-y-2.5">
          <h3 className="font-display text-base font-bold text-white">Fall of Wickets</h3>
          {recalc.fallOfWickets.length === 0 ? (
            <p className="text-xs text-[#8FA397]">No wickets fallen yet.</p>
          ) : (
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-[#D7E4DC]">
              {recalc.fallOfWickets.map((fow) => (
                <span key={fow.wicketNumber} className="font-mono tabular-nums">
                  <strong className="text-white">
                    {fow.wicketNumber}-{fow.score}
                  </strong>{' '}
                  ({fow.playerName}, {fow.overs} ov)
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-[#101612] border border-white/10 p-4 space-y-2.5">
          <h3 className="font-display text-base font-bold text-white">Partnerships</h3>
          {recalc.partnerships.length === 0 ? (
            <p className="text-xs text-[#8FA397]">No partnerships recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {recalc.partnerships.map((p) => (
                <div
                  key={p.index}
                  className="flex items-center justify-between gap-2 text-xs border-b border-white/5 pb-1.5 last:border-0 last:pb-0"
                >
                  <span className="text-[#D7E4DC] truncate">
                    {p.batter1Name} &amp; {p.batter2Name}
                    {p.isCurrent ? ' (active)' : ''}
                  </span>
                  <span className="font-mono font-semibold text-white tabular-nums shrink-0">
                    {p.runs} ({p.balls})
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
