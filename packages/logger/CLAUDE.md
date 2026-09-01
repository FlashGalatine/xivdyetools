# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/logger` is a unified structured-logging package that runs on browsers, Node.js, and Cloudflare Workers with the same API. It provides:

- A core `Logger` interface (debug/info/warn/error) plus an `ExtendedLogger` with `child()`, `setContext()`, and `time()`/`timeAsync()` performance helpers.
- Three pre-built presets (`browser`, `worker`, `library`) tuned for each runtime.
- Field-level secret redaction (recursive, cycle-guarded — not depth-limited), a value-shape scan for secret-shaped strings regardless of key (context fields, array items including nested arrays, and — for JWT/Discord-token shapes only — bare tokens inside free-text messages), and pattern-based `key=value` error-message sanitization.

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
│   ├── browser.ts         # createBrowserLogger
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
```

### Worker preset (`@xivdyetools/logger/worker`)

```typescript
interface WorkerLoggerOptions { service, environment, version?, level? }
function createWorkerLogger(options, requestId?): ExtendedLogger;
function createRequestLogger(env: { ENVIRONMENT, API_VERSION?, SERVICE_NAME? }, requestId): ExtendedLogger;
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

### Secret redaction (three mechanisms)

**1. Key-name field redaction** in `BaseLogger.redactSensitiveFields` walks `LogContext` recursively — cycle-guarded via a `WeakSet` (BUG-024), **not depth-limited**; an earlier version of this doc said "max depth 3", which was already stale before the 2026-08-29 audit (that cap was replaced by the cycle guard back in the 2026-07-18 audit) — and replaces values whose keys appear in `redactFields`, or end in `token`/`secret`/`password`/`apikey`, with `'[REDACTED]'`. The default list is `CORE_REDACT_FIELDS` from `constants.ts`:

```
password, token, secret, authorization, cookie, api_key, apiKey,
access_token, refresh_token
```

The worker preset extends this with `WORKER_REDACT_FIELDS`:

```
+ jwt_secret, bot_api_secret, bot_signing_secret, discord_client_secret
```

User-supplied `redactFields` are **merged** with the defaults, never replaced (FINDING-008).

**2. Value-shape redaction** (`looksLikeSecretValue`, FINDING-026 + FINDING-025) redacts a string that itself *looks* like a secret regardless of its key — `Bearer …`, a three-part JWT, a Discord bot token, or a `≥64`-hex blob. This runs inside `redactSensitiveFields`'s per-key loop, so it already reached a string value at **any object nesting depth**, including a string inside an object that is itself an array item (`{ a: [{ note: 'Bearer ...' }] }` was always caught, at any depth) — S10-R10 (2026-08-30 fix round 1) corrects an earlier version of this doc, which wrongly claimed the scan "ran only against top-level context field values" before FINDING-025; that was never true, and a future sprint chasing that phantom gap would waste time. The one thing FINDING-025 (2026-08-29 audit) actually added is narrower: a **bare string item directly inside an array** — `{ tokens: ['eyJ…'] }` — because the array-recursion branch only recursed into *object* items and returned every other item, strings included, unchanged. That fix reaches items nested in arrays inside arrays too (an array item has no key of its own, so this is the only one of the three mechanisms that can apply to it — the key-name rule needs a key, and the array's *own* key gets checked separately, one level up). The same fix corrected a shape bug in the array recursion: an item that was itself an array used to be spread into a plain object with numeric-string keys (`{ a: [[1, 2]] }` logged as `{ a: [{ '0': 1, '1': 2 }] }`) instead of staying an array. S10-R8 (2026-08-30 fix round 1) fixed a separate, older bug in the same recursion: the cycle guard was a *global* seen-set, so a value referenced from two sibling keys (`{ a: shared, b: shared }`) was redacted only at its first reference — the guard is now an ancestor (recursion-path) set, popped after each branch finishes, so an aliased value is redacted at every reference. That fix's own follow-up, S10-R12 (2026-08-30 fix round 2): the ancestor set alone makes a heavily-aliased structure exponentially expensive to walk (the same shared child re-processed once per path to it), so round 1 added a total node-visit budget (`MAX_REDACT_NODES`) to bound that — but review found the budget failed OPEN (`if (exhausted) return context unchanged`), so an oversized context emitted everything past the cutoff completely unscanned: a silent redaction bypass, not a safety net. The budget is gone; `RedactionGuard` now carries a `memo: WeakMap<object, unknown>` alongside `ancestors` instead. A node's fully-redacted result is cached only on the way OUT of `redactSensitiveFields`/`redactArrayItems` (after its own children are fully processed, never before — an ancestor still on the current path is caught by the `ancestors` check FIRST and never consults `memo`, so a cycle can never receive its own partial result). Every distinct node is processed exactly once no matter how many times it's aliased, aliased references resolve to the SAME redacted object, and there is no cutoff left to fail open past.

