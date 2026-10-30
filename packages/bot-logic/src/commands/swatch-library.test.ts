/**
 * /swatch on the library-backed import (xivcharakit integration, Task 6).
 *
 * executeSwatch reads through core's facade (`inspectCharaForTools` →
 * `resolveCharaForTools`) and matches the projection's `matchHex` — never a
 * fallback to `displayHex` or a preview colour. A slot whose `matchHex` is null
 * (unknown activation, inactive, unresolved) gives no row, no slot: target and
 * no strip colour. The lip matches its live composite, `lipComposite?.hex ??
 * matchHex`, gated on `matchHex`. Success exposes only the card and embed.
 *
 * Expected colours and dyes are pinned independently of the parser: the
 * palette hex comes from `CharacterColorService` (or a literal), the dye from
 * the dye table.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CharacterColorService,
  ColorService,
  inspectCharaForTools,
  resolveCharaForTools,
} from '@xivdyetools/core';
import { generateNearestSheet, generateSwatchCard } from '@xivdyetools/svg';
import { executeSwatch, type SwatchInput, type SwatchResult } from './swatch.js';

// @ts-expect-error — bot-logic 5 removes the published legacy character type.
export type { SwatchCharacter } from '../index.js';
// @ts-expect-error — a success exposes presentation outputs only.
export type RemovedSuccessCharacter = Extract<SwatchResult, { ok: true }>['character'];
import { dyeService } from '../input-resolution.js';
import { createTranslator } from '../i18n/index.js';
import {
  CHARA_CANARY_PATTERN,
  DUSKWIGHT_HETEROCHROMIA,
  charaBytes,
  charaBytesWithInvalidUtf8,
  charaFixtureObject,
  charaTextOfBytes,
  withCharaCanaries,
} from './__fixtures__/chara-fixtures.js';

vi.mock('@xivdyetools/svg', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xivdyetools/svg')>();
  return {
    ...actual,
    generateSwatchCard: vi.fn(actual.generateSwatchCard),
    generateNearestSheet: vi.fn(actual.generateNearestSheet),
  };
});
vi.mock('@xivdyetools/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xivdyetools/core')>();
  return {
    ...actual,
    inspectCharaForTools: vi.fn(actual.inspectCharaForTools),
    resolveCharaForTools: vi.fn(actual.resolveCharaForTools),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

const en = createTranslator('en');
const UNREADABLE_EN = 'Could not read the file — it is not a .chara file the bot can read';

type Doc = Record<string, unknown>;

const run = (doc: Doc | string, over: Partial<SwatchInput> = {}) =>
  executeSwatch({
    fileText: typeof doc === 'string' ? doc : JSON.stringify(doc),
    locale: 'en',
    ...over,
  });

type CardInput = Parameters<typeof generateSwatchCard>[0];
const lastCard = (): CardInput => {
  const call = vi.mocked(generateSwatchCard).mock.calls.at(-1);
  if (!call) throw new Error('generateSwatchCard was not called');
  return call[0];
};
const lastSheet = (): Parameters<typeof generateNearestSheet>[0] => {
  const call = vi.mocked(generateNearestSheet).mock.calls.at(-1);
  if (!call) throw new Error('generateNearestSheet was not called');
  return call[0];
};
const rowLabels = (): string[] => lastCard().rows.map((r) => r.slotLabel);

const DUSK = charaFixtureObject(DUSKWIGHT_HETEROCHROMIA);
const MIDLANDER = { Tribe: 'Midlander', Gender: 'Feminine' };

/** Hair index 10 on a Midlander woman's sheet — `#FFE7A1` (R2·C3). */
const HAIR_ONLY: Doc = { ...MIDLANDER, HairTone: 10 };

// ============================================================================
// 1. Colour states
// ============================================================================

describe('confirmed-active slots: exact rows and the exact closest dye', () => {
  it('a palette hair index is its sheet colour, matched to the nearest dye by ΔE2000', async () => {
    const sheet = await new CharacterColorService().getHairColors('Midlander', 'Female');
    expect(sheet[10].hex.toUpperCase()).toBe('#FFE7A1');

    const result = await run(HAIR_ONLY);
    if (!result.ok) throw new Error(result.errorMessage);
    const rows = lastCard().rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      slotLabel: en.t('card.slotHair'),
      addr: 'R2·C3',
      sourceHex: '#FFE7A1',
      name: 'Vanilla Yellow',
    });
    expect(rows[0].deltaE).toBeGreaterThan(4.0);
    expect(rows[0].deltaE).toBeLessThan(4.3);
  });

  it('shared eye index 42 is one EYES·LR row at #DCBA6C, nearest Metallic Brass', async () => {
    expect(new CharacterColorService().getEyeColors()[42].hex.toUpperCase()).toBe('#DCBA6C');
    const result = await run({ LEyeColor: 42, REyeColor: 42 });
    if (!result.ok) throw new Error(result.errorMessage);
    const rows = lastCard().rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ slotLabel: 'EYES·LR', sourceHex: '#DCBA6C', name: 'Metallic Brass' });
    expect(rows[0].deltaE).toBeGreaterThan(2.5);
    expect(rows[0].deltaE).toBeLessThan(2.8);
  });
});

