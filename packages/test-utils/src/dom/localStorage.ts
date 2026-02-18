/**
 * Mock localStorage for testing
 *
 * Provides a Map-backed implementation of the Storage interface
 * for testing localStorage-dependent code.
 *
 * @example
 * ```typescript
 * const storage = new MockLocalStorage();
 *
 * // Use as global localStorage
 * Object.defineProperty(globalThis, 'localStorage', { value: storage });
 *
 * // Or use directly
 * storage.setItem('key', 'value');
 * expect(storage.getItem('key')).toBe('value');
 *
 * // Check internal storage
 * expect(storage._store.get('key')).toBe('value');
 *
 * // Reset between tests
 * storage.clear();
 * ```
 */

/**
 * Mock implementation of the Storage interface
 */
export class MockLocalStorage implements Storage {
  /** Internal storage map */
  readonly _store = new Map<string, string>();

  get length(): number {
    return this._store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this._store.keys());
    return keys[index] ?? null;
  }

  getItem(key: string): string | null {
    return this._store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this._store.set(key, value);
  }

  removeItem(key: string): void {
    this._store.delete(key);
  }

  clear(): void {
    this._store.clear();
  }

  /**
   * Get all keys in storage
   */
  keys(): string[] {
    return Array.from(this._store.keys());
  }

  /**
   * Get all entries as an object
   */
  toObject(): Record<string, string> {
    return Object.fromEntries(this._store);
  }

  /**
   * Populate storage from an object
   */
  fromObject(obj: Record<string, string>): void {
    this._store.clear();
    for (const [key, value] of Object.entries(obj)) {
      this._store.set(key, value);
    }
  }
}

/**
 * Creates a mock localStorage instance
 *
 * @returns A new MockLocalStorage instance
 */
export function createMockLocalStorage(): MockLocalStorage {
  return new MockLocalStorage();
}

/**
 * Sets up mock localStorage on globalThis
 *
 * @returns The mock localStorage instance (for assertions)
 */
export function setupLocalStorageMock(): MockLocalStorage {
  const storage = new MockLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    writable: true,
    configurable: true,
  });
  return storage;
}

/**
 * Mock implementation of sessionStorage
 * (Same interface as localStorage)
 */
export class MockSessionStorage extends MockLocalStorage {}

/**
 * Creates a mock sessionStorage instance
 *
 * @returns A new MockSessionStorage instance
 */
export function createMockSessionStorage(): MockSessionStorage {
  return new MockSessionStorage();
}

/**
 * Sets up mock sessionStorage on globalThis
 *
 * @returns The mock sessionStorage instance
 */
export function setupSessionStorageMock(): MockSessionStorage {
  const storage = new MockSessionStorage();
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: storage,
    writable: true,
    configurable: true,
  });
  return storage;
}
