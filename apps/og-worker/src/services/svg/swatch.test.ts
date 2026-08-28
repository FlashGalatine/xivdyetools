/**
 * Swatch OG tests — the 15E band adapter.
 */
import { describe, it, expect } from 'vitest';
import { generateSwatchOG } from './swatch';

describe('generateSwatchOG (15E band)', () => {
  it('the target is a target, never a result — no invented name or stain', async () => {
    const svg = await generateSwatchOG({ color: '7A6B4F' });
    expect(svg).toContain('width="400"');
    expect(svg).toContain('TARGET');
    expect(svg).toContain('#7A6B4F');
    expect(svg).toContain('NO STAIN ID');
    expect(svg).toContain('SWATCH');
  });

  it('holds four matches, not five (the 11px name floor)', async () => {
    const svg = await generateSwatchOG({ color: '7A6B4F', limit: 20 });
    expect(svg).toContain('>4<');
    expect(svg).not.toContain('>5<');
  });

  it('the X frame carries the target line', async () => {
    const svg = await generateSwatchOG({ color: '7A6B4F', frame: 'x' });
    expect(svg).toContain('height="210"');
    expect(svg).toContain('xivdyetools.app/swatch');
  });

  it('an invalid hex renders the neutral state, never throws', async () => {
    const svg = await generateSwatchOG({ color: 'zzz' });
    expect(svg).toContain('NOT FOUND');
  });
});
