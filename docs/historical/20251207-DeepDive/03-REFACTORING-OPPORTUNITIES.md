# Refactoring Opportunities: xivdyetools-presets-api

**Date:** December 7, 2025
**Focus Areas:** Code Duplication, Type Safety, Error Handling, Organization

---

## Summary

| Category | Issues | Priority | Effort |
|----------|--------|----------|--------|
| Code Duplication | 4 | HIGH | Medium |
| Type Safety | 3 | MEDIUM | Medium |
| Error Handling | 3 | MEDIUM | Low |
| Code Organization | 4 | LOW | Medium |

---

## 1. Code Duplication

### 1.1 Repeated Authentication Guard Pattern

**Files:**
- `src/handlers/presets.ts` (Lines 73-74, 96-100, 121-125, 155-159, 191-195, 338-342)
- `src/handlers/votes.ts` (Lines 153-157, 187-191, 216-220)

**Occurrences:** 9 times

**Current Pattern:**
```typescript
// Repeated in every authenticated endpoint
const authError = requireAuth(c);
if (authError) return authError;

const userError = requireUserContext(c);
if (userError) return userError;
```

**Problem:** Changes to auth flow require updates in 9 locations

**Refactoring:**

Create middleware factory:
```typescript
// src/middleware/guards.ts
import { Context, Next } from 'hono';
import { requireAuth, requireUserContext } from './auth.js';

export function requireAuthAndUser() {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const authError = requireAuth(c);
    if (authError) return authError;

    const userError = requireUserContext(c);
    if (userError) return userError;

    await next();
  };
}

// For moderator routes
export function requireModeratorAccess() {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const authError = requireAuth(c);
    if (authError) return authError;

    const modError = requireModerator(c);
    if (modError) return modError;

    await next();
  };
}
```

**Usage:**
```typescript
// Before
presetsRouter.post('/', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const userError = requireUserContext(c);
  if (userError) return userError;
  // ... handler logic
});

// After
presetsRouter.post('/', requireAuthAndUser(), async (c) => {
  // ... handler logic (auth already validated)
});
```

---

### 1.2 Repeated Preset Existence Check

**Files:**
- `src/handlers/presets.ts` (Lines 166-169)
- `src/handlers/votes.ts` (Lines 164-170, 198-204)

**Current Pattern:**
```typescript
const preset = await c.env.DB.prepare('SELECT id FROM presets WHERE id = ?')
  .bind(presetId)
  .first();

if (!preset) {
  return c.json({ error: 'Not Found', message: 'Preset not found' }, 404);
}
```

**Refactoring:**

Create helper function:
```typescript
// src/services/preset-service.ts
export async function getPresetOrThrow(
  db: D1Database,
  id: string
): Promise<CommunityPreset> {
  const preset = await getPresetById(db, id);
  if (!preset) {
    throw new HTTPException(404, { message: 'Preset not found' });
  }
  return preset;
}
```

Or create middleware:
```typescript
// src/middleware/preset-loader.ts
export function loadPreset(paramName = 'id') {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const id = c.req.param(paramName);
    const preset = await getPresetById(c.env.DB, id);

    if (!preset) {
      return c.json({ error: 'Not Found', message: 'Preset not found' }, 404);
    }

    c.set('preset', preset);
    await next();
  };
}

// Usage
presetsRouter.patch('/:id', requireAuthAndUser(), loadPreset(), async (c) => {
  const preset = c.get('preset'); // Already loaded and validated
  // ... handler logic
});
```

---

### 1.3 Repeated Category Row Transformation

**File:** `src/handlers/categories.ts` (Lines 40-48, 83-91)

**Current Pattern:**
```typescript
const categories: CategoryMeta[] = (result.results || []).map((row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  icon: row.icon,
  is_curated: row.is_curated === 1,
  display_order: row.display_order,
  preset_count: row.preset_count || 0,
}));
```

**Refactoring:**

