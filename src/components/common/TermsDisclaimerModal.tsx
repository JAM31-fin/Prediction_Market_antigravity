import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  AlertTriangle, 
  ShieldCheck, 
  BookOpen, 
  PhoneCall, 
  Coins, 
  Trophy, 
  Lock, 
  Clock, 
  HeartHandshake,
  CheckCircle2,
  FileText,
  Building2,
  Scale
} from 'lucide-react';

interface TermsDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsDisclaimerModal: React.FC<TermsDisclaimerModalProps> = ({
  isOpen,
  onClose,
}) => {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 14 }}
          transition={{ type: 'spring', stiffness: 450, damping: 32 }}
          className="relative w-full max-w-3xl bg-[#0d131f] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] sm:max-h-[88vh]"
        >
          {/* Subtle Top Decorative Accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-blue-500 to-emerald-500" />

          {/* Sticky Header */}
          <div className="shrink-0 bg-[#111827]/95 border-b border-white/[0.08] px-5 sm:px-7 pt-5 pb-4 relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
              aria-label="Cerrar modal"
              title="Cerrar ventana (Esc)"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Scale className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-mono uppercase font-bold tracking-wider text-amber-400">
                MARCO LEGAL & DESCARGO OFICIAL (FASE BETA)
              </span>
            </div>

            <h2 id="terms-modal-title" className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              Términos, Condiciones y Descargo de Responsabilidad
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Por favor lee con atención las reglas operativas, el marco académico y las normas éticas del simulador.
            </p>
          </div>

          {/* Scrollable Modal Body */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-5 text-slate-300 text-xs sm:text-[13px] leading-relaxed">
            
            {/* Top Warning/Neutral Disclaimer Banner */}
            <div className="rounded-xl p-4 sm:p-5 bg-gradient-to-br from-amber-500/10 via-slate-900/90 to-amber-500/5 border border-amber-500/35 shadow-inner">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                      DESCARGO DE RESPONSABILIDAD (DISCLAIMER)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      PROYECTO INDEPENDIENTE
                    </span>
                  </div>
                  <p className="text-slate-200 text-xs leading-relaxed text-wrap-pretty font-normal">
                    Este simulador de mercados de predicción es un <strong>proyecto independiente con fines estrictamente académicos y de investigación</strong> sobre agregación de información y modelos de consenso colectivo. 
                  </p>
                  <p className="text-slate-300 text-xs leading-relaxed text-wrap-pretty">
                    <strong>No tiene ninguna relación institucional, patrocinio, respaldo, aval ni vínculo formal con la Universidad del Pacífico (UP) ni con el Centro de Estudiantes de la Universidad del Pacífico (CEUP)</strong>.
                  </p>
                  <div className="mt-2 pt-2 border-t border-amber-500/20 text-[11px] text-amber-200/90 flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Esta plataforma <strong>NO es una casa de apuestas</strong>, no involucra dinero real de entrada, no acepta depósitos ni procesa apuestas comerciales.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Structured 7 Sections */}
            <div className="space-y-4 pt-1">
              
              {/* Section 1 */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/[0.06] hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-6 h-6 rounded-md bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-mono text-xs font-bold">
                    1
                  </div>
                  <h3 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    Naturaleza del Simulador (Fase Beta y Fines Académicos)
                  </h3>
                </div>
                <p className="text-slate-300 pl-8 leading-relaxed">
                  La plataforma opera en fase experimental (Beta) como un prototipo de simulación algorítmica para evaluar la regla de puntuación de mercado logarítmica (LMSR). Todos los mercados, preguntas y cuotas tienen fines exclusivamente analíticos, científicos y de estudio sobre la sabiduría de las masas. La plataforma se reserva el derecho de calibrar parámetros de liquidez y resolver anomalías técnicas en cualquier momento.
                </p>
              </div>

              {/* Section 2 */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/[0.06] hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-6 h-6 rounded-md bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold">
                    2
                  </div>
                  <h3 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                    <PhoneCall className="w-4 h-4 text-cyan-400" />
                    Registro Exclusivo por Teléfono y Prohibición de Multicuentas
                  </h3>
                </div>
                <p className="text-slate-300 pl-8 leading-relaxed">
                  Para resguardar la validez de los resultados experimentales y prevenir manipulaciones artificiales (ataques Sybil), el registro y acceso se efectúa <strong>únicamente mediante un número de celular personal válido</strong> (9 dígitos, prefijo +51 para Perú). <strong>Queda estrictamente prohibida la creación de multicuentas por parte de un mismo participante</strong>. La detección de cuentas duplicadas o identidades ficticias resultará en el bloqueo permanente y la anulación inmediata de los registros asociados.
                </p>
              </div>

              {/* Section 3 */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/[0.06] hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono text-xs font-bold">
                    3
                  </div>
                  <h3 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-emerald-400" />
                    Puntos Virtuales sin Valor Económico Real y Prohibición de Apuestas
                  </h3>
                </div>
                <p className="text-slate-300 pl-8 leading-relaxed">
                  Todos los saldos, posiciones y unidades de negociación dentro de la aplicación son <strong>créditos virtuales simulados (puntos de prueba) sin valor económico o monetario de curso legal</strong>. No constituyen activos financieros, no son redimibles ni convertibles en dinero fiat ni en criptomonedas, y no otorgan derechos económicos frente a los creadores de la plataforma. Queda terminantemente prohibido utilizar el simulador para apuestas clandestinas, pactos externos o intermediación de dinero real.
                </p>
              </div>

              {/* Section 4 */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/[0.06] hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-6 h-6 rounded-md bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 font-mono text-xs font-bold">
                    4
                  </div>
                  <h3 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-purple-400" />
                    Torneo Piloto con Premio de S/ 15 (Gratuito y Antifraude)
                  </h3>
                </div>
                <p className="text-slate-300 pl-8 leading-relaxed">
                  Como incentivo de evaluación académica, se llevará a cabo un torneo piloto experimental con un premio simbólico único de <strong>S/ 15 (quince soles)</strong> para el participante clasificado en el 1.er puesto de la tabla al finalizar el periodo de prueba. La inscripción es <strong>100% gratuita y no requiere ningún pago de entrada</strong>. Cualquier uso de bots automatizados no supervisados, scripts de ataque, explotación deliberada de bugs o colusión coordinada descalificará al participante de manera definitiva.
                </p>
              </div>

              {/* Section 5 */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/[0.06] hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-6 h-6 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-mono text-xs font-bold">
                    5
                  </div>
                  <h3 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-amber-400" />
                    Tratamiento de Datos Personales y Privacidad
                  </h3>
                </div>
                <p className="text-slate-300 pl-8 leading-relaxed">
                  El número de teléfono móvil solicitado es empleado exclusivamente como identificador de sesión y mecanismo de validación de unicidad en la base de datos interna. <strong>La plataforma NO solicita contraseñas complejas, correos personales ni correos institucionales (@up.edu.pe)</strong>. Los números no serán cedidos, comercializados ni compartidos con empresas ni terceros ajenos al proyecto de investigación.
                </p>
              </div>

              {/* Section 6 */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/[0.06] hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-6 h-6 rounded-md bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 font-mono text-xs font-bold">
                    6
                  </div>
                  <h3 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-rose-400" />
                    Congelamiento Obligatorio durante Periodos de Veda Electoral
                  </h3>
                </div>
                <p className="text-slate-300 pl-8 leading-relaxed">
                  En acatamiento estricto a las disposiciones legales y electorales peruanas aplicables (Ley Orgánica de Elecciones), todo mercado de predicción de naturaleza política, electoral o referendaria <strong>será congelado y suspendido de manera automática durante los periodos de veda electoral</strong> estipulados por el Jurado Nacional de Elecciones (JNE), impidiendo transacciones hasta la publicación oficial de resultados.
                </p>
              </div>

              {/* Section 7 */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/[0.06] hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-6 h-6 rounded-md bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-mono text-xs font-bold">
                    7
                  </div>
                  <h3 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                    <HeartHandshake className="w-4 h-4 text-indigo-400" />
                    Normas de Respeto, Convivencia y No Difamación
                  </h3>
                </div>
                <p className="text-slate-300 pl-8 leading-relaxed">
                  Los participantes se comprometen a interactuar bajo un estándar de respeto mutuo, honestidad y cordialidad cívica. Se prohíben conductas hostiles, difamatorias, acoso o la creación de mercados con fines vejatorios o de hostigamiento hacia personas naturales o entidades. Las cuentas que incurran en estas prácticas serán canceladas de oficio.
                </p>
              </div>

            </div>

          </div>

          {/* Sticky Modal Footer */}
          <div className="shrink-0 bg-[#111827]/95 border-t border-white/[0.08] px-5 sm:px-7 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Simulador Beta · Fines Académicos · Sin Dinero Real</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-mono font-extrabold text-xs shadow-md transition-colors cursor-pointer min-h-[40px] flex items-center justify-center"
            >
              Entendido y Cerrar
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
