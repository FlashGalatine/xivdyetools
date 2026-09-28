/**
 * 2a default-card tests — a default card never fakes data, and the root card
 * takes no tile.
 */
import { describe, it, expect } from 'vitest';
import { textWidth } from '@xivdyetools/svg';
import { generateDefaultCard, DEFAULT_DECK } from './default-card';
import { MARK_STRIPES } from './tokens';
import { BAND_FRAMES } from './band';

const tool = {
  tool: { ...DEFAULT_DECK.harmony, label: '/HARMONY' },
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

  it('DEFAULT_DECK names a glyph for all ten tools', () => {
    expect(Object.keys(DEFAULT_DECK)).toHaveLength(10);
    expect(DEFAULT_DECK.glamour.glyphName).toBe('glamour');
    for (const [name, entry] of Object.entries(DEFAULT_DECK)) {
      expect(entry.glyphName, name).toBeTruthy();
    }
  });
});

/** The deck's one-liner lines: 12 px in the muted grey, at the deck's left margin. */
const subLines = (svg: string): Array<{ y: number; text: string }> =>
  [
    ...svg.matchAll(
      /<text x="13" y="([\d.]+)" fill="#9C9CA2" font-size="12" font-family="[^"]*">([^<]*)<\/text>/g
    ),
  ].map((m) => ({ y: Number(m[1]), text: m[2] }));

/** The one-liner's usable width: the 400 frame less the 13 px margins. */
const LINE_W = BAND_FRAMES.discord.width - 26;

describe('the deck one-liner wraps (2a deck; the design sets it with text-wrap)', () => {
  const GLAMOUR =
    'Load a character file and list every piece it wears, with its dyes and where to get it.';
  const LONG = Array(12).fill('Load a character file and list every piece.').join(' ');

  it('a one-liner wider than the card wraps onto a second line inside the card', () => {
    const svg = generateDefaultCard({ ...tool, sub: GLAMOUR });
    const lines = subLines(svg);

    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.text).join(' ')).toBe(GLAMOUR);
    for (const l of lines) expect(textWidth(l.text, 12, 'body'), l.text).toBeLessThanOrEqual(LINE_W);
    // Every line sits above the 26 px footer
    const footerTop = BAND_FRAMES.discord.height - 26;
    for (const l of lines) expect(l.y).toBeLessThan(footerTop - 4);
  });

  it('a one-liner that fits keeps one line and the 54 px deck', () => {
    const svg = generateDefaultCard({ ...tool, sub: 'Color tools for FFXIV dyes.' });
    expect(subLines(svg)).toHaveLength(1);
    // The deck rule: 350 − 26 footer − 54 deck
    expect(svg).toContain('y1="270"');
  });

  it('breaks a CJK one-liner that has no spaces, losing no character', () => {
    const zh = '载入角色文件，列出穿戴的每件装备及其染剂与获取方式。载入角色文件，列出穿戴的每件装备及其染剂与获取方式。';
    const lines = subLines(generateDefaultCard({ ...tool, sub: zh }));

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((l) => l.text).join('')).toBe(zh);
    for (const l of lines) expect(textWidth(l.text, 12, 'body')).toBeLessThanOrEqual(LINE_W);
  });

  it('stops at three lines, the last ending in an ellipsis', () => {
    const lines = subLines(generateDefaultCard({ ...tool, sub: LONG }));

    expect(lines).toHaveLength(3);
    expect(lines[2].text.endsWith('…')).toBe(true);
    expect(textWidth(lines[2].text, 12, 'body')).toBeLessThanOrEqual(LINE_W);
  });

  it('keeps the tile whole between the header and a grown deck', () => {
    const svg = generateDefaultCard({ ...tool, sub: LONG });
    // The deck rule is the one between the header's (30) and the footer's
    const footerTop = BAND_FRAMES.discord.height - 26;
    const rule = [...svg.matchAll(/<line x1="0" y1="([\d.]+)"/g)]
      .map((m) => Number(m[1]))
      .find((y) => y > 30 && y < footerTop)!;
    const tile = /<rect x="[\d.]+" y="([\d.]+)" width="168" height="168"/.exec(svg)!;

    expect(Number(tile[1])).toBeGreaterThanOrEqual(30);
    expect(Number(tile[1]) + 168).toBeLessThanOrEqual(rule);
  });
});
