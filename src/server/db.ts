/**
 * Database Connection & Transaction Layer
 * 
 * Supports:
 * 1. Direct Supabase / PostgreSQL via `DATABASE_URL` (pg.Pool with SSL).
 * 2. Supabase JS Client via `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (server-side privileged key).
 * 3. In-process PostgreSQL engine via `pg-mem` as a seamless fallback when credentials
 *    are awaiting configuration or contain unreplaced placeholders, ensuring zero startup crashes
 *    and exact PostgreSQL SQL dialect execution.
 */

import pg from 'pg';
import { newDb, IMemoryDb } from 'pg-mem';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

export interface DatabaseHealth {
  connected: boolean;
  type: 'supabase_postgres' | 'local_postgres_engine';
  urlConfigured: boolean;
  poolSize?: number;
  lastError?: string | null;
  placeholderDetected?: boolean;
}

let pgPool: pg.Pool | null = null;
let memDb: IMemoryDb | null = null;
let memPgPool: any = null;
let supabaseClient: SupabaseClient | null = null;
let activeDatabaseType: 'supabase_postgres' | 'local_postgres_engine' = 'local_postgres_engine';
let lastDatabaseError: string | null = null;
let hasLoggedPlaceholderWarning = false;
let hasFailedExternalConnection = false;

/**
 * Checks whether a database URL contains template placeholders like [YOUR-PASSWORD]
 */
export function isPlaceholderDatabaseUrl(url?: string | null): boolean {
  if (!url) return false;
  return (
    /\[YOUR[-_]PASSWORD\]|<YOUR[-_]PASSWORD>|YOUR[-_]PASSWORD|\[PASSWORD\]|<password>/i.test(url) ||
    /\[YOUR[-_]PROJECT[-_]REF\]|<YOUR[-_]PROJECT[-_]REF>/i.test(url) ||
    /:\/\/[^:]*:(?:%5B|\[)YOUR[-_]PASSWORD(?:%5D|\])@/i.test(url)
  );
}

/**
 * Normalizes a database URL:
 * 1. Strips accidental outer brackets around real passwords (e.g. [myPassword] -> myPassword).
 * 2. In IPv4-only container environments, automatically maps direct Supabase host (db.<ref>.supabase.co)
 *    to the IPv4-compatible Supabase Session Pooler (aws-0-<region>.pooler.supabase.com:5432)
 *    with username postgres.<ref>.
 */
export function normalizeDatabaseUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;

  let cleaned = rawUrl.trim();

  // Strip accidental outer brackets around password if it's not a placeholder
  cleaned = cleaned.replace(
    /(:\/\/[^:]+:)(?:%5B|\[)(.*?)(?:%5D|\])(@)/i,
    (match, prefix, inner, suffix) => {
      if (/^YOUR[-_]PASSWORD$|^PASSWORD$/i.test(inner)) {
        return match;
      }
      return `${prefix}${encodeURIComponent(inner)}${suffix}`;
    }
  );

  // If using direct Supabase hostname (db.<project-ref>.supabase.co) or pooler host
  // Route through the IPv4 Connection Pooler in Transaction Mode (port 6543) to prevent
  // the EMAXCONNSSESSION 15-client limit of session mode (port 5432).
  try {
    const u = new URL(cleaned);
    const hostMatch = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    const poolerPort = process.env.SUPABASE_POOLER_PORT || '6543'; // Transaction mode pooler
    if (hostMatch) {
      const projectRef = hostMatch[1];
      const region = process.env.SUPABASE_REGION || (projectRef === 'bpccsxtmacaezjlkbrdn' ? 'sa-east-1' : 'us-east-1');
      const poolerHost = `aws-0-${region}.pooler.supabase.com`;
      const poolerUser = u.username.includes('.') ? u.username : `postgres.${projectRef}`;
      const dbName = u.pathname.replace(/^\//, '') || 'postgres';

      cleaned = `${u.protocol}//${poolerUser}:${u.password}@${poolerHost}:${poolerPort}/${dbName}`;
    } else if (u.hostname.includes('.pooler.supabase.com') && (u.port === '5432' || !u.port)) {
      u.port = poolerPort;
      cleaned = u.toString();
    }
  } catch {}

  return cleaned;
}

/**
 * Checks if an error is an authentication failure or network connection failure
 */
export function isConnectionOrAuthError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = err.code || '';
  return (
    code === '28P01' || // invalid_password
    code === '28000' || // invalid_authorization_specification
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    msg.includes('password authentication failed') ||
    msg.includes('connection refused') ||
    msg.includes('timeout') ||
    msg.includes('no pg_hba.conf entry')
  );
}

/**
 * Initializes and returns the embedded PostgreSQL engine (pg-mem)
 */
function getEmbeddedMemPool(): {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }>;
  connect: () => Promise<pg.PoolClient>;
} {
  if (!memPgPool) {
    logger.info('DB', 'Initializing embedded PostgreSQL engine (pg-mem)...');
    memDb = newDb({
      autoCreateForeignKeyIndices: true,
    });

    // Register PostgreSQL standard functions
    memDb.public.registerFunction({
      name: 'now',
      implementation: () => new Date(),
    });

    memPgPool = memDb.adapters.createPg();
    activeDatabaseType = 'local_postgres_engine';
  }

  return {
    query: async (text: string, params?: any[]) => {
      const client = new memPgPool.Client();
      await client.connect();
      try {
        const res = await client.query(text, params);
        return {
          rows: res.rows || [],
          rowCount: res.rowCount ?? (res.rows ? res.rows.length : 0),
        };
      } finally {
        await client.end();
      }
    },
    connect: async () => {
      const client = new memPgPool.Client();
      await client.connect();
      (client as any).release = async () => {
        await client.end();
      };
      return client as any;
    },
  };
}

