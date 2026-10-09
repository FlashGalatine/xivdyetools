# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/logger` is a unified structured-logging package that runs on browsers, Node.js, and Cloudflare Workers with the same API. It provides:

- A core `Logger` interface (debug/info/warn/error) plus an `ExtendedLogger` with `child()`, `setContext()`, and `time()`/`timeAsync()` performance helpers.
- Three pre-built presets (`browser`, `worker`, `library`) tuned for each runtime.
- Field-level secret redaction (recursive, cycle-guarded — not depth-limited), a value-shape scan for secret-shaped strings regardless of key (context fields, array items including nested arrays, and — for JWT/Discord-token shapes only — bare tokens inside free-text messages), and pattern-based `key=value` sanitization that runs over `message`, `error.message`, and (when `sanitizeErrors` is on) every string value in a context, so a secret embedded in a longer context string is redacted too.

The package exists so that the workers, web app, and shared libraries can emit consistent JSON-structured logs (worker side) or pretty console output (browser/library side) without each app re-implementing redaction, correlation IDs, and adapter selection. It ships with `sideEffects: false`.

## Commands

```bash
pnpm build         # tsc -p tsconfig.build.json
pnpm test          # vitest run
pnpm test:watch    # vitest
pnpm test:coverage # vitest run --coverage
pnpm type-check    # tsc --noEmit
pnpm lint          # eslint src + knip dead-code gate (lint:dead)
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
access_token, refresh_token, private_key, privateKey, set_cookie,
setCookie, webhook_url, webhookUrl, auth_header, authHeader,
session_id, sessionId, client_secret, signing_secret, webhook_secret
```

(22 entries — the last 13 were added by FINDING-026, 2026-08-21 security audit.)

The worker preset extends this with `WORKER_REDACT_FIELDS` (= the 22 above plus
these four, 26 in total):

```
+ jwt_secret, bot_api_secret, bot_signing_secret, discord_client_secret
```

User-supplied `redactFields` are **merged** with the defaults, never replaced (FINDING-008).

**2. Value-shape redaction** (`looksLikeSecretValue`, FINDING-026 + FINDING-025) redacts a string that itself *looks* like a secret regardless of its key — `Bearer …`, a three-part JWT, a Discord bot token, or a `≥64`-hex blob. This runs inside `redactSensitiveFields`'s per-key loop, so it already reached a string value at **any object nesting depth**, including a string inside an object that is itself an array item (`{ a: [{ note: 'Bearer ...' }] }` was always caught, at any depth) — S10-R10 (2026-08-30 fix round 1) corrects an earlier version of this doc, which wrongly claimed the scan "ran only against top-level context field values" before FINDING-025; that was never true, and a future sprint chasing that phantom gap would waste time. The one thing FINDING-025 (2026-08-29 audit) actually added is narrower: a **bare string item directly inside an array** — `{ tokens: ['eyJ…'] }` — because the array-recursion branch only recursed into *object* items and returned every other item, strings included, unchanged. That fix reaches items nested in arrays inside arrays too (an array item has no key of its own, so this is the only one of the three mechanisms that can apply to it — the key-name rule needs a key, and the array's *own* key gets checked separately, one level up). The same fix corrected a shape bug in the array recursion: an item that was itself an array used to be spread into a plain object with numeric-string keys (`{ a: [[1, 2]] }` logged as `{ a: [{ '0': 1, '1': 2 }] }`) instead of staying an array. S10-R8 (2026-08-30 fix round 1) fixed a separate, older bug in the same recursion: the cycle guard was a *global* seen-set, so a value referenced from two sibling keys (`{ a: shared, b: shared }`) was redacted only at its first reference — the guard is now an ancestor (recursion-path) set, popped after each branch finishes, so an aliased value is redacted at every reference. That fix's own follow-up, S10-R12 (2026-08-30 fix round 2): the ancestor set alone makes a heavily-aliased structure exponentially expensive to walk (the same shared child re-processed once per path to it), so round 1 added a total node-visit budget (`MAX_REDACT_NODES`) to bound that — but review found the budget failed OPEN (`if (exhausted) return context unchanged`), so an oversized context emitted everything past the cutoff completely unscanned: a silent redaction bypass, not a safety net. The budget is gone; `RedactionGuard` now carries a `memo: WeakMap<object, unknown>` alongside `ancestors` instead. A node's fully-redacted result is cached only on the way OUT of `redactSensitiveFields`/`redactArrayItems` (after its own children are fully processed, never before — an ancestor still on the current path is caught by the `ancestors` check FIRST and never consults `memo`, so a cycle can never receive its own partial result). Every distinct node is processed exactly once no matter how many times it's aliased, aliased references resolve to the SAME redacted object, and there is no cutoff left to fail open past.

