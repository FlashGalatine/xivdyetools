/**
 * Test secret constants
 *
 * Provides default secret values for testing authentication flows.
 *
 * WARNING: These are for TESTING ONLY. Never use these values in production.
 *
 * @example
 * ```typescript
 * import { TEST_JWT_SECRET, TEST_BOT_SECRET } from '@xivdyetools/test-utils/constants';
 *
 * const env = {
 *   JWT_SECRET: TEST_JWT_SECRET,
 *   BOT_API_SECRET: TEST_BOT_SECRET,
 * };
 * ```
 */

/**
 * Default JWT secret for testing
 *
 * Use this to create test JWTs that can be verified by test environments.
 */
export const TEST_JWT_SECRET = 'test-jwt-secret-key-for-testing-32chars';

/**
 * Default bot API secret for testing
 */
export const TEST_BOT_SECRET = 'test-bot-secret';

// Note: TEST_SIGNING_SECRET is available from '@xivdyetools/test-utils/auth'

/**
 * Default Discord client ID for testing
 */
export const TEST_DISCORD_CLIENT_ID = 'test-discord-client-id';

/**
 * Default Discord client secret for testing
 */
export const TEST_DISCORD_CLIENT_SECRET = 'test-discord-client-secret';

/**
 * Default XIVAuth client ID for testing
 */
export const TEST_XIVAUTH_CLIENT_ID = 'test-xivauth-client-id';

/**
 * Default moderator Discord IDs for testing
 */
export const TEST_MODERATOR_IDS = '123456789,987654321';

/**
 * Default test user Discord ID
 */
export const TEST_USER_DISCORD_ID = '123456789';

/**
 * Default test moderator Discord ID
 */
export const TEST_MODERATOR_DISCORD_ID = '987654321';

/**
 * Default frontend URL for testing
 */
export const TEST_FRONTEND_URL = 'http://localhost:5173';

/**
 * Default worker URL for testing
 */
export const TEST_WORKER_URL = 'http://localhost:8788';

/**
 * Default CORS origin for testing
 */
export const TEST_CORS_ORIGIN = 'http://localhost:3000';

/**
 * JWT expiry in seconds for testing (1 hour)
 */
export const TEST_JWT_EXPIRY = 3600;

/**
 * JWT expiry string for testing
 */
export const TEST_JWT_EXPIRY_STRING = '3600';
