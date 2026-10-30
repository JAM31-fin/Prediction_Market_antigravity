import React, { useState, useMemo, useEffect } from 'react';
import { Position } from '../../types';
import { useMarket } from '../../context/MarketContext';
import { LMSREngine } from '../../services/lmsrEngine';
import { X, ArrowRight, TrendingUp, TrendingDown, Check, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PartialSellModalProps {
  position: Position | null;
  onClose: () => void;
}

export const PartialSellModal: React.FC<PartialSellModalProps> = ({ position, onClose }) => {
  const { markets, partialSellPosition } = useMarket();

  const [sharesToSell, setSharesToSell] = useState<string>(
    position ? Math.min(position.quantity, 25).toString() : '0'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (position) {
      setSharesToSell(Math.min(position.quantity, 25).toString());
      setError(null);
    }
  }, [position]);

  const market = useMemo(() => {
    if (!position) return null;
    return markets.find((m) => m.id === position.marketId) || null;
  }, [markets, position]);

  const parsedShares = parseFloat(sharesToSell) || 0;

  // Compute live sell quotation
  const quote = useMemo(() => {
    if (!market || !position || parsedShares <= 0) return null;
    const quantities: Record<string, number> = {};
    market.outcomes.forEach((o) => {
      quantities[o.id] = o.q;
    });

    try {
      return LMSREngine.getTradeQuote(
        quantities,
        position.outcomeId,
        'SELL',
        parsedShares,
        market.liquidityParameter,
        market.commissionRate,
        market.spread
      );
    } catch {
      return null;
    }
  }, [market, position, parsedShares]);

  if (!position) return null;

  const isAll = parsedShares >= position.quantity - 0.0001;
  const costBasisPortion = isAll ? position.currentCostBasis : Number((parsedShares * position.averagePrice).toFixed(2));
  const estimatedPnL = quote ? Number((quote.netAmount - costBasisPortion).toFixed(2)) : 0;

  const handleSell = async () => {
    if (parsedShares <= 0 || parsedShares > position.quantity + 0.00001) {
      setError(`Please enter a valid share quantity between 0 and ${position.quantity.toFixed(3)}.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // If selling all, pass exact position quantity
    const sharesToExecute = isAll ? position.quantity : parsedShares;
    const success = await partialSellPosition(position, sharesToExecute);
    setIsSubmitting(false);

    if (success) {
      confetti({
        particleCount: 25,
        spread: 50,
        origin: { y: 0.7 },
      });
      onClose();
    } else {
      setError('Sell order execution failed. Please check liquidity state.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-4">
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">
            LIQUIDATE POSITION
          </span>
          <h3 className="text-base font-bold text-slate-100 mt-2 line-clamp-2">
            {position.marketQuestion}
          </h3>
          <div className="text-xs text-slate-400 mt-1 font-mono">
            Selling: <span className="text-emerald-400 font-bold">{position.outcomeName}</span> &bull; Available:{' '}
            <span className="text-slate-100 font-bold">{position.quantity.toFixed(3)} shares</span>
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-1 font-mono">
            Shares to Liquidate:
          </label>
          <div className="relative">
            <input
              type="number"
              min="0.001"
              max={position.quantity}
              step="any"
              value={sharesToSell}
              onChange={(e) => setSharesToSell(e.target.value)}
              className={`w-full bg-slate-950 border rounded-lg px-3 py-2.5 text-base font-mono font-bold text-slate-100 focus:outline-none ${
                parsedShares > position.quantity + 0.00001
                  ? 'border-rose-500 focus:border-rose-500'
                  : 'border-slate-800 focus:border-rose-500'
              }`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
              SHARES
            </span>
          </div>

          {parsedShares > position.quantity + 0.00001 && (
            <div className="mt-1.5 text-[11px] text-rose-400 font-mono flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Cannot sell more than available ({position.quantity.toFixed(3)} shares)</span>
            </div>
          )}

          {/* Quick Percentage Chips & Direct Share Chips */}
          <div className="mt-2.5 space-y-1.5">
            {position.quantity >= 25 && (
              <div className="flex items-center gap-1.5">
                {[25, 50, 75, 100].filter((s) => s <= position.quantity).map((s) => (
                  <button
                    key={`qty-${s}`}
                    type="button"
                    onClick={() => {
                      if (s === position.quantity) {
                        setSharesToSell(position.quantity.toString());
                      } else {
                        setSharesToSell(s.toString());
                      }
                    }}
                    className="flex-1 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 transition-colors"
                  >
                    {s} shares
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5">
              {[
                { label: '25%', factor: 0.25 },
                { label: '50%', factor: 0.50 },
                { label: '75%', factor: 0.75 },
                { label: '100%', factor: 1.0, isAllBtn: true },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => {
                    if (btn.isAllBtn) {
                      setSharesToSell(position.quantity.toString());
                    } else {
                      setSharesToSell((position.quantity * btn.factor).toFixed(3));
                    }
                  }}
                  className={`py-1 rounded border text-[11px] font-mono transition-colors ${
                    btn.isAllBtn
                      ? 'flex-[1.5] bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-300 font-bold'
                      : 'flex-1 bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Execution Breakdown */}
        {quote && (
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3.5 mb-5 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-slate-400">
              <span>Avg Entry Price:</span>
              <span className="text-slate-300">${position.averagePrice.toFixed(3)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span>Execution Bid Price:</span>
              <span className="text-slate-300">${quote.effectivePricePerShare.toFixed(3)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span>Platform Commission (1%):</span>
              <span className="text-slate-400">${quote.commission.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span>Execution Spread:</span>
              <span className="text-slate-400">${quote.spreadCost.toFixed(2)}</span>
            </div>

            <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-slate-200">
              <span className="font-bold">Net Cash Proceeds:</span>
              <span className="text-emerald-400 font-bold text-sm">${quote.netAmount.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Realized P&L on Sale:</span>
              <span className={`font-bold ${estimatedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {estimatedPnL >= 0 ? '+' : ''}${estimatedPnL.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg mb-4 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-mono transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSell}
            disabled={isSubmitting || parsedShares <= 0 || parsedShares > position.quantity}
            className={`flex-1 py-2.5 rounded-lg font-mono font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
              isSubmitting || parsedShares <= 0 || parsedShares > position.quantity
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-rose-500 hover:bg-rose-400 text-white shadow-md'
            }`}
          >
            {isSubmitting ? (
              <span>Executing...</span>
            ) : (
              <>
                <span>CONFIRM SELL</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
