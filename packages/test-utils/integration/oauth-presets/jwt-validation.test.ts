/**
 * OAuth → Presets API Integration Tests: JWT Validation
 *
 * Tests that JWTs created by the OAuth worker are correctly validated
 * by the Presets API. Both services share the same JWT_SECRET.
 *
 * These tests verify:
 * - Valid JWTs authenticate successfully
 * - Expired JWTs are rejected
 * - Invalid JWTs are rejected
 * - User context is extracted correctly from JWT claims
 * - Moderator status is recognized from JWT user ID
 *
 * @module integration/oauth-presets/jwt-validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockPresetsEnv,
  createUserJWT,
  createExpiredUserJWT,
  createWebAuthHeaders,
  createExpiredWebAuthHeaders,
  testUsers,
  SHARED_JWT_SECRET,
  MODERATOR_IDS,
} from '../setup.js';
import { createTestJWT } from '../../src/auth/jwt.js';

// ============================================================================
// Simulated Auth Middleware (mirrors presets-api/src/middleware/auth.ts)
// ============================================================================

interface JWTPayload {
  sub: string;
  iat: number;
  exp: number;
  iss: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

interface AuthContext {
  isAuthenticated: boolean;
  isModerator: boolean;
  userDiscordId?: string;
  userName?: string;
  authSource: 'none' | 'bot' | 'web';
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  const decoded = atob(base64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;

    // Validate algorithm
    const header = JSON.parse(base64UrlDecode(encodedHeader));
    if (header.alg !== 'HS256') return null;

    // Verify signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    let sigBase64 = signature.replace(/-/g, '+').replace(/_/g, '/');
    const sigPadding = sigBase64.length % 4;
    if (sigPadding) {
      sigBase64 += '='.repeat(4 - sigPadding);
    }
    const sigBytes = Uint8Array.from(atob(sigBase64), (c) => c.charCodeAt(0));

    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(signatureInput)
    );

    if (!isValid) return null;

    // Decode payload
    const payload: JWTPayload = JSON.parse(base64UrlDecode(encodedPayload));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

function checkModerator(userDiscordId: string | undefined, moderatorIds: string): boolean {
  if (!userDiscordId || !moderatorIds) return false;
  const ids = moderatorIds.split(/[\s,]+/).filter(Boolean);
  return ids.includes(userDiscordId);
}

/**
 * Simulates the auth middleware processing a request
 */
