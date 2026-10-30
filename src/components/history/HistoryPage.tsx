import React, { useState } from 'react';
import { useMarket } from '../../context/MarketContext';
import { useLanguage } from '../../context/LanguageContext';
import { marketDictionary, getLocalizedOutcomeName } from '../../i18n/marketTranslations';
import { 
  Download, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CheckCircle2, 
  Search 
} from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const { trades, navigateTo } = useMarket();
  const { language } = useLanguage();
  const [filterType, setFilterType] = useState<'ALL' | 'BUY' | 'SELL' | 'RESOLUTION'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');

  // Filter trades
  const filteredTrades = trades.filter((trade) => {
    if (filterType !== 'ALL' && trade.type !== filterType) {
      return false;
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchMarket = trade.marketQuestion.toLowerCase().includes(q);
      const matchOutcome = trade.outcomeName.toLowerCase().includes(q);
      if (!matchMarket && !matchOutcome) return false;
    }
    return true;
  });

  // Export ledger to CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'Type', 'Market', 'Outcome', 'Quantity', 'Price', 'Gross Amount', 'Fee', 'Net Cash'];
    const rows = filteredTrades.map((t) => [
      t.id,
      new Date(t.timestamp).toISOString(),
      t.type,
      `"${t.marketQuestion.replace(/"/g, '""')}"`,
      `"${t.outcomeName.replace(/"/g, '""')}"`,
      t.quantity.toFixed(3),
      t.price.toFixed(3),
      t.amount.toFixed(2),
      t.fee.toFixed(2),
      (t.amount - (t.type === 'BUY' ? 0 : t.fee)).toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `centramarkets_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-wrap-balance">
            {language === 'es' ? 'Historial de Transacciones' : 'Transaction History & Audited Ledger'}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 text-wrap-pretty">
            {language === 'es'
              ? 'Registro inmutable de compras, ventas y liquidaciones de ganancias con auditoría de doble entrada.'
              : 'Every trade execution, settlement payout, and liquidity fee recorded with double-entry integrity.'}
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={filteredTrades.length === 0}
          className="self-start sm:self-auto px-4 py-2 min-h-[38px] rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-mono font-medium flex items-center gap-2 btn-tactile disabled:opacity-50 cursor-pointer shadow-sm"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>{language === 'es' ? 'Exportar Libro (CSV)' : 'Export Ledger (CSV)'}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono elevation-card">
        
        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {([
            { id: 'ALL', label: language === 'es' ? 'Todas' : 'All Transactions' },
            { id: 'BUY', label: language === 'es' ? 'Compras' : 'BUY' },
            { id: 'SELL', label: language === 'es' ? 'Ventas' : 'SELL' },
            { id: 'RESOLUTION', label: language === 'es' ? 'Liquidaciones' : 'RESOLUTION' },
          ] as const).map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterType(item.id as any)}
              className={`px-3 py-1.5 min-h-[34px] rounded-lg btn-tactile font-semibold cursor-pointer whitespace-nowrap ${
                filterType === item.id
                  ? 'bg-slate-800 text-white border border-slate-700 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search inside history */}
        <div className="relative w-full sm:w-72 group">
          <Search className="w-3.5 h-3.5 text-slate-500 group-focus-within:text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2 transition-colors pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={language === 'es' ? 'Buscar por contrato u opción...' : 'Search by market or outcome...'}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/70 font-sans transition-[border-color,box-shadow] duration-150 ease-out"
          />
        </div>

      </div>

      {/* Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden elevation-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs tabular-nums">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-bold">{language === 'es' ? 'Fecha' : 'Timestamp'}</th>
                <th className="py-3.5 px-4 font-bold">{language === 'es' ? 'Operación' : 'Action'}</th>
                <th className="py-3.5 px-4 font-bold font-sans">{language === 'es' ? 'Contrato de Mercado' : 'Market Contract'}</th>
                <th className="py-3.5 px-4 font-bold font-sans">{language === 'es' ? 'Opción' : 'Outcome'}</th>
                <th className="py-3.5 px-4 text-right font-bold">{language === 'es' ? 'Acciones' : 'Shares'}</th>
                <th className="py-3.5 px-4 text-right font-bold">{language === 'es' ? 'Precio' : 'Price'}</th>
                <th className="py-3.5 px-4 text-right font-bold">{language === 'es' ? 'Total Bruto' : 'Gross Total'}</th>
                <th className="py-3.5 px-4 text-right font-bold">{language === 'es' ? 'Tarifas' : 'Fee'}</th>
                <th className="py-3.5 px-4 text-right font-bold">{language === 'es' ? 'Neto en Saldo' : 'Net Cash'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-500">
                    {language === 'es' ? 'No hay operaciones que coincidan con la búsqueda.' : 'No transactions matching your criteria.'}
                  </td>
                </tr>
              ) : (
                filteredTrades.map((t) => {
                  const isBuy = t.type === 'BUY';
                  const isSell = t.type === 'SELL';
                  const isResolution = t.type === 'SETTLEMENT' || t.type === 'RESOLUTION';
                  const netChange = isBuy ? -t.amount : (t.amount - (isSell ? t.fee : 0));
                  
                  const entry = marketDictionary[t.marketId];
                  const displayQuestion = entry ? entry.question[language] : t.marketQuestion;
                  const displayOutcome = getLocalizedOutcomeName(t.outcomeName, language);

                  return (
                    <tr 
                      key={t.id} 
                      onClick={() => navigateTo('detail', t.marketId)}
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(t.timestamp).toLocaleString(language === 'es' ? 'es-ES' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isBuy
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : isSell
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                          }`}
                        >
                          {isBuy && <ArrowDownLeft className="w-2.5 h-2.5" />}
                          {isSell && <ArrowUpRight className="w-2.5 h-2.5" />}
                          {isResolution && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {language === 'es'
                            ? isBuy ? 'COMPRA' : isSell ? 'VENTA' : 'PAGO PREMIO'
                            : t.type}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-sans text-slate-200 font-medium max-w-xs truncate">
                        {displayQuestion}
                      </td>

                      <td className="py-3.5 px-4 font-sans text-slate-300 font-semibold">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px]">
                          {displayOutcome}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right text-slate-300">
                        {t.quantity.toFixed(3)}
                      </td>

                      <td className="py-3.5 px-4 text-right text-slate-400">
                        ${t.price.toFixed(3)}
                      </td>

                      <td className="py-3.5 px-4 text-right text-slate-300">
                        ${t.amount.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-right text-slate-500 text-[11px]">
                        ${t.fee.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold whitespace-nowrap">
                        <span className={netChange >= 0 ? 'text-emerald-400' : 'text-slate-200'}>
                          {netChange >= 0 ? `+$${netChange.toFixed(2)}` : `-$${Math.abs(netChange).toFixed(2)}`}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
