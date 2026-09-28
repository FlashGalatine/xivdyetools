import { afterEach, describe, it, expect, vi } from 'vitest';
import { charaShaderHex } from '../chara-shader-colors.js';
import { CharacterColorService } from '../../CharacterColorService.js';

const characterColors = new CharacterColorService();

// Ground truth from the game: the character creator's own RGB readouts (2026-09-28,
// Hair Color screen, Raen ♀, hair and highlights both on 42) and the corpus's .chara
// floats, which store the shader color. Both halves come from human.cmp.
describe('human.cmp — the creator shows one half, a .chara stores the other', () => {
  it('Raen ♀ hair 42: the creator shows #FFDC98, a file stores #E5D2AC', async () => {
    expect((await characterColors.getHairColors('Raen', 'Female'))[42].hex).toBe('#FFDC98');
    expect(await charaShaderHex('hair', 42, 'Raen', 'Female')).toBe('#E5D2AC');
  });

  it('highlight 42: the creator shows RGB 225,186,112, a file stores 255,186,86', async () => {
    expect(characterColors.getHighlightColors()[42].rgb).toEqual({ r: 225, g: 186, b: 112 });
    expect(await charaShaderHex('highlights', 42, null, null)).toBe('#FFBA56');
  });

  it('the tattoo / limbal swatches are the feature palette, not a copy of the eyes', () => {
    const eyes = characterColors.getEyeColors().map((c) => c.hex);
    const features = characterColors.getTattooColors().map((c) => c.hex);
    expect(features).toHaveLength(192);
    expect(features.filter((hex, i) => hex !== eyes[i]).length).toBeGreaterThan(150);
  });
});

describe('charaShaderHex', () => {
  it('needs a tribe and gender for the clan tables', async () => {
    expect(await charaShaderHex('skin', 3, null, 'Female')).toBeNull();
    expect(await charaShaderHex('hair', 3, 'Raen', null)).toBeNull();
  });

  it('is null past the palette', async () => {
    expect(await charaShaderHex('eyes', 192, null, null)).toBeNull();
    expect(await charaShaderHex('lipsDark', 96, null, null)).toBeNull();
    expect(await charaShaderHex('skin', 192, 'Raen', 'Female')).toBeNull();
  });
});

// The web app gets both tables as a lazy chunk, so one dropped request must not
// fail every later .chara import in the tab.
describe('a table that failed to load', () => {
  const tables = {
    shared: '../../../data/character_colors/shader/shared.json',
    clan: '../../../data/character_colors/shader/race_specific.json',
  };

  afterEach(() => {
    vi.doUnmock(tables.shared);
    vi.doUnmock(tables.clan);
    vi.resetModules();
  });

  it('is loaded again by the next call — shared palettes', async () => {
    vi.resetModules();
    vi.doMock(tables.shared, () => {
      throw new Error('chunk failed to load');
    });
    const fresh = await import('../chara-shader-colors.js');
    await expect(fresh.charaShaderHex('highlights', 42, null, null)).rejects.toThrow();

    vi.doUnmock(tables.shared);
    expect(await fresh.charaShaderHex('highlights', 42, null, null)).toBe('#FFBA56');
  });

  it('is loaded again by the next call — clan tables', async () => {
    vi.resetModules();
    vi.doMock(tables.clan, () => {
      throw new Error('chunk failed to load');
    });
    const fresh = await import('../chara-shader-colors.js');
    await expect(fresh.charaShaderHex('hair', 42, 'Raen', 'Female')).rejects.toThrow();

    vi.doUnmock(tables.clan);
    expect(await fresh.charaShaderHex('hair', 42, 'Raen', 'Female')).toBe('#E5D2AC');
  });
});
