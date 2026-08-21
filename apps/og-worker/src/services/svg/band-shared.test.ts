/**
 * notFoundBand input hardening (FINDING-005 / OG-1, 2026-08-21 audit).
 *
 * The not-found card echoes the caller's input as its title. That input used
 * to flow, uncapped, into `wrapName`, whose hyphenation loop re-measured the
 * remaining word on every decrement — cubic in the input length — so a single
 * 16 KB URL segment burned seconds-to-minutes of CPU. The card must (a) cap
 * the echoed label and (b) wrap in linear time regardless of input.
 */
import { describe, it, expect } from 'vitest';
import { notFoundBand } from './band-shared.js';

describe('notFoundBand', () => {
  it('echoes a normal label unchanged', () => {
    const svg = notFoundBand('Swatch', 'swatch', '#GGGGGG', 'swatch');
    expect(svg).toContain('#GGGGGG');
  });

  it('caps a pathological label and renders in linear time', () => {
    const junk = 'X'.repeat(16 * 1024);
    const started = Date.now();
    const svg = notFoundBand('Swatch', 'swatch', junk, 'swatch');
    const elapsed = Date.now() - started;

    // cubic wrapping on 16 K chars takes tens of seconds; linear is milliseconds
    expect(elapsed).toBeLessThan(2000);
    // the raw 16 K string must not be in the card at all
    expect(svg).not.toContain(junk);
    // the echoed label is clipped to a short prefix (32 chars + ellipsis)
    expect(svg).toContain(`${'X'.repeat(32)}…`);
  });

  it('caps an over-long CJK label as well', () => {
    const junk = '彩'.repeat(8 * 1024);
    const started = Date.now();
    const svg = notFoundBand('Swatch', 'swatch', junk, 'swatch');
    expect(Date.now() - started).toBeLessThan(2000);
    expect(svg).not.toContain(junk);
  });
});
