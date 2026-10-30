import React, { useState, useEffect } from 'react';
import { Market, Category } from '../../types';
import { useMarket } from '../../context/MarketContext';
import { X, Sliders, CheckCircle2, AlertCircle, Lock, ShieldCheck, RefreshCw } from 'lucide-react';

interface AdminEditMarketModalProps {
  market: Market | null;
  onClose: () => void;
}

export const AdminEditMarketModal: React.FC<AdminEditMarketModalProps> = ({ market, onClose }) => {
  const { editMarket } = useMarket();

  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Crypto');
  const [resolutionSource, setResolutionSource] = useState('');
  const [resolutionRules, setResolutionRules] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [resolutionTime, setResolutionTime] = useState('');
  const [liquidityParameter, setLiquidityParameter] = useState<number>(100);
  const [spread, setSpread] = useState<number>(0.02);
  const [commissionRate, setCommissionRate] = useState<number>(0.01);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Editable outcomes for pre-trading phase
  const [editableOutcomes, setEditableOutcomes] = useState<
    { id: string; name: string; initialProb: number; color?: string }[]
  >([]);

  const hasTrades = Boolean(
    market && ((market.volume > 0) || ((market.totalTraders ?? 0) > 0) || ((market.totalTrades ?? 0) > 0))
  );

  const toDateTimeLocal = (isoString?: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    if (market) {
      setQuestion(market.question);
      setDescription(market.description);
      setCategory(market.category);
      setResolutionSource(market.resolutionSource);
      setResolutionRules(market.resolutionRules || '');
      setCloseTime(toDateTimeLocal(market.closeTime));
      setResolutionTime(toDateTimeLocal(market.resolutionTime || market.closeTime));
      setLiquidityParameter(market.liquidityParameter);
      setSpread(market.spread);
      setCommissionRate(market.commissionRate);
      setStatusMessage(null);

      const mappedOutcomes = market.outcomes.map((o) => {
        const prob = o.initialProbability ?? o.initialPrice ?? o.currentPrice;
        return {
          id: o.id,
          name: o.name,
          initialProb: Math.round(prob * 100),
          color: o.color,
        };
      });
      setEditableOutcomes(mappedOutcomes);
    }
  }, [market]);

  if (!market) return null;

  const totalProb = Math.round(
    editableOutcomes.reduce((acc, o) => acc + (Number(o.initialProb) || 0), 0)
  );
  const isProbSumValid = totalProb === 100;

  // Handle binary probability link
  const handleBinaryProbChange = (id: string, val: number) => {
    const clamped = Math.max(1, Math.min(99, Math.round(val)));
    setEditableOutcomes((prev) => {
      const otherId = prev.find((o) => o.id !== id)?.id;
      return prev.map((o) => {
        if (o.id === id) return { ...o, initialProb: clamped };
        if (o.id === otherId) return { ...o, initialProb: 100 - clamped };
        return o;
      });
    });
  };

  const handleNormalizeProbs = () => {
    const total = editableOutcomes.reduce((acc, o) => acc + (Number(o.initialProb) || 0), 0);
    if (total <= 0) return;
    let accumulated = 0;
    const normalized = editableOutcomes.map((o, idx) => {
      if (idx === editableOutcomes.length - 1) {
        return { ...o, initialProb: Math.max(1, 100 - accumulated) };
      }
      const rounded = Math.max(1, Math.round((o.initialProb / total) * 100));
      accumulated += rounded;
      return { ...o, initialProb: rounded };
    });
    setEditableOutcomes(normalized);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setStatusMessage('Question title is required.');
      return;
    }

    if (!hasTrades && !isProbSumValid) {
      setStatusMessage(
        `Initial probabilities must sum to exactly 100% (currently ${totalProb}%). Click 'Normalize to 100%' or adjust values.`
      );
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    const isoClose = closeTime ? new Date(closeTime).toISOString() : market.closeTime;
    const isoResolution = resolutionTime ? new Date(resolutionTime).toISOString() : isoClose;

    try {
      if (hasTrades) {
        // Safe operational parameters only
        await editMarket(market.id, {
          question,
          description,
          category,
          resolutionSource,
          resolutionRules,
          closeTime: isoClose,
          resolutionTime: isoResolution,
        });
      } else {
        // Pre-trading phase: update all parameters and outcomes/probabilities
        await editMarket(market.id, {
          question,
          description,
          category,
          resolutionSource,
          resolutionRules,
          closeTime: isoClose,
          resolutionTime: isoResolution,
          liquidityParameter: Math.max(10, liquidityParameter),
          spread: Math.max(0, spread),
          commissionRate: Math.max(0, commissionRate),
          outcomesUpdates: editableOutcomes.map((o) => ({
            id: o.id,
            name: o.name,
            color: o.color,
            initialProbability: o.initialProb / 100,
          })),
        });
      }

      setIsSaving(false);
      onClose();
    } catch (err: any) {
      setIsSaving(false);
      setStatusMessage(err?.message || 'Failed to update market.');
    }
  };

  const isBinary = market.outcomes.length === 2 && market.type === 'binary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 elevation-popover relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 btn-tactile cursor-pointer"
          aria-label="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Sliders className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-mono uppercase font-bold text-emerald-400">
            MARKET PARAMETERS EDITOR
          </span>
        </div>

        <h3 className="text-base font-bold text-slate-100 mb-3 text-wrap-balance">
          {market.question}
        </h3>

        {/* State Banner: Pre-Trading vs Active Trades */}
        {hasTrades ? (
          <div className="p-3 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-300">Active Trading Locked Parameters</div>
              <div className="text-[11px] text-amber-400/80 mt-0.5">
                Market has ${market.volume.toLocaleString('en-US')} volume and {market.totalTraders} active traders. Initial probabilities, outcomes, and LMSR liquidity parameters are locked to safeguard trader positions. Operational metadata (question, description, close date, oracle source & rules) remain editable.
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-emerald-400">Pre-Trading State (0 Trades Executed)</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                No trades exist yet. You can freely edit initial probabilities, outcome labels, colors, and the LMSR liquidity parameter <span className="font-mono text-emerald-400">b</span> before trading begins.
              </div>
            </div>
          </div>
        )}

        {statusMessage && (
          <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Market Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-sans"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-sans"
            />
          </div>

          {/* Initial Probabilities & Outcomes Section */}
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-850 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-300 font-bold uppercase">
                Initial Outcome Probabilities {hasTrades && '(Locked)'}
              </span>
              {!hasTrades && (
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isProbSumValid
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    Total: {totalProb}% {isProbSumValid ? '✓' : '(Must sum to 100%)'}
                  </span>
                  {!isProbSumValid && (
                    <button
                      type="button"
                      onClick={handleNormalizeProbs}
                      className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-amber-500/30 text-[10px]"
                    >
                      Normalize
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {editableOutcomes.map((outcome) => (
                <div
                  key={outcome.id}
                  className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 ${
                    hasTrades ? 'bg-slate-900/50 border-slate-850 opacity-70' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="color"
                      disabled={hasTrades}
                      value={outcome.color || '#10b981'}
                      onChange={(e) => {
                        setEditableOutcomes((prev) =>
                          prev.map((o) => (o.id === outcome.id ? { ...o, color: e.target.value } : o))
                        );
                      }}
                      className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer disabled:cursor-not-allowed shrink-0"
                    />
                    <input
                      type="text"
                      disabled={hasTrades}
                      value={outcome.name}
                      onChange={(e) => {
                        setEditableOutcomes((prev) =>
                          prev.map((o) => (o.id === outcome.id ? { ...o, name: e.target.value } : o))
                        );
                      }}
                      className="bg-transparent border border-transparent focus:border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-semibold flex-1 disabled:text-slate-400"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-slate-400 text-xs">Initial:</span>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      disabled={hasTrades}
                      value={outcome.initialProb}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        if (isBinary) {
                          handleBinaryProbChange(outcome.id, val);
                        } else {
                          setEditableOutcomes((prev) =>
                            prev.map((o) => (o.id === outcome.id ? { ...o, initialProb: val } : o))
                          );
                        }
                      }}
                      className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 text-xs text-right font-mono disabled:text-slate-400 disabled:bg-slate-900"
                    />
                    <span className="text-slate-400 text-xs">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {['Weather', 'Crypto', 'Economy', 'Technology', 'Sports', 'Entertainment', 'Everyday Life', 'Other'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Cierre de Trading (Close Time)</label>
              <input
                type="datetime-local"
                required
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Fecha Estimada de Resolución (Resolution Time)</label>
            <input
              type="datetime-local"
              required
              value={resolutionTime}
              onChange={(e) => setResolutionTime(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
            />
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              Fecha en la que la autoridad u oráculo verificará el resultado oficial para liquidar los pagos.
            </p>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Resolution Source Authority</label>
            <input
              type="text"
              value={resolutionSource}
              onChange={(e) => setResolutionSource(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-sans"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Resolution Rules</label>
            <input
              type="text"
              value={resolutionRules}
              onChange={(e) => setResolutionRules(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-sans"
              placeholder="Exact settlement criteria"
            />
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-850 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-bold uppercase text-[10px]">LMSR Market Making Engine</span>
              {hasTrades && (
                <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Locked by Active Trades
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Liquidity b</label>
                <input
                  type="number"
                  min="10"
                  max="10000"
                  disabled={hasTrades}
                  value={liquidityParameter}
                  onChange={(e) => setLiquidityParameter(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-xs font-bold disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Spread (Bid/Ask)</label>
                <input
                  type="number"
                  step="0.005"
                  min="0"
                  max="0.2"
                  disabled={hasTrades}
                  value={spread}
                  onChange={(e) => setSpread(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-xs font-bold disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Commission</label>
                <input
                  type="number"
                  step="0.005"
                  min="0"
                  max="0.1"
                  disabled={hasTrades}
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-xs font-bold disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 min-h-[38px] rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-mono btn-tactile cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 min-h-[38px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono btn-tactile shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Parameters'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
