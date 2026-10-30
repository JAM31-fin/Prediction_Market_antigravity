import React from 'react';
import { Position } from '../../types';
import { Briefcase, TrendingUp, TrendingDown, ArrowRight, Lock } from 'lucide-react';

interface UserMarketPositionProps {
  positions: Position[];
  onSellClick: (pos: Position) => void;
  marketStatus?: string;
}

export const UserMarketPosition: React.FC<UserMarketPositionProps> = ({ 
  positions, 
  onSellClick,
  marketStatus = 'open'
}) => {
  const isMarketOpen = marketStatus === 'open';
  const activePositions = positions.filter((p) => p.status === 'OPEN' && p.quantity > 0.001);

  if (activePositions.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between text-xs elevation-card">
        <div className="flex items-center gap-2.5 text-slate-400">
          <Briefcase className="w-4 h-4 text-slate-500 shrink-0" />
          <span>You have no open positions in this contract.</span>
        </div>
        <span className="text-slate-500 font-mono text-[11px]">Use trading panel to enter</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 elevation-card">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-emerald-400 shrink-0" />
          <h4 className="font-semibold text-xs sm:text-sm text-slate-100 uppercase tracking-wider font-mono">
            Your Active Contract Holdings
          </h4>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 font-bold tabular-nums">
          {activePositions.length} Position{activePositions.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {activePositions.map((pos) => {
          const isProfitable = pos.unrealizedPnL >= 0;

          return (
            <div
              key={pos.id}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-100">
                    {pos.outcomeName}
                  </span>
                  <span className="font-mono text-emerald-400 font-medium tabular-nums">
                    {pos.quantity.toFixed(3)} shares
                  </span>
                </div>
                <div className="text-slate-400 text-[11px] font-mono mt-0.5 tabular-nums">
                  Avg: ${(pos.averagePrice).toFixed(3)} &bull; Current: ${(pos.currentPrice).toFixed(2)}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-5">
                <div className="text-right font-mono tabular-nums">
                  <div className="text-slate-200 font-bold text-sm">
                    ${pos.currentValue.toFixed(2)}
                  </div>
                  <div
                    className={`text-[11px] font-bold flex items-center justify-end gap-1 ${
                      isProfitable ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isProfitable ? (
                      <TrendingUp className="w-3 h-3 shrink-0" />
                    ) : (
                      <TrendingDown className="w-3 h-3 shrink-0" />
                    )}
                    <span>
                      {isProfitable ? '+' : ''}${pos.unrealizedPnL.toFixed(2)} ({pos.unrealizedPnLPercent}%)
                    </span>
                  </div>
                </div>

                {isMarketOpen ? (
                  <button
                    onClick={() => onSellClick(pos)}
                    className="px-3.5 py-1.5 min-h-[34px] rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold btn-tactile cursor-pointer"
                  >
                    SELL
                  </button>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-mono font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                    LOCKED
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
