# Code Audit: xivdyetools-presets-api

**Version:** 1.1.0
**Date:** 2025-12-14
**Total Findings:** 15 (2 CRITICAL, 5 HIGH, 7 MEDIUM, 1 LOW)

---

## Summary Table

| ID | Title | Severity | Category | File |
|----|-------|----------|----------|------|
| PRESETS-SQL-001 | SQL Injection via Dynamic ORDER BY | CRITICAL | Security | preset-service.ts |
| PRESETS-SEC-001 | Bot Auth Header Spoofing | CRITICAL | Security | auth.ts |
| PRESETS-BUG-001 | Duplicate Detection Race Condition | HIGH | Bug | presets.ts |
| PRESETS-BUG-002 | Moderation Status Not Reset | HIGH | Bug | presets.ts |
| PRESETS-SEC-002 | HMAC Signature Replay Attack | HIGH | Security | auth.ts |
| PRESETS-BUG-003 | Missing Vote Deduplication on Edit | HIGH | Bug | presets.ts |
| PRESETS-SEC-003 | Moderator ID Parsing Fragile | HIGH | Security | auth.ts |
| PRESETS-PERF-001 | D1 Batch Transaction Overhead | MEDIUM | Performance | presets.ts |
| PRESETS-PERF-002 | Rate Limit Query on Every Submission | MEDIUM | Performance | presets.ts |
| PRESETS-PERF-003 | Large Response Pagination Default | MEDIUM | Performance | presets.ts |
| PRESETS-BUG-004 | Missing WHERE Clause Guard | MEDIUM | Bug | presets.ts |
| PRESETS-SEC-004 | Missing Content-Type Validation | MEDIUM | Security | presets.ts |
| PRESETS-SEC-005 | Profanity Filter ReDoS Risk | MEDIUM | Security | moderation-service.ts |
| PRESETS-REF-001 | Repeated Validation Logic | MEDIUM | Refactoring | presets.ts |
| PRESETS-REF-002 | Service Binding Notification Fire-and-Forget | LOW | Reliability | presets.ts |

---

## CRITICAL Findings

### PRESETS-SQL-001: SQL Injection via Dynamic ORDER BY

**Severity:** CRITICAL
**Category:** Security

**Location:**
- **File:** `src/services/preset-service.ts`
- **Lines:** 116-122 (also 98-109 for ORDER BY construction)
- **Function:** `listPresets()`

**Description:**
While `.bind()` is correctly used for parameterized values, the ORDER BY clause is built via string concatenation. If the `sort` parameter comes from user input without validation, SQL injection is possible.

**Evidence:**
```typescript
// Lines 98-109: Dynamic ORDER BY construction
let orderClause = '';
switch (options.sort) {
  case 'newest':
    orderClause = 'ORDER BY created_at DESC';
    break;
  case 'popular':
    orderClause = 'ORDER BY vote_count DESC';
    break;
  default:
    orderClause = `ORDER BY ${options.sort}`;  // DANGER: Unsanitized!
}

// Line 116-122: Query execution
const query = `SELECT * FROM presets ${whereClause} ${orderClause}`;
return await db.prepare(query).bind(...bindings).all();
```

**Attack Example:**
```
GET /api/v1/presets?sort=vote_count;DROP TABLE presets;--
```

**Impact:**
- Full database compromise
- Data exfiltration
- Data modification/deletion
- Potential for persistent backdoors

**Recommendation:**
```typescript
// Whitelist valid sort options
const VALID_SORT_OPTIONS = ['newest', 'popular', 'oldest', 'name'] as const;
type SortOption = typeof VALID_SORT_OPTIONS[number];

const SORT_TO_SQL: Record<SortOption, string> = {
  newest: 'created_at DESC',
  popular: 'vote_count DESC',
  oldest: 'created_at ASC',
  name: 'name ASC'
};

function buildOrderClause(sort: string): string {
  if (!VALID_SORT_OPTIONS.includes(sort as SortOption)) {
    return SORT_TO_SQL.newest;  // Default to safe option
  }
  return SORT_TO_SQL[sort as SortOption];
}
```

