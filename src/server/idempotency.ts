/**
 * Idempotency Key Manager
 * 
 * Protects against duplicate requests, network retries, or double-clicks
 * creating unintended duplicate trades or transactions.
 */

interface IdempotencyRecord<T> {
  key: string;
  userId: string;
  result?: T;
  error?: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: number;
}

export class IdempotencyManager {
  private records: Map<string, IdempotencyRecord<any>> = new Map();
  private readonly ttlMs: number;

  constructor(ttlMinutes = 15) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (now - record.createdAt > this.ttlMs) {
        this.records.delete(key);
      }
    }
  }

  /**
   * Check or acquire idempotency lock
   */
  public check<T>(key: string, userId: string): { cached?: T; isDuplicate: boolean; pending: boolean } {
    this.cleanExpired();
    const existing = this.records.get(key);
    if (!existing) {
      return { isDuplicate: false, pending: false };
    }

    if (existing.userId !== userId) {
      // Key belongs to another user
      return { isDuplicate: false, pending: false };
    }

    if (existing.status === 'PENDING') {
      return { isDuplicate: true, pending: true };
    }

    if (existing.status === 'COMPLETED') {
      return { cached: existing.result, isDuplicate: true, pending: false };
    }

    return { isDuplicate: false, pending: false };
  }

  public recordPending(key: string, userId: string): void {
    this.records.set(key, {
      key,
      userId,
      status: 'PENDING',
      createdAt: Date.now(),
    });
  }

  public recordSuccess<T>(key: string, userId: string, result: T): void {
    this.records.set(key, {
      key,
      userId,
      result,
      status: 'COMPLETED',
      createdAt: Date.now(),
    });
  }

  public recordFailure(key: string, userId: string, error: string): void {
    this.records.set(key, {
      key,
      userId,
      error,
      status: 'FAILED',
      createdAt: Date.now(),
    });
  }
}

export const idempotencyManager = new IdempotencyManager();
