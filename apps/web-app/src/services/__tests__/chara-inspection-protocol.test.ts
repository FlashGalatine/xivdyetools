/**
 * The cross-thread DTO boundary between the `.chara` inspection worker and the page (Task 4).
 *
 * The worker answers with a projected `ImportedCharaCharacter`; the page re-validates it before
 * trusting it, because a structured-clone message is a separate boundary from the core projection.
 * Every bound below is pinned at its limit and one step past it, so moving a limit (or dropping a
 * check) turns exactly one of these red.
 *
 * Decision pinned here: a result carrying a field the projection never produces (`document`, `raw`,
 * `fields`, a slot's `storedIndex` / `storedExtended`) is REJECTED (`null`), not stripped. A worker
 * that leaks raw document data is defective, and the page must not adopt any part of its answer.
 */
import { describe, it, expect } from 'vitest';
import {
  DyeService,
  dyeDatabase,
  type ImportedCharaCharacter,
  type ImportedCharaSlot,
} from '@xivdyetools/core';
import {
  CHARA_INSPECTION_TIMEOUT_MS,
  isInspectionRequest,
  parseInspectionResponse,
  validateImportedCharacter,
} from '../chara-inspection-protocol';

const SLOT_NAMES = [
  'leftEye',
  'rightEye',
  'hair',
  'highlights',
  'skin',
  'limbal',
  'lip',
  'facePaint',
] as const;

const GEAR_SLOTS = [
  'MainHand',
  'OffHand',
  'HeadGear',
  'Body',
  'Hands',
  'Legs',
  'Feet',
  'Ears',
  'Neck',
  'Wrists',
  'LeftRing',
  'RightRing',
] as const;

const KIB_256 = 256 * 1024;

/** A confirmed-active, resolved palette slot: the only shape whose `matchHex` may be non-null. */
function slot(name: (typeof SLOT_NAMES)[number]): ImportedCharaSlot {
  return {
    slot: name,
    kind: name === 'limbal' ? 'tattoo' : name,
    indexMeaning: 'color',
    sheetIndex: 3,
    variant: null,
    gridAddress: null,
    creatorHex: '#985726',
    shaderHex: '#985726',
    extendedHex: null,
    effectiveExtendedHex: null,
    extendedActive: false,
    active: true,
    interpretation: 'palette',
    reason: 'paletteOnly',
    deltaE: null,
    displayHex: '#985726',
    alpha: null,
    lipComposite: null,
    correction: null,
    index: 3,
    indexState: 'valid',
    matchHex: '#985726',
  };
}

/** An all-ASCII valid projection (so UTF-16 length and UTF-8 bytes of its JSON agree). */
function baseCharacter(): ImportedCharaCharacter {
  return {
    producer: 'Anamnesis Character File',
    race: 'Lalafell',
    tribe: 'Dunesfolk',
    gender: 'Female',
    nickname: null,
    extendedValid: true,
    extendedDeclared: true,
    slots: SLOT_NAMES.map(slot),
    eyesShareIndex: true,
    gearDyes: [{ slot: 'Body', channel: 1, stainId: 86, dye: null }],
    gearModels: [
      { slot: 'Body', base: 361, variant: 5 },
      { slot: 'MainHand', set: 634, base: 19, variant: 1 },
    ],
    glassesId: null,
    issues: [{ code: 'PALETTE_UNAVAILABLE', severity: 'warning', path: ['LeftEyeColor'] }],
  };
}

type LooseRecord = Record<string, unknown>;
interface Loose extends LooseRecord {
  slots: LooseRecord[];
  gearModels: LooseRecord[];
  gearDyes: LooseRecord[];
  issues: LooseRecord[];
}

/** A deep copy of the valid base, loosely typed so a test can break exactly one thing. */
function draft(): Loose {
  return structuredClone(baseCharacter()) as unknown as Loose;
}

function slotNamed(d: Loose, name: string): LooseRecord {
  const found = d.slots.find((s) => s.slot === name);
  if (!found) throw new Error(`test setup: no slot ${name}`);
  return found;
}

/**
 * A copy of the offline database's own dye object for this stain, exactly as the worker's
 * projection carries it (lowercase hex, plus the runtime nameLower / categoryLower / lab /
 * legacyItemID fields `DyeDatabase` adds).
 */
