import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useMarket } from '../../context/MarketContext';
import { 
  Phone, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  User,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

interface PhoneAuthFormProps {
  onSuccess?: () => void;
  onOpenTerms: () => void;
  compactMode?: boolean;
}

export const PhoneAuthForm: React.FC<PhoneAuthFormProps> = ({
  onSuccess,
  onOpenTerms,
  compactMode = false,
}) => {
  const { loginWithPhone } = useMarket();

  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [alias, setAlias] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract clean digits: Any 9 digits in beta phase
  const cleanDigits = phoneNumber.replace(/\D/g, '');
  
  const isPhoneValid = cleanDigits.length === 9;
  const isUsernameValid = username.trim().length >= 3;
  const isSubmitDisabled = !isUsernameValid || !isPhoneValid || !acceptedTerms || loading;

  // Format 9 digits as "9XX XXX XXX"
  const formatDisplayPhone = (digits: string) => {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    let raw = e.target.value.replace(/\D/g, '');
    // If length didn't change but string shortened, user backspaced on a space: delete 1 digit
    if (raw.length === phoneNumber.length && e.target.value.length < formatDisplayPhone(phoneNumber).length) {
      raw = raw.slice(0, -1);
    }
    // Limit strictly to 9 digits
    if (raw.length > 9) {
      raw = raw.slice(0, 9);
    }
    setPhoneNumber(raw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cleanDigits.length !== 9) {
      setError('El número de celular debe tener exactamente 9 dígitos (ej. 987 654 321).');
      return;
    }
    if (isSubmitDisabled) return;

    setError(null);
    setLoading(true);

    try {
      await loginWithPhone(
        cleanDigits, 
        username.trim(), 
        alias.trim() || undefined
      );
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión / registrarse. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Error alert */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <p className="text-rose-200/90 leading-relaxed text-xs">{error}</p>
        </div>
      )}

      <form noValidate onSubmit={handleSubmit} className="space-y-3.5">
        
        {/* 1. Username Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-mono font-semibold text-slate-200 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Nombre de usuario</span>
            </label>
            <div className="text-[11px] font-mono">
              {isUsernameValid ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Válido
                </span>
              ) : (
                <span className="text-slate-400">
                  Mínimo 3 caracteres
                </span>
              )}
            </div>
          </div>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => {
              setError(null);
              setUsername(e.target.value);
            }}
            placeholder="ej. juan_perez"
            autoComplete="username"
            autoFocus={!compactMode}
            className="w-full bg-[#0b0f19] border border-slate-700/90 hover:border-slate-600 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none transition-all shadow-inner"
          />
        </div>

        {/* 2. Phone Number Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-mono font-semibold text-slate-200 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Número de celular</span>
            </label>
            <div className="text-[11px] font-mono">
              {cleanDigits.length === 0 ? (
                <span className="text-slate-400">9 dígitos</span>
              ) : cleanDigits.length < 9 ? (
                <span className="text-slate-400">{cleanDigits.length}/9 dígitos</span>
              ) : (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  9 dígitos válidos
                </span>
              )}
            </div>
          </div>

          <div className="relative flex items-center">
            <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />

            <input
              type="tel"
              inputMode="numeric"
              value={formatDisplayPhone(cleanDigits)}
              onChange={handlePhoneChange}
              placeholder="9 dígitos (ej. 987 654 321)"
              autoComplete="tel"
              className="w-full bg-[#0b0f19] border border-slate-700/90 hover:border-slate-600 focus:border-emerald-500 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 font-mono tracking-wider focus:outline-none transition-all shadow-inner"
            />
          </div>
          <p className="text-[10px] text-slate-400 font-mono mt-1">
            Cualquier número de 9 dígitos.
          </p>
        </div>

        {/* 3. Alias Field (Optional) */}
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
            value={alias}
            onChange={(e) => {
              setError(null);
              setAlias(e.target.value);
            }}
            placeholder="ej. Juan P. (nombre visible en el torneo)"
            className="w-full bg-[#0b0f19] border border-slate-700/90 hover:border-slate-600 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none transition-all shadow-inner"
          />
          <p className="text-[10px] text-slate-400 font-mono mt-1">
            Si lo dejas en blanco, se utilizará tu nombre de usuario.
          </p>
        </div>

        {/* 4. Mandatory Terms & Disclaimer Checkbox */}
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
                  onOpenTerms();
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
                  onOpenTerms();
                }}
                className="underline text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
              >
                Descargo de Responsabilidad
              </button>{' '}
              de la versión Beta.
            </span>
          </label>
        </div>

        {/* 5. Submit Button */}
        <motion.button
          whileTap={!isSubmitDisabled ? { scale: 0.98 } : undefined}
          type="submit"
          disabled={isSubmitDisabled}
          className={`w-full py-3 px-4 rounded-xl font-mono text-xs font-black shadow-md flex items-center justify-center gap-2 min-h-[44px] transition-all ${
            isSubmitDisabled
              ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500 border border-slate-700/60'
              : 'bg-[#10b981] hover:bg-[#059669] text-slate-950 cursor-pointer shadow-emerald-950/40 hover:shadow-lg'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              <span>PROCESANDO...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>CONTINUAR / ENTRAR AL SIMULADOR</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </motion.button>

      </form>
    </div>
  );
};
