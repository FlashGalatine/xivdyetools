# Security Code Review — `apps/api-worker`

| | |
|---|---|
| **Deploy unit** | `xivdyetools-api-worker` (production: `data.xivdyetools.app`, `proxy.xivdyetools.app`, `proxy.xivdyetools.projectgalatine.com`, `developers.xivdyetools.app`; top-level config: routeless `xivdyetools-api-worker-dev`) |
| **Review date** | 2026-08-21 |
| **Tree reviewed** | `08a8f522` on `monorepo-2.0-prep` (clean for `apps/api-worker`, `packages/worker-kit`, `packages/core/src/services/chara`) |
| **Method** | Manual, read-only source review of every non-test file in `apps/api-worker/src`, `apps/api-worker/wrangler.toml`, all of `packages/worker-kit/src`, and the `@xivdyetools/core` code paths api-worker calls. Two platform facts were verified against Cloudflare's documentation (KV per-key write throttle; `workers_dev` inference). Nothing was executed against production and no source file was modified. |
| **Stack** | Cloudflare Workers + Hono 4.13.1 (lockfile) + KV (`RATE_LIMIT`) + Cache API + Workers Static Assets (`ASSETS`, production only) |

## 0. Executive summary

The worker is a well-partitioned, anonymous, read-mostly API. Input validation is strict and allow-list based everywhere that matters (datacenter/world names, item-ID lists, hex colours, enums, slot names, 16-bit lanes), every outbound URL is built from configuration plus validated integers or allow-listed strings, the Cache API keys are canonicalised from validated input and a fixed origin, and the request coalescer is correct. No SSRF, no open proxy, no injection, no cross-user data exposure and no cache-poisoning primitive that an attacker controls were found.

The findings are about **abuse controls and robustness**, not data safety:

- **API-1 (MEDIUM)** — the only abuse control on `/v1/*`, the KV-backed limiter, arithmetically cannot trip for any client faster than ~1 req/s, because Cloudflare KV rejects more than one write per second per key (documented, `429`), the backend swallows the failed `put`, and the 60-second fixed window therefore caps the counter at ~60 < the 65-request ceiling. It also degrades to "no limit" if the account's daily KV write quota is exhausted.
- Five **LOW** items: body cap enforced only after full buffering (`/v1/chara/resolve`); a 7-day per-key cache that can be filled with empty/partial answers if the single XIVAPI search is truncated; a non-canonical icon cache key that lets one client bypass the shared edge entry; a dev worker that is publicly reachable on `workers.dev` with stack traces if it has ever been deployed; and the two operational edges of the Universalis relay (origin-agnostic by design, and service-binding callers share one rate-limit bucket).
- Seven **INFO** hardening nits.

Correction to the review brief: `POST /v1/chara/resolve` does **not** accept an uploaded binary `.chara` file. The web app parses the (JSON) `.chara` file client-side with `@xivdyetools/core`'s `parseCharaFile()` and posts only `{ gear: [{slot, set?, base, variant}], glasses? }` — twelve small integers plus a facewear row. There is no binary offset/length parsing anywhere in this deploy unit. Also, `RATE_LIMIT_REQUESTS=30` in production governs only the Universalis memory limiter; the `/v1/*` KV limiter is hard-coded to 60 + 5 burst.

Severity counts: CRITICAL 0 · HIGH 0 · MEDIUM 1 · LOW 6 · INFO 7.

---

## 1. Findings

### API-1 — `/v1/*` KV rate limiter cannot block fast clients (KV 1-write/s/key throttle + swallowed `put` errors)

| | |
|---|---|
| **Severity** | **MEDIUM** — the sole abuse control on the public API and on the XIVAPI-proxying chara routes is defeated by exactly the traffic pattern it exists to stop; impact is availability/cost and third-party (XIVAPI) shared fate, not confidentiality. |
| **CWE** | CWE-799 (Improper Control of Interaction Frequency), CWE-390 (Detection of Error Condition Without Action) |
| **Confidence** | **CONFIRMED** (code path + Cloudflare-documented platform behaviour; deterministic arithmetic; not live-tested) |
| **Files** | `packages/worker-kit/src/rate-limiter/backends/kv.ts:108-120` (`check`), `:125-182` (`checkOnly`), `:193-252` (`increment` retry loop, no rethrow), `:283-286` (`buildKey` — 60 s fixed window); `apps/api-worker/src/middleware/rate-limit.ts:24-34` (60 + 5 burst, `failOpen: true`, `onError: 'fail-open'`); `apps/api-worker/src/index.ts:92` |

Excerpt (`kv.ts:193-252`, abridged):