**Effort:** Low (15 minutes)

---

### PRESETS-SEC-001: Bot Auth Header Spoofing

**Severity:** CRITICAL
**Category:** Security

**Location:**
- **File:** `src/middleware/auth.ts`
- **Lines:** 203-248
- **Function:** Bot authentication fallback

**Description:**
If `BOT_SIGNING_SECRET` is not configured, bot authentication falls back to trusting `X-User-Discord-ID` header without verification. An attacker knowing the `BOT_API_SECRET` can impersonate any user.

**Evidence:**
```typescript
// Lines 238-248: Legacy mode without signature verification
if (!env.BOT_SIGNING_SECRET) {
  console.warn('BOT_SIGNING_SECRET not configured, using legacy mode');
  // Trusts X-User-Discord-ID header directly!
  const userId = request.headers.get('X-User-Discord-ID');
  if (userId) {
    return {
      authenticated: true,
      userId: userId,  // Attacker-controlled!
      method: 'bot-legacy'
    };
  }
}
```

**Impact:**
- Complete account takeover for any user
- Create/modify/delete presets as any user
- Vote manipulation
- Moderation bypass

**Recommendation:**
```typescript
// Remove legacy mode entirely
if (!env.BOT_SIGNING_SECRET) {
  console.error('CRITICAL: BOT_SIGNING_SECRET not configured');
  return {
    authenticated: false,
    error: 'Bot authentication not properly configured'
  };
}

// Always require HMAC signature
const signature = request.headers.get('X-Signature');
const timestamp = request.headers.get('X-Timestamp');
if (!verifyBotSignature(signature, timestamp, userId, env.BOT_SIGNING_SECRET)) {
  return { authenticated: false, error: 'Invalid signature' };
}
```

**Effort:** Low (30 minutes)

---

## HIGH Findings

### PRESETS-BUG-001: Duplicate Detection Race Condition

**Severity:** HIGH
**Category:** Bug

**Location:**
- **File:** `src/handlers/presets.ts`
- **Lines:** 375-386 (duplicate check), 399 (create)
- **Function:** `createPreset()`

**Description:**
Duplicate check followed by create is not atomic. Between check and insert, another user could create same dyes, then both users get "added vote to existing" response but duplicate presets are created.

**Evidence:**
```typescript
// Line 376: Check for existing
const existing = await presetService.findByDyeSignature(signature);

// Line 399: Create if not found (not atomic with check!)
if (!existing) {
  const newPreset = await presetService.create(presetData);
}

// Race: User A checks -> User B checks -> User A creates -> User B creates
// Result: Two presets with same dye_signature
```

**Impact:**
- Duplicate presets in database
- Vote splitting across duplicates
- Confusing user experience

**Recommendation:**
```typescript
// Option 1: Use UNIQUE constraint and handle violation
try {
  const newPreset = await presetService.create(presetData);
} catch (error) {
  if (error.code === 'UNIQUE_VIOLATION') {
    // Another request created it first, find and vote
    const existing = await presetService.findByDyeSignature(signature);
    await voteService.addVote(existing.id, userId);
    return jsonResponse({ preset: existing, voted: true });
  }
  throw error;
}

// Option 2: Use D1 transaction with isolation
await db.batch([
  db.prepare('INSERT INTO presets ... ON CONFLICT(dye_signature) DO NOTHING'),
  db.prepare('INSERT INTO votes ...')
]);
```

**Effort:** Medium (1-2 hours)

---

### PRESETS-BUG-002: Moderation Status Not Reset on Edit

**Severity:** HIGH
**Category:** Bug

**Location:**
- **File:** `src/handlers/presets.ts`
- **Lines:** 251-308
- **Function:** `updatePreset()`

**Description:**
When editing a preset, if name/description passes moderation check, `moderationStatus` is conditionally set. But the logic `moderationStatus === 'pending' ? 'pending' : undefined` means flagged presets remain pending forever even after fixing content.

