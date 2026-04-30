# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/test-utils` is the **shared testing toolbox** for the entire workspace: Cloudflare Workers binding mocks (D1, KV, R2, Service Bindings, Analytics Engine), authentication helpers (JWT, HMAC, headers, contexts), domain object factories (`createMockPreset`, `createMockUser`, `createMockDye`, `mockDyes`, etc.), DOM/browser polyfills (localStorage, canvas, ResizeObserver, fetch, matchMedia), response assertion helpers, and test constants (PKCE values, well-known secrets).

Every worker app (`discord-worker`, `presets-api`, `oauth`, `moderation-worker`, `api-worker`, `og-worker`) and the web app uses these mocks in their Vitest suites. `vitest >= 2.0.0` is a peer dependency; consumers bring their own `vitest`.

The package ships **subpath exports** so consumers can import only the slice they need (`@xivdyetools/test-utils/cloudflare`, `/auth`, `/factories`, `/dom`, `/assertions`, `/constants`) and avoid pulling Workers types into a browser test, or DOM polyfills into a worker test.

## Commands

```bash
pnpm --filter @xivdyetools/test-utils run build
pnpm --filter @xivdyetools/test-utils run test
pnpm --filter @xivdyetools/test-utils run test:coverage
pnpm --filter @xivdyetools/test-utils run type-check
pnpm --filter @xivdyetools/test-utils run lint
pnpm --filter @xivdyetools/test-utils run clean
```

### Run from monorepo root

```bash
pnpm turbo run build --filter=@xivdyetools/test-utils
pnpm turbo run test --filter=@xivdyetools/test-utils
pnpm --filter @xivdyetools/test-utils exec vitest run src/cloudflare/d1.test.ts
```

## Architecture

The package is organized into **independent subpath-export modules**, each backing a `package.json#exports` entry. The root `index.ts` re-exports all of them for callers that want everything; in practice consumers should pick the narrowest path that satisfies their test (it keeps both bundle size and type-resolution cost down).

### Key Directories

```
src/
├── index.ts                  # Aggregate re-export of every submodule
├── cloudflare/               # CF Workers binding mocks (D1, KV, R2, Fetcher, Analytics)
│   ├── d1.ts                 # createMockD1Database with regex-pattern QueryMockFn
│   ├── kv.ts                 # createMockKV (Map-backed, _store / _ttls inspectable)
│   ├── r2.ts                 # createMockR2Bucket (ArrayBuffer storage)
│   ├── fetcher.ts            # createMockFetcher for service bindings
│   └── analytics.ts          # createMockAnalyticsEngine
├── auth/                     # JWT, HMAC, headers, auth context helpers
│   ├── jwt.ts                # createTestJWT, signing helpers
│   ├── signature.ts          # HMAC signature helpers
│   ├── headers.ts            # Authorization / x-signature builders
│   └── context.ts            # Mock auth context object
├── factories/                # Domain object factories
│   ├── preset.ts             # createMockPreset, mockPresets
│   ├── category.ts           # createMockCategory
│   ├── vote.ts               # createMockVote
│   ├── user.ts               # createMockUser
│   └── dye.ts                # createMockDye, mockDyes
├── dom/                      # Browser API polyfills for jsdom/happy-dom tests
│   ├── localStorage.ts
│   ├── canvas.ts
│   ├── resizeObserver.ts
│   ├── fetch.ts
│   └── matchMedia.ts
├── assertions/
│   └── response.ts           # expectJsonResponse, status / header asserts
├── constants/
│   ├── pkce.ts               # Test PKCE verifier / challenge pairs
│   └── secrets.ts            # Well-known test secrets (JWT_SECRET, etc.)
└── utils/
    ├── counters.ts           # randomId, randomStringId (parallel-safe; TEST-DESIGN-001)
    └── crypto.ts             # SubtleCrypto helpers for auth fixtures
```

## Public API

The main entry point re-exports everything; for production tests prefer the narrower subpath imports listed under `package.json#exports`.

### `@xivdyetools/test-utils/cloudflare`

```ts
// D1
type QueryMockFn = (query: string, bindings: unknown[]) => unknown;
interface D1Result<T>;
interface MockD1PreparedStatement;
function createMockD1Database(): MockD1Database;
//   .prepare(sql) → statement
//   ._setupMock(fn)            // route via regex on query
//   ._queries: string[]        // observed queries
//   ._bindings: unknown[][]    // observed bindings
//   ._reset()

// KV
function createMockKV(): MockKVNamespace;
//   .get / .put / .list / .delete (KVNamespace surface)
//   ._store: Map<string,string>
//   ._ttls: Map<string,number>
//   ._reset()

// R2
function createMockR2Bucket(): MockR2Bucket;
//   .put / .get / .head / .delete / .list
//   ._store: Map<string, StoredR2Object>
//   ._reset()

// Service binding fetcher
function createMockFetcher(): MockFetcher;

// Analytics
function createMockAnalyticsEngine(): MockAnalyticsEngineDataset;
```

