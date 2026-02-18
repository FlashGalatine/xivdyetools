/**
 * @xivdyetools/logger - No-Op Adapter
 *
 * Logger adapter that discards all output.
 * Used as a default for libraries to prevent log pollution.
 *
 * @module adapters/noop-adapter
 */

import { BaseLogger } from '../core/base-logger.js';
import type { LogEntry, LoggerConfig } from '../types.js';

/**
 * No-op logger adapter that discards all output
 *
 * Use this when you want logging calls to have no effect,
 * such as:
 * - Default logger for libraries (to not pollute consumer logs)
 * - Disabling logging in tests
 * - Silent mode
 *
 * @example
 * ```typescript
 * // In a library
 * export class DyeService {
 *   constructor(private logger: Logger = new NoopAdapter()) {}
 *
 *   findDye(id: number) {
 *     this.logger.debug('Finding dye', { id }); // Silent by default
 *   }
 * }
 *
 * // Consumer can enable logging:
 * const service = new DyeService(new ConsoleAdapter());
 * ```
 */
export class NoopAdapter extends BaseLogger {
  constructor(config: Partial<LoggerConfig> = {}) {
    // Set level to error to minimize processing (though write does nothing anyway)
    super({
      level: 'error',
      format: 'json',
      timestamps: false,
      sanitizeErrors: false,
      ...config,
    });
  }

  protected write(_entry: LogEntry): void {
    // Intentionally empty - all logs are discarded
  }
}