**Evidence:**
```typescript
// Line 252: Moderation check
const moderationResult = await moderationService.check(name, description);

// Line 284: Conditional status (problematic)
const updateData = {
  ...changes,
  moderationStatus: moderationResult.flagged ? 'pending' : undefined
  // If previously pending and now passes: stays pending!
};

// Should be:
moderationStatus: moderationResult.flagged ? 'pending' : 'approved'
```

**Impact:**
- Users can never get presets un-flagged through editing
- Moderation queue fills with false positives
- Frustrated users who fixed their content

**Recommendation:**
```typescript
moderationStatus: moderationResult.flagged ? 'pending' : 'approved'
```

**Effort:** Low (10 minutes)

---

### PRESETS-SEC-002: HMAC Signature Replay Attack

**Severity:** HIGH
**Category:** Security

**Location:**
- **File:** `src/middleware/auth.ts`
- **Lines:** 33-37
- **Function:** `verifyBotSignature()`

**Description:**
Timestamp validation allows 5-minute skew, but doesn't track used signatures. The same (timestamp, signature) combination can be replayed infinite times within the window.

**Evidence:**
```typescript
// Lines 33-37: Timestamp validation
const now = Math.floor(Date.now() / 1000);
if (Math.abs(now - timestamp) > 300) {  // 5 minute window
  return false;
}
// No nonce or signature tracking!
```

**Impact:**
- Request replay attacks within 5-minute window
- Duplicate actions (votes, submissions)
- Potential for abuse amplification

**Recommendation:**
```typescript
// Track used signatures in KV
async function verifyBotSignature(
  signature: string,
  timestamp: number,
  ...
): Promise<boolean> {
  // Time validation
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    return false;
  }

  // Replay protection
  const signatureKey = `sig:${signature}`;
  if (await env.KV.get(signatureKey)) {
    return false;  // Already used
  }
  await env.KV.put(signatureKey, '1', { expirationTtl: 600 });

  // Verify HMAC
  return await verifyHMAC(signature, timestamp, ...);
}
```

**Effort:** Medium (1 hour)

---

### PRESETS-BUG-003: Missing Vote Deduplication on Edit

**Severity:** HIGH
**Category:** Bug

**Location:**
- **File:** `src/handlers/presets.ts`
- **Lines:** 232-249
- **Function:** `updatePreset()`

**Description:**
Auto-vote is added on creation (line 408) but if user edits dyes, behavior is asymmetric with submit. No tracking of whether vote was from original creation.

**Evidence:**
```typescript
// On creation (line 408):
await voteService.addVote(newPreset.id, userId);  // Auto-vote

// On edit (lines 232-249):
// No vote logic at all
// If dyes changed significantly, should vote be reset?
```

**Impact:**
- Inconsistent vote semantics
- Users confused about their votes
- Potential for vote gaming via edit

**Recommendation:**
Document this behavior explicitly or implement consistent vote tracking:
```typescript
// Option 1: Document that editing preserves original vote
// Option 2: Track vote source
await voteService.addVote(presetId, userId, { source: 'creation' });
// On edit: don't touch votes
// On manual vote: source: 'manual'
```

**Effort:** Low (documentation) or Medium (implementation)

---

### PRESETS-SEC-003: Moderator ID Parsing Fragile

**Severity:** HIGH
**Category:** Security

**Location:**
- **File:** `src/middleware/auth.ts`
- **Lines:** 168-171
- **Function:** `isModeratorId()`

**Description:**
`MODERATOR_IDS.split(',').map((id) => id.trim())` assumes comma-separated string. Extra whitespace, newlines, or formatting issues break parsing.

**Evidence:**
```typescript
// Lines 168-171
const moderatorIds = (env.MODERATOR_IDS || '').split(',').map((id) => id.trim());
return moderatorIds.includes(userId);

// Problematic inputs:
// "123, 456" -> ["123", "456"] ✓
// "123,\n456" -> ["123", "\n456"] ✗ (newline not trimmed from middle)
// "123 456" -> ["123 456"] ✗ (space not a separator)
```

