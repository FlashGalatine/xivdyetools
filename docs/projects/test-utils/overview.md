# Test Utils Package Overview

**@xivdyetools/test-utils** - Shared testing utilities and mocks

---

## What is @xivdyetools/test-utils?

A testing utilities package that provides mocks for Cloudflare bindings (D1, KV, R2, etc.), domain object factories, and test helpers. Used across all projects for consistent testing.

---

## Installation

```bash
npm install -D @xivdyetools/test-utils
```

---

## Cloudflare Binding Mocks

### D1 Database Mock

```typescript
import { createMockD1 } from '@xivdyetools/test-utils';

const mockDb = createMockD1({
  presets: [
    { id: '1', name: 'Test Preset', status: 'approved' }
  ]
});

// Use in tests
const env = { DB: mockDb };
const result = await env.DB.prepare('SELECT * FROM presets').all();
```

### KV Namespace Mock

```typescript
import { createMockKV } from '@xivdyetools/test-utils';

const mockKv = createMockKV({
  'rate:user123': { count: 5, timestamp: Date.now() }
});

// Use in tests
const env = { KV: mockKv };
await env.KV.put('key', 'value');
const value = await env.KV.get('key');
```

### R2 Bucket Mock

```typescript
import { createMockR2 } from '@xivdyetools/test-utils';

const mockR2 = createMockR2();

// Use in tests
const env = { BUCKET: mockR2 };
await env.BUCKET.put('file.png', binaryData);
```

### Service Binding (Fetcher) Mock

```typescript
import { createMockFetcher } from '@xivdyetools/test-utils';

const mockPresetsApi = createMockFetcher({
  '/api/v1/presets': {
    body: JSON.stringify({ presets: [] }),
    status: 200
  },
  '/api/v1/presets/123': {
    body: JSON.stringify({ preset: { id: '123', name: 'Test' } }),
    status: 200
  }
});

// Use in tests
const env = { PRESETS_API: mockPresetsApi };
const response = await env.PRESETS_API.fetch(new Request('/api/v1/presets'));
```

### Analytics Engine Mock

```typescript
import { createMockAnalytics } from '@xivdyetools/test-utils';

const mockAnalytics = createMockAnalytics();

// Use in tests
const env = { ANALYTICS: mockAnalytics };
env.ANALYTICS.writeDataPoint({ indexes: ['cmd:harmony'], doubles: [1] });
```

---

## Domain Object Factories

Create test data with sensible defaults:

```typescript
import {
  createTestDye,
  createTestPreset,
  createTestUser
} from '@xivdyetools/test-utils';

// Create test dye
const dye = createTestDye({ name: 'Test Red', category: 'red' });

// Create test preset
const preset = createTestPreset({
  name: 'My Preset',
  colors: [dye.id],
  status: 'approved'
});

// Create test user
const user = createTestUser({
  discordId: '123456789',
  username: 'Tester#1234'
});
```

---

## Auth Helpers

```typescript
import {
  createMockJWT,
  createBotAuthHeaders,
  createJWTAuthHeaders
} from '@xivdyetools/test-utils';

// Create mock JWT token
const token = createMockJWT({
  discordId: '123456789',
  username: 'Test#1234'
});

// Create auth headers for bot requests
const botHeaders = createBotAuthHeaders({
  userId: '123456789',
  username: 'Test#1234'
});

// Create auth headers for web requests
const jwtHeaders = createJWTAuthHeaders(token);
```

---

## DOM Utilities (for Web App)

```typescript
import {
  createTestElement,
  waitForUpdate,
  simulateClick
} from '@xivdyetools/test-utils/dom';

// Create Lit element for testing
const element = await createTestElement('my-component', {
  prop1: 'value',
  prop2: 123
});

// Wait for Lit update cycle
await waitForUpdate(element);

// Simulate user interaction
simulateClick(element.shadowRoot.querySelector('button'));
```

---

## Usage Example

```typescript
import { describe, it, expect, vi } from 'vitest';
import {
  createMockD1,
  createMockKV,
  createTestPreset,
  createBotAuthHeaders
} from '@xivdyetools/test-utils';
import { handleGetPresets } from '../handlers/presets';

describe('GET /presets', () => {
  it('returns approved presets', async () => {
    const preset = createTestPreset({ status: 'approved' });

    const env = {
      DB: createMockD1({ presets: [preset] }),
      KV: createMockKV()
    };

    const request = new Request('http://test/api/v1/presets');
    const response = await handleGetPresets(request, env);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.presets).toHaveLength(1);
  });
});
```

---

## Related Documentation

- [Types Package](../types/overview.md) - Shared types
- [Logger Package](../logger/overview.md) - Logging utilities
- [Developer Guides: Testing](../../developer-guides/testing.md) - Testing strategies
