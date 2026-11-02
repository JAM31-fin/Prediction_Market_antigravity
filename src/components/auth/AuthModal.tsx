import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useMarket } from '../../context/MarketContext';
import {
  X,
  LogIn,
  UserPlus,
  User,
  Lock,
  Phone,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  Loader2,
  Database,
  LogOut,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const {
    user,
    login,
    register,
    logout,
    setAdminSubView,
    navigateTo,
    setIsTermsModalOpen,
  } = useMarket();

  // Mode: 'login' (Log In) vs 'register' (Sign In)
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  // Direction for horizontal slide animation: 1 = right-to-left (to register), -1 = left-to-right (to login)
  const [direction, setDirection] = useState<number>(initialMode === 'register' ? 1 : -1);

  // --- Log In Form State ---
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // --- Admin Master PIN Second Step ---
  const [adminStep, setAdminStep] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [showAdminPin, setShowAdminPin] = useState(false);

  // --- Sign In / Registration Form State ---
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regPhoneNumber, setRegPhoneNumber] = useState('');
  const [regAlias, setRegAlias] = useState('');
  const [prefix] = useState('+51');
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  // Common UI State
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const prevIsOpenRef = useRef(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever modal opens or initialMode changes
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      const initial = initialMode || 'login';
      setDirection(initial === 'register' ? 1 : -1);
      setMode(initial);
      setAdminStep(false);
      setError(null);
      setLoginIdentifier('');
      setLoginPassword('');
      setAdminPin('');
      setShowLoginPassword(false);
      setShowAdminPin(false);
      setRegUsername('');
      setRegPassword('');
      setShowRegPassword(false);
      setRegPhoneNumber('');
      setRegAlias('');
      setAcceptedTerms(true);
    } else if (isOpen && initialMode && initialMode !== mode && !prevIsOpenRef.current) {
      setDirection(initialMode === 'register' ? 1 : -1);
      setMode(initialMode);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialMode]);

  // Focus PIN input when admin step activates
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

  // Horizontal slide animation variants for carousel transition between Log In and Sign In
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 60 : dir < 0 ? -60 : 0,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -60 : 60,
      opacity: 0,
    }),
  };

  // Phone formatting helpers: Peruvian mobile numbers have 9 digits and start with 9
  const cleanPhoneDigits = regPhoneNumber.replace(/\D/g, '').replace(/^51/, '');
  const isPhoneValid = /^9\d{8}$/.test(cleanPhoneDigits);
  const isRegUsernameValid = regUsername.trim().length >= 3;
  const isRegPasswordValid = regPassword.length >= 6;
  const isRegisterDisabled =
    !isRegUsernameValid || !isRegPasswordValid || !isPhoneValid || !acceptedTerms || loading;

  const formatDisplayPhone = (digits: string) => {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    let raw = e.target.value.replace(/\D/g, '');
    // If user pasted or entered with Peruvian country code 51 at start, strip it
    if (raw.startsWith('51') && (raw.length > 9 || raw.length === 2)) {
      raw = raw.slice(2);
    }
    // If length didn't change but string shortened, user backspaced on a space: delete 1 digit
    if (raw.length === regPhoneNumber.length && e.target.value.length < formatDisplayPhone(regPhoneNumber).length) {
      raw = raw.slice(0, -1);
    }
    // Cap at 9 digits
    if (raw.length > 9) {
      raw = raw.slice(0, 9);
    }
    setRegPhoneNumber(raw);
  };

  // --- 1. HANDLE LOG IN (Usuario y Contraseña) ---
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!loginIdentifier.trim()) {
        throw new Error('Por favor ingresa tu nombre de usuario.');
      }
      if (!loginPassword) {
        throw new Error('Por favor ingresa tu contraseña.');
      }

      if (!adminStep) {
        try {
          const authedUser = await login(loginIdentifier.trim(), loginPassword);
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
            /Administrator master PIN is required|PIN maestro de administrador/i.test(
              loginErr?.message || ''
            );

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

        const authedUser = await login(loginIdentifier.trim(), loginPassword, adminPin.trim());
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

  // --- 2. HANDLE SIGN IN / REGISTRO (Usuario, Contraseña y Número de Celular) ---
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^9\d{8}$/.test(cleanPhoneDigits)) {
      setError('El número de celular debe empezar con 9 y tener exactamente 9 dígitos (ej. 987 654 321).');
      return;
    }
    if (regUsername.trim().length < 3) {
      setError('El nombre de usuario debe tener al menos 3 caracteres.');
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(regUsername.trim())) {
      setError('El nombre de usuario solo puede contener letras, números, guiones y puntos.');
      return;
    }
    if (regPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (!acceptedTerms) {
      setError('Debes aceptar los Términos y Condiciones y el Descargo de Responsabilidad para continuar.');
      return;
    }

    setLoading(true);
    try {
      const fullPhone = `${prefix}${cleanPhoneDigits}`;
      await register(
        regUsername.trim(),
        regPassword,
        fullPhone,
        regAlias.trim() || regUsername.trim()
      );
      onClose();
    } catch (err: any) {
      const msg = err.message || '';
      if (/already registered|ya está registrado/i.test(msg)) {
        setError('Este número de celular ya está registrado. Por favor utiliza la pestaña "Log In".');
      } else if (/already exists/i.test(msg)) {
        setError('Este nombre de usuario ya está en uso. Por favor elige otro o utiliza "Log In".');
      } else {
        setError(msg || 'Error al registrar la cuenta. Intenta nuevamente.');
      }
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
        <div
          className={`absolute top-0 left-0 right-0 h-1 transition-all duration-300 ${
            mode === 'login'
              ? 'bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600'
              : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500'
          }`}
        />

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
            <div
              className={`w-5 h-5 rounded flex items-center justify-center font-bold font-mono text-[11px] ${
                mode === 'login'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#10b981] text-slate-950'
              }`}
            >
              {mode === 'login' ? 'L' : 'S'}
            </div>
            <span
              className={`text-[11px] font-mono uppercase font-bold tracking-wider ${
                mode === 'login' ? 'text-blue-400' : 'text-emerald-400'
              }`}
            >
              {user
                ? 'SESIÓN ACTIVA'
                : adminStep
                ? 'AUTORIZACIÓN OPERADOR'
                : mode === 'login'
                ? 'ACCESO DE USUARIO / LOG IN'
                : 'REGISTRO DE PARTICIPANTE / SIGN IN'}
            </span>
          </div>

          <h3 className="text-base font-extrabold text-white text-wrap-balance">
            {user
              ? 'Gestión de Cuenta'
              : adminStep
              ? 'Autorización PIN Maestro'
              : mode === 'login'
              ? 'Log In · Iniciar Sesión'
              : 'Sign In · Registrarse'}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
            {user
              ? 'Detalles de tu sesión activa y saldo disponible.'
              : adminStep
              ? 'Ingresa tu PIN de seguridad maestro para acceder a la consola.'
              : mode === 'login'
              ? 'Ingresa con tu nombre de usuario y contraseña.'
              : 'Regístrate con tu número de celular para competir en los torneos.'}
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

          {/* Interactive Sliding Switcher Pill (Slider Tab) */}
          {!user && !adminStep && (
            <div className="space-y-2">
              <div 
                role="tablist"
                aria-label="Selección de modo de autenticación"
                className="relative p-1 rounded-2xl bg-[#0b0f19] border border-white/[0.08] grid grid-cols-2 select-none overflow-hidden"
              >
                {/* Sliding indicator pill */}
                <motion.div
                  className={`absolute top-1 bottom-1 rounded-xl shadow-md ${
                    mode === 'login'
                      ? 'left-1 w-[calc(50%-4px)] bg-blue-600 border border-blue-400/40 shadow-blue-600/30'
                      : 'left-[calc(50%+2px)] w-[calc(50%-4px)] bg-[#10b981] border border-emerald-300/40 shadow-emerald-500/30'
                  }`}
                  layoutId="auth-sliding-pill-indicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />

                {/* Tab 1: Log In */}
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'login'}
                  onClick={() => {
                    setDirection(-1);
                    setMode('login');
                    setError(null);
                  }}
                  className={`relative z-10 py-2.5 px-3 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    mode === 'login' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Log In (Ingresar)</span>
                </button>

                {/* Tab 2: Sign In */}
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  onClick={() => {
                    setDirection(1);
                    setMode('register');
                    setError(null);
                  }}
                  className={`relative z-10 py-2.5 px-3 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    mode === 'register' ? 'text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Sign In (Registrarse)</span>
                </button>
              </div>

              {/* Slider micro-affordance hint */}
              <div className="flex items-center justify-between px-2 text-[10px] font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      mode === 'login' ? 'bg-blue-400 w-5' : 'bg-slate-700 w-1.5'
                    }`}
                  />
                  <span
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      mode === 'register' ? 'bg-emerald-400 w-5' : 'bg-slate-700 w-1.5'
                    }`}
                  />
                </div>
                <span className="flex items-center gap-1.5 text-slate-400 select-none">
                  <span className="text-[11px]">↔</span>
                  <span>Desliza para alternar vista</span>
                </span>
              </div>
            </div>
          )}

          {/* Error Notification Alert */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <p className="text-rose-200/90 leading-relaxed text-xs">{error}</p>
            </div>
          )}

          {/* ============================================================== */}
          {/* SLIDING FORMS VIEWPORT WITH DRAG / SWIPE GESTURE SUPPORT       */}
          {/* ============================================================== */}
          {!user && (
            <div className="relative overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                {mode === 'login' ? (
                  <motion.div
                    key="auth-modal-login-view"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    drag={!adminStep ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(_e, { offset, velocity }) => {
                      if (offset.x < -40 || velocity.x < -300) {
                        setDirection(1);
                        setMode('register');
                        setError(null);
                      }
                    }}
                    className="touch-pan-y"
                  >
                    <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                      {adminStep ? (
                        /* Step 2 for Admin: PIN Maestro */
                        <div className="space-y-3.5">
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-amber-200/90 text-xs leading-relaxed">
                              Credenciales de administrador reconocidas. Se requiere el PIN maestro de seguridad.
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-xs font-mono font-semibold text-amber-300">
                                PIN Maestro de Administrador
                              </label>
                              <button
                                type="button"
                                onClick={() => setShowAdminPin(!showAdminPin)}
                                className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                              >
                                {showAdminPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                <span>{showAdminPin ? 'Ocultar' : 'Mostrar'}</span>
                              </button>
                            </div>
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

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAdminStep(false);
                                setAdminPin('');
                                setError(null);
                              }}
                              className="px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                              <span>Volver</span>
                            </button>

                            <motion.button
                              whileTap={{ scale: 0.98 }}
                              type="submit"
                              disabled={loading}
                              className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-black text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
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
                        </div>
                      ) : (
                        /* Step 1: Standard Username & Password */
                        <div className="space-y-3.5">
                          <div>
                            <label className="block text-xs font-mono font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-blue-400" />
                              <span>Nombre de usuario</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={loginIdentifier}
                              onChange={(e) => {
                                setError(null);
                                setLoginIdentifier(e.target.value);
                              }}
                              placeholder="ej. juan_perez o admin31"
                              autoComplete="username"
                              autoFocus
                              className="w-full bg-[#0b0f19] border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none transition-all shadow-inner"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-xs font-mono font-semibold text-slate-200 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-blue-400" />
                                <span>Contraseña</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => setShowLoginPassword(!showLoginPassword)}
                                className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                              >
                                {showLoginPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                <span>{showLoginPassword ? 'Ocultar' : 'Mostrar'}</span>
                              </button>
                            </div>
                            <input
                              type={showLoginPassword ? 'text' : 'password'}
                              required
                              value={loginPassword}
                              onChange={(e) => {
                                setError(null);
                                setLoginPassword(e.target.value);
                              }}
                              placeholder="••••••••"
                              autoComplete="current-password"
                              className="w-full bg-[#0b0f19] border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none transition-all shadow-inner"
                            />
                          </div>

                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={loading || !loginIdentifier.trim() || !loginPassword}
                            className={`w-full py-3 px-4 rounded-xl font-mono text-xs font-black shadow-md flex items-center justify-center gap-2 min-h-[44px] transition-all ${
                              loading || !loginIdentifier.trim() || !loginPassword
                                ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500 border border-slate-700/60'
                                : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-blue-950/40 hover:shadow-lg'
                            }`}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                <span>VERIFICANDO...</span>
                              </>
                            ) : (
                              <>
                                <LogIn className="w-4 h-4" />
                                <span>INICIAR SESIÓN (LOG IN)</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </>
                            )}
                          </motion.button>

                          <div className="pt-2 text-center text-xs font-mono text-slate-400">
                            ¿No tienes una cuenta aún?{' '}
                            <button
                              type="button"
                              onClick={() => {
                                setDirection(1);
                                setMode('register');
                                setError(null);
                              }}
                              className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                            >
                              Desliza a Registro (Sign In) →
                            </button>
                          </div>
                        </div>
                      )}
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="auth-modal-register-view"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(_e, { offset, velocity }) => {
                      if (offset.x > 40 || velocity.x > 300) {
                        setDirection(-1);
                        setMode('login');
                        setError(null);
                      }
                    }}
                    className="touch-pan-y"
                  >
                    <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                      {/* 1. Nombre de Usuario */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-mono font-semibold text-slate-200 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Nombre de usuario</span>
                          </label>
                          <div className="text-[11px] font-mono">
                            {isRegUsernameValid ? (
                              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Válido
                              </span>
                            ) : (
                              <span className="text-slate-400">Mín. 3 caracteres</span>
                            )}
                          </div>
                        </div>
                        <input
                          type="text"
                          required
                          value={regUsername}
                          onChange={(e) => {
                            setError(null);
                            setRegUsername(e.target.value);
                          }}
                          placeholder="ej. juan_perez"
                          autoComplete="username"
                          autoFocus
                          className="w-full bg-[#0b0f19] border border-slate-700/80 hover:border-slate-600 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none transition-all shadow-inner"
                        />
                      </div>

                      {/* 2. Contraseña */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-mono font-semibold text-slate-200 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Contraseña</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                          >
                            {showRegPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{showRegPassword ? 'Ocultar' : 'Mostrar'}</span>
                          </button>
                        </div>
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          value={regPassword}
                          onChange={(e) => {
                            setError(null);
                            setRegPassword(e.target.value);
                          }}
                          placeholder="Mínimo 6 caracteres"
                          autoComplete="new-password"
                          className="w-full bg-[#0b0f19] border border-slate-700/80 hover:border-slate-600 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none transition-all shadow-inner"
                        />
                      </div>

                      {/* 3. Número de Celular (Obligatorio en Sign In) */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-mono font-semibold text-slate-200 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Número de celular (WhatsApp)</span>
                          </label>
                          <div className="text-[11px] font-mono">
                            {cleanPhoneDigits.length === 0 ? (
                              <span className="text-slate-400">9 dígitos (empieza con 9)</span>
                            ) : !cleanPhoneDigits.startsWith('9') ? (
                              <span className="text-amber-400 font-semibold flex items-center gap-1">
                                Debe empezar con 9
                              </span>
                            ) : cleanPhoneDigits.length < 9 ? (
                              <span className="text-slate-400">{cleanPhoneDigits.length}/9 dígitos</span>
                            ) : (
                              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                9 dígitos válidos
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="relative flex items-center">
                          <div className="absolute left-1.5 top-1.5 bottom-1.5 px-2.5 rounded-lg bg-slate-800/90 border border-slate-700 flex items-center gap-1.5 text-xs font-mono font-bold text-slate-200 select-none z-10 pointer-events-none">
                            <span className="text-sm leading-none">🇵🇪</span>
                            <span>{prefix}</span>
                          </div>

                          <input
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            required
                            value={formatDisplayPhone(cleanPhoneDigits)}
                            onChange={handlePhoneChange}
                            placeholder="987 654 321"
                            autoComplete="tel"
                            className="w-full bg-[#0b0f19] border border-slate-700/80 hover:border-slate-600 focus:border-emerald-500 rounded-xl pl-[88px] pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 font-mono tracking-wider focus:outline-none transition-all shadow-inner"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          Cualquier número de 9 dígitos que comience con 9 (ej. 987 654 321).
                        </p>
                      </div>

                      {/* 4. Alias o Apodo (Opcional) */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-mono font-semibold text-slate-200 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Alias o Apodo</span>
                          </label>
                          <span className="text-[10px] font-mono text-slate-400 font-medium">(Opcional)</span>
                        </div>
                        <input
                          type="text"
                          value={regAlias}
                          onChange={(e) => {
                            setError(null);
                            setRegAlias(e.target.value);
                          }}
                          placeholder="ej. Juan P. (nombre visible en el torneo)"
                          className="w-full bg-[#0b0f19] border border-slate-700/80 hover:border-slate-600 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none transition-all shadow-inner"
                        />
                      </div>

                      {/* 5. Aceptación de Términos */}
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06] hover:border-slate-700 transition-colors">
                        <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                          <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 bg-[#0b0f19] cursor-pointer shrink-0"
                          />
                          <span className="text-[11px] text-slate-300 leading-relaxed text-wrap-pretty">
                            He leído y acepto los{' '}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsTermsModalOpen(true);
                              }}
                              className="underline text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                            >
                              Términos y Condiciones
                            </button>{' '}
                            y el{' '}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsTermsModalOpen(true);
                              }}
                              className="underline text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                            >
                              Descargo de Responsabilidad
                            </button>{' '}
                            de la versión Beta.
                          </span>
                        </label>
                      </div>

                      {/* Submit Button */}
                      <motion.button
                        whileTap={!isRegisterDisabled ? { scale: 0.98 } : undefined}
                        type="submit"
                        disabled={isRegisterDisabled}
                        className={`w-full py-3 px-4 rounded-xl font-mono text-xs font-black shadow-md flex items-center justify-center gap-2 min-h-[44px] transition-all ${
                          isRegisterDisabled
                            ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500 border border-slate-700/60'
                            : 'bg-[#10b981] hover:bg-[#059669] text-slate-950 cursor-pointer shadow-emerald-950/40 hover:shadow-lg'
                        }`}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                            <span>CREANDO CUENTA...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>CREAR CUENTA (SIGN IN) Y ENTRAR</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </motion.button>

                      <div className="pt-2 text-center text-xs font-mono text-slate-400">
                        ¿Ya tienes una cuenta registrada?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setDirection(-1);
                            setMode('login');
                            setError(null);
                          }}
                          className="text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer"
                        >
                          ← Desliza a Iniciar Sesión (Log In)
                        </button>
                      </div>

                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="shrink-0 bg-[#111827]/95 border-t border-white/[0.08] px-5 py-3 flex items-center justify-between text-[11px] font-mono">
          {!user && (
            <span className="text-slate-400">
              {mode === 'login'
                ? 'Ingreso rápido con usuario y clave'
                : '1 cuenta por celular · Saldo virtual gratuito'}
            </span>
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