Extract transformer:
```typescript
// src/services/category-service.ts
export interface CategoryRow {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  is_curated: number;
  display_order: number;
  preset_count?: number;
}

export function rowToCategory(row: CategoryRow): CategoryMeta {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    is_curated: row.is_curated === 1,
    display_order: row.display_order,
    preset_count: row.preset_count || 0,
  };
}

export function rowsToCategories(rows: CategoryRow[]): CategoryMeta[] {
  return rows.map(rowToCategory);
}
```

---

### 1.4 Repeated Moderation Action Logging

**File:** `src/handlers/moderation.ts` (Lines 73-78, 147-152)

**Current Pattern:**
```typescript
const logId = crypto.randomUUID();
const now = new Date().toISOString();

await c.env.DB.prepare(
  `INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, reason, created_at)
   VALUES (?, ?, ?, ?, ?, ?)`
)
  .bind(logId, presetId, auth.userDiscordId!, action, body.reason || null, now)
  .run();
```

**Refactoring:**

Create service function:
```typescript
// src/services/moderation-service.ts
export type ModerationAction = 'approve' | 'reject' | 'flag' | 'unflag' | 'revert';

export async function logModerationAction(
  db: D1Database,
  presetId: string,
  moderatorId: string,
  action: ModerationAction,
  reason?: string
): Promise<void> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, presetId, moderatorId, action, reason || null, now).run();
}

// Usage
await logModerationAction(c.env.DB, presetId, auth.userDiscordId!, 'approve', body.reason);
```

---

## 2. Type Safety Issues

### 2.1 Unsafe Type Assertions on Query Parameters

**File:** `src/handlers/presets.ts` (Lines 37-48)

**Current Code:**
```typescript
const filters: PresetFilters = {
  category: category as PresetFilters['category'],  // Unsafe!
  search,
  status: status as PresetFilters['status'],         // Unsafe!
  sort: sort as PresetFilters['sort'],               // Unsafe!
  page: page ? parseInt(page, 10) : undefined,
  limit: limit ? Math.min(parseInt(limit, 10), 100) : undefined,
  is_curated: is_curated === 'true' ? true : is_curated === 'false' ? false : undefined,
};
```

**Problem:** Type assertions bypass TypeScript's type checking. Invalid values pass through silently.

**Refactoring:**

Create validation utilities:
```typescript
// src/utils/validators.ts
export type PresetCategory = 'jobs' | 'grand-companies' | 'seasons' | 'events' | 'aesthetics' | 'community';
export type PresetStatus = 'pending' | 'approved' | 'rejected' | 'flagged';
export type PresetSort = 'popular' | 'newest' | 'oldest';

const VALID_CATEGORIES: PresetCategory[] = ['jobs', 'grand-companies', 'seasons', 'events', 'aesthetics', 'community'];
const VALID_STATUSES: PresetStatus[] = ['pending', 'approved', 'rejected', 'flagged'];
const VALID_SORTS: PresetSort[] = ['popular', 'newest', 'oldest'];

export function validateCategory(value: unknown): PresetCategory | undefined {
  if (!value) return undefined;
  return VALID_CATEGORIES.includes(value as PresetCategory)
    ? (value as PresetCategory)
    : undefined;
}

export function validateStatus(value: unknown): PresetStatus | undefined {
  if (!value) return undefined;
  return VALID_STATUSES.includes(value as PresetStatus)
    ? (value as PresetStatus)
    : undefined;
}

export function validateSort(value: unknown): PresetSort | undefined {
  if (!value) return undefined;
  return VALID_SORTS.includes(value as PresetSort)
    ? (value as PresetSort)
    : undefined;
}

export function validatePagination(page?: string, limit?: string): { page: number; limit: number } {
  const p = page ? Math.max(1, parseInt(page, 10)) : 1;
  const l = limit ? Math.max(1, Math.min(parseInt(limit, 10), 100)) : 20;

  if (isNaN(p) || isNaN(l)) {
    throw new Error('Invalid pagination parameters');
  }

  return { page: p, limit: l };
}
```

