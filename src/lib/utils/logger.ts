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
    message,
  };

  if (context) {
    entry.context = context;
  }

  if (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    entry.error = {
      name: err.name,
      message: err.message,
      stack: err.stack,
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
