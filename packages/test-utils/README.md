# @xivdyetools/test-utils

Shared testing utilities for the xivdyetools ecosystem. Provides mocks for Cloudflare Workers bindings, authentication helpers, domain object factories, and DOM utilities.

## Installation

**Workspace-private since 1.2.0 (Monorepo 2.0 Tier 1) — not published to npm.** Consume it from inside the monorepo as a `workspace:*` devDependency:

```json
"devDependencies": { "@xivdyetools/test-utils": "workspace:*" }
```

(Versions up to 1.1.8 remain on npm as history only.)

## Features

- **Cloudflare Workers Mocks**: D1Database, KVNamespace, R2Bucket, AnalyticsEngineDataset, Fetcher (Service Bindings)
- **Auth Helpers**: JWT creation, HMAC bot signatures, bearer-token headers
- **Domain Factories**: Preset row, Category row, Dye mock data factories

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
import { createTestJWT, createBotSignature, authHeaders } from '@xivdyetools/test-utils/auth';

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

// Build a bearer-token Authorization header
const headers = authHeaders(jwt, 'user-discord-id', 'username');
```

### Domain Factories

```typescript
import {
  createMockPresetRow,
  createMockSubmission,
  createMockDye,
} from '@xivdyetools/test-utils/factories';

// Create mock domain objects
const row = createMockPresetRow({ status: 'pending' });
const submission = createMockSubmission();
const dye = createMockDye({ name: 'Custom Dye' });
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
| `@xivdyetools/test-utils/constants` | Test constants (PKCE, etc.) |

Note: `/dom` and `/assertions` were removed 2026-08-18 (dead-code audit, DEAD-026) — zero consumers anywhere in the workspace. If the web-app ever adopts this package for DOM polyfills, pull them back from git history.

## TypeScript

This package includes full TypeScript support. Cloudflare Workers types are included via `@cloudflare/workers-types`.

## Connect With Me

**Flash Galatine** | Midgardsormr (Aether)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
🐦 **X/Twitter**: [@AsheJunius](https://x.com/AsheJunius)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## License

MIT © 2025-2026 Flash Galatine — see [LICENSE](./LICENSE).

## Legal Notice

**FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**
**FINAL FANTASY XIV © SQUARE ENIX CO., LTD.**

XIV Dye Tools is an unofficial fan project and is **not affiliated with, endorsed by, or sponsored by Square Enix Co., Ltd.**
