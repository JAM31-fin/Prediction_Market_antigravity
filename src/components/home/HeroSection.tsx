import React from 'react';
import { useMarket } from '../../context/MarketContext';
import { useLanguage } from '../../context/LanguageContext';
import { Search, ArrowRight, ShieldCheck, Activity, Layers, Coins, Trophy } from 'lucide-react';

export const HeroSection: React.FC = () => {
  const { searchQuery, setSearchQuery, navigateTo, metrics } = useMarket();
  const { language, t } = useLanguage();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigateTo('markets');
  };

  return (
    <div className="relative py-10 md:py-14 border-b border-[#151e2e] overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Headline & Badge */}
        <div className="max-w-3xl mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#080d18] border border-amber-500/30 text-amber-300 text-xs font-mono font-medium mb-4 shadow-sm">
            <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{language === 'es' ? 'TORNEO ALFA ENTRE AMIGOS' : 'FRIENDS ALPHA TOURNAMENT'}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-3 text-wrap-balance">
            {language === 'es' ? (
              <>Pronostica y Compite con <span className="text-[#00f0a0]">Tus Amigos</span></>
            ) : (
              <>Predict & Compete with <span className="text-[#00f0a0]">Your Friends</span></>
            )}
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl text-wrap-pretty">
            {language === 'es'
              ? 'Participa en retos del grupo, deportes, cripto y vida cotidiana. Liquidez garantizada en tiempo real para operar al instante.'
              : 'Trade group challenges, sports, crypto, and everyday milestones with guaranteed continuous liquidity and instant execution.'}
          </p>
        </div>

        {/* Central Search Input with Focus Ring & Concentric Radius */}
        <form onSubmit={handleSearch} className="max-w-2xl relative mb-10">
          <div className="relative flex items-center group">
            <Search className="w-5 h-5 text-slate-500 group-focus-within:text-[#00f0a0] transition-colors absolute left-4 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'es' ? 'Buscar retos o eventos (ej. Reto grupal, Fútbol, Bitcoin)...' : 'Search contracts (e.g. Group challenge, Soccer, Bitcoin)...'}
              className="w-full bg-[#060a14] border border-[#151e2e] rounded-2xl pl-12 pr-32 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#00f0a0]/60 focus:ring-1 focus:ring-[#00f0a0]/20 shadow-lg shadow-black/50 transition-[border-color,box-shadow] duration-150 ease-out"
            />
            <div className="absolute right-2 flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 min-h-[38px] rounded-xl bg-[#00f0a0] hover:bg-[#00f0a0]/90 text-slate-950 text-xs font-bold font-mono btn-tactile flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(0,240,160,0.3)]"
              >
                <span>{language === 'es' ? 'BUSCAR' : 'EXPLORE'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>

        {/* Telemetry Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl">
          <div className="p-3.5 rounded-2xl terminal-card elevation-card transition-colors">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Activity className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Total Volume</span>
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-100 tracking-tight">
              ${metrics.totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] font-mono text-[#00f0a0] flex items-center gap-1 mt-0.5">
              <span>●</span> Live 24h Indexed
            </div>
          </div>

          <div className="p-3.5 rounded-2xl terminal-card elevation-card transition-colors">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Active Markets</span>
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-100 tracking-tight">
              {metrics.activeMarkets}
            </div>
            <div className="text-[11px] font-mono text-[#00d2ff] flex items-center gap-1 mt-0.5">
              <span>●</span> Binary & Multi
            </div>
          </div>

          <div className="p-3.5 rounded-2xl terminal-card elevation-card transition-colors">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Liquidity Engine</span>
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-100 tracking-tight">
              LMSR Model
            </div>
            <div className="text-[11px] font-mono text-amber-400 flex items-center gap-1 mt-0.5">
              <span>●</span> Continuous AMM
            </div>
          </div>

          <div className="p-3.5 rounded-2xl terminal-card elevation-card transition-colors">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Coins className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Sandbox Capital</span>
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-[#00f0a0] tracking-tight">
              $1,000.00
            </div>
            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
              <span>●</span> Virtual Testing
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