describe('unknown activation (active === null) gives no row and no export', () => {
  /** Missing EnableHighlights, missing FacePaint and a lip index without Mouth. */
  const UNKNOWN_BESIDE_HAIR: Doc = {
    ...HAIR_ONLY,
    Highlights: 5,
    FacePaintColor: 5,
    LipsToneFurPattern: 5,
  };

  it('a confirmed-active hair row survives beside three unknown-activity slots', async () => {
    const result = await run(UNKNOWN_BESIDE_HAIR);
    if (!result.ok) throw new Error(result.errorMessage);
    expect(rowLabels()).toEqual([en.t('card.slotHair')]);
    // the strip is the matched colours only — no preview colour sneaks in
    expect(lastCard().stripHexes).toEqual(['#FFE7A1']);
    expect(lastCard().labels.footKey).toBe('nearest by ΔE2000 · 1 of 1 slot');
    // fixed localized text only: no library reason code reaches the embed
    expect(result.embed.description).not.toMatch(/activityUnknown|ambiguousZeroBlock|ACTIVITY_UNKNOWN/);
  });

  it('the card’s embed carries the fixed activity-unknown line, and only when such a colour exists (added with the implementation)', async () => {
    const withUnknown = await run(UNKNOWN_BESIDE_HAIR, { locale: 'de' });
    if (!withUnknown.ok) throw new Error(withUnknown.errorMessage);
    expect(withUnknown.embed.description).toContain(createTranslator('de').t('card.swatchActivityUnknown'));

    const without = await run(HAIR_ONLY);
    if (!without.ok) throw new Error(without.errorMessage);
    expect(without.embed.description).not.toContain(en.t('card.swatchActivityUnknown'));
  });

  it('slot: highlights is missing when its activation is unknown', async () => {
    const result = await run(UNKNOWN_BESIDE_HAIR, { slot: 'highlights' });
    expect(result).toMatchObject({ ok: false, error: 'SLOT_MISSING' });
    expect(generateNearestSheet).not.toHaveBeenCalled();
  });

  it('slot: lip is missing for a lip index without Mouth, even with a live composite', async () => {
    const result = await run({ ...DUSK, Mouth: null }, { slot: 'lip' });
    expect(result).toMatchObject({ ok: false, error: 'SLOT_MISSING' });
  });

  it('a lip index without Mouth draws no LIP row and no lip line, whatever the composite', async () => {
    const result = await run({ ...DUSK, Mouth: null });
    if (!result.ok) throw new Error(result.errorMessage);
    expect(rowLabels()).not.toContain(en.t('card.slotLip'));
    expect(result.embed.description).not.toContain('Lip α');
  });

  describe('a file whose only colours are of unknown activity is NO_LIVE_SLOTS, explained', () => {
    const noSlots = (locale: 'en' | 'de') => createTranslator(locale).t('card.swatchNoSlots');
    const explanation = (message: string, locale: 'en' | 'de'): string =>
      message.replace(noSlots(locale), '').trim();

    it.each([
      ['the plan tuple: Highlights and FacePaintColor with no controls', { Highlights: 0, FacePaintColor: 0 }],
      ['the plan tuple: a Wildwood lip index without Mouth', { Tribe: 'Wildwood', LipsToneFurPattern: 53 }],
      ['all three unknown controls on a Midlander', { ...MIDLANDER, Highlights: 5, FacePaintColor: 5, LipsToneFurPattern: 5 }],
    ])('%s', async (_label, doc) => {
      const result = await run(doc);
      expect(result).toMatchObject({ ok: false, error: 'NO_LIVE_SLOTS' });
      if (result.ok) return;
      expect(result.errorMessage).toContain(noSlots('en'));
      // …followed by a localized explanation of why nothing matched
      expect(explanation(result.errorMessage, 'en').length).toBeGreaterThan(0);
      expect(result.errorMessage).not.toMatch(/activityUnknown|undefined|card\./);
    });

    it('explains it in the reader’s language', async () => {
      const doc = { ...MIDLANDER, Highlights: 5, FacePaintColor: 5, LipsToneFurPattern: 5 };
      const enResult = await run(doc);
      const deResult = await run(doc, { locale: 'de' });
      if (enResult.ok || deResult.ok) throw new Error('expected NO_LIVE_SLOTS');
      expect(deResult.error).toBe('NO_LIVE_SLOTS');
      expect(deResult.errorMessage).toContain(noSlots('de'));
      const deExplanation = explanation(deResult.errorMessage, 'de');
      expect(deExplanation.length).toBeGreaterThan(0);
      expect(deExplanation).not.toBe(explanation(enResult.errorMessage, 'en'));
    });

    it('keys the explanation on active === null, not on the reason: an all-zero block explains the same way', async () => {
      // EnableHighlights is missing, so activation is unknown, but the library's
      // reason is ambiguousZeroBlock (the seven-float block is all zero)
      const zeroBlock = {
        ...MIDLANDER,
        IsExtendedAppearanceValid: true,
        Highlights: 5,
        SkinColor: '0, 0, 0',
        LeftEyeColor: '0, 0, 0',
        RightEyeColor: '0, 0, 0',
        LimbalRingColor: '0, 0, 0',
        HairColor: '0, 0, 0',
        HairHighlight: '0, 0, 0',
        MouthColor: '0, 0, 0, 0',
      };
      const unknownOnly = await run({ ...MIDLANDER, Highlights: 5 });
      const zero = await run(zeroBlock);
      if (unknownOnly.ok || zero.ok) throw new Error('expected NO_LIVE_SLOTS');
      expect(zero.error).toBe('NO_LIVE_SLOTS');
      expect(zero.errorMessage).toBe(unknownOnly.errorMessage);
      expect(zero.errorMessage).not.toBe(noSlots('en'));
    });

    it('explicitly disabled controls are not unknown: the bare sentence, no explanation', async () => {
      const result = await run({
        ...MIDLANDER,
        EnableHighlights: false,
        Highlights: 5,
        FacePaint: 128,
        FacePaintColor: 5,
        Mouth: 2,
        LipsToneFurPattern: 5,
      });
      expect(result).toEqual({ ok: false, error: 'NO_LIVE_SLOTS', errorMessage: noSlots('en') });
    });
  });
});

