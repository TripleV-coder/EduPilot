/**
 * Structured Logging System
 * Provides consistent logging across the application
 */

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// ---------------------------------------------------------------------------
// N56 (Lot 6) — aucune donnée personnelle dans les journaux. Des appels réels y
// écrivaient l'email de la personne, un numéro de téléphone ou le texte d'une
// erreur citant un email. Le masquage est fait ici, pour tous les appelants :
// message, contexte (même imbriqué) et texte des erreurs.
// ---------------------------------------------------------------------------

const MASKED = "[masqué]";
const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;
// 8 à 15 chiffres, séparés au plus par un espace ou un point ; jamais collés à
// des lettres (identifiants) ni séparés par des tirets (dates).
const PHONE = /(?<![\w+])\+?\d(?:[ .]?\d){7,14}(?!\w)/g;
const SECRET_KEY = /pass(?:word|wd)?|token|secret|authorization|cookie|otp|api[-_]?key/i;
const PERSONAL_KEY = /^(?:firstName|lastName|fullName|birthPlace|dateOfBirth|birthDate|address|nationality)$/i;
const MAX_DEPTH = 6;

export function redactText(text: string): string {
  return text
    .replace(EMAIL, (_match, first: string, domain: string) => `${first}***@${domain}`)
    .replace(PHONE, (match) => `[tél. ***${match.replace(/\D/g, "").slice(-2)}]`);
}

function redactValue(value: unknown, key: string | undefined, depth: number): unknown {
  if (key !== undefined && (SECRET_KEY.test(key) || PERSONAL_KEY.test(key))) return MASKED;
  if (typeof value === "string") return redactText(value);
  if (depth >= MAX_DEPTH || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redactValue(item, undefined, depth + 1));
  if (value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, redactValue(v, k, depth + 1)]),
  );
}

/**
 * Format log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  const { timestamp, level, message, context, error } = entry;

  if (process.env.NODE_ENV === "production") {
    // JSON format for production (easy parsing by log aggregators)
    return JSON.stringify(entry);
  }

  // Pretty format for development
  let output = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

  if (context && Object.keys(context).length > 0) {
    output += `\n  Context: ${JSON.stringify(context, null, 2)}`;
  }

  if (error) {
    output += `\n  Error: ${error.name}: ${error.message}`;
    if (error.stack) {
      output += `\n  Stack: ${error.stack}`;
    }
  }

  return output;
}

/**
 * Create log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: redactText(message),
  };

  if (context) {
    entry.context = redactValue(context, undefined, 0) as LogContext;
  }

  if (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    entry.error = {
      name: err.name,
      message: redactText(err.message),
      stack: err.stack ? redactText(err.stack) : undefined,
    };
  }

  return entry;
}

/**
 * Log to appropriate output
 */
function log(entry: LogEntry): void {
  const formatted = formatLogEntry(entry);

  switch (entry.level) {
    case LogLevel.DEBUG:
      console.debug(formatted);
      break;
    case LogLevel.INFO:
      console.info(formatted);
      break;
    case LogLevel.WARN:
      console.warn(formatted);
      break;
    case LogLevel.ERROR:
      console.error(formatted);
      break;
  }
}

/**
 * Logger class with structured logging methods
 */
export class Logger {
  private context: LogContext;

  constructor(defaultContext: LogContext = {}) {
    this.context = defaultContext;
  }

  /**
   * Merge additional context with default context
   */
  private mergeContext(additionalContext?: LogContext): LogContext {
    return { ...this.context, ...additionalContext };
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === "production") {
      return; // Skip debug logs in production
    }
    log(createLogEntry(LogLevel.DEBUG, message, this.mergeContext(context)));
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    log(createLogEntry(LogLevel.INFO, message, this.mergeContext(context)));
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    log(createLogEntry(LogLevel.WARN, message, this.mergeContext(context)));
  }

  /**
   * Log error message
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    log(createLogEntry(LogLevel.ERROR, message, this.mergeContext(context), error));
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger(this.mergeContext(additionalContext));
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger({
  app: "edupilot",
  environment: process.env.NODE_ENV || "development",
});

/**
 * Create logger for specific module
 */
export function createLogger(module: string, additionalContext?: LogContext): Logger {
  return logger.child({ module, ...additionalContext });
}

/**
 * Log API request
 */
export function logApiRequest(
  method: string,
  path: string,
  userId?: string,
  duration?: number
): void {
  logger.info("API Request", {
    method,
    path,
    userId,
    duration: duration ? `${duration}ms` : undefined,
  });
}

/**
 * Log API error
 */
export function logApiError(
  method: string,
  path: string,
  error: Error,
  userId?: string
): void {
  logger.error(`API Error: ${method} ${path}`, error, {
    method,
    path,
    userId,
  });
}

/**
 * Log database query (only in development)
 */
export function logDatabaseQuery(query: string, duration?: number): void {
  if (process.env.NODE_ENV === "development") {
    logger.debug("Database Query", {
      query,
      duration: duration ? `${duration}ms` : undefined,
    });
  }
}
