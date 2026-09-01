# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/test-utils` is the **shared testing toolbox** for the entire workspace: Cloudflare Workers binding mocks (D1, KV, R2, Service Bindings, Analytics Engine), authentication helpers (JWT, bearer-token headers), domain object factories (`createMockPresetRow`, `createMockCategoryRow`, `createMockDye`, `mockDyes`, etc.), and test constants (PKCE values). A 2026-08-18 dead-code audit (DEAD-026/027, Task 5) removed the `/dom` and `/assertions` subpaths and the `factories/user.ts` / `factories/vote.ts` / `auth/context.ts` / `constants/secrets.ts` modules — all had zero consumers anywhere in the workspace; see the package CHANGELOG's "Removed (2026-08-18 dead-code audit)" entry for the full list, including the two DEAD-026 candidates that turned out to have live consumers in this package's own `integration/` suite and were kept instead. One of those two was reversed 2026-08-31 (FINDING-015, Sprint 11 fix round): `auth/signature.ts`'s v1 bot-signature helpers lost their only remaining consumer when the v1-signature integration tests they backed were deleted, and are gone along with it — see "Removed (2026-08-31, FINDING-015)" in the CHANGELOG.

Every worker app that declares it (`discord-worker`, `presets-api`, `oauth`, `moderation-worker`, `api-worker`) uses these mocks in their Vitest suites — see "Consumers" below for the actual per-app slice. `vitest >= 2.0.0` is a peer dependency; consumers bring their own `vitest`.

The package ships **subpath exports** so consumers can import only the slice they need (`@xivdyetools/test-utils/cloudflare`, `/auth`, `/factories`, `/constants`) and avoid pulling Workers types into tests that don't need them.

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
│   └── analytics.ts          # createMockAnalyticsEngine (consumed by discord-worker's
│                              #   src/test-utils.ts since Task 5's DEAD-005 consolidation)
├── auth/                     # JWT, header helpers
│   ├── jwt.ts                 # createTestJWT, createExpiredJWT
│   └── headers.ts            # authHeaders (bearer-token header builder)
├── factories/                # Domain object factories
│   ├── preset.ts              # createMockPresetRow, createMockSubmission
│   ├── category.ts            # createMockCategoryRow
│   └── dye.ts                 # createMockDye, mockDyes
├── constants/
│   └── pkce.ts                # VALID_CODE_VERIFIER / VALID_CODE_CHALLENGE
└── utils/
    └── counters.ts            # randomId, randomStringId (parallel-safe; TEST-DESIGN-001)
```

`/dom`, `/assertions`, `factories/user.ts`, `factories/vote.ts`, `auth/context.ts`, `constants/secrets.ts`, and `utils/crypto.ts` were removed 2026-08-18 (dead-code audit, DEAD-026/027) — zero consumers anywhere in the workspace. Internal callers of the old `utils/crypto.ts` pass-through now import `@xivdyetools/auth/encoding` directly. `auth/signature.ts` (kept in that same 2026-08-18 pass because the integration suite still used it) was removed later, 2026-08-31 — its v1 bot-signature helpers lost their only consumer when the v1-signature test blocks in `integration/discord-presets/bot-authentication.test.ts` were deleted (FINDING-015, 2026-08-29 security audit, Sprint 11 fix round).

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
function createTestJWT(secret, payload, expiresInSeconds?, issuer?): Promise<string>;
function createExpiredJWT(secret, payload?): Promise<string>;
function authHeaders(token, userId?, userName?): Record<string, string>;
```

The v1 bot-signature helpers (`createBotSignature`, `createTimestampedSignature`, `verifyBotSignature`, `TEST_SIGNING_SECRET`) that used to be documented here were removed 2026-08-31 — see "Key Directories" above.

### `@xivdyetools/test-utils/factories`

```ts
function createMockPresetRow(overrides?): PresetRow;
function createMockSubmission(overrides?): PresetSubmission;
function createMockCategoryRow(overrides?): CategoryRow;
function createMockDye(overrides?): Dye;
const mockDyes: Dye[];
```

Factories accept a `Partial<T>` override object and fill in sensible defaults; row IDs default to `randomId()`/`randomStringId()` from `utils/counters.ts` so suites running in parallel don't collide. `randomId`/`randomStringId` themselves are exported from the root barrel (`utils/index.ts`), not from `/factories`.

### `@xivdyetools/test-utils/constants`

```ts
const VALID_CODE_VERIFIER: string;   // RFC 7636 PKCE test verifier
const VALID_CODE_CHALLENGE: string;  // matching-format test challenge
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
A test that only needs the PKCE constants should `import from '@xivdyetools/test-utils/constants'` — not the root. The root re-exports drag in `@cloudflare/workers-types` (a devDependency here), which slows TypeScript and bloats the test bundle in environments that don't need it.

### Vitest as a peer dependency
`vitest >= 2.0.0` is a **peer** dependency, not a regular dependency: consumers bring their own version, which keeps the workspace from accidentally running two `vitest` instances side-by-side.

## Consumers

- `apps/discord-worker` — KV / Analytics Engine mocks (`src/test-utils.ts`'s `createMockEnv`, since Task 5's DEAD-005 consolidation).
- `apps/presets-api` — D1 mock, JWT helpers, preset / category factories (`tests/test-utils.ts` shim).
- `apps/oauth` — D1 mock, JWT + PKCE helpers.
- `apps/moderation-worker` — service-binding fetcher mock.
- `apps/api-worker` — D1 + KV mocks for caching tests.
- `@xivdyetools/svg` (devDependency) — fixtures for snapshot tests.

`apps/web-app` does **not** consume this package (it has its own local test mocks); `@xivdyetools/bot-logic` and `apps/stoat-worker` declare it as a devDependency but never import it (Task 6 territory — see the dead-code audit's Wave 3 plan).

## Internal Dependencies

- `@xivdyetools/types` — `Dye`, `Preset`, `User`, etc. for factory return types.
- `@xivdyetools/auth` — Base64URL helpers for JWT/PKCE (imported via `@xivdyetools/auth/encoding`).

Peer: `vitest >= 2.0.0`.

## Publishing

**Not published.** Since 2026-07-30 (Monorepo 2.0 Tier 1) this package is `"private": true` — it is consumed only via `workspace:*` devDependencies and has no external audience. It was removed from the Publish Packages workflow; versions up to 1.1.8 remain on npm as history.

Note the `package.json#exports` map — if you add a new submodule (e.g., `src/perf/`), add a corresponding `./perf` entry there or it won't be importable by name.