**Impact:**
- Legitimate moderators denied access
- Inconsistent moderation capabilities
- Hard-to-debug permission issues

**Recommendation:**
```typescript
const moderatorIds = (env.MODERATOR_IDS || '')
  .split(/[\s,]+/)  // Split on whitespace or comma
  .filter(Boolean)   // Remove empty strings
  .map(id => id.trim());

return moderatorIds.includes(userId);
```

**Effort:** Low (10 minutes)

---

## MEDIUM Findings

### PRESETS-PERF-001: D1 Batch Transaction Overhead

**Severity:** MEDIUM
**Category:** Performance

**Location:**
- **File:** `src/handlers/presets.ts`
- **Lines:** 177-179
- **Function:** `deletePreset()`

**Description:**
Delete operation uses `.batch([query1, query2])` for 2 queries. D1 batch has ~50ms overhead per batch, potentially slower than sequential for simple operations.

**Impact:**
- Minor added latency on delete
- ~50-100ms slower than necessary

**Recommendation:**
Benchmark D1 batch vs sequential. Consider CASCADE DELETE in schema if supported.

**Effort:** Low (30 minutes to benchmark)

---

### PRESETS-PERF-002: Rate Limit Query on Every Submission

**Severity:** MEDIUM
**Category:** Performance

**Location:**
- **File:** `src/handlers/presets.ts`
- **Lines:** 347-359
- **Function:** `checkSubmissionRateLimit()`

**Description:**
`COUNT(*)` query runs even if user is known to be over limit from previous request in same session.

**Impact:**
- Unnecessary database queries
- Added latency for repeat violators

**Recommendation:**
Cache rate limit results in memory or KV for 1 minute:
```typescript
const cacheKey = `ratelimit:${userId}`;
const cached = await env.KV.get(cacheKey);
if (cached === 'blocked') {
  return { allowed: false };
}
```

**Effort:** Low (30 minutes)

---

### PRESETS-PERF-003: Large Response Pagination Default

**Severity:** MEDIUM
**Category:** Performance

**Location:**
- **File:** `src/handlers/presets.ts`
- **Lines:** 37-51
- **Function:** Query parameter parsing

**Description:**
Default limit is 20, but client can request up to 100 (line 46). Large responses serialize significant JSON.

**Impact:**
- Bandwidth waste for large responses
- Slow response times for max pagination

**Recommendation:**
Lower cap to 50, or implement response compression.

**Effort:** Low (10 minutes)

---

### PRESETS-BUG-004: Missing WHERE Clause Guard

**Severity:** MEDIUM
**Category:** Bug

**Location:**
- **File:** `src/handlers/presets.ts`
- **Lines:** 131-137
- **Function:** `refreshAuthor()`

