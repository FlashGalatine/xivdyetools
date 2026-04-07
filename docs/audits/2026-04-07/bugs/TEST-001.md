# TEST-001: No Handler-Level Tests for presets-api

- **Severity:** MEDIUM
- **Category:** Testing Gap
- **Files:**
  - `apps/presets-api/src/handlers/presets.ts` — No dedicated test file
  - `apps/presets-api/src/handlers/votes.ts` — No dedicated test file
  - `apps/presets-api/src/handlers/categories.ts` — No dedicated test file
  - `apps/presets-api/src/handlers/moderation.ts` — No dedicated test file

## Description

The presets-api has tests for middleware (auth, rate limiting, ban check) and services (validation, preset-service), but the handler layer — which orchestrates the business logic — lacks dedicated tests.

Key untested flows:
1. **Preset submission:** Validation → duplicate detection → moderation → D1 insert → Discord notification
2. **Voting:** Auth check → duplicate vote detection → atomic vote update
3. **Moderation actions:** Moderator role check → status update → notification
4. **Race condition handling:** Duplicate detection fallback to vote (lines 445-476 in presets.ts)

## Risk

Handler logic includes critical orchestration like race condition handling (CRITICAL-001) and fire-and-forget notifications. Without handler tests, regressions in these flows would only be caught by integration or manual testing.

## Recommendation

Add handler-level integration tests using the existing `@xivdyetools/test-utils` D1 mock:

```typescript
describe('POST /presets', () => {
  it('creates a preset and triggers Discord notification');
  it('rejects duplicate submissions and votes on existing');
  it('flags content that fails moderation');
  it('enforces per-user submission rate limit');
});
```

## Effort

MEDIUM — Test infrastructure exists; need to write test cases for each handler flow.
