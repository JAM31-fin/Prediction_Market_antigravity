import React from 'react';
import { useMarket } from '../../context/MarketContext';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Search, 
  ArrowRight, 
  ShieldCheck, 
  Activity, 
  Layers, 
  Coins, 
  Scale,
  Sparkles,
  Trophy,
  AlertTriangle
} from 'lucide-react';

export const HeroSection: React.FC = () => {
  const { searchQuery, setSearchQuery, navigateTo, metrics, user, setIsTermsModalOpen } = useMarket();
  const { language } = useLanguage();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigateTo('markets');
  };

  return (
    <div className="relative pt-6 pb-8 md:pt-8 md:pb-10 border-b border-white/[0.08] overflow-hidden bg-gradient-to-b from-slate-950 via-[#0b0f19] to-[#0b0f19]">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* MANDATORY INDEPENDENT RESEARCH DISCLAIMER CARD (Prominent at top of Home) */}
        <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-[#0f172a]/95 border border-amber-500/35 shadow-xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-emerald-500 to-blue-500" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 shadow-sm">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    {language === 'es' ? 'AVISO OFICIAL: PROYECTO DE INVESTIGACIÓN INDEPENDIENTE' : 'OFFICIAL NOTICE: INDEPENDENT RESEARCH PROJECT'}
                  </span>
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                    {language === 'es' ? 'SIMULACIÓN VIRTUAL' : 'VIRTUAL SIMULATION'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-4xl text-wrap-pretty">
                  <strong>CentraMarkets</strong> {language === 'es'
                    ? 'es una plataforma computacional desarrollada como proyecto de investigación independiente sobre la regla logarítmica de mercado (LMSR). No cuenta con vinculación institucional, auspicio ni respaldo de la Universidad del Pacífico (UP) ni CEUP. Se opera exclusivamente con créditos de prueba sin valor fiat ni costo de entrada. No es una casa de apuestas.'
                    : 'is a computational platform developed as an independent research project on logarithmic market scoring rules (LMSR). It holds no institutional affiliation, sponsorship, or endorsement from Universidad del Pacífico (UP) or CEUP. Operates exclusively with test credits without fiat value or real money entry fees. It is not a gambling service.'}
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2 self-start md:self-center">
              <button
                type="button"
                onClick={() => setIsTermsModalOpen(true)}
                className="px-3.5 py-2 min-h-[38px] rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 text-xs font-mono font-semibold flex items-center gap-1.5 btn-tactile cursor-pointer shadow-sm transition-colors"
              >
                <Scale className="w-3.5 h-3.5 text-cyan-400" />
                <span>{language === 'es' ? 'Ver Términos & Marco Ético' : 'Terms & Ethical Framework'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Brand Headline & Market Explorer Pitch (Compact, Markets Front and Center) */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#3b82f6] font-bold tracking-wider uppercase mb-1.5">
              <span>●</span>
              <span>{language === 'es' ? 'Terminal de Predicciones Algorítmicas' : 'Algorithmic Prediction Terminal'}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              CentraMarkets <span className="text-slate-400 font-medium text-lg sm:text-2xl font-sans">| {language === 'es' ? 'Explorador en Tiempo Real' : 'Real-Time Explorer'}</span>
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              {language === 'es'
                ? 'Liquidez algorítmica continua garantizada mediante LMSR. Pronostica eventos y explora las probabilidades implícitas del mercado.'
                : 'Guaranteed continuous algorithmic liquidity powered by LMSR. Forecast contract events and explore real-time market odds.'}
            </p>
          </div>

          {/* Quick Metrics Ticker Summary */}
          <div className="flex items-center gap-2 font-mono text-xs text-slate-300 tabular-nums shrink-0">
            <div className="px-3 py-1.5 rounded-xl bg-[#111827] border border-white/[0.08] flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#10b981]" />
              <span className="text-slate-400">{language === 'es' ? 'Volumen:' : 'Volume:'}</span>
              <span className="font-bold text-white">${metrics.totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-[#111827] border border-white/[0.08] flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#3b82f6]" />
              <span className="text-slate-400">{language === 'es' ? 'Mercados:' : 'Markets:'}</span>
              <span className="font-bold text-white">{metrics.activeMarkets}</span>
            </div>
          </div>
        </div>

        {/* Central Search Bar */}
        <form onSubmit={handleSearch} className="max-w-3xl relative">
          <div className="relative flex items-center group">
            <Search className="w-5 h-5 text-slate-500 group-focus-within:text-[#3b82f6] transition-colors absolute left-4 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'es' ? "Buscar contratos (ej. Retos grupales, Deportes, Cripto, Economía)..." : "Search prediction contracts (e.g. Sports, Crypto, Economics)..."}
              aria-label={language === 'es' ? "Buscar contratos de predicción" : "Search prediction contracts"}
              className="w-full bg-[#0b0f19] border border-white/[0.12] rounded-2xl pl-12 pr-32 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/30 shadow-lg shadow-black/40 transition-all duration-150 ease-out"
            />
            <div className="absolute right-2 flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 min-h-[38px] rounded-xl bg-[#3b82f6] hover:bg-blue-600 text-white text-xs font-bold font-mono btn-tactile flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>{language === 'es' ? 'BUSCAR' : 'SEARCH'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
