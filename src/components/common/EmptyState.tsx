import React from 'react';

interface EmptyStateProps {
  icon: React.ComponentType<{className?: string}>;
  title: string;
  description: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  return (
    <div className="rounded-2xl bg-[#0D130F] border border-white/10 p-6 sm:p-10 text-center flex flex-col items-center justify-center">
      <div className="w-14 h-14 rounded-2xl bg-[#0B3B24]/60 border border-[#22C55E]/25 flex items-center justify-center text-[#4ADE80] mb-4">
        <Icon className="w-7 h-7" />
      </div>
      <h2 className="font-display text-lg sm:text-xl font-bold text-white tracking-tight text-balance">
        {title}
      </h2>
      <p className="mt-2 text-sm text-[#9CB0A4] leading-relaxed max-w-md">{description}</p>

      {(primaryActionLabel || secondaryActionLabel) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
          {primaryActionLabel && onPrimaryAction && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] active:scale-[0.98] px-5 py-2.5 min-h-[44px] text-sm font-semibold text-white transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {primaryActionLabel}
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#161F19] hover:bg-[#1F2C24] border border-white/15 px-5 py-2.5 min-h-[44px] text-sm font-semibold text-white transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
