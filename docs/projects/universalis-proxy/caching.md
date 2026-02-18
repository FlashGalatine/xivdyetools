# Caching Strategy

**Deep dive into the Universalis Proxy's dual-layer caching architecture**

---

## Overview

The proxy implements a sophisticated caching strategy designed to:
1. Minimize latency for end users
2. Reduce load on the Universalis API
3. Maintain data freshness
4. Handle cache failures gracefully

---

## Cache Layers

### Layer 1: Cloudflare Cache API (Edge)

The Cache API provides regional caching at Cloudflare's edge locations.

**Characteristics**:
- Ultra-low latency (same datacenter)
- Automatic eviction based on TTL
- Regional scope (each edge caches independently)
- ~200+ global locations

**Implementation**:
```typescript
const cache = caches.default;
const cachedResponse = await cache.match(request);

if (cachedResponse) {
  return cachedResponse; // Edge hit
}
```

### Layer 2: Cloudflare KV (Global)

KV storage provides globally persistent caching.

**Characteristics**:
- Consistent data across all edges
- Explicit TTL control
- Eventually consistent (~60s propagation)
- Survives edge cache eviction

**Implementation**:
```typescript
const cached = await env.PRICE_CACHE.get(cacheKey, 'json');

if (cached && !isExpired(cached.timestamp)) {
  // Populate edge cache from KV
  await cache.put(request, createResponse(cached));
  return cached.data;
}
```

---

## Cache Key Generation

Cache keys are normalized to ensure consistent caching:

```typescript
function generateCacheKey(server: string, itemIds: number[]): string {
  // Sort IDs for consistent keys regardless of request order
  const sortedIds = [...itemIds].sort((a, b) => a - b);
  return `${server.toLowerCase()}:${sortedIds.join(',')}`;
}
```

**Example**:
```
Request: /api/Gilgamesh/123,456,789
Cache Key: gilgamesh:123,456,789

Request: /api/Gilgamesh/789,123,456
Cache Key: gilgamesh:123,456,789  (same!)
```

---

## TTL Configuration

### Price Data (Dynamic)

Market prices change frequently, so shorter TTLs are used:

| Phase | Duration | Behavior |
|-------|----------|----------|
| **Fresh** | 0 - 5 min | Serve from cache immediately |
| **Stale** | 5 - 6 min | Serve stale, revalidate in background |
| **Expired** | > 6 min | Fetch fresh data |

### Static Data (Slow-changing)

Item names, icons, and other static data rarely change:

| Phase | Duration | Behavior |
|-------|----------|----------|
| **Fresh** | 0 - 24h | Serve from cache immediately |
| **Stale** | 24 - 25h | Serve stale, revalidate in background |
| **Expired** | > 25h | Fetch fresh data |

---

## Stale-While-Revalidate

When cached data expires, the proxy serves stale data immediately while fetching fresh data in the background:

```
Timeline:
─────────────────────────────────────────────────────────
0s     Request arrives, cache is 5.5 min old (stale)
0ms    Return stale data to client (instant response)
0ms    Start background fetch from Universalis
~200ms Background fetch completes, cache updated
─────────────────────────────────────────────────────────
       Next request gets fresh data
```

**Benefits**:
- Users never wait for upstream API
- Cache stays warm
- Reduces perceived latency

---

## Request Coalescing

When multiple requests for the same data arrive simultaneously, only one upstream request is made:

```typescript
const inflightRequests = new Map<string, Promise<Response>>();

async function fetchWithCoalescing(key: string): Promise<Response> {
  // Check if request already in flight
  if (inflightRequests.has(key)) {
    return inflightRequests.get(key)!;
  }

  // Start new request
  const promise = fetchFromUpstream(key);
  inflightRequests.set(key, promise);

  try {
    return await promise;
  } finally {
    inflightRequests.delete(key);
  }
}
```

**Scenario**:
```
T+0ms:   Client A requests gilgamesh:123
T+10ms:  Client B requests gilgamesh:123 (coalesced)
T+20ms:  Client C requests gilgamesh:123 (coalesced)
T+200ms: Upstream response arrives
T+200ms: All three clients receive same response
```

---

## Memory Leak Protection

In-flight request entries are cleaned up after 60 seconds to prevent memory leaks:

```typescript
const inflightRequests = new Map<string, {
  promise: Promise<Response>;
  timestamp: number;
}>();

// Periodic cleanup
function cleanupStaleEntries() {
  const now = Date.now();
  for (const [key, entry] of inflightRequests) {
    if (now - entry.timestamp > 60000) {
      inflightRequests.delete(key);
    }
  }
}
```

This handles edge cases like:
- Upstream API timeouts
- Worker restarts
- Abandoned requests

---

## Cache Headers

The proxy returns headers to help debug caching behavior:

| Header | Values | Description |
|--------|--------|-------------|
| `X-Cache-Status` | `HIT`, `MISS`, `STALE` | Cache layer that served response |
| `X-Cache-Age` | Seconds | How old the cached data is |
| `X-Cache-Source` | `edge`, `kv` | Which cache layer responded |

**Example Response Headers**:
```
X-Cache-Status: HIT
X-Cache-Age: 142
X-Cache-Source: edge
```

---

## Error Handling

### Upstream Timeout

If Universalis doesn't respond within timeout:
1. Return stale cache if available (any age)
2. Return 504 Gateway Timeout if no cache

### Invalid Response

If Universalis returns invalid data:
1. Don't cache the response
2. Return stale cache if available
3. Return 502 Bad Gateway if no cache

### KV Errors

If KV storage fails:
1. Continue with edge-only caching
2. Log error for monitoring
3. No user-visible impact

---

## Performance Metrics

Typical performance characteristics:

| Scenario | Latency | Upstream Calls |
|----------|---------|----------------|
| Edge cache hit | <5ms | 0 |
| KV cache hit | ~20ms | 0 |
| Cache miss | ~200ms | 1 |
| SWR refresh | <5ms (user), ~200ms (background) | 1 |

---

## Related Documentation

- [Overview](overview.md) - Proxy introduction and features
- [Deployment](deployment.md) - KV namespace setup
- [Data Flow](../../architecture/data-flow.md) - Full sequence diagrams
