/**
 * Tests for the /glamour card (Glamour Reader Directions, turn 1, 2a).
 *
 * Pieces in slot order: a slot lead over the look count, the item's icon
 * tile, the name, the dyes it wears, and the in-game verdict at the right.
 * The card draws; the caller picks the twin, orders, and caps at five.
 */

import { describe, it, expect } from 'vitest';
import { generateGlamourCard, type GlamourCardOptions, type GlamourCardRow } from './glamour-card.js';
import { CARD_DARK, CARD_LIGHT, CARD_MAX_HEIGHT, textWidth } from './frame.js';

const row = (over: Partial<GlamourCardRow> = {}): GlamourCardRow => ({
  slotLabel: 'HEAD',
  lookLabel: '+2 LOOK',
  twins: 2,
  tone: 'fix',
  name: 'Hempen Coif',
  dyes: [{ hex: '#E4DFD0', name: 'Snow White' }],
  status: 'TWIN',
  ...over,
});

/** The design's stress file: three twins named, one free choice, one no-fix. */
const STRESS: GlamourCardOptions = {
  stripHexes: ['#2B2B31', '#E6B437', '#E4DFD0', '#64252E', '#79242F', '#E6A89B'],
  charSub: 'ANAMNESIS · MIDLANDER ♀',
  title: '5 dyed pieces · 6 dyes',
  rows: [
    row({
      slotLabel: 'WEAPON',
      lookLabel: '+1 LOOK',
      twins: 1,
      name: 'Curtana Zenith Replica',
      dyes: [{ hex: '#E6B437', name: 'Metallic Gold' }],
    }),
    row(),
    row({
      slotLabel: 'BODY',
      lookLabel: '+1 LOOK',
      twins: 1,
      name: 'Lady’s Yukata',
      dyes: [
        { hex: '#64252E', name: 'Wine Red' },
        { hex: '#79242F', name: 'Dalamud Red' },
      ],
    }),
    row({
      slotLabel: 'HANDS',
      lookLabel: '+1 LOOK',
      twins: 1,
      tone: 'choice',
      name: 'Augmented Deepshadow Gloves of Striking',
      dyes: [
        { hex: '#2B2B31', name: 'Jet Black' },
        { hex: '#E6A89B', name: 'Coral Pink' },
      ],
      status: 'OK',
    }),
    row({
      slotLabel: 'LEGS',
      lookLabel: 'ONE LOOK',
      twins: 0,
      tone: 'block',
      name: 'Viera Gaskins',
      dyes: [{ hex: '#2B2B31', name: 'Jet Black' }],
      status: 'VIERA',
    }),
  ],
  footKey: '5 of 5 dyed pieces · 3 named from a twin · 1 with no fix',
  lang: 'en',
};

const heightOf = (svg: string): number => Number(/height="(\d+)"/.exec(svg)?.[1]);

/** Every `<text>` run: its x, fill and content. */
const texts = (svg: string): Array<{ x: number; y: number; fill: string; text: string }> =>
  [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" fill="([^"]+)"[^>]*>([^<]*)<\/text>/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
    fill: m[3],
    text: m[4],
  }));

