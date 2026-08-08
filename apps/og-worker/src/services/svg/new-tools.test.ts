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
    expect(svg).toContain('EXTRACTOR');
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

  it('the X frame carries the CURATED tag on the url line', () => {
    const svg = generatePresetsOG({ presetId: firstPreset.id, frame: 'x' });
    expect(svg).toContain('CURATED');
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
    // Tier labels + the static vendor price (ellipsised to the band width)
    expect(svg).toContain('STD S');
    expect(svg).toContain('VENDOR 216 G');
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

  it('the X frame links the stainID share grammar', () => {
    const svg = generateBudgetOG({ dyeId: sid(0), frame: 'x' });
    expect(svg).toContain('xivdyetools.app/budget?dye=');
  });
});
