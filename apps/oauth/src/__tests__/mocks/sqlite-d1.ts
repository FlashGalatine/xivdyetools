import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import type { UserRow } from '../../types.js';

/** Real SQLite, with D1's atomic batch semantics. No production BEGIN statements. */
export function createSQLiteD1(
  schema = readFileSync(new URL('../../../schema/users.sql', import.meta.url), 'utf8'),
  onStatement?: (statement: { sql: string; params: unknown[] }) => void,
  storage?: { filename: string; existing?: boolean },
) {
  const sqlite = new DatabaseSync(storage?.filename ?? ':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  if (!storage?.existing) sqlite.exec(schema);
  const statements: { sql: string; params: unknown[] }[] = [];
  let beforeBatch: (() => void) | undefined;
  const prepare = (sql: string, params: SQLInputValue[] = []) => {
    const execute = () => {
      statements.push({ sql, params });
      onStatement?.({ sql, params });
      const statement = sqlite.prepare(sql);
      if (statement.columns().length) {
        return { results: statement.all(...params), success: true, meta: { changes: 0 } };
      }
      const result = statement.run(...params);
      return { results: [], success: true, meta: { changes: Number(result.changes) } };
    };
    return {
      bind: (...values: SQLInputValue[]) => prepare(sql, values),
      first: async (column?: string) => {
        const row = execute().results[0];
        return row ? (column ? row[column] : row) : null;
      },
      all: async () => execute(),
      run: async () => execute(),
      raw: async () => execute().results.map(Object.values),
    };
  };
  const db = {
    prepare,
    batch: async (batch: ReturnType<typeof prepare>[]) => {
      const hook = beforeBatch;
      beforeBatch = undefined;
      hook?.();
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const statement of batch) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 0, duration: 0 };
    },
  } as unknown as D1Database;
  return {
    db,
    sqlite,
    statements,
    beforeBatch: (hook: () => void) => {
      beforeBatch = hook;
    },
    seed: (row: Partial<UserRow> & Pick<UserRow, 'id'>) => {
      const value = {
        discord_id: null,
        xivauth_id: null,
        auth_provider: 'discord',
        username: 'Stored name',
        created_at: '2026-01-01 00:00:00',
        updated_at: '2026-01-01 00:00:00',
        ...row,
      };
      const keys = Object.keys(value);
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO users (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
        )
        .run(...Object.values(value));
    },
    close: () => sqlite.close(),
  };
}
