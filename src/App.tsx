/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {useEffect, useState} from 'react';
import {App as CapacitorApp} from '@capacitor/app';
import {Capacitor} from '@capacitor/core';
import {RefreshCw, WifiOff} from 'lucide-react';
import {ErrorBoundary} from './components/common/ErrorBoundary';
import {HomeDashboard} from './components/dashboard/HomeDashboard';
import {BottomNav} from './components/layout/BottomNav';
import {TopBar} from './components/layout/TopBar';
import {PlayerCareerProfileView} from './components/stats/PlayerCareerProfileView';
import {CreateMatchView} from './components/views/CreateMatchView';
import {MatchesView} from './components/views/MatchesView';
import {PlayersView} from './components/views/PlayersView';
import {ProfileView} from './components/views/ProfileView';
import {StatisticsView} from './components/views/StatisticsView';
import {TeamsView} from './components/views/TeamsView';
import {TournamentsView} from './components/views/TournamentsView';
import {UserProvider, useUser} from './contexts/UserContext';
import {requestPersistentStorage} from './db/database';
import {useAppSummary} from './hooks/useAppSummary';
import {useOnlineStatus} from './hooks/useOnlineStatus';
import {triggerServiceWorkerRefresh, useServiceWorkerStatus} from './pwa/swStatus';
import type {AppView, Match} from './types/cricket';
import type {AppLanguage} from './types/user';

const VALID_INITIAL_VIEWS: AppView[] = [
  'home',
  'matches',
  'create-match',
  'teams',
  'players',
  'tournaments',
  'statistics',
  'profile',
];

function getInitialViewFromUrl(): AppView {
  if (typeof window === 'undefined') return 'home';
  const param = new URLSearchParams(window.location.search).get('view') as AppView | null;
  if (param && VALID_INITIAL_VIEWS.includes(param)) {
    return param;
  }
  return 'home';
}

const VIEW_PAGE_TITLES: Record<AppLanguage, Record<AppView, string>> = {
  en: {
    home: 'Cricket Arena — Match Scoring & Tournament Management',
    matches: 'Matches & Live Scoring — Cricket Arena',
    'create-match': 'Create Match — Cricket Arena',
    teams: 'Teams & Rosters — Cricket Arena',
    players: 'Players — Cricket Arena',
    'player-profile': 'Player Career Profile & Records — Cricket Arena',
    tournaments: 'Tournaments & Points Table — Cricket Arena',
    statistics: 'Statistics & Leaderboards — Cricket Arena',
    profile: 'Personal Control Panel, Profile & Backup — Cricket Arena',
  },
  bn: {
    home: 'Cricket Arena — লাইভ স্কোরিং ও টুর্নামেন্ট প্ল্যাটফর্ম',
    matches: 'ম্যাচ ও লাইভ স্কোরিং — Cricket Arena',
    'create-match': 'নতুন ম্যাচ তৈরি — Cricket Arena',
    teams: 'দল ও স্কোয়াড — Cricket Arena',
    players: 'খেলোয়াড় তালিকা — Cricket Arena',
    'player-profile': 'খেলোয়াড় ক্যারিয়ার প্রোফাইল ও রেকর্ড — Cricket Arena',
    tournaments: 'টুর্নামেন্ট ও পয়েন্ট টেবিল — Cricket Arena',
    statistics: 'পরিসংখ্যান ও লিডারবোর্ড — Cricket Arena',
    profile: 'পার্সোনাল কন্ট্রোল প্যানেল, প্রোফাইল ও ব্যাকআপ — Cricket Arena',
  },
};

