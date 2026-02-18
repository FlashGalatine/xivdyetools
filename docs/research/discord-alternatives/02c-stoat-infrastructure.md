# Stoat Bot — Infrastructure

**Parent document:** [02-stoat.md](./02-stoat.md)

Covers: Storage backend, image attachment handling, rate limiting, webhook ingestion.

---

### Storage Backend

The Discord worker uses **six** storage layers across Cloudflare KV, Upstash Redis, Analytics Engine, Cache API, D1, and in-memory caches. Moving to a persistent Node.js process significantly simplifies this.

#### Current Discord Worker Storage Map

| Storage System | Data | Key Pattern | Characteristics |
|---|---|---|---|
| **CF KV** | User preferences | `prefs:v1:{userId}` | JSON blob, no TTL, read every command |
| **CF KV** | Legacy language prefs | `i18n:user:{userId}` | Migration source, read as fallback |
| **CF KV** | Legacy world prefs | `budget:world:v1:{userId}` | Migration source |
| **CF KV** | Favorites | `xivdye:favorites:v1:{userId}` | JSON array of dye IDs, max 20 |
| **CF KV** | Collections | `xivdye:collections:v1:{userId}` | JSON array of collection objects, max 50 |
| **CF KV** | Analytics counters | `stats:total`, `stats:cmd:{name}` | Optimistic concurrency, 30-day TTL |
| **CF KV** | Daily unique users | `usertrack:{date}:{userId}` | Marker key, 30-day TTL |
| **CF KV** | Rate limit fallback | `ratelimit:user:{userId}:{cmd}\|{window}` | When Upstash unavailable |
| **Upstash Redis** | Rate limiting | `ratelimit:user:{userId}:{cmd}` | Atomic INCR + EXPIRE, 60s TTL |
| **CF Analytics Engine** | Command telemetry | (structured data points) | Write-only, fire-and-forget |
| **CF Cache API** | PNG image cache | `https://cache.xivdyetools.internal/v1/{cmd}/{hash}` | 2h–7d TTL |
| **In-memory** | Locale instances, fonts, world data, dye service | Module-level vars | Isolate lifetime |

#### Stoat Bot Storage Design

**Principle:** A persistent Node.js process means in-memory state survives across requests. Many things that needed external storage on Workers can be in-memory with periodic disk persistence.

##### SQLite (better-sqlite3) — Primary persistent store

SQLite is ideal for a single-process Node.js bot: zero-config, no separate server, synchronous reads (fast), and handles all the structured data the bot needs.

```sql
-- User preferences (replaces prefs:v1:{userId})
CREATE TABLE preferences (
  user_id    TEXT PRIMARY KEY,
  language   TEXT,
  blending   TEXT,
  matching   TEXT,
  count      INTEGER,
  clan       TEXT,
  gender     TEXT,
  world      TEXT,
  market     INTEGER,  -- boolean
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Favorites (replaces xivdye:favorites:v1:{userId})
CREATE TABLE favorites (
  user_id  TEXT NOT NULL,
  dye_id   INTEGER NOT NULL,
  added_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, dye_id)
);
-- Max 20 per user enforced in application code

-- Collections (replaces xivdye:collections:v1:{userId})
CREATE TABLE collections (
  id          TEXT PRIMARY KEY,  -- UUID
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_collections_user ON collections(user_id);

CREATE TABLE collection_dyes (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  dye_id        INTEGER NOT NULL,
  PRIMARY KEY (collection_id, dye_id)
);
-- Max 50 collections per user, max 20 dyes per collection

-- Analytics (replaces stats:* keys and Analytics Engine)
CREATE TABLE command_stats (
  command    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  guild_id   TEXT,
  success    INTEGER NOT NULL,  -- 1 or 0
  error_type TEXT,
  latency_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_stats_command ON command_stats(command);
CREATE INDEX idx_stats_date ON command_stats(created_at);
-- Query for summaries: SELECT command, COUNT(*) FROM command_stats GROUP BY command
-- Unique users today: SELECT COUNT(DISTINCT user_id) FROM command_stats WHERE created_at >= date('now')
```

**Advantages over KV:**
- **Atomic operations** — No optimistic concurrency needed for counter increments
- **Relational queries** — `SELECT COUNT(DISTINCT user_id)` replaces the `kv.list()` + count pattern
- **Normalized data** — Favorites and collection dyes are proper rows, not JSON blobs that get read-modify-written
- **No TTL management** — Use `DELETE FROM command_stats WHERE created_at < date('now', '-30 days')` on a daily cron

##### Upstash Redis — Rate limiting (reuse existing)