function realDye(stainId: number): LooseRecord {
  const dye = new DyeService(dyeDatabase).getByStainId(stainId);
  if (!dye) throw new Error(`test setup: no dye ${stainId}`);
  return structuredClone(dye) as unknown as LooseRecord;
}

/** The base with a real dye on its Body channel 1 (stain 86). */
function draftWithDye(): Loose {
  const d = draft();
  d.gearDyes[0].dye = realDye(86);
  return d;
}

/** Every object and array reachable from `value`. */
function nodesOf(value: unknown, into: Set<object> = new Set()): Set<object> {
  if (typeof value === 'object' && value !== null && !into.has(value)) {
    into.add(value);
    for (const child of Object.values(value)) nodesOf(child, into);
  }
  return into;
}

describe('CHARA_INSPECTION_TIMEOUT_MS', () => {
  it('is exactly 5_000 ms', () => {
    // Red if the shared timeout constant changes.
    expect(CHARA_INSPECTION_TIMEOUT_MS).toBe(5_000);
  });
});

describe('isInspectionRequest', () => {
  const bytes = new ArrayBuffer(8);

  it('accepts an inspect request with a positive safe integer id and an ArrayBuffer', () => {
    expect(isInspectionRequest({ type: 'inspect', id: 1, bytes })).toBe(true);
    expect(isInspectionRequest({ type: 'inspect', id: Number.MAX_SAFE_INTEGER, bytes })).toBe(true);
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
    ['unsafe', Number.MAX_SAFE_INTEGER + 1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['numeric string', '1'],
    ['missing', undefined],
  ])('rejects a %s id', (_label, id) => {
    // Red if the id check drops positivity, integrality, the safe-integer bound or the type check.
    expect(isInspectionRequest({ type: 'inspect', id, bytes })).toBe(false);
  });

  it.each([
    ['missing', undefined],
    ['a Uint8Array view', new Uint8Array(8)],
    ['a string', 'bytes'],
    ['null', null],
    ['a plain object', { byteLength: 8 }],
  ])('rejects bytes that are %s', (_label, value) => {
    // Red if anything but a real ArrayBuffer is accepted as the transferred payload.
    expect(isInspectionRequest({ type: 'inspect', id: 1, bytes: value })).toBe(false);
  });

  it.each([
    ['an unknown type', { type: 'inspected', id: 1, bytes }],
    ['a missing type', { id: 1, bytes }],
    ['null', null],
    ['undefined', undefined],
    ['an array', [1, bytes]],
    ['a string', 'inspect'],
  ])('rejects %s', (_label, value) => {
    expect(isInspectionRequest(value)).toBe(false);
  });
});

describe('parseInspectionResponse', () => {
  it('returns a valid success response with its result intact', () => {
    const result = baseCharacter();
    expect(parseInspectionResponse({ type: 'success', id: 4, result })).toEqual({
      type: 'success',
      id: 4,
      result,
    });
  });

  it.each(['unreadable', 'workerFailed'] as const)('returns a valid %s error response', (code) => {
    expect(parseInspectionResponse({ type: 'error', id: 9, code })).toEqual({
      type: 'error',
      id: 9,
      code,
    });
  });

  it('rebuilds an error response without any extra field such as a raw message', () => {
    // Red if the parsed error passes the incoming object through (raw text would cross over).
    const parsed = parseInspectionResponse({
      type: 'error',
      id: 9,
      code: 'workerFailed',
      message: 'RAW-EXCEPTION-CANARY',
    });
    expect(parsed).toStrictEqual({ type: 'error', id: 9, code: 'workerFailed' });
    expect(JSON.stringify(parsed)).not.toContain('RAW-EXCEPTION-CANARY');
  });

  it.each(['timedOut', 'superseded', 'unknown', '', 42])(
    'rejects an error code the worker may not send (%s)',
    (code) => {
      // timedOut / superseded are synthesized by the host only; red if the worker could forge them.
      expect(parseInspectionResponse({ type: 'error', id: 9, code })).toBeNull();
    }
  );

  it.each([
    ['a numeric string', '4'],
    ['zero', 0],
    ['negative', -4],
    ['fractional', 4.5],
    ['unsafe', Number.MAX_SAFE_INTEGER + 1],
    ['missing', undefined],
  ])('rejects a %s id on success and error responses', (_label, id) => {
    expect(parseInspectionResponse({ type: 'success', id, result: baseCharacter() })).toBeNull();
    expect(parseInspectionResponse({ type: 'error', id, code: 'unreadable' })).toBeNull();
  });

  it.each([
    ['an unknown type', { type: 'progress', id: 4 }],
    ['a request echoed back', { type: 'inspect', id: 4, bytes: new ArrayBuffer(1) }],
    ['a success without a result', { type: 'success', id: 4 }],
    ['a success with an invalid result', { type: 'success', id: 4, result: { slots: [] } }],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'success'],
    ['an array', ['success', 4]],
  ])('returns null for %s', (_label, value) => {
    expect(parseInspectionResponse(value)).toBeNull();
  });

  it('returns null when the success result fails validation (a non-null match on unknown activation)', () => {
    const d = draft();
    slotNamed(d, 'hair').active = null;
    expect(parseInspectionResponse({ type: 'success', id: 4, result: d })).toBeNull();
  });
});