```ts
async increment(key, config, now = Date.now()): Promise<void> {
  const kvKey = this.buildKey(key, now, config.windowMs);   // api:ip:<ip>|<floor(now/60000)>
  for (let attempt = 0; attempt < this.maxRetries; attempt++) {   // 3 tight retries, no backoff
    try {
      const result = await this.kv.get(kvKey);
      …
      await this.kv.put(kvKey, JSON.stringify(entry), { expirationTtl: ttl });
      return;
    } catch (error) {
      if (attempt === this.maxRetries - 1) { /* log */ }            // ← swallowed, never rethrown
    }
  }
}
```

Cloudflare KV, per its documentation ("Write key-value pairs → Limits to KV writes to the same key"): *"Workers KV has a maximum of 1 write to the same key per second. Writes made to the same key within 1 second will cause rate limiting (`429`) errors to be thrown."* The limiter's key is one per IP per 60-second window, so at most ~60 increments can ever succeed inside a window. `checkOnly` allows while `entry.count < 65` (60 + `burstAllowance` 5). The counter therefore tops out at ≈60 and the condition is never false. The three immediate retries all land inside the same second and fail too. `check()` then returns `allowed: true` and even decrements `remaining` as if the request had been counted, so `X-RateLimit-Remaining` looks healthy.

Aggravating factors:
- `failOpen: true` + `onError: 'fail-open'` — any KV outage is also "no limit" (documented/accepted, listed here because it compounds).
- If the account is on the Workers Free plan (the cache-service comment at `universalis/services/cache-service.ts:5-6` says the proxy moved off KV *"to eliminate KV write limits on the free tier"*), KV allows 1,000 writes/day; once exhausted every `put` throws and the `/v1` limiter silently stops counting for the rest of the UTC day (PLAUSIBLE — depends on plan).
- Each `/v1` request costs 2 KV reads + up to 3 write attempts; a flood is billed to the operator, not the attacker.
- Cross-cutting: the same `KVRateLimiter` is consumed by other workers (presets-api, oauth) — out of this unit's scope but the defect is shared.

Exploit scenario: one IP runs `seq 1 5000 | xargs -P 20 -I{} curl -s https://data.xivdyetools.app/v1/dyes/batch?ids=1,2,3 -o /dev/null` → every response is `200`, no `429` ever appears (count ≈ 60 at the end of each minute, threshold 65). Swap the target for `POST /v1/chara/resolve` with a fresh `base`/`variant` per request (65,535² × 12 distinct keys available) → every request is a Cache-API miss → one XIVAPI `/api/search` per request, indefinitely, from the worker's fixed UA. XIVAPI blocks or throttles the worker → `503 UPSTREAM_UNAVAILABLE` for every real user's glamour import. Same for `/v1/chara/icon/:id` with non-cached ids (see API-4).

Recommended fix:
1. Replace KV for this purpose with the Workers **Rate Limiting binding** (`[[ratelimits]]` / `env.RATE_LIMITER.limit({ key })` — atomic, per-colo, no KV ops), or a Durable Object counter; `worker-kit` already ships `UpstashRateLimiter` (Redis `INCR`, atomic) if an external store is acceptable.
2. If KV must stay: treat a `429` on `put` as a *positive* abuse signal (a client that collides on the 1 s write rule is by definition >1 rps) rather than swallowing it; remove the three zero-backoff retries; and make `check()` not report the request as counted when the write failed.
3. Correct the public statement in `docs/guide/rate-limits.md` and `CLAUDE.md` ("60 req/min per IP … enforced") until the control actually enforces.

---

### API-2 — `/v1/chara/resolve` buffers the entire request body before enforcing the 8 KB cap

| | |
|---|---|
| **Severity** | **LOW** — the intended 8 KB bound is bypassable by omitting `Content-Length` (HTTP/1.1 chunked or HTTP/2), allowing up to the platform's ~100 MB body to be buffered into a 128 MB isolate; effect is isolate-local, transient, and rate-limited (but see API-1). |
| **CWE** | CWE-770 (Allocation of Resources Without Limits or Throttling) |
| **Confidence** | CONFIRMED (code); OOM impact PLAUSIBLE |
| **Files** | `apps/api-worker/src/chara/router.ts:42` (`MAX_BODY_BYTES = 8 * 1024`), `:140-155` (`readJsonBody`) |

```ts
async function readJsonBody(raw: Request): Promise<unknown> {
  const length = Number(raw.headers.get('Content-Length') ?? '0');   // absent → 0 → passes
  if (length > MAX_BODY_BYTES) throw new ApiError(…, 413);
  const text = await raw.text();                                      // ← full buffer first
  if (text.length > MAX_BODY_BYTES) throw new ApiError(…, 413);       // UTF-16 units, not bytes
```

