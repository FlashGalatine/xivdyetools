# @xivdyetools/test-utils

Shared testing utilities for the xivdyetools ecosystem. Provides mocks for Cloudflare Workers bindings, authentication helpers, domain object factories, and DOM utilities.

## Installation

```bash
npm install -D @xivdyetools/test-utils
```

## Features

- **Cloudflare Workers Mocks**: D1Database, KVNamespace, R2Bucket, AnalyticsEngineDataset, Fetcher (Service Bindings)
- **Auth Helpers**: JWT creation/verification, HMAC signatures, auth context factories
- **Domain Factories**: Preset, Category, Vote, User mock data factories
- **DOM Utilities**: localStorage mock, Canvas mock, ResizeObserver mock
- **Assertions**: Response assertion helpers for API testing

## Usage

### Cloudflare Mocks

```typescript
import { createMockD1Database, createMockKV, createMockFetcher } from '@xivdyetools/test-utils/cloudflare';

// D1 Database mock with query tracking
const db = createMockD1Database();
db._setupMock((query, bindings) => {
  if (query.includes('SELECT')) return { id: 1, name: 'Test' };
  return null;
});

// Use in your tests
const env = { DB: db as unknown as D1Database };

// Check what queries were executed
console.log(db._queries);    // ['SELECT ...']
console.log(db._bindings);   // [['param1', 'param2']]

// Reset between tests
db._reset();
```

### Auth Helpers

```typescript
import { createTestJWT, createBotSignature, createAuthContext } from '@xivdyetools/test-utils/auth';

// Create a valid JWT for testing
const jwt = await createTestJWT('your-secret', {
  sub: 'user-123',
  username: 'TestUser',
  global_name: 'Test User',
});

// Create HMAC signature for bot auth
const signature = await createBotSignature(
  timestamp,
  'user-discord-id',
  'username',
  'signing-secret'
);

// Create auth context for middleware testing
const ctx = createAuthContext({ isModerator: true });
```

### Domain Factories

```typescript
import {
  createMockPreset,
  createMockPresetRow,
  createMockSubmission,
  createMockUser,
  resetCounters,
} from '@xivdyetools/test-utils/factories';

// Create mock domain objects
const preset = createMockPreset({ name: 'Custom Name' });
const row = createMockPresetRow({ status: 'pending' });
const submission = createMockSubmission();

// Reset auto-increment counters between tests
beforeEach(() => resetCounters());
```

### DOM Utilities

```typescript
import { MockLocalStorage, setupCanvasMocks, setupResizeObserverMock } from '@xivdyetools/test-utils/dom';

// Mock localStorage
const storage = new MockLocalStorage();
global.localStorage = storage;

// Setup canvas mocks for chart testing
setupCanvasMocks();

// Setup ResizeObserver mock
setupResizeObserverMock();
```

### Assertions

```typescript
import { assertJsonResponse } from '@xivdyetools/test-utils/assertions';

const response = await app.request('/api/v1/presets');
const body = await assertJsonResponse<{ presets: Preset[] }>(response, 200);
expect(body.presets).toHaveLength(1);
```

### Constants

```typescript
import { VALID_CODE_VERIFIER, VALID_CODE_CHALLENGE } from '@xivdyetools/test-utils/constants';

// RFC 7636 compliant PKCE test values
const params = new URLSearchParams({
  code_verifier: VALID_CODE_VERIFIER,
  code_challenge: VALID_CODE_CHALLENGE,
});
```

## Subpath Exports

| Import Path | Contents |
|-------------|----------|
| `@xivdyetools/test-utils` | All exports |
| `@xivdyetools/test-utils/cloudflare` | Cloudflare Workers mocks |
| `@xivdyetools/test-utils/auth` | Authentication helpers |
| `@xivdyetools/test-utils/factories` | Domain object factories |
| `@xivdyetools/test-utils/dom` | DOM/browser utilities |
| `@xivdyetools/test-utils/assertions` | Response assertions |
| `@xivdyetools/test-utils/constants` | Test constants (PKCE, etc.) |

## TypeScript

This package includes full TypeScript support. Cloudflare Workers types are included via `@cloudflare/workers-types`.

## Connect With Me

**Flash Galatine** | Balmung (Crystal)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
📝 **Blog**: [Project Galatine](https://blog.projectgalatine.com/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
🐦 **X / Twitter**: [@AsheJunius](https://x.com/AsheJunius)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## License

MIT © 2025 Flash Galatine
