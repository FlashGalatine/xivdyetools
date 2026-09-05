# Test Utils Package Overview

**@xivdyetools/test-utils** - Shared testing utilities and mocks

---

## What is @xivdyetools/test-utils?

Mocks for the Cloudflare bindings the workers use (D1, KV, R2, Analytics
Engine, service-binding Fetcher), auth helpers, domain-object factories and PKCE
test constants. Every mock keeps an observation surface (`_queries`, `_calls`,
`_store`, `_dataPoints`) and a `_reset()`.

---

## Installation

**Workspace-private — not published to npm.** Consume it from inside the
monorepo:

```json
"devDependencies": { "@xivdyetools/test-utils": "workspace:*" }
```

Subpaths: `.`, `./cloudflare`, `./auth`, `./factories`, `./constants`.

---

## Cloudflare Binding Mocks

None of the mock factories take seed data — they start empty and you program
them through their `_`-prefixed helpers.

### D1 Database Mock

```typescript
import { createMockD1Database } from '@xivdyetools/test-utils/cloudflare';

const db = createMockD1Database();            // or ({ maxQueryHistory: 100 })

// Program responses by inspecting the SQL and its bindings
db._setupMock((query, bindings) => {
  if (query.includes('SELECT') && query.includes('presets')) {
    return { id: 'preset-1', name: 'Test Preset', status: 'approved' };
  }
  return null;
});

const env = { DB: db as unknown as D1Database };

db._queries;   // ['SELECT ...']  — every query executed
db._bindings;  // [['preset-1']]  — every binding array
db._reset();
```

`createMockD1()` is the same mock pre-cast to `D1Database`; reach the helpers
back through `(db as unknown as MockD1Database)`. Also available:
`_setBanStatus(isBanned)` and `_setBatchFailure(index, message?)`.

### KV Namespace Mock

```typescript
import { createMockKV } from '@xivdyetools/test-utils/cloudflare';

const kv = createMockKV();                    // no arguments

await kv.put('rate:user123', '5', { expirationTtl: 60 });
const value = await kv.get('rate:user123');

kv._store;   // Map<string, string>
kv._ttls;    // Map<string, number>
kv._reset();
```

### R2 Bucket Mock

```typescript
import { createMockR2Bucket } from '@xivdyetools/test-utils/cloudflare';

const bucket = createMockR2Bucket();

await bucket.put('preview/abc.webp', binaryData);
const obj = await bucket.get('preview/abc.webp');

bucket._store;   // Map<string, StoredR2Object>
bucket._reset();
```

### Service Binding (Fetcher) Mock

```typescript
import { createMockFetcher } from '@xivdyetools/test-utils/cloudflare';

const presetsApi = createMockFetcher();       // or ({ maxCallHistory: 50 })

// Responses are registered per path pattern (string or RegExp), not in the
// constructor:
presetsApi._setupResponse('/api/v1/presets', { presets: [] }, { status: 200 });
presetsApi._setDefaultResponse({ error: 'not found' }, { status: 404 });

const env = { PRESETS_API: presetsApi };
await env.PRESETS_API.fetch('https://example.test/api/v1/presets');

presetsApi._calls;   // MockFetchCall[] — url, method, headers, body, timestamp
presetsApi._reset();
```

### Analytics Engine Mock

```typescript
import { createMockAnalyticsEngine } from '@xivdyetools/test-utils/cloudflare';

const analytics = createMockAnalyticsEngine();

analytics.writeDataPoint({ indexes: ['cmd:harmony'], doubles: [1] });
analytics._dataPoints;   // AnalyticsDataPoint[] (each with a timestamp)
analytics._reset();
```

---

## Domain Object Factories

```typescript
import {
  createMockDye,
  createMockPresetRow,
  createMockSubmission,
  createMockCategoryRow,
  mockDyes,
} from '@xivdyetools/test-utils/factories';

const dye = createMockDye({ name: 'Test Red', category: 'Reds' });
// Real-shaped: stainID lands in 1-254 and `id === itemID`.

const row = createMockPresetRow({ status: 'pending' });   // a D1 PresetRow — `dyes`/`tags` are JSON strings
const submission = createMockSubmission({ dyes: [1, 2, 3] });
const category = createMockCategoryRow({ id: 'aesthetics' });

mockDyes;   // a small fixed Dye[] covering several categories
```

There is no user factory. `PresetRow` and `CategoryRow` are this package's own
D1-row shapes; `Dye` and `PresetSubmission` come from `@xivdyetools/types` and
are re-exported here.

---

## Auth Helpers

```typescript
import { createTestJWT, createExpiredJWT, authHeaders } from '@xivdyetools/test-utils/auth';

const token = await createTestJWT('test-secret', { sub: 'user-123', username: 'TestUser' });
// createTestJWT(secret, payload, expiresInSeconds = 3600, issuer = 'xivdyetools-oauth-worker')

const expired = await createExpiredJWT('test-secret');

const headers = authHeaders(token, '123456789', 'TestUser');
// { Authorization: 'Bearer …', 'X-User-Discord-ID': …, 'X-User-Discord-Name': … }
```

PKCE constants live under `/constants`: `VALID_CODE_VERIFIER`,
`VALID_CODE_CHALLENGE`.

> The `/dom` and `/assertions` subpaths were removed 2026-08-18 (dead-code
> audit, DEAD-026) — they had no consumers anywhere in the workspace.

---

## Usage Example

```typescript
import { describe, it, expect } from 'vitest';
import { createMockD1Database, createMockKV } from '@xivdyetools/test-utils/cloudflare';
import { createMockPresetRow } from '@xivdyetools/test-utils/factories';
import { handleGetPresets } from '../handlers/presets';

describe('GET /presets', () => {
  it('returns approved presets', async () => {
    const row = createMockPresetRow({ status: 'approved' });
    const db = createMockD1Database();
    db._setupMock((query) => (query.includes('SELECT') ? row : null));

    const env = { DB: db as unknown as D1Database, KV: createMockKV() };
    const response = await handleGetPresets(new Request('http://test/api/v1/presets'), env);

    expect(response.status).toBe(200);
    expect(db._queries[0]).toContain('presets');
  });
});
```

---

## Full reference

Package README: [`packages/test-utils/README.md`](../../../packages/test-utils/README.md)

## Related Documentation

- [Types Package](../types/overview.md) - Shared types
- [Logger Package](../logger/overview.md) - Logging utilities
- [Developer Guides: Testing](../../developer-guides/testing.md) - Testing strategies
