/**
 * Precise Decimal Arithmetic for Monetary Calculations
 * 
 * Powered by decimal.js to guarantee:
 * 1. Zero IEEE-754 precision leakage (e.g. 0.1 + 0.2 === 0.3).
 * 2. Exact half-up rounding to currency cents ($0.01).
 * 3. Strict financial comparisons without epsilon hacks.
 * 4. Auditable accounting conservation: Balance_before + delta === Balance_after.
 */

import Decimal from 'decimal.js';

// Configure default precision for financial operations
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class Money {
  /**
   * Instantiates a Decimal object for internal or advanced high-precision arithmetic
   */
  public static d(val: number | string | Decimal): Decimal {
    return new Decimal(val || 0);
  }

  /**
   * Convert floating dollar amount to integer cents (exact)
   */
  public static toCents(dollars: number): number {
    if (typeof dollars !== 'number' || !isFinite(dollars)) {
      throw new Error(`Invalid monetary amount: ${dollars}`);
    }
    return new Decimal(dollars).times(100).round().toNumber();
  }

  /**
   * Convert integer cents back to 2-decimal floating dollar representation
   */
  public static fromCents(cents: number): number {
    return new Decimal(cents || 0).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Normalize an amount to standard 2-decimal rounded currency
   */
  public static round(dollars: number): number {
    if (typeof dollars !== 'number' || !isFinite(dollars)) return 0;
    return new Decimal(dollars).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Exact addition: a + b
   */
  public static add(a: number, b: number): number {
    return new Decimal(a || 0).plus(b || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Exact subtraction: a - b
   */
  public static subtract(a: number, b: number): number {
    return new Decimal(a || 0).minus(b || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Exact multiplication: amount * rate (rounded to nearest cent)
   */
  public static multiply(amount: number, rate: number): number {
    return new Decimal(amount || 0).times(rate || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Exact division: amount / divisor (rounded to nearest cent)
   */
  public static divide(amount: number, divisor: number): number {
    if (divisor === 0) throw new Error('Division by zero');
    return new Decimal(amount || 0).dividedBy(divisor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Exact comparison: a >= b
   */
  public static gte(a: number, b: number): boolean {
    return new Decimal(a || 0).gte(new Decimal(b || 0));
  }

  /**
   * Exact comparison: a > b
   */
  public static gt(a: number, b: number): boolean {
    return new Decimal(a || 0).gt(new Decimal(b || 0));
  }

  /**
   * Exact comparison: a === b
   */
  public static eq(a: number, b: number): boolean {
    return new Decimal(a || 0).eq(new Decimal(b || 0));
  }

  /**
   * Exact comparison: a < b
   */
  public static lt(a: number, b: number): boolean {
    return new Decimal(a || 0).lt(new Decimal(b || 0));
  }

  /**
   * Exact comparison: a <= b
   */
  public static lte(a: number, b: number): boolean {
    return new Decimal(a || 0).lte(new Decimal(b || 0));
  }
}
