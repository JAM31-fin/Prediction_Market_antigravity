import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useMarket } from '../../context/MarketContext';
import { useLanguage } from '../../context/LanguageContext';
import { HeroSection } from './HeroSection';
import { CategoryFilter } from './CategoryFilter';
import { MarketCard } from './MarketCard';
import { PhoneAuthForm } from '../auth/PhoneAuthForm';
import { SlidesModal } from '../common/SlidesModal';
import { 
  TrendingUp, 
  Flame, 
  Clock, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Activity, 
  Zap, 
  EyeOff,
  Trophy,
  Phone,
  Scale,
  Award,
  Ban,
  HelpCircle,
  CheckCircle2
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const { 
    markets, 
    selectedCategory, 
    setSelectedCategory, 
    navigateTo, 
    trades, 
    user, 
    setIsTermsModalOpen 
  } = useMarket();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'trending' | 'volume' | 'ending' | 'new'>('trending');
  const [isSlidesOpen, setIsSlidesOpen] = useState(false);

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
    { id: 'volume', label: language === 'es' ? 'Más Operados' : 'Most Traded', icon: <TrendingUp className="w-4 h-4 text-[#10b981]" /> },
    { id: 'ending', label: language === 'es' ? 'Por Finalizar' : 'Ending Soon', icon: <Clock className="w-4 h-4 text-[#3b82f6]" /> },
    { id: 'new', label: language === 'es' ? 'Nuevos Retos' : 'New Contracts', icon: <Sparkles className="w-4 h-4 text-purple-400" /> },
  ] as const;

  return (
    <div className="min-h-screen pb-20">
      {/* Top Hero: Independent Research Disclaimer + CentraMarkets Header + Quick Search */}
      <HeroSection />

      {/* Primary Market Explorer (Immediately Visible in First Viewport) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8">
        
        {/* Category Filter Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
              {language === 'es' ? 'Sectores y Categorías' : 'Contract Sectors'}
            </h2>
            <button
              onClick={() => navigateTo('markets')}
              className="text-xs text-[#3b82f6] hover:text-blue-400 flex items-center gap-1 font-semibold transition-colors btn-tactile cursor-pointer"
            >
              <span>{language === 'es' ? `Ver Todos (${markets.length})` : `View All (${markets.length})`}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <CategoryFilter />
        </div>

        {/* Live Order Tape Strip */}
        {trades.length > 0 && (
          <div className="mb-6 p-3 rounded-xl bg-[#111827] border border-white/[0.08] flex items-center gap-3 overflow-hidden text-xs font-mono shadow-sm">
            <div className="flex items-center gap-2 text-[#3b82f6] font-bold shrink-0 pl-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3b82f6]"></span>
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
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${trade.type === 'BUY' ? 'bg-[#10b981]/20 text-emerald-300' : 'bg-[#f43f5e]/20 text-rose-300'}`}>
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
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-1 mb-6">
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
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3b82f6]"
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
              className="text-center py-20 bg-[#111827] rounded-2xl border border-white/[0.08] flex flex-col items-center justify-center shadow-sm"
            >
              <p className="text-slate-400 text-sm font-medium">No open markets found in this category.</p>
              {selectedCategory !== 'All' && (
                <button
                  onClick={() => setSelectedCategory('All')}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#162032] border border-white/[0.08] text-slate-200 hover:text-white hover:bg-slate-700 text-xs font-semibold transition-colors shadow-sm cursor-pointer"
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

        {/* BOTTOM SECTION: TOURNAMENTS, REGISTRATION, GUIDE & TRANSPARENCY */}
        <div className="mt-20 pt-12 border-t border-white/[0.08] space-y-12">
          
          {/* Tournament Arena & Registration Gate Section */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#0d131f] border border-white/[0.12] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              {/* Left Column: Tournament Pitch & Benefits */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold shadow-sm">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>{language === 'es' ? 'TORNEO PILOTO BETA · PREMIO S/ 15' : 'BETA PILOT TOURNAMENT · S/ 15 PRIZE'}</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                    {language === 'es' ? 'INSCRIPCIÓN 100% GRATUITA' : '100% FREE ENTRY'}
                  </span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {language === 'es'
                    ? 'Compite con tus amigos en el ranking de predicciones'
                    : 'Compete with friends in the prediction leaderboard'}
                </h3>

                <p className="text-sm text-slate-300 leading-relaxed max-w-xl text-wrap-pretty">
                  {language === 'es'
                    ? 'Únete a los torneos oficiales con saldo virtual independiente. Al registrarte con tu número de celular recibes tus créditos iniciales para comenzar a operar y clasificar en el podio.'
                    : 'Join official tournaments with dedicated virtual subwallets. Register with your phone number to receive your starting test bankroll and climb the podium.'}
                </p>

                {/* 3 Value Pillars */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06]">
                    <Ban className="w-4 h-4 text-emerald-400 mb-1.5" />
                    <div className="text-xs font-bold text-slate-200">
                      {language === 'es' ? 'Cero Dinero Real' : 'Zero Real Money'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {language === 'es' ? 'Créditos virtuales sin pérdidas' : 'Virtual credits, zero loss risk'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06]">
                    <Phone className="w-4 h-4 text-[#3b82f6] mb-1.5" />
                    <div className="text-xs font-bold text-slate-200">
                      {language === 'es' ? 'Acceso con Celular' : 'Phone Sign In'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {language === 'es' ? 'Solo teléfono (+51). En 10s' : 'Phone only (+51). In 10s'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06]">
                    <Award className="w-4 h-4 text-amber-400 mb-1.5" />
                    <div className="text-xs font-bold text-slate-200">
                      {language === 'es' ? 'Podio y Reconocimiento' : 'Live Podium'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {language === 'es' ? 'Premio al líder del torneo' : 'Reward for tournament leader'}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSlidesOpen(true)}
                    className="px-4 py-2 min-h-[40px] rounded-xl bg-[#111827] hover:bg-slate-800 text-slate-200 border border-white/[0.12] text-xs font-mono font-semibold flex items-center gap-2 btn-tactile cursor-pointer shadow-sm transition-colors"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>{language === 'es' ? 'Ver Guía Interactiva (Slides)' : 'Interactive Guide (Slides)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateTo('tournaments')}
                    className="px-4 py-2 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold flex items-center gap-2 btn-tactile cursor-pointer shadow-sm transition-colors"
                  >
                    <Trophy className="w-4 h-4 text-slate-950" />
                    <span>{language === 'es' ? 'Explorar Torneos Activos' : 'Browse Active Tournaments'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Right Column: Embedded Registration Form for Unregistered Users, or Profile Card for Authenticated */}
              <div className="lg:col-span-5">
                {!user ? (
                  <div className="p-5 sm:p-6 rounded-2xl bg-[#111827] border border-white/[0.12] shadow-xl">
                    <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/[0.08]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                          <Phone className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-white">
                            {language === 'es' ? 'Regístrate para Operar' : 'Register to Trade'}
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            {language === 'es' ? 'Recibe tus 100 créditos de prueba' : 'Get your 100 free test tokens'}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                        GRATIS
                      </span>
                    </div>

                    <PhoneAuthForm
                      compactMode={true}
                      onOpenTerms={() => setIsTermsModalOpen(true)}
                      onSuccess={() => navigateTo('markets')}
                    />

                    <div className="mt-3.5 pt-3 border-t border-white/[0.06] text-center">
                      <p className="text-[10px] font-mono text-slate-400">
                        {language === 'es' ? '1 cuenta por participante · Sin spam · Saldo virtual' : '1 account per trader · No spam · Virtual credits'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-[#111827] border border-white/[0.12] text-center space-y-4 shadow-xl">
                    <div className="w-12 h-12 rounded-full bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center mx-auto text-[#10b981]">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white">
                        {language === 'es' ? `¡Bienvenido, ${user.username || user.name}!` : `Welcome, ${user.username || user.name}!`}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {language === 'es'
                          ? `Tu cuenta está activa con $${(user.virtualBalance ?? 0).toFixed(2)} USD virtuales listos para pronosticar.`
                          : `Your account is active with $${(user.virtualBalance ?? 0).toFixed(2)} virtual USD ready to trade.`}
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
                      <button
                        onClick={() => navigateTo('portfolio')}
                        className="px-4 py-2 min-h-[40px] rounded-xl bg-[#3b82f6] hover:bg-blue-600 text-white font-mono text-xs font-bold btn-tactile cursor-pointer"
                      >
                        {language === 'es' ? 'Ver Mi Portafolio' : 'View Portfolio'}
                      </button>
                      <button
                        onClick={() => navigateTo('tournaments')}
                        className="px-4 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-semibold btn-tactile cursor-pointer border border-white/[0.08]"
                      >
                        {language === 'es' ? 'Arena de Torneos' : 'Tournaments Arena'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Platform Transparency & Integrity Pillars */}
          <div className="p-6 sm:p-7 rounded-2xl bg-[#111827] border border-white/[0.08] grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-[#0b0f19] border border-white/[0.08] flex items-center justify-center text-[#3b82f6] shrink-0 shadow-sm">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100 tracking-tight">
                  {language === 'es' ? 'Liquidez Algorítmica LMSR' : 'Algorithmic Liquidity'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {language === 'es'
                    ? 'Tus órdenes ejecutan directamente contra el creador de mercado de Hanson, garantizando contraparte y cálculo continuo de precios.'
                    : 'Positions execute directly against the Hanson LMSR market maker, guaranteeing execution at mathematical fair value.'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-[#0b0f19] border border-white/[0.08] flex items-center justify-center text-[#10b981] shrink-0 shadow-sm">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100 tracking-tight">
                  {language === 'es' ? 'Oráculos con Reglas Claras' : 'Authoritative Oracles'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {language === 'es'
                    ? 'Criterios explícitos de resolución, fuentes oficiales designadas y periodo de impugnación optimista para evitar ambigüedades.'
                    : 'Explicit resolution criteria, designated source authorities, and optimistic dispute windows eliminate outcome ambiguity.'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-[#0b0f19] border border-white/[0.08] flex items-center justify-center text-purple-400 shrink-0 shadow-sm">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100 tracking-tight">
                  {language === 'es' ? 'Libro Contable Auditado' : 'Audited Ledger'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {language === 'es'
                    ? 'Comisiones transparentes del 1% y movimientos atómicos de créditos registrados con consistencia contable.'
                    : 'Transparent 1% trading commission with atomic credit movements recorded consistently on the platform ledger.'}
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Interactive Frontend-Slides Modal */}
      <SlidesModal
        isOpen={isSlidesOpen}
        onClose={() => setIsSlidesOpen(false)}
        initialDeck="how-it-works"
      />
    </div>
  );
};
