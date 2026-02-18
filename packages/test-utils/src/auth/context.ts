/**
 * Auth context factories for testing middleware and handlers
 *
 * Provides factory functions to create authentication contexts
 * for testing protected endpoints.
 *
 * @example
 * ```typescript
 * // Regular authenticated user
 * const userCtx = createAuthContext({ userDiscordId: '123456789' });
 *
 * // Moderator context
 * const modCtx = createModeratorContext();
 *
 * // Unauthenticated context
 * const anonCtx = createUnauthenticatedContext();
 * ```
 */

import type { AuthContext, AuthSource } from '@xivdyetools/types/auth';

// Re-export the type for convenience
export type { AuthContext, AuthSource };

/**
 * Creates an authenticated user context
 *
 * @param overrides - Optional overrides for the default values
 * @returns An AuthContext for an authenticated user
 */
export function createAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    isAuthenticated: true,
    isModerator: false,
    userDiscordId: '123456789',
    userName: 'TestUser',
    authSource: 'bot',
    ...overrides,
  };
}

/**
 * Creates a moderator context
 *
 * @param overrides - Optional overrides for the default values
 * @returns An AuthContext for a moderator
 */
export function createModeratorContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    isAuthenticated: true,
    isModerator: true,
    userDiscordId: '123456789',
    userName: 'ModeratorUser',
    authSource: 'bot',
    ...overrides,
  };
}

/**
 * Creates an unauthenticated context
 *
 * @returns An AuthContext for an unauthenticated request
 */
export function createUnauthenticatedContext(): AuthContext {
  return {
    isAuthenticated: false,
    isModerator: false,
    authSource: 'none',
  };
}

/**
 * Creates a web-authenticated context (JWT auth)
 *
 * @param overrides - Optional overrides for the default values
 * @returns An AuthContext for a web-authenticated user
 */
export function createWebAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    isAuthenticated: true,
    isModerator: false,
    userDiscordId: '123456789',
    userName: 'WebUser',
    authSource: 'web',
    ...overrides,
  };
}

/**
 * Creates a bot-authenticated context
 *
 * @param overrides - Optional overrides for the default values
 * @returns An AuthContext for a bot-authenticated user
 */
export function createBotAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    isAuthenticated: true,
    isModerator: false,
    userDiscordId: '123456789',
    userName: 'BotUser',
    authSource: 'bot',
    ...overrides,
  };
}
