import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CharacterColorService } from '../../CharacterColorService.js';
import { inspectCharaForTools, resolveCharaWithProvider } from '../chara-library.js';
import { resolveCharaForTools } from '../chara-library-resolve.js';
import { createCharaPaletteProvider } from '../chara-palette-provider.js';
import type {
  CharaPaletteProvider,
  ImportedCharaCharacter,
  ImportedCharaSlot,
} from '../chara-library-types.js';
import type { CharaInspection } from 'xivcharakit';
import type { PaletteRequest } from 'xivcharakit/palettes';
import { MAX_CHARA_FILE_BYTES } from '../chara-limits.js';
import { importSpecifiers, runtimeClosure } from './import-graph.js';
import * as core from '../../../index.js';

const colors = new CharacterColorService();
const dyes = {
  getByStainId: (id: number) =>
    id === 5 ? ({ name: 'Snow White', stainID: 5 } as never) : undefined,
};

async function importChara(
  doc: unknown,
  lookup: typeof dyes | undefined = dyes,
): Promise<ImportedCharaCharacter> {
  const text = typeof doc === 'string' ? doc : JSON.stringify(doc);
  return resolveCharaForTools(inspectCharaForTools(text), colors, lookup);
}

function slot(c: ImportedCharaCharacter, name: ImportedCharaSlot['slot']): ImportedCharaSlot {
  const found = c.slots.find((s) => s.slot === name);
  expect(found).toBeDefined();
  return found!;
}

describe('public surface', () => {
  it('exports the facade from the root barrel', () => {
    expect(typeof core.inspectCharaForTools).toBe('function');
    expect(typeof core.resolveCharaForTools).toBe('function');
    expect(typeof core.createCharaPaletteProvider).toBe('function');
  });

  it('exports the provider-based entry from the root barrel', () => {
    expect(typeof core.resolveCharaWithProvider).toBe('function');
  });
});

describe('inspectCharaForTools byte admission', () => {
  const base = '{"LEyeColor":0}';
  it('admits exactly 8,192 bytes and refuses 8,193', () => {
    expect(MAX_CHARA_FILE_BYTES).toBe(8192);
    expect(() => inspectCharaForTools(base.padEnd(8191))).not.toThrow();
    expect(() => inspectCharaForTools(base.padEnd(8192))).not.toThrow();
    expect(() => inspectCharaForTools(base.padEnd(8193))).toThrowError(
      expect.objectContaining({ code: 'INPUT_TOO_LARGE' }),
    );
  });

  it('measures strings in UTF-8 bytes, not code units', () => {
    // 4,000 two-byte characters = 8,000 bytes + overhead stays under; 4,100 goes over
    const under = JSON.stringify({ Hair: 1, Nickname: 'é'.repeat(4000) });
    const over = JSON.stringify({ Hair: 1, Nickname: 'é'.repeat(4100) });
    expect(() => inspectCharaForTools(under)).not.toThrow();
    expect(() => inspectCharaForTools(over)).toThrowError(
      expect.objectContaining({ code: 'INPUT_TOO_LARGE' }),
    );
  });

  it('admits the exact multibyte UTF-8 boundary as text or bytes and refuses one byte more', () => {
    const exact = JSON.stringify({ Hair: 1, Nickname: 'é'.repeat(4084) });
    const encoder = new TextEncoder();
    expect(encoder.encode(exact)).toHaveLength(8192);
    for (const input of [exact, encoder.encode(exact)]) {
      expect(() => inspectCharaForTools(input)).not.toThrow();
    }
    for (const input of [`${exact} `, encoder.encode(`${exact} `)]) {
      expect(() => inspectCharaForTools(input)).toThrowError(
        expect.objectContaining({ code: 'INPUT_TOO_LARGE' }),
      );
    }
  });

  it('accepts bytes and refuses invalid UTF-8', () => {
    expect(() => inspectCharaForTools(new TextEncoder().encode(base))).not.toThrow();
    expect(() => inspectCharaForTools(new Uint8Array([0x7b, 0xff, 0x7d]))).toThrowError(
      expect.objectContaining({ code: 'INVALID_UTF8' }),
    );
  });

  it('refuses structural problems with fixed codes', () => {
    expect(() => inspectCharaForTools('not json')).toThrowError(
      expect.objectContaining({ code: 'INVALID_JSON' }),
    );
    expect(() => inspectCharaForTools('{"a":1,"a":2}')).toThrowError(
      expect.objectContaining({ code: 'DUPLICATE_KEY' }),
    );
    expect(() => inspectCharaForTools('{"Nothing":1}')).toThrowError(
      expect.objectContaining({ code: 'NOT_CHARACTER' }),
    );
  });

  it('does not touch the network or storage', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const getItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem, setItem: getItem, removeItem: getItem });
    await importChara({ Tribe: 'Midlander', Gender: 'Masculine', Hair: 3 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    fetchSpy.mockRestore();
  });

  it('survives prototype-shaped keys without polluting anything', async () => {
    const c = await importChara(
      '{"Tribe":"Midlander","Gender":"Masculine","__proto__":{"x":1},"constructor":2}',
    );
    expect(c.tribe).toBe('Midlander');
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    // the unknown key is reported as a path-free-of-raw-names diagnostic
    expect(JSON.stringify(c)).not.toContain('constructor');
  });
});

