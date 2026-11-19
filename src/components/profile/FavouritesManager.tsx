import React, {useMemo, useState} from 'react';
import {Heart, Radio, Search, Shield, Trophy, UserCheck} from 'lucide-react';
import {useUser} from '../../contexts/UserContext';
import {formatOvers} from '../../engine/scoringEngine';
import {
  MAJOR_CRICKET_LEAGUES,
  type AppView,
  type Match,
  type Player,
  type Team,
  type Tournament,
} from '../../types/cricket';

interface FavouritesManagerProps {
  teams: Team[];
  players: Player[];
  matches: Match[];
  tournaments: Tournament[];
  onNavigate: (view: AppView) => void;
  onOpenMatch?: (matchId: string) => void;
}

type FavTab = 'teams' | 'players' | 'leagues' | 'matches';

export const FavouritesManager: React.FC<FavouritesManagerProps> = ({
  teams,
  players,
  matches,
  tournaments,
  onNavigate,
  onOpenMatch,
}) => {
  const {
    t,
    language,
    profile,
    toggleFavouriteTeam,
    toggleFavouritePlayer,
    toggleFavouriteLeague,
    toggleFavouriteMatch,
  } = useUser();

  const [activeTab, setActiveTab] = useState<FavTab>('teams');
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();

  const allLeagueChoices = useMemo(() => {
    const localNames = tournaments.map((tr) => tr.name);
    const combined = Array.from(new Set([...localNames, ...MAJOR_CRICKET_LEAGUES]));
    if (!q) return combined;
    return combined.filter((name) => name.toLowerCase().includes(q));
  }, [tournaments, q]);

  const filteredTeams = useMemo(() => {
    if (!q) return teams;
    return teams.filter(
      (tm) => tm.name.toLowerCase().includes(q) || tm.shortName.toLowerCase().includes(q),
    );
  }, [teams, q]);

  const filteredPlayers = useMemo(() => {
    if (!q) return players;
    return players.filter(
      (pl) =>
        pl.name.toLowerCase().includes(q) ||
        (pl.country ?? '').toLowerCase().includes(q),
    );
  }, [players, q]);

  const filteredMatches = useMemo(() => {
    if (!q) return matches;
    return matches.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.teamAName.toLowerCase().includes(q) ||
        m.teamBName.toLowerCase().includes(q),
    );
  }, [matches, q]);

  const tabs: Array<{id: FavTab; label: string; count: number; icon: React.ComponentType<{className?: string}>}> = [
    {id: 'teams', label: t.panel.favTeams, count: profile.favouriteTeamIds.length, icon: Shield},
    {id: 'players', label: t.panel.favPlayers, count: profile.favouritePlayerIds.length, icon: UserCheck},
    {id: 'leagues', label: t.panel.favLeagues, count: profile.favouriteLeagues.length, icon: Trophy},
    {id: 'matches', label: t.panel.favMatches, count: profile.favouriteMatchIds.length, icon: Radio},
  ];

  return (
    <div className="rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-white">{t.panel.tabs.favourites}</h3>
          <p className="text-xs text-[#9CB0A4]">
            {language === 'bn'
              ? 'আপনার পছন্দের দল, খেলোয়াড়, লিগ ও ম্যাচ নির্বাচন করলে সেগুলোর ম্যাচ আপডেট ও নোটিফিকেশন পাবেন।'
              : 'Pick your favourite teams, players, leagues & matches to receive personalized match updates.'}
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setSearch('');
              }}
              className={`flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs font-semibold border transition-colors ${
                active
                  ? 'bg-[#0D3B24] border-[#22C55E]/40 text-white'
                  : 'bg-[#0B100D] border-white/10 text-[#9CB0A4] hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-1.5 truncate">
                <Icon className="w-3.5 h-3.5 text-[#4ADE80] shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="font-mono text-xs text-[#4ADE80] tabular-nums shrink-0">
                {item.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#8FA397] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={language === 'bn' ? 'খুঁজুন...' : 'Search to add or remove favourites...'}
          className="w-full min-h-[42px] rounded-xl bg-[#080C0A] border border-white/10 pl-10 pr-4 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
        />
      </div>

      {/* Tab Content */}
      {activeTab === 'teams' && (
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {filteredTeams.length === 0 ? (
            <div className="rounded-xl bg-[#0B100D] border border-white/10 p-4 text-xs text-[#9CB0A4] flex items-center justify-between gap-3">
              <span>
                {language === 'bn'
                  ? 'এখনো কোনো দল তৈরি করা হয়নি।'
                  : 'No teams created yet on this device.'}
              </span>
              <button
                type="button"
                onClick={() => onNavigate('teams')}
                className="text-[#4ADE80] font-semibold hover:underline shrink-0"
              >
                {t.home.cards.teams}
              </button>
            </div>
          ) : (
            filteredTeams.map((team) => {
              const isFav = profile.favouriteTeamIds.includes(team.id);
              return (
                <div
                  key={team.id}
                  className="rounded-xl bg-[#0B100D] border border-white/10 p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-lg border border-white/15 flex items-center justify-center text-[11px] font-mono font-bold text-white shrink-0"
                      style={{backgroundColor: team.primaryColor || '#0D3B24'}}
                    >
                      {team.shortName}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{team.name}</div>
                      <div className="text-xs text-[#8FA397] truncate">
                        {team.location ?? team.city ?? `${team.playerIds.length} players`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleFavouriteTeam(team.id)}
                    aria-pressed={isFav}
                    className={`min-h-[38px] px-3 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0 ${
                      isFav
                        ? 'bg-[#0D3B24] border-[#22C55E]/50 text-[#4ADE80]'
                        : 'bg-[#141D17] border-white/10 text-[#9CB0A4] hover:text-white'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-[#4ADE80]' : ''}`} />
                    <span>{isFav ? (language === 'bn' ? 'প্রিয়' : 'Saved') : (language === 'bn' ? 'যোগ করুন' : 'Add')}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'players' && (
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {filteredPlayers.length === 0 ? (
            <div className="rounded-xl bg-[#0B100D] border border-white/10 p-4 text-xs text-[#9CB0A4] flex items-center justify-between gap-3">
              <span>
                {language === 'bn'
                  ? 'এখনো কোনো খেলোয়াড় যোগ করা হয়নি।'
                  : 'No players registered yet on this device.'}
              </span>
              <button
                type="button"
                onClick={() => onNavigate('players')}
                className="text-[#4ADE80] font-semibold hover:underline shrink-0"
              >
                {t.home.cards.players}
              </button>
            </div>
          ) : (
            filteredPlayers.map((player) => {
              const isFav = profile.favouritePlayerIds.includes(player.id);
              return (
                <div
                  key={player.id}
                  className="rounded-xl bg-[#0B100D] border border-white/10 p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{player.name}</div>
                    <div className="text-xs text-[#8FA397] truncate capitalize">
                      {player.role}
                      {player.country ? ` · ${player.country}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleFavouritePlayer(player.id)}
                    aria-pressed={isFav}
                    className={`min-h-[38px] px-3 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0 ${
                      isFav
                        ? 'bg-[#0D3B24] border-[#22C55E]/50 text-[#4ADE80]'
                        : 'bg-[#141D17] border-white/10 text-[#9CB0A4] hover:text-white'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-[#4ADE80]' : ''}`} />
                    <span>{isFav ? (language === 'bn' ? 'প্রিয়' : 'Saved') : (language === 'bn' ? 'যোগ করুন' : 'Add')}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'leagues' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
          {allLeagueChoices.map((leagueName) => {
            const isFav = profile.favouriteLeagues.includes(leagueName);
            return (
              <button
                key={leagueName}
                type="button"
                onClick={() => void toggleFavouriteLeague(leagueName)}
                aria-pressed={isFav}
                className={`rounded-xl border p-3 flex items-center justify-between gap-2 text-left transition-colors ${
                  isFav
                    ? 'bg-[#0D3B24]/70 border-[#22C55E]/50 text-white'
                    : 'bg-[#0B100D] border-white/10 text-[#C8D6CE] hover:border-white/25'
                }`}
              >
                <span className="text-xs sm:text-sm font-medium truncate">{leagueName}</span>
                <Heart
                  className={`w-4 h-4 shrink-0 ${
                    isFav ? 'text-[#4ADE80] fill-[#4ADE80]' : 'text-[#6E8276]'
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'matches' && (
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {filteredMatches.length === 0 ? (
            <div className="rounded-xl bg-[#0B100D] border border-white/10 p-4 text-xs text-[#9CB0A4] flex items-center justify-between gap-3">
              <span>
                {language === 'bn'
                  ? 'এখনো কোনো ম্যাচ তৈরি করা হয়নি।'
                  : 'No matches created yet.'}
              </span>
              <button
                type="button"
                onClick={() => onNavigate('matches')}
                className="text-[#4ADE80] font-semibold hover:underline shrink-0"
              >
                {t.nav.matches}
              </button>
            </div>
          ) : (
            filteredMatches.map((match) => {
              const isFav = profile.favouriteMatchIds.includes(match.id);
              return (
                <div
                  key={match.id}
                  className="rounded-xl bg-[#0B100D] border border-white/10 p-3 flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => onOpenMatch?.(match.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="text-sm font-semibold text-white truncate">{match.title}</div>
                    <div className="text-xs text-[#8FA397] truncate">
                      {match.format} · {match.status}
                      {match.innings.length > 0
                        ? ` · ${match.innings
                            .map((inn) => `${inn.runs}/${inn.wickets} (${formatOvers(inn.legalBalls)})`)
                            .join(' | ')}`
                        : ''}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleFavouriteMatch(match.id)}
                    aria-pressed={isFav}
                    className={`min-h-[38px] px-3 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0 ${
                      isFav
                        ? 'bg-[#0D3B24] border-[#22C55E]/50 text-[#4ADE80]'
                        : 'bg-[#141D17] border-white/10 text-[#9CB0A4] hover:text-white'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-[#4ADE80]' : ''}`} />
                    <span>{isFav ? (language === 'bn' ? 'প্রিয়' : 'Saved') : (language === 'bn' ? 'যোগ করুন' : 'Add')}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
