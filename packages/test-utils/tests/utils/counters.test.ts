/**
 * Tests for ID generation utility functions
 *
 * TEST-DESIGN-001: All ID generation uses random IDs for parallel test safety.
 */
import { describe, it, expect } from 'vitest';
import {
  nextStringId,
  randomId,
  randomStringId,
} from '../../src/utils/counters.js';

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
