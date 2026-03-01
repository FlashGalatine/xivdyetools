# DEAD-070: `getRequestId` — zero external consumers

## Category
Unused Exports (Functions)

## Location
- File(s): `packages/logger/src/presets/worker.ts`
- Line(s): 120–130
- Symbol(s): `getRequestId`

## Evidence
Monorepo-wide grep for `getRequestId` as an import from `@xivdyetools/logger`:
- **Zero** hits from any app or package.

Every worker app defines its own `getRequestId` function locally:
- `apps/discord-worker/src/middleware/request-id.ts` — `getRequestId(c: Context): string`
- `apps/moderation-worker/src/middleware/request-id.ts` — `getRequestId(c: Context): string`
- `apps/presets-api/src/middleware/request-id.ts` — `getRequestId(c: Context): string`
- `apps/oauth/src/middleware/request-id.ts` — `getRequestId(c: Context): string`

**Key difference:** The logger's `getRequestId` takes a `Request` object and checks `x-request-id` → `cf-ray` → `crypto.randomUUID()`. The app-local versions take a Hono `Context` object, enabling them to also set the request ID on the context for downstream middleware.

The signature mismatch (Request vs Context) explains why apps define their own versions.

## Why It Exists
Utility function extracted alongside `createWorkerLogger`. Designed for standalone use before apps adopted the Hono middleware pattern with `Context`.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — clear function name, zero import hits |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |
| **Hidden Consumers** | NONE |

## Recommendation
**REMOVE** (from barrel) or **DEPRECATE** (next minor version)

### Rationale
The function was superseded by app-local implementations with a better interface (Hono Context vs raw Request). Since all 4 worker apps have their own versions, this function provides no value.

Options:
1. **Remove from barrel** — mark `@internal`, remove from `src/presets/index.ts` and `src/index.ts`
2. **Deprecate** — add `@deprecated Use app-local getRequestId with Hono Context` and remove at next major
3. **Redesign** — change signature to accept `Context` (breaking change, not recommended for a library)

### If Removing
1. Remove from `src/presets/index.ts` re-export
2. Remove from `src/index.ts` barrel
3. The function can remain in `worker.ts` as it's called internally by `createRequestLogger`
