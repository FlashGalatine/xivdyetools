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
import type { HarmonySelectionConfig } from '../HarmonySelector.js';
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

  /**
   * `excludeItemIDs` is "must never be chosen"; `preventDuplicates` is "do not
   * repeat what is already on screen". They were one `Set` until 2026-09-03,
   * and that Set is read only on the `preventDuplicates` branch — so with
   * duplicates allowed the exclusions did nothing at all.
   *
   * Every existing test above passes `preventDuplicates: true`, which is the
   * one setting where the old code happened to be right, so the whole class of
   * defect was invisible. bot-logic defaulted the flag to FALSE, so it was the
   * bot that shipped it: `/harmony monochromatic` (a single `[0]` offset whose
   * ideal is the base colour) answered the base dye as its own harmony.
   */
  describe('exclusions (independent of de-duplication)', () => {
    it.each([true, false])('never returns an excluded dye — preventDuplicates=%s', (dedup) => {
      const slots = generateHarmonySlots(
        RED.hex,
        'monochromatic',
        ALL,
        { ...PERCEPTUAL, preventDuplicates: dedup },
        { excludeItemIDs: [RED.itemID] }
      );

      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every((s) => s.dye !== null)).toBe(true);
      expect(slots.every((s) => s.dye?.itemID !== RED.itemID)).toBe(true);
    });

    it.each([true, false])('never offers an excluded dye as a companion — %s', (dedup) => {
      const slots = generateHarmonySlots(
        RED.hex,
        'analogous',
        ALL,
        { ...PERCEPTUAL, preventDuplicates: dedup, companionCount: 3 },
        { excludeItemIDs: [RED.itemID] }
      );

      expect(slots.some((s) => s.companions.length > 0)).toBe(true);
      expect(slots.every((s) => s.companions.every((d) => d.itemID !== RED.itemID))).toBe(true);
    });

    it('excludes every id it is given, not just the first', () => {
      const [a, b, c] = ALL;
      const slots = generateHarmonySlots(
        WHITE.hex,
        'square',
        ALL,
        { ...PERCEPTUAL, preventDuplicates: false, companionCount: 2 },
        { excludeItemIDs: [a.itemID, b.itemID, c.itemID] }
      );

      const seen = slots.flatMap((s) => [s.dye, ...s.companions]).filter((d): d is Dye => d != null);
      expect(seen.length).toBeGreaterThan(0);
      for (const id of [a.itemID, b.itemID, c.itemID]) {
        expect(seen.every((d) => d.itemID !== id)).toBe(true);
      }
    });

    it('still lets an explicit pin win its slot', () => {
      // A hand-swap is the user naming a dye; that outranks our exclusions.
      const slots = generateHarmonySlots(
        WHITE.hex,
        'complementary',
        ALL,
        { ...PERCEPTUAL, preventDuplicates: false },
        { excludeItemIDs: [RED.itemID], pinned: new Map([[0, RED]]) }
      );

      expect(slots[0].dye?.itemID).toBe(RED.itemID);
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

  describe('colour wheel', () => {
    const ALL_DYES = svc.getAllDyes();
    const base = (config: Partial<HarmonySelectionConfig> = {}) =>
      generateHarmonySlots(RED.hex, 'complementary', ALL_DYES, { ...PERCEPTUAL, preventDuplicates: true, ...config }, {
        excludeItemIDs: [RED.itemID],
      });

    it('defaults to the RGB wheel: unset and rgb answer identically, with wheelHue = targetHue', () => {
      const unset = base();
      const rgb = base({ wheel: 'rgb' });
      expect(rgb.map((s) => s.dye?.itemID)).toEqual(unset.map((s) => s.dye?.itemID));
      for (const s of unset) expect(s.wheelHue).toBe(s.targetHue);
    });

    it('exposes the ring angle separately from the sRGB hue on a warped wheel', () => {
      const [slot] = base({ wheel: 'ryb' });
      const baseWheelHue = ColorService.hexToHsv(RED.hex).h; // Dalamud Red is near sRGB 0°, so ≈ RYB 0°
      expect(Math.abs(slot.wheelHue - ((baseWheelHue + 180) % 360))).toBeLessThan(5);
      expect(slot.targetHue).not.toBeCloseTo(slot.wheelHue, 0);
    });

    it("chooses a different complement for a saturated red on RYB than on RGB", () => {
      expect(base({ wheel: 'ryb' })[0].dye?.itemID).not.toBe(base()[0].dye?.itemID);
    });

    it.each(['ryb', 'munsell', 'oklch-hue', 'oklch-lightness'] as const)(
      'keeps a near-grey base near-grey on %s',
      (wheel) => {
        // Snow White itself is HSV s≈8.77 (not 0), and RYB/Munsell/oklch-hue
        // carry the base's own S/V onto the rotated hue by design, so the
        // ideal can never read BELOW the base's own saturation. 15 is well
        // under the file's existing "near-neutral" bar (20, above) and still
        // catches a wheel that made a near-grey base noticeably chromatic.
        const slots = generateHarmonySlots(WHITE.hex, 'triadic', ALL_DYES, { ...PERCEPTUAL, wheel }, {
          excludeItemIDs: [WHITE.itemID],
        });
        for (const s of slots) expect(ColorService.hexToHsv(s.targetHex).s).toBeLessThan(15);
      }
    );

    it('rejects an unknown wheel loudly rather than falling back to RGB', () => {
      expect(() => base({ wheel: 'cmyk' as never })).toThrow(RangeError);
    });
  });
});
