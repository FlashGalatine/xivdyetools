import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockD1Database } from '@xivdyetools/test-utils';
import { searchPresetAuthors, searchBannedUsers } from './ban-service.js';

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

    it('includes existing partial bans so explicit expansion stays available', async () => {
      db._setupMock(() => []);

      await searchPresetAuthors(db as unknown as D1Database, 'test', 25);

      expect(db._queries[0]).not.toContain('LEFT JOIN banned_users');
      expect(db._queries[0]).not.toContain('b.id IS NULL');
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
      db._setupMock((_query) => {
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

    /**
     * moderation-worker-08: Discord sends an autocomplete interaction with
     * `value: ''` the moment the option is focused, and `minLength: 1` made
     * that return `[]` — so the picker showed nothing until the moderator
     * typed. For `unban_user` that WAS the feature: a moderator who does not
     * remember a banned user's stored display name had no way to list who is
     * currently banned. Every existing test passed a non-empty query, so the
     * empty case was simply never asked.
     */
    it('lists the top of the list for an empty query rather than nothing', async () => {
      db._setupMock(() => [
        { discord_id: 'user-1', xivauth_id: null, username: 'Banned One', banned_at: 'now' },
      ]);

      const results = await searchBannedUsers(db as unknown as D1Database, '', 25);

      expect(results).toHaveLength(1);
      // `%%` matches everything; LIMIT 25 is what bounds it.
      expect(db._bindings[0][0]).toBe('%%');
      expect(db._bindings[0][4]).toBe(25);
    });

    it('still bounds an over-long query', async () => {
      db._setupMock(() => []);

      await searchBannedUsers(db as unknown as D1Database, 'x'.repeat(150), 25);

      // `validateQueryInput` TRUNCATES at maxLength rather than refusing, so
      // dropping `minLength` above did not loosen this end of the range.
      expect(db._bindings[0][0]).toBe(`%${'x'.repeat(100)}%`);
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
});
