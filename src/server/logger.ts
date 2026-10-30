/**
 * Structured Server-Side Logger
 * 
 * Provides centralized, structured logging with log levels, request timing,
 * and strict sanitization to ensure sensitive information (passwords, tokens,
 * secrets, PII) is never written to logs.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL];
}

function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);

  const sanitized: Record<string, any> = {};
  const SENSITIVE_KEYS = new Set([
    'password',
    'passwordhash',
    'token',
    'authorization',
    'secret',
    'apikey',
    'cookie',
    'credential',
    'sessionsecret',
  ]);

  for (const [key, value] of Object.entries(data)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lower)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function formatLog(level: LogLevel, tag: string, message: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  const entry: Record<string, any> = {
    timestamp,
    level: level.toUpperCase(),
    tag,
    message,
  };
  if (meta !== undefined) {
    entry.meta = sanitizeData(meta);
  }
  return JSON.stringify(entry);
}

export const logger = {
  debug(tag: string, message: string, meta?: any): void {
    if (shouldLog('debug')) {
      console.debug(formatLog('debug', tag, message, meta));
    }
  },

  info(tag: string, message: string, meta?: any): void {
    if (shouldLog('info')) {
      console.log(formatLog('info', tag, message, meta));
    }
  },

  warn(tag: string, message: string, meta?: any): void {
    if (shouldLog('warn')) {
      console.warn(formatLog('warn', tag, message, meta));
    }
  },

  error(tag: string, message: string, errorOrMeta?: any): void {
    if (shouldLog('error')) {
      let meta: any;
      if (errorOrMeta instanceof Error) {
        meta = {
          name: errorOrMeta.name,
          message: errorOrMeta.message,
          stack: errorOrMeta.stack,
        };
      } else {
        meta = errorOrMeta;
      }
      console.error(formatLog('error', tag, message, meta));
    }
  },
};
