# @xivdyetools/rate-limiter

Shared rate limiting utilities for the xivdyetools ecosystem.

## Installation

```bash
npm install @xivdyetools/rate-limiter
```

## Features

- **MemoryRateLimiter** - In-memory sliding window with LRU eviction
- **KVRateLimiter** - Cloudflare KV backend with optimistic concurrency
- Pre-built configurations for OAuth, Discord commands, and public APIs
- Fail-open design for availability
- TypeScript support with full type definitions

## Usage

### Basic Usage

```typescript
import { MemoryRateLimiter, getClientIp, getRateLimitHeaders } from '@xivdyetools/rate-limiter';

const limiter = new MemoryRateLimiter();

const ip = getClientIp(request);
const result = await limiter.check(ip, { maxRequests: 100, windowMs: 60_000 });

if (!result.allowed) {
  return new Response('Too Many Requests', {
    status: 429,
    headers: getRateLimitHeaders(result),
  });
}
```

### Using Presets

```typescript
import { KVRateLimiter, getDiscordCommandLimit } from '@xivdyetools/rate-limiter';

const limiter = new KVRateLimiter({ kv: env.RATE_LIMIT_KV });
const config = getDiscordCommandLimit('match_image'); // Returns stricter limit

const result = await limiter.check(userId, config);
```

### Subpath Imports

```typescript
// Import only what you need
import { MemoryRateLimiter } from '@xivdyetools/rate-limiter/memory';
import { KVRateLimiter } from '@xivdyetools/rate-limiter/kv';
import { OAUTH_LIMITS, PUBLIC_API_LIMITS } from '@xivdyetools/rate-limiter/presets';
```

## API

### MemoryRateLimiter

In-memory rate limiter with sliding window algorithm and LRU eviction.

```typescript
const limiter = new MemoryRateLimiter({
  maxEntries: 10_000,           // Max tracked keys (default: 10000)
  cleanupIntervalRequests: 100, // Cleanup every N requests (default: 100)
});

await limiter.check(key, config);  // Check and record request
await limiter.reset(key);          // Reset specific key
await limiter.resetAll();          // Reset all keys
```

### KVRateLimiter

Cloudflare KV-backed rate limiter with optimistic concurrency.

```typescript
const limiter = new KVRateLimiter({
  kv: env.RATE_LIMIT_KV,  // KV namespace binding
  keyPrefix: 'ratelimit:', // Key prefix (default: 'ratelimit:')
  maxRetries: 3,           // Retry attempts (default: 3)
  ttlBuffer: 60,           // TTL buffer seconds (default: 60)
});

await limiter.check(key, config);      // Check and record
await limiter.checkOnly(key, config);  // Check without recording
await limiter.increment(key, config);  // Record after processing
```

### Configuration

```typescript
interface RateLimitConfig {
  maxRequests: number;      // Max requests per window
  windowMs: number;         // Window size in milliseconds
  burstAllowance?: number;  // Extra burst requests (default: 0)
  failOpen?: boolean;       // Allow on backend error (default: true)
}
```

### Pre-built Configurations

```typescript
import {
  OAUTH_LIMITS,           // OAuth endpoint limits
  DISCORD_COMMAND_LIMITS, // Per-command Discord limits
  MODERATION_LIMITS,      // Moderation bot limits
  PUBLIC_API_LIMITS,      // General API limits
  UNIVERSALIS_PROXY_LIMITS,
} from '@xivdyetools/rate-limiter';
```

## License

MIT
