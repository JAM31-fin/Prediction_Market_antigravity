import React, { useState, useEffect, useRef } from 'react';
import { useMarket } from '../../context/MarketContext';
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
  User,
  Lock,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { user, login, register, logout, setAdminSubView, navigateTo } = useMarket();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [adminStep, setAdminStep] = useState<boolean>(false);
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showAdminPin, setShowAdminPin] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const prevIsOpenRef = useRef<boolean>(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Sync state ONLY when modal transitions from closed to open.
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setMode(initialMode);
      setAdminStep(false);
      setError(null);
      setPassword('');
      setShowPassword(false);
      setShowAdminPin(false);
      setUsername('');
      setPhoneNumber('');
      setAdminPin('');
      setName('');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialMode]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        if (!adminStep) {
          // STEP 1: Standard login attempt (without PIN)
          if (!username.trim()) {
            throw new Error('Por favor ingresa tu nombre de usuario, correo o celular.');
          }
          if (!password) {
            throw new Error('Por favor ingresa tu contraseña.');
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
              // Smooth dynamic transition to Step 2 for Admin PIN challenge
              setAdminStep(true);
              setAdminPin('');
              setError(null);
            } else {
              throw loginErr;
            }
          }
        } else {
          // STEP 2: Administrator master PIN verification
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
      } else {
        // REGISTRATION MODE
        if (!username.trim()) {
          throw new Error('Por favor ingresa un nombre de usuario.');
        }
        if (!phoneNumber.trim()) {
          throw new Error('El número de celular es obligatorio para validar tu cuenta en el torneo.');
        }
        if (!password) {
          throw new Error('Por favor define una contraseña para tu cuenta.');
        }

        await register(username.trim(), password, phoneNumber.trim(), name.trim() || undefined);
        navigateTo('portfolio');
        onClose();
      }
    } catch (err: any) {
      if (adminStep) {
        setError(err.message || 'Código PIN maestro inválido. Por favor verifica e intenta nuevamente.');
      } else {
        setError(err.message || 'Error de autenticación. Verifica tus credenciales.');
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

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setAdminStep(false);
    setError(null);
    setPassword('');
    setAdminPin('');
    setShowPassword(false);
    setShowAdminPin(false);
  };

  const handleBackToStep1 = () => {
    setAdminStep(false);
    setAdminPin('');
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full elevation-popover flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto overflow-hidden shadow-2xl transition-all duration-200">
        
        {/* Sticky Header */}
        <div className="shrink-0 bg-slate-900 border-b border-slate-800 px-5 pt-4 pb-3 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 btn-tactile cursor-pointer transition-colors"
            aria-label="Cerrar ventana"
            title="Cerrar ventana (Esc)"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Platform branding & tag */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-5 h-5 rounded flex items-center justify-center font-bold font-mono text-[11px] ${
              adminStep ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
            }`}>
              {adminStep ? 'A' : 'C'}
            </div>
            <span className={`text-[11px] font-mono uppercase font-bold tracking-wider ${
              adminStep ? 'text-amber-400' : 'text-slate-400'
            }`}>
              {adminStep ? 'AUTORIZACIÓN DE ADMINISTRADOR' : 'ACCESO AL TORNEO'}
            </span>
          </div>

          <h3 className="text-base font-bold text-slate-100 text-wrap-balance">
            {adminStep
              ? 'Verificación de Seguridad'
              : mode === 'login'
              ? 'Iniciar Sesión'
              : 'Crear Cuenta de Participante'}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 text-wrap-pretty">
            {adminStep
              ? `Acceso de operador detectado para @${username || 'admin'}. Ingresa tu PIN maestro.`
              : mode === 'login'
              ? 'Ingresa tus credenciales para acceder a tu billetera y posiciones.'
              : 'Regístrate con tu usuario y celular para participar en los mercados.'}
          </p>

          {/* Mode Tabs (Only visible when not in admin step) */}
          {!adminStep && (
            <div className="flex border-b border-slate-800 mt-3.5 -mb-3 font-mono text-xs gap-2">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`pb-2.5 px-3 font-semibold transition-[color,border-color] duration-150 border-b-2 cursor-pointer ${
                  mode === 'login'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`pb-2.5 px-3 font-semibold transition-[color,border-color] duration-150 border-b-2 cursor-pointer ${
                  mode === 'register'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Registrarse
              </button>
            </div>
          )}
        </div>

        {/* Form wrapping body and footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          
          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            
            {/* Active Session Indicator */}
            {user && !adminStep && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-full border flex items-center justify-center font-mono font-bold text-xs ${
                      user.role === 'admin'
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                        : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    }`}
                  >
                    {(user.username || user.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <span>{user.username || user.name}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          user.role === 'admin'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {user.role ? user.role.toUpperCase() : 'USER'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Saldo: ${user.virtualBalance?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  title="Cerrar sesión activa"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Salir</span>
                </button>
              </div>
            )}

            {/* Error Notification */}
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <p className="text-rose-200/90 leading-relaxed text-xs text-wrap-pretty">{error}</p>
              </div>
            )}

            {/* STEP 2: DYNAMIC ADMIN PIN CHALLENGE */}
            {adminStep ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-amber-300">
                      Cuenta con Rol Administrador
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Las credenciales son correctas. Por motivos de seguridad, introduce tu PIN maestro para autorizar el panel de control y la resolución de mercados.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-mono font-semibold text-amber-300 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>PIN Maestro de Administrador</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAdminPin(!showAdminPin)}
                      className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer min-h-[26px] px-1"
                    >
                      {showAdminPin ? (
                        <>
                          <EyeOff className="w-3 h-3 text-slate-400" />
                          <span>Ocultar</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3 text-slate-400" />
                          <span>Mostrar</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      ref={pinInputRef}
                      type={showAdminPin ? 'text' : 'password'}
                      required
                      value={adminPin}
                      onChange={(e) => setAdminPin(e.target.value)}
                      placeholder=""
                      maxLength={12}
                      className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3.5 py-3 text-sm text-center tracking-[0.3em] text-amber-300 focus:outline-none focus:border-amber-400 font-mono transition-[border-color,box-shadow] duration-150 shadow-inner"
                      autoComplete="one-time-code"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-1.5 text-center">
                    Código de seguridad asignado a la consola de administración.
                  </p>
                </div>
              </div>
            ) : mode === 'login' ? (
              /* LOGIN MODE - STEP 1 (Clean, no PIN visible upfront) */
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5">
                    Usuario, correo o celular
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono transition-[border-color,box-shadow] duration-150"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-mono font-semibold text-slate-300">
                      Contraseña
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer min-h-[26px] px-1"
                    >
                      {showPassword ? (
                        <>
                          <EyeOff className="w-3 h-3 text-slate-400" />
                          <span>Ocultar</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3 text-slate-400" />
                          <span>Mostrar</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono transition-[border-color,box-shadow] duration-150"
                      autoComplete="current-password"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* REGISTRATION MODE - Clean & Modern, No confusing dummy examples */
              <div className="space-y-3.5">
                {/* 1. Username */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-mono font-semibold text-slate-300">
                      Nombre de usuario
                    </label>
                    <span className="text-[10px] font-mono text-emerald-400 font-medium">Obligatorio</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder=""
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono transition-[border-color,box-shadow] duration-150"
                    autoComplete="username"
                  />
                </div>

                {/* 2. Phone Number (Anti-Sybil) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Número de celular</span>
                    </label>
                    <span className="text-[10px] font-mono text-emerald-400 font-medium">Obligatorio</span>
                  </div>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder=""
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono transition-[border-color,box-shadow] duration-150"
                    autoComplete="tel"
                  />
                  <p className="text-[10px] text-slate-400 font-mono mt-1">
                    Validación única para participar en el torneo (1 cuenta por persona).
                  </p>
                </div>

                {/* 3. Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <label className="block text-xs font-mono font-semibold text-slate-300">
                        Contraseña
                      </label>
                      <span className="text-[10px] font-mono text-emerald-400 font-medium">Obligatoria</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer min-h-[26px] px-1"
                    >
                      {showPassword ? (
                        <>
                          <EyeOff className="w-3 h-3 text-slate-400" />
                          <span>Ocultar</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3 text-slate-400" />
                          <span>Mostrar</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono transition-[border-color,box-shadow] duration-150"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {/* 4. Nickname (Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-mono font-semibold text-slate-300">
                      Apodo
                    </label>
                    <span className="text-[10px] font-mono text-slate-500">(Opcional)</span>
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder=""
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono transition-[border-color,box-shadow] duration-150"
                  />
                  <p className="text-[10px] text-slate-500 font-mono mt-1">
                    Nombre visible en la clasificación y perfil del torneo.
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Sticky Action Footer */}
          <div className="shrink-0 bg-slate-900 border-t border-slate-800 px-5 py-3.5 space-y-2">
            {adminStep ? (
              <>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs btn-tactile shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer min-h-[42px] transition-colors"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <>
                      <span>VERIFICAR PIN Y ACCEDER</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBackToStep1}
                  className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-mono text-xs font-semibold btn-tactile flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver a ingresar credenciales</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs btn-tactile shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer min-h-[42px] transition-colors"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <>
                      <span>{mode === 'login' ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-mono text-xs font-semibold btn-tactile flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] transition-colors"
                >
                  Cancelar
                </button>
              </>
            )}

            {/* Persistence Status */}
            <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3 text-cyan-400" />
                PostgreSQL / Supabase Cloud
              </span>
              <span>Anti-Sybil + PIN 2FA</span>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
