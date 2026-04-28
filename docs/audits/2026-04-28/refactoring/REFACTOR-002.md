# REFACTOR-002: og-worker and universalis-proxy lack the standard middleware stack

- **Priority:** MEDIUM
- **Effort:** LOW
- **Category:** Cross-Worker Consistency / Observability
- **Files:**
  - [`apps/og-worker/src/index.ts`](../../../../apps/og-worker/src/index.ts) — no `@xivdyetools/worker-middleware` import
  - [`apps/universalis-proxy/src/index.ts`](../../../../apps/universalis-proxy/src/index.ts) — no `@xivdyetools/worker-middleware` import

## Description

Five of the seven Cloudflare Workers in the monorepo wire up the shared middleware extracted in 2026-04-07's REFACTOR-001 (`@xivdyetools/worker-middleware`):

| Worker | Uses worker-middleware? |
|--------|-------------------------|
| `discord-worker` | ✅ |
| `presets-api` | ✅ |
| `oauth` | ✅ |
| `moderation-worker` | ✅ |
| `api-worker` | ✅ (request-id only — see also BUG-001) |
| **`og-worker`** | ❌ |
| **`universalis-proxy`** | ❌ |

og-worker has its own `trackAnalytics()` function ([`index.ts:72-87`](../../../../apps/og-worker/src/index.ts#L72-L87)) but no request ID middleware and no structured logger; universalis-proxy similarly defines its own CORS / rate-limit middleware inline ([`index.ts:32-60`](../../../../apps/universalis-proxy/src/index.ts#L32-L60)) without request IDs or structured logging.

## Impact

- **No request correlation in the two missing workers.** When debugging a request that crosses workers (e.g., web-app → og-worker for image generation, or a flow involving universalis-proxy), there's no shared request ID to trace through logs.
- **Inconsistent observability surface.** Five workers ship structured JSON logs with request IDs; two ship `console.*` strings with whatever ad-hoc context the call site adds. This makes log-shipper schemas non-uniform and complicates dashboards.
- **og-worker is on the hot path for social previews.** Errors here are user-visible (broken Discord embeds) and hard to reproduce; observability gaps cost real diagnostic time.

## Recommendation

Add to both workers:

```typescript
import {
  requestIdMiddleware,
  loggerMiddleware,
  getLogger,
} from '@xivdyetools/worker-middleware';

app.use('*', requestIdMiddleware());
app.use('*', loggerMiddleware());

// Then in handlers:
const logger = getLogger(c);
logger?.info('crawler request', { tool, lang, crawler });
```

og-worker's existing `trackAnalytics` should remain (it writes to Analytics Engine, a different system); structured logs and analytics events are complementary, not redundant.

For universalis-proxy, the existing inline CORS handler can stay — it has worker-specific origin-validation logic that doesn't generalize. Just add request-id and logger on top.

## Effort

LOW — ~10 lines per worker, plus a couple of `console.error` → `logger?.error` replacements.

## Resolution

**Status:** OPEN
