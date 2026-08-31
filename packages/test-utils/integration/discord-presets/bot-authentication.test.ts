/**
 * Discord Worker → Presets API Integration Tests: Bot Authentication
 *
 * Tests that the Discord worker can authenticate with the Presets API
 * using bot credentials, via the local development/test bypass this
 * middleware simulation still models.
 *
 * These tests verify:
 * - Bot authentication with BOT_API_SECRET works (dev/test, unsigned)
 * - User context headers are properly passed through
 * - Moderator status is recognized from user context
 * - Wrong API secret / missing Authorization are rejected
 *
 * Does NOT cover the signed (production) bot-request path. Until
 * 2026-08-31 this file modeled v1's HMAC scheme (`timestamp:userId:userName`)
 * — but that was already a fiction by the time it was removed: presets-api
 * stopped accepting v1 in 2.2.0 (2026-08-30) and started accepting only
 * `X-Request-Signature-V2`, which this simulation never modeled at all. The
 * v1-signature test blocks and the local verifier/header builders they used
 * were deleted (FINDING-015, 2026-08-29 security audit, Sprint 11 fix round)
 * rather than left passing against a contract no longer in production.
 * Porting this harness to sign with `@xivdyetools/auth`'s
 * `createBotSignatureV2` would restore coverage of the signed path — a
 * follow-up, not done here.
 *
 * @module integration/discord-presets/bot-authentication
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockPresetsEnv,
  createBotHeaders,
  testUsers,
  type MockPresetsEnv,
} from '../setup.js';

// ============================================================================
// Simulated Bot Auth Middleware (mirrors the dev/test + API-secret-gate
// subset of presets-api/src/middleware/auth.ts — not the v2 signature path)
// ============================================================================

interface AuthContext {
  isAuthenticated: boolean;
  isModerator: boolean;
  userDiscordId?: string;
  userName?: string;
  authSource: 'none' | 'bot' | 'web';
}

function checkModerator(userDiscordId: string | undefined, moderatorIds: string): boolean {
  if (!userDiscordId || !moderatorIds) return false;
  const ids = moderatorIds.split(/[\s,]+/).filter(Boolean);
  return ids.includes(userDiscordId);
}

/**
 * Simulates the auth middleware processing bot authentication
 */
async function processBotAuth(
  headers: Record<string, string>,
  env: {
    BOT_API_SECRET: string;
    BOT_SIGNING_SECRET?: string;
    MODERATOR_IDS: string;
    ENVIRONMENT: string;
  }
): Promise<AuthContext> {
  let auth: AuthContext = {
    isAuthenticated: false,
    isModerator: false,
    authSource: 'none',
  };

  const authHeader = headers['Authorization'];
  const userDiscordId = headers['X-User-Discord-ID'];
  const userName = headers['X-User-Discord-Name'];

  if (!authHeader?.startsWith('Bearer ')) {
    return auth;
  }

  const token = authHeader.slice(7);

  // Bot authentication
  if (token === env.BOT_API_SECRET) {
    const isDevOrTest = env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'test';

    if (!env.BOT_SIGNING_SECRET && isDevOrTest) {
      // Allow unsigned bot auth in development/test
      auth = {
        isAuthenticated: true,
        isModerator: checkModerator(userDiscordId, env.MODERATOR_IDS),
        userDiscordId: userDiscordId || undefined,
        userName: userName || undefined,
        authSource: 'bot',
      };
    }
    // Otherwise (production without a signing secret, or ANY request with
    // one configured) stays unauthenticated. This simulation's HMAC
    // verifier (`verifyBotRequestSignature`, v1's `timestamp:userId:userName`
    // format) was removed with the v1-signature test blocks it existed to
    // support (FINDING-015, 2026-08-29 audit, Sprint 11 fix round) — it
    // never modeled the live v2 contract, so nothing of value was lost by
    // not replacing it here. See the module comment above for the gap.
  }

  return auth;
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Discord Worker → Presets API: Bot Authentication', () => {
  let env: MockPresetsEnv;

  beforeEach(() => {
    env = createMockPresetsEnv();
  });

  describe('Bot Authentication without Signature (Development/Test)', () => {
    it('should authenticate bot with API secret in test environment', async () => {
      const headers = createBotHeaders(
        testUsers.normalUser.discordId,
        testUsers.normalUser.username
      );

      const authContext = await processBotAuth(headers, {
        BOT_API_SECRET: env.BOT_API_SECRET,
        BOT_SIGNING_SECRET: undefined, // No signature required
        MODERATOR_IDS: env.MODERATOR_IDS,
        ENVIRONMENT: 'test',
      });

      expect(authContext.isAuthenticated).toBe(true);
      expect(authContext.authSource).toBe('bot');
      expect(authContext.userDiscordId).toBe(testUsers.normalUser.discordId);
    });

    it('should authenticate bot without user context headers', async () => {
      const headers = createBotHeaders(); // No user headers

      const authContext = await processBotAuth(headers, {
        BOT_API_SECRET: env.BOT_API_SECRET,
        BOT_SIGNING_SECRET: undefined,
        MODERATOR_IDS: env.MODERATOR_IDS,
        ENVIRONMENT: 'test',
      });

      expect(authContext.isAuthenticated).toBe(true);
      expect(authContext.userDiscordId).toBeUndefined();
    });

    it('should recognize moderator from user context', async () => {
      const headers = createBotHeaders(
        testUsers.moderator.discordId,
        testUsers.moderator.username
      );

      const authContext = await processBotAuth(headers, {
        BOT_API_SECRET: env.BOT_API_SECRET,
        BOT_SIGNING_SECRET: undefined,
        MODERATOR_IDS: env.MODERATOR_IDS,
        ENVIRONMENT: 'test',
      });

      expect(authContext.isAuthenticated).toBe(true);
      expect(authContext.isModerator).toBe(true);
    });
  });

  describe('Invalid Bot Authentication', () => {
    it('should reject wrong API secret', async () => {
      const headers = {
        Authorization: 'Bearer wrong-api-secret',
        'Content-Type': 'application/json',
      };

      const authContext = await processBotAuth(headers, {
        BOT_API_SECRET: env.BOT_API_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
        ENVIRONMENT: 'test',
      });

      expect(authContext.isAuthenticated).toBe(false);
    });

    it('should reject missing Authorization header', async () => {
      const headers = {
        'Content-Type': 'application/json',
        'X-User-Discord-ID': testUsers.normalUser.discordId,
      };

      const authContext = await processBotAuth(headers, {
        BOT_API_SECRET: env.BOT_API_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
        ENVIRONMENT: 'test',
      });

      expect(authContext.isAuthenticated).toBe(false);
    });
  });
});