describe('projection shape', () => {
  it('returns the eight slots in the contract order with the host fields', async () => {
    const c = await importChara({
      TypeName: 'Anamnesis',
      Nickname: 'Hero',
      Tribe: 'Raen',
      Gender: 'Feminine',
      Race: 'Au Ra',
      IsExtendedAppearanceValid: true,
      Glasses: { GlassesId: 3 },
    });
    expect(c.slots.map((s) => s.slot)).toEqual([
      'leftEye',
      'rightEye',
      'hair',
      'highlights',
      'skin',
      'limbal',
      'lip',
      'facePaint',
    ]);
    expect(c).toMatchObject({
      producer: 'Anamnesis',
      nickname: 'Hero',
      race: 'AuRa',
      tribe: 'Raen',
      gender: 'Female',
      extendedValid: true,
      extendedDeclared: true,
      glassesId: 3,
    });
    expect(c.gearModels).toEqual([]);
    expect(c.gearDyes).toEqual([]);
  });

  it('maps identity aliases and numeric enums', async () => {
    expect(await importChara({ Tribe: 'Helion', Gender: 'Masculine' })).toMatchObject({
      tribe: 'Helions',
      race: 'Hrothgar',
      gender: 'Male',
    });
    const numeric = await importChara({ Tribe: 1, Gender: 0, Hair: 1 });
    expect(numeric.tribe).toBe('Midlander');
    expect(numeric.race).toBe('Hyur');
    expect(numeric.gender).toBe('Male');
  });

  it('uses the canonical race from the tribe, not a contradictory declared race', async () => {
    const c = await importChara({ Tribe: 'Wildwood', Gender: 'Feminine', Race: 'Viera' });
    expect(c.race).toBe('Elezen');
  });

  it('refuses the Male/Female strings no producer writes, as unresolved context', async () => {
    const c = await importChara({ Tribe: 'Midlander', Gender: 'Male', Hair: 3, HairTone: 5 });
    expect(c.gender).toBeNull();
    expect(slot(c, 'hair').displayHex).toBeNull();
    expect(slot(c, 'hair').interpretation).toBe('unresolved');
  });

  it('keeps the extended flag and its declaration distinct', async () => {
    expect(await importChara({ Tribe: 'Midlander', Gender: 'Masculine' })).toMatchObject({
      extendedValid: false,
      extendedDeclared: false,
    });
    expect(
      await importChara({
        Tribe: 'Midlander',
        Gender: 'Masculine',
        IsExtendedAppearanceValid: null,
      }),
    ).toMatchObject({ extendedValid: false, extendedDeclared: true });
    expect(
      await importChara({
        Tribe: 'Midlander',
        Gender: 'Masculine',
        IsExtendedAppearanceValid: false,
      }),
    ).toMatchObject({ extendedValid: false, extendedDeclared: true });
  });

  it('bounds nickname and producer to 256 UTF-16 code units', async () => {
    const long = 'n'.repeat(400);
    const c = await importChara({
      Tribe: 'Midlander',
      Gender: 'Masculine',
      Nickname: long,
      TypeName: long,
    });
    expect(c.nickname).toHaveLength(256);
    expect(c.producer).toHaveLength(256);
  });

  describe.each(['TypeName', 'Nickname'] as const)('BUG-003: bounded %s label', (field) => {
    it.each([
      ['pair crossing cutoff', `${'a'.repeat(255)}😀suffix`, 'a'.repeat(255), 255],
      ['pair ending at cutoff', `${'a'.repeat(254)}😀suffix`, `${'a'.repeat(254)}😀`, 256],
      ['all astral characters', `${'😀'.repeat(128)}suffix`, '😀'.repeat(128), 256],
      ['ASCII characters', 'a'.repeat(400), 'a'.repeat(256), 256],
    ] as const)('keeps intact characters for %s', async (_case, input, expected, units) => {
      const character = await importChara({
        Tribe: 'Midlander',
        Gender: 'Masculine',
        [field]: input,
      });
      const label = field === 'TypeName' ? character.producer : character.nickname;
      expect(label).toBe(expected);
      expect(label).toHaveLength(units);
    });
  });

  it('carries no raw document, image or unknown field into the result', async () => {
    const c = await importChara({
      Tribe: 'Midlander',
      Gender: 'Masculine',
      Hair: 3,
      Base64Image: 'CANARY_IMAGE_PAYLOAD',
      Author: 'CANARY_AUTHOR',
      Description: 'CANARY_DESCRIPTION',
      CANARY_UNKNOWN_KEY: 'CANARY_UNKNOWN_VALUE',
      Body: { ModelBase: 1, ModelVariant: 1, CANARY_LANE: 4 },
    });
    const json = JSON.stringify(c);
    for (const canary of [
      'CANARY_IMAGE',
      'CANARY_AUTHOR',
      'CANARY_DESCRIPTION',
      'CANARY_UNKNOWN',
      'CANARY_LANE',
    ]) {
      expect(json).not.toContain(canary);
    }
    for (const forbidden of ['document', 'fields', 'raw', 'storedExtended', 'storedIndex']) {
      expect(json).not.toContain(`"${forbidden}"`);
    }
  });
});

