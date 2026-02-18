/**
 * @xivdyetools/logger - JSON Adapter
 *
 * Logger adapter that outputs structured JSON to stdout.
 * Best for production environments and log aggregation.
 *
 * @module adapters/json-adapter
 */

import { BaseLogger } from '../core/base-logger.js';
import type { LogEntry, LoggerConfig } from '../types.js';

/**
 * JSON logger adapter for structured logging
 *
 * Outputs all logs as JSON to stdout via console.log.
 * This format is ideal for log aggregation services like
 * Cloudflare Logs, Datadog, or ELK stack.
 *
 * @example
 * ```typescript
 * const logger = new JsonAdapter({ level: 'info' });
 * logger.info('Request received', { path: '/api/dyes', method: 'GET' });
 * // Output: {"level":"info","message":"Request received","timestamp":"...","context":{"path":"/api/dyes","method":"GET"}}
 * ```
 */
export class JsonAdapter extends BaseLogger {
  constructor(config: Partial<LoggerConfig> = {}) {
    super({
      format: 'json',
      timestamps: true,
      sanitizeErrors: true,
      ...config,
    });
  }

  protected write(entry: LogEntry): void {
    // All JSON output goes to console.log for consistent handling
    // by log aggregation systems (Cloudflare, etc.)
    console.log(JSON.stringify(entry));
  }
}
