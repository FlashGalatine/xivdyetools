/**
 * /glamour on the library-backed import (xivcharakit integration, Task 6).
 *
 * Gear models and dyes come from core's projection (`inspectCharaForTools` →
 * `resolveCharaForTools`): only complete uint16 models leave for the resolver,
 * each copied to exactly `{ slot, base, variant, set? }`, with the validated
 * facewear id; zero, missing and invalid dye channels stay distinct; valid
 * gear stays usable whatever the appearance resolves to.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inspectCharaForTools, resolveCharaForTools, type CharaGearModel } from '@xivdyetools/core';
import { generateGlamourCard } from '@xivdyetools/svg';
import { executeGlamour, type GlamourInput, type GlamourResolveAnswer } from './glamour.js';
import { createTranslator } from '../i18n/index.js';
import {
  CHARA_CANARY_PATTERN,
  charaBytes,
  charaBytesWithInvalidUtf8,
  charaTextOfBytes,
  withCharaCanaries,
} from './__fixtures__/chara-fixtures.js';

vi.mock('@xivdyetools/svg', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xivdyetools/svg')>();
  return { ...actual, generateGlamourCard: vi.fn(actual.generateGlamourCard) };
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

type Doc = Record<string, unknown>;

const UNREADABLE_EN = 'Could not read the file — it is not a .chara file the bot can read';
const ALLOWED_MODEL_KEYS = ['base', 'set', 'slot', 'variant'];

const names = (en: string) => ({ en, ja: en, de: en, fr: en });
const item = (itemId: number, name: string) => ({
  itemId,
  names: names(name),
  alternates: [],
  rules: [{ itemIds: [itemId], dyeCount: 2, glamourable: true, wearMask: 0xffff, grandCompany: 0 }],
});
const ANSWER: GlamourResolveAnswer = {
  items: {
    MainHand: item(7001, 'Test Sword'),
    HeadGear: item(7002, 'Test Hat'),
    Body: item(7003, 'Test Coat'),
    Hands: item(7004, 'Test Gloves'),
    Legs: item(7005, 'Test Trousers'),
    Feet: item(7006, 'Test Boots'),
    Ears: item(7007, 'Test Earrings'),
    Wrists: item(7008, 'Test Bracelet'),
  },
  glasses: { names: names('Test Glasses') },
};

const MIDLANDER = { Tribe: 'Midlander', Gender: 'Feminine' };
/**
 * A colour key the legacy parser requires before it reads a file at all, so a
 * test that is not about partial files fails (or passes) for its own reason.
 */
const WITH_HAIR = { ...MIDLANDER, HairTone: 10 };

/**
 * Valid, incomplete and invalid gear side by side (stain 12 Wine Red, 10
 * Dalamud Red; 240 is no stain in the table):
 * - Body: complete, two dyes
 * - Legs: complete, DyeId 0 (undyed) and DyeId2 240 (unknown stain)
 * - Hands: complete, both dye channels invalid (-3, "x")
 * - Wrists: complete, no dye keys at all
 * - HeadGear: fractional base (361.5) — incomplete, never floored
 * - Feet: no ModelVariant — incomplete, never defaulted
 * - Ears: base 70,000 — out of uint16 range
 */
const MIXED_GEAR: Doc = {
  ...MIDLANDER,
  HairTone: 10,
  Body: { ModelBase: 812, ModelVariant: 2, DyeId: 12, DyeId2: 10 },
  Legs: { ModelBase: 777, ModelVariant: 1, DyeId: 0, DyeId2: 240 },
  Hands: { ModelBase: 640, ModelVariant: 1, DyeId: -3, DyeId2: 'x' },
  Wrists: { ModelBase: 7, ModelVariant: 1 },
  HeadGear: { ModelBase: 361.5, ModelVariant: 5, DyeId: 1 },
  Feet: { ModelBase: 99, DyeId: 1 },
  Ears: { ModelBase: 70000, ModelVariant: 1, DyeId: 1 },
  Glasses: { GlassesId: 4 },
};

const input = (doc: Doc | string, over: Partial<GlamourInput> = {}): GlamourInput => ({
  fileText: typeof doc === 'string' ? doc : JSON.stringify(doc),
  locale: 'en',
  resolve: vi.fn(async () => ANSWER),
  ...over,
});

