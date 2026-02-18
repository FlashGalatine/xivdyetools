import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockD1Database } from '@xivdyetools/test-utils';
import {
  isUserBannedByDiscordId,
  searchPresetAuthors,
  searchBannedUsers,
  getUserForBanConfirmation,
  banUser,
  unbanUser,
  hideUserPresets,
  restoreUserPresets,
  getActiveBan,
} from './ban-service.js';

describe('ban-service', () => {
  let db: ReturnType<typeof createMockD1Database>;

  beforeEach(() => {
    db = createMockD1Database();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isUserBannedByDiscordId', () => {
    it('should return true when user is banned', async () => {
      // Simulate user is banned
      db._setBanStatus(true);

      const result = await isUserBannedByDiscordId(db as unknown as D1Database, 'user-123');
      expect(result).toBe(true);
    });

    it('should return false when user is not banned', async () => {
      db._setupMock(() => null);

      const result = await isUserBannedByDiscordId(db as unknown as D1Database, 'user-456');
      expect(result).toBe(false);
    });

    it('should check for unbanned_at IS NULL', async () => {
      db._setupMock(() => null);

      await isUserBannedByDiscordId(db as unknown as D1Database, 'user-123');

      expect(db._queries[0]).toContain('unbanned_at IS NULL');
    });

    it('should use correct binding', async () => {
      db._setupMock(() => null);

      await isUserBannedByDiscordId(db as unknown as D1Database, 'discord-id-789');

      expect(db._bindings[0]).toEqual(['discord-id-789']);
    });
  });

  describe('searchPresetAuthors', () => {
    it('should return preset authors with counts', async () => {
      db._setupMock((query) => {
        if (query.includes('SELECT') && query.includes('author_discord_id')) {
          return [
            { discord_id: 'user-1', username: 'User One', preset_count: 5 },
            { discord_id: 'user-2', username: 'User Two', preset_count: 3 },
          ];
        }
        return null;
      });

      const results = await searchPresetAuthors(db as unknown as D1Database, 'user', 25);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        discordId: 'user-1',
        username: 'User One',
        presetCount: 5,
      });
      expect(results[1]).toEqual({
        discordId: 'user-2',
        username: 'User Two',
        presetCount: 3,
      });
    });

    it('should escape SQL LIKE special characters', async () => {
      db._setupMock(() => []);

      await searchPresetAuthors(db as unknown as D1Database, 'user%test_name\\foo', 25);

      // Should escape %, _, and \
      expect(db._bindings[0][0]).toBe('%user\\%test\\_name\\\\foo%');
    });

    it('should exclude already banned users', async () => {
      db._setupMock(() => []);

      await searchPresetAuthors(db as unknown as D1Database, 'test', 25);

      expect(db._queries[0]).toContain('LEFT JOIN banned_users');
      expect(db._queries[0]).toContain('b.id IS NULL');
    });

    it('should use LIKE with ESCAPE clause', async () => {
      db._setupMock(() => []);

      await searchPresetAuthors(db as unknown as D1Database, 'test', 25);

      expect(db._queries[0]).toContain("LIKE ? ESCAPE '\\'");
    });

    it('should apply limit parameter', async () => {
      db._setupMock(() => []);

      await searchPresetAuthors(db as unknown as D1Database, 'test', 10);

      expect(db._bindings[0][1]).toBe(10);
    });

    it('should order by preset count DESC and name ASC', async () => {
      db._setupMock(() => []);

      await searchPresetAuthors(db as unknown as D1Database, 'test', 25);

      expect(db._queries[0]).toContain('ORDER BY preset_count DESC, p.author_name ASC');
    });

    it('should handle empty results', async () => {
      db._setupMock(() => []);

      const results = await searchPresetAuthors(db as unknown as D1Database, 'nonexistent', 25);

      expect(results).toEqual([]);
    });

    it('should handle null results', async () => {
      db._setupMock(() => []);

      const results = await searchPresetAuthors(db as unknown as D1Database, 'test', 25);

      expect(results).toEqual([]);
    });

    it('should fallback to simpler query on error', async () => {
      let callCount = 0;
      db._setupMock((query) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('banned_users table error');
        }
        return { results: [{ discord_id: 'user-1', username: 'User', preset_count: 1 }] };
      });

      const results = await searchPresetAuthors(db as unknown as D1Database, 'test', 25);

      expect(results).toHaveLength(1);
      expect(db._queries).toHaveLength(2); // Two queries (first failed, second succeeded)
      expect(db._queries[1]).not.toContain('LEFT JOIN banned_users');
    });
  });

  describe('searchBannedUsers', () => {
    it('should return currently banned users', async () => {
      db._setupMock((query) => {
        if (query.includes('SELECT') && query.includes('banned_users')) {
          return [
            {
              discord_id: 'banned-1',
              xivauth_id: null,
              username: 'BannedUser1',
              banned_at: '2025-01-01T00:00:00Z',
            },
            {
              discord_id: 'banned-2',
              xivauth_id: 'xiv-123',
              username: 'BannedUser2',
              banned_at: '2025-01-10T00:00:00Z',
            },
          ];
        }
        return null;
      });

      const results = await searchBannedUsers(db as unknown as D1Database, 'banned', 25);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        discordId: 'banned-1',
        xivAuthId: null,
        username: 'BannedUser1',
        bannedAt: '2025-01-01T00:00:00Z',
      });
    });

    it('should escape special characters in search query', async () => {
      db._setupMock(() => []);

      await searchBannedUsers(db as unknown as D1Database, 'user%_\\', 25);

      expect(db._bindings[0][0]).toBe('%user\\%\\_\\\\%');
      expect(db._bindings[0][1]).toBe('%user\\%\\_\\\\%');
    });

    it('should search both username and discord_id', async () => {
      db._setupMock(() => []);

      await searchBannedUsers(db as unknown as D1Database, 'test', 25);

      expect(db._queries[0]).toContain('username LIKE ? ESCAPE');
      expect(db._queries[0]).toContain('discord_id LIKE ? ESCAPE');
      expect(db._queries[0]).toContain('OR');
    });

    it('should only return users where unbanned_at IS NULL', async () => {
      db._setupMock(() => []);

      await searchBannedUsers(db as unknown as D1Database, 'test', 25);

      expect(db._queries[0]).toContain('WHERE unbanned_at IS NULL');
    });

    it('should handle errors gracefully', async () => {
      db._setupMock(() => {
        throw new Error('Database error');
      });

      const results = await searchBannedUsers(db as unknown as D1Database, 'test', 25);

      expect(results).toEqual([]);
    });

    it('should handle empty results', async () => {
      db._setupMock(() => []);

      const results = await searchBannedUsers(db as unknown as D1Database, 'nonexistent', 25);

      expect(results).toEqual([]);
    });
  });

  describe('getUserForBanConfirmation', () => {
    it('should return user details with recent presets', async () => {
      let queryCount = 0;
      db._setupMock((query) => {
        queryCount++;
        if (queryCount === 1 && query.includes('COUNT(*)')) {
          return {
            discord_id: 'user-123',
            username: 'TestUser',
            preset_count: 10,
          };
        }
        if (queryCount === 2 && query.includes('LIMIT 3')) {
          return [
            { id: 'preset-1', name: 'Preset One' },
            { id: 'preset-2', name: 'Preset Two' },
            { id: 'preset-3', name: 'Preset Three' },
          ];
        }
        return null;
      });

      const result = await getUserForBanConfirmation(
        db as unknown as D1Database,
        'user-123',
        'https://example.com'
      );

      expect(result).toEqual({
        user: {
          discordId: 'user-123',
          username: 'TestUser',
          presetCount: 10,
        },
        recentPresets: [
          { id: 'preset-1', name: 'Preset One', shareUrl: 'https://example.com/presets/preset-1' },
          { id: 'preset-2', name: 'Preset Two', shareUrl: 'https://example.com/presets/preset-2' },
          {
            id: 'preset-3',
            name: 'Preset Three',
            shareUrl: 'https://example.com/presets/preset-3',
          },
        ],
      });
    });

    it('should return null when user has no presets', async () => {
      db._setupMock(() => null);

      const result = await getUserForBanConfirmation(
        db as unknown as D1Database,
        'user-999',
        'https://example.com'
      );

      expect(result).toBeNull();
    });

    it('should handle user with fewer than 3 presets', async () => {
      let queryCount = 0;
      db._setupMock((query) => {
        queryCount++;
        if (queryCount === 1) {
          return { discord_id: 'user-1', username: 'User', preset_count: 2 };
        }
        return [{ id: 'p1', name: 'Preset 1' }];
      });

      const result = await getUserForBanConfirmation(
        db as unknown as D1Database,
        'user-1',
        'https://example.com'
      );

      expect(result?.recentPresets).toHaveLength(1);
    });

    it('should construct correct share URLs', async () => {
      let queryCount = 0;
      db._setupMock((query) => {
        queryCount++;
        if (queryCount === 1) {
          return { discord_id: 'user-1', username: 'User', preset_count: 1 };
        }
        return [{ id: 'abc123', name: 'Test' }];
      });

      const result = await getUserForBanConfirmation(
        db as unknown as D1Database,
        'user-1',
        'https://test.com'
      );

      expect(result?.recentPresets[0].shareUrl).toBe('https://test.com/presets/abc123');
    });
  });

  describe('banUser', () => {
    it('should successfully ban user and hide presets', async () => {
      db._setupMock((query) => {
        // INSERT INTO banned_users
        if (query.includes('INSERT INTO banned_users')) {
          return { meta: { changes: 1 } };
        }
        // UPDATE presets (hide)
        if (query.includes('UPDATE presets')) {
          return { meta: { changes: 5 } };
        }
        return null;
      });

      const result = await banUser(
        db as unknown as D1Database,
        'user-123',
        'TestUser',
        'mod-456',
        'Violating ToS'
      );

      expect(result.success).toBe(true);
      expect(result.presetsHidden).toBe(5);
      expect(result.error).toBeUndefined();
    });

    it('should prevent double-banning', async () => {
      // Simulate user is already banned
      db._setBanStatus(true);

      const result = await banUser(
        db as unknown as D1Database,
        'user-123',
        'TestUser',
        'mod-456',
        'Reason'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('User is already banned.');
      expect(result.presetsHidden).toBe(0);
    });

    it('should insert ban record with correct data', async () => {
      let queryCount = 0;
      db._setupMock((query) => {
        queryCount++;
        if (queryCount === 1) return null; // Not banned
        if (queryCount === 2) return { meta: { changes: 1 } }; // INSERT
        if (queryCount === 3) return { meta: { changes: 0 } }; // UPDATE
        return null;
      });

      await banUser(
        db as unknown as D1Database,
        'discord-789',
        'UserName',
        'mod-123',
        'Ban reason here'
      );

      const insertQuery = db._queries[1];
      expect(insertQuery).toContain('INSERT INTO banned_users');
      expect(insertQuery).toContain('discord_id');
      expect(insertQuery).toContain('username');
      expect(insertQuery).toContain('moderator_discord_id');
      expect(insertQuery).toContain('reason');
      expect(insertQuery).toContain('banned_at');

      const bindings = db._bindings[1];
      expect(bindings[1]).toBe('discord-789'); // discord_id
      expect(bindings[2]).toBe('UserName'); // username
      expect(bindings[3]).toBe('mod-123'); // moderator_discord_id
      expect(bindings[4]).toBe('Ban reason here'); // reason
      expect(bindings[5]).toBe('2025-01-15T12:00:00.000Z'); // banned_at
    });

    it('should generate UUID for ban record', async () => {
      let queryCount = 0;
      db._setupMock((query) => {
        queryCount++;
        if (queryCount === 1) return null;
        if (queryCount === 2) return { meta: { changes: 1 } };
        if (queryCount === 3) return { meta: { changes: 0 } };
        return null;
      });

      await banUser(
        db as unknown as D1Database,
        'user-123',
        'User',
        'mod-123',
        'Reason'
      );

      const uuid = db._bindings[1][0];
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should handle missing banned_users table', async () => {
      db._setupMock(() => {
        throw new Error('no such table: banned_users');
      });

      const result = await banUser(
        db as unknown as D1Database,
        'user-123',
        'User',
        'mod-123',
        'Reason'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Ban system not configured. Please run the database migration first.');
    });

    it('should handle database errors', async () => {
      db._setupMock(() => {
        throw new Error('Database connection failed');
      });

      const result = await banUser(
        db as unknown as D1Database,
        'user-123',
        'User',
        'mod-123',
        'Reason'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    it('should hide user presets after banning', async () => {
      let queryCount = 0;
      db._setupMock((query) => {
        queryCount++;
        if (queryCount === 1) return null;
        if (queryCount === 2) return { meta: { changes: 1 } };
        if (queryCount === 3) return { meta: { changes: 3 } };
        return null;
      });

      await banUser(
        db as unknown as D1Database,
        'user-123',
        'User',
        'mod-123',
        'Reason'
      );

      expect(db._queries[2]).toContain('UPDATE presets');
      expect(db._queries[2]).toContain("SET status = 'hidden'");
      expect(db._queries[2]).toContain('WHERE author_discord_id = ?');
    });
  });

  describe('unbanUser', () => {
    it('should successfully unban user and restore presets', async () => {
      // Simulate user is banned
      db._setBanStatus(true);

      db._setupMock((query) => {
        // UPDATE banned_users
        if (query.includes('UPDATE banned_users')) {
          return { meta: { changes: 1 } };
        }
        // UPDATE presets (restore)
        if (query.includes('UPDATE presets')) {
          return { meta: { changes: 4 } };
        }
        return null;
      });

      const result = await unbanUser(
        db as unknown as D1Database,
        'user-123',
        'mod-456'
      );

      expect(result.success).toBe(true);
      expect(result.presetsRestored).toBe(4);
      expect(result.error).toBeUndefined();
    });

    it('should fail when user is not currently banned', async () => {
      db._setupMock(() => null); // User not banned

      const result = await unbanUser(
        db as unknown as D1Database,
        'user-123',
        'mod-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('User is not currently banned.');
      expect(result.presetsRestored).toBe(0);
    });

    it('should update ban record with unban timestamp', async () => {
      // Simulate user is banned
      db._setBanStatus(true);

      db._setupMock((query) => {
        if (query.includes('UPDATE banned_users')) {
          return { meta: { changes: 1 } };
        }
        if (query.includes('UPDATE presets')) {
          return { meta: { changes: 0 } };
        }
        return null;
      });

      await unbanUser(
        db as unknown as D1Database,
        'discord-789',
        'mod-123'
      );

      const updateQuery = db._queries[1];
      expect(updateQuery).toContain('UPDATE banned_users');
      expect(updateQuery).toContain('SET unbanned_at = ?');
      expect(updateQuery).toContain('unban_moderator_discord_id = ?');
      expect(updateQuery).toContain('WHERE discord_id = ?');
      expect(updateQuery).toContain('AND unbanned_at IS NULL');

      const bindings = db._bindings[1];
      expect(bindings[0]).toBe('2025-01-15T12:00:00.000Z'); // unbanned_at
      expect(bindings[1]).toBe('mod-123'); // unban_moderator_discord_id
      expect(bindings[2]).toBe('discord-789'); // discord_id
    });

    it('should fail if ban record update fails', async () => {
      // Simulate user is banned
      db._setBanStatus(true);

      db._setupMock((query) => {
        if (query.includes('UPDATE banned_users')) {
          return { meta: { changes: 0 } }; // UPDATE failed
        }
        return null;
      });

      const result = await unbanUser(
        db as unknown as D1Database,
        'user-123',
        'mod-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update ban record.');
    });

    it('should handle database errors', async () => {
      // Simulate user is banned
      db._setBanStatus(true);

      db._setupMock(() => {
        throw new Error('Connection timeout');
      });

      const result = await unbanUser(
        db as unknown as D1Database,
        'user-123',
        'mod-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });
  });

  describe('hideUserPresets', () => {
    it('should hide approved presets', async () => {
      db._setupMock(() => ({ meta: { changes: 3 } }));

      const count = await hideUserPresets(db as unknown as D1Database, 'user-123');

      expect(count).toBe(3);
      expect(db._queries[0]).toContain('UPDATE presets');
      expect(db._queries[0]).toContain("SET status = 'hidden'");
      expect(db._queries[0]).toContain("WHERE author_discord_id = ? AND status = 'approved'");
    });

    it('should only hide approved presets, not pending or rejected', async () => {
      db._setupMock(() => ({ meta: { changes: 2 } }));

      await hideUserPresets(db as unknown as D1Database, 'user-456');

      expect(db._queries[0]).toContain("status = 'approved'");
    });

    it('should return 0 when no presets to hide', async () => {
      db._setupMock(() => ({ meta: { changes: 0 } }));

      const count = await hideUserPresets(db as unknown as D1Database, 'user-789');

      expect(count).toBe(0);
    });

    it('should handle undefined changes', async () => {
      db._setupMock(() => ({ meta: {} }));

      const count = await hideUserPresets(db as unknown as D1Database, 'user-123');

      expect(count).toBe(0);
    });
  });

  describe('restoreUserPresets', () => {
    it('should restore hidden presets to approved status', async () => {
      db._setupMock(() => ({ meta: { changes: 5 } }));

      const count = await restoreUserPresets(db as unknown as D1Database, 'user-123');

      expect(count).toBe(5);
      expect(db._queries[0]).toContain('UPDATE presets');
      expect(db._queries[0]).toContain("SET status = 'approved'");
      expect(db._queries[0]).toContain("WHERE author_discord_id = ? AND status = 'hidden'");
    });

    it('should only restore hidden presets, not rejected or pending', async () => {
      db._setupMock(() => ({ meta: { changes: 2 } }));

      await restoreUserPresets(db as unknown as D1Database, 'user-456');

      expect(db._queries[0]).toContain("status = 'hidden'");
    });

    it('should return 0 when no presets to restore', async () => {
      db._setupMock(() => ({ meta: { changes: 0 } }));

      const count = await restoreUserPresets(db as unknown as D1Database, 'user-789');

      expect(count).toBe(0);
    });

    it('should use correct binding', async () => {
      db._setupMock(() => ({ meta: { changes: 1 } }));

      await restoreUserPresets(db as unknown as D1Database, 'discord-id-abc');

      expect(db._bindings[0]).toEqual(['discord-id-abc']);
    });
  });

  describe('getActiveBan', () => {
    it('should return active ban record', async () => {
      db._setupMock(() => ({
        id: 'ban-id-123',
        discord_id: 'user-123',
        xivauth_id: null,
        username: 'BannedUser',
        moderator_discord_id: 'mod-456',
        reason: 'ToS violation',
        banned_at: '2025-01-01T00:00:00Z',
        unbanned_at: null,
        unban_moderator_discord_id: null,
      }));

      const ban = await getActiveBan(db as unknown as D1Database, 'user-123');

      expect(ban).toEqual({
        id: 'ban-id-123',
        discordId: 'user-123',
        xivAuthId: null,
        username: 'BannedUser',
        moderatorDiscordId: 'mod-456',
        reason: 'ToS violation',
        bannedAt: '2025-01-01T00:00:00Z',
        unbannedAt: null,
        unbanModeratorDiscordId: null,
      });
    });

    it('should return null when no active ban exists', async () => {
      db._setupMock(() => null);

      const ban = await getActiveBan(db as unknown as D1Database, 'user-456');

      expect(ban).toBeNull();
    });

    it('should query for unbanned_at IS NULL', async () => {
      db._setupMock(() => null);

      await getActiveBan(db as unknown as D1Database, 'user-123');

      expect(db._queries[0]).toContain('WHERE discord_id = ?');
      expect(db._queries[0]).toContain('AND unbanned_at IS NULL');
      expect(db._queries[0]).toContain('LIMIT 1');
    });

    it('should use correct binding', async () => {
      db._setupMock(() => null);

      await getActiveBan(db as unknown as D1Database, 'discord-999');

      expect(db._bindings[0]).toEqual(['discord-999']);
    });
  });
});
