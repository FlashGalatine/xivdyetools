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
  it('preserves the reviewed duty sources for complete weapon families and the Templar set', () => {
    const lookup = table as Record<string, string>;
    for (let id = 52299; id <= 52320; id++)
      expect(lookup[id], `Palazzo Diamond ${id}`).toBe('Dancing Mad (Ultimate)');
    for (let id = 47028; id <= 47071; id++)
      expect(lookup[id], `Pilgrim weapon ${id}`).toBe("Pilgrim's Traverse");
    for (const id of [2896, 3217, 3919, 31536, 31537]) expect(lookup[id]).toBe('Dzemael Darkhold');
    for (const id of [24996, 24997]) expect(lookup[id]).toBe('Baldesion Arsenal');
    expect(lookup[1661]).toBe('The Aurum Vale');
  });
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

  it('names a settlement as the outpost, never a stable, shop, forge or raid entrance beside the vendor (spec D10)', () => {
    // The labels the nearest-label rule used to print, for a vendor standing next to them.
    const facilities = new Set([
      'Chocobokeep',
      "Rowena's House of Splendors",
      'The Diamond Forge',
      'The Workbench',
      'Crystal Tower',
      'Longbeard Council',
      'Heaven-on-High',
    ]);
    const outposts = (line: string): string[] =>
      line.split(' / ').flatMap((segment) => {
        const parts = segment.replace(/ \(.*\)$/, '').split(' - ');
        return parts.length >= 3 ? [parts[parts.length - 1] ?? ''] : [];
      });
    expect(offending((l) => outposts(l).some((o) => facilities.has(o)))).toEqual([]);
    // The GPOSERS reminders' own example vendor, in the zone-first order of the guide's template
    expect((table as Record<string, string>)['15181']).toBe('E-Una-Kotor - South Shroud - Quarrymill (3 Aetherpool Grips)');
  });

  it("writes The Emperor's New items as Goberin in Vesper Bay (Mar 2026 reminders)", () => {
    expect((table as Record<string, string>)['10033']).toBe('Goberin - Western Thanalan - Vesper Bay');
  });

  it('lists desynthesis and Deep Dungeons only as the only source (Mar 2026 reminders)', () => {
    const deep = /^(The Palace of the Dead|Heaven-on-High|Eureka Orthos|Pilgrim's Traverse) \(/;
    const desynth = /^Desynthesis \(/;
    expect(offending((l) => l.split(' / ').some((s) => desynth.test(s)) && !l.split(' / ').every((s) => desynth.test(s)))).toEqual([]);
    expect(offending((l) => l.split(' / ').some((s) => deep.test(s)) && !l.split(' / ').every((s) => deep.test(s)))).toEqual([]);
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