describe('equipment projection', () => {
  it('accepts an equipment-only document and keeps appearance explicitly unresolved', async () => {
    const c = await importChara({ Body: { ModelBase: 1, ModelVariant: 2, DyeId: 5 } });
    expect(c.gearModels).toEqual([{ slot: 'Body', base: 1, variant: 2 }]);
    expect(c.gearDyes).toEqual([
      { slot: 'Body', channel: 1, stainId: 5, dye: { name: 'Snow White', stainID: 5 } },
    ]);
    for (const s of c.slots) {
      expect(s.displayHex).toBeNull();
      expect(s.matchHex).toBeNull();
    }
  });

  it('keeps valid gear beside a malformed color', async () => {
    const c = await importChara({
      Tribe: 'Midlander',
      Gender: 'Masculine',
      LeftEyeColor: 'Infinity',
      Legs: { ModelBase: 3, ModelVariant: 1, DyeId: 9 },
    });
    expect(c.gearModels).toEqual([{ slot: 'Legs', base: 3, variant: 1 }]);
    expect(c.issues.some((i) => i.path[0] === 'LeftEyeColor')).toBe(true);
  });

  it('omits incomplete models and their dyes, with a bounded warning', async () => {
    const c = await importChara({
      HeadGear: { ModelBase: 1.5, ModelVariant: 1, DyeId: 2 },
      Feet: { ModelBase: 4, DyeId: 2 },
      Hands: { ModelBase: 6, ModelVariant: 1, DyeId: 7 },
    });
    expect(c.gearModels.map((m) => m.slot)).toEqual(['Hands']);
    expect(c.gearDyes.map((d) => d.slot)).toEqual(['Hands']);
    expect(c.issues.some((i) => i.code === 'INCOMPLETE_MODEL' && i.path[0] === 'HeadGear')).toBe(
      true,
    );
  });

  it('drops empty slots and keeps a weapon triple with its set', async () => {
    const c = await importChara({
      Body: { ModelBase: 0, ModelVariant: 0, DyeId: 5 },
      MainHand: { ModelSet: 634, ModelBase: 1, ModelVariant: 1, DyeId: 5 },
    });
    expect(c.gearModels).toEqual([{ slot: 'MainHand', set: 634, base: 1, variant: 1 }]);
    expect(c.gearDyes.map((d) => d.slot)).toEqual(['MainHand']);
  });

  it('emits badges only for valid nonzero channels, including a second channel alone', async () => {
    const c = await importChara({
      Body: { ModelBase: 1, ModelVariant: 1, DyeId: 0, DyeId2: 5 },
      Legs: { ModelBase: 1, ModelVariant: 1, DyeId: null },
      Feet: { ModelBase: 1, ModelVariant: 1, DyeId: -3, DyeId2: 'x' },
      Hands: { ModelBase: 1, ModelVariant: 1, DyeId: 1.5 },
    });
    expect(c.gearDyes).toEqual([
      { slot: 'Body', channel: 2, stainId: 5, dye: { name: 'Snow White', stainID: 5 } },
    ]);
    // invalid channels stay as diagnostics rather than becoming "undyed"
    expect(
      c.issues.filter((i) => i.path[0] === 'Feet' && i.path[1] === 'DyeId').length,
    ).toBeGreaterThan(0);
  });

  it('gives an unknown stain a null dye and no lookup a null dye', async () => {
    const doc = { Body: { ModelBase: 1, ModelVariant: 1, DyeId: 99 } };
    expect((await importChara(doc)).gearDyes[0].dye).toBeNull();
    expect((await importChara(doc, undefined)).gearDyes[0].dye).toBeNull();
  });

  it('enforces uint16 bounds on lanes, dyes and facewear', async () => {
    const at = await importChara({
      Body: { ModelBase: 65535, ModelVariant: 65535, DyeId: 65535 },
      Glasses: { GlassesId: 65535 },
    });
    expect(at.gearModels).toEqual([{ slot: 'Body', base: 65535, variant: 65535 }]);
    expect(at.gearDyes.map((d) => d.stainId)).toEqual([65535]);
    expect(at.glassesId).toBe(65535);

    const over = await importChara({
      Body: { ModelBase: 65536, ModelVariant: 1, DyeId: 65536 },
      Legs: { ModelBase: 1, ModelVariant: 1, DyeId: 65536 },
      Glasses: { GlassesId: 65536 },
    });
    expect(over.gearModels).toEqual([{ slot: 'Legs', base: 1, variant: 1 }]);
    expect(over.gearDyes).toEqual([]);
    expect(over.glassesId).toBeNull();
  });

  it('refuses negative, fractional and string lanes without inventing values', async () => {
    const c = await importChara({
      Body: { ModelBase: -1, ModelVariant: 1 },
      Legs: { ModelBase: 1, ModelVariant: 0.5 },
      Feet: { ModelBase: '1', ModelVariant: 1 },
    });
    expect(c.gearModels).toEqual([]);
  });

  it('reads both Glasses shapes and maps 0 and absent to null', async () => {
    expect(
      (await importChara({ Tribe: 'Midlander', Gender: 'Masculine', Glasses: { GlassesId: 4 } }))
        .glassesId,
    ).toBe(4);
    expect(
      (await importChara({ Tribe: 'Midlander', Gender: 'Masculine', Glasses: 4 })).glassesId,
    ).toBe(4);
    expect(
      (await importChara({ Tribe: 'Midlander', Gender: 'Masculine', Glasses: 0 })).glassesId,
    ).toBeNull();
    expect((await importChara({ Tribe: 'Midlander', Gender: 'Masculine' })).glassesId).toBeNull();
  });
});

