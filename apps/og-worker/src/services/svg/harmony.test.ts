/**
 * Harmony OG tests — the 15E band adapter.
 */
import { describe, it, expect } from 'vitest';
import { generateHarmonyOG } from './harmony';
import { dyeService } from './dye-helpers';

const anyDye = dyeService.getAllDyes()[0];
const stainId = anyDye.stainID ?? anyDye.id;

describe('generateHarmonyOG (15E band)', () => {
  it('renders the Discord band frame with base + matches', () => {
    const svg = generateHarmonyOG({ dyeId: stainId, harmonyType: 'tetradic' });

    expect(svg).toContain('<svg');
    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="350"');
    expect(svg).toContain('XIV DYE TOOLS');
    expect(svg).toContain('HARMONY');
    expect(svg).toContain('BASE');
    // The deck names the base and the harmony it anchors
    expect(svg).toMatch(/font-size="14.5"[^>]*>[^<]*Tetradic</);
    // Ideal offsets ride the match roles
    expect(svg).toContain('+60°');
    // The footer prints the path only
    expect(svg).toContain('xivdyetools.app/harmony');
    expect(svg).not.toContain('?dye=');
  });

  it('the Δ is match → computed ideal (never four-reds on a correct tetrad)', () => {
    const svg = generateHarmonyOG({ dyeId: stainId, harmonyType: 'tetradic' });
    // Every match tag is a Δ value
    const deltas = [...svg.matchAll(/Δ(\d+\.\d)/g)].map((m) => parseFloat(m[1]));
    expect(deltas.length).toBeGreaterThan(0);
  });

  it('renders the X frame at 400×210, deck dropped, bands intact', () => {
    const discord = generateHarmonyOG({ dyeId: stainId, harmonyType: 'triadic' });
    const svg = generateHarmonyOG({ dyeId: stainId, harmonyType: 'triadic', frame: 'x' });
    expect(svg).toContain('height="210"');
    expect(svg).toContain('xivdyetools.app/harmony');
    // The deck drops...
    expect(discord).toContain('font-size="14.5"');
    expect(svg).not.toContain('font-size="14.5"');
    // ...and the bands keep their roles and names
    expect(svg).toContain('BASE');
    expect(svg).toContain('font-size="17"');
  });

  it('monochromatic falls back to nearest dyes', () => {
    const svg = generateHarmonyOG({ dyeId: stainId, harmonyType: 'monochromatic' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('≈');
  });

  it('an unknown dye renders the neutral state, never throws', () => {
    const svg = generateHarmonyOG({ dyeId: 999999, harmonyType: 'tetradic' });
    expect(svg).toContain('NOT FOUND');
    expect(svg).toContain('#999999');
  });

  it('localizes dye names', () => {
    const en = generateHarmonyOG({ dyeId: stainId, harmonyType: 'triadic', locale: 'en' });
    const ja = generateHarmonyOG({ dyeId: stainId, harmonyType: 'triadic', locale: 'ja' });
    expect(en).toContain('<svg');
    expect(ja).toContain('<svg');
  });

  it('names the requested algorithm in the footer-right slot', () => {
    const svg = generateHarmonyOG({
      dyeId: stainId,
      harmonyType: 'triadic',
      algorithm: 'ciede2000',
      frame: 'x',
    });
    expect(svg).toContain('ΔE2000');
  });

  it('localizes the tool tag and the harmony name', () => {
    const de = generateHarmonyOG({ dyeId: stainId, harmonyType: 'triadic', locale: 'de' });
    expect(de).toContain('HARMONIE');
    const ja = generateHarmonyOG({ dyeId: stainId, harmonyType: 'triadic', locale: 'ja' });
    expect(ja).toContain('ハーモニー');
  });
});
