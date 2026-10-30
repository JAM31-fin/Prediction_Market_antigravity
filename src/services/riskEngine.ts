/**
 * Authoritative LMSR & Platform Market Maker Risk Engine
 * 
 * Computes exact mathematical risk, liability, exposure, and P&L metrics
 * for the centralized LMSR automated market maker:
 * - Theoretical maximum LMSR loss: L_max = b * ln(n)
 * - Current market-maker exposure
 * - Potential settlement obligations by outcome
 * - Commission and spread revenue breakdowns
 * - Outcome-by-outcome scenario analysis (If outcome X wins -> platform P&L)
 * - Time-sliced revenue (Today, 7-day, 30-day, All-time)
 * - Net Platform Result
 * 
 * Strict Constraint: All metrics derive strictly from authenticated trades,
 * actual positions, and current LMSR state. Zero synthetic/ghost activity.
 */

import { Market, Trade, Position } from '../types';
import { LMSREngine } from './lmsrEngine';

export interface OutcomeScenarioRisk {
  outcomeId: string;
  outcomeName: string;
  currentProbability: number;
  traderSharesHeld: number;
  settlementObligation: number; // $1.00 per share held if this outcome wins
  platformMMPnL: number;        // CashCollected - settlementObligation
  platformNetResult: number;    // platformMMPnL + commissionRevenue + spreadRevenue
  maxTheoreticalLoss: number;   // b * ln(1 / p_0,i)
}

export interface MarketRiskReport {
  marketId: string;
  marketQuestion: string;
  category: string;
  status: string;
  liquidityParameter: number; // b
  numOutcomes: number;
  
  // Theoretical Bound
  maxTheoreticalLoss: number; // b * ln(1 / min_p_0)
  
  // Probabilities
  initialProbabilities: Record<string, number>;
  currentProbabilities: Record<string, number>;
  
  // Activity (Strictly Real)
  totalVolume: number;
  traderCount: number;
  tradeCount: number;
  commissionRate: number;
  spreadRate: number;
  
  // Revenue & Cash Flows
  commissionRevenue: number;
  spreadRevenue: number;
  totalFeeRevenue: number;
  cashCollectedFromLMSR: number; // Net cash paid into LMSR by traders: C(q) - C(q0)
  
  // Liabilities & Exposure
  potentialSettlementObligation: number; // Max outcome obligation max_k(S_k)
  currentExposure: number;               // max(0, max_k(S_k - CashCollected))
  
  // P&L
  unrealizedMMPnL: number;      // Expected MM P&L under current probabilities
  realizedMMPnL: number;        // Actual realized P&L if market is resolved
  netPlatformResult: number;    // Overall platform profit/loss on this market
  settlementPayout?: number;    // Actual cash paid out at resolution
  
  // Scenario Breakdown
  scenarios: OutcomeScenarioRisk[];
  worstCaseOutcome: string;
  bestCaseOutcome: string;
}

export interface RevenuePeriodMetrics {
  commissionRevenue: number;
  spreadRevenue: number;
  totalRevenue: number;
  volume: number;
  tradesCount: number;
}

export interface PlatformRiskAggregates {
  totalMaxTheoreticalLoss: number;
  totalCurrentExposure: number;
  totalPotentialSettlement: number;
  totalCommissionRevenue: number;
  totalSpreadRevenue: number;
  totalFeeRevenue: number;
  totalVolume: number;
  totalTrades: number;
  uniqueTradersCount: number;
  realizedMMPnL: number;
  unrealizedMMPnL: number;
  netPlatformResult: number;
  riskCoverageRatio: number; // Ratio de Cobertura = (Comisiones Acumuladas + Spreads) / Exposición Neta Restante
  netRemainingExposure: number;
  
  periods: {
    today: RevenuePeriodMetrics;
    sevenDays: RevenuePeriodMetrics;
    thirtyDays: RevenuePeriodMetrics;
    allTime: RevenuePeriodMetrics;
  };
}

