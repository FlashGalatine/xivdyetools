/**
 * Tests for the frame system's band-ink law (2026-08-29).
 *
 * A header band painted in a dye's own colour needs its ink picked per dye:
 * white on Dalamud Red, near-black on Pure White. The rule is the one
 * og-worker's band already uses — whichever of the two candidates MEASURES
 * the higher WCAG contrast against the ground — so the Discord card and the
 * OG card agree for every dye.
 */

import { describe, it, expect } from 'vitest';
import { bandInk, pillInkOnDye } from './frame.js';

describe('bandInk', () => {
  it('picks near-black ink on light grounds', () => {
    expect(bandInk('#F9F8F4').on).toBe('#0A0A0A'); // Pure White
    expect(bandInk('#FAC62B').on).toBe('#0A0A0A'); // Honey Yellow
    // Qiqirn Brown (L 0.183): black measures 4.66:1, white 4.50:1
    expect(bandInk('#996E3F').on).toBe('#0A0A0A');
  });

  it('keeps white ink on dark grounds', () => {
    expect(bandInk('#781A1A').on).toBe('#FFFFFF'); // Dalamud Red
    expect(bandInk('#2A2A2A').on).toBe('#FFFFFF');
    expect(bandInk('#0000FF').on).toBe('#FFFFFF');
  });

  it('switches where the two measured contrasts cross, not at a fixed lightness', () => {
    // #757575: 4.61:1 against white, 4.56:1 against black → white
    expect(bandInk('#757575').on).toBe('#FFFFFF');
    // #787878: 4.42:1 against white, 4.76:1 against black → near-black
    expect(bandInk('#787878').on).toBe('#0A0A0A');
  });

  it('carries the mid and dim tiers of the same ink', () => {
    expect(bandInk('#F9F8F4')).toEqual({
      on: '#0A0A0A',
      onMid: 'rgba(10,10,10,0.85)',
      onDim: 'rgba(10,10,10,0.72)',
    });
    expect(bandInk('#781A1A')).toEqual({
      on: '#FFFFFF',
      onMid: 'rgba(255,255,255,0.85)',
      onDim: 'rgba(255,255,255,0.72)',
    });
  });

  it('accepts lower-case and bare hex', () => {
    expect(bandInk('f9f8f4').on).toBe('#0A0A0A');
    expect(bandInk('#781a1a').on).toBe('#FFFFFF');
  });
});

// The command pill on a dye ground is a 34 % black scrim, so its ink is judged
// against the dye seen THROUGH the scrim, not the bare dye: a mid-tone that
// takes dark ink on the band still wants white inside the darkened pill.
describe('pillInkOnDye', () => {
  it('is near-black inside the pill on a light dye', () => {
    expect(pillInkOnDye('#F9F8F4')).toBe('rgba(10,10,10,0.85)'); // Pure White
    expect(pillInkOnDye('#FAC62B')).toBe('rgba(10,10,10,0.85)'); // Honey Yellow
  });

  it('is white inside the pill on a dark dye', () => {
    expect(pillInkOnDye('#781A1A')).toBe('rgba(255,255,255,0.85)'); // Dalamud Red
  });

  it('is white inside the pill on a mid-tone whose band ink is dark', () => {
    // Qiqirn Brown: band ink is near-black (L 0.183), but under the scrim the
    // ground drops to L ≈ 0.07, where white measures 8.5:1 and black 2.4:1.
    expect(bandInk('#996E3F').on).toBe('#0A0A0A');
    expect(pillInkOnDye('#996E3F')).toBe('rgba(255,255,255,0.85)');
  });
});
