import React, { useState, useEffect, useRef } from 'react';
import { useMarket } from '../../context/MarketContext';
import { X, ArrowRight, ShieldCheck, LogOut, AlertCircle, Loader2, Database, Eye, EyeOff, UserCheck, Phone, KeyRound } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { user, login, register, logout, setAdminSubView, navigateTo } = useMarket();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const prevIsOpenRef = useRef<boolean>(false);

  // Sync state ONLY when modal transitions from closed to open.
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setMode(initialMode);
      setError(null);
      setPassword('');
      setShowPassword(false);
      setUsername('');
      setPhoneNumber('');
      setAdminPin('');
      setName('');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialMode]);

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
        const authedUser = await login(username.trim(), password, adminPin.trim() || undefined);
        if (authedUser?.role === 'admin') {
          navigateTo('admin');
          setAdminSubView('overview');
        } else {
          navigateTo('portfolio');
        }
      } else {
        if (!phoneNumber.trim()) {
          throw new Error('El número de celular / WhatsApp es obligatorio para evitar cuentas duplicadas.');
        }
        await register(username.trim(), password, phoneNumber.trim(), name.trim());
        navigateTo('portfolio');
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error de autenticación. Verifica las credenciales.');
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
    setError(null);
    setPassword('');
    setShowPassword(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full elevation-popover flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto overflow-hidden">
        
        {/* Sticky Header */}
        <div className="shrink-0 bg-slate-900 border-b border-slate-800 px-5 pt-4 pb-3 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 btn-tactile cursor-pointer"
            aria-label="Cerrar ventana"
            title="Cerrar ventana (Esc)"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Centra branding */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center text-slate-950 font-bold font-mono text-[11px]">
              C
            </div>
            <span className="text-[11px] font-mono uppercase font-bold text-slate-400 tracking-wider">
              TORNEO PRIVADO & ACCESO
            </span>
          </div>

          <h3 className="text-base font-bold text-slate-100 text-wrap-balance">
            {mode === 'login' ? 'Iniciar Sesión' : 'Registro de Participante (Anti-Sybil)'}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 text-wrap-pretty">
            {mode === 'login'
              ? 'Ingreso seguro con usuario, correo o teléfono.'
              : '1 cuenta por persona validada con número de celular / WhatsApp.'}
          </p>

          {/* Mode Tabs */}
          <div className="flex border-b border-slate-800 mt-3 -mb-3 font-mono text-xs gap-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`pb-2 px-3 font-semibold transition-[color,border-color] duration-150 border-b-2 cursor-pointer ${
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
              className={`pb-2 px-3 font-semibold transition-[color,border-color] duration-150 border-b-2 cursor-pointer ${
                mode === 'register'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Registrarse
            </button>
          </div>
        </div>

        {/* Form wrapping body and footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          
          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
            
            {/* Active Session Indicator */}
            {user ? (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
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
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Salir</span>
                </button>
              </div>
            ) : null}

            {/* Error Notification */}
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <p className="text-rose-200/90 leading-relaxed text-xs text-wrap-pretty">{error}</p>
              </div>
            )}

            {/* Inputs */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  {mode === 'login' ? 'Usuario, Correo o Celular:' : 'Nombre de Usuario:'}
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={mode === 'login' ? 'ej: admin31, mateo@amigos.pe o +51999888777' : 'ej: carlos_trader (sin espacios)'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono transition-[border-color,box-shadow] duration-150"
                  autoComplete="username"
                />
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Número de Celular / WhatsApp (Anti-Sybil obligatorio):</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="ej: +51 999 888 777 o +54 9 11 2345 6789"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono transition-[border-color,box-shadow] duration-150"
                    autoComplete="tel"
                  />
                  <p className="text-[11px] text-slate-400 font-mono mt-1">
                    Tu número se usa para validar tu identidad en el torneo y evitar cuentas duplicadas (1 cuenta por amigo).
                  </p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-mono text-slate-300">
                    Contraseña:
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer min-h-[30px] px-1"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                        <span>Ocultar</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
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
                    placeholder={mode === 'login' ? 'Ingresa tu contraseña' : 'Crea una contraseña segura'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono transition-[border-color,box-shadow] duration-150"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                </div>
              </div>

              {mode === 'login' && (
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span>PIN Maestro de Administrador <span className="text-slate-500">(Solo si eres Admin)</span>:</span>
                  </label>
                  <input
                    type="password"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="PIN maestro de seguridad (6 dígitos)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono transition-[border-color,box-shadow] duration-150"
                    autoComplete="one-time-code"
                  />
                </div>
              )}

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Nombre o Apodo <span className="text-slate-500">(opcional)</span>:
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ej: Carlos Trader"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono transition-[border-color,box-shadow] duration-150"
                  />
                  <p className="text-[11px] text-emerald-400/90 font-mono mt-1.5 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Al inscribirte a un torneo recibirás automáticamente tu saldo aislado ($1,000).</span>
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* Sticky Action Footer */}
          <div className="shrink-0 bg-slate-900 border-t border-slate-800 px-5 py-3.5 space-y-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs btn-tactile shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer min-h-[42px]"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{mode === 'login' ? 'INICIAR SESIÓN' : 'CREAR CUENTA Y VALIDAR'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            {/* Back / Cancel button */}
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-mono text-xs font-semibold btn-tactile flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px]"
            >
              ← Volver / Cancelar
            </button>

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
