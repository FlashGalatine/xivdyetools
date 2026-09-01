/**
 * Integration Test Setup
 *
 * Provides shared utilities for cross-service integration tests.
 * Creates simulated environments that mimic real worker interactions.
 *
 * @module integration/setup
 * @testonly shared fixture factory for the discord-presets and oauth-presets
 * cross-service integration suites; only tests construct these mock environments.
 */

import { createMockD1Database, type MockD1Database } from '../src/cloudflare/d1.js';
import { createMockKV, type MockKVNamespace } from '../src/cloudflare/kv.js';
import { createTestJWT, createExpiredJWT } from '../src/auth/jwt.js';

// ============================================================================
// Shared Test Constants
// ============================================================================

/** Shared JWT secret (used by both OAuth and Presets API) */
export const SHARED_JWT_SECRET = 'test-jwt-secret-key-for-testing-32chars';

/** Bot API secret for Discord worker authentication */
export const BOT_API_SECRET = 'test-bot-api-secret';

/**
 * Bot signing secret for HMAC request signatures (>= 32 bytes, FINDING-009).
 * Was `= TEST_SIGNING_SECRET` (re-exported from the now-deleted `../src/auth/signature.js`)
 * until 2026-08-31 (FINDING-015, Sprint 11 fix round) — inlined here since it now has
 * no signing helper left to share the value with; kept as the same literal so any
 * fixture that happened to compare against the old string is unaffected.
 */
export const BOT_SIGNING_SECRET = 'test-signing-secret-at-least-32-bytes!!!';

/** Moderator Discord IDs */
export const MODERATOR_IDS = '111111111111111111,222222222222222222';

/** OAuth worker URL (issuer for JWTs) */
export const OAUTH_WORKER_URL = 'https://oauth.xivdyetools.com';

/** Presets API URL */
export const PRESETS_API_URL = 'https://api.xivdyetools.com';

// ============================================================================
// Mock User Data
// ============================================================================

export interface MockUser {
  id: string;
  discordId: string;
  username: string;
  globalName: string;
  avatar: string | null;
  isModerator: boolean;
}

export const testUsers: Record<string, MockUser> = {
  normalUser: {
    id: 'user-001',
    discordId: '333333333333333333',
    username: 'testuser',
    globalName: 'Test User',
    avatar: null,
    isModerator: false,
  },
  moderator: {
    id: 'user-002',
    discordId: '111111111111111111', // Matches MODERATOR_IDS
    username: 'moduser',
    globalName: 'Moderator User',
    avatar: 'abc123',
    isModerator: true,
  },
  anotherUser: {
    id: 'user-003',
    discordId: '444444444444444444',
    username: 'another',
    globalName: 'Another User',
    avatar: null,
    isModerator: false,
  },
};

// ============================================================================
// Preset Mock Environment
// ============================================================================

export interface MockPresetsEnv {
  DB: MockD1Database;
  ENVIRONMENT: string;
  API_VERSION: string;
  CORS_ORIGIN: string;
  BOT_API_SECRET: string;
  BOT_SIGNING_SECRET: string;
  MODERATOR_IDS: string;
  JWT_SECRET: string;
}

/**
 * Create a mock Presets API environment
 */
export function createMockPresetsEnv(overrides: Partial<MockPresetsEnv> = {}): MockPresetsEnv {
  return {
    DB: createMockD1Database(),
    ENVIRONMENT: 'test',
    API_VERSION: 'v1',
    CORS_ORIGIN: 'http://localhost:3000',
    BOT_API_SECRET,
    BOT_SIGNING_SECRET,
    MODERATOR_IDS,
    JWT_SECRET: SHARED_JWT_SECRET,
    ...overrides,
  };
}

// ============================================================================
// OAuth Mock Environment
// ============================================================================

export interface MockOAuthEnv {
  DB: MockD1Database;
  ENVIRONMENT: string;
  WORKER_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRY: string;
  TOKEN_BLACKLIST?: MockKVNamespace;
}

/**
 * Create a mock OAuth environment
 */
export function createMockOAuthEnv(overrides: Partial<MockOAuthEnv> = {}): MockOAuthEnv {
  return {
    DB: createMockD1Database(),
    ENVIRONMENT: 'test',
    WORKER_URL: OAUTH_WORKER_URL,
    JWT_SECRET: SHARED_JWT_SECRET,
    JWT_EXPIRY: '3600',
    ...overrides,
  };
}

// ============================================================================
// JWT Creation (Simulates OAuth Worker)
// ============================================================================

