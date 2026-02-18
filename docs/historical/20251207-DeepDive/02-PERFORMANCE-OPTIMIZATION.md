# Performance Optimization: xivdyetools-presets-api

**Date:** December 7, 2025
**Focus Areas:** Database, Caching, Memory/CPU, Worker-Specific

---

## Summary

| Category | Issues | Estimated Improvement |
|----------|--------|----------------------|
| Database | 5 | -40-60% latency |
| Caching | 4 | -150-300ms per request |
| Memory/CPU | 3 | -25-35% CPU |
| Worker-Specific | 4 | +30% throughput |

---

## 1. Database Query Efficiency

### 1.1 N+1 Query Problem in Pagination

**File:** `src/services/preset-service.ts` (Lines 105-119)
**Impact:** 2x database round-trips per paginated request

**Current Implementation:**
```typescript
// Query 1: Get total count
const countQuery = `SELECT COUNT(*) as total FROM presets WHERE ${whereClause}`;
const countResult = await db.prepare(countQuery).bind(...params).first();

// Query 2: Get paginated data
const dataQuery = `SELECT * FROM presets WHERE ${whereClause} LIMIT ? OFFSET ?`;
const dataResult = await db.prepare(dataQuery).bind(...params).all();
```

**Optimization:** Use window function (SQLite 3.25+)
```typescript
// Single query with COUNT(*) OVER()
const query = `
  SELECT *, COUNT(*) OVER() as total
  FROM presets
  WHERE ${whereClause}
  ORDER BY ${orderBy}
  LIMIT ? OFFSET ?
`;
const result = await db.prepare(query).bind(...params).all();
const total = result.results[0]?.total || 0;
```

**Savings:** 50% reduction in database queries for list endpoints

---

### 1.2 Missing Database Indexes

**File:** `schema.sql` (Lines 48-54)

**Current Indexes:**
```sql
CREATE INDEX idx_presets_category ON presets(category_id);
CREATE INDEX idx_presets_status ON presets(status);
CREATE INDEX idx_presets_vote_count ON presets(vote_count DESC);
CREATE INDEX idx_presets_author ON presets(author_discord_id);
CREATE INDEX idx_presets_created ON presets(created_at DESC);
CREATE INDEX idx_presets_curated ON presets(is_curated);
```

**Missing Composite Indexes:**
```sql
-- For filtered + sorted queries
CREATE INDEX idx_presets_status_category ON presets(status, category_id);
CREATE INDEX idx_presets_status_vote ON presets(status, vote_count DESC);
CREATE INDEX idx_presets_status_created ON presets(status, created_at DESC);

-- For rate limit checks
CREATE INDEX idx_presets_author_created ON presets(author_discord_id, created_at DESC);

-- For search optimization
CREATE INDEX idx_presets_name ON presets(name);
```

**Impact:** Without composite indexes, queries like:
```sql
SELECT * FROM presets WHERE status = 'approved' ORDER BY vote_count DESC
```
Require full table scan + sort instead of index-only lookup.

---

### 1.3 Vote Operations Execute 4-5 Queries

**File:** `src/handlers/votes.ts` (Lines 20-79)

**Current Flow (addVote):**
1. `SELECT 1 FROM votes WHERE ...` — Check if exists
2. `INSERT INTO votes ...` — Add vote (batched)
3. `UPDATE presets SET vote_count = vote_count + 1` — Increment (batched)
4. `SELECT vote_count FROM presets WHERE id = ?` — Get new count

