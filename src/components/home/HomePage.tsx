import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useMarket } from '../../context/MarketContext';
import { useLanguage } from '../../context/LanguageContext';
import { HeroSection } from './HeroSection';
import { CategoryFilter } from './CategoryFilter';
import { MarketCard } from './MarketCard';
import { TrendingUp, Flame, Clock, Sparkles, ArrowRight, ShieldCheck, Activity, Zap, EyeOff } from 'lucide-react';

export const HomePage: React.FC = () => {
  const { markets, selectedCategory, setSelectedCategory, navigateTo, trades } = useMarket();
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'trending' | 'volume' | 'ending' | 'new'>('trending');

  // Filter by category if one is selected
  const categoryFilteredMarkets = markets.filter((m) => {
    if (selectedCategory === 'All') return true;
    return m.category === selectedCategory;
  });

  // Trending (high trader count)
  const trendingMarkets = [...categoryFilteredMarkets].sort((a, b) => b.totalTraders - a.totalTraders);

  // Most traded (volume)
  const mostTradedMarkets = [...categoryFilteredMarkets].sort((a, b) => b.volume - a.volume);

  // Ending soon (closest closeTime in the future)
  const endingSoonMarkets = [...categoryFilteredMarkets]
    .filter((m) => m.status === 'open' && new Date(m.closeTime).getTime() > Date.now())
    .sort((a, b) => new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime());

  // Newest
  const newestMarkets = [...categoryFilteredMarkets].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const displayedMarkets = {
    trending: trendingMarkets,
    volume: mostTradedMarkets,
    ending: endingSoonMarkets,
    new: newestMarkets,
  }[activeTab];

  const TABS = [
    { id: 'trending', label: language === 'es' ? 'En Tendencia' : 'Trending', icon: <Flame className="w-4 h-4 text-amber-400" /> },
    { id: 'volume', label: language === 'es' ? 'Más Operados' : 'Most Traded', icon: <TrendingUp className="w-4 h-4 text-emerald-400" /> },
    { id: 'ending', label: language === 'es' ? 'Por Finalizar' : 'Ending Soon', icon: <Clock className="w-4 h-4 text-blue-400" /> },
    { id: 'new', label: language === 'es' ? 'Nuevos Retos' : 'New Contracts', icon: <Sparkles className="w-4 h-4 text-purple-400" /> },
  ] as const;

  return (
    <div className="min-h-screen pb-20">
      {/* Hero with Search & Telemetry */}
      <HeroSection />

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        
        {/* Category Filter Bar */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {language === 'es' ? 'Sectores y Categorías' : 'Contract Sectors'}
            </h2>
            <button
              onClick={() => navigateTo('markets')}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold transition-colors"
            >
              <span>{language === 'es' ? `Ver Todos (${markets.length})` : `View All (${markets.length})`}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <CategoryFilter />
        </div>

        {/* Live Order Tape Strip */}
        {trades.length > 0 && (
          <div className="mb-10 p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3 overflow-hidden text-xs font-mono shadow-sm">
            <div className="flex items-center gap-2 text-cyan-400 font-bold shrink-0 pl-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="tracking-wider">LIVE TAPE:</span>
            </div>
            <div className="flex items-center gap-6 overflow-x-auto no-scrollbar scrollbar-none whitespace-nowrap text-slate-300 tabular-nums">
              {trades.slice(0, 6).map((trade) => (
                <span key={trade.id} className="inline-flex items-center gap-1.5">
                  <span className="text-slate-400">
                    {trade.isAnonymous ? (
                      <span className="inline-flex items-center gap-1 text-slate-400 italic">
                        <EyeOff className="w-3 h-3 text-slate-500" />
                        {language === 'es' ? 'Trader Anónimo' : 'Anon Trader'}
                      </span>
                    ) : (
                      trade.userName || 'Trader'
                    )}
                  </span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${trade.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                    {trade.type}
                  </span>
                  <span className="text-slate-200">{trade.outcomeName}</span>
                  <span className="text-slate-100 font-semibold">${trade.amount.toFixed(0)}</span>
                  <span className="text-slate-500">({Math.round(trade.price * 100)}&cent;)</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Section Tabs: Trending, Most Traded, Ending Soon, New */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-8">
          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 pb-3 text-sm font-semibold transition-colors cursor-pointer ${
                    isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="home-active-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <span className="text-xs text-slate-400 font-mono tabular-nums hidden sm:inline">
            Displaying {displayedMarkets.length} of {markets.length} contracts
          </span>
        </div>

        {/* Market Cards Grid with Animation */}
        <AnimatePresence mode="wait">
          {displayedMarkets.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20 bg-slate-900 rounded-xl border border-slate-800 flex flex-col items-center justify-center shadow-sm"
            >
              <p className="text-slate-400 text-sm font-medium">No open markets found in this category.</p>
              {selectedCategory !== 'All' && (
                <button
                  onClick={() => setSelectedCategory('All')}
                  className="mt-4 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                >
                  View all categories
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={activeTab + selectedCategory}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {displayedMarkets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Platform Transparency Callout */}
        <div className="mt-16 p-6 sm:p-7 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0 shadow-sm">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100 tracking-tight">Algorithmic Liquidity</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Positions execute directly against the LMSR market maker, guaranteeing execution for every contract at mathematical fair value.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 shrink-0 shadow-sm">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100 tracking-tight">Authoritative Oracles</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Explicit resolution criteria, designated source authorities, and exact settlement schedules eliminate outcome ambiguity.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-purple-400 shrink-0 shadow-sm">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100 tracking-tight">Audited Double-Entry Ledger</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Transparent 1% trading commission with atomic credit movements audited on the platform ledger.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
