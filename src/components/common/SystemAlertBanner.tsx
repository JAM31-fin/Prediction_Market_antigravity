import React, { useState } from 'react';
import { useMarket } from '../../context/MarketContext';
import { Database, AlertTriangle, RefreshCw, X, ServerCrash } from 'lucide-react';

export const SystemAlertBanner: React.FC = () => {
  const { systemAlert, retryConnection, clearSystemAlert } = useMarket();
  const [isRetrying, setIsRetrying] = useState(false);

  if (!systemAlert) return null;

  const isDatabaseError = systemAlert.type === 'database_unavailable';

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryConnection();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      className={`border-b px-4 py-3 text-xs transition-colors ${
        isDatabaseError
          ? 'bg-amber-950/70 border-amber-500/40 text-amber-200'
          : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`p-1.5 rounded-md shrink-0 mt-0.5 sm:mt-0 ${
              isDatabaseError ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
            }`}
          >
            {isDatabaseError ? (
              <Database className="w-4 h-4" />
            ) : (
              <ServerCrash className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="font-bold flex items-center gap-2">
              <span>{systemAlert.title}</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-black/40 border border-white/10">
                {isDatabaseError ? 'Storage Alert' : 'Network Alert'}
              </span>
            </div>
            <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
              {systemAlert.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className={`px-3 py-1.5 rounded-md font-mono text-[11px] font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 ${
              isDatabaseError
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-rose-500 hover:bg-rose-400 text-white'
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Retrying...' : 'Retry Connection'}</span>
          </button>
          <button
            onClick={clearSystemAlert}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
            title="Dismiss alert"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
