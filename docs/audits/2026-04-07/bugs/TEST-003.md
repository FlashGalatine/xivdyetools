# TEST-003: Missing Error Scenario Coverage in og-worker

- **Severity:** LOW
- **Category:** Testing Gap
- **File:** `apps/og-worker/src/` — Error paths untested

## Description

The og-worker has test files for its SVG generation and route handling, but error scenarios are not covered:

1. Invalid hex color parameters
2. Out-of-bounds gradient steps (exceeding `OG_MAX_GRADIENT_STEPS = 20`)
3. SVG rendering failures (e.g., malformed font data)
4. Memory pressure under concurrent SVG generation

## Risk

LOW — The og-worker generates images and serves them to crawlers/social media. Errors result in missing previews, not security or data issues.

## Recommendation

Add error path tests for bounds validation:

```typescript
describe('error scenarios', () => {
  it('returns fallback for invalid hex color');
  it('clamps gradient steps to OG_MAX_GRADIENT_STEPS');
  it('handles SVG render failures gracefully');
});
```

## Effort

LOW — Straightforward test additions using existing test infrastructure.
