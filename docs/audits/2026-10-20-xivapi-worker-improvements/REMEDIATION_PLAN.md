# XIVAPI worker consistency and request reuse — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. The user has selected **native execution**; preserve it. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Draft for review. Writing this plan does not authorize implementation or deployment.

**Goal:** Make the existing equipment, facewear and icon integration follow one upstream snapshot and avoid duplicate concurrent Item/Glasses lookups.

**Architecture:** One immutable request context supplies cache identity and upstream selectors. Dedicated icon storage separates retention from public cache headers; a bounded in-flight loader shares decoded lookup data inside one isolate.

**Tech stack:** Existing TypeScript, Hono, Cloudflare Cache API/ExecutionContext, Vitest and Wrangler; no dependency or binding additions.

**Spec:** [Proposed design and scope](README.md).

**Sources:** [Issue #322](https://github.com/FlashGalatine/xivdyetools/issues/322), [original research at e0e48bf5](https://github.com/FlashGalatine/xivdyetools/blob/e0e48bf5813d53addccd6084af6725868139c1c1/docs/audits/2026-10-20-xivapi-offloading/README.md), [current source verification](evidence/BASELINE.md).

**Status basis:** Four selected recommendations, all unimplemented. Six adjacent candidates remain in the design's later register. No fixed or superseded recommendations in this plan.

## Global constraints

- One deploy unit: `apps/api-worker`. No browser, bot, core, acquisition-table, locale or font changes.
- Preserve existing resolve JSON, cached `version: null`, local parsing/dyes and identifier-only upstream payloads.
- Preserve eight-KiB resolve-body and one-MiB streamed icon limits, canonical decimal icon IDs, PNG-only output, redirect refusal, negative-result and truncated-search rules.
- Context discovery: ten-minute success TTL, one-minute retry after failure, three-second timeout, maximum 32 KiB decoded body. Fully canonical inputs skip discovery.
- Never persist or join data in-flight work under an unresolved alias; retain last complete context or bypass shared caching/coalescing on bootstrap failure.
- Canonical game keys are 16 lower-case hex characters; canonical schemas are `exdschema@2:rev:` plus a full 40-character lower-case SHA-1.
- Icons: seven days fresh, 30 days retained internally; versioned public URLs `public, max-age=2592000, immutable`; unversioned URLs `public, max-age=300, must-revalidate`.
- At most 256 pending lookup keys per isolate. Saturation bypasses coalescing for unreserved keys. Coalescing shares decoded data, never request/response bodies or a Hono context.
- Tests use fixtures/local mock upstreams. No live XIVAPI calls in normal build/install/test commands.
- Native implementation; commit each significant task; one fresh final review. Open a PR after the implementation gates pass. Never publish, manually deploy, merge or push to main as part of execution.

## Review focus

1. A request crosses the memo expiry or an alias changes between cache access and fetch: all its data must still use its captured context. Task 1 pins this.
2. A first discovery fails, or only part of an identity is valid: bypass shared data reuse and never write an alias-keyed entry. Task 1 pins this.
3. A browser uses an old moving icon URL or sends malformed/duplicate version selectors: maintain route compatibility, reject invalid selectors and state the old immutable-cache limitation. Task 2 pins this.
4. A 304 arrives without usable retained PNG bytes, or a changed 200 is oversized/not PNG: do not create an empty, unsafe or newly fresh cache entry. Task 3 pins this.
5. Requests overlap partly, one owner disconnects/fails, or the registry saturates: no hangs, poisoned negatives, lost keys, shared I/O objects or invalid cleanup. Task 4 pins this.

---

## Sprint 1 — API worker: snapshot consistency, icons and concurrent misses

Order correctness before optimization; ship the four tasks as one coherent API-worker release.

| ID | Priority | Task / commit boundary |
|---|---|---|
| XIVAPI-001 | P2 | Task 1 — capture upstream context and partition row caches |
| XIVAPI-002 | P2 | Task 2 — version-aware icon transport and cache policy |
| XIVAPI-003 | P3 | Task 3 — retained PNG validators and conditional refresh |
| XIVAPI-004 | P3 | Task 4 — coalesce Item/Glasses misses and complete release verification |

**Ends with:** affected-unit gate → whole graph and root gates → independent review → implementation PR → separately authorized merge running `.github/workflows/deploy-api-worker.yml`. No publish or consumer-deploy sprint is needed. That workflow builds docs and deploys the API worker on main; there is no reachable API-worker staging deployment.

### Task 1 — Capture one upstream context (XIVAPI-001)

**Files**

- Modify: `apps/api-worker/src/chara/xivapi.ts`, `cache.ts`, `router.ts`
- Tests: `apps/api-worker/src/chara/xivapi.test.ts`, `router.test.ts`
- Create tests: `apps/api-worker/src/chara/cache.test.ts`
- Docs: `apps/api-worker/CLAUDE.md`, `docs/developer-guides/environment-variables.md`, `apps/api-worker/docs/reference/chara.md`

**Interfaces**

In `xivapi.ts`, introduce:
```ts
interface XivapiContext {
  readonly base: string;
  readonly version: string;       // canonical, or configured selector on bootstrap failure
  readonly schema: string | undefined;
  readonly cacheNamespace: string | null; // null means identity is unverified
}
interface XivapiResponseIdentity {
  version: string | null;
  schema: string | null;
}
```

`XivapiClient.resolveContext(): Promise<XivapiContext>` replaces `cacheNamespace()`. `searchItems(lookups, context)` and `getGlasses(id, context)` consume it explicitly; their existing result fields gain `schema: string | null` for internal consistency checks. The public resolve envelope does not gain a schema field. Use a collision-free serialized tuple of normalized base/version/schema for `cacheNamespace`; keep row shape version 5 as a separate key component.

`CharaRowCache` accepts the verified namespace; the route does not construct/use it on an unverified context. The route registers its pending discovery promise with its own `executionCtx.waitUntil` before awaiting it, captures one context and records observed response identity on fallback calls to detect mixed snapshots. The icon route applies the same lifetime rule when it needs discovery in Task 2.

- [ ] **1. Write regression tests.** Name/assert:
  - `partitions rows and cached Glasses null by base and schema`: identical game/model keys under two bases and two schemas never replay each other's values; all old-format entries miss.
  - `captures context across memo expiry`: pause after cache read, advance past ten minutes, change the discovery response, then assert both Item and Glasses URLs still send the original game/schema pair.
  - `memoizes the complete context`: concurrent discoveries for one input tuple make one metadata request; different base/version/schema inputs do not join. Check exact ten-minute and one-minute retry boundaries, and assert each route registers pending discovery with its own execution context.
  - `uses canonical pins without discovery`: a full pair generates zero discovery calls; shorter/moving selectors use the metadata probe.
  - `bypasses shared reuse on bootstrap failure`: timeout/503, invalid JSON, missing schema, truncated/oversized body or malformed canonical keys yield no cache reads/writes and no literal-alias entries; fallback data calls can still succeed.
  - `retains the last complete pair after discovery failure`: never combine a new version with an old schema.
  - `refuses response identity drift`: mismatched/missing identity on a successful verified-context response gives 503 and no write. A verified Glasses 404 remains cacheable null; conflicting Item/Glasses fallback metadata gives 503.
- [ ] **2. Run RED:** `pnpm --filter xivdyetools-api-worker exec vitest run src/chara/xivapi.test.ts src/chara/cache.test.ts src/chara/router.test.ts --coverage.enabled=false`. Confirm the new cases fail for the missing behavior.
- [ ] **3. Implement the interfaces.** Use one bounded `Item/1?fields=Name` probe instead of today's `/api/version` request. Include requested version/schema, validate row 1 plus canonical metadata, memoize complete results, and reuse captured selectors for all data calls. Discovery failure is not a partially valid context. Cache only verified identities; do not add a production pin or duplicate metadata request.
- [ ] **4. Run GREEN:** repeat the focused command, then `pnpm --filter xivdyetools-api-worker run type-check lint`. Update test fixtures with canonical identities; do not loosen metadata assertions to retain old stubs.
- [ ] **5. Update the task's docs and commit:** `fix(api-worker): pin lookup cache identity`. Explain cache bypass, last-good context and discovery-excluded `X-Cache` semantics.

### Task 2 — Version-aware icon transport (XIVAPI-002)

**Files**

- Modify: `apps/api-worker/src/chara/xivapi.ts`, `router.ts`
- Create: `apps/api-worker/src/chara/icons.ts`, `icon-cache.ts`
- Tests: existing `xivapi.test.ts`, `router.test.ts`; new `icon-cache.test.ts`
- Docs: `apps/api-worker/docs/reference/chara.md`, `apps/api-worker/docs/.vitepress/theme/lib/endpoints.ts`, `apps/api-worker/CLAUDE.md`

**Interfaces**

Add `XivapiAssetContext { readonly base: string; readonly version: string; readonly cacheable: boolean }`. `XivapiClient.resolveAssetContext(versionOverride?: string): Promise<XivapiAssetContext>` uses a validated canonical override/configured game key directly, otherwise projects Task 1's context. It never requires a schema probe for an explicitly pinned asset.

`iconAssetUrl(base: string, iconId: number, version: string): string` adds the version query. `fetchIcon(iconId: number, context: XivapiAssetContext, ifNoneMatch?: string): Promise<Response>` sends PNG Accept and an optional internal validator, with the existing timeout and manual redirect policy.

`CharaIconCache(ctx: ExecutionContext)` in `icon-cache.ts` uses a dedicated `chara-icons` named store. `get(context, iconId): Promise<IconCacheEntry | null>` and `put(context, iconId, entry): Promise<void>` store only cacheable contexts. `IconCacheEntry` contains bounded validated `bytes: Uint8Array`, `etag: string | null`, `cachedAt: number`; timestamps/validator live in internal headers. Keys include policy version 1 plus serialized base/game/id.

`loadIcon(client: XivapiClient, context: XivapiAssetContext, iconId: number, cache: CharaIconCache): Promise<IconPayload>` in `icons.ts` owns validation and freshness. `IconPayload` contains decoded `bytes: Uint8Array`, `cacheStatus: 'HIT' | 'MISS'`, and `cacheUpdate: IconCacheEntry | null`. Fresh hits and uncacheable contexts return no update. The route builds the public response and, when an update exists, schedules `cache.put(context, iconId, cacheUpdate)` using its own execution context. Task 2 fetches stale entries unconditionally; Task 3 adds conditional refresh.

- [ ] **1. Write regressions:** verify explicit versions reach `/api/asset`; changing game/base/policy cannot replay old bytes; unknown query parameters still collapse to one key. Empty, repeated, uppercase, short or nonhex `version` is 400 before any discovery or asset fetch. Unversioned requests follow the resolved game key; explicit pins cost no discovery. Assert exact public headers for both URL forms and no internal headers in responses.
- [ ] **2. Run RED:** `pnpm --filter xivdyetools-api-worker exec vitest run src/chara/xivapi.test.ts src/chara/icon-cache.test.ts src/chara/router.test.ts --coverage.enabled=false`.
- [ ] **3. Implement the interfaces and route integration.** Keep icon ID parsing and validation before upstream work. Extract icon transport/storage from the growing router, retain all current error codes and PNG/sandbox/nosniff behavior, and stop reading the old unversioned default-cache entries. Store under one synthetic key independent of request hostname. No changes to consumer icon URL builders.
- [ ] **4. Run GREEN:** repeat the focused command; run `pnpm --filter xivdyetools-api-worker run type-check lint`. Keep the current 404, malformed PNG, oversized/chunked-body and redirect regressions passing. Cache API absent/read/write failure must remain a usable uncached path.
- [ ] **5. Update the optional parameter in both EndpointCard and endpoint registry, explain the browser migration limitation, and commit:** `fix(api-worker): version icon cache entries`.

### Task 3 — Conditional refresh of retained PNGs (XIVAPI-003)

**Files**

- Modify: `apps/api-worker/src/chara/icons.ts`, `icon-cache.ts`, `xivapi.ts`
- Tests: `icon-cache.test.ts`, `router.test.ts`, `xivapi.test.ts`; create `icons.test.ts`
- Docs: `apps/api-worker/docs/reference/chara.md`, `apps/api-worker/CLAUDE.md`

**Interfaces**

Extend Task 2's `loadIcon` behavior without changing its signature. Keep the in-memory entry shape and stored PNG body. Named constants in `icon-cache.ts` define `ICON_FRESH_MS = 604800000` and `ICON_RETAIN_MS = 2592000000`. A cache read at age >= retention is a miss even if a test double returns the object.

- [ ] **1. Write tests with fake time:** fresh (<7 days) makes zero asset calls; exactly 7 days revalidates with the stored ETag; 304 returns identical PNG bytes as HTTP 200 and refreshes timestamp while retaining/updating the validator. A changed 200 replaces bytes/validator only after validation. Exactly 30 days is a miss with no validator. Missing ETag fetches unconditionally. A standalone 304, corrupt retained entry, oversized 200 and non-PNG 200 cannot produce a successful fresh entry. Timeout/429/5xx/404 leave any prior timestamp unchanged and preserve the existing error mapping.
- [ ] **2. Run RED:** `pnpm --filter xivdyetools-api-worker exec vitest run src/chara/icons.test.ts src/chara/icon-cache.test.ts src/chara/xivapi.test.ts src/chara/router.test.ts --coverage.enabled=false`.
- [ ] **3. Implement conditional refresh.** The HTTP helper must permit 304 only for conditional asset handling; keep all other 3xx refused. A 304 requires matching retained validated bytes and is never forwarded as an empty image. Read stored bodies with the same one-MiB bound; invalid storage becomes a miss. No body+304 means 503 without an automatic retry. On failed refresh, do not extend the retained entry or serve it as a stale success.
- [ ] **4. Run GREEN:** repeat the focused command and `pnpm --filter xivdyetools-api-worker run type-check lint`. Assert independent public responses: reading one body never consumes another request's response. Public cache headers must remain Task 2's headers on fresh, 200-refresh and 304-refresh paths.
- [ ] **5. Document retention versus freshness and commit:** `perf(api-worker): revalidate cached icons`.

### Task 4 — Coalesce Item/Glasses misses and finish (XIVAPI-004)

**Files**

- Create: `apps/api-worker/src/chara/lookup-loader.ts`, `lookup-loader.test.ts`
- Modify: `apps/api-worker/src/chara/router.ts`
- Tests: `apps/api-worker/src/chara/router.test.ts`
- Create hermetic runtime check: `apps/api-worker/tests/chara-concurrency.test.mjs`
- Modify: `apps/api-worker/package.json` (runtime-check script and release version), `apps/api-worker/CHANGELOG.md`, `apps/api-worker/CLAUDE.md`
- Docs: `apps/api-worker/docs/reference/chara.md`, `docs/projects/api-worker/overview.md`, root `README.md`, `docs/versions.md`

**Interfaces**

A per-request `CharaLookupLoader(client: XivapiClient, context: XivapiContext, cache: CharaRowCache | null, executionCtx: ExecutionContext)` in `lookup-loader.ts` provides:

- `loadRows(misses: readonly SlotLookup[]): Promise<{ rows: Map<string, ItemRow[]>; version: string | null; schema: string | null; truncated: boolean }>`
- `loadGlasses(id: number): Promise<{ row: GlassesRow | null; version: string | null; schema: string | null }>`

It consumes Task 1's context/row cache and existing `indexRows`/`lookupKey`. Module-level registries reserve keys per verified context, row shape version, operation and family/id; promises resolve to decoded per-key data and metadata. Reservation occurs before any await. The owner groups only its new row keys into one search and schedules that result's cache writes; waiters never repeat those writes. For unverified contexts or keys beyond the shared cap, use the normal uncached/coalescing-bypass path as appropriate (verified overflow may still use persistent caching).

Only Item and Glasses use this loader. Leave Universalis, icon refresh and context discovery's own memo independent.

- [ ] **1. Write deterministic concurrency tests with deferred upstream promises:**
  - Identical simultaneous imports perform one Item search and one Glasses fetch; all response bodies remain independently readable and equivalent.
  - Overlap `[Head:A, Body:B]` and `[Body:B, Feet:C]`: the owner fetches A+B, the second request fetches only C, and both receive B. Keep independent keys concurrent and retain batching for an entirely new 12-slot import.
  - Same model with a different slot, base, game, schema, operation or Glasses ID never joins. An unresolved context never joins.
  - Complete empty rows and Glasses null are legitimate shared negatives; timeout/429/503/rejection are not. All waiters settle on failure; the next request can retry.
  - Truncated owner pages satisfy current requests only, do not persist even apparent negatives/positives, and can be retried by a later request.
  - Fill 256 pending keys, then submit additional unique keys: no active owner is evicted, no key is lost, and overflow fetches normally. After settlement the registry is empty; stale-owner cleanup cannot delete a replacement entry.
  - A disconnected first caller does not strand a second waiter; request abort is not wired to another invocation's work. `X-Cache` is MISS for waiters and HIT for wholly cached data.
- [ ] **2. Run RED:** `pnpm --filter xivdyetools-api-worker exec vitest run src/chara/lookup-loader.test.ts src/chara/router.test.ts --coverage.enabled=false`.
- [ ] **3. Implement the loader and route integration.** Share decoded data only and give each waiter its own data view where mutation could occur. Register the owner's bounded promise with its own `executionCtx.waitUntil`; clean up exact entry identity on all terminal paths. No polling, background interval, permanent result memo or arbitrary post-completion delay. Preserve the existing search timeout and one-search batching.
- [ ] **4. Run GREEN** with the focused command, then add `test:chara-runtime = node --test tests/chara-concurrency.test.mjs`. This test launches Wrangler in local mode plus a local fixture HTTP upstream, makes two held-open concurrent resolve requests, disconnects the first and asserts the second completes with the shared data, one upstream data call and no cross-request-I/O runtime error. Exercise both a held data call with canonical pins and a held context discovery with moving selectors; discovery must also survive its owner's disconnect with one probe. Stub all upstream routes locally, check subprocess failures, bound the harness, and terminate only its own child processes in `finally`. Run after dependency builds using `pnpm --filter xivdyetools-api-worker run test:chara-runtime`; include it in the implementation's validation evidence. A Node/Vitest mock alone does not verify Workers request ownership.
- [ ] **5. Apply release/docs changes.** Recheck the current branch/released version before bumping. Baseline API worker is 0.20.1; propose **0.21.0** for the additive optional icon query plus internal fixes, unless an existing pending release already carries them. Update its technical changelog and version tables. No root player-facing changelog announcement for this internal/API-only release. Explain per-isolate scope, unchanged row freshness behavior, coalesced MISS and the cache-write gap.
- [ ] **6. Run release gate** below, review the final diff and commit: `perf(api-worker): coalesce chara lookup misses`. Obtain one fresh whole-branch review; fix findings with focused regressions and rerun affected gates before opening the implementation PR.

## Release gate and handoff

Run commands from the worktree root; the ellipsis in the unit selector is leading:

```bash
pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker
pnpm --filter xivdyetools-api-worker run test:chara-runtime
pnpm turbo run build type-check lint test --concurrency=2
pnpm type-check:scripts
pnpm test:scripts
pnpm dead-code:check
pnpm docs:check-versions
pnpm docs:check-links
pnpm workers:check-logs
gitleaks git --no-banner --redact --log-opts="origin/main..HEAD"
```

Before opening the PR, rebase/merge current main in this feature worktree as appropriate; never force-push or switch the shared checkout. Check any new production configuration against Wrangler invariants. Use the existing API-worker docs build (`build`/`build:docs`), and inspect the rendered icon parameter/caching copy if it changed. No web bundle/font/release work is required unless execution broadens scope.

The PR must state the new optional version parameter, header compatibility/migration window, one-time cold caches, per-isolate deduplication limits, discovery fallback and observed test/runtime results. Do not claim a new total latency guarantee or a measured upstream request-volume reduction from synthetic tests alone.

Keep this planning snapshot frozen; record execution in a new handoff rather than rewriting archived research. No task is marked complete until its test evidence, commit and final disposition exist.

## Deferred / superseded / KEEP

No selected ID is superseded or duplicated. The six adjacent candidates and their revisit triggers are in [the design's later register](README.md#later-register); they are not unfinished tasks in this sprint. Dye audit PR #324 remains a separate delivery, with no dependency on this worker rollout.