describe('explicitly disabled controls are inactive: no row', () => {
  it('EnableHighlights false, FacePaint 0 and a clear Mouth lip bit give no row beside the hair', async () => {
    const result = await run({
      ...HAIR_ONLY,
      EnableHighlights: false,
      Highlights: 5,
      FacePaint: 0,
      FacePaintColor: 5,
      Mouth: 2,
      LipsToneFurPattern: 5,
    });
    if (!result.ok) throw new Error(result.errorMessage);
    expect(rowLabels()).toEqual([en.t('card.slotHair')]);
    expect(lastCard().stripHexes).toEqual(['#FFE7A1']);
    expect(result.embed.description).not.toContain('Lip α');
  });

  it.each([
    [0, false],
    [128, false],
    [129, true],
  ])('FacePaint %i → face-paint row %s', async (facePaint, drawn) => {
    const result = await run({ ...HAIR_ONLY, FacePaint: facePaint, FacePaintColor: 5 });
    if (!result.ok) throw new Error(result.errorMessage);
    expect(rowLabels().includes(en.t('card.slotPaint'))).toBe(drawn);
  });

  it('the Duskwight export stores Mouth 2: no LIP row, so six live slots, five drawn', async () => {
    const result = await run(DUSK);
    if (!result.ok) throw new Error(result.errorMessage);
    expect(rowLabels()).not.toContain(en.t('card.slotLip'));
    expect(lastCard().labels.footKey).toBe('nearest by ΔE2000 · 5 of 6 slots');
    expect(result.embed.description).not.toContain('Lip α');
  });
});

describe('the library lip-composite rule', () => {
  it('a live lip matches its composite and names raw and blend', async () => {
    const result = await run({ ...DUSK, Mouth: 130 });
    if (!result.ok) throw new Error(result.errorMessage);
    const lip = lastCard().rows.find((r) => r.slotLabel === en.t('card.slotLip'));
    // the kept five drop the two safest; ask the strip instead, which keeps every row
    expect(lastCard().stripHexes).toContain('#AE8F98');
    if (lip) expect(lip.sourceHex).toBe('#AE8F98');
    expect(result.embed.description).toContain('Lip α 0.60 — raw #621C33, blended #AE8F98');
  });

  it('no blend without live extended data: the lip matches its palette colour and the lip line is gone', async () => {
    const result = await run({ ...DUSK, Mouth: 130, IsExtendedAppearanceValid: false });
    if (!result.ok) throw new Error(result.errorMessage);
    expect(lastCard().stripHexes).toContain('#621C33');
    expect(lastCard().stripHexes).not.toContain('#B69A91');
    expect(result.embed.description).not.toContain('Lip α');
    const target = await run({ ...DUSK, Mouth: 130, IsExtendedAppearanceValid: false }, { slot: 'lip' });
    if (!target.ok) throw new Error(target.errorMessage);
    expect(lastSheet().targetHex).toBe('#621C33');
  });

  it('slot: lip targets the composite of a live lip', async () => {
    const result = await run({ ...DUSK, Mouth: 130 }, { slot: 'lip' });
    if (!result.ok) throw new Error(result.errorMessage);
    expect(lastSheet().targetHex).toBe('#AE8F98');
    expect(result.embed.description).toContain('LIP `#AE8F98`');
  });
});

