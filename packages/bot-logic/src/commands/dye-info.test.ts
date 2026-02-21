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

  it('returns embed with footer', async () => {
    const result = await executeDyeInfo({ dye: snowWhite, locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.footer).toBeDefined();
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

  it('returns dyeInfos matching dyes count', async () => {
    const result = await executeRandom({ locale: 'en', count: 3 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.dyeInfos.length).toBe(result.dyes.length);
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

  it('returns embed with description containing dye list', async () => {
    const result = await executeRandom({ locale: 'en', count: 2 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.description).toBeDefined();
    expect(result.embed.description).toContain('**1.**');
    expect(result.embed.description).toContain('**2.**');
  });
});
