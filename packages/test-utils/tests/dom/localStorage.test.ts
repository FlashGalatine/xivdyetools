/**
 * Tests for localStorage mock utilities
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MockLocalStorage,
  createMockLocalStorage,
  setupLocalStorageMock,
  MockSessionStorage,
  createMockSessionStorage,
  setupSessionStorageMock,
} from '../../src/dom/localStorage.js';

describe('MockLocalStorage', () => {
  let storage: MockLocalStorage;

  beforeEach(() => {
    storage = new MockLocalStorage();
  });

  describe('setItem and getItem', () => {
    it('stores and retrieves a value', () => {
      storage.setItem('key', 'value');

      expect(storage.getItem('key')).toBe('value');
    });

    it('returns null for missing key', () => {
      expect(storage.getItem('nonexistent')).toBeNull();
    });

    it('overwrites existing value', () => {
      storage.setItem('key', 'first');
      storage.setItem('key', 'second');

      expect(storage.getItem('key')).toBe('second');
    });
  });

  describe('removeItem', () => {
    it('removes a key', () => {
      storage.setItem('key', 'value');

      storage.removeItem('key');

      expect(storage.getItem('key')).toBeNull();
    });

    it('does not throw for missing key', () => {
      expect(() => storage.removeItem('nonexistent')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('removes all items', () => {
      storage.setItem('key1', 'value1');
      storage.setItem('key2', 'value2');
      storage.setItem('key3', 'value3');

      storage.clear();

      expect(storage.length).toBe(0);
      expect(storage.getItem('key1')).toBeNull();
    });
  });

  describe('length', () => {
    it('returns 0 for empty storage', () => {
      expect(storage.length).toBe(0);
    });

    it('returns correct count', () => {
      storage.setItem('key1', 'value1');
      storage.setItem('key2', 'value2');

      expect(storage.length).toBe(2);
    });
  });

  describe('key', () => {
    it('returns key at index', () => {
      storage.setItem('a', '1');
      storage.setItem('b', '2');

      const keys = [storage.key(0), storage.key(1)];

      expect(keys).toContain('a');
      expect(keys).toContain('b');
    });

    it('returns null for out of range index', () => {
      storage.setItem('key', 'value');

      expect(storage.key(1)).toBeNull();
      expect(storage.key(100)).toBeNull();
    });
  });

  describe('keys', () => {
    it('returns all keys', () => {
      storage.setItem('a', '1');
      storage.setItem('b', '2');
      storage.setItem('c', '3');

      const keys = storage.keys();

      expect(keys).toContain('a');
      expect(keys).toContain('b');
      expect(keys).toContain('c');
      expect(keys).toHaveLength(3);
    });

    it('returns empty array for empty storage', () => {
      expect(storage.keys()).toEqual([]);
    });
  });

  describe('toObject', () => {
    it('returns all entries as object', () => {
      storage.setItem('a', '1');
      storage.setItem('b', '2');

      const obj = storage.toObject();

      expect(obj).toEqual({ a: '1', b: '2' });
    });

    it('returns empty object for empty storage', () => {
      expect(storage.toObject()).toEqual({});
    });
  });

  describe('fromObject', () => {
    it('populates storage from object', () => {
      storage.fromObject({ x: 'foo', y: 'bar' });

      expect(storage.getItem('x')).toBe('foo');
      expect(storage.getItem('y')).toBe('bar');
    });

    it('clears existing items', () => {
      storage.setItem('old', 'value');

      storage.fromObject({ new: 'value' });

      expect(storage.getItem('old')).toBeNull();
      expect(storage.getItem('new')).toBe('value');
    });
  });

  describe('_store', () => {
    it('allows direct access to internal storage', () => {
      storage.setItem('key', 'value');

      expect(storage._store.get('key')).toBe('value');
    });

    it('changes reflect in getItem', () => {
      storage._store.set('direct', 'set');

      expect(storage.getItem('direct')).toBe('set');
    });
  });
});

describe('createMockLocalStorage', () => {
  it('returns a new MockLocalStorage instance', () => {
    const storage = createMockLocalStorage();

    expect(storage).toBeInstanceOf(MockLocalStorage);
  });
});

describe('setupLocalStorageMock', () => {
  it('sets globalThis.localStorage', () => {
    const storage = setupLocalStorageMock();

    expect(globalThis.localStorage).toBe(storage);
  });

  it('returns the mock storage for assertions', () => {
    const storage = setupLocalStorageMock();

    storage.setItem('test', 'value');

    expect(storage.getItem('test')).toBe('value');
    expect(globalThis.localStorage.getItem('test')).toBe('value');
  });
});

describe('MockSessionStorage', () => {
  it('extends MockLocalStorage', () => {
    const storage = new MockSessionStorage();

    expect(storage).toBeInstanceOf(MockLocalStorage);
  });

  it('has all localStorage methods', () => {
    const storage = new MockSessionStorage();

    storage.setItem('key', 'value');
    expect(storage.getItem('key')).toBe('value');

    storage.removeItem('key');
    expect(storage.getItem('key')).toBeNull();
  });
});

describe('createMockSessionStorage', () => {
  it('returns a new MockSessionStorage instance', () => {
    const storage = createMockSessionStorage();

    expect(storage).toBeInstanceOf(MockSessionStorage);
  });
});

describe('setupSessionStorageMock', () => {
  it('sets globalThis.sessionStorage', () => {
    const storage = setupSessionStorageMock();

    expect(globalThis.sessionStorage).toBe(storage);
  });

  it('returns the mock storage for assertions', () => {
    const storage = setupSessionStorageMock();

    storage.setItem('session', 'data');

    expect(storage.getItem('session')).toBe('data');
    expect(globalThis.sessionStorage.getItem('session')).toBe('data');
  });
});
