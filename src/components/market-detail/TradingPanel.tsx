import React, { useState, useEffect, useMemo } from 'react';
import { Market, Position, Outcome, TournamentParticipant } from '../../types';
import { useMarket } from '../../context/MarketContext';
import { useLanguage } from '../../context/LanguageContext';
import { LMSREngine } from '../../services/lmsrEngine';
import confetti from 'canvas-confetti';
import { 
  ArrowRight, 
  HelpCircle, 
  Check, 
  AlertCircle, 
  Info, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck,
  Wallet,
  Sparkles,
  Zap,
  DollarSign,
  Trophy,
  Coins
} from 'lucide-react';
import { MarketLifecycleStateCard } from './MarketLifecycleStateCard';

interface TradingPanelProps {
  market: Market;
  tradeIntent?: {
    mode: 'BUY' | 'SELL';
    outcomeId?: string;
    shares?: string;
  } | null;
}

export const TradingPanel: React.FC<TradingPanelProps> = ({ market, tradeIntent }) => {
  const { 
    user, 
    positions, 
    executeTrade, 
    navigateTo,
    tournaments,
    loadUserTournamentParticipant
  } = useMarket();
  const { language, t } = useLanguage();

  // Mode: BUY or SELL
  const [tradeMode, setTradeMode] = useState<'BUY' | 'SELL'>('BUY');
  
  // Selected outcome id
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>(
    market.outcomes[0]?.id || ''
  );

  // Buy input: dollar amount
  const [dollarAmount, setDollarAmount] = useState<string>('50');

  // Sell input: shares count
  const [sellShares, setSellShares] = useState<string>('25');

  const [isExecuting, setIsExecuting] = useState(false);
  const [tradeStatus, setTradeStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Tournament context & isolated wallet state
  const isTournamentMarket = Boolean(market.tournamentId);
  const tournament = useMemo(() => {
    return isTournamentMarket ? tournaments.find((t) => t.id === market.tournamentId) : null;
  }, [isTournamentMarket, tournaments, market.tournamentId]);

  const [tournamentParticipant, setTournamentParticipant] = useState<TournamentParticipant | null>(null);
  const [isLoadingParticipant, setIsLoadingParticipant] = useState(false);

  useEffect(() => {
    if (market.tournamentId && user) {
      setIsLoadingParticipant(true);
      loadUserTournamentParticipant(market.tournamentId)
        .then((part) => setTournamentParticipant(part))
        .catch(() => setTournamentParticipant(null))
        .finally(() => setIsLoadingParticipant(false));
    } else {
      setTournamentParticipant(null);
    }
  }, [market.tournamentId, user, loadUserTournamentParticipant]);

  const isEnrolledInTournament = Boolean(tournamentParticipant);

  // Sync external trade intent if user clicked SELL on holdings
  useEffect(() => {
    if (tradeIntent) {
      if (tradeIntent.mode) setTradeMode(tradeIntent.mode);
      if (tradeIntent.outcomeId) setSelectedOutcomeId(tradeIntent.outcomeId);
      if (tradeIntent.shares) setSellShares(tradeIntent.shares);
      setTradeStatus(null);
    }
  }, [tradeIntent]);

  // Find user position for this market and selected outcome
  const userPosition = useMemo(() => {
    return positions.find(
      (p) => p.marketId === market.id && p.outcomeId === selectedOutcomeId && p.status === 'OPEN' && p.quantity > 0
    );
  }, [positions, market.id, selectedOutcomeId]);

  const selectedOutcome = market.outcomes.find((o) => o.id === selectedOutcomeId) || market.outcomes[0];

  // LMSR Quantities map
  const currentQuantities = useMemo(() => {
    const qMap: Record<string, number> = {};
    market.outcomes.forEach((o) => {
      qMap[o.id] = o.q;
    });
    return qMap;
  }, [market]);

  // Compute live quote using isolated LMSR Engine
  const parsedAmount = parseFloat(dollarAmount) || 0;
  const parsedShares = parseFloat(sellShares) || 0;

  const quote = useMemo(() => {
    try {
      if (tradeMode === 'BUY') {
        if (parsedAmount <= 0) return null;
        return LMSREngine.getTradeQuote(
          currentQuantities,
          selectedOutcomeId,
          'BUY',
          parsedAmount,
          market.liquidityParameter,
          market.commissionRate,
          market.spread
        );
      } else {
        if (parsedShares <= 0 || !userPosition) return null;
        // Cap quote calculation to available shares so it doesn't fail
        const quoteShares = Math.min(parsedShares, userPosition.quantity);
        return LMSREngine.getTradeQuote(
          currentQuantities,
          selectedOutcomeId,
          'SELL',
          quoteShares,
          market.liquidityParameter,
          market.commissionRate,
          market.spread
        );
      }
    } catch {
      return null;
    }
  }, [currentQuantities, selectedOutcomeId, tradeMode, parsedAmount, parsedShares, userPosition, market]);

  // Check if active user is an administrator
  const isAdmin = user?.role === 'admin';

  // Effective available balance: tournament subwallet balance if market is assigned to a tournament, otherwise global virtual balance
  const userBalance = isTournamentMarket 
    ? (tournamentParticipant?.tournamentBalance ?? 0)
    : (user?.virtualBalance ?? 0);

  const isTournamentEnrollmentRequired = isTournamentMarket && !isEnrolledInTournament && !isAdmin;

  const isInsufficientBalance = tradeMode === 'BUY' && parsedAmount > userBalance;
  const isZeroBuy = tradeMode === 'BUY' && parsedAmount <= 0;
  
  const availableShares = userPosition ? userPosition.quantity : 0;
  const isNoPositionToSell = tradeMode === 'SELL' && (!userPosition || availableShares <= 0);
  const isExceedingOwnedShares = tradeMode === 'SELL' && (parsedShares > availableShares + 0.00001);
  const isZeroSell = tradeMode === 'SELL' && parsedShares <= 0;

  const isBuyDisabled =
    isAdmin ||
    market.status !== 'open' ||
    isTournamentEnrollmentRequired ||
    isZeroBuy ||
    isInsufficientBalance ||
    isExecuting;

  const isSellDisabled =
    isAdmin ||
    market.status !== 'open' ||
    isTournamentEnrollmentRequired ||
    isZeroSell ||
    isNoPositionToSell ||
    isExceedingOwnedShares ||
    isExecuting;

  // Handle Trade Execution
  const handleExecute = async () => {
    if (isAdmin) {
      setTradeStatus({
        success: false,
        message: 'Administrators cannot trade. Platform integrity policy prohibits administrative accounts from taking market positions.',
      });
      return;
    }

    if (isTournamentEnrollmentRequired) {
      setTradeStatus({
        success: false,
        message: language === 'es'
          ? 'Debes unirte a este torneo para operar en este mercado oficial.'
          : 'You must join this tournament to trade in this official tournament market.',
      });
      return;
    }

    if (market.status !== 'open') {
      setTradeStatus({ success: false, message: `Market is ${market.status} and not accepting trades.` });
      return;
    }

    if (tradeMode === 'BUY') {
      if (isInsufficientBalance) {
        setTradeStatus({ success: false, message: `Insufficient balance. You have $${userBalance.toFixed(2)} available.` });
        return;
      }
      if (parsedAmount <= 0) {
        setTradeStatus({ success: false, message: 'Please enter a valid investment amount.' });
        return;
      }
    } else {
      if (isNoPositionToSell) {
        setTradeStatus({ success: false, message: 'You do not own any shares of this outcome.' });
        return;
      }
      if (isExceedingOwnedShares) {
        setTradeStatus({ success: false, message: `Cannot sell more than available shares (Available: ${availableShares.toFixed(3)} shares).` });
        return;
      }
      if (parsedShares <= 0) {
        setTradeStatus({ success: false, message: 'Please enter a valid share quantity to sell.' });
        return;
      }
    }

    setIsExecuting(true);
    setTradeStatus(null);

    const isSellingAll = tradeMode === 'SELL' && userPosition && parsedShares >= userPosition.quantity - 0.0001;
    const amountOrShares = tradeMode === 'BUY' 
      ? parsedAmount 
      : (isSellingAll && userPosition ? userPosition.quantity : parsedShares);

    const res = await executeTrade({
      marketId: market.id,
      outcomeId: selectedOutcomeId,
      type: tradeMode,
      amountOrShares,
    });

    setIsExecuting(false);
    setTradeStatus(res);

    if (res.success) {
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.65 },
        colors: ['#10b981', '#3b82f6', '#22c55e'],
      });

      // If sold, reset or update sell input
      if (tradeMode === 'SELL') {
        setSellShares('0');
      }

      if (market.tournamentId) {
        loadUserTournamentParticipant(market.tournamentId)
          .then(setTournamentParticipant)
          .catch(() => {});
      }

      setTimeout(() => {
        setTradeStatus(null);
      }, 4500);
    }
  };

  // If market is not open (closed, resolving, resolved, cancelled), display dedicated lifecycle card
  if (market.status !== 'open') {
    return <MarketLifecycleStateCard market={market} />;
  }

  return (
    <div id="trading-panel" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 elevation-card">
      
      {/* Administrator Trading Prohibited Banner */}
      {isAdmin && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-start gap-2.5 mb-4">
          <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="leading-relaxed">
            <div className="font-bold text-amber-300">Administrative Trading Restricted</div>
            <div className="text-[11px] text-amber-400/90 mt-0.5 font-sans">
              Platform integrity rules prohibit administrative accounts from taking market positions. Switch to a trader account to place orders.
            </div>
          </div>
        </div>
      )}

      {/* Tournament Market Indicator Banner */}
      {isTournamentMarket && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-600/10 to-transparent border border-amber-500/30 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Trophy className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5 flex-wrap">
                  <span>{language === 'es' ? 'Mercado Oficial del Torneo:' : 'Official Tournament Market:'}</span>
                  <span className="text-white underline decoration-amber-500/50">{tournament?.title || 'Torneo'}</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  {isEnrolledInTournament ? (
                    <span className="flex items-center gap-1 text-emerald-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      {language === 'es'
                        ? `Operando con subcartera aislada. Saldo del torneo: $${userBalance.toFixed(2)} USD`
                        : `Operating with isolated subwallet. Tournament balance: $${userBalance.toFixed(2)} USD`}
                    </span>
                  ) : (
                    <span className="text-amber-200">
                      {language === 'es'
                        ? 'Estás viendo un mercado exclusivo de torneo. Inscríbete para recibir saldo y competir.'
                        : 'Official tournament market. Join the tournament to receive your bankroll and compete.'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {!isEnrolledInTournament && !isAdmin && (
              <button
                type="button"
                onClick={() => navigateTo('tournaments')}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-[11px] flex items-center gap-1 btn-tactile cursor-pointer shadow-sm shadow-amber-500/20"
              >
                <span>{language === 'es' ? 'Inscribirse' : 'Join'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Trading Panel Header: Mode Tabs with concentric radius */}
      <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 mb-4">
        <button
          onClick={() => {
            setTradeMode('BUY');
            setTradeStatus(null);
          }}
          className={`flex-1 py-2.5 text-xs font-bold font-mono rounded-lg btn-tactile cursor-pointer ${
            tradeMode === 'BUY'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          BUY
        </button>
        <button
          onClick={() => {
            setTradeMode('SELL');
            setTradeStatus(null);
            // If current selected outcome has no shares, check if user holds shares in another outcome
            const ownedPos = positions.find((p) => p.marketId === market.id && p.status === 'OPEN' && p.quantity > 0.001);
            if (ownedPos && (!userPosition || userPosition.quantity <= 0)) {
              setSelectedOutcomeId(ownedPos.outcomeId);
              setSellShares(ownedPos.quantity.toString());
            } else if (userPosition && userPosition.quantity > 0) {
              setSellShares(userPosition.quantity.toString());
            }
          }}
          className={`flex-1 py-2.5 text-xs font-bold font-mono rounded-lg btn-tactile cursor-pointer ${
            tradeMode === 'SELL'
              ? 'bg-rose-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          SELL
        </button>
      </div>

      {/* Outcome Selector */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="font-medium text-slate-300">Choose Outcome:</span>
          <span className="font-mono text-cyan-400 font-medium tabular-nums">
            Mid: {Math.round((selectedOutcome?.currentPrice || 0.5) * 100)}&cent;
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {market.outcomes.map((outcome) => {
            const isSelected = outcome.id === selectedOutcomeId;
            return (
              <button
                key={outcome.id}
                onClick={() => {
                  setSelectedOutcomeId(outcome.id);
                  setTradeStatus(null);
                }}
                className={`p-3 rounded-xl border text-left btn-tactile cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 border-cyan-500 text-slate-100 shadow-sm ring-1 ring-cyan-500/40'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs truncate text-slate-200">{outcome.name}</div>
                <div className="font-mono text-xs font-bold mt-1 tabular-nums" style={{ color: outcome.color || '#10b981' }}>
                  {tradeMode === 'BUY' ? `${Math.round(outcome.buyPrice * 100)}¢ Ask` : `${Math.round(outcome.sellPrice * 100)}¢ Bid`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input Section */}
      {tradeMode === 'BUY' ? (
        /* BUY INPUT: Cash Amount ($) */
        <div className="mb-4">
          {/* Zero Balance Tournament Callout */}
          {!isAdmin && user && userBalance <= 0 && (
            <div className="mb-3.5 p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0 mt-0.5">
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-200 text-xs">
                    {language === 'es' ? 'Saldo inicial: $0.00 USD' : 'Initial Balance: $0.00 USD'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    {language === 'es'
                      ? 'Las cuentas inician en $0. Inscríbete en un torneo activo para recibir tu capital de prueba asignado y comenzar a operar.'
                      : 'Accounts start with $0. Join an active tournament in the Tournaments Arena to receive your test bankroll.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigateTo('tournaments')}
                    className="mt-2.5 px-3.5 py-1.5 min-h-[34px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-[11px] flex items-center gap-1.5 btn-tactile shadow-sm cursor-pointer"
                  >
                    <span>{language === 'es' ? '🏆 Ir a Torneos' : '🏆 Go to Tournaments'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-medium text-slate-300">Investment Amount:</span>
            <span className="font-mono text-[11px] text-slate-400 flex items-center gap-1.5 tabular-nums">
              <Wallet className="w-3.5 h-3.5 text-slate-500" />
              {isTournamentMarket ? (
                <>
                  {language === 'es' ? 'Saldo Torneo: ' : 'Tournament Bal: '}
                  <span className="text-emerald-400 font-bold">${userBalance.toFixed(2)}</span>
                </>
              ) : (
                <>
                  Available: <span className="text-emerald-400 font-bold">${userBalance.toFixed(2)}</span>
                </>
              )}
            </span>
          </div>

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">$</span>
            <input
              type="number"
              min="1"
              max={userBalance}
              step="1"
              value={dollarAmount}
              onChange={(e) => setDollarAmount(e.target.value)}
              placeholder="0.00"
              className={`w-full bg-slate-950 border rounded-lg pl-8 pr-16 py-2.5 text-base font-mono font-bold text-slate-100 focus:outline-none transition-colors tabular-nums ${
                isInsufficientBalance
                  ? 'border-rose-500 focus:border-rose-500'
                  : 'border-slate-800 focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/20'
              }`}
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500 font-semibold">
              USD
            </span>
          </div>

          {/* Balance error message */}
          {isInsufficientBalance && (
            <div className="mt-1.5 text-[11px] text-rose-400 font-mono flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Insufficient virtual credits (Available: ${userBalance.toFixed(2)})</span>
            </div>
          )}

          {/* Quick Amount Chips */}
          <div className="flex items-center gap-1.5 mt-2.5">
            {['10', '25', '50', '100'].map((amt) => (
              <button
                key={amt}
                onClick={() => setDollarAmount(amt)}
                className="flex-1 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono tabular-nums text-slate-300 btn-tactile cursor-pointer"
              >
                ${amt}
              </button>
            ))}
            <button
              onClick={() => setDollarAmount(Math.floor(userBalance).toString())}
              className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-cyan-400 btn-tactile font-bold cursor-pointer"
            >
              MAX
            </button>
          </div>
        </div>
      ) : (
        /* SELL INPUT: Number of Shares */
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-medium text-slate-300">Shares to Sell:</span>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              Available: <span className="text-emerald-400 font-bold">{availableShares > 0 ? availableShares.toFixed(3) : '0'} shares</span>
            </span>
          </div>

          <div className="relative">
            <input
              type="number"
              min="0.001"
              max={availableShares}
              step="any"
              value={sellShares}
              onChange={(e) => setSellShares(e.target.value)}
              placeholder="0.00"
              className={`w-full bg-slate-950 border rounded-lg px-3.5 py-2.5 text-base font-mono font-bold text-slate-100 focus:outline-none transition-colors tabular-nums ${
                isExceedingOwnedShares
                  ? 'border-rose-500 focus:border-rose-500'
                  : 'border-slate-800 focus:border-rose-500/70 focus:ring-1 focus:ring-rose-500/20'
              }`}
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500 font-semibold">
              SHARES
            </span>
          </div>

          {/* Validation Alerts */}
          {isExceedingOwnedShares && (
            <div className="mt-1.5 text-[11px] text-rose-400 font-mono flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Cannot sell more than available shares (Available: {availableShares.toFixed(3)} shares)</span>
            </div>
          )}

          {isNoPositionToSell && (
            <div className="mt-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300 font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>You do not own any shares of this outcome.</span>
            </div>
          )}

          {/* Quick Percentage Chips */}
          {availableShares > 0 && (
            <div className="mt-2.5 space-y-1.5">
              {availableShares >= 25 && (
                <div className="flex items-center gap-1.5">
                  {[25, 50, 75, 100].filter((sh) => sh <= availableShares).map((sh) => (
                    <button
                      key={`shares-${sh}`}
                      type="button"
                      onClick={() => {
                        setSellShares(sh.toString());
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono tabular-nums text-slate-300 btn-tactile cursor-pointer"
                    >
                      {sh} sh
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5">
                {[
                  { label: '25%', factor: 0.25 },
                  { label: '50%', factor: 0.50 },
                  { label: '75%', factor: 0.75 },
                  { label: '100% ALL', factor: 1.0, isAll: true },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => {
                      if (btn.isAll) {
                        setSellShares(availableShares.toString());
                      } else {
                        setSellShares((availableShares * btn.factor).toFixed(3));
                      }
                    }}
                    className={`py-1.5 rounded-lg border text-[11px] font-mono btn-tactile cursor-pointer tabular-nums ${
                      btn.isAll
                        ? 'flex-[1.5] bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-300 font-bold'
                        : 'flex-1 bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Real-time Order Summary Ticket with Concentric Radius */}
      {quote && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-5 space-y-3 text-xs elevation-card">
          {tradeMode === 'BUY' ? (
            <>
              {/* Highlighted Profit Card */}
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {language === 'es' ? 'Si tu predicción gana, cobras:' : 'Payout if your prediction wins:'}
                  </div>
                  <div className="text-lg font-mono font-extrabold text-emerald-400 mt-0.5 tabular-nums">
                    ${quote.potentialPayout.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-mono text-slate-400">
                    {language === 'es' ? 'Ganancia neta estimada:' : 'Estimated net profit:'}
                  </div>
                  <div className="text-sm font-mono font-bold text-white mt-0.5 flex items-center gap-1 justify-end tabular-nums">
                    <span className="text-emerald-400">+{((quote.potentialProfit / quote.grossAmount) * 100).toFixed(1)}%</span>
                    <span className="text-slate-400 text-xs">(+${quote.potentialProfit.toFixed(2)})</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 font-mono text-xs text-slate-400 tabular-nums">
                <div className="flex items-center justify-between">
                  <span>{language === 'es' ? 'Probabilidad actual:' : 'Implied Probability:'}</span>
                  <span className="text-slate-200 font-bold">{Math.round(quote.marketMidPrice * 100)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{language === 'es' ? 'Precio medio por acción:' : 'Avg. Execution Price:'}</span>
                  <span className="text-slate-200 font-bold">${quote.effectivePricePerShare.toFixed(3)}/sh</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{language === 'es' ? 'Acciones a recibir:' : 'Shares credited:'}</span>
                  <span className="text-cyan-400 font-bold">{quote.shares.toFixed(3)}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{language === 'es' ? 'Comisión y spread incluidos:' : 'Commissions & spread included:'}</span>
                  <span>${(quote.commission + quote.spreadCost).toFixed(2)}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Highlighted Sell Card */}
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {language === 'es' ? 'Efectivo recibido en saldo:' : 'Cash credited to balance:'}
                  </div>
                  <div className="text-lg font-mono font-extrabold text-white mt-0.5 tabular-nums">
                    ${quote.netAmount.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-mono text-slate-400">
                    {language === 'es' ? 'Acciones liquidadas:' : 'Shares liquidated:'}
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-200 mt-0.5 tabular-nums">
                    {quote.shares.toFixed(3)}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 font-mono text-xs text-slate-400 tabular-nums">
                <div className="flex items-center justify-between">
                  <span>{language === 'es' ? 'Precio de venta (Bid):' : 'Sell Price (Bid):'}</span>
                  <span className="text-slate-200 font-bold">${quote.effectivePricePerShare.toFixed(3)}/sh</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{language === 'es' ? 'Comisión y spread retenidos:' : 'Fees & spread deducted:'}</span>
                  <span>${(quote.commission + quote.spreadCost).toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Trade Status Feedback with subtle transition */}
      {tradeStatus && (
        <div
          className={`p-3.5 rounded-xl mb-4 text-xs transition-[opacity,transform] duration-150 shadow-sm ${
            tradeStatus.success
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              {tradeStatus.success ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <div>
                <div className="font-bold text-xs">
                  {tradeStatus.success
                    ? (language === 'es' ? '¡Operación Ejecutada con Éxito!' : 'Order Executed Successfully')
                    : (language === 'es' ? 'Error al Ejecutar la Operación' : 'Trade Execution Failed')}
                </div>
                <div className="text-slate-300 text-[11px] mt-0.5 leading-relaxed text-wrap-pretty">
                  {tradeStatus.message}
                </div>
              </div>
            </div>
            <button
              onClick={() => setTradeStatus(null)}
              className="text-slate-400 hover:text-slate-200 w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-800/60 transition-colors text-[11px] cursor-pointer shrink-0"
              title="Dismiss notification"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Execution Button with tactile press */}
      {tradeMode === 'BUY' ? (
        <button
          onClick={
            isTournamentEnrollmentRequired
              ? () => navigateTo('tournaments')
              : user && userBalance <= 0 && !isAdmin
              ? () => navigateTo('tournaments')
              : handleExecute
          }
          disabled={isAdmin || market.status !== 'open' || (!isTournamentEnrollmentRequired && userBalance > 0 && isBuyDisabled)}
          className={`w-full py-3.5 rounded-xl font-bold font-mono text-sm tracking-wider btn-tactile shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
            isAdmin || market.status !== 'open'
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750'
              : isTournamentEnrollmentRequired
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-amber-500/20 shadow-md'
              : user && userBalance <= 0
              ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-cyan-500/20 shadow-md'
              : isBuyDisabled
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold'
          }`}
        >
          {isExecuting ? (
            <span>{language === 'es' ? 'Ejecutando en el mercado...' : 'Executing via LMSR...'}</span>
          ) : isAdmin ? (
            <span>{language === 'es' ? 'ADMIN NO PUEDE OPERAR' : 'ADMIN TRADING RESTRICTED'}</span>
          ) : isTournamentEnrollmentRequired ? (
            <>
              <Trophy className="w-4 h-4 text-slate-950" />
              <span>{language === 'es' ? '🏆 INSCRIBIRSE AL TORNEO PARA OPERAR' : '🏆 JOIN TOURNAMENT TO TRADE'}</span>
            </>
          ) : user && userBalance <= 0 ? (
            <>
              <Trophy className="w-4 h-4 text-slate-950" />
              <span>{language === 'es' ? '🏆 INSCRIBIRSE A TORNEO PARA OBTENER CAPITAL' : '🏆 JOIN TOURNAMENT TO RECEIVE BANKROLL'}</span>
            </>
          ) : (
            <>
              <span>{language === 'es' ? `APOSTAR POR ${selectedOutcome?.name} ($${parsedAmount.toFixed(2)})` : `BUY ${selectedOutcome?.name} ($${parsedAmount.toFixed(2)})`}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      ) : (
        <button
          onClick={isTournamentEnrollmentRequired ? () => navigateTo('tournaments') : handleExecute}
          disabled={isAdmin || market.status !== 'open' || (!isTournamentEnrollmentRequired && isSellDisabled)}
          className={`w-full py-3.5 rounded-xl font-bold font-mono text-sm tracking-wider btn-tactile shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
            isAdmin || market.status !== 'open'
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750'
              : isTournamentEnrollmentRequired
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-amber-500/20 shadow-md'
              : isSellDisabled
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750'
              : 'bg-rose-600 hover:bg-rose-500 text-white font-semibold'
          }`}
        >
          {isExecuting ? (
            <span>{language === 'es' ? 'Liquidando acciones...' : 'Settling Shares...'}</span>
          ) : isAdmin ? (
            <span>{language === 'es' ? 'ADMIN NO PUEDE OPERAR' : 'ADMIN TRADING RESTRICTED'}</span>
          ) : isTournamentEnrollmentRequired ? (
            <>
              <Trophy className="w-4 h-4 text-slate-950" />
              <span>{language === 'es' ? '🏆 INSCRIBIRSE AL TORNEO PARA OPERAR' : '🏆 JOIN TOURNAMENT TO TRADE'}</span>
            </>
          ) : isNoPositionToSell ? (
            <span>{language === 'es' ? `NO TIENES ACCIONES DE ${selectedOutcome?.name}` : `NO ${selectedOutcome?.name} SHARES OWNED`}</span>
          ) : isExceedingOwnedShares ? (
            <span>{language === 'es' ? `SUPERA EL SALDO (${availableShares.toFixed(3)})` : `EXCEEDS AVAILABLE (${availableShares.toFixed(3)})`}</span>
          ) : isZeroSell ? (
            <span>{language === 'es' ? 'INGRESA CANTIDAD A VENDER' : 'ENTER SHARES TO SELL'}</span>
          ) : (
            <>
              <span>
                {language === 'es' ? `VENDER ${selectedOutcome?.name}` : `SELL ${selectedOutcome?.name}`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      )}

      {/* Position Status Reminder */}
      {userPosition && (
        <div className="mt-4 p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
          <div>
            <div className="text-slate-400 text-[11px]">Your Open Position</div>
            <div className="font-semibold text-slate-200 mt-0.5">
              {userPosition.quantity.toFixed(2)} {selectedOutcome?.name} shares
            </div>
          </div>
          <div className="text-right">
            <div className="text-slate-400 text-[11px]">Current Market Value</div>
            <div className="font-mono font-bold text-emerald-400 text-sm tabular-nums mt-0.5">
              ${userPosition.currentValue.toFixed(2)}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
