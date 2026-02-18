# Stoat Bot — Testing Strategy

**Parent document:** [02-stoat.md](./02-stoat.md)

---

### Testing Strategy

The Discord worker has a mature Vitest setup with unit tests, integration tests, and a shared `@xivdyetools/test-utils` package. The Stoat bot inherits this infrastructure but benefits from a key shift: **WASM-dependent code becomes natively testable** on Node.js.

#### What Carries Over Directly

| Component | Reusable? | Notes |
|---|---|---|
| **Vitest framework** | Yes | Same `vitest.config.ts` pattern, same test runner |
| **`@xivdyetools/test-utils`** | Partially | Factories (`createMockDye`, `createMockPreset`) and assertions (`assertJsonResponse`) reuse as-is. Cloudflare mocks (`createMockKV`, `createMockD1`, `createMockFetcher`) are **not needed** |
| **`@xivdyetools/core` tests** | Yes — unchanged | Core is platform-agnostic; its tests don't change |
| **SVG generator tests** | Yes | SVG structure assertions (`toContain('<svg')`, `toContain('<circle')`) work identically |
| **Color blending integration tests** | Yes | Algorithm tests are pure math — no platform dependency |
| **Test patterns** | Yes | `vi.mock()`, `vi.hoisted()`, `beforeEach(vi.clearAllMocks)`, fake timers |

#### What's New or Different