export class RiskEngine {
  /**
   * Theoretical maximum LMSR loss.
   * For uniform probabilities: L_max = b * ln(n).
   * For non-uniform initial probabilities p_i:
   * The worst-case loss is bounded by b * ln(1 / min_i(p_i)).
   * Outcome-specific theoretical loss if outcome i wins is b * ln(1 / p_i).
   */
  public static calculateMaxTheoreticalLoss(
    b: number,
    numOutcomesOrProbabilities: number | Record<string, number>
  ): number {
    if (b <= 0) return 0;
    if (typeof numOutcomesOrProbabilities === 'number') {
      if (numOutcomesOrProbabilities <= 1) return 0;
      return Number((b * Math.log(numOutcomesOrProbabilities)).toFixed(2));
    }
    const probs = Object.values(numOutcomesOrProbabilities);
    if (probs.length === 0) return 0;
    const minP = Math.max(0.0001, Math.min(...probs));
    return Number((b * Math.log(1 / minP)).toFixed(2));
  }

  /**
   * Calculates comprehensive risk report for a single market
   */
  public static calculateMarketRisk(
    market: Market,
    allTrades: Trade[],
    allPositions: Position[]
  ): MarketRiskReport {
    const b = market.liquidityParameter || 100;
    const numOutcomes = market.outcomes.length;

    // Filter trades strictly belonging to this market (exclude settlement trades from volume)
    const marketTrades = allTrades.filter((t) => t.marketId === market.id);
    const tradingTrades = marketTrades.filter((t) => t.type === 'BUY' || t.type === 'SELL');
    const totalVolume = Number(
      tradingTrades.reduce((acc, t) => acc + (t.amount || 0), 0).toFixed(2)
    );
    const uniqueUserIds = new Set(tradingTrades.map((t) => t.userId).filter(Boolean));
    const traderCount = Math.max(uniqueUserIds.size, market.totalTraders || 0);
    const tradeCount = tradingTrades.length;

    // Fees generated
    const commissionRevenue = Number(
      marketTrades.reduce((acc, t) => acc + (t.fee || 0), 0).toFixed(2)
    );
    const spreadRevenue = Number(
      marketTrades.reduce((acc, t) => acc + (t.spreadFee || 0), 0).toFixed(2)
    );
    const totalFeeRevenue = Number((commissionRevenue + spreadRevenue).toFixed(2));

    // Initial vs Current probabilities
    const initialProbabilities: Record<string, number> = {};
    const currentProbabilities: Record<string, number> = {};
    market.outcomes.forEach((o) => {
      initialProbabilities[o.id] = o.initialProbability ?? 1 / numOutcomes;
      currentProbabilities[o.id] = o.currentPrice ?? 1 / numOutcomes;
    });

    const maxTheoreticalLoss = this.calculateMaxTheoreticalLoss(b, initialProbabilities);

    // Current LMSR cost vs initial LMSR cost
    // C(q) = b * ln(sum(e^(q_i / b)))
    const currentQuantities: Record<string, number> = {};
    market.outcomes.forEach((o) => {
      currentQuantities[o.id] = o.q ?? 0;
    });

    const initialQuantities = market.initialQuantities ?? LMSREngine.calculateInitialQuantities(initialProbabilities, b);

    const cCurrent = LMSREngine.cost(currentQuantities, b);
    const cInitial = LMSREngine.cost(initialQuantities, b);
    // Net cash collected by LMSR from trader share purchases (excluding fees)
    const cashCollectedFromLMSR = Number((cCurrent - cInitial).toFixed(2));

    // Determine outstanding shares held per outcome:
    // When market is OPEN, CLOSED, or RESOLVING: look at OPEN positions.
    // When market is RESOLVED: look at SETTLED positions (or OPEN) to preserve the historical resolution audit.
    const isResolved = market.status === 'resolved';
    const marketPositions = allPositions.filter((p) => p.marketId === market.id);

    const traderSharesByOutcome: Record<string, number> = {};
    market.outcomes.forEach((o) => {
      traderSharesByOutcome[o.id] = 0;
    });

    marketPositions.forEach((p) => {
      if (traderSharesByOutcome[p.outcomeId] === undefined) return;
      if (!isResolved) {
        if (p.status === 'OPEN' && p.quantity > 0) {
          traderSharesByOutcome[p.outcomeId] += p.quantity;
        }
      } else {
        // In resolved state, include settled positions
        if ((p.status === 'OPEN' || p.status === 'SETTLED_WIN' || p.status === 'SETTLED_LOSE') && p.quantity > 0) {
          traderSharesByOutcome[p.outcomeId] += p.quantity;
        }
      }
    });

    // Scenarios by outcome
    let maxObligation = 0;
    const scenarios: OutcomeScenarioRisk[] = market.outcomes.map((o) => {
      const sharesHeld = Number((traderSharesByOutcome[o.id] || 0).toFixed(2));
      const settlementObligation = Number(sharesHeld.toFixed(2)); // $1.00 payout per winning share
      if (settlementObligation > maxObligation) {
        maxObligation = settlementObligation;
      }

      const platformMMPnL = Number((cashCollectedFromLMSR - settlementObligation).toFixed(2));
      const platformNetResult = Number((platformMMPnL + totalFeeRevenue).toFixed(2));
      const initProb = Math.max(0.0001, initialProbabilities[o.id] || (1 / numOutcomes));
      const maxLoss = Number((b * Math.log(1 / initProb)).toFixed(2));

      return {
        outcomeId: o.id,
        outcomeName: o.name,
        currentProbability: Number((currentProbabilities[o.id] || 0).toFixed(4)),
        traderSharesHeld: sharesHeld,
        settlementObligation,
        platformMMPnL,
        platformNetResult,
        maxTheoreticalLoss: maxLoss,
      };
    });

    // Determine worst & best outcomes
    let worstCaseOutcome = market.outcomes[0]?.name || '';
    let bestCaseOutcome = market.outcomes[0]?.name || '';
    let minNet = Infinity;
    let maxNet = -Infinity;
    scenarios.forEach((s) => {
      if (s.platformNetResult < minNet) {
        minNet = s.platformNetResult;
        worstCaseOutcome = s.outcomeName;
      }
      if (s.platformNetResult > maxNet) {
        maxNet = s.platformNetResult;
        bestCaseOutcome = s.outcomeName;
      }
    });

    // Current platform exposure: worst-case out of pocket payout exceeding collected cash
    const currentExposure = Math.max(0, Number((maxObligation - Math.max(0, cashCollectedFromLMSR)).toFixed(2)));

    // Expected unrealized MM P&L under current market prices
    const expectedPayout = scenarios.reduce(
      (acc, s) => acc + s.settlementObligation * s.currentProbability,
      0
    );
    const unrealizedMMPnL = Number((cashCollectedFromLMSR - expectedPayout).toFixed(2));

    // If market is resolved, calculate actual realized settlement
    let realizedMMPnL = 0;
    let actualPayout = 0;
    if (isResolved) {
      const winningOutcomeId = market.resolvedOutcomeId || market.winningOutcomeId;
      if (market.settlementPayout !== undefined) {
        actualPayout = market.settlementPayout;
      } else if (winningOutcomeId) {
        const winScenario = scenarios.find((s) => s.outcomeId === winningOutcomeId);
        actualPayout = winScenario ? winScenario.settlementObligation : 0;
      }
      realizedMMPnL = Number((cashCollectedFromLMSR - actualPayout).toFixed(2));
    }

    const netPlatformResult = isResolved
      ? Number((realizedMMPnL + totalFeeRevenue).toFixed(2))
      : Number((unrealizedMMPnL + totalFeeRevenue).toFixed(2));

    return {
      marketId: market.id,
      marketQuestion: market.question,
      category: market.category,
      status: market.status,
      liquidityParameter: b,
      numOutcomes,
      maxTheoreticalLoss,
      initialProbabilities,
      currentProbabilities,
      totalVolume,
      traderCount,
      tradeCount,
      commissionRate: market.commissionRate || 0.01,
      spreadRate: market.spread || 0.015,
      commissionRevenue,
      spreadRevenue,
      totalFeeRevenue,
      cashCollectedFromLMSR,
      potentialSettlementObligation: Number(maxObligation.toFixed(2)),
      currentExposure,
      unrealizedMMPnL,
      realizedMMPnL,
      netPlatformResult,
      settlementPayout: isResolved ? actualPayout : undefined,
      scenarios,
      worstCaseOutcome,
      bestCaseOutcome,
    };
  }

