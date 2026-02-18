# Implementation Roadmap: xivdyetools-presets-api

**Date:** December 7, 2025
**Total Estimated Effort:** ~16-20 hours
**Recommended Timeline:** 2-3 focused sessions

---

## Overview

This roadmap synthesizes findings from the security audit, performance analysis, and code quality review into actionable implementation phases.

---

## Phase Summary

| Phase | Focus | Duration | Priority |
|-------|-------|----------|----------|
| 1 | Critical Security | 2-3 hours | P0 - Immediate |
| 2 | Database Optimization | 2-3 hours | P1 - High |
| 3 | Caching Infrastructure | 3-4 hours | P2 - High |
| 4 | Code Quality | 4-5 hours | P3 - Medium |
| 5 | Advanced Optimizations | 4-5 hours | P4 - Low |

---

## Phase 1: Critical Security (P0)

**Timeline:** Immediate
**Effort:** 2-3 hours

### 1.1 Fix CORS Configuration

**File:** `src/index.ts`

**Tasks:**
- [ ] Restrict localhost to specific port (5173)
- [ ] Handle no-origin requests properly
- [ ] Move additional origins to environment variable

**Changes:**
```typescript
// Before (lines 44-52)
if (
  !origin ||
  origin === allowedOrigin ||
  additionalOrigins.includes(origin) ||
  origin.startsWith('http://localhost:') ||
  origin.startsWith('http://127.0.0.1:')
) {
  return origin || '*';
}

// After
const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const additionalOrigins = (c.env.ADDITIONAL_CORS_ORIGINS || '').split(',').filter(Boolean);

if (!origin) {
  return null; // Don't allow requests without origin
}

if (
  origin === allowedOrigin ||
  additionalOrigins.includes(origin) ||
  devOrigins.includes(origin)
) {
  return origin;
}

return null;
```

**Update wrangler.toml:**
```toml
[vars]
ADDITIONAL_CORS_ORIGINS = "https://xivdyetools.projectgalatine.com"
```

---

### 1.2 Add JWT Algorithm Validation

**File:** `src/middleware/auth.ts`

**Tasks:**
- [ ] Parse and validate JWT header before signature verification
- [ ] Reject tokens with non-HS256 algorithm

**Changes:**
```typescript
async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;

    // ADD: Validate algorithm
    const header = JSON.parse(base64UrlDecode(encodedHeader));
    if (header.alg !== 'HS256') {
      console.warn('JWT rejected: unsupported algorithm', { alg: header.alg });
      return null;
    }

    // ... rest of verification
  }
}
```

---

### 1.3 Escape LIKE Wildcards

**File:** `src/services/preset-service.ts`

**Tasks:**
- [ ] Create escape function
- [ ] Apply to search patterns

**Changes:**
```typescript
function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

// In getPresets()
if (search) {
  conditions.push('(name LIKE ? ESCAPE \'\\\' OR description LIKE ? ESCAPE \'\\\' OR tags LIKE ? ESCAPE \'\\\')');
  const searchPattern = `%${escapeLikePattern(search)}%`;
  params.push(searchPattern, searchPattern, searchPattern);
}
```

---

### 1.4 Add Security Headers

**File:** `src/index.ts`

**Tasks:**
- [ ] Add security headers middleware

**Changes:**
```typescript
// Add after CORS middleware
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});
```

---

## Phase 2: Database Optimization (P1)

**Timeline:** After Phase 1
**Effort:** 2-3 hours

### 2.1 Add Missing Indexes

**File:** `schema.sql`

**Tasks:**
- [ ] Add composite indexes for common queries
- [ ] Test query performance before/after

**SQL to add:**
```sql
-- Composite indexes for filtered queries
CREATE INDEX IF NOT EXISTS idx_presets_status_category ON presets(status, category_id);
CREATE INDEX IF NOT EXISTS idx_presets_status_vote ON presets(status, vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_presets_status_created ON presets(status, created_at DESC);

-- For rate limit checks
CREATE INDEX IF NOT EXISTS idx_presets_author_created ON presets(author_discord_id, created_at DESC);

-- For search optimization
CREATE INDEX IF NOT EXISTS idx_presets_name ON presets(name);
```

**Migration command:**
```bash
npx wrangler d1 execute xivdyetools-presets --file=./migrations/add_composite_indexes.sql
```

---

### 2.2 Implement Window Function for Pagination

**File:** `src/services/preset-service.ts`

**Tasks:**
- [ ] Replace two-query pagination with single query
- [ ] Update return type to include total

**Changes:**
```typescript
// Before (lines 105-119): Two queries
const countResult = await db.prepare(countQuery).bind(...params).first();
const dataResult = await db.prepare(dataQuery).bind(...params).all();

// After: Single query with window function
const query = `
  SELECT *, COUNT(*) OVER() as _total
  FROM presets
  WHERE ${whereClause}
  ORDER BY ${orderBy}
  LIMIT ? OFFSET ?
`;

const result = await db.prepare(query).bind(...params, limit, offset).all();
const total = (result.results[0] as any)?._total || 0;
const presets = result.results.map(row => {
  const { _total, ...preset } = row as any;
  return rowToPreset(preset);
});

return { presets, total, page, limit };
```

