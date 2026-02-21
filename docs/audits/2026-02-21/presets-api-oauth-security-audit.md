# Security & Code Audit Report: presets-api + oauth

**Audit Date:** 2026-02-21  
**Scope:** `apps/presets-api/src/**/*.ts`, `apps/oauth/src/**/*.ts`  
**Auditor:** Deep-dive automated analysis  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Presets API Findings](#presets-api-findings)
   - [Security Vulnerabilities](#pa-security)
   - [Bugs](#pa-bugs)
   - [Refactoring Opportunities](#pa-refactoring)
   - [Optimization Opportunities](#pa-optimization)
3. [OAuth Worker Findings](#oauth-worker-findings)
   - [Security Vulnerabilities](#oa-security)
   - [Bugs](#oa-bugs)
   - [Refactoring Opportunities](#oa-refactoring)
   - [Optimization Opportunities](#oa-optimization)
4. [Cross-Cutting Concerns](#cross-cutting)
5. [Summary Matrix](#summary-matrix)

---

## Executive Summary

Both applications demonstrate strong security awareness — PKCE is used for OAuth, SQL queries use parameterized binding throughout, HMAC signatures protect bot authentication, and content-type validation prevents smuggling attacks. However, the audit identified **19 findings** across both apps, including:

- **2 Medium-severity security issues** (timing-unsafe HMAC comparison, inconsistent state expiration validation)
- **3 Medium-severity bugs** (hidden preset exposure, dye signature edge case, non-atomic vote/character operations)
- **8 Low-severity security observations** (production-visible localhost CORS, excessive logging, fail-open patterns)
- **6 Low-severity refactoring/optimization opportunities**

No critical (P0) vulnerabilities were found. SQL injection is not present — all queries use D1 parameterized binding. The PKCE OAuth flow is correctly implemented.

---

<a id="pa-security"></a>
## Presets API Findings

### Security Vulnerabilities

#### SEC-PA-001: Hidden/rejected presets accessible by ID via public endpoint
- **Severity:** Medium
- **Impact:** Information disclosure — moderated or banned content remains accessible
- **Location:** [preset-service.ts](apps/presets-api/src/services/preset-service.ts#L170-L177), [presets.ts](apps/presets-api/src/handlers/presets.ts#L297-L305)

**Description:** `getPresetById()` returns any preset regardless of status. The `GET /api/v1/presets/:id` endpoint has no status filter, meaning hidden, rejected, or flagged presets can be fetched by anyone who knows the UUID. In contrast, `getPresets()` and `getFeaturedPresets()` properly exclude hidden presets.

```typescript
// preset-service.ts — no status filter
export async function getPresetById(db: D1Database, id: string): Promise<CommunityPreset | null> {
  const query = 'SELECT * FROM presets WHERE id = ?';
  const row = await db.prepare(query).bind(id).first<PresetRow>();
  return row ? rowToPreset(row) : null;
}
```

**Suggested fix:** Add a status filter for public access, or add an `includeHidden` parameter:
```typescript
export async function getPresetById(
  db: D1Database,
  id: string,
  options?: { includeAllStatuses?: boolean }
): Promise<CommunityPreset | null> {
  const query = options?.includeAllStatuses
    ? 'SELECT * FROM presets WHERE id = ?'
    : "SELECT * FROM presets WHERE id = ? AND status NOT IN ('hidden', 'rejected')";
  const row = await db.prepare(query).bind(id).first<PresetRow>();
  return row ? rowToPreset(row) : null;
}
```
Internal calls (edit, delete, moderation) would pass `{ includeAllStatuses: true }`.

---

#### SEC-PA-002: CORS allows localhost origins unconditionally in production
- **Severity:** Low
- **Impact:** A malicious app running on the same server on port 5173 or 8787 could make authenticated cross-origin requests
- **Location:** [index.ts](apps/presets-api/src/index.ts#L105-L115)

**Description:** The `allowedDevOrigins` list is checked for every request regardless of `ENVIRONMENT`. Unlike the OAuth worker which gates localhost behind a development check, the presets API always allows `localhost:5173` and `localhost:8787`.

```typescript
// Checked unconditionally — no env guard
const allowedDevOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
];
if (allowedDevOrigins.includes(origin)) {
  return origin;
}
```

**Suggested fix:** Gate behind environment check:
```typescript
if (env.ENVIRONMENT === 'development' && allowedDevOrigins.includes(origin)) {
  return origin;
}
```

---

#### SEC-PA-003: Bot API secret compared with timing-unsafe `===`
- **Severity:** Low
- **Impact:** Theoretical timing side-channel on secret value (very difficult to exploit over network)
- **Location:** [auth.ts](apps/presets-api/src/middleware/auth.ts#L107)

**Description:** The bot API secret is compared using `===`:
```typescript
if (token === c.env.BOT_API_SECRET) {
```
While the HMAC signature (verified separately) provides strong authentication, the initial token comparison leaks timing information. Over a Cloudflare Worker network boundary, exploitation is extremely unlikely, but best practice is constant-time comparison.

**Suggested fix:** Use `crypto.subtle.timingSafeEqual` or compare via HMAC:
```typescript
const encoder = new TextEncoder();
const a = encoder.encode(token);
const b = encoder.encode(c.env.BOT_API_SECRET);
if (a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b)) {
```

---

#### SEC-PA-004: Ban check fails open on database errors
- **Severity:** Low
- **Impact:** If `banned_users` table is missing or DB is down, banned users can bypass the ban
- **Location:** [ban-check.ts](apps/presets-api/src/middleware/ban-check.ts#L83-L87)

**Description:** The ban check catch block logs the error but allows the request to continue:
```typescript
} catch (error) {
  // Log error but don't block the request if the check fails
  console.error('Ban check failed:', error);
}
```
This is an explicit design choice documented in the code. However, it means a database issue or missing table silently disables the ban system.

**Suggested fix:** Consider an `alertOnBanCheckFailure` mechanism (e.g., structured log with severity=critical) so monitoring systems can catch the degraded state. Or fail-closed in production:
```typescript
if (c.env.ENVIRONMENT === 'production') throw error;
```

---

#### SEC-PA-005: Ban check missing on DELETE preset endpoint
- **Severity:** Low
- **Impact:** A banned user can still delete their own presets
- **Location:** [presets.ts](apps/presets-api/src/handlers/presets.ts#L172-L200)

**Description:** The DELETE handler calls `requireAuth` and `requireUserContext` but not `requireNotBannedCheck`, unlike POST (submit) and PATCH (edit) which both ban-check. This may be intentional (allowing banned users to clean up their content), but is inconsistent.

**Suggested fix:** If intentional, add a comment. If not:
```typescript
presetsRouter.delete('/:id', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const userError = requireUserContext(c);
  if (userError) return userError;
  const banError = await requireNotBannedCheck(c); // Add this
  if (banError) return banError;
  // ...
```

---

### Bugs {#pa-bugs}

#### BUG-PA-001: `dye_signature` UNIQUE constraint causes 500 error for presets matching rejected/hidden duplicates
- **Severity:** Medium
- **Impact:** Users get a cryptic 500 error when submitting a preset with dyes matching a rejected/hidden preset
- **Location:** [preset-service.ts](apps/presets-api/src/services/preset-service.ts#L168-L176), [presets.ts](apps/presets-api/src/handlers/presets.ts#L368-L387)

**Description:** The `dye_signature` column has a UNIQUE constraint covering ALL statuses (schema.sql), but `findDuplicatePreset()` only checks `approved` and `pending` presets. Flow for a user submitting dyes that match a rejected preset:

1. `findDuplicatePreset()` → no match (rejected preset excluded)
2. `createPreset()` → INSERT fails with UNIQUE constraint violation
3. Error handler catches constraint error, re-calls `findDuplicatePreset()` → still no match
4. Error is re-thrown → **500 Internal Server Error**

```typescript
// Only checks approved/pending — misses rejected/hidden
const query = `SELECT * FROM presets WHERE dye_signature = ? AND status IN ('approved', 'pending') LIMIT 1`;
```

**Suggested fix:** Expand `findDuplicatePreset` to check all non-hidden statuses, or make the UNIQUE constraint partial (D1 may not support partial unique indexes). Alternatively, handle the constraint error specifically:
```typescript
if (isConstraintError && !existingPreset) {
  return c.json({
    success: false,
    error: ErrorCode.DUPLICATE_RESOURCE,
    message: 'This dye combination has been previously submitted',
  }, 409);
}
```

---

#### BUG-PA-002: Vote insert and count update are non-atomic
- **Severity:** Medium
- **Impact:** If the UPDATE fails after a successful INSERT, the `vote_count` on the preset becomes permanently desynchronized from the actual vote rows
- **Location:** [votes.ts](apps/presets-api/src/handlers/votes.ts#L37-L70)

**Description:** `addVote()` performs two separate operations:
1. `INSERT INTO votes ...` (succeeds)
2. `UPDATE presets SET vote_count = vote_count + 1 ...` (could fail)

Similarly, `removeVote()` does DELETE then UPDATE. These are not wrapped in `db.batch()`, so a failure between the two leaves inconsistent state.

```typescript
// Step 1: Insert vote (succeeds)
const insertResult = await db.prepare('INSERT INTO votes ...').bind(...).run();
// Step 2: Update count (could fail — vote exists but count not incremented)
const updateResult = await db.prepare('UPDATE presets SET vote_count = vote_count + 1 ...').bind(...).first();
```

**Suggested fix:** Use `db.batch()` for atomicity:
```typescript
const [insertResult, updateResult] = await db.batch([
  db.prepare('INSERT INTO votes (preset_id, user_discord_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
    .bind(presetId, userDiscordId, now),
  db.prepare('UPDATE presets SET vote_count = vote_count + 1, updated_at = ? WHERE id = ? RETURNING vote_count')
    .bind(now, presetId),
]);
// Check insertResult.meta.changes to determine if vote was new
```
Note: D1 `batch()` guarantees atomicity — all succeed or all fail.

---

#### BUG-PA-003: `removeVote` not ban-checked
- **Severity:** Low
- **Impact:** A banned user can remove their own votes
- **Location:** [votes.ts](apps/presets-api/src/handlers/votes.ts#L174-L190)

**Description:** The DELETE vote endpoint calls `requireAuth` and `requireUserContext` but not `requireNotBannedCheck`. The POST vote endpoint properly checks for bans. Removing votes is a lower-risk action (potentially intentional omission), but is inconsistent.

---

### Refactoring Opportunities {#pa-refactoring}

#### REF-PA-001: Notification payload construction duplicated between submit and edit
- **Severity:** Low
- **Location:** [presets.ts](apps/presets-api/src/handlers/presets.ts#L315-L330) and [presets.ts](apps/presets-api/src/handlers/presets.ts#L410-L420)

Both the submit and edit handlers construct nearly identical `PresetNotificationPayload` objects for `notifyDiscordBot()`. Extract a `buildNotificationPayload()` helper.

---

#### REF-PA-002: `PresetNotificationPayload` type should live in shared types
- **Severity:** Low
- **Location:** [presets.ts](apps/presets-api/src/handlers/presets.ts#L620-L640)

The notification payload interface is defined inline in the handler file. It describes an inter-worker API contract and should be in shared types for documentation and cross-worker type safety.

---

### Optimization Opportunities {#pa-optimization}

#### OPT-PA-001: `getPresetById` called twice during update flow
- **Severity:** Low
- **Location:** [presets.ts](apps/presets-api/src/handlers/presets.ts#L224), [preset-service.ts](apps/presets-api/src/services/preset-service.ts#L372)

During PATCH, `getPresetById` is called in the handler to check ownership, then `updatePreset()` calls `getPresetById` again to return the updated preset. The first call's result could be passed to `updatePreset` or a `RETURNING` clause could eliminate the second query.

---

<a id="oa-security"></a>
## OAuth Worker Findings

### Security Vulnerabilities

#### SEC-OA-001: State signature verified with non-constant-time string comparison
- **Severity:** Medium
- **Impact:** Theoretical timing side-channel allows byte-by-byte recovery of HMAC signature
- **Location:** [state-signing.ts](apps/oauth/src/utils/state-signing.ts#L68-L73)

**Description:** The `verifyState()` function recomputes the HMAC and compares using `!==`, which is not constant-time:

```typescript
const expectedSignature = await signJwtData(encodedState, secret);
if (providedSignature !== expectedSignature) {
  throw new Error('Invalid state signature');
}
```

In contrast, JWT verification in `jwt-service.ts` correctly uses `crypto.subtle.verify()` which is constant-time. This inconsistency creates a weaker security property for state parameters.

While exploiting this over a Cloudflare Worker network is extremely difficult, it violates the principle of least surprise and best practices.

**Suggested fix:** Use `crypto.subtle.verify()` for state signature verification, matching the JWT approach:
```typescript
export async function verifyState(signedState: string, secret: string, allowUnsigned = false): Promise<StateData> {
  const parts = signedState.split('.');
  if (parts.length === 2) {
    const [encodedState, providedSignature] = parts;
    // Use constant-time verify instead of string comparison
    const key = await getSigningKey(secret);
    const encoder = new TextEncoder();
    const sigBytes = base64UrlDecodeBytes(providedSignature);
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(encodedState));
    if (!isValid) throw new Error('Invalid state signature');
    const json = base64UrlDecode(encodedState);
    return JSON.parse(json) as StateData;
  }
  // ... rest unchanged
}
```

---

#### SEC-OA-002: Discord callback skips state expiration check when `exp` is falsy
- **Severity:** Medium
- **Impact:** During transition period, unsigned states without `exp` field never expire (replay indefinitely)
- **Location:** [callback.ts](apps/oauth/src/handlers/callback.ts#L81-L85)

**Description:** The Discord GET callback checks state expiration with a guard that silently passes when `exp` is falsy:

```typescript
// Discord callback — skips if exp is undefined/0
if (stateData.exp && stateData.exp < now) {
  // redirect with error
}
```

The XIVAuth callback correctly uses `validateStateExpiration()` which **throws** on missing `exp`:

```typescript
// XIVAuth callback — throws on missing exp
validateStateExpiration(stateData); // throws Error('State missing expiration timestamp')
```

During the transition period (`STATE_TRANSITION_PERIOD=true`), unsigned legacy states may lack `exp`. A Discord unsigned state without `exp` would never expire, enabling replay attacks. The XIVAuth path correctly rejects such states.

**Suggested fix:** Use `validateStateExpiration` in the Discord callback too:
```typescript
// Replace the manual check in callback.ts:
try {
  validateStateExpiration(stateData);
} catch (err) {
  const redirectUrl = new URL(`${c.env.FRONTEND_URL}/auth/callback`);
  redirectUrl.searchParams.set('error', err instanceof Error ? err.message : 'State expired');
  return c.redirect(redirectUrl.toString());
}
```

---

#### SEC-OA-003: `ALLOWED_REDIRECT_ORIGINS` includes localhost in production authorize flow
- **Severity:** Low
- **Impact:** Authorize endpoint accepts localhost `redirect_uri` values in production; mitigated by callback-level validation
- **Location:** [oauth.ts](apps/oauth/src/constants/oauth.ts#L7-L14), [authorize.ts](apps/oauth/src/handlers/authorize.ts#L75-L80), [xivauth.ts](apps/oauth/src/handlers/xivauth.ts#L97-L102)

**Description:** `ALLOWED_REDIRECT_ORIGINS` includes localhost entries unconditionally. Both authorize handlers spread this array into their allowlist without filtering by environment. The XIVAuth GET callback handler filters localhost for production, but the Discord GET callback doesn't use the shared constant at all (constructs its own list).

While the callback-level redirect validation provides a defense-in-depth layer, the authorize handlers accepting localhost redirect URIs in production creates an inconsistency.

**Suggested fix:** Either filter localhost from the shared constant in production, or split into `PROD_REDIRECT_ORIGINS` and `DEV_REDIRECT_ORIGINS`:
```typescript
export const PROD_REDIRECT_ORIGINS = ['https://xivdyetools.app', 'https://xivdyetools.projectgalatine.com'];
export const DEV_REDIRECT_ORIGINS = [...PROD_REDIRECT_ORIGINS, 'http://localhost:5173', ...];
```

---

#### SEC-OA-004: XIVAuth callback logs sensitive information in production
- **Severity:** Low
- **Impact:** Access token metadata, social identities, and user IDs written to Worker logs
- **Location:** [xivauth.ts](apps/oauth/src/handlers/xivauth.ts#L411-L425), [xivauth.ts](apps/oauth/src/handlers/xivauth.ts#L460-L465)

**Description:** Several `console.log()` calls in the success path are not gated behind an environment check:

```typescript
// Logged unconditionally, including in production:
console.log('XIVAuth token exchange successful:', {
  token_type: tokens.token_type,
  expires_in: tokens.expires_in,
  scope: tokens.scope,
  has_access_token: !!tokens.access_token,
  has_refresh_token: !!tokens.refresh_token,
});

console.log('XIVAuth user info received:', {
  id: xivauthUser.id,           // PII
  has_social_identities: ...,
  // ...
});
```

The error-path logging correctly distinguishes between environments, but success-path logging does not.

**Suggested fix:** Wrap in development check or remove:
```typescript
if (c.env.ENVIRONMENT === 'development') {
  console.log('XIVAuth token exchange successful:', { ... });
}
```

---

#### SEC-OA-005: No `iss` (issuer) claim validation on JWT verification
- **Severity:** Low
- **Impact:** A JWT signed with the same secret but for a different service would be accepted
- **Location:** [jwt-service.ts](apps/oauth/src/services/jwt-service.ts#L231-L252)

**Description:** `verifyJWT()` checks signature and expiration, but does not validate the `iss` claim matches the expected `WORKER_URL`. In a single-service deployment this is low risk, but if the JWT secret is shared across services, tokens from one could be used on another.

```typescript
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  // Checks: signature ✓, expiration ✓, issuer ✗
}
```

**Suggested fix:** Add optional issuer validation:
```typescript
if (payload.iss && expectedIssuer && payload.iss !== expectedIssuer) {
  throw new Error('JWT issuer mismatch');
}
```

---

#### SEC-OA-006: Rate limiter fails open on DO errors
- **Severity:** Low
- **Impact:** If Durable Object is unreachable, rate limiting is disabled; explicitly documented
- **Location:** [rate-limit-do.ts](apps/oauth/src/services/rate-limit-do.ts#L90-L95), [rate-limit-do.ts](apps/oauth/src/services/rate-limit-do.ts#L103-L108)

**Description:** Both DO error paths return `allowed: true`. This is an explicit availability-over-consistency design choice, but it means a DO outage effectively disables rate limiting for all auth endpoints.

The in-memory fallback (`rate-limit.ts`) does not have this issue since it's always in-process.

**Suggested fix:** Consider logging these events at `error` severity so monitoring can detect a degraded rate limiting state. No code change needed if the risk is accepted.

---

### Bugs {#oa-bugs}

#### BUG-OA-001: `storeCharacters` deletes then inserts without atomicity
- **Severity:** Medium
- **Impact:** Worker crash or timeout between DELETE and INSERT causes permanent data loss for user's characters
- **Location:** [user-service.ts](apps/oauth/src/services/user-service.ts#L183-L195)

**Description:** Characters are replaced by first deleting all existing records, then inserting new ones in a loop. These operations are not batched:

```typescript
export async function storeCharacters(db: D1Database, userId: string, characters: XIVAuthCharacter[]): Promise<void> {
  // Step 1: Delete all characters (succeeds)
  await db.prepare('DELETE FROM xivauth_characters WHERE user_id = ?').bind(userId).run();

  // Step 2: Insert new ones one by one (could fail partway through)
  for (const char of characters) {
    await db.prepare('INSERT INTO xivauth_characters ...').bind(...).run();
  }
}
```

**Suggested fix:** Use `db.batch()` for atomicity:
```typescript
export async function storeCharacters(db: D1Database, userId: string, characters: XIVAuthCharacter[]): Promise<void> {
  const statements = [
    db.prepare('DELETE FROM xivauth_characters WHERE user_id = ?').bind(userId),
    ...characters.map(char =>
      db.prepare('INSERT INTO xivauth_characters (user_id, lodestone_id, name, server, verified) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, char.id, char.name, char.home_world, char.verified ? 1 : 0)
    ),
  ];
  await db.batch(statements);
}
```

---

#### BUG-OA-002: `getConfigForPath` iteration order not guaranteed for overlapping paths
- **Severity:** Low
- **Impact:** `/auth/xivauth/callback` could match `/auth/xivauth` (10 req/min) instead of the intended `/auth/xivauth/callback` (20 req/min) depending on object iteration order
- **Location:** [rate-limit-do.ts](apps/oauth/src/services/rate-limit-do.ts#L42-L54)

**Description:** In the DO rate limiter, `getConfigForPath` iterates over `RATE_LIMITS` entries using `Object.entries()` with `startsWith` matching. If `/auth/xivauth` is iterated before `/auth/xivauth/callback`, the less specific (stricter) rule matches first:

```typescript
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/auth/discord': { maxRequests: 10, windowMs: 60_000 },
  '/auth/xivauth': { maxRequests: 10, windowMs: 60_000 },       // ← matched first?
  '/auth/callback': { maxRequests: 20, windowMs: 60_000 },
  '/auth/xivauth/callback': { maxRequests: 20, windowMs: 60_000 }, // ← never reached?
};
```

The in-memory `rate-limit.ts` avoids this by using explicit `||` conditions.

**Suggested fix:** Sort by specificity (longest path first) or use exact matching:
```typescript
function getConfigForPath(path: string): RateLimitConfig {
  const sortedKeys = Object.keys(RATE_LIMITS)
    .filter(k => k !== 'default')
    .sort((a, b) => b.length - a.length); // longest first
  for (const key of sortedKeys) {
    if (path.startsWith(key)) return RATE_LIMITS[key];
  }
  return RATE_LIMITS.default;
}
```

---

#### BUG-OA-003: `updateUser` doesn't return provider IDs from the SELECT result
- **Severity:** Low  
- **Impact:** After update, the returned `UserRow` accurately reflects database state (because it does a fresh SELECT), so this is not a data correctness issue. However, the function performs two DB round-trips where one would suffice.
- **Location:** [user-service.ts](apps/oauth/src/services/user-service.ts#L148-L163)

**Description:** After the UPDATE, a separate SELECT retrieves the full row. D1 supports `RETURNING *` on UPDATE statements, which would eliminate the extra query:
```typescript
// Current: two queries
await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...).run();
const updated = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
```

**Suggested fix:**
```typescript
const updated = await db.prepare(
  `UPDATE users SET ${fields.join(', ')} WHERE id = ? RETURNING *`
).bind(...values, userId).first<UserRow>();
```

---

### Refactoring Opportunities {#oa-refactoring}

#### REF-OA-001: Discord and XIVAuth callback handlers share near-identical patterns
- **Severity:** Low
- **Location:** [callback.ts](apps/oauth/src/handlers/callback.ts), [xivauth.ts](apps/oauth/src/handlers/xivauth.ts)

Both GET callbacks follow the same pattern: check for error → validate code+state → verify state signature → validate expiration → validate redirect URI → redirect with code. Extract a shared `handleOAuthCallback()` utility.

---

#### REF-OA-002: Legacy `createJWT` function should be removed
- **Severity:** Low
- **Location:** [jwt-service.ts](apps/oauth/src/services/jwt-service.ts#L85-L128)

`createJWT` (for Discord users) is marked `@deprecated` in favor of `createJWTForUser`. Verify no callers remain and remove it. It uses `user.id` as the `sub` claim (Discord ID), while `createJWTForUser` uses the internal user UUID — having both available risks accidental use of the wrong one.

---

#### REF-OA-003: `base64UrlEncode` wrapper re-exports could be simplified
- **Severity:** Low
- **Location:** [jwt-service.ts](apps/oauth/src/services/jwt-service.ts#L19-L33)

The `base64UrlEncode` function wraps `@xivdyetools/crypto` functions to support both `string` and `ArrayBuffer` input. This wrapper is re-exported for use in `refresh.ts` and `state-signing.ts`. Consider either:
1. Having `@xivdyetools/crypto` export a unified overloaded function
2. Or importing the specific variant needed in each file

---

### Optimization Opportunities {#oa-optimization}

#### OPT-OA-001: Character storage uses sequential INSERTs instead of batch
- **Severity:** Low
- **Location:** [user-service.ts](apps/oauth/src/services/user-service.ts#L183-L195)

See BUG-OA-001 — `db.batch()` would both fix the atomicity issue and improve performance by reducing DB round trips from N+1 to 1.

---

#### OPT-OA-002: Per-IP Durable Object creates many small DO instances
- **Severity:** Low (informational)
- **Location:** [rate-limit-do.ts](apps/oauth/src/services/rate-limit-do.ts#L76)

Each unique IP address creates its own Durable Object instance. Under high traffic from many IPs, this could create a large number of small DOs. This is Cloudflare's recommended pattern for rate limiting DOs, so the design is correct, but worth monitoring for cost implications.

---

<a id="cross-cutting"></a>
## Cross-Cutting Concerns

#### XC-001: `envValidated` module-level boolean never resets
- **Severity:** Informational
- **Locations:** [presets-api/index.ts](apps/presets-api/src/index.ts#L36), [oauth/index.ts](apps/oauth/src/index.ts#L31)

Both apps use a module-level `let envValidated = false` that's set to `true` on first validation. Since CF Worker isolates can be long-lived, this means env validation runs once per isolate lifetime. This is correct and intentional (env doesn't change within an isolate), but means issues introduced via `wrangler secret put` won't be caught until isolate recycling.

---

#### XC-002: Request ID validation inconsistency between apps
- **Severity:** Informational
- **Locations:** [presets-api/request-id.ts](apps/presets-api/src/middleware/request-id.ts#L22-L25), [oauth/request-id.ts](apps/oauth/src/middleware/request-id.ts#L36)

The presets API validates `X-Request-ID` against a UUID regex pattern (preventing log injection), while the OAuth worker accepts any value. The presets API approach is more secure.

**Suggested fix:** Apply UUID validation to the OAuth worker's request-id middleware as well.

---

<a id="summary-matrix"></a>
## Summary Matrix

| ID | App | Type | Severity | Title |
|---|---|---|---|---|
| SEC-PA-001 | presets-api | Security | **Medium** | Hidden/rejected presets accessible by ID |
| SEC-PA-002 | presets-api | Security | Low | CORS allows localhost in production |
| SEC-PA-003 | presets-api | Security | Low | Bot API secret timing-unsafe comparison |
| SEC-PA-004 | presets-api | Security | Low | Ban check fails open on DB errors |
| SEC-PA-005 | presets-api | Security | Low | Ban check missing on DELETE |
| BUG-PA-001 | presets-api | Bug | **Medium** | dye_signature UNIQUE causes 500 for rejected dupes |
| BUG-PA-002 | presets-api | Bug | **Medium** | Vote insert/count update non-atomic |
| BUG-PA-003 | presets-api | Bug | Low | removeVote not ban-checked |
| REF-PA-001 | presets-api | Refactor | Low | Notification payload duplication |
| REF-PA-002 | presets-api | Refactor | Low | Notification type should be shared |
| OPT-PA-001 | presets-api | Optimization | Low | Double getPresetById in update flow |
| SEC-OA-001 | oauth | Security | **Medium** | State HMAC non-constant-time comparison |
| SEC-OA-002 | oauth | Security | **Medium** | Discord callback skips expiration on falsy exp |
| SEC-OA-003 | oauth | Security | Low | Localhost in production authorize allowlist |
| SEC-OA-004 | oauth | Security | Low | Production logging of PII in XIVAuth flow |
| SEC-OA-005 | oauth | Security | Low | No issuer validation on JWT verify |
| SEC-OA-006 | oauth | Security | Low | DO rate limiter fails open |
| BUG-OA-001 | oauth | Bug | **Medium** | storeCharacters non-atomic |
| BUG-OA-002 | oauth | Bug | Low | Rate limit path matching order ambiguity |
| BUG-OA-003 | oauth | Bug | Low | updateUser extra SELECT |
| REF-OA-001 | oauth | Refactor | Low | Callback handler duplication |
| REF-OA-002 | oauth | Refactor | Low | Legacy createJWT should be removed |
| REF-OA-003 | oauth | Refactor | Low | base64UrlEncode wrapper complexity |
| OPT-OA-001 | oauth | Optimization | Low | Sequential character INSERTs |
| OPT-OA-002 | oauth | Optimization | Low | Per-IP DO proliferation (informational) |
| XC-001 | both | Informational | Info | envValidated never resets |
| XC-002 | both | Informational | Info | Request ID validation inconsistency |

### Priority Recommendations

**Fix immediately (Medium):**
1. SEC-OA-001 — Constant-time state signature comparison
2. SEC-OA-002 — Consistent state expiration validation
3. BUG-PA-001 — Handle rejected duplicate dye signature gracefully
4. BUG-PA-002 — Atomic vote operations with `db.batch()`
5. BUG-OA-001 — Atomic character storage with `db.batch()`
6. SEC-PA-001 — Filter hidden/rejected presets from public GET by ID

**Fix soon (Low):**
7. SEC-PA-002 — Gate localhost CORS behind environment check
8. SEC-OA-004 — Gate production logging
9. XC-002 — Consistent request ID validation

### What's Done Well

- **SQL injection prevention:** 100% parameterized queries throughout both apps. D1 binding is used consistently.
- **PKCE implementation:** Full PKCE S256 flow with proper code_verifier storage (never sent through redirects).
- **State signing:** HMAC-signed OAuth state prevents CSRF tampering (aside from the constant-time comparison issue).
- **Content-Type validation:** POST/PATCH requests require `application/json`, preventing smuggling.
- **Security headers:** `X-Content-Type-Options`, `X-Frame-Options`, HSTS all properly set.
- **Input validation:** Comprehensive validation service with consistent rules.
- **Production error sanitization:** Error details are hidden in production, only shown in development.
- **Rate limiting:** Multi-layer rate limiting (IP-based + per-user submission limits).
- **LIKE pattern escaping:** `escapeLikePattern()` prevents wildcard injection in search queries.
- **Race condition handling:** UNIQUE constraint + try/catch for duplicate preset creation.
- **HMAC bot authentication:** Production requires signed bot requests, not just API keys.
