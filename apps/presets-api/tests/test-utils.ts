/**
 * Test utilities and mocks for the presets API tests
 *
 * Most utilities are now imported from @xivdyetools/test-utils.
 * This file contains project-specific utilities and re-exports.
 */

import { vi } from 'vitest';
import type { Env, PresetRow } from '../src/types';

// Re-export shared test utilities
export {
  // Cloudflare mocks
  createMockD1Database,
  // Auth helpers
  createTestJWT,
  createExpiredJWT,
  authHeaders,
  // Factories
  createMockSubmission,
  createMockCategoryRow,
} from '@xivdyetools/test-utils';

// Import for internal use
import { createMockD1Database, createMockR2Bucket, createMockPresetRow as createSharedPresetRow } from '@xivdyetools/test-utils';

/** Include the API's internal revision without changing the shared public preset fixture. */
export function createMockPresetRow(overrides: Partial<PresetRow> = {}): PresetRow {
  return { ...createSharedPresetRow(overrides), content_revision: 0, ...overrides };
}

/**
 * The create / edit handlers re-read the row (`SELECT * FROM presets WHERE id = ?`)
 * to build the moderation notification from one consistent read (FINDING-017).
 * Many mocks answer unmodelled statements with a bare `{ success: true }`, which
 * is not a row; give the re-read a valid one in that case only, and leave
 * `null` and real rows alone so tests that model the row keep control.
 * Only a re-read that follows an INSERT/UPDATE of `presets` is substituted (not
 * the ownership read before it), it carries the requested id, and it is
 * `pending` — the status every notifying flow in these suites sends, and one
 * the handlers now require the re-read row to still hold.
 */
export function withPresetRereadRow(db: { _setupMock: (fn: (q: string, b: unknown[]) => unknown) => void }): void {
  const original = db._setupMock.bind(db);
  db._setupMock = (fn) => {
    let written = false;
    original((query, bindings) => {
      if (/^\s*(INSERT INTO|UPDATE) presets\b/i.test(query)) written = true;
      const result = fn(query, bindings);
      const isReread = /SELECT \* FROM presets WHERE id = \?/.test(query);
      if (
        written &&
        isReread &&
        result &&
        typeof result === 'object' &&
        !Array.isArray(result) &&
        !('dyes' in result)
      ) {
        return createMockPresetRow({ id: String(bindings[0]), status: 'pending' });
      }
      return result;
    });
  };
}

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
    JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-bytes!!-that-is-at-least-32-bytes!!',
    PERSPECTIVE_API_KEY: undefined,
    DISCORD_WORKER: undefined,
    INTERNAL_WEBHOOK_SECRET: undefined,
    THUMBNAILS: createMockR2Bucket() as unknown as R2Bucket,
    IMAGE_WORKER: {
      // Happy-path default: returns fake webp bytes. Tests that need
      // image-worker to reject the upload override this per-test.
      fetch: async () =>
        new Response(new Uint8Array([1, 2, 3, 4]).buffer, {
          status: 200,
          headers: { 'Content-Type': 'image/webp' },
        }),
    } as unknown as Fetcher,
    ...overrides,
  };
}

/**
 * FINDING-019: with no PERSPECTIVE_API_KEY, `moderateContent` queues every
 * submission (`method: 'unscored'`). Tests that need a clean pass configure a
 * scorer: set the key on `env` and answer Perspective with near-zero scores.
 * Pair with `vi.unstubAllGlobals()` in `afterEach`.
 */
export function useCleanPerspective(env: Env): Env {
  env.PERSPECTIVE_API_KEY = 'test-perspective-key';
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            attributeScores: {
              TOXICITY: { summaryScore: { value: 0.01 } },
              SEVERE_TOXICITY: { summaryScore: { value: 0.01 } },
              IDENTITY_ATTACK: { summaryScore: { value: 0.01 } },
              INSULT: { summaryScore: { value: 0.01 } },
              PROFANITY: { summaryScore: { value: 0.01 } },
            },
          }),
          { status: 200 }
        )
    )
  );
  return env;
}
