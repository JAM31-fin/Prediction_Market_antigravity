import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../../context/LanguageContext';
import { useMarket } from '../../context/MarketContext';
import { 
  X, 
  Sparkles, 
  Trophy, 
  Coins, 
  TrendingUp, 
  Award, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

interface WelcomeInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeInstructionsModal: React.FC<WelcomeInstructionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { language } = useLanguage();
  const { navigateTo } = useMarket();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGoToTournaments = () => {
    onClose();
    navigateTo('tournaments');
  };

  const handleExploreMarkets = () => {
    onClose();
    navigateTo('markets');
  };

  const steps = [
    {
      step: '1',
      badge: language === 'es' ? 'PASO 1 · GRATUITO' : 'STEP 1 · FREE',
      title: language === 'es' ? 'Ingresa al Torneo' : 'Join the Tournament',
      description: language === 'es'
        ? 'Para participar en los mercados oficiales debes unirte a un torneo activo. La inscripción es 100% libre y sin costo.'
        : 'Official prediction markets are hosted inside tournaments. Join an active tournament for free with just one click.',
      icon: <Trophy className="w-5 h-5 text-amber-400" />,
      colorClasses: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      badgeClasses: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    },
    {
      step: '2',
      badge: language === 'es' ? 'PASO 2 · SALDO INICIAL' : 'STEP 2 · STARTING BANKROLL',
      title: language === 'es' ? 'Se te asignan 100 Tokens' : 'Receive 100 Tokens',
      description: language === 'es'
        ? 'Al inscribirte al torneo, el sistema te otorga automáticamente 100 tokens / créditos de prueba en tu billetera de competición.'
        : 'Upon enrollment, the system automatically credits 100 virtual tokens into your tournament bankroll.',
      icon: <Coins className="w-5 h-5 text-cyan-400" />,
      colorClasses: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
      badgeClasses: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    },
    {
      step: '3',
      badge: language === 'es' ? 'PASO 3 · INVERSIÓN' : 'STEP 3 · TRADE POSITIONS',
      title: language === 'es' ? '¡Opera en los Mercados!' : 'Trade & Invest!',
      description: language === 'es'
        ? 'Pronostica el futuro invirtiendo en los resultados que consideres correctos. Compra o vende acciones para maximizar tu patrimonio.'
        : 'Predict the future by taking positions on outcomes you believe in. Buy and sell shares to grow your net equity.',
      icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
      colorClasses: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      badgeClasses: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
    {
      step: '4',
      badge: language === 'es' ? 'PASO 4 · RECOMPENSA' : 'STEP 4 · REWARD',
      title: language === 'es' ? '¡El Podio tiene Premio!' : 'Podium Winners Get a Prize!',
      description: language === 'es'
        ? 'Al vencer la fecha límite del torneo, los participantes que queden en los primeros puestos del podio recibirán el premio acordado.'
        : 'When the tournament deadline arrives, traders finishing at the top of the leaderboard podium will win the designated prize.',
      icon: <Award className="w-5 h-5 text-purple-400" />,
      colorClasses: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
      badgeClasses: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    },
  ];

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="relative w-full max-w-2xl bg-[#0f172a] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col"
        >
          {/* Top Decorative Glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-amber-500" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="p-6 sm:p-7 pb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-bold tracking-wide mb-3">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>{language === 'es' ? 'DEMO FASE BETA · 100% GRATUITO' : 'BETA PHASE DEMO · 100% FREE'}</span>
            </div>

            <h2 id="welcome-modal-title" className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {language === 'es' ? '¡Bienvenido a Centra! Guía de Inicio Rápido' : 'Welcome to Centra! Quick Start Guide'}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              {language === 'es'
                ? 'Esta es una plataforma de predicción en fase demo abierta. No requiere dinero real ni depósitos. Sigue estos 4 sencillos pasos para participar y competir:'
                : 'This is an open demo prediction market platform. No real money or deposits required. Follow these 4 simple steps to participate and compete:'}
            </p>
          </div>

          {/* Step Cards Grid */}
          <div className="px-6 sm:px-7 py-2 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
            {steps.map((st) => (
              <div
                key={st.step}
                className="p-3.5 rounded-xl bg-[#0b0f19]/90 border border-slate-800/90 flex flex-col justify-between hover:border-slate-700 transition-colors shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${st.colorClasses}`}>
                      {st.icon}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${st.badgeClasses}`}>
                      {st.badge}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-100 mb-1">
                    {st.title}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed text-wrap-pretty">
                    {st.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Disclaimer pill */}
          <div className="px-6 sm:px-7 pt-3 pb-1">
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {language === 'es'
                  ? 'Entorno seguro: Todos los mercados son operados con créditos virtuales de prueba.'
                  : 'Safe environment: All contracts and tournaments use risk-free virtual credits.'}
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 sm:p-7 pt-4 flex flex-col gap-2 bg-slate-950/40 border-t border-slate-800/80 mt-2">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoToTournaments}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-500 hover:from-amber-400 hover:to-teal-400 text-slate-950 font-black font-mono text-xs sm:text-sm tracking-wide shadow-lg shadow-emerald-500/15 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Trophy className="w-4 h-4 text-slate-950 shrink-0" />
              <span>
                {language === 'es' 
                  ? '🏆 1. INGRESAR AL TORNEO Y RECIBIR 100 TOKENS' 
                  : '🏆 1. JOIN TOURNAMENT & RECEIVE 100 TOKENS'}
              </span>
              <ArrowRight className="w-4 h-4 text-slate-950 shrink-0" />
            </motion.button>

            <button
              type="button"
              onClick={handleExploreMarkets}
              className="w-full py-2 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors cursor-pointer text-center"
            >
              {language === 'es' ? 'Explorar mercados primero' : 'Explore markets first'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
