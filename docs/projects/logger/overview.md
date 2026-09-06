# Logger Package Overview

**@xivdyetools/logger** - Unified logging across environments

---

## What is @xivdyetools/logger?

A logging package that works consistently across browser, Node.js, and Cloudflare
Workers. Structured entries, configurable levels, child loggers with inherited
context, and three layers of secret redaction on by default.

---

## Installation

```bash
npm install @xivdyetools/logger
```

---

## Choosing a factory

There is **no** generic `createLogger()`. Pick the preset that matches the
runtime — each returns a ready-made logger rather than taking a name string:

| Factory | Subpath | Returns | Use in |
|---------|---------|---------|--------|
| `createBrowserLogger(options?)` | `./browser` | `ExtendedLogger` | Web app. Dev-only by default. |
| `browserLogger` | `./browser` | `ExtendedLogger` | A ready-made default browser instance. |
| `createWorkerLogger(options, requestId?)` | `./worker` | `ExtendedLogger` | Cloudflare Workers (JSON output). |
| `createRequestLogger(env, requestId)` | `./worker` | `ExtendedLogger` | Per-request worker logger built from `env`. |
| `createLibraryLogger(prefix, config?)` | `./library` | `Logger` | Libraries that want an opt-in logger. |
| `NoOpLogger` / `ConsoleLogger` | `./library` | `Logger` | Library defaults — silent, or pretty console. |

Everything above is also re-exported from the root (`@xivdyetools/logger`);
the subpaths keep bundles lean. The four subpath exports are `.`, `./browser`,
`./worker`, `./library` — **there is no `/node` subpath**.

---

## Quick Start

```typescript
import { createBrowserLogger } from '@xivdyetools/logger';

const logger = createBrowserLogger({ prefix: 'color-matcher' });

logger.debug('Detailed information');
logger.info('Color matched', { dye: 'Coral Pink' });
logger.warn('Warning condition');
logger.error('Failed to load data', err, { operation: 'fetchDyes' });
```

`error()` takes the error as its **second** argument: `error(message, error?, context?)`.

### Cloudflare Workers

```typescript
import { createRequestLogger } from '@xivdyetools/logger/worker';

export default {
  async fetch(request: Request, env: Env) {
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
    const logger = createRequestLogger(
      {
        ENVIRONMENT: env.ENVIRONMENT,
        API_VERSION: env.API_VERSION,
        SERVICE_NAME: 'xivdyetools-presets-api',
      },
      requestId,
    );

    logger.info('Request received');
    return new Response('ok');
  },
};
```

`createRequestLogger` is a thin wrapper over `createWorkerLogger({ service,
environment, version }, requestId)` — use the latter directly when the values do
not come from a worker `env`.

### Libraries

```typescript
import { NoOpLogger, ConsoleLogger } from '@xivdyetools/logger/library';
import type { Logger } from '@xivdyetools/logger';

class MyService {
  constructor(private logger: Logger = NoOpLogger) {}
}

// A consumer opts in:
const service = new MyService(ConsoleLogger);
```

---

## Configuration

`LoggerConfig` — the shape the adapters and `createLibraryLogger` accept
(`Partial<LoggerConfig>` there):

```typescript
interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error';  // minimum level to log
  format: 'json' | 'pretty';                    // output format
  timestamps: boolean;                          // include ISO timestamps
  prefix?: string;                              // message prefix
  sanitizeErrors: boolean;                      // free-text secret sanitisation
  redactFields?: string[];                      // merged with the defaults, never replaces them
}
```

The preset factories take their own option shapes instead:
`BrowserLoggerOptions` (`devOnly`, `isDev`, `errorTracker`, `prefix`) and
`WorkerLoggerOptions` (`service`, `environment`, `version`, `level`).

---

## Log Levels

| Level | Use case |
|-------|----------|
| `debug` | Detailed debugging information |
| `info` | Normal operational messages |
| `warn` | Warning conditions |
| `error` | Error conditions |

Entries at or above the configured level are written.

---

## Extended API

`ExtendedLogger` adds context inheritance and timing on top of `Logger`:

```typescript
const requestLogger = logger.child({ requestId: 'abc-123' });
requestLogger.info('Processing');       // carries requestId

logger.setContext({ service: 'api' });  // merged into every later entry

const end = logger.time('database-query');
await db.query();
const durationMs = end();

await logger.timeAsync('fetch-prices', () => api.getPriceData(52254));
```

Also exported: the `BaseLogger` class and the `ConsoleAdapter` / `JsonAdapter` /
`NoopAdapter` write adapters, plus the `LogLevel`, `LogContext`, `LogEntry`,
`Logger`, `ExtendedLogger` and `ErrorTracker` types.

---

## Full reference

- Package README: [`packages/logger/README.md`](../../../packages/logger/README.md) — including the full 22-field redaction list and the four worker-only additions.
- [Logging Standards](../../developer-guides/logging-standards.md) - conventions across the ecosystem

## Related Documentation

- [Types Package](../types/overview.md) - Shared types
- [Test Utils](../test-utils/overview.md) - Testing utilities