describe('diagnostics', () => {
  it('replaces unrecognized source keys in paths with "unknown"', async () => {
    const c = await importChara({ Tribe: 'Midlander', Gender: 'Masculine', CANARY_PATH_KEY: 1 });
    const unknown = c.issues.find((i) => i.code === 'UNSUPPORTED_FIELD');
    expect(unknown?.path).toEqual(['unknown']);
    expect(JSON.stringify(c.issues)).not.toContain('CANARY_PATH_KEY');
  });

  it('never carries the library English message', async () => {
    const c = await importChara({ Tribe: 'Midlander', Gender: 'Masculine', Bogus: 1 });
    expect(JSON.stringify(c.issues)).not.toContain('message');
    expect(JSON.stringify(c.issues)).not.toContain('Stored field');
    expect(Object.keys(c.issues[0]).sort()).toEqual(['code', 'path', 'severity']);
  });

  it('deduplicates and caps at 64 with the fixed truncation code', async () => {
    const many: Record<string, unknown> = { Tribe: 'Midlander', Gender: 'Masculine' };
    // 100 distinct unsupported keys collapse onto the same sanitized path: one entry
    for (let i = 0; i < 100; i += 1) many[`Extra${i}`] = 1;
    const collapsed = await importChara(many);
    expect(collapsed.issues.filter((i) => i.code === 'UNSUPPORTED_FIELD')).toHaveLength(1);
    expect(collapsed.issues.length).toBeLessThanOrEqual(64);
  });
});

