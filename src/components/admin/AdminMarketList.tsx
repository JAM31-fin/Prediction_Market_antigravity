import React, { useState } from 'react';
import { useMarket } from '../../context/MarketContext';
import { Market, MarketStatus } from '../../types';
import { AdminResolutionModal } from './AdminResolutionModal';
import { AdminEditMarketModal } from './AdminEditMarketModal';
import { AdminCancelMarketModal } from './AdminCancelMarketModal';
import { 
  Search, 
  Play, 
  Pause, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  Plus, 
  Sliders, 
  Filter,
  ArrowUpRight,
  Edit,
  XCircle,
  ShieldAlert,
  Lock,
  Hourglass,
  Trash2
} from 'lucide-react';

export const AdminMarketList: React.FC = () => {
  const { markets, updateMarketStatus, updateMarketLiquidity, setAdminSubView, navigateTo, deleteMarket, clearAllMarkets, purgeGhostTrades } = useMarket();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MarketStatus | 'ALL'>('ALL');
  const [marketToResolve, setMarketToResolve] = useState<Market | null>(null);
  const [marketToEdit, setMarketToEdit] = useState<Market | null>(null);
  const [marketToCancel, setMarketToCancel] = useState<Market | null>(null);
  const [marketToDelete, setMarketToDelete] = useState<Market | null>(null);
  const [isWipingAll, setIsWipingAll] = useState(false);
  const [isPurgingTrades, setIsPurgingTrades] = useState(false);
  const [editingLiquidityId, setEditingLiquidityId] = useState<string | null>(null);
  const [newLiquidityVal, setNewLiquidityVal] = useState<number>(100);

  const filtered = markets.filter((m) => {
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const questionMatch = m.question?.toLowerCase().includes(q);
      const categoryMatch = m.category?.toLowerCase().includes(q);
      if (!questionMatch && !categoryMatch) {
        return false;
      }
    }
    return true;
  });

  const handleSetStatus = async (marketId: string, status: MarketStatus) => {
    await updateMarketStatus(marketId, status);
  };

  const handleTogglePause = async (m: Market) => {
    const nextStatus: MarketStatus = m.status === 'open' ? 'paused' : 'open';
    await updateMarketStatus(m.id, nextStatus);
  };

  const handleCloseMarket = async (m: Market) => {
    await updateMarketStatus(m.id, 'closed');
  };

  const handleSaveLiquidity = async (marketId: string) => {
    await updateMarketLiquidity(marketId, newLiquidityVal);
    setEditingLiquidityId(null);
  };

  return (
    <div className="py-6 space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Market Management Desk
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Monitor state, adjust liquidity parameters, and execute contract settlements.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setIsPurgingTrades(true)}
            className="px-3.5 py-2 min-h-[38px] rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold font-mono text-xs flex items-center gap-1.5 btn-tactile cursor-pointer"
            title="Purge all open trades, positions, and ghost trader counts"
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>PURGE TRADES / RESET</span>
          </button>

          {markets.length > 0 && (
            <button
              onClick={() => setIsWipingAll(true)}
              className="px-3.5 py-2 min-h-[38px] rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold font-mono text-xs flex items-center gap-1.5 btn-tactile cursor-pointer"
              title="Delete all previous markets and reset contracts"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>WIPE ALL MARKETS</span>
            </button>
          )}

          <button
            onClick={() => setAdminSubView('create')}
            className="px-4 py-2 min-h-[38px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 btn-tactile shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>CREATE MARKET</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar with Concentric Radius */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono elevation-card">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {(['ALL', 'open', 'closed', 'resolving', 'resolved', 'cancelled'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 min-h-[34px] rounded-lg btn-tactile font-semibold capitalize cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-950 text-slate-400 border border-slate-855 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contracts..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
          />
        </div>
      </div>

      {/* Markets Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Market Question</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-right">Volume</th>
                <th className="py-3.5 px-4 text-right">Liquidity (b)</th>
                <th className="py-3.5 px-4 text-right">Close Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No markets found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const isOpen = m.status === 'open';
                  const isPaused = m.status === 'paused';
                  const isResolved = m.status === 'resolved';

                  return (
                    <tr key={m.id} className="hover:bg-slate-850/40 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            m.status === 'open'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : m.status === 'closed'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : m.status === 'resolving'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : m.status === 'resolved'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {m.status === 'open' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                          {m.status === 'closed' && <Lock className="w-2.5 h-2.5" />}
                          {m.status === 'resolving' && <Hourglass className="w-2.5 h-2.5 animate-spin" />}
                          {m.status === 'resolved' && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {m.status === 'cancelled' && <AlertTriangle className="w-2.5 h-2.5" />}
                          {m.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-sans font-semibold text-slate-200 max-w-sm">
                        <div className="truncate">{m.question}</div>
                        <div className="text-slate-500 font-mono text-[10px] mt-0.5">
                          {(m.type || (m.outcomes?.length === 2 ? 'binary' : 'multi')).toUpperCase()} &bull; {m.outcomes?.length || 0} outcomes
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {m.category || 'General'}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-200 whitespace-nowrap">
                        ${(m.volume ?? 0).toLocaleString('en-US')}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {editingLiquidityId === m.id ? (
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min="10"
                              max="5000"
                              value={newLiquidityVal}
                              onChange={(e) => setNewLiquidityVal(parseInt(e.target.value) || 100)}
                              className="w-16 bg-slate-950 border border-emerald-500 rounded px-1.5 py-0.5 text-xs text-white"
                            />
                            <button
                              onClick={() => handleSaveLiquidity(m.id)}
                              className="px-1.5 py-0.5 bg-emerald-500 text-slate-950 rounded text-[10px] font-bold"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingLiquidityId(m.id);
                              setNewLiquidityVal(m.liquidityParameter);
                            }}
                            className="text-emerald-400 hover:text-emerald-300 font-bold underline decoration-dotted"
                            title="Click to adjust LMSR liquidity b parameter"
                          >
                            b = {m.liquidityParameter}
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right text-slate-400 whitespace-nowrap">
                        <div title={`Cierre: ${new Date(m.closeTime).toLocaleString()}`}>
                          {m.closeTime ? new Date(m.closeTime).toLocaleDateString() : 'N/A'}
                        </div>
                        {m.resolutionTime && (
                          <div className="text-[10px] text-slate-500 font-mono" title={`Resolución: ${new Date(m.resolutionTime).toLocaleString()}`}>
                            Res: {new Date(m.resolutionTime).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* [OPEN] */}
                          {m.status !== 'open' && m.status !== 'resolved' && m.status !== 'cancelled' && (
                            <button
                              onClick={() => handleSetStatus(m.id, 'open')}
                              className="btn-tactile px-2.5 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono"
                              title="Re-open market trading"
                            >
                              OPEN
                            </button>
                          )}

                          {/* [CLOSE] */}
                          {m.status === 'open' && (
                            <button
                              onClick={() => handleSetStatus(m.id, 'closed')}
                              className="btn-tactile px-2.5 py-1 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-bold font-mono"
                              title="Close market trading"
                            >
                              CLOSE
                            </button>
                          )}

                          {/* [RESOLVE] */}
                          {(m.status === 'open' || m.status === 'closed') && (
                            <button
                              onClick={() => setMarketToResolve(m)}
                              className="btn-tactile px-2.5 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold font-mono"
                              title="Resolve winning outcome & settle payouts"
                            >
                              RESOLVE
                            </button>
                          )}

                          {/* [RESOLVING STATUS / MANAGE] */}
                          {m.status === 'resolving' && (
                            <button
                              onClick={() => setMarketToResolve(m)}
                              className="btn-tactile px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/40 text-[10px] font-bold font-mono"
                              title="Ventana de disputa en curso: Gestionar o finalizar resolución"
                            >
                              RESOLVING...
                            </button>
                          )}

                          {/* [CANCEL] */}
                          {m.status !== 'resolved' && m.status !== 'cancelled' && (
                            <button
                              onClick={() => setMarketToCancel(m)}
                              className="btn-tactile px-2.5 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold font-mono"
                              title="Cancel market & refund all positions"
                            >
                              CANCEL
                            </button>
                          )}

                          {/* Edit Parameters */}
                          <button
                            onClick={() => setMarketToEdit(m)}
                            className="btn-tactile p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 ml-0.5 min-w-[30px] min-h-[30px] flex items-center justify-center"
                            title="Edit Market Parameters"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* View in App */}
                          <button
                            onClick={() => navigateTo('detail', m.id)}
                            className="btn-tactile p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 min-w-[30px] min-h-[30px] flex items-center justify-center"
                            title="View Market Detail Page"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Market */}
                          <button
                            onClick={() => setMarketToDelete(m)}
                            className="btn-tactile p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 min-w-[30px] min-h-[30px] flex items-center justify-center"
                            title="Delete Market Contract"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Single Market Confirmation Modal */}
      {marketToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl elevation-popover">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-lg text-white font-sans text-wrap-balance">Delete Market Contract?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans text-wrap-pretty">
              Are you sure you want to permanently delete <strong className="text-white">"{marketToDelete.question}"</strong>?
              This will remove the contract and any associated open positions from active trading.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2 font-mono text-xs">
              <button
                onClick={() => setMarketToDelete(null)}
                className="btn-tactile px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold min-h-[38px]"
              >
                CANCEL
              </button>
              <button
                onClick={async () => {
                  await deleteMarket(marketToDelete.id);
                  setMarketToDelete(null);
                }}
                className="btn-tactile px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg min-h-[38px]"
              >
                CONFIRM DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wipe All Markets Confirmation Modal */}
      {isWipingAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl elevation-popover">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-lg text-white font-sans text-wrap-balance">Wipe All Previous Markets?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans text-wrap-pretty">
              This will permanently delete all {markets.length} market contracts, clear historical positions and trade records, and reset the platform to a pristine clean state for new contracts.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2 font-mono text-xs">
              <button
                onClick={() => setIsWipingAll(false)}
                className="btn-tactile px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold min-h-[38px]"
              >
                CANCEL
              </button>
              <button
                onClick={async () => {
                  await clearAllMarkets();
                  setIsWipingAll(false);
                }}
                className="btn-tactile px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg min-h-[38px]"
              >
                CONFIRM WIPE ALL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge Trades & Reset Ghost Traders Modal */}
      {isPurgingTrades && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl elevation-popover">
            <div className="flex items-center gap-3 text-amber-400">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-white text-wrap-balance">Purge All Trades & Ghost Traders?</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed text-wrap-pretty">
              This action resets the platform to a clean state:
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 font-mono list-disc pl-5">
              <li>Wipes all open positions and trade records (0 open trades)</li>
              <li>Removes any ghost trader counts from market statistics</li>
              <li>Restores all demo balances to their canonical defaults ($25,000 / $1,000)</li>
              <li>Preserves all canonical markets and contract rules</li>
            </ul>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsPurgingTrades(false)}
                className="btn-tactile px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs min-h-[38px]"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={async () => {
                  await purgeGhostTrades();
                  setIsPurgingTrades(false);
                }}
                className="btn-tactile px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-lg text-xs min-h-[38px]"
              >
                CONFIRM PURGE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Market Parameters Modal */}
      {marketToEdit && (
        <AdminEditMarketModal
          market={marketToEdit}
          onClose={() => setMarketToEdit(null)}
        />
      )}

      {/* Cancel Market Confirmation Modal */}
      {marketToCancel && (
        <AdminCancelMarketModal
          market={marketToCancel}
          onClose={() => setMarketToCancel(null)}
        />
      )}

      {/* Settlement Resolution Modal */}
      {marketToResolve && (
        <AdminResolutionModal
          market={marketToResolve}
          onClose={() => setMarketToResolve(null)}
        />
      )}

    </div>
  );
};
