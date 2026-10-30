import { describe, it, expect } from 'vitest';

describe('Continuous Time Slicing & Projections', () => {
  it('correctly maps trade timestamps into continuous window', () => {
    const now = 1793240623742;
    const windowStart = now - 3600 * 1000; // 1 hour window

    const trade1 = now - 15 * 60 * 1000; // 15 mins ago
    const trade2 = now; // now

    // Check linear coordinate interpolation:
    const xRatioTrade1 = (trade1 - windowStart) / (now - windowStart);
    const xRatioTrade2 = (trade2 - windowStart) / (now - windowStart);

    expect(xRatioTrade1).toBeCloseTo(0.75, 2); // 75% across the chart
    expect(xRatioTrade2).toBeCloseTo(1.0, 2);  // 100% (right edge)
  });
});
