# @xivdyetools/worker-middleware

Shared [Hono](https://hono.dev/) middleware for xivdyetools Cloudflare Workers.

Eliminates duplicated middleware across workers by providing a consistent, configurable stack for request ID management and structured logging.

## Installation

```bash
pnpm add @xivdyetools/worker-middleware
```

**Peer dependency:** `hono ^4.0.0`

## Usage

```typescript
import {
  requestIdMiddleware,
  loggerMiddleware,
  getRequestId,
  getLogger,
} from '@xivdyetools/worker-middleware';
import type { MiddlewareVariables } from '@xivdyetools/worker-middleware';

// Extend with your app's variables
type Variables = MiddlewareVariables & {
  auth: AuthContext;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// 1. Request ID (must be first for tracing)
app.use('*', requestIdMiddleware());

// 2. Structured logger (after request ID for correlation)
app.use('*', loggerMiddleware({
  serviceName: 'xivdyetools-presets-api',
  readApiVersionFromEnv: true,
  logUserAgent: true,
}));

// In handlers:
app.get('/api/example', (c) => {
  const logger = c.get('logger');
  logger.info('Processing request');
  return c.json({ ok: true });
});

// In error handlers:
app.onError((err, c) => {
  const requestId = getRequestId(c);
  const logger = getLogger(c);
  logger?.error('Unhandled error', err);
  return c.json({ error: 'Internal error', requestId }, 500);
});
```

## API

### `requestIdMiddleware(options?)`

Returns a Hono middleware that generates or preserves a `X-Request-ID` header for distributed tracing.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `validateFormat` | `boolean` | `true` | Validate incoming `X-Request-ID` against UUID format. Rejects malformed values to prevent log injection. |

### `getRequestId(c)`

Safe helper to extract the request ID from Hono context. Returns `'unknown'` if the middleware hasn't run.

### `loggerMiddleware(options)`

Returns a Hono middleware that creates a per-request structured logger (via `@xivdyetools/logger`) and logs request start/completion with timing.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serviceName` | `string` | *required* | Service name for log aggregation. |
| `readEnvironmentFromEnv` | `boolean` | `true` | Read `ENVIRONMENT` from `c.env`. When `false`, defaults to `'production'`. |
| `readApiVersionFromEnv` | `boolean` | `false` | Read `API_VERSION` from `c.env`. |
| `logUserAgent` | `boolean` | `false` | Include `User-Agent` in the "Request started" log. |
| `sanitizePath` | `(path: string) => string` | — | Optional function to redact sensitive URL segments before logging. |

### `getLogger(c)`

Safe helper to extract the logger from Hono context. Returns `undefined` if the middleware hasn't run.

### `MiddlewareVariables`

TypeScript type for the context variables set by the middleware stack:

```typescript
type MiddlewareVariables = {
  requestId: string;
  logger: ExtendedLogger;
};
```

Extend this with your app-specific variables when creating your Hono app.

## Worker Configuration Examples

```typescript
// discord-worker — no ENVIRONMENT env var, no user agent
app.use('*', requestIdMiddleware());
app.use('*', loggerMiddleware({
  serviceName: 'xivdyetools-discord-worker',
  readEnvironmentFromEnv: false,
}));

// presets-api — has ENVIRONMENT + API_VERSION, logs user agent
app.use('*', requestIdMiddleware());
app.use('*', loggerMiddleware({
  serviceName: 'xivdyetools-presets-api',
  readApiVersionFromEnv: true,
  logUserAgent: true,
}));

// moderation-worker — custom URL sanitizer
import { sanitizeUrl } from './utils/url-sanitizer.js';
app.use('*', requestIdMiddleware());
app.use('*', loggerMiddleware({
  serviceName: 'xivdyetools-moderation-worker',
  readEnvironmentFromEnv: false,
  sanitizePath: sanitizeUrl,
}));
```

## License

MIT
