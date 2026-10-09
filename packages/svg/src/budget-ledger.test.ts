/**
 * The ledger's exported geometry IS the drawn card (REFACTOR-003).
 *
 * discord-worker's budget calculator spends the 350 px wall with
 * LEDGER_HEADER_H / LEDGER_COLHEAD_H / LEDGER_GROUP_H / LEDGER_ROW_H and the
 * two footer heights, so those constants must be the numbers the generator
 * actually draws with. A literal drifting inside the generator would let the
 * calculator pack a card that cardShell then clamps, cutting the footer off.
 */
import { describe, it, expect } from 'vitest';
import { CARD_MAX_HEIGHT } from './frame.js';
import {
  generateBudgetLedger,
  LEDGER_HEADER_H,
  LEDGER_COLHEAD_H,
  LEDGER_GROUP_H,
  LEDGER_ROW_H,
  LEDGER_FOOTER_H,
  LEDGER_FOOTER_2LINE_H,
  type BudgetLedgerGroup,
} from './budget-ledger.js';

function groupOf(rows: number): BudgetLedgerGroup {
  return {
    tier: 'Standard Spectrum Dye',
    price: '216 GIL',
    rows: Array.from({ length: rows }, (_, i) => ({
      hex: '#2F2C2B',
      name: `Row ${i}`,
      de: '5.2',
      tier: 1,
      perDe: '13.6k',
    })),
  };
}

function ledgerHeight(groupRows: number[], keyLines: string[]): number {
  const svg = generateBudgetLedger({
    target: { hex: '#1F1D1A', name: 'Jet Black', price: '71,400 GIL', subLabel: 'board only' },
    groups: groupRows.map(groupOf),
    labels: {
      lTarget: 'TARGET',
      lCandidate: 'CANDIDATE',
      deLabel: 'ΔE',
      perDeLabel: 'GIL/ΔE',
      keyLines,
    },
    lang: 'en',
  });
  const m = /viewBox="0 0 \d+ (\d+(?:\.\d+)?)"/.exec(svg);
  expect(m).not.toBeNull();
  return Number(m![1]);
}

/** What the calculator charges for a card of this shape. */
function charged(groupRows: number[], footer: number): number {
  const rows = groupRows.reduce((n, r) => n + r, 0);
  return (
    LEDGER_HEADER_H +
    LEDGER_COLHEAD_H +
    groupRows.length * LEDGER_GROUP_H +
    rows * LEDGER_ROW_H +
    footer
  );
}

describe('budget ledger geometry (REFACTOR-003)', () => {
  const ONE_LINE = ['GIL/ΔE = (TARGET − ROW) ÷ ΔE2000'];
  const TWO_LINES = [...ONE_LINE, 'ΔE column: RGB DIST · ratio stays ΔE2000'];

  it.each([[[1]], [[3]], [[2, 1]], [[1, 1, 1]]])(
    'groups %j draw exactly the header, column header, group bands and rows the constants name',
    (groupRows) => {
      const expected = charged(groupRows, LEDGER_FOOTER_H);
      // Stay under the wall, or the shell's clamp would hide a mismatch
      expect(expected).toBeLessThan(CARD_MAX_HEIGHT);
      expect(ledgerHeight(groupRows, ONE_LINE)).toBe(expected);
    },
  );

  it('a second key line takes the two-line footer height', () => {
    const groupRows = [2, 1];
    const expected = charged(groupRows, LEDGER_FOOTER_2LINE_H);
    expect(expected).toBeLessThan(CARD_MAX_HEIGHT);
    expect(ledgerHeight(groupRows, TWO_LINES)).toBe(expected);
  });
});
