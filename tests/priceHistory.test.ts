import { describe, it, expect } from 'vitest';
import { compactPriceHistory } from '../src/server/dbService';
import { PricePoint } from '../src/types';

describe('Price History Compaction & Temporal Bucketing', () => {
  const basePrices = { 'yes': 0.5, 'no': 0.5 };
  const now = 1761696000000; // Fixed timestamp reference

  it('preserves genesis opening point and appends new trade points', () => {
    const genesisTime = now - 3600000 * 2;
    const history: PricePoint[] = [];

    const newPoint: PricePoint = {
      timestamp: now,
      timeLabel: '20:00',
      prices: { 'yes': 0.6, 'no': 0.4 },
      volume: 100,
    };

    const compacted = compactPriceHistory(history, newPoint, genesisTime);
    expect(compacted).toHaveLength(2);
    expect(compacted[0].timestamp).toBe(genesisTime);
    expect(compacted[0].volume).toBe(0);
    expect(compacted[1].timestamp).toBe(now);
    expect(compacted[1].prices['yes']).toBe(0.6);
  });

  it('deduplicates and updates when trades occur within the same second (<1000ms)', () => {
    const history: PricePoint[] = [
      {
        timestamp: now,
        timeLabel: '20:00:01',
        prices: { 'yes': 0.55, 'no': 0.45 },
        volume: 50,
      },
    ];

    const rapidSecondTrade: PricePoint = {
      timestamp: now + 300, // 300ms later in same second
      timeLabel: '20:00:01',
      prices: { 'yes': 0.65, 'no': 0.35 },
      volume: 150,
    };

    const result = compactPriceHistory(history, rapidSecondTrade);
    expect(result).toHaveLength(1);
    expect(result[0].prices['yes']).toBe(0.65);
    expect(result[0].volume).toBe(150);
  });

  it('keeps high-resolution detail for trades under 1 hour, and buckets older trades', () => {
    const history: PricePoint[] = [];
    const genesisTime = now - 3600000 * 5; // 5 hours ago

    // Insert 60 trades spaced every 2 minutes across 5 hours (multiple trades per 5m bucket)
    for (let i = 60; i >= 1; i--) {
      const ts = now - i * 120000; // spaced every 2 minutes
      history.push({
        timestamp: ts,
        timeLabel: `${i}m`,
        prices: { 'yes': 0.5 + i * 0.002, 'no': 0.5 - i * 0.002 },
        volume: i * 10,
      });
    }

    const latestPoint: PricePoint = {
      timestamp: now,
      timeLabel: 'Now',
      prices: { 'yes': 0.75, 'no': 0.25 },
      volume: 1000,
    };

    const result = compactPriceHistory(history, latestPoint, genesisTime);
    // Genesis point is strictly preserved
    expect(result[0].timestamp).toBe(genesisTime);
    // Latest point is strictly preserved
    expect(result[result.length - 1].timestamp).toBe(now);
    expect(result[result.length - 1].prices['yes']).toBe(0.75);
    // Trades in the 1h..5h range get compacted from 2m intervals into 5m buckets, so total points is well below 60
    expect(result.length).toBeLessThan(50);
  });

  it('enforces hard-cap ceiling so payloads remain lightweight', () => {
    const history: PricePoint[] = [];
    const genesisTime = now - 3600000 * 24 * 30; // 30 days ago

    // Generate 500 points
    for (let i = 500; i >= 1; i--) {
      history.push({
        timestamp: now - i * 60000,
        timeLabel: `${i}m`,
        prices: basePrices,
        volume: 500 - i,
      });
    }

    const latest: PricePoint = {
      timestamp: now,
      timeLabel: 'Now',
      prices: { 'yes': 0.9, 'no': 0.1 },
      volume: 9999,
    };

    const result = compactPriceHistory(history, latest, genesisTime);
    expect(result.length).toBeLessThanOrEqual(250);
    expect(result[0].timestamp).toBe(genesisTime);
    expect(result[result.length - 1].timestamp).toBe(now);
  });
});
