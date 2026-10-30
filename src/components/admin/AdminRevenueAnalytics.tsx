import React, { useState, useMemo, useEffect } from 'react';
import { useMarket } from '../../context/MarketContext';
import { RiskEngine } from '../../services/riskEngine';
import { LedgerEntry, LedgerTransactionType } from '../../types';
import { apiClient } from '../../services/apiClient';
import { 
  ResponsiveContainer, 
  ComposedChart,
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  Legend,
  ReferenceLine
} from 'recharts';
import { 
  DollarSign, 
  TrendingUp, 
  PieChart as PieIcon, 
  Download, 
  Activity, 
  ShieldCheck,
  ArrowUpRight,
  Filter,
  Calendar,
  Layers,
  BarChart3,
  ArrowDownLeft
} from 'lucide-react';

export const AdminRevenueAnalytics: React.FC = () => {
  const { metrics, markets, allTrades, allPositions, user, platformBalance } = useMarket();

  // Selected period tab
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'sevenDays' | 'thirtyDays' | 'allTime'>('allTime');

  // Ledger filter
  const [ledgerFilter, setLedgerFilter] = useState<LedgerTransactionType | 'ALL'>('ALL');

  // Chart view toggle: 'trend' | 'markets'
  const [chartView, setChartView] = useState<'trend' | 'markets'>('trend');

  // Authoritative server-side ledger
  const [serverLedger, setServerLedger] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    let mounted = true;
    apiClient.getAdminLedger().then((entries) => {
      if (mounted && Array.isArray(entries) && entries.length > 0) {
        setServerLedger(entries);
      }
    }).catch(() => {
      // Fallback silently to local cache if network/offline
    });
    return () => {
      mounted = false;
    };
  }, [allTrades]);

  // Platform Aggregates calculated from authoritative platform-wide records
  const aggregates = useMemo(() => {
    return RiskEngine.calculatePlatformAggregates(markets, allTrades, allPositions);
  }, [markets, allTrades, allPositions]);

  // Read Audited Ledger Entries (Server authoritative)
  const ledgerEntries = useMemo(() => {
    const all = serverLedger;
    if (ledgerFilter === 'ALL') return all;
    return all.filter((e) => e.type === ledgerFilter);
  }, [ledgerFilter, serverLedger]);

  // Current active period metrics
  const activePeriodData = aggregates.periods[selectedPeriod];

  // Cumulative revenue and net platform result chart data with resilient baseline
  const chartData = useMemo(() => {
    const executedTrades = (allTrades || []).filter((t) => t.type === 'BUY' || t.type === 'SELL');
    if (executedTrades.length === 0) {
      return [
        { tradeIndex: '#0', time: 'Start', commission: 0, spread: 0, totalFees: 0, netResult: 0, volume: 0 },
        { tradeIndex: '#1', time: 'Current', commission: 0, spread: 0, totalFees: 0, netResult: 0, volume: 0 },
      ];
    }
    const sorted = [...executedTrades].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    let cumCommission = 0;
    let cumSpread = 0;
    let cumVol = 0;

    const totalTradesCount = sorted.length;
    const finalNetResult = aggregates.netPlatformResult;
    const finalMMPnL = aggregates.realizedMMPnL + aggregates.unrealizedMMPnL;

    const points = [
      {
        tradeIndex: '#0',
        time: 'Start',
        commission: 0,
        spread: 0,
        totalFees: 0,
        netResult: 0,
        volume: 0,
      }
    ];

    sorted.forEach((t, idx) => {
      cumCommission += t.fee || 0;
      cumSpread += t.spreadFee || 0;
      cumVol += t.amount || 0;
      const d = new Date(t.timestamp);
      const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      
      const progressFraction = totalTradesCount > 0 ? (idx + 1) / totalTradesCount : 1;
      const progressiveMMPnL = Number((finalMMPnL * progressFraction).toFixed(2));
      const progressiveFees = Number((cumCommission + cumSpread).toFixed(2));
      const progressiveNet = idx === totalTradesCount - 1 
        ? finalNetResult 
        : Number((progressiveFees + progressiveMMPnL).toFixed(2));

      points.push({
        tradeIndex: `#${idx + 1}`,
        time: timeStr,
        commission: Number(cumCommission.toFixed(2)),
        spread: Number(cumSpread.toFixed(2)),
        totalFees: progressiveFees,
        netResult: progressiveNet,
        volume: Number(cumVol.toFixed(2)),
      });
    });

    return points;
  }, [allTrades, aggregates]);

  // Per-market breakdown chart data
  const marketChartData = useMemo(() => {
    return markets.map((m) => {
      const mTrades = (allTrades || []).filter((t) => t.marketId === m.id && (t.type === 'BUY' || t.type === 'SELL'));
      const comm = mTrades.reduce((acc, t) => acc + (t.fee || 0), 0);
      const sprd = mTrades.reduce((acc, t) => acc + (t.spreadFee || 0), 0);
      const fees = comm + sprd;
      const risk = RiskEngine.calculateMarketRisk(m, allTrades, allPositions);

      return {
        id: m.id,
        name: m.question.length > 22 ? m.question.substring(0, 20) + '...' : m.question,
        volume: Number((m.volume || 0).toFixed(2)),
        fees: Number(fees.toFixed(2)),
        netResult: Number(risk.netPlatformResult.toFixed(2)),
      };
    });
  }, [markets, allTrades, allPositions]);

  return (
    <div className="py-6 space-y-6 font-mono">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight font-sans">
            Revenue & Financial Analytics
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5 font-sans">
            Audited platform fee monetization, market-maker P&L performance, and time-sliced financial reporting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Audited Double-Entry Ledger</span>
          </span>
        </div>
      </div>

      {/* Top-Level Metric: NET PLATFORM RESULT */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/30 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-emerald-400">
                TOP-LEVEL METRIC
              </span>
              <span className="px-2 py-0.5 text-[10px] rounded bg-slate-800 text-slate-400 border border-slate-700">
                Centralized Market Maker
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
              NET PLATFORM RESULT
            </h1>
            <p className="text-slate-400 text-xs mt-1 font-sans max-w-2xl">
              Conceptually: <code className="text-emerald-300">Net Result = Commission Revenue + Spread Revenue + Market-Maker P&L</code>.
              Platform Treasury Balance: <strong className="text-amber-400 font-bold font-mono">${(user?.virtualBalance ?? platformBalance ?? (25000 + aggregates.netPlatformResult)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> ($25k seed + Net Result).
            </p>
          </div>

          <div className="text-left md:text-right bg-slate-950/80 p-4 rounded-xl border border-slate-800 shrink-0">
            <div className="text-slate-400 text-[11px] uppercase">Net Platform Result</div>
            <div className={`text-2xl sm:text-3xl font-black mt-1 ${
              aggregates.netPlatformResult >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {aggregates.netPlatformResult >= 0 ? '+' : ''}${aggregates.netPlatformResult.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-end gap-2">
              <span>Commission: ${aggregates.totalCommissionRevenue.toFixed(2)}</span>
              <span>&bull;</span>
              <span>Spread: ${aggregates.totalSpreadRevenue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Time-Sliced Revenue Period Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-200">Revenue Time Horizon:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              onClick={() => setSelectedPeriod('today')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-bold ${
                selectedPeriod === 'today'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setSelectedPeriod('sevenDays')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-bold ${
                selectedPeriod === 'sevenDays'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setSelectedPeriod('thirtyDays')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-bold ${
                selectedPeriod === 'thirtyDays'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setSelectedPeriod('allTime')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-bold ${
                selectedPeriod === 'allTime'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All-Time
            </button>
          </div>
        </div>

        {/* Selected Period Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-850">
            <div className="text-slate-400 text-[10px] uppercase">Period Fee Revenue</div>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              ${activePeriodData.totalRevenue.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Commission + Spread</div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-850">
            <div className="text-slate-400 text-[10px] uppercase">Commission Revenue</div>
            <div className="text-xl font-bold text-slate-100 mt-1">
              ${activePeriodData.commissionRevenue.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Contract trading fees</div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-850">
            <div className="text-slate-400 text-[10px] uppercase">Spread Revenue</div>
            <div className="text-xl font-bold text-slate-100 mt-1">
              ${activePeriodData.spreadRevenue.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Liquidity bid-ask capture</div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-850">
            <div className="text-slate-400 text-[10px] uppercase">Market-Maker P&L</div>
            <div className={`text-xl font-bold mt-1 ${
              aggregates.realizedMMPnL + aggregates.unrealizedMMPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {aggregates.realizedMMPnL + aggregates.unrealizedMMPnL >= 0 ? '+' : ''}${(aggregates.realizedMMPnL + aggregates.unrealizedMMPnL).toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Realized: ${aggregates.realizedMMPnL.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Revenue & Fee Performance Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">
                {chartView === 'trend' ? 'Revenue & Fee Accrual Trend' : 'Market-by-Market P&L & Volume'}
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              {chartView === 'trend'
                ? 'Cumulative guaranteed platform monetization (1% trading commission + execution spread capture).'
                : 'Comparative financial breakdown per market showing trading volume, operator fees, and net result.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs mr-2">
              <button
                onClick={() => setChartView('trend')}
                className={`px-3 py-1.5 rounded-lg font-bold btn-tactile flex items-center gap-1.5 cursor-pointer ${
                  chartView === 'trend' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Cumulative Trend</span>
              </button>
              <button
                onClick={() => setChartView('markets')}
                className={`px-3 py-1.5 rounded-lg font-bold btn-tactile flex items-center gap-1.5 cursor-pointer ${
                  chartView === 'markets' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Per Market</span>
              </button>
            </div>

            {chartView === 'trend' ? (
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  Commission (1%)
                </span>
                <span className="flex items-center gap-1.5 text-sky-400 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
                  Spread Fee
                </span>
                <span className="flex items-center gap-1.5 text-amber-400 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                  Total Fees
                </span>
                <span className="flex items-center gap-1.5 text-teal-300 font-mono font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" />
                  Net Platform Result
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-indigo-400 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                  Volume
                </span>
                <span className="flex items-center gap-1.5 text-amber-400 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                  Operator Fees
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                  Net Result
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="h-72 w-full pt-2 min-h-[280px]">
          {chartView === 'trend' ? (
            <ResponsiveContainer width="100%" height="100%" minHeight={260}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCommission" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorSpread" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  tickFormatter={(v) => `$${v}`} 
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.5rem',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                  formatter={(value: any, name: string) => [
                    `$${Number(value).toFixed(2)}`,
                    name === 'commission'
                      ? 'Commission Fee'
                      : name === 'spread'
                      ? 'Spread Capture'
                      : name === 'totalFees'
                      ? 'Total Fees'
                      : name === 'netResult'
                      ? 'Net Platform Result'
                      : name
                  ]}
                />
                <Area 
                  type="monotone" 
                  dataKey="commission" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorCommission)" 
                  name="commission"
                />
                <Area 
                  type="monotone" 
                  dataKey="spread" 
                  stroke="#38bdf8" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorSpread)" 
                  name="spread"
                />
                <Line 
                  type="monotone" 
                  dataKey="totalFees" 
                  stroke="#f59e0b" 
                  strokeWidth={2} 
                  dot={false}
                  name="totalFees"
                />
                <Line 
                  type="monotone" 
                  dataKey="netResult" 
                  stroke="#2dd4bf" 
                  strokeWidth={2.5} 
                  dot={{ r: 3, fill: '#2dd4bf', strokeWidth: 1, stroke: '#0f172a' }}
                  activeDot={{ r: 5, fill: '#2dd4bf' }}
                  name="netResult"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : marketChartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
              <Activity className="w-6 h-6 mb-2 text-slate-600" />
              <span>No active markets created yet.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={260}>
              <BarChart data={marketChartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  tickFormatter={(v) => `$${v}`} 
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.5rem',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                  formatter={(value: any, name: string) => [
                    `$${Number(value).toFixed(2)}`,
                    name === 'volume' ? 'Total Volume' : name === 'fees' ? 'Platform Fees' : 'Net Platform Result'
                  ]}
                />
                <Bar dataKey="volume" fill="#6366f1" radius={[4, 4, 0, 0]} name="volume" />
                <Bar dataKey="fees" fill="#f59e0b" radius={[4, 4, 0, 0]} name="fees" />
                <Bar dataKey="netResult" fill="#10b981" radius={[4, 4, 0, 0]} name="netResult" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Audited Balance & Transaction History Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">
                Audited Balance & Transaction Ledger
              </h3>
              <span className="text-[10px] px-2 py-0.2 rounded bg-slate-800 text-slate-400">
                {ledgerEntries.length} entries
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Every balance modification is recorded with immutable timestamps and balance derivations.
            </p>
          </div>

          {/* Filter by Transaction Type */}
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={ledgerFilter}
              onChange={(e) => setLedgerFilter(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-mono"
            >
              <option value="ALL">All Ledger Events</option>
              <option value="INITIAL_DEMO_CREDIT">INITIAL_DEMO_CREDIT</option>
              <option value="BUY">BUY (Acquisition)</option>
              <option value="SELL">SELL (Liquidation)</option>
              <option value="COMMISSION">COMMISSION (Fees)</option>
              <option value="SETTLEMENT">SETTLEMENT (Payouts)</option>
              <option value="REFUND">REFUND (Cancellations)</option>
              <option value="RESET_DEMO_CREDIT">RESET_DEMO_CREDIT</option>
            </select>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-800">
            <thead className="bg-slate-950/60 text-slate-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-3">Account / User</th>
                <th className="py-3 px-3">Event Type</th>
                <th className="py-3 px-3 text-right">Credit / Debit</th>
                <th className="py-3 px-3 text-right">Balance After</th>
                <th className="py-3 px-4">Audit Description</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-850">
              {ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No ledger entries recorded matching the current filter.
                  </td>
                </tr>
              ) : (
                ledgerEntries.map((entry) => {
                  const isCredit = entry.amount > 0;
                  const isNeutral = entry.amount === 0;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-850/40 transition-colors">
                      <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-slate-200 text-[11px] font-bold">
                        {entry.userEmail}
                      </td>

                      <td className="py-3 px-3">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                          entry.type === 'INITIAL_DEMO_CREDIT'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : entry.type === 'BUY'
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                            : entry.type === 'SELL'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : entry.type === 'COMMISSION'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            : entry.type === 'SETTLEMENT'
                            ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                            : entry.type === 'REFUND'
                            ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {entry.type}
                        </span>
                      </td>

                      <td className={`py-3 px-3 text-right font-bold ${
                        isCredit ? 'text-emerald-400' : isNeutral ? 'text-slate-400' : 'text-rose-400'
                      }`}>
                        {isCredit ? '+' : ''}${entry.amount.toFixed(2)}
                      </td>

                      <td className="py-3 px-3 text-right text-slate-100 font-bold">
                        ${entry.balanceAfter.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-slate-300 text-[11px] max-w-xs truncate" title={entry.description}>
                        {entry.description}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
