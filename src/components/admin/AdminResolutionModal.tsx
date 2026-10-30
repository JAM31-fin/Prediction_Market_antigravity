import React, { useState, useEffect, useMemo } from 'react';
import { Market } from '../../types';
import { useMarket } from '../../context/MarketContext';
import { LMSREngine } from '../../services/lmsrEngine';
import { CheckCircle2, AlertTriangle, X, ShieldCheck, ArrowRight, Clock, AlertOctagon, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';

interface AdminResolutionModalProps {
  market: Market | null;
  onClose: () => void;
}

export const AdminResolutionModal: React.FC<AdminResolutionModalProps> = ({ market, onClose }) => {
  const { resolveMarket, disputeMarketResolution, finalizeMarketResolution, allPositions, allTrades } = useMarket();

  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>(
    market?.proposedOutcomeId || market?.outcomes[0]?.id || ''
  );
  const [resolutionProof, setResolutionProof] = useState<string>(market?.resolutionProof || '');
  const [disputeWindowSeconds, setDisputeWindowSeconds] = useState<number>(300); // 5 min default
  const [immediateResolution, setImmediateResolution] = useState<boolean>(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Countdown timer for resolving status
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isDeadlinePassed, setIsDeadlinePassed] = useState<boolean>(false);

  useEffect(() => {
    if (!market?.disputeDeadline || market.status !== 'resolving') {
      setTimeLeft('');
      setIsDeadlinePassed(false);
      return;
    }

    const updateTimer = () => {
      const diffMs = new Date(market.disputeDeadline!).getTime() - Date.now();
      if (diffMs <= 0) {
        setTimeLeft('00:00 (Ventana Vencida)');
        setIsDeadlinePassed(true);
      } else {
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        setTimeLeft(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
        setIsDeadlinePassed(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [market?.disputeDeadline, market?.status]);

  useEffect(() => {
    if (market && market.outcomes.length > 0) {
      setSelectedOutcomeId(market.proposedOutcomeId || market.outcomes[0].id);
      setResolutionProof(market.resolutionProof || '');
      setError(null);
    }
  }, [market]);

  if (!market) return null;

  const isResolvingState = market.status === 'resolving';

  // Calculate settlement impact across all trader positions
  const relevantPositions = (allPositions || []).filter((p) => p.marketId === market.id && p.status === 'OPEN');
  const winningPositions = relevantPositions.filter((p) => p.outcomeId === selectedOutcomeId);
  const totalWinningShares = winningPositions.reduce((acc, p) => acc + p.quantity, 0);
  const totalPayout = totalWinningShares * 1.0;

  // LMSR Cash Flow & Resulting Platform P&L
  const b = market.liquidityParameter || 100;
  const currentQ: Record<string, number> = {};
  market.outcomes.forEach((o) => { currentQ[o.id] = o.q; });
  const initQ = market.initialQuantities ?? LMSREngine.calculateInitialQuantities(market.initialProbabilities || {}, b);
  const cCur = LMSREngine.cost(currentQ, b);
  const cInit = LMSREngine.cost(initQ, b);
  const lmsrCashFlow = market.cumulativeLmsrCashFlow !== undefined ? market.cumulativeLmsrCashFlow : (cCur - cInit);

  const marketTrades = (allTrades || []).filter((t) => t.marketId === market.id && (t.type === 'BUY' || t.type === 'SELL'));
  const totalCommissions = marketTrades.reduce((acc, t) => acc + (t.fee || 0), 0);
  const totalSpreads = marketTrades.reduce((acc, t) => acc + (t.spreadFee || 0), 0);
  const totalFees = totalCommissions + totalSpreads;

  const mmPnL = lmsrCashFlow - totalPayout;
  const platformNetResult = mmPnL + totalFees;

  const selectedOutcome = market.outcomes.find((o) => o.id === selectedOutcomeId);

  const handleProposeResolution = async () => {
    if (!selectedOutcomeId) return;
    setIsResolving(true);
    setError(null);

    const res = await resolveMarket(market.id, selectedOutcomeId, {
      resolutionProof,
      disputeWindowSeconds: immediateResolution ? 0 : disputeWindowSeconds,
    });
    setIsResolving(false);

    if (res && res.success) {
      if (immediateResolution) {
        try {
          confetti({
            particleCount: 50,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch {}
      }
      onClose();
    } else {
      setError(res?.error || 'Market resolution could not be completed. Please check the network.');
    }
  };

  const handleDispute = async () => {
    setIsResolving(true);
    setError(null);

    const res = await disputeMarketResolution(market.id, 'Impugnado por el operador administrativo.');
    setIsResolving(false);

    if (res && res.success) {
      onClose();
    } else {
      setError(res?.error || 'Failed to dispute resolution.');
    }
  };

  const handleFinalize = async () => {
    setIsResolving(true);
    setError(null);

    const res = await finalizeMarketResolution(market.id, true);
    setIsResolving(false);

    if (res && res.success) {
      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}
      onClose();
    } else {
      setError(res?.error || 'Failed to finalize resolution.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 elevation-popover relative max-h-[90vh] overflow-y-auto">
        
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 btn-tactile cursor-pointer"
          aria-label="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-xs font-mono uppercase font-bold text-amber-400">
            {isResolvingState ? 'VENTANA OPTIMISTA EN CURSO' : 'OPERATOR SETTLEMENT DESK'}
          </span>
        </div>

        <h3 className="text-base font-bold text-slate-100 mb-1 leading-snug text-wrap-balance">
          {market.question}
        </h3>
        <p className="text-xs text-slate-400 mb-4 font-mono">
          Designated Authority: <span className="text-slate-200">{market.resolutionSource}</span>
        </p>

        {/* ACTIVE RESOLVING BANNER */}
        {isResolvingState ? (
          <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs mb-5 space-y-2">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Tiempo Restante de Disputa:</span>
              </span>
              <span className="font-mono text-sm px-2 py-0.5 rounded bg-amber-950 border border-amber-500/40 text-amber-300">
                {timeLeft || 'Calculando...'}
              </span>
            </div>
            <div className="text-slate-300 leading-relaxed text-[11px]">
              El resultado propuesto es <span className="font-bold text-emerald-400">{selectedOutcome?.name}</span>. Durante este período los saldos permanecen protegidos y no han sido distribuidos.
            </div>
            {market.resolutionProof && (
              <div className="text-[11px] text-slate-400 font-mono">
                Evidencia: <span className="text-slate-200">{market.resolutionProof}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5 mb-5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div className="leading-relaxed text-wrap-pretty text-[11px]">
              <span className="font-bold">Protocolo Optimista: </span>
              Al proponer una resolución, se abrirá una ventana de disputa temporal antes de liberar los saldos. Las posiciones permanecen seguras en escrow.
            </div>
          </div>
        )}

        {/* Choose Winning Outcome */}
        <div className="mb-5">
          <label className="block text-xs font-mono text-slate-300 mb-2 font-semibold">
            {isResolvingState ? 'Resultado Propuesto Actualmente:' : 'Seleccionar Resultado Ganador:'}
          </label>
          <div className="space-y-2">
            {market.outcomes.map((outcome) => {
              const isSelected = outcome.id === selectedOutcomeId;
              return (
                <div
                  key={outcome.id}
                  onClick={() => !isResolvingState && setSelectedOutcomeId(outcome.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    !isResolvingState ? 'cursor-pointer btn-tactile' : 'opacity-85'
                  } ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500 text-slate-100 ring-1 ring-emerald-500/40'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-emerald-400 bg-emerald-500' : 'border-slate-600'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </div>
                    <span className="font-bold text-xs">{outcome.name}</span>
                  </div>
                  <span className="font-mono text-xs text-slate-400 tabular-nums">
                    Last price: {Math.round(outcome.currentPrice * 100)}&cent;
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Settlement Impact Breakdown */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 mb-5 font-mono text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span>Winning Outcome:</span>
            <span className="text-emerald-400 font-bold">{selectedOutcome?.name}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Outstanding Winning Shares:</span>
            <span className="text-slate-200">{totalWinningShares.toFixed(2)} shares</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Total Settlement Payout ($1/share):</span>
            <span className="text-emerald-400 font-bold">${totalPayout.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Net LMSR Cash Flow:</span>
            <span className="text-slate-200">${lmsrCashFlow.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Fees Collected (Comm + Spread):</span>
            <span className="text-slate-200">+${totalFees.toFixed(2)}</span>
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between font-bold">
            <span className="text-slate-200">Resulting Platform Net P&L:</span>
            <span className={platformNetResult >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {platformNetResult >= 0 ? '+' : ''}${platformNetResult.toFixed(2)}
            </span>
          </div>
        </div>

        {!isResolvingState && (
          <>
            {/* Dispute Window Configuration */}
            <div className="mb-4">
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Ventana de Disputa Optimista:
              </label>
              <select
                disabled={immediateResolution}
                value={disputeWindowSeconds}
                onChange={(e) => setDisputeWindowSeconds(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono disabled:opacity-50"
              >
                <option value={60}>1 minuto (Test ultrarrápido)</option>
                <option value={300}>5 minutos (Demo oficial blindada - recomendado)</option>
                <option value={1800}>30 minutos (Modo evento)</option>
                <option value={43200}>12 horas (Entorno productivo)</option>
              </select>
            </div>

            {/* Optional Oracle Reference / Proof URL */}
            <div className="mb-4">
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Oracle Verification URL / Reference Note:
              </label>
              <input
                type="text"
                value={resolutionProof}
                onChange={(e) => setResolutionProof(e.target.value)}
                placeholder="e.g. Official bulletin link or report confirmation ID"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-sans"
              />
            </div>

            {/* Bypass Dispute Window (Emergency direct resolution) */}
            <div className="mb-5 flex items-center gap-2">
              <input
                type="checkbox"
                id="immRes"
                checked={immediateResolution}
                onChange={(e) => setImmediateResolution(e.target.checked)}
                className="rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="immRes" className="text-[11px] font-mono text-slate-400 cursor-pointer">
                Liquidación inmediata (sin ventana de disputa previa)
              </label>
            </div>
          </>
        )}

        {/* Error Notification */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        {isResolvingState ? (
          <div className="flex items-center gap-3">
            <button
              onClick={handleDispute}
              disabled={isResolving}
              className="flex-1 py-2.5 min-h-[38px] rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-mono font-bold btn-tactile flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4 text-rose-400" />
              <span>IMPUGNAR RESOLUCIÓN</span>
            </button>
            <button
              onClick={handleFinalize}
              disabled={isResolving}
              className="flex-1 py-2.5 min-h-[38px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-bold btn-tactile flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isResolving ? (
                <span>Liquidando...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>FINALIZAR AHORA</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 min-h-[38px] rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-mono btn-tactile cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleProposeResolution}
              disabled={isResolving}
              className="flex-1 py-2.5 min-h-[38px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-bold btn-tactile flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isResolving ? (
                <span>Procesando...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{immediateResolution ? 'CONFIRMAR SETTLEMENT' : 'PROPONER RESOLUCIÓN'}</span>
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