| Aspect | Discord Worker | Stoat Bot |
|---|---|---|
| **WASM mocking** | Must mock `@resvg/resvg-wasm`, `@cf-wasm/photon` (can't run in test) | **No mocking needed** — `@resvg/resvg-js` and `sharp` run natively in Vitest |
| **External service mocks** | `createMockKV()`, `createMockFetcher()`, `createMockAnalytics()` | `createMockDatabase()` (SQLite), `createMockRedis()` (Upstash), `createMockRevoltClient()` |
| **Bot framework mocking** | Mock `verifyDiscordRequest`, craft `DiscordInteraction` payloads | Mock `revolt.js` `Client`, `Message`, `Channel` objects |
| **HTTP handler testing** | `app.fetch(req, mockEnv, mockCtx)` on Hono | `http.inject({ method, url, payload })` on Fastify (or Hono's `app.request()`) |
| **Coverage gaps** | WASM modules excluded (renderer, photon, dye-info-card) | **Filled** — resvg-js and sharp are testable. Coverage should be higher |
| **CI runner** | Tests NOT run in deploy CI (only type-check) | **Tests must run in CI** — add test step before deploy |

#### Mock Layer Design

##### revolt.js Client Mock

The `revolt.js` `Client` is a WebSocket-based event emitter. Tests mock it to simulate incoming messages and verify outbound calls.

```typescript
// test-utils/revolt-mocks.ts
import { vi } from 'vitest';

interface MockChannel {
  id: string;
  serverId: string | null;
  sendMessage: ReturnType<typeof vi.fn>;
}

interface MockMessage {
  id: string;
  content: string;
  authorId: string;
  channel: MockChannel;
  attachments: any[];
  react: ReturnType<typeof vi.fn>;
  unreact: ReturnType<typeof vi.fn>;
  reply: ReturnType<typeof vi.fn>;
}

function createMockChannel(overrides?: Partial<MockChannel>): MockChannel {
  return {
    id: 'channel-01',
    serverId: 'server-01',
    sendMessage: vi.fn().mockResolvedValue({ id: 'sent-msg-01' }),
    ...overrides,
  };
}

function createMockMessage(overrides?: Partial<MockMessage>): MockMessage {
  const channel = createMockChannel();
  return {
    id: 'msg-01',
    content: '!xd info Snow White',
    authorId: 'user-01',
    channel,
    attachments: [],
    react: vi.fn().mockResolvedValue(undefined),
    unreact: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue({ id: 'reply-01' }),
    ...overrides,
  };
}

function createMockClient(): {
  client: any;
  emit: (event: string, ...args: any[]) => void;
} {
  const handlers = new Map<string, Function[]>();

  const client = {
    user: { username: 'XIV Dye Tools' },
    channels: { get: vi.fn() },
    websocket: { connected: true, ready: true },
    api: { post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    on: vi.fn((event: string, handler: Function) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
    loginBot: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    configuration: {
      features: { autumn: { url: 'https://cdn.example.com' } },
    },
  };

  const emit = (event: string, ...args: any[]) => {
    for (const handler of handlers.get(event) ?? []) {
      handler(...args);
    }
  };

  return { client, emit };
}
```

**Usage in tests:**
```typescript
import { createMockClient, createMockMessage } from '../test-utils/revolt-mocks.js';

describe('!xd info command', () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
    vi.clearAllMocks();
  });

  it('sends dye info embed for exact match', async () => {
    const message = createMockMessage({ content: '!xd info Snow White' });

    await handleInfoCommand(message, ['Snow', 'White']);

    expect(message.react).toHaveBeenCalledWith(encodeURIComponent('⏳'));
    expect(message.channel.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [expect.objectContaining({ title: expect.stringContaining('Snow White') })],
      })
    );
    expect(message.unreact).toHaveBeenCalledWith(encodeURIComponent('⏳'));
  });

  it('sends disambiguation for ambiguous input', async () => {
    const message = createMockMessage({ content: '!xd info turquoise' });

    await handleInfoCommand(message, ['turquoise']);

    expect(message.channel.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Found 2 dyes'),
      })
    );
  });
});
```

##### SQLite Mock

Two approaches for testing SQLite-backed storage:

```typescript
// Option A: In-memory SQLite (real database, ephemeral)
import Database from 'better-sqlite3';

function createTestDatabase(): Database.Database {
  const db = new Database(':memory:');
  // Run migrations
  db.exec(readFileSync('src/storage/migrations/001-init.sql', 'utf-8'));
  return db;
}

// Option B: vi.fn() mock (no SQLite dependency in test)
function createMockDatabase() {
  return {
    prepare: vi.fn().mockReturnValue({
      run: vi.fn().mockReturnValue({ changes: 1 }),
      get: vi.fn().mockReturnValue(null),
      all: vi.fn().mockReturnValue([]),
    }),
    exec: vi.fn(),
    pragma: vi.fn(),
    close: vi.fn(),
  };
}
```

**Recommendation:** Use **Option A (in-memory SQLite)** for most tests. `better-sqlite3` is synchronous and fast — an in-memory database runs migrations and queries in <1ms. This tests real SQL queries (catches typos, schema mismatches) without the fragility of mocking `prepare().get()` chains. Reserve Option B for tests that specifically need to simulate database errors.

```typescript
describe('analytics storage', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('tracks command execution', () => {
    trackCommand(db, {
      command: 'info',
      userId: 'user-01',
      guildId: 'server-01',
      success: true,
      latencyMs: 42,
    });

    const stats = getAggregateStats(db);
    expect(stats.totalCommands).toBe(1);
    expect(stats.successCount).toBe(1);
    expect(stats.commandsToday).toBe(1);
  });

  it('calculates unique users correctly', () => {
    trackCommand(db, { command: 'info', userId: 'user-01', guildId: null, success: true });
    trackCommand(db, { command: 'info', userId: 'user-02', guildId: null, success: true });
    trackCommand(db, { command: 'match', userId: 'user-01', guildId: null, success: true });

    const stats = getAggregateStats(db);
    expect(stats.uniqueUsersToday).toBe(2);  // user-01 counted once
    expect(stats.totalCommands).toBe(3);
  });
});
```

##### Upstash Redis Mock

```typescript
// test-utils/redis-mocks.ts
function createMockRedis() {
  const store = new Map<string, { value: any; expiresAt?: number }>();

  return {
    incr: vi.fn(async (key: string) => {
      const current = store.get(key)?.value ?? 0;
      store.set(key, { value: current + 1, expiresAt: store.get(key)?.expiresAt });
      return current + 1;
    }),
    ttl: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry?.expiresAt) return -1;
      return Math.ceil((entry.expiresAt - Date.now()) / 1000);
    }),
    expire: vi.fn(async (key: string, seconds: number) => {
      const entry = store.get(key);
      if (entry) entry.expiresAt = Date.now() + seconds * 1000;
    }),
    ping: vi.fn().mockResolvedValue('PONG'),
    pipeline: vi.fn().mockReturnThis(),
    exec: vi.fn(async function(this: any) {
      // Return results from most recent pipeline commands
      return [1, -1];  // [incr result, ttl result]
    }),
    _store: store,
    _reset: () => store.clear(),
  };
}
```

##### Autumn CDN Upload Mock

```typescript
// test-utils/autumn-mocks.ts
function createMockAutumn() {
  const uploads: { tag: string; filename: string; buffer: Buffer }[] = [];

  return {
    upload: vi.fn(async (buffer: Buffer, filename: string, tag = 'attachments') => {
      const id = `file-${uploads.length + 1}`;
      uploads.push({ tag, filename, buffer });
      return id;
    }),
    _uploads: uploads,
    _reset: () => { uploads.length = 0; },
  };
}
```

#### Test Categories

##### 1. Unit Tests (`src/**/*.test.ts`)

| Module | What to test | Mock dependencies |
|---|---|---|
| **Command parser** | Prefix detection, `!xivdye`/`!xd`, `>` separator, greedy matching | None (pure logic) |
| **Dye input resolver** | ItemID, exact/partial/localized matches, ambiguity thresholds | `DyeService` (from core) |
| **Command handlers** (`info`, `harmony`, `match`, etc.) | Correct embeds, masquerade, reactions, error messages | revolt.js mocks, renderer |
| **Response formatter** | Discord embed → Stoat `SendableEmbed` conversion | None (pure logic) |
| **Storage: preferences** | CRUD, upsert, default values | In-memory SQLite |
| **Storage: favorites** | Add/remove, max 20 enforcement | In-memory SQLite |
| **Storage: collections** | Create/delete, max 50, add/remove dyes | In-memory SQLite |
| **Storage: analytics** | Track command, aggregate stats, command breakdown | In-memory SQLite |
| **Rate limiter** | Allow/deny, window reset, fail-open, exempt commands | Redis mock |
| **Admin authorization** | `isAuthorized()`, ULID validation, silent deny | Env vars |
| **Image processing** | sharp resize, pixel extraction, format validation | None (sharp runs in test) |
| **Webhook handlers** | HMAC verification, payload routing, error cases | revolt.js client mock |
| **Health check** | Component status assembly, latency measurement | SQLite + Redis + client mocks |

##### 2. Integration Tests (`src/**/*.integration.test.ts`)

| Test | What it exercises | Real dependencies |
|---|---|---|
| **SVG → PNG pipeline** | Generate SVG → render with resvg-js → valid PNG buffer | `@resvg/resvg-js`, `@xivdyetools/core` SVG generators |
| **Image extraction pipeline** | sharp decode → resize → pixel extraction → k-means → dye matching | `sharp`, `PaletteService` |
| **Full command flow** | Parse message → resolve dye → generate image → format response | All except revolt.js network |
| **Storage round-trip** | Write preferences → read back → verify schema | `better-sqlite3` in-memory |
| **Webhook → channel message** | HTTP POST → verify → craft embed → check `sendMessage()` args | Fastify `inject()`, revolt.js mock |

##### 3. End-to-End Tests (Optional, manual or scripted)

For bot interactions that are hard to unit-test (WebSocket event flow, Autumn CDN uploads, reaction handling), consider a lightweight E2E test script that runs against a **test Stoat server** (self-hosted instance or a dedicated test channel):

```typescript
// e2e/smoke-test.ts — Run manually after deploy
// Requires: BOT_TOKEN, TEST_CHANNEL_ID

const client = new Client();
await client.loginBot(process.env.BOT_TOKEN!);

// Wait for ready
await new Promise(resolve => client.on('ready', resolve));

const channel = client.channels.get(process.env.TEST_CHANNEL_ID!);

// Send test command
await channel.sendMessage({ content: '!xd info Snow White' });

// Wait for bot response (poll for new messages)
await sleep(5000);
const messages = await channel.fetchMessages({ limit: 5 });
const botReply = messages.find(m => m.authorId === client.user.id);

assert(botReply, 'Bot should have replied');
assert(botReply.embeds?.length > 0, 'Reply should have an embed');
assert(botReply.embeds[0].title?.includes('Snow White'), 'Embed should mention Snow White');

console.log('✅ Smoke test passed');
client.logout();
```

**When to run:** After deployment, not in CI. This catches integration issues (wrong channel IDs, expired tokens, Autumn CDN changes) that unit tests can't.

#### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json'],
      thresholds: {
        statements: 85,
        branches: 70,
        functions: 85,
        lines: 85,
      },
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.integration.test.ts',
        'src/test-utils/**',
        'src/**/index.ts',        // Re-export barrels
        'e2e/**',                  // E2E smoke tests
      ],
      // No WASM exclusions needed — resvg-js and sharp run natively
    },
  },
});
```

```typescript
// vitest.integration.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    globals: true,
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 15_000,
    // No coverage thresholds — integration tests supplement, not replace
  },
});
```

**Key difference from Discord worker:** No coverage exclusions for WASM modules. The renderer (`@resvg/resvg-js`) and image processor (`sharp`) are both testable in Vitest's Node.js environment. This means coverage should be **higher** than the Discord worker's 85% threshold — previously untestable rendering code is now fully exercisable.

#### CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test -- --run           # Unit tests
      - run: npm run test:integration        # Integration tests
      - run: npm run test -- --run --coverage # Coverage report

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci && npm run build
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

**Key improvement over Discord worker CI:** Tests are **required to pass before deploy**. The Discord worker's CI only runs `type-check` before deploying — the Stoat bot enforces `lint + type-check + test + integration` as a gate.

#### Package Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:all": "vitest run && vitest run --config vitest.integration.config.ts",
    "test:coverage": "vitest run --coverage",
    "test:coverage:ui": "vitest --coverage --ui",
    "lint": "eslint src/",
    "type-check": "tsc --noEmit",
    "build": "tsup src/index.ts --format esm",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  }
}
```

