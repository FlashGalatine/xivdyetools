# XIV Dye Tools Discord Worker - Deep Dive Analysis

**Date:** December 7, 2025
**Project:** xivdyetools-discord-worker v1.1.0
**Analyst:** Claude Code (Opus 4.5)

---

## Executive Summary

This document presents a comprehensive analysis of the `xivdyetools-discord-worker` Cloudflare Worker codebase, examining security posture, performance characteristics, and refactoring opportunities. The codebase demonstrates solid architectural decisions with a few areas for improvement.

### Overall Assessment

| Area | Score | Notes |
|------|-------|-------|
| Security | **A-** | Strong foundation with Ed25519 verification, SSRF protection, rate limiting |
| Performance | **B+** | Good use of deferred responses, WASM; some optimization opportunities |
| Code Quality | **A-** | Clean architecture, TypeScript throughout, consistent patterns |
| Maintainability | **B+** | Well-organized, but some code duplication exists |

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Security Analysis](#2-security-analysis)
3. [Performance Optimization Opportunities](#3-performance-optimization-opportunities)
4. [Refactoring Recommendations](#4-refactoring-recommendations)
5. [Risk Assessment](#5-risk-assessment)
6. [Recommended Action Items](#6-recommended-action-items)

---

## 1. Architecture Overview

### 1.1 Technology Stack

- **Runtime:** Cloudflare Workers (edge computing)
- **Framework:** Hono (lightweight HTTP framework)
- **Signature Verification:** discord-interactions library (Ed25519)
- **Image Processing:** @cf-wasm/photon (WASM-based)
- **SVG Rendering:** @resvg/resvg-wasm (WASM-based)
- **Core Library:** xivdyetools-core (dye database, color algorithms)

### 1.2 Request Flow

```
Discord POST /
    -> Ed25519 Signature Verification
    -> Interaction Type Routing
    -> Rate Limit Check (KV-backed)
    -> Command/Button/Modal Handler
    -> Deferred Response + Background Processing
    -> Follow-up via Discord REST API
```

### 1.3 Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Entry Point | `src/index.ts` | Hono app, routing, main interaction handling |
| Verification | `src/utils/verify.ts` | Ed25519 signature verification |
| Rate Limiter | `src/services/rate-limiter.ts` | Per-user sliding window rate limiting |
| Image Validators | `src/services/image/validators.ts` | SSRF protection, format validation |
| Photon Service | `src/services/image/photon.ts` | WASM image processing |
| SVG Renderer | `src/services/svg/renderer.ts` | WASM SVG-to-PNG rendering |
| Preset API | `src/services/preset-api.ts` | Service Binding to presets worker |

---

## 2. Security Analysis

### 2.1 Strengths

#### Ed25519 Signature Verification (EXCELLENT)
**Location:** `src/utils/verify.ts`

The implementation correctly:
- Validates presence of `X-Signature-Ed25519` and `X-Signature-Timestamp` headers
- Uses the trusted `discord-interactions` library for verification
- Returns appropriate 401 responses for invalid signatures
- Logs verification failures for monitoring

```typescript
// Correct implementation pattern
const { isValid, body, error } = await verifyDiscordRequest(
  c.req.raw,
  env.DISCORD_PUBLIC_KEY
);
if (!isValid) {
  return unauthorizedResponse(error);
}
```

#### SSRF Protection (EXCELLENT)
**Location:** `src/services/image/validators.ts`

The image URL validation implements defense-in-depth:
1. **Host Allowlist:** Only allows `cdn.discordapp.com` and `media.discordapp.net`
2. **Protocol Check:** HTTPS-only enforcement
3. **Private IP Blocking:** Regex patterns for localhost, 127.x, 10.x, 172.16-31.x, 192.168.x, IPv6 private ranges

```typescript
const ALLOWED_HOSTS = new Set([
  'cdn.discordapp.com',
  'media.discordapp.net',
]);
```

#### Rate Limiting (GOOD)
**Location:** `src/services/rate-limiter.ts`

- Per-user, per-command rate limits stored in KV
- 60-second sliding window
- Command-specific limits (5-30 requests/minute based on resource intensity)
- Graceful degradation: fails open on KV errors (prevents total lockout)

#### Moderator Authorization (GOOD)
**Location:** `src/services/preset-api.ts`, button/modal handlers

- Moderator IDs stored in environment variable
- Checked before processing approve/reject/revert actions
- Returns ephemeral error messages for unauthorized users

### 2.2 Areas for Improvement

#### Issue S-1: Webhook Secret Timing Attack (LOW)
**Location:** `src/index.ts:76-82`

```typescript
// Current implementation - vulnerable to timing attacks
if (!env.INTERNAL_WEBHOOK_SECRET || authHeader !== expectedAuth) {
  return c.json({ error: 'Unauthorized' }, 401);
}
```

**Risk:** String comparison using `!==` may be vulnerable to timing attacks.

**Recommendation:** Use constant-time comparison:
```typescript
import { timingSafeEqual } from 'crypto';

function secureCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}
```

#### Issue S-2: Missing Request Body Size Limit (LOW)
**Location:** `src/index.ts`

The main Discord interaction endpoint doesn't enforce a maximum request body size before parsing JSON.

**Recommendation:** Add body size validation before parsing:
```typescript
const body = await request.text();
if (body.length > 100000) { // 100KB limit
  return badRequestResponse('Request body too large');
}
```

#### Issue S-3: User Input in Error Messages (LOW)
**Location:** `src/handlers/commands/harmony.ts:154`

```typescript
embeds: [
  errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: colorInput })),
],
```

User input (`colorInput`) is displayed in error messages. While Discord embeds escape markdown, consider sanitizing inputs to prevent potential future issues.

#### Issue S-4: CORS Wildcard in Production (INFO)
**Location:** `src/index.ts:51`

```typescript
app.use('*', cors());
```

Using wildcard CORS is acceptable for a bot endpoint but consider restricting in production if not needed.

### 2.3 Security Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Ed25519 signature verification | ✅ PASS | Using discord-interactions library |
| SSRF protection for external URLs | ✅ PASS | Strict allowlist + private IP blocking |
| Rate limiting | ✅ PASS | Per-user, per-command limits |
| Input validation | ✅ PASS | Options validated before processing |
| Authorization checks | ✅ PASS | Moderator ID verification |
| Secrets in environment | ✅ PASS | Using Cloudflare secrets |
| SQL injection | ✅ N/A | Using D1 parameterized queries (in preset-api) |
| XSS | ✅ PASS | Discord embeds auto-escape |
| Timing attacks | ⚠️ WARN | Webhook secret comparison |
| File upload validation | ✅ PASS | Magic bytes + size limits |

---

## 3. Performance Optimization Opportunities

### 3.1 Current Performance Patterns (GOOD)

#### Deferred Responses
All long-running commands properly use `deferredResponse()` and `ctx.waitUntil()`:

```typescript
ctx.waitUntil(processHarmonyCommand(...));
return deferResponse;
```

This prevents Discord's 3-second timeout.

#### WASM Memory Management
**Location:** `src/services/image/photon.ts`

Proper cleanup of WASM memory in `finally` blocks:

```typescript
finally {
  if (resizedImage) {
    try { resizedImage.free(); } catch { }
  }
  if (originalImage && originalImage !== resizedImage) {
    try { originalImage.free(); } catch { }
  }
}
```

#### Service Bindings
**Location:** `src/services/preset-api.ts`

Uses Cloudflare Service Bindings for worker-to-worker communication, avoiding HTTP overhead:

```typescript
if (env.PRESETS_API) {
  response = await env.PRESETS_API.fetch(new Request(`https://internal${path}`, {...}));
}
```

### 3.2 Optimization Opportunities

#### Issue P-1: Redundant Locale Resolution (MEDIUM)
**Location:** Multiple command handlers

The locale is resolved multiple times per request in some handlers:

```typescript
// In handleHarmonyCommand:
const t = await createUserTranslator(env.KV, userId, interaction.locale);
// Later...
const locale = await resolveUserLocale(env.KV, userId, interaction.locale);
```

**Impact:** 2 KV reads instead of 1 per command.

**Recommendation:** Resolve locale once and pass to translator:
```typescript
const locale = await resolveUserLocale(env.KV, userId, interaction.locale);
const t = createTranslator(locale);
```

#### Issue P-2: Synchronous DyeService Initialization (LOW)
**Location:** Multiple command handlers

DyeService is instantiated at module level in each handler file:

```typescript
const dyeService = new DyeService(dyeDatabase);
```

While this works, it means the k-d tree is built on cold start for each isolate.

**Recommendation:** Consider lazy initialization or singleton pattern if startup time becomes an issue.

#### Issue P-3: SVG String Concatenation (LOW)
**Location:** `src/services/svg/*.ts`

SVG generation uses template literals with string concatenation. For very complex SVGs, this could be optimized.

**Current approach is acceptable** for the current SVG complexity level.

#### Issue P-4: Missing Response Caching Headers (INFO)
**Location:** `src/utils/response.ts`

Discord API responses don't benefit from HTTP caching, but the `/health` endpoint could set cache headers:

```typescript
app.get('/health', (c) => {
  c.header('Cache-Control', 'public, max-age=60');
  return c.json({...});
});
```

### 3.3 Performance Metrics to Monitor

| Metric | Target | Current Status |
|--------|--------|----------------|
| Cold start time | < 200ms | Unknown - needs monitoring |
| Image processing latency | < 3s | Acceptable (within Discord timeout) |
| KV read latency | < 50ms | Typically ~10-20ms |
| Service Binding latency | < 100ms | Minimal overhead |

---

## 4. Refactoring Recommendations

### 4.1 Code Duplication

#### Issue R-1: Duplicate DiscordInteraction Interface (HIGH)
**Location:** Multiple handler files

The `DiscordInteraction` interface is duplicated in:
- `src/index.ts:557-619`
- `src/handlers/commands/harmony.ts:35-54`
- `src/handlers/commands/match-image.ts:42-77`
- `src/handlers/commands/preset.ts:48-77`
- (and others)

Each has slightly different properties based on needs.

**Recommendation:** Create a single comprehensive interface in `src/types/discord.ts`:

```typescript
export interface DiscordInteraction {
  id: string;
  type: number;
  application_id: string;
  token: string;
  locale?: string;
  guild_id?: string;
  channel_id?: string;
  member?: {
    user: DiscordUser;
  };
  user?: DiscordUser;
  data?: InteractionData;
  message?: InteractionMessage;
}
```

#### Issue R-2: Duplicate ButtonInteraction/ModalInteraction Types (MEDIUM)
**Location:** `src/handlers/buttons/*.ts`, `src/handlers/modals/*.ts`

Similar interface duplication for button and modal interactions.

**Recommendation:** Consolidate into `src/types/discord.ts`.

### 4.2 Structural Improvements

#### Issue R-3: Large Index File (MEDIUM)
**Location:** `src/index.ts` (622 lines)

The main entry point handles:
- HTTP routing
- Interaction type routing
- Command dispatching
- Autocomplete logic
- Inline DiscordInteraction type

**Recommendation:** Extract into modules:
```
src/
├── index.ts           # Just Hono app setup and routes
├── routes/
│   ├── interactions.ts  # Main interaction handler
│   ├── webhooks.ts      # Webhook endpoints
│   └── health.ts        # Health check
├── handlers/
│   └── autocomplete.ts  # Autocomplete logic (currently inline)
```

#### Issue R-4: Inconsistent Error Handling Patterns (LOW)
**Location:** Various handlers

Some handlers use try/catch with error logging, others let errors propagate.

**Recommendation:** Create a consistent error handling wrapper:

```typescript
async function withErrorHandling<T>(
  fn: () => Promise<T>,
  fallback: T,
  context: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`Error in ${context}:`, error);
    return fallback;
  }
}
```

### 4.3 Missing Abstractions

#### Issue R-5: No Unified Response Builder (LOW)
**Location:** Various handlers

Creating Discord embeds is done inline with repetitive patterns.

**Recommendation:** Create builder helpers:

```typescript
// src/utils/embed-builder.ts
export function createDyeEmbed(dye: Dye, t: Translator): DiscordEmbed {
  return {
    title: getLocalizedDyeName(dye.itemID, dye.name),
    color: parseInt(dye.hex.replace('#', ''), 16),
    // ...standard dye embed fields
  };
}
```

#### Issue R-6: User ID Extraction Pattern (LOW)
**Location:** All command handlers

```typescript
const userId = interaction.member?.user?.id ?? interaction.user?.id;
```

This pattern is repeated in every handler.

**Recommendation:** Add utility function:

```typescript
// src/utils/interaction.ts
export function getUserId(interaction: DiscordInteraction): string | undefined {
  return interaction.member?.user?.id ?? interaction.user?.id;
}

export function getUsername(interaction: DiscordInteraction): string {
  return interaction.member?.user?.username
    ?? interaction.user?.username
    ?? 'Unknown';
}
```

### 4.4 Test Coverage Gaps

| Area | Coverage | Notes |
|------|----------|-------|
| SVG Generation | ✅ Good | Multiple test files |
| Image Validation | ✅ Good | `validators.test.ts` exists |
| Rate Limiter | ❌ Missing | No tests for rate-limiter.ts |
| Command Handlers | ❌ Missing | No unit tests for handlers |
| Integration | ❌ Missing | No E2E tests |

**Recommendation:** Add tests for:
1. Rate limiter edge cases (window expiry, KV failures)
2. Command handler mocking (mock Discord API responses)
3. Button/modal interaction flows

---

## 5. Risk Assessment

### 5.1 High Risk Items

None identified. The codebase has solid security fundamentals.

### 5.2 Medium Risk Items

| Issue | Risk | Mitigation |
|-------|------|------------|
| Duplicate types | Maintenance burden, inconsistencies | Consolidate to shared types |
| Missing rate limiter tests | Potential bugs in edge cases | Add unit tests |
| Large index.ts | Harder to maintain | Extract into modules |

### 5.3 Low Risk Items

| Issue | Risk | Mitigation |
|-------|------|------------|
| Webhook timing attack | Theoretical exploit | Use constant-time comparison |
| Redundant KV reads | Minor performance impact | Cache locale resolution |
| Missing request size limit | DoS potential (low) | Add size validation |

---

## 6. Recommended Action Items

### Immediate (Before Next Release)

1. **[S-1]** Implement constant-time comparison for webhook secret
2. **[R-1]** Consolidate DiscordInteraction types into `src/types/discord.ts`

### Short-term (Next Sprint)

3. **[P-1]** Fix redundant locale resolution in command handlers
4. **[R-3]** Extract autocomplete logic from index.ts
5. **[R-6]** Add user extraction utilities

### Medium-term (Next Month)

6. **[R-2]** Consolidate button/modal interaction types
7. Add rate limiter unit tests
8. Add command handler unit tests
9. Consider request body size limit

### Long-term (Backlog)

10. **[R-3]** Full index.ts modularization
11. **[R-5]** Create embed builder utilities
12. Set up E2E testing with mocked Discord API

---

## Appendix A: File Structure Reference

```
xivdyetools-discord-worker/
├── src/
│   ├── index.ts                 # Main entry point (622 lines)
│   ├── handlers/
│   │   ├── commands/
│   │   │   ├── index.ts         # Command exports
│   │   │   ├── harmony.ts       # /harmony command
│   │   │   ├── match-image.ts   # /match_image command
│   │   │   ├── preset.ts        # /preset command (1208 lines - largest)
│   │   │   └── ...
│   │   ├── buttons/
│   │   │   ├── index.ts         # Button router
│   │   │   ├── copy.ts          # Copy buttons
│   │   │   └── preset-moderation.ts
│   │   └── modals/
│   │       ├── index.ts
│   │       └── preset-rejection.ts
│   ├── services/
│   │   ├── image/
│   │   │   ├── photon.ts        # WASM image processing
│   │   │   └── validators.ts    # SSRF protection
│   │   ├── svg/
│   │   │   ├── renderer.ts      # WASM SVG-to-PNG
│   │   │   └── ...              # SVG generators
│   │   ├── rate-limiter.ts      # KV-backed rate limiting
│   │   ├── user-storage.ts      # Favorites/collections
│   │   ├── preset-api.ts        # Preset API client
│   │   ├── i18n.ts              # Locale resolution
│   │   └── bot-i18n.ts          # Bot UI translations
│   ├── types/
│   │   ├── env.ts               # Environment bindings
│   │   ├── preset.ts            # Preset types
│   │   └── image.ts             # Image types
│   ├── utils/
│   │   ├── verify.ts            # Ed25519 verification
│   │   ├── response.ts          # Response builders
│   │   └── discord-api.ts       # REST API utilities
│   └── locales/
│       └── *.json               # Translation files
├── wrangler.toml                # Worker config
└── package.json
```

---

## Appendix B: Dependencies Security Status

| Package | Version | Status | Notes |
|---------|---------|--------|-------|
| hono | 4.10.7 | ✅ Current | No known vulnerabilities |
| discord-interactions | 4.4.0 | ✅ Current | Trusted for Ed25519 |
| @cf-wasm/photon | 0.3.4 | ✅ Current | Cloudflare-maintained |
| @resvg/resvg-wasm | 2.6.2 | ✅ Current | No known vulnerabilities |
| xivdyetools-core | 1.3.6 | ✅ Current | Internal package |

---

*This analysis was conducted on December 7, 2025. Findings should be re-evaluated as the codebase evolves.*
