/**
 * Extractor / Presets / Budget OG tests — the three net-new 15E adapters.
 */
import { describe, it, expect } from 'vitest';
import { presetData } from '@xivdyetools/core';
import { generateExtractorOG } from './extractor';
import { generatePresetsOG } from './presets';
import { generateBudgetOG } from './budget';
import { dyeService } from './dye-helpers';

const dyes = dyeService.getAllDyes();
const sid = (i: number): number => dyes[i].stainID ?? dyes[i].id;
const firstPreset = (presetData as { palettes: Array<{ id: string; name: string }> }).palettes[0];

describe('generateExtractorOG (15E band)', () => {
  it('band width IS the share; the extracted pixel rides the 54px strip', () => {
    const svg = generateExtractorOG({
      entries: [
        { hex: '8E5A3C', share: 31 },
        { hex: 'C9A96A', share: 24 },
        { hex: '3E4A52', share: 19 },
      ],
    });
    expect(svg).toContain('width="400"');
    expect(svg).toContain('31%');
    expect(svg).toContain('height="54"');
    expect(svg).toContain('#8E5A3C');
    expect(svg).toMatch(/Δ\d+\.\d/);
    expect(svg).toContain('EXTRACT');
    // EN writes EN-US, per the String Pass
    expect(svg).toContain('colors from an image');
    expect(svg).not.toContain('colours');
  });

  it('the X frame is the one card whose names yield, and scales the strip ×0.66', () => {
    const entries = [
      { hex: '8E5A3C', share: 31 },
      { hex: '221C1A', share: 11 },
    ];
    const discord = generateExtractorOG({ entries });
    const x = generateExtractorOG({ entries, frame: 'x' });

    // 54 → 36
    expect(x).toContain('height="36"');
    expect(x).not.toContain('height="54"');
    // The share-% and Δ stay; the name goes — a 44px band is under the floor
    expect(x).toContain('31%');
    expect(x).toMatch(/Δ\d+\.\d/);
    expect(discord).toContain('font-size="11.5"');
    expect(x).not.toContain('font-size="11.5"');
  });

  it('localizes the tool tag', () => {
    const entries = [{ hex: '8E5A3C', share: 31 }];
    expect(generateExtractorOG({ entries, locale: 'de' })).toContain('EXTRAKT');
    expect(generateExtractorOG({ entries, locale: 'ko' })).toContain('추출');
  });

  it('caps at five entries and sorts by dominance', () => {
    const entries = Array.from({ length: 8 }, (_, i) => ({ hex: '8E5A3C', share: i + 1 }));
    const svg = generateExtractorOG({ entries });
    // Dominance order survives the cap: 8..4 kept, 3..1 dropped
    expect(svg).toContain('8%');
    expect(svg).toContain('4%');
    expect(svg).not.toContain('>3%<');
  });

  it('no valid entries renders the neutral state', () => {
    const svg = generateExtractorOG({ entries: [{ hex: 'zzz', share: 50 }] });
    expect(svg).toContain('NOT FOUND');
  });
});

describe('generatePresetsOG (15E band)', () => {
  it('renders equal bands with names + stain tags, no Δ', () => {
    const svg = generatePresetsOG({ presetId: firstPreset.id });
    expect(svg).toContain('width="400"');
    expect(svg).toContain(firstPreset.name);
    expect(svg).toMatch(/#\d+/);
    expect(svg).not.toMatch(/Δ\d/);
  });

  it('the X frame moves the preset name to the footer beside CURATED', () => {
    const svg = generatePresetsOG({ presetId: firstPreset.id, frame: 'x' });
    expect(svg).toContain(`${firstPreset.name} · CURATED`);
    // Preset names are never localised, so the slot needs no key
    expect(generatePresetsOG({ presetId: firstPreset.id, frame: 'x', locale: 'ja' })).toContain(
      firstPreset.name
    );
  });

  it('an unknown preset renders the neutral state', () => {
    const svg = generatePresetsOG({ presetId: 'no-such-preset' });
    expect(svg).toContain('NOT FOUND');
  });
});

describe('generateBudgetOG (15E band)', () => {
  it('target at double width; candidates carry tier labels; vendor 216 is the only price', () => {
    const coffer = dyes.find((d) => d.acquisition === 'Venture Coffers');
    const svg = generateBudgetOG({ dyeId: coffer!.stainID ?? coffer!.id });
    expect(svg).toContain('TARGET · COFFER');
    // One figure per row: the price takes the role row (a 67px band cannot
    // hold 'STD SPECTRUM' on either frame), Δ stands alone in the tag, and
    // the footer names the tier once where it fits whole
    expect(svg).toContain('216 G');
    expect(svg).not.toContain('STD S…');
    expect(svg).toContain('VENDOR 216 G');
    expect(svg).not.toMatch(/Δ\d+\.\d · /);
    // The verdict is the deck: the ledger ranked four, the band recommends one
    expect(svg).toContain('Best per point:');
  });

  it('a vendor-tier target still renders (nearest-any stands in)', () => {
    const vendor = dyes.find((d) => d.consolidationType === 'A');
    const svg = generateBudgetOG({ dyeId: vendor!.stainID ?? vendor!.id });
    expect(svg).toContain('TARGET · STD SP');
  });

  it('an unknown dye renders the neutral state', () => {
    const svg = generateBudgetOG({ dyeId: 999999 });
    expect(svg).toContain('NOT FOUND');
  });

  it('the X frame moves the verdict to the footer and gives each band one figure', () => {
    const coffer = dyes.find((d) => d.acquisition === 'Venture Coffers');
    const svg = generateBudgetOG({ dyeId: coffer!.stainID ?? coffer!.id, frame: 'x' });

    expect(svg).toContain('xivdyetools.app/budget');
    expect(svg).not.toContain('?dye=');
    expect(svg).toMatch(/BEST · /);
    // Price replaces the tier name on the role row; Δ stands alone in the tag
    expect(svg).toContain('216 G');
    expect(svg).not.toMatch(/Δ\d+\.\d · /);
  });

  it('localizes the tool tag', () => {
    expect(generateBudgetOG({ dyeId: sid(0), locale: 'ja' })).toContain('予算');
  });
});