describe('appearance semantics', () => {
  const identity = { Tribe: 'Midlander', Gender: 'Masculine' };

  it('resolves a palette index to its host color with a match', async () => {
    const c = await importChara({ ...identity, HairTone: 10 });
    const hair = slot(c, 'hair');
    const expected = (await colors.getHairColors('Midlander', 'Male'))[10].hex;
    expect(hair).toMatchObject({
      interpretation: 'palette',
      active: true,
      displayHex: expected,
      matchHex: expected,
      index: 10,
      indexState: 'valid',
    });
  });

  it('reports unresolved slots with a null display and match', async () => {
    const c = await importChara({ ...identity });
    const eye = slot(c, 'leftEye');
    expect(eye.indexState).toBe('absent');
    expect(eye.index).toBeNull();
    expect(eye.displayHex).toBeNull();
    expect(eye.matchHex).toBeNull();
  });

  it('unknown race leaves hair and skin unresolved, not guessed', async () => {
    const c = await importChara({ HairTone: 10, Skintone: 10 });
    expect(slot(c, 'hair')).toMatchObject({
      interpretation: 'unresolved',
      displayHex: null,
      matchHex: null,
    });
    expect(slot(c, 'skin')).toMatchObject({
      interpretation: 'unresolved',
      displayHex: null,
      matchHex: null,
    });
  });

  it('pins unknown activation: preview kept, no match', async () => {
    const grayProvided = await importChara({ ...identity, Highlights: 5, FacePaintColor: 5 });
    for (const name of ['highlights', 'facePaint'] as const) {
      const s = slot(grayProvided, name);
      expect(s.active, name).toBeNull();
      expect(s.reason, name).toBe('activityUnknown');
      expect(s.displayHex, name).not.toBeNull();
      expect(s.matchHex, name).toBeNull();
    }
    const lip = await importChara({ Tribe: 'Wildwood', LipsToneFurPattern: 53 });
    const l = slot(lip, 'lip');
    expect(l.active).toBeNull();
    expect(l.reason).toBe('activityUnknown');
    expect(l.matchHex).toBeNull();
    expect(l.displayHex).not.toBeNull();
  });

  it('keeps explicitly disabled controls inactive with no match, unlike unknown', async () => {
    const c = await importChara({
      ...identity,
      EnableHighlights: false,
      Highlights: 5,
      FacePaint: 0,
      FacePaintColor: 5,
    });
    expect(slot(c, 'highlights')).toMatchObject({
      active: false,
      interpretation: 'inactive',
      reason: 'highlightsDisabled',
      matchHex: null,
    });
    expect(slot(c, 'facePaint')).toMatchObject({
      active: false,
      interpretation: 'inactive',
      reason: 'facePaintNone',
      matchHex: null,
    });
  });

  it('treats the mirror-only FacePaint 128 as none and 129 as active', async () => {
    const mirror = await importChara({ ...identity, FacePaint: 128, FacePaintColor: 5 });
    expect(slot(mirror, 'facePaint')).toMatchObject({
      active: false,
      reason: 'facePaintNone',
      matchHex: null,
    });
    const painted = await importChara({ ...identity, FacePaint: 129, FacePaintColor: 5 });
    expect(slot(painted, 'facePaint')).toMatchObject({ active: true });
    expect(slot(painted, 'facePaint').matchHex).not.toBeNull();
  });

  it('enables a confirmed-active highlight with a match', async () => {
    const c = await importChara({ ...identity, EnableHighlights: true, Highlights: 5 });
    const s = slot(c, 'highlights');
    expect(s).toMatchObject({ active: true, interpretation: 'palette' });
    expect(s.matchHex).toBe(s.displayHex);
  });

  it('invalid control values are not rewritten to inactive', async () => {
    const c = await importChara({ ...identity, EnableHighlights: 'yes', Highlights: 5 });
    const s = slot(c, 'highlights');
    expect(s.active).not.toBe(false);
    expect(s.matchHex).toBeNull();
  });

  it('applies the lip-color bit: a clear bit disables the lip', async () => {
    const disabled = await importChara({ ...identity, LipsToneFurPattern: 5, Mouth: 2 });
    expect(slot(disabled, 'lip')).toMatchObject({
      active: false,
      reason: 'lipDisabled',
      matchHex: null,
    });
    const enabled = await importChara({ ...identity, LipsToneFurPattern: 5, Mouth: 130 });
    const lip = slot(enabled, 'lip');
    expect(lip.active).toBe(true);
    expect(lip.matchHex).not.toBeNull();
  });

  it('Hrothgar fur pattern is not a color', async () => {
    const c = await importChara({ Tribe: 'Helions', Gender: 'Masculine', LipsToneFurPattern: 3 });
    expect(slot(c, 'lip')).toMatchObject({ indexMeaning: 'furPattern', matchHex: null });
  });

  it('an all-zero extended block does not become a real color', async () => {
    const c = await importChara({
      ...identity,
      IsExtendedAppearanceValid: true,
      HairTone: 10,
      SkinColor: '0, 0, 0',
      LeftEyeColor: '0, 0, 0',
      RightEyeColor: '0, 0, 0',
      LimbalRingColor: '0, 0, 0',
      HairColor: '0, 0, 0',
      HairHighlight: '0, 0, 0',
      MouthColor: '0, 0, 0, 0',
    });
    const hair = slot(c, 'hair');
    expect(hair.reason).toBe('ambiguousZeroBlock');
    expect(hair.interpretation).toBe('palette');
  });

  it('keeps the original and the corrected eye color distinguishable', async () => {
    const eyes = colors.getEyeColors();
    const lin = (hex: string) =>
      [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v * v).toFixed(6))
        .join(',');
    const left = eyes[10].hex;
    const right = eyes[20].hex;
    // Brio-style crossing: each eye's float holds the OTHER eye's palette color
    const c = await importChara({
      ...identity,
      IsExtendedAppearanceValid: true,
      LEyeColor: 10,
      REyeColor: 20,
      LeftEyeColor: lin(right),
      RightEyeColor: lin(left),
    });
    const l = slot(c, 'leftEye');
    expect(l.correction).toBe('historicalEyePairSwap');
    expect(l.extendedHex).not.toBe(l.effectiveExtendedHex);
  });
});

