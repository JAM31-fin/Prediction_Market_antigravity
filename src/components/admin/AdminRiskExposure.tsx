import React, { useState, useMemo } from 'react';
import { useMarket } from '../../context/MarketContext';
import { RiskEngine, MarketRiskReport } from '../../services/riskEngine';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Cpu, 
  CheckCircle2, 
  Info, 
  X, 
  Eye, 
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Percent,
  Layers,
  HelpCircle,
  Activity
} from 'lucide-react';

export const AdminRiskExposure: React.FC = () => {
  const { markets, allPositions, allTrades } = useMarket();
  const [selectedMarketReport, setSelectedMarketReport] = useState<MarketRiskReport | null>(null);

  // Compute detailed mathematical risk reports using platform-wide positions and trades
  const riskReports: MarketRiskReport[] = useMemo(() => {
    return markets.map((m) => RiskEngine.calculateMarketRisk(m, allTrades, allPositions));
  }, [markets, allTrades, allPositions]);

  // Aggregate platform metrics
  const platformAggregates = useMemo(() => {
    return RiskEngine.calculatePlatformAggregates(markets, allTrades, allPositions);
  }, [markets, allTrades, allPositions]);

  return (
    <div className="py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              MARKET MAKER RISK
            </h2>
            <span className="px-2 py-0.5 text-[10px] uppercase font-mono font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              LMSR Math Engine
            </span>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Financial exposure, theoretical loss bounds, and scenario settlement liabilities for the platform liquidity desk.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">Total Active Contracts:</span>
          <span className="text-emerald-400 font-bold">
            {markets.filter((m) => m.status === 'open').length} / {markets.length}
          </span>
        </div>
      </div>

      {/* Top Level Distinct Financial Risk Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 font-mono text-xs">
        
        {/* Metric 1: Theoretical Maximum LMSR Loss */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="uppercase font-bold text-[11px]">Max Theoretical Loss</span>
              <span className="text-[10px] text-amber-400 font-bold">&Sigma; b &bull; ln(n)</span>
            </div>
            <div className="text-2xl font-black text-amber-400 mt-2">
              ${platformAggregates.totalMaxTheoreticalLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-slate-400 text-[10px] mt-2 pt-2 border-t border-slate-800/80">
            <span className="text-slate-300 font-bold">Risk bound:</span> Worst-case mathematical limit of the LMSR liquidity provider.
          </div>
        </div>

        {/* Metric 2: Current Market-Maker Exposure */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="uppercase font-bold text-[11px]">Current MM Exposure</span>
              <span className="text-[10px] text-sky-400 font-bold">Net At-Risk</span>
            </div>
            <div className="text-2xl font-black text-sky-400 mt-2">
              ${platformAggregates.totalCurrentExposure.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-slate-400 text-[10px] mt-2 pt-2 border-t border-slate-800/80">
            <span className="text-slate-300 font-bold">Real-time exposure:</span> Out-of-pocket settlement deficit if worst outcomes resolve now.
          </div>
        </div>

        {/* Metric 3: Potential Settlement Obligations */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="uppercase font-bold text-[11px]">Potential Settlement</span>
              <span className="text-[10px] text-purple-400 font-bold">Max Payout</span>
            </div>
            <div className="text-2xl font-black text-purple-300 mt-2">
              ${platformAggregates.totalPotentialSettlement.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-slate-400 text-[10px] mt-2 pt-2 border-t border-slate-800/80">
            <span className="text-slate-300 font-bold">Gross liabilities:</span> Max payout obligations across all winning shares held by traders.
          </div>
        </div>

        {/* Metric 4: Net Market-Maker P&L */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="uppercase font-bold text-[11px]">MM P&L + Fees</span>
              <span className={`text-[10px] font-bold ${platformAggregates.netPlatformResult >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {platformAggregates.netPlatformResult >= 0 ? '+Net Profit' : '-Net Loss'}
              </span>
            </div>
            <div className={`text-2xl font-black mt-2 ${platformAggregates.netPlatformResult >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {platformAggregates.netPlatformResult >= 0 ? '+' : ''}${platformAggregates.netPlatformResult.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-slate-400 text-[10px] mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <span>Fees: ${platformAggregates.totalFeeRevenue.toFixed(2)}</span>
            <span>MM P&L: ${(platformAggregates.realizedMMPnL + platformAggregates.unrealizedMMPnL).toFixed(2)}</span>
          </div>
        </div>

        {/* Metric 5: Solvency Risk Coverage Ratio */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="uppercase font-bold text-[11px]">Ratio de Cobertura</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                platformAggregates.riskCoverageRatio >= 1.0
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : platformAggregates.riskCoverageRatio >= 0.5
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {platformAggregates.riskCoverageRatio >= 1.0 ? 'Solvente' : 'Déficit'}
              </span>
            </div>
            <div className={`text-2xl font-black mt-2 ${
              platformAggregates.riskCoverageRatio >= 1.0 ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {platformAggregates.riskCoverageRatio >= 999
                ? '∞ (Sin Riesgo)'
                : `${(platformAggregates.riskCoverageRatio * 100).toFixed(1)}%`}
            </div>
          </div>
          <div className="text-slate-400 text-[10px] mt-2 pt-2 border-t border-slate-800/80">
            <span className="text-slate-300 font-bold">Fórmula:</span> (Fees ${platformAggregates.totalCommissionRevenue.toFixed(2)} + Spreads ${platformAggregates.totalSpreadRevenue.toFixed(2)}) / Exp ${platformAggregates.netRemainingExposure.toFixed(2)}
          </div>
        </div>

      </div>

      {/* Distinction & Mathematical Education Note */}
      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-200">LMSR Bound Definition:</span> For any contract with <code className="text-amber-400">n</code> outcomes, the theoretical maximum LMSR market maker loss is <code className="text-amber-400">L_max = b &bull; ln(n)</code> (for binary: <code className="text-amber-400">b &bull; ln(2)</code>). Current exposure tracks actual inventory skew relative to collected cash flows.
          </div>
        </div>
      </div>

      {/* Market Risk Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-xs uppercase font-mono tracking-wider text-slate-200">
              Market Risk & Liability Table
            </h3>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Click &ldquo;Inspect Risk Details&rdquo; on any market to view outcome scenario analysis and LMSR state.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Showing {riskReports.length} contracts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs divide-y divide-slate-800">
            <thead className="bg-slate-950/60 text-slate-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Market / Contract</th>
                <th className="py-3 px-3">Liquidity b</th>
                <th className="py-3 px-3">Current Probabilities</th>
                <th className="py-3 px-3 text-right">Volume</th>
                <th className="py-3 px-3 text-right">Current Exposure</th>
                <th className="py-3 px-3 text-right">Max LMSR Loss</th>
                <th className="py-3 px-3 text-right">Potential Settlement</th>
                <th className="py-3 px-3 text-right">Net Result</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-850">
              {riskReports.map((report) => {
                const isBinary = report.numOutcomes === 2;
                return (
                  <tr key={report.marketId} className="hover:bg-slate-850/40 transition-colors">
                    <td className="py-3 px-4 max-w-xs sm:max-w-sm">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          {report.category}
                        </span>
                        <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-bold ${
                          report.status === 'open'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : report.status === 'resolved'
                            ? 'bg-purple-500/10 text-purple-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {report.status}
                        </span>
                      </div>
                      <div className="font-sans font-bold text-slate-100 truncate text-xs" title={report.marketQuestion}>
                        {report.marketQuestion}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-emerald-400 font-bold">{report.liquidityParameter}</span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {Object.entries(report.currentProbabilities).map(([outcomeId, prob]) => {
                          const outcomeName = report.scenarios.find((s) => s.outcomeId === outcomeId)?.outcomeName || outcomeId;
                          return (
                            <span key={outcomeId} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                              <span className="text-slate-400 mr-1">{outcomeName}:</span>
                              <span className="font-bold text-slate-100">{Math.round(prob * 100)}%</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right text-slate-200">
                      ${report.totalVolume.toFixed(2)}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <span className={`font-bold ${report.currentExposure > 0 ? 'text-sky-400' : 'text-slate-400'}`}>
                        ${report.currentExposure.toFixed(2)}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right text-amber-400 font-bold" title={`${report.liquidityParameter} * ln(${report.numOutcomes})`}>
                      ${report.maxTheoreticalLoss.toFixed(2)}
                    </td>

                    <td className="py-3 px-3 text-right text-purple-300 font-bold">
                      ${report.potentialSettlementObligation.toFixed(2)}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <span className={`font-bold ${report.netPlatformResult >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {report.netPlatformResult >= 0 ? '+' : ''}${report.netPlatformResult.toFixed(2)}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedMarketReport(report)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-mono transition-colors flex items-center gap-1 mx-auto"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Inspect Risk</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Market Risk Modal / Drawer */}
      {selectedMarketReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {selectedMarketReport.category}
                  </span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                    Risk Breakdown
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white font-sans">
                  {selectedMarketReport.marketQuestion}
                </h3>
              </div>

              <button
                onClick={() => setSelectedMarketReport(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Core LMSR Parameters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-850">
                <div className="text-slate-400 text-[10px] uppercase">Liquidity (b)</div>
                <div className="text-base font-bold text-emerald-400 mt-1">
                  b = {selectedMarketReport.liquidityParameter}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-850">
                <div className="text-slate-400 text-[10px] uppercase">Theoretical Max Loss</div>
                <div className="text-base font-bold text-amber-400 mt-1">
                  ${selectedMarketReport.maxTheoreticalLoss.toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">b &bull; ln({selectedMarketReport.numOutcomes})</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-850">
                <div className="text-slate-400 text-[10px] uppercase">Trading Volume</div>
                <div className="text-base font-bold text-slate-100 mt-1">
                  ${selectedMarketReport.totalVolume.toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">{selectedMarketReport.tradeCount} trades</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-850">
                <div className="text-slate-400 text-[10px] uppercase">Real Traders</div>
                <div className="text-base font-bold text-slate-100 mt-1">
                  {selectedMarketReport.traderCount}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">authenticated accounts</div>
              </div>
            </div>

            {/* Fees & LMSR Cash Flows */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-850">
                <div className="text-slate-400 text-[10px]">Commission Revenue ({(selectedMarketReport.commissionRate * 100).toFixed(1)}%)</div>
                <div className="text-sm font-bold text-emerald-400 mt-1">
                  ${selectedMarketReport.commissionRevenue.toFixed(2)}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-850">
                <div className="text-slate-400 text-[10px]">Spread Revenue ({(selectedMarketReport.spreadRate * 100).toFixed(1)}%)</div>
                <div className="text-sm font-bold text-emerald-400 mt-1">
                  ${selectedMarketReport.spreadRevenue.toFixed(2)}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-850">
                <div className="text-slate-400 text-[10px]">Net Cash Inflow to LMSR</div>
                <div className="text-sm font-bold text-slate-200 mt-1">
                  ${selectedMarketReport.cashCollectedFromLMSR.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Probability Shifts: Initial vs Current */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-3 font-mono text-xs">
              <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                Probability Evolution (Initial vs Current)
              </div>

              <div className="space-y-2">
                {selectedMarketReport.scenarios.map((s) => {
                  const initP = selectedMarketReport.initialProbabilities[s.outcomeId] || (1 / selectedMarketReport.numOutcomes);
                  const currP = s.currentProbability;
                  const delta = currP - initP;

                  return (
                    <div key={s.outcomeId} className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="font-bold text-slate-200">{s.outcomeName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-[11px]">Initial: {Math.round(initP * 100)}%</span>
                        <span className="text-slate-500">&rarr;</span>
                        <span className="font-bold text-emerald-400 text-[11px]">Current: {Math.round(currP * 100)}%</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          delta > 0 ? 'bg-emerald-500/10 text-emerald-400' : delta < 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Outcome-by-Outcome Scenario Settlement Analysis */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                  Scenario Settlement Analysis (By Result)
                </span>
                <span className="text-slate-400 text-[10px]">
                  Cash Collected: ${selectedMarketReport.cashCollectedFromLMSR.toFixed(2)}
                </span>
              </div>

              <div className="space-y-2.5">
                {selectedMarketReport.scenarios.map((scenario) => {
                  const isPositive = scenario.platformNetResult >= 0;
                  return (
                    <div key={scenario.outcomeId} className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100">
                            If &ldquo;{scenario.outcomeName}&rdquo; Wins:
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({scenario.traderSharesHeld.toFixed(1)} shares held)
                          </span>
                        </div>
                        <div className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          Platform Net P&L: {isPositive ? '+' : ''}${scenario.platformNetResult.toFixed(2)}
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-850">
                        <span>Settlement Payout Liability: -${scenario.settlementObligation.toFixed(2)}</span>
                        <span>LMSR P&L: ${scenario.platformMMPnL.toFixed(2)}</span>
                        <span>Fee Revenue: +${selectedMarketReport.totalFeeRevenue.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedMarketReport(null)}
                className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors"
              >
                Close Risk Breakdown
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
