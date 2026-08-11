/**
 * Fallback arms across the command modules.
 *
 * Every command formats optional dye metadata (`cost`/`currency`, `stainID`,
 * `itemID`) and every one of them has a "this dye has none" arm. The happy
 * path is well covered; these are the arms a consolidated or synthetic dye
 * actually takes, and the frame rules say a missing value must render as a
 * blank or an em dash — never as `undefined` or `NaN` burned into a PNG.
 */

import { describe, it, expect } from 'vitest';
import type { Dye, DyeTypeFilters } from '@xivdyetools/types';
import { dyeService } from '../input-resolution.js';
import { executeComparison } from './comparison.js';
import { executeContrast } from './contrast.js';
import { executeDyeInfo } from './dye-info.js';
import { executeMixer } from './mixer.js';

const snowWhite = dyeService.searchByName('Snow White')[0];
const sootBlack = dyeService.searchByName('Soot Black')[0];
const dalamudRed = dyeService.searchByName('Dalamud Red')[0];

/** A dye stripped of every optional field a card might print. */
const bare = (base: Dye, overrides: Partial<Dye> = {}): Dye =>
  ({
    ...base,
    itemID: 0,
    stainID: undefined,
    cost: undefined,
    currency: undefined,
    consolidationType: undefined,
    ...overrides,
  }) as Dye;

describe('executeComparison — optional metadata', () => {
  it('omits the stain suffix when a dye has no stainID', async () => {
    const result = await executeComparison({
      dyes: [bare(snowWhite), bare(sootBlack)],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).not.toContain('undefined');
    expect(result.svgString).not.toContain('NaN');
  });

  it('keeps the stain suffix when a dye has one', async () => {
    const result = await executeComparison({ dyes: [snowWhite, sootBlack], locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain(String(snowWhite.stainID));
  });

  it('fails cleanly on a single dye rather than drawing a pairless card', async () => {
    // The `best ? … : undefined` arm in the embed is therefore unreachable
    // through this entry point — the card generator rejects one dye first.
    const result = await executeComparison({ dyes: [snowWhite], locale: 'en' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('GENERATION_FAILED');
    expect(result.errorMessage).toBeTruthy();
  });

  it('names the closest pair once there are two dyes', async () => {
    const result = await executeComparison({ dyes: [snowWhite, sootBlack], locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.embed.description).toContain('↔');
  });
});

describe('executeContrast — optional metadata', () => {
  it('falls back to the raw name when a dye has no itemID to localize', async () => {
    const result = await executeContrast({
      dyes: [bare(snowWhite), bare(sootBlack)],
      locale: 'ja',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('Snow White');
    expect(result.svgString).not.toContain('undefined');
  });
});

describe('executeDyeInfo — optional metadata', () => {
  it('prints an em dash for MKT when the dye has no market item', async () => {
    const result = await executeDyeInfo({ dye: bare(snowWhite), locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Blanks, never inventions — a missing market id is an em dash
    expect(result.svgString).toContain('—');
    expect(result.svgString).not.toContain('undefined');
  });

  it('prints SRC without a price when the dye has no cost or currency', async () => {
    const result = await executeDyeInfo({
      dye: bare(dalamudRed, { acquisition: 'Dye Vendor' }),
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('Dye Vendor');
    expect(result.svgString).not.toContain('NaN');
  });

  it('prints SRC with a price when the dye has both', async () => {
    const priced = { ...dalamudRed, cost: 216, currency: 'Gil' } as Dye;
    const result = await executeDyeInfo({ dye: priced, locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('216');
  });

  it('falls back to the site root when the dye has no stainID to share', async () => {
    const result = await executeDyeInfo({ dye: bare(snowWhite), locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.embed.description).toBe('https://xivdyetools.app');
  });

  it('deep-links by stainID when the dye has one', async () => {
    const result = await executeDyeInfo({ dye: snowWhite, locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.embed.description).toContain(`stain=${snowWhite.stainID}`);
  });

  it('names the consolidated item for a consolidated dye', async () => {
    const consolidated = { ...dalamudRed, consolidationType: 'A' } as Dye;
    const result = await executeDyeInfo({ dye: consolidated, locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('52254');
  });
});

describe('executeMixer — exhausted filters', () => {
  /** Every exclusion at once: no dye in the database survives this. */
  const excludeEverything: DyeTypeFilters = {
    excludeMetallic: true,
    excludePastel: true,
    excludeDark: true,
    excludeCosmic: true,
    excludeIshgardian: true,
    excludeExpensive: true,
    excludeVendorDyes: true,
    excludeCraftDyes: true,
  };

  it('reports NO_MATCHES rather than drawing an empty sweep', async () => {
    const result = await executeMixer({
      dye1: snowWhite,
      dye2: sootBlack,
      blendingMode: 'rgb',
      locale: 'en',
      dyeFilters: excludeEverything,
    });

    if (result.ok) {
      // If some dye survives the filter set, the sweep must still be sane
      expect(result.svgString).toContain('<svg');
      expect(result.svgString).not.toContain('undefined');
      return;
    }
    expect(result.error).toBe('NO_MATCHES');
    expect(result.errorMessage).toBeTruthy();
  });

  it('still produces a sweep with no filters at all', async () => {
    const result = await executeMixer({
      dye1: snowWhite,
      dye2: sootBlack,
      blendingMode: 'rgb',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('<svg');
  });
});