async function processAuth(
  authHeader: string | undefined,
  env: { JWT_SECRET: string; MODERATOR_IDS: string }
): Promise<AuthContext> {
  let auth: AuthContext = {
    isAuthenticated: false,
    isModerator: false,
    authSource: 'none',
  };

  if (!authHeader?.startsWith('Bearer ')) {
    return auth;
  }

  const token = authHeader.slice(7);
  const jwtPayload = await verifyJWT(token, env.JWT_SECRET);

  if (jwtPayload) {
    const displayName = jwtPayload.global_name || jwtPayload.username;
    auth = {
      isAuthenticated: true,
      isModerator: checkModerator(jwtPayload.sub, env.MODERATOR_IDS),
      userDiscordId: jwtPayload.sub,
      userName: displayName,
      authSource: 'web',
    };
  }

  return auth;
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('OAuth → Presets API: JWT Validation', () => {
  let env: ReturnType<typeof createMockPresetsEnv>;

  beforeEach(() => {
    env = createMockPresetsEnv();
  });

  describe('Valid JWT Authentication', () => {
    it('should authenticate a normal user with valid JWT', async () => {
      const headers = await createWebAuthHeaders(testUsers.normalUser);
      const authContext = await processAuth(headers.Authorization, {
        JWT_SECRET: env.JWT_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
      });

      expect(authContext.isAuthenticated).toBe(true);
      expect(authContext.authSource).toBe('web');
      expect(authContext.userDiscordId).toBe(testUsers.normalUser.discordId);
      expect(authContext.userName).toBe(testUsers.normalUser.globalName);
      expect(authContext.isModerator).toBe(false);
    });

    it('should authenticate a moderator and recognize moderator status', async () => {
      const headers = await createWebAuthHeaders(testUsers.moderator);
      const authContext = await processAuth(headers.Authorization, {
        JWT_SECRET: env.JWT_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
      });

      expect(authContext.isAuthenticated).toBe(true);
      expect(authContext.userDiscordId).toBe(testUsers.moderator.discordId);
      expect(authContext.isModerator).toBe(true);
    });

    it('should use global_name when available, fallback to username', async () => {
      // User with global_name
      const jwt1 = await createTestJWT(SHARED_JWT_SECRET, {
        sub: '123',
        username: 'username123',
        global_name: 'Display Name',
      });
      const auth1 = await processAuth(`Bearer ${jwt1}`, {
        JWT_SECRET: env.JWT_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
      });
      expect(auth1.userName).toBe('Display Name');

      // User without global_name (null)
      const jwt2 = await createTestJWT(SHARED_JWT_SECRET, {
        sub: '456',
        username: 'fallback_user',
        global_name: null,
      });
      const auth2 = await processAuth(`Bearer ${jwt2}`, {
        JWT_SECRET: env.JWT_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
      });
      expect(auth2.userName).toBe('fallback_user');
    });
  });

  describe('JWT Expiration', () => {
    it('should reject expired JWT', async () => {
      const headers = await createExpiredWebAuthHeaders(testUsers.normalUser);
      const authContext = await processAuth(headers.Authorization, {
        JWT_SECRET: env.JWT_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
      });

      expect(authContext.isAuthenticated).toBe(false);
      expect(authContext.authSource).toBe('none');
    });

    it('should accept JWT that expires in the future', async () => {
      // JWT with 1 hour expiry
      const jwt = await createTestJWT(
        SHARED_JWT_SECRET,
        { sub: '123', username: 'test' },
        3600 // 1 hour
      );
      const authContext = await processAuth(`Bearer ${jwt}`, {
        JWT_SECRET: env.JWT_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
      });

      expect(authContext.isAuthenticated).toBe(true);
    });
  });

  describe('Invalid JWT Handling', () => {
    it('should reject JWT with wrong secret', async () => {
      const jwt = await createTestJWT(
        'wrong-secret-key-that-does-not-match',
        { sub: '123', username: 'test' }
      );
      const authContext = await processAuth(`Bearer ${jwt}`, {
        JWT_SECRET: env.JWT_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
      });

      expect(authContext.isAuthenticated).toBe(false);
    });

    it('should reject malformed JWT', async () => {
      const malformedTokens = [
        'not.a.valid.jwt.token',
        'only-one-part',
        'two.parts',
        '',
        'eyJhbGciOiJIUzI1NiJ9.eyJ0ZXN0IjoidGVzdCJ9', // missing signature
      ];

      for (const token of malformedTokens) {
        const authContext = await processAuth(`Bearer ${token}`, {
          JWT_SECRET: env.JWT_SECRET,
          MODERATOR_IDS: env.MODERATOR_IDS,
        });
        expect(authContext.isAuthenticated).toBe(false);
      }
    });

    it('should reject JWT with non-HS256 algorithm', async () => {
      // Manually create JWT with different algorithm header
      const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const payload = btoa(JSON.stringify({ sub: '123', username: 'test', iat: 0, exp: 9999999999 }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const fakeToken = `${header}.${payload}.fakesignature`;

      const authContext = await processAuth(`Bearer ${fakeToken}`, {
        JWT_SECRET: env.JWT_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
      });

      expect(authContext.isAuthenticated).toBe(false);
    });

    it('should handle missing Authorization header', async () => {
      const authContext = await processAuth(undefined, {
        JWT_SECRET: env.JWT_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
      });

      expect(authContext.isAuthenticated).toBe(false);
      expect(authContext.authSource).toBe('none');
    });

    it('should handle non-Bearer authorization', async () => {
      const authContext = await processAuth('Basic dXNlcjpwYXNz', {
        JWT_SECRET: env.JWT_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
      });

      expect(authContext.isAuthenticated).toBe(false);
    });
  });

  describe('Cross-Service JWT Sharing', () => {
    it('should validate JWT created with same secret used by OAuth worker', async () => {
      // This simulates: OAuth creates JWT -> User sends to Presets API -> API validates
      const jwt = await createUserJWT(testUsers.normalUser);

      // Verify the JWT is correctly formatted
      expect(jwt.split('.')).toHaveLength(3);

      // Verify Presets API can validate it
      const authContext = await processAuth(`Bearer ${jwt}`, {
        JWT_SECRET: SHARED_JWT_SECRET,
        MODERATOR_IDS,
      });

      expect(authContext.isAuthenticated).toBe(true);
      expect(authContext.userDiscordId).toBe(testUsers.normalUser.discordId);
    });

    it('should extract user identity consistently across both services', async () => {
      // Both OAuth and Presets API should see the same user identity
      const jwt = await createUserJWT(testUsers.normalUser);
      const authContext = await processAuth(`Bearer ${jwt}`, {
        JWT_SECRET: SHARED_JWT_SECRET,
        MODERATOR_IDS,
      });

      // The user ID in authContext should match what OAuth put in the JWT
      expect(authContext.userDiscordId).toBe(testUsers.normalUser.discordId);
      expect(authContext.userName).toBe(testUsers.normalUser.globalName);
    });
  });

  describe('User Creation Flow', () => {
    it('should authenticate newly created user from OAuth flow', async () => {
      // Simulate OAuth flow: new user logs in, gets JWT
      const newUser = {
        id: 'new-user-001',
        discordId: '999999999999999999',
        username: 'newuser',
        globalName: 'New User',
        avatar: 'hash123',
        isModerator: false,
      };

      const jwt = await createUserJWT(newUser);
      const authContext = await processAuth(`Bearer ${jwt}`, {
        JWT_SECRET: env.JWT_SECRET,
        MODERATOR_IDS: env.MODERATOR_IDS,
      });

      expect(authContext.isAuthenticated).toBe(true);
      expect(authContext.userDiscordId).toBe(newUser.discordId);
      expect(authContext.isModerator).toBe(false);
    });
  });
});