**Description:**
`PATCH /refresh-author` updates presets by user, but if `auth.userDiscordId` is undefined (shouldn't happen, but defensive coding), WHERE clause becomes problematic.

**Evidence:**
```typescript
.bind(auth.userName, auth.userDiscordId)
// Query: "SET author_name = ? WHERE author_discord_id = ?"
// If userDiscordId is undefined: WHERE author_discord_id = NULL
// (probably matches nothing, but behavior is undefined)
```

**Impact:**
- Edge case could cause unexpected behavior
- No explicit null guard

**Recommendation:**
```typescript
if (!auth.userDiscordId) {
  return jsonResponse({ error: 'User ID required' }, 400);
}
```

**Effort:** Low (5 minutes)

---

### PRESETS-SEC-004: Missing Content-Type Validation

**Severity:** MEDIUM
**Category:** Security

**Location:**
- **File:** `src/handlers/presets.ts`
- **Lines:** 361-367, 212-218
- **Function:** POST and PATCH handlers

**Description:**
Endpoints parse JSON with `c.req.json()` but don't validate Content-Type header. Could allow JSON smuggling attacks.

**Impact:**
- Potential for content-type confusion attacks
- Non-standard API behavior

**Recommendation:**
```typescript
// Add middleware to validate Content-Type
app.use('/api/v1/presets/*', async (c, next) => {
  if (['POST', 'PATCH', 'PUT'].includes(c.req.method)) {
    const contentType = c.req.header('content-type');
    if (!contentType?.includes('application/json')) {
      return c.json({ error: 'Content-Type must be application/json' }, 415);
    }
  }
  await next();
});
```

**Effort:** Low (15 minutes)

---

### PRESETS-SEC-005: Profanity Filter ReDoS Risk

**Severity:** MEDIUM
**Category:** Security

**Location:**
- **File:** `src/services/moderation-service.ts`
- **Lines:** 27-40
- **Function:** `checkProfanity()`

**Description:**
Word patterns use `\b${escapeRegex(word)}\b` for each word. With large profanity lists and special character-heavy input, regex matching could hang (ReDoS).

**Evidence:**
```typescript
// Line 27-40: Dynamic regex construction
const patterns = profanityWords.map(word =>
  new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi')
);

// Each pattern tested separately
for (const pattern of patterns) {
  if (pattern.test(text)) {  // ReDoS potential
    return { flagged: true };
  }
}
```

**Impact:**
- DoS via malicious preset names
- Worker timeout on pathological input

**Recommendation:**
```typescript
// Use simple substring matching instead
function checkProfanity(text: string): boolean {
  const normalized = text.toLowerCase();
  return profanityWords.some(word =>
    normalized.includes(word.toLowerCase())
  );
}

// Reserve regex complexity for Perspective API
```

**Effort:** Low (30 minutes)

---

### PRESETS-REF-001: Repeated Validation Logic

**Severity:** MEDIUM
**Category:** Refactoring

**Location:**
- **File:** `src/handlers/presets.ts`
- **Lines:** 447-527
- **Functions:** `validateSubmission()`, `validateEditRequest()`

**Description:**
The two validation functions have nearly identical logic duplicated.

**Impact:**
- Maintenance burden
- Potential for validation drift

**Recommendation:**
Merge into single function with optional field checking.

**Effort:** Low (30 minutes)

---

### PRESETS-REF-002: Service Binding Notification Fire-and-Forget

**Severity:** LOW
**Category:** Reliability

**Location:**
- **File:** `src/handlers/presets.ts`
- **Lines:** 412-427, 292-308
- **Function:** `notifyDiscordBot()`

**Description:**
Notification errors are caught but don't fail the request. If Discord worker is down, user never knows.

**Impact:**
- Silent notification failures
- Inconsistent Discord bot behavior

**Recommendation:**
Log failures prominently or add optional webhook fallback.

**Effort:** Low (15 minutes)

---

## Recommendations Summary

### Immediate (Day 1)
1. Fix SQL injection in ORDER BY (PRESETS-SQL-001)
2. Make BOT_SIGNING_SECRET mandatory (PRESETS-SEC-001)
3. Fix moderator ID parsing (PRESETS-SEC-003)

### This Sprint
4. Add atomic duplicate detection (PRESETS-BUG-001)
5. Fix moderation status reset (PRESETS-BUG-002)
6. Add signature replay protection (PRESETS-SEC-002)
7. Add Content-Type validation (PRESETS-SEC-004)

### Next Sprint
8. Document or fix vote behavior on edit (PRESETS-BUG-003)
9. Add WHERE clause guard (PRESETS-BUG-004)
10. Simplify profanity filter (PRESETS-SEC-005)
11. Cache rate limit results (PRESETS-PERF-002)

### Backlog
12. Benchmark D1 batch operations (PRESETS-PERF-001)
13. Lower pagination cap (PRESETS-PERF-003)
14. Merge validation functions (PRESETS-REF-001)
15. Improve notification error handling (PRESETS-REF-002)
