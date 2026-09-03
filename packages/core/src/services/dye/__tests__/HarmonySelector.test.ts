/**
 * Tests for the shared harmony selector.
 *
 * The contract that matters most is not any single number here — it is that
 * every surface now gets the SAME dyes, which the consumers' own parity tests
 * pin. What this file pins is the behaviour those consumers rely on: the ideal
 * a slot targets, the ranking, de-duplication, pinning, and the fact that a
 * harmony type is a row in `HARMONY_OFFSETS` rather than a bespoke method.
 */

import { describe, it, expect } from 'vitest';
import { generateHarmonySlots, isKnownHarmonyType } from '../HarmonySelector.js';
import { HARMONY_OFFSETS } from '../../../constants/index.js';
import { DyeService } from '../../DyeService.js';
import dyeDatabase from '../../../data/dyes.json' with { type: 'json' };
import { ColorService } from '../../ColorService.js';
import type { Dye } from '@xivdyetools/types';

const svc = new DyeService(dyeDatabase);
const ALL: Dye[] = svc.getAllDyes().filter((d) => d.category !== 'Facewear');

/** A saturated base and a near-neutral one: the two behave very differently. */
const RED = ALL.find((d) => d.name === 'Dalamud Red') ?? ALL[0];
const WHITE = ALL.find((d) => d.name === 'Snow White') ?? ALL[0];

const PERCEPTUAL = { usePerceptualMatching: true, matchingMethod: 'ciede2000' } as const;

describe('isKnownHarmonyType', () => {
  it.each(Object.keys(HARMONY_OFFSETS))('accepts %s', (type) => {
    expect(isKnownHarmonyType(type)).toBe(true);
  });

  it.each(['', 'nonsense', 'toString', 'constructor'])('rejects %j', (type) => {
    expect(isKnownHarmonyType(type)).toBe(false);
  });
});

