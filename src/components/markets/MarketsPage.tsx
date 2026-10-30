import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useMarket } from '../../context/MarketContext';
import { useLanguage } from '../../context/LanguageContext';
import { getLocalizedMarket } from '../../i18n/marketTranslations';
import { MarketCard } from '../home/MarketCard';
import { CategoryFilter } from '../home/CategoryFilter';
import { MarketType, MarketStatus } from '../../types';
import { 
  Search, 
  Grid, 
  List, 
  ArrowUpDown, 
  Clock, 
  X,
  SlidersHorizontal,
  ArrowUpRight
} from 'lucide-react';

export const MarketsPage: React.FC = () => {
  const { markets, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory, navigateTo } = useMarket();
  const { language } = useLanguage();

  const [selectedType, setSelectedType] = useState<MarketType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<MarketStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'trending' | 'volume' | 'closing' | 'newest'>('trending');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Localize markets for display and search
  const localizedMarkets = markets.map((m) => getLocalizedMarket(m, language));

  // Apply filters
  const filteredMarkets = localizedMarkets.filter((m) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesQ = m.question.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        (m.tags && m.tags.some((t) => t.toLowerCase().includes(q)));
      if (!matchesQ) return false;
    }

    // Category
    if (selectedCategory !== 'All' && m.category !== selectedCategory) {
      return false;
    }

    // Market Type
    const marketType = m.type || (m.outcomes && m.outcomes.length === 2 ? 'binary' : 'multi');
    if (selectedType !== 'all' && marketType !== selectedType) {
      return false;
    }

    // Status
    if (selectedStatus !== 'all' && m.status !== selectedStatus) {
      return false;
    }

    return true;
  });

  // Apply Sorting
  const sortedMarkets = [...filteredMarkets].sort((a, b) => {
    if (sortBy === 'trending') {
      return b.totalTraders - a.totalTraders;
    }
    if (sortBy === 'volume') {
      return b.volume - a.volume;
    }
    if (sortBy === 'closing') {
      return new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime();
    }
    if (sortBy === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-wrap-balance">
            {language === 'es' ? 'Mercados de Predicción' : 'Prediction Markets'}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 text-wrap-pretty">
            {language === 'es'
              ? 'Explora y opera contratos de predicción con liquidez matemática garantizada.'
              : 'Explore and trade centralized prediction contracts with deterministic LMSR liquidity pricing.'}
          </p>
        </div>

        {/* View Mode Toggle with Concentric Radius */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg btn-tactile cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center ${
                viewMode === 'grid' ? 'bg-slate-800 text-cyan-400 font-bold shadow-sm' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg btn-tactile cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center ${
                viewMode === 'list' ? 'bg-slate-800 text-cyan-400 font-bold shadow-sm' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar with Concentric Radius */}
      <div className="space-y-4 mb-8 bg-slate-900 border border-slate-800 p-5 rounded-2xl elevation-card">
        
        {/* Search & Sort Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2 group">
            <Search className="w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'es' ? 'Buscar por palabra clave, reto o pregunta...' : 'Search by keyword, asset, or question...'}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/20 transition-[border-color,box-shadow] duration-150 ease-out"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium shrink-0 flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              {language === 'es' ? 'Orden:' : 'Sort:'}
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/70 font-mono cursor-pointer"
            >
              <option value="trending">{language === 'es' ? 'En Tendencia (Participantes)' : 'Trending (Traders)'}</option>
              <option value="volume">{language === 'es' ? 'Mayor Volumen ($)' : 'Highest Volume ($)'}</option>
              <option value="closing">{language === 'es' ? 'Por Finalizar' : 'Closing Soon'}</option>
              <option value="newest">{language === 'es' ? 'Más Nuevos' : 'Newest First'}</option>
            </select>
          </div>
        </div>

        {/* Secondary Filter: Category Pills */}
        <CategoryFilter showCounts={false} />

        {/* Market Type & Status Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
          
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-mono text-[11px]">{language === 'es' ? 'Tipo:' : 'Type:'}</span>
            {([
              { id: 'all', label: language === 'es' ? 'Todos' : 'All Types' },
              { id: 'binary', label: language === 'es' ? 'Binarios' : 'Binary' },
              { id: 'multi', label: language === 'es' ? 'Múltiples' : 'Categorical' },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono btn-tactile cursor-pointer ${
                  selectedType === t.id
                    ? 'bg-slate-800 text-white border border-slate-700 font-semibold shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-mono text-[11px]">{language === 'es' ? 'Estado:' : 'Status:'}</span>
            {([
              { id: 'all', label: language === 'es' ? 'Todos' : 'All' },
              { id: 'open', label: language === 'es' ? 'Abiertos' : 'Open' },
              { id: 'closed', label: language === 'es' ? 'Cerrados' : 'Closed' },
              { id: 'resolved', label: language === 'es' ? 'Resueltos' : 'Resolved' },
            ] as const).map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStatus(s.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono btn-tactile cursor-pointer ${
                  selectedStatus === s.id
                    ? 'bg-slate-800 text-white border border-slate-700 font-semibold shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

        </div>

      </div>

      {/* Results Count & Reset Filter */}
      <div className="flex items-center justify-between mb-5 text-xs text-slate-400 font-mono tabular-nums">
        <span>
          {language === 'es'
            ? <>Mostrando <span className="text-white font-bold">{sortedMarkets.length}</span> de {markets.length} contratos</>
            : <>Showing <span className="text-white font-bold">{sortedMarkets.length}</span> of {markets.length} contracts</>}
        </span>
        {(searchQuery || selectedCategory !== 'All' || selectedType !== 'all' || selectedStatus !== 'all') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setSelectedType('all');
              setSelectedStatus('all');
            }}
            className="text-emerald-400 hover:text-emerald-300 font-sans font-semibold cursor-pointer transition-colors"
          >
            {language === 'es' ? 'Limpiar todos los filtros' : 'Clear all filters'}
          </button>
        )}
      </div>

      {/* Markets Content */}
      {sortedMarkets.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-white/[0.06] flex flex-col items-center justify-center backdrop-blur-md">
          <p className="text-slate-300 font-semibold text-sm">
            {language === 'es' ? 'No se encontraron mercados con los criterios actuales.' : 'No prediction markets match your current criteria.'}
          </p>
          <p className="text-slate-500 text-xs mt-1">
            {language === 'es' ? 'Intenta relajar los filtros o buscar con otras palabras.' : 'Try relaxing filters or search with different keywords.'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setSelectedType('all');
              setSelectedStatus('all');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-xs font-semibold transition-colors shadow-sm cursor-pointer"
          >
            {language === 'es' ? 'Restablecer filtros' : 'Reset all filters'}
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedMarkets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      ) : (
        /* Detailed List View */
        <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800 overflow-hidden shadow-sm">
          {sortedMarkets.map((m) => {
            const isBinary = (m.type || (m.outcomes && m.outcomes.length === 2 ? 'binary' : 'multi')) === 'binary';
            const yes = isBinary
              ? m.outcomes.find((o) => o.id.toLowerCase() === 'yes' || o.id.toLowerCase().endsWith('-yes') || o.name.toUpperCase() === 'YES' || o.name.toUpperCase() === 'SÍ')
              : null;
            const no = isBinary
              ? m.outcomes.find((o) => o.id.toLowerCase() === 'no' || o.id.toLowerCase().endsWith('-no') || o.name.toUpperCase() === 'NO')
              : null;

            return (
              <div
                key={m.id}
                onClick={() => navigateTo('detail', m.id)}
                className="p-4 sm:p-5 hover:bg-[#111a2e] cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                      {m.category}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800/60 text-slate-400 font-semibold">
                      {m.type || (m.outcomes && m.outcomes.length === 2 ? 'binary' : 'multi')}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      {language === 'es' ? 'Cierre:' : 'Closes:'} {new Date(m.closeTime).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100 hover:text-cyan-300 transition-colors tracking-tight">
                    {m.question}
                  </h3>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  {/* Prices */}
                  {isBinary && yes && no ? (
                    <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
                      <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/25">
                        {yes.name} {Math.round(yes.currentPrice * 100)}&cent;
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 font-bold border border-rose-500/25">
                        {no.name} {Math.round(no.currentPrice * 100)}&cent;
                      </span>
                    </div>
                  ) : (
                    <div className="font-mono text-xs text-slate-300 tabular-nums">
                      {m.outcomes.length} {language === 'es' ? 'opciones' : 'outcomes'}
                    </div>
                  )}

                  {/* Volume */}
                  <div className="text-right font-mono text-xs tabular-nums">
                    <div className="text-slate-400 text-[10px]">{language === 'es' ? 'Volumen' : 'Volume'}</div>
                    <div className="font-bold text-slate-200">
                      ${m.volume.toLocaleString('en-US')}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateTo('detail', m.id);
                    }}
                    className="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-mono font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>{language === 'es' ? 'OPERAR' : 'TRADE'}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
