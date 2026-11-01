import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useMarket } from '../../context/MarketContext';
import { PhoneAuthForm } from './PhoneAuthForm';
import {
  X,
  ArrowRight,
  ShieldCheck,
  LogOut,
  AlertCircle,
  Loader2,
  Database,
  Eye,
  EyeOff,
  UserCheck,
  Phone,
  KeyRound,
  ArrowLeft,
  Lock,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { user, login, logout, setAdminSubView, navigateTo, setIsTermsModalOpen } = useMarket();

  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [adminStep, setAdminStep] = useState<boolean>(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showAdminPin, setShowAdminPin] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const prevIsOpenRef = useRef<boolean>(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Sync state ONLY when modal transitions from closed to open.
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setIsAdminMode(false);
      setAdminStep(false);
      setError(null);
      setPassword('');
      setShowPassword(false);
      setShowAdminPin(false);
      setUsername('');
      setAdminPin('');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  // Focus PIN input when transitioning to admin step
  useEffect(() => {
    if (adminStep) {
      const timer = setTimeout(() => {
        pinInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [adminStep]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!adminStep) {
        if (!username.trim()) {
          throw new Error('Por favor ingresa tu usuario o credencial de operador.');
        }
        if (!password) {
          throw new Error('Por favor ingresa tu contraseña de operador.');
        }

        try {
          const authedUser = await login(username.trim(), password);
          if (authedUser?.role === 'admin') {
            navigateTo('admin');
            setAdminSubView('overview');
          } else {
            navigateTo('portfolio');
          }
          onClose();
        } catch (loginErr: any) {
          const isPinChallenge =
            loginErr?.requiresAdminPin ||
            /Administrator master PIN is required|PIN maestro de administrador/i.test(loginErr?.message || '');

          if (isPinChallenge) {
            setAdminStep(true);
            setAdminPin('');
            setError(null);
          } else {
            throw loginErr;
          }
        }
      } else {
        if (!adminPin.trim()) {
          throw new Error('Por favor ingresa tu código PIN maestro de administrador.');
        }

        const authedUser = await login(username.trim(), password, adminPin.trim());
        if (authedUser?.role === 'admin') {
          navigateTo('admin');
          setAdminSubView('overview');
        } else {
          navigateTo('portfolio');
        }
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Error de autenticación. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setError(null);
    await logout();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
        className="relative rounded-2xl max-w-md w-full bg-[#0d131f] border border-white/[0.12] flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto overflow-hidden shadow-2xl"
      >
        {/* Top Decorative Strip */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-amber-500" />

        {/* Sticky Header */}
        <div className="shrink-0 bg-[#111827]/95 border-b border-white/[0.08] px-5 pt-4 pb-3.5 relative">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3 min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
            aria-label="Cerrar ventana"
            title="Cerrar ventana (Esc)"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Platform branding & tag */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-5 h-5 rounded flex items-center justify-center font-bold font-mono text-[11px] ${
              isAdminMode ? 'bg-amber-500 text-slate-950' : 'bg-[#10b981] text-slate-950'
            }`}>
              {isAdminMode ? 'A' : 'C'}
            </div>
            <span className={`text-[11px] font-mono uppercase font-bold tracking-wider ${
              isAdminMode ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {isAdminMode ? 'PANEL DE CONTROL OPERADOR' : 'SIMULADOR DE PREDICCIONES (BETA)'}
            </span>
          </div>

          <h3 className="text-base font-extrabold text-white text-wrap-balance">
            {user
              ? 'Gestión de Cuenta'
              : isAdminMode
              ? adminStep
                ? 'Autorización PIN Maestro'
                : 'Acceso de Administrador'
              : 'Acceso / Registro por Celular'}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
            {user
              ? 'Detalles de tu sesión activa y saldo disponible.'
              : isAdminMode
              ? 'Consola exclusiva para operadores y gestión de mercados.'
              : 'Ingresa tu número de teléfono para acceder o registrarte en el torneo de prueba.'}
          </p>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          
          {/* Active Session Indicator (if logged in) */}
          {user && (
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full border flex items-center justify-center font-mono font-bold text-sm ${
                      user.role === 'admin'
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                        : 'bg-[#10b981]/20 border-[#10b981]/40 text-[#10b981]'
                    }`}
                  >
                    {(user.username || user.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <span>{user.name || user.username}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          user.role === 'admin'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30'
                        }`}
                      >
                        {user.role ? user.role.toUpperCase() : 'USER'}
                      </span>
                    </div>
                    {user.phoneNumber && (
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{user.phoneNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Cerrar sesión activa"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold">Salir</span>
                </button>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.04] flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Saldo Virtual:</span>
                <span className="text-[#10b981] font-bold">
                  ${(user.virtualBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* Error Notification */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <p className="text-rose-200/90 leading-relaxed text-xs">{error}</p>
            </div>
          )}

          {/* MAIN PARTICIPANT PHONE FLOW */}
          {!user && !isAdminMode && (
            <PhoneAuthForm
              onSuccess={onClose}
              onOpenTerms={() => setIsTermsModalOpen(true)}
            />
          )}

          {/* ADMIN OPERATOR CREDENTIALS FLOW */}
          {!user && isAdminMode && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              {adminStep ? (
                <div className="space-y-3.5">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-amber-200/90 text-xs leading-relaxed">
                      Se requiere el PIN maestro de seguridad para autorizar la consola de operador.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-semibold text-amber-300 mb-1.5">
                      PIN Maestro de Administrador
                    </label>
                    <input
                      ref={pinInputRef}
                      type={showAdminPin ? 'text' : 'password'}
                      required
                      value={adminPin}
                      onChange={(e) => setAdminPin(e.target.value)}
                      placeholder="••••••"
                      maxLength={12}
                      className="w-full bg-[#0b0f19] border border-amber-500/50 rounded-xl px-4 py-3 text-center text-lg tracking-[0.3em] text-amber-300 font-mono focus:outline-none focus:border-amber-400 shadow-inner"
                      autoComplete="one-time-code"
                    />
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-black text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>VERIFICAR PIN Y ACCEDER</span>
                      </>
                    )}
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5">
                      Usuario de Operador
                    </label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin31"
                      className="w-full bg-[#0b0f19] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-mono font-semibold text-slate-300">
                        Contraseña
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showPassword ? 'Ocultar' : 'Mostrar'}</span>
                      </button>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono transition-all"
                    />
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-black text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    ) : (
                      <>
                        <span>ACCEDER COMO OPERADOR</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </motion.button>
                </div>
              )}
            </form>
          )}

        </div>

        {/* Modal Footer / Fallback Toggle */}
        <div className="shrink-0 bg-[#111827]/95 border-t border-white/[0.08] px-5 py-3 flex items-center justify-between text-[11px] font-mono">
          {!user && (
            <button
              type="button"
              onClick={() => {
                setIsAdminMode(!isAdminMode);
                setAdminStep(false);
                setError(null);
              }}
              className="text-slate-400 hover:text-slate-200 underline cursor-pointer transition-colors"
            >
              {isAdminMode
                ? '← Volver al acceso de participante por celular'
                : '¿Operador o administrador? Acceso con credenciales'}
            </button>
          )}

          <div className="flex items-center gap-1 text-slate-400 ml-auto">
            <Database className="w-3 h-3 text-[#3b82f6]" />
            <span>Fase Beta · PostgreSQL</span>
          </div>
        </div>

      </motion.div>
    </div>
  );
};
