/**
 * Integration Test Setup
 *
 * Provides shared utilities for cross-service integration tests.
 * Creates simulated environments that mimic real worker interactions.
 *
 * @module integration/setup
 */

import { createMockD1Database, type MockD1Database } from '../src/cloudflare/d1.js';
import { createMockKV, type MockKVNamespace } from '../src/cloudflare/kv.js';
import { createTestJWT, createExpiredJWT } from '../src/auth/jwt.js';
import { createBotSignature, createTimestampedSignature, TEST_SIGNING_SECRET } from '../src/auth/signature.js';

// ============================================================================
// Shared Test Constants
// ============================================================================

/** Shared JWT secret (used by both OAuth and Presets API) */
export const SHARED_JWT_SECRET = 'test-jwt-secret-key-for-testing-32chars';

/** Bot API secret for Discord worker authentication */
export const BOT_API_SECRET = 'test-bot-api-secret';

/** Bot signing secret for HMAC request signatures */
export const BOT_SIGNING_SECRET = TEST_SIGNING_SECRET;

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
  'X-Request-Timestamp'?: string;
  'X-Request-Signature'?: string;
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

/**
 * Create headers for bot authentication with HMAC signature
 * Used for production environments where signature is required
 */
export async function createSignedBotHeaders(
  userDiscordId: string,
  userName: string
): Promise<BotAuthHeaders> {
  const { signature, timestamp } = await createTimestampedSignature(
    userDiscordId,
    userName,
    BOT_SIGNING_SECRET
  );

  return {
    Authorization: `Bearer ${BOT_API_SECRET}`,
    'Content-Type': 'application/json',
    'X-User-Discord-ID': userDiscordId,
    'X-User-Discord-Name': userName,
    'X-Request-Timestamp': timestamp,
    'X-Request-Signature': signature,
  };
}

/**
 * Create headers with an invalid/expired signature
 * Used for testing signature validation
 */
export async function createInvalidSignatureHeaders(
  userDiscordId: string,
  userName: string
): Promise<BotAuthHeaders> {
  // Use an old timestamp (more than 2 minutes ago)
  const oldTimestamp = (Math.floor(Date.now() / 1000) - 300).toString();
  const signature = await createBotSignature(
    oldTimestamp,
    userDiscordId,
    userName,
    BOT_SIGNING_SECRET
  );

  return {
    Authorization: `Bearer ${BOT_API_SECRET}`,
    'Content-Type': 'application/json',
    'X-User-Discord-ID': userDiscordId,
    'X-User-Discord-Name': userName,
    'X-Request-Timestamp': oldTimestamp,
    'X-Request-Signature': signature,
  };
}

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
export { createBotSignature, createTimestampedSignature };
