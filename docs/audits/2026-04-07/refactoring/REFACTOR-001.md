# REFACTOR-001: Request ID & Logger Middleware Duplicated Across Workers

- **Priority:** MEDIUM
- **Effort:** MEDIUM
- **Category:** Code Duplication
- **Files:**
  - `apps/discord-worker/src/middleware/request-id.ts` (~20 lines)
  - `apps/discord-worker/src/middleware/logger.ts` (~35 lines)
  - `apps/presets-api/src/middleware/request-id.ts` (~25 lines)
  - `apps/presets-api/src/middleware/logger.ts` (~50 lines)
  - `apps/oauth/src/middleware/request-id.ts` (~20 lines)
  - `apps/oauth/src/middleware/logger.ts` (~35 lines)
  - `apps/moderation-worker/src/middleware/request-id.ts` (similar)
  - `apps/moderation-worker/src/middleware/logger.ts` (similar)
- **Total duplicated:** ~185 LOC across 4 workers

## Description

Each worker independently implements:
1. **Request ID middleware:** Generates a UUID, attaches to Hono context variables, sets `X-Request-ID` response header
2. **Logger middleware:** Creates a request-scoped logger with request ID, method, path, optional user agent; logs request start/end with timing

The implementations are nearly identical with minor differences:
- `SERVICE_NAME` constant differs per worker
- presets-api's logger includes optional `userAgent` logging
- Variable names and import paths vary slightly

## Impact

- Bug fixes or improvements must be applied to 4 workers independently
- Inconsistent behavior can creep in (e.g., one worker logs user-agent, others don't)
- New workers require copy-pasting the middleware

## Recommendation

Extract into a shared `@xivdyetools/worker-middleware` package or extend `@xivdyetools/logger`:

```typescript
// packages/worker-middleware/src/index.ts
export { requestIdMiddleware } from './request-id.js';
export { loggerMiddleware } from './logger.js';
export { securityHeadersMiddleware } from './security-headers.js';
```

Each worker would import and configure:

```typescript
import { requestIdMiddleware, loggerMiddleware } from '@xivdyetools/worker-middleware';

app.use('*', requestIdMiddleware());
app.use('*', loggerMiddleware({ serviceName: 'presets-api', logUserAgent: true }));
```

## Effort

MEDIUM — Create new package, migrate 4 workers, verify behavior parity, add tests.
