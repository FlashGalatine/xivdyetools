# REFACTOR-003: `getLogger`/`getRequestId` use `Context<any, any, any>` instead of leveraging Hono module augmentation

- **Priority:** LOW
- **Effort:** LOW
- **Category:** Type Safety
- **Files:**
  - [`packages/worker-middleware/src/logger.ts:178`](../../../../packages/worker-middleware/src/logger.ts#L178)
  - [`packages/worker-middleware/src/request-id.ts:95`](../../../../packages/worker-middleware/src/request-id.ts#L95)

## Description

Both context-accessor helpers in `@xivdyetools/worker-middleware` use `Context<any, any, any>` to sidestep Hono's strict context typing:

```typescript
// packages/worker-middleware/src/logger.ts:178
export function getLogger(c: Context<any, any, any>): ExtendedLogger | undefined { ... }

// packages/worker-middleware/src/request-id.ts:95
export function getRequestId(c: Context<any, any, any>): string { ... }
```

Hono supports module augmentation to declare context variables that survive across middleware/handlers:

```typescript
declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
    logger: ExtendedLogger;
  }
}
```

If this augmentation lives in the package's public types (it likely does already — the middleware's `set('requestId', id)` calls work because Hono resolves the variable map), the helpers can drop the `any` triple and use a generic constraint that preserves caller-side typing:

```typescript
import type { Context } from 'hono';

export function getRequestId<E extends { Variables: { requestId: string } }>(
  c: Context<E>,
): string {
  return c.get('requestId');
}
```

## Impact

- **Today:** No functional issue. Both helpers work correctly.
- **Type safety leak:** `any, any, any` opts every caller out of Hono's `Bindings` and `Variables` typing for the context they pass in. A caller doing `getLogger(c).somethingNonExistent` would not be caught by tsc; whereas with proper augmentation, callers retain their narrow context typing through the helper.
- **Pattern repetition:** The same `Context<any, any, any>` shape appears in both helpers and would propagate to any future helpers added to the package.

## Recommendation

1. If `@xivdyetools/worker-middleware` does not already export module augmentation, add it to a `types.ts` (or to the helpers' files) so consumers can opt in:

   ```typescript
   declare module 'hono' {
     interface ContextVariableMap {
       requestId: string;
       logger: ExtendedLogger;
     }
   }
   ```

2. Refactor both helpers to use a constrained generic. Test by deliberately introducing a typo in a consumer's `c.get()` call to confirm tsc now catches it.

If module augmentation is already present, the helper signatures alone are the ~5-line fix.

## Effort

LOW — one or two files, no API surface change for callers.

## Resolution

**Status:** OPEN