**Usage:**
```typescript
const filters: PresetFilters = {
  category: validateCategory(category),
  search,
  status: validateStatus(status),
  sort: validateSort(sort),
  ...validatePagination(page, limit),
  is_curated: is_curated === 'true' ? true : is_curated === 'false' ? false : undefined,
};
```

---

### 2.2 Missing Explicit Error Types in Catch Blocks

**Files:** Multiple handlers

**Current Pattern:**
```typescript
try {
  body = await c.req.json<PresetEditRequest>();
} catch {
  return c.json({ error: 'Bad Request', message: 'Invalid JSON body' }, 400);
}
```

**Problem:** Error is not typed, can't distinguish between error types

**Refactoring:**
```typescript
try {
  body = await c.req.json<PresetEditRequest>();
} catch (error) {
  if (error instanceof SyntaxError) {
    return c.json({ error: 'Bad Request', message: 'Invalid JSON syntax' }, 400);
  }
  if (error instanceof TypeError) {
    return c.json({ error: 'Bad Request', message: 'Invalid request body' }, 400);
  }
  throw error; // Re-throw unexpected errors
}
```

---

### 2.3 Non-Null Assertions on Auth Context

**Files:** Multiple handlers

**Current Pattern:**
```typescript
auth.userDiscordId!  // Used 15+ times
auth.userName!       // Used 5+ times
```

**Problem:** Non-null assertions bypass TypeScript safety

**Refactoring:**

Create type guard:
```typescript
// src/middleware/auth.ts
export interface AuthenticatedContext {
  isAuthenticated: true;
  isModerator: boolean;
  userDiscordId: string;
  userName: string;
  authSource: 'bot' | 'web';
}

export function assertAuthenticated(auth: AuthContext): asserts auth is AuthenticatedContext {
  if (!auth.isAuthenticated || !auth.userDiscordId) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
}

// Usage
const auth = c.get('auth');
assertAuthenticated(auth);
// Now TypeScript knows auth.userDiscordId is string
const userId = auth.userDiscordId; // No assertion needed
```

---

## 3. Error Handling

### 3.1 Inconsistent Logging Methods

**Files:** Various

**Current Mix:**
```typescript
console.error('Unhandled error:', err);              // index.ts:109
console.error('Perspective API error:', ...);        // moderation-service.ts:96
console.log('Discord worker binding not configured'); // presets.ts:559
console.error('Failed to send webhook:', error);     // moderation-service.ts:220
```

**Problem:** No structured format, mixed log levels

**Refactoring:**

Create logger utility:
```typescript
// src/utils/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };

  const output = JSON.stringify(entry);

  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
};

// Usage
logger.error('Perspective API error', { status: response.status, body: text });
logger.info('Discord notification skipped', { reason: 'binding not configured' });
```

---

### 3.2 Silent Failures in Notification Service

**File:** `src/services/moderation-service.ts` (Lines 212-259)

**Current Pattern:**
```typescript
try {
  await fetch(env.MODERATION_WEBHOOK_URL, { ... });
} catch (error) {
  console.error('Failed to send webhook notification:', error);
  // Silently continues - no retry, no monitoring
}
```

**Problem:**
- No retry logic for transient failures
- Notifications fail silently
- No visibility into failure rates

**Refactoring:**
```typescript
// src/utils/fetch-with-retry.ts
export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const { maxRetries = 3, baseDelay = 100, onRetry } = retryOptions;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      // Don't retry 4xx errors
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`);
      }
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      onRetry?.(attempt + 1, error as Error);
    }

    // Exponential backoff
    await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
  }

  throw new Error('Max retries exceeded');
}

