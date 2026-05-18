import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children?: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application render error:', error, errorInfo);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  private goHome = () => {
    window.history.pushState({}, '', '/');
    this.setState({ error: null });
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_100%)] flex items-center justify-center p-4 text-gray-900 dark:text-white">
        <div className="max-w-lg w-full rounded-3xl border border-white/80 dark:border-gray-800/80 bg-white/90 dark:bg-gray-950/90 shadow-2xl shadow-gray-300/50 dark:shadow-black/30 backdrop-blur-xl p-8 text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 flex items-center justify-center mx-auto mb-5 shadow-sm">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-3">Something went wrong</h1>
          <p className="text-sm leading-6 text-gray-600 dark:text-gray-400 mb-6">
            This screen could not finish loading. Your saved exam data and account records are not changed by this message.
          </p>
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800/80 p-4 mb-6 text-left">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Error detail</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
              {this.state.error.message || 'Unexpected application error'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={this.retry}
              className="flex-1 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} />
              Try Again
            </button>
            <button
              type="button"
              onClick={this.goHome}
              className="flex-1 rounded-full border border-gray-200/80 dark:border-gray-700/80 bg-white/85 dark:bg-gray-900/80 px-5 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-sm hover:bg-white dark:hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
            >
              <Home size={16} />
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
