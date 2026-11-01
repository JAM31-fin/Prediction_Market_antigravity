import React, { useState } from 'react';
import { useMarket } from '../../context/MarketContext';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Search, 
  ArrowRight, 
  ShieldCheck, 
  Activity, 
  Layers, 
  Coins, 
  Trophy, 
  Sparkles,
  Phone,
  Scale,
  GraduationCap,
  Ban,
  Award,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { SlidesModal } from '../common/SlidesModal';
import { PhoneAuthForm } from '../auth/PhoneAuthForm';

export const HeroSection: React.FC = () => {
  const { searchQuery, setSearchQuery, navigateTo, metrics, user, setIsTermsModalOpen, setIsWelcomeModalOpen } = useMarket();
  const { language } = useLanguage();
  const [isSlidesOpen, setIsSlidesOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigateTo('markets');
  };

  return (
    <div className="relative py-8 md:py-12 border-b border-white/[0.08] overflow-hidden bg-gradient-to-b from-slate-950 via-[#0b0f19] to-[#0b0f19]">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* UNREGISTERED / WELCOME SCREEN HERO */}
        {!user ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-8">
            
            {/* Left Column: Welcome Briefing & Academic Research Badges */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Badges strip */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Fase Beta Experimental — Sin Dinero Real</span>
                </span>

                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 hover:border-cyan-500/40 text-xs font-mono transition-colors cursor-pointer"
                >
                  <Scale className="w-3 h-3 text-cyan-400" />
                  <span>Aviso Legal & Disclaimer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSlidesOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>¿Cómo funciona?</span>
                </button>
              </div>

              {/* Main Welcome Headline */}
              <div>
                <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.15] text-wrap-balance">
                  Simulador de <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Mercados de Predicción</span>
                </h1>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed mt-3 max-w-2xl text-wrap-pretty">
                  Plataforma algorítmica para el pronóstico colectivo de eventos mediante la regla de puntuación de mercado logarítmica (LMSR). Participa con saldo simulado de prueba y compite en el ranking.
                </p>
              </div>

              {/* Academic & Non-Gambling Disclaimer Snippet */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/25 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[12px] text-slate-300 leading-relaxed">
                  <strong>Investigación Independiente:</strong> Sin relación institucional, patrocinio ni aval de la Universidad del Pacífico (UP) ni CEUP. No es una casa de apuestas y no involucra dinero real de entrada.
                </p>
              </div>

              {/* 3 Core Value Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06]">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
                    <Ban className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs font-bold text-slate-100">Sin Dinero Real</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                    Puntos virtuales sin valor financiero. Cero riesgo de pérdidas.
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06]">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs font-bold text-slate-100">Registro Telefónico</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                    Solo celular (+51). Sin correos @up.edu.pe ni contraseñas.
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06]">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-2">
                    <Award className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs font-bold text-slate-100">Torneo Piloto S/ 15</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                    Inscripción 100% gratuita. Premio al líder del podio.
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Instant Phone Registration Card */}
            <div className="lg:col-span-5">
              <div className="p-5 sm:p-6 rounded-2xl bg-[#0d131f] border border-white/[0.12] shadow-2xl relative">
                
                {/* Header of Phone Card */}
                <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-white">
                        Acceso al Torneo Beta
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Ingresa con tu celular en 10 segundos
                      </p>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                    GRATUITO
                  </span>
                </div>

                {/* Embedded Modular Phone Auth Form */}
                <PhoneAuthForm
                  compactMode={true}
                  onOpenTerms={() => setIsTermsModalOpen(true)}
                  onSuccess={() => navigateTo('markets')}
                />

                <div className="mt-4 pt-3 border-t border-white/[0.06] text-center">
                  <p className="text-[10px] font-mono text-slate-400">
                    Sistema Anti-Sybil · 1 cuenta por participante · Sin spam
                  </p>
                </div>

              </div>
            </div>

          </div>
        ) : (
          /* AUTHENTICATED LOGGED-IN HERO */
          <div className="max-w-3xl mb-8">
            <div className="flex flex-wrap items-center gap-2.5 mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111827] border border-amber-500/30 text-amber-300 text-xs font-mono font-medium shadow-sm">
                <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>TORNEO PILOTO BETA (PREMIO S/ 15)</span>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 font-mono text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Fase Beta Experimental — Sin Dinero Real</span>
              </span>

              <button
                onClick={() => setIsSlidesOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#111827] border border-blue-500/30 hover:border-blue-500/60 text-[#3b82f6] text-xs font-mono font-medium transition-colors cursor-pointer shadow-sm hover:bg-blue-500/10"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>¿Cómo funciona? (Slides)</span>
              </button>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-3 text-wrap-balance">
              Pronostica y Compite con <span className="text-[#3b82f6]">Tus Amigos</span>
            </h1>

            <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl text-wrap-pretty">
              Participa en retos del grupo, deportes, cripto y actualidad. Liquidez algorítmica continua garantizada mediante LMSR.
            </p>
          </div>
        )}

        {/* Central Search Bar */}
        <form onSubmit={handleSearch} className="max-w-2xl relative mb-8">
          <div className="relative flex items-center group">
            <Search className="w-5 h-5 text-slate-500 group-focus-within:text-[#3b82f6] transition-colors absolute left-4 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar mercados o eventos (ej. Reto grupal, Fútbol, Elecciones)..."
              className="w-full bg-[#0b0f19] border border-white/[0.08] rounded-2xl pl-12 pr-32 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#3b82f6]/60 focus:ring-1 focus:ring-[#3b82f6]/20 shadow-lg shadow-black/50 transition-[border-color,box-shadow] duration-150 ease-out"
            />
            <div className="absolute right-2 flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 min-h-[38px] rounded-xl bg-[#3b82f6] hover:bg-blue-600 text-white text-xs font-bold font-mono btn-tactile flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>BUSCAR</span>
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
              <span>Volumen Total</span>
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-100 tracking-tight">
              ${metrics.totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] font-mono text-[#10b981] flex items-center gap-1 mt-0.5">
              <span>●</span> En Vivo 24h
            </div>
          </div>

          <div className="p-3.5 rounded-2xl terminal-card elevation-card transition-colors">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Mercados Activos</span>
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-100 tracking-tight">
              {metrics.activeMarkets}
            </div>
            <div className="text-[11px] font-mono text-[#3b82f6] flex items-center gap-1 mt-0.5">
              <span>●</span> Binarios y Multi
            </div>
          </div>

          <div className="p-3.5 rounded-2xl terminal-card elevation-card transition-colors">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Motor LMSR</span>
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-100 tracking-tight">
              Hanson C(q)
            </div>
            <div className="text-[11px] font-mono text-amber-400 flex items-center gap-1 mt-0.5">
              <span>●</span> AMM Continuo
            </div>
          </div>

          <div className="p-3.5 rounded-2xl terminal-card elevation-card transition-colors">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Coins className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Créditos de Prueba</span>
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-[#10b981] tracking-tight">
              100 Tokens
            </div>
            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
              <span>●</span> Sin Dinero Real
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