One thing this does *not* fix: a detected cycle's back-edge still serialises one layer of the raw original object before `JSON.stringify`'s own circularity check catches it. This is a **known residual of the current check ordering** (`ancestors` checked before `memo`, `memo` populated only on the way out) — S10-R17 (2026-08-30 fix round 3) corrects an earlier draft of this note, which overstated it as something the design "structurally cannot" fix. It's more precise than that: under a *different* ordering (memoizing on the way in, or checking `memo` before `ancestors`), the back-edge would resolve to the redacted copy instead of the raw original — verified empirically by mutating the guard both ways and confirming a cycle test that pins this exact property goes red only when BOTH properties are violated together (neither alone is observable, by construction — a node still on the ancestor path never has a memo entry yet regardless of check order or set timing alone). That different ordering is a deliberate design change with its own trade-offs, not made here — routed as a follow-up. See `CHANGELOG.md`'s "still not covered" list.

A second, separate mechanism in this file had the SAME class of bug, one layer down: `safeStringify`'s own cycle-detection set (used by `JsonAdapter.write` on every log line, and by `formatError`'s non-Error branch) was ALSO a global "seen anywhere" `WeakSet` — harmless before this section's memoization fix, when every aliased reference was still a distinct object, but a regression once `redactSensitiveFields` started handing it the SAME object twice: the second occurrence read as a cycle and was replaced with `"[Circular]"`, silently dropping legitimate repeated data (a fail-CLOSED bug, not a leak, but still a defect — found and fixed within the same unreleased version, S10-R14). Fixed with the identical technique one level down: `safeStringify`'s cycle-detection stack is now path-scoped too, reconstructed inside `JSON.stringify`'s replacer via the `this`-matching trick the `json-stringify-safe` npm package uses (reimplemented, not depended on).

