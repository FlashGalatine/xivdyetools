# FINDING-024: og-worker `/og/*` edge-cache key is the full request URL — any unknown query parameter is a cache miss and a full resvg render, with no worker-side limiter (WAF rule still an unchecked dashboard item)
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** og-worker · **Rotation:** NONE · **CWE:** CWE-770
Residual of `2026-08-21-security/FINDING-005` (OG-4).

## Location
- `apps/og-worker/src/index.ts:182` — `const cacheKey = new Request(c.req.url, { method: 'GET' })`
- `docs/operations/POST_MERGE_CHECKLIST.md:342` — the OG-4 WAF rate rule is still unticked

## Evidence
- `GET /og/harmony/FF0000?x=1`, `?x=2`, … — every variant misses `caches.default` and renders (CPU-bound; fonts + resvg), so one client turns the cache into a no-op. Param validation and the linear wrap (FINDING-005) keep each render bounded; the count is not.

## Fix
- Canonicalise the cache key from the validated params only (tool, colours, `lang`, `frame`, `algo`) and 404 or 301 unknown params; or add a `[[ratelimits]]` binding to `/og/*`.

## Status
FIXED 2026-08-30 (Sprint 7, og-worker 2.4.0) — commits `c6bd962b`, `9b2f4ca3`, `e2bdeec6`,
`e2e9ca6b`, `636e42ec`, `ebdc49ed`, `e9b6f471`, `86884104`, `6f6f5fd1`.

The finding's first Fix option was taken, on **both** axes it names. Query: `/og/*` accepts
exactly `lang`, `frame` and `algo` (any other key → `404`, before the cache lookup and before
any render, without echoing the key), `algo`'s *value* is validated on every route, and the key
carries the *resolved* `lang` / `frame` plus the raw-but-validated `algo`. Path: every route now
parses its path params against an anchored grammar and rejects anything else, so one card has
exactly one accepted spelling — and since only 200s are stored, only canonical keys can enter
the cache.

Four amplification paths the original evidence did not name were found during review and closed
in the same sprint: `algo`'s value was unvalidated on the 7 of 12 route patterns that never read
it; `HEAD` skipped the cache middleware entirely (`curl -I` in a loop needed no distinct URLs at
all); the key used the raw path while Hono routes on the decoded one; and — the largest — every
route parsed its path params leniently (`parseInt` accepting trailing junk and leading zeros, an
unanchored `.replace('.png','')`, `%2F` surviving `decodeURI`, and `/og/swatch/:color` never
validated at all), so `/og/harmony/102aaa/complementary` and `/og/harmony/00102/complementary`
rendered the identical card under different keys at the same cost per request as the `?x=N` this
finding documents.

**What remains, honestly stated:** enumeration of *distinct* ids — including ids that render a
"not found" card — is still a render per id, and so are the list tails a card does not draw
(comparison / accessibility accept 16 entries but draw 4; extractor accepts more than its 5) plus
counts that clamp to the band cap. Those were left accepted deliberately (ruling S7-R17):
for comparison / accessibility, rejecting them would 404 image URLs already embedded in links
shared before this deploy (the extractor tail was never emitted at all — it is hand-built only),
and in every case the attacker's cost per render is identical to distinct-id enumeration. The
emitter no longer *produces* non-canonical URLs. No `[[ratelimits]]` binding was added (ruling
S7-R1): Discord's and X's link-preview fetchers share source IPs, so an IP-keyed limiter
throttles legitimate previews exactly when a link goes viral. That count bound remains the WAF
rate-limiting rule, **deployed 2026-09-01**: `og-worker render bound (FINDING-024)` on the
`xivdyetools.app` zone — hostname `og.xivdyetools.app` and path `/og/`, 300 requests / 10 s per IP,
Block, 10 s mitigation. The Log-then-Block rollout this file previously prescribed turned out not to
be available: the zone is on the **Free plan**, where rate limiting is Block-only, IP-only, fixed at
a 10 s period and a 10 s mitigation timeout, and limited to **one rule per zone** (Log and Managed
Challenge start at Pro). That 10 s timeout is what makes Block acceptable — a false positive returns
429 to a single IP for ten seconds and clears itself, rather than locking out a crawler fleet — and
300/10 s is 30 req/s sustained from one address, which no link-preview fetcher does. Tune it from
Security → Events, which records firings even under Block: many distinct IPs at modest volume would
mean raise the threshold. Verified after deployment that a canonical render still returns
`200 image/png` and the worker's own query guard still 404s. Details in
`docs/operations/POST_MERGE_CHECKLIST.md`.
