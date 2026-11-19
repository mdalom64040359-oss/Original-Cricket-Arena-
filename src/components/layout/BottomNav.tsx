import React from 'react';
import {Home, Radio, Shield, Trophy, User} from 'lucide-react';
import {useUser} from '../../contexts/UserContext';
import type {AppView} from '../../types/cricket';

interface BottomNavProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({activeView, onNavigate}) => {
  const {t} = useUser();

  const navItems: Array<{
    view: AppView;
    label: string;
    icon: React.ComponentType<{className?: string}>;
  }> = [
    {view: 'home', label: t.nav.home, icon: Home},
    {view: 'matches', label: t.nav.matches, icon: Radio},
    {view: 'teams', label: t.nav.teams, icon: Shield},
    {view: 'tournaments', label: t.nav.tournaments, icon: Trophy},
    {view: 'profile', label: t.nav.profile, icon: User},
  ];

  const isViewGroupActive = (tabView: AppView) => {
    if (tabView === 'matches' && activeView === 'create-match') return true;
    if (tabView === 'teams' && (activeView === 'players' || activeView === 'player-profile')) {
      return true;
    }
    return activeView === tabView;
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0F0C]/95 backdrop-blur-md border-t border-white/10 pb-safe"
      aria-label="Bottom navigation"
    >
      <div className="grid grid-cols-5 h-[62px] items-center max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isViewGroupActive(item.view);

          return (
            <button
              key={item.view}
              type="button"
              onClick={() => onNavigate(item.view)}
              className={`flex flex-col items-center justify-center min-h-[44px] w-full rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] ${
                active ? 'text-[#22C55E]' : 'text-[#8FA397] hover:text-white'
              }`}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="mt-1 text-[10.5px] font-medium leading-none tracking-tight whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
