/**
 * 2a default-card tests — a default card never fakes data, and the root card
 * takes no tile.
 */
import { describe, it, expect } from 'vitest';
import { generateDefaultCard, DEFAULT_DECK, MARK_STRIPES } from './default-card';
import { BAND_FRAMES } from './band';

const tool = {
  tool: DEFAULT_DECK.harmony,
  name: 'Color Harmony',
  sub: 'Build a palette around any dye. Six harmony types, real dyes only.',
  path: 'xivdyetools.app/harmony',
  methodTag: 'ΔE2000',
};

describe('generateDefaultCard (2a)', () => {
  it('renders the Discord frame with the header, six stripes, tile, deck and footer', () => {
    const svg = generateDefaultCard(tool);

    expect(svg).toContain(`width="${BAND_FRAMES.discord.width}"`);
    expect(svg).toContain(`height="${BAND_FRAMES.discord.height}"`);
    expect(svg).toContain('XIV DYE TOOLS');
    expect(svg).toContain('/HARMONY');
    expect(svg).toContain('Color Harmony');
    expect(svg).toContain('xivdyetools.app/harmony');
    expect(svg).toContain('ΔE2000');
    for (const hex of MARK_STRIPES) expect(svg).toContain(hex);
    // The tile is the contrast guarantee — the glyph never touches a stripe
    expect(svg).toContain('rx="24"');
  });

  it('never fakes data: no dye name, no Δ figure, no price', () => {
    const svg = generateDefaultCard(tool);
    expect(svg).not.toMatch(/Δ\d/);
    expect(svg).not.toMatch(/\d+ G</);
    expect(svg).not.toMatch(/#[0-9A-F]{6}</);
  });

  it('the root card takes no tile and drops the method tag', () => {
    const svg = generateDefaultCard({
      tool: null,
      name: 'XIV Dye Tools',
      sub: 'Color tools for FFXIV dyes.',
      path: 'xivdyetools.app',
      methodTag: null,
    });

    expect(svg).not.toContain('rx="24"');
    expect(svg).not.toContain('ΔE2000');
    // The stripes still carry the identity
    for (const hex of MARK_STRIPES) expect(svg).toContain(hex);
  });

  it('the X frame scales the tile ×0.66, drops the deck, and keeps the 60px strip', () => {
    const svg = generateDefaultCard({ ...tool, frame: 'x' });

    expect(svg).toContain('height="210"');
    // 168 → 104, rx 24 → 16
    expect(svg).toContain('rx="16"');
    expect(svg).not.toContain('rx="24"');
    // The one-liner drops; the name and path move into the strip
    expect(svg).not.toContain(tool.sub);
    expect(svg).toContain('Color Harmony');
    expect(svg).toContain('xivdyetools.app/harmony');
  });

  it('DEFAULT_DECK names a glyph for all nine tools', () => {
    expect(Object.keys(DEFAULT_DECK)).toHaveLength(9);
    for (const [name, entry] of Object.entries(DEFAULT_DECK)) {
      expect(entry.glyphName, name).toBeTruthy();
    }
  });
});
