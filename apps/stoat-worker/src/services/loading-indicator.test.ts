/**
 * Tests for loading-indicator.ts
 *
 * Covers withLoadingIndicator(): react/unreact lifecycle,
 * success & error paths, and resilience to react/unreact failures.
 */

import { describe, it, expect, vi } from 'vitest';
import { withLoadingIndicator } from './loading-indicator.js';

function createMockReactable() {
  return {
    react: vi.fn().mockResolvedValue(undefined),
    unreact: vi.fn().mockResolvedValue(undefined),
  };
}

describe('withLoadingIndicator', () => {
  it('calls react before executing the function', async () => {
    const message = createMockReactable();
    const callOrder: string[] = [];
    message.react.mockImplementation(async () => {
      callOrder.push('react');
    });

    await withLoadingIndicator(message, async () => {
      callOrder.push('fn');
      return 42;
    });

    expect(callOrder[0]).toBe('react');
    expect(callOrder[1]).toBe('fn');
  });

  it('calls unreact after the function succeeds', async () => {
    const message = createMockReactable();
    const result = await withLoadingIndicator(message, async () => 'done');

    expect(result).toBe('done');
    expect(message.unreact).toHaveBeenCalledOnce();
  });

  it('calls unreact after the function throws', async () => {
    const message = createMockReactable();
    const error = new Error('boom');

    await expect(
      withLoadingIndicator(message, async () => {
        throw error;
      }),
    ).rejects.toThrow('boom');

    expect(message.unreact).toHaveBeenCalledOnce();
  });

  it('returns the function result', async () => {
    const message = createMockReactable();
    const result = await withLoadingIndicator(message, async () => ({ key: 'value' }));
    expect(result).toEqual({ key: 'value' });
  });

  it('still executes function if react fails', async () => {
    const message = createMockReactable();
    message.react.mockRejectedValue(new Error('react failed'));

    const result = await withLoadingIndicator(message, async () => 'ok');
    expect(result).toBe('ok');
  });

  it('does not throw if unreact fails', async () => {
    const message = createMockReactable();
    message.unreact.mockRejectedValue(new Error('unreact failed'));

    const result = await withLoadingIndicator(message, async () => 'ok');
    expect(result).toBe('ok');
  });

  it('passes the encoded ⏳ emoji to react/unreact', async () => {
    const message = createMockReactable();
    await withLoadingIndicator(message, async () => null);

    const expectedEmoji = encodeURIComponent('⏳');
    expect(message.react).toHaveBeenCalledWith(expectedEmoji);
    expect(message.unreact).toHaveBeenCalledWith(expectedEmoji);
  });

  it('still unreacts when both fn throws and unreact throws', async () => {
    const message = createMockReactable();
    message.unreact.mockRejectedValue(new Error('unreact failed'));

    await expect(
      withLoadingIndicator(message, async () => {
        throw new Error('fn error');
      }),
    ).rejects.toThrow('fn error');

    // unreact was attempted even though it will fail
    expect(message.unreact).toHaveBeenCalledOnce();
  });
});
