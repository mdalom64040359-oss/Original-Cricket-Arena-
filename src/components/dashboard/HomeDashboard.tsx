import React from 'react';
import {
  ArrowRight,
  BarChart3,
  Plus,
  Radio,
  Shield,
  Trophy,
  User,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import {useUser} from '../../contexts/UserContext';
import {formatOvers} from '../../engine/scoringEngine';
import type {AppView, DashboardSummary} from '../../types/cricket';
import {CricketLogo} from '../common/CricketLogo';
import {PWAInstallButton} from '../common/PWAInstallButton';

interface HomeDashboardProps {
  summary: DashboardSummary;
  isLoading: boolean;
  isOnline: boolean;
  onNavigate: (view: AppView) => void;
  onOpenMatch?: (matchId: string) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  summary,
  isLoading,
  isOnline,
  onNavigate,
  onOpenMatch,
}) => {
  const {t, firebaseUser, profile, syncState} = useUser();

  const totalFavourites =
    profile.favouriteTeamIds.length +
    profile.favouritePlayerIds.length +
    profile.favouriteLeagues.length +
    profile.favouriteMatchIds.length;

  const quickCards: Array<{
    view: AppView;
    title: string;
    subtitle: string;
    countLabel?: string;
    icon: React.ComponentType<{className?: string}>;
    iconClassName: string;
    featured?: boolean;
  }> = [
    {
      view: 'create-match',
      title: t.home.cards.createMatch,
      subtitle: t.home.cards.createMatchSub,
      icon: Zap,
      iconClassName: 'text-amber-400',
      featured: true,
    },
    {
      view: 'matches',
      title: t.home.cards.liveMatches,
      subtitle: t.home.cards.liveMatchesSub,
      countLabel: isLoading ? '—' : `${summary.liveMatches.length} Live · ${summary.matchesCount}`,
      icon: Radio,
      iconClassName: 'text-sky-400',
    },
    {
      view: 'tournaments',
      title: t.home.cards.createTournament,
      subtitle: t.home.cards.createTournamentSub,
      countLabel: isLoading ? '—' : `${summary.tournamentsCount}`,
      icon: Trophy,
      iconClassName: 'text-amber-400',
    },
    {
      view: 'teams',
      title: t.home.cards.teams,
      subtitle: t.home.cards.teamsSub,
      countLabel: isLoading ? '—' : `${summary.teamsCount}`,
      icon: Shield,
      iconClassName: 'text-slate-200',
    },
    {
      view: 'players',
      title: t.home.cards.players,
      subtitle: t.home.cards.playersSub,
      countLabel: isLoading ? '—' : `${summary.playersCount}`,
      icon: User,
      iconClassName: 'text-sky-400',
    },
    {
      view: 'statistics',
      title: t.home.cards.statistics,
      subtitle: t.home.cards.statisticsSub,
      countLabel: isLoading ? '—' : `${summary.completedMatchesCount}`,
      icon: BarChart3,
      iconClassName: 'text-emerald-400',
    },
  ];

  const syncText =
    syncState === 'synced'
      ? t.panel.syncSynced
      : syncState === 'pending'
        ? t.panel.syncPending
        : t.panel.syncLocal;

  return (
    <div className="space-y-6">
      {/* Quick Launcher Grid: Matches Screenshot 2x3 (Mobile) / 3x2 (Desktop) */}
      <section aria-labelledby="arena-modules-heading" className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="arena-modules-heading"
            className="font-display text-lg sm:text-xl font-bold text-white tracking-tight"
          >
            {t.home.toolsTitle}
          </h2>
          <span className="text-xs text-[#9CB0A4]">{t.home.tapAnyCard}</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {quickCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.view}
                type="button"
                onClick={() => onNavigate(card.view)}
                className={`group text-left rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 min-h-[126px] active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] ${
                  card.featured
                    ? 'bg-[#0C3522] hover:bg-[#11442C] border border-[#22C55E]/50'
                    : 'bg-[#0B110D] hover:bg-[#121B15] border border-white/10 hover:border-[#22C55E]/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      card.featured
                        ? 'bg-[#144D31] border border-[#22C55E]/40'
                        : 'bg-[#101813] border border-white/10'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${card.iconClassName}`} />
                  </div>
                  {card.countLabel ? (
                    <span className="font-mono text-xs font-semibold text-[#9AC2AA] tabular-nums">
                      {card.countLabel}
                    </span>
                  ) : (
                    <ArrowRight className="w-4 h-4 text-[#4ADE80] group-hover:translate-x-0.5 transition-transform shrink-0 mt-1" />
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="font-display text-sm sm:text-base font-bold text-white tracking-tight">
                    {card.title}
                  </h3>
                  <p className="text-xs text-[#9CB0A4] leading-snug line-clamp-2">{card.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Primary Hero & Live Matches Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-stretch">
        {/* Focal Anchor: Create Match */}
        <div className="lg:col-span-7 rounded-2xl bg-gradient-to-br from-[#0D3B24] via-[#092818] to-[#0D1410] border border-[#22C55E]/25 p-5 sm:p-7 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3.5">
              <CricketLogo size={46} className="shrink-0" />
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
                  {t.appName}
                </h1>
                <p className="text-xs sm:text-sm text-[#B8D0C2]">{t.home.tagline}</p>
              </div>
            </div>

            <p className="text-sm sm:text-base text-[#D7E4DC] leading-relaxed max-w-xl">
              {t.home.heroDesc}
            </p>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-[#9AC2AA]">
              <span>T10</span>
              <span aria-hidden="true">·</span>
              <span>T20</span>
              <span aria-hidden="true">·</span>
              <span>ODI</span>
              <span aria-hidden="true">·</span>
              <span>Test</span>
              <span aria-hidden="true">·</span>
              <span>Custom Overs</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('create-match')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] active:scale-[0.98] px-6 py-3 min-h-[48px] text-sm sm:text-base font-semibold text-white transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Plus className="w-5 h-5 shrink-0" />
              <span>{t.createMatch}</span>
            </button>
            <PWAInstallButton showFallbackGuide />
          </div>
        </div>

        {/* Companion Panel: Live Matches */}
        <div className="lg:col-span-5 rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Radio className="w-5 h-5 text-[#22C55E] shrink-0" />
              <h2 className="font-display text-lg font-bold text-white tracking-tight">
                {t.home.liveMatches}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('matches')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#4ADE80] hover:text-white min-h-[40px] px-2 -mr-2 rounded-lg whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
            >
              <span>{t.home.allMatches}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {isLoading ? (
            <div className="py-8 text-sm text-[#9CB0A4]">{t.home.loadingRecords}</div>
          ) : summary.liveMatches.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center py-4 space-y-3">
              <p className="text-sm font-semibold text-white">{t.home.noLiveMatches}</p>
              <p className="text-xs sm:text-sm text-[#9CB0A4] leading-relaxed">
                {t.home.noLiveDesc}
              </p>
              <div className="pt-1 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => onNavigate('create-match')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#17211B] hover:bg-[#1E2B23] border border-white/15 px-4 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
                >
                  <span>{t.home.startNewMatch}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {summary.liveMatches.slice(0, 2).map((match) => (
                <button
                  key={match.id}
                  type="button"
                  onClick={() => (onOpenMatch ? onOpenMatch(match.id) : onNavigate('matches'))}
                  className="w-full text-left rounded-xl bg-[#161F19] hover:bg-[#1C2820] border border-white/10 p-3.5 transition-colors min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white truncate">{match.title}</span>
                    <span className="font-mono text-xs text-[#4ADE80] tabular-nums shrink-0">
                      {match.format}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[#9CB0A4] truncate">
                    {match.innings.length > 0
                      ? match.innings
                          .map((inn) => {
                            const s =
                              inn.battingTeamId === match.teamAId
                                ? match.teamAShortName
                                : match.teamBShortName;
                            return `${s} ${inn.runs}/${inn.wickets} (${formatOvers(inn.legalBalls)})`;
                          })
                          .join(' · ')
                      : `${match.teamAName} vs ${match.teamBName}`}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-[#9CB0A4]">
            <span>{t.home.totalRecordedMatches}</span>
            <span className="font-mono font-semibold text-white tabular-nums">
              {isLoading ? '—' : summary.matchesCount}
            </span>
          </div>
        </div>
      </section>

      {/* Personal Control Panel & Local Storage Strip */}
      <section className="rounded-2xl bg-[#0D120F] border border-white/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#141E18] border border-white/10 flex items-center justify-center text-[#22C55E] overflow-hidden shrink-0">
            {profile.photoDataUrl ? (
              <img
                src={profile.photoDataUrl}
                alt={profile.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm font-semibold text-white">
              <span>{t.home.localStorageTitle}</span>
              <span aria-hidden="true" className="text-[#6E8276]">
                ·
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9AC2AA]">
                {isOnline ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-[#22C55E]" />
                    <span>{t.onlineLabel}</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-300">{t.offlineLabel}</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-[#9CB0A4]">
              {firebaseUser
                ? t.home.personalBannerSignedIn
                    .replace('{name}', profile.displayName)
                    .replace('{favCount}', String(totalFavourites))
                    .replace('{syncText}', syncText)
                : t.home.personalBannerGuest}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('profile')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 px-4 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
        >
          <span>{t.home.openControlPanel}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>
    </div>
  );
};
