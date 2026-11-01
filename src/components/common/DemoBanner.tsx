import React from 'react';
import { Scale, Sparkles, Trophy, ArrowUpRight, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useMarket } from '../../context/MarketContext';

export const DemoBanner: React.FC = () => {
  const { language } = useLanguage();
  const { navigateTo, setIsWelcomeModalOpen, setIsTermsModalOpen } = useMarket();

  return (
    <aside aria-label={language === 'es' ? 'Aviso legal y de investigación' : 'Legal and research notice'} className="bg-[#0b0f19] border-b border-amber-500/20 text-xs text-slate-300 px-4 py-2">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        
        {/* Research & Experimental Simulation Notice */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>{language === 'es' ? 'INVESTIGACIÓN INDEPENDIENTE' : 'INDEPENDENT RESEARCH'}</span>
          </div>
          <span className="text-slate-300 text-xs font-sans">
            {language === 'es'
              ? 'Entorno de simulación académica sin relación institucional con la UP. Créditos de prueba sin valor fiat.'
              : 'Academic simulation environment with no institutional UP affiliation. Virtual test credits without fiat value.'}
          </span>
        </div>

        {/* Action Pills */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setIsTermsModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 hover:border-cyan-500/40 text-[11px] font-mono cursor-pointer transition-colors"
          >
            <Scale className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>{language === 'es' ? 'Descargo Legal' : 'Legal Disclaimer'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsWelcomeModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 text-[11px] font-mono cursor-pointer transition-colors"
          >
            <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
            <span>{language === 'es' ? 'Guía Rápida' : 'Quick Guide'}</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('tournaments')}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-mono font-bold cursor-pointer transition-colors"
          >
            <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
            <span>{language === 'es' ? 'Torneo S/ 15' : 'S/ 15 Tournament'}</span>
            <ArrowUpRight className="w-3 h-3 text-amber-400 shrink-0" />
          </button>
        </div>

      </div>
    </aside>
  );
};
