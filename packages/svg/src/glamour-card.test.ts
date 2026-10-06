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
  lookLabel: '+2 LOOKS',
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
      slotLabel: 'MAIN HAND',
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
    for (const text of ['MAIN HAND', 'HEAD', 'BODY', 'HANDS', 'LEGS', '+2 LOOKS', 'ONE LOOK', 'Hempen Coif', 'TWIN', 'OK', 'VIERA']) {
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
    expect(ink('+2 LOOKS')).toBe(CARD_DARK.tiers[0]);
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

  /**
   * I18N-015: the key used to wrap at any space into a mark-width column of two
   * lines, so a count left its noun ("… · 3" / "durch Zwilling benannt …") and
   * long German lost its tail to an ellipsis. Five rows leave room for exactly
   * two footer lines, so the key has to fit two — whole, a clause never split.
   * Each is bot-logic's own key for five of twelve pieces, ten named from a
   * twin and two with no fix: the widest the counts get.
   */
  describe.each([
    { lang: 'en', footKey: '5 of 12 dyed pieces · 10 named from a twin · 2 with no fix' },
    { lang: 'de', footKey: '5 von 12 gefärbten Teilen · 10 durch Zwilling benannt · 2 ohne Lösung' },
    { lang: 'fr', footKey: '5 sur 12 pièces teintes · 10 via un jumeau · 2 sans solution' },
    { lang: 'ja', footKey: '染色済み12部位中5部位 · 別アイテムで表示 10 · 解決不可 2' },
    { lang: 'ko', footKey: '염색한 장비 12개 중 5개 · 같은 외형으로 10개 대체 · 해결 불가 2개' },
    { lang: 'zh', footKey: '已染色 12 件中的 5 件 · 10 件以同外观装备代替 · 2 件无法解决' },
  ])('the $lang count key on a five-row card', ({ lang, footKey }) => {
    const svg = generateGlamourCard({ ...STRESS, footKey, lang });
    const rowsEnd = 56 + 48 * STRESS.rows.length;
    const foot = texts(svg).filter((r) => r.x === 15 && r.y > rowsEnd);
    const lines = foot.map((r) => r.text);

    it('prints the whole key — nothing ellipsised', () => {
      expect(lines.join(' ')).toBe(footKey);
      expect(lines.join('')).not.toContain('…');
    });

    it('keeps every count with its noun: a clause is never split across lines', () => {
      for (const clause of footKey.split(' · ')) {
        expect(
          lines.some((l) => l.includes(clause)),
          `"${clause}" whole on one line of ${JSON.stringify(lines)}`
        ).toBe(true);
      }
    });

    it('fits the frame rather than the clamp: the last line sits inside 350', () => {
      // cardShell clamps the declared height, so an overlong footer is cropped
      // silently; measure where the drawn line actually lands. The mark and every
      // single-line footer in the suite keep 13 px under the baseline.
      const last = foot[foot.length - 1];
      expect(last.y + 13).toBeLessThanOrEqual(CARD_MAX_HEIGHT);
      expect(last.y + 13).toBeLessThanOrEqual(heightOf(svg));
    });

    it('keeps the line beside the mark clear of it, and every line inside the margin', () => {
      const markLeft = 400 - 15 - (18 + 7 + textWidth('xivdyetools.app', 11, 'mono'));
      const mark = texts(svg).find((r) => r.text === 'xivdyetools.app')!;
      for (const r of foot) {
        const right = r.x + textWidth(r.text, 11, 'mono');
        // The mark shares its line with the key; a line under it runs the full width
        expect(right, r.text).toBeLessThanOrEqual(r.y === mark.y ? markLeft - 10 : 400 - 15);
      }
      // The mark sits on the key's first line, bottom-right of the card's last row
      expect(mark.y).toBe(foot[0].y);
    });
  });

  it('a key the frame cannot hold is cut at the last line it can, never pushed past 350', () => {
    const footKey = Array.from({ length: 8 }, (_, i) => `${i + 2} von 12 gefärbten Teilen`).join(' · ');
    const svg = generateGlamourCard({ ...STRESS, footKey });
    const foot = texts(svg).filter((r) => r.x === 15 && r.y > 56 + 48 * STRESS.rows.length);
    expect(foot[foot.length - 1].y + 13).toBeLessThanOrEqual(CARD_MAX_HEIGHT);
    expect(foot[foot.length - 1].text.endsWith('…')).toBe(true);
  });

  /** The footer runs of a one-row card, and how far right each may reach. */
  const oneRowFoot = (footKey: string): Array<{ text: string; right: number; limit: number }> => {
    const svg = generateGlamourCard({ ...STRESS, rows: [row()], footKey });
    const mark = texts(svg).find((r) => r.text === 'xivdyetools.app')!;
    const markLeft = 400 - 15 - (18 + 7 + textWidth('xivdyetools.app', 11, 'mono'));
    return texts(svg)
      .filter((r) => r.x === 15 && r.y > 56 + 48)
      .map((r) => ({
        text: r.text,
        right: r.x + textWidth(r.text, 11, 'mono'),
        limit: r.y === mark.y ? markLeft - 10 : 400 - 15,
      }));
  };

  it('breaks a clause too long for any line between words, each count kept with its word', () => {
    // Unglued, the first line would end on "12": "…, nämlich 12" fits beside
    // the mark and "…, nämlich 12 gefärbte" does not.
    const footKey = 'Teile mit Zwillingen, nämlich 12 gefärbte Teile aus dem Gepäck, dazu 10 andere Gegenstände';
    const foot = oneRowFoot(footKey);
    expect(foot.length).toBeGreaterThan(1);
    expect(foot.map((r) => r.text).join(' ')).toBe(footKey);
    for (const r of foot) {
      expect(r.right, r.text).toBeLessThanOrEqual(r.limit);
      expect(r.text, 'a line never ends on a bare count').not.toMatch(/(^|\s)\d+$/);
    }
    for (const pair of ['12 gefärbte', '10 andere']) {
      expect(foot.some((r) => r.text.includes(pair)), pair).toBe(true);
    }
  });

  it('keeps a count that ends its clause with the word before it, and the "·" after it', () => {
    // ja/ko put the count after the noun ("解決不可 2"). The clause is wider
    // than any line, so it has to break between words: unglued, the second
    // line would end on "haben," and the third open on "2 ·".
    const footKey =
      'Gefärbte Teile aus dem Gepäck, die keine Zwillinge und keine weiteren Gegenstände haben, 2 · 3 ohne Lösung';
    const foot = oneRowFoot(footKey);
    expect(foot.length).toBeGreaterThan(2);
    expect(foot.map((r) => r.text).join(' ')).toBe(footKey);
    for (const r of foot) {
      expect(r.right, r.text).toBeLessThanOrEqual(r.limit);
      expect(r.text, 'a line never opens on a bare count or separator').not.toMatch(/^(\d+|·)( |$)/);
    }
  });

  /**
   * The line beside the mark is the narrow one (~232.7 px); every line under
   * it runs the full 370. A first clause between the two used to be broken
   * across them, though it fits a line of its own.
   */
  describe('a first clause too wide to sit beside the mark', () => {
    // The 2026-10-04 review's probe: the first clause is ~355 px
    const footKey = 'Gefärbte Teile im Gepäck, angezeigt fünf von zwölf · 3 ohne Lösung';
    const clause = 'Gefärbte Teile im Gepäck, angezeigt fünf von zwölf';

    it('starts whole on the full-width line under the mark when the card has the height', () => {
      const foot = oneRowFoot(footKey);
      expect(foot.map((r) => r.text).join(' ')).toBe(footKey);
      expect(foot.some((r) => r.text.includes(clause)), JSON.stringify(foot)).toBe(true);
      for (const r of foot) expect(r.right, r.text).toBeLessThanOrEqual(r.limit);
      // Nothing is drawn beside the mark: the clause did not start there
      expect(foot.every((r) => r.limit === 400 - 15)).toBe(true);
    });

    it('keeps the mark and every line inside the declared height', () => {
      const svg = generateGlamourCard({ ...STRESS, rows: [row()], footKey });
      const t = texts(svg);
      const mark = t.find((r) => r.text === 'xivdyetools.app')!;
      const last = t.filter((r) => r.x === 15 && r.y > 56 + 48).at(-1)!;
      expect(mark.y + 13).toBeLessThanOrEqual(heightOf(svg));
      expect(last.y + 13).toBeLessThanOrEqual(heightOf(svg));
    });

    it('breaks between words beside the mark instead when the extra line is past 350', () => {
      // Five rows leave two footer lines; the whole clause would need a third
      // and the key would lose its tail to an ellipsis, so the clause breaks.
      const svg = generateGlamourCard({ ...STRESS, footKey });
      const foot = texts(svg).filter((r) => r.x === 15 && r.y > 56 + 48 * STRESS.rows.length);
      expect(foot.map((r) => r.text).join(' ')).toBe(footKey);
      expect(foot.map((r) => r.text).join('')).not.toContain('…');
      expect(foot[foot.length - 1].y + 13).toBeLessThanOrEqual(CARD_MAX_HEIGHT);
    });

    it('moves a word too wide for the line beside the mark whole as well, not by code point', () => {
      // One 38-character word (~259 px) opens a clause too long for any line
      const word = 'Zwillingsgegenstandsoptikenverzeichnis';
      const foot = oneRowFoot(`${word} mit 12 gefärbten Teilen aus dem Gepäck und dazu 10 weiteren`);
      expect(foot.some((r) => r.text.split(' ').includes(word)), JSON.stringify(foot)).toBe(true);
      for (const r of foot) expect(r.right, r.text).toBeLessThanOrEqual(r.limit);
    });
  });

  it('keeps the mark inside the card when the count key is empty', () => {
    // An empty key still has the mark's line: the height is measured from it
    for (const rows of [[row()], STRESS.rows]) {
      const svg = generateGlamourCard({ ...STRESS, rows, footKey: '' });
      const mark = texts(svg).find((r) => r.text === 'xivdyetools.app')!;
      expect(mark.y + 13, `${rows.length} row(s)`).toBeLessThanOrEqual(heightOf(svg));
    }
  });

  it('breaks a spaceless clause too long for any line by code point, never cutting it', () => {
    const footKey = '別アイテムで表示'.repeat(4);
    const foot = oneRowFoot(footKey);
    expect(foot.length).toBeGreaterThan(1);
    expect(foot.map((r) => r.text).join('')).toBe(footKey);
    for (const r of foot) expect(r.right, r.text).toBeLessThanOrEqual(r.limit);
  });

  it('gives a shorter card the third line a long key needs', () => {
    const footKey = '5 von 12 gefärbten Teilen · 10 durch Zwilling benannt · 2 ohne Lösung · 12 von 12 gefärbten Teilen';
    const svg = generateGlamourCard({ ...STRESS, rows: STRESS.rows.slice(0, 2), footKey });
    const foot = texts(svg).filter((r) => r.x === 15 && r.y > 56 + 48 * 2);
    expect(foot.map((r) => r.text).join(' ')).toBe(footKey);
    expect(foot[foot.length - 1].y + 13).toBeLessThanOrEqual(heightOf(svg));
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

  it('widens the slot column for a long official slot name, and the name gives way', () => {
    // The game has no short forms: French names the main hand "Main directrice"
    const svg = generateGlamourCard({
      ...STRESS,
      rows: [row({ slotLabel: 'MAIN DIRECTRICE', name: 'Augmented Deepshadow Gloves of Striking' })],
    });
    const t = texts(svg);
    expect(t.map((r) => r.text)).toContain('MAIN DIRECTRICE');
    const name = t.find((r) => r.text.startsWith('Augmented'))!;
    expect(name.x).toBeGreaterThanOrEqual(15 + textWidth('MAIN DIRECTRICE', 11, 'mono') + 10 + 32 + 10);
  });

  it('never lets the longest official slot name run into the icon tile', () => {
    // The French off hand, tracked at 0.8 px, is wider than the column's ceiling
    const svg = generateGlamourCard({ ...STRESS, rows: [row({ slotLabel: 'MAIN NON DIRECTRICE' })] });
    const label = /<text x="15" [^>]*>MAIN NON DIRECTRICE<\/text>/.exec(svg);
    expect(label, 'the whole word is drawn').not.toBeNull();
    const tracking = Number(/letter-spacing="([^"]+)"/.exec(label![0])?.[1] ?? 0);
    const width = textWidth('MAIN NON DIRECTRICE', 11, 'mono') + tracking * 'MAIN NON DIRECTRICE'.length;
    const iconX = Number(/<rect x="([\d.]+)" y="[\d.]+" width="32" height="32"/.exec(svg)![1]);
    expect(15 + width).toBeLessThanOrEqual(iconX - 8);
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
