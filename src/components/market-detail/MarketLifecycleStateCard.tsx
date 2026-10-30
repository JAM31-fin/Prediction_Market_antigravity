import React, { useState } from 'react';
import { Market, Position } from '../../types';
import { useMarket } from '../../context/MarketContext';
import { 
  Lock, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  ExternalLink, 
  ShieldCheck, 
  Hourglass,
  Layers,
  ShieldAlert
} from 'lucide-react';
import { DisputeCountdownTimer } from '../common/DisputeCountdownTimer';

interface MarketLifecycleStateCardProps {
  market: Market;
}

export const MarketLifecycleStateCard: React.FC<MarketLifecycleStateCardProps> = ({ market }) => {
  const {
    positions,
    trades,
    navigateTo,
    user,
    activeRole,
    disputeMarketResolution,
    finalizeMarketResolution,
  } = useMarket();

  const [isDisputing, setIsDisputing] = useState(false);
  const [disputeReasonInput, setDisputeReasonInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDispute = async () => {
    if (!disputeReasonInput.trim()) return;
    try {
      setActionLoading(true);
      setActionError(null);
      await disputeMarketResolution(market.id, disputeReasonInput.trim());
      setIsDisputing(false);
      setDisputeReasonInput('');
    } catch (err: any) {
      setActionError(err.message || 'Error disputing market');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalize = async () => {
    try {
      setActionLoading(true);
      setActionError(null);
      await finalizeMarketResolution(market.id);
    } catch (err: any) {
      setActionError(err.message || 'Error finalizing market');
    } finally {
      setActionLoading(false);
    }
  };

  // Find all positions (open or settled) for this market
  const marketPositions = positions.filter((p) => p.marketId === market.id);
  const openPositions = marketPositions.filter((p) => p.status === 'OPEN' && p.quantity > 0.0001);

  // Find settlement trade if resolved
  const settlementTrades = trades.filter(
    (t) => t.marketId === market.id && (t.type === 'RESOLUTION' || t.type === 'SETTLEMENT' || t.type === 'REFUND')
  );

  const winningOutcome = market.outcomes.find(
    (o) => o.id === (market.winningOutcomeId || market.resolvedOutcomeId) || o.isWinner
  );

  const formatDateTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  // 1. CLOSED STATE
  if (market.status === 'closed') {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">Market Closed</h3>
            <p className="text-[11px] text-slate-400">Trading operations are halted</p>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-850 space-y-2 text-xs font-mono">
          <div className="flex justify-between text-slate-400">
            <span>Market Status:</span>
            <span className="text-purple-400 font-bold uppercase">CLOSED</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Closed At:</span>
            <span className="text-slate-200">{formatDateTime(market.closeTime)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Trading Status:</span>
            <span className="text-rose-400 font-semibold">BUY & SELL Disabled</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          This market has reached its scheduled close time. No new BUY or SELL orders can be placed. All existing contract positions are preserved and locked awaiting administrator oracle resolution.
        </p>

        {/* Existing Position Visibility */}
        <div className="pt-3 border-t border-slate-800/80">
          <div className="text-[11px] font-mono text-slate-400 uppercase font-bold mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Your Position in this Contract:</span>
          </div>

          {openPositions.length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-850 text-slate-500 text-xs text-center">
              You hold no active shares in this closed market.
            </div>
          ) : (
            <div className="space-y-2">
              {openPositions.map((pos) => (
                <div key={pos.id} className="p-3 rounded-lg bg-slate-950 border border-slate-850 text-xs font-mono">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-200">{pos.outcomeName}</span>
                    <span className="text-emerald-400 font-bold">{pos.quantity.toFixed(3)} Shares</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Invested Cost: ${pos.currentCostBasis.toFixed(2)}</span>
                    <span className="text-purple-400 font-semibold">Locked for Settlement</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. RESOLVING STATE (Optimistic Dispute Window)
  if (market.status === 'resolving') {
    const proposedWinner = market.outcomes.find(
      (o) => o.id === (market.proposedOutcomeId || market.winningOutcomeId || market.resolvedOutcomeId)
    );
    const isUserAdmin = activeRole === 'admin' || user?.role === 'admin';
    const isDisputeWindowActive = Boolean(
      market.disputeDeadline && new Date(market.disputeDeadline).getTime() > Date.now()
    );

    return (
      <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Hourglass className="w-4 h-4 animate-spin" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">
              Resolución Propuesta: {proposedWinner?.name || 'Por Confirmar'}
            </h3>
            <p className="text-[11px] text-amber-400/90 font-mono">Ventana de Disputa Optimista Activa</p>
          </div>
        </div>

        {/* Dispute Window Countdown Card */}
        <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-amber-300 font-bold uppercase text-[10px] tracking-wider">
              Tiempo para Impugnaciones:
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30">
              <DisputeCountdownTimer
                deadline={market.disputeDeadline}
                showIcon={true}
                expiredLabel="Ventana Concluida (Listo para Liquidar)"
              />
            </span>
          </div>
          <div className="text-[11px] text-slate-300 font-sans">
            El resultado preliminar ha sido propuesto. Los saldos <span className="font-bold text-amber-300">NO</span> se transfieren a los ganadores hasta concluir este periodo sin disputas.
          </div>
        </div>

        {/* Proposed Outcome & Proof */}
        <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-850 space-y-2 text-xs font-mono">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Resultado Propuesto:</span>
            <span className="px-2.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
              {proposedWinner?.name || 'YES'} (Pago $1.00 USD)
            </span>
          </div>

          {(market.resolutionProof || market.resolutionSource) && (
            <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-855">
              <span>Fuente / Evidencia:</span>
              <span className="text-slate-200 truncate max-w-[180px] text-right" title={market.resolutionProof || market.resolutionSource}>
                {market.resolutionProof || market.resolutionSource}
              </span>
            </div>
          )}

          <div className="flex justify-between text-slate-400">
            <span>Fin de Ventana:</span>
            <span className="text-slate-200">{formatDateTime(market.disputeDeadline || '')}</span>
          </div>
        </div>

        {/* Admin Quick Action Controls */}
        {isUserAdmin && (
          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2.5">
            <div className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center justify-between">
              <span>Acciones de Operador (Admin)</span>
              <span className="text-amber-400">Válidas durante disputa</span>
            </div>

            {actionError && (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {actionError}
              </div>
            )}

            {!isDisputing ? (
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <button
                  onClick={() => setIsDisputing(true)}
                  disabled={actionLoading}
                  className="px-3 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold transition-colors cursor-pointer text-center"
                >
                  Impugnar Propuesta
                </button>
                <button
                  onClick={handleFinalize}
                  disabled={actionLoading || isDisputeWindowActive}
                  title={isDisputeWindowActive ? "En periodo de disputa activo: Espera el vencimiento del plazo o utiliza el panel de administración." : "Finalizar y liquidar pagos."}
                  className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-colors cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Procesando...' : isDisputeWindowActive ? 'En Espera de Vencimiento' : 'Finalizar Liquidación'}
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  placeholder="Motivo de la impugnación..."
                  value={disputeReasonInput}
                  onChange={(e) => setDisputeReasonInput(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-rose-500/40 text-slate-100 text-xs focus:outline-none focus:border-rose-400"
                />
                <div className="flex justify-end gap-2 text-xs font-mono">
                  <button
                    onClick={() => {
                      setIsDisputing(false);
                      setDisputeReasonInput('');
                    }}
                    className="px-2.5 py-1 rounded text-slate-400 hover:text-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDispute}
                    disabled={actionLoading || !disputeReasonInput.trim()}
                    className="px-3 py-1 rounded bg-rose-500 hover:bg-rose-400 text-white font-bold disabled:opacity-50"
                  >
                    {actionLoading ? 'Revirtiendo...' : 'Confirmar Impugnación'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-slate-400 leading-relaxed">
          El contrato se encuentra congelado. Ninguna orden de compra o venta puede ejecutarse durante la resolución optimista.
        </p>

        {/* Existing Position Visibility */}
        <div className="pt-3 border-t border-slate-800/80">
          <div className="text-[11px] font-mono text-slate-400 uppercase font-bold mb-2">
            Posiciones en Custodia Awaiting Settlement:
          </div>
          {openPositions.length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-850 text-slate-500 text-xs text-center">
              No mantienes posiciones en este contrato.
            </div>
          ) : (
            <div className="space-y-2">
              {openPositions.map((pos) => {
                const isWinningHold = pos.outcomeId === proposedWinner?.id || pos.outcomeName === proposedWinner?.name;
                return (
                  <div key={pos.id} className="p-3 rounded-lg bg-slate-950 border border-slate-850 text-xs font-mono">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-200">{pos.outcomeName}</span>
                      <span className="text-emerald-400 font-bold">{pos.quantity.toFixed(3)} Shares</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Costo: ${pos.currentCostBasis.toFixed(2)}</span>
                      <span className={isWinningHold ? "text-emerald-400 font-semibold" : "text-slate-400"}>
                        {isWinningHold ? `Pago Potencial: $${(pos.quantity * 1.0).toFixed(2)}` : 'Potencial: $0.00'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. RESOLVED STATE
  if (market.status === 'resolved') {
    // Check if user had a winning or losing position
    const winningPosition = marketPositions.find(
      (p) => (p.outcomeId === (market.winningOutcomeId || market.resolvedOutcomeId) || p.outcomeName === winningOutcome?.name)
    );
    const anyUserPosition = marketPositions[0];

    const payoutTrade = settlementTrades.find((t) => t.type === 'RESOLUTION' || t.type === 'SETTLEMENT');
    const totalPayout = payoutTrade ? payoutTrade.amount : (winningPosition ? winningPosition.quantity * 1.0 : 0);

    return (
      <div className="bg-slate-900 border border-blue-500/30 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">Market Resolved</h3>
            <p className="text-[11px] text-slate-400 font-mono">Official final result published</p>
          </div>
        </div>

        {/* Resolution Metadata */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-2.5 text-xs font-mono">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Winning Outcome:</span>
            <span className="px-2.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-sm">
              {winningOutcome ? `${winningOutcome.name} won` : 'YES won'}
            </span>
          </div>

          <div className="flex justify-between text-slate-400">
            <span>Final Result:</span>
            <span className="text-slate-200">1 Winning Share = $1.00 USD</span>
          </div>

          <div className="flex justify-between text-slate-400">
            <span>Resolution Source:</span>
            <span className="text-slate-200 truncate max-w-[180px] text-right" title={market.resolutionSource}>
              {market.resolutionSource}
            </span>
          </div>

          <div className="flex justify-between text-slate-400">
            <span>Resolution Time:</span>
            <span className="text-slate-200">
              {formatDateTime(market.resolutionTime || market.closeTime)}
            </span>
          </div>
        </div>

        {/* User Final Settlement Card */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5 text-xs font-mono">
          <span className="block text-[11px] uppercase font-bold text-slate-300">
            Your Final Settlement Summary:
          </span>

          {anyUserPosition ? (
            <div className="space-y-2 pt-1 border-t border-slate-850">
              <div className="flex justify-between text-slate-400">
                <span>Your Position:</span>
                <span className="text-slate-200 font-bold">
                  {anyUserPosition.quantity.toFixed(3)} {anyUserPosition.outcomeName}
                </span>
              </div>

              {winningPosition ? (
                <>
                  <div className="flex justify-between text-slate-400">
                    <span>Settlement Rate:</span>
                    <span className="text-emerald-400">
                      {winningPosition.quantity.toFixed(3)} shares &times; $1.00
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-200 font-bold text-sm pt-1 border-t border-slate-850">
                    <span>Payout:</span>
                    <span className="text-emerald-400 font-extrabold text-base">
                      +${totalPayout.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-400/90 text-right">
                    &bull; Credited to demo cash balance
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-slate-400">
                    <span>Settlement Rate:</span>
                    <span className="text-slate-400">
                      {anyUserPosition.quantity.toFixed(3)} shares &times; $0.00
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-200 font-bold pt-1 border-t border-slate-850">
                    <span>Payout:</span>
                    <span className="text-rose-400">$0.00 (Contract Expired)</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-slate-400 text-xs py-1">
              You held no shares in this market at time of resolution.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-xs">
          <button
            onClick={() => navigateTo('portfolio')}
            className="text-emerald-400 hover:text-emerald-300 font-mono transition-colors"
          >
            &rarr; View in Portfolio
          </button>
          <button
            onClick={() => navigateTo('history')}
            className="text-slate-400 hover:text-slate-200 font-mono transition-colors"
          >
            &rarr; Ledger History
          </button>
        </div>
      </div>
    );
  }

  // 4. CANCELLED STATE
  if (market.status === 'cancelled') {
    const refundTrade = settlementTrades.find((t) => t.type === 'REFUND');
    const totalRefund = refundTrade ? refundTrade.amount : 0;
    const refundedPosition = marketPositions.find((p) => p.status === 'REFUNDED' || p.status === 'CANCELLED');

    return (
      <div className="bg-slate-900 border border-rose-500/30 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">Market Cancelled</h3>
            <p className="text-[11px] text-rose-400/90 font-mono">Contract voided by governance</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          This market was cancelled by administrator governance. In accordance with platform clearing rules, 100% of all user positions have been returned and refunded to participants' cash balances.
        </p>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-2 text-xs font-mono">
          <div className="flex justify-between text-slate-400">
            <span>Governance Action:</span>
            <span className="text-rose-400 font-bold uppercase">MARKET VOIDED</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Trading:</span>
            <span className="text-slate-300">Permanently Halted</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Refund Policy:</span>
            <span className="text-emerald-400 font-bold">100% Capital Refund</span>
          </div>

          {(refundTrade || refundedPosition) && (
            <div className="pt-2 border-t border-slate-850 space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Refunded Shares:</span>
                <span className="text-slate-200 font-bold">
                  {refundTrade?.quantity.toFixed(3) ?? refundedPosition?.quantity.toFixed(3)} {refundTrade?.outcomeName ?? refundedPosition?.outcomeName}
                </span>
              </div>
              <div className="flex justify-between text-emerald-400 font-bold text-sm">
                <span>Total Refund Credited:</span>
                <span>+${(totalRefund || (refundedPosition?.currentCostBasis ?? 0)).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs">
          <button
            onClick={() => navigateTo('portfolio')}
            className="text-emerald-400 hover:text-emerald-300 font-mono transition-colors"
          >
            &rarr; View Portfolio Balance
          </button>
          <button
            onClick={() => navigateTo('history')}
            className="text-slate-400 hover:text-slate-200 font-mono transition-colors"
          >
            &rarr; View Refund Ledger
          </button>
        </div>
      </div>
    );
  }

  return null;
};