Exploit: `curl -X POST https://data.xivdyetools.app/v1/chara/resolve -H 'Content-Type: application/json' -H 'Transfer-Encoding: chunked' --data-binary @100MB.json` (or any HTTP/2 client that streams without a length). The worker reads 100 MB into a string (UTF-16 doubles it) before the size check; the isolate exceeds its memory limit and is torn down along with every other in-flight request on it. Sustained from one IP this is 65/min by design — or unbounded under API-1.

Fix: use Hono's `bodyLimit({ maxSize: 8 * 1024 })` on the route, or read `raw.body` with a reader and abort once the byte counter passes 8 KB (the proxy already has this exact pattern in `universalis/services/cached-fetch.ts:148-169`, `readBounded`). Compare bytes, not `text.length`.

---

### API-3 — Per-key chara row cache can be filled with empty/partial families for ~8 days when the batched XIVAPI search is truncated

| | |
|---|---|
| **Severity** | **LOW** — integrity of a non-security feature (item names) for up to 7 d + 1 d SWR, user-influenceable but requires crafting a request whose combined families exceed XIVAPI's 500-row cap. |
| **CWE** | CWE-754 (Improper Check for Unusual or Exceptional Conditions) |
| **Confidence** | PLAUSIBLE |
| **Files** | `apps/api-worker/src/chara/xivapi.ts:34` (`SEARCH_LIMIT = 500`), `:112` (`next?: string` declared, never read), `:207-219`; `apps/api-worker/src/chara/router.ts:194-203` (every miss — including an empty `found` — is stored); `apps/api-worker/src/chara/cache.ts:21-25` (7 d + 24 h), `:66-68` |

```ts
// router.ts:198-202
for (const lookup of misses) {
  const found: ItemRow[] = index.get(lookupKey(lookup)) ?? [];
  rows.set(lookupKey(lookup), found);
  cache.storeRows(lookup, found);          // ← [] cached 7 days even if the page was truncated
}
```

All up-to-12 lookups of a request go to XIVAPI as **one** nested-group query with `limit=500`; the response's `next` cursor is ignored. If the families matched by that request sum past 500 rows, the tail groups come back incomplete or absent, and the code caches `[]` ("no item row") or a family missing its lowest `row_id` under those keys. Every later user importing that real item gets `null` (or the wrong primary name) until the entry ages out. The comment at `xivapi.ts:13` asserts "one file's families fit comfortably" — true for real files, but the request body is attacker-authored.

Exploit: POST a body combining the 12 slot keys with the largest known families (the resolver docs note a single aetherotransformer key matching 347 gun rows; role/Replica/Augmented sets are the usual multi-row families) so that the 500-row page truncates; the truncated slot keys are now poisoned for 8 days for everyone.

Fix: when `body.next` is set or `results.length === SEARCH_LIMIT`, do not store empty/partial results for that request (or page through `next` before indexing); optionally cap the per-request total by splitting into per-slot queries when a family is known to be large.

---

### API-4 — Icon proxy edge cache is keyed on the un-normalised request path; lenient `parseInt` lets one client bypass the shared entry and force a fresh XIVAPI fetch per request

| | |
|---|---|
| **Severity** | **LOW** — 1:1 (no amplification) upstream traffic that defeats the "every viewer shares one edge entry" design and fills the edge cache with aliases; bounded only by API-1. |
| **CWE** | CWE-400 (Uncontrolled Resource Consumption), CWE-20 |
| **Confidence** | CONFIRMED |
| **Files** | `apps/api-worker/src/chara/router.ts:240-245` (cache key = `c.req.url` with query stripped), `:254-258`; `apps/api-worker/src/lib/validation.ts:145` (`parseInt(value, 10)`) |

```ts
const iconId = parseIntParam(c.req.param('iconId'), 'iconId', { min: 1, max: 999_999 }); // '41716abc' → 41716
const url = new URL(c.req.url); url.search = '';
const cacheKey = new Request(url.toString(), { method: 'GET' });   // ← path kept verbatim
```

`/v1/chara/icon/41716`, `/041716`, `/0000041716`, `/41716abc`, `/41716%20`, `/41716%2Fx` all parse to icon 41716 but are distinct `caches.default` keys; each first hit is a full XIVAPI `/api/asset` round-trip and a new 30-day edge object. Not a poisoning vector (content always matches the parsed id) but a cache-busting one. The same leniency exists on `/v1/dyes/:id` and `/v1/dyes/stain/:stainId` (harmless there — no cache, no upstream).

Fix: build the cache key from the canonical parsed id (`new Request(\`${origin}/v1/chara/icon/${iconId}\`)`) and reject non-canonical ids with a strict pattern (`/^[1-9]\d{0,5}$/`) in `parseIntParam` callers that feed caches or upstreams.

---

