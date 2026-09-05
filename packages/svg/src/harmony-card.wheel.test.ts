import { describe, it, expect } from 'vitest';
import { generateHarmonyCard, type HarmonyCardOptions } from './harmony-card.js';
import { CARD_TYPE, CARD_WIDTH, textWidth } from './frame.js';

const base: HarmonyCardOptions = {
  typeLabel: 'Complementary',
  baseHex: '#B02020',
  baseName: 'Dalamud Red',
  slots: [
    {
      idealHex: '#20B0B0',
      hex: '#1E9E9E',
      localizedName: 'Turquoise Green',
      subText: '#1E9E9E · Stain 42',
      deltaE: 4.2,
      angleLabel: '180°',
    },
  ],
  labels: { base: 'BASE', ideal: 'IDEAL HUE', found: 'NEAREST DYE', bandKey: 'KEY', derivedNote: null },
  tierWords: ['EXACT', 'CLOSE', 'LOOSE', 'UNREACHABLE'],
  lang: 'en',
};

describe('harmony card wheel token', () => {
  it('prints nothing extra on the default wheel', () => {
    const svg = generateHarmonyCard(base);
    expect(svg).not.toContain('RYB');
  });

  it('prints the wheel name, uppercased, under the harmony type when given', () => {
    const svg = generateHarmonyCard({ ...base, wheelLabel: "RYB (artist's)" });
    // cardText escapes ' to &apos; (see base-escape.test.ts); uppercasing
    // happens before escaping, so the entity name itself stays lowercase.
    expect(svg).toContain("RYB (ARTIST&apos;S)");
  });

  /**
   * The label is right-anchored on the header row that already carries the
   * `/HARMONY` pill on the left. Unfitted, the German OKLCH-hue name is wider
   * than the whole card, so it ran under (and past) the pill — the one card
   * defect a locale can cause that no English test can see. Every sibling card
   * fits its header-right text to `CARD_WIDTH - PAD*2 - chip.width - 10`
   * (a11y-card ~141, contrast-card ~274); this one now does too.
   */
  describe('the wheel label is fitted to the header row', () => {
    const DE_OKLCH_HUE = 'OKLCH-Farbton (wahrnehmungsgleiche Abstände)';

    /** The chip's own rect, read back off the rendered card (x=16, y=14). */
    const chipWidth = (svg: string): number => {
      const m = /<rect x="16" y="14" width="([\d.]+)" height="21"/.exec(svg);
      if (!m) throw new Error('no command chip in the card');
      return Number(m[1]);
    };

    /** The wheel label sits on its own baseline, 14 + 15 + 12. */
    const labelText = (svg: string): string | null => {
      const m = /<text x="\d+" y="41"[^>]*>([^<]*)<\/text>/.exec(svg);
      return m ? m[1] : null;
    };

    it('truncates a label too wide for the row, with an ellipsis', () => {
      const svg = generateHarmonyCard({ ...base, wheelLabel: DE_OKLCH_HUE });
      const rendered = labelText(svg);
      expect(rendered).not.toBeNull();
      expect(rendered!.length).toBeLessThan(DE_OKLCH_HUE.length);
      expect(rendered!.endsWith('…')).toBe(true);
      expect(rendered!.startsWith('OKLCH-FARBTON')).toBe(true);
    });

    it('keeps the fitted label clear of the command pill', () => {
      const svg = generateHarmonyCard({ ...base, wheelLabel: DE_OKLCH_HUE });
      const budget = CARD_WIDTH - 16 * 2 - chipWidth(svg) - 10;
      expect(textWidth(labelText(svg)!, CARD_TYPE.label, 'mono')).toBeLessThanOrEqual(budget);
    });

    it('leaves a label that already fits completely alone', () => {
      const svg = generateHarmonyCard({ ...base, wheelLabel: 'RYB' });
      expect(labelText(svg)).toBe('RYB');
    });
  });
});
