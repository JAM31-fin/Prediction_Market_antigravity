import React from 'react';
import { Trade } from '../../types';
import { Activity, Clock } from 'lucide-react';

interface MarketTradesFeedProps {
  trades: Trade[];
}

export const MarketTradesFeed: React.FC<MarketTradesFeedProps> = ({ trades }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="font-semibold text-sm text-slate-100 uppercase tracking-wider font-mono">
            Recent Market Trades
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">Live Execution Feed</span>
      </div>

      <div className="divide-y divide-slate-800/60 max-h-60 overflow-y-auto font-mono text-xs">
        {trades.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            No trades executed on this contract yet.
          </div>
        ) : (
          trades.slice(0, 15).map((t) => {
            const timeAgo = Math.round((Date.now() - new Date(t.timestamp).getTime()) / 60000);
            const timeLabel = timeAgo <= 0 ? 'Just now' : `${timeAgo}m ago`;

            return (
              <div key={t.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      t.type === 'BUY'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {t.type}
                  </span>
                  <span className="text-slate-200 font-semibold truncate max-w-[120px]">
                    {t.outcomeName}
                  </span>
                  <span className="text-slate-500 text-[11px] hidden sm:inline">
                    by {t.userName || 'Trader'}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <div>
                    <span className="text-slate-200 font-bold">${t.amount.toFixed(2)}</span>
                    <span className="text-slate-500 text-[11px] ml-1.5">
                      ({t.quantity.toFixed(1)} sh @ {Math.round(t.price * 100)}&cent;)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">{timeLabel}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
