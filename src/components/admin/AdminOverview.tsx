import React, { useMemo } from 'react';
import { useMarket } from '../../context/MarketContext';
import { RiskEngine } from '../../services/riskEngine';
import { 
  TrendingUp, 
  DollarSign, 
  Layers, 
  Users, 
  ShieldCheck, 
  Plus, 
  AlertCircle, 
  ArrowRight,
  Clock,
  CheckCircle2,
  Hourglass
} from 'lucide-react';

export const AdminOverview: React.FC = () => {
  const { metrics, markets, trades, allTrades, allPositions, user, platformBalance, setAdminSubView, navigateTo } = useMarket();

  // Find markets closing or pending resolution
  const pendingSettlement = markets.filter(
    (m) => m.status === 'open' && new Date(m.closeTime).getTime() <= Date.now()
  );

  // Find markets currently in optimistic resolution dispute window
  const resolvingMarkets = markets.filter((m) => m.status === 'resolving');

  // Compute platform-wide risk aggregates including Solvency Coverage Ratio
  const platformAggregates = useMemo(() => {
    return RiskEngine.calculatePlatformAggregates(markets, allTrades, allPositions);
  }, [markets, allTrades, allPositions]);

  return (
    <div className="py-6 space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-bold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            OPERATOR MANAGEMENT DESK
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Platform Operator Operations
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Centralized liquidity parameter oversight, oracle settlement clearance, and revenue accounting.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setAdminSubView('create')}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>CREATE NEW MARKET</span>
          </button>
        </div>
      </div>

      {/* High-Level Operator KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 font-mono">
        <div className="terminal-card p-4 rounded-2xl border-amber-500/30">
          <div className="text-[11px] text-amber-400 uppercase font-bold">Platform Balance</div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1 tabular-nums">
            ${(user?.virtualBalance ?? platformBalance ?? 25000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">$25k Base + Net Result</div>
        </div>

        <div className="terminal-card p-4 rounded-2xl">
          <div className="text-[11px] text-slate-400 uppercase font-bold">Total Platform Volume</div>
          <div className="text-xl sm:text-2xl font-black text-white mt-1 tabular-nums">
            ${(metrics?.totalVolume ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-[#10b981] mt-1">&bull; Gross contract flow</div>
        </div>

        <div className="terminal-card p-4 rounded-2xl">
          <div className="text-[11px] text-slate-400 uppercase font-bold">Net Operator Revenue</div>
          <div className="text-xl sm:text-2xl font-black text-[#10b981] mt-1 tabular-nums">
            ${(metrics?.netRevenue ?? metrics?.totalRevenue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Commissions + spreads</div>
        </div>

        <div className="terminal-card p-4 rounded-2xl">
          <div className="text-[11px] text-slate-400 uppercase font-bold">Active Contracts</div>
          <div className="text-xl sm:text-2xl font-black text-[#3b82f6] mt-1 tabular-nums">
            {metrics?.activeMarkets ?? 0} Open
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{markets?.length ?? 0} total deployed</div>
        </div>

        <div className="terminal-card p-4 rounded-2xl">
          <div className="text-[11px] text-slate-400 uppercase font-bold">Active Traders</div>
          <div className="text-xl sm:text-2xl font-black text-purple-400 mt-1 tabular-nums">
            {(metrics?.activeUsers || metrics?.totalUsers || 0).toLocaleString('en-US')}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 truncate">
            {(allTrades?.length ?? trades?.length ?? 0)} trades &bull; {(metrics?.totalUsers || 0)} users
          </div>
        </div>

        {/* Solvency Coverage Ratio KPI */}
        <div className="terminal-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-[11px] uppercase font-bold text-slate-400">
            <span>Ratio Cobertura</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
              platformAggregates.riskCoverageRatio >= 1.0
                ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30'
                : platformAggregates.riskCoverageRatio >= 0.5
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-[#f43f5e]/15 text-[#f43f5e] border border-[#f43f5e]/30'
            }`}>
              {platformAggregates.riskCoverageRatio >= 1.0 ? 'SOLVENTE' : 'ALERTA'}
            </span>
          </div>
          <div className={`text-xl sm:text-2xl font-black mt-1 tabular-nums ${
            platformAggregates.riskCoverageRatio >= 1.0 ? 'text-[#10b981]' : 'text-amber-400'
          }`}>
            {platformAggregates.riskCoverageRatio >= 999
              ? '∞ (100%)'
              : `${(platformAggregates.riskCoverageRatio * 100).toFixed(1)}%`}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 truncate" title={`(Comisiones: $${platformAggregates.totalCommissionRevenue.toFixed(2)} + Spreads: $${platformAggregates.totalSpreadRevenue.toFixed(2)}) / Exp: $${platformAggregates.netRemainingExposure.toFixed(2)}`}>
            (Fees+Spread)/Exp Neta
          </div>
        </div>
      </div>

      {/* Optimistic Dispute Window Alert */}
      {resolvingMarkets.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Hourglass className="w-5 h-5 text-amber-400 shrink-0 animate-spin" />
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-amber-300">
                  {resolvingMarkets.length} {resolvingMarkets.length === 1 ? 'Mercado en Ventana de Disputa Optimista' : 'Mercados en Ventana de Disputa Optimista'}
                </h4>
                <p className="text-[11px] text-slate-300">
                  Resoluciones propuestas en periodo de gracia. Los pagos no se transfieren hasta la finalización.
                </p>
              </div>
            </div>
            <button
              onClick={() => setAdminSubView('markets')}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold transition-colors cursor-pointer self-start sm:self-auto"
            >
              Gestionar Disputas &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Pending Settlement Alert (if any) */}
      {pendingSettlement.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-amber-300">
                  {pendingSettlement.length} Market{pendingSettlement.length > 1 ? 's' : ''} Ready for Oracle Settlement
                </h4>
                <p className="text-xs text-amber-400/80 mt-0.5">
                  The scheduled close timestamp has passed. Review oracle source and declare winning outcome.
                </p>
              </div>
            </div>
            <button
              onClick={() => setAdminSubView('markets')}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs shrink-0 transition-colors"
            >
              Resolve Now
            </button>
          </div>
        </div>
      )}

      {/* Two Column Layout: Quick Actions & Live Trades Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Quick Operations Panel */}
        <div className="terminal-card rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
            Operator Administrative Functions
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-sans">
            <button
              onClick={() => setAdminSubView('create')}
              className="p-3.5 rounded-xl bg-[#0b0f19]/70 hover:bg-[#111827] border border-slate-800 hover:border-slate-700 text-left transition-all flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="font-bold text-slate-100 flex items-center justify-between">
                  <span>Deploy New Contract</span>
                  <Plus className="w-4 h-4 text-[#10b981]" />
                </div>
                <p className="text-slate-400 text-[11px] mt-1">
                  Configure binary, multi-outcome, or range prediction markets.
                </p>
              </div>
              <span className="text-[#10b981] font-mono font-semibold text-[11px] mt-3 block">
                Open Wizard &rarr;
              </span>
            </button>

            <button
              onClick={() => setAdminSubView('markets')}
              className="p-3.5 rounded-xl bg-[#0b0f19]/70 hover:bg-[#111827] border border-slate-800 hover:border-slate-700 text-left transition-all flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="font-bold text-slate-100 flex items-center justify-between">
                  <span>Settlement Desk</span>
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-slate-400 text-[11px] mt-1">
                  Declare verified oracle outcomes and trigger ledger payouts.
                </p>
              </div>
              <span className="text-amber-400 font-mono font-semibold text-[11px] mt-3 block">
                Manage Markets &rarr;
              </span>
            </button>

            <button
              onClick={() => setAdminSubView('revenue')}
              className="p-3.5 rounded-xl bg-[#0b0f19]/70 hover:bg-[#111827] border border-slate-800 hover:border-slate-700 text-left transition-all flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="font-bold text-slate-100 flex items-center justify-between">
                  <span>Revenue Analytics</span>
                  <TrendingUp className="w-4 h-4 text-[#3b82f6]" />
                </div>
                <p className="text-slate-400 text-[11px] mt-1">
                  Audit 1% trading fees, bid/ask spreads, and daily revenue charts.
                </p>
              </div>
              <span className="text-[#3b82f6] font-mono font-semibold text-[11px] mt-3 block">
                View Ledgers &rarr;
              </span>
            </button>

            <button
              onClick={() => setAdminSubView('risk')}
              className="p-3.5 rounded-xl bg-[#0b0f19]/70 hover:bg-[#111827] border border-slate-800 hover:border-slate-700 text-left transition-all flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="font-bold text-slate-100 flex items-center justify-between">
                  <span>LMSR Risk Monitor</span>
                  <Clock className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-slate-400 text-[11px] mt-1">
                  Check b &bull; ln(n) bounds and position inventory skew alerts.
                </p>
              </div>
              <span className="text-purple-400 font-mono font-semibold text-[11px] mt-3 block">
                Inspect Exposure &rarr;
              </span>
            </button>
          </div>
        </div>

        {/* Live System Execution Feed */}
        <div className="terminal-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Live Operator Execution Tape
            </h3>
            <span className="text-[11px] font-mono text-[#10b981] font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              Automated MM Active
            </span>
          </div>

          <div className="divide-y divide-slate-800/60 max-h-64 overflow-y-auto font-mono text-xs">
            {trades.slice(0, 8).map((t) => (
              <div key={t.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      t.type === 'BUY'
                        ? 'bg-[#10b981]/15 text-[#10b981]'
                        : 'bg-[#f43f5e]/15 text-[#f43f5e]'
                    }`}
                  >
                    {t.type}
                  </span>
                  <span className="text-slate-200 font-semibold truncate max-w-[140px]">
                    {t.outcomeName}
                  </span>
                  <span className="text-slate-400 text-[11px] tabular-nums">
                    ${t.amount.toFixed(0)}
                  </span>
                </div>
                <div className="text-right text-[11px] text-slate-400 tabular-nums">
                  Fee: <span className="text-[#10b981]">${t.fee.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
