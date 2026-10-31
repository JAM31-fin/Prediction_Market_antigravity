import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { useMarket } from '../../context/MarketContext';
import { useLanguage } from '../../context/LanguageContext';
import { marketDictionary, getLocalizedOutcomeName } from '../../i18n/marketTranslations';
import { Position, LeaderboardUser } from '../../types';
import { PartialSellModal } from './PartialSellModal';
import confetti from 'canvas-confetti';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { 
  Briefcase, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  Trophy,
  Coins,
  Award,
  Sparkles,
  Flame,
  AlertCircle
} from 'lucide-react';

export const PortfolioPage: React.FC = () => {
  const { 
    user, 
    positions, 
    trades, 
    tournaments, 
    userTournaments,
    selectedTournamentId,
    setSelectedTournamentId,
    joinTournament,
    loadTournamentLeaderboard,
    navigateTo 
  } = useMarket();
  const { language, t } = useLanguage();

  const [selectedPositionToSell, setSelectedPositionToSell] = useState<Position | null>(null);
  const [activeTab, setActiveTab] = useState<'open' | 'settled'>('open');
  const [chartView, setChartView] = useState<'value' | 'pnl'>('value');
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);

  // Tournament selection: prioritize selectedTournamentId, then first tournament user is in, then first available
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(() => {
    if (selectedTournamentId && tournaments.some((t) => t.id === selectedTournamentId)) {
      return selectedTournamentId;
    }
    if (userTournaments.length > 0) {
      return userTournaments[0].tournament.id;
    }
    if (tournaments.length > 0) {
      return tournaments[0].id;
    }
    return null;
  });

  // Sync when selectedTournamentId or tournaments list changes
  useEffect(() => {
    if (selectedTournamentId && tournaments.some((t) => t.id === selectedTournamentId)) {
      setActiveTournamentId(selectedTournamentId);
    } else if (!activeTournamentId && tournaments.length > 0) {
      if (userTournaments.length > 0) {
        setActiveTournamentId(userTournaments[0].tournament.id);
      } else {
        setActiveTournamentId(tournaments[0].id);
      }
    }
  }, [selectedTournamentId, tournaments, userTournaments, activeTournamentId]);

  // Current tournament & participation metadata
  const currentParticipation = useMemo(() => {
    return userTournaments.find((ut) => ut.tournament.id === activeTournamentId);
  }, [userTournaments, activeTournamentId]);

  const currentTournament = useMemo(() => {
    return tournaments.find((t) => t.id === activeTournamentId) || currentParticipation?.tournament;
  }, [tournaments, activeTournamentId, currentParticipation]);

  const isEnrolled = Boolean(currentParticipation);
  const tournamentBalance = currentParticipation?.participant.tournamentBalance ?? 0;
  const initialGrantedBalance = currentParticipation?.participant.initialGrantedBalance 
    ?? currentTournament?.initialBalance 
    ?? 100.0;

  // Load leaderboard for active tournament to compute rank & podium standing
  useEffect(() => {
    if (activeTournamentId) {
      loadTournamentLeaderboard(activeTournamentId)
        .then(setLeaderboard)
        .catch(() => setLeaderboard([]));
    }
  }, [activeTournamentId, loadTournamentLeaderboard]);

  const userRankInfo = useMemo(() => {
    if (!user || !isEnrolled || leaderboard.length === 0) return null;
    const entry = leaderboard.find((u) => u.id === user.id);
    if (!entry) return null;
    const rank = entry.rank || (leaderboard.findIndex((u) => u.id === user.id) + 1);
    return {
      rank,
      totalUsers: leaderboard.length,
      isPodium: rank <= 3,
    };
  }, [user, isEnrolled, leaderboard]);

  // Filter positions strictly for this tournament
  const tournamentPositions = useMemo(() => {
    if (!activeTournamentId) return positions;
    return positions.filter((p) => {
      if (p.tournamentId) return p.tournamentId === activeTournamentId;
      const marketBelongs = currentTournament?.marketIds?.includes(p.marketId);
      if (marketBelongs) return true;
      if (tournaments.length === 1) return true;
      return false;
    });
  }, [positions, activeTournamentId, currentTournament, tournaments.length]);

  // Open positions (qty > 0)
  const openPositions = useMemo(() => {
    return tournamentPositions.filter((p) => p.status === 'OPEN' && p.quantity > 0.001);
  }, [tournamentPositions]);

  // Settled / historical positions
  const settledPositions = useMemo(() => {
    return tournamentPositions.filter((p) => p.status !== 'OPEN' || p.quantity <= 0.001);
  }, [tournamentPositions]);

  // Filter trades strictly for this tournament
  const tournamentTrades = useMemo(() => {
    if (!activeTournamentId) return trades;
    return trades.filter((t) => {
      if (t.tournamentId) return t.tournamentId === activeTournamentId;
      const marketBelongs = currentTournament?.marketIds?.includes(t.marketId);
      if (marketBelongs) return true;
      if (tournaments.length === 1) return true;
      return false;
    });
  }, [trades, activeTournamentId, currentTournament, tournaments.length]);

  // Financial calculations strictly calibrated to tournament bankroll
  const totalInvested = openPositions.reduce((acc, p) => acc + p.currentCostBasis, 0);
  const totalPositionsValue = openPositions.reduce((acc, p) => acc + p.currentValue, 0);
  const totalPortfolioValue = (isEnrolled ? tournamentBalance : (user?.virtualBalance ?? 0)) + totalPositionsValue;
  const totalUnrealizedPnL = openPositions.reduce((acc, p) => acc + p.unrealizedPnL, 0);
  const totalRealizedPnL = tournamentPositions.reduce((acc, p) => acc + (p.realizedPnL || 0), 0);
  const totalNetPnL = totalRealizedPnL + totalUnrealizedPnL;
  const baseVal = isEnrolled ? initialGrantedBalance : 100.0;
  const netReturnPercent = baseVal > 0 
    ? Number((((totalPortfolioValue - baseVal) / baseVal) * 100).toFixed(2)) 
    : 0;

  // Handle Joining active tournament directly from portfolio
  const handleJoinTournament = async () => {
    if (!activeTournamentId) return;
    try {
      setIsJoining(true);
      await joinTournament(activeTournamentId);
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#f59e0b'],
      });
    } catch (err: any) {
      console.error('Failed to join tournament:', err);
    } finally {
      setIsJoining(false);
    }
  };

  // Generate authentic historical portfolio chart data from tournament trade logs
  const chartData = useMemo(() => {
    // If no trades yet in this tournament, render baseline points
    if (!tournamentTrades || tournamentTrades.length === 0) {
      return [
        { time: language === 'es' ? 'Inicio' : 'Start', value: baseVal, pnl: 0 },
        { time: language === 'es' ? 'Hoy' : 'Now', value: Number(totalPortfolioValue.toFixed(2)), pnl: Number((totalPortfolioValue - baseVal).toFixed(2)) },
      ];
    }

    // Sort trades chronologically (oldest to newest)
    const sortedTrades = [...tournamentTrades].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const data = [
      { time: language === 'es' ? 'Inicio' : 'Start', value: baseVal, pnl: 0 }
    ];

    let runningCash = baseVal;
    let runningPositionCost = 0;

    for (const tr of sortedTrades) {
      const d = new Date(tr.timestamp);
      const timeLabel = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      
      if (tr.type === 'BUY') {
        runningCash -= tr.amount;
        runningPositionCost += (tr.amount - tr.fee - tr.spreadFee);
      } else if (tr.type === 'SELL') {
        runningCash += tr.amount;
        runningPositionCost = Math.max(0, runningPositionCost - tr.amount);
      } else if (tr.type === 'SETTLEMENT') {
        runningCash += tr.amount;
      }

      const estimatedPointVal = Number((runningCash + runningPositionCost).toFixed(2));
      const estimatedPointPnl = Number((estimatedPointVal - baseVal).toFixed(2));

      data.push({
        time: timeLabel,
        value: estimatedPointVal,
        pnl: estimatedPointPnl,
      });
    }

    // Always include current real mark-to-market point as final anchor
    data.push({
      time: language === 'es' ? 'Hoy' : 'Now',
      value: Number(totalPortfolioValue.toFixed(2)),
      pnl: Number((totalPortfolioValue - baseVal).toFixed(2)),
    });

    return data;
  }, [tournamentTrades, totalPortfolioValue, baseVal, language]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      
      {/* Header & Tournament Selector Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold tracking-wider">
              {language === 'es' ? 'PORTAFOLIO DE TORNEO' : 'TOURNAMENT PORTFOLIO'}
            </span>
            {currentTournament && (
              <span className="text-slate-400 text-xs font-mono">
                &bull; {currentTournament.title}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-wrap-balance">
            {language === 'es' ? 'Mi Portafolio de Inversión' : 'My Investment Portfolio'}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 text-wrap-pretty">
            {language === 'es' 
              ? 'Control de patrimonio neto, saldo de competición y posiciones atadas a tu torneo.'
              : 'Track your tournament net equity, competition bankroll, and active market positions.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigateTo('tournaments')}
            className="px-3.5 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold font-mono text-xs flex items-center gap-1.5 btn-tactile cursor-pointer transition-colors"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>{language === 'es' ? 'VER TORNEOS' : 'TOURNAMENTS'}</span>
          </button>
          <button
            onClick={() => navigateTo('markets')}
            className="px-4 py-2 min-h-[40px] rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 btn-tactile shadow-sm cursor-pointer"
          >
            <span>{language === 'es' ? 'EXPLORAR MERCADOS' : 'EXPLORE MARKETS'}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tournament Switcher Tabs */}
      {tournaments.length > 0 && (
        <div className="mb-6 p-1.5 rounded-2xl bg-[#0b0f19] border border-white/[0.08] flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div className="px-3 py-1 text-[11px] font-mono text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>{language === 'es' ? 'Torneo:' : 'Tournament:'}</span>
          </div>
          {tournaments.map((t) => {
            const isSelected = t.id === activeTournamentId;
            const participation = userTournaments.find((ut) => ut.tournament.id === t.id);
            const userInTourn = Boolean(participation);

            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTournamentId(t.id);
                  setSelectedTournamentId(t.id);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono font-semibold shrink-0 transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <span>{t.title}</span>
                {userInTourn ? (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isSelected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700/60 text-slate-300'
                  }`}>
                    ${participation.participant.tournamentBalance.toFixed(2)} tokens
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {language === 'es' ? 'Sin unirse' : 'Not joined'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Non-enrolled Callout Banner if user hasn't joined the selected tournament */}
      {!isEnrolled && currentTournament && (
        <div className="mb-8 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-emerald-500/15 border border-amber-500/30 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm sm:text-base">
                  {language === 'es' ? 'Aún no estás inscrito en este torneo' : 'You are not enrolled in this tournament'}
                </h3>
                <span className="px-2 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {language === 'es' ? '100% GRATUITO' : '100% FREE'}
                </span>
              </div>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 leading-relaxed">
                {language === 'es'
                  ? `Inscríbete gratis con 1 clic para recibir tus ${initialGrantedBalance.toFixed(0)} tokens de prueba y activar tu portafolio en "${currentTournament.title}".`
                  : `Join for free with 1 click to receive your ${initialGrantedBalance.toFixed(0)} test tokens and start trading in "${currentTournament.title}".`}
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleJoinTournament}
            disabled={isJoining}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black font-mono text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>
              {isJoining
                ? (language === 'es' ? 'Inscribiendo...' : 'Joining...')
                : (language === 'es' ? `🏆 UNIRSE Y RECIBIR ${initialGrantedBalance.toFixed(0)} TOKENS` : `🏆 JOIN & GET ${initialGrantedBalance.toFixed(0)} TOKENS`)}
            </span>
          </motion.button>
        </div>
      )}

      {/* KPI Cards Grid calibrated to tournament equity */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8 font-mono tabular-nums">
        
        {/* Total Portfolio Value (Equity) */}
        <div className="p-4 rounded-2xl terminal-card elevation-card">
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
            {language === 'es' ? 'Patrimonio Total' : 'Total Equity'}
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-white mt-1">
            ${totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-[11px] font-bold mt-1 ${netReturnPercent >= 0 ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
            {netReturnPercent >= 0 ? '+' : ''}{netReturnPercent}% {language === 'es' ? 'ROI torneo' : 'tournament ROI'}
          </div>
        </div>

        {/* Available Tournament Tokens */}
        <div className="p-4 rounded-2xl terminal-card elevation-card">
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
            {language === 'es' ? 'Tokens Disponibles' : 'Available Tokens'}
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-[#3b82f6] mt-1">
            ${(isEnrolled ? tournamentBalance : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            {language === 'es' ? 'Saldo en Torneo' : 'Tournament Cash'}
          </div>
        </div>

        {/* Invested Amount */}
        <div className="p-4 rounded-2xl terminal-card elevation-card">
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
            {language === 'es' ? 'Capital en Posiciones' : 'Invested Capital'}
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-200 mt-1">
            ${totalInvested.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {openPositions.length} {language === 'es' ? 'Posiciones' : 'Positions'}
          </div>
        </div>

        {/* Unrealized P&L */}
        <div className="p-4 rounded-2xl terminal-card elevation-card">
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
            {language === 'es' ? 'PnL No Realizado' : 'Unrealized P&L'}
          </div>
          <div className={`text-lg sm:text-xl font-extrabold mt-1 ${totalUnrealizedPnL >= 0 ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
            {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Mark to Market</div>
        </div>

        {/* Realized P&L */}
        <div className="p-4 rounded-2xl terminal-card elevation-card">
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
            {language === 'es' ? 'PnL Realizado' : 'Realized P&L'}
          </div>
          <div className={`text-lg sm:text-xl font-extrabold mt-1 ${totalRealizedPnL >= 0 ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
            {totalRealizedPnL >= 0 ? '+' : ''}${totalRealizedPnL.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {language === 'es' ? 'Ventas Cerradas' : 'Closed Trades'}
          </div>
        </div>

        {/* Tournament Rank / Podium Standing */}
        <div className="p-4 rounded-2xl terminal-card elevation-card flex flex-col justify-between">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              {language === 'es' ? 'Clasificación' : 'Leaderboard Rank'}
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-amber-400 mt-1 flex items-center gap-1.5">
              {userRankInfo ? (
                <>
                  <Award className="w-5 h-5 text-amber-400" />
                  <span>#{userRankInfo.rank}</span>
                  <span className="text-xs text-slate-400 font-normal">/ {userRankInfo.totalUsers}</span>
                </>
              ) : (
                <span className="text-slate-400 text-sm font-normal">
                  {isEnrolled ? (language === 'es' ? 'Participando' : 'Active') : (language === 'es' ? 'Sin unirse' : 'Not joined')}
                </span>
              )}
            </div>
          </div>
          <div className="mt-1">
            {userRankInfo?.isPodium ? (
              <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-400" />
                {language === 'es' ? '¡EN EL PODIO!' : 'ON THE PODIUM!'}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400">
                {language === 'es' ? 'Compitiendo por el podio' : 'Competing for podium'}
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Portfolio Financial Performance Chart */}
      <div className="terminal-card rounded-2xl p-5 sm:p-6 mb-8 elevation-card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="font-bold text-sm text-slate-100 font-mono uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>{language === 'es' ? 'Evolución del Portafolio en el Torneo' : 'Tournament Portfolio Growth Trajectory'}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 text-wrap-pretty">
              {language === 'es'
                ? `Valuación calculada sobre el saldo inicial de ${initialGrantedBalance.toFixed(0)} tokens y posiciones en vivo.`
                : `Valuation tracked from initial ${initialGrantedBalance.toFixed(0)} tokens bankroll and active positions.`}
            </p>
          </div>

          <div className="flex items-center glass-terminal rounded-xl p-1 text-xs font-mono">
            <button
              onClick={() => setChartView('value')}
              className={`px-3 py-1.5 min-h-[36px] rounded-lg btn-tactile cursor-pointer ${
                chartView === 'value' ? 'bg-slate-800 text-[#10b981] font-semibold border border-slate-700/60 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {language === 'es' ? 'Patrimonio ($)' : 'Portfolio Value ($)'}
            </button>
            <button
              onClick={() => setChartView('pnl')}
              className={`px-3 py-1.5 min-h-[36px] rounded-lg btn-tactile cursor-pointer ${
                chartView === 'pnl' ? 'bg-slate-800 text-[#3b82f6] font-semibold border border-slate-700/60 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {language === 'es' ? 'Retorno Neto ($)' : 'Cumulative P&L ($)'}
            </button>
          </div>
        </div>

        <div className="h-60 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.16} />
                  <stop offset="60%" stopColor="#10b981" stopOpacity={0.03} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.16} />
                  <stop offset="60%" stopColor="#3b82f6" stopOpacity={0.03} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.8} />
              <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
              <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0b0f19', 
                  borderColor: 'rgba(255,255,255,0.1)', 
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                }}
                itemStyle={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}
                labelStyle={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}
                formatter={(val: any) => [`$${Number(val).toFixed(2)} USD`, chartView === 'value' ? 'Patrimonio' : 'P&L']}
              />
              <Area 
                type="monotone" 
                dataKey={chartView === 'value' ? 'value' : 'pnl'} 
                stroke={chartView === 'value' ? '#10b981' : '#3b82f6'} 
                strokeWidth={2}
                fill={chartView === 'value' ? 'url(#valGrad)' : 'url(#pnlGrad)'} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Positions Tabs: Open vs Settled */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('open')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'open'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{language === 'es' ? 'Posiciones Abiertas' : 'Open Positions'}</span>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400">
              {openPositions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('settled')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'settled'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{language === 'es' ? 'Posiciones Cerradas / Liquidadas' : 'Settled Positions'}</span>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-slate-700 text-slate-300">
              {settledPositions.length}
            </span>
          </button>
        </div>
      </div>

      {/* Positions List */}
      {activeTab === 'open' ? (
        openPositions.length === 0 ? (
          <div className="text-center py-16 terminal-card rounded-2xl flex flex-col items-center justify-center p-6 elevation-card">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
              <Briefcase className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-200 mb-1">
              {language === 'es' ? 'No tienes posiciones activas en este torneo' : 'No active positions in this tournament'}
            </h4>
            <p className="text-slate-400 text-xs max-w-sm mb-4">
              {isEnrolled 
                ? (language === 'es' ? 'Usa tus tokens disponibles para comprar acciones en los mercados oficiales y empezar a escalar en el ranking.' : 'Use your tournament bankroll to take positions and climb the leaderboard.')
                : (language === 'es' ? 'Primero inscríbete en el torneo para recibir tus 100 tokens de prueba.' : 'First join the tournament to receive your 100 test tokens.')}
            </p>
            {isEnrolled ? (
              <button
                onClick={() => navigateTo('markets')}
                className="px-4 py-2 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 btn-tactile shadow-sm cursor-pointer"
              >
                <span>{language === 'es' ? 'EXPLORAR MERCADOS DEL TORNEO' : 'EXPLORE TOURNAMENT MARKETS'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleJoinTournament}
                disabled={isJoining}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 btn-tactile shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>{language === 'es' ? `UNIRSE Y RECIBIR ${initialGrantedBalance.toFixed(0)} TOKENS` : `JOIN & GET ${initialGrantedBalance.toFixed(0)} TOKENS`}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {openPositions.map((pos) => {
              const isProfitable = pos.unrealizedPnL >= 0;
              const entry = marketDictionary[pos.marketId];
              const displayQuestion = entry ? entry.question[language] : pos.marketQuestion;
              const displayOutcome = getLocalizedOutcomeName(pos.outcomeName, language);

              return (
                <div
                  key={pos.id}
                  className="terminal-card terminal-card-hover rounded-2xl p-4 sm:p-5 transition-all elevation-card"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* Market Question & Outcome Badge */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="hud-tag text-slate-300">
                          {pos.marketCategory}
                        </span>
                        <span className="hud-tag text-[#3b82f6] bg-sky-950/40 border-sky-500/20">
                          {displayOutcome} &bull; {pos.quantity.toFixed(3)} {language === 'es' ? 'acciones' : 'Shares'}
                        </span>
                      </div>
                      
                      <h3
                        onClick={() => navigateTo('detail', pos.marketId)}
                        className="text-sm sm:text-base font-bold text-slate-100 hover:text-[#3b82f6] cursor-pointer transition-colors leading-snug tracking-tight text-wrap-balance"
                      >
                        {displayQuestion}
                      </h3>
                    </div>

                    {/* Financial Metrics Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs text-right tabular-nums">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">
                          {language === 'es' ? 'Precio Entrada' : 'Avg Entry'}
                        </div>
                        <div className="font-semibold text-slate-300 mt-0.5">
                          ${pos.averagePrice.toFixed(3)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">
                          {language === 'es' ? 'Precio Actual' : 'Current Price'}
                        </div>
                        <div className="font-semibold text-slate-300 mt-0.5">
                          ${pos.currentPrice.toFixed(2)} ({Math.round(pos.currentPrice * 100)}&cent;)
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">
                          {language === 'es' ? 'Valor Actual' : 'Current Value'}
                        </div>
                        <div className="font-bold text-slate-100 mt-0.5">
                          ${pos.currentValue.toFixed(2)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">
                          {language === 'es' ? 'Ganancia / Pérdida' : 'Unrealized P&L'}
                        </div>
                        <div
                          className={`font-bold mt-0.5 flex items-center justify-end gap-1 ${
                            isProfitable ? 'text-[#10b981]' : 'text-[#f43f5e]'
                          }`}
                        >
                          {isProfitable ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span>
                            {isProfitable ? '+' : ''}${pos.unrealizedPnL.toFixed(2)} ({pos.unrealizedPnLPercent}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: [BUY MORE], [SELL] */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/[0.08]">
                      <button
                        onClick={() => navigateTo('detail', pos.marketId)}
                        className="flex-1 sm:flex-none px-3.5 py-1.5 min-h-[40px] rounded-lg bg-[#111827] hover:bg-[#10b981]/15 text-slate-200 hover:text-[#10b981] border border-white/[0.08] hover:border-[#10b981]/40 text-xs font-mono font-semibold btn-tactile cursor-pointer"
                      >
                        {language === 'es' ? 'INVERTIR MÁS' : 'BUY MORE'}
                      </button>
                      <button
                        onClick={() => setSelectedPositionToSell(pos)}
                        className="flex-1 sm:flex-none px-3.5 py-1.5 min-h-[40px] rounded-lg bg-[#f43f5e]/15 hover:bg-[#f43f5e]/25 text-[#f43f5e] border border-[#f43f5e]/40 text-xs font-mono font-bold btn-tactile cursor-pointer"
                      >
                        {language === 'es' ? 'VENDER / COBRAR' : 'SELL / REDEEM'}
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Settled / Closed Positions Tab */
        <div className="space-y-3">
          {settledPositions.length === 0 ? (
            <div className="text-center py-16 terminal-card rounded-2xl text-slate-400 text-xs font-mono">
              {language === 'es' ? 'No hay posiciones cerradas o liquidadas en este torneo todavía.' : 'No settled or closed positions in this tournament yet.'}
            </div>
          ) : (
            settledPositions.map((pos) => {
              const entry = marketDictionary[pos.marketId];
              const displayQuestion = entry ? entry.question[language] : pos.marketQuestion;
              const displayOutcome = getLocalizedOutcomeName(pos.outcomeName, language);

              return (
                <div key={pos.id} className="terminal-card rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 text-xs font-mono tabular-nums elevation-card">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="hud-tag uppercase text-slate-400">
                        {pos.status}
                      </span>
                      <span className="font-bold text-slate-200 font-sans text-sm">
                        {displayQuestion}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      {language === 'es' ? 'Opción elegida:' : 'Contract Outcome:'} <span className="text-slate-200 font-bold">{displayOutcome}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] text-slate-400">{language === 'es' ? 'Ganancia Realizada' : 'Realized P&L'}</div>
                    <div className={`font-bold text-sm ${pos.realizedPnL >= 0 ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
                      {pos.realizedPnL >= 0 ? '+' : ''}${pos.realizedPnL.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Partial Sell Modal */}
      {selectedPositionToSell && (
        <PartialSellModal
          position={selectedPositionToSell}
          onClose={() => setSelectedPositionToSell(null)}
        />
      )}

    </div>
  );
};