// Usage in moderation-service.ts
try {
  await fetchWithRetry(env.MODERATION_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  }, {
    maxRetries: 3,
    onRetry: (attempt) => logger.warn('Webhook retry', { attempt, url: env.MODERATION_WEBHOOK_URL }),
  });
} catch (error) {
  logger.error('Webhook notification failed after retries', { error: String(error) });
}
```

---

### 3.3 Missing Error Context in Vote Operations

**File:** `src/handlers/votes.ts` (Lines 71-78, 133-141)

**Current Pattern:**
```typescript
} catch (error) {
  console.error('Failed to add vote:', error);
  return {
    success: false,
    new_vote_count: 0,
    error: 'Failed to add vote',  // Generic message
  };
}
```

**Problem:** Error details lost, debugging difficult

**Refactoring:**
```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorName = error instanceof Error ? error.name : 'Error';

  logger.error('Vote operation failed', {
    operation: 'addVote',
    presetId,
    userId: userDiscordId,
    errorName,
    errorMessage,
  });

  return {
    success: false,
    new_vote_count: 0,
    error: 'Failed to add vote',
    // Include details in development
    ...(env.ENVIRONMENT === 'development' && { details: errorMessage }),
  };
}
```

---

## 4. Code Organization

### 4.1 Large types.ts File

**File:** `src/types.ts` (~250 lines)

**Current Structure:** All types in one file

**Refactoring:**

Split into focused modules:
```
src/types/
├── index.ts           # Re-exports all
├── cloudflare.ts      # Env, D1 bindings
├── auth.ts            # AuthContext, AuthSource
├── domain.ts          # CommunityPreset, CategoryMeta
├── requests.ts        # PresetSubmission, PresetEditRequest
├── responses.ts       # PresetListResponse, VoteResult
└── filters.ts         # PresetFilters, PresetStatus
```

**Example splits:**

```typescript
// src/types/auth.ts
export type AuthSource = 'none' | 'bot' | 'web';

export interface AuthContext {
  isAuthenticated: boolean;
  isModerator: boolean;
  userDiscordId?: string;
  userName?: string;
  authSource: AuthSource;
}

// src/types/domain.ts
export interface CommunityPreset {
  id: string;
  name: string;
  description: string;
  category_id: string;
  dyes: number[];
  tags: string[];
  // ...
}

// src/types/index.ts
export * from './auth.js';
export * from './cloudflare.js';
export * from './domain.js';
export * from './requests.js';
export * from './responses.js';
export * from './filters.js';
```

---

### 4.2 Rate Limiting Should Be Middleware

**File:** `src/handlers/presets.ts` (Line 348)

**Current Pattern:**
```typescript
// Inside handler
const rateLimit = await checkSubmissionRateLimit(c.env.DB, auth.userDiscordId!);
if (!rateLimit.allowed) {
  return c.json({
    error: 'Rate Limit Exceeded',
    message: `You've reached the daily limit of ${rateLimit.limit} submissions`,
    reset_at: rateLimit.resetAt,
  }, 429);
}
```

**Refactoring:**

Extract to middleware:
```typescript
// src/middleware/rate-limit.ts
export interface RateLimitConfig {
  limit: number;
  window: 'day' | 'hour' | 'minute';
  keyPrefix: string;
}

export function rateLimit(config: RateLimitConfig) {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const auth = c.get('auth');
    if (!auth.userDiscordId) {
      await next();
      return;
    }

    const result = await checkRateLimit(
      c.env.DB,
      `${config.keyPrefix}:${auth.userDiscordId}`,
      config.limit,
      config.window
    );

    if (!result.allowed) {
      c.header('X-RateLimit-Limit', String(config.limit));
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', result.resetAt!);

      return c.json({
        error: 'Rate Limit Exceeded',
        message: `Rate limit of ${config.limit} per ${config.window} exceeded`,
        reset_at: result.resetAt,
      }, 429);
    }

    c.header('X-RateLimit-Remaining', String(result.remaining));
    await next();
  };
}