describe('generateGlamourCard (2a)', () => {
  it('draws a 400-wide card inside the 350 budget, with the /GLAMOUR chip and the mark', () => {
    const svg = generateGlamourCard(STRESS);

    expect(svg).toContain('width="400"');
    expect(heightOf(svg)).toBeLessThanOrEqual(CARD_MAX_HEIGHT);
    expect(svg).toContain('/GLAMOUR');
    expect(svg).toContain('xivdyetools.app');
  });

  it('says whose file it is by producer and tribe only, never by name', () => {
    const svg = generateGlamourCard(STRESS);
    expect(svg).toContain('ANAMNESIS · MIDLANDER ♀');
    expect(svg).toContain('5 dyed pieces');
  });

  it('one row per piece: slot, look count, name, its dyes and the verdict', () => {
    const svg = generateGlamourCard(STRESS);
    for (const text of ['WEAPON', 'HEAD', 'BODY', 'HANDS', 'LEGS', '+2 LOOK', 'ONE LOOK', 'Hempen Coif', 'TWIN', 'OK', 'VIERA']) {
      expect(svg, text).toContain(`>${text}</text>`);
    }
    // Two-dye pieces print both names; each dye also draws a chip in its colour
    expect(svg).toContain('>Wine Red · Dalamud Red</text>');
    expect(svg).toContain('fill="#79242F"');
  });

  it('green marks a twin that fixed something, amber a piece nothing fixes, grey a free choice', () => {
    const t = texts(generateGlamourCard(STRESS));
    const ink = (content: string, from = 0): string => t.slice(from).find((r) => r.text === content)!.fill;

    expect(ink('TWIN')).toBe(CARD_DARK.tiers[0]);
    expect(ink('VIERA')).toBe(CARD_DARK.tiers[2]);
    expect(ink('OK')).toBe(CARD_DARK.label);
    expect(ink('+2 LOOK')).toBe(CARD_DARK.tiers[0]);
    // One look: nothing to pick from, so the quiet ink whatever the verdict
    expect(ink('ONE LOOK')).toBe(CARD_DARK.label);
    // A free choice between twins reads grey, not green
    const choice = t.findIndex((r) => r.text === 'HANDS');
    expect(ink('+1 LOOK', choice)).toBe(CARD_DARK.subValue);
  });

  it('draws an icon tile for each piece', () => {
    const svg = generateGlamourCard(STRESS);
    expect(svg.match(/width="32" height="32"/g)).toHaveLength(5);
  });

  it('keeps a long name inside the row, clear of the verdict column', () => {
    const svg = generateGlamourCard(STRESS);
    const name = texts(svg).find((r) => r.text.startsWith('Augmented Deepshadow'))!;
    const verdictX = 400 - 15 - 44;
    expect(name.x + textWidth(name.text, 13, 'body')).toBeLessThanOrEqual(verdictX);
  });

  it('prints the whole count key in the footer, wrapping onto a second line as drawn', () => {
    const rowsEnd = 56 + 48 * STRESS.rows.length;
    const foot = texts(generateGlamourCard(STRESS)).filter((r) => r.x === 15 && r.y > rowsEnd);
    expect(foot.length).toBeLessThanOrEqual(2);
    expect(foot.map((r) => r.text).join(' ')).toBe(STRESS.footKey);
  });

  it('grows with the rows: one piece is a short card', () => {
    const one = generateGlamourCard({ ...STRESS, rows: [row()] });
    expect(heightOf(one)).toBeLessThan(heightOf(generateGlamourCard(STRESS)));
  });

  it('follows the light theme', () => {
    const svg = generateGlamourCard({ ...STRESS, theme: 'light' });
    expect(svg).toContain(`fill="${CARD_LIGHT.surface}"`);
    expect(texts(svg).find((r) => r.text === 'TWIN')!.fill).toBe(CARD_LIGHT.tiers[0]);
  });

  it('widens the verdict column for a long verdict, and the name gives way', () => {
    const svg = generateGlamourCard({ ...STRESS, rows: [row({ status: 'ZWILLING', name: 'Augmented Deepshadow Gloves of Striking' })] });
    const t = texts(svg);
    expect(t.map((r) => r.text)).toContain('ZWILLING');
    const name = t.find((r) => r.text.startsWith('Augmented'))!;
    const verdictLeft = 400 - 15 - textWidth('ZWILLING', 11, 'mono');
    expect(name.x + textWidth(name.text, 13, 'body')).toBeLessThanOrEqual(verdictLeft);
  });

  it('keeps the title and drops the dye count when both do not fit', () => {
    const both = texts(generateGlamourCard({ ...STRESS, title: '5 dyed pieces', titleExtra: '6 dyes' }));
    expect(both.map((r) => r.text)).toContain('5 dyed pieces · 6 dyes');

    const long = texts(generateGlamourCard({ ...STRESS, title: '6 gefärbte Teile', titleExtra: '7 Farbstoffe' }));
    expect(long.map((r) => r.text)).toContain('6 gefärbte Teile');
  });

  it('escapes item names', () => {
    const svg = generateGlamourCard({ ...STRESS, rows: [row({ name: 'A & <B>' })] });
    expect(svg).toContain('A &amp; &lt;B&gt;');
  });
});
