import React, { useState } from 'react';
import { useMarket } from '../../context/MarketContext';
import { useLanguage } from '../../context/LanguageContext';
import { getLocalizedMarket } from '../../i18n/marketTranslations';
import { PriceChart } from './PriceChart';
import { TradingPanel } from './TradingPanel';
import { MarketRulesCard } from './MarketRulesCard';
import { MarketTradesFeed } from './MarketTradesFeed';
import { UserMarketPosition } from './UserMarketPosition';
import { DisputeCountdownTimer } from '../common/DisputeCountdownTimer';
import { 
  ArrowLeft, 
  Clock, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Lock, 
  AlertTriangle, 
  Hourglass, 
  RefreshCw, 
  SearchX,
  TrendingUp,
  Activity
} from 'lucide-react';

export const MarketDetailPage: React.FC = () => {
  const { markets, selectedMarketId, navigateTo, positions, trades, allTrades, retryConnection } = useMarket();
  const { language } = useLanguage();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Match explicitly selected market, or default to first if none specified
  const rawMarket = selectedMarketId 
    ? markets.find((m) => m.id === selectedMarketId)
    : markets[0];

  const market = rawMarket ? getLocalizedMarket(rawMarket, language) : null;

  // Active trade intent to populate TradingPanel when clicking on holdings
  const [tradeIntent, setTradeIntent] = useState<{
    mode: 'BUY' | 'SELL';
    outcomeId?: string;
    shares?: string;
  } | null>(null);

  // Trades on this market across all platform participants
  const marketTrades = (allTrades && allTrades.length > 0 ? allTrades : trades).filter(
    (t) => t.marketId === market?.id
  );

  // Unique active traders on this contract
  const distinctMarketTraders = new Set(marketTrades.map((t) => t.userId).filter(Boolean)).size;
  const activeTradersDisplay = market ? Math.max(market.totalTraders || 0, distinctMarketTraders) : 0;

  // Positions on this market
  const marketPositions = positions.filter((p) => p.marketId === market?.id);

  if (!market) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20">
        <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-8 text-center backdrop-blur-xl shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mx-auto mb-4 text-amber-400">
            <SearchX className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">
            {language === 'es' ? 'Contrato de Mercado No Disponible' : 'Market Contract Unavailable'}
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto mb-6 leading-relaxed">
            {language === 'es'
              ? 'El identificador del mercado no se encuentra en el registro activo.'
              : 'The market contract identifier is not currently listed in the active registry.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => navigateTo('markets')}
              className="px-5 py-2.5 min-h-[38px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold font-mono btn-tactile shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              {language === 'es' ? 'Explorar Mercados' : 'Browse Active Markets'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Format time remaining
  const getTimeRemaining = (closeIso: string) => {
    const diff = new Date(closeIso).getTime() - Date.now();
    if (diff <= 0) return language === 'es' ? 'Contrato Finalizado' : 'Contract Closed';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 1) return language === 'es' ? `Cierra en ${days} días` : `Closes in ${days} days`;
    if (hours > 0) {
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return language === 'es' ? `Cierra en ${hours}h ${mins}m` : `Closes in ${hours}h ${mins}m`;
    }
    const mins = Math.floor(diff / (1000 * 60));
    return language === 'es' ? `Cierra en ${mins}m` : `Closes in ${mins}m`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Back to Markets Breadcrumbs */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateTo('markets')}
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-emerald-400 btn-tactile cursor-pointer group py-2 px-3 -ml-3 rounded-xl min-h-[38px] hover:bg-slate-900/60"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform shrink-0" />
          <span>{language === 'es' ? 'VOLVER A TODOS LOS MERCADOS' : 'BACK TO ALL MARKETS'}</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] font-mono text-slate-300">
            {market.category}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-white/[0.06] text-[11px] font-mono text-slate-400 uppercase font-semibold">
            {market.type || (market.outcomes?.length === 2 ? 'binary' : 'multi')}
          </span>
        </div>
      </div>

      {/* Optimistic Resolution Dispute Banner */}
      {market.status === 'resolving' && (
        <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-md shadow-lg">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Hourglass className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                  {language === 'es' ? 'Resolución Propuesta:' : 'Proposed Resolution:'}
                </span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs">
                  {market.outcomes.find(o => o.id === (market.proposedOutcomeId || market.winningOutcomeId || market.resolvedOutcomeId))?.name || 'YES'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                  {language === 'es' ? 'VENTANA DE DISPUTA OPTIMISTA' : 'OPTIMISTIC DISPUTE WINDOW'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {language === 'es'
                  ? 'Los fondos permanecen asegurados en custodia sin transferirse. Si no se registra impugnación dentro del plazo, el mercado liquidará automáticamente a $1.00 USD por acción ganadora.'
                  : 'Funds remain held in escrow without balance transfers. If no dispute is filed before expiration, this market will automatically finalize at $1.00 USD per winning share.'}
              </p>
              {(market.resolutionProof || market.resolutionSource) && (
                <div className="mt-1.5 text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                  <span>{language === 'es' ? 'Prueba / Fuente:' : 'Proof / Source:'}</span>
                  <span className="text-slate-200 underline decoration-slate-600 truncate max-w-sm">
                    {market.resolutionProof || market.resolutionSource}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-800 shrink-0">
            <div className="text-left md:text-right">
              <div className="text-[10px] font-mono text-slate-400 uppercase">
                {language === 'es' ? 'Plazo de Impugnación' : 'Dispute Window'}
              </div>
              <div className="text-base sm:text-lg font-mono font-black text-amber-400 tabular-nums">
                <DisputeCountdownTimer
                  deadline={market.disputeDeadline}
                  showIcon={false}
                  expiredLabel={language === 'es' ? 'Ventana Concluida' : 'Window Expired'}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Market Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 mb-6 elevation-card">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2.5 mb-3">
              <span
                className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm ${
                  market.status === 'open'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : market.status === 'closed'
                    ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                    : market.status === 'resolving'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : market.status === 'resolved'
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                }`}
              >
                {market.status === 'open' && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                {market.status === 'closed' && <Lock className="w-3 h-3" />}
                {market.status === 'resolving' && <Hourglass className="w-3 h-3 animate-spin" />}
                {market.status === 'resolved' && <CheckCircle2 className="w-3 h-3" />}
                {market.status === 'cancelled' && <AlertTriangle className="w-3 h-3" />}
                {(language === 'es'
                  ? market.status === 'open' ? 'ABIERTO' : market.status === 'resolving' ? 'EN RESOLUCIÓN OPTIMISTA' : market.status === 'resolved' ? 'RESUELTO' : market.status === 'closed' ? 'CERRADO' : market.status
                  : market.status === 'resolving' ? 'IN OPTIMISTIC RESOLUTION' : market.status
                ).toUpperCase()}
              </span>

              {/* Countdown OR Resolved indicator (Clean and separated) */}
              {market.status === 'open' ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono tabular-nums">
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{getTimeRemaining(market.closeTime)}</span>
                </div>
              ) : market.status === 'resolving' ? (
                <div className="flex items-center gap-1.5 text-xs text-amber-400 font-mono tabular-nums bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                  <DisputeCountdownTimer
                    deadline={market.disputeDeadline}
                    showIcon={true}
                    expiredLabel={language === 'es' ? 'Disputa concluida' : 'Dispute expired'}
                  />
                </div>
              ) : market.status === 'resolved' ? (
                <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-mono tabular-nums bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>{language === 'es' ? 'Contrato Liquidado y Resuelto' : 'Contract Resolved & Settled'}</span>
                </div>
              ) : null}
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-snug text-wrap-balance">
              {market.question}
            </h1>

            <p className="text-slate-400 text-xs sm:text-sm mt-2.5 leading-relaxed max-w-3xl text-wrap-pretty">
              {market.description}
            </p>
          </div>

          {/* Key Metrics Columns */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-800 text-xs font-mono shrink-0">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 min-w-[125px]">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                {language === 'es' ? 'Volumen Total' : 'Total Volume'}
              </div>
              <div className="text-lg font-bold text-slate-100 tabular-nums mt-0.5">
                ${market.volume.toLocaleString('en-US')}
              </div>
              <div className="text-[10px] text-emerald-400 font-mono mt-0.5">● USD Virtual</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 min-w-[125px]">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                {language === 'es' ? 'Participantes' : 'Active Traders'}
              </div>
              <div className="text-lg font-bold text-slate-100 tabular-nums mt-0.5">
                {activeTradersDisplay}
              </div>
              <div className="text-[10px] text-cyan-400 font-mono mt-0.5">● {language === 'es' ? 'Pronósticos' : 'Traders'}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 min-w-[125px]">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                {language === 'es' ? 'Liquidez LMSR' : 'LMSR Liquidity'}
              </div>
              <div className="text-lg font-bold text-slate-100 tabular-nums mt-0.5">
                b = {market.liquidityParameter}
              </div>
              <div className="text-[10px] text-purple-400 font-mono mt-0.5">● Algorithmic</div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Chart & Specs on Left, Trading Panel & Feed on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 cols): Chart, Outcome Probability Bars, Rules */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* Interactive Price Chart */}
          <PriceChart market={market} />

          {/* Outcome Probabilities Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              {language === 'es' ? 'Precios y Probabilidades en Tiempo Real' : 'Outcome Pricing & Probability Distribution'}
            </h4>
            <div className="space-y-3">
              {market.outcomes.map((outcome) => {
                const pct = Math.round(outcome.currentPrice * 100);
                const color = outcome.color || '#10b981';
                return (
                  <div key={outcome.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-bold text-slate-100">{outcome.name}</span>
                        {outcome.label && (
                          <span className="text-slate-400 text-[11px] hidden sm:inline">
                            &bull; {outcome.label}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs tabular-nums">
                        <span className="text-slate-400 mr-2">{pct}%</span>
                        <span className="font-bold" style={{ color }}>
                          {pct}&cent;
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar without Fuzzy Glow */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
                      <div
                        className="h-full transition-[width] duration-300 ease-out"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-2 tabular-nums">
                      <span>{language === 'es' ? 'Pool LMSR' : 'LMSR Pool State'}: q = {outcome.q.toFixed(1)}</span>
                      <span>
                        {language === 'es' ? 'Comprar a' : 'Ask'}: {Math.round(outcome.buyPrice * 100)}&cent; | {language === 'es' ? 'Vender a' : 'Bid'}: {Math.round(outcome.sellPrice * 100)}&cent;
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* User Active Holdings in this Contract */}
          <UserMarketPosition
            positions={marketPositions}
            marketStatus={market.status}
            onSellClick={(pos) => {
              setTradeIntent({
                mode: 'SELL',
                outcomeId: pos.outcomeId,
                shares: pos.quantity.toString(),
              });
              const panel = document.getElementById('trading-panel');
              if (panel) {
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
          />

          {/* Contract Rules & Resolution Authority */}
          <MarketRulesCard market={market} />
        </div>

        {/* Right Column (5 cols): Trading Execution Panel, Recent Trades */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Main Trading Panel */}
          <TradingPanel market={market} tradeIntent={tradeIntent} />

          {/* Live Trades Stream for this Market */}
          <MarketTradesFeed trades={marketTrades} />
        </div>

      </div>

    </div>
  );
};
