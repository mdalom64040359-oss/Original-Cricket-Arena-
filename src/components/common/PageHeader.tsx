import React from 'react';
import {ArrowLeft} from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBackHome: () => void;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({title, subtitle, onBackHome, action}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#101612] hover:bg-[#18221C] border border-white/10 text-white transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
          aria-label="Back to Home Dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
            {title}
          </h1>
          {subtitle && <p className="text-xs sm:text-sm text-[#9CB0A4] truncate">{subtitle}</p>}
        </div>
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