function AppShell() {
  const {t, language} = useUser();
  const [activeView, setActiveView] = useState<AppView>(getInitialViewFromUrl);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [selectedProfilePlayerId, setSelectedProfilePlayerId] = useState<string | null>(null);
  const [profileReturnView, setProfileReturnView] = useState<AppView>('players');
  const {summary, isLoading, refresh} = useAppSummary();
  const isOnline = useOnlineStatus();
  const swStatus = useServiceWorkerStatus();

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === 'bn' ? 'bn' : 'en';
    const localizedTitles = VIEW_PAGE_TITLES[language] ?? VIEW_PAGE_TITLES.en;
    document.title = localizedTitles[activeView] ?? localizedTitles.home;
  }, [activeView, language]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: {remove: () => Promise<void>} | null = null;
    void CapacitorApp.addListener('backButton', () => {
      if (activeView === 'player-profile') {
        setActiveView(profileReturnView);
        return;
      }
      if (activeView === 'matches' && selectedMatchId) {
        setSelectedMatchId(null);
        return;
      }
      if (activeView === 'create-match') {
        setEditingMatch(null);
        setActiveView('matches');
        return;
      }
      if (activeView === 'players') {
        setActiveView('teams');
        return;
      }
      if (activeView !== 'home') {
        setActiveView('home');
        return;
      }
      void CapacitorApp.minimizeApp();
    }).then((handle) => {
      listenerHandle = handle;
    });

    return () => {
      void listenerHandle?.remove();
    };
  }, [activeView, selectedMatchId, profileReturnView]);

  const handleNavigate = (view: AppView) => {
    setActiveView(view);
    if (view !== 'matches') {
      setSelectedMatchId(null);
    }
    if (view !== 'create-match') {
      setEditingMatch(null);
    }
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const handleOpenPlayerProfile = (playerId: string, returnTo?: AppView) => {
    setSelectedProfilePlayerId(playerId);
    setProfileReturnView(returnTo ?? (activeView === 'player-profile' ? profileReturnView : activeView));
    setActiveView('player-profile');
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const handleOpenMatch = (matchId: string) => {
    setSelectedMatchId(matchId);
    setEditingMatch(null);
    setActiveView('matches');
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const handleEditMatch = (match: Match) => {
    setEditingMatch(match);
    setActiveView('create-match');
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const handleMatchSaved = async (savedMatch: Match) => {
    await refresh();
    setEditingMatch(null);
    setSelectedMatchId(savedMatch.id);
    setActiveView('matches');
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const renderCurrentView = () => {
    switch (activeView) {
      case 'home':
        return (
          <HomeDashboard
            summary={summary}
            isLoading={isLoading}
            isOnline={isOnline}
            onNavigate={handleNavigate}
            onOpenMatch={handleOpenMatch}
          />
        );
      case 'matches':
        return (
          <MatchesView
            selectedMatchId={selectedMatchId}
            onSelectMatch={setSelectedMatchId}
            onEditMatch={handleEditMatch}
            onNavigate={handleNavigate}
            onDataChanged={refresh}
            onOpenPlayerProfile={(pid) => handleOpenPlayerProfile(pid, 'matches')}
          />
        );
      case 'create-match':
        return (
          <CreateMatchView
            summary={summary}
            editingMatch={editingMatch}
            onNavigate={handleNavigate}
            onMatchSaved={handleMatchSaved}
            onCancelEdit={() => {
              setEditingMatch(null);
              handleNavigate('matches');
            }}
          />
        );
      case 'teams':
        return (
          <TeamsView
            onNavigate={handleNavigate}
            onOpenMatch={handleOpenMatch}
            onOpenPlayerProfile={(pid) => handleOpenPlayerProfile(pid, 'teams')}
            onDataChanged={refresh}
          />
        );
      case 'players':
        return (
          <PlayersView
            onNavigate={handleNavigate}
            onOpenPlayerProfile={(pid) => handleOpenPlayerProfile(pid, 'players')}
            onDataChanged={refresh}
          />
        );
      case 'player-profile':
        return selectedProfilePlayerId ? (
          <PlayerCareerProfileView
            playerId={selectedProfilePlayerId}
            onBack={() => handleNavigate(profileReturnView)}
            onOpenMatch={handleOpenMatch}
            onDataChanged={refresh}
          />
        ) : (
          <PlayersView
            onNavigate={handleNavigate}
            onOpenPlayerProfile={(pid) => handleOpenPlayerProfile(pid, 'players')}
            onDataChanged={refresh}
          />
        );
      case 'tournaments':
        return (
          <TournamentsView
            onNavigate={handleNavigate}
            onOpenMatch={handleOpenMatch}
            onDataChanged={refresh}
          />
        );
      case 'statistics':
        return (
          <StatisticsView
            summary={summary}
            onNavigate={handleNavigate}
            onOpenMatch={handleOpenMatch}
            onOpenPlayerProfile={(pid) => handleOpenPlayerProfile(pid, 'statistics')}
          />
        );
      case 'profile':
        return (
          <ProfileView
            summary={summary}
            isOnline={isOnline}
            onNavigate={handleNavigate}
            onOpenMatch={handleOpenMatch}
            onDataChanged={refresh}
          />
        );
      default:
        return (
          <HomeDashboard
            summary={summary}
            isLoading={isLoading}
            isOnline={isOnline}
            onNavigate={handleNavigate}
            onOpenMatch={handleOpenMatch}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#070A08] text-white flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-[#16A34A] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
      >
        {t.skipToMain}
      </a>

      <TopBar activeView={activeView} isOnline={isOnline} onNavigate={handleNavigate} />

      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="bg-[#1A1508] border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200 flex items-center justify-center gap-2"
        >
          <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{t.offlineBanner}</span>
        </div>
      )}

      {swStatus.needRefresh && isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="bg-[#0B2618] border-b border-[#22C55E]/30 px-4 py-2 text-xs text-[#D7E4DC] flex flex-wrap items-center justify-center gap-3"
        >
          <span>
            {language === 'bn'
              ? 'Cricket Arena-এর নতুন অফলাইন সংস্করণ প্রস্তুত।'
              : 'A new offline-ready update of Cricket Arena is available.'}
          </span>
          <button
            type="button"
            onClick={() => void triggerServiceWorkerRefresh()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] px-3 py-1 font-semibold text-white transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>{language === 'bn' ? 'আপডেট করুন' : 'Update Now'}</span>
          </button>
        </div>
      )}

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-24 md:pb-12 focus:outline-none"
      >
        {renderCurrentView()}
      </main>

      <BottomNav activeView={activeView} onNavigate={handleNavigate} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <UserProvider>
        <AppShell />
      </UserProvider>
    </ErrorBoundary>
  );
}
