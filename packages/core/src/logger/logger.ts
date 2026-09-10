export type LogCategory =
  | 'camera'
  | 'vision'
  | 'recognition'
  | 'liveness'
  | 'security'
  | 'platform'
  | 'storage'
  | 'ui'
  | 'automation';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  category: LogCategory;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

// Prohibited keys that MUST NEVER appear in logs
const SENSITIVE_KEYS = new Set([
  'embedding',
  'embeddings',
  'vector',
  'rawimage',
  'framebuffer',
  'password',
  'secret',
  'token',
  'key',
  'keychain',
]);

export class Logger {
  private static buffer: LogEntry[] = [];
  private static maxBufferEntries = 1000;
  private static minLevel: LogLevel = 'info';

  public static setLogLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  public static log(
    category: LogCategory,
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    const levelOrder: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levelOrder[level] < levelOrder[this.minLevel]) {
      return;
    }

    const sanitizedMeta = this.sanitizeMetadata(metadata);
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      category,
      level,
      message,
      metadata: sanitizedMeta,
    };

    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferEntries) {
      this.buffer.shift();
    }

    const logStr = `[${entry.timestamp}] [${level.toUpperCase()}] [${category}] ${message}`;
    if (level === 'error') {
      console.error(logStr, sanitizedMeta ?? '');
    } else if (level === 'warn') {
      console.warn(logStr, sanitizedMeta ?? '');
    } else {
      console.log(logStr, sanitizedMeta ?? '');
    }
  }

  public static debug(category: LogCategory, msg: string, meta?: Record<string, unknown>): void {
    this.log(category, 'debug', msg, meta);
  }

  public static info(category: LogCategory, msg: string, meta?: Record<string, unknown>): void {
    this.log(category, 'info', msg, meta);
  }

  public static warn(category: LogCategory, msg: string, meta?: Record<string, unknown>): void {
    this.log(category, 'warn', msg, meta);
  }

  public static error(category: LogCategory, msg: string, meta?: Record<string, unknown>): void {
    this.log(category, 'error', msg, meta);
  }

  public static getRecentLogs(limit: number = 100): LogEntry[] {
    return this.buffer.slice(-limit);
  }

  public static exportPrivacySafeDiagnostics(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        entriesCount: this.buffer.length,
        logs: this.buffer,
      },
      null,
      2
    );
  }

  public static clear(): void {
    this.buffer = [];
  }

  private static sanitizeMetadata(raw?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!raw) return undefined;
    const sanitized: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(raw)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lower)) {
        sanitized[key] = '[REDACTED_BIOMETRIC_OR_SECRET]';
      } else if (val instanceof Float32Array || val instanceof Uint8Array || Array.isArray(val) && val.length > 50) {
        sanitized[key] = `[Array length: ${val.length} REDACTED]`;
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = this.sanitizeMetadata(val as Record<string, unknown>);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }
}
