/**
 * Tests for the /accessibility command (13D/13E/13H router).
 *
 * The vision: option chooses the frame — a named lens renders 13D,
 * vision:all (or absent) renders 13E, a single dye renders 13H.
 */

import { describe, it, expect, vi } from 'vitest';
import { executeAccessibility, VISION_TYPES, type AccessibilityInput } from './accessibility.js';

const dalamud = { hex: '#781A1A', name: 'Dalamud Red', itemID: 5738 };
const hunter = { hex: '#284B2C', name: 'Hunter Green', itemID: 5748 };

describe('executeAccessibility — 13H solo (one dye)', () => {
  it('renders every lens for a single dye', async () => {
    const result = await executeAccessibility({ dyes: [dalamud], locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.mode).toBe('solo');
    expect(result.svgString).toContain('/ACCESSIBILITY');
    expect(result.svgString).toContain('Dalamud Red');
    // Every lens row + the SHIFT column
    expect(result.svgString).toContain('SHIFT');
    expect(result.svgString).toContain('Achromatopsia');
  });

  it('carries no tier colours — a shift is not a risk', async () => {
    const result = await executeAccessibility({ dyes: [dalamud], locale: 'en' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The far tier colour never appears in the solo frame
    expect(result.svgString).not.toContain('#f4645a');
  });

  it('works with hex-only input (no itemID)', async () => {
    const result = await executeAccessibility({
      dyes: [{ hex: '#336699', name: '#336699' }],
      locale: 'en',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('#336699');
  });
});

describe('executeAccessibility — 13E all lenses (pair)', () => {
  it('renders one row per lens including the normal control', async () => {
    const result = await executeAccessibility({
      dyes: [dalamud, hunter],
      vision: 'all',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.mode).toBe('all');
    expect(result.svgString).toContain('Normal Vision');
    expect(result.svgString).toContain('Achromatopsia');
    expect(result.svgString).toContain('SEPARATION');
    // The verdict sentence lives in the embed, not the frame
    expect(result.embed.description).toBeDefined();
    expect(result.embed.title).toContain('↔');
  });

  it('defaults a pair with no vision option to 13E', async () => {
    const result = await executeAccessibility({ dyes: [dalamud, hunter], locale: 'en' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe('all');
  });

  it('names the weakest lens under the table', async () => {
    const result = await executeAccessibility({
      dyes: [dalamud, hunter],
      vision: 'all',
      locale: 'en',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The red/green pair's only real failure is achromatopsia
    expect(result.svgString).toContain('weakest: Achromatopsia');
  });
});

describe('executeAccessibility — 13D named lens (pair)', () => {
  it('routes a named lens to the lens frame', async () => {
    const result = await executeAccessibility({
      dyes: [dalamud, hunter],
      vision: 'protanopia',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.mode).toBe('lens');
    expect(result.svgString).toContain('AS DESIGNED');
    expect(result.svgString).toContain('AS PERCEIVED');
    // The other lenses stay as the summary strip (untranslated codes)
    expect(result.svgString).toContain('DEUT');
    expect(result.svgString).toContain('ACHR');
  });

  it('prints the typed command in the chip (/a11y alias)', async () => {
    const result = await executeAccessibility({
      dyes: [dalamud, hunter],
      vision: 'deuteranopia',
      locale: 'en',
      commandLabel: '/A11Y',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('/A11Y');
    expect(result.svgString).not.toContain('/ACCESSIBILITY');
  });
});

describe('VISION_TYPES', () => {
  it('achromatopsia is a full member, not a hidden flag', () => {
    expect(VISION_TYPES).toContain('achromatopsia');
    expect(VISION_TYPES).toHaveLength(4);
  });
});

describe('localization', () => {
  it('works with Japanese locale', async () => {
    const result = await executeAccessibility({
      dyes: [dalamud, hunter],
      vision: 'all',
      locale: 'ja',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // TERM-001: vision names come from core, so the bot now says the same thing
    // the web app and OG cards say. `通常の視覚` was bot-logic's own wording.
    expect(result.svgString).toContain('正常視覚');
    expect(result.svgString).not.toContain('通常の視覚');
  });

  it('uses core vision names, not a bot-local copy (TERM-001)', async () => {
    const result = await executeAccessibility({
      dyes: [dalamud, hunter],
      vision: 'all',
      locale: 'ko',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // core: 제1색맹 / 제2색맹 — bot-logic used to say 적색맹 / 녹색맹.
    expect(result.svgString).toContain('제1색맹');
    expect(result.svgString).not.toContain('적색맹');
  });
});

describe('executeAccessibility — no dye at all', () => {
  /**
   * One dye is enough (13H), none is not. No dye used to fall through to the
   * pair frames and throw on `a.hex` inside the catch, coming back as
   * GENERATION_FAILED — a caller's mistake reported as a render bug. A
   * non-array (a JavaScript caller of the published package) is refused the
   * same way rather than thrown across the boundary.
   */
  it.each([
    ['no dyes', []],
    ['undefined', undefined],
    ['null', null],
  ])('refuses %s with its own code and a localized message', async (_label, dyes) => {
    const warn = vi.fn();
    const result = await executeAccessibility({
      dyes: dyes as AccessibilityInput['dyes'],
      locale: 'de',
      logger: { warn },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('NOT_ENOUGH_DYES');
    expect(result.errorMessage).toBe('Bitte gib eine Farbe (Hex-Code oder Farbstoffname) ein.');
    // A refusal is an answer, not a failure — nothing is logged as one
    const lines = warn.mock.calls.flat().map(String);
    expect(lines.some((l) => l.includes('generation failed'))).toBe(false);
  });
});

describe('executeAccessibility — a generation failure is logged (BUG-125)', () => {
  /**
   * The catch used to be bare. A hex input is user-typed and core's parser
   * quotes it in its message, so the line names the error's class — never
   * the message, never a dye name or hex.
   */
  it.each([
    ['solo', 1],
    ['pair', 2],
  ])('logs the error class for the %s frame and leaves the input out', async (_label, count) => {
    const warn = vi.fn();
    const typed = { hex: '#ZZZZZZ', name: 'Sentinel Typed Name' };
    const dyes = count === 1 ? [typed] : [dalamud, typed];
    const result = await executeAccessibility({ dyes, locale: 'en', logger: { warn } });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('GENERATION_FAILED');

    const lines = warn.mock.calls.flat().map(String);
    expect(lines.some((l) => /^\[accessibility\] generation failed: \w+/.test(l))).toBe(true);
    for (const line of lines) {
      expect(line).not.toContain('ZZZZZZ');
      expect(line).not.toContain('Sentinel Typed Name');
    }
  });
});