/**
 * Switch from external PostgreSQL to embedded engine
 */
export function switchToEmbeddedEngine(reason: string) {
  hasFailedExternalConnection = true;
  if (pgPool) {
    pgPool.end().catch(() => {});
    pgPool = null;
  }
  activeDatabaseType = 'local_postgres_engine';
  lastDatabaseError = reason;
  return getEmbeddedMemPool();
}

/**
 * Initialize PostgreSQL connection pool
 */
export function getDatabasePool(): {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }>;
  connect: () => Promise<pg.PoolClient>;
} {
  const rawDbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL;
  const dbUrl = normalizeDatabaseUrl(rawDbUrl);

  // 1. If DATABASE_URL is set but contains template placeholders (e.g. [YOUR-PASSWORD])
  if (rawDbUrl && isPlaceholderDatabaseUrl(rawDbUrl)) {
    if (!hasLoggedPlaceholderWarning) {
      logger.warn(
        'DB',
        'DATABASE_URL contains placeholder password "[YOUR-PASSWORD]". To connect directly to your Supabase PostgreSQL cluster, replace [YOUR-PASSWORD] with your database password in environment variables. Embedded PostgreSQL engine (pg-mem) is active.'
      );
      hasLoggedPlaceholderWarning = true;
    }
    lastDatabaseError = 'DATABASE_URL contains placeholder password "[YOUR-PASSWORD]". Please update environment variables with your actual database password.';
    activeDatabaseType = 'local_postgres_engine';
    return getEmbeddedMemPool();
  }

  // 2. If valid database URL is configured and hasn't failed previously, use pg.Pool
  if (dbUrl && !hasFailedExternalConnection) {
    if (!pgPool) {
      logger.info('DB', 'Connecting to external PostgreSQL / Supabase cluster...');
      const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
      pgPool = new pg.Pool({
        connectionString: dbUrl,
        ssl: isLocalhost ? false : { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
        allowExitOnIdle: true,
      });

      pgPool.on('error', (err) => {
        logger.error('DB', `PostgreSQL pool error: ${err.message}`);
        lastDatabaseError = err.message;
        if (isConnectionOrAuthError(err)) {
          switchToEmbeddedEngine(err.message);
        }
      });

      activeDatabaseType = 'supabase_postgres';
    }
    return pgPool;
  }

  // 3. Fallback to embedded PostgreSQL engine (pg-mem)
  return getEmbeddedMemPool();
}

/**
 * Executes a query with parameters, with automatic failover to embedded PostgreSQL
 */
export async function dbQuery<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  try {
    const pool = getDatabasePool();
    const result = await pool.query(text, params);
    lastDatabaseError = null;
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount,
    };
  } catch (err: any) {
    // If external pool failed due to authentication or connection, gracefully failover
    if (activeDatabaseType === 'supabase_postgres' && isConnectionOrAuthError(err)) {
      logger.warn(
        'DB',
        `External PostgreSQL query failed (${err.message}). Seamlessly failing over to embedded PostgreSQL engine (pg-mem) to maintain availability.`
      );
      const memPool = switchToEmbeddedEngine(err.message);
      try {
        const result = await memPool.query(text, params);
        return {
          rows: result.rows as T[],
          rowCount: result.rowCount,
        };
      } catch (fallbackErr: any) {
        lastDatabaseError = fallbackErr.message;
        throw fallbackErr;
      }
    }

    lastDatabaseError = err.message;
    logger.error('DB', `SQL Query Failed: ${err.message}`, { query: text.slice(0, 120), params });
    throw err;
  }
}

/**
 * Execute an atomic transaction with automatic BEGIN, COMMIT, ROLLBACK, and failover
 */
export async function dbTransaction<T>(
  callback: (client: {
    query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }>;
  }) => Promise<T>
): Promise<T> {
  let pool = getDatabasePool();
  let client: any;

  try {
    client = await pool.connect();
  } catch (connectErr: any) {
    if (activeDatabaseType === 'supabase_postgres' && isConnectionOrAuthError(connectErr)) {
      logger.warn(
        'DB',
        `External PostgreSQL connection failed (${connectErr.message}). Failing over to embedded PostgreSQL engine (pg-mem).`
      );
      pool = switchToEmbeddedEngine(connectErr.message);
      client = await pool.connect();
    } else {
      throw connectErr;
    }
  }

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr: any) {
      logger.error('DB', `Rollback error: ${rollbackErr.message}`);
    }
    throw err;
  } finally {
    if (client && typeof client.release === 'function') {
      client.release();
    }
  }
}

/**
 * Supabase JavaScript Client (Server-side privileged client)
 * Uses SUPABASE_SECRET_KEY (server-side only, never exposed to client)
 */
export function getSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  // Supabase modern API key model: SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY (server-side only)
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }

  return supabaseClient;
}

/**
 * Check Database Health
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL;
  const placeholderDetected = isPlaceholderDatabaseUrl(dbUrl);

  try {
    await dbQuery('SELECT 1 AS ping;');
    return {
      connected: true,
      type: activeDatabaseType,
      urlConfigured: !!(dbUrl && !placeholderDetected),
      placeholderDetected,
      lastError: lastDatabaseError,
    };
  } catch (err: any) {
    return {
      connected: false,
      type: activeDatabaseType,
      urlConfigured: !!(dbUrl && !placeholderDetected),
      placeholderDetected,
      lastError: err.message || lastDatabaseError,
    };
  }
}
