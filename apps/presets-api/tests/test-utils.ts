/**
 * Test utilities and mocks for the presets API tests
 *
 * Most utilities are now imported from @xivdyetools/test-utils.
 * This file contains project-specific utilities and re-exports.
 */

import type { Env } from '../src/types';

// Re-export shared test utilities
export {
  // Cloudflare mocks
  createMockD1Database,
  // Auth helpers
  createTestJWT,
  createExpiredJWT,
  createBotSignature,
  authHeaders,
  authHeadersWithSignature,
  createAuthContext,
  createModeratorContext,
  createUnauthenticatedContext,
  // Factories
  createMockPreset,
  createMockPresetRow,
  createMockSubmission,
  createMockCategoryRow,
  createMockVoteRow,
  // Assertions
  assertJsonResponse,
  // Counters
  resetCounters,
  // Constants
  TEST_SIGNING_SECRET,
} from '@xivdyetools/test-utils';

// Import for internal use
import { createMockD1Database } from '@xivdyetools/test-utils';

// ============================================
// PROJECT-SPECIFIC: MOCK ENVIRONMENT
// ============================================

/**
 * Create mock environment with all bindings
 * Note: This is project-specific as it uses the local Env type
 * The D1 mock is cast to D1Database for compatibility with Cloudflare's strict types
 */
export function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: createMockD1Database() as unknown as D1Database,
    ENVIRONMENT: 'development',
    API_VERSION: 'v1',
    CORS_ORIGIN: 'http://localhost:3000',
    BOT_API_SECRET: 'test-bot-secret',
    // Note: BOT_SIGNING_SECRET is NOT set by default
    // This allows bot auth to work without signatures for most tests
    // Tests that specifically test signature validation should override this
    BOT_SIGNING_SECRET: undefined,
    MODERATOR_IDS: '123456789,987654321',
    JWT_SECRET: 'test-jwt-secret',
    PERSPECTIVE_API_KEY: undefined,
    MODERATION_WEBHOOK_URL: undefined,
    OWNER_DISCORD_ID: undefined,
    DISCORD_BOT_TOKEN: undefined,
    DISCORD_WORKER: undefined,
    DISCORD_BOT_WEBHOOK_URL: undefined,
    INTERNAL_WEBHOOK_SECRET: undefined,
    ...overrides,
  };
}

// ============================================
// PROJECT-SPECIFIC: REQUEST HELPERS
// ============================================

/**
 * Create a mock request for testing handlers
 */
export function createMockRequest(
    method: string,
    url: string,
    options: {
        headers?: Record<string, string>;
        body?: unknown;
    } = {}
): Request {
    const init: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    };

    if (options.body && method !== 'GET') {
        init.body = JSON.stringify(options.body);
    }

  return new Request(url, init);
}
