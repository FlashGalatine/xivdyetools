/**
 * Dye Info & Random Commands — Unit Tests
 *
 * Tests for executeDyeInfo and executeRandom.
 */

import { describe, it, expect } from 'vitest';
import { executeDyeInfo, executeRandom } from './dye-info.js';
import { dyeService } from '../input-resolution.js';

// Get a real dye to use in tests
const snowWhite = dyeService.searchByName('Snow White')[0];
const sootBlack = dyeService.searchByName('Soot Black')[0];

// ============================================================================
// executeDyeInfo
// ============================================================================

describe('executeDyeInfo', () => {
  it('returns ok result with SVG and embed for a valid dye', async () => {
    const result = await executeDyeInfo({ dye: snowWhite, locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.svgString).toContain('<svg');
    expect(result.dye).toBe(snowWhite);
    expect(result.localizedName).toBeDefined();
    expect(result.localizedCategory).toBeDefined();
    expect(result.embed.title).toBeDefined();
    expect(result.embed.color).toBeGreaterThanOrEqual(0);
  });

  it('includes localized name in result', async () => {
    const result = await executeDyeInfo({ dye: snowWhite, locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.localizedName).toBe('Snow White');
  });

  it('returns a one-line embed (the PNG is self-contained)', async () => {
    const result = await executeDyeInfo({ dye: snowWhite, locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.title).toBe('Snow White');
    expect(result.embed.description).toContain('xivdyetools.app');
  });

  // 2026-08-29: the link used to be `/dye?stain=…`, but the web app has no
  // /dye page and reads `dye` / `dyes`, never `stain` — it opened the app with
  // nothing selected. The Comparison tool is the app's single-dye view.
  it('links to the web app comparison tool by stainID', async () => {
    const result = await executeDyeInfo({ dye: snowWhite, locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(snowWhite.stainID).toBe(1);
    expect(result.embed.description).toBe('https://xivdyetools.app/comparison?dyes=1');
  });

  it('sets embed color from dye hex', async () => {
    const result = await executeDyeInfo({ dye: snowWhite, locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expectedColor = parseInt(snowWhite.hex.replace('#', ''), 16);
    expect(result.embed.color).toBe(expectedColor);
  });

  it('works with different locales', async () => {
    const enResult = await executeDyeInfo({ dye: snowWhite, locale: 'en' });
    const jaResult = await executeDyeInfo({ dye: snowWhite, locale: 'ja' });

    expect(enResult.ok).toBe(true);
    expect(jaResult.ok).toBe(true);
  });

  it('works with a different dye (Soot Black)', async () => {
    const result = await executeDyeInfo({ dye: sootBlack, locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.svgString).toContain('<svg');
    expect(result.dye.name).toBe('Soot Black');
  });
});

// ============================================================================
// executeRandom
// ============================================================================

describe('executeRandom', () => {
  it('returns ok result with random dyes', async () => {
    const result = await executeRandom({ locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.dyes.length).toBeGreaterThan(0);
    expect(result.svgString).toContain('<svg');
    expect(result.embed.title).toBeDefined();
  });

  it('returns requested number of dyes (default 5)', async () => {
    const result = await executeRandom({ locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.dyes.length).toBe(5);
  });

  it('respects count parameter', async () => {
    const result = await executeRandom({ locale: 'en', count: 3 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.dyes.length).toBe(3);
  });

  it('caps count at 5', async () => {
    const result = await executeRandom({ locale: 'en', count: 10 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.dyes.length).toBe(5);
  });

  it('clamps the count to the R1 five-row cap', async () => {
    const result = await executeRandom({ locale: 'en', count: 9 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.dyes.length).toBe(5);
  });

  it('excludes Facewear dyes', async () => {
    const result = await executeRandom({ locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const dye of result.dyes) {
      expect(dye.category).not.toBe('Facewear');
    }
  });

  it('supports uniqueCategories mode', async () => {
    const result = await executeRandom({ locale: 'en', count: 5, uniqueCategories: true });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Each dye should be from a different category
    const categories = result.dyes.map((d) => d.category);
    const uniqueCategories = new Set(categories);
    expect(uniqueCategories.size).toBe(categories.length);
  });

  it('keeps the embed to one line — the table already names every dye', async () => {
    const result = await executeRandom({ locale: 'en', count: 2 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.title).toBeDefined();
    expect(result.embed.description).toBeUndefined();
  });
});