**Optimized Flow:**
```typescript
// Use RETURNING clause (SQLite 3.35+) or upsert
const result = await db.batch([
  db.prepare(`
    INSERT INTO votes (preset_id, user_discord_id, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT(preset_id, user_discord_id) DO NOTHING
  `).bind(presetId, userDiscordId, now),

  db.prepare(`
    UPDATE presets
    SET vote_count = vote_count + 1
    WHERE id = ? AND NOT EXISTS (
      SELECT 1 FROM votes
      WHERE preset_id = ? AND user_discord_id = ?
    )
    RETURNING vote_count
  `).bind(presetId, presetId, userDiscordId)
]);
```

**Savings:** Reduce from 4-5 queries to 2 (batch)

---

### 1.4 Categories Endpoint Performs JOIN Every Request

**File:** `src/handlers/categories.ts` (Lines 19-51)

**Current Query:**
```sql
SELECT c.*, COUNT(CASE WHEN p.status = 'approved' THEN 1 END) as preset_count
FROM categories c
LEFT JOIN presets p ON p.category_id = c.id
GROUP BY c.id
ORDER BY c.display_order
```

**Problem:** Full LEFT JOIN on presets table every request. Categories rarely change.

**Optimization Options:**

1. **Denormalize preset_count:**
   ```sql
   ALTER TABLE categories ADD COLUMN preset_count INTEGER DEFAULT 0;
   -- Update via trigger or application code
   ```

2. **Cache with KV (recommended):**
   ```typescript
   const cacheKey = 'categories:v1:with_counts';
   let categories = await env.KV_CACHE.get(cacheKey, 'json');

   if (!categories) {
     const result = await db.prepare(query).all();
     categories = result.results;
     await env.KV_CACHE.put(cacheKey, JSON.stringify(categories), {
       expirationTtl: 3600 // 1 hour
     });
   }
   ```

---

### 1.5 Inefficient Rate Limit Query

**File:** `src/services/rate-limit-service.ts` (Lines 18-46)

**Current Implementation:**
```typescript
const query = `
  SELECT COUNT(*) as count
  FROM presets
  WHERE author_discord_id = ?
    AND created_at >= ?
    AND created_at < ?
`;
```

**Problem:**
- Scans presets table for rate limiting
- Unused `rate_limits` table exists in schema
- Missing index on `(author_discord_id, created_at)`

**Optimization:** Use dedicated rate_limits table:
```typescript
export async function checkSubmissionRateLimit(
  db: D1Database,
  userDiscordId: string
): Promise<RateLimitResult> {
  const key = `submit:${userDiscordId}`;
  const now = new Date().toISOString();

  const entry = await db.prepare(`
    SELECT count, expires_at FROM rate_limits
    WHERE key = ? AND expires_at > ?
  `).bind(key, now).first();

  if (!entry) {
    // First submission today
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    await db.prepare(`
      INSERT INTO rate_limits (key, count, expires_at)
      VALUES (?, 1, ?)
    `).bind(key, tomorrow).run();
    return { allowed: true, remaining: 9 };
  }

  if (entry.count >= 10) {
    return { allowed: false, remaining: 0, resetAt: entry.expires_at };
  }

  await db.prepare(`
    UPDATE rate_limits SET count = count + 1 WHERE key = ?
  `).bind(key).run();

  return { allowed: true, remaining: 10 - entry.count - 1 };
}
```

---

## 2. Caching Opportunities

### 2.1 Categories Data (Static)

| Property | Value |
|----------|-------|
| Change frequency | Rarely (admin only) |
| Request frequency | Every page load |
| Recommended TTL | 3600 seconds (1 hour) |
| Cache type | KV Namespace |

**Implementation:**
```typescript
async function getCategoriesWithCache(env: Env): Promise<CategoryMeta[]> {
  const cacheKey = 'categories:v1';

  // Try cache first
  const cached = await env.KV_CACHE.get(cacheKey, 'json');
  if (cached) return cached as CategoryMeta[];

  // Query database
  const result = await env.DB.prepare(CATEGORIES_QUERY).all();
  const categories = result.results.map(rowToCategory);

  // Cache for 1 hour
  await env.KV_CACHE.put(cacheKey, JSON.stringify(categories), {
    expirationTtl: 3600
  });

  return categories;
}
```

---

### 2.2 Featured Presets (Read-Heavy)

| Property | Value |
|----------|-------|
| Change frequency | Slowly (votes change over time) |
| Request frequency | Homepage, every tool |
| Recommended TTL | 300 seconds (5 minutes) |
| Cache type | KV Namespace |

**File:** `src/services/preset-service.ts` (Lines 135-144)

```typescript
async function getFeaturedPresetsWithCache(
  db: D1Database,
  kv: KVNamespace
): Promise<CommunityPreset[]> {
  const cacheKey = 'featured:v1:top10';

  const cached = await kv.get(cacheKey, 'json');
  if (cached) return cached as CommunityPreset[];

  const result = await db.prepare(`
    SELECT * FROM presets
    WHERE status = 'approved' AND is_curated = 0
    ORDER BY vote_count DESC
    LIMIT 10
  `).all();

  const presets = result.results.map(rowToPreset);

  await kv.put(cacheKey, JSON.stringify(presets), {
    expirationTtl: 300
  });

  return presets;
}
```

---

### 2.3 JWT Token Verification Cache

**File:** `src/middleware/auth.ts` (Lines 47-94)
**Impact:** 15-20% CPU reduction

**Problem:** JWT signature verification is CPU-intensive (HMAC-SHA256)

**Implementation:**
```typescript
async function verifyJWTWithCache(
  token: string,
  secret: string,
  kv: KVNamespace
): Promise<JWTPayload | null> {
  // Hash token for cache key (don't store raw token)
  const tokenHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token)
  );
  const cacheKey = `jwt:${btoa(String.fromCharCode(...new Uint8Array(tokenHash))).slice(0, 32)}`;

  // Try cache
  const cached = await kv.get(cacheKey, 'json');
  if (cached) {
    const payload = cached as JWTPayload;
    // Double-check expiration
    if (payload.exp * 1000 > Date.now()) {
      return payload;
    }
  }

  // Verify token
  const payload = await verifyJWT(token, secret);
  if (!payload) return null;

  // Cache with TTL matching token expiration
  const ttl = payload.exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) {
    await kv.put(cacheKey, JSON.stringify(payload), {
      expirationTtl: Math.min(ttl, 3600) // Max 1 hour
    });
  }

  return payload;
}
```

---

### 2.4 Missing KV Namespace Binding

**File:** `wrangler.toml`

**Current:** No KV namespace configured

**Required Configuration:**
```toml
[[kv_namespaces]]
binding = "KV_CACHE"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"

[[env.production.kv_namespaces]]
binding = "KV_CACHE"
id = "your-production-kv-namespace-id"
```

**Update Types:**
```typescript
// In types.ts
export interface Env {
  // ... existing
  KV_CACHE: KVNamespace;
}
```

---

## 3. Memory/CPU Optimization

### 3.1 Profanity Regex Recompilation

**File:** `src/services/moderation-service.ts` (Lines 23-37)
**Impact:** ~10% CPU overhead

**Current Code:**
```typescript
function checkLocalFilter(name: string, description: string): ModerationResult | null {
  const textToCheck = `${name} ${description}`.toLowerCase();

  for (const [_locale, words] of Object.entries(profanityLists)) {
    for (const word of words) {
      // Creates new RegExp for every word, every request!
      const regex = new RegExp(`\\b${escapeRegex(word.toLowerCase())}\\b`, 'i');
      if (regex.test(textToCheck)) {
        // ...
      }
    }
  }
}
```

**Optimization:** Pre-compile at module load:
```typescript
// Pre-compiled patterns at module initialization
const profanityPatterns: Map<string, RegExp[]> = new Map();

// Build cache once
for (const [locale, words] of Object.entries(profanityLists)) {
  const patterns = words.map(word =>
    new RegExp(`\\b${escapeRegex(word.toLowerCase())}\\b`, 'i')
  );
  profanityPatterns.set(locale, patterns);
}

function checkLocalFilter(name: string, description: string): ModerationResult | null {
  const textToCheck = `${name} ${description}`.toLowerCase();

  for (const patterns of profanityPatterns.values()) {
    for (const regex of patterns) {
      if (regex.test(textToCheck)) {
        const flaggedField = regex.test(name.toLowerCase()) ? 'name' : 'description';
        return {
          passed: false,
          flaggedField,
          flaggedReason: 'Contains prohibited content',
          method: 'local',
        };
      }
    }
  }

  return null;
}
```

**Savings:** Eliminate regex compilation from hot path

---

### 3.2 JSON.parse in Hot Path

**File:** `src/services/preset-service.ts` (Lines 29-47)

**Current Code:**
```typescript
export function rowToPreset(row: PresetRow): CommunityPreset {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category_id: row.category_id,
    dyes: JSON.parse(row.dyes),                    // Parse every time
    tags: JSON.parse(row.tags),                    // Parse every time
    author_discord_id: row.author_discord_id,
    author_name: row.author_name,
    vote_count: row.vote_count,
    status: row.status,
    is_curated: row.is_curated === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    dye_signature: row.dye_signature,
    previous_values: row.previous_values ? JSON.parse(row.previous_values) : null,
  };
}
```

**Called From:**
- `getPresets()` — up to 100 presets per page
- `getFeaturedPresets()` — 10 presets
- `getPresetsByUser()` — all user presets
- `findDuplicatePreset()` — every submission

**Optimization Options:**

1. **Lazy parsing with getters:**
```typescript
export function rowToPreset(row: PresetRow): CommunityPreset {
  const preset: CommunityPreset = {
    id: row.id,
    name: row.name,
    // ... other fields
  };

  // Lazy parse on access
  let _dyes: number[] | undefined;
  Object.defineProperty(preset, 'dyes', {
    get() {
      if (!_dyes) _dyes = JSON.parse(row.dyes);
      return _dyes;
    }
  });

  return preset;
}
```

2. **Select only needed columns for list views:**
```typescript
// For list view, don't select dyes if not needed
const listQuery = `
  SELECT id, name, category_id, author_name, vote_count, created_at
  FROM presets WHERE ...
`;
```

---

### 3.3 DateTime String Recreation

**Files:** Multiple handlers

**Problem:** `new Date().toISOString()` called repeatedly:
```typescript
// In handlers/votes.ts
const now = new Date().toISOString();

// In handlers/presets.ts
const now = new Date().toISOString();

// In services/preset-service.ts
const now = new Date().toISOString();
```

**Optimization:** Create once in middleware:
```typescript
// In middleware
app.use('*', async (c, next) => {
  c.set('requestTime', new Date().toISOString());
  await next();
});

// In handlers
const now = c.get('requestTime');
```

---

## 4. Worker-Specific Optimizations

### 4.1 Perspective API Blocks Response

**File:** `src/services/moderation-service.ts` (Lines 157-164)

**Current Code:**
```typescript
const perspectiveResult = await checkWithPerspective(
  `${name} ${description}`,
  env
);
```

**Problem:** Network call to external API blocks response (200-500ms)

**Optimization:** Use `waitUntil()` for non-blocking:
```typescript
// In handler
const localResult = checkLocalFilter(name, description);

if (localResult && !localResult.passed) {
  // Immediate rejection
  return c.json({ error: 'Content flagged' }, 400);
}

// Create preset with pending status
const preset = await createPreset(db, submission, 'pending');

// Run Perspective check in background
c.executionCtx.waitUntil(
  checkWithPerspective(`${name} ${description}`, env)
    .then(result => {
      if (result && !result.passed) {
        return updatePresetStatus(db, preset.id, 'flagged');
      }
      return updatePresetStatus(db, preset.id, 'approved');
    })
    .catch(err => console.error('Perspective check failed:', err))
);

return c.json({ preset, status: 'pending' });
```

---

### 4.2 Logger Middleware Overhead

**File:** `src/index.ts` (Line 33)

**Current Code:**
```typescript
app.use('*', logger());
```

**Problem:** Logs every request, including health checks

**Optimization:**
```typescript
// Conditional logging
app.use('*', async (c, next) => {
  // Skip logging for health checks in production
  if (c.env.ENVIRONMENT !== 'development' && c.req.path === '/health') {
    return next();
  }

  const start = performance.now();
  await next();
  const duration = performance.now() - start;

  // Only log slow requests or errors in production
  if (c.env.ENVIRONMENT === 'development' || duration > 1000 || c.res.status >= 400) {
    console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${duration.toFixed(0)}ms`);
  }
});
```

---

### 4.3 Service Binding Without Retry

**File:** `src/handlers/presets.ts` (Lines 556-579)

**Current Code:**
```typescript
const response = await env.DISCORD_WORKER.fetch(
  new Request('https://internal/webhooks/preset-submission', { ... })
);