### API-5 — Routeless dev worker is deployable with `workers.dev` implicitly enabled and `ENVIRONMENT=development` (stack traces in 500s, no HSTS, dev KV)

| | |
|---|---|
| **Severity** | **LOW** — information disclosure of bundle paths/stack traces plus a second, publicly reachable copy of the Universalis/XIVAPI relay; depends on whether `pnpm deploy` has ever been run. |
| **CWE** | CWE-209 (Error Message Containing Sensitive Information), CWE-489 (Active Debug Code) |
| **Confidence** | PLAUSIBLE (config is CONFIRMED; live exposure not checked) |
| **Files** | `apps/api-worker/wrangler.toml:6-30` (top-level env: `name = "xivdyetools-api-worker-dev"`, no `routes`, no `workers_dev = false`); `apps/api-worker/src/index.ts:162, 191-193` (`message: isDev ? err.message : …`, `...(isDev && { stack: err.stack })`); `apps/api-worker/CLAUDE.md:15` documents `pnpm deploy` as the ad-hoc path |

Cloudflare's documentation: *"If you do not specify `workers_dev = false` but add a routes component … the value of `workers_dev` will be inferred as `false` on the next deploy."* The production env has routes → inferred off. The top-level env has none → `workers.dev` (and, on wrangler ≥ 4.44, preview URLs) default **on**, so `xivdyetools-api-worker-dev.<account>.workers.dev` is public after any `pnpm deploy`.

Exploit: find the account subdomain (visible from any other `workers.dev` worker), request `https://xivdyetools-api-worker-dev.<sub>.workers.dev/v1/dyes?page=abc` or trigger any unhandled throw → JSON 500 carrying `err.message` and `err.stack` (bundle paths, dependency internals); use the host as an unthrottled relay.

Fix: add `workers_dev = false` and `preview_urls = false` to the top-level config (production inherits routes already); alternatively front the dev worker with Cloudflare Access. Independently, stop returning `stack` in any HTTP response — log it instead.

---

### API-6 — Universalis relay is origin-agnostic with only a per-isolate soft limiter (accepted design; `ALLOWED_ORIGINS` is dead config) — upstream-429 shared fate

| | |
|---|---|
| **Severity** | **LOW** — documented/accepted design for a public proxy; the concrete risk is that third-party abuse via `proxy.xivdyetools.app` gets the worker's egress throttled by Universalis, breaking market data for the web app and `/budget` simultaneously. |
| **CWE** | CWE-799, CWE-284 |
| **Confidence** | CONFIRMED (design) |
| **Files** | `apps/api-worker/src/index.ts:72-89` (`cors({ origin: '*' })`), `:137-138`; `apps/api-worker/src/universalis/router.ts:66-90` (limiter), `:171-183` (upstream 429 path); `apps/api-worker/src/universalis/services/rate-limiter.ts:39-46` (per-isolate `MemoryRateLimiter`); `apps/api-worker/src/universalis/types.ts:39` and `test-setup.ts:116,124` (`ALLOWED_ORIGINS` typed/mocked, never read); `docs/reference/universalis.md:50` publicly states the per-isolate limit |

Answer to the brief's question: `ALLOWED_ORIGINS` is **dead config**, not a gap — nothing reads it; the proxy is intentionally a generic relay. No `Origin`/`Referer` policy exists. The memory limiter is per isolate (stated in code), so N isolates/PoPs = N× the budget, and isolate recycling resets it. The Cache API + coalescer are the real upstream protection, but only for repeated (dc, ids) tuples; 1,000,000 ids × 100-per-request × ~100 worlds is an effectively unbounded miss space.

Exploit: a third-party tool (or an attacker) points at `https://proxy.xivdyetools.app/api/v2/aggregated/<world>/<fresh id set>` from many addresses; Universalis returns 429 to the worker's egress; `router.ts:171-183` now answers `429 Rate limited by upstream API` to the web app and to discord-worker's `/budget` for everyone until Universalis relents.

Fix (policy decision): keep open but add a cheap second tier — e.g. a global per-colo token bucket on upstream *misses* (not hits), a stricter budget when `Origin`/`Referer` is not an xivdyetools host (soft allow-list, not a block), and move the per-IP check **after** the cache lookup so hits are free (see API-7). Remove `ALLOWED_ORIGINS` from `universalis/types.ts` and `test-setup.ts` so nobody assumes it is enforced.

---

### API-7 — Service-binding callers (discord-worker `/budget`) share one `unknown` rate-limit bucket on `/api/v2/aggregated`; the check runs before the cache lookup