---

### 2.3 Reduce Vote Operation Queries

**File:** `src/handlers/votes.ts`

**Tasks:**
- [ ] Use INSERT ... ON CONFLICT for atomic operations
- [ ] Remove separate existence check

**Changes:**
```typescript
export async function addVote(
  db: D1Database,
  presetId: string,
  userDiscordId: string
): Promise<VoteResult> {
  const now = new Date().toISOString();

  try {
    // Single batch with conflict handling
    const results = await db.batch([
      // Try to insert vote (will fail silently if exists)
      db.prepare(`
        INSERT INTO votes (preset_id, user_discord_id, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT(preset_id, user_discord_id) DO NOTHING
      `).bind(presetId, userDiscordId, now),

      // Increment vote count only if insert succeeded
      db.prepare(`
        UPDATE presets
        SET vote_count = vote_count + 1
        WHERE id = ? AND EXISTS (
          SELECT 1 FROM votes
          WHERE preset_id = ? AND user_discord_id = ? AND created_at = ?
        )
      `).bind(presetId, presetId, userDiscordId, now),

      // Get current vote count
      db.prepare('SELECT vote_count FROM presets WHERE id = ?').bind(presetId),
    ]);

    const countResult = results[2].results?.[0] as { vote_count: number } | undefined;
    const wasInserted = (results[0].meta?.changes || 0) > 0;

    return {
      success: true,
      new_vote_count: countResult?.vote_count || 0,
      already_voted: !wasInserted,
    };
  } catch (error) {
    // ... error handling
  }
}
```

---

## Phase 3: Caching Infrastructure (P2)

**Timeline:** After Phase 2
**Effort:** 3-4 hours

### 3.1 Add KV Namespace

**File:** `wrangler.toml`

**Tasks:**
- [ ] Create KV namespace
- [ ] Add bindings for all environments

**Commands:**
```bash
# Create KV namespaces
npx wrangler kv:namespace create "CACHE"
npx wrangler kv:namespace create "CACHE" --preview
```

**Add to wrangler.toml:**
```toml
[[kv_namespaces]]
binding = "KV_CACHE"
id = "<your-kv-id>"
preview_id = "<your-preview-kv-id>"

[[env.production.kv_namespaces]]
binding = "KV_CACHE"
id = "<your-production-kv-id>"
```

**Update types.ts:**
```typescript
export interface Env {
  // ... existing
  KV_CACHE: KVNamespace;
}
```

---

### 3.2 Implement Categories Cache

**File:** `src/services/category-service.ts` (new file)

**Tasks:**
- [ ] Create category service with caching
- [ ] Update handlers to use service

```typescript
const CACHE_KEY = 'categories:v1';
const CACHE_TTL = 3600; // 1 hour

export async function getCategoriesWithCache(
  db: D1Database,
  kv: KVNamespace
): Promise<CategoryMeta[]> {
  // Try cache first
  const cached = await kv.get(CACHE_KEY, 'json');
  if (cached) return cached as CategoryMeta[];

  // Query database
  const result = await db.prepare(CATEGORIES_QUERY).all();
  const categories = (result.results || []).map(rowToCategory);

  // Cache for 1 hour
  await kv.put(CACHE_KEY, JSON.stringify(categories), {
    expirationTtl: CACHE_TTL,
  });

  return categories;
}

export async function invalidateCategoriesCache(kv: KVNamespace): Promise<void> {
  await kv.delete(CACHE_KEY);
}
```

---

### 3.3 Implement Featured Presets Cache

**File:** `src/services/preset-service.ts`

**Tasks:**
- [ ] Add cache layer for featured presets
- [ ] Invalidate on vote changes (or use short TTL)

```typescript
const FEATURED_CACHE_KEY = 'featured:v1:top10';
const FEATURED_CACHE_TTL = 300; // 5 minutes

export async function getFeaturedPresetsWithCache(
  db: D1Database,
  kv: KVNamespace
): Promise<CommunityPreset[]> {
  const cached = await kv.get(FEATURED_CACHE_KEY, 'json');
  if (cached) return cached as CommunityPreset[];

  const result = await db.prepare(`
    SELECT * FROM presets
    WHERE status = 'approved' AND is_curated = 0
    ORDER BY vote_count DESC
    LIMIT 10
  `).all();

  const presets = (result.results || []).map(rowToPreset);

  await kv.put(FEATURED_CACHE_KEY, JSON.stringify(presets), {
    expirationTtl: FEATURED_CACHE_TTL,
  });

  return presets;
}
```

---

## Phase 4: Code Quality (P3)

**Timeline:** After Phase 3
**Effort:** 4-5 hours

### 4.1 Create Auth Guard Middleware

**File:** `src/middleware/guards.ts` (new file)

**Tasks:**
- [ ] Create middleware factory functions
- [ ] Update all handlers to use new middleware

```typescript
export function requireAuthAndUser() {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const auth = c.get('auth');

    if (!auth.isAuthenticated) {
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }

    if (!auth.userDiscordId) {
      return c.json({ error: 'Bad Request', message: 'User context required' }, 400);
    }

    await next();
  };
}
```

---

### 4.2 Create Structured Logger

**File:** `src/utils/logger.ts` (new file)

**Tasks:**
- [ ] Create logger utility
- [ ] Replace all console.* calls

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
};
```

---

### 4.3 Create Query Param Validators

**File:** `src/utils/validators.ts` (new file)

**Tasks:**
- [ ] Create validation functions for all query params
- [ ] Update handlers to use validators

---

### 4.4 Pre-compile Profanity Regex

**File:** `src/services/moderation-service.ts`

**Tasks:**
- [ ] Move regex compilation to module initialization
- [ ] Update checkLocalFilter to use pre-compiled patterns

```typescript
// Pre-compiled at module load
const profanityPatterns = new Map<string, RegExp[]>();

