/**
 * The harmony deck with the longest words it can be given.
 *
 * On a non-default wheel the deck reads "<dye> · <harmony> · <wheel name>", and
 * the German and French wheel names are long — "OKLCH-Farbton
 * (wahrnehmungsgleiche Abstände)", "Luminosité OKLCH (conserve la luminosité)".
 * `band.ts` ellipsises the deck to the frame (`fit(deck, width - 26, 14.5)`), but
 * nothing exercised the long combination: the suite's only localized render used
 * the default wheel, where the deck is two short parts. Recommendation 8 of the
 * 2026-09-19 i18n audit.
 *
 * Every dye × both long wheels × de / fr, so the longest dye name is in the set
 * whichever it is after the next patch's renames.
 */
import { describe, it, expect } from 'vitest';
import { estimateTextWidth } from '@xivdyetools/svg';
import { generateHarmonyOG } from './harmony';
import { dyeService } from './dye-helpers';

const FRAME_WIDTH = 400;
/** `band.ts`: the deck is drawn at 14.5 px in the body face, 13 px in from each edge. */
const DECK_SIZE = 14.5;
const DECK_BUDGET = FRAME_WIDTH - 26;
/** The body-face width factor `fit()` measures with. */
const BODY_FACTOR = 0.54;

const unescapeXml = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, '&');

/** The deck is the one text element set at 14.5 px. */
function deckOf(svg: string): string {
  const match = /font-size="14\.5"[^>]*>([^<]*)</.exec(svg);
  expect(match, 'the card has a deck line').not.toBeNull();
  return unescapeXml(match![1]);
}

describe('harmony deck: the longest localized wheel names fit the frame', () => {
  const dyes = dyeService.getAllDyes();

  for (const locale of ['de', 'fr'] as const) {
    for (const wheel of ['oklch-hue', 'oklch-lightness'] as const) {
      it(`${locale} · ${wheel}: every dye's deck stays inside ${DECK_BUDGET}px`, () => {
        let widest = 0;
        let truncated = 0;
        for (const dye of dyes) {
          const deck = deckOf(
            generateHarmonyOG({
              dyeId: dye.stainID ?? dye.id,
              harmonyType: 'split-complementary',
              wheel,
              locale,
            })
          );
          const width = estimateTextWidth(deck, DECK_SIZE * BODY_FACTOR);
          widest = Math.max(widest, width);
          if (deck.endsWith('…')) truncated++;
          expect(width, deck).toBeLessThanOrEqual(DECK_BUDGET);
          // Whatever is cut, it is cut from the END: the dye the card is about stays.
          expect(deck.startsWith('…'), deck).toBe(false);
        }
        // The point of the test is that the guard is REACHED. If no deck in this
        // set needs cutting, the fixture has gone soft and proves nothing.
        expect(truncated, `widest deck ${widest.toFixed(0)}px`).toBeGreaterThan(0);
      });
    }
  }
});
