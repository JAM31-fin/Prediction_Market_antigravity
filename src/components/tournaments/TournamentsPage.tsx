import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { useMarket } from '../../context/MarketContext';
import { useLanguage } from '../../context/LanguageContext';
import { Tournament, LeaderboardUser, TournamentStatus } from '../../types';
import { AdminTournamentModal } from './AdminTournamentModal';
import { SlidesModal } from '../common/SlidesModal';
import { 
  Trophy, 
  Clock, 
  Calendar, 
  Users, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  ArrowUpRight, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Award,
  Zap,
  Info,
  Link2,
  Unlink,
  Coins,
  X,
  Plus,
  Layers
} from 'lucide-react';

export const TournamentsPage: React.FC = () => {
  const { 
    tournaments, 
    selectedTournament, 
    selectedTournamentId,
    setSelectedTournamentId,
    tournamentLeaderboard, 
    loadTournamentLeaderboard,
    tournamentMarkets,
    loadingTournamentMarkets,
    loadTournamentMarkets,
    userTournamentParticipant,
    loadUserTournamentParticipant,
    addMarketToTournament,
    removeMarketFromTournament,
    markets,
    setAdminSubView,
    joinTournament,
    createTournament,
    updateTournament,
    deleteTournament,
    user,
    navigateTo,
    setSelectedCategory
  } = useMarket();

  const { language, t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'upcoming' | 'completed'>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [searchTrader, setSearchTrader] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  // Tournament Markets linking state
  const [isLinkMarketsModalOpen, setIsLinkMarketsModalOpen] = useState(false);
  const [marketSearchTerm, setMarketSearchTerm] = useState('');
  const [linkingMarketId, setLinkingMarketId] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  // Load leaderboard, tournament markets and user participant data when selected tournament changes
  useEffect(() => {
    if (selectedTournament?.id) {
      loadTournamentLeaderboard(selectedTournament.id);
      loadTournamentMarkets(selectedTournament.id, tournamentMarkets.length > 0);
      loadUserTournamentParticipant(selectedTournament.id);
    }
  }, [selectedTournament?.id, loadTournamentLeaderboard, loadTournamentMarkets, loadUserTournamentParticipant]);

  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      if (activeTab === 'all') return true;
      return t.status === activeTab;
    });
  }, [tournaments, activeTab]);

  const getTimeRemaining = (endDateIso: string) => {
    const diff = new Date(endDateIso).getTime() - Date.now();
    if (diff <= 0) return language === 'es' ? 'Torneo Finalizado' : 'Tournament Ended';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 1) return language === 'es' ? `Cierra en ${days} días` : `Ends in ${days} days`;
    if (hours > 0) {
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return language === 'es' ? `Cierra en ${hours}h ${mins}m` : `Ends in ${hours}h ${mins}m`;
    }
    const mins = Math.floor(diff / (1000 * 60));
    return language === 'es' ? `Cierra en ${mins}m` : `Ends in ${mins}m`;
  };

  const isUserJoined = useMemo(() => {
    if (!user) return false;
    return tournamentLeaderboard.some((u) => u.id === user.id);
  }, [tournamentLeaderboard, user]);

  const handleJoin = async () => {
    if (!selectedTournament || !user) return;
    try {
      setIsJoining(true);
      await joinTournament(selectedTournament.id);
      await Promise.all([
        loadUserTournamentParticipant(selectedTournament.id),
        loadTournamentLeaderboard(selectedTournament.id),
      ]);
      setJoinSuccess(true);
      setTimeout(() => setJoinSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsJoining(false);
    }
  };

  const handleToggleMarketLink = async (marketId: string, isCurrentlyLinked: boolean) => {
    if (!selectedTournament) return;
    try {
      setLinkingMarketId(marketId);
      if (isCurrentlyLinked) {
        await removeMarketFromTournament(selectedTournament.id, marketId);
      } else {
        await addMarketToTournament(selectedTournament.id, marketId);
      }
    } catch (err: any) {
      alert(err?.message || 'Error updating tournament market link');
    } finally {
      setLinkingMarketId(null);
    }
  };

  const handleCreateMarketForTournament = () => {
    if (selectedTournament) {
      setSelectedTournamentId(selectedTournament.id);
    }
    setAdminSubView('create');
    navigateTo('admin');
  };

  const handleTradeInTournament = () => {
    if (!selectedTournament) {
      navigateTo('markets');
      return;
    }
    if (selectedTournament.categoryFilter && selectedTournament.categoryFilter !== 'ALL') {
      setSelectedCategory(selectedTournament.categoryFilter);
    } else {
      setSelectedCategory('All');
    }
    navigateTo('markets');
  };

  const handleStatusChange = async (tournamentId: string, newStatus: TournamentStatus) => {
    try {
      await updateTournament(tournamentId, { status: newStatus });
    } catch (err: any) {
      alert(err?.message || 'Error updating status');
    }
  };

  const handleDelete = async (tournamentId: string, title: string) => {
    const confirmMsg = language === 'es'
      ? `¿Estás seguro de eliminar el torneo "${title}"?`
      : `Are you sure you want to delete tournament "${title}"?`;
    if (window.confirm(confirmMsg)) {
      try {
        await deleteTournament(tournamentId);
      } catch (err: any) {
        alert(err?.message || 'Error deleting tournament');
      }
    }
  };

  const filteredLeaderboard = useMemo(() => {
    if (!searchTrader.trim()) return tournamentLeaderboard;
    const q = searchTrader.toLowerCase();
    return tournamentLeaderboard.filter((u) => 
      u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
    );
  }, [tournamentLeaderboard, searchTrader]);

  const top3 = useMemo(() => {
    return filteredLeaderboard.slice(0, 3);
  }, [filteredLeaderboard]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      
      {/* Top Testing Arena Hero Header */}
      <div className="relative terminal-card rounded-2xl p-6 sm:p-8 overflow-hidden elevation-card border border-amber-500/30">
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold tracking-wide">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>{language === 'es' ? 'ARENA DE PRUEBAS & TORNEOS PRIVADOS' : 'ALPHA TESTING & TOURNAMENTS ARENA'}</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight text-wrap-balance">
              {language === 'es' ? 'Torneos del Grupo & Clasificación' : 'Group Tournaments & Leaderboard'}
            </h1>
            
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed text-wrap-pretty">
              {language === 'es'
                ? 'Apartado exclusivo para testear la plataforma con amigos. Organiza torneos con saldo virtual, define fechas límites estrictas y compite por premios reales.'
                : 'Dedicated arena to test the platform with friends. Organize tournaments with virtual credits, enforce strict deadlines, and compete for real rewards.'}
            </p>
          </div>

          {/* Actions: Visual Rules (Slides) & Admin Create */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsRulesModalOpen(true)}
              className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[#111827] hover:bg-[#1a2333] border border-[#3b82f6]/30 hover:border-[#3b82f6]/60 text-[#3b82f6] font-mono font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-[#3b82f6]" />
              <span>{language === 'es' ? 'Reglamento Visual (Slides)' : 'Visual Rules (Slides)'}</span>
            </button>

            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setEditingTournament(null);
                  setIsModalOpen(true);
                }}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{language === 'es' ? 'Crear / Organizar Torneo' : 'Create / Organize Tournament'}</span>
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Tournament Selection & Status Tabs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none font-mono text-xs p-1 bg-[#111827]/80 rounded-xl border border-white/[0.06]">
            {([
              { id: 'active', label: language === 'es' ? 'En Curso' : 'Active', icon: <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" /> },
              { id: 'upcoming', label: language === 'es' ? 'Próximos' : 'Upcoming', icon: <Clock className="w-3.5 h-3.5 text-amber-400" /> },
              { id: 'completed', label: language === 'es' ? 'Finalizados' : 'Completed', icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#3b82f6]" /> },
              { id: 'all', label: language === 'es' ? 'Todos' : 'All', icon: null },
            ] as const).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`relative px-4 py-2 min-h-[40px] rounded-lg flex items-center gap-2 font-bold cursor-pointer transition-colors z-10 ${
                    isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="tournaments-tab-active"
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

          <div className="text-xs font-mono text-slate-400 tabular-nums">
            {language === 'es' ? 'Mostrando' : 'Showing'} <strong className="text-white font-bold">{filteredTournaments.length}</strong> {language === 'es' ? 'torneo(s)' : 'tournament(s)'}
          </div>
        </div>

        {/* Tournaments Grid or Empty State */}
        {filteredTournaments.length === 0 ? (
          <div className="terminal-card rounded-2xl p-8 sm:p-12 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#111827] border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Trophy className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h4 className="text-base font-bold text-white tracking-tight">
                {language === 'es' ? 'No hay torneos activos en este momento' : 'No tournaments created yet'}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {language === 'es'
                  ? 'Cero eventos o participantes simulados. Como administrador, puedes organizar el primer torneo privado para tu grupo, definir la fecha límite y el premio real.'
                  : 'Zero simulated ghost events. As an administrator, you can organize the first private tournament for your group with strict deadlines and real prizes.'}
              </p>
            </div>
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setEditingTournament(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-extrabold cursor-pointer shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{language === 'es' ? 'Crear Primer Torneo' : 'Create First Tournament'}</span>
              </motion.button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTournaments.map((t) => {
              const isSelected = selectedTournament?.id === t.id;
              return (
                <motion.div
                  key={t.id}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedTournamentId(t.id)}
                  className={`relative terminal-card rounded-2xl p-5 cursor-pointer flex flex-col justify-between gap-4 elevation-card transition-all ${
                    isSelected
                      ? 'border-amber-400/60 ring-1 ring-amber-400/40 shadow-sm bg-[#111827]'
                      : 'terminal-card-hover'
                  }`}
                >
                  <div>
                    {/* Status & Deadline Header */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                          t.status === 'active'
                            ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30'
                            : t.status === 'upcoming'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30'
                        }`}
                      >
                        {t.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />}
                        {t.status === 'upcoming' && <Clock className="w-3 h-3 text-amber-400" />}
                        {t.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-[#3b82f6]" />}
                        {language === 'es'
                          ? t.status === 'active' ? 'EN CURSO' : t.status === 'upcoming' ? 'PRÓXIMO' : 'FINALIZADO'
                          : t.status.toUpperCase()}
                      </span>

                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 tabular-nums">
                        <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                        {getTimeRemaining(t.endDate)}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white tracking-tight line-clamp-1 mb-1.5 text-wrap-balance">
                      {t.title}
                    </h3>

                    <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed mb-3 text-wrap-pretty">
                      {t.description || (language === 'es' ? 'Torneo de pronósticos para el grupo.' : 'Group prediction tournament.')}
                    </p>

                    {/* Highlights with Concentric Radius */}
                    <div className="space-y-1.5 text-xs font-mono bg-[#0b0f19]/60 rounded-xl p-3 border border-white/[0.06]">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                          {language === 'es' ? 'Premio #1:' : 'Prize:'}
                        </span>
                        <span className="font-bold text-amber-300 truncate max-w-[170px] text-right">
                          {t.prizePool || (language === 'es' ? 'Premio acordado' : 'Agreed Prize')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-[#10b981]" />
                          {language === 'es' ? 'Saldo inicial:' : 'Bankroll:'}
                        </span>
                        <span className="font-bold font-mono text-slate-200 tabular-nums">
                          ${t.initialBalance.toLocaleString('en-US')} USD
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Users className="w-3 h-3 text-[#3b82f6]" />
                          {language === 'es' ? 'Mercados:' : 'Markets:'}
                        </span>
                        <span className="text-[#3b82f6] font-semibold">
                          {t.categoryFilter === 'ALL'
                            ? (language === 'es' ? 'Todos' : 'All')
                            : t.categoryFilter}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer with Admin Controls & Selection Prompt */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                    {isAdmin ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setEditingTournament(t);
                            setIsModalOpen(true);
                          }}
                          title={language === 'es' ? 'Editar configuración' : 'Edit tournament'}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {t.status === 'active' ? (
                          <button
                            onClick={() => handleStatusChange(t.id, 'completed')}
                            title={language === 'es' ? 'Finalizar torneo' : 'End tournament'}
                            className="px-2.5 py-1 rounded-lg bg-[#3b82f6]/15 border border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#3b82f6]/25 transition-colors cursor-pointer text-[10px] font-bold"
                          >
                            {language === 'es' ? 'Cerrar' : 'Close'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(t.id, 'active')}
                            title={language === 'es' ? 'Activar torneo' : 'Activate tournament'}
                            className="px-2.5 py-1 rounded-lg bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981] hover:bg-[#10b981]/25 transition-colors cursor-pointer text-[10px] font-bold"
                          >
                            {language === 'es' ? 'Activar' : 'Activate'}
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(t.id, t.title)}
                          title={language === 'es' ? 'Eliminar' : 'Delete'}
                          className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        {isSelected ? '● Seleccionado' : 'Haz clic para ver'}
                      </span>
                    )}

                    <span className={`text-[11px] font-bold flex items-center gap-1 ${
                      isSelected ? 'text-amber-400' : 'text-slate-400 group-hover:text-white'
                    }`}>
                      {language === 'es' ? 'Ver Clasificación' : 'View Arena'}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Tournament Arena & Live Leaderboard */}
      {selectedTournament && (
        <div className="space-y-6 pt-6 border-t border-slate-800">
          
          {/* Active Tournament Detail Hero Banner */}
          <div className="terminal-card rounded-2xl p-6 sm:p-7 elevation-card border-amber-500/30">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              
              <div className="space-y-2.5 max-w-3xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>TORNEO SELECCIONADO</span>
                  </span>

                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-300 text-xs font-mono">
                    {language === 'es' ? 'Mercados: ' : 'Markets: '}
                    <strong className="text-white">
                      {selectedTournament.categoryFilter === 'ALL'
                        ? (language === 'es' ? 'Todos los Sectores' : 'All Sectors')
                        : selectedTournament.categoryFilter}
                    </strong>
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {selectedTournament.title}
                </h2>

                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                  {selectedTournament.description}
                </p>

                {/* Deadlines & Timeline */}
                <div className="flex items-center gap-4 text-xs font-mono text-slate-400 pt-1 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {language === 'es' ? 'Inicio: ' : 'Start: '}
                      {new Date(selectedTournament.startDate).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                    <Clock className="w-3.5 h-3.5 text-rose-400" />
                    <span>
                      {language === 'es' ? 'Fecha Límite: ' : 'Deadline: '}
                      {new Date(selectedTournament.endDate).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tournament CTA Buttons & Prize Spotlight */}
              <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-3 shrink-0 lg:min-w-[260px]">
                
                {/* Prize Pool Callout */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30 text-center">
                  <div className="text-[10px] font-mono uppercase font-bold text-amber-300 tracking-wider flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    {language === 'es' ? 'Premio Anunciado al #1' : 'Announced Prize for #1'}
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-amber-200 mt-0.5">
                    {selectedTournament.prizePool || '$50 USD en efectivo'}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {!isUserJoined ? (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleJoin}
                      disabled={isJoining}
                      className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-mono font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isJoining ? (language === 'es' ? 'Inscribiendo...' : 'Joining...') : (language === 'es' ? 'Unirme al Torneo' : 'Join Tournament')}</span>
                    </motion.button>
                  ) : (
                    <div className="flex-1 px-3 py-2 min-h-[44px] rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981] font-mono font-bold text-xs flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                      <span>{language === 'es' ? 'Inscrito' : 'Joined'}</span>
                    </div>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleTradeInTournament}
                    className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                  >
                    <span>{language === 'es' ? 'Operar' : 'Trade'}</span>
                    <ArrowUpRight className="w-4 h-4 text-[#3b82f6]" />
                  </motion.button>
                </div>

                {/* Subcartera Aislada del Torneo */}
                {isUserJoined && (
                  <div className="p-3.5 rounded-xl bg-[#111827]/90 border border-[#10b981]/30 text-center">
                    <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold flex items-center justify-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-[#10b981]" />
                      {language === 'es' ? 'Tu Saldo en este Torneo' : 'Your Tournament Balance'}
                    </div>
                    <div className="text-base font-bold font-mono text-[#10b981] mt-0.5 tabular-nums">
                      ${(userTournamentParticipant?.tournamentBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[11px] text-slate-400 font-normal">USD</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      {language === 'es' ? 'Subcartera 100% aislada de tu saldo global' : '100% isolated from your global balance'}
                    </div>
                  </div>
                )}

                {joinSuccess && (
                  <div className="text-[11px] font-mono text-[#10b981] text-center animate-pulse">
                    {language === 'es' ? '¡Te has unido exitosamente al torneo!' : 'Successfully joined tournament!'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mercados Oficiales del Torneo Section */}
          <div className="terminal-card rounded-2xl p-5 sm:p-6 space-y-4 elevation-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Layers className="w-4 h-4" />
                  </span>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {language === 'es' ? 'Mercados Oficiales del Torneo' : 'Official Tournament Markets'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono font-bold">
                    {tournamentMarkets.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'es'
                    ? 'Solo las operaciones realizadas en estos mercados utilizan tu subcartera del torneo y suman puntos para la clasificación oficial.'
                    : 'Only trades placed on these markets utilize your tournament subwallet and score points for the official standings.'}
                </p>
              </div>

              {/* Admin Actions: Link existing or Create new market for tournament */}
              {isAdmin && (
                <div className="flex items-center gap-2 shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreateMarketForTournament}
                    className="px-3.5 py-2 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm shadow-amber-500/20"
                    title={language === 'es' ? 'Crear mercado vinculado directamente a este torneo' : 'Create new market linked to this tournament'}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{language === 'es' ? 'Crear Mercado' : 'Create Market'}</span>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsLinkMarketsModalOpen(true)}
                    className="px-3.5 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-mono font-bold text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                    title={language === 'es' ? 'Vincular o desvincular mercados existentes a este torneo' : 'Link or unlink existing markets'}
                  >
                    <Link2 className="w-3.5 h-3.5 text-[#3b82f6]" />
                    <span>{language === 'es' ? 'Vincular Mercados' : 'Link Markets'}</span>
                  </motion.button>
                </div>
              )}
            </div>

            {loadingTournamentMarkets && tournamentMarkets.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-mono text-xs">
                {language === 'es' ? 'Cargando mercados del torneo...' : 'Loading tournament markets...'}
              </div>
            ) : tournamentMarkets.length === 0 ? (
              <div className="py-10 text-center rounded-xl bg-[#0b0f19]/60 border border-slate-800/80 p-6">
                <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <div className="font-bold text-slate-300 text-sm">
                  {language === 'es' ? 'No hay mercados vinculados a este torneo' : 'No markets linked to this tournament yet'}
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                  {isAdmin
                    ? (language === 'es' 
                        ? 'Como administrador, puedes vincular mercados existentes con el botón "Vincular Mercados" o crear uno nuevo específicamente para este torneo.'
                        : 'As an administrator, you can link existing markets using "Link Markets" or create a new one for this tournament.')
                    : (language === 'es'
                        ? 'El organizador del torneo aún no ha vinculado mercados activos. Vuelve pronto para comenzar a operar.'
                        : 'The organizer has not linked active markets yet. Check back soon to start trading.')}
                </p>
                {isAdmin && (
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      onClick={() => setIsLinkMarketsModalOpen(true)}
                      className="px-4 py-2 min-h-[40px] rounded-xl bg-[#3b82f6]/15 border border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#3b82f6]/25 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>{language === 'es' ? 'Vincular Mercados Ahora' : 'Link Markets Now'}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tournamentMarkets.map((m) => {
                  return (
                    <div
                      key={m.id}
                      className="p-4 rounded-xl terminal-card terminal-card-hover flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="hud-tag">
                              {m.category}
                            </span>
                            <span className="hud-tag text-[#3b82f6] bg-sky-950/40 border-sky-500/20">
                              {m.outcomes?.length === 2 ? 'binary' : `${m.outcomes?.length || 0} opciones`}
                            </span>
                          </div>
                          <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full ${
                            m.status === 'open' 
                              ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30' 
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {m.status}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug mb-3">
                          {m.question}
                        </h4>

                        {/* Outcomes & Probabilities (Binary vs Multi-Outcome) */}
                        {m.outcomes.length === 2 ? (
                          <div className="grid grid-cols-2 gap-2 font-mono text-xs mb-3">
                            <div className="p-2.5 rounded-xl bg-[#10b981]/10 border border-[#10b981]/25 text-center">
                              <div className="text-[10px] text-[#10b981] uppercase font-bold truncate">
                                {m.outcomes[0]?.name || 'SÍ'}
                              </div>
                              <div className="text-base font-black text-white mt-0.5 tabular-nums">
                                {Math.round((m.outcomes[0]?.currentPrice || 0.5) * 100)}%
                              </div>
                            </div>

                            <div className="p-2.5 rounded-xl bg-[#f43f5e]/10 border border-[#f43f5e]/25 text-center">
                              <div className="text-[10px] text-[#f43f5e] uppercase font-bold truncate">
                                {m.outcomes[1]?.name || 'NO'}
                              </div>
                              <div className="text-base font-black text-white mt-0.5 tabular-nums">
                                {Math.round((m.outcomes[1]?.currentPrice || 0.5) * 100)}%
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5 mb-3 font-mono text-xs max-h-44 overflow-y-auto pr-0.5">
                            {m.outcomes.map((outcome, idx) => {
                              const prob = Math.round((outcome.currentPrice || 0) * 100);
                              return (
                                <div
                                  key={outcome.id}
                                  className="relative overflow-hidden p-2 rounded-xl bg-[#0b0f19]/80 border border-slate-800 flex items-center justify-between text-xs"
                                >
                                  <div
                                    className="absolute inset-y-0 left-0 bg-slate-800/70 rounded-l-xl transition-[width] duration-300 ease-out"
                                    style={{ width: `${prob}%` }}
                                  />
                                  <div className="relative z-10 flex items-center gap-2 truncate pr-2">
                                    <span
                                      className="w-2 h-2 rounded-full shrink-0"
                                      style={{ backgroundColor: outcome.color || (idx === 0 ? '#10b981' : idx === 1 ? '#3b82f6' : '#f43f5e') }}
                                    />
                                    <span className="font-bold text-slate-200 truncate">
                                      {outcome.name}
                                    </span>
                                  </div>
                                  <div className="relative z-10 flex items-center gap-2 font-mono tabular-nums shrink-0">
                                    <span className="text-slate-400">{prob}%</span>
                                    <span className="font-bold text-[#10b981]">{prob}&cent;</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                          Vol: <span className="text-slate-200 font-bold">${m.volume.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isAdmin && (
                            <button
                              onClick={() => handleToggleMarketLink(m.id, true)}
                              disabled={linkingMarketId === m.id}
                              title={language === 'es' ? 'Desvincular del torneo' : 'Unlink from tournament'}
                              className="p-2 rounded-lg bg-slate-900 hover:bg-[#f43f5e]/15 text-slate-400 hover:text-[#f43f5e] border border-slate-800 hover:border-[#f43f5e]/30 transition-colors cursor-pointer"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => navigateTo('detail', m.id)}
                            className="px-3.5 py-1.5 min-h-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-mono font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <span>{language === 'es' ? 'Operar' : 'Trade'}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-[#3b82f6]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top 3 Podium */}
          {top3.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                {language === 'es' ? 'Podio de Honor del Torneo' : 'Tournament Hall of Fame Podium'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1st Place */}
                {top3[0] && (
                  <motion.div
                    whileHover={{ y: -3 }}
                    className="order-1 sm:order-2 p-5 rounded-2xl terminal-card border-amber-500/40 relative shadow-xl text-center flex flex-col justify-between bg-gradient-to-b from-amber-500/15 via-[#111827] to-[#0b0f19]"
                  >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[11px] font-mono font-black uppercase shadow-md flex items-center gap-1">
                      🥇 {language === 'es' ? '1er Lugar' : '1st Place'}
                    </div>

                    <div className="pt-2">
                      <div className="w-14 h-14 mx-auto rounded-full ring-4 ring-amber-500/30 bg-slate-900 border border-amber-500/40 flex items-center justify-center text-xl font-black font-mono text-amber-300 mb-2">
                        {top3[0].username.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="font-extrabold text-white text-base tracking-tight truncate">
                        {top3[0].name || top3[0].username}
                      </div>
                      <div className="text-xs font-mono text-amber-400">
                        @{top3[0].username}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 font-mono text-xs space-y-1">
                      <div className="text-slate-400 text-[10px] uppercase font-bold">
                        {language === 'es' ? 'Patrimonio Neto' : 'Net Equity'}
                      </div>
                      <div className="text-lg font-black font-mono text-amber-300 tabular-nums">
                        ${top3[0].totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[#10b981] font-bold text-[11px] tabular-nums">
                        +{top3[0].roiPercent}% ROI
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 2nd Place */}
                {top3[1] && (
                  <motion.div
                    whileHover={{ y: -3 }}
                    className="order-2 sm:order-1 p-5 rounded-2xl terminal-card border-slate-600/40 relative shadow-md text-center flex flex-col justify-between bg-gradient-to-b from-slate-400/10 via-[#111827] to-[#0b0f19]"
                  >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-slate-400 text-slate-950 text-[11px] font-mono font-black uppercase shadow-md flex items-center gap-1">
                      🥈 {language === 'es' ? '2do Lugar' : '2nd Place'}
                    </div>

                    <div className="pt-2">
                      <div className="w-12 h-12 mx-auto rounded-full ring-2 ring-slate-400/30 bg-slate-900 border border-slate-700 flex items-center justify-center text-lg font-bold font-mono text-slate-200 mb-2">
                        {top3[1].username.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="font-bold text-slate-100 text-sm tracking-tight truncate">
                        {top3[1].name || top3[1].username}
                      </div>
                      <div className="text-xs font-mono text-slate-400">
                        @{top3[1].username}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 font-mono text-xs space-y-1">
                      <div className="text-slate-400 text-[10px] uppercase font-bold">
                        {language === 'es' ? 'Patrimonio Neto' : 'Net Equity'}
                      </div>
                      <div className="text-base font-bold font-mono text-slate-100 tabular-nums">
                        ${top3[1].totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className={`font-bold text-[11px] tabular-nums ${top3[1].roiPercent >= 0 ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
                        {top3[1].roiPercent >= 0 ? `+${top3[1].roiPercent}%` : `${top3[1].roiPercent}%`} ROI
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 3rd Place */}
                {top3[2] && (
                  <motion.div
                    whileHover={{ y: -3 }}
                    className="order-3 sm:order-3 p-5 rounded-2xl terminal-card border-amber-800/40 relative shadow-md text-center flex flex-col justify-between bg-gradient-to-b from-amber-700/10 via-[#111827] to-[#0b0f19]"
                  >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-700 text-amber-100 text-[11px] font-mono font-black uppercase shadow-md flex items-center gap-1">
                      🥉 {language === 'es' ? '3er Lugar' : '3rd Place'}
                    </div>

                    <div className="pt-2">
                      <div className="w-12 h-12 mx-auto rounded-full ring-2 ring-amber-700/30 bg-slate-900 border border-amber-800/40 flex items-center justify-center text-lg font-bold font-mono text-amber-200 mb-2">
                        {top3[2].username.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="font-bold text-slate-100 text-sm tracking-tight truncate">
                        {top3[2].name || top3[2].username}
                      </div>
                      <div className="text-xs font-mono text-slate-400">
                        @{top3[2].username}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 font-mono text-xs space-y-1">
                      <div className="text-slate-400 text-[10px] uppercase font-bold">
                        {language === 'es' ? 'Patrimonio Neto' : 'Net Equity'}
                      </div>
                      <div className="text-base font-bold font-mono text-slate-100 tabular-nums">
                        ${top3[2].totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className={`font-bold text-[11px] tabular-nums ${top3[2].roiPercent >= 0 ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
                        {top3[2].roiPercent >= 0 ? `+${top3[2].roiPercent}%` : `${top3[2].roiPercent}%`} ROI
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {/* Full Standings Table */}
          <div className="terminal-card rounded-2xl overflow-hidden elevation-card">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#3b82f6]" />
                  <span>{language === 'es' ? 'Clasificación General en Tiempo Real' : 'Live Tournament Standings'}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {language === 'es'
                    ? 'Patrimonio = Efectivo disponible + Valor de contratos abiertos a precio de mercado'
                    : 'Net Equity = Available cash + Open contracts valued at current market odds'}
                </p>
              </div>

              {/* Trader Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  aria-label={language === 'es' ? 'Buscar participante' : 'Search participant'}
                  value={searchTrader}
                  onChange={(e) => setSearchTrader(e.target.value)}
                  placeholder={language === 'es' ? 'Buscar amigo...' : 'Search participant...'}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0b0f19] border border-white/[0.08] text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-[#3b82f6] font-sans"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-[#0b0f19]/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4 w-16">#</th>
                    <th className="py-3.5 px-4 font-sans">{language === 'es' ? 'Participante' : 'Trader'}</th>
                    <th className="py-3.5 px-4 text-right">{language === 'es' ? 'Efectivo' : 'Cash'}</th>
                    <th className="py-3.5 px-4 text-right">{language === 'es' ? 'En Posiciones' : 'Open Val.'}</th>
                    <th className="py-3.5 px-4 text-right">{language === 'es' ? 'Patrimonio Total' : 'Total Equity'}</th>
                    <th className="py-3.5 px-4 text-right">ROI %</th>
                    <th className="py-3.5 px-4 text-right">{language === 'es' ? 'Aciertos' : 'Win Rate'}</th>
                    <th className="py-3.5 px-4 text-right">{language === 'es' ? 'Operaciones' : 'Trades'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 tabular-nums">
                  {filteredLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400 font-sans">
                        <Users className="w-7 h-7 mx-auto mb-2 text-slate-600" />
                        <p className="font-semibold text-slate-300">
                          {language === 'es' ? 'No hay participantes inscritos todavía' : 'No participants enrolled yet'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {language === 'es' ? '¡Sé el primero en inscribirte al torneo y recibir tu saldo para operar!' : 'Be the first to join the tournament and get your test bankroll!'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredLeaderboard.map((u, idx) => {
                      const isCurrentUser = user?.id === u.id;
                      return (
                        <tr 
                          key={u.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isCurrentUser ? 'bg-[#3b82f6]/[0.06] border-l-2 border-l-[#3b82f6]' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 font-bold">
                            {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                          </td>

                          <td className="py-3.5 px-4 font-sans">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold font-mono text-xs text-slate-200 shrink-0">
                                {u.username.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-100 flex items-center gap-1.5 truncate">
                                  <span>{u.name || u.username}</span>
                                  {isCurrentUser && (
                                    <span className="px-1.5 py-0.2 rounded bg-[#3b82f6]/20 text-[#3b82f6] text-[10px] font-mono font-bold">
                                      {language === 'es' ? 'TÚ' : 'YOU'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400 truncate">
                                  @{u.username}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right text-slate-400">
                            ${u.virtualBalance.toFixed(2)}
                          </td>

                          <td className="py-3.5 px-4 text-right text-slate-300">
                            ${u.openPositionsValue.toFixed(2)}
                          </td>

                          <td className="py-3.5 px-4 text-right font-bold text-slate-100 text-sm">
                            ${u.totalEquity.toFixed(2)}
                          </td>

                          <td className="py-3.5 px-4 text-right font-bold">
                            <span className={u.roiPercent >= 0 ? 'text-[#10b981]' : 'text-[#f43f5e]'}>
                              {u.roiPercent >= 0 ? `+${u.roiPercent}%` : `${u.roiPercent}%`}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right text-slate-300">
                            {u.winRate}% <span className="text-slate-500 text-[10px]">({u.winsCount})</span>
                          </td>

                          <td className="py-3.5 px-4 text-right text-slate-400">
                            {u.tradesCount}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rules and Determination Card */}
          <div className="terminal-card rounded-2xl p-5 text-xs space-y-2">
            <h4 className="font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Info className="w-4 h-4 text-[#3b82f6]" />
              <span>{language === 'es' ? 'Reglas y Condiciones del Torneo' : 'Tournament Rules & Conditions'}</span>
            </h4>
            <p className="text-slate-400 whitespace-pre-line leading-relaxed font-mono">
              {selectedTournament.rules || (
                language === 'es'
                  ? '1. Cada participante inicia con su saldo virtual.\n2. Al llegar la fecha límite, se congela el ranking y el primer lugar es declarado ganador.'
                  : '1. Each participant trades with their starting virtual balance.\n2. When the deadline arrives, the ranking locks and #1 is crowned winner.'
              )}
            </p>
          </div>

        </div>
      )}

      {/* Admin Tournament Modal */}
      <AdminTournamentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tournamentToEdit={editingTournament}
        onSave={async (data) => {
          if (editingTournament) {
            await updateTournament(editingTournament.id, data);
          } else {
            await createTournament(data);
          }
        }}
      />

      {/* Modal to Link / Unlink Markets to Tournament */}
      {isLinkMarketsModalOpen && selectedTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="terminal-card glass-terminal rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl elevation-card overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#3b82f6]" />
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {language === 'es' ? 'Vincular Mercados al Torneo' : 'Link Markets to Tournament'}
                  </h3>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  <span className="font-semibold text-amber-300">{selectedTournament.title}</span> • {tournamentMarkets.length} {language === 'es' ? 'mercados vinculados' : 'linked markets'}
                </div>
              </div>
              <button
                onClick={() => setIsLinkMarketsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-slate-800/80 bg-[#0b0f19]/60">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={marketSearchTerm}
                  onChange={(e) => setMarketSearchTerm(e.target.value)}
                  placeholder={language === 'es' ? 'Buscar mercados por pregunta o categoría...' : 'Search markets by question or category...'}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#111827] border border-slate-700 text-xs text-white placeholder-slate-500 outline-none focus:border-[#3b82f6] font-sans"
                />
              </div>
            </div>

            {/* Markets List */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {markets
                .filter((m) => {
                  if (!marketSearchTerm.trim()) return true;
                  const q = marketSearchTerm.toLowerCase();
                  return m.question.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
                })
                .map((m) => {
                  const isLinked = tournamentMarkets.some((tm) => tm.id === m.id);
                  const isBusy = linkingMarketId === m.id;

                  return (
                    <div
                      key={m.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        isLinked
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-[#0b0f19]/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="hud-tag">
                            {m.category}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                            Vol: ${m.volume.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-white truncate">
                          {m.question}
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleMarketLink(m.id, isLinked)}
                        disabled={isBusy}
                        className={`shrink-0 px-3.5 py-1.5 min-h-[36px] rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                          isLinked
                            ? 'bg-[#f43f5e]/15 hover:bg-[#f43f5e]/25 border border-[#f43f5e]/30 text-[#f43f5e]'
                            : 'bg-[#10b981] hover:bg-[#059669] text-slate-950 shadow-sm'
                        }`}
                      >
                        {isBusy ? (
                          <span>...</span>
                        ) : isLinked ? (
                          <>
                            <Unlink className="w-3.5 h-3.5" />
                            <span>{language === 'es' ? 'Desvincular' : 'Unlink'}</span>
                          </>
                        ) : (
                          <>
                            <Link2 className="w-3.5 h-3.5" />
                            <span>{language === 'es' ? 'Vincular' : 'Link'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-[#0b0f19]/80 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">
                {language === 'es' ? 'Los cambios se aplican de inmediato.' : 'Changes take effect immediately.'}
              </span>
              <button
                onClick={() => setIsLinkMarketsModalOpen(false)}
                className="px-4 py-2 min-h-[38px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold cursor-pointer"
              >
                {language === 'es' ? 'Cerrar' : 'Done'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Visual Tournament Rules Slides Modal */}
      <SlidesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        initialDeck="tournament-rules"
      />

    </div>
  );
};