Keep the existing Upstash Redis setup for rate limiting. It's HTTP-based, works from any runtime, and the atomic `INCR` + `EXPIRE` pattern is already proven.

```typescript
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Same pattern as Discord worker:
const key = `ratelimit:stoat:${userId}:${command}`;
const [count, ttl] = await redis.pipeline()
  .incr(key)
  .ttl(key)
  .exec();

if (ttl === -1) {
  await redis.expire(key, 60); // 60-second window
}
```

**Why not in-memory rate limiting?** If the bot restarts (deploy, crash, Fly.io restart), all rate limit state is lost. With Upstash, rate limits survive restarts. This matters for commands like `!xivdye extract` (image processing) where abuse could be costly.

**Key prefix change:** Use `ratelimit:stoat:` instead of `ratelimit:user:` to namespace separately from the Discord bot in the same Upstash instance.

##### In-Memory LRU Cache — Image caching (replaces CF Cache API)

On Workers, the Cache API is a free edge cache. On Node.js, use an in-memory LRU cache:

```typescript
import { LRUCache } from "lru-cache";

const imageCache = new LRUCache<string, Buffer>({
  max: 200,                    // Max 200 cached images
  maxSize: 100 * 1024 * 1024,  // 100 MiB total
  sizeCalculation: (buf) => buf.length,
  ttl: 24 * 60 * 60 * 1000,   // 24 hours default
});

// Cache key: same SHA-256 hash of params
const cacheKey = `${command}:${hashParams(params)}`;
const cached = imageCache.get(cacheKey);
if (cached) return cached; // Cache hit — skip SVG→PNG render

const png = await renderToPng(svgString);
imageCache.set(cacheKey, png, {
  ttl: hasMarketData ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
});
```

**Tradeoff:** Cache is lost on restart (unlike CF Cache API which persists at the edge). This is acceptable — the cache is a performance optimization, not a data store. Cold starts just mean a few extra PNG renders.

##### In-Memory — Everything else

These are already in-memory on the Discord worker (isolate-lifetime caches), but now they persist for the **full process lifetime**:

| Data | Discord Worker | Stoat Bot | Notes |
|---|---|---|---|
| Locale instances | Module-level Map (isolate lifetime) | Module-level Map (process lifetime) | Same pattern, longer lived |
| Font buffers | Module-level cache (isolate lifetime) | Module-level cache (process lifetime) | Load once, never evict |
| Universalis world data | 1-hour in-memory TTL | Same 1-hour TTL | Same pattern |
| Dye service / database | Module-level singleton | Module-level singleton | Same |
| Message context (reaction tracking) | N/A (Discord uses interaction tokens) | LRU Map with 1-hour TTL | New — tracks message→dye for reactions |

#### Storage Migration Summary

| Discord (current) | Stoat (proposed) | Migration complexity |
|---|---|---|
| CF KV (preferences) | SQLite `preferences` table | Low — same data, better schema |
| CF KV (favorites) | SQLite `favorites` table | Low — normalized from JSON array |
| CF KV (collections) | SQLite `collections` + `collection_dyes` | Low — normalized from JSON blob |
| CF KV (analytics counters) | SQLite `command_stats` table | Low — proper table replaces key counting |
| CF KV (daily user tracking) | SQLite (query `command_stats`) | None — derived from stats table |
| CF KV (rate limit fallback) | Dropped — Upstash is primary | None |
| Upstash Redis (rate limiting) | Upstash Redis (same, new prefix) | Trivial — reuse same instance |
| CF Analytics Engine | SQLite `command_stats` | Low — single table replaces write-only API |
| CF Cache API (image cache) | In-memory LRU (lru-cache) | Low — same key hashing, new backend |
| In-memory caches | In-memory caches (longer-lived) | None — same pattern |

#### File Layout

```
xivdyetools-stoat-bot/
  data/
    bot.db              ← SQLite database file (gitignored)
  src/
    storage/
      database.ts       ← better-sqlite3 init, migrations, helpers
      preferences.ts    ← User preferences CRUD
      favorites.ts      ← Favorites CRUD
      collections.ts    ← Collections CRUD
      analytics.ts      ← Command stats logging + queries
    services/
      rate-limiter.ts   ← Upstash Redis rate limiting
      image-cache.ts    ← LRU in-memory image cache
```

#### Backup & Persistence

SQLite on Fly.io requires a **persistent volume** (Fly Volumes) so the database survives deploys:

```toml
# fly.toml
[mounts]
  source = "bot_data"
  destination = "/data"
```