/**
 * Simulate OAuth worker creating a JWT for a user
 * Uses the shared JWT secret so Presets API can verify it
 */
export async function createUserJWT(user: MockUser): Promise<string> {
  return createTestJWT(SHARED_JWT_SECRET, {
    sub: user.discordId,
    username: user.username,
    global_name: user.globalName,
    avatar: user.avatar,
  });
}

/**
 * Create an expired JWT (for testing token refresh flows)
 */
export async function createExpiredUserJWT(user: MockUser): Promise<string> {
  return createExpiredJWT(SHARED_JWT_SECRET, {
    sub: user.discordId,
    username: user.username,
    global_name: user.globalName,
  });
}

// ============================================================================
// Bot Authentication Helpers (Simulates Discord Worker)
// ============================================================================

export interface BotAuthHeaders {
  Authorization: string;
  'Content-Type': string;
  'X-User-Discord-ID'?: string;
  'X-User-Discord-Name'?: string;
}

/**
 * Create headers for bot authentication (without HMAC signature)
 * Used for development/test environments where signature is optional
 */
export function createBotHeaders(
  userDiscordId?: string,
  userName?: string
): BotAuthHeaders {
  const headers: BotAuthHeaders = {
    Authorization: `Bearer ${BOT_API_SECRET}`,
    'Content-Type': 'application/json',
  };

  if (userDiscordId) {
    headers['X-User-Discord-ID'] = userDiscordId;
  }
  if (userName) {
    headers['X-User-Discord-Name'] = userName;
  }

  return headers;
}

// `createSignedBotHeaders` / `createInvalidSignatureHeaders` (v1 HMAC-signed header
// builders) were removed 2026-08-31 (FINDING-015, Sprint 11 fix round) along with the
// v1-signature test blocks they existed to support — presets-api has accepted only
// `X-Request-Signature-V2` since 2.2.0, and neither builder ever produced that header.
// A v2 equivalent (using `@xivdyetools/auth`'s `createBotSignatureV2`) would need to be
// written from scratch, not adapted from these; see bot-authentication.test.ts's module
// comment for the coverage gap this leaves.

// ============================================================================
// Web Authentication Helpers (Simulates Web App)
// ============================================================================

export interface WebAuthHeaders {
  Authorization: string;
  'Content-Type': string;
}

/**
 * Create headers for web authentication with JWT
 */
export async function createWebAuthHeaders(user: MockUser): Promise<WebAuthHeaders> {
  const jwt = await createUserJWT(user);
  return {
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Create headers with an expired JWT
 */
export async function createExpiredWebAuthHeaders(user: MockUser): Promise<WebAuthHeaders> {
  const jwt = await createExpiredUserJWT(user);
  return {
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/json',
  };
}

// ============================================================================
// Request Builders
// ============================================================================

/**
 * Build a Request object for testing
 */
export function buildRequest(
  method: string,
  path: string,
  options: {
    headers?: Record<string, string>;
    body?: unknown;
    baseUrl?: string;
  } = {}
): Request {
  const url = `${options.baseUrl || PRESETS_API_URL}${path}`;
  const init: RequestInit = {
    method,
    headers: options.headers || { 'Content-Type': 'application/json' },
  };

  if (options.body && method !== 'GET') {
    init.body = JSON.stringify(options.body);
  }

  return new Request(url, init);
}

// ============================================================================
// Database Seeding Helpers
// ============================================================================

/**
 * Seed a preset into the mock database
 */
export function seedPreset(
  db: MockD1Database,
  preset: {
    id: string;
    name: string;
    description: string;
    category_id: string;
    dyes: number[];
    author_discord_id: string;
    author_name: string;
    status?: string;
    vote_count?: number;
  }
): void {
  db._setupMock((query, bindings) => {
    if (query.includes('SELECT') && query.includes('WHERE id = ?')) {
      const queryId = bindings[bindings.length - 1];
      if (queryId === preset.id) {
        return {
          id: preset.id,
          name: preset.name,
          description: preset.description,
          category_id: preset.category_id,
          dyes: JSON.stringify(preset.dyes),
          tags: '[]',
          author_discord_id: preset.author_discord_id,
          author_name: preset.author_name,
          vote_count: preset.vote_count || 0,
          status: preset.status || 'approved',
          is_curated: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          dye_signature: null,
          previous_values: null,
        };
      }
    }
    return null;
  });
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { createMockD1Database, createMockKV, createTestJWT, createExpiredJWT };
