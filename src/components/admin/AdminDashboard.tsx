import React from 'react';
import { motion } from 'motion/react';
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
      <div className="terminal-card p-4 sm:p-5 rounded-2xl border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 text-xs font-mono elevation-card">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-amber-300 tracking-wide">CENTRALIZED OPERATOR CONTROL CONSOLE</span>
              <span className="text-slate-400 hidden sm:inline">&bull; Role: Platform Market Maker & Clearing Desk</span>
            </div>
            <div className="text-slate-300 text-[11px] mt-0.5 flex items-center gap-2 flex-wrap">
              <span>Platform Treasury Balance: <strong className="text-amber-400 font-bold font-mono tabular-nums">${(user?.virtualBalance ?? platformBalance ?? 25000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
              <span className="text-slate-500">&bull;</span>
              <span className="text-slate-400">Seed: $25,000.00 Base</span>
            </div>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigateTo('home')}
          className="self-start sm:self-auto px-4 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors text-xs font-mono font-bold cursor-pointer border border-slate-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit to Trader View</span>
        </motion.button>
      </div>

      {/* Operator Navigation Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto border-b border-slate-800 pb-3 mb-4 font-mono text-xs no-scrollbar scrollbar-none">
        <div className="flex items-center gap-1.5 p-1 bg-[#0e1424]/80 rounded-xl border border-white/[0.06]">
          {([
            { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
            { id: 'markets', label: 'Market Management', icon: <Layers className="w-3.5 h-3.5" /> },
            { id: 'create', label: 'Create Market', icon: <PlusCircle className="w-3.5 h-3.5" /> },
            { id: 'revenue', label: 'Revenue Analytics', icon: <TrendingUp className="w-3.5 h-3.5" /> },
            { id: 'risk', label: 'Market Maker Risk', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
            { id: 'users', label: 'Amigos / Usuarios', icon: <Users className="w-3.5 h-3.5" /> },
          ] as const).map((tab) => {
            const isActive = adminSubView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setAdminSubView(tab.id as any)}
                className={`relative px-3.5 py-2 min-h-[38px] rounded-lg flex items-center gap-2 whitespace-nowrap font-bold cursor-pointer transition-colors z-10 ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="admin-nav-tab"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    className="absolute inset-0 rounded-lg bg-slate-800/90 border border-white/[0.12] shadow-sm -z-10"
                  />
                )}
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigateTo('tournaments')}
          className="px-4 py-2 min-h-[40px] rounded-xl flex items-center gap-2 whitespace-nowrap font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 cursor-pointer shrink-0"
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Organize Tournaments (Arena)</span>
        </motion.button>
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
