import React, { useState } from 'react';
import { Market } from '../../types';
import { useMarket } from '../../context/MarketContext';
import { X, AlertTriangle, ShieldAlert } from 'lucide-react';

interface AdminCancelMarketModalProps {
  market: Market | null;
  onClose: () => void;
}

export const AdminCancelMarketModal: React.FC<AdminCancelMarketModalProps> = ({ market, onClose }) => {
  const { cancelMarket, positions } = useMarket();
  const [isCancelling, setIsCancelling] = useState(false);

  if (!market) return null;

  // Calculate refund amount for this market
  const marketPositions = positions.filter((p) => p.marketId === market.id && p.status === 'OPEN');
  const totalCostBasisRefund = marketPositions.reduce((sum, p) => sum + p.currentCostBasis, 0);

  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    await cancelMarket(market.id);
    setIsCancelling(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-rose-500/30 rounded-2xl max-w-md w-full p-6 elevation-popover relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 btn-tactile cursor-pointer"
          aria-label="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2 text-rose-400">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span className="text-xs font-mono uppercase font-bold">
            CANCEL & REFUND MARKET
          </span>
        </div>

        <h3 className="text-base font-bold text-slate-100 mb-2 leading-snug text-wrap-balance">
          Cancel "{market.question}"?
        </h3>

        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs mb-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <p>
              Cancelling a market voids all active shares and refunds the full initial invested cost basis to all traders.
            </p>
          </div>
          {totalCostBasisRefund > 0 && (
            <div className="text-[11px] font-mono text-slate-300 pt-1 border-t border-rose-500/20">
              Estimated refund to active demo account:{' '}
              <span className="font-bold text-emerald-400">${totalCostBasisRefund.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 min-h-[38px] rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-mono btn-tactile cursor-pointer"
          >
            Keep Market Active
          </button>
          <button
            onClick={handleConfirmCancel}
            disabled={isCancelling}
            className="flex-1 py-2.5 min-h-[38px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs btn-tactile shadow-md disabled:opacity-50 cursor-pointer"
          >
            {isCancelling ? 'Processing...' : 'Confirm Void & Refund'}
          </button>
        </div>
      </div>
    </div>
  );
};