**`toJSON` values** (BUG-141, 2026-10-04 deep dive). The spread copy `redactSensitiveFields` makes turns any object with no own enumerable keys into `{}`, so a `Date` or `URL` in a context used to log as `{}`. A nested object or array item that has a `toJSON` (own or inherited) is now serialized first, the way `JSON.stringify` would (`toJSON(key)`), and the RESULT goes through the same redaction as any other value: `Date` becomes its ISO string (an invalid `Date` becomes `null`), `URL` becomes its href, and a class with `toJSON` becomes its redacted shape. Consumers that parsed `context.at` as an object now see a string. `Map` and `Set` have no `toJSON` and stay `{}`, as under `JSON.stringify`. An `Error` in a context, with `sanitizeErrors` on (the default), never has its `toJSON` called: a `toJSON` can return the stack in any shape (`String(this.stack)`, or nested under another key) that no key-based strip catches, so it takes the spread path it took before BUG-141 and logs only its own enumerable fields — `{}` for a plain `Error`, `{ name, code, severity }` for an `AppError` — with no stack and no message. With `sanitizeErrors` off its `toJSON` runs like any other, stack included. Guards, all in `redactNested`: a `toJSON` that throws, or returns the same object, falls back to the spread copy (a log call must never throw); a result that throws while it is walked (a Proxy whose `ownKeys` trap throws) logs `'[Unserializable]'`; an `Error` check that itself throws (a Proxy whose `getPrototypeOf` trap throws) counts as an `Error` and takes the spread path; the original stays in `ancestors` while its result is walked, so a result pointing back at it logs `'[Circular]'`; nested `toJSON` results are capped at `MAX_TO_JSON_DEPTH = 32` and past it the value is `'[Truncated]'` (fail closed); the `toJSON` calls per top-level log call that return an object or array are capped at `MAX_TO_JSON_CALLS = 4096` (`RedactionGuard.jsonCalls`), because the depth cap alone does not bound fan-out (a `toJSON` returning two fresh instances is 2^depth calls). Only those calls are counted, since only an object or array result can hold further `toJSON` values: a `toJSON` that returns a string or other primitive (every `Date` and `URL`), a plain object, an array and an `Error` under `sanitizeErrors` are never counted, so 5000 rows that each carry a `Date` log in full. Once the count reaches the cap, any further value that has a `toJSON` becomes `'[Truncated]'` without the call, and plain objects are still redacted normally; an own function-valued `toJSON` is deleted from the redacted copy so it cannot re-run and emit raw data at serialization time. One hook does survive, unchanged from 2.2.1: a function or class VALUE is passed through as-is (it is not an object to the walk), so if it carries a `toJSON`, `JSON.stringify` calls it and the result is emitted unredacted. `memo` is keyed by identity, so an object aliased under two keys gets `toJSON` once, with the first key. Non-plain objects are deliberately not skipped, since that would bypass key redaction.

The normalized redact-field `Set` is built once in the constructor (OPT-010) rather than per node, so a subclass that reassigns `config.redactFields` after construction would see a stale set.

**This residual is CLOSED as of BUG-004** (deep dive 2026-09-02). It used to read: a detected cycle's back-edge still serialises one layer of the raw original object before `JSON.stringify`'s own circularity check catches it, a known residual of the check ordering (`ancestors` before `memo`, `memo` populated only on the way out), with the fix routed as a follow-up because the alternative ordering is a design change with its own trade-offs.

It was worse than "one layer", which is why it was a leak rather than a cosmetic wart: the guard returned the RAW original node, so everything reachable through the back-edge was emitted verbatim. Given `inner = { token: 'shhh' }; ctx = { items: [inner] }; inner.back = ctx`, the copy of `inner` correctly got `token: '[REDACTED]'`, but `inner.back` handed back the original `ctx` whose `items[0]` is the original `inner` — and `safeStringify` only marks the SECOND back-edge, so the emitted line carried `"token":"shhh"`.

