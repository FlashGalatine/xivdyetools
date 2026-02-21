# @xivdyetools/logger

Unified logging for the xivdyetools ecosystem. Works in browsers, Node.js, and Cloudflare Workers.

## Installation

```bash
npm install @xivdyetools/logger
```

## Features

- **Environment-aware** - Different behavior for development vs production
- **Structured logging** - JSON output for log aggregation
- **Request correlation** - Track requests across distributed services
- **Secret redaction** - Automatically redact sensitive fields
- **Performance timing** - Built-in performance measurement utilities
- **Error tracking integration** - Ready for Sentry/similar services
- **Backward compatible** - Drop-in replacement for xivdyetools-core Logger

## Quick Start

### Browser (xivdyetools-web-app)

```typescript
import { createBrowserLogger } from '@xivdyetools/logger/browser';

const logger = createBrowserLogger();

logger.info('App initialized');
logger.debug('Debug info', { userId: '123' });
logger.warn('Deprecated feature used');
logger.error('Failed to load data', error, { endpoint: '/api/dyes' });
```

### Cloudflare Workers (oauth, presets-api, discord-worker)

```typescript
import { createWorkerLogger, getRequestId } from '@xivdyetools/logger/worker';

export default {
  async fetch(request: Request, env: Env) {
    const requestId = getRequestId(request);
    const logger = createWorkerLogger({
      service: 'xivdyetools-presets-api',
      environment: env.ENVIRONMENT,
      version: env.API_VERSION,
    }, requestId);

    logger.info('Request received', {
      path: new URL(request.url).pathname,
      method: request.method,
    });

    // ... handle request

    return new Response('OK');
  }
};
```

### Library (xivdyetools-core)

```typescript
import { NoOpLogger, ConsoleLogger } from '@xivdyetools/logger/library';
import type { Logger } from '@xivdyetools/logger';

class DyeService {
  constructor(private logger: Logger = NoOpLogger) {}

  findDye(id: number) {
    this.logger.debug('Finding dye', { id });
    // ... implementation
  }
}

// Silent by default (no console pollution)
const service = new DyeService();

// Enable logging when needed
const debugService = new DyeService(ConsoleLogger);
```

## Presets

### Browser Preset

Optimized for web applications with dev-mode filtering and error tracking integration.

```typescript
import { createBrowserLogger, perf } from '@xivdyetools/logger/browser';

// Basic usage (logs only in development)
const logger = createBrowserLogger();

// With error tracking (e.g., Sentry)
import * as Sentry from '@sentry/browser';

const logger = createBrowserLogger({
  prefix: 'myapp',
  errorTracker: {
    captureException: (error, context) => Sentry.captureException(error, { extra: context }),
    captureMessage: (message, level) => Sentry.captureMessage(message, level),
    setTag: (key, value) => Sentry.setTag(key, value),
    setUser: (user) => Sentry.setUser(user),
  },
});

// Performance monitoring
perf.start('render');
renderComponent();
const duration = perf.end('render'); // Logs: "render: 45.23ms"

// Async timing
const data = await perf.measure('fetchDyes', () => fetchDyes());

// View metrics
console.log(perf.getMetrics('render'));
// { count: 5, totalTime: 125.4, minTime: 20.1, maxTime: 30.2, avgTime: 25.08 }

perf.logMetrics(); // Log all metrics to console
```

### Worker Preset

Optimized for Cloudflare Workers with JSON structured output.

```typescript
import { createWorkerLogger, createRequestLogger, getRequestId } from '@xivdyetools/logger/worker';

// In Hono middleware
app.use('*', async (c, next) => {
  const requestId = getRequestId(c.req.raw);

  const logger = createRequestLogger({
    ENVIRONMENT: c.env.ENVIRONMENT,
    API_VERSION: c.env.API_VERSION,
    SERVICE_NAME: 'xivdyetools-presets-api',
  }, requestId);

  c.set('logger', logger);
  c.header('X-Request-ID', requestId);

  await next();
});

// In route handler
app.get('/api/presets', async (c) => {
  const logger = c.get('logger');

  logger.info('Fetching presets', {
    category: c.req.query('category'),
    page: c.req.query('page'),
  });

  // Output (JSON):
  // {"level":"info","message":"Fetching presets","timestamp":"2024-01-15T10:30:00.000Z",
  //  "context":{"service":"xivdyetools-presets-api","requestId":"abc-123","category":"jobs"}}
});
```

### Library Preset

For npm packages that shouldn't pollute consumer logs.

```typescript
import { NoOpLogger, ConsoleLogger, createLibraryLogger } from '@xivdyetools/logger/library';
import type { Logger } from '@xivdyetools/logger';

// NoOpLogger - Silent (default for libraries)
export const NoOpLogger: Logger;

// ConsoleLogger - Prefixed with [xivdyetools]
export const ConsoleLogger: Logger;

// Custom prefix
const myLogger = createLibraryLogger('mylib:color');
myLogger.debug('Processing color'); // [mylib:color] Processing color
```

