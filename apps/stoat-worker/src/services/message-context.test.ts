/**
 * Tests for the MessageContextStore.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageContextStore } from './message-context.js';

describe('MessageContextStore', () => {
  let store: MessageContextStore;

  beforeEach(() => {
    store = new MessageContextStore();
    vi.useRealTimers();
  });

  it('stores and retrieves context', () => {
    const data = { command: 'dye-info', dyeId: 42, dyeHex: '#FF0000', createdAt: Date.now() };
    store.set('msg-01', data);
    expect(store.get('msg-01')).toEqual(data);
  });

  it('returns undefined for unknown message', () => {
    expect(store.get('unknown')).toBeUndefined();
  });

  it('deletes context', () => {
    store.set('msg-01', { command: 'test', createdAt: Date.now() });
    store.delete('msg-01');
    expect(store.get('msg-01')).toBeUndefined();
  });

  it('evicts expired entries on get', () => {
    vi.useFakeTimers();
    const now = Date.now();

    store.set('msg-old', { command: 'old', createdAt: now });

    // Advance past TTL (1 hour)
    vi.advanceTimersByTime(61 * 60 * 1000);

    expect(store.get('msg-old')).toBeUndefined();
  });

  it('does not evict entries within TTL', () => {
    vi.useFakeTimers();
    const now = Date.now();

    store.set('msg-recent', { command: 'recent', createdAt: now });

    // Advance 30 minutes (within 1-hour TTL)
    vi.advanceTimersByTime(30 * 60 * 1000);

    expect(store.get('msg-recent')).toBeDefined();
  });

  it('evicts oldest entries when capacity is exceeded', () => {
    // Fill to capacity (default 500) + 1
    for (let i = 0; i < 501; i++) {
      store.set(`msg-${i}`, { command: `cmd-${i}`, createdAt: Date.now() });
    }

    // The first entry should have been evicted
    expect(store.get('msg-0')).toBeUndefined();
    // The latest entry should still exist
    expect(store.get('msg-500')).toBeDefined();
  });
});
