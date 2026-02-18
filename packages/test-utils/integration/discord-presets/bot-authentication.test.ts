/**
 * Discord Worker → Presets API Integration Tests: Bot Authentication
 *
 * Tests that the Discord worker can authenticate with the Presets API
 * using bot credentials and HMAC signatures.
 *
 * These tests verify:
 * - Bot authentication with BOT_API_SECRET works
 * - HMAC signature validation for production environments
 * - User context headers are properly passed through
 * - Invalid signatures are rejected
 * - Moderation operations work through bot auth
 *
 * @module integration/discord-presets/bot-authentication
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockPresetsEnv,
  createBotHeaders,
  createSignedBotHeaders,
  createInvalidSignatureHeaders,
  testUsers,
  BOT_API_SECRET,
  BOT_SIGNING_SECRET,
  MODERATOR_IDS,
  type MockPresetsEnv,
} from '../setup.js';
import { createBotSignature, createTimestampedSignature } from '../../src/auth/signature.js';

// ============================================================================
// Simulated Bot Auth Middleware (mirrors presets-api/src/middleware/auth.ts)
// ============================================================================

interface AuthContext {
  isAuthenticated: boolean;
  isModerator: boolean;
  userDiscordId?: string;
  userName?: string;
  authSource: 'none' | 'bot' | 'web';
}

const SIGNATURE_MAX_AGE_SECONDS = 120;

async function verifyBotRequestSignature(
  signature: string | undefined,
  timestamp: string | undefined,
  userDiscordId: string | undefined,
  userName: string | undefined,
  signingSecret: string
): Promise<boolean> {
  if (!signature || !timestamp) return false;

  const requestTime = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(requestTime) || Math.abs(now - requestTime) > SIGNATURE_MAX_AGE_SECONDS) {
    return false;
  }

  const message = `${timestamp}:${userDiscordId || ''}:${userName || ''}`;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(signingSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    return await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(message));
  } catch {
    return false;
  }
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

    if (!env.BOT_SIGNING_SECRET) {
      if (isDevOrTest) {
        // Allow unsigned bot auth in development/test
        auth = {
          isAuthenticated: true,
          isModerator: checkModerator(userDiscordId, env.MODERATOR_IDS),
          userDiscordId: userDiscordId || undefined,
          userName: userName || undefined,
          authSource: 'bot',
        };
      }
      // In production without signing secret, reject
    } else {
      // Verify HMAC signature
      const signature = headers['X-Request-Signature'];
      const timestamp = headers['X-Request-Timestamp'];

      const isValidSignature = await verifyBotRequestSignature(
        signature,
        timestamp,
        userDiscordId,
        userName,
        env.BOT_SIGNING_SECRET
      );

      if (isValidSignature) {
        auth = {
          isAuthenticated: true,
          isModerator: checkModerator(userDiscordId, env.MODERATOR_IDS),
          userDiscordId: userDiscordId || undefined,
          userName: userName || undefined,
          authSource: 'bot',
        };
      }
    }
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

  describe('Bot Authentication with HMAC Signature (Production)', () => {
    it('should authenticate with valid HMAC signature', async () => {
      const headers = await createSignedBotHeaders(
        testUsers.normalUser.discordId,
        testUsers.normalUser.username
      );

      const authContext = await processBotAuth(headers, {
        BOT_API_SECRET: env.BOT_API_SECRET,
        BOT_SIGNING_SECRET: env.BOT_SIGNING_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
        ENVIRONMENT: 'production',
      });

      expect(authContext.isAuthenticated).toBe(true);
      expect(authContext.authSource).toBe('bot');
      expect(authContext.userDiscordId).toBe(testUsers.normalUser.discordId);
    });

    it('should reject request with expired timestamp', async () => {
      const headers = await createInvalidSignatureHeaders(
        testUsers.normalUser.discordId,
        testUsers.normalUser.username
      );

      const authContext = await processBotAuth(headers, {
        BOT_API_SECRET: env.BOT_API_SECRET,
        BOT_SIGNING_SECRET: env.BOT_SIGNING_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
        ENVIRONMENT: 'production',
      });

      expect(authContext.isAuthenticated).toBe(false);
    });

    it('should reject request with tampered user ID', async () => {
      // Create valid signature for one user
      const { signature, timestamp } = await createTimestampedSignature(
        testUsers.normalUser.discordId,
        testUsers.normalUser.username,
        BOT_SIGNING_SECRET
      );

      // But send different user ID in headers (spoofing attempt)
      const headers = {
        Authorization: `Bearer ${BOT_API_SECRET}`,
        'Content-Type': 'application/json',
        'X-User-Discord-ID': testUsers.anotherUser.discordId, // Tampered!
        'X-User-Discord-Name': testUsers.normalUser.username,
        'X-Request-Timestamp': timestamp,
        'X-Request-Signature': signature,
      };

      const authContext = await processBotAuth(headers, {
        BOT_API_SECRET: env.BOT_API_SECRET,
        BOT_SIGNING_SECRET: env.BOT_SIGNING_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
        ENVIRONMENT: 'production',
      });

      // Should reject because signature doesn't match tampered headers
      expect(authContext.isAuthenticated).toBe(false);
    });

    it('should reject request with wrong signing secret', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = await createBotSignature(
        timestamp,
        testUsers.normalUser.discordId,
        testUsers.normalUser.username,
        'wrong-signing-secret' // Wrong secret
      );

      const headers = {
        Authorization: `Bearer ${BOT_API_SECRET}`,
        'Content-Type': 'application/json',
        'X-User-Discord-ID': testUsers.normalUser.discordId,
        'X-User-Discord-Name': testUsers.normalUser.username,
        'X-Request-Timestamp': timestamp,
        'X-Request-Signature': signature,
      };

      const authContext = await processBotAuth(headers, {
        BOT_API_SECRET: env.BOT_API_SECRET,
        BOT_SIGNING_SECRET: env.BOT_SIGNING_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
        ENVIRONMENT: 'production',
      });

      expect(authContext.isAuthenticated).toBe(false);
    });

    it('should reject request without signature in production', async () => {
      const headers = createBotHeaders(
        testUsers.normalUser.discordId,
        testUsers.normalUser.username
      );

      const authContext = await processBotAuth(headers, {
        BOT_API_SECRET: env.BOT_API_SECRET,
        BOT_SIGNING_SECRET: env.BOT_SIGNING_SECRET, // Signing secret is set
        MODERATOR_IDS: env.MODERATOR_IDS,
        ENVIRONMENT: 'production',
      });

      // No signature provided, should reject
      expect(authContext.isAuthenticated).toBe(false);
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

  describe('Signature Timing Window', () => {
    it('should accept signature within 2 minute window', async () => {
      // Create signature with current timestamp
      const headers = await createSignedBotHeaders(
        testUsers.normalUser.discordId,
        testUsers.normalUser.username
      );

      const authContext = await processBotAuth(headers, {
        BOT_API_SECRET: env.BOT_API_SECRET,
        BOT_SIGNING_SECRET: env.BOT_SIGNING_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
        ENVIRONMENT: 'production',
      });

      expect(authContext.isAuthenticated).toBe(true);
    });

    it('should reject signature with timestamp more than 2 minutes old', async () => {
      // Create signature with 5 minute old timestamp
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 300).toString();
      const signature = await createBotSignature(
        oldTimestamp,
        testUsers.normalUser.discordId,
        testUsers.normalUser.username,
        BOT_SIGNING_SECRET
      );

      const headers = {
        Authorization: `Bearer ${BOT_API_SECRET}`,
        'Content-Type': 'application/json',
        'X-User-Discord-ID': testUsers.normalUser.discordId,
        'X-User-Discord-Name': testUsers.normalUser.username,
        'X-Request-Timestamp': oldTimestamp,
        'X-Request-Signature': signature,
      };

      const authContext = await processBotAuth(headers, {
        BOT_API_SECRET: env.BOT_API_SECRET,
        BOT_SIGNING_SECRET: env.BOT_SIGNING_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
        ENVIRONMENT: 'production',
      });

      expect(authContext.isAuthenticated).toBe(false);
    });

    it('should reject signature with future timestamp', async () => {
      // Create signature with 5 minute future timestamp
      const futureTimestamp = (Math.floor(Date.now() / 1000) + 300).toString();
      const signature = await createBotSignature(
        futureTimestamp,
        testUsers.normalUser.discordId,
        testUsers.normalUser.username,
        BOT_SIGNING_SECRET
      );

      const headers = {
        Authorization: `Bearer ${BOT_API_SECRET}`,
        'Content-Type': 'application/json',
        'X-User-Discord-ID': testUsers.normalUser.discordId,
        'X-User-Discord-Name': testUsers.normalUser.username,
        'X-Request-Timestamp': futureTimestamp,
        'X-Request-Signature': signature,
      };

      const authContext = await processBotAuth(headers, {
        BOT_API_SECRET: env.BOT_API_SECRET,
        BOT_SIGNING_SECRET: env.BOT_SIGNING_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
        ENVIRONMENT: 'production',
      });

      expect(authContext.isAuthenticated).toBe(false);
    });
  });

  describe('Moderation via Bot Auth', () => {
    it('should allow moderator to perform moderation actions', async () => {
      const headers = await createSignedBotHeaders(
        testUsers.moderator.discordId,
        testUsers.moderator.username
      );

      const authContext = await processBotAuth(headers, {
        BOT_API_SECRET: env.BOT_API_SECRET,
        BOT_SIGNING_SECRET: env.BOT_SIGNING_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
        ENVIRONMENT: 'production',
      });

      expect(authContext.isAuthenticated).toBe(true);
      expect(authContext.isModerator).toBe(true);
      expect(authContext.authSource).toBe('bot');
    });

    it('should not grant moderator status to non-moderator users', async () => {
      const headers = await createSignedBotHeaders(
        testUsers.normalUser.discordId,
        testUsers.normalUser.username
      );

      const authContext = await processBotAuth(headers, {
        BOT_API_SECRET: env.BOT_API_SECRET,
        BOT_SIGNING_SECRET: env.BOT_SIGNING_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
        ENVIRONMENT: 'production',
      });

      expect(authContext.isAuthenticated).toBe(true);
      expect(authContext.isModerator).toBe(false);
    });
  });
});