describe('generateHarmonySlots', () => {
  it('returns one slot per offset, for every type in the table', () => {
    for (const [type, offsets] of Object.entries(HARMONY_OFFSETS)) {
      const slots = generateHarmonySlots(RED.hex, type, ALL, PERCEPTUAL);
      expect(slots, type).toHaveLength(offsets.length);
      expect(slots.map((s) => s.index), type).toEqual(offsets.map((_, i) => i));
    }
  });

  // The reason the bot can serve ten types after this change and eight before:
  // a type is a row in the table, not a method someone has to write.
  it.each(['compound', 'shades'])('builds %s, which no find*Dyes method exists for', (type) => {
    const slots = generateHarmonySlots(RED.hex, type, ALL, PERCEPTUAL);

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.dye !== null)).toBe(true);
  });

  it('returns nothing for an unknown type rather than guessing', () => {
    expect(generateHarmonySlots(RED.hex, 'not-a-harmony', ALL, PERCEPTUAL)).toEqual([]);
    // Own-property lookup: an inherited key must not resolve to a function.
    expect(generateHarmonySlots(RED.hex, 'toString', ALL, PERCEPTUAL)).toEqual([]);
  });

  // This is the difference that made the bot and the page disagree on 89-100%
  // of bases: the ideal carries the BASE's saturation and value, so a
  // desaturated base looks for desaturated dyes.
  it('builds each ideal from the base saturation and value', () => {
    const baseHsv = ColorService.hexToHsv(WHITE.hex);
    const slots = generateHarmonySlots(WHITE.hex, 'triadic', ALL, PERCEPTUAL);

    for (const slot of slots) {
      const idealHsv = ColorService.hexToHsv(slot.targetHex);
      expect(idealHsv.s).toBeCloseTo(baseHsv.s, 0);
      expect(idealHsv.v).toBeCloseTo(baseHsv.v, 0);
      expect(idealHsv.h).toBeCloseTo(slot.targetHue, 0);
    }
  });

  it('keeps a near-neutral base near-neutral', () => {
    const baseHsv = ColorService.hexToHsv(WHITE.hex);
    expect(baseHsv.s).toBeLessThan(20); // Snow White really is desaturated

    const slots = generateHarmonySlots(WHITE.hex, 'analogous', ALL, PERCEPTUAL);

    // Every chosen dye is itself desaturated. The old bot path answered this
    // with Neon Green and Kobold Brown.
    for (const slot of slots) {
      expect(slot.dye).not.toBeNull();
      expect(ColorService.hexToHsv(slot.dye!.hex).s).toBeLessThan(40);
    }
  });

  it('normalises negative offsets to a wheel angle', () => {
    // `shades` is [15, 345]; 345 is -15 on the wheel.
    const slots = generateHarmonySlots(RED.hex, 'shades', ALL, PERCEPTUAL);
    expect(slots.map((s) => s.offset)).toEqual([15, 345]);
    expect(slots.every((s) => s.targetHue >= 0 && s.targetHue < 360)).toBe(true);
  });

  describe('de-duplication', () => {
    it('never repeats a dye across slots when asked', () => {
      const slots = generateHarmonySlots(WHITE.hex, 'tetradic', ALL, {
        ...PERCEPTUAL,
        preventDuplicates: true,
      });

      const ids = slots.map((s) => s.dye?.itemID).filter((id): id is number => id != null);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('never returns the base dye itself', () => {
      const slots = generateHarmonySlots(
        RED.hex,
        'monochromatic',
        ALL,
        { ...PERCEPTUAL, preventDuplicates: true },
        { excludeItemIDs: [RED.itemID] }
      );

      expect(slots.every((s) => s.dye?.itemID !== RED.itemID)).toBe(true);
    });

    it('may repeat when de-duplication is off', () => {
      const slots = generateHarmonySlots(WHITE.hex, 'tetradic', ALL, PERCEPTUAL);
      expect(slots.every((s) => s.dye !== null)).toBe(true);
    });
  });

  describe('pinning', () => {
    it('honours a caller-fixed dye for its slot', () => {
      const pin = ALL.find((d) => d.name === 'Jet Black')!;
      const slots = generateHarmonySlots(
        RED.hex,
        'triadic',
        ALL,
        { ...PERCEPTUAL, preventDuplicates: true },
        { excludeItemIDs: [RED.itemID], pinned: new Map([[1, pin]]) }
      );

      expect(slots[1].dye?.itemID).toBe(pin.itemID);
      // ...and it still consumes its place, so a later slot cannot reuse it.
      expect(slots.filter((s) => s.dye?.itemID === pin.itemID)).toHaveLength(1);
    });

    it('scores a pinned dye against its own slot ideal', () => {
      const pin = ALL.find((d) => d.name === 'Jet Black')!;
      const slots = generateHarmonySlots(RED.hex, 'triadic', ALL, PERCEPTUAL, { pinned: new Map([[0, pin]]) });

      expect(slots[0].deviance).toBeGreaterThan(0);
      expect(slots[0].deviance).toBe(
        ColorService.getDistanceForMethod(slots[0].targetHex, pin.hex, 'ciede2000')
      );
    });
  });

  describe('companions', () => {
    it('returns none by default', () => {
      const slots = generateHarmonySlots(RED.hex, 'triadic', ALL, PERCEPTUAL);
      expect(slots.every((s) => s.companions.length === 0)).toBe(true);
    });

    it('returns runners-up nearest first, excluding the chosen dye', () => {
      const slots = generateHarmonySlots(RED.hex, 'complementary', ALL, {
        ...PERCEPTUAL,
        companionCount: 3,
      });
      const slot = slots[0];

      expect(slot.companions).toHaveLength(3);
      expect(slot.companions.map((d) => d.itemID)).not.toContain(slot.dye?.itemID);

      const distances = slot.companions.map((d) =>
        ColorService.getDistanceForMethod(slot.targetHex, d.hex, 'ciede2000')
      );
      expect([...distances].sort((a, b) => a - b)).toEqual(distances);
      expect(distances[0]).toBeGreaterThanOrEqual(slot.deviance);
    });
  });

  describe('candidate pool', () => {
    it('leaves a slot empty rather than inventing a dye', () => {
      const slots = generateHarmonySlots(RED.hex, 'triadic', [], PERCEPTUAL);

      expect(slots).toHaveLength(2);
      expect(slots.every((s) => s.dye === null)).toBe(true);
      expect(slots.every((s) => s.deviance === 0)).toBe(true);
    });

    it('chooses only from the pool it was given', () => {
      const pool = ALL.slice(0, 3);
      const slots = generateHarmonySlots(RED.hex, 'square', pool, PERCEPTUAL);

      const poolIds = new Set(pool.map((d) => d.itemID));
      for (const slot of slots) {
        expect(poolIds.has(slot.dye!.itemID)).toBe(true);
      }
    });

    it('never surfaces Facewear, whatever the caller passes', () => {
      const facewear = svc.getAllDyes().filter((d) => d.category === 'Facewear');
      // Only meaningful if the database still carries any; since schema v2 it
      // does not, which is itself worth asserting.
      const slots = generateHarmonySlots(RED.hex, 'triadic', [...facewear, ...ALL], PERCEPTUAL);

      expect(slots.every((s) => s.dye?.category !== 'Facewear')).toBe(true);
    });
  });

  describe('hue-angle ranking (perceptual matching off)', () => {
    it('ranks by angular distance instead of ΔE', () => {
      const slots = generateHarmonySlots(RED.hex, 'complementary', ALL, {
        usePerceptualMatching: false,
        matchingMethod: 'ciede2000',
      });
      const slot = slots[0];

      const chosenHue = ColorService.hexToHsv(slot.dye!.hex).h;
      const diff = Math.abs(chosenHue - slot.targetHue);
      const angular = Math.min(diff, 360 - diff);

      expect(slot.deviance).toBeCloseTo(angular, 5);
      // Degrees, not ΔE units: a hue distance can never exceed 180.
      expect(slot.deviance).toBeLessThanOrEqual(180);
    });
  });
});
