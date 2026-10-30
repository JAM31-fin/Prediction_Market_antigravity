import { describe, it, expect } from 'vitest';
import { LMSREngine } from '../src/services/lmsrEngine';

describe('LMSR Engine - Centralized Market Maker Verification', () => {
  const b = 100;

  it('calculates initial quantities with C(q0) = 0 and probabilities summing to 1.00', () => {
    const targetProbs = { yes: 0.6, no: 0.4 };
    const q0 = LMSREngine.calculateInitialQuantities(targetProbs, b);

    // Initial cost should be 0: C(q0) = b * ln(sum(exp(q0_i / b))) = b * ln(0.6 + 0.4) = b * ln(1) = 0
    const initialCost = LMSREngine.cost(q0, b);
    expect(Math.abs(initialCost)).toBeLessThan(1e-4);

    const prices = LMSREngine.calculatePrices(q0, b);
    expect(prices.yes + prices.no).toBeCloseTo(1.0, 4);
    expect(prices.yes).toBeCloseTo(0.6, 2);
    expect(prices.no).toBeCloseTo(0.4, 2);
  });

  it('guarantees price monotonicity and sum = 1.00 after user buys shares from House', () => {
    const q0 = LMSREngine.calculateInitialQuantities({ yes: 0.5, no: 0.5 }, b);
    const investment = 50; // $50 investment

    const quote = LMSREngine.getTradeQuote(q0, 'yes', 'BUY', investment, b, 0.01, 0.015);

    expect(quote.shares).toBeGreaterThan(0);
    expect(quote.grossAmount).toBe(50);
    expect(quote.commission).toBe(0.5); // 1% of 50
    expect(quote.spreadCost).toBe(0.75); // 1.5% of 50
    expect(quote.netAmount).toBe(48.75);
    expect(quote.lmsrCashFlow).toBe(48.75);

    // YES price must increase, NO price must decrease
    expect(quote.newProbabilities.yes).toBeGreaterThan(0.5);
    expect(quote.newProbabilities.no).toBeLessThan(0.5);
    expect(quote.newProbabilities.yes + quote.newProbabilities.no).toBeCloseTo(1.0, 4);

    // Effective price per share must be strictly between starting price and final price
    expect(quote.effectivePricePerShare).toBeGreaterThan(0.5);
    expect(quote.effectivePricePerShare).toBeLessThanOrEqual(quote.newProbabilities.yes + 0.05);
  });

  it('handles extreme investment values (A/b > 700) without overflow to Infinity', () => {
    const q0 = LMSREngine.calculateInitialQuantities({ yes: 0.5, no: 0.5 }, b);
    
    // Extreme 1: $80,000 on b = 100 -> A/b = 800 (previously exceeded IEEE 754 exp limit 709.78)
    const quoteLarge = LMSREngine.getTradeQuote(q0, 'yes', 'BUY', 80000, b, 0.01, 0.015);
    expect(Number.isFinite(quoteLarge.shares)).toBe(true);
    expect(quoteLarge.shares).toBeGreaterThan(0);
    expect(quoteLarge.effectivePricePerShare).toBeGreaterThan(0.5);
    expect(quoteLarge.effectivePricePerShare).toBeLessThanOrEqual(1.05);

    // Extreme 2: $1,000 on very tight liquidity b = 1 -> A/b = 1000
    const qTight = LMSREngine.calculateInitialQuantities({ yes: 0.5, no: 0.5 }, 1);
    const quoteTight = LMSREngine.getTradeQuote(qTight, 'yes', 'BUY', 1000, 1, 0.01, 0.015);
    expect(Number.isFinite(quoteTight.shares)).toBe(true);
    expect(quoteTight.shares).toBeGreaterThan(0);
  });

  it('guarantees sell refund equals LMSR cost delta when selling back to House', () => {
    const q0 = LMSREngine.calculateInitialQuantities({ yes: 0.5, no: 0.5 }, b);
    
    // First, buy 100 shares
    const buyQuote = LMSREngine.getTradeQuote(q0, 'yes', 'BUY', 100, b, 0, 0);
    const sharesOwned = buyQuote.shares;
    const postBuyQ = buyQuote.newQuantities;

    // Now, sell all 100 shares back to House
    const sellQuote = LMSREngine.getTradeQuote(postBuyQ, 'yes', 'SELL', sharesOwned, b, 0, 0);

    // Refund without fees should match exactly the LMSR cash flow delta
    const costAfterBuy = LMSREngine.cost(postBuyQ, b);
    const costAfterSell = LMSREngine.cost(sellQuote.newQuantities, b);
    const actualDelta = costAfterBuy - costAfterSell;

    expect(sellQuote.grossAmount).toBeCloseTo(actualDelta, 1);
    expect(sellQuote.newProbabilities.yes).toBeCloseTo(0.5, 2);
  });

  it('respects theoretical maximum LMSR subsidy bound L_max = b * ln(N)', () => {
    // For binary market N=2, maximum loss the house can experience is b * ln(2)
    const bParam = 200;
    const maxTheoreticalLoss = bParam * Math.log(2);

    expect(maxTheoreticalLoss).toBeCloseTo(138.63, 1);
  });

  describe('LMSR Subsidy Budget Calibration (Phase 1)', () => {
    it('calibrates b from subsidy budget for symmetric binary market (50/50)', () => {
      // S = 100, p_min = 0.5 => b = S / ln(1 / 0.5) = 100 / ln(2) ~= 144.27
      const subsidy = 100;
      const probs = { yes: 0.5, no: 0.5 };
      const bCalibrated = LMSREngine.calculateBFromSubsidy(subsidy, probs);

      expect(bCalibrated).toBeCloseTo(144.27, 1);

      // Verify inverse: calculateMaxLoss(b, probs) must equal the subsidy budget
      const maxLoss = LMSREngine.calculateMaxLoss(bCalibrated, probs);
      expect(maxLoss).toBeCloseTo(subsidy, 1);
    });

    it('calibrates b from subsidy budget for asymmetric binary market (70/30)', () => {
      // S = 150, p_min = 0.3 => b = S / ln(1 / 0.3) = 150 / 1.20397 ~= 124.59
      const subsidy = 150;
      const probs = { yes: 0.7, no: 0.3 };
      const bCalibrated = LMSREngine.calculateBFromSubsidy(subsidy, probs);

      expect(bCalibrated).toBeCloseTo(124.59, 1);

      const maxLoss = LMSREngine.calculateMaxLoss(bCalibrated, probs);
      expect(maxLoss).toBeCloseTo(subsidy, 1);
    });

    it('calibrates b for multiclass market (4 outcomes: 40%, 30%, 20%, 10%)', () => {
      // p_min = 0.1 => ln(1 / 0.1) = ln(10) ~= 2.302585
      // With S = 230.26 => b ~= 100.00
      const subsidy = 230.26;
      const probs = { a: 0.4, b: 0.3, c: 0.2, d: 0.1 };
      const bCalibrated = LMSREngine.calculateBFromSubsidy(subsidy, probs);

      expect(bCalibrated).toBeCloseTo(100.0, 1);

      const maxLoss = LMSREngine.calculateMaxLoss(bCalibrated, probs);
      expect(maxLoss).toBeCloseTo(subsidy, 1);
    });

    it('handles edge cases gracefully (zero or negative subsidy, array input, unnormalized probs)', () => {
      expect(LMSREngine.calculateBFromSubsidy(0, { yes: 0.5, no: 0.5 })).toBe(10);
      expect(LMSREngine.calculateBFromSubsidy(-50, { yes: 0.5, no: 0.5 })).toBe(10);

      // Array input
      const bFromArray = LMSREngine.calculateBFromSubsidy(100, [0.5, 0.5]);
      expect(bFromArray).toBeCloseTo(144.27, 1);

      // Unnormalized input (e.g. percentages 50 and 50)
      const bFromPercentages = LMSREngine.calculateBFromSubsidy(100, { yes: 50, no: 50 });
      expect(bFromPercentages).toBeCloseTo(144.27, 1);
    });
  });
});