const resolveCall = (i: GlamourInput): [CharaGearModel[], number | null] => {
  const calls = (i.resolve as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls).toHaveLength(1);
  return calls[0] as [CharaGearModel[], number | null];
};

// ============================================================================
// 3. Gear models and dyes from the projection
// ============================================================================

describe('the resolver request', () => {
  it('sends only complete uint16 models, each exactly { slot, base, variant }, and the validated glasses id', async () => {
    const i = input(MIXED_GEAR);
    const result = await executeGlamour(i);
    if (!result.ok) throw new Error(result.errorMessage);
    const [gear, glassesId] = resolveCall(i);

    expect(gear).toEqual([
      { slot: 'Body', base: 812, variant: 2 },
      { slot: 'Hands', base: 640, variant: 1 },
      { slot: 'Legs', base: 777, variant: 1 },
      { slot: 'Wrists', base: 7, variant: 1 },
    ]);
    for (const model of gear) {
      for (const key of Object.keys(model)) expect(ALLOWED_MODEL_KEYS).toContain(key);
    }
    expect(glassesId).toBe(4);
  });

  it('keeps a weapon’s set lane, and nothing else, on the wire', async () => {
    const i = input({
      ...WITH_HAIR,
      MainHand: { ModelSet: 201, ModelBase: 20, ModelVariant: 1, DyeId: 113, Color: '0, 0, 0', Scale: '1, 1, 1' },
    });
    await executeGlamour(i);
    const [gear] = resolveCall(i);
    expect(gear).toEqual([{ slot: 'MainHand', set: 201, base: 20, variant: 1 }]);
    expect(Object.keys(gear[0]).sort()).toEqual(['base', 'set', 'slot', 'variant']);
  });

  it.each([
    ['out of uint16 range', { GlassesId: 70000 }],
    ['fractional', { GlassesId: 1.5 }],
    ['zero', { GlassesId: 0 }],
    ['negative', { GlassesId: -1 }],
  ])('sends no glasses id for a %s GlassesId and lists no Facewear', async (_label, glasses) => {
    const i = input({ ...WITH_HAIR, Body: { ModelBase: 812, ModelVariant: 2, DyeId: 12 }, Glasses: glasses });
    const result = await executeGlamour(i);
    if (!result.ok) throw new Error(result.errorMessage);
    expect(resolveCall(i)[1]).toBeNull();
    expect(result.embed.description).not.toContain('Facewear');
  });

  it('accepts both Glasses shapes', async () => {
    const i = input({ ...WITH_HAIR, Body: { ModelBase: 812, ModelVariant: 2 }, Glasses: 4 });
    await executeGlamour(i);
    expect(resolveCall(i)[1]).toBe(4);
  });

  it.each([
    ['an armour piece', { slot: 'Body', base: 812, variant: 2 }, { slot: 'Body', base: 812, variant: 2 }],
    ['a weapon', { slot: 'MainHand', set: 201, base: 20, variant: 1 }, { slot: 'MainHand', set: 201, base: 20, variant: 1 }],
  ])('copies %s from the projection to exactly its lanes, whatever else the model carries', async (_label, model, wire) => {
    const actual = await vi.importActual<typeof import('@xivdyetools/core')>('@xivdyetools/core');
    vi.mocked(resolveCharaForTools).mockImplementationOnce(async (...args) => {
      const character = await actual.resolveCharaForTools(...args);
      const extra = { ...model, dye1: 12, raw: 'CANARY_RAW', CANARY_KEY: 1 } as unknown as CharaGearModel;
      return { ...character, gearModels: [extra] };
    });
    const i = input(WITH_HAIR);
    const result = await executeGlamour(i);
    if (!result.ok) throw new Error(result.errorMessage);
    const [gear] = resolveCall(i);
    expect(gear).toEqual([wire]);
    expect(Object.keys(gear[0]).sort()).toEqual(Object.keys(wire).sort());
    expect(JSON.stringify(gear)).not.toMatch(CHARA_CANARY_PATTERN);
  });
});

