/**
 * LMSR (Logarithmic Market Scoring Rule) Pricing & Market Making Engine
 * 
 * Implements the standard Hanson LMSR automated market maker:
 * C(q) = b * ln(sum(exp(q_i / b)))
 * p_i = exp(q_i / b) / sum(exp(q_j / b))
 * 
 * Uses the Log-Sum-Exp trick for floating point precision and overflow safety.
 * Dedicated standalone module separated completely from UI components.
 */

export interface LMSRMarketState {
  quantities: Record<string, number>; // outcomeId -> current shares vector q_i
  b: number; // liquidity parameter
}

export class LMSREngine {
  /**
   * Log-sum-exp helper for numerical stability
   */
  private static logSumExp(qValues: number[], b: number): { sumExp: number; maxVal: number } {
    if (qValues.length === 0) return { sumExp: 1, maxVal: 0 };
    const scaled = qValues.map((q) => q / b);
    const maxVal = Math.max(...scaled);
    const sumExp = scaled.reduce((acc, val) => acc + Math.exp(val - maxVal), 0);
    return { sumExp, maxVal };
  }

  /**
   * Calculate cost function C(q)
   */
  public static cost(quantities: Record<string, number>, b: number): number {
    const qArray = Object.values(quantities);
    const { sumExp, maxVal } = this.logSumExp(qArray, b);
    return b * (maxVal + Math.log(sumExp));
  }

  /**
   * Calculate marginal price for all outcomes: p_i = exp(q_i / b) / sum(exp(q_j / b))
   * Returned prices are between 0.00 and 1.00, summing to 1.00
   */
  public static calculatePrices(
    quantities: Record<string, number>,
    b: number
  ): Record<string, number> {
    const outcomeIds = Object.keys(quantities);
    const qArray = outcomeIds.map((id) => quantities[id]);
    const { sumExp, maxVal } = this.logSumExp(qArray, b);

    const prices: Record<string, number> = {};
    for (const id of outcomeIds) {
      const q = quantities[id];
      const p = Math.exp(q / b - maxVal) / sumExp;
      // Clamp between 0.01 and 0.99 for clean display bounds
      prices[id] = Math.max(0.01, Math.min(0.99, p));
    }

    // Normalize so sum equals 1.00
    const total = Object.values(prices).reduce((a, b) => a + b, 0);
    for (const id of outcomeIds) {
      prices[id] = Number((prices[id] / total).toFixed(4));
    }

    return prices;
  }

  /**
   * Calculate initial share quantities q_i from starting target probabilities and liquidity parameter b.
   * In a normalized LMSR: q_0,i = b * ln(p_i) where sum(p_i) = 1.00.
   * This guarantees that:
   * 1. sum_i exp(q_0,i / b) = sum_i p_i = 1.00
   * 2. Initial cost C(q_0) = b * ln(1.00) = 0.00, meaning zero cumulative trade cash flow before any trades.
   * 3. Initial marginal prices match the exact administrator-defined probabilities.
   */
  public static calculateInitialQuantities(
    targetProbabilities: Record<string, number>,
    b: number
  ): Record<string, number> {
    const outcomeIds = Object.keys(targetProbabilities);
    if (outcomeIds.length === 0) return {};

    // Strictly normalize probabilities to sum to 1.00
    const rawSum = outcomeIds.reduce((sum, id) => sum + Math.max(0.0001, targetProbabilities[id] || 0), 0);
    const normalized: Record<string, number> = {};
    for (const id of outcomeIds) {
      normalized[id] = Math.max(0.0001, (targetProbabilities[id] || 0) / rawSum);
    }

    const quantities: Record<string, number> = {};
    for (const id of outcomeIds) {
      const q = b * Math.log(normalized[id]);
      quantities[id] = Number(q.toFixed(4));
    }

    return quantities;
  }

  /**
   * Derives liquidity parameter b from subsidy budget S and initial probabilities p_0:
   * b = S / ln(1 / p_0,min)
   * Where S is the maximum dollar risk/subsidy the platform commits.
   */
  public static calculateBFromSubsidy(
    subsidyBudget: number,
    initialProbabilities: Record<string, number> | number[]
  ): number {
    if (!subsidyBudget || subsidyBudget <= 0) return 10; // Safe minimal floor

    const rawValues = Array.isArray(initialProbabilities)
      ? initialProbabilities
      : Object.values(initialProbabilities);

    if (rawValues.length === 0) return 10;

    // Normalize probabilities
    const sum = rawValues.reduce((acc, p) => acc + Math.max(0.00001, Number(p) || 0), 0);
    if (sum <= 0) return 10;

    const normalized = rawValues.map((p) => Math.max(0.00001, Number(p) || 0) / sum);
    const minP = Math.max(0.0001, Math.min(...normalized));

    // If minP >= 1 (e.g. single outcome), denominator would be 0
    if (minP >= 0.9999) return 10;

    const denominator = Math.log(1 / minP);
    if (denominator <= 0 || !isFinite(denominator)) return 10;

    const b = subsidyBudget / denominator;
    return Number(Math.max(1, b).toFixed(2));
  }