for (const [locale, words] of Object.entries(profanityLists)) {
  profanityPatterns.set(
    locale,
    words.map(word => new RegExp(`\\b${escapeRegex(word.toLowerCase())}\\b`, 'i'))
  );
}

function checkLocalFilter(name: string, description: string): ModerationResult | null {
  const textToCheck = `${name} ${description}`.toLowerCase();

  for (const patterns of profanityPatterns.values()) {
    for (const regex of patterns) {
      if (regex.test(textToCheck)) {
        // ...
      }
    }
  }
  return null;
}
```

---

## Phase 5: Advanced Optimizations (P4)

**Timeline:** Future sessions
**Effort:** 4-5 hours

### 5.1 JWT Token Verification Cache

**File:** `src/middleware/auth.ts`

**Tasks:**
- [ ] Hash tokens for cache keys
- [ ] Cache verified payloads with TTL matching exp

---

### 5.2 Perspective API with waitUntil

**File:** `src/services/moderation-service.ts`

**Tasks:**
- [ ] Run Perspective check non-blocking
- [ ] Update preset status asynchronously

---

### 5.3 Response Size Optimization

**File:** `src/handlers/presets.ts`

**Tasks:**
- [ ] Create list vs detail response types
- [ ] Reduce columns in list queries

---

### 5.4 Implement Rate Limiting Table

**File:** `src/services/rate-limit-service.ts`

**Tasks:**
- [ ] Use rate_limits table instead of preset queries
- [ ] Add cleanup job for expired entries

---

## Testing Checklist

### After Each Phase:

- [ ] Run all unit tests: `npm test`
- [ ] Run type check: `npm run type-check`
- [ ] Run linter: `npm run lint`
- [ ] Deploy to staging: `npm run deploy`
- [ ] Manual testing of affected endpoints

### Specific Tests:

**Phase 1 (Security):**
- [ ] Verify CORS rejects invalid origins
- [ ] Verify CORS accepts valid origins
- [ ] Test JWT with invalid algorithm is rejected
- [ ] Test search with LIKE wildcards works correctly

**Phase 2 (Database):**
- [ ] Verify pagination returns correct totals
- [ ] Test voting operations are atomic
- [ ] Measure query performance improvement

**Phase 3 (Caching):**
- [ ] Verify categories are cached
- [ ] Verify cache invalidation works
- [ ] Test cache miss behavior

**Phase 4 (Code Quality):**
- [ ] All handlers use new middleware
- [ ] Logging is consistent JSON format
- [ ] Invalid query params are rejected

---

## File Changes Summary

| Phase | Files Modified | Files Created |
|-------|----------------|---------------|
| 1 | index.ts, auth.ts, preset-service.ts, wrangler.toml | — |
| 2 | schema.sql, preset-service.ts, votes.ts | migrations/add_composite_indexes.sql |
| 3 | wrangler.toml, types.ts, preset-service.ts | category-service.ts |
| 4 | presets.ts, votes.ts, moderation-service.ts | guards.ts, logger.ts, validators.ts |
| 5 | auth.ts, moderation-service.ts, presets.ts, rate-limit-service.ts | — |

---

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| CORS changes | May break legitimate clients | Test thoroughly before production |
| Index additions | Migration may lock table | Run during low-traffic window |
| Query changes | May affect pagination | Comprehensive testing with edge cases |
| Caching | Stale data possible | Use appropriate TTLs, implement invalidation |
| Middleware refactor | Handler behavior changes | Test all endpoints after changes |

---

## Success Metrics

After completing all phases:

| Metric | Current | Target |
|--------|---------|--------|
| Security issues | 12 | 0 critical/high |
| Average latency (list) | ~300ms | ~100ms |
| Database queries per list | 2 | 1 |
| CPU usage | Baseline | -25-35% |
| Code duplication | 9 auth guards | 1 middleware |
| Test coverage | 85% | 85%+ |

---

## Next Steps

1. **Start with Phase 1** - Security fixes are highest priority
2. **Create feature branch** - `feat/presets-api-improvements`
3. **Implement incrementally** - Commit after each task
4. **Test continuously** - Run tests after each change
5. **Deploy to staging** - Verify in staging before production