describe('indexGap (the unused lip / face-paint 96-127 gap, COL-09/10/35)', () => {
  const identity = { Tribe: 'Midlander', Gender: 'Masculine' };
  const lipDoc = (value: unknown) => ({ ...identity, LipsToneFurPattern: value, Mouth: 130 });
  const facePaintDoc = (value: unknown) => ({ ...identity, FacePaint: 129, FacePaintColor: value });
  const cases: readonly [unknown, boolean][] = [
    [95, false],
    [96, true],
    [100, true],
    [127, true],
    [128, false],
    [96.5, true],
    [127.5, false],
    [-1, false],
    [3, false],
    ['100', false],
  ];

  for (const [value, expected] of cases) {
    it(`lip ${JSON.stringify(value)} -> ${expected}`, async () => {
      expect(slot(await importChara(lipDoc(value)), 'lip').indexGap).toBe(expected);
    });
    it(`facePaint ${JSON.stringify(value)} -> ${expected}`, async () => {
      expect(slot(await importChara(facePaintDoc(value)), 'facePaint').indexGap).toBe(expected);
    });
  }

  it('reports the gap whichever way the library classifies it', async () => {
    const valid = slot(await importChara(lipDoc(100)), 'lip');
    expect(valid).toMatchObject({ indexState: 'valid', reason: 'indexOutOfRange', indexGap: true });
    const fraction = slot(await importChara(facePaintDoc(96.5)), 'facePaint');
    expect(fraction).toMatchObject({
      indexState: 'invalid',
      reason: 'invalidIndex',
      index: null,
      indexGap: true,
    });
  });

  it('is false on every other slot, even with an index in the gap range', async () => {
    const c = await importChara({
      ...identity,
      LEyeColor: 100,
      REyeColor: 100,
      HairTone: 100,
      Highlights: 100,
      Skintone: 100,
      LimbalEyes: 100,
      LipsToneFurPattern: 3,
      FacePaint: 129,
      FacePaintColor: 3,
    });
    for (const s of c.slots) expect(s.indexGap, s.slot).toBe(false);
    expect(slot(c, 'hair').index).toBe(100);
  });

  it('is false for a Hrothgar fur pattern and for a lip of unknown race', async () => {
    const fur = await importChara({
      Tribe: 'Helions',
      Gender: 'Masculine',
      LipsToneFurPattern: 100,
    });
    expect(slot(fur, 'lip')).toMatchObject({ indexMeaning: 'furPattern', indexGap: false });
    const unknown = await importChara({ LipsToneFurPattern: 100 });
    expect(slot(unknown, 'lip')).toMatchObject({ indexMeaning: 'unknown', indexGap: false });
  });

  it('never serializes the raw fractional index', async () => {
    const lip = await importChara(lipDoc(96.5));
    const paint = await importChara(facePaintDoc(96.5));
    expect(slot(lip, 'lip').indexGap).toBe(true);
    expect(slot(paint, 'facePaint').indexGap).toBe(true);
    expect(JSON.stringify(lip)).not.toContain('96.5');
    expect(JSON.stringify(paint)).not.toContain('96.5');
  });
});

const echo = (request: PaletteRequest) => ({
  ...request,
  hex: '#112233',
  rgb: [17, 34, 51] as const,
  datasetVersion: 'test',
});

type ProviderEntry = (
  inspection: CharaInspection,
  provider: CharaPaletteProvider,
) => Promise<ImportedCharaCharacter>;

