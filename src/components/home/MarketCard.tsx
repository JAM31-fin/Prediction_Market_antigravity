import React from 'react';
import { motion } from 'motion/react';
import { Market } from '../../types';
import { useMarket } from '../../context/MarketContext';
import { useLanguage } from '../../context/LanguageContext';
import { getLocalizedMarket } from '../../i18n/marketTranslations';
import { Clock, Users, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface MarketCardProps {
  market: Market;
}

export const MarketCard: React.FC<MarketCardProps> = React.memo(({ market: rawMarket }) => {
  const { navigateTo } = useMarket();
  const { language } = useLanguage();
  const market = getLocalizedMarket(rawMarket, language);

  // Time remaining format
  const getTimeRemaining = (closeIso: string) => {
    const diff = new Date(closeIso).getTime() - Date.now();
    if (diff <= 0) return language === 'es' ? 'Finalizado' : 'Ended';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 1) return language === 'es' ? `Cierra en ${days}d` : `Closes in ${days}d`;
    if (hours > 0) {
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return language === 'es' ? `Cierra en ${hours}h ${mins}m` : `Closes in ${hours}h ${mins}m`;
    }
    const mins = Math.floor(diff / (1000 * 60));
    return language === 'es' ? `Cierra en ${mins}m` : `Closes in ${mins}m`;
  };

  // Find top outcomes
  const topOutcomes = market.outcomes.slice(0, 3);
  const isBinary = (market.type || (market.outcomes && market.outcomes.length === 2 ? 'binary' : 'multi')) === 'binary';
  const yesOutcome = isBinary
    ? market.outcomes.find((o) => o.id.toLowerCase() === 'yes' || o.id.toLowerCase().endsWith('-yes') || o.name.toUpperCase() === 'YES' || o.name.toUpperCase() === 'SÍ')
    : null;
  const noOutcome = isBinary
    ? market.outcomes.find((o) => o.id.toLowerCase() === 'no' || o.id.toLowerCase().endsWith('-no') || o.name.toUpperCase() === 'NO')
    : null;

  const yesPercent = yesOutcome ? Math.round(yesOutcome.currentPrice * 100) : 50;
  const noPercent = noOutcome ? Math.round(noOutcome.currentPrice * 100) : 50;

  return (
    <motion.article
      aria-labelledby={`market-title-${market.id}`}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={() => navigateTo('detail', market.id)}
      className="group relative terminal-card terminal-card-hover rounded-2xl p-5 cursor-pointer flex flex-col justify-between elevation-card"
    >
      <div>
        {/* Card Header: Category, Market Type & Clean Status / Time */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="hud-tag text-slate-300">
              {market.category}
            </span>
            <span className="hud-tag text-[#3b82f6] bg-blue-950/40 border-blue-500/25">
              {market.type || (market.outcomes?.length === 2 ? 'binary' : 'categorical')}
            </span>
            {market.liquidityParameter && (
              <span className="hud-tag text-slate-400">
                b={market.liquidityParameter}
              </span>
            )}
          </div>

          {/* Status Badge OR Countdown (Zero Overlap) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {market.status === 'resolved' ? (
              <span className="px-2.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1 shadow-sm">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>{language === 'es' ? 'RESUELTO' : 'RESOLVED'}</span>
              </span>
            ) : market.status === 'paused' ? (
              <span className="px-2.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold flex items-center gap-1 shadow-sm">
                <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{language === 'es' ? 'PAUSADO' : 'PAUSED'}</span>
              </span>
            ) : market.status === 'closed' ? (
              <span className="px-2.5 py-0.5 rounded bg-slate-700/50 text-slate-300 border border-slate-600/40 text-[10px] font-mono font-bold flex items-center gap-1 shadow-sm">
                <span>{language === 'es' ? 'CERRADO' : 'CLOSED'}</span>
              </span>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono tabular-nums">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{getTimeRemaining(market.closeTime)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Market Question with balanced text wrap */}
        <h3 id={`market-title-${market.id}`} className="font-semibold text-sm sm:text-base text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-2 mb-4 leading-snug tracking-tight text-wrap-balance">
          {market.question}
        </h3>

        {/* Pricing & Probabilities Section (Polymarket Style) */}
        {isBinary && yesOutcome && noOutcome ? (
          <div className="space-y-3 mb-5">
            {/* Split Probability Bar without Fuzzy Glow */}
            <div className="relative h-2 w-full bg-[#0b0f19] rounded-full overflow-hidden flex border border-white/[0.08]">
              <div
                style={{ width: `${yesPercent}%` }}
                className="bg-[#10b981] h-full transition-[width] duration-300 ease-out"
              />
              <div
                style={{ width: `${noPercent}%` }}
                className="bg-[#f43f5e] h-full transition-[width] duration-300 ease-out"
              />
            </div>

            {/* Quick Action Pills for YES and NO */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateTo('detail', market.id);
                }}
                className="p-3 rounded-xl bg-emerald-500/[0.08] hover:bg-emerald-500/15 border border-emerald-500/25 hover:border-emerald-500/50 flex items-center justify-between transition-all text-left cursor-pointer btn-tactile group/yes"
              >
                <div>
                  <span className="text-xs font-bold text-[#10b981] tracking-wider flex items-center gap-1">
                    <span>{yesOutcome.name}</span>
                  </span>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                    {yesPercent}% {language === 'es' ? 'prob.' : 'chance'}
                  </div>
                </div>
                <div className="text-right font-mono font-black text-base text-[#10b981] tabular-nums">
                  {yesPercent}&cent;
                </div>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateTo('detail', market.id);
                }}
                className="p-3 rounded-xl bg-rose-500/[0.08] hover:bg-rose-500/15 border border-rose-500/25 hover:border-rose-500/50 flex items-center justify-between transition-all text-left cursor-pointer btn-tactile group/no"
              >
                <div>
                  <span className="text-xs font-bold text-[#f43f5e] tracking-wider flex items-center gap-1">
                    <span>{noOutcome.name}</span>
                  </span>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                    {noPercent}% {language === 'es' ? 'prob.' : 'chance'}
                  </div>
                </div>
                <div className="text-right font-mono font-black text-base text-[#f43f5e] tabular-nums">
                  {noPercent}&cent;
                </div>
              </button>
            </div>
          </div>
        ) : (
          /* Multi-Outcome Preview */
          <div className="space-y-2 mb-5">
            {topOutcomes.map((outcome) => {
              const pct = Math.round(outcome.currentPrice * 100);
              return (
                <div
                  key={outcome.id}
                  className="relative overflow-hidden p-2.5 rounded-xl bg-[#0b0f19] border border-white/[0.08] flex items-center justify-between text-xs"
                >
                  <div 
                    className="absolute inset-y-0 left-0 bg-blue-500/10 rounded-l-xl transition-[width] duration-300 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative z-10 font-medium text-slate-200 truncate max-w-[170px]">
                    {outcome.name}
                  </span>
                  <div className="relative z-10 flex items-center gap-2 font-mono tabular-nums">
                    <span className="text-slate-400">{pct}%</span>
                    <span className="font-bold text-[#10b981]">{pct}&cent;</span>
                  </div>
                </div>
              );
            })}
            {market.outcomes.length > 3 && (
              <div className="text-[11px] text-slate-400 text-center font-mono">
                +{market.outcomes.length - 3} {language === 'es' ? 'más opciones' : 'more outcomes'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Footer: Volume, Traders, Trade Button */}
      <div className="pt-3.5 border-t border-white/[0.08] flex items-center justify-between text-xs">
        <div className="flex items-center gap-3.5 text-slate-400 font-mono text-[11px] tabular-nums">
          <div>
            <span className="text-slate-400">Vol: </span>
            <span className="text-slate-200 font-semibold">
              ${market.volume.toLocaleString('en-US')}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{market.totalTraders.toLocaleString('en-US')}</span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            navigateTo('detail', market.id);
          }}
          className="px-3.5 py-1.5 min-h-[44px] rounded-xl bg-[#111827] hover:bg-blue-600/15 text-slate-200 hover:text-blue-400 border border-white/[0.08] hover:border-blue-500/40 text-xs font-mono font-semibold flex items-center gap-1.5 btn-tactile cursor-pointer group/btn"
        >
          <span>{language === 'es' ? 'OPERAR' : 'TRADE'}</span>
          <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 text-blue-400" />
        </button>
      </div>
    </motion.article>
  );
});

MarketCard.displayName = 'MarketCard';
