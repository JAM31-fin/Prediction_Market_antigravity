import React from 'react';
import { ShieldAlert, ArrowLeft, KeyRound } from 'lucide-react';
import { useMarket } from '../../context/MarketContext';

interface AdminAccessDeniedProps {
  onReturnHome: () => void;
  onOpenAuth: () => void;
}

export const AdminAccessDenied: React.FC<AdminAccessDeniedProps> = ({ onReturnHome, onOpenAuth }) => {
  const { user } = useMarket();

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-6 text-amber-400">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono font-bold text-xs uppercase tracking-wider">
        403 Forbidden &bull; Role-Based Authorization
      </span>

      <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mt-4 mb-3">
        Administrator Privileges Required
      </h1>

      <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto mb-6">
        The Operator Dashboard, Market Lifecycle Management, and Resolution Desk are restricted to accounts with the <span className="font-mono text-amber-300 font-bold">admin</span> role.
      </p>

      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-left max-w-md mx-auto mb-8 space-y-1.5">
        <div className="flex justify-between text-slate-400">
          <span>Active Account:</span>
          <span className="text-slate-200">{user?.email || 'Not signed in'}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Current Role:</span>
          <span className="text-rose-400 font-bold uppercase">{user?.role || 'Guest'}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Required Role:</span>
          <span className="text-amber-400 font-bold uppercase">admin</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={onReturnHome}
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono font-bold transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>RETURN TO MARKETS</span>
        </button>

        <button
          onClick={onOpenAuth}
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
        >
          <KeyRound className="w-4 h-4" />
          <span>SIGN IN AS ADMINISTRATOR</span>
        </button>
      </div>
    </div>
  );
};
