import React from 'react';
import { Market } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { getLocalizedMarket } from '../../i18n/marketTranslations';
import { ShieldCheck, BookOpen, Clock, CheckCircle2, Cpu, FileText } from 'lucide-react';

interface MarketRulesCardProps {
  market: Market;
}

export const MarketRulesCard: React.FC<MarketRulesCardProps> = ({ market: rawMarket }) => {
  const { language } = useLanguage();
  const market = getLocalizedMarket(rawMarket, language);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <BookOpen className="w-4 h-4 text-emerald-400" />
        <h3 className="font-semibold text-sm text-slate-100 uppercase tracking-wider font-mono">
          {language === 'es' ? 'Reglas de Resolución y Especificación' : 'Contract Specification & Resolution Rules'}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-850">
          <div className="text-slate-400 text-[11px] mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{language === 'es' ? 'Fuente de Resolución:' : 'Resolution Authority:'}</span>
          </div>
          <div className="font-semibold text-slate-200 font-sans">
            {market.resolutionSource}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-950 border border-slate-850">
          <div className="text-slate-400 text-[11px] mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>{language === 'es' ? 'Liquidación Programada:' : 'Scheduled Settlement:'}</span>
          </div>
          <div className="font-semibold text-slate-200">
            {new Date(market.resolutionTime).toLocaleString(language === 'es' ? 'es-ES' : 'en-US')}
          </div>
        </div>
      </div>

      {/* Rules Narrative */}
      <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-2">
        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-amber-400" />
          <span>{language === 'es' ? 'Criterio de Determinación:' : 'Determination Criteria:'}</span>
        </div>
        <p className="text-slate-300 font-sans text-xs">
          {market.resolutionRules}
        </p>
      </div>

      {/* LMSR Mathematical Parameters */}
      <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-400">
        <div>
          <span>{language === 'es' ? 'Parámetro de Liquidez (b): ' : 'Liquidity Parameter (b): '}</span>
          <span className="text-slate-200 font-bold">{market.liquidityParameter}</span>
        </div>
        <div>
          <span>{language === 'es' ? 'Comisión: ' : 'Commission Rate: '}</span>
          <span className="text-slate-200 font-bold">{(market.commissionRate * 100).toFixed(1)}%</span>
        </div>
        <div>
          <span>{language === 'es' ? 'Spread: ' : 'Execution Spread: '}</span>
          <span className="text-slate-200 font-bold">{(market.spread * 100).toFixed(1)}%</span>
        </div>
        <div>
          <span>{language === 'es' ? 'Pago por acción ganadora: ' : 'Payout Unit: '}</span>
          <span className="text-emerald-400 font-bold">$1.00 USD</span>
        </div>
      </div>
    </div>
  );
};