  /**
   * Calculates theoretical maximum loss L_max for market maker given b and initial probabilities:
   * L_max = b * ln(1 / p_0,min)
   */
  public static calculateMaxLoss(
    b: number,
    initialProbabilities: Record<string, number> | number[]
  ): number {
    if (!b || b <= 0) return 0;

    const rawValues = Array.isArray(initialProbabilities)
      ? initialProbabilities
      : Object.values(initialProbabilities);

    if (rawValues.length === 0) return 0;

    const sum = rawValues.reduce((acc, p) => acc + Math.max(0.00001, Number(p) || 0), 0);
    if (sum <= 0) return 0;

    const normalized = rawValues.map((p) => Math.max(0.00001, Number(p) || 0) / sum);
    const minP = Math.max(0.0001, Math.min(...normalized));

    if (minP >= 0.9999) return 0;

    const maxLoss = b * Math.log(1 / minP);
    return Number(Math.max(0, maxLoss).toFixed(2));
  }

  /**
   * Calculate exact shares given an investment dollar amount A
   * A = C(q + deltaQ * e_i) - C(q)
   * Solved analytically:
   * deltaQ = b * ln( exp(A / b) * sumExp - sumOtherExp ) + b * maxVal - q_i
   */
  public static calculateSharesForInvestment(
    quantities: Record<string, number>,
    outcomeId: string,
    amountDollars: number,
    b: number
  ): { shares: number; newQuantities: Record<string, number>; effectivePrice: number } {
    if (amountDollars <= 0) {
      return {
        shares: 0,
        newQuantities: { ...quantities },
        effectivePrice: this.calculatePrices(quantities, b)[outcomeId] || 0.5,
      };
    }

    const currentQ = quantities[outcomeId] ?? 0;
    const outcomeIds = Object.keys(quantities);
    const qArray = outcomeIds.map((id) => quantities[id]);
    const { sumExp, maxVal } = this.logSumExp(qArray, b);

    // sum of exp((q_j/b) - maxVal) for all j != outcomeId
    const sumOtherExp = outcomeIds.reduce((sum, id) => {
      if (id === outcomeId) return sum;
      return sum + Math.exp(quantities[id] / b - maxVal);
    }, 0);

    const ratio = amountDollars / b;
    let deltaQ = 0;

    if (ratio > 500) {
      // For large A/b, exp(-ratio) is practically 0; factor out exp(A/b) to avoid overflow
      const innerLog = Math.max(1e-12, sumExp - Math.exp(-ratio) * sumOtherExp);
      deltaQ = amountDollars + b * Math.log(innerLog) + b * maxVal - currentQ;
    } else {
      const targetVal = Math.exp(ratio) * sumExp - sumOtherExp;
      if (targetVal > 0 && isFinite(targetVal)) {
        deltaQ = b * Math.log(targetVal) + b * maxVal - currentQ;
      } else {
        // Asymptotic factorization fallback
        const innerLog = Math.max(1e-12, sumExp - Math.exp(-ratio) * sumOtherExp);
        deltaQ = amountDollars + b * Math.log(innerLog) + b * maxVal - currentQ;
      }
    }

    // Safety guard against non-finite or non-positive values
    if (!isFinite(deltaQ) || deltaQ <= 0) {
      const currentPrice = Math.max(0.01, this.calculatePrices(quantities, b)[outcomeId] || 0.5);
      deltaQ = amountDollars / currentPrice;
    }

    deltaQ = Math.max(0.01, deltaQ);

    const newQuantities = {
      ...quantities,
      [outcomeId]: currentQ + deltaQ,
    };

    const effectivePrice = amountDollars / deltaQ;

    return {
      shares: Number(deltaQ.toFixed(4)),
      newQuantities,
      effectivePrice: Number(effectivePrice.toFixed(4)),
    };
  }

  /**
   * Calculate cost required to purchase a specific number of shares deltaQ
   */
  public static calculateCostForShares(
    quantities: Record<string, number>,
    outcomeId: string,
    deltaQ: number,
    b: number
  ): number {
    if (deltaQ <= 0) return 0;
    const currentCost = this.cost(quantities, b);
    const newQuantities = {
      ...quantities,
      [outcomeId]: (quantities[outcomeId] || 0) + deltaQ,
    };
    const newCost = this.cost(newQuantities, b);
    return Math.max(0, newCost - currentCost);
  }

