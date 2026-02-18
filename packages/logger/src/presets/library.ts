/**
 * @xivdyetools/logger - Library Preset
 *
 * Pre-configured loggers for library use (xivdyetools-core).
 * Maintains backward compatibility with existing Logger interface.
 *
 * @module presets/library
 */

import { ConsoleAdapter } from '../adapters/console-adapter.js';
import { NoopAdapter } from '../adapters/noop-adapter.js';
import type { Logger, LoggerConfig } from '../types.js';

/**
 * No-op logger that suppresses all output
 *
 * This is the default logger for libraries to prevent
 * polluting consumer application logs.
 *
 * @example
 * ```typescript
 * import { NoOpLogger, DyeService } from 'xivdyetools-core';
 *
 * // Default behavior - no console output
 * const service = new DyeService();
 *
 * // Explicitly pass NoOpLogger (same effect)
 * const service2 = new DyeService({ logger: NoOpLogger });
 * ```
 */
export const NoOpLogger: Logger = new NoopAdapter();

/**
 * Console logger for development and debugging
 *
 * Use this when you want to see library log messages in the console.
 * Prefixes all messages with [xivdyetools] for easy identification.
 *
 * @example
 * ```typescript
 * import { ConsoleLogger, DyeService } from 'xivdyetools-core';
 *
 * // Enable verbose logging during development
 * const dyeService = new DyeService({ logger: ConsoleLogger });
 *
 * // Now library logs will appear:
 * // [2024-01-15T10:30:00.000Z] [xivdyetools] Loading dye database...
 * ```
 */
export const ConsoleLogger: Logger = new ConsoleAdapter({
  level: 'debug',
  format: 'pretty',
  timestamps: true,
  prefix: 'xivdyetools',
});

/**
 * Create a custom library logger with a specific prefix
 *
 * Use this to create loggers with custom prefixes for different
 * library modules.
 *
 * @example
 * ```typescript
 * // Create a logger for a specific module
 * const colorLogger = createLibraryLogger('xivdyetools:color');
 * colorLogger.debug('Converting hex to RGB', { hex: '#FF0000' });
 * // Output: [xivdyetools:color] Converting hex to RGB {"hex":"#FF0000"}
 * ```
 */
export function createLibraryLogger(
  prefix: string,
  config: Partial<LoggerConfig> = {}
): Logger {
  return new ConsoleAdapter({
    level: 'debug',
    format: 'pretty',
    timestamps: true,
    prefix,
    ...config,
  });
}

/**
 * Logger interface type export
 *
 * Re-export for consumers who need to type their logger parameters.
 *
 * @example
 * ```typescript
 * import type { Logger } from '@xivdyetools/logger/library';
 *
 * class MyService {
 *   constructor(private logger: Logger = NoOpLogger) {}
 * }
 * ```
 */
export type { Logger };