describe.each<[string, ProviderEntry]>([
  ['resolveCharaForTools', resolveCharaForTools],
  ['resolveCharaWithProvider', resolveCharaWithProvider],
])('%s with a palette provider', (_name, resolveWith) => {
  const identity = { Tribe: 'Midlander', Gender: 'Masculine' };

  it('uses the provider directly and leaves the CharacterColorService path untouched', async () => {
    const getColor = vi.fn(async (request: PaletteRequest) => echo(request));
    const provider: CharaPaletteProvider = { getColor };
    const serviceSpies = (
      [
        'getHairColors',
        'getSkinColors',
        'getEyeColors',
        'getHighlightColors',
        'getTattooColors',
        'getLipColorsDark',
        'getLipColorsLight',
        'getFacePaintColorsDark',
        'getFacePaintColorsLight',
      ] as const
    ).map((name) => vi.spyOn(CharacterColorService.prototype, name));
    try {
      const inspection = inspectCharaForTools(
        JSON.stringify({
          ...identity,
          HairTone: 10,
          LEyeColor: 4,
          LipsToneFurPattern: 5,
          Mouth: 130,
        }),
      );
      const c = await resolveWith(inspection, provider);
      expect(getColor).toHaveBeenCalledWith(
        expect.objectContaining({
          table: 'creator',
          palette: 'hair',
          index: 10,
          tribe: 'Midlander',
          gender: 'Masculine',
        }),
      );
      expect(getColor).toHaveBeenCalledWith(
        expect.objectContaining({ table: 'shader', palette: 'hair', index: 10 }),
      );
      expect(getColor).toHaveBeenCalledWith(
        expect.objectContaining({ table: 'creator', palette: 'eyes', index: 4 }),
      );
      expect(getColor).toHaveBeenCalledWith(
        expect.objectContaining({ table: 'creator', palette: 'lipsDark', index: 5 }),
      );
      expect(slot(c, 'hair')).toMatchObject({
        creatorHex: '#112233',
        displayHex: '#112233',
        matchHex: '#112233',
      });
      for (const spy of serviceSpies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of serviceSpies) spy.mockRestore();
    }
  });

  it('a provider that returns null yields the library unresolved states', async () => {
    const getColor = vi.fn(async () => null);
    const inspection = inspectCharaForTools(JSON.stringify({ ...identity, HairTone: 10 }));
    const c = await resolveWith(inspection, { getColor });
    expect(getColor).toHaveBeenCalled();
    expect(c.issues.some((i) => i.code === 'PALETTE_UNAVAILABLE')).toBe(false);
    expect(slot(c, 'hair')).toMatchObject({
      interpretation: 'unresolved',
      reason: 'missingPaletteEntry',
      creatorHex: null,
      displayHex: null,
      matchHex: null,
    });
  });

  it('a provider that throws yields PALETTE_UNAVAILABLE and no throw', async () => {
    const getColor = vi.fn(async () => {
      throw new Error('page went away');
    });
    const inspection = inspectCharaForTools(JSON.stringify({ ...identity, HairTone: 10 }));
    const c = await resolveWith(inspection, { getColor });
    expect(getColor).toHaveBeenCalled();
    expect(c.issues.some((i) => i.code === 'PALETTE_UNAVAILABLE' && i.path[0] === 'HairTone')).toBe(
      true,
    );
    expect(slot(c, 'hair')).toMatchObject({ displayHex: null, matchHex: null });
    expect(JSON.stringify(c)).not.toContain('page went away');
  });

  it('a provider answering a different coordinate is rejected as an invalid association', async () => {
    const getColor = vi.fn(async (request: PaletteRequest) => ({
      ...echo(request),
      index: request.index + 1,
    }));
    const inspection = inspectCharaForTools(JSON.stringify({ ...identity, HairTone: 10 }));
    const c = await resolveWith(inspection, { getColor });
    expect(getColor).toHaveBeenCalled();
    expect(
      c.issues.some((i) => i.code === 'INVALID_PALETTE_RESPONSE' && i.path[0] === 'HairTone'),
    ).toBe(true);
    expect(slot(c, 'hair')).toMatchObject({ displayHex: null, matchHex: null });
  });
});

describe('entry-point signatures (compile-time)', () => {
  it('resolveCharaForTools accepts only a service or a provider', () => {
    const typeOnly = (inspection: CharaInspection): void => {
      // @ts-expect-error a plain object is neither a CharacterColorService nor a palette provider
      void resolveCharaForTools(inspection, {});
    };
    expect(typeof typeOnly).toBe('function');
  });

  it('resolveCharaWithProvider accepts only a provider, never the service', () => {
    const typeOnly = (inspection: CharaInspection): void => {
      // @ts-expect-error the service has no getColor: only resolveCharaForTools bridges it
      void resolveCharaWithProvider(inspection, colors);
      // @ts-expect-error a plain object is not a palette provider
      void resolveCharaWithProvider(inspection, {});
    };
    expect(typeof typeOnly).toBe('function');
  });
});

