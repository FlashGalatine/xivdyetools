import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';

type BeforeStatement = (statement: {
  sql: string;
  values: unknown[];
  database: DatabaseSync;
}) => void | Promise<void>;

/** A small D1-compatible adapter backed by SQLite for query-level route tests. */
export class SqliteD1 {
  readonly database = new DatabaseSync(':memory:');
  private beforeStatement: BeforeStatement | undefined;

  constructor(schema: string) {
    this.database.exec(schema);
  }

  setBeforeStatement(hook: BeforeStatement | undefined): void {
    this.beforeStatement = hook;
  }

  close(): void {
    this.database.close();
  }

  prepare(query: string): D1PreparedStatement {
    return new SqliteD1Statement(this, query) as unknown as D1PreparedStatement;
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.database.exec('BEGIN');
    try {
      const results = [] as D1Result<T>[];
      for (const statement of statements) {
        results.push(await (statement as unknown as SqliteD1Statement).all<T>());
      }
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  async exec(query: string): Promise<D1ExecResult> {
    this.database.exec(query);
    return { count: 0, duration: 0 };
  }

  async execute<T>(
    sql: string,
    values: unknown[],
    mode: 'all' | 'run'
  ): Promise<D1Result<T>> {
    await this.beforeStatement?.({ sql, values, database: this.database });
    const statement = this.database.prepare(sql);
    const bound = values as SQLInputValue[];
    let results: T[] = [];
    let changes = 0;
    let lastRowId = 0;
    if (mode === 'all') {
      results = statement.all(...bound) as T[];
      // Querying changes() observes SQLite's just-completed statement without
      // resetting it, so a following `WHERE changes() > 0` in batch sees the
      // same value D1 would expose in its metadata.
      const metadata = this.database
        .prepare('SELECT changes() AS changes, last_insert_rowid() AS last_row_id')
        .get() as { changes: number | bigint; last_row_id: number | bigint };
      changes = Number(metadata.changes);
      lastRowId = Number(metadata.last_row_id);
    } else {
      const result = statement.run(...bound);
      changes = Number(result.changes);
      lastRowId = Number(result.lastInsertRowid);
    }
    return {
      success: true,
      results,
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: changes,
        last_row_id: lastRowId,
        changed_db: changes > 0,
        changes,
      },
    };
  }
}

class SqliteD1Statement {
  constructor(
    private readonly d1: SqliteD1,
    private readonly sql: string,
    private readonly values: unknown[] = []
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new SqliteD1Statement(this.d1, this.sql, values) as unknown as D1PreparedStatement;
  }

  async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
    const result = await this.d1.execute<Record<string, unknown>>(this.sql, this.values, 'all');
    const row = result.results[0] ?? null;
    return (columnName && row ? row[columnName] : row) as T | null;
  }

  run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.d1.execute<T>(this.sql, this.values, 'run');
  }

  all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.d1.execute<T>(this.sql, this.values, 'all');
  }

  async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]> {
    const rows = (await this.d1.execute<Record<string, unknown>>(this.sql, this.values, 'all')).results;
    const names = rows[0] ? Object.keys(rows[0]) : [];
    const values = rows.map((row) => names.map((name) => row[name])) as T[];
    return options?.columnNames ? ([names, ...values] as T[]) : values;
  }
}
