/**
 * Tests for counter utility functions
 *
 * TEST-DESIGN-001: nextStringId now uses random IDs for parallel test safety.
 * The legacy nextId function still uses sequential counters.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  nextId,
  nextStringId,
  randomId,
  randomStringId,
  resetCounters,
  resetCounter,
  getCounterValue,
} from '../../src/utils/counters.js';

beforeEach(() => {
  resetCounters();
});

describe('nextId (legacy sequential)', () => {
  it('returns sequential numbers starting at 1', () => {
    expect(nextId('test')).toBe(1);
    expect(nextId('test')).toBe(2);
    expect(nextId('test')).toBe(3);
  });

  it('maintains separate counters for different keys', () => {
    expect(nextId('users')).toBe(1);
    expect(nextId('presets')).toBe(1);
    expect(nextId('users')).toBe(2);
    expect(nextId('votes')).toBe(1);
    expect(nextId('presets')).toBe(2);
  });

  it('handles many increments', () => {
    for (let i = 0; i < 100; i++) {
      nextId('counter');
    }
    expect(nextId('counter')).toBe(101);
  });
});

// TEST-DESIGN-001: randomId generates unique numeric IDs
describe('randomId', () => {
  it('returns a positive integer', () => {
    const id = randomId();
    expect(Number.isInteger(id)).toBe(true);
    expect(id).toBeGreaterThan(0);
  });

  it('returns unique IDs', () => {
    const ids = new Set<number>();
    for (let i = 0; i < 100; i++) {
      ids.add(randomId());
    }
    // With 9-digit random numbers, 100 IDs should all be unique
    expect(ids.size).toBe(100);
  });
});

// TEST-DESIGN-001: randomStringId generates unique prefixed IDs
describe('randomStringId', () => {
  it('returns prefixed random IDs', () => {
    const id = randomStringId('user');
    expect(id).toMatch(/^user-[a-z0-9]{8}$/);
  });

  it('returns unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(randomStringId('test'));
    }
    expect(ids.size).toBe(100);
  });

  it('handles various prefixes', () => {
    expect(randomStringId('discord')).toMatch(/^discord-[a-z0-9]{8}$/);
    expect(randomStringId('xivauth')).toMatch(/^xivauth-[a-z0-9]{8}$/);
    expect(randomStringId('test-item')).toMatch(/^test-item-[a-z0-9]{8}$/);
  });
});

// TEST-DESIGN-001: nextStringId now delegates to randomStringId
describe('nextStringId (now uses random)', () => {
  it('returns prefixed random IDs (not sequential)', () => {
    const id1 = nextStringId('user');
    const id2 = nextStringId('user');
    const id3 = nextStringId('user');

    // Should be random format, not sequential
    expect(id1).toMatch(/^user-[a-z0-9]{8}$/);
    expect(id2).toMatch(/^user-[a-z0-9]{8}$/);
    expect(id3).toMatch(/^user-[a-z0-9]{8}$/);

    // Should be unique
    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
  });

  it('returns unique IDs for parallel test safety', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      ids.add(nextStringId('preset'));
    }
    expect(ids.size).toBe(50);
  });

  it('handles various prefixes', () => {
    expect(nextStringId('discord')).toMatch(/^discord-[a-z0-9]{8}$/);
    expect(nextStringId('xivauth')).toMatch(/^xivauth-[a-z0-9]{8}$/);
    expect(nextStringId('test-item')).toMatch(/^test-item-[a-z0-9]{8}$/);
  });
});

describe('resetCounters', () => {
  it('resets all counters', () => {
    nextId('a');
    nextId('a');
    nextId('b');

    resetCounters();

    expect(nextId('a')).toBe(1);
    expect(nextId('b')).toBe(1);
  });

  it('allows fresh counting after reset', () => {
    for (let i = 0; i < 10; i++) {
      nextId('test');
    }

    resetCounters();

    expect(nextId('test')).toBe(1);
  });
});

describe('resetCounter', () => {
  it('resets a specific counter', () => {
    nextId('keep');
    nextId('keep');
    nextId('reset');
    nextId('reset');

    resetCounter('reset');

    expect(nextId('reset')).toBe(1);
    expect(nextId('keep')).toBe(3);
  });

  it('handles non-existent counter', () => {
    expect(() => resetCounter('nonexistent')).not.toThrow();
    expect(nextId('nonexistent')).toBe(1);
  });
});

describe('getCounterValue', () => {
  it('returns current counter value', () => {
    nextId('test');
    nextId('test');
    nextId('test');

    expect(getCounterValue('test')).toBe(3);
  });

  it('returns 0 for uninitialized counter', () => {
    expect(getCounterValue('never-used')).toBe(0);
  });

  it('does not increment the counter', () => {
    nextId('check');
    nextId('check');

    getCounterValue('check');
    getCounterValue('check');
    getCounterValue('check');

    expect(getCounterValue('check')).toBe(2);
  });
});
