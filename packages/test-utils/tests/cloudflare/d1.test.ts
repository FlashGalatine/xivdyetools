/**
 * Tests for Mock D1 Database
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockD1Database, createMockD1 } from '../../src/cloudflare/d1.js';

describe('createMockD1Database', () => {
  it('creates a mock database', () => {
    const db = createMockD1Database();

    expect(db.prepare).toBeDefined();
    expect(db.batch).toBeDefined();
    expect(db.exec).toBeDefined();
    expect(db.dump).toBeDefined();
    expect(db.withSession).toBeDefined();
    expect(db._queries).toBeDefined();
    expect(db._bindings).toBeDefined();
    expect(db._setupMock).toBeDefined();
    expect(db._reset).toBeDefined();
  });

  describe('prepare', () => {
    it('creates a prepared statement', () => {
      const db = createMockD1Database();

      const stmt = db.prepare('SELECT * FROM users');

      expect(stmt.bind).toBeDefined();
      expect(stmt.first).toBeDefined();
      expect(stmt.all).toBeDefined();
      expect(stmt.run).toBeDefined();
      expect(stmt.raw).toBeDefined();
    });

    describe('bind', () => {
      it('returns the statement for chaining', () => {
        const db = createMockD1Database();
        const stmt = db.prepare('SELECT * FROM users WHERE id = ?');

        const boundStmt = stmt.bind(1);

        expect(boundStmt).toBe(stmt);
      });

      it('tracks bindings', async () => {
        const db = createMockD1Database();
        const stmt = db.prepare('SELECT * FROM users WHERE id = ? AND name = ?');

        stmt.bind(1, 'Alice');
        await stmt.first();

        expect(db._bindings).toHaveLength(1);
        expect(db._bindings[0]).toEqual([1, 'Alice']);
      });
    });

    describe('first', () => {
      it('returns null by default', async () => {
        const db = createMockD1Database();

        const result = await db.prepare('SELECT * FROM users').first();

        expect(result).toBeNull();
      });

      it('tracks query', async () => {
        const db = createMockD1Database();

        await db.prepare('SELECT * FROM users WHERE id = 1').first();

        expect(db._queries).toContain('SELECT * FROM users WHERE id = 1');
      });

      it('returns first element from mock array', async () => {
        const db = createMockD1Database();
        db._setupMock(() => [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);

        const result = await db.prepare('SELECT * FROM users').first();

        expect(result).toEqual({ id: 1, name: 'Alice' });
      });

      it('returns single mock object directly', async () => {
        const db = createMockD1Database();
        db._setupMock(() => ({ id: 1, name: 'Alice' }));

        const result = await db.prepare('SELECT * FROM users').first();

        expect(result).toEqual({ id: 1, name: 'Alice' });
      });

      it('returns null for empty array', async () => {
        const db = createMockD1Database();
        db._setupMock(() => []);

        const result = await db.prepare('SELECT * FROM users').first();

        expect(result).toBeNull();
      });
    });

    describe('all', () => {
      it('returns empty results by default', async () => {
        const db = createMockD1Database();

        const result = await db.prepare('SELECT * FROM users').all();

        expect(result.results).toEqual([]);
        expect(result.success).toBe(true);
        expect(result.meta).toBeDefined();
      });

      it('tracks query', async () => {
        const db = createMockD1Database();

        await db.prepare('SELECT * FROM presets').all();

        expect(db._queries).toContain('SELECT * FROM presets');
      });

      it('returns mock array', async () => {
        const db = createMockD1Database();
        const mockUsers = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
        db._setupMock(() => mockUsers);

        const result = await db.prepare('SELECT * FROM users').all();

        expect(result.results).toEqual(mockUsers);
        expect(result.success).toBe(true);
      });

      it('wraps single object in array', async () => {
        const db = createMockD1Database();
        db._setupMock(() => ({ id: 1, name: 'Alice' }));

        const result = await db.prepare('SELECT * FROM users').all();

        expect(result.results).toEqual([{ id: 1, name: 'Alice' }]);
      });
    });

    describe('run', () => {
      it('returns success result by default', async () => {
        const db = createMockD1Database();

        const result = await db.prepare('INSERT INTO users VALUES (1)').run();

        expect(result.success).toBe(true);
        expect(result.meta.changes).toBe(1);
        expect(result.meta.rows_written).toBe(1);
        expect(result.meta.changed_db).toBe(true);
      });

      it('tracks query', async () => {
        const db = createMockD1Database();

        await db.prepare('DELETE FROM users WHERE id = 1').run();

        expect(db._queries).toContain('DELETE FROM users WHERE id = 1');
      });

      it('returns custom result when mock returns D1Result', async () => {
        const db = createMockD1Database();
        db._setupMock(() => ({
          results: [],
          success: true,
          meta: { duration: 5, changes: 0, last_row_id: 0, rows_read: 0, rows_written: 0, size_after: 100, changed_db: false },
        }));

        const result = await db.prepare('UPDATE users SET name = ?').run();

        expect(result.meta.duration).toBe(5);
        expect(result.meta.size_after).toBe(100);
      });
    });

    describe('raw', () => {
      it('returns empty array by default', async () => {
        const db = createMockD1Database();

        const result = await db.prepare('SELECT * FROM users').raw();

        expect(result).toEqual([]);
      });

      it('converts objects to arrays of values', async () => {
        const db = createMockD1Database();
        db._setupMock(() => [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);

        const result = await db.prepare('SELECT * FROM users').raw();

        expect(result).toEqual([[1, 'Alice'], [2, 'Bob']]);
      });
    });
  });

  describe('batch', () => {
    it('executes multiple statements', async () => {
      const db = createMockD1Database();
      const stmt1 = db.prepare('INSERT INTO users VALUES (1)');
      const stmt2 = db.prepare('INSERT INTO users VALUES (2)');

      const results = await db.batch([stmt1, stmt2]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe('exec', () => {
    it('executes raw SQL', async () => {
      const db = createMockD1Database();

      const result = await db.exec('CREATE TABLE users (id INTEGER)');

      expect(result.count).toBe(1);
      expect(result.duration).toBe(0);
      expect(db._queries).toContain('CREATE TABLE users (id INTEGER)');
    });
  });

  describe('dump', () => {
    it('returns empty ArrayBuffer', async () => {
      const db = createMockD1Database();

      const result = await db.dump();

      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(result.byteLength).toBe(0);
    });
  });

  describe('withSession', () => {
    it('returns a session object', () => {
      const db = createMockD1Database();

      const session = db.withSession();

      expect(session.prepare).toBeDefined();
      expect(session.batch).toBeDefined();
      expect(session.exec).toBeDefined();
      expect(session.getBookmark).toBeDefined();
    });

    it('returns default bookmark', () => {
      const db = createMockD1Database();

      const session = db.withSession();

      expect(session.getBookmark()).toBe('mock-bookmark');
    });

    it('returns provided constraint/bookmark', () => {
      const db = createMockD1Database();

      const session = db.withSession('custom-bookmark');

      expect(session.getBookmark()).toBe('custom-bookmark');
    });

    it('session shares query tracking', async () => {
      const db = createMockD1Database();
      const session = db.withSession();

      await session.prepare('SELECT * FROM users').first();

      expect(db._queries).toContain('SELECT * FROM users');
    });

    it('session exec tracks queries', async () => {
      const db = createMockD1Database();
      const session = db.withSession();

      await session.exec('PRAGMA table_info(users)');

      expect(db._queries).toContain('PRAGMA table_info(users)');
    });

    it('session batch works', async () => {
      const db = createMockD1Database();
      const session = db.withSession();
      const stmt1 = session.prepare('INSERT INTO users VALUES (1)');
      const stmt2 = session.prepare('INSERT INTO users VALUES (2)');

      const results = await session.batch([stmt1, stmt2]);

      expect(results).toHaveLength(2);
    });
  });

  describe('_setupMock', () => {
    it('sets up conditional responses based on query', async () => {
      const db = createMockD1Database();
      db._setupMock((query, bindings) => {
        if (query.includes('users')) {
          return [{ id: 1, name: 'User' }];
        }
        if (query.includes('presets')) {
          return [{ id: 'p1', name: 'Preset' }];
        }
        return null;
      });

      const users = await db.prepare('SELECT * FROM users').all();
      const presets = await db.prepare('SELECT * FROM presets').all();
      const other = await db.prepare('SELECT * FROM other').first();

      expect(users.results).toEqual([{ id: 1, name: 'User' }]);
      expect(presets.results).toEqual([{ id: 'p1', name: 'Preset' }]);
      expect(other).toBeNull();
    });

    it('receives bindings', async () => {
      const db = createMockD1Database();
      let capturedBindings: unknown[] = [];
      db._setupMock((_query, bindings) => {
        capturedBindings = bindings;
        return [{ id: bindings[0] }];
      });

      await db.prepare('SELECT * FROM users WHERE id = ?').bind(42).first();

      expect(capturedBindings).toEqual([42]);
    });
  });

  describe('_reset', () => {
    it('clears queries and bindings', async () => {
      const db = createMockD1Database();
      await db.prepare('SELECT 1').first();
      db.prepare('SELECT 2').bind('a', 'b');

      db._reset();

      expect(db._queries).toHaveLength(0);
      expect(db._bindings).toHaveLength(0);
    });

    it('clears mock function', async () => {
      const db = createMockD1Database();
      db._setupMock(() => [{ id: 1 }]);

      db._reset();

      const result = await db.prepare('SELECT * FROM users').first();
      expect(result).toBeNull();
    });
  });

  describe('_mockFn', () => {
    it('returns undefined when no mock is set', () => {
      const db = createMockD1Database();

      expect(db._mockFn).toBeUndefined();
    });

    it('returns the mock function when set', () => {
      const db = createMockD1Database();
      const mockFn = () => [{ id: 1 }];
      db._setupMock(mockFn);

      expect(db._mockFn).toBe(mockFn);
    });
  });
});

describe('createMockD1', () => {
  it('returns a D1Database-typed mock', () => {
    const db = createMockD1();

    // Should have D1Database methods
    expect(db.prepare).toBeDefined();
    expect(db.batch).toBeDefined();
    expect(db.exec).toBeDefined();
  });

  it('can be cast back to access test helpers', async () => {
    const db = createMockD1();
    const mockDb = db as unknown as ReturnType<typeof createMockD1Database>;

    mockDb._setupMock(() => [{ id: 1 }]);
    await db.prepare('SELECT 1').first();

    expect(mockDb._queries).toContain('SELECT 1');
  });
});