// EXT-28: squared sRGB channels recreate the two live extended colours.
const SHARED_INDEX_DIFFERENT_COLOURS = {
  IsExtendedAppearanceValid: true, LEyeColor: 42, REyeColor: 42,
  LeftEyeColor: `${(135 / 255) ** 2}, ${(192 / 255) ** 2}, ${(163 / 255) ** 2}`,
  RightEyeColor: `${(220 / 255) ** 2}, ${(186 / 255) ** 2}, ${(108 / 255) ** 2}`,
};

describe('winning eye colours (BUG-002)', () => {
  it('keeps EXT-28 as distinct L/R rows with independent nearest-dye distances', async () => {
    const result = await run(SHARED_INDEX_DIFFERENT_COLOURS);
    if (!result.ok) throw new Error(result.errorMessage);
    expect(lastCard().stripHexes).toEqual(['#87C0A3', '#DCBA6C']);
    expect(rowLabels()).toEqual(['EYES·L', 'EYES·R']);
    expect(lastCard().rows).toHaveLength(2);
    for (const [i, hex] of ['#87C0A3', '#DCBA6C'].entries()) {
      const nearest = dyeService.getAllDyes().map((dye) => ({ dye,
        distance: ColorService.getDistanceForMethod(hex, dye.hex, 'ciede2000'),
      })).sort((a, b) => a.distance - b.distance)[0];
      expect(lastCard().rows[i]).toMatchObject({ sourceHex: hex, dyeHex: nearest.dye.hex, name: nearest.dye.name });
      expect(lastCard().rows[i].deltaE).toBeCloseTo(nearest.distance, 10);
    }
    expect(result.embed.description).not.toContain('EYES·LR');
  });

  it('slot:eyes keeps left preference and five matches for EXT-28', async () => {
    const result = await run(SHARED_INDEX_DIFFERENT_COLOURS, { slot: 'eyes' });
    if (!result.ok) throw new Error(result.errorMessage);
    expect(lastSheet()).toMatchObject({ targetHex: '#87C0A3', targetText: 'EYES·L #87C0A3' });
    expect(lastSheet().rows).toHaveLength(5);
    expect(result.embed.description).toContain('EYES·L `#87C0A3`');
  });

  it('merges equal live colours even when their stored indices differ', async () => {
    const result = await run({ IsExtendedAppearanceValid: true, LEyeColor: 42, REyeColor: 169,
      LeftEyeColor: '0, 0, 1', RightEyeColor: '0, 0, 1' });
    if (!result.ok) throw new Error(result.errorMessage);
    expect(rowLabels()).toEqual(['EYES·LR']);
    expect(lastCard().stripHexes).toEqual(['#0000FF']);
  });
});

describe('the eye-pair correction', () => {
  /**
   * Eye index 10 (#F0EACB) and 20 (#B7A981): the left float stores the RIGHT
   * eye's palette colour, the right float a custom blue. The library swaps
   * this one-sided crossing (EYE_PAIRING_INFERRED); the legacy resolver did
   * not, and matched the wrong eye against each colour.
   */
  const ONE_SIDED = {
    IsExtendedAppearanceValid: true,
    LEyeColor: 10,
    REyeColor: 20,
    LeftEyeColor: '0.515017, 0.439231, 0.255917',
    RightEyeColor: '0, 0, 1',
  };

  it('pins the palette colours the case is built from', () => {
    const eyes = new CharacterColorService().getEyeColors();
    expect(eyes[10].hex.toUpperCase()).toBe('#F0EACB');
    expect(eyes[20].hex.toUpperCase()).toBe('#B7A981');
  });

  it('draws the corrected colours: left off grid in blue, right on its own grid cell', async () => {
    const result = await run(ONE_SIDED);
    if (!result.ok) throw new Error(result.errorMessage);
    const rows = lastCard().rows;
    expect(rows.find((r) => r.slotLabel === 'EYES·L')).toMatchObject({ sourceHex: '#0000FF', addr: 'OFF GRID' });
    expect(rows.find((r) => r.slotLabel === 'EYES·R')).toMatchObject({ sourceHex: '#B7A981', addr: 'R3·C5' });
    expect(result.embed.description).toContain('EYES·L off grid — index #F0EACB, live #0000FF');
    expect(result.embed.description).not.toContain('EYES·R off grid');

  });

  it.each([undefined, 'eyes'] as const)('a shared index whose left eye has no matchHex draws and selects only EYES·R (slot:%s)', async (slot) => {
    // The bundled palettes never leave one of two same-index eyes unmatched, so
    // the projection is patched: display colours cannot qualify the left eye
    // for merging when its matching colour is missing.
    const actual = await vi.importActual<typeof import('@xivdyetools/core')>('@xivdyetools/core');
    vi.mocked(resolveCharaForTools).mockImplementationOnce(async (...args) => {
      const character = await actual.resolveCharaForTools(...args);
      expect(character.eyesShareIndex).toBe(true);
      return {
        ...character,
        slots: character.slots.map((s) =>
          s.slot === 'leftEye'
            ? { ...s, interpretation: 'unresolved' as const, reason: 'missingShaderReference' as const, matchHex: null }
            : s
        ),
      };
    });
    const result = await run({ ...HAIR_ONLY, LEyeColor: 42, REyeColor: 42 }, { slot });
    if (!result.ok) throw new Error(result.errorMessage);
    if (slot) {
      expect(lastSheet()).toMatchObject({ targetHex: '#DCBA6C', targetText: 'EYES·R #DCBA6C' });
      expect(lastSheet().rows).toHaveLength(5);
      expect(result.embed.description).toContain('EYES·R `#DCBA6C`');
    } else {
      const eyes = lastCard().rows.filter((r) => r.slotLabel.startsWith('EYES'));
      expect(eyes).toHaveLength(1);
      expect(eyes[0]).toMatchObject({ slotLabel: 'EYES·R', sourceHex: '#DCBA6C' });
    }
  });

  it('the Duskwight export’s exact crossing shows each eye’s own colour', async () => {
    const result = await run(DUSK);
    if (!result.ok) throw new Error(result.errorMessage);
    expect(lastCard().rows.find((r) => r.slotLabel === 'EYES·L')?.sourceHex).toBe('#87C0A3');
    expect(lastCard().rows.find((r) => r.slotLabel === 'EYES·R')?.sourceHex).toBe('#DCBA6C');
    expect(lastCard().stripHexes.slice(0, 2)).toEqual(['#87C0A3', '#DCBA6C']);
  });
});