// Usage
presetsRouter.post('/',
  requireAuthAndUser(),
  rateLimit({ limit: 10, window: 'day', keyPrefix: 'submit' }),
  async (c) => {
    // Handler logic without rate limit checks
  }
);
```

---

### 4.3 Unused rate_limits Table

**File:** `schema.sql` (Lines 104-112)

**Current State:**
```sql
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER DEFAULT 1,
  window_start TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
```

**Problem:** Table exists but rate limiting queries the presets table instead

**Options:**
1. **Remove the table** if not needed
2. **Implement proper rate limiting** using the table (recommended)

See Performance Optimization document for implementation details.

---

### 4.4 Create Category Service

**Current State:** Category logic scattered across handlers

**Refactoring:**

```typescript
// src/services/category-service.ts
import type { D1Database } from '@cloudflare/workers-types';
import type { CategoryMeta, CategoryRow } from '../types.js';

export function rowToCategory(row: CategoryRow): CategoryMeta {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    is_curated: row.is_curated === 1,
    display_order: row.display_order,
    preset_count: row.preset_count || 0,
  };
}

export async function getAllCategories(db: D1Database): Promise<CategoryMeta[]> {
  const result = await db.prepare(`
    SELECT c.*, COUNT(CASE WHEN p.status = 'approved' THEN 1 END) as preset_count
    FROM categories c
    LEFT JOIN presets p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.display_order
  `).all();

  return (result.results || []).map(rowToCategory);
}

export async function getCategoryById(
  db: D1Database,
  id: string
): Promise<CategoryMeta | null> {
  const result = await db.prepare(`
    SELECT c.*, COUNT(CASE WHEN p.status = 'approved' THEN 1 END) as preset_count
    FROM categories c
    LEFT JOIN presets p ON p.category_id = c.id
    WHERE c.id = ?
    GROUP BY c.id
  `).bind(id).first();

  return result ? rowToCategory(result) : null;
}

export async function createCategory(
  db: D1Database,
  category: Omit<CategoryMeta, 'preset_count'>
): Promise<CategoryMeta> {
  await db.prepare(`
    INSERT INTO categories (id, name, description, icon, is_curated, display_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    category.id,
    category.name,
    category.description,
    category.icon,
    category.is_curated ? 1 : 0,
    category.display_order
  ).run();

  return { ...category, preset_count: 0 };
}
```

---

## Summary Table

| Issue | Category | File(s) | Effort |
|-------|----------|---------|--------|
| Auth guard duplication | Duplication | presets.ts, votes.ts | 30 min |
| Preset existence check | Duplication | presets.ts, votes.ts | 20 min |
| Category transformation | Duplication | categories.ts | 15 min |
| Moderation log duplication | Duplication | moderation.ts | 15 min |
| Unsafe type assertions | Type Safety | presets.ts | 30 min |
| Missing error types | Type Safety | Multiple | 20 min |
| Non-null assertions | Type Safety | Multiple | 30 min |
| Inconsistent logging | Error Handling | Multiple | 45 min |
| Silent notification failures | Error Handling | moderation-service.ts | 30 min |
| Missing error context | Error Handling | votes.ts | 15 min |
| Large types.ts | Organization | types.ts | 45 min |
| Rate limit in handler | Organization | presets.ts | 30 min |
| Unused rate_limits table | Organization | schema.sql | 20 min |
| Missing category service | Organization | categories.ts | 30 min |

**Total Estimated Effort:** ~6.5 hours

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 hours)
1. Create auth guard middleware factory
2. Extract moderation log function
3. Create structured logger utility

### Phase 2: Type Safety (2-3 hours)
4. Create validation utilities for query params
5. Add type guards for auth context
6. Add explicit error types in catch blocks

### Phase 3: Organization (2-3 hours)
7. Split types.ts into modules
8. Create category service
9. Extract rate limiting to middleware

### Phase 4: Error Handling (1-2 hours)
10. Implement fetch with retry
11. Add error context to vote operations
12. Use structured logger throughout
