# Testing Guide

## Framework
- **Vitest 4** for most packages
- **Vitest 3.2** for oauth and presets-api (required by `@cloudflare/vitest-pool-workers`)
- **V8 coverage** provider with per-package thresholds (typically 80%+)
- **529 test files** across the monorepo

## Running Tests
```bash
# From monorepo root
pnpm turbo run test                                    # All packages
pnpm turbo run test --filter=@xivdyetools/core         # Single package
pnpm turbo run test --filter='./packages/*'             # All packages
pnpm turbo run test --filter='./apps/*'                 # All apps

# Single test file
pnpm --filter @xivdyetools/core exec vitest run src/path/to/file.test.ts

# Watch mode
pnpm --filter @xivdyetools/core exec vitest

# Coverage
pnpm --filter @xivdyetools/core exec vitest run --coverage
```

## @xivdyetools/test-utils
Shared package providing all mocking infrastructure:

### Cloudflare Worker Mocks
- `createMockD1Database()` — D1 mock with prepared statement support, query history tracking, `_bindings` inspection
- `createMockKV()` — KV namespace mock (in-memory)
- `createMockR2()` — R2 bucket mock
- `createMockFetcher()` — Service binding Fetcher mock
- `createMockAnalyticsEngine()` — Analytics Engine mock

### Auth Helpers
- `createTestJWT(payload, secret)` — Generate valid JWT for testing
- `createExpiredJWT()` — Generate expired JWT
- `createBotSignature(secret, timestamp, userId, userName)` — HMAC signature
- `authHeaders(token)` — Pre-built Authorization header objects
- `createAuthContext()` / `createModeratorContext()` / `createUnauthenticatedContext()`

### Factories
- `createMockDye(overrides)` — Dye objects with sensible defaults
- `createMockPreset(overrides)` — Preset objects
- `createMockCategory()`, `createMockUser()`, `createMockVote()`
- `randomId()` — Parallel-safe random IDs (not sequential!)

### DOM Utilities (for web-app)
- `MockLocalStorage` — localStorage mock
- `setupCanvasMocks()` — Canvas 2D context mock
- `setupResizeObserverMock()` — ResizeObserver mock
- `setupFetchMock()` — Global fetch mock
- `setupMatchMediaMock()` — matchMedia mock for responsive tests

### Assertion Helpers
- `assertJsonResponse(response, expectedStatus)` — Validate JSON response
- `assertErrorResponse(response, status, errorMessage)` — Validate error
- `assertOkResponse(response)` — 200 check
- `assertCorsHeaders(response)` — CORS headers present

## Testing Patterns

### Singleton Reset
```typescript
beforeEach(() => {
  // @ts-expect-error - accessing private static for testing
  MyService.instance = null;
  service = MyService.getInstance();
});
```

### Mock D1 Query Assertions
```typescript
const mockDb = createMockD1Database();
mockDb._setupMock(() => mockRows);

// After operation
expect(mockDb._queries).toContainEqual(expect.stringMatching(/SELECT.*FROM presets/));
expect(mockDb._bindings).toContainEqual(expect.arrayContaining(['approved']));
```

### Fake Timers
```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());
```

### Hoisted Module Mocks
```typescript
const mockFn = vi.hoisted(() => vi.fn());
vi.mock('../../services/i18n.js', () => ({
  resolveUserLocale: mockFn,
}));
```

### Hono Route Testing
```typescript
const res = await app.request('/api/v1/presets', {
  method: 'POST',
  headers: authHeaders(jwt),
  body: JSON.stringify({ name: 'Test', ... }),
}, env);
expect(res.status).toBe(201);
```

## E2E Testing (Web App)
- **Playwright 1.57** with chromium, mobile-chrome projects
- Tests in `apps/web-app/e2e/`
- V8 coverage collection via CDP
```bash
pnpm --filter xivdyetools-web-app run test:e2e
pnpm --filter xivdyetools-web-app run test:e2e:headed   # Visible browser
pnpm --filter xivdyetools-web-app run test:e2e:coverage  # With coverage
```

## Best Practices
1. **Use randomId()** — Not sequential IDs. Prevents test pollution in parallel execution.
2. **Reset mocks between tests** — `vi.clearAllMocks()` in afterEach.
3. **Memory management** — Mock D1 enforces `maxQueryHistory` (default 1000). Use `_setMaxQueryHistory()` for long suites.
4. **Hoist mocks** — Use `vi.hoisted()` for mocks in describe blocks.
5. **Error coverage** — Always test `.rejects.toThrow()` paths.

## CI
- Tests run on affected packages only (Turborepo filtering)
- Node.js 22
- Coverage thresholds enforced per-package

## Related Documentation
- [Local Setup](./local-setup.md) — Development environment and prerequisites
- [Monorepo Setup](./monorepo-setup.md) — Project structure and dependency management
- [Developer Guides Index](./index.md) — All developer guides