The SQLite file lives at `/data/bot.db`. Fly Volumes persist across deploys and restarts. For extra safety, schedule a daily backup to an S3-compatible store (Cloudflare R2, Backblaze B2) using SQLite's `.backup()` API.

### Image Attachment Handling (`!xivdye extract`)

The `!xivdye extract` command accepts a user-uploaded image and extracts dominant colors, matching them to FFXIV dyes. This is the only command where the bot *receives* an image rather than *sending* one.

#### Stoat Attachment Data Model

When a user sends a message with an image, Stoat's `Message` object includes an `attachments` array of `File` objects:

```typescript
// revolt.js File class (from message.attachments)
interface File {
  id: string;              // Unique file ID (maps from API _id)
  tag: string;             // Bucket tag, e.g. "attachments"
  filename: string;        // Original filename
  contentType: string;     // MIME type, e.g. "image/png"
  size: number;            // File size in bytes
  metadata: Metadata;      // Discriminated union by type

  // URL getters (built from features.autumn.url)
  previewUrl: string;      // Processed/resized preview
  originalUrl: string;     // Original unprocessed file
}

// Metadata discriminated union
type Metadata =
  | { type: "File" }       // Generic file
  | { type: "Text" }
  | { type: "Image"; width: number; height: number }
  | { type: "Video"; width: number; height: number }
  | { type: "Audio" };
```

**Key advantage over Discord:** Stoat provides image dimensions (`width`, `height`) directly in the attachment metadata *before* downloading. Discord requires reading the `width`/`height` from the resolved attachment data. Both work, but Stoat's discriminated union makes the type narrowing cleaner.

#### URL Format

Autumn CDN URLs follow this pattern:
```
{autumn_base_url}/{tag}/{file_id}           → processed/preview
{autumn_base_url}/{tag}/{file_id}/original  → original file
```

Example:
```
https://cdn.revoltusercontent.com/attachments/3mdvLzmb3khCRg9Gcxb4tzd9zZ/original
```

The base URL should be read dynamically from `client.configuration.features.autumn.url` — it migrated from `autumn.revolt.chat` to `cdn.revoltusercontent.com` and may change again.

#### Detection & Download Flow

```typescript
async function handleExtractCommand(message: Message) {
  // 1. Check for image attachments
  const images = message.attachments?.filter(
    (file) => file.metadata.type === "Image"
  );

  if (!images || images.length === 0) {
    return message.channel.sendMessage({
      content: "Please attach an image to extract colors from.\nUsage: `!xivdye extract` (with image attached)",
      replies: [{ id: message.id, mention: false }]
    });
  }

  // 2. Take the first image attachment
  const img = images[0];

  // 3. Pre-download validation (metadata available without fetching)
  const sizeError = validateFileSize(img.size);
  if (sizeError) {
    return message.channel.sendMessage({
      content: sizeError,
      replies: [{ id: message.id, mention: false }]
    });
  }

  const dimError = validateDimensions(img.metadata.width, img.metadata.height);
  if (dimError) {
    return message.channel.sendMessage({
      content: dimError,
      replies: [{ id: message.id, mention: false }]
    });
  }

  // 4. React with ⏳ (image processing takes 1-5 seconds)
  await message.react(encodeURIComponent("⏳"));

  try {
    // 5. Download original image from Autumn CDN
    const imageBuffer = await fetchImageWithTimeout(img.originalUrl);

    // 6. Validate format via magic bytes
    const formatResult = validateImageFormat(imageBuffer);
    if (!formatResult.valid) {
      await message.channel.sendMessage({
        content: formatResult.error,
        replies: [{ id: message.id, mention: false }]
      });
      return;
    }

    // 7. Process: resize → extract pixels → k-means → match dyes
    const matches = await extractColorsFromImage(imageBuffer, colorCount);

    // 8. Generate result image (palette grid SVG → PNG)
    const resultPng = await generatePaletteGrid(matches, locale);

    // 9. Upload result to Autumn CDN
    const fileId = await uploadToAutumn(resultPng, "extractor-result.png");

    // 10. Send result
    await message.channel.sendMessage({
      replies: [{ id: message.id, mention: false }],
      embeds: [{
        title: colorCount === 1
          ? "Closest Match"
          : `Top ${matches.length} Matches`,
        description: formatMatchDescriptions(matches, locale),
        colour: matches[0].matchedDye.hex,
        media: fileId
      }],
      interactions: {
        reactions: [encodeURIComponent("❓")],
        restrict_reactions: true
      }
    });

  } catch (error) {
    await message.channel.sendMessage({
      content: `Something went wrong: ${error.message}`,
      replies: [{ id: message.id, mention: false }]
    });
  } finally {
    await message.unreact(encodeURIComponent("⏳"));
  }
}
```

