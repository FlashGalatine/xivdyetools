/**
 * @xivdyetools/logger - Console Adapter
 *
 * Logger adapter that outputs to the console with pretty formatting.
 * Best for development and debugging.
 *
 * @module adapters/console-adapter
 */

import { BaseLogger } from '../core/base-logger.js';
import type { LogEntry, LoggerConfig } from '../types.js';

/**
 * Console logger adapter with pretty or JSON formatting
 *
 * Outputs logs to the console using appropriate console methods
 * (console.debug, console.info, console.warn, console.error).
 *
 * @example
 * ```typescript
 * const logger = new ConsoleAdapter({ format: 'pretty', prefix: 'MyApp' });
 * logger.info('Server started', { port: 3000 });
 * // Output: [2024-01-15T10:30:00.000Z] [MyApp] Server started {"port":3000}
 * ```
 */
export class ConsoleAdapter extends BaseLogger {
  constructor(config: Partial<LoggerConfig> = {}) {
    super({
      format: 'pretty',
      ...config,
    });
  }

  protected write(entry: LogEntry): void {
    if (this.config.format === 'pretty') {
      this.writePretty(entry);
    } else {
      this.writeJson(entry);
    }
  }

  /**
   * Write a log entry with pretty formatting
   */
  private writePretty(entry: LogEntry): void {
    const { level, message, timestamp, context, error } = entry;

    // Build the log line
    const parts: string[] = [];

    if (this.config.timestamps) {
      parts.push(`[${timestamp}]`);
    }

    parts.push(message);

    // Add context as JSON if present
    if (context && Object.keys(context).length > 0) {
      parts.push(JSON.stringify(context));
    }

    const logLine = parts.join(' ');

    // Use appropriate console method
    switch (level) {
      case 'debug':
        if (error) {
          console.debug(logLine, error);
        } else {
          console.debug(logLine);
        }
        break;
      case 'info':
        if (error) {
          console.info(logLine, error);
        } else {
          console.info(logLine);
        }
        break;
      case 'warn':
        if (error) {
          console.warn(logLine, error);
        } else {
          console.warn(logLine);
        }
        break;
      case 'error':
        if (error) {
          console.error(logLine, error);
        } else {
          console.error(logLine);
        }
        break;
    }
  }

  /**
   * Write a log entry as JSON
   */
  private writeJson(entry: LogEntry): void {
    const jsonStr = JSON.stringify(entry);

    switch (entry.level) {
      case 'debug':
        console.debug(jsonStr);
        break;
      case 'info':
        console.info(jsonStr);
        break;
      case 'warn':
        console.warn(jsonStr);
        break;
      case 'error':
        console.error(jsonStr);
        break;
    }
  }
}