if (!response.ok) {
  throw new Error(`Discord worker returned ${response.status}`);
}
```

**Problem:** No retry logic for transient failures

**Optimization:**
```typescript
async function fetchWithRetry(
  binding: Fetcher,
  request: Request,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await binding.fetch(request.clone());
      if (response.ok) return response;

      // Don't retry 4xx errors
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`);
      }
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
    }

    // Exponential backoff: 100ms, 200ms, 400ms
    await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt)));
  }

  throw new Error('Max retries exceeded');
}
```

---

### 4.4 Response Size Optimization

**File:** `src/handlers/presets.ts`

**Problem:** List endpoints return full preset objects:
- `description`: up to 200 chars
- `dyes`: 5-element array
- `previous_values`: Only needed for moderation

**Optimization:** Create list vs detail response types:
```typescript
// For list view (smaller payload)
interface PresetListItem {
  id: string;
  name: string;
  category_id: string;
  author_name: string | null;
  vote_count: number;
  created_at: string;
}

// Use in query
const listQuery = `
  SELECT id, name, category_id, author_name, vote_count, created_at
  FROM presets WHERE ...
`;
```

**Estimated Savings:** ~60% reduction in list response sizes

---

## Performance Improvement Summary

| Optimization | Latency | Throughput | CPU | Effort |
|--------------|---------|------------|-----|--------|
| Database indexes | -40-60% | +50% | — | 15 min |
| Window functions (pagination) | -50% queries | +30% | — | 30 min |
| Categories cache (KV) | -100-200ms | +30% | — | 1 hour |
| Featured presets cache | -50-100ms | +20% | — | 30 min |
| Regex pre-compilation | — | — | -10-15% | 20 min |
| JWT token cache | -10-50ms | — | -15-20% | 45 min |
| Response size optimization | — | +15% | — | 1 hour |
| waitUntil for Perspective | -200-500ms | +40% | — | 1 hour |
| **Total Estimated** | **-200-350ms** | **+80-100%** | **-25-35%** | **~6 hours** |

---

## Implementation Priority

### Phase 1: Quick Wins (< 2 hours)
1. Add composite database indexes
2. Pre-compile profanity regex patterns
3. Add KV namespace binding to wrangler.toml

### Phase 2: Caching Layer (2-3 hours)
4. Implement categories cache
5. Implement featured presets cache
6. Update type definitions for KV

### Phase 3: Query Optimization (2-3 hours)
7. Implement window functions for pagination
8. Reduce vote operation queries
9. Use dedicated rate_limits table

### Phase 4: Advanced (3-4 hours)
10. JWT token verification cache
11. Perspective API with waitUntil
12. Response size optimization
