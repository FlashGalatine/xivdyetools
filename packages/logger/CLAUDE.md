# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/logger` is a unified structured-logging package that runs on browsers, Node.js, and Cloudflare Workers with the same API. It provides:

- A core `Logger` interface (debug/info/warn/error) plus an `ExtendedLogger` with `child()`, `setContext()`, and `time()`/`timeAsync()` performance helpers.
- Three pre-built presets (`browser`, `worker`, `library`) tuned for each runtime.
- Field-level secret redaction (recursive, up to depth 3) and pattern-based error-message sanitization.

The package exists so that the workers, web app, and shared libraries can emit consistent JSON-structured logs (worker side) or pretty console output (browser/library side) without each app re-implementing redaction, correlation IDs, and adapter selection. It ships with `sideEffects: false`.

## Commands

```bash
pnpm build         # tsc -p tsconfig.build.json
pnpm test          # vitest run
pnpm test:watch    # vitest
pnpm test:coverage # vitest run --coverage
pnpm type-check    # tsc --noEmit
pnpm lint          # eslint src
pnpm clean         # rimraf dist coverage
```

### Run from monorepo root

```bash
pnpm turbo run build --filter=@xivdyetools/logger
pnpm --filter @xivdyetools/logger exec vitest run src/core/base-logger.test.ts
```

## Architecture

Three layers: `core` (the abstract `BaseLogger`), `adapters` (concrete write strategies), and `presets` (factory functions that wire an adapter + config for a specific runtime).

### Key Directories

```
src/
├── core/
│   └── base-logger.ts     # Abstract BaseLogger with redaction, child(), time*()
├── adapters/
│   ├── console-adapter.ts # Pretty console output (browser/dev)
│   ├── json-adapter.ts    # Structured JSON (worker)
│   └── noop-adapter.ts    # Silent (library default)
├── presets/
│   ├── browser.ts         # createBrowserLogger, perf
│   ├── worker.ts          # createWorkerLogger, createRequestLogger
│   └── library.ts         # NoOpLogger, ConsoleLogger, createLibraryLogger
├── constants.ts           # CORE_REDACT_FIELDS, WORKER_REDACT_FIELDS
└── types.ts               # Logger, ExtendedLogger, LogContext, LogEntry, LoggerConfig
```

## Public API