The fix is neither of the two orderings that follow-up was weighing: **both guards return the `'[Circular]'` sentinel** instead of a node. The check ordering is unchanged (so every property S10-R16 pins still holds, and its two tests still discriminate the same mutation — `result` is not the sentinel either), the already-redacted copy was unreachable at that point anyway, and the sentinel is the same marker `safeStringify` would have written one layer down. A cyclic context now reads identically whether the cycle is caught during redaction or during serialisation.

A second, separate mechanism in this file had the SAME class of bug, one layer down: `safeStringify`'s own cycle-detection set (used by `JsonAdapter.write` on every log line, and by `formatError`'s non-Error branch) was ALSO a global "seen anywhere" `WeakSet` — harmless before this section's memoization fix, when every aliased reference was still a distinct object, but a regression once `redactSensitiveFields` started handing it the SAME object twice: the second occurrence read as a cycle and was replaced with `"[Circular]"`, silently dropping legitimate repeated data (a fail-CLOSED bug, not a leak, but still a defect — found and fixed within the same unreleased version, S10-R14). Fixed with the identical technique one level down: `safeStringify`'s cycle-detection stack is now path-scoped too, reconstructed inside `JSON.stringify`'s replacer via the `this`-matching trick the `json-stringify-safe` npm package uses (reimplemented, not depended on).