#### Validation Layers

The Discord worker has extensive validation — the Stoat bot ports all of it, with adjustments for the new CDN:

| Validation | Discord Worker | Stoat Bot | Notes |
|---|---|---|---|
| **URL allowlist (SSRF)** | `cdn.discordapp.com`, `media.discordapp.net` | Autumn CDN URL from `features.autumn.url` | Stoat is simpler — attachments always come from Autumn |
| **File size** | Max 10 MB (Content-Length + buffer check) | Max 10 MB (pre-check via `file.size` metadata) | Stoat advantage: size known before download |
| **Dimensions** | Max 4096×4096, max 16 megapixels | Same limits (pre-check via `file.metadata.width/height`) | Stoat advantage: dimensions known before download |
| **Format (magic bytes)** | PNG, JPEG, GIF, WebP, BMP | Same set | Checked after download |
| **Fetch timeout** | 10 seconds | 10 seconds | Same |
| **Redirect handling** | Manual redirect with validation | Not needed — Autumn URLs are direct | Simpler |
| **Private IP blocking** | Blocks 127.*, 10.*, 192.168.*, etc. | Same guards on any fetch | Defense in depth |

#### SSRF Considerations

The Discord worker restricts image URLs to Discord's own CDN because Discord passes the CDN URL as data. Stoat's model is different — and actually **safer by default**:

1. **Attachments always come from Autumn CDN** — the bot reads `file.originalUrl`, which is constructed from the API's `features.autumn.url` + the file ID. There's no user-controlled URL to validate.
2. **No user-provided URLs** — unlike Discord where a bot *could* receive a URL option from the user, the `!xivdye extract` command only processes message attachments.
3. **Still validate** — even though the URL is bot-constructed, keep the SSRF guards (protocol check, private IP blocking) as defense in depth.

```typescript
// Simplified SSRF validation for Stoat
function validateAutumnUrl(url: string, expectedBase: string): boolean {
  const parsed = new URL(url);
  return (
    parsed.protocol === "https:" &&
    url.startsWith(expectedBase) &&
    !isPrivateHost(parsed.hostname)
  );
}
```

#### Processing Pipeline Changes

| Step | Discord Worker (CF Workers) | Stoat Bot (Node.js) | Notes |
|---|---|---|---|
| **Image decode** | `@cf-wasm/photon` (WASM) | `sharp` or `@aspect-build/photon` | sharp is faster, more robust |
| **Resize** | `PhotonImage` → Lanczos3, max 256px | `sharp.resize(256, 256, { fit: 'inside' })` | sharp handles this in one call |
| **Pixel extraction** | `extractPixels()` → RGBA Uint8Array | `sharp.raw().toBuffer()` → RGBA Buffer | Same output format |
| **Memory management** | Manual `.free()` for WASM objects | Automatic GC | No memory leak risk |
| **K-means clustering** | `@xivdyetools/core` PaletteService | Same (platform-agnostic) | No change |
| **SVG → PNG** | `@resvg/resvg-wasm` | `@resvg/resvg-js` (Node.js native) | Faster, no WASM init |
| **Memory limit** | 128 MB WASM heap | Process memory (512 MB+ on Fly.io) | Much more headroom |

##### sharp vs photon for Image Processing

| Factor | sharp | @aspect-build/photon |
|---|---|---|
| **Maturity** | Industry standard, 10+ years | Niche, Rust→WASM→Node bridge |
| **Performance** | Very fast (libvips C library) | Good (Rust native) |
| **API** | Rich, well-documented | Minimal, pixel-level |
| **Install size** | ~30 MB (prebuilt binaries) | ~5 MB |
| **Resize quality** | Excellent (multiple kernels) | Good (Lanczos3) |
| **Pixel access** | `.raw().toBuffer()` → RGBA | `extractPixels()` → RGBA |
| **Memory safety** | Managed by libvips | Manual (but no WASM heap limit) |

**Recommendation:** Use **sharp** for the Stoat bot. It's the standard Node.js image library, handles decode + resize + pixel extraction in a single pipeline, and eliminates the WASM memory management complexity. The larger install size is irrelevant for a VPS deployment (unlike CF Workers where bundle size matters).

