# Caching Strategy

**Deep dive into the Universalis Proxy's Cache API + coalescing architecture**

---

## Overview

The proxy's caching is designed to:

1. Minimize latency for end users
2. Reduce load on the Universalis API
3. Keep prices acceptably fresh
4. Degrade gracefully when the cache or upstream misbehaves

> **History**: the proxy originally used a dual-layer design (Cache API + KV). It was migrated to **Cache API only** to eliminate KV write limits on the free tier — there are no KV bindings anymore. Cross-isolate deduplication that KV used to provide is covered by the Cache API itself; in-isolate deduplication is the coalescer's job.

---

## The Single Cache Layer: Cloudflare Cache API

All cached entries live in a named cache (`caches.open('universalis-proxy')`) at the Cloudflare edge.

**Characteristics**:
- Ultra-low latency (same datacenter)
- Regional scope — each edge location caches independently
- Evicted by Cloudflare under memory pressure; the worker also actively deletes entries that age beyond the SWR window

**Synthetic URL keys** — the Cache API requires full URLs as keys, so logical cache keys are wrapped in a synthetic URL:

```
{baseUrl}/__cache/{encodeURIComponent(key)}
```

**Freshness metadata travels in headers** on the stored response — `X-Cached-At`, `X-Cache-TTL`, `X-SWR-Window`. On lookup, `CacheService.get()` computes the entry's age and classifies it:

| Age | Classification | Behavior |
|-----|----------------|----------|
| ≤ TTL | Fresh | Served as `HIT` |
| TTL < age ≤ TTL + SWR | Stale | Served as `HIT-STALE`, background revalidation triggered |
| > TTL + SWR | Expired | Deleted (`ctx.waitUntil`), treated as `MISS` |

> **Local development**: the Cache API is unavailable under `wrangler dev` (`typeof caches === 'undefined'`), so every local request is a `MISS`. This is expected, not a bug.

---

## Cache Key Normalization

Keys are normalized so semantically identical requests share an entry:

- Item IDs are **sorted numerically**
- The datacenter is **lowercased**
- Each endpoint type contributes a `keyPrefix`

```
Request:  /api/v2/aggregated/Crystal/5731,5729,5730
Key:      aggregated:crystal:5729,5730,5731

Request:  /api/v2/aggregated/crystal/5729,5730,5731
Key:      aggregated:crystal:5729,5730,5731   (same entry!)
```

---

## TTL Configuration

Defined in `src/config/cache.ts` (`CACHE_CONFIGS`):

| Endpoint | `cacheTtl` | `swrWindow` | Rationale |
|----------|-----------|-------------|-----------|
| `aggregated` | 300 s (5 min) | 120 s (2 min) | Prices update frequently |
| `data-centers` | 86 400 s (24 h) | 21 600 s (6 h) | Very static data |
| `worlds` | 86 400 s (24 h) | 21 600 s (6 h) | Very static data |

---

## Stale-While-Revalidate

When an entry is stale but inside the SWR window, `cachedFetch` returns it immediately and refreshes in the background via `ctx.waitUntil`:

```
Timeline (aggregated, TTL 300s + SWR 120s):
─────────────────────────────────────────────────────────
0s      Request arrives; entry is 340s old (stale, in SWR)
0ms     Stale data returned to client (X-Cache: HIT-STALE)
0ms     Background revalidation starts (coalesced under
        a separate "revalidate:{key}" coalescer key)
~200ms  Fresh data stored; next request is a fresh HIT
─────────────────────────────────────────────────────────
```

If revalidation fails, it fails silently — stale data continues to be served until it ages past the SWR window, at which point the entry is deleted and the next request pays the upstream round-trip.

### Honest stale headers (BUG-028)

A stale response is already up to `cacheTtl + swrWindow` old. Re-serving it with a full `max-age` would let *downstream* HTTP caches treat it as fresh for another entire TTL. So:

- **Stale responses**: `Cache-Control: public, max-age=0, must-revalidate`
- **Fresh responses**: `Cache-Control: public, max-age=<cacheTtl>, stale-while-revalidate=<swrWindow>` — downstream caches can implement SWR natively

---

## Request Coalescing

`RequestCoalescer` deduplicates concurrent fetches for the same cache key **within one isolate** — a module-scope map of in-flight promises. Ten simultaneous requests for the same aggregate produce one upstream fetch; the other nine await the same promise.

Two details worth knowing:

- **Only the winning fetch writes to cache** (OPT-021). The store happens *inside* the coalesced function, so a burst of N waiters produces one cache write — previously every waiter re-serialized and re-put the identical entry.
- **Background revalidations coalesce separately** under `revalidate:{key}`, so a stale burst can't trigger multiple simultaneous refreshes either.

### Leak protection (PROXY-CRITICAL-001 / OPT-003)

In-flight entries are timestamped and swept if older than **60 s** (hung upstream, abandoned request). The sweep runs at most every **~10 s with ±20 % jitter**, so cleanup work isn't synchronized across isolates.

---

## Upstream Fetch Safeguards

- Requests carry `User-Agent: XIVDyeTools/1.0 (https://xivdyetools.app)` and `Accept: application/json`.
- **5 MB response cap**, enforced twice: a cheap `Content-Length` fast-fail, then the authoritative **streamed byte budget** in `readBounded()` (BUG-065) — chunked responses without a `Content-Length` cannot bypass the ceiling. Oversized bodies raise `ResponseTooLargeError` → 502.
- Upstream non-2xx raises `UpstreamError`; 429s preserve `Retry-After` toward the client.

---

## Cache Headers

Every proxied response includes debug headers built by `buildCacheHeaders()`:

| Header | Values | Meaning |
|--------|--------|---------|
| `X-Cache` | `HIT`, `MISS`, `HIT-STALE` | Cache outcome for this request |
| `X-Cache-Source` | `cache-api`, `upstream` | Where the payload came from |
| `X-Cache-Stale` | `true`, `false` | Whether the served entry was stale |
| `Cache-Control` | see SWR section | Downstream caching policy (BUG-028) |
| `Vary` | `Origin` | Prevents shared caches replaying one origin's CORS header to another (BUG-027) |

Cache hits and misses are also logged as structured JSON events (`event: 'cache_result'`) for observability (OPT-002).

---

## Related Documentation

- [Overview](overview.md) - Proxy introduction and features
- [Deployment](deployment.md) - Environments and deploy procedure
- [Data Flow](../../architecture/data-flow.md) - Full sequence diagrams
- `apps/universalis-proxy/src/services/` - `cache-service.ts`, `cached-fetch.ts`, `request-coalescer.ts` (the implementation this document describes)
