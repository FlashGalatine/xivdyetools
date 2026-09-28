/**
 * Invariants of the committed acquisition table (src/chara/data/acquisition.en.json).
 *
 * The stage tests prove the rules on small inputs; this file guards the
 * GENERATED output against the defect classes the 2026-09-27 review found in
 * real data, so a regeneration after a patch cannot quietly bring them back.
 * Each check names a line a player would otherwise paste into a submission.
 */
import { describe, expect, it } from 'vitest';
import table from '../../src/chara/data/acquisition.en.json';

const lines = Object.entries(table as Record<string, string>);

function offending(test: (line: string) => boolean): string[] {
  return lines.filter(([, line]) => test(line)).map(([id, line]) => `${id}: ${line}`).slice(0, 5);
}

describe('acquisition table invariants', () => {
  it('has a line for most equippable items', () => {
    expect(lines.length).toBeGreaterThan(15000);
  });

  it('carries no game text markup and no doubled spaces', () => {
    expect(offending((l) => l.includes('<') || l.includes('>'))).toEqual([]);
    expect(offending((l) => l.includes('  '))).toEqual([]);
  });

  it('never prices anything in the retired Red scrips (a misread tomestone price)', () => {
    expect(offending((l) => /Red (Crafters'|Gatherers') Scrip/.test(l))).toEqual([]);
  });

  it('never lists a salvager, a recompense officer or the MGF trader (they only sell back)', () => {
    expect(offending((l) => /(Calamity|Journeyman) Salvager|Recompense Officer|MGF Trader/.test(l))).toEqual([]);
  });

  it('lists raid and trial encounters, never the book or totem exchange (spec D5/D6)', () => {
    // A mixed upgrade ("Weathered Book of Spades, 100 Allagan Tomestones of
    // Poetics") keeps its vendor line by design; a pure token exchange never does.
    expect(offending((l) => /AAC Illustrated|\bTotems?\b|Totem of/.test(l))).toEqual([]);
  });

  it('reads known relics as their saga, whatever step or replica', () => {
    const expected: Record<string, string> = {
      10059: 'Zodiac Weapons Saga', // Nirvana Zeta
      12127: 'Zodiac Weapons Saga', // Replica Sphairai Zenith
      1665: 'Zodiac Weapons Saga', // Unfinished Curtana
      13611: 'Anima Weapons Saga',
      32669: 'Resistance Gear & Weapons',
      33613: 'Resistance Gear & Weapons', // Blade's armor
      39921: 'Manderville Weapons Saga',
      47878: 'Phantom Gear & Weapons',
      45679: 'Cosmic Tools Saga',
    };
    const actual = Object.fromEntries(Object.keys(expected).map((id) => [id, (table as Record<string, string>)[id]]));
    expect(actual).toEqual(expected);
  });
});
