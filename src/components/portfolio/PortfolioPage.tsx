import React, { useState, useMemo } from 'react';
import { useMarket } from '../../context/MarketContext';
import { useLanguage } from '../../context/LanguageContext';
import { marketDictionary, getLocalizedOutcomeName } from '../../i18n/marketTranslations';
import { Position } from '../../types';
import { PartialSellModal } from './PartialSellModal';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { 
  Briefcase, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export const PortfolioPage: React.FC = () => {
  const { user, positions, trades, navigateTo } = useMarket();
  const { language, t } = useLanguage();

  const [selectedPositionToSell, setSelectedPositionToSell] = useState<Position | null>(null);
  const [activeTab, setActiveTab] = useState<'open' | 'settled'>('open');
  const [chartView, setChartView] = useState<'value' | 'pnl'>('value');

  // Open positions (qty > 0)
  const openPositions = useMemo(() => {
    return positions.filter((p) => p.status === 'OPEN' && p.quantity > 0.001);
  }, [positions]);

  // Settled / historical positions
  const settledPositions = useMemo(() => {
    return positions.filter((p) => p.status !== 'OPEN' || p.quantity <= 0.001);
  }, [positions]);

  // Totals calculations
  const totalInvested = openPositions.reduce((acc, p) => acc + p.currentCostBasis, 0);
  const totalPositionsValue = openPositions.reduce((acc, p) => acc + p.currentValue, 0);
  const totalPortfolioValue = (user?.virtualBalance ?? 0) + totalPositionsValue;
  const totalUnrealizedPnL = openPositions.reduce((acc, p) => acc + p.unrealizedPnL, 0);
  const totalRealizedPnL = positions.reduce((acc, p) => acc + (p.realizedPnL || 0), 0);
  const totalNetPnL = totalRealizedPnL + totalUnrealizedPnL;
  const initialVirtualDeposit = 1000.0;
  const netReturnPercent = Number((((totalPortfolioValue - initialVirtualDeposit) / initialVirtualDeposit) * 100).toFixed(2));

  // Generate authentic historical portfolio chart data from genuine trade logs
  const chartData = useMemo(() => {
    const baseVal = 1000.0;
    
    // If no trades yet, render two baseline points
    if (!trades || trades.length === 0) {
      return [
        { time: language === 'es' ? 'Inicio' : 'Start', value: baseVal, pnl: 0 },
        { time: language === 'es' ? 'Hoy' : 'Now', value: totalPortfolioValue, pnl: Number((totalPortfolioValue - baseVal).toFixed(2)) },
      ];
    }

    // Sort trades chronologically (oldest to newest)
    const sortedTrades = [...trades].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const data = [
      { time: language === 'es' ? 'Inicio' : 'Start', value: baseVal, pnl: 0 }
    ];

    let runningCash = baseVal;
    let runningPositionCost = 0;

    for (const tr of sortedTrades) {
      const d = new Date(tr.timestamp);
      const timeLabel = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      
      if (tr.type === 'BUY') {
        runningCash -= tr.amount;
        runningPositionCost += (tr.amount - tr.fee - tr.spreadFee);
      } else if (tr.type === 'SELL') {
        runningCash += tr.amount;
        runningPositionCost = Math.max(0, runningPositionCost - tr.amount);
      } else if (tr.type === 'SETTLEMENT') {
        runningCash += tr.amount;
      }

      const estimatedPointVal = Number((runningCash + runningPositionCost).toFixed(2));
      const estimatedPointPnl = Number((estimatedPointVal - baseVal).toFixed(2));

      data.push({
        time: timeLabel,
        value: estimatedPointVal,
        pnl: estimatedPointPnl,
      });
    }

    // Always include current real mark-to-market point as final anchor
    data.push({
      time: language === 'es' ? 'Hoy' : 'Now',
      value: Number(totalPortfolioValue.toFixed(2)),
      pnl: Number((totalPortfolioValue - baseVal).toFixed(2)),
    });

    return data;
  }, [trades, totalPortfolioValue, language]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      
      {/* Header & Balance Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-wrap-balance">
            {t('portfolio.title')}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 text-wrap-pretty">
            {t('portfolio.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigateTo('markets')}
            className="px-4 py-2 min-h-[38px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 btn-tactile shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            <span>{language === 'es' ? 'EXPLORAR MERCADOS' : 'EXPLORE MARKETS'}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8 font-mono tabular-nums">
        
        {/* Total Portfolio Value */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 elevation-card">
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t('portfolio.totalValue')}</div>
          <div className="text-lg sm:text-xl font-extrabold text-white mt-1">
            ${totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-[11px] font-bold mt-1 ${netReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netReturnPercent >= 0 ? '+' : ''}{netReturnPercent}% {language === 'es' ? 'histórico' : 'all-time'}
          </div>
        </div>

        {/* Available Virtual Cash */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 elevation-card">
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t('portfolio.availableCash')}</div>
          <div className="text-lg sm:text-xl font-extrabold text-cyan-400 mt-1">
            ${(user?.virtualBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">{language === 'es' ? 'Créditos Disponibles' : 'Virtual Credits'}</div>
        </div>

        {/* Invested Amount */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 elevation-card">
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Invested Capital</div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-200 mt-1">
            ${totalInvested.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{openPositions.length} Positions</div>
        </div>

        {/* Unrealized P&L */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 elevation-card">
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Unrealized P&L</div>
          <div className={`text-lg sm:text-xl font-extrabold mt-1 ${totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Mark to Market</div>
        </div>

        {/* Realized P&L */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 elevation-card">
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Realized P&L</div>
          <div className={`text-lg sm:text-xl font-extrabold mt-1 ${totalRealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalRealizedPnL >= 0 ? '+' : ''}${totalRealizedPnL.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Closed Trades</div>
        </div>

        {/* Total Net P&L */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 elevation-card">
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Net Return</div>
          <div className={`text-lg sm:text-xl font-extrabold mt-1 ${totalNetPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalNetPnL >= 0 ? '+' : ''}${totalNetPnL.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Combined P&L</div>
        </div>

      </div>

      {/* Portfolio Financial Performance Chart with Concentric Radius */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 mb-8 elevation-card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="font-bold text-sm text-slate-100 font-mono uppercase tracking-wider">
              Portfolio Growth Trajectory
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 text-wrap-pretty">
              Historical valuation calculated across cash balance and active mark-to-market positions.
            </p>
          </div>

          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-mono">
            <button
              onClick={() => setChartView('value')}
              className={`px-3 py-1.5 rounded-lg btn-tactile cursor-pointer ${
                chartView === 'value' ? 'bg-slate-800 text-white font-semibold border border-slate-700/60 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Portfolio Value ($)
            </button>
            <button
              onClick={() => setChartView('pnl')}
              className={`px-3 py-1.5 rounded-lg btn-tactile cursor-pointer ${
                chartView === 'pnl' ? 'bg-slate-800 text-white font-semibold border border-slate-700/60 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cumulative P&L ($)
            </button>
          </div>
        </div>

        <div className="h-60 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.6} />
              <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
              <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                }}
                formatter={(val: any) => [`$${val}`, chartView === 'value' ? 'Portfolio Value' : 'Net P&L']}
              />
              <Area
                type="monotone"
                dataKey={chartView === 'value' ? 'value' : 'pnl'}
                stroke={chartView === 'value' ? '#10b981' : '#06b6d4'}
                strokeWidth={2}
                fillOpacity={1}
                fill={chartView === 'value' ? 'url(#valGrad)' : 'url(#pnlGrad)'}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Positions Section Header & Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('open')}
            className={`text-sm font-semibold pb-2 border-b-2 transition-[color,border-color] duration-150 flex items-center gap-2 cursor-pointer ${
              activeTab === 'open'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Briefcase className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{language === 'es' ? `Posiciones Abiertas (${openPositions.length})` : `Open Positions (${openPositions.length})`}</span>
          </button>

          <button
            onClick={() => setActiveTab('settled')}
            className={`text-sm font-semibold pb-2 border-b-2 transition-[color,border-color] duration-150 flex items-center gap-2 cursor-pointer ${
              activeTab === 'settled'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{language === 'es' ? `Liquidadas y Cerradas (${settledPositions.length})` : `Settled & Closed (${settledPositions.length})`}</span>
          </button>
        </div>

        <span className="text-xs text-slate-400 font-mono hidden sm:inline">
          {language === 'es' ? 'Valoración en tiempo real por LMSR' : 'Live LMSR Mark Valuation'}
        </span>
      </div>

      {/* Open Positions Table / Cards */}
      {activeTab === 'open' ? (
        openPositions.length === 0 ? (
          <div className="text-center py-20 bg-slate-900 rounded-2xl border border-slate-800 p-6 elevation-card">
            <Briefcase className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h4 className="text-slate-200 font-bold text-sm">
              {language === 'es' ? 'No tienes posiciones activas' : 'No Active Positions'}
            </h4>
            <p className="text-slate-400 text-xs mt-1 mb-5 text-wrap-pretty">
              {language === 'es'
                ? 'Actualmente no tienes participaciones en ningún mercado. ¡Elige un reto o evento para pronosticar!'
                : 'You currently hold no shares in any contract. Use your virtual balance to take a position.'}
            </p>
            <button
              onClick={() => navigateTo('markets')}
              className="px-4 py-2 min-h-[38px] bg-white hover:bg-slate-100 text-slate-950 rounded-xl text-xs font-semibold font-sans btn-tactile shadow-sm cursor-pointer"
            >
              {language === 'es' ? 'EXPLORAR MERCADOS' : 'BROWSE PREDICTION MARKETS'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {openPositions.map((pos) => {
              const isProfitable = pos.unrealizedPnL >= 0;
              const entry = marketDictionary[pos.marketId];
              const displayQuestion = entry ? entry.question[language] : pos.marketQuestion;
              const displayOutcome = getLocalizedOutcomeName(pos.outcomeName, language);

              return (
                <div
                  key={pos.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-750 rounded-2xl p-4 sm:p-5 transition-colors elevation-card"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* Market Question & Outcome Badge */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
                          {pos.marketCategory}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono font-semibold text-xs border border-slate-700">
                          {displayOutcome} &bull; {pos.quantity.toFixed(3)} {language === 'es' ? 'acciones' : 'Shares'}
                        </span>
                      </div>
                      
                      <h3
                        onClick={() => navigateTo('detail', pos.marketId)}
                        className="text-sm sm:text-base font-bold text-slate-100 hover:text-cyan-300 cursor-pointer transition-colors leading-snug tracking-tight text-wrap-balance"
                      >
                        {displayQuestion}
                      </h3>
                    </div>

                    {/* Financial Metrics Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs text-right tabular-nums">
                      <div>
                        <div className="text-[10px] text-slate-500">
                          {language === 'es' ? 'Precio Entrada' : 'Avg Entry'}
                        </div>
                        <div className="font-semibold text-slate-300 mt-0.5">
                          ${pos.averagePrice.toFixed(3)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-500">
                          {language === 'es' ? 'Precio Actual' : 'Current Price'}
                        </div>
                        <div className="font-semibold text-slate-300 mt-0.5">
                          ${pos.currentPrice.toFixed(2)} ({Math.round(pos.currentPrice * 100)}&cent;)
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-500">
                          {language === 'es' ? 'Valor Actual' : 'Current Value'}
                        </div>
                        <div className="font-bold text-slate-100 mt-0.5">
                          ${pos.currentValue.toFixed(2)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-500">
                          {language === 'es' ? 'Ganancia / Pérdida' : 'Unrealized P&L'}
                        </div>
                        <div
                          className={`font-bold mt-0.5 flex items-center justify-end gap-1 ${
                            isProfitable ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isProfitable ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span>
                            {isProfitable ? '+' : ''}${pos.unrealizedPnL.toFixed(2)} ({pos.unrealizedPnLPercent}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: [BUY MORE], [SELL] */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                      <button
                        onClick={() => navigateTo('detail', pos.marketId)}
                        className="flex-1 sm:flex-none px-3.5 py-1.5 min-h-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium btn-tactile cursor-pointer border border-slate-700"
                      >
                        {language === 'es' ? 'APOSTAR MÁS' : 'BUY MORE'}
                      </button>
                      <button
                        onClick={() => setSelectedPositionToSell(pos)}
                        className="flex-1 sm:flex-none px-3.5 py-1.5 min-h-[36px] rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold btn-tactile cursor-pointer"
                      >
                        {language === 'es' ? 'VENDER / COBRAR' : 'SELL / REDEEM'}
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Settled / Closed Positions Tab */
        <div className="space-y-3">
          {settledPositions.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-white/[0.06] text-slate-500 text-xs font-mono">
              {language === 'es' ? 'No hay posiciones cerradas o liquidadas todavía.' : 'No settled or closed positions yet.'}
            </div>
          ) : (
            settledPositions.map((pos) => {
              const entry = marketDictionary[pos.marketId];
              const displayQuestion = entry ? entry.question[language] : pos.marketQuestion;
              const displayOutcome = getLocalizedOutcomeName(pos.outcomeName, language);

              return (
                <div key={pos.id} className="bg-slate-900/50 border border-white/[0.06] rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 text-xs font-mono tabular-nums">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                        {pos.status}
                      </span>
                      <span className="font-bold text-slate-200 font-sans text-sm">
                        {displayQuestion}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      {language === 'es' ? 'Opción elegida:' : 'Contract Outcome:'} <span className="text-slate-200 font-bold">{displayOutcome}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">{language === 'es' ? 'Ganancia Realizada' : 'Realized P&L'}</div>
                    <div className={`font-bold text-sm ${pos.realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pos.realizedPnL >= 0 ? '+' : ''}${pos.realizedPnL.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Partial Sell Modal */}
      {selectedPositionToSell && (
        <PartialSellModal
          position={selectedPositionToSell}
          onClose={() => setSelectedPositionToSell(null)}
        />
      )}

    </div>
  );
};
