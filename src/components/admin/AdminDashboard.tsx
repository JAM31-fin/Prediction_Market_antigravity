import React from 'react';
import { useMarket } from '../../context/MarketContext';
import { AdminOverview } from './AdminOverview';
import { AdminMarketList } from './AdminMarketList';
import { AdminCreateMarket } from './AdminCreateMarket';
import { AdminRevenueAnalytics } from './AdminRevenueAnalytics';
import { AdminRiskExposure } from './AdminRiskExposure';
import { AdminUsersList } from './AdminUsersList';
import { 
  LayoutDashboard, 
  Layers, 
  PlusCircle, 
  TrendingUp, 
  ShieldAlert, 
  ArrowLeft,
  ShieldCheck,
  Cpu,
  Trophy,
  Users
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { adminSubView, setAdminSubView, navigateTo, user, platformBalance } = useMarket();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Operator Security Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 text-xs font-mono">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-amber-300">CENTRALIZED OPERATOR CONTROL CONSOLE</span>
              <span className="text-slate-400 hidden sm:inline">&bull; Role: Platform Market Maker & Clearing Desk</span>
            </div>
            <div className="text-slate-300 text-[11px] mt-0.5 flex items-center gap-2 flex-wrap">
              <span>Platform Treasury Balance: <strong className="text-amber-400 font-bold font-mono">${(user?.virtualBalance ?? platformBalance ?? 25000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
              <span className="text-slate-500">&bull;</span>
              <span className="text-slate-400">Seed: $25,000.00 Base</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigateTo('home')}
          className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 flex items-center gap-1.5 transition-colors text-[11px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit to Trader View</span>
        </button>
      </div>

      {/* Operator Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800 pb-3 mb-2 font-mono text-xs no-scrollbar scrollbar-none">
        <button
          onClick={() => setAdminSubView('overview')}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors font-bold ${
            adminSubView === 'overview'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setAdminSubView('markets')}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors font-bold ${
            adminSubView === 'markets'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Market Management</span>
        </button>

        <button
          onClick={() => setAdminSubView('create')}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors font-bold ${
            adminSubView === 'create'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Create Market</span>
        </button>

        <button
          onClick={() => setAdminSubView('revenue')}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors font-bold ${
            adminSubView === 'revenue'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Revenue Analytics</span>
        </button>

        <button
          onClick={() => setAdminSubView('risk')}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors font-bold ${
            adminSubView === 'risk'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Market Maker Risk</span>
        </button>

        <button
          onClick={() => setAdminSubView('users')}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors font-bold ${
            adminSubView === 'users'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Amigos / Usuarios</span>
        </button>

        <button
          onClick={() => navigateTo('tournaments')}
          className="px-3.5 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors font-bold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/30 ml-auto cursor-pointer"
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Organize Tournaments (Arena)</span>
        </button>
      </div>

      {/* Tab Views */}
      {adminSubView === 'overview' && <AdminOverview />}
      {adminSubView === 'markets' && <AdminMarketList />}
      {adminSubView === 'create' && <AdminCreateMarket />}
      {adminSubView === 'revenue' && <AdminRevenueAnalytics />}
      {adminSubView === 'risk' && <AdminRiskExposure />}
      {adminSubView === 'users' && <AdminUsersList />}

    </div>
  );
};