  /**
   * Calculate refund returned to user when selling deltaQ shares
   * Refund = C(q) - C(q - deltaQ * e_i)
   */
  public static calculateRefundForSellingShares(
    quantities: Record<string, number>,
    outcomeId: string,
    sharesToSell: number,
    b: number
  ): { refund: number; newQuantities: Record<string, number>; effectivePrice: number } {
    if (sharesToSell <= 0) {
      return {
        refund: 0,
        newQuantities: { ...quantities },
        effectivePrice: this.calculatePrices(quantities, b)[outcomeId] || 0.5,
      };
    }

    const currentQ = quantities[outcomeId] || 0;
    const actualSellShares = sharesToSell; // Allow exact position liquidation without artificial pool cap
    const currentCost = this.cost(quantities, b);
    
    const newQuantities = {
      ...quantities,
      [outcomeId]: currentQ - actualSellShares,
    };

    const newCost = this.cost(newQuantities, b);
    const rawRefund = Math.max(0, currentCost - newCost);
    const effectivePrice = actualSellShares > 0 ? rawRefund / actualSellShares : 0;

    return {
      refund: Number(rawRefund.toFixed(2)),
      newQuantities,
      effectivePrice: Number(effectivePrice.toFixed(4)),
    };
  }

  /**
   * Generate bid and ask prices with market spread
   * @param midPrice Base LMSR probability (0.01 - 0.99)
   * @param spread Half-spread (e.g., 0.015 for 1.5 cents)
   */
  public static getSpreadPrices(midPrice: number, spread: number = 0.015): {
    mid: number;
    buy: number;
    sell: number;
  } {
    const mid = Number(midPrice.toFixed(2));
    const buy = Math.min(0.99, Number((mid + spread).toFixed(2)));
    const sell = Math.max(0.01, Number((mid - spread).toFixed(2)));
    return { mid, buy, sell };
  }

  /**
   * Calculate complete trade quotation including operator commission and spread
   */
  public static getTradeQuote(
    quantities: Record<string, number>,
    outcomeId: string,
    tradeType: 'BUY' | 'SELL',
    inputValue: number, // In BUY: dollar amount; In SELL: share quantity
    b: number,
    commissionRate: number = 0.01,
    spread: number = 0.015
  ) {
    const currentPrices = this.calculatePrices(quantities, b);
    const midPrice = currentPrices[outcomeId] || 0.5;
    const spreadInfo = this.getSpreadPrices(midPrice, spread);

    if (tradeType === 'BUY') {
      const grossInvestment = inputValue;
      const commission = Number((grossInvestment * commissionRate).toFixed(2));
      const spreadCost = Number((grossInvestment * spread).toFixed(2));
      const netToPool = Math.max(0.01, grossInvestment - commission - spreadCost);

      const { shares, newQuantities, effectivePrice } = this.calculateSharesForInvestment(
        quantities,
        outcomeId,
        netToPool,
        b
      );

      const potentialPayout = Number(shares.toFixed(2)); // Each winning share pays $1.00
      const potentialProfit = Number((potentialPayout - grossInvestment).toFixed(2));
      const newProbabilities = this.calculatePrices(newQuantities, b);
      const lmsrCashFlow = Number(netToPool.toFixed(4)); // Exact LMSR trade cash flow: C(newQ) - C(oldQ)

      return {
        tradeType: 'BUY' as const,
        outcomeId,
        shares,
        grossAmount: grossInvestment,
        commission,
        spreadCost,
        netAmount: netToPool,
        lmsrCashFlow,
        effectivePricePerShare: effectivePrice,
        marketMidPrice: midPrice,
        buyPrice: spreadInfo.buy,
        sellPrice: spreadInfo.sell,
        potentialPayout,
        potentialProfit,
        newQuantities,
        newProbabilities,
      };
    } else {
      const sharesToSell = inputValue;
      const { refund: grossRefund, newQuantities, effectivePrice } = this.calculateRefundForSellingShares(
        quantities,
        outcomeId,
        sharesToSell,
        b
      );

      const commission = Number((grossRefund * commissionRate).toFixed(2));
      const spreadCost = Number((grossRefund * spread).toFixed(2));
      const netProceeds = Math.max(0, Number((grossRefund - commission - spreadCost).toFixed(2)));
      const newProbabilities = this.calculatePrices(newQuantities, b);
      const lmsrCashFlow = Number((-grossRefund).toFixed(4)); // Signed LMSR cash flow (negative: refunded from LMSR)

      return {
        tradeType: 'SELL' as const,
        outcomeId,
        shares: sharesToSell,
        grossAmount: grossRefund,
        commission,
        spreadCost,
        netAmount: netProceeds,
        lmsrCashFlow,
        effectivePricePerShare: effectivePrice,
        marketMidPrice: midPrice,
        buyPrice: spreadInfo.buy,
        sellPrice: spreadInfo.sell,
        potentialPayout: 0,
        potentialProfit: 0,
        newQuantities,
        newProbabilities,
      };
    }
  }
}
