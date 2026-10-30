import React from 'react';
import { Trophy, ShieldCheck, Database, Award, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useMarket } from '../../context/MarketContext';

export const DemoBanner: React.FC = () => {
  const { language } = useLanguage();
  const { navigateTo } = useMarket();

  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-slate-900/95 to-cyan-500/10 border-b border-amber-500/20 text-xs text-slate-300 px-4 py-2">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateTo('tournaments')}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold font-mono text-[11px] cursor-pointer transition-colors"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>{language === 'es' ? 'ARENA DE TORNEOS' : 'TOURNAMENTS ARENA'}</span>
            <ArrowUpRight className="w-3 h-3 text-amber-400" />
          </button>
          <span className="text-slate-300 text-xs hidden sm:inline">
            {language === 'es'
              ? 'Organiza y compite con tus amigos con fechas límites y saldo virtual.'
              : 'Organize and compete with friends with strict deadlines and virtual credits.'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('tournaments')}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-750 text-emerald-400 border border-slate-700 text-[11px] font-mono cursor-pointer transition-colors"
          >
            <Award className="w-3 h-3 text-emerald-400" />
            <span>{language === 'es' ? 'Podio y Clasificación' : 'Live Standings'}</span>
          </button>

          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/80 text-cyan-400 border border-slate-700 text-[11px] font-mono hidden md:inline-flex">
            <Database className="w-3 h-3 text-cyan-400" />
            <span>{language === 'es' ? 'Auditoría Contable' : 'Audited Ledger'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