### Types (from `types.ts`)

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
interface LogContext { requestId?, userId?, operation?, service?, environment?, [key: string]: unknown }
interface LogEntry   { level, message, timestamp, context?, error? }
interface Logger          { debug, info, warn, error }
interface ExtendedLogger extends Logger { child, setContext, time, timeAsync }
interface LoggerConfig    { level, format, timestamps, prefix?, sanitizeErrors, redactFields? }
interface ErrorTracker    { captureException, captureMessage, setTag, setUser }
```

### Core (`@xivdyetools/logger`)

```typescript
abstract class BaseLogger implements ExtendedLogger {
  protected abstract write(entry: LogEntry): void;
  // child() returns a DelegatingLogger that shares the parent's adapter
}
function createSimpleLogger(writeFn, config?): Logger;
```

### Adapters

```typescript
class ConsoleAdapter extends BaseLogger { /* pretty console */ }
class JsonAdapter    extends BaseLogger { /* console.log(JSON.stringify(entry)) */ }
class NoopAdapter    extends BaseLogger { /* drops everything */ }
```

### Browser preset (`@xivdyetools/logger/browser`)

```typescript
interface BrowserLoggerOptions { devOnly?, isDev?, errorTracker?, prefix? }
function createBrowserLogger(options?): ExtendedLogger;
const browserLogger: ExtendedLogger;  // singleton
const perf: { /* performance helpers */ };
```

### Worker preset (`@xivdyetools/logger/worker`)

```typescript
interface WorkerLoggerOptions { service, environment, version?, level? }
function createWorkerLogger(options, requestId?): ExtendedLogger;
function createRequestLogger(env: { ENVIRONMENT, API_VERSION?, SERVICE_NAME? }, requestId): ExtendedLogger;
function getRequestId(request: Request): string;  // @deprecated
```

### Library preset (`@xivdyetools/logger/library`)

```typescript
const NoOpLogger: Logger;       // suppresses all output (default for libraries)
const ConsoleLogger: Logger;    // pretty console with [xivdyetools] prefix
function createLibraryLogger(prefix: string): Logger;
```

## Key Patterns

### Runtime detection

The browser preset auto-detects dev mode in this order:

1. `import.meta.env.DEV` (Vite)
2. `import.meta.env.MODE === 'development'`
3. `globalThis.process?.env?.NODE_ENV === 'development'`
4. Fallback to `false` (production)

The worker preset doesn't probe — `ENVIRONMENT` is passed in explicitly via worker bindings. The library preset is runtime-agnostic and defers to its caller.

### Secret redaction (two layers)

**Field redaction** in `BaseLogger.redactSensitiveFields` walks `LogContext` recursively (max depth 3) and replaces values whose keys appear in `redactFields` with `'[REDACTED]'`. The default list is `CORE_REDACT_FIELDS` from `constants.ts`:

```
password, token, secret, authorization, cookie, api_key, apiKey,
access_token, refresh_token
```

The worker preset extends this with `WORKER_REDACT_FIELDS`:

```
+ jwt_secret, bot_api_secret, bot_signing_secret, discord_client_secret
```

User-supplied `redactFields` are **merged** with the defaults, never replaced (FINDING-008).

**Error-message sanitization** in `BaseLogger.sanitizeErrorMessage` runs regex replacements against `error.message` for `Bearer ...`, `token=...`, `secret=...`, `password=...`, `api_key=...`, `authorization=...`, `access_token=...`, `refresh_token=...`, `client_secret=...`, `private_key=...`, `signing_key=...`, `webhook_secret=...`, `auth_token=...`, `credentials=...`. Both quoted and unquoted values are matched. Stack traces are dropped when `sanitizeErrors` is true.

### Structured field convention

`LogContext` is a flat record but specific keys are reserved: `requestId`, `userId`, `operation`, `service`, `environment`. Use these consistently — they're what log aggregation queries over. Anything else can go on the same object (`{ requestId, dyeId: 42 }`); it'll show up under `context` in the JSON output.

### Child loggers and the delegation pattern

`logger.child(context)` returns a `DelegatingLogger` (LOG-API-001) that holds a reference to the parent and merges its own context on every call rather than cloning the adapter. This means child loggers share the parent's write adapter, config changes propagate, and nested children form a chain.

### Worker pattern

In a Cloudflare Worker, the canonical setup is:

```typescript
// In Hono middleware (or `@xivdyetools/worker-middleware`)
const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
const logger = createRequestLogger({
  ENVIRONMENT: c.env.ENVIRONMENT,
  API_VERSION: c.env.API_VERSION,
  SERVICE_NAME: 'my-worker',
}, requestId);
c.set('logger', logger);
```

`createRequestLogger` is a thin wrapper over `createWorkerLogger` that maps the `env`-shaped object to the underlying options. Most apps use it via `loggerMiddleware()` from `@xivdyetools/worker-middleware` rather than calling it directly.

## Consumers

Grepped from `package.json` files in the monorepo:

- Packages: `@xivdyetools/core`, `@xivdyetools/worker-middleware`
- Apps: `xivdyetools-web-app`, `xivdyetools-discord-worker`, `xivdyetools-presets-api`, `xivdyetools-oauth`, `xivdyetools-moderation-worker`, `xivdyetools-api-worker`, `xivdyetools-stoat-worker`

## Internal Dependencies

None. The package depends only on Web Platform globals (`console`, `crypto.randomUUID`, `performance`).

## Publishing

```bash
# 1. Make changes in packages/logger/
# 2. Build and test
pnpm turbo run build test --filter=@xivdyetools/logger

# 3. Bump version in packages/logger/package.json
# 4. Publish
pnpm --filter @xivdyetools/logger publish --provenance --access public --no-git-checks
```

`prepublishOnly` runs `clean` then `build` automatically.