| | |
|---|---|
| **Severity** | **LOW** — availability: the bot can rate-limit itself at >30 proxy calls/min per isolate, cache hits included; no bypass for external clients (Cloudflare always stamps `CF-Connecting-IP` on edge traffic). |
| **CWE** | CWE-799 |
| **Confidence** | CONFIRMED (code); impact PLAUSIBLE |
| **Files** | `packages/worker-kit/src/rate-limiter/ip.ts:61-78` (`'unknown'` fallback, XFF distrusted by default — correct); `apps/api-worker/src/universalis/router.ts:70-75` (limiter) precedes `:158` (`cachedFetch`); `apps/discord-worker/src/services/budget/universalis-client.ts:126-133` (`new Request('https://internal' + path, …)` — no client-IP header forwarded) |

Service-binding requests carry whatever headers the caller sets; discord-worker sets only `Content-Type`, so `getClientIp()` returns `'unknown'` and every `/budget` price lookup across all Discord users lands in one 30/min bucket per isolate. Because the limiter runs before `cachedFetch`, even fully cached answers consume it.

Fix: in discord-worker forward a stable per-user key (e.g. `X-Budget-Caller: <hash(userId)>`) and have the proxy accept it **only** when `CF-Connecting-IP` is absent (binding-only path), or exempt binding calls; in the proxy, do the Cache-API lookup first and only charge the limiter on misses.

---

### API-8 — Upstream/internal error details echoed to clients on the Universalis routes

| | |
|---|---|
| **Severity** | **INFO** — minor implementation detail leak (`statusText` of upstream, raw `Error.message` such as JSON parse or fetch internals). |
| **CWE** | CWE-209 |
| **Confidence** | CONFIRMED |
| **Files** | `apps/api-worker/src/universalis/router.ts:186-192` (`message: error.statusText`), `:214-220` (`message: error instanceof Error ? error.message : 'Unknown error'`) |

Fix: log the detail (already done via `getLogger(c)`) and return a constant message; keep `requestId` for correlation. The `/v1` `onError` handler already does this correctly in production (`index.ts:187-196`).

---

### API-9 — No timeout on the Universalis upstream fetch; redirects followed by default on both upstream clients

| | |
|---|---|
| **Severity** | **INFO** — a hung Universalis response pins the request and every coalesced waiter for up to the coalescer's 60 s sweep / platform subrequest limit; `redirect: 'follow'` means a compromised or misconfigured upstream could redirect the worker to a third host and have that body cached. Upstreams are trusted, so hardening only. |
| **CWE** | CWE-400, CWE-601 (server-side variant) |
| **Confidence** | CONFIRMED |
| **Files** | `apps/api-worker/src/universalis/services/cached-fetch.ts:121-127` (no `signal`, no `redirect`); `apps/api-worker/src/chara/xivapi.ts:185-189` (has `AbortSignal.timeout(10_000)`, no `redirect`) |

Fix: `signal: AbortSignal.timeout(10_000)` in `fetchFromUpstream`; `redirect: 'error'` (or `'manual'` + host check) on both clients.

---

### API-10 — Docs host responses bypass the worker's security-header middleware

| | |
|---|---|
| **Severity** | **INFO** — `developers.xivdyetools.app` pages get no `X-Content-Type-Options`, `X-Frame-Options` or HSTS from the worker (zone-level HSTS may or may not cover it); static docs, so clickjacking value is nil. |
| **CWE** | CWE-693 (Protection Mechanism Failure) |
| **Confidence** | CONFIRMED |
| **Files** | `apps/api-worker/src/index.ts:35-40` (returns `ASSETS.fetch()` before `:60-67`) |

Fix: ship a `_headers` file in `docs/.vitepress/dist` (Workers Static Assets honours `_headers`/`_redirects`) or wrap the `ASSETS.fetch` response and set the same headers. The VitePress `TryIt.vue` component itself is clean (escaped `{{ }}` interpolation only, `encodeURIComponent` on every param, fixed `BASE`).

---

### API-11 — Dead / misleading configuration

