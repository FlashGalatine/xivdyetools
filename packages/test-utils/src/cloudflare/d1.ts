/**
 * Mock D1 Database for testing Cloudflare Workers
 *
 * Provides a mock implementation of D1Database that tracks queries
 * and allows custom mock responses for testing.
 *
 * @example
 * ```typescript
 * const db = createMockD1Database();
 *
 * // Setup mock responses using regex patterns (TEST-DESIGN-002)
 * // Use /^\s*SELECT/i to anchor to start and be case-insensitive
 * db._setupMock((query, bindings) => {
 *   if (/^\s*SELECT/i.test(query) && query.includes('presets')) {
 *     return [{ id: 'preset-1', name: 'Test Preset' }];
 *   }
 *   if (/^\s*INSERT/i.test(query)) {
 *     return { meta: { changes: 1, last_row_id: 1 } };
 *   }
 *   return null;
 * });
 *
 * // Use in tests
 * const env = { DB: db as unknown as D1Database };
 *
 * // Assert queries were made
 * expect(db._queries).toContain('SELECT * FROM presets');
 * expect(db._bindings[0]).toEqual(['param1']);
 *
 * // Reset between tests
 * db._reset();
 * ```
 */

/**
 * Function type for mocking query responses
 */
export type QueryMockFn = (query: string, bindings: unknown[]) => unknown;

/**
 * Mock D1 prepared statement interface
 */
/**
 * D1 result type - matches Cloudflare's D1Result<T>
 */
export interface D1Result<T = unknown> {
  results: T[];
  success: true;
  meta: D1Meta;
}

export interface MockD1PreparedStatement {
  bind: (...values: unknown[]) => MockD1PreparedStatement;
  first: <T = unknown>() => Promise<T | null>;
  all: <T = unknown>() => Promise<D1Result<T>>;
  run: <T = unknown>() => Promise<D1Result<T>>;
  // raw() has complex overloads in D1 - simplified for testing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: <T = unknown[]>(options?: { columnNames?: boolean }) => Promise<T>;
}

/**
 * D1 result metadata - matches Cloudflare's D1Meta type
 * Includes index signature to match Record<string, unknown> requirement
 */
interface D1Meta {
  duration: number;
  changes: number;
  last_row_id: number;
  rows_read: number;
  rows_written: number;
  size_after: number;
  changed_db: boolean;
  [key: string]: unknown;
}

/**
 * Mock D1 database session (returned by withSession)
 * Mimics D1DatabaseSession which has similar methods to D1Database
 */
export interface MockD1DatabaseSession {
  prepare: (query: string) => MockD1PreparedStatement;
  batch: <T = unknown>(statements: MockD1PreparedStatement[]) => Promise<D1Result<T>[]>;
  exec: (query: string) => Promise<{ count: number; duration: number }>;
  /** Get constraint string for this session */
  getBookmark: () => string;
}

/**
 * Configuration options for the mock D1 database
 */
export interface MockD1DatabaseConfig {
  /** Maximum number of queries to keep in history (prevents memory leaks). Default: 1000 */
  maxQueryHistory?: number;
}

/** Default maximum query history size */
const DEFAULT_MAX_QUERY_HISTORY = 1000;

/**
 * Extended mock D1 database with test helpers
 */
export interface MockD1Database {
  prepare: (query: string) => MockD1PreparedStatement;
  batch: <T = unknown>(statements: MockD1PreparedStatement[]) => Promise<D1Result<T>[]>;
  exec: (query: string) => Promise<{ count: number; duration: number }>;
  dump: () => Promise<ArrayBuffer>;
  /** Start a session - returns a session object with same query methods */
  withSession: (constraintOrBookmark?: string) => MockD1DatabaseSession;

  /** Array of all queries executed (for assertions). Limited to maxQueryHistory entries. */
  _queries: string[];

  /** Array of all binding arrays passed to queries. Limited to maxQueryHistory entries. */
  _bindings: unknown[][];

  /** Setup a mock function to return custom responses */
  _setupMock: (fn: QueryMockFn) => void;

  /** Reset queries, bindings, and mock function */
  _reset: () => void;

  /** Current mock function (if any) */
  _mockFn?: QueryMockFn;

  /**
   * Set the ban status for ban-check middleware tests
   * @param isBanned - true to simulate banned user, false or undefined for not banned
   */
  _setBanStatus: (isBanned: boolean) => void;

  /** Set the maximum query history size (for memory management) */
  _setMaxQueryHistory: (max: number) => void;
}

/**
 * Creates a mock D1 database for testing
 *
 * The mock tracks all queries and bindings for assertions, and supports
 * custom response functions for simulating database behavior.
 *
 * TEST-OPT-003 FIX: Added maxQueryHistory config to prevent unbounded memory growth
 * in long-running test suites. Default is 1000 queries.
 *
 * @param config - Optional configuration for the mock database
 * @returns A mock D1 database that can be cast to D1Database
 */
