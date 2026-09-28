import { describe, it, expect } from 'vitest';
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