describe('resolveCharaForTools delegates to resolveCharaWithProvider', () => {
  const doc = {
    Tribe: 'Midlander',
    Gender: 'Masculine',
    HairTone: 10,
    LEyeColor: 4,
    REyeColor: 4,
    LipsToneFurPattern: 5,
    Mouth: 130,
    FacePaint: 129,
    FacePaintColor: 100,
    Body: { ModelBase: 1, ModelVariant: 1, DyeId: 5, DyeId2: 99 },
    Bogus: 1,
  };

  it('bridges a CharacterColorService exactly as createCharaPaletteProvider does', async () => {
    const inspection = inspectCharaForTools(JSON.stringify(doc));
    const viaTools = await resolveCharaForTools(inspection, colors, dyes);
    const direct = await resolveCharaWithProvider(
      inspection,
      createCharaPaletteProvider(colors),
      dyes,
    );
    expect(viaTools).toEqual(direct);
    // the comparison is not vacuous: the bridged service really resolved colors
    expect(slot(viaTools, 'hair').displayHex).not.toBeNull();
    expect(slot(viaTools, 'facePaint').indexGap).toBe(true);
    expect(viaTools.gearDyes.map((d) => d.stainId)).toEqual([5, 99]);
  });

  it('hands a provider through unchanged: same requests, same projection', async () => {
    const inspection = inspectCharaForTools(JSON.stringify(doc));
    const viaToolsColor = vi.fn(async (request: PaletteRequest) => echo(request));
    const directColor = vi.fn(async (request: PaletteRequest) => echo(request));
    const viaTools = await resolveCharaForTools(inspection, { getColor: viaToolsColor }, dyes);
    const direct = await resolveCharaWithProvider(inspection, { getColor: directColor }, dyes);
    expect(viaToolsColor).toHaveBeenCalled();
    expect(viaToolsColor.mock.calls).toEqual(directColor.mock.calls);
    expect(viaTools).toEqual(direct);
    expect(slot(viaTools, 'hair').displayHex).toBe('#112233');
  });

  it('defaults the dye lookup the same way when none is given', async () => {
    const inspection = inspectCharaForTools(JSON.stringify(doc));
    const getColor = async (request: PaletteRequest) => echo(request);
    const viaTools = await resolveCharaForTools(inspection, { getColor });
    const direct = await resolveCharaWithProvider(inspection, { getColor });
    expect(viaTools).toEqual(direct);
    expect(direct.gearDyes.every((d) => d.dye === null)).toBe(true);
  });
});

/**
 * The web app's inspection worker imports only `inspectCharaForTools` and `resolveCharaWithProvider`
 * and passes its own provider. Any runtime import path from `chara-library.ts` to the host palette
 * bridge makes a bundler emit core's shader-table chunks into that worker's build (never fetched,
 * but shipped and counted against the bundle budget). A dynamic `import()` would not help: bundlers
 * emit a chunk for every reachable dynamic import target. Only `import type` is erased under
 * `verbatimModuleSyntax`; `import { type X }` keeps a side-effect import, so it counts as runtime.
 */
describe('chara-library import graph', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const charaDir = resolve(here, '..');
  const libraryFile = resolve(charaDir, 'chara-library.ts');
  const forbiddenFiles = [
    resolve(charaDir, 'chara-palette-provider.ts'),
    resolve(charaDir, 'chara-shader-colors.ts'),
    resolve(charaDir, '../CharacterColorService.ts'),
  ];

  it('the specifier scan sees runtime, type-only and dynamic imports (control)', () => {
    const scanned = importSpecifiers(
      [
        "import { a, type B } from './runtime-named.js';",
        "import type { C } from './type-only.js';",
        "import './side-effect.js';",
        "export { d } from './re-export.js';",
        "export type { E } from './type-re-export.js';",
        "const f = () => import('./dynamic.js');",
        "// import { g } from './commented-out.js';",
        "/* import { h } from './block-comment.js'; */",
      ].join('\n'),
    );
    expect(scanned).toEqual([
      { specifier: './runtime-named.js', typeOnly: false },
      { specifier: './type-only.js', typeOnly: true },
      { specifier: './side-effect.js', typeOnly: false },
      { specifier: './re-export.js', typeOnly: false },
      { specifier: './type-re-export.js', typeOnly: true },
      { specifier: './dynamic.js', typeOnly: false },
    ]);
  });

  it('the closure walk follows runtime imports to the shader tables (control)', () => {
    const closure = runtimeClosure(resolve(charaDir, 'chara-palette-provider.ts'));
    expect(closure.has(resolve(charaDir, 'chara-shader-colors.ts'))).toBe(true);
  });

  it('chara-library.ts imports the palette bridge, shader tables and service only as types', () => {
    const offending = importSpecifiers(readFileSync(libraryFile, 'utf8'))
      .filter(({ typeOnly }) => !typeOnly)
      .map(({ specifier }) => specifier.replace(/\.js$/, ''))
      .filter((specifier) =>
        ['./chara-palette-provider', './chara-shader-colors', '../CharacterColorService'].includes(
          specifier,
        ),
      );
    expect(offending).toEqual([]);
  });

  it('no runtime import path leads from chara-library.ts to them', () => {
    const closure = runtimeClosure(libraryFile);
    expect(forbiddenFiles.filter((file) => closure.has(file))).toEqual([]);
  });
});