describe('unresolved slots give no row and no crash', () => {
  it('hair and skin without a tribe and gender are errors, the eyes still match', async () => {
    const result = await run({ HairTone: 10, Skintone: 3, LEyeColor: 42, REyeColor: 42 });
    if (!result.ok) throw new Error(result.errorMessage);
    expect(rowLabels()).toEqual(['EYES·LR']);
    expect(lastCard().stripHexes).toEqual(['#DCBA6C']);
  });

  it('a lip index in the unused 96-127 gap is no row', async () => {
    const result = await run({ ...HAIR_ONLY, LipsToneFurPattern: 100, Mouth: 130 });
    if (!result.ok) throw new Error(result.errorMessage);
    expect(rowLabels()).toEqual([en.t('card.slotHair')]);
    expect(lastCard().stripHexes).toEqual(['#FFE7A1']);
  });

  it('a malformed colour beside valid ones no longer refuses the whole file', async () => {
    const result = await run({ ...HAIR_ONLY, LeftEyeColor: 'Infinity' });
    if (!result.ok) throw new Error(result.errorMessage);
    expect(rowLabels()).toEqual([en.t('card.slotHair')]);
  });
});

describe('colour data the file holds but that cannot be used: one fixed localized line', () => {
  const UNUSABLE = (locale: 'en' | 'de' = 'en'): string => createTranslator(locale).t('card.swatchUnusable');
  const EYES = { LEyeColor: 42, REyeColor: 42 };

  it('the line is a real, fixed sentence in every locale, not the key', () => {
    for (const locale of ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const) {
      const line = createTranslator(locale).t('card.swatchUnusable');
      expect(line).not.toMatch(/card\.|\{/);
      expect(line.length).toBeGreaterThan(10);
    }
    expect(UNUSABLE('de')).not.toBe(UNUSABLE('en'));
  });

  it.each([
    ['an invalid (fractional) eye index → invalidIndex', { ...HAIR_ONLY, LEyeColor: 1.5 }],
    ['an eye index past its sheet → indexOutOfRange', { ...HAIR_ONLY, LEyeColor: 250, REyeColor: 250 }],
    ['a lip index in the 96-127 gap → indexOutOfRange', { ...HAIR_ONLY, LipsToneFurPattern: 100, Mouth: 130 }],
    ['a malformed eye colour with no index → missingColor + INVALID_FIELD', { ...HAIR_ONLY, IsExtendedAppearanceValid: true, LeftEyeColor: 'Infinity' }],
    ['a skin index with no Tribe or Gender → missingTribeGender', { ...EYES, Skintone: 3 }],
    ['a hair index with an unsupported "Male" Gender → missingTribeGender', { ...EYES, Tribe: 'Midlander', Gender: 'Male', HairTone: 10 }],
    ['a hair index with an unknown Tribe → missingTribeGender', { ...EYES, Tribe: 'Firstname', Gender: 'Feminine', HairTone: 10 }],
    ['a live lip index with no race → missingRace', { ...EYES, LipsToneFurPattern: 5, Mouth: 130 }],
  ])('%s: the success embed carries the line, once', async (_label, doc) => {
    const result = await run(doc as Doc);
    if (!result.ok) throw new Error(result.errorMessage);
    const description = result.embed.description ?? '';
    expect(description).toContain(UNUSABLE());
    expect(description.split(UNUSABLE()).length - 1).toBe(1);
    // fixed text only: no reason or issue code, and no stored value
    expect(description).not.toMatch(/invalidIndex|indexOutOfRange|missing[A-Z]|INVALID_FIELD|Infinity|Firstname|250|100/);
  });

  it.each([
    ['slots the file simply leaves empty (missingColor)', HAIR_ONLY],
    ['an explicitly disabled highlight (highlightsDisabled)', { ...HAIR_ONLY, EnableHighlights: false, Highlights: 5 }],
    ['an explicitly disabled face paint (facePaintNone)', { ...HAIR_ONLY, FacePaint: 0, FacePaintColor: 5 }],
    ['a lip with the colour bit clear (lipDisabled)', { ...HAIR_ONLY, Mouth: 2, LipsToneFurPattern: 5 }],
    ['a live lip of opacity zero (noLip)', { ...DUSK, Mouth: 130, MouthColor: '0.04, 0.0015, 0.012, 0' }],
    ['a Hrothgar fur pattern (furPattern)', { ...EYES, Tribe: 'Helions', Gender: 'Feminine', LipsToneFurPattern: 35 }],
    ['colours of unknown activity (activityUnknown)', { ...HAIR_ONLY, Highlights: 5, FacePaintColor: 5, LipsToneFurPattern: 5 }],
    ['a malformed colour on a slot whose index still matched', { ...HAIR_ONLY, HairColor: 'Infinity' }],
    ['the committed Duskwight export', DUSK],
  ])('%s: no line', async (_label, doc) => {
    const result = await run(doc as Doc);
    if (!result.ok) throw new Error(result.errorMessage);
    expect(result.embed.description).not.toContain(UNUSABLE());
  });

  it('says it in the reader’s language', async () => {
    const result = await run({ ...HAIR_ONLY, LEyeColor: 250, REyeColor: 250 }, { locale: 'de' });
    if (!result.ok) throw new Error(result.errorMessage);
    expect(result.embed.description).toContain(UNUSABLE('de'));
    expect(result.embed.description).not.toContain(UNUSABLE('en'));
  });

  describe('NO_LIVE_SLOTS appends it to the explanation', () => {
    const noSlots = en.t('card.swatchNoSlots');

    it('a file whose only colour cannot be used', async () => {
      const result = await run({ LEyeColor: 250, REyeColor: 250 });
      expect(result).toEqual({ ok: false, error: 'NO_LIVE_SLOTS', errorMessage: `${noSlots}\n${UNUSABLE()}` });
    });

    it('beside the activity-unknown sentence, which comes first', async () => {
      const result = await run({ ...MIDLANDER, Highlights: 5, Skintone: 250 });
      expect(result).toEqual({
        ok: false,
        error: 'NO_LIVE_SLOTS',
        errorMessage: `${noSlots}\n${en.t('card.swatchActivityUnknown')}\n${UNUSABLE()}`,
      });
    });

    it('not for an empty or disabled-only file', async () => {
      const result = await run({ ...MIDLANDER, EnableHighlights: false, Highlights: 5 });
      expect(result).toEqual({ ok: false, error: 'NO_LIVE_SLOTS', errorMessage: noSlots });
    });
  });

  /**
   * The whole reason vocabulary, through a projection whose left eye is set to
   * each unresolved reason: pins the trigger set itself, including reasons the
   * bundled palettes never produce (missingPaletteEntry, missingShaderReference).
   */
  describe('the trigger set over the library’s reason vocabulary', () => {
    const withLeftEye = async (patch: Record<string, unknown>) => {
      const actual = await vi.importActual<typeof import('@xivdyetools/core')>('@xivdyetools/core');
      vi.mocked(resolveCharaForTools).mockImplementationOnce(async (...args) => {
        const character = await actual.resolveCharaForTools(...args);
        return {
          ...character,
          slots: character.slots.map((s) =>
            s.slot === 'leftEye'
              ? { ...s, matchHex: null, displayHex: null, lipComposite: null, ...patch }
              : s
          ),
        };
      });
      const result = await run(HAIR_ONLY);
      if (!result.ok) throw new Error(result.errorMessage);
      return result.embed.description ?? '';
    };

    it.each([
      'invalidIndex',
      'indexOutOfRange',
      'missingTribeGender',
      'missingRace',
      'missingPaletteEntry',
      'missingShaderReference',
    ])('unresolved for %s → the line', async (reason) => {
      expect(await withLeftEye({ interpretation: 'unresolved', active: true, reason })).toContain(UNUSABLE());
    });

    it.each([
      ['unresolved', 'missingColor'],
      ['inactive', 'highlightsDisabled'],
      ['inactive', 'facePaintNone'],
      ['inactive', 'lipDisabled'],
      ['inactive', 'noLip'],
      ['inactive', 'furPattern'],
      // an inactive slot is never "unusable", whatever its index said before activation
      ['inactive', 'invalidIndex'],
    ])('%s for %s → no line', async (interpretation, reason) => {
      expect(await withLeftEye({ interpretation, active: interpretation === 'inactive' ? false : true, reason })).not.toContain(UNUSABLE());
    });
  });
});

// ============================================================================
// 3. Presentation behavior retained after the legacy character payload removal
// ============================================================================

describe('presentation without a character payload', () => {
  it('lists distinct worn gear dyes once each in the embed', async () => {
    const result = await run(DUSK);
    if (!result.ok) throw new Error(result.errorMessage);
    expect(result.embed.description).toContain('Gunmetal Black · Snow White · Bright Orange');
    for (const name of ['Gunmetal Black', 'Snow White', 'Bright Orange']) {
      expect(result.embed.description?.split(name)).toHaveLength(2);
    }
  });

  it('a stored float that is not live keeps the palette colour', async () => {
    const result = await run({ ...HAIR_ONLY, HairColor: '1, 0, 0' });
    if (!result.ok) throw new Error(result.errorMessage);
    expect(rowLabels()).toEqual(['HAIR']);
    expect(lastCard().rows[0].sourceHex).toBe('#FFE7A1');
    expect(lastCard().stripHexes).toEqual(['#FFE7A1']);
    expect(result.embed.description).not.toContain('#FF0000');
  });

  it('labels a race-unknown limbal slot as a tattoo row', async () => {
    const result = await run({ LimbalEyes: 30 });
    if (!result.ok) throw new Error(result.errorMessage);
    expect(rowLabels()).toEqual(['TATT.']);
    expect(lastCard().rows[0].sourceHex).toBe('#746040');
  });
});
// ============================================================================
// 4. Byte input
// ============================================================================

describe('byte input', () => {
  const warnings = () => {
    const warn = vi.fn();
    const error = vi.fn();
    const lines = (): string[] => [...warn.mock.calls, ...error.mock.calls].flat().map(String);
    return { logger: { warn, error }, lines };
  };

  it('reads fileBytes through the facade and prefers them over fileText', async () => {
    const bytes = charaBytes(HAIR_ONLY);
    const result = await executeSwatch({
      // the text alone has no live slot
      fileText: JSON.stringify({ EnableHighlights: false, Highlights: 36 }),
      fileBytes: bytes,
      locale: 'en',
    } as SwatchInput);
    if (!result.ok) throw new Error(result.errorMessage);
    expect(rowLabels()).toEqual([en.t('card.slotHair')]);
    expect(inspectCharaForTools).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(inspectCharaForTools).mock.calls[0][0];
    expect(arg).toBeInstanceOf(Uint8Array);
    expect(Array.from(arg as Uint8Array)).toEqual(Array.from(bytes));
  });

  it('accepts fileBytes with no fileText', async () => {
    const result = await executeSwatch({ fileBytes: charaBytes(HAIR_ONLY), locale: 'en' } as SwatchInput);
    expect(result.ok).toBe(true);
  });

  it('refuses invalid UTF-8 as INVALID_UTF8, in the reader’s language, instead of re-encoding it', async () => {
    const { logger, lines } = warnings();
    const result = await executeSwatch({
      fileText: JSON.stringify(HAIR_ONLY),
      fileBytes: charaBytesWithInvalidUtf8(HAIR_ONLY),
      locale: 'de',
      logger,
    } as SwatchInput);
    const de = createTranslator('de');
    expect(result).toEqual({
      ok: false,
      error: 'PARSE_FAILED',
      errorMessage: de.t('card.swatchParseError', { message: de.t('card.charaFileReason.unreadable') }),
    });
    expect(lines()).toContainEqual(expect.stringMatching(/^\[swatch\] parse failed: \S+ INVALID_UTF8$/));
  });

  it('refuses bytes over 8,192 as INPUT_TOO_LARGE', async () => {
    const { logger, lines } = warnings();
    const result = await executeSwatch({
      fileBytes: charaBytes(charaTextOfBytes(HAIR_ONLY, 8_193)),
      locale: 'en',
      logger,
    } as SwatchInput);
    expect(result).toEqual({ ok: false, error: 'PARSE_FAILED', errorMessage: UNREADABLE_EN });
    expect(lines()).toContainEqual(expect.stringMatching(/^\[swatch\] parse failed: \S+ INPUT_TOO_LARGE$/));
  });

  it('accepts exactly 8,192 bytes', async () => {
    const bytes = charaBytes(charaTextOfBytes(HAIR_ONLY, 8_192));
    expect(bytes.byteLength).toBe(8_192);
    const result = await executeSwatch({ fileBytes: bytes, locale: 'en' } as SwatchInput);
    expect(result.ok).toBe(true);
  });

  it('measures fileText in UTF-8 bytes against the same cap', async () => {
    const { logger, lines } = warnings();
    const result = await run(charaTextOfBytes(HAIR_ONLY, 8_193), { logger });
    expect(result).toMatchObject({ ok: false, error: 'PARSE_FAILED' });
    expect(lines()).toContainEqual(expect.stringMatching(/INPUT_TOO_LARGE$/));
    expect((await run(charaTextOfBytes(HAIR_ONLY, 8_192))).ok).toBe(true);
  });

  it('refuses an input with neither fileText nor fileBytes as PARSE_FAILED', async () => {
    const result = await executeSwatch({ locale: 'en' } as SwatchInput);
    expect(result).toEqual({ ok: false, error: 'PARSE_FAILED', errorMessage: UNREADABLE_EN });
  });

  it('still reads fileText alone', async () => {
    const result = await run(HAIR_ONLY);
    expect(result.ok).toBe(true);
  });
});

// ============================================================================
// 5. Privacy canaries
// ============================================================================

describe('privacy canaries', () => {
  const capture = () => {
    const warn = vi.fn();
    const error = vi.fn();
    return {
      logger: { warn, error },
      logged: (): string => JSON.stringify([...warn.mock.calls, ...error.mock.calls]),
    };
  };
  /** Every string handed to the SVG generators. */
  const generatorInputs = (): string =>
    JSON.stringify([...vi.mocked(generateSwatchCard).mock.calls, ...vi.mocked(generateNearestSheet).mock.calls]);

  const CANARY_DOC = withCharaCanaries({
    ...HAIR_ONLY,
    LEyeColor: 42,
    REyeColor: 42,
    TypeName: 'CANARY_PRODUCER Firstname Lastname',
  });

  it('the canary document really carries every canary', () => {
    const text = JSON.stringify(CANARY_DOC);
    for (const c of ['CANARY_PRODUCER', 'CANARY_NICK', 'CANARY_AUTHOR', 'CANARY_DESC', 'CANARY_UNKNOWN', 'CANARY_TAG', 'CANARY_LANE', 'CANARY_GLASSES']) {
      expect(text).toContain(c);
    }
  });

  it.each([undefined, 'hair'] as const)('success has exactly the presentation keys (slot:%s)', async (slot) => {
    const result = await run(CANARY_DOC, { slot });
    if (!result.ok) throw new Error(result.errorMessage);
    expect(Object.keys(result).sort()).toEqual(['embed', 'ok', 'svgString']);
  });
  it.each([
    ['the card', {}],
    ['the slot: route', { slot: 'hair' as const }],
    ['the hardest order', { order: 'hardest' as const }],
  ])('none reaches %s, the full result, the generators or the logs', async (_label, over) => {
    const { logger, logged } = capture();
    const result = await run(CANARY_DOC, { ...over, logger });
    if (!result.ok) throw new Error(result.errorMessage);
    expect(JSON.stringify(result)).not.toMatch(CHARA_CANARY_PATTERN);
    expect(generatorInputs()).not.toMatch(CHARA_CANARY_PATTERN);
    expect(logged()).not.toMatch(CHARA_CANARY_PATTERN);
    expect(result.embed.title).toBe('Character swatch');
  });

  it('a canary in a malformed field never reaches the reply or the logs', async () => {
    const { logger, logged } = capture();
    const result = await run({ ...CANARY_DOC, LeftEyeColor: 'CANARY_MALFORMED', Tribe: 'CANARY_TRIBE' }, { logger });
    expect(JSON.stringify(result)).not.toMatch(CHARA_CANARY_PATTERN);
    expect(generatorInputs()).not.toMatch(CHARA_CANARY_PATTERN);
    expect(logged()).not.toMatch(CHARA_CANARY_PATTERN);
  });

  it('a structural refusal (a duplicate key) is PARSE_FAILED by code, never quoting the file', async () => {
    const { logger, logged } = capture();
    const text = '{"HairTone":10,"Tribe":"Midlander","Gender":"Feminine","CANARY_DUP":1,"CANARY_DUP":2}';
    const result = await run(text, { logger });
    expect(result).toEqual({ ok: false, error: 'PARSE_FAILED', errorMessage: UNREADABLE_EN });
    expect(logged()).toMatch(/\[swatch\] parse failed: \S+ DUPLICATE_KEY/);
    expect(logged()).not.toMatch(CHARA_CANARY_PATTERN);
  });

  it('a forced error inside the read quoting a canary is logged by class only', async () => {
    vi.mocked(resolveCharaForTools).mockImplementationOnce(() => {
      throw new TypeError('CANARY_THROWN Firstname Lastname');
    });
    const { logger, logged } = capture();
    const result = await run(CANARY_DOC, { logger });
    expect(result).toEqual({ ok: false, error: 'PARSE_FAILED', errorMessage: UNREADABLE_EN });
    expect(logged()).toContain('[swatch] parse failed: TypeError');
    expect(logged()).not.toMatch(CHARA_CANARY_PATTERN);
  });
});
