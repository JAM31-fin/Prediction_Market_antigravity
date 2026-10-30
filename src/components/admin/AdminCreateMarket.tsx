import React, { useState, useEffect } from 'react';
import { useMarket } from '../../context/MarketContext';
import { MarketType, Category, Outcome } from '../../types';
import { LMSREngine } from '../../services/lmsrEngine';
import { 
  Plus, 
  Trash2, 
  Sparkles, 
  ArrowRight, 
  Check, 
  AlertCircle, 
  ShieldCheck, 
  Cpu,
  Layers,
  HelpCircle,
  Trophy
} from 'lucide-react';

export const AdminCreateMarket: React.FC = () => {
  const { createMarket, setAdminSubView, tournaments, selectedTournamentId } = useMarket();

  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Friends');
  const [assignedTournamentId, setAssignedTournamentId] = useState<string>(selectedTournamentId || '');
  const [marketType, setMarketType] = useState<MarketType>('binary');
  const [closeTime, setCloseTime] = useState(
    new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [resolutionTime, setResolutionTime] = useState(
    new Date(Date.now() + 72 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [resolutionSource, setResolutionSource] = useState('');
  const [resolutionRules, setResolutionRules] = useState('');
  const [liquidityParameter, setLiquidityParameter] = useState<number>(100);
  const [subsidyBudget, setSubsidyBudget] = useState<number>(69.31);
  const [commissionRate, setCommissionRate] = useState<number>(0.01);
  const [spread, setSpread] = useState<number>(0.015);

  // Binary initial probabilities (in percent, sum to 100%)
  const [binaryYesProb, setBinaryYesProb] = useState<number>(50);
  const [binaryNoProb, setBinaryNoProb] = useState<number>(50);

  // Dynamic outcomes for multi/range with percentage (sum to 100%)
  const [customOutcomes, setCustomOutcomes] = useState<
    { name: string; initialProb: number; color: string }[]
  >([
    { name: 'Outcome A', initialProb: 40, color: '#10b981' },
    { name: 'Outcome B', initialProb: 35, color: '#3b82f6' },
    { name: 'Outcome C', initialProb: 25, color: '#f59e0b' },
  ]);

  // Derive current probability distribution vector
  const getCurrentProbs = () => {
    return marketType === 'binary'
      ? [binaryYesProb / 100, binaryNoProb / 100]
      : customOutcomes.map((o) => (Number(o.initialProb) || 1) / 100);
  };

  const handleSubsidyChange = (val: number) => {
    const s = Math.max(1, Math.round(val));
    setSubsidyBudget(s);
    const probs = getCurrentProbs();
    const derivedB = LMSREngine.calculateBFromSubsidy(s, probs);
    setLiquidityParameter(derivedB);
  };

  const handleLiquidityChange = (val: number) => {
    const bVal = Math.max(1, Math.round(val));
    setLiquidityParameter(bVal);
    const probs = getCurrentProbs();
    const derivedLoss = LMSREngine.calculateMaxLoss(bVal, probs);
    setSubsidyBudget(derivedLoss);
  };

  const handleBinaryYesChange = (val: number) => {
    const clamped = Math.max(1, Math.min(99, Math.round(val)));
    setBinaryYesProb(clamped);
    setBinaryNoProb(100 - clamped);
    const probs = [clamped / 100, (100 - clamped) / 100];
    const derivedLoss = LMSREngine.calculateMaxLoss(liquidityParameter, probs);
    setSubsidyBudget(derivedLoss);
  };

  const handleBinaryNoChange = (val: number) => {
    const clamped = Math.max(1, Math.min(99, Math.round(val)));
    setBinaryNoProb(clamped);
    setBinaryYesProb(100 - clamped);
    const probs = [(100 - clamped) / 100, clamped / 100];
    const derivedLoss = LMSREngine.calculateMaxLoss(liquidityParameter, probs);
    setSubsidyBudget(derivedLoss);
  };

  const totalMultiProb = Math.round(customOutcomes.reduce((acc, o) => acc + (Number(o.initialProb) || 0), 0));
  const isMultiProbValid = totalMultiProb === 100;

  const handleNormalizeMultiProbs = () => {
    const total = customOutcomes.reduce((acc, o) => acc + (Number(o.initialProb) || 0), 0);
    if (total <= 0) return;
    let accumulated = 0;
    const normalized = customOutcomes.map((o, idx) => {
      if (idx === customOutcomes.length - 1) {
        return { ...o, initialProb: Math.max(1, 100 - accumulated) };
      }
      const rounded = Math.max(1, Math.round((o.initialProb / total) * 100));
      accumulated += rounded;
      return { ...o, initialProb: rounded };
    });
    setCustomOutcomes(normalized);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add custom outcome
  const handleAddOutcome = () => {
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4'];
    const nextColor = colors[customOutcomes.length % colors.length];
    setCustomOutcomes([
      ...customOutcomes,
      { name: `Outcome ${String.fromCharCode(65 + customOutcomes.length)}`, initialProb: 10, color: nextColor },
    ]);
  };

  // Remove custom outcome
  const handleRemoveOutcome = (index: number) => {
    if (customOutcomes.length <= 2) return;
    setCustomOutcomes(customOutcomes.filter((_, i) => i !== index));
  };

  // Quick preset loader
  const handleLoadPreset = (type: 'friends' | 'weather' | 'fed' | 'bitcoin') => {
    if (type === 'friends') {
      setQuestion('¿Alguien del grupo llegará más de 15 minutos tarde a la próxima salida?');
      setDescription('Predicción grupal sobre la puntualidad en la reunión o salida programada de amigos.');
      setCategory('Friends');
      setMarketType('binary');
      setBinaryYesProb(65);
      setBinaryNoProb(35);
      setResolutionSource('Chat grupal y hora presencial acordada');
      setResolutionRules('Resuelve SÍ a los 15:00 minutos exactos de retraso sobre la hora pactada.');
      setLiquidityParameter(150);
    } else if (type === 'weather') {
      setQuestion('Will precipitation exceed 2.0 mm in Central London tomorrow?');
      setDescription('Contract tracks official Met Office rainfall measurement at St. James Park observation station.');
      setCategory('Weather');
      setMarketType('binary');
      setBinaryYesProb(50);
      setBinaryNoProb(50);
      setResolutionSource('UK Met Office Official Weather Bulletins');
      setResolutionRules('Resolves YES if registered precipitation between 00:00 and 23:59 UTC exceeds 2.0mm. Otherwise resolves NO.');
      setLiquidityParameter(120);
    } else if (type === 'fed') {
      setQuestion('What will be the Federal Reserve policy rate change at the upcoming FOMC?');
      setDescription('Traders forecast the benchmark federal funds target range adjustment.');
      setCategory('Economy');
      setMarketType('multi');
      setResolutionSource('Federal Reserve Board Statement');
      setResolutionRules('Resolves based on the official target range announcement following the FOMC meeting.');
      setCustomOutcomes([
        { name: 'Hold / No Change', initialProb: 55, color: '#10b981' },
        { name: '25 bps Cut', initialProb: 35, color: '#3b82f6' },
        { name: '50+ bps Cut', initialProb: 8, color: '#f59e0b' },
        { name: 'Rate Hike', initialProb: 2, color: '#ef4444' },
      ]);
      setLiquidityParameter(150);
    } else if (type === 'bitcoin') {
      setQuestion('Will Bitcoin reach $150,000 before December 31, 2026?');
      setDescription('Tracks continuous spot index price on major centralized spot exchanges.');
      setCategory('Crypto');
      setMarketType('binary');
      setBinaryYesProb(70);
      setBinaryNoProb(30);
      setResolutionSource('CME CF Bitcoin Reference Rate (BRR)');
      setResolutionRules('Resolves YES if the price index touches or breaches $150,000.00 at any point prior to expiration.');
      setLiquidityParameter(200);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!question.trim()) {
      setError('Please provide a market question.');
      return;
    }
    if (!resolutionSource.trim()) {
      setError('Please provide a resolution authority / oracle source.');
      return;
    }

    if (marketType !== 'binary' && totalMultiProb !== 100) {
      setError(`Multi-outcome initial probabilities must sum to exactly 100% (currently ${totalMultiProb}%). Please click 'Normalize to 100%' or adjust values.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Build outcomes with initial probabilities
    let finalOutcomes: { name: string; initialProb: number; color?: string }[] = [];

    if (marketType === 'binary') {
      finalOutcomes = [
        { name: 'YES', initialProb: binaryYesProb / 100, color: '#10b981' },
        { name: 'NO', initialProb: binaryNoProb / 100, color: '#ef4444' },
      ];
    } else {
      finalOutcomes = customOutcomes.map((o) => ({
        name: o.name,
        initialProb: Number((o.initialProb / 100).toFixed(4)),
        color: o.color,
      }));
    }

    const outcomesToCreate: Outcome[] = finalOutcomes.map((o, idx) => ({
      id: `out-${idx + 1}`,
      name: o.name,
      q: 0,
      initialProbability: o.initialProb,
      initialPrice: o.initialProb,
      currentPrice: o.initialProb,
      buyPrice: Number((o.initialProb + spread / 2).toFixed(4)),
      sellPrice: Number((o.initialProb - spread / 2).toFixed(4)),
      color: o.color,
    }));

    try {
      const newMarket = await createMarket({
        question,
        description,
        category,
        type: marketType,
        status: 'open',
        closeTime: new Date(closeTime).toISOString(),
        resolutionTime: new Date(resolutionTime).toISOString(),
        resolutionSource,
        resolutionRules,
        liquidityParameter,
        subsidyBudget,
        commissionRate,
        spread,
        outcomes: outcomesToCreate,
        tournamentId: assignedTournamentId || undefined,
      });

      setIsSubmitting(false);

      if (newMarket) {
        setAdminSubView('markets');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || 'Failed to create market contract. Please check input parameters.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Create New Prediction Contract
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Deploy an automated LMSR-backed event contract with deterministic liquidity.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto text-xs font-mono flex-wrap">
          <span className="text-slate-500 mr-1">Presets:</span>
          <button
            type="button"
            onClick={() => handleLoadPreset('friends')}
            className="px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 transition-colors font-bold cursor-pointer"
          >
            👥 Reto de Amigos
          </button>
          <button
            type="button"
            onClick={() => handleLoadPreset('weather')}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
          >
            London Rain
          </button>
          <button
            type="button"
            onClick={() => handleLoadPreset('fed')}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
          >
            FOMC Decision
          </button>
          <button
            type="button"
            onClick={() => handleLoadPreset('bitcoin')}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
          >
            BTC $150k
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Creation Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: Core Contract Definition */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
            1. Contract Title & Classification
          </h3>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Market Question / Title: *
            </label>
            <input
              type="text"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Will it rain in Lima tomorrow?"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Detailed Description / Context:
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide background context, market purpose, or specifics for market participants..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Category:
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="Friends">👥 Retos del Grupo (Friends)</option>
                <option value="Sports">⚽ Deportes (Sports)</option>
                <option value="Crypto">🪙 Criptomonedas (Crypto)</option>
                <option value="Economy">📊 Economía & Mercados (Economy)</option>
                <option value="Technology">💻 Tecnología & IA (Technology)</option>
                <option value="Everyday Life">🌱 Vida Cotidiana (Everyday Life)</option>
                <option value="Weather">🌦️ Clima (Weather)</option>
                <option value="Entertainment">🎬 Entretenimiento (Entertainment)</option>
                <option value="Other">Otro (Other)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Vincular a Torneo:</span>
              </label>
              <select
                value={assignedTournamentId}
                onChange={(e) => setAssignedTournamentId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="">🌐 Mercado General (Sin torneo)</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    🏆 {t.title} ({t.status === 'active' ? 'Activo' : t.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Contract Outcome Architecture:
              </label>
              <div className="flex items-center gap-2">
                {(['binary', 'multi', 'range'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMarketType(t)}
                    className={`flex-1 py-2 text-xs font-mono capitalize rounded-lg border transition-colors ${
                      marketType === t
                        ? 'bg-slate-800 text-emerald-400 border-emerald-500 font-bold'
                        : 'bg-slate-950 text-slate-400 border-slate-850 hover:text-slate-200'
                    }`}
                  >
                    {t === 'binary' ? 'Binary (Y/N)' : t === 'multi' ? 'Multi-Outcome' : 'Range Brackets'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Outcomes Specification */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
              2. Contract Outcomes Setup
            </h3>
            {marketType !== 'binary' && (
              <button
                type="button"
                onClick={handleAddOutcome}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-emerald-400 text-xs font-mono flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Outcome</span>
              </button>
            )}
          </div>

          {marketType === 'binary' ? (
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-300 font-bold">
                  Binary Initial Probabilities (Must sum to 100%):
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  Total: {binaryYesProb + binaryNoProb}% (Valid)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold font-mono text-emerald-400">
                      Initial YES probability:
                    </label>
                    <span className="text-xs font-bold text-emerald-300 font-mono">{binaryYesProb}¢ / {binaryYesProb}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={binaryYesProb}
                      onChange={(e) => handleBinaryYesChange(Number(e.target.value) || 50)}
                      className="w-full bg-slate-900 border border-emerald-500/50 rounded px-3 py-1.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-400"
                    />
                    <span className="text-xs font-mono text-slate-400">%</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold font-mono text-rose-400">
                      Initial NO probability:
                    </label>
                    <span className="text-xs font-bold text-rose-300 font-mono">{binaryNoProb}¢ / {binaryNoProb}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={binaryNoProb}
                      onChange={(e) => handleBinaryNoChange(Number(e.target.value) || 50)}
                      className="w-full bg-slate-900 border border-rose-500/50 rounded px-3 py-1.5 text-white font-mono text-sm focus:outline-none focus:border-rose-400"
                    />
                    <span className="text-xs font-mono text-slate-400">%</span>
                  </div>
                </div>
              </div>

              {/* Quick Probability Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono">
                <span className="text-slate-500 text-[11px]">Presets:</span>
                {[
                  { label: '50% / 50%', y: 50 },
                  { label: '60% / 40%', y: 60 },
                  { label: '70% / 30%', y: 70 },
                  { label: '80% / 20%', y: 80 },
                  { label: '90% / 10%', y: 90 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleBinaryYesChange(preset.y)}
                    className={`px-2.5 py-1 rounded border text-[11px] transition-colors ${
                      binaryYesProb === preset.y
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-mono text-slate-300">
                  Outcome probabilities must sum to exactly 100%:
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                      isMultiProbValid
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    Total: {totalMultiProb}% {isMultiProbValid ? '✓' : '(Invalid)'}
                  </span>
                  {!isMultiProbValid && (
                    <button
                      type="button"
                      onClick={handleNormalizeMultiProbs}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-[11px] font-mono transition-colors"
                    >
                      Normalize to 100%
                    </button>
                  )}
                </div>
              </div>

              {customOutcomes.map((outcome, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-950 border border-slate-850 text-xs font-mono"
                >
                  <input
                    type="color"
                    value={outcome.color}
                    onChange={(e) => {
                      const updated = [...customOutcomes];
                      updated[idx].color = e.target.value;
                      setCustomOutcomes(updated);
                    }}
                    className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={outcome.name}
                    onChange={(e) => {
                      const updated = [...customOutcomes];
                      updated[idx].name = e.target.value;
                      setCustomOutcomes(updated);
                    }}
                    placeholder={`Outcome ${idx + 1} Name`}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-sans"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-slate-400 text-xs font-mono">Initial Prob:</span>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={outcome.initialProb}
                      onChange={(e) => {
                        const updated = [...customOutcomes];
                        updated[idx].initialProb = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                        setCustomOutcomes(updated);
                      }}
                      className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-xs text-right font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-slate-400 text-xs font-mono">%</span>
                  </div>
                  {customOutcomes.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOutcome(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors shrink-0"
                      title="Remove outcome"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Settlement Rules & Oracle Source */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
            3. Oracle Source & Resolution Criteria
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Close Trading Date & Time:
              </label>
              <input
                type="datetime-local"
                required
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Resolution Settlement Time:
              </label>
              <input
                type="datetime-local"
                required
                value={resolutionTime}
                onChange={(e) => setResolutionTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Designated Resolution Authority / Oracle: *
            </label>
            <input
              type="text"
              required
              value={resolutionSource}
              onChange={(e) => setResolutionSource(e.target.value)}
              placeholder="e.g. National Weather Service, Bureau of Labor Statistics, Official League Scoreboard"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Explicit Determination Rules:
            </label>
            <textarea
              rows={2}
              value={resolutionRules}
              onChange={(e) => setResolutionRules(e.target.value)}
              placeholder="Exact criteria required to declare each outcome winner. State tie-break or cancellation provisions..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-sans"
            />
          </div>
        </div>

        {/* Section 4: LMSR Mathematical Parameters */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
              4. Algorithmic Liquidity Engine (LMSR)
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              Hanson C(q) Cost Function
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
            <div>
              <label className="block text-slate-300 mb-1 font-bold text-amber-300">
                Presupuesto Subsidio ($ USD):
              </label>
              <input
                type="number"
                min="5"
                max="50000"
                step="5"
                value={subsidyBudget}
                onChange={(e) => handleSubsidyChange(parseFloat(e.target.value) || 50)}
                className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-2 text-amber-300 font-bold focus:outline-none focus:border-amber-400"
              />
              <span className="text-[10px] text-amber-400/80 mt-1 block">
                Tope máximo de riesgo ($S) asumido
              </span>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">
                Liquidity Parameter (b):
              </label>
              <input
                type="number"
                min="1"
                max="5000"
                step="1"
                value={liquidityParameter}
                onChange={(e) => handleLiquidityChange(parseInt(e.target.value) || 100)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-bold focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                b = S / ln(1/p_min)
              </span>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">
                Platform Commission:
              </label>
              <input
                type="number"
                min="0"
                max="0.1"
                step="0.005"
                value={commissionRate}
                onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0.01)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-bold focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Default: 0.01 (1.0% per trade)
              </span>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">
                Execution Spread Margin:
              </label>
              <input
                type="number"
                min="0"
                max="0.1"
                step="0.005"
                value={spread}
                onChange={(e) => setSpread(parseFloat(e.target.value) || 0.015)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-bold focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Default: 0.015 (1.5% dual-sided)
              </span>
            </div>
          </div>
        </div>

        {/* Pre-Creation Market Maker Risk Assessment Summary */}
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-5 space-y-3 font-mono text-xs shadow-md">
          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Market Maker Risk Assessment (Pre-Deployment Summary)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-slate-300">
            <div>
              <span className="text-slate-400">Market: </span>
              <span className="font-bold text-white font-sans">{question.trim() || 'Untitled Contract Question'}</span>
            </div>

            <div>
              <span className="text-slate-400">Outcomes: </span>
              <span className="font-bold text-slate-100">
                {marketType === 'binary' 
                  ? 'YES / NO' 
                  : customOutcomes.map((o) => o.name).join(' / ')}
              </span>
            </div>

            <div>
              <span className="text-slate-400">Initial Probabilities: </span>
              <span className="font-bold text-emerald-400">
                {marketType === 'binary'
                  ? `${binaryYesProb}% / ${binaryNoProb}%`
                  : customOutcomes.map((o) => `${o.initialProb}%`).join(' / ')}
              </span>
            </div>

            <div>
              <span className="text-slate-400">Liquidity Parameter: </span>
              <span className="font-bold text-slate-100">b = {liquidityParameter}</span>
            </div>

            <div>
              <span className="text-slate-400">Allocated Subsidy Budget: </span>
              <span className="font-bold text-amber-400">${subsidyBudget.toFixed(2)} USD</span>
            </div>

            <div>
              <span className="text-slate-400">Theoretical Maximum LMSR Loss: </span>
              <span className="font-bold text-amber-400">
                ${LMSREngine.calculateMaxLoss(liquidityParameter, getCurrentProbs()).toFixed(2)} USD
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-800">
            Formula: <code className="text-amber-300">L_max = b &bull; ln(1 / p_0,min) = S</code> (peor escenario matemático acotado por el subsidio autorizado).
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setAdminSubView('markets')}
            className="px-5 py-2.5 min-h-[38px] rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-mono btn-tactile cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 min-h-[38px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-bold btn-tactile shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Deploying Contract...</span>
            ) : (
              <>
                <span>CREATE PREDICTION MARKET</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  );
};
