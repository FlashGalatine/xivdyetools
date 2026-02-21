# Security & Code Audit Report: Discord Workers

**Scope:** `apps/discord-worker/` and `apps/moderation-worker/`  
**Date:** 2026-02-21  
**Auditor:** Automated deep-dive analysis  
**Risk Classification:** CRITICAL / HIGH / MEDIUM / LOW / INFO

---

## Executive Summary

The discord-worker and moderation-worker are Cloudflare Workers handling Discord HTTP Interactions (slash commands, buttons, modals). Both use Hono as an HTTP framework and communicate with the presets-api via Cloudflare Service Bindings or fallback HTTP.

**Critical findings:** 2 — A prototype pollution false-positive bug that likely rejects all valid interactions in the moderation-worker, and an HTTP 429 response that Discord silently discards.

**High findings:** 3 — Inconsistent JSON parsing security posture, missing request timeouts, unsanitized user content in notification embeds.

**Medium findings:** 5 — Race conditions in KV storage, CORS wildcard, singleton cache staleness.

**Low/Info findings:** 6 — Refactoring opportunities and minor optimizations.

---

## Critical Findings

### BUG-MW-001: `safeParseJSON` Prototype Pollution Check Always Triggers False Positive

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **File** | [safe-json.ts](apps/moderation-worker/src/utils/safe-json.ts#L174-L200) |
| **Impact** | Every valid Discord interaction is rejected, rendering the moderation-worker non-functional |

**Description:**  
The `hasPrototypePollution()` function uses the `in` operator to check for dangerous keys:

```typescript
const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

for (const key of dangerousKeys) {
  if (key in obj) {  // ← BUG: checks prototype chain, not own properties
    return {
      detected: true,
      reason: `Dangerous key '${key}' found at ${path}`,
    };
  }
}
```

The `in` operator checks the **full prototype chain**, not just own properties. Since every object inherits `constructor` from `Object.prototype`, `'constructor' in JSON.parse('{}')` is always `true`. This means `safeParseJSON` rejects every valid JSON object as a prototype pollution attempt.

In `index.ts`, every Discord interaction is parsed through this function:

```typescript
const parseResult = safeParseJSON<DiscordInteraction>(body, {
  maxDepth: 10,
  validateStructure: true,
  freezeResult: true,
});

if (!parseResult.success) {
  return badRequestResponse(parseResult.error || 'Invalid JSON body');
}
```

**Suggested fix:**  
Replace `key in obj` with `Object.prototype.hasOwnProperty.call(obj, key)`:

```typescript
for (const key of dangerousKeys) {
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    return {
      detected: true,
      reason: `Dangerous key '${key}' found at ${path}`,
    };
  }
}
```

Also recursively check with the same fix:
```typescript
for (const [key, value] of Object.entries(obj)) {
  const check = hasPrototypePollution(value, `${path}.${key}`);
  // ...
}
```

`Object.entries()` only iterates own enumerable properties, so the recursive scan is already correct.

---

### BUG-MW-002: Rate Limit Response Returns HTTP 429, Discord Silently Discards It

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **File** | [response.ts](apps/moderation-worker/src/utils/response.ts#L293-L316) |
| **Impact** | Rate-limited users see "This interaction failed" instead of a friendly rate limit message |

**Description:**  
The moderation-worker's `rateLimitedResponse()` function returns an HTTP 429 status:

```typescript
export function rateLimitedResponse(resetTime: number): Response {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  return new Response(
    JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Rate limit exceeded. Please wait before trying again.',
        flags: MessageFlags.EPHEMERAL,
      },
    }),
    {
      status: 429,  // ← BUG: Discord expects HTTP 200 for interaction responses
      headers: { ... },
    }
  );
}
```

Discord's Interactions API **requires HTTP 200** responses. Any non-200 status causes Discord to show the generic "This interaction failed" error. The friendly rate limit message in the body is never displayed.

By contrast, the discord-worker correctly returns ephemeral messages with HTTP 200 via `ephemeralResponse(formatRateLimitMessage(rateLimitResult))`.

**Called from** [index.ts](apps/moderation-worker/src/index.ts#L214):
```typescript
if (!rateLimitCheck.allowed) {
  return rateLimitedResponse(rateLimitCheck.resetTime);
}
```

**Suggested fix:**  
Return HTTP 200 with an ephemeral message:

```typescript
export function rateLimitedResponse(resetTime: number): Response {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `Rate limit exceeded. Please wait **${Math.max(1, retryAfter)} second${retryAfter !== 1 ? 's' : ''}** before trying again.`,
      flags: MessageFlags.EPHEMERAL,
    },
  });
}
```

---

## High Findings

### SEC-DW-001: Discord Worker Uses Raw `JSON.parse` Without Prototype Pollution Protection

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **File** | [index.ts](apps/discord-worker/src/index.ts#L398-L403) |
| **Impact** | Discord-worker is vulnerable to prototype pollution attacks via crafted interactions |

**Description:**  
The moderation-worker uses `safeParseJSON` (with prototype pollution detection, depth limits, and `Object.freeze`), but the discord-worker uses raw `JSON.parse`:

```typescript
// discord-worker/src/index.ts
let interaction: DiscordInteraction;
try {
  interaction = JSON.parse(body) as DiscordInteraction;
} catch {
  return badRequestResponse('Invalid JSON body');
}
```

vs. moderation-worker:
```typescript
// moderation-worker/src/index.ts
const parseResult = safeParseJSON<DiscordInteraction>(body, {
  maxDepth: 10,
  validateStructure: true,
  freezeResult: true,
});
```

While Discord's signature verification (Ed25519) provides some trust that the payload came from Discord, an attacker who compromises the interaction endpoint URL before signature verification, or if Discord itself sends a payload with `__proto__`, the discord-worker would be vulnerable.

**Suggested fix:**  
Use `safeParseJSON` in the discord-worker too (once the `in` operator bug from BUG-MW-001 is fixed). Consider extracting `safeParseJSON` into a shared package.

---

### SEC-DW-003: Unsanitized User Content in Preset Notification Embeds

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **File** | [preset.ts](apps/discord-worker/src/handlers/commands/preset.ts#L870-L1070) |
| **Impact** | User-controlled preset names/descriptions embedded without sanitization in moderation Discord messages |

**Description:**  
The webhook handler in `index.ts` correctly sanitizes user content before embedding:

```typescript
// index.ts - webhook handler (CORRECT)
const safeName = sanitizePresetName(preset.name);
const safeDescription = sanitizePresetDescription(preset.description);
```

But the preset command handler's notification functions embed raw user content:

```typescript
// preset.ts - notifyModerationChannel (MISSING SANITIZATION)
`**Name:** ${preset.name}`,
`**Description:** ${preset.description}`,
```

```typescript
// preset.ts - notifySubmissionChannel (MISSING SANITIZATION)
title: `${statusDisplay.icon} New Preset: ${preset.name}`,
description: preset.description,
```

```typescript
// preset.ts - notifyEditModerationChannel (MISSING SANITIZATION)
`**Preset:** ${updatedPreset.name}`,
`**New Description:** ${updatedPreset.description}`,
```

While Discord embeds don't execute scripts, control characters, zero-width characters, and excessively long strings can manipulate embed formatting, create misleading displays, or cause rendering issues.

**Suggested fix:**  
Apply `sanitizePresetName()` and `sanitizePresetDescription()` consistently in all three notification functions:

```typescript
async function notifyModerationChannel(env, preset, logger) {
  const safeName = sanitizePresetName(preset.name);
  const safeDescription = sanitizePresetDescription(preset.description);
  // ...use safeName and safeDescription in embed
}
```

---

### SEC-MW-002: Missing Request Timeouts on Moderation-Worker Discord API Calls

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **File** | [discord-api.ts](apps/moderation-worker/src/utils/discord-api.ts#L24-L64) |
| **Impact** | `sendFollowUp` and `editOriginalResponse` can hang indefinitely if Discord is unresponsive |

**Description:**  
The moderation-worker's `sendFollowUp` and `editOriginalResponse` functions make `fetch` calls without an `AbortSignal.timeout`:

```typescript
// moderation-worker discord-api.ts
export async function sendFollowUp(...) {
  return await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    // ← Missing: signal: AbortSignal.timeout(5000)
  });
}

export async function editOriginalResponse(...) {
  return await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    // ← Missing: signal: AbortSignal.timeout(5000)
  });
}
```

By contrast, the discord-worker correctly uses `AbortSignal.timeout(5000)` on all Discord API calls. CF Workers have a 30-second CPU time limit, so a hung fetch could consume the entire budget.

The `sendMessage` and `editMessage` functions in the same file DO have timeouts, making this an inconsistency.

**Suggested fix:**  
Add `AbortSignal.timeout(5000)` to all fetch calls in the moderation-worker's `discord-api.ts`.

---

### BUG-MW-003: Autocomplete Rate Limit Increment Is a Floating Promise

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **File** | [index.ts](apps/moderation-worker/src/index.ts#L283-L286) |
| **Impact** | Rate limit counters may not increment, allowing rate limit bypass during high load |

**Description:**  
In the moderation-worker's `handleAutocomplete` function, the rate limit increment is fire-and-forgotten without `ctx.waitUntil()`:

```typescript
// moderation-worker/src/index.ts - handleAutocomplete
incrementRateLimit(env.KV, userId, 'autocomplete').catch((err) => {
  logger.error('Failed to increment autocomplete rate limit', ...);
});
```

vs. the command handler which correctly uses `ctx.waitUntil()`:

```typescript
// moderation-worker/src/index.ts - handleCommand
ctx.waitUntil(
  incrementRateLimit(env.KV, userId, 'command').catch((err) => {
    logger.error('Failed to increment command rate limit', ...);
  })
);
```

Without `ctx.waitUntil()`, the KV write may not complete before the worker terminates, especially for fast autocomplete responses. This means the rate limit counter isn't reliably incremented, allowing users to exceed autocomplete rate limits.

The `handleAutocomplete` function doesn't receive `ctx: ExecutionContext` as a parameter, which is the root cause — it needs to be plumbed through.

**Suggested fix:**  
Add `ctx: ExecutionContext` to `handleAutocomplete`'s parameter list and wrap the increment:

```typescript
async function handleAutocomplete(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,  // ← Add this
  logger: ExtendedLogger
): Promise<Response> {
  // ...
  ctx.waitUntil(
    incrementRateLimit(env.KV, userId, 'autocomplete').catch(...)
  );
  // ...
}
```

Update the call site in `app.post('/')` to pass `c.executionCtx`.

---

## Medium Findings

### SEC-DW-002: CORS Wildcard Enabled on Security-Critical Endpoint

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | [index.ts](apps/discord-worker/src/index.ts#L80) |
| **Impact** | Any origin can make cross-origin requests to the worker, including webhook endpoints |

**Description:**  
```typescript
app.use('*', cors());
```

This enables CORS for **all origins** on **all routes**, including:
- `POST /` — Discord interactions (protected by signature verification)
- `POST /webhooks/preset-submission` — Protected only by Bearer token
- `POST /webhooks/github` — Protected by HMAC signature
- `GET /health` — Unauthenticated

While the webhook endpoints have their own authentication, enabling CORS means a malicious webpage could attempt cross-origin requests to the webhook endpoints. If an attacker obtains the `INTERNAL_WEBHOOK_SECRET` (e.g., from leaked env vars), CORS wouldn't provide any additional barrier.

The moderation-worker correctly does NOT enable CORS.

**Suggested fix:**  
Remove the global CORS middleware or restrict it to specific origins/routes:

```typescript
// Only enable CORS for the health check if needed
app.use('/health', cors());
// Discord and webhook endpoints don't need CORS
```

---

### BUG-DW-002: KV Favorites/Collections Read-Modify-Write Race Condition

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | [user-storage.ts](apps/discord-worker/src/services/user-storage.ts#L108-L128) |
| **Impact** | Concurrent requests can lose favorites/collection modifications |

**Description:**  
`addFavorite`, `removeFavorite`, `addCollection`, `addDyeToCollection`, etc. all follow a get→modify→put pattern without any concurrency control:

```typescript
export async function addFavorite(kv, userId, dyeId): Promise<AddResult> {
  const favorites = await getFavorites(kv, userId);    // 1. Read
  if (favorites.includes(dyeId)) return { ... };
  favorites.push(dyeId);                                // 2. Modify
  await kv.put(`${FAVORITES_KEY_PREFIX}${userId}`, JSON.stringify(favorites));  // 3. Write
  return { success: true };
}
```

If user A sends two rapid `/favorites add` commands, both reads may see the same array, and the second write silently overwrites the first, losing a favorite entry. KV doesn't support atomic read-modify-write.

The analytics `incrementCounter` has a similar issue but includes a retry mechanism (with known limitations).

**Suggested fix:**  
For KV-based storage, options are limited:
1. **Accept the race** (current approach) — document that rapid concurrent operations may lose data.
2. **Use Durable Objects** — provides true transactional semantics for per-user storage.
3. **Use D1 with transactions** — since D1 is already bound, consider migrating user storage to SQL with proper transactions.

---

### BUG-DW-003: Singleton Caches Never Invalidated on Env Changes

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Files** | [rate-limiter.ts](apps/discord-worker/src/services/rate-limiter.ts#L62-L71), [preset-api.ts](apps/moderation-worker/src/services/preset-api.ts#L266-L273), [index.ts](apps/discord-worker/src/index.ts#L78) |
| **Impact** | Environment variable changes (secrets rotation, moderator list updates) don't take effect until isolate recycle |

**Description:**  
Multiple module-level singletons cache values across requests within the same V8 isolate:

1. **`limiterInstance`** in discord-worker's `rate-limiter.ts` — caches the rate limiter backend choice (Upstash vs KV)
2. **`moderatorIdsCache`** in moderation-worker's `preset-api.ts` — caches parsed moderator IDs
3. **`envValidated`** in discord-worker's `index.ts` — caches env validation result
4. **`startupValidationDone`** in moderation-worker's `index.ts` — caches startup validation

If `MODERATOR_IDS` is updated via `wrangler secret put`, existing isolates continue using the old cache. A newly added moderator won't have access until all isolates recycle (which could take minutes to hours).

**Suggested fix:**  
For security-sensitive caches like `moderatorIdsCache`, consider:
1. Reparse on every request (the parsing is cheap — split + Set construction for ~5 IDs)
2. Add a TTL-based cache invalidation (e.g., reparse every 60 seconds)

For `limiterInstance`, the current behavior is acceptable since rate limiter backend rarely changes.

---

### BUG-MW-004: Moderation-Worker Rate Limit Check Occurs Before Signature Verification

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | [index.ts](apps/moderation-worker/src/index.ts#L200-L220) |
| **Impact** | Minor: Rate limiting does KV operations before verifying the request is authentic |

**Description:**  
In the moderation-worker's interaction handler, after signature verification, the command handler is called, which does rate limiting. The rate limit KV reads/writes use the `userId` extracted from the verified interaction, so this is not exploitable for unauthenticated abuse.

However, the `handleAutocomplete` function also checks and increments rate limits. Since the interaction is already verified at this point, this is correctly scoped.

The ordering is correct: signature verification → parse → route → rate limit (in handlers). No action needed — this is INFO level.

---

### SEC-DW-004: Ban Custom ID Parsing Doesn't Validate Discord Snowflake Format

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | [ban-confirmation.ts](apps/moderation-worker/src/handlers/buttons/ban-confirmation.ts#L68-L81) |
| **Impact** | A malformed button custom_id could pass an invalid user ID to the ban system |

**Description:**  
The `handleBanConfirmButton` extracts `targetUserId` from a custom_id like `ban_confirm_{discordId}_{base64username}`:

```typescript
const idPart = customId.replace('ban_confirm_', '');
const underscoreIndex = idPart.indexOf('_');
const targetUserId = idPart.substring(0, underscoreIndex);
```

While the code checks `if (!targetUserId)` for empty strings, it doesn't validate that `targetUserId` is a valid Discord snowflake. The moderation-worker's `isModerator` correctly validates snowflake format for moderator checks, but the ban target is not validated.

The same issue exists in [ban-reason.ts](apps/moderation-worker/src/handlers/modals/ban-reason.ts#L67-L72).

The `preset-moderation.ts` button handlers correctly validate preset IDs with `isValidUuid()`, but ban handlers don't validate user IDs.

**Suggested fix:**  
Add snowflake validation:
```typescript
import { isValidSnowflake } from '@xivdyetools/types';

const targetUserId = idPart.substring(0, underscoreIndex);
if (!targetUserId || !isValidSnowflake(targetUserId)) {
  return ephemeralResponse('Invalid target user ID.');
}
```

---

## Low Findings

### REF-001: Duplicate `DiscordInteraction` Type Definitions

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **Files** | [discord-worker/index.ts](apps/discord-worker/src/index.ts#L740-L800), [discord-worker/types/env.ts](apps/discord-worker/src/types/env.ts#L109-L180), [moderation-worker/index.ts](apps/moderation-worker/src/index.ts#L448-L500), [moderation-worker/types/env.ts](apps/moderation-worker/src/types/env.ts#L63-L115) |
| **Impact** | Maintenance burden; types can diverge silently |

Both workers define `DiscordInteraction` in two places:
1. In `types/env.ts` (used by handler imports)
2. Locally at the bottom of `index.ts` (used by the router)

The env.ts version has `username?: string` (optional) while the index.ts version has `username: string` (required). TypeScript structural typing masks this divergence, but future changes to one definition won't propagate to the other.

**Suggested fix:**  
Remove the local definition in `index.ts` and import from `types/env.ts`. Or better, create a shared `@xivdyetools/discord-types` package.

---

### REF-002: Duplicate HMAC Signature Generation Across Workers

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **Files** | [discord-worker/preset-api.ts](apps/discord-worker/src/services/preset-api.ts#L44-L68), [moderation-worker/preset-api.ts](apps/moderation-worker/src/services/preset-api.ts#L67-L90) |
| **Impact** | Code duplication; signature format changes require updating both workers |

The `generateRequestSignature` function is nearly identical across both workers. This function is security-critical — a bug in one copy but not the other could cause subtle auth failures.

**Suggested fix:**  
Move `generateRequestSignature` into `@xivdyetools/auth` alongside the existing verification functions, or create a shared `preset-api-client` package.

---

### REF-003: Duplicate Preset API Client Code

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **Files** | [discord-worker/preset-api.ts](apps/discord-worker/src/services/preset-api.ts) (662 lines), [moderation-worker/preset-api.ts](apps/moderation-worker/src/services/preset-api.ts) (514 lines) |
| **Impact** | ~400 lines of duplicate code across workers |

The core `request()` function, `getPresets()`, `getPreset()`, `isApiEnabled()`, `searchPresetsForAutocomplete()`, and all moderation functions are duplicated. The moderation-worker is a strict subset.

**Suggested fix:**  
Extract a `@xivdyetools/preset-api-client` package with the shared `request()`, query builders, and common functions. Each worker imports and extends with worker-specific functions.

---

### REF-004: Duplicate Response Builder Utilities

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **Files** | [discord-worker/response.ts](apps/discord-worker/src/utils/response.ts), [moderation-worker/response.ts](apps/moderation-worker/src/utils/response.ts) |
| **Impact** | ~150 lines of duplicate code |

`pongResponse`, `messageResponse`, `ephemeralResponse`, `deferredResponse`, `errorEmbed`, `successEmbed`, `infoEmbed`, etc. are duplicated with minor differences.

---

### REF-005: `verify.ts` Thin Re-Exports Add No Value

| Field | Value |
|-------|-------|
| **Severity** | INFO |
| **Files** | [discord-worker/verify.ts](apps/discord-worker/src/utils/verify.ts), [moderation-worker/verify.ts](apps/moderation-worker/src/utils/verify.ts) |
| **Impact** | Extra indirection for no functional benefit |

Both files are identical thin re-exports from `@xivdyetools/auth`:

```typescript
export {
  verifyDiscordRequest,
  unauthorizedResponse,
  badRequestResponse,
  timingSafeEqual,
  type DiscordVerificationResult,
  type DiscordVerifyOptions,
} from '@xivdyetools/auth';
```

**Suggested fix:**  
Import directly from `@xivdyetools/auth` at call sites. The "backwards compatibility" comment doesn't justify the indirection since both workers are the only consumers.

---

### OPT-DW-001: Analytics `incrementCounter` Performs 3 KV Operations Per Increment

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **File** | [analytics.ts](apps/discord-worker/src/services/analytics.ts#L130-L155) |
| **Impact** | High KV operation count under load; may hit free-tier limits |

Each `incrementCounter` call does:
1. `kv.getWithMetadata` — read current value
2. `kv.put` — write new value
3. `kv.get` — verify write (read back)

And `trackCommandWithKV` calls this 3-4 times per command. That's 9-12 KV operations per command execution. The verification read provides no strong guarantees due to KV's eventual consistency.

**Suggested fix:**  
Remove the verification read (step 3). Rely on Analytics Engine for accurate stats and treat KV counters as best-effort approximations.

---

## Positive Security Findings

The following security practices are implemented well:

1. **Ed25519 Signature Verification** — Both workers verify Discord interaction signatures via `@xivdyetools/auth` before processing any interaction.

2. **HMAC Request Signing** — Worker-to-worker API calls use HMAC-SHA256 signatures with timestamp binding, preventing replay attacks.

3. **Timing-Safe Comparisons** — Webhook authentication in the discord-worker uses `timingSafeEqual` for constant-time string comparison.

4. **SSRF Protection** — Image validation in `validators.ts` implements a strict allowlist (`cdn.discordapp.com`, `media.discordapp.net`), IP literal blocking, cloud metadata endpoint blocking, and private IP range blocking.

5. **SQL Injection Prevention** — The moderation-worker uses parameterized queries throughout and escapes LIKE patterns via `validateAndEscapeQuery`.

6. **Error Message Sanitization** — Both workers sanitize error messages before displaying to users, filtering SQL keywords, file paths, and stack traces.

7. **Content-Length Checking** — Webhook endpoints check Content-Length headers AND verify actual body size as defense-in-depth.

8. **Security Headers** — Both workers set `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, with the moderation-worker additionally setting `Content-Security-Policy`, `Cache-Control`, and `Referrer-Policy`.

9. **Moderator Authorization** — All moderation actions check `isModerator()` before processing. The moderation-worker additionally restricts commands to a specific channel via `isInModerationChannel()`.

10. **UUID Validation** — Preset IDs are validated as UUID v4 format before use in API calls.

11. **GitHub Webhook Verification** — HMAC-SHA256 signature verification with timing-safe comparison for GitHub push webhooks.

12. **URL/Token Sanitization** — The moderation-worker sanitizes URLs in log output to prevent token leakage via `sanitizeUrl`.

---

## Summary Table

| ID | Severity | Type | Worker | Title |
|-------|----------|------|--------|-------|
| BUG-MW-001 | CRITICAL | Bug | mod-worker | `safeParseJSON` prototype check uses `in` operator (always false positive) |
| BUG-MW-002 | CRITICAL | Bug | mod-worker | Rate limit response returns HTTP 429 (Discord rejects non-200) |
| SEC-DW-001 | HIGH | Security | discord-worker | Raw `JSON.parse` without prototype pollution protection |
| SEC-DW-003 | HIGH | Security | discord-worker | Unsanitized user content in notification embeds |
| SEC-MW-002 | HIGH | Security | mod-worker | Missing `AbortSignal.timeout` on `sendFollowUp`/`editOriginalResponse` |
| BUG-MW-003 | HIGH | Bug | mod-worker | Autocomplete rate limit increment is a floating promise |
| SEC-DW-002 | MEDIUM | Security | discord-worker | CORS wildcard enabled on all routes |
| BUG-DW-002 | MEDIUM | Bug | discord-worker | KV favorites/collections read-modify-write race condition |
| BUG-DW-003 | MEDIUM | Bug | both | Singleton caches never invalidated on env changes |
| SEC-DW-004 | MEDIUM | Security | mod-worker | Ban target user ID not validated as snowflake |
| REF-001 | LOW | Refactor | both | Duplicate `DiscordInteraction` type definitions |
| REF-002 | LOW | Refactor | both | Duplicate HMAC signature generation |
| REF-003 | LOW | Refactor | both | Duplicate preset API client (~400 lines) |
| REF-004 | LOW | Refactor | both | Duplicate response builder utilities |
| REF-005 | INFO | Refactor | both | `verify.ts` thin re-exports add no value |
| OPT-DW-001 | LOW | Optimization | discord-worker | Analytics `incrementCounter` performs 3 KV ops per increment |
