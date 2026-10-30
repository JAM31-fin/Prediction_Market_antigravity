import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Tournament, Category, TournamentStatus } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Trophy, 
  Calendar, 
  Clock, 
  DollarSign, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Tag,
  FileText
} from 'lucide-react';

interface AdminTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentToEdit?: Tournament | null;
  onSave: (data: Partial<Tournament>) => Promise<void>;
}

const CATEGORIES: (Category | 'ALL')[] = [
  'ALL',
  'Friends',
  'Sports',
  'Crypto',
  'Economy',
  'Technology',
  'Entertainment',
  'Everyday Life',
];

export const AdminTournamentModal: React.FC<AdminTournamentModalProps> = ({
  isOpen,
  onClose,
  tournamentToEdit,
  onSave,
}) => {
  const { language } = useLanguage();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prizePool, setPrizePool] = useState('');
  const [initialBalance, setInitialBalance] = useState('1000');
  const [status, setStatus] = useState<TournamentStatus>('active');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'ALL'>('ALL');
  const [rules, setRules] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatForDateTimeInput = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  useEffect(() => {
    if (tournamentToEdit) {
      setTitle(tournamentToEdit.title);
      setDescription(tournamentToEdit.description);
      setPrizePool(tournamentToEdit.prizePool);
      setInitialBalance(tournamentToEdit.initialBalance.toString());
      setStatus(tournamentToEdit.status);
      setStartDate(formatForDateTimeInput(tournamentToEdit.startDate));
      setEndDate(formatForDateTimeInput(tournamentToEdit.endDate));
      setCategoryFilter(tournamentToEdit.categoryFilter || 'ALL');
      setRules(tournamentToEdit.rules);
    } else {
      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      setTitle('');
      setDescription('');
      setPrizePool('🎁 $50 USD en efectivo / Premio acordado');
      setInitialBalance('1000');
      setStatus('active');
      setStartDate(formatForDateTimeInput(now.toISOString()));
      setEndDate(formatForDateTimeInput(in7Days.toISOString()));
      setCategoryFilter('ALL');
      setRules('1. Saldo inicial de prueba otorgado.\n2. Gana quien logre mayor Patrimonio Neto al cumplirse la fecha límite.\n3. Se permiten operaciones en los mercados habilitados.');
    }
    setError(null);
  }, [tournamentToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError(language === 'es' ? 'El título del torneo es obligatorio.' : 'Tournament title is required.');
      return;
    }
    if (!endDate) {
      setError(language === 'es' ? 'Debes indicar una fecha límite.' : 'Deadline date is required.');
      return;
    }

    const numBal = parseFloat(initialBalance);
    if (isNaN(numBal) || numBal <= 0) {
      setError(language === 'es' ? 'El saldo inicial debe ser un número positivo.' : 'Starting balance must be positive.');
      return;
    }

    try {
      setLoading(true);
      await onSave({
        title: title.trim(),
        description: description.trim(),
        prizePool: prizePool.trim(),
        initialBalance: numBal,
        status,
        startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
        endDate: new Date(endDate).toISOString(),
        categoryFilter,
        rules: rules.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error saving tournament');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
        className="terminal-card glass-terminal rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl elevation-card my-8 border border-white/[0.12]"
      >
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#111827]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {tournamentToEdit
                  ? (language === 'es' ? 'Configurar / Editar Torneo' : 'Configure / Edit Tournament')
                  : (language === 'es' ? 'Organizar Nuevo Torneo' : 'Organize New Tournament')}
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'es'
                  ? 'Define premios, fechas límites y reglas de competencia para el grupo'
                  : 'Define prizes, deadlines, and group competition rules'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto font-sans">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Tournament Title */}
          <div>
            <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5">
              {language === 'es' ? 'Nombre o Título del Torneo *' : 'Tournament Title *'}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={language === 'es' ? 'Ej. 🏆 1er Torneo de Predicciones del Grupo' : 'e.g. 🏆 1st Friends Prediction Tournament'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0f19] border border-slate-700/80 focus:border-[#3b82f6] text-sm text-slate-100 placeholder-slate-500 outline-none transition-all font-sans"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5">
              {language === 'es' ? 'Descripción o Motivo del Torneo' : 'Tournament Description'}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={language === 'es' ? 'Breve resumen del propósito del torneo para motivar a tus amigos...' : 'Brief summary of the tournament purpose...'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0f19] border border-slate-700/80 focus:border-[#3b82f6] text-sm text-slate-100 placeholder-slate-500 outline-none transition-all font-sans"
            />
          </div>

          {/* Prize and Starting Balance Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>{language === 'es' ? 'Premio Anunciado para el #1' : 'Announced Prize for #1'}</span>
              </label>
              <input
                type="text"
                value={prizePool}
                onChange={(e) => setPrizePool(e.target.value)}
                placeholder={language === 'es' ? 'Ej. $50 USD / Cena pagada por todos' : 'e.g. $50 USD / Free dinner'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0f19] border border-slate-700/80 focus:border-amber-400 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-[#10b981]" />
                <span>{language === 'es' ? 'Saldo Inicial Virtual (USD)' : 'Starting Virtual Balance (USD)'}</span>
              </label>
              <input
                type="number"
                min="100"
                step="50"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0f19] border border-slate-700/80 focus:border-[#10b981] text-sm font-mono text-slate-100 placeholder-slate-500 outline-none transition-all tabular-nums"
              />
            </div>
          </div>

          {/* Deadlines: Start Date & End Date (Deadline) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{language === 'es' ? 'Fecha y Hora de Inicio' : 'Start Date & Time'}</span>
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#0b0f19] border border-slate-700/80 focus:border-[#3b82f6] text-xs font-mono text-slate-100 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                <span>{language === 'es' ? 'Fecha Límite (Deadline) *' : 'Deadline Date & Time *'}</span>
              </label>
              <input
                type="datetime-local"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#0b0f19] border border-slate-700/80 focus:border-rose-500 text-xs font-mono text-slate-100 outline-none transition-all"
              />
            </div>
          </div>

          {/* Status & Category Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#3b82f6]" />
                <span>{language === 'es' ? 'Mercados Elegibles' : 'Eligible Markets'}</span>
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0f19] border border-slate-700/80 focus:border-[#3b82f6] text-sm text-slate-100 outline-none transition-all cursor-pointer font-sans"
              >
                <option value="ALL">{language === 'es' ? '🌐 Todos los Mercados' : '🌐 All Markets'}</option>
                <option value="Friends">{language === 'es' ? '👥 Solo Retos del Grupo' : '👥 Group Challenges Only'}</option>
                <option value="Sports">{language === 'es' ? '⚽ Solo Deportes' : '⚽ Sports Only'}</option>
                <option value="Crypto">{language === 'es' ? '🪙 Solo Criptomonedas' : '🪙 Crypto Only'}</option>
                <option value="Technology">{language === 'es' ? '💻 Solo Tecnología' : '💻 Technology Only'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5">
                {language === 'es' ? 'Estado del Torneo' : 'Tournament Status'}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0f19] border border-slate-700/80 focus:border-[#3b82f6] text-sm text-slate-100 outline-none transition-all cursor-pointer font-sans"
              >
                <option value="active">{language === 'es' ? '🟢 Activo / En Curso' : '🟢 Active / Running'}</option>
                <option value="upcoming">{language === 'es' ? '⏳ Próximo (Apertura futura)' : '⏳ Upcoming (Opens later)'}</option>
                <option value="completed">{language === 'es' ? '🏁 Finalizado / Cerrado' : '🏁 Completed / Closed'}</option>
                <option value="cancelled">{language === 'es' ? '❌ Cancelado' : '❌ Cancelled'}</option>
              </select>
            </div>
          </div>

          {/* Rules and Determination Criteria */}
          <div>
            <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>{language === 'es' ? 'Reglas y Criterios de Victoria' : 'Rules & Win Criteria'}</span>
            </label>
            <textarea
              rows={3}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder={language === 'es' ? 'Detalla las reglas de desempate, límites y condiciones...' : 'Detail tie-break rules and conditions...'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0f19] border border-slate-700/80 focus:border-[#3b82f6] text-xs font-mono text-slate-200 placeholder-slate-500 outline-none transition-all"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold cursor-pointer transition-colors"
            >
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-mono font-extrabold flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {loading
                  ? (language === 'es' ? 'Guardando...' : 'Saving...')
                  : tournamentToEdit
                  ? (language === 'es' ? 'Guardar Cambios' : 'Save Changes')
                  : (language === 'es' ? 'Crear Torneo' : 'Create Tournament')}
              </span>
            </motion.button>
          </div>
        </form>

      </motion.div>
    </div>
  );
};