describe('validateImportedCharacter', () => {
  it('accepts a valid projection and returns it unchanged', () => {
    const base = baseCharacter();
    expect(validateImportedCharacter(base)).toEqual(base);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an array', []],
    ['a string', 'character'],
    ['a number', 7],
  ])('rejects %s', (_label, value) => {
    expect(validateImportedCharacter(value)).toBeNull();
  });

  describe('appearance slots: exactly the eight, each once', () => {
    it('rejects seven slots', () => {
      const d = draft();
      d.slots = d.slots.filter((s) => s.slot !== 'facePaint');
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('rejects nine slots (one repeated)', () => {
      const d = draft();
      d.slots.push(structuredClone(slotNamed(d, 'hair')));
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('rejects eight slots with a duplicate (facePaint missing, hair twice)', () => {
      // Red if only the count is checked, not uniqueness.
      const d = draft();
      d.slots = d.slots.map((s) => (s.slot === 'facePaint' ? { ...slotNamed(d, 'hair') } : s));
      expect(d.slots).toHaveLength(8);
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('rejects eight unique slots when one is not an appearance slot', () => {
      const d = draft();
      slotNamed(d, 'facePaint').slot = 'tail';
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('rejects slots that are not an array', () => {
      const d = draft() as LooseRecord;
      d.slots = { leftEye: slot('leftEye') };
      expect(validateImportedCharacter(d)).toBeNull();
    });
  });

  describe('gear models: at most twelve, unique', () => {
    function models(count: number): LooseRecord[] {
      return GEAR_SLOTS.slice(0, count).map((s, i) => ({ slot: s, base: 100 + i, variant: 1 }));
    }

    it('accepts twelve unique models (every gear slot)', () => {
      const d = draft();
      d.gearModels = models(12);
      expect(validateImportedCharacter(d)).toEqual(d);
    });

    it('rejects thirteen models', () => {
      // With 12 gear slots a 13th model must repeat one, so the uniqueness check rejects this
      // first; the count cap is redundant (see MAX_GEAR_MODELS) and no test reaches it alone.
      const d = draft();
      d.gearModels = [...models(12), { slot: 'Body', base: 999, variant: 2 }];
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('rejects an identical model listed twice', () => {
      // Red if models are only counted, not de-duplicated.
      const d = draft();
      d.gearModels = [...models(3), { ...models(3)[1] }];
      expect(validateImportedCharacter(d)).toBeNull();
    });
  });

  describe('dye channels: at most twenty-four', () => {
    function channels(count: number): LooseRecord[] {
      const all = GEAR_SLOTS.flatMap((s) =>
        [1, 2].map((channel) => ({ slot: s, channel, stainId: 5, dye: null }))
      );
      return all.slice(0, count);
    }

    it('accepts twenty-four channels', () => {
      const d = draft();
      d.gearDyes = channels(24);
      expect(validateImportedCharacter(d)).toEqual(d);
    });

    it('rejects twenty-five channels', () => {
      // A 25th channel must repeat a (slot, channel) pair, so the uniqueness check rejects this
      // first; the count cap is redundant (see MAX_DYE_CHANNELS) and no test reaches it alone.
      const d = draft();
      d.gearDyes = [...channels(24), { slot: 'Body', channel: 1, stainId: 6, dye: null }];
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('rejects a channel other than 1 or 2', () => {
      const d = draft();
      d.gearDyes[0].channel = 3;
      expect(validateImportedCharacter(d)).toBeNull();
    });
  });

  describe('diagnostics: at most sixty-four', () => {
    function issues(count: number): LooseRecord[] {
      return Array.from({ length: count }, (_, i) => ({
        code: 'PALETTE_UNAVAILABLE',
        severity: 'warning',
        path: ['LeftEyeColor', i],
      }));
    }

    it('accepts sixty-four diagnostics', () => {
      const d = draft();
      d.issues = issues(64);
      expect(validateImportedCharacter(d)).toEqual(d);
    });

    it('rejects sixty-five diagnostics', () => {
      const d = draft();
      d.issues = issues(65);
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('rejects a diagnostic severity outside info / warning / error', () => {
      const d = draft();
      d.issues[0].severity = 'fatal';
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('accepts a 32-segment diagnostic path and rejects a 33-segment one', () => {
      // Red if the path segment cap moves or is dropped (core's projection caps paths at 32).
      const ok = draft();
      ok.issues[0].path = Array.from({ length: 32 }, (_, i) => i);
      expect(validateImportedCharacter(ok)).toEqual(ok);
      const over = draft();
      over.issues[0].path = Array.from({ length: 33 }, (_, i) => i);
      expect(validateImportedCharacter(over)).toBeNull();
    });
  });

  describe('hex values: canonical #RRGGBB uppercase or null', () => {
    const NON_CANONICAL = [
      ['lowercase', '#abcdef'],
      ['short', '#ABC'],
      ['with alpha', '#AABBCCDD'],
      ['without hash', 'AABBCC'],
      ['non-hex digits', '#GGGGGG'],
      ['a number', 0xaabbcc],
    ] as const;
    const FIELDS = ['creatorHex', 'shaderHex', 'extendedHex', 'effectiveExtendedHex'] as const;

    it.each(FIELDS)('accepts null and an uppercase value in %s', (field) => {
      const nullDraft = draft();
      slotNamed(nullDraft, 'skin')[field] = null;
      expect(validateImportedCharacter(nullDraft)).toEqual(nullDraft);
      const upperDraft = draft();
      slotNamed(upperDraft, 'skin')[field] = '#A1B2C3';
      expect(validateImportedCharacter(upperDraft)).toEqual(upperDraft);
    });

    for (const field of FIELDS) {
      it.each(NON_CANONICAL)(`rejects a %s ${field}`, (_label, value) => {
        const d = draft();
        slotNamed(d, 'skin')[field] = value;
        expect(validateImportedCharacter(d)).toBeNull();
      });
    }

    it.each(NON_CANONICAL)(
      'rejects a %s displayHex on a slot that has no match',
      (_label, value) => {
        // matchHex is null and the slot inactive, so only the hex rule can reject this.
        const d = draft();
        const s = slotNamed(d, 'highlights');
        s.active = false;
        s.interpretation = 'inactive';
        s.reason = 'highlightsDisabled';
        s.matchHex = null;
        s.displayHex = value;
        expect(validateImportedCharacter(d)).toBeNull();
      }
    );

    it('rejects a lowercase match that equals a lowercase display', () => {
      // Red if matchHex is checked only for equality with displayHex and never for canonical form.
      const d = draft();
      const s = slotNamed(d, 'hair');
      s.displayHex = '#a85726';
      s.matchHex = '#a85726';
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('accepts an uppercase lip composite and rejects a lowercase one', () => {
      const ok = draft();
      slotNamed(ok, 'lip').lipComposite = { hex: '#A0B0C0', alpha: 0.5, derived: true };
      expect(validateImportedCharacter(ok)).toEqual(ok);
      const bad = draft();
      slotNamed(bad, 'lip').lipComposite = { hex: '#a0b0c0', alpha: 0.5, derived: true };
      expect(validateImportedCharacter(bad)).toBeNull();
    });
  });

  describe('uint16 identifiers: model lanes, dye and facewear ids', () => {
    type Setter = (d: Loose, value: unknown) => void;
    const LANES: Array<[string, Setter]> = [
      ['gear model base', (d, v) => (d.gearModels[0].base = v)],
      ['gear model variant', (d, v) => (d.gearModels[0].variant = v)],
      ['weapon model set', (d, v) => (d.gearModels[1].set = v)],
      ['dye stain id', (d, v) => (d.gearDyes[0].stainId = v)],
      ['facewear id', (d, v) => (d.glassesId = v)],
    ];

    it.each(LANES)('accepts 65535 as a %s', (_label, set) => {
      const d = draft();
      set(d, 65_535);
      expect(validateImportedCharacter(d)).toEqual(d);
    });

    for (const [label, set] of LANES) {
      it.each([
        ['65536', 65_536],
        ['negative', -1],
        ['fractional', 1.5],
        ['a numeric string', '7'],
        ['NaN', Number.NaN],
      ])(`rejects a %s ${label}`, (_valueLabel, value) => {
        const d = draft();
        set(d, value);
        expect(validateImportedCharacter(d)).toBeNull();
      });
    }
  });

  describe('local labels: at most 256 UTF-16 code units', () => {
    it.each(['producer', 'nickname'] as const)('accepts 256 units and null in %s', (field) => {
      const ascii = draft();
      ascii[field] = 'a'.repeat(256);
      expect(validateImportedCharacter(ascii)).toEqual(ascii);
      const astral = draft();
      // 128 astral characters = 256 UTF-16 code units
      astral[field] = '\u{1F600}'.repeat(128);
      expect(validateImportedCharacter(astral)).toEqual(astral);
      const empty = draft();
      empty[field] = null;
      expect(validateImportedCharacter(empty)).toEqual(empty);
    });

    it.each(['producer', 'nickname'] as const)('rejects 257 units in %s', (field) => {
      const ascii = draft();
      ascii[field] = 'a'.repeat(257);
      expect(validateImportedCharacter(ascii)).toBeNull();
      // 129 code points but 257 UTF-16 units: red if the bound counts code points, not units.
      const astral = draft();
      astral[field] = '\u{1F600}'.repeat(128) + 'a';
      expect(validateImportedCharacter(astral)).toBeNull();
    });

    it.each(['producer', 'nickname'] as const)('rejects a non-string %s', (field) => {
      const d = draft();
      d[field] = 42;
      expect(validateImportedCharacter(d)).toBeNull();
    });
  });

  describe('serialized size: at most 256 KiB', () => {
    /** The ASCII base with one issue code padded so its JSON is exactly `target` characters. */
    function sized(target: number): Loose {
      const d = draft();
      d.issues = [{ code: 'X', severity: 'info', path: [] }];
      const unpadded = JSON.stringify(d).length;
      d.issues[0].code = 'X'.repeat(1 + target - unpadded);
      return d;
    }

    it('accepts a projection whose JSON is exactly 256 KiB', () => {
      const d = sized(KIB_256);
      const json = JSON.stringify(d);
      expect(json.length).toBe(KIB_256);
      expect(new TextEncoder().encode(json).length).toBe(KIB_256);
      expect(validateImportedCharacter(d)).toEqual(d);
    });

    it('rejects a projection whose JSON is one byte over 256 KiB', () => {
      const d = sized(KIB_256 + 1);
      expect(JSON.stringify(d).length).toBe(KIB_256 + 1);
      expect(validateImportedCharacter(d)).toBeNull();
    });
  });

  describe('matchHex follows the shared matching rule', () => {
    it('accepts a non-null match on a confirmed-active, resolved slot equal to its display', () => {
      const d = draft();
      const hair = slotNamed(d, 'hair');
      hair.interpretation = 'offGrid';
      hair.reason = 'offGrid';
      hair.displayHex = '#123456';
      hair.matchHex = '#123456';
      expect(validateImportedCharacter(d)).toEqual(d);
    });

    it('accepts a null match on unknown activation that keeps its display as evidence', () => {
      const d = draft();
      const s = slotNamed(d, 'lip');
      s.active = null;
      s.reason = 'activityUnknown';
      s.matchHex = null;
      expect(validateImportedCharacter(d)).toEqual(d);
    });

    it('rejects a non-null match on unknown activation (active: null)', () => {
      // FINDING-003: unknown activation keeps its color as evidence but never matches.
      const d = draft();
      const s = slotNamed(d, 'lip');
      s.active = null;
      s.reason = 'activityUnknown';
      expect(s.matchHex).toBe(s.displayHex);
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('rejects a match that differs from displayHex', () => {
      const d = draft();
      slotNamed(d, 'skin').matchHex = '#000000';
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('rejects a non-null match on an inactive slot (active: false)', () => {
      const d = draft();
      slotNamed(d, 'highlights').active = false;
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it.each(['inactive', 'unresolved'] as const)(
      'rejects a non-null match when the interpretation is %s',
      (interpretation) => {
        const d = draft();
        slotNamed(d, 'facePaint').interpretation = interpretation;
        expect(validateImportedCharacter(d)).toBeNull();
      }
    );

    it('rejects a non-null match when displayHex is null', () => {
      const d = draft();
      slotNamed(d, 'leftEye').displayHex = null;
      expect(validateImportedCharacter(d)).toBeNull();
    });
  });

  describe('raw document data is rejected, not stripped', () => {
    it.each([
      ['document', { Nickname: 'RAW-CANARY' }],
      ['raw', 'RAW-CANARY'],
      ['fields', { Hair: { state: 'valid', value: 1 } }],
      ['inspection', { identity: {} }],
    ])('rejects a top-level %s field', (key, value) => {
      const d = draft();
      d[key] = value;
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it.each([
      ['storedExtended', { state: 'valid', value: [0.1, 0.2, 0.3] }],
      ['storedIndex', { state: 'valid', value: 3 }],
      ['raw', 'RAW-CANARY'],
    ])('rejects a slot carrying %s', (key, value) => {
      const d = draft();
      slotNamed(d, 'skin')[key] = value;
      expect(validateImportedCharacter(d)).toBeNull();
    });
  });

  describe('arrays are dense and index-only (structured clone keeps non-index properties)', () => {
    type ArrayPick = (d: Loose) => unknown[];
    const ARRAYS: Array<[string, ArrayPick]> = [
      ['slots', (d) => d.slots],
      ['gearModels', (d) => d.gearModels],
      ['gearDyes', (d) => d.gearDyes],
      ['issues', (d) => d.issues],
      ['an issue path', (d) => d.issues[0].path as unknown[]],
    ];

    it.each(ARRAYS)('rejects a non-index property on %s', (_label, pick) => {
      // Red if an array is checked only by Array.isArray + length + elements: the extra property
      // survives postMessage and never shows up in JSON.stringify.
      const d = draft();
      (pick(d) as unknown as LooseRecord).raw = 'RAW-CANARY';
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it.each(ARRAYS)('rejects a non-enumerable non-index property on %s', (_label, pick) => {
      const d = draft();
      Object.defineProperty(pick(d), 'raw', { value: 'RAW-CANARY', enumerable: false });
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('rejects an oversized non-index payload that JSON.stringify cannot see', () => {
      // Red if the 256 KiB bound is measured on the received object rather than the rebuilt one.
      const d = draft();
      (d.issues as unknown as LooseRecord).document = 'x'.repeat(1_000_000);
      expect(JSON.stringify(d).length).toBeLessThan(KIB_256);
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('rejects sparse issues', () => {
      const d = draft();
      const sparse: LooseRecord[] = [];
      sparse[0] = d.issues[0];
      sparse[2] = structuredClone(d.issues[0]);
      expect(sparse).toHaveLength(3);
      d.issues = sparse;
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('rejects a sparse issue path', () => {
      const d = draft();
      const path: unknown[] = [];
      path[0] = 'LeftEyeColor';
      path[2] = 1;
      d.issues[0].path = path;
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it.each([
      ['gearModels', (d: Loose) => d.gearModels],
      ['gearDyes', (d: Loose) => d.gearDyes],
    ])('rejects sparse %s', (_label, pick) => {
      const d = draft();
      const list = pick(d);
      list.length = list.length + 1;
      expect(validateImportedCharacter(d)).toBeNull();
    });
  });

  describe('every value is read once from a plain data property (F8)', () => {
    it('rejects a getter whose value changes between reads', () => {
      // Red if a property is read more than once: the first read passes the label bound, a later
      // one would hand the page 10,000 characters.
      const d = draft();
      let reads = 0;
      Object.defineProperty(d, 'nickname', {
        enumerable: true,
        get: () => (++reads === 1 ? null : 'x'.repeat(10_000)),
      });
      const result = validateImportedCharacter(d);
      expect(result).toBeNull();
    });

    it('rejects a getter on a slot field', () => {
      const d = draft();
      const skin = slotNamed(d, 'skin');
      const hex = skin.displayHex;
      Object.defineProperty(skin, 'displayHex', { enumerable: true, get: () => hex });
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('rejects a non-enumerable extra key on the character', () => {
      // Red if keys are listed with Object.keys, which skips non-enumerable properties.
      const d = draft();
      Object.defineProperty(d, 'document', { value: { raw: 'RAW-CANARY' }, enumerable: false });
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('rejects a non-enumerable extra key on a slot', () => {
      const d = draft();
      Object.defineProperty(slotNamed(d, 'hair'), 'storedIndex', {
        value: { state: 'valid', value: 3 },
        enumerable: false,
      });
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('rejects a symbol-keyed extra property', () => {
      const d = draft() as unknown as Record<symbol, unknown>;
      d[Symbol('raw')] = 'RAW-CANARY';
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it('returns a rebuilt object that shares no object or array with the input', () => {
      // Red if the validator returns the received object (or any part of it) by reference.
      const d = draftWithDye();
      slotNamed(d, 'lip').lipComposite = { hex: '#A0B0C0', alpha: 0.5, derived: true };
      d.issues[0].path = ['Body', 0];
      const result = validateImportedCharacter(d);
      expect(result).toEqual(d);
      const inputNodes = nodesOf(d);
      const outputNodes = nodesOf(result);
      expect(outputNodes.size).toBe(inputNodes.size);
      for (const node of outputNodes) expect(inputNodes.has(node)).toBe(false);
    });

    it('returns a plain object even when the input is a class instance with the same fields', () => {
      class Shaped {
        constructor(source: LooseRecord) {
          Object.assign(this, source);
        }
      }
      const d = new Shaped(draft());
      const result = validateImportedCharacter(d);
      expect(result).not.toBeNull();
      expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    });
  });

  describe('dye objects: the offline database shape, allowlisted (F4)', () => {
    it('accepts a real dye object (lowercase hex) and carries every field of it', () => {
      const d = draftWithDye();
      expect((d.gearDyes[0].dye as LooseRecord).hex).toMatch(/^#[0-9a-f]{6}$/);
      const result = validateImportedCharacter(d);
      expect(result).toEqual(d);
      expect(result?.gearDyes[0].dye).toStrictEqual(realDye(86));
    });

    it('rejects an extra key on a dye', () => {
      // Red if only `dye.stainID` is checked: anything else could ride along in the dye object.
      const d = draftWithDye();
      (d.gearDyes[0].dye as LooseRecord).raw = 'RAW-CANARY';
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it.each(['nameLower', 'lab', 'legacyItemID', 'hex', 'isMetallic', 'currency'])(
      'rejects a dye without %s',
      (key) => {
        const d = draftWithDye();
        delete (d.gearDyes[0].dye as LooseRecord)[key];
        expect(validateImportedCharacter(d)).toBeNull();
      }
    );

    it('rejects a dye whose stainID differs from the badge', () => {
      const d = draftWithDye();
      d.gearDyes[0].stainId = 85;
      expect(validateImportedCharacter(d)).toBeNull();
    });

    type DyeSetter = (dye: LooseRecord) => void;
    it.each<[string, DyeSetter]>([
      ['a numeric hex', (dye) => (dye.hex = 0xe2000e)],
      ['a hex that is not #RRGGBB', (dye) => (dye.hex = 'red')],
      ['a string flag', (dye) => (dye.isMetallic = 'yes')],
      ['a numeric name', (dye) => (dye.name = 7)],
      ['a fractional itemID', (dye) => (dye.itemID = 1.5)],
      ['a non-finite cost', (dye) => (dye.cost = Number.POSITIVE_INFINITY)],
      ['a numeric currency', (dye) => (dye.currency = 42)],
      ['an unknown consolidation type', (dye) => (dye.consolidationType = 'D')],
      ['an rgb with an extra channel', (dye) => ((dye.rgb as LooseRecord).a = 1)],
      ['an hsv channel that is a string', (dye) => ((dye.hsv as LooseRecord).h = '1')],
      ['a NaN lab channel', (dye) => ((dye.lab as LooseRecord).L = Number.NaN)],
      ['an array for rgb', (dye) => (dye.rgb = [226, 0, 14])],
    ])('rejects a dye with %s', (_label, set) => {
      const d = draftWithDye();
      set(d.gearDyes[0].dye as LooseRecord);
      expect(validateImportedCharacter(d)).toBeNull();
    });

    it.each<[string, DyeSetter]>([
      ['a null currency', (dye) => (dye.currency = null)],
      ['a null consolidation type', (dye) => (dye.consolidationType = null)],
      ['a null legacyItemID', (dye) => (dye.legacyItemID = null)],
    ])('accepts a dye with %s', (_label, set) => {
      const d = draftWithDye();
      set(d.gearDyes[0].dye as LooseRecord);
      expect(validateImportedCharacter(d)).toEqual(d);
    });
  });
});