That path-scoping fix has its own cost, also found and fixed within this same unreleased version (S10-R18): memoization guarantees the redacted tree is maximally SHARED, and path-scoped detection correctly does not treat that sharing as a cycle — but `JSON.stringify` has no notion of "already emitted this subtree", so it walks a shared node once per PATH that reaches it, not once per distinct node. On a normal log context that's an unnoticeable constant-factor cost; on a structure that's deeply AND repeatedly aliased (this package's own S10-R12 test shape — a chain where each level references the same child from both of its own keys) path count is exponential in depth, and so is serialisation time and output size (measured: 3ms/147KB at 12 levels, 608ms/~37MB at 20, no measured completion at 40 — the exact structure and depth `redactContext()` itself handles in well under a millisecond, since redaction is memoized and linear; only serialisation expands). `safeStringify` now carries its own node-visit budget (`MAX_STRINGIFY_NODES = 50_000`), and — this is the point worth reading twice before touching either budget in this file — it fails CLOSED, not open: past the limit, every remaining value becomes the literal string `"[Truncated]"` rather than being walked further. That is deliberately the opposite failure direction from the redaction budget S10-R12 removed, and is not an inconsistency: by the time anything reaches `safeStringify` it has already been through the redaction pass in full, so there is no unredacted data left in its input regardless of where it stops — cutting off here can only drop already-safe data (diagnostics), never emit anything raw (a secret). A budget that fails open is never acceptable in the redactor; a budget that fails closed is the right tool in the serialiser, precisely because what each one's exhaustion costs is different.

**3. Free-text sanitization** in `BaseLogger.sanitizeErrorMessage` runs against `message`, `error.message`, and non-`Error` throws alike (three call sites, one shared implementation, so they can't drift): `key=value` regex replacements for `Bearer ...`, `token=...`, `secret=...`, `password=...`, `api_key=...`, `authorization=...`, `access_token=...`, `refresh_token=...`, `client_secret=...`, `private_key=...`, `signing_key=...`, `webhook_secret=...`, `auth_token=...`, `credentials=...` (both quoted and unquoted values matched), plus — since FINDING-025 — the same JWT and Discord-bot-token *shape* patterns from mechanism 2, reused as `\b`-delimited substring redactions so a bare token with no key name in front of it (`refresh failed for eyJhbGci…`) still gets caught, redacting only the matched span and leaving the rest of the sentence readable. The `≥64`-hex pattern from mechanism 2 is **deliberately not** reused here: a free-standing 64-hex run inside a log line is far more likely a sha256 content hash or cache key than a secret, and whole-value anchoring is what makes it safe on a field/array item, not on a substring of prose. Stack traces are dropped when `sanitizeErrors` is true.

### Structured field convention

`LogContext` is a flat record but specific keys are reserved: `requestId`, `userId`, `operation`, `service`, `environment`. Use these consistently — they're what log aggregation queries over. Anything else can go on the same object (`{ requestId, dyeId: 42 }`); it'll show up under `context` in the JSON output.

### Child loggers and the delegation pattern

`logger.child(context)` returns a `DelegatingLogger` (LOG-API-001) that holds a reference to the parent and merges its own context on every call rather than cloning the adapter. This means child loggers share the parent's write adapter, config changes propagate, and nested children form a chain.

### Worker pattern

In a Cloudflare Worker, the canonical setup is:

```typescript
// In Hono middleware (or `@xivdyetools/worker-kit`)
const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
const logger = createRequestLogger({
  ENVIRONMENT: c.env.ENVIRONMENT,
  API_VERSION: c.env.API_VERSION,
  SERVICE_NAME: 'my-worker',
}, requestId);
c.set('logger', logger);
```

`createRequestLogger` is a thin wrapper over `createWorkerLogger` that maps the `env`-shaped object to the underlying options. Most apps use it via `loggerMiddleware()` from `@xivdyetools/worker-kit` rather than calling it directly.

## Consumers

Grepped from `package.json` files in the monorepo:

- Packages: `@xivdyetools/core`, `@xivdyetools/worker-kit`
- Apps: `xivdyetools-web-app`, `xivdyetools-discord-worker`, `xivdyetools-presets-api`, `xivdyetools-oauth`, `xivdyetools-moderation-worker`, `xivdyetools-api-worker`, `xivdyetools-stoat-worker`

(`image-worker` and `og-worker` get the logger transitively through `@xivdyetools/worker-kit` rather than declaring it directly.)

## Internal Dependencies

None. The package depends only on Web Platform globals (`console`, `crypto.randomUUID`, `performance`).

## Publishing

Publishing goes through the **Publish Packages to npm** GitHub Actions workflow, which authenticates via npm trusted publishing (OIDC). There is no npm token — see the root `CLAUDE.md` for the full flow and the break-glass local path.

```bash
# 1. Make changes in packages/logger/
# 2. Build and test
pnpm turbo run build test --filter=@xivdyetools/logger

# 3. Bump version in packages/logger/package.json and merge to main
# 4. Actions → "Publish Packages to npm" → package: @xivdyetools/logger
```

`prepublishOnly` runs `clean` then `build` automatically.