export function createMockD1Database(config?: MockD1DatabaseConfig): MockD1Database {
  const queries: string[] = [];
  const bindings: unknown[][] = [];
  let mockFn: QueryMockFn | undefined;
  let banStatus: boolean | undefined;
  let maxQueryHistory = config?.maxQueryHistory ?? DEFAULT_MAX_QUERY_HISTORY;

  /**
   * Enforce max query history limit using FIFO eviction
   * TEST-OPT-003 FIX: Prevents unbounded memory growth
   */
  const enforceMaxHistory = (): void => {
    while (queries.length > maxQueryHistory) {
      queries.shift();
      bindings.shift();
    }
  };

  const createDefaultMeta = (): D1Meta => ({
    duration: 0,
    changes: 0,
    last_row_id: 0,
    rows_read: 0,
    rows_written: 0,
    size_after: 0,
    changed_db: false,
  });

  const createStatement = (query: string): MockD1PreparedStatement => {
    let boundValues: unknown[] = [];

    const statement: MockD1PreparedStatement = {
      bind: (...values: unknown[]) => {
        boundValues = values;
        bindings.push(values);
        return statement;
      },

      first: async <T = unknown>() => {
        queries.push(query);
        enforceMaxHistory();
        // Special handling for banned_users queries to prevent false ban detection
        // Use _setBanStatus(true) to simulate a banned user in tests
        if (query.includes('banned_users')) {
          if (banStatus === true) {
            return { 1: 1 } as T; // User is banned
          }
          // Default: user not banned (don't call mockFn to avoid side effects)
          return null;
        }
        if (mockFn) {
          const result = mockFn(query, boundValues);
          // If result is an array, return first element
          if (Array.isArray(result)) {
            return (result[0] ?? null) as T | null;
          }
          return result as T | null;
        }
        return null;
      },

      all: async <T = unknown>(): Promise<D1Result<T>> => {
        queries.push(query);
        enforceMaxHistory();
        if (mockFn) {
          const result = mockFn(query, boundValues);
          if (Array.isArray(result)) {
            return { results: result as T[], success: true as const, meta: createDefaultMeta() };
          }
          // If single object returned, wrap in array
          if (result && typeof result === 'object') {
            return { results: [result] as T[], success: true as const, meta: createDefaultMeta() };
          }
        }
        return { results: [] as T[], success: true as const, meta: createDefaultMeta() };
      },

      run: async <T = unknown>(): Promise<D1Result<T>> => {
        queries.push(query);
        enforceMaxHistory();
        if (mockFn) {
          const result = mockFn(query, boundValues);
          if (result && typeof result === 'object' && 'meta' in result) {
            return result as D1Result<T>;
          }
        }
        return {
          results: [] as T[],
          success: true as const,
          meta: { ...createDefaultMeta(), changes: 1, rows_written: 1, last_row_id: 1, changed_db: true },
        };
      },

      raw: async <T = unknown[]>(_options?: { columnNames?: boolean }): Promise<T> => {
        queries.push(query);
        enforceMaxHistory();
        if (mockFn) {
          const result = mockFn(query, boundValues);
          if (Array.isArray(result)) {
            // Convert objects to arrays of values
            return result.map((row) => {
              if (typeof row === 'object' && row !== null) {
                return Object.values(row);
              }
              return row;
            }) as T;
          }
        }
        return [] as T;
      },
    };

    return statement;
  };

  // Create the mock database object
  const mockDb: MockD1Database = {
    prepare: createStatement,

    batch: async <T = unknown>(statements: MockD1PreparedStatement[]): Promise<D1Result<T>[]> => {
      const results: D1Result<T>[] = [];
      for (const stmt of statements) {
        // Execute each statement's run method
        await stmt.run();
        results.push({ results: [] as T[], success: true as const, meta: createDefaultMeta() });
      }
      return results;
    },

    exec: async (query: string) => {
      queries.push(query);
      enforceMaxHistory();
      return { count: 1, duration: 0 };
    },

    dump: async () => {
      return new ArrayBuffer(0);
    },

    // withSession returns a session object with the same query methods
    // In real D1, this creates a transaction-like session for consistency
    withSession: (constraintOrBookmark?: string): MockD1DatabaseSession => {
      // Return a session object that shares the same query tracking
      return {
        prepare: createStatement,
        batch: async <T = unknown>(statements: MockD1PreparedStatement[]): Promise<D1Result<T>[]> => {
          const results: D1Result<T>[] = [];
          for (const stmt of statements) {
            await stmt.run();
            results.push({ results: [] as T[], success: true as const, meta: createDefaultMeta() });
          }
          return results;
        },
        exec: async (query: string) => {
          queries.push(query);
          enforceMaxHistory();
          return { count: 1, duration: 0 };
        },
        getBookmark: () => constraintOrBookmark ?? 'mock-bookmark',
      };
    },

    _queries: queries,
    _bindings: bindings,

    _setupMock: (fn: QueryMockFn) => {
      mockFn = fn;
    },

    _reset: () => {
      queries.length = 0;
      bindings.length = 0;
      mockFn = undefined;
      banStatus = undefined;
    },

    get _mockFn() {
      return mockFn;
    },

    _setBanStatus: (isBanned: boolean) => {
      banStatus = isBanned;
    },

    _setMaxQueryHistory: (max: number) => {
      maxQueryHistory = max;
      // Immediately enforce the new limit
      enforceMaxHistory();
    },
  };

  return mockDb;
}

/**
 * Creates a mock D1 database pre-cast as D1Database
 *
 * Use this when you need to pass the mock to code expecting D1Database.
 * The mock still supports all testing helpers via type assertion:
 *
 * @example
 * ```typescript
 * const db = createMockD1();
 * // Use as D1Database
 * someFunction(db);
 *
 * // Access testing helpers via assertion
 * (db as unknown as MockD1Database)._queries;
 * (db as unknown as MockD1Database)._setupMock(...);
 * ```
 *
 * @returns A D1Database-typed mock
 */
export function createMockD1(): D1Database {
  return createMockD1Database() as unknown as D1Database;
}