That path-scoping fix has its own cost, also found and fixed within this same unreleased version (S10-R18): memoization guarantees the redacted tree is maximally SHARED, and path-scoped detection correctly does not treat that sharing as a cycle — but `JSON.stringify` has no notion of "already emitted this subtree", so it walks a shared node once per PATH that reaches it, not once per distinct node. On a normal log context that's an unnoticeable constant-factor cost; on a structure that's deeply AND repeatedly aliased (this package's own S10-R12 test shape — a chain where each level references the same child from both of its own keys) path count is exponential in depth, and so is serialisation time and output size (measured: 3ms/147KB at 12 levels, 608ms/~37MB at 20, no measured completion at 40 — the exact structure and depth `redactContext()` itself handles in well under a millisecond, since redaction is memoized and linear; only serialisation expands). `safeStringify` now carries its own node-visit budget (`MAX_STRINGIFY_NODES = 50_000`), and — this is the point worth reading twice before touching either budget in this file — it fails CLOSED, not open: past the limit, every remaining value becomes the literal string `"[Truncated]"` rather than being walked further. That is deliberately the opposite failure direction from the redaction budget S10-R12 removed, and is not an inconsistency: by the time anything reaches `safeStringify` it has already been through the redaction pass in full, so there is no unredacted data left in its input regardless of where it stops — cutting off here can only drop already-safe data (diagnostics), never emit anything raw (a secret). A budget that fails open is never acceptable in the redactor; a budget that fails closed is the right tool in the serialiser, precisely because what each one's exhaustion costs is different.

**3. Free-text sanitization** in `BaseLogger.sanitizeErrorMessage` runs against `message`, `error.message`, non-`Error` throws, and — since BUG-140 (2026-10-04 deep dive) — every string VALUE in a log context (object values, nested values, array items) through `scrubString`, which is gated by `sanitizeErrors` (default on; `false` keeps the old output). Four call sites, one shared implementation, so they can't drift. On a context string the whole-value shape verdict of mechanism 2 runs first; if the string is not itself secret-shaped, the rules below run over it, so `'upstream said password=hunter2 and gave up'` logs as `'upstream said password=[REDACTED] and gave up'`. Keys are never rewritten. Consumer-visible side effect, identical to the message path: a diagnostic such as `'password: required'` becomes `'password=[REDACTED]'`. Benign strings (a sha256 substring, `'XIVAuth token exchange failed'`) stay byte-identical. A second pass over an already-redacted value is harmless for fully consumed values (`password=[REDACTED]` re-matches to itself), so merged global/child context is not mangled; a mixed-quote value (`password="x'y"`) only settles on the second pass, a quirk shared with the message path. The rules themselves: `key=value` regex replacements for `Bearer ...`, `token=...`, `secret=...`, `password=...`, `api_key=...`, `authorization=...`, `access_token=...`, `refresh_token=...`, `client_secret=...`, `private_key=...`, `signing_key=...`, `webhook_secret=...`, `auth_token=...`, `credentials=...` (both quoted and unquoted values matched), plus — since FINDING-025 — the same JWT and Discord-bot-token *shape* patterns from mechanism 2, reused as `\b`-delimited substring redactions so a bare token with no key name in front of it (`refresh failed for eyJhbGci…`) still gets caught, redacting only the matched span and leaving the rest of the sentence readable. The `≥64`-hex pattern from mechanism 2 is **deliberately not** reused here: a free-standing 64-hex run inside a log line is far more likely a sha256 content hash or cache key than a secret, and whole-value anchoring is what makes it safe on a field/array item, not on a substring of prose. Stack traces are dropped when `sanitizeErrors` is true.

Two notes on the `authorization=` rule, both from BUG-005 (2026-09-02). It consumes to a delimiter or end of line rather than to the first space, because an Authorization value IS the rest of the header — before that, `Authorization: Basic dXNlcjpwYXNzd29yZA==` had its *scheme word* redacted and its credential left intact (`Bearer` was safe only because of its own dedicated pass; Discord's `Bot` was rescued only incidentally, when the value happened to match the Discord-token shape). Every OTHER key rule still stops at whitespace, so an ordinary `token=abc failed at 12:04` stays diagnosable; only here is the whole tail known to belong to the value. And the free-text scheme pass stays **`Bearer`-only** on purpose: extending it to `Basic|Bot|Digest|Token` looks tempting for the naked-scheme case, but four of those five are ordinary English — that version turned oauth's `'XIVAuth token exchange failed'` into `'XIVAuth token [REDACTED] failed'`, and an oauth test caught it.

One more rule sits between the shape patterns and the `key=value` ones: a **JSON-shaped sweep** (BUG-025) that rewrites every quoted key ending in `token`/`secret`/`password`/`key` — `"…":"…"` → `"…":"[REDACTED]"` — in a single pass, which is what catches compound names (`sessionToken`, `webhook_secret`) the per-key patterns miss when a serialized payload lands in a message.

One rule sits after the shape patterns and before the JSON sweep: **URL userinfo** (BUG-141 review) rewrites `scheme://user:PASSWORD@host` to `scheme://user:[REDACTED]@host`, keeping the user name, in messages, error messages, and context strings alike (`https://example.com/a:b@c` is untouched). The user name may be empty, so `redis://:PASSWORD@host:6379` is redacted too. It exists because a `URL` object in a context now logs as its href (see mechanism 2). Only the userinfo password is covered: other secret-bearing query parameters such as OAuth `code=` or `X-Amz-Signature=` are not matched by any rule. The scheme part is capped at 32 characters (`[a-z][a-z0-9+.-]{0,31}://`): unbounded, every start position in a long run of letters, hex, base64 or `a.a.a.` scanned to the end of the run, so a 100 KB message, error message or context string took 3-8 s. Output is unchanged for every scheme up to 32 characters, and a longer one is still redacted (it keeps its last 32 characters as the scheme).

**Every free-text rule must stay linear.** These rules run over every log message, error message and context string, so a rule that backtracks quadratically is a denial of service on any request that logs caller input. On 2026-10-06 every rule was swept with adversarial 100 KB inputs (letters, hex, base64, `a.` runs, `a://:` runs, quote, colon and whitespace runs, repeated key names, `eyJ-` runs); only the URL rule above and the JWT pattern were super-linear. The JWT pattern (`\beyJ…{8,}\.…{8,}\.…{8,}\b`) took about 5 s on `eyJ-eyJ-…` in 2.2.1 as well: `-` is in its segment class but is not a word character, so `\b` holds before every `eyJ` after a `-` and each start scanned to the end of the run. It is now `JWT_SCAN`, which consumes the whole run from the first start and redacts only a match whose `.payload.signature` group is present; a 300,000-input differential fuzz against the old pattern gave identical output for both the free-text replace and the `looksLikeSecretValue` verdict. `hardening.test.ts` pins each adversarial input under 250 ms per path; add any new rule's worst input there.

All 18 patterns are compiled **once at module scope** (`SANITIZE_RULES`) — this function runs on every log line plus every error message, and used to compile all of them per call (OPT-007).

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
