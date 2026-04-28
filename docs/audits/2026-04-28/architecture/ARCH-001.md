# ARCH-001: api-worker CORS `maxAge: 86400` — long preflight cache for an evolving public API

- **Severity:** LOW
- **Category:** Configuration / API Hygiene
- **File:** [`apps/api-worker/src/index.ts:58`](../../../../apps/api-worker/src/index.ts#L58)

## Description

The api-worker's CORS middleware caches preflight responses for 24 hours:

```typescript
// apps/api-worker/src/index.ts:43-61
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Accept', 'X-API-Key'],
  exposeHeaders: ['X-RateLimit-Limit', /* ... */ 'Retry-After'],
  maxAge: 86400,  // ← 24 hours
  credentials: false,
}));
```

The 2026-04-07 audit (ARCH-002) reduced `maxAge` to 3600 (1 hour) in `presets-api` and `oauth` for the same reason: a long preflight cache locks browsers into the **previous** policy — if `allowHeaders` or `allowMethods` change, every client retains the stale policy for up to a day before re-checking.

## Why this matters more for api-worker than its siblings

- api-worker is the new **public read-only API** at `data.xivdyetools.app` and is more likely to evolve in its early life (added headers like `X-API-Key`, new methods, new exposed rate-limit headers).
- A 24-hour cache means policy changes take up to a day to propagate to active clients, hiding the policy update from anyone debugging a CORS failure.
- The cost of a 1-hour cache is negligible: `CORS preflight = 1 OPTIONS request per origin per hour`. For a read-only public API this is well within rate-limit budgets.

## Recommendation

Reduce `maxAge` to `3600` (1 hour) to match the precedent set by the 2026-04-07 audit:

```typescript
app.use('*', cors({
  // ...
  maxAge: 3600,  // ARCH-001 (2026-04-28): match presets-api/oauth precedent
  credentials: false,
}));
```

## Effort

TRIVIAL — single number change.

## Resolution

**Status:** OPEN
