/**
 * Regression guard for the v4 color wheel's harmony node angles.
 *
 * The wheel's angle table is one of three independent definitions of harmony
 * geometry (core HarmonyGenerator offsets, the legacy ColorWheelDisplay, and
 * this component) — a past bug had tetradic silently duplicating the square's
 * 90° steps here while the matched dyes (core) correctly used the rectangle
 * offsets, so the wheel visualization contradicted the results.
 */
import { describe, it, expect } from 'vitest';
import '@components/v4/v4-color-wheel';
import type { V4ColorWheel } from '@components/v4/v4-color-wheel';

function anglesFor(type: string): number[] {
  const el = document.createElement('v4-color-wheel') as V4ColorWheel;
  (el as unknown as { harmonyType: string }).harmonyType = type;
  return (el as unknown as { getHarmonyAngles(): number[] }).getHarmonyAngles();
}

describe('V4ColorWheel harmony angles', () => {
  it('tetradic is a rectangle (two complementary pairs 60° apart), matching core offsets [60, 180, 240]', () => {
    expect(anglesFor('tetradic')).toEqual([0, 60, 180, 240]);
  });

  it('square is four even 90° steps', () => {
    expect(anglesFor('square')).toEqual([0, 90, 180, 270]);
  });

  it('tetradic and square are visually distinct formations', () => {
    expect(anglesFor('tetradic')).not.toEqual(anglesFor('square'));
  });

  it('remaining harmony types match core HarmonyGenerator offsets', () => {
    expect(anglesFor('complementary')).toEqual([0, 180]);
    expect(anglesFor('triadic')).toEqual([0, 120, 240]);
    expect(anglesFor('split-complementary')).toEqual([0, 150, 210]);
  });
});
