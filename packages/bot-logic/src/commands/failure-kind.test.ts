/**
 * failureKind — the one shape every command's failure log line takes (BUG-125).
 *
 * The line names what failed, never what it was given: an error's message can
 * quote its input, and that input is what the user typed or the player's file.
 */
import { describe, it, expect } from 'vitest';
import { AppError } from '@xivdyetools/types';
import { failureKind } from './failure-kind.js';

const SENTINEL = 'Sentinel Real Name #ABCDEF';

describe('failureKind', () => {
  it('names an Error by its class', () => {
    expect(failureKind(new TypeError(SENTINEL))).toBe('TypeError');
    expect(failureKind(new RangeError(SENTINEL))).toBe('RangeError');
    expect(failureKind(new Error(SENTINEL))).toBe('Error');
  });

  it('names an AppError by its class and code', () => {
    expect(failureKind(new AppError('INVALID_HEX_COLOR', `Invalid hex color: ${SENTINEL}`))).toBe(
      'AppError INVALID_HEX_COLOR',
    );
  });

  it('ignores a code that is not a string', () => {
    const error = Object.assign(new Error(SENTINEL), { code: 503 });
    expect(failureKind(error)).toBe('Error');
  });

  it('names a thrown non-Error by its type only — even one shaped like an AppError', () => {
    expect(failureKind(SENTINEL)).toBe('string');
    expect(failureKind(42)).toBe('number');
    expect(failureKind({ code: 'INVALID_INPUT', message: SENTINEL })).toBe('object');
    expect(failureKind(null)).toBe('object');
    expect(failureKind(undefined)).toBe('undefined');
  });

  it('never carries the message', () => {
    const thrown: unknown[] = [
      new TypeError(SENTINEL),
      new AppError('INVALID_INPUT', SENTINEL),
      SENTINEL,
      { message: SENTINEL },
    ];
    for (const error of thrown) expect(failureKind(error)).not.toContain('Sentinel');
  });
});
