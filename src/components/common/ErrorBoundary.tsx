import React, {Component, type ErrorInfo, type ReactNode} from 'react';
import {AlertTriangle, RefreshCw} from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {hasError: false, message: ''};
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Cricket Arena ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as {error?: string; operationType?: string};
        if (parsed?.error) {
          friendly = `Security / Sync Notice (${parsed.operationType ?? 'operation'}): ${parsed.error}`;
        }
      } catch {
        // plain error message
      }

      return (
        <div className="min-h-screen bg-[#070A08] text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-[#101612] border border-rose-500/30 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold text-white">Something went wrong</h1>
                <p className="text-xs text-[#9CB0A4]">Your local Cricket Arena data remains safe in IndexedDB.</p>
              </div>
            </div>
            <p className="text-xs font-mono text-rose-200 bg-[#080C0A] border border-white/10 rounded-xl p-3 break-words">
              {friendly}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({hasError: false, message: ''});
                window.location.reload();
              }}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-sm font-semibold text-white"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload App</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