#### Test File Layout

```
xivdyetools-stoat-bot/
  src/
    commands/
      info.ts
      info.test.ts              ← Co-located unit test
      harmony.ts
      harmony.test.ts
      stats.ts
      stats.test.ts
      admin.ts
      admin.test.ts
      parser.ts
      parser.test.ts            ← Command parser + prefix detection
    storage/
      database.ts
      database.test.ts          ← In-memory SQLite, migration tests
      preferences.ts
      preferences.test.ts
      favorites.ts
      favorites.test.ts
      collections.ts
      collections.test.ts
      analytics.ts
      analytics.test.ts         ← Aggregate stats, command breakdown
    services/
      rate-limiter.ts
      rate-limiter.test.ts
      image-cache.ts
      image-cache.test.ts
      dye-resolver.ts
      dye-resolver.test.ts      ← Multi-strategy resolution
      image-processor.ts
      image-processor.test.ts   ← sharp pipeline (runs real sharp)
    http/
      server.ts
      webhooks/
        github.ts
        github.test.ts          ← HMAC verification, payload routing
        preset.ts
        preset.test.ts
    config/
      admin.ts
      admin.test.ts             ← ULID validation, authorization
    test-utils/
      revolt-mocks.ts           ← createMockClient, createMockMessage, createMockChannel
      database-mocks.ts         ← createTestDatabase (in-memory SQLite)
      redis-mocks.ts            ← createMockRedis
      autumn-mocks.ts           ← createMockAutumn
    integration/
      svg-pipeline.integration.test.ts
      image-extraction.integration.test.ts
      command-flow.integration.test.ts
      storage-roundtrip.integration.test.ts
      webhook-flow.integration.test.ts
  e2e/
    smoke-test.ts               ← Manual post-deploy verification
```

#### What's NOT Tested (and Why)

| Component | Why not tested | Mitigation |
|---|---|---|
| **revolt.js WebSocket connection** | External service — can't mock the gateway handshake | E2E smoke test post-deploy |
| **Autumn CDN upload** | External service — real uploads cost storage | Mock in unit tests; E2E verifies |
| **Universalis API responses** | External, rate-limited | Mock with `createMockUniversalisProxy()` (reuse from Discord worker) |
| **Fly.io persistent volume** | Infrastructure-level | SQLite `:memory:` in tests covers the same queries |
| **Masquerade rendering** | Client-side visual behavior | Manual verification on test server |

---
