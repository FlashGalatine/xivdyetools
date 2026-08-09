import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCharaFile } from '../chara-parser.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string): string => readFileSync(join(fixturesDir, name), 'utf8');

describe('parseCharaFile', () => {
  describe('duskwight heterochromia (old Anamnesis, extended valid)', () => {
    const parsed = parseCharaFile(fixture('duskwight-heterochromia.chara'));

    it('maps identity', () => {
      expect(parsed.race).toBe('Elezen');
      expect(parsed.tribe).toBe('Duskwight');
      expect(parsed.gender).toBe('Female');
      expect(parsed.producer).toBeNull();
      expect(parsed.extendedDeclared).toBe(true);
      expect(parsed.extendedValid).toBe(true);
    });

    it('crosses eye keys: REyeColor is the LEFT eye, LEyeColor the right', () => {
      const left = parsed.slots.find((s) => s.slot === 'leftEye');
      const right = parsed.slots.find((s) => s.slot === 'rightEye');
      expect(left?.index).toBe(42);
      expect(right?.index).toBe(169);
      // Left float = LeftEyeColor (warm amber), right = RightEyeColor (green).
      expect(left?.floatLinear?.[0]).toBeCloseTo(0.7443291, 6);
      expect(right?.floatLinear?.[0]).toBeCloseTo(0.28027683, 6);
    });

    it('gamma-encodes linear floats to sRGB', () => {
      const skin = parsed.slots.find((s) => s.slot === 'skin');
      // linear 0.8858132 → sRGB ≈ 0.9497 → 242
      expect(skin?.float?.r).toBe(242);
      expect(skin?.float?.g).toBe(218);
      expect(skin?.float?.b).toBe(226);
    });

    it('FacePaint: 0 inerts FacePaintColor (only 0 is load-bearing)', () => {
      const facePaint = parsed.slots.find((s) => s.slot === 'facePaint');
      expect(facePaint?.index).toBe(55);
      expect(facePaint?.indexActive).toBe(false);
      expect(facePaint?.inertReason).toBe('facePaintNone');
    });

    it('reads lip alpha as a continuous opacity', () => {
      const lip = parsed.slots.find((s) => s.slot === 'lip');
      expect(lip?.alpha).toBeCloseTo(0.6, 6);
      expect(lip?.indexActive).toBe(true);
    });

    it('emits only dyed gear channels as stain IDs, labelled by slot', () => {
      expect(parsed.gearDyes).toEqual([
        { slot: 'HeadGear', channel: 1, stainId: 92 },
        { slot: 'HeadGear', channel: 2, stainId: 1 },
        { slot: 'Body', channel: 1, stainId: 97 },
        { slot: 'Body', channel: 2, stainId: 92 },
        { slot: 'Hands', channel: 1, stainId: 97 },
        { slot: 'Legs', channel: 1, stainId: 97 },
        { slot: 'Feet', channel: 1, stainId: 97 },
      ]);
    });
  });

  describe('Hrothgar Helions (fur pattern, highlights off, alpha-0 lip)', () => {
    const parsed = parseCharaFile(fixture('hrothgar-helions.chara'));

    it('maps the file plural "Helions" to the SubRace', () => {
      expect(parsed.tribe).toBe('Helions');
      expect(parsed.tribeRaw).toBe('Helions');
    });

    it('EnableHighlights: false inerts the highlight index', () => {
      const highlights = parsed.slots.find((s) => s.slot === 'highlights');
      expect(highlights?.indexActive).toBe(false);
      expect(highlights?.inertReason).toBe('highlightsDisabled');
    });

    it('LipsToneFurPattern is a fur-pattern enum on Hrothgar, not a colour', () => {
      const lip = parsed.slots.find((s) => s.slot === 'lip');
      expect(lip?.indexActive).toBe(false);
      expect(lip?.inertReason).toBe('furPattern');
      expect(lip?.alpha).toBe(0);
    });

    it('FacePaint: 106 stays active (do not range-validate FacePaint)', () => {
      const facePaint = parsed.slots.find((s) => s.slot === 'facePaint');
      expect(facePaint?.indexActive).toBe(true);
    });
  });

  describe('Xaela with new Anamnesis header (no IsExtendedAppearanceValid)', () => {
    const parsed = parseCharaFile(fixture('xaela-anamnesis-header.chara'));

    it('shows the producer but never parses against it', () => {
      expect(parsed.producer).toBe('Anamnesis Character File');
    });

    it('missing IsExtendedAppearanceValid means floats are not live', () => {
      expect(parsed.extendedDeclared).toBe(false);
      expect(parsed.extendedValid).toBe(false);
    });

    it('an absent MouthColor alpha ≠ 0 — here alpha is declared 0.7058824', () => {
      const lip = parsed.slots.find((s) => s.slot === 'lip');
      expect(lip?.alpha).toBeCloseTo(0.7058824, 6);
    });
  });

  describe('loud failures', () => {
    it('rejects invalid JSON', () => {
      expect(() => parseCharaFile('not json')).toThrow(/not valid JSON/);
    });

    it('rejects an unrecognised tribe naming got vs expected', () => {
      expect(() => parseCharaFile(JSON.stringify({ Tribe: 'Padjal' }))).toThrow(
        /Tribe: unrecognised value "Padjal"/
      );
    });

    it('refuses a JSON carrying no colour field at all (wrong kind of file)', () => {
      expect(() => parseCharaFile(JSON.stringify({ name: 'not-a-character', version: 3 }))).toThrow(
        /no character colour fields/
      );
    });

    it('accepts an extended-only file (floats, no palette indices)', () => {
      const parsed = parseCharaFile(JSON.stringify({ SkinColor: '0.5, 0.4, 0.3' }));
      expect(parsed.slots.find((s) => s.slot === 'skin')?.float).not.toBeNull();
    });

    it('rejects a malformed float colour naming the field', () => {
      expect(() =>
        parseCharaFile(JSON.stringify({ SkinColor: 'red, green, blue' }))
      ).toThrow(/SkinColor/);
    });

    it('an absent MouthColor leaves the lip index valid (Ktisis omits the key)', () => {
      const parsed = parseCharaFile(
        JSON.stringify({ Race: 'Viera', Tribe: 'Rava', Gender: 'Feminine', LipsToneFurPattern: 12 })
      );
      const lip = parsed.slots.find((s) => s.slot === 'lip');
      expect(lip?.alpha).toBeNull();
      expect(lip?.indexActive).toBe(true);
      expect(lip?.index).toBe(12);
    });
  });
});