### `@xivdyetools/test-utils/auth`

```ts
function createTestJWT(payload, options?): Promise<string>;
function buildAuthorizationHeader(token): { Authorization: string };
function createAuthContext(overrides?): AuthContext;
// + HMAC signature helpers, Discord Ed25519 signing helpers
```

### `@xivdyetools/test-utils/factories`

```ts
function createMockPreset(overrides?): Preset;
const mockPresets: Preset[];
function createMockCategory(overrides?): Category;
function createMockVote(overrides?): Vote;
function createMockUser(overrides?): User;
function createMockDye(overrides?): Dye;
const mockDyes: Dye[];
function randomId(): number;          // parallel-safe (TEST-DESIGN-001)
function randomStringId(): string;
```

All factories accept a `Partial<T>` override object and fill in sensible defaults; IDs default to `randomId()` so suites running in parallel don't collide.

### `@xivdyetools/test-utils/dom`

```ts
function setupLocalStorage(): void;       // installs a jsdom-friendly mock
function setupCanvas(): void;             // 2D context shim
function setupResizeObserver(): void;
function setupFetchMock(): MockFetch;
function setupMatchMedia(query?): void;
```

### `@xivdyetools/test-utils/assertions`

```ts
async function expectJsonResponse(response: Response, expectedStatus?): Promise<unknown>;
// + status / header / cookie assertions on Response
```

### `@xivdyetools/test-utils/constants`

```ts
const TEST_PKCE: { verifier; challenge };
const TEST_SECRETS: { JWT_SECRET; HMAC_SECRET; ... };
```

## Key Patterns / Algorithms

### Mock-first, not record-and-replay
The CF Worker mocks are **inspectable Maps + observed-call arrays**, not network proxies. Tests typically:
1. Construct the mock (`const db = createMockD1Database()`).
2. Pre-seed state (`await kv.put('key', 'value')`) or wire up routing (`db._setupMock(fn)`).
3. Cast into the binding shape (`{ DB: db as unknown as D1Database }`) and pass to the worker under test.
4. Assert against `db._queries`, `kv._store`, etc.
5. Call `_reset()` between tests (or in `beforeEach`).

### Anchored regex for D1 routing (`TEST-DESIGN-002`)
When matching SQL inside `_setupMock`, anchor with `/^\s*SELECT/i` (start anchor + case insensitive) rather than `query.includes('SELECT')`. The "includes" form silently misclassifies queries whose string body mentions another verb.

### Parallel-safe IDs (`TEST-DESIGN-001`)
`randomId()` / `randomStringId()` from `utils/counters.ts` give every factory call a fresh ID. Use these — never hard-code `id: 1` — when running tests in parallel, otherwise the parallel D1 mock can collide on inserts.

### Subpath exports save bundle/type cost
A web-app test that only needs DOM polyfills should `import from '@xivdyetools/test-utils/dom'` — not the root. The root re-exports drag in `@cloudflare/workers-types` (a devDependency here), which slows TypeScript and bloats the test bundle in environments that don't need it.

### Vitest as a peer dependency
`vitest >= 2.0.0` is a **peer** dependency, not a regular dependency: consumers bring their own version, which keeps the workspace from accidentally running two `vitest` instances side-by-side.

## Consumers

- `apps/discord-worker` — D1 / KV / Fetcher mocks, JWT helpers, dye factories.
- `apps/presets-api` — D1 / KV mocks, preset / category / vote / user factories.
- `apps/oauth` — D1 mock, JWT + PKCE helpers.
- `apps/moderation-worker` — service-binding fetcher mock.
- `apps/api-worker` — D1 + KV mocks for caching tests.
- `apps/web-app` — DOM polyfills, dye factories.
- `@xivdyetools/svg` (devDependency) — fixtures for snapshot tests.
- `@xivdyetools/bot-logic` (devDependency) — fixtures for command tests.

## Internal Dependencies

- `@xivdyetools/types` — `Dye`, `Preset`, `User`, etc. for factory return types.
- `@xivdyetools/crypto` — Base64URL helpers for JWT/PKCE.

Peer: `vitest >= 2.0.0`.

## Publishing

```bash
# 1. Bump version in packages/test-utils/package.json
# 2. Build + test
pnpm turbo run build test --filter=@xivdyetools/test-utils

# 3. Publish
pnpm --filter @xivdyetools/test-utils publish --provenance --access public --no-git-checks
```

Note the `package.json#exports` map — if you add a new submodule (e.g., `src/perf/`), add a corresponding `./perf` entry there or it won't be importable by name.
