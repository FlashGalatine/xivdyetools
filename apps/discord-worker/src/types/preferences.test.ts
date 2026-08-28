/**
 * Tests for CLANS_BY_RACE — DEAD-024 adoption anti-drift proof.
 *
 * CLANS_BY_RACE is derived from the shared `RACE_SUBRACES` game-data table
 * in `@xivdyetools/types` (via a local display-name/order adapter), rather
 * than hand-rolling its own race/clan set. These tests prove the derived
 * set stays in lockstep with the shared source of truth, and that the
 * pre-adoption display order/labels are unchanged.
 */
import { describe, it, expect } from 'vitest';
import { RACE_SUBRACES, SUBRACE_TO_RACE, type Race } from '@xivdyetools/types';
import { MATCHING_METHODS as CORE_MATCHING_METHODS } from '@xivdyetools/core';
import { CLANS_BY_RACE, VALID_CLANS, MATCHING_METHODS } from './preferences.js';

describe('CLANS_BY_RACE (DEAD-024 adoption)', () => {
  it('has exactly one entry per race in the shared RACE_SUBRACES table', () => {
    expect(Object.keys(CLANS_BY_RACE)).toHaveLength(Object.keys(RACE_SUBRACES).length);
  });

  it('gives every race exactly the number of clans RACE_SUBRACES defines for it', () => {
    const raceSubraceCounts = (Object.keys(RACE_SUBRACES) as Race[]).map(
      (race) => RACE_SUBRACES[race].length,
    );
    const clanCounts = Object.values(CLANS_BY_RACE).map((clans) => clans.length);

    // Every race contributes exactly 2 subraces today; comparing sorted
    // count arrays catches a race silently dropped or double-counted even
    // if array order differs.
    expect(clanCounts.sort()).toEqual(raceSubraceCounts.sort());
  });

  it('flattens to exactly as many clans as SUBRACE_TO_RACE has keys', () => {
    expect(VALID_CLANS).toHaveLength(Object.keys(SUBRACE_TO_RACE).length);
  });

  it('preserves the pre-adoption display order and labels', () => {
    // Locking this down is the point of the adapter: the shared table only
    // supplies the *set*, not the /preferences-facing order or spacing.
    expect(Object.keys(CLANS_BY_RACE)).toEqual([
      'Hyur',
      "Miqo'te",
      'Lalafell',
      'Roegadyn',
      'Elezen',
      'Au Ra',
      'Viera',
      'Hrothgar',
    ]);
    expect(CLANS_BY_RACE.Hyur).toEqual(['Midlander', 'Highlander']);
    expect(CLANS_BY_RACE["Miqo'te"]).toEqual(['Seeker of the Sun', 'Keeper of the Moon']);
    expect(CLANS_BY_RACE['Au Ra']).toEqual(['Raen', 'Xaela']);
    expect(CLANS_BY_RACE.Hrothgar).toEqual(['Helions', 'The Lost']);
  });
});

describe('MATCHING_METHODS (DEAD-037 anti-drift proof)', () => {
  it('has exactly the same values, in the same order, as core MATCHING_METHODS', () => {
    // This app's list carries per-method display name/description for
    // /preferences and autocomplete; only the `value` column is the shared
    // vocabulary. Proving order+values match core catches a new/renamed/
    // reordered method landing on one side without the other.
    expect(MATCHING_METHODS.map((m) => m.value)).toEqual(CORE_MATCHING_METHODS);
  });

  it('has no extra or missing methods relative to core', () => {
    expect(MATCHING_METHODS).toHaveLength(CORE_MATCHING_METHODS.length);
  });
});
