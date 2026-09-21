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

    it('emits every WORN piece as a model key, undyed accessories included, empty off-hand skipped', () => {
      expect(parsed.gearModels).toEqual([
        { slot: 'MainHand', set: 5603, base: 9, variant: 3 },
        { slot: 'HeadGear', base: 813, variant: 2 },
        { slot: 'Body', base: 876, variant: 1 },
        { slot: 'Hands', base: 835, variant: 2 },
        { slot: 'Legs', base: 835, variant: 2 },
        { slot: 'Feet', base: 6135, variant: 1 },
        { slot: 'Ears', base: 124, variant: 6 },
        { slot: 'Neck', base: 111, variant: 2 },
        { slot: 'Wrists', base: 134, variant: 6 },
        { slot: 'LeftRing', base: 53, variant: 1 },
        { slot: 'RightRing', base: 53, variant: 1 },
      ]);
      // Worn ≠ dyed: 11 pieces worn, 5 slots dyed — the footnote needs both.
      expect(new Set(parsed.gearDyes.map((g) => g.slot)).size).toBe(5);
    });

    it('Glasses { GlassesId: 0 } is no facewear', () => {
      expect(parsed.glassesId).toBeNull();
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

    it('carries both weapon triples — the off-hand here is the main hand\'s ModelSub (fist pair)', () => {
      expect(parsed.gearModels.slice(0, 2)).toEqual([
        { slot: 'MainHand', set: 301, base: 31, variant: 1 },
        { slot: 'OffHand', set: 351, base: 31, variant: 1 },
      ]);
      // Five accessory slots are all-zero in this file → not worn, not emitted.
      expect(parsed.gearModels.map((m) => m.slot)).toEqual([
        'MainHand',
        'OffHand',
        'HeadGear',
        'Body',
        'Legs',
        'Feet',
      ]);
    });
  });

  // A real Anamnesis export, scrubbed of Nickname / Author / Description /
  // Tags / Base64Image. It is here because it writes `"Race": "Lalafel"` —
  // the game enum's one-L spelling — which the parser refused outright until
  // the tribe became the source of truth. A synthetic object cannot prove
  // what a producer actually emits.
  describe('Lalafell Dunesfolk (real Anamnesis export, drifted Race spelling)', () => {
    const text = fixture('lalafell-dunesfolk.chara');
    const parsed = parseCharaFile(text);

    it('the fixture really does carry the one-L spelling', () => {
      expect(JSON.parse(text).Race).toBe('Lalafel');
    });

    it('parses, and reads the race off the tribe', () => {
      expect(parsed.race).toBe('Lalafell');
      expect(parsed.tribe).toBe('Dunesfolk');
      expect(parsed.tribeRaw).toBe('Dunesfolk');
      expect(parsed.gender).toBe('Female');
      expect(parsed.producer).toBe('Anamnesis Character File');
    });

    it('fills all eight colour slots', () => {
      expect(parsed.slots).toHaveLength(8);
      expect(parsed.slots.filter((s) => s.index !== null)).toHaveLength(8);
    });

    it('carries the glamour dye channels', () => {
      expect(parsed.gearDyes.length).toBeGreaterThan(0);
      expect(parsed.gearDyes.every((d) => d.stainId > 0)).toBe(true);
    });

    it('carries no name, author or screenshot', () => {
      const raw = JSON.parse(text) as Record<string, unknown>;
      for (const key of ['Nickname', 'Author', 'Description', 'Tags', 'Base64Image']) {
        expect(raw).not.toHaveProperty(key);
      }
      expect(parsed.nickname).toBeNull();
    });
  });

  // Spec 10a ("Tribe, not Race"): Race strings drift between producers and
  // producer versions, Tribe does not. Tribe therefore determines the race,
  // and the file's own Race key is never allowed to contradict it.
  describe('race comes from the tribe, not the Race key', () => {
    const parse = (extra: Record<string, unknown>): ReturnType<typeof parseCharaFile> =>
      parseCharaFile(JSON.stringify({ Gender: 'Feminine', Skintone: 1, ...extra }));

    it.each([
      ['Midlander', 'Hyur'],
      ['Highlander', 'Hyur'],
      ['Wildwood', 'Elezen'],
      ['Duskwight', 'Elezen'],
      ['Plainsfolk', 'Lalafell'],
      ['Dunesfolk', 'Lalafell'],
      ['SeekerOfTheSun', "Miqo'te"],
      ['KeeperOfTheMoon', "Miqo'te"],
      ['SeaWolf', 'Roegadyn'],
      ['Hellsguard', 'Roegadyn'],
      ['Raen', 'AuRa'],
      ['Xaela', 'AuRa'],
      ['Helions', 'Hrothgar'],
      ['TheLost', 'Hrothgar'],
      ['Rava', 'Viera'],
      ['Veena', 'Viera'],
    ])('derives %s → %s with no Race key at all', (tribe, expected) => {
      expect(parse({ Tribe: tribe }).race).toBe(expected);
    });

    // The bug this replaced: Anamnesis writes the game enum's "Lalafel" (one
    // trailing L), which the old race table did not carry, so the parser threw
    // before reading a colour. Tribe answers it without consulting Race.
    it.each([
      ['Lalafel', 'Dunesfolk', 'Lalafell'],
      ['Lalafell', 'Dunesfolk', 'Lalafell'],
      ['Miqote', 'SeekerOfTheSun', "Miqo'te"],
      ['AuRa', 'Xaela', 'AuRa'],
      ['Au Ra', 'Xaela', 'AuRa'],
      ['Hrothgar', 'Helions', 'Hrothgar'],
    ])('ignores the file spelling %s (%s) and still reports %s', (Race, Tribe, expected) => {
      expect(parse({ Race, Tribe }).race).toBe(expected);
    });

    it('a Race spelling no producer has used yet is not fatal', () => {
      // The whole point: the next drift must not be another P0. Tribe wins.
      expect(parse({ Race: 'Lalafelle', Tribe: 'Dunesfolk' }).race).toBe('Lalafell');
      expect(parse({ Race: 42, Tribe: 'Dunesfolk' }).race).toBe('Lalafell');
      expect(parse({ Race: null, Tribe: 'Dunesfolk' }).race).toBe('Lalafell');
    });

    it('a Race that contradicts the Tribe loses to the Tribe', () => {
      const parsed = parse({ Race: 'Lalafel', Tribe: 'Xaela' });
      expect(parsed.race).toBe('AuRa');
      expect(parsed.tribe).toBe('Xaela');
    });

    it('falls back to the Race key only when the file carries no Tribe', () => {
      expect(parse({ Race: 'Lalafel' }).race).toBe('Lalafell');
      expect(parse({ Race: 'Hrothgar' }).race).toBe('Hrothgar');
      expect(parse({ Race: 'Nonesuch' }).race).toBeNull();
      expect(parse({}).race).toBeNull();
    });

    it('still fails loudly on an unrecognised TRIBE — that one is authoritative', () => {
      expect(() => parse({ Tribe: 'Dunesfolke' })).toThrow(/unrecognised value "Dunesfolke"/);
    });

    // Two slot rules key off the race. Before Tribe became the source of
    // truth they read a Race key that a real file may simply not carry.
    it('inerts a Hrothgar fur pattern even when the file has no Race key', () => {
      const lip = parse({ Tribe: 'Helions', LipsToneFurPattern: 37 }).slots.find(
        (s) => s.slot === 'lip',
      );
      expect(lip?.indexActive).toBe(false);
      expect(lip?.inertReason).toBe('furPattern');
    });

    it('does not inert a lip tone for a non-Hrothgar tribe', () => {
      const lip = parse({ Tribe: 'Dunesfolk', LipsToneFurPattern: 37 }).slots.find(
        (s) => s.slot === 'lip',
      );
      expect(lip?.indexActive).toBe(true);
      expect(lip?.inertReason).toBeUndefined();
    });
  });

  describe('gear model quirks', () => {
    const base = { Race: 'Viera', Tribe: 'Rava', Gender: 'Feminine', Skintone: 1 };

    it('accepts Glasses as a bare integer (Brio-era Ktisis) or { GlassesId }', () => {
      expect(parseCharaFile(JSON.stringify({ ...base, Glasses: 40 })).glassesId).toBe(40);
      expect(parseCharaFile(JSON.stringify({ ...base, Glasses: { GlassesId: 160 } })).glassesId).toBe(160);
      expect(parseCharaFile(JSON.stringify({ ...base })).glassesId).toBeNull();
      expect(parseCharaFile(JSON.stringify({ ...base, Glasses: 0 })).glassesId).toBeNull();
    });

    it('treats a null hand record as empty (one Anamnesis file writes MainHand: null)', () => {
      const parsed = parseCharaFile(
        JSON.stringify({ ...base, MainHand: null, OffHand: null, Body: { ModelBase: 279, ModelVariant: 1 } }),
      );
      expect(parsed.gearModels).toEqual([{ slot: 'Body', base: 279, variant: 1 }]);
    });

    it('a weapon with set but no base is still worn; armour with base 0 is not', () => {
      const parsed = parseCharaFile(
        JSON.stringify({
          ...base,
          MainHand: { ModelSet: 2099, ModelBase: 0, ModelVariant: 0 },
          Body: { ModelBase: 0, ModelVariant: 7, DyeId: 5 },
        }),
      );
      expect(parsed.gearModels).toEqual([{ slot: 'MainHand', set: 2099, base: 0, variant: 0 }]);
      // The dye channel is still reported even though no model is worn — the
      // file said so; the UI decides how to show a dye on nothing.
      expect(parsed.gearDyes).toEqual([{ slot: 'Body', channel: 1, stainId: 5 }]);
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
