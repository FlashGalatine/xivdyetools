# TEST-002: No Tests for api-worker

- **Severity:** MEDIUM
- **Category:** Testing Gap
- **File:** `apps/api-worker/` — Zero test files

## Description

The `api-worker` is a public-facing REST API for dye matching and color data. It exposes endpoints under `/v1/` with rate limiting, CORS, and security headers. Despite being public-facing, it has zero test coverage.

Key untested endpoints:
1. `/v1/dyes` — Dye listing and search
2. `/v1/match` — Color-to-dye matching
3. Rate limiting behavior
4. CORS headers on responses
5. Error responses for invalid input

## Risk

As a public API, the api-worker is the most exposed surface without test coverage. Regressions in dye matching logic, rate limiting, or error handling would go undetected until users report issues.

## Recommendation

Add integration tests covering:

```typescript
describe('GET /v1/dyes', () => {
  it('returns dye list with correct structure');
  it('supports search parameter');
  it('returns 429 when rate limited');
});

describe('GET /v1/match', () => {
  it('matches hex color to nearest dye');
  it('returns 400 for invalid hex input');
  it('includes CORS headers');
});
```

## Effort

MEDIUM — Requires setting up test harness for the worker (Vitest + miniflare or similar).

## Resolution

**Status:** RESOLVED (2026-04-07)

The api-worker has 137 tests across 7 test files covering all route handlers, middleware, validation, serialization, and services. Coverage is 93.96% statements. The audit finding was written before these tests were added.
