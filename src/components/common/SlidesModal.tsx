import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../../context/LanguageContext';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  ShieldCheck, 
  Cpu, 
  Trophy, 
  Coins, 
  Lock, 
  CheckCircle2, 
  ArrowRight,
  BookOpen
} from 'lucide-react';

interface SlidesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDeck?: 'how-it-works' | 'tournament-rules';
}

export const SlidesModal: React.FC<SlidesModalProps> = ({
  isOpen,
  onClose,
  initialDeck = 'how-it-works',
}) => {
  const { language } = useLanguage();
  const [deck, setDeck] = useState<'how-it-works' | 'tournament-rules'>(initialDeck);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setDeck(initialDeck);
      setCurrentSlide(0);
    }
  }, [isOpen, initialDeck]);

  const howItWorksSlides = [
    {
      badge: language === 'es' ? 'PASO 1 • INTRODUCCIÓN' : 'STEP 1 • INTRODUCTION',
      icon: <BookOpen className="w-5 h-5 text-[#38bdf8]" />,
      title: language === 'es' ? '¿Qué es CentraMarkets?' : 'What is CentraMarkets?',
      subtitle: language === 'es' 
        ? 'Una plataforma de predicciones descentralizada para ti y tu grupo.'
        : 'A decentralized prediction market platform for you and your friends.',
      description: language === 'es'
        ? 'En lugar de encuestas de opinión estáticas, los mercados de predicción permiten a los usuarios respaldar sus opiniones con saldo virtual. El precio de cada opción refleja directamente la probabilidad colectiva del resultado.'
        : 'Instead of static polls, prediction markets allow participants to back their beliefs with test bankrolls. The price of each share directly reflects the crowd\'s collective probability.',
      highlights: [
        { label: language === 'es' ? 'Liquidez Continua' : 'Continuous Liquidity', val: language === 'es' ? 'Siempre hay contraparte para operar' : 'Always a counterparty ready to trade' },
        { label: language === 'es' ? 'Precio = Probabilidad' : 'Price = Probability', val: '$0.65 USD = 65% probabilidad' },
        { label: language === 'es' ? 'Pago Fijo al Cierre' : 'Fixed Payout', val: '$1.00 USD por acción ganadora' },
      ],
    },
    {
      badge: language === 'es' ? 'PASO 2 • MATEMÁTICA LMSR' : 'STEP 2 • LMSR MATHEMATICS',
      icon: <Cpu className="w-5 h-5 text-[#10b981]" />,
      title: language === 'es' ? 'Motor de Precios LMSR de Hanson' : 'Hanson\'s LMSR Pricing Engine',
      subtitle: language === 'es'
        ? 'Precios y probabilidades gobernados por algoritmos puros sin manipulación.'
        : 'Prices and odds governed by mathematical invariants without manipulation.',
      description: language === 'es'
        ? 'CentraMarkets utiliza la regla de puntuación logarítmica de Robin Hanson (LMSR). Cada compra de acciones incrementa el precio de esa opción y reduce las demás suavemente, garantizando que el mercado nunca se quede sin liquidez.'
        : 'CentraMarkets implements Robin Hanson\'s Logarithmic Market Scoring Rule. Buying shares moves odds smoothly along an exponential curve, ensuring guaranteed liquidity at all times.',
      highlights: [
        { label: 'Fórmula', val: 'C(q) = b · ln(∑ e^(q_i / b))' },
        { label: 'Parámetro b', val: language === 'es' ? 'Sensibilidad de liquidez y subsidio' : 'Liquidity sensitivity & depth' },
        { label: 'Conservación', val: '∑ P(outcomes) = 1.00 (100%)' },
      ],
    },
    {
      badge: language === 'es' ? 'PASO 3 • COMPRA Y VENTA' : 'STEP 3 • TRADING & POSITION MGMT',
      icon: <TrendingUp className="w-5 h-5 text-[#38bdf8]" />,
      title: language === 'es' ? 'Especula y Asegura Ganancias' : 'Trade & Lock In Profits',
      subtitle: language === 'es'
        ? 'No necesitas esperar a que el evento concluya para tomar beneficios.'
        : 'You do not need to wait for contract expiration to take profits.',
      description: language === 'es'
        ? 'Si compraste acciones SÍ a $0.30 y la probabilidad sube a $0.70 por noticias recientes, puedes vender una parte o el total de tu posición en cualquier instante antes de la fecha límite para cerrar tu rentabilidad en efectivo.'
        : 'If you bought YES shares at $0.30 and probabilities rally to $0.70 following news, you can partially or fully liquidate shares at any moment before the deadline to lock in cash ROI.',
      highlights: [
        { label: language === 'es' ? 'Entrada Temprana' : 'Early Entry', val: language === 'es' ? 'Mayor retorno por riesgo' : 'Higher reward for smart research' },
        { label: language === 'es' ? 'Venta Parcial' : 'Partial Selling', val: language === 'es' ? 'Control de riesgo quirúrgico' : 'Surgical risk and inventory management' },
        { label: language === 'es' ? 'Comisión Operador' : 'Operator Fee', val: '1% de tarifa justa para liquidez' },
      ],
    },
    {
      badge: language === 'es' ? 'PASO 4 • RESOLUCIÓN & COBROS' : 'STEP 4 • ORACLE SETTLEMENT',
      icon: <ShieldCheck className="w-5 h-5 text-[#10b981]" />,
      title: language === 'es' ? 'Resolución Verificada y Liquidación' : 'Oracle Verification & Payouts',
      subtitle: language === 'es'
        ? 'Transparencia de doble entrada y liquidación automática sin fricción.'
        : 'Double-entry transparency and automatic frictionless clearing.',
      description: language === 'es'
        ? 'Al cumplirse la fecha de cierre, el orador oficial declara la opción ganadora basada en fuentes verificables. Cada acción ganadora se canjea automáticamente a $1.00 USD y los fondos se acreditan de inmediato en tu cuenta.'
        : 'When the close deadline passes, the designated oracle verifies the winning outcome against official sources. Every winning share redeems at exactly $1.00 USD, immediately credited to your balance.',
      highlights: [
        { label: language === 'es' ? 'Ventana de Disputa' : 'Dispute Window', val: language === 'es' ? 'Periodo de gracia optimista' : 'Optimistic grace period verification' },
        { label: language === 'es' ? 'Pago Íntegro' : 'Full Payout', val: '$1.00 USD / share' },
        { label: language === 'es' ? 'Auditoría' : 'Auditability', val: language === 'es' ? 'Libro inmutable exportable' : 'Immutable double-entry ledger' },
      ],
    },
  ];

  const tournamentRulesSlides = [
    {
      badge: language === 'es' ? 'TORNEOS • INTRODUCCIÓN' : 'TOURNAMENTS • OVERVIEW',
      icon: <Trophy className="w-5 h-5 text-amber-400" />,
      title: language === 'es' ? 'Arena de Competencia entre Amigos' : 'Private Group Competition Arena',
      subtitle: language === 'es'
        ? 'Demuestra quién tiene el mejor análisis sin arriesgar tu patrimonio personal.'
        : 'Prove who possesses superior predictive edge in isolated leaderboards.',
      description: language === 'es'
        ? 'Los torneos privados permiten organizar competencias cerradas entre amigos o colegas con un saldo inicial idéntico para todos los participantes y fechas límite estrictas.'
        : 'Private tournaments enable structured group contests with an identical starting bankroll for all competitors and strict, immutable deadlines.',
      highlights: [
        { label: language === 'es' ? 'Acceso Privado' : 'Private Access', val: language === 'es' ? 'Solo participantes invitados' : 'Invited group members only' },
        { label: language === 'es' ? 'Premios Reales' : 'Real Rewards', val: language === 'es' ? 'Premios acordados para el podio' : 'Pre-agreed rewards for the podium' },
        { label: language === 'es' ? 'Ranking en Vivo' : 'Live Standings', val: language === 'es' ? 'Actualización en tiempo real' : 'Real-time equity updates' },
      ],
    },
    {
      badge: language === 'es' ? 'TORNEOS • SUBCARTERAS' : 'TOURNAMENTS • SUBWALLETS',
      icon: <Coins className="w-5 h-5 text-[#10b981]" />,
      title: language === 'es' ? 'Subcarteras 100% Aisladas' : '100% Isolated Subwallets',
      subtitle: language === 'es'
        ? 'Cero contaminación entre torneos y tu saldo global.'
        : 'Zero cross-contamination between contests and personal balances.',
      description: language === 'es'
        ? 'Cada torneo al que te unes te asigna una subcartera con un bankroll virtual independiente (ej. $1,000 USD). Las compras y ventas en mercados del torneo solo usan ese saldo, asegurando equidad competitiva.'
        : 'Each tournament grants an isolated virtual bankroll (e.g. $1,000 USD). Trades executed within tournament markets pull exclusively from this subwallet, guaranteeing fair play.',
      highlights: [
        { label: language === 'es' ? 'Saldo Inicial Idéntico' : 'Identical Bankroll', val: '$1,000.00 USD Base' },
        { label: language === 'es' ? 'Mercados Oficiales' : 'Official Markets', val: language === 'es' ? 'Solo mercados vinculados puntúan' : 'Only linked markets count towards ROI' },
        { label: language === 'es' ? 'Patrimonio Neto' : 'Net Equity', val: 'Efectivo + Contratos abiertos' },
      ],
    },
    {
      badge: language === 'es' ? 'TORNEOS • FINALES' : 'TOURNAMENTS • LOCK & REWARD',
      icon: <Lock className="w-5 h-5 text-amber-400" />,
      title: language === 'es' ? 'Fecha Límite y Coronación del Podio' : 'Strict Deadline & Podium Crown',
      subtitle: language === 'es'
        ? 'Al llegar el deadline, se congela la clasificación y se proclama al ganador.'
        : 'At deadline, rankings freeze atomically and winners claim rewards.',
      description: language === 'es'
        ? 'Al cumplirse el minuto exacto del fin del torneo, ninguna nueva operación es admitida. El participante con mayor Patrimonio Neto (ROI %) en el podio de honor se consagra campeón y recibe el premio acordado.'
        : 'The moment the deadline strikes, no further orders can be placed. The participant boasting highest Net Equity (ROI %) on the hall-of-fame podium is crowned champion.',
      highlights: [
        { label: language === 'es' ? 'Cierre Automático' : 'Atomic Lock', val: language === 'es' ? 'Timestamp inmutable' : 'Immutable timestamp enforce' },
        { label: 'Podio #1, #2, #3', val: 'Oro, Plata y Bronce' },
        { label: language === 'es' ? 'Criterio de Victoria' : 'Victory Metric', val: 'Mayor Patrimonio Neto Total' },
      ],
    },
  ];

  const slides = deck === 'how-it-works' ? howItWorksSlides : tournamentRulesSlides;
  const slide = slides[currentSlide] || slides[0];

  const handleNext = useCallback(() => {
    setCurrentSlide((prev) => (prev < slides.length - 1 ? prev + 1 : prev));
  }, [slides.length]);

  const handlePrev = useCallback(() => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  // Keyboard navigation listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
        className="terminal-card glass-terminal rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl elevation-popover border border-white/[0.09] overflow-hidden"
      >
        {/* Top Header & Deck Switcher */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] bg-[#090d16]/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-[#090d16] rounded-xl border border-white/[0.06] text-xs font-mono">
            <button
              onClick={() => {
                setDeck('how-it-works');
                setCurrentSlide(0);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                deck === 'how-it-works'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {language === 'es' ? 'Cómo Operar' : 'How it Works'}
            </button>
            <button
              onClick={() => {
                setDeck('tournament-rules');
                setCurrentSlide(0);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                deck === 'tournament-rules'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {language === 'es' ? 'Reglas de Torneos' : 'Tournament Rules'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
              {currentSlide + 1} / {slides.length}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Cerrar diapositivas"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Slide Viewport (Strict Viewport Fitting) */}
        <div className="p-5 sm:p-8 flex-1 overflow-y-auto flex flex-col justify-between gap-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${deck}-${currentSlide}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <span className="hud-tag">
                  {slide.badge}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-white/[0.08] flex items-center justify-center shrink-0">
                  {slide.icon}
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {slide.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#38bdf8] font-medium">
                    {slide.subtitle}
                  </p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                {slide.description}
              </p>

              {/* Highlights 3-Card Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {slide.highlights.map((h, i) => (
                  <div 
                    key={i} 
                    className="p-3.5 rounded-xl bg-[#090d16] border border-white/[0.06] flex flex-col justify-between gap-1"
                  >
                    <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">
                      {h.label}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-100">
                      {h.val}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation Bar */}
        <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-[#090d16]/80 flex items-center justify-between gap-4 shrink-0">
          <button
            onClick={handlePrev}
            disabled={currentSlide === 0}
            className="px-3.5 py-2 min-h-[38px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{language === 'es' ? 'Anterior' : 'Previous'}</span>
          </button>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`transition-all rounded-full cursor-pointer ${
                  currentSlide === i 
                    ? 'w-6 h-2 bg-[#38bdf8]' 
                    : 'w-2 h-2 bg-slate-700 hover:bg-slate-600'
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>

          {currentSlide < slides.length - 1 ? (
            <button
              onClick={handleNext}
              className="px-4 py-2 min-h-[38px] rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-mono text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
            >
              <span>{language === 'es' ? 'Siguiente' : 'Next'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 min-h-[38px] rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-mono text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{language === 'es' ? 'Comenzar a Operar' : 'Start Trading'}</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
