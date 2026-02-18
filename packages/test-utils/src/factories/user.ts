/**
 * User factory functions for testing
 *
 * Provides functions to create mock users for OAuth and auth testing.
 *
 * @example
 * ```typescript
 * const user = createMockUser({ username: 'TestPlayer' });
 * const row = createMockUserRow({ auth_provider: 'discord' });
 * ```
 */

import type { AuthUser } from '@xivdyetools/types/auth';
import { nextStringId } from '../utils/counters.js';

// Re-export type for convenience
export type { AuthUser };

/**
 * User database row type
 */
export interface UserRow {
  id: string;
  discord_id: string | null;
  xivauth_id: string | null;
  auth_provider: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Creates a mock user row (as returned from database)
 *
 * @param overrides - Optional overrides for the default values
 * @returns A UserRow object
 */
export function createMockUserRow(overrides: Partial<UserRow> = {}): UserRow {
  const id = overrides.id ?? nextStringId('user');
  const now = new Date().toISOString();

  return {
    id,
    discord_id: '123456789',
    xivauth_id: null,
    auth_provider: 'discord',
    username: 'TestUser',
    avatar_url: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

/**
 * Creates a mock AuthUser (domain object)
 *
 * @param overrides - Optional overrides for the default values
 * @returns An AuthUser object
 */
export function createMockUser(overrides: Partial<AuthUser> = {}): AuthUser {
  const id = overrides.id ?? nextStringId('user');

  return {
    id,
    username: 'TestUser',
    global_name: 'Test User',
    avatar: null,
    avatar_url: null,
    auth_provider: 'discord',
    ...overrides,
  };
}

/**
 * Creates multiple mock users
 *
 * @param count - Number of users to create
 * @param overrides - Optional overrides to apply to all users
 * @returns Array of AuthUser objects
 */
export function createMockUsers(
  count: number,
  overrides: Partial<AuthUser> = {}
): AuthUser[] {
  return Array.from({ length: count }, (_, i) =>
    createMockUser({
      username: `User${i + 1}`,
      global_name: `User ${i + 1}`,
      ...overrides,
    })
  );
}

/**
 * Creates a Discord-authenticated user
 *
 * @param discordId - Discord user ID
 * @param overrides - Optional additional overrides
 * @returns An AuthUser object
 */
export function createDiscordUser(
  discordId: string,
  overrides: Partial<AuthUser> = {}
): AuthUser {
  return createMockUser({
    id: discordId,
    auth_provider: 'discord',
    ...overrides,
  });
}

/**
 * Creates an XIVAuth-authenticated user
 *
 * @param xivauthId - XIVAuth user ID
 * @param overrides - Optional additional overrides
 * @returns An AuthUser object
 */
export function createXIVAuthUser(
  xivauthId: string,
  overrides: Partial<AuthUser> = {}
): AuthUser {
  return createMockUser({
    id: xivauthId,
    auth_provider: 'xivauth',
    ...overrides,
  });
}

/**
 * Converts an AuthUser to a UserRow
 *
 * @param user - The AuthUser to convert
 * @param discordId - Discord ID (if auth_provider is 'discord')
 * @param xivauthId - XIVAuth ID (if auth_provider is 'xivauth')
 * @returns A UserRow object
 */
export function userToRow(
  user: AuthUser,
  discordId?: string | null,
  xivauthId?: string | null
): UserRow {
  const now = new Date().toISOString();

  return {
    id: user.id,
    discord_id: discordId ?? (user.auth_provider === 'discord' ? user.id : null),
    xivauth_id: xivauthId ?? (user.auth_provider === 'xivauth' ? user.id : null),
    auth_provider: user.auth_provider ?? 'discord',
    username: user.username,
    avatar_url: user.avatar_url,
    created_at: now,
    updated_at: now,
  };
}