```typescript
import sharp from "sharp";

async function processImageForExtraction(buffer: Buffer): Promise<{
  pixels: Buffer;
  width: number;
  height: number;
}> {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  // Resize to max 256px maintaining aspect ratio
  const resized = image.resize(256, 256, {
    fit: "inside",
    withoutEnlargement: true,
    kernel: "lanczos3"
  });

  // Extract raw RGBA pixel data
  const { data, info } = await resized
    .ensureAlpha()   // Guarantee 4 channels (RGBA)
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    pixels: data,    // RGBA Buffer, same format as photon-wasm output
    width: info.width,
    height: info.height
  };
}
```

This replaces ~40 lines of WASM photon code (load → resize → extract → free × 2) with ~15 lines of sharp code that handles everything in a streaming pipeline.

#### Command Syntax

```
!xivdye extract                    → Extract 1 dominant color (default)
!xivdye extract 3                  → Extract top 3 colors
!xivdye extract 5                  → Extract top 5 colors (maximum)
!xd extract                        → Short alias
```

The image is always provided as a message attachment, not a URL argument. This avoids the need for URL validation against arbitrary user-provided URLs.

#### URL-Based Extraction (Future Enhancement)

A future version could accept image URLs:
```
!xivdye extract https://example.com/image.png
```

This would reintroduce SSRF concerns and require the full URL validation suite (protocol check, host allowlist, private IP blocking, redirect validation). **Defer to v2** — attachment-only is safer and covers the primary use case.

---

### Rate Limiting

The Discord worker uses a 4-tier rate limiting system based on computational cost. The Stoat bot ports this directly, reusing the existing Upstash Redis backend with a new key prefix.

#### Current Discord Worker Rate Limits

| Tier | Commands | Limit | Rationale |
|---|---|---|---|
| **Expensive** | `match_image` (extract) | 5 req/min | WASM photon + k-means clustering — most CPU-intensive |
| **API-dependent** | `accessibility`, `budget` | 10 req/min | External API calls (Universalis) — don't abuse upstream |
| **Standard** | `harmony`, `match`, `mixer`, `comparison` | 15 req/min | SVG generation + PNG rendering — moderate cost |
| **Light** | `dye`, `favorites`, `collection`, `language` | 20 req/min | Mostly data lookups or small responses |
| **Exempt** | `about`, `manual`, `stats` | No limit | Pure text, negligible cost |

All limits use a **60-second sliding window**, tracked **per-user per-command**.

#### Stoat Bot Rate Limit Configuration

The same tiering applies, with minor adjustments for the Stoat runtime:

```typescript
// src/services/rate-limiter.ts
import { Redis } from "@upstash/redis";

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Tier 1: Expensive (image processing from user uploads)
  extract:       { limit: 5,  windowMs: 60_000 },

  // Tier 2: API-dependent (external calls)
  a11y:          { limit: 10, windowMs: 60_000 },
  budget:        { limit: 10, windowMs: 60_000 },

  // Tier 3: Standard (SVG→PNG generation)
  harmony:       { limit: 15, windowMs: 60_000 },
  match:         { limit: 15, windowMs: 60_000 },
  mixer:         { limit: 15, windowMs: 60_000 },
  comparison:    { limit: 15, windowMs: 60_000 },
  gradient:      { limit: 15, windowMs: 60_000 },
  swatch:        { limit: 15, windowMs: 60_000 },

  // Tier 4: Light (data lookups, text responses)
  info:          { limit: 20, windowMs: 60_000 },
  search:        { limit: 20, windowMs: 60_000 },
  list:          { limit: 20, windowMs: 60_000 },
  random:        { limit: 20, windowMs: 60_000 },
  favorites:     { limit: 20, windowMs: 60_000 },
  collection:    { limit: 20, windowMs: 60_000 },
  prefs:         { limit: 20, windowMs: 60_000 },
  preset:        { limit: 20, windowMs: 60_000 },

  // Default fallback for unrecognized commands
  default:       { limit: 15, windowMs: 60_000 },
};

// Exempt commands — skip rate limiting entirely
const EXEMPT_COMMANDS = new Set(["about", "help", "ping"]);
```

#### Implementation

```typescript
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;        // Epoch ms when limit resets
  retryAfter?: number;    // Seconds to wait (only when blocked)
}

async function checkRateLimit(
  redis: Redis,
  userId: string,
  command: string
): Promise<RateLimitResult> {
  if (EXEMPT_COMMANDS.has(command)) {
    return { allowed: true, remaining: Infinity, resetAt: 0 };
  }

  const config = RATE_LIMITS[command] ?? RATE_LIMITS.default;
  const key = `ratelimit:stoat:${userId}:${command}`;

  try {
    const [count, ttl] = await redis.pipeline()
      .incr(key)
      .ttl(key)
      .exec() as [number, number];

    // Set expiry on first request in window
    if (ttl === -1) {
      await redis.expire(key, Math.ceil(config.windowMs / 1000));
    }

    if (count > config.limit) {
      const retryAfter = ttl > 0 ? ttl : Math.ceil(config.windowMs / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + retryAfter * 1000,
        retryAfter,
      };
    }

    return {
      allowed: true,
      remaining: config.limit - count,
      resetAt: Date.now() + (ttl > 0 ? ttl * 1000 : config.windowMs),
    };

  } catch {
    // Fail-open: if Upstash is unreachable, allow the request
    return { allowed: true, remaining: config.limit, resetAt: 0 };
  }
}
```

