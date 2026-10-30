import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useMarket } from '../../context/MarketContext';
import { useLanguage } from '../../context/LanguageContext';
import { 
  TrendingUp, 
  ShieldAlert, 
  Search, 
  Bell, 
  ChevronDown,
  Wallet,
  Globe,
  Trophy
} from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';

export const Navbar: React.FC = () => {
  const { 
    currentView, 
    navigateTo, 
    user, 
    searchQuery, 
    setSearchQuery,
    setIsAuthModalOpen,
    notifications,
    realtimeStatus,
    retryConnection,
  } = useMarket();

  const { language, toggleLanguage, t } = useLanguage();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigateTo('markets');
    }
  };

  const NAV_ITEMS = [
    { id: 'home', label: language === 'es' ? 'INICIO' : 'HOME' },
    { id: 'markets', label: language === 'es' ? 'MERCADOS' : 'MARKETS' },
    { id: 'tournaments', label: language === 'es' ? '🏆 TORNEOS' : '🏆 TOURNAMENTS' },
    { id: 'portfolio', label: language === 'es' ? 'PORTAFOLIO' : 'PORTFOLIO' },
    { id: 'history', label: language === 'es' ? 'HISTORIAL' : 'HISTORY' },
  ] as const;

  return (
    <header className="sticky top-0 z-40 bg-[#0b0f19]/90 border-b border-white/[0.08] backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-7">
            <button
              onClick={() => navigateTo('home')}
              className="flex items-center gap-2.5 text-left group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-[#3b82f6] group-hover:border-blue-500/60 group-hover:shadow-sm transition-all">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-white font-sans">
                    CENTRA<span className="text-[#3b82f6]">MARKETS</span>
                  </span>
                  <span className="hud-tag text-[#3b82f6] bg-blue-950/40 border-blue-500/25">
                    LMSR
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 -mt-0.5 font-mono">
                  Prediction Terminal
                </div>
              </div>
            </button>

            {/* Main Navigation Links with Sliding Pill */}
            <nav className="hidden md:flex items-center gap-1 bg-black/40 border border-white/[0.06] p-1 rounded-xl">
              {NAV_ITEMS.map((item) => {
                const isActive = currentView === item.id || (item.id === 'markets' && currentView === 'detail');
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className="relative px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-medium tracking-normal transition-colors cursor-pointer btn-tactile"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="navbar-tab-active"
                        className="absolute inset-0 bg-blue-500/15 border border-blue-500/30 rounded-lg shadow-sm"
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className={`relative z-10 ${isActive ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}

              {/* Admin Dashboard Navigation */}
              {user?.role === 'admin' && (
                <button
                  onClick={() => navigateTo('admin')}
                  aria-current={currentView === 'admin' ? 'page' : undefined}
                  className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold btn-tactile flex items-center gap-1.5 cursor-pointer ${
                    currentView === 'admin'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>ADMIN</span>
                </button>
              )}
            </nav>
          </div>

          {/* Quick Search Bar */}
          <form onSubmit={handleSearchSubmit} className="hidden lg:flex items-center flex-1 max-w-xs relative group">
            <Search className="w-3.5 h-3.5 text-slate-500 group-focus-within:text-[#3b82f6] absolute left-3 top-1/2 -translate-y-1/2 transition-colors pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contracts..."
              aria-label={language === 'es' ? 'Buscar contratos y retos' : 'Search contracts and markets'}
              className="w-full bg-[#0b0f19] border border-white/[0.08] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#3b82f6]/60 focus:ring-1 focus:ring-[#3b82f6]/20 transition-[border-color,box-shadow] duration-150 ease-out"
            />
          </form>

          {/* Right Action Widgets */}
          <div className="flex items-center gap-2">

            {/* Real-time SSE Live Connection Indicator with Radar Pulse */}
            <button
              type="button"
              id="navbar-realtime-status-pill"
              onClick={() => {
                if (realtimeStatus !== 'connected') {
                  retryConnection();
                }
              }}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 min-h-[40px] sm:min-h-[44px] rounded-xl border text-[11px] font-mono tabular-nums transition-[background-color,border-color,color] ${
                realtimeStatus === 'connected'
                  ? 'bg-black/30 border-white/[0.08] text-slate-300 hover:border-slate-700 cursor-default'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 cursor-pointer btn-tactile'
              }`}
              title={
                realtimeStatus === 'connected'
                  ? 'Real-Time Feed: LIVE (Server-Sent Events active for probability updates and trades)'
                  : `Real-Time Feed: ${realtimeStatus.toUpperCase()} (Click to reconnect)`
              }
            >
              <span className="relative flex h-2 w-2">
                {realtimeStatus === 'connected' && (
                  <span className="animate-radar absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    realtimeStatus === 'connected'
                      ? 'bg-[#10b981]'
                      : realtimeStatus === 'connecting'
                      ? 'bg-amber-400 animate-pulse'
                      : realtimeStatus === 'reconnecting'
                      ? 'bg-orange-500 animate-pulse'
                      : 'bg-[#f43f5e]'
                  }`}
                />
              </span>
              <span
                className={`font-semibold ${
                  realtimeStatus === 'connected'
                    ? 'text-[#10b981]'
                    : realtimeStatus === 'connecting'
                    ? 'text-amber-400'
                    : realtimeStatus === 'reconnecting'
                    ? 'text-orange-400'
                    : 'text-[#f43f5e]'
                }`}
              >
                {realtimeStatus === 'connected' ? 'LIVE' : realtimeStatus.toUpperCase()}
              </span>
            </button>

            {/* Language Selector (ES / EN) */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] sm:min-h-[44px] rounded-xl bg-[#111827] hover:bg-[#162032] border border-white/[0.08] hover:border-blue-500/30 text-xs font-mono font-bold text-slate-200 btn-tactile cursor-pointer"
              title={language === 'es' ? 'Cambiar idioma / Switch language' : 'Switch language / Cambiar idioma'}
              aria-label={language === 'es' ? 'Cambiar idioma a inglés' : 'Switch language to Spanish'}
            >
              <Globe className="w-3.5 h-3.5 text-[#3b82f6] shrink-0" />
              <span>{language.toUpperCase()}</span>
            </button>

            {/* Virtual Cash Balance Badge (Accessible Button) */}
            {user && (
              <button
                type="button"
                onClick={() => navigateTo(user.role === 'admin' ? 'admin' : 'portfolio')}
                className="flex items-center gap-2 px-3 py-1.5 min-h-[40px] sm:min-h-[44px] rounded-xl bg-[#111827] hover:bg-[#162032] border border-white/[0.08] hover:border-blue-500/30 cursor-pointer btn-tactile shadow-sm text-left"
                title={user.role === 'admin' ? 'Platform Treasury Balance' : 'Virtual Balance - Click to view portfolio'}
                aria-label={user.role === 'admin' ? `Treasury balance: $${(user.virtualBalance ?? 0).toFixed(2)} USD` : `Account balance: $${(user.virtualBalance ?? 0).toFixed(2)} USD`}
              >
                <Wallet className={`w-3.5 h-3.5 shrink-0 ${user.role === 'admin' ? 'text-amber-400' : 'text-[#10b981]'}`} />
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 leading-none">
                    {user.role === 'admin' ? 'Treasury' : 'Balance'}
                  </div>
                  <div className={`text-xs font-mono font-bold tabular-nums leading-tight mt-0.5 ${
                    user.role === 'admin' ? 'text-amber-400' : 'text-[#10b981]'
                  }`}>
                    ${(user.virtualBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </button>
            )}

            {/* Notifications Bell with 40x40px hit area */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] p-2 rounded-xl bg-[#111827] hover:bg-[#162032] border border-white/[0.08] hover:border-blue-500/30 text-slate-300 hover:text-white btn-tactile flex items-center justify-center cursor-pointer"
                title="Notifications"
                aria-label="Toggle notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#3b82f6] text-[10px] font-mono font-bold text-white flex items-center justify-center tabular-nums shadow-sm">
                    {unreadNotifs}
                  </span>
                )}
              </button>
              <NotificationDropdown isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
            </div>

            {/* Profile / Account Trigger */}
            {user ? (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 min-h-[40px] sm:min-h-[44px] rounded-xl bg-[#111827] hover:bg-[#162032] border border-white/[0.08] hover:border-blue-500/30 text-slate-200 btn-tactile cursor-pointer"
                title="Account Settings"
              >
                <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold font-mono shrink-0 ${
                  user.role === 'admin'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                }`}>
                  {(user.username || user.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-medium truncate max-w-[110px] leading-tight text-slate-200">
                    {user.username || user.name}
                  </span>
                  <span className={`text-[10px] font-mono leading-none ${
                    user.role === 'admin' ? 'text-amber-400 font-semibold' : 'text-slate-400'
                  }`}>
                    {user.role === 'admin' ? 'Admin' : 'Trader'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline shrink-0" />
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-4 py-2 min-h-[40px] sm:min-h-[44px] rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-sans text-xs font-semibold btn-tactile cursor-pointer shadow-sm flex items-center justify-center"
              >
                Sign In
              </button>
            )}
          </div>

        </div>

        {/* Mobile Navigation Strip */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-white/[0.06] text-xs">
          {NAV_ITEMS.map((item) => {
            const isActive = currentView === item.id || (item.id === 'markets' && currentView === 'detail');
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`px-3 py-2.5 min-h-[44px] flex items-center font-semibold btn-tactile ${isActive ? 'text-[#3b82f6]' : 'text-slate-400'}`}
              >
                {item.label}
              </button>
            );
          })}
          {user?.role === 'admin' && (
            <button
              onClick={() => navigateTo('admin')}
              aria-current={currentView === 'admin' ? 'page' : undefined}
              className={`px-3 py-2.5 min-h-[44px] flex items-center font-semibold btn-tactile ${currentView === 'admin' ? 'text-amber-400' : 'text-slate-400'}`}
            >
              ADMIN
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