## API Reference

### Logger Interface

```typescript
interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: unknown, context?: LogContext): void;
}
```

### ExtendedLogger Interface

```typescript
interface ExtendedLogger extends Logger {
  // Create child logger with inherited context
  child(context: LogContext): ExtendedLogger;

  // Set global context for all logs
  setContext(context: LogContext): void;

  // Performance timing
  time(label: string): () => number;
  timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T>;
}
```

### LogContext

```typescript
interface LogContext {
  requestId?: string;    // Correlation ID
  userId?: string;       // User identifier
  operation?: string;    // Current operation
  service?: string;      // Service name
  [key: string]: unknown;
}
```

### Adapters

| Adapter | Use Case | Output |
|---------|----------|--------|
| `ConsoleAdapter` | Development | Pretty console output |
| `JsonAdapter` | Production/Workers | Structured JSON |
| `NoopAdapter` | Libraries/Testing | Silent |

```typescript
import { ConsoleAdapter, JsonAdapter, NoopAdapter } from '@xivdyetools/logger';

// Custom adapter
const logger = new ConsoleAdapter({
  level: 'debug',
  format: 'pretty',
  timestamps: true,
  prefix: 'myapp',
  sanitizeErrors: true,
  redactFields: ['password', 'token', 'secret'],
});
```

## Configuration

### LoggerConfig

```typescript
interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error';  // Minimum level to log
  format: 'json' | 'pretty';                    // Output format
  timestamps: boolean;                          // Include timestamps
  prefix?: string;                              // Message prefix
  sanitizeErrors: boolean;                      // Remove secrets from errors
  redactFields?: string[];                      // Fields to redact
}
```

### Default Redacted Fields

The following fields are automatically redacted from log context:

- `password`
- `token`
- `secret`
- `authorization`
- `cookie`
- `api_key` / `apiKey`
- `access_token`
- `refresh_token`

## Migration Guide

### From xivdyetools-core Logger

```typescript
// Before
import { Logger, NoOpLogger, ConsoleLogger } from 'xivdyetools-core';

class MyService {
  constructor(private logger: Logger = NoOpLogger) {}
}

// After
import { NoOpLogger, ConsoleLogger } from '@xivdyetools/logger/library';
import type { Logger } from '@xivdyetools/logger';

class MyService {
  constructor(private logger: Logger = NoOpLogger) {}
}
```

### From xivdyetools-web-app logger

```typescript
// Before
import { logger, perf } from '../shared/logger';

// After
import { browserLogger as logger, perf } from '@xivdyetools/logger/browser';

// Or create custom instance
import { createBrowserLogger, perf } from '@xivdyetools/logger/browser';
const logger = createBrowserLogger({ prefix: 'xivdyetools' });
```

### From console.log in Workers

```typescript
// Before
console.log('Request received:', request.url);
console.error('Error:', error);

// After
import { createWorkerLogger, getRequestId } from '@xivdyetools/logger/worker';

const logger = createWorkerLogger({
  service: 'my-worker',
  environment: env.ENVIRONMENT,
}, getRequestId(request));

logger.info('Request received', { url: request.url });
logger.error('Error', error);
```

## Advanced Usage

### Child Loggers

```typescript
const logger = createWorkerLogger({ service: 'api', environment: 'production' });

// Create child with request context
const requestLogger = logger.child({ requestId: 'abc-123', userId: 'user-456' });

requestLogger.info('Processing request'); // Includes requestId and userId
requestLogger.info('Fetching data');      // Includes requestId and userId
```

### Custom Adapter

```typescript
import { BaseLogger, LogEntry, LoggerConfig } from '@xivdyetools/logger';

class MyCustomAdapter extends BaseLogger {
  protected write(entry: LogEntry): void {
    // Send to custom destination
    myLoggingService.send(entry);
  }
}

const logger = new MyCustomAdapter({ level: 'info' });
```

### Performance Timing

```typescript
import { perf } from '@xivdyetools/logger/browser';

// Manual timing
perf.start('database-query');
await db.query(...);
const duration = perf.end('database-query');

// Async wrapper
const result = await perf.measure('api-call', async () => {
  return fetch('/api/data').then(r => r.json());
});

// Sync wrapper
const processed = perf.measureSync('data-processing', () => {
  return data.map(transform);
});

// Aggregate metrics
perf.logMetrics();
perf.clearMetrics();
```

## Connect With Me

**Flash Galatine** | Midgardsormr (Aether)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
📝 **Blog**: [Project Galatine](https://blog.projectgalatine.com/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## License

MIT © 2025-2026 Flash Galatine