#### Rate Limit Response

On Discord, rate limit messages are ephemeral (only the user sees them). On Stoat, they're sent as brief public replies:

```typescript
if (!rateLimitResult.allowed) {
  const seconds = rateLimitResult.retryAfter ?? 60;
  const plural = seconds === 1 ? "" : "s";
  await message.channel.sendMessage({
    content: `You're using this command too quickly! Please wait **${seconds} second${plural}** before trying again.`,
    replies: [{ id: message.id, mention: false }]
  });
  return;
}
```

This is intentionally public — other users benefit from seeing rate limit feedback (they learn the bot has limits, and busy channels self-regulate).

#### Fail-Open Design

The rate limiter uses **fail-open** semantics: if Upstash Redis is unreachable (network error, timeout), requests are **allowed** rather than blocked. This prioritizes availability — a brief Redis outage shouldn't disable the bot. The worst case is a few extra requests slip through during the outage, which is acceptable.

#### Key Differences from Discord Worker

| Aspect | Discord Worker | Stoat Bot |
|---|---|---|
| **Redis key prefix** | `ratelimit:user:` | `ratelimit:stoat:` |
| **KV fallback** | Yes (Cloudflare KV) | No — Upstash only |
| **Response type** | Ephemeral (user-only) | Public reply (brief) |
| **Exempt commands** | `about`, `manual`, `stats` | `about`, `help`, `ping` |
| **Command naming** | Discord command names | Stoat subcommand names |
| **Scope** | Per-user per-command | Same |
| **Window** | 60-second sliding | Same |

The KV fallback is dropped because the Stoat bot runs on a persistent process where a brief Upstash outage just means fail-open. On CF Workers, the KV fallback existed because each request is isolated and the fail-open window was less predictable.

---

### Webhook Ingestion (HTTP Server)

The Discord worker receives two incoming webhooks alongside its main interaction handler. The Stoat bot needs to handle the same incoming events — but the architecture is different. Instead of multiple routes on a CF Worker, the Stoat bot runs a lightweight HTTP server **in the same process** as the WebSocket client.

#### Current Discord Worker Webhook Endpoints

| Endpoint | Source | Purpose | Auth |
|---|---|---|---|
| `POST /webhooks/github` | GitHub | Changelog push → post version announcement | HMAC-SHA256 (`X-Hub-Signature-256`) |
| `POST /webhooks/preset-submission` | Preset web app | New/approved presets → post to mod/log channel | Bearer token (`INTERNAL_WEBHOOK_SECRET`) |
| `GET /health` | Monitoring | Health check | None |

Both webhooks post messages to specific Discord channels. The Stoat bot needs to post equivalent messages to Stoat channels.

#### Architecture: Co-Located HTTP + WebSocket

Since the Stoat bot is a persistent Node.js process, the HTTP server and revolt.js WebSocket client run in the **same process**. This is simpler than CF Workers — no Service Bindings, no separate Workers.

```typescript
// src/index.ts — Process entrypoint
import { Client } from "revolt.js";
import Fastify from "fastify";

// 1. Initialize revolt.js WebSocket client
const client = new Client();
await client.loginBot(process.env.BOT_TOKEN!);

// 2. Start HTTP server for webhooks (different port than WebSocket)
const http = Fastify();

http.get("/health", async () => ({
  status: "healthy",
  service: "xivdyetools-stoat-bot",
  timestamp: new Date().toISOString(),
  ws: client.websocket.connected ? "connected" : "disconnected",
}));

http.post("/webhooks/github", async (request, reply) => {
  await handleGitHubWebhook(request, client);
  return reply.status(200).send({ ok: true });
});

http.post("/webhooks/preset-submission", async (request, reply) => {
  await handlePresetWebhook(request, client);
  return reply.status(200).send({ ok: true });
});

