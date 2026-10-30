import { describe, it, expect } from 'vitest';
import { Money } from '../src/server/money';

describe('Money Engine - Precision & Accounting Invariants', () => {
  it('eliminates standard floating point rounding errors', () => {
    // Standard JS: 0.1 + 0.2 === 0.30000000000000004
    expect(0.1 + 0.2).not.toBe(0.3);
    // Money helper with decimal.js
    expect(Money.add(0.1, 0.2)).toBe(0.3);
  });

  it('performs exact subtraction and preserves balance identities', () => {
    const startBalance = 1000.0;
    const debit = 49.99;
    const fee = 0.50;

    const afterDebit = Money.subtract(startBalance, debit);
    expect(afterDebit).toBe(950.01);

    const afterFee = Money.subtract(afterDebit, fee);
    expect(afterFee).toBe(949.51);

    // Identity check: start - sum(debits) === final
    expect(Money.subtract(startBalance, Money.add(debit, fee))).toBe(afterFee);
  });

  it('performs safe rounding and cent conversions', () => {
    expect(Money.toCents(12.345)).toBe(1235); // Half-up rounds to 1235 cents ($12.35)
    expect(Money.fromCents(1235)).toBe(12.35);
    expect(Money.round(12.345)).toBe(12.35);
    expect(Money.round(12.344)).toBe(12.34);
  });

  it('handles exact comparisons without epsilon thresholds', () => {
    expect(Money.gte(100.0, 99.99)).toBe(true);
    expect(Money.lte(99.99, 100.0)).toBe(true);
    expect(Money.eq(100.0, 100.0)).toBe(true);
    expect(Money.eq(100.0, Money.round(100.000000000001))).toBe(true);
    expect(Money.gt(100.01, 100.0)).toBe(true);
    expect(Money.lt(99.99, 100.0)).toBe(true);
  });

  it('correctly calculates commissions and percentages', () => {
    const tradeAmount = 50.0;
    const commissionRate = 0.01; // 1%
    const spreadRate = 0.015; // 1.5%

    const commission = Money.multiply(tradeAmount, commissionRate);
    const spreadCost = Money.multiply(tradeAmount, spreadRate);

    expect(commission).toBe(0.5);
    expect(spreadCost).toBe(0.75);

    const netInvestment = Money.subtract(tradeAmount, Money.add(commission, spreadCost));
    expect(netInvestment).toBe(48.75);
  });
});