describe('gear and dyes the file holds but that cannot be used', () => {
  const t = (locale: 'en' | 'de' = 'en') => createTranslator(locale);
  const SKIPPED = (locale: 'en' | 'de' = 'en'): string => t(locale).t('card.glamourGearSkipped');
  const DYE_INVALID = (locale: 'en' | 'de' = 'en'): string => t(locale).t('card.glamourDyeInvalid');
  const BODY = { ModelBase: 812, ModelVariant: 2, DyeId: 12 };
  const description = async (doc: Doc, over: Partial<GlamourInput> = {}): Promise<string> => {
    const result = await executeGlamour(input(doc, over));
    if (!result.ok) throw new Error(result.errorMessage);
    return result.embed.description ?? '';
  };

  it('both lines are real, fixed sentences in every locale, not keys', () => {
    for (const locale of ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const) {
      for (const key of ['card.glamourGearSkipped', 'card.glamourDyeInvalid']) {
        const line = createTranslator(locale).t(key);
        expect(line, `${locale} ${key}`).not.toMatch(/card\.|\{/);
        expect(line.length).toBeGreaterThan(10);
      }
    }
  });

  it('the mixed file says both, once each, in the reader’s language', async () => {
    const d = await description(MIXED_GEAR, { locale: 'de' });
    expect(d.split(SKIPPED('de')).length - 1).toBe(1);
    expect(d.split(DYE_INVALID('de')).length - 1).toBe(1);
    expect(d).not.toContain(SKIPPED('en'));
    // fixed text only: no issue code, no slot path, no stored value
    expect(d).not.toMatch(/INCOMPLETE_MODEL|INVALID_FIELD|DyeId|361\.5|70000|-3/);
  });

  describe('a dropped gear model (INCOMPLETE_MODEL, or a slot that is no object)', () => {
    it.each([
      ['a fractional base', { HeadGear: { ModelBase: 361.5, ModelVariant: 5 } }],
      ['a missing variant', { Feet: { ModelBase: 99 } }],
      ['a base past uint16', { Ears: { ModelBase: 70000, ModelVariant: 1 } }],
      ['a null lane', { Legs: { ModelBase: null, ModelVariant: 1 } }],
      ['a weapon with no ModelSet', { MainHand: { ModelBase: 20, ModelVariant: 1 } }],
      ['a slot that is a number, not an object', { Hands: 5 }],
    ])('%s: the gear line, not the dye line', async (_label, gear) => {
      const d = await description({ ...WITH_HAIR, Body: BODY, ...gear });
      expect(d).toContain(SKIPPED());
      expect(d).not.toContain(DYE_INVALID());
      // the valid piece is still listed
      expect(d).toContain('**Body:** Test Coat\nDye 1: Wine Red\n');
    });

    it.each([
      ['every piece complete', { Body: BODY }],
      ['a slot stored as null', { Body: BODY, Hands: null }],
      ['an empty slot (all lanes zero)', { Body: BODY, Hands: { ModelBase: 0, ModelVariant: 0, DyeId: 0 } }],
      ['an empty weapon slot', { Body: BODY, OffHand: { ModelSet: 0, ModelBase: 0, ModelVariant: 0 } }],
    ])('%s: no gear line', async (_label, gear) => {
      expect(await description({ ...WITH_HAIR, ...gear })).not.toContain(SKIPPED());
    });

    it('a file whose only gear was dropped is NO_GEAR, with the gear line after the reason', async () => {
      const i = input({ ...WITH_HAIR, Body: { ModelBase: 1.5, ModelVariant: 1 }, Legs: { ModelBase: 3 } });
      const result = await executeGlamour(i);
      expect(result).toEqual({
        ok: false,
        error: 'NO_GEAR',
        errorMessage: `${t().t('card.glamourNoGear')}\n${SKIPPED()}`,
      });
      expect(i.resolve).not.toHaveBeenCalled();
    });

    it('a file with no gear at all is the bare NO_GEAR sentence', async () => {
      const result = await executeGlamour(input(WITH_HAIR));
      expect(result).toEqual({ ok: false, error: 'NO_GEAR', errorMessage: t().t('card.glamourNoGear') });
    });
  });

  describe('an invalid dye channel on a listed piece does not read as undyed', () => {
    it.each([
      ['a negative', -3],
      ['a string', 'x'],
      ['a fractional', 1.5],
      ['an out-of-uint16', 70000],
      ['a boolean', true],
    ])('%s DyeId: the piece stays, the channel is not listed, and the dye line says so', async (_label, dye) => {
      const d = await description({ ...WITH_HAIR, Body: BODY, Hands: { ModelBase: 640, ModelVariant: 1, DyeId: dye } });
      expect(d).toContain('**Hands:** Test Gloves\nAcquisition:');
      expect(d).toContain(DYE_INVALID());
      expect(d).not.toContain(SKIPPED());
    });

    it('an invalid second channel beside a valid first one says so too', async () => {
      const d = await description({ ...WITH_HAIR, Body: { ...BODY, DyeId2: 'x' } });
      expect(d).toContain('**Body:** Test Coat\nDye 1: Wine Red\n');
      expect(d).toContain(DYE_INVALID());
    });

    it.each([
      ['DyeId 0 (undyed)', { Body: { ...BODY, DyeId: 0 } }],
      ['no dye keys at all', { Body: { ModelBase: 812, ModelVariant: 2 } }],
      ['a null DyeId', { Body: { ...BODY, DyeId: null } }],
      ['a valid stain the table does not know (240)', { Body: { ...BODY, DyeId: 240 } }],
      ['an invalid dye on an empty slot', { Body: BODY, Hands: { ModelBase: 0, ModelVariant: 0, DyeId: -3 } }],
      ['an invalid dye on a dropped (incomplete) piece', { Body: BODY, Feet: { ModelBase: 99, DyeId: 'x' } }],
    ])('%s: no dye line', async (_label, gear) => {
      expect(await description({ ...WITH_HAIR, ...gear })).not.toContain(DYE_INVALID());
    });
  });
});

describe('dye channels', () => {
  it('keeps zero, missing and invalid channels distinct, and an unknown stain nameless without failing', async () => {
    const result = await executeGlamour(input(MIXED_GEAR));
    if (!result.ok) throw new Error(result.errorMessage);
    const d = result.embed.description ?? '';

    expect(d).toContain('**Body:** Test Coat\nDye 1: Wine Red\nDye 2: Dalamud Red\n');
    // DyeId 0 is undyed, DyeId2 240 is a stain the table does not know
    expect(d).toContain('**Legs:** Test Trousers\nDye 2: #240\n');
    expect(d).not.toMatch(/\*\*Legs:\*\* Test Trousers\nDye 1:/);
    // invalid channels are not dyes and not a reason to drop the worn piece
    expect(d).toContain('**Hands:** Test Gloves\nAcquisition:');
    expect(d).not.toContain('#-3');
    // no dye keys at all: worn and undyed
    expect(d).toContain('**Bracelets:** Test Bracelet\nAcquisition:');
    // incomplete and out-of-range models are no pieces at all
    expect(d).not.toContain('Test Hat');
    expect(d).not.toContain('Test Boots');
    expect(d).not.toContain('Test Earrings');
  });

  it('draws only the dyes it can colour on the card', async () => {
    await executeGlamour(input(MIXED_GEAR));
    const card = vi.mocked(generateGlamourCard).mock.calls.at(-1)![0];
    const dyedRows = card.rows.map((r) => [r.slotLabel, r.dyes.map((x) => x.name)]);
    expect(dyedRows).toEqual([
      ['BODY', ['Wine Red', 'Dalamud Red']],
      ['LEGS', []],
    ]);
  });
});

describe('valid gear survives an unresolved appearance', () => {
  it.each([
    ['an equipment-only file', { Body: { ModelBase: 812, ModelVariant: 2, DyeId: 12 } }],
    [
      'a malformed colour and hair/skin with no tribe',
      { HairTone: 10, Skintone: 3, LeftEyeColor: 'Infinity', Body: { ModelBase: 812, ModelVariant: 2, DyeId: 12 } },
    ],
    [
      'appearance of unknown activity only',
      { ...MIDLANDER, Highlights: 5, FacePaintColor: 5, LipsToneFurPattern: 5, Body: { ModelBase: 812, ModelVariant: 2, DyeId: 12 } },
    ],
    ['an unrecognized Tribe', { Tribe: 'Firstname', Body: { ModelBase: 812, ModelVariant: 2, DyeId: 12 } }],
  ])('%s still reads as a glamour', async (_label, doc) => {
    const i = input(doc as Doc);
    const result = await executeGlamour(i);
    if (!result.ok) throw new Error(result.errorMessage);
    expect(resolveCall(i)[0]).toEqual([{ slot: 'Body', base: 812, variant: 2 }]);
    expect(result.embed.description).toContain('**Body:** Test Coat\nDye 1: Wine Red\n');
  });

  it('a file whose gear is all incomplete wears nothing: NO_GEAR, resolver not called', async () => {
    const i = input({ ...MIDLANDER, HairTone: 10, Body: { ModelBase: 1.5, ModelVariant: 1 }, Legs: { ModelBase: 3 } });
    const result = await executeGlamour(i);
    expect(result).toMatchObject({ ok: false, error: 'NO_GEAR' });
    expect(i.resolve).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 4. Byte input
// ============================================================================

describe('byte input', () => {
  const GEAR_DOC: Doc = { ...WITH_HAIR, Body: { ModelBase: 812, ModelVariant: 2, DyeId: 12 } };
  const capture = () => {
    const warn = vi.fn();
    const error = vi.fn();
    return {
      logger: { warn, error },
      lines: (): string[] => [...warn.mock.calls, ...error.mock.calls].flat().map(String),
    };
  };

  it('reads fileBytes through the facade and prefers them over fileText', async () => {
    const bytes = charaBytes(GEAR_DOC);
    const i = { ...input('not json'), fileBytes: bytes } as GlamourInput;
    const result = await executeGlamour(i);
    if (!result.ok) throw new Error(result.errorMessage);
    expect(resolveCall(i)[0]).toEqual([{ slot: 'Body', base: 812, variant: 2 }]);
    const arg = vi.mocked(inspectCharaForTools).mock.calls[0][0];
    expect(arg).toBeInstanceOf(Uint8Array);
    expect(Array.from(arg as Uint8Array)).toEqual(Array.from(bytes));
  });

  it('accepts fileBytes with no fileText', async () => {
    const { fileText: _drop, ...rest } = input(GEAR_DOC);
    void _drop;
    const result = await executeGlamour({ ...rest, fileBytes: charaBytes(GEAR_DOC) } as GlamourInput);
    expect(result.ok).toBe(true);
  });

  it('refuses invalid UTF-8 as INVALID_UTF8 in the reader’s language, before any lookup', async () => {
    const { logger, lines } = capture();
    const i = {
      ...input(GEAR_DOC, { locale: 'fr', logger }),
      fileBytes: charaBytesWithInvalidUtf8(GEAR_DOC),
    } as GlamourInput;
    const result = await executeGlamour(i);
    const fr = createTranslator('fr');
    expect(result).toEqual({
      ok: false,
      error: 'PARSE_FAILED',
      errorMessage: fr.t('card.swatchParseError', { message: fr.t('card.charaFileReason.unreadable') }),
    });
    expect(i.resolve).not.toHaveBeenCalled();
    expect(lines()).toContainEqual(expect.stringMatching(/^\[glamour\] parse failed: \S+ INVALID_UTF8$/));
  });

  it('refuses bytes over 8,192 as INPUT_TOO_LARGE, before any lookup', async () => {
    const { logger, lines } = capture();
    const { fileText: _drop, ...rest } = input(GEAR_DOC, { logger });
    void _drop;
    const i = { ...rest, fileBytes: charaBytes(charaTextOfBytes(GEAR_DOC, 8_193)) } as GlamourInput;
    const result = await executeGlamour(i);
    expect(result).toEqual({ ok: false, error: 'PARSE_FAILED', errorMessage: UNREADABLE_EN });
    expect(i.resolve).not.toHaveBeenCalled();
    expect(lines()).toContainEqual(expect.stringMatching(/^\[glamour\] parse failed: \S+ INPUT_TOO_LARGE$/));
  });

  it('accepts exactly 8,192 bytes', async () => {
    const bytes = charaBytes(charaTextOfBytes(GEAR_DOC, 8_192));
    expect(bytes.byteLength).toBe(8_192);
    const { fileText: _drop, ...rest } = input(GEAR_DOC);
    void _drop;
    const result = await executeGlamour({ ...rest, fileBytes: bytes } as GlamourInput);
    expect(result.ok).toBe(true);
  });

  it('refuses an input with neither fileText nor fileBytes as PARSE_FAILED', async () => {
    const { fileText: _drop, ...rest } = input(GEAR_DOC);
    void _drop;
    const i = rest as GlamourInput;
    const result = await executeGlamour(i);
    expect(result).toEqual({ ok: false, error: 'PARSE_FAILED', errorMessage: UNREADABLE_EN });
    expect(i.resolve).not.toHaveBeenCalled();
  });

  it('still reads fileText alone', async () => {
    const result = await executeGlamour(input(GEAR_DOC));
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
  const CANARY_DOC = withCharaCanaries({
    TypeName: 'Anamnesis Character File',
    ...MIDLANDER,
    HairTone: 10,
    Legs: { ModelBase: 777, ModelVariant: 1, DyeId: 12 },
  });

  it('none reaches the card, the embed, the resolver request, the generator or the logs', async () => {
    const { logger, logged } = capture();
    const i = input(CANARY_DOC, { logger });
    const result = await executeGlamour(i);
    if (!result.ok) throw new Error(result.errorMessage);

    const [gear, glassesId] = resolveCall(i);
    expect(gear).toEqual([
      { slot: 'Body', base: 812, variant: 2 },
      { slot: 'Legs', base: 777, variant: 1 },
    ]);
    expect(glassesId).toBe(4);
    expect(JSON.stringify([gear, glassesId])).not.toMatch(CHARA_CANARY_PATTERN);
    expect(JSON.stringify(result)).not.toMatch(CHARA_CANARY_PATTERN);
    expect(JSON.stringify(vi.mocked(generateGlamourCard).mock.calls)).not.toMatch(CHARA_CANARY_PATTERN);
    expect(logged()).not.toMatch(CHARA_CANARY_PATTERN);
  });

  it('a canary in a malformed field never reaches the reply, the request or the logs', async () => {
    const { logger, logged } = capture();
    const i = input({ ...CANARY_DOC, LeftEyeColor: 'CANARY_MALFORMED', Tribe: 'CANARY_TRIBE' }, { logger });
    const result = await executeGlamour(i);
    expect(JSON.stringify(result)).not.toMatch(CHARA_CANARY_PATTERN);
    expect(JSON.stringify((i.resolve as ReturnType<typeof vi.fn>).mock.calls)).not.toMatch(CHARA_CANARY_PATTERN);
    expect(logged()).not.toMatch(CHARA_CANARY_PATTERN);
  });

  it('a structural refusal (a duplicate key) is PARSE_FAILED by code, never quoting the file', async () => {
    const { logger, logged } = capture();
    const i = input('{"HairTone":10,"Body":{"ModelBase":812,"ModelVariant":2},"CANARY_DUP":1,"CANARY_DUP":2}', { logger });
    const result = await executeGlamour(i);
    expect(result).toEqual({ ok: false, error: 'PARSE_FAILED', errorMessage: UNREADABLE_EN });
    expect(i.resolve).not.toHaveBeenCalled();
    expect(logged()).toMatch(/\[glamour\] parse failed: \S+ DUPLICATE_KEY/);
    expect(logged()).not.toMatch(CHARA_CANARY_PATTERN);
  });

  it('a forced error inside the read quoting a canary is logged by class only', async () => {
    vi.mocked(resolveCharaForTools).mockImplementationOnce(() => {
      throw new TypeError('CANARY_THROWN Firstname Lastname');
    });
    const { logger, logged } = capture();
    const i = input(CANARY_DOC, { logger });
    const result = await executeGlamour(i);
    expect(result).toEqual({ ok: false, error: 'PARSE_FAILED', errorMessage: UNREADABLE_EN });
    expect(i.resolve).not.toHaveBeenCalled();
    expect(logged()).toContain('[glamour] parse failed: TypeError');
    expect(logged()).not.toMatch(CHARA_CANARY_PATTERN);
  });
});
