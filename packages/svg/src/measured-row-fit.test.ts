/**
 * `measuredRow`'s lead column must truncate to its pixel budget (I18N-011).
 *
 * The lead was the only text in the row drawn without `fitText`. In English
 * nothing overflowed — the shipped leads clear the 56 px budget by 1–15 px — so
 * the gap was invisible. CJK is counted at 2× width by `estimateTextWidth`,
 * which is what makes a ja/ko/zh lead the first thing to spill into the colour
 * pair beside it.
 *
 * These assert the *behaviour* (a too-long lead is ellipsised, a short one is
 * left alone), so they fail if the `fitText` calls are removed again.
 */

import { describe, it, expect } from 'vitest';
import { measuredRow, CARD_DARK } from './frame.js';

const ELLIPSIS = '…';

/** The lead column's real budget, from the shipped row widths. */
const WIDTHS = { lead: 56, pair: 60, name: 150, bar: 60, measure: 40 };

/** A row with everything `measuredRow` requires; only the lead varies per test. */
function rowWith(lead: string | { text: string; sub?: string }): string {
  return measuredRow(12, 0, 34, {
    theme: CARD_DARK,
    lead,
    sourceHex: '#ff0000',
    dyeHex: '#00ff00',
    name: 'Snow White',
    deltaE: 1.2,
    lang: 'en',
    widths: WIDTHS,
  });
}

describe('measuredRow lead fits its column', () => {
  it('leaves a short Latin lead untouched', () => {
    expect(rowWith('01')).toContain('01');
    expect(rowWith('01')).not.toContain(ELLIPSIS);
  });

  it('ellipsises an over-long CJK lead instead of overrunning the pair', () => {
    // 12 full-width glyphs ≈ 24 Latin widths — far past the 56 px lead budget.
    const svg = rowWith('最も近い色の候補を表示');
    expect(svg).toContain(ELLIPSIS);
    expect(svg).not.toContain('最も近い色の候補を表示');
  });

  it('ellipsises an over-long lead sub-line too', () => {
    const svg = rowWith({ text: '01', sub: '正常視覚のときの見え方' });
    expect(svg).toContain(ELLIPSIS);
    expect(svg).not.toContain('正常視覚のときの見え方');
  });
});