await http.listen({ port: Number(process.env.HTTP_PORT ?? 3000), host: "0.0.0.0" });
```

**Key advantage:** The `client` object is shared — webhook handlers can call `client.channels.get(channelId).sendMessage(...)` directly. No need for separate bot tokens or REST API calls.

#### GitHub Webhook Handler

Posts version announcements to a Stoat channel when `CHANGELOG-laymans.md` is updated on the main branch.

```typescript
import { timingSafeEqual } from "node:crypto";

async function handleGitHubWebhook(request: FastifyRequest, client: Client) {
  // 1. Verify HMAC-SHA256 signature
  const signature = request.headers["x-hub-signature-256"] as string;
  const body = JSON.stringify(request.body);
  const expected = `sha256=${hmacSha256(process.env.GITHUB_WEBHOOK_SECRET!, body)}`;

  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw { statusCode: 401, message: "Invalid signature" };
  }

  // 2. Check payload size (defense in depth)
  if (body.length > 10_000) {
    throw { statusCode: 413, message: "Payload too large" };
  }

  // 3. Check if CHANGELOG-laymans.md was modified on main
  const payload = request.body as GitHubPushPayload;
  if (payload.ref !== "refs/heads/main") return;

  const changelogModified = payload.commits?.some(c =>
    [...(c.added ?? []), ...(c.modified ?? [])].includes("CHANGELOG-laymans.md")
  );
  if (!changelogModified) return;

  // 4. Fetch and parse latest changelog version
  const raw = await fetch(
    "https://raw.githubusercontent.com/owner/repo/main/CHANGELOG-laymans.md"
  ).then(r => r.text());
  const version = parseLatestVersion(raw);
  if (!version) return;

  // 5. Post announcement to Stoat channel
  const channel = client.channels.get(process.env.ANNOUNCEMENT_CHANNEL_ID!);
  if (!channel) return;

  await channel.sendMessage({
    embeds: [{
      title: `XIV Dye Tools ${version.tag}`,
      description: version.body,
      colour: "#5865F2"
    }]
  });
}
```

#### Preset Submission Webhook Handler

Routes preset notifications to moderation or log channels.

```typescript
async function handlePresetWebhook(request: FastifyRequest, client: Client) {
  // 1. Verify bearer token
  const auth = request.headers.authorization;
  const expected = `Bearer ${process.env.INTERNAL_WEBHOOK_SECRET}`;

  if (!auth || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    throw { statusCode: 401, message: "Unauthorized" };
  }

  // 2. Validate payload
  const payload = request.body as PresetNotificationPayload;
  if (!payload?.preset?.name || !payload?.status) {
    throw { statusCode: 400, message: "Invalid payload" };
  }

  // 3. Sanitize content
  const name = sanitizePresetName(payload.preset.name);
  const description = sanitizePresetDescription(payload.preset.description ?? "");

  // 4. Route by status
  if (payload.status === "pending") {
    // Post to moderation channel
    const modChannel = client.channels.get(process.env.MODERATION_CHANNEL_ID!);
    if (!modChannel) return;

    await modChannel.sendMessage({
      embeds: [{
        title: `New Preset Submission: ${name}`,
        description: [
          description,
          "",
          `**Category:** ${payload.preset.category}`,
          `**Dyes:** ${payload.preset.dyes.length}`,
          `**Author:** ${payload.preset.authorName}`,
        ].join("\n"),
        colour: "#FFA500"  // Orange for pending review
      }],
      // Note: Stoat has no native buttons for approve/reject.
      // Use preset reactions instead:
      interactions: {
        reactions: [
          encodeURIComponent("✅"),   // Approve
          encodeURIComponent("❌"),   // Reject
        ],
        restrict_reactions: true
      }
    });
    // Track context for reaction-based moderation
    // (approve/reject handled via MessageReact event)

  } else if (payload.status === "approved") {
    // Post to submission log channel
    const logChannel = client.channels.get(process.env.SUBMISSION_LOG_CHANNEL_ID!);
    if (!logChannel) return;

    await logChannel.sendMessage({
      embeds: [{
        title: `Preset Approved: ${name}`,
        description: [
          description,
          "",
          `**Category:** ${payload.preset.category}`,
          `**Dyes:** ${payload.preset.dyes.length}`,
          `**Author:** ${payload.preset.authorName}`,
        ].join("\n"),
        colour: "#00CC66"  // Green for approved
      }]
    });
  }
}
```

#### Preset Moderation via Reactions

On Discord, preset moderation uses buttons (approve/reject). On Stoat, we use the same reaction pattern as the rest of the bot:

```typescript
// In the global reaction handler:
case "✅": {
  const ctx = messageContext.get(messageId);
  if (ctx?.command !== "preset-moderation") return;

  // Check if user has moderator role
  const member = await message.channel.server?.fetchMember(userId);
  if (!hasModerationPermission(member)) return;

  // Approve the preset via API call
  await presetApi.moderate(ctx.presetId, "approved", userId);
  await message.channel.sendMessage({
    content: `Preset **${ctx.presetName}** approved by <@${userId}>.`,
    replies: [{ id: messageId, mention: false }]
  });
  break;
}