  /**
   * Aggregates platform-wide risk, exposure, revenue and net result
   */
  public static calculatePlatformAggregates(
    markets: Market[],
    allTrades: Trade[],
    allPositions: Position[]
  ): PlatformRiskAggregates {
    const marketReports = markets.map((m) =>
      this.calculateMarketRisk(m, allTrades, allPositions)
    );

    const totalMaxTheoreticalLoss = Number(
      marketReports.reduce((acc, r) => acc + r.maxTheoreticalLoss, 0).toFixed(2)
    );
    const totalCurrentExposure = Number(
      marketReports.reduce((acc, r) => acc + r.currentExposure, 0).toFixed(2)
    );
    const totalPotentialSettlement = Number(
      marketReports.reduce((acc, r) => acc + r.potentialSettlementObligation, 0).toFixed(2)
    );

    const totalCommissionRevenue = Number(
      allTrades.reduce((acc, t) => acc + (t.fee || 0), 0).toFixed(2)
    );
    const totalSpreadRevenue = Number(
      allTrades.reduce((acc, t) => acc + (t.spreadFee || 0), 0).toFixed(2)
    );
    const totalFeeRevenue = Number((totalCommissionRevenue + totalSpreadRevenue).toFixed(2));

    const tradingTrades = allTrades.filter((t) => t.type === 'BUY' || t.type === 'SELL');
    const totalVolume = Number(
      tradingTrades.reduce((acc, t) => acc + (t.amount || 0), 0).toFixed(2)
    );
    const totalTrades = tradingTrades.length;
    const uniqueTradersCount = new Set(tradingTrades.map((t) => t.userId).filter(Boolean)).size;

    const realizedMMPnL = Number(
      marketReports.reduce((acc, r) => acc + r.realizedMMPnL, 0).toFixed(2)
    );
    const unrealizedMMPnL = Number(
      marketReports
        .filter((r) => r.status !== 'resolved')
        .reduce((acc, r) => acc + r.unrealizedMMPnL, 0)
        .toFixed(2)
    );

    const netPlatformResult = Number(
      (totalFeeRevenue + realizedMMPnL + unrealizedMMPnL).toFixed(2)
    );

    // Compute time-period slices
    const now = Date.now();
    const oneDayAgo = now - 24 * 3600 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 3600 * 1000;

    const calcSlice = (filterFn: (t: Trade) => boolean): RevenuePeriodMetrics => {
      const sliceTrades = allTrades.filter(filterFn);
      const comm = Number(sliceTrades.reduce((acc, t) => acc + (t.fee || 0), 0).toFixed(2));
      const spread = Number(sliceTrades.reduce((acc, t) => acc + (t.spreadFee || 0), 0).toFixed(2));
      const tradingSlice = sliceTrades.filter((t) => t.type === 'BUY' || t.type === 'SELL');
      const vol = Number(tradingSlice.reduce((acc, t) => acc + (t.amount || 0), 0).toFixed(2));
      return {
        commissionRevenue: comm,
        spreadRevenue: spread,
        totalRevenue: Number((comm + spread).toFixed(2)),
        volume: vol,
        tradesCount: tradingSlice.length,
      };
    };

    const today = calcSlice((t) => new Date(t.timestamp).getTime() >= oneDayAgo);
    const sevenDays = calcSlice((t) => new Date(t.timestamp).getTime() >= sevenDaysAgo);
    const thirtyDays = calcSlice((t) => new Date(t.timestamp).getTime() >= thirtyDaysAgo);
    const allTime = {
      commissionRevenue: totalCommissionRevenue,
      spreadRevenue: totalSpreadRevenue,
      totalRevenue: totalFeeRevenue,
      volume: totalVolume,
      tradesCount: totalTrades,
    };

    const totalPlatformFees = Number((totalCommissionRevenue + totalSpreadRevenue).toFixed(2));
    const netRemainingExposure = Math.max(0, Number(totalCurrentExposure.toFixed(2)));
    const riskCoverageRatio = netRemainingExposure > 0
      ? Number((totalPlatformFees / netRemainingExposure).toFixed(4))
      : 999.99; // Totalmente cubierto / sin exposición neta abierta

    return {
      totalMaxTheoreticalLoss,
      totalCurrentExposure,
      totalPotentialSettlement,
      totalCommissionRevenue,
      totalSpreadRevenue,
      totalFeeRevenue,
      totalVolume,
      totalTrades,
      uniqueTradersCount,
      realizedMMPnL,
      unrealizedMMPnL,
      netPlatformResult,
      riskCoverageRatio,
      netRemainingExposure,
      periods: {
        today,
        sevenDays,
        thirtyDays,
        allTime,
      },
    };
  }
}