| | |
|---|---|
| **Severity** | **INFO** — no runtime impact, but each item invites a wrong assumption by the next reader (the review brief itself made two of them). |
| **CWE** | CWE-1164 (Irrelevant Code), CWE-1059 (Insufficient Technical Documentation) |
| **Confidence** | CONFIRMED |
| **Files** | `apps/api-worker/src/universalis/types.ts:37-43` + `test-setup.ts:113-130` (`ALLOWED_ORIGINS`, unread); `apps/api-worker/src/index.ts:77` (`X-API-Key` in `allowHeaders`, no API-key feature exists — Phase 2 placeholder); `apps/api-worker/wrangler.toml:23-24,44` vs `middleware/rate-limit.ts:28-33` (`RATE_LIMIT_REQUESTS`/`RATE_LIMIT_WINDOW_SECONDS` govern only the proxy's memory limiter; `/v1` is hard-coded 60 + 5); `middleware/rate-limit.ts:6` still names the retired `@xivdyetools/worker-middleware` |

Fix: delete `ALLOWED_ORIGINS`; drop `X-API-Key` until Phase 2; either read `RATE_LIMIT_REQUESTS` in the `/v1` limiter or rename the vars `PROXY_RATE_LIMIT_*`.

---

### API-12 — Icon proxy reflects upstream `Content-Type` and caches any 2xx body for 30 days

| | |
|---|---|
| **Severity** | **INFO** — the path is pinned to `ui/icon/<n>000/<n>_hr1.tex&format=png` on a trusted upstream, so an SVG/HTML body would require XIVAPI itself to misbehave; `nosniff` is already set. |
| **CWE** | CWE-79 (potential, via MIME confusion) |
| **Confidence** | CONFIRMED (behaviour), exploit THEORETICAL |
| **Files** | `apps/api-worker/src/chara/router.ts:277-283` (`'Content-Type': upstream.headers.get('Content-Type') ?? 'image/png'`), `:261-274` (size check after full `arrayBuffer()`) |

Fix: pin `Content-Type: image/png`, verify the PNG magic bytes before caching, add `Content-Disposition: inline` and `Content-Security-Policy: sandbox`; read with a byte budget as in `readBounded`.

---

### API-13 — Minor input-bound nits

| | |
|---|---|
| **Severity** | **INFO** — harmless today (URL-length bound, 125-entry database, pure `includes()` search). |
| **CWE** | CWE-20 |
| **Confidence** | CONFIRMED |
| **Files** | `apps/api-worker/src/routes/dyes.ts:44-57` (`q` has no length cap), `:269` (`page` has no upper bound), `apps/api-worker/src/routes/match.ts:86` (`maxDistance` accepts `Infinity`); 4xx/5xx envelopes carry no explicit `Cache-Control` (404 is heuristically cacheable by RFC 9111) |

Fix: `q` ≤ 100 chars, `page` ≤ e.g. 1000, `Number.isFinite(maxDistance)`, `Cache-Control: no-store` on error envelopes.

---

### API-14 — Client IP and User-Agent in logs

| | |
|---|---|
| **Severity** | **INFO** — acceptable for abuse forensics on an anonymous API; note it for the data-retention inventory. |
| **CWE** | CWE-532 |
| **Confidence** | CONFIRMED |
| **Files** | `packages/worker-kit/src/middleware/logger.ts:142-145` (`userAgent` per request when `logUserAgent: true`, enabled in `index.ts:55`); `packages/worker-kit/src/middleware/rate-limit.ts:144-150` and `rate-limiter/backends/kv.ts:165-170, 228-247` (`key` = IP on backend failures); `cached-fetch.ts:63-68, 85-89` (`console.log` cache keys — not PII). Query strings are **not** logged (`logger.ts:75-78` logs `pathname` only). |

---

## 2. Positive controls verified

| Area | Verified behaviour | Where |
|---|---|---|
| SSRF / URL construction | Every outbound URL = env base (`UNIVERSALIS_API_BASE`, `XIVAPI_BASE`, `XIVAPI_VERSION`, `XIVAPI_SCHEMA`) + either an allow-listed lowercase DC/world name, a canonicalised digit/comma list, `URLSearchParams`-encoded constant fields, or zero-padded validated integers. No user string reaches a URL unvalidated; no `..`/`?`/`#`/`@`/scheme/host injection possible. The icon proxy is **not** an open proxy (numeric id → fixed `ui/icon/…_hr1.tex` path). | `universalis/router.ts:94-162`, `chara/xivapi.ts:84-102, 176-180, 207-212, 224, 238-240`, `chara/router.ts:240` |
| Path-param decoding | Hono decodes `%xx` in params, so `%2F` etc. become literal characters — all are rejected by the allow-list / regex / `parseInt` guards that follow. `toLowerCase()` Unicode folding (e.g. Kelvin sign) can only produce an ASCII name that then *is* the canonical value. | `universalis/router.ts:94-127, 153-154`, `config/datacenters.ts:148-176` |
| Universalis item IDs | `^[\d,]+$`, 1–100 ids, each integer 1–1,000,000, empty segments rejected (`Number('')` → 0 → `< 1`), deduped + sorted for key and upstream URL (`?listings=5&entries=5` bounds payload). | `universalis/router.ts:124-162` |
| Upstream size bounds | Universalis: `Content-Length` fast-fail + streamed byte budget (5 MB) that cancels the reader. Icon: 1 MB. Search JSON: XIVAPI hard cap 500 rows. | `cached-fetch.ts:129-169`, `chara/router.ts:267-274` |
| Cache keys | `CacheService` URL = `<request origin>/__cache/<encodeURIComponent(key)>` in a **named** cache (`universalis-proxy` / `chara-resolve`); keys embed only validated/canonical values; only `response.ok` JSON bodies are stored; error bodies never cached; request origin is one of the four configured custom domains (not client-controllable on custom-domain Workers). POST `/v1/chara/resolve` envelope is `Cache-Control: no-store`. | `cache-service.ts:65-67, 112-135`, `cached-fetch.ts:92-105`, `chara/cache.ts:35-46`, `chara/router.ts:226-228` |
| Cache-Control hygiene | Stale SWR hits re-served with `max-age=0, must-revalidate` (BUG-028); fresh hits advertise `stale-while-revalidate`; icons `immutable`; dye routes `public, max-age=3600, s-maxage=86400` with locale carried in the URL (no `Vary` needed). | `cached-fetch.ts:237-256`, `routes/*.ts` |
| Request coalescer | Exact-key map, entry inserted synchronously before any await, resolved/rejected promise shared only with same-key waiters, deleted 100 ms after success / immediately on error, jittered sweep of >60 s entries, unhandled-rejection guard. No cross-key sharing, no unbounded growth (cardinality = in-flight set). | `request-coalescer.ts:111-163` |
| Rate-limit key | `getClientIp()` prefers `CF-Connecting-IP`, distrusts `X-Forwarded-For` by default, lower-cases IPv6, uses `\|` delimiter so IPv6 colons cannot collide with the window suffix. CORS preflights never reach the limiter (cors middleware answers `OPTIONS` first). | `ip.ts:53-89`, `kv.ts:283-286`, `index.ts:72-92` |
| `/v1/chara/resolve` validation | Object-only body, `gear` array ≤ 12, slot ∈ 12-name allow-list, each slot at most once, lanes integer 0–65535, empty pieces rejected, `glasses` integer 1–65535, 8 KB JSON cap (see API-2 for enforcement order), no object merging → no prototype pollution. Upstream calls per request ≤ 2 (one batched search + one glasses sheet). | `chara/router.ts:51-138, 172-232` |
| `.chara` parsing | Not binary; JSON with per-field type checks, no offsets/lengths; runs client-side only; unknown tribe/race/gender fails loudly; `readModelLane` clamps to non-negative finite ints. | `packages/core/src/services/chara/chara-parser.ts:279-427`, `chara-models.ts:60-112` |
| Query validation (`/v1/dyes`, `/v1/match`) | Anchored simple regexes (no ReDoS): `^#?[0-9A-Fa-f]{6}$`; enums allow-listed; `perPage` ≤ 200; `ids`/`excludeIds` ≤ 50; `limit` 1–125; booleans strict (`true/false/1/0`); locale ∈ 6 codes; method allow-list with legacy map; `category` exact-match; `searchByName` is `includes()` on pre-lowered names. | `lib/validation.ts`, `core/src/services/dye/DyeSearch.ts:82-143` |
| Error handling | Prod `onError` returns generic message + `requestId`, stack only when `ENVIRONMENT=development`; `ApiError.details` are structured, JSON-encoded; `notFound` echoes pathname inside JSON with `nosniff` (no XSS). | `index.ts:144-197` |
| Security headers / CORS | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, HSTS in prod on every worker-generated response (incl. error paths, since headers are applied after `next()`); `cors({ origin: '*', credentials: false })`; `X-Request-ID` accepted only if UUID (log-injection guard). | `index.ts:60-89`, `worker-kit/middleware/request-id.ts:24, 57-76` |
| Static assets | `run_worker_first = true` + explicit host check means docs never shadow API paths on `data.*` and API paths on `developers.*` fall to the assets 404 page; no filesystem — traversal handled by the platform manifest. | `wrangler.toml:54-58`, `index.ts:35-40` |
| Secrets / auth | None required, none present; no `nodejs_compat`; prod config only under `[env.production]` (BUG-008) so a bare deploy cannot overwrite production. CI deploys with `--env production` via `wrangler-action@v4`. | `wrangler.toml:1-9, 32-62`, `.github/workflows/deploy-api-worker.yml` |
| Docs site | Local search provider, no third-party scripts; `TryIt.vue` escapes all output. | `docs/.vitepress/config.ts`, `theme/components/TryIt.vue` |

## 3. Route table

| Method | Path (host) | Auth | Rate limit | Notes |
|---|---|---|---|---|
| GET | `/` (data/proxy hosts) | none | none | name/version/status JSON |
| GET | `/health` | none | none | `{status, timestamp}` |
| GET | `/v1/dyes` | none | KV 60+5/min/IP (API-1) | filters/sort/pagination, `perPage ≤ 200` |
| GET | `/v1/dyes/search?q=` | none | KV | `includes()` search, locale-aware |
| GET | `/v1/dyes/categories` | none | KV | memoised payload |
| GET | `/v1/dyes/batch?ids=` | none | KV | ≤ 50 ids |
| GET | `/v1/dyes/consolidation-groups` | none | KV | memoised |
| GET | `/v1/dyes/stain/:stainId` | none | KV | `parseInt`, > 0 |
| GET | `/v1/dyes/:id` | none | KV | range auto-detect; legacy negative ids → explanatory 404 |
| GET | `/v1/match/closest?hex=` | none | KV | |
| GET | `/v1/match/within-distance?hex=&maxDistance=` | none | KV | `limit ≤ 125` |
| POST | `/v1/chara/resolve` | none | KV | JSON ≤ 8 KB (API-2), ≤ 2 XIVAPI calls, `no-store` |
| GET | `/v1/chara/icon/:iconId` | none | KV | XIVAPI icon proxy, `caches.default` 30 d (API-4) |
| GET | `/universalis/aggregated/:datacenter/:itemIds` | none | memory 30/min/IP/isolate (prod) | also mounted at `/api/v2/...` (proxy.* hosts, discord-worker binding) |
| GET | `/universalis/data-centers`, `/universalis/worlds` (+ `/api/v2/…`) | none | none | 24 h + 6 h SWR |
| OPTIONS | `*` | — | none | CORS preflight, `maxAge 3600` |
| ANY | `*` on `developers.xivdyetools.app` | none | none | `ASSETS.fetch`, `404-page`; bypasses all API middleware (API-10) |
| ANY | anything else | — | — | JSON 404 envelope |

No route requires or accepts authentication; `X-API-Key` in CORS `allowHeaders` is inert (API-11).

## 4. Coverage

**Read in full (api-worker, non-test):** `src/index.ts`, `src/types.ts`, `src/middleware/rate-limit.ts`, `src/middleware/locale.ts`, `src/lib/api-error.ts`, `src/lib/response.ts`, `src/lib/services.ts`, `src/lib/dye-serializer.ts`, `src/lib/validation.ts`, `src/routes/dyes.ts`, `src/routes/match.ts`, `src/universalis/router.ts`, `src/universalis/types.ts`, `src/universalis/config/cache.ts`, `src/universalis/config/datacenters.ts`, `src/universalis/services/cached-fetch.ts`, `src/universalis/services/cache-service.ts`, `src/universalis/services/request-coalescer.ts`, `src/universalis/services/rate-limiter.ts`, `src/universalis/test-setup.ts`, `src/chara/router.ts`, `src/chara/xivapi.ts`, `src/chara/resolver.ts`, `src/chara/cache.ts`, `src/chara/regional-names.ts`, `src/chara/types.ts`, `src/chara/data/item-names.meta.json` (the `ko`/`zh` tables are generated data and were not opened), `wrangler.toml`, `package.json`, `vitest.config.ts`, `CLAUDE.md`, `docs/.vitepress/config.ts`, `docs/.vitepress/theme/index.ts`, `docs/.vitepress/theme/components/TryIt.vue`, `docs/guide/rate-limits.md`, `docs/reference/chara.md`, `docs/reference/universalis.md`.

**Read in full (worker-kit):** `src/index.ts`, `src/middleware/{index,types,rate-limit,request-id,logger}.ts`, `src/rate-limiter/{index,ip,headers,types}.ts`, `src/rate-limiter/backends/{kv,memory,upstash}.ts`, `src/rate-limiter/presets/{configs,index}.ts`.

**Read (core, api-worker call paths):** `src/services/chara/chara-models.ts` (full), `src/services/chara/chara-parser.ts` (full), `src/services/chara/chara-resolver.ts` (header/types + fetch sites — client-side only, no API calls), `src/services/DyeService.ts` and `src/services/dye/DyeSearch.ts` (`searchByName`, `searchByLocalizedName`, `filterDyes`), `src/services/APIService.ts` (URL-building sites — the browser-side Universalis client that targets the proxy).

**Read (adjacent, call-site only):** `apps/discord-worker/src/services/budget/universalis-client.ts:95-160`; `.github/workflows/deploy-api-worker.yml` (grep for deploy command/secrets).

**External references consulted:** Cloudflare docs — KV "Limits to KV writes to the same key" (1 write/s/key → `429`); Workers "workers.dev" routing (`workers_dev` inferred `false` only when routes exist; preview-URL default follows it).

**Not read:** `*.test.ts`, `tests/**`, `tsconfig.json`, `coverage/**`, remaining docs markdown (`docs/index.md`, `docs/guide/{index,errors,responses}.md`, `docs/reference/{index,dyes,matching}.md`), `scripts/build-item-names.mjs`, `@xivdyetools/logger` internals (redaction not in scope).
