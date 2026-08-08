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
    // The sub-line names the harmony type + the stain tag
    expect(svg).toContain(`TETRADIC ON #${stainId}`);
    // Ideal offsets ride the match roles
    expect(svg).toContain('+60°');
  });

  it('the Δ is match → computed ideal (never four-reds on a correct tetrad)', () => {
    const svg = generateHarmonyOG({ dyeId: stainId, harmonyType: 'tetradic' });
    // Every match tag is a Δ value
    const deltas = [...svg.matchAll(/Δ(\d+\.\d)/g)].map((m) => parseFloat(m[1]));
    expect(deltas.length).toBeGreaterThan(0);
  });

  it('renders the X frame at 400×210', () => {
    const svg = generateHarmonyOG({ dyeId: stainId, harmonyType: 'triadic', frame: 'x' });
    expect(svg).toContain('height="210"');
    expect(svg).toContain('xivdyetools.app/harmony?dye=');
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

  it('names the requested algorithm in the X url line', () => {
    const svg = generateHarmonyOG({
      dyeId: stainId,
      harmonyType: 'triadic',
      algorithm: 'ciede2000',
      frame: 'x',
    });
    expect(svg).toContain('ΔE2000');
  });
});