case "❌": {
  const ctx = messageContext.get(messageId);
  if (ctx?.command !== "preset-moderation") return;

  const member = await message.channel.server?.fetchMember(userId);
  if (!hasModerationPermission(member)) return;

  await presetApi.moderate(ctx.presetId, "rejected", userId);
  await message.channel.sendMessage({
    content: `Preset **${ctx.presetName}** rejected by <@${userId}>.`,
    replies: [{ id: messageId, mention: false }]
  });
  break;
}
```

#### On-Demand API Calls (Unchanged)

These integrations are pull-based — the bot calls them when commands are executed. They port directly:

| API | Discord Worker | Stoat Bot | Notes |
|---|---|---|---|
| **Preset API** | Service Binding (`env.PRESETS_API`) with HMAC | Direct HTTP with HMAC | Same auth, same endpoints |
| **Universalis** | Service Binding (`env.UNIVERSALIS_PROXY`) | Direct HTTP to proxy or Universalis API | Same batched pricing logic |

On CF Workers, Service Bindings provide zero-latency Worker-to-Worker calls. On a VPS, these become regular HTTPS calls with ~50-100ms latency. This is negligible for user-facing commands (budget already takes 1-3 seconds due to Universalis response time).

**Universalis directly vs. proxy:** The Discord worker uses a Universalis proxy (another CF Worker) to add caching and rate limiting. The Stoat bot can either:
1. **Reuse the same proxy** — call it via HTTPS (the proxy is already deployed and works for any HTTP client)
2. **Call Universalis directly** — add in-memory caching (LRU cache) and respect Universalis rate limits locally

Option 1 is simpler and reuses existing infrastructure. The proxy handles caching and rate limiting at the edge, so the Stoat bot benefits without reimplementation.

#### Hosting Considerations

The HTTP server needs to be reachable from the internet for GitHub and preset webhooks to POST to it. On Fly.io:

```toml
# fly.toml

[http_service]
  internal_port = 3000        # Fastify listens here
  force_https = true
  auto_stop_machines = false   # Keep running for WebSocket
  auto_start_machines = true

[[services.ports]]
  handlers = ["tls", "http"]
  port = 443
```

The bot exposes:
- **Port 3000 internally** → mapped to **HTTPS on port 443** by Fly.io's proxy
- Webhook URLs become: `https://xivdyetools-stoat.fly.dev/webhooks/github`, etc.
- The WebSocket connection to Stoat's gateway is outbound — it doesn't need a public port

#### Security Summary

| Webhook | Auth Method | Same as Discord Worker? |
|---|---|---|
| GitHub | HMAC-SHA256 (`X-Hub-Signature-256`) | Yes — identical verification |
| Preset submission | Bearer token (constant-time compare) | Yes — identical verification |
| Health check | None (public) | Yes |

Additional defenses ported from the Discord worker:
- **Payload size limit:** 10 KB max for both webhooks
- **Constant-time string comparison:** `timingSafeEqual()` for all secret comparisons
- **Content sanitization:** Preset names and descriptions sanitized before display

#### HTTP Framework Choice

| Framework | Install Size | Perf | Why / Why Not |
|---|---|---|---|
| **Fastify** | ~2 MB | Very fast | Schema validation, plugins, TypeScript-first |
| **Hono** | ~100 KB | Fast | Ultra-lightweight, CF Workers compatible (could share code with Telegram worker later) |
| **Express** | ~1.5 MB | Moderate | Most popular, but less TypeScript-friendly |
| **Node http** | 0 (built-in) | Fast | No framework overhead, but manual routing |

**Recommendation:** Use **Hono** if planning to share webhook handler code with a future Telegram CF Worker (Hono runs on both Node.js and CF Workers). Otherwise, **Fastify** is the more mature choice for a Node.js-only service.

#### File Layout Addition

```
xivdyetools-stoat-bot/
  src/
    http/
      server.ts             ← Fastify/Hono setup, route registration
      webhooks/
        github.ts           ← GitHub push → changelog announcement
        preset.ts           ← Preset submission → mod/log channel
      middleware/
        verify-hmac.ts      ← HMAC-SHA256 signature verification
        verify-bearer.ts    ← Bearer token verification
```

---
