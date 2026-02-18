/**
 * Tests for user factory functions
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetCounters } from '../../src/utils/counters.js';
import {
  createMockUserRow,
  createMockUser,
  createMockUsers,
  createDiscordUser,
  createXIVAuthUser,
  userToRow,
} from '../../src/factories/user.js';

beforeEach(() => {
  resetCounters();
});

describe('createMockUserRow', () => {
  it('creates a user row with defaults', () => {
    const row = createMockUserRow();

    // TEST-DESIGN-001: IDs are now random for parallel test safety
    expect(row.id).toMatch(/^user-[a-z0-9]{8}$/);
    expect(row.discord_id).toBe('123456789');
    expect(row.xivauth_id).toBeNull();
    expect(row.auth_provider).toBe('discord');
    expect(row.username).toBe('TestUser');
    expect(row.avatar_url).toBeNull();
    expect(row.created_at).toBeDefined();
    expect(row.updated_at).toBeDefined();
  });

  it('accepts overrides', () => {
    const row = createMockUserRow({
      id: 'custom-id',
      username: 'CustomUser',
    });

    expect(row.id).toBe('custom-id');
    expect(row.username).toBe('CustomUser');
  });

  it('generates unique IDs', () => {
    const row1 = createMockUserRow();
    const row2 = createMockUserRow();

    expect(row1.id).not.toBe(row2.id);
  });
});

describe('createMockUser', () => {
  it('creates a user with defaults', () => {
    const user = createMockUser();

    // TEST-DESIGN-001: IDs are now random for parallel test safety
    expect(user.id).toMatch(/^user-[a-z0-9]{8}$/);
    expect(user.username).toBe('TestUser');
    expect(user.global_name).toBe('Test User');
    expect(user.avatar).toBeNull();
    expect(user.avatar_url).toBeNull();
    expect(user.auth_provider).toBe('discord');
  });

  it('accepts overrides', () => {
    const user = createMockUser({
      username: 'OverriddenUser',
      auth_provider: 'xivauth',
    });

    expect(user.username).toBe('OverriddenUser');
    expect(user.auth_provider).toBe('xivauth');
  });

  it('generates unique IDs', () => {
    const user1 = createMockUser();
    const user2 = createMockUser();

    expect(user1.id).not.toBe(user2.id);
  });
});

describe('createMockUsers', () => {
  it('creates specified number of users', () => {
    const users = createMockUsers(5);

    expect(users).toHaveLength(5);
  });

  it('generates unique usernames with index', () => {
    const users = createMockUsers(3);

    expect(users[0].username).toBe('User1');
    expect(users[1].username).toBe('User2');
    expect(users[2].username).toBe('User3');
  });

  it('generates unique global names with index', () => {
    const users = createMockUsers(3);

    expect(users[0].global_name).toBe('User 1');
    expect(users[1].global_name).toBe('User 2');
    expect(users[2].global_name).toBe('User 3');
  });

  it('applies overrides to all users', () => {
    const users = createMockUsers(3, { auth_provider: 'xivauth' });

    expect(users.every((u) => u.auth_provider === 'xivauth')).toBe(true);
  });

  it('generates unique IDs', () => {
    const users = createMockUsers(3);
    const ids = users.map((u) => u.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(3);
  });
});

describe('createDiscordUser', () => {
  it('creates a Discord-authenticated user', () => {
    const user = createDiscordUser('discord-123');

    expect(user.id).toBe('discord-123');
    expect(user.auth_provider).toBe('discord');
  });

  it('accepts overrides', () => {
    const user = createDiscordUser('discord-456', { username: 'DiscordPlayer' });

    expect(user.id).toBe('discord-456');
    expect(user.username).toBe('DiscordPlayer');
    expect(user.auth_provider).toBe('discord');
  });
});

describe('createXIVAuthUser', () => {
  it('creates an XIVAuth-authenticated user', () => {
    const user = createXIVAuthUser('xivauth-123');

    expect(user.id).toBe('xivauth-123');
    expect(user.auth_provider).toBe('xivauth');
  });

  it('accepts overrides', () => {
    const user = createXIVAuthUser('xivauth-456', { username: 'XIVPlayer' });

    expect(user.id).toBe('xivauth-456');
    expect(user.username).toBe('XIVPlayer');
    expect(user.auth_provider).toBe('xivauth');
  });
});

describe('userToRow', () => {
  it('converts Discord user to row format', () => {
    const user = createMockUser({ id: 'user-id', auth_provider: 'discord' });

    const row = userToRow(user);

    expect(row.id).toBe('user-id');
    expect(row.discord_id).toBe('user-id');
    expect(row.xivauth_id).toBeNull();
    expect(row.auth_provider).toBe('discord');
    expect(row.username).toBe(user.username);
  });

  it('converts XIVAuth user to row format', () => {
    const user = createMockUser({ id: 'xiv-id', auth_provider: 'xivauth' });

    const row = userToRow(user);

    expect(row.id).toBe('xiv-id');
    expect(row.discord_id).toBeNull();
    expect(row.xivauth_id).toBe('xiv-id');
    expect(row.auth_provider).toBe('xivauth');
  });

  it('accepts explicit discord ID', () => {
    const user = createMockUser({ id: 'user-id' });

    const row = userToRow(user, 'explicit-discord-id');

    expect(row.discord_id).toBe('explicit-discord-id');
  });

  it('accepts explicit XIVAuth ID', () => {
    const user = createMockUser({ id: 'user-id' });

    const row = userToRow(user, null, 'explicit-xivauth-id');

    expect(row.xivauth_id).toBe('explicit-xivauth-id');
  });

  it('adds timestamps', () => {
    const user = createMockUser();

    const row = userToRow(user);

    expect(row.created_at).toBeDefined();
    expect(row.updated_at).toBeDefined();
  });

  it('preserves avatar_url', () => {
    const user = createMockUser({ avatar_url: 'https://example.com/avatar.png' });

    const row = userToRow(user);

    expect(row.avatar_url).toBe('https://example.com/avatar.png');
  });
});
