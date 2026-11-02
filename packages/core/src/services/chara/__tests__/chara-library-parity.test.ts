/**
 * Library regression cases for XIVCharaKit (readChara -> inspectChara -> resolveAppearance).
 *
 * This corpus began as a comparison with the retired host parser and resolver. Case titles,
 * classifications and notes retain that historical comparison and its source references; only the
 * library expectations execute now. The hand-written document and library expectation for every
 * case remain the compatibility register in docs/research/2026-10-22-xivcharakit-integration.md.
 *
 * The library uses its bundled palette provider, a test-only import that matches the application
 * bridge on all 26,496 creator and shader requests.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { readChara, inspectChara, type CharaInspection } from 'xivcharakit';
import {
  createDefaultPaletteProvider,
  type PaletteColor,
  type PaletteProvider,
  type PaletteRequest,
} from 'xivcharakit/palettes';
import { resolveAppearance } from 'xivcharakit/appearance';
import type { CharaSlotId, CharaGearSlotId } from '../chara-types.js';

// ---------------------------------------------------------------- case schema

type Classification = 'preserved' | 'intentional';

type FieldExpect = {
  state: 'absent' | 'null' | 'valid' | 'invalid' | 'unsupported';
  value?: unknown;
  /** The raw evidence the library kept (absent for an absent field). */
  raw?: unknown;
};

interface LibSlotExpect {
  kind?: string;
  active?: boolean | null;
  interpretation?: 'palette' | 'offGrid' | 'extendedOnly' | 'inactive' | 'unresolved';
  reason?: string;
  displayHex?: string | null;
  creatorHex?: string | null;
  shaderHex?: string | null;
  extendedHex?: string | null;
  effectiveExtendedHex?: string | null;
  extendedActive?: boolean;
  correction?: 'historicalEyePairSwap' | null;
  indexMeaning?: 'color' | 'furPattern' | 'unknown';
  sheetIndex?: number | null;
  variant?: 'dark' | 'light' | null;
  alpha?: number | null;
  /** `null` asserts that no lip composite exists. */
  lipCompositeHex?: string | null;
  deltaE?: null | { max: number } | { min: number };
  storedIndex?: FieldExpect;
}

interface LibEquipmentExpect {
  status?: 'absent' | 'null' | 'invalid' | 'empty' | 'worn';
  /** `null` asserts that the library returned no model. */
  model?: null | { set?: number; base: number; variant: number };
  /** Lane field states: pin WHICH lane is invalid/null/absent. */
  set?: FieldExpect;
  base?: FieldExpect;
  variant?: FieldExpect;
  dye1?: FieldExpect;
  dye2?: FieldExpect;
}

interface LibExpect {
  /** `readChara` refuses the document with this `CharaInputError` code. */
  refused?: string;
  identity?: {
    canonicalRace?: string | null;
    raceSource?: 'tribe' | 'race' | null;
    race?: FieldExpect;
    tribe?: FieldExpect;
    gender?: FieldExpect;
  };
  slots?: Partial<Record<CharaSlotId, LibSlotExpect>>;
  equipment?: Partial<Record<CharaGearSlotId, LibEquipmentExpect>>;
  facewear?: FieldExpect;
  eyesShareIndex?: boolean;
  /** Number of eye-pair corrections recorded on the appearance result. */
  corrections?: number;
  /** Issue codes that must be present among the inspection + appearance issues. */
  issueCodes?: string[];
  /** Issue codes that must be absent. */
  noIssueCodes?: string[];
  /** Issues that must be present with exactly this structured path (ties a code to one field/slot). */
  issues?: { code: string; path: (string | number)[] }[];
  /** `inspection.document.hasEmbeddedImage` (the image itself is never retained). */
  hasEmbeddedImage?: boolean;
  /** `inspection.document.embeddedImages[].type`, in order. */
  embeddedImageTypes?: string[];
}

interface ParityCase {
  /** Stable register id, `<AREA>-<NN>` (for example `ACT-03`). Unique across all sections. */
  id: string;
  title: string;
  /** The plan compatibility-table row (or review-focus item) this case pins. */
  planRow: string;
  /** The document as an object, or raw JSON text for malformed input. */
  doc: Record<string, unknown> | string;
  /**
   * `preserved`: the new import must read the document the way the host does today.
   * `intentional`: the host and the library differ on purpose and the library side is the new behavior.
   */
  classification: Classification;
  /** True when a library result that differs from `lib` blocks adoption (a required alias or contract). */
  blocksIfDiverges?: boolean;
  /** One or two sentences: why the expectations are what they are, citing the plan row or api.md. */
  note: string;
  /**
   * Library palette provider (all echo the request coordinates, tribe and gender):
   * - 'bundled' (default): the library's default provider, whose data equals the host's sheets.
   * - 'gray': every request, creator or shader, answers #808080.
   * - 'noShader': creator requests answer #808080; every shader request answers null (to reach
   *   `missingShaderReference`).
   * - 'noCreator': creator requests answer null; shader requests answer #808080 (to reach
   *   `missingPaletteEntry`).
   * - 'tagged': the colour encodes the request, so the palette the library asked for is visible even
   *   where two sheets hold identical colours. Hex = '#' + PP + TT + II, each pair two uppercase hex
   *   digits: PP = palette ordinal (01 eyes, 02 highlights, 03 features, 04 lipsDark, 05 lipsLight,
   *   06 facePaintDark, 07 facePaintLight, 08 skin, 09 hair), TT = 00 for a creator request and FF for
   *   a shader request, II = the in-sheet index. Example: a light lip at file index 140 (in-sheet 12)
   *   has creatorHex '#05000C' and shaderHex '#04FF0C' (the shader reference is always lipsDark).
   */
  provider?: 'bundled' | 'gray' | 'noShader' | 'noCreator' | 'tagged';
  /** Library appearance policy overrides. */
  policy?: { historicalEyeCorrection?: boolean; offGridDeltaE?: number; eyeMatchDeltaE?: number };
  lib: LibExpect;
}

// -------------------------------------------------------------- document helpers

/** Identity every case starts from unless it says otherwise (an Elezen Wildwood woman). */
const char = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  Race: 'Elezen',
  Tribe: 'Wildwood',
  Gender: 'Feminine',
  ...extra,
});

/** An armor/accessory record the way every producer writes it. */
const armor = (base: number, variant: number, dye1 = 0, dye2 = 0): Record<string, unknown> => ({
  ModelBase: base,
  ModelVariant: variant,
  DyeId: dye1,
  DyeId2: dye2,
});

/** A weapon record: the weapon triple plus the two dye channels. */
const weapon = (
  set: number,
  base: number,
  variant: number,
  dye1 = 0,
  dye2 = 0,
): Record<string, unknown> => ({
  ModelSet: set,
  ModelBase: base,
  ModelVariant: variant,
  DyeId: dye1,
  DyeId2: dye2,
});

/**
 * A stored extended float for an sRGB color the way the game writes it: each channel squared
 * (gamma 2.0), eight decimals, "r, g, b" separated by comma-space.
 */
const squared = (hex: string, alpha?: number): string => {
  const n = parseInt(hex.replace('#', ''), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    ((c / 255) ** 2).toFixed(8),
  );
  return (alpha === undefined ? channels : [...channels, String(alpha)]).join(', ');
};

const upper = (v: string | null | undefined): string | null | undefined =>
  typeof v === 'string' ? v.toUpperCase() : v;

const text = (c: ParityCase): string => (typeof c.doc === 'string' ? c.doc : JSON.stringify(c.doc));

function assertDelta(
  got: number | null,
  want: null | { max: number } | { min: number },
  at: string,
): void {
  if (want === null) return void expect(got, at).toBeNull();
  expect(got, at).not.toBeNull();
  if (got === null) return;
  if ('max' in want) expect(got, at).toBeLessThanOrEqual(want.max);
  else expect(got, at).toBeGreaterThanOrEqual(want.min);
}

// ----------------------------------------------------------------- registration

/** Case-table sanity: unique ids and a non-vacuous library expectation for every case. */
function registerIntegrityTests(cases: ParityCase[]): void {
  describe('[register] case table', () => {
    it('has unique ids of the form AREA-NN', () => {
      const ids = cases.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[A-Z]{2,5}-\d{2}$/);
    });
    it('asserts something on the library side of every case', () => {
      for (const c of cases) {
        expect(Object.keys(c.lib).length, `${c.id} lib`).toBeGreaterThan(0);
        expect(c.note.length, `${c.id} note`).toBeGreaterThan(20);
      }
    });
  });
}

/** Returns #808080 for every request, echoing its coordinates — for activation tuples. */
function grayProvider(): PaletteProvider {
  return {
    async getColor(request: PaletteRequest): Promise<PaletteColor> {
      return { ...request, hex: '#808080', rgb: [128, 128, 128], datasetVersion: 'parity-gray/1' };
    },
  };
}

const bundled = createDefaultPaletteProvider();

const PALETTE_ORDINAL: Record<string, number> = {
  eyes: 1,
  highlights: 2,
  features: 3,
  lipsDark: 4,
  lipsLight: 5,
  facePaintDark: 6,
  facePaintLight: 7,
  skin: 8,
  hair: 9,
};
const pair = (n: number): string => n.toString(16).toUpperCase().padStart(2, '0');

/** Synthetic providers described on `ParityCase.provider`. */
function syntheticProvider(kind: 'noShader' | 'noCreator' | 'tagged'): PaletteProvider {
  return {
    async getColor(request: PaletteRequest): Promise<PaletteColor | null> {
      if (kind === 'noShader' && request.table === 'shader') return null;
      if (kind === 'noCreator' && request.table === 'creator') return null;
      if (kind !== 'tagged')
        return {
          ...request,
          hex: '#808080',
          rgb: [128, 128, 128],
          datasetVersion: `parity-${kind}/1`,
        };
      const p = PALETTE_ORDINAL[request.palette];
      const t = request.table === 'shader' ? 255 : 0;
      return {
        ...request,
        hex: `#${pair(p)}${pair(t)}${pair(request.index)}`,
        rgb: [p, t, request.index],
        datasetVersion: 'parity-tagged/1',
      };
    },
  };
}

function providerFor(c: ParityCase): PaletteProvider {
  const kind = c.provider ?? 'bundled';
  if (kind === 'bundled') return bundled;
  if (kind === 'gray') return grayProvider();
  return syntheticProvider(kind);
}

async function runLib(c: ParityCase) {
  try {
    const inspection: CharaInspection = inspectChara(readChara(text(c)));
    const appearance = await resolveAppearance(inspection, {
      palettes: providerFor(c),
      ...(c.policy ? { policy: c.policy } : {}),
    });
    return { ok: true as const, inspection, appearance };
  } catch (error) {
    return { ok: false as const, error };
  }
}

function assertLib(c: ParityCase, result: Awaited<ReturnType<typeof runLib>>): void {
  const want = c.lib;
  if (want.refused !== undefined) {
    expect(result.ok, `${c.id}: readChara should refuse this document`).toBe(false);
    if (result.ok) return;
    expect((result.error as { code?: string }).code).toBe(want.refused);
    return;
  }
  if (!result.ok) throw result.error;
  const { inspection, appearance } = result;
  const id = want.identity;
  if (id) {
    if (id.canonicalRace !== undefined)
      expect(inspection.identity.canonicalRace).toBe(id.canonicalRace);
    if (id.raceSource !== undefined) expect(inspection.identity.raceSource).toBe(id.raceSource);
    for (const key of ['race', 'tribe', 'gender'] as const) {
      const w = id[key];
      if (w !== undefined)
        expect(inspection.identity[key], `${c.id} identity.${key}`).toMatchObject(w);
    }
  }
  if (want.facewear !== undefined) expect(inspection.facewear).toMatchObject(want.facewear);
  if (want.eyesShareIndex !== undefined)
    expect(appearance.eyesShareIndex).toBe(want.eyesShareIndex);
  if (want.corrections !== undefined) expect(appearance.corrections.length).toBe(want.corrections);
  const codes = [...inspection.issues, ...appearance.issues].map((i) => i.code);
  for (const code of want.issueCodes ?? []) expect(codes, `${c.id}: issue ${code}`).toContain(code);
  for (const code of want.noIssueCodes ?? [])
    expect(codes, `${c.id}: no issue ${code}`).not.toContain(code);
  const allIssues = [...inspection.issues, ...appearance.issues];
  for (const w of want.issues ?? []) {
    const hit = allIssues.some(
      (i) => i.code === w.code && JSON.stringify(i.path) === JSON.stringify(w.path),
    );
    expect(hit, `${c.id}: issue ${w.code} at ${JSON.stringify(w.path)}`).toBe(true);
  }
  if (want.hasEmbeddedImage !== undefined)
    expect(inspection.document.hasEmbeddedImage, `${c.id} hasEmbeddedImage`).toBe(
      want.hasEmbeddedImage,
    );
  if (want.embeddedImageTypes !== undefined)
    expect(
      inspection.document.embeddedImages.map((i) => i.type),
      `${c.id} embeddedImages`,
    ).toEqual(want.embeddedImageTypes);

  for (const [slotId, w] of Object.entries(want.slots ?? {}) as [CharaSlotId, LibSlotExpect][]) {
    const got = appearance.slots[slotId];
    const at = `${c.id} lib ${slotId}`;
    if (w.kind !== undefined) expect(got.kind, `${at} kind`).toBe(w.kind);
    if (w.active !== undefined) expect(got.active, `${at} active`).toBe(w.active);
    if (w.interpretation !== undefined)
      expect(got.interpretation, `${at} interpretation`).toBe(w.interpretation);
    if (w.reason !== undefined) expect(got.reason, `${at} reason`).toBe(w.reason);
    if (w.displayHex !== undefined)
      expect(upper(got.displayHex), `${at} displayHex`).toBe(upper(w.displayHex));
    if (w.creatorHex !== undefined)
      expect(upper(got.creatorHex), `${at} creatorHex`).toBe(upper(w.creatorHex));
    if (w.shaderHex !== undefined)
      expect(upper(got.shaderHex), `${at} shaderHex`).toBe(upper(w.shaderHex));
    if (w.extendedHex !== undefined)
      expect(upper(got.extendedHex), `${at} extendedHex`).toBe(upper(w.extendedHex));
    if (w.effectiveExtendedHex !== undefined)
      expect(upper(got.effectiveExtendedHex), `${at} effectiveExtendedHex`).toBe(
        upper(w.effectiveExtendedHex),
      );
    if (w.extendedActive !== undefined)
      expect(got.extendedActive, `${at} extendedActive`).toBe(w.extendedActive);
    if (w.correction !== undefined) expect(got.correction, `${at} correction`).toBe(w.correction);
    if (w.indexMeaning !== undefined)
      expect(got.indexMeaning, `${at} indexMeaning`).toBe(w.indexMeaning);
    if (w.sheetIndex !== undefined) expect(got.sheetIndex, `${at} sheetIndex`).toBe(w.sheetIndex);
    if (w.variant !== undefined) expect(got.variant, `${at} variant`).toBe(w.variant);
    if (w.alpha !== undefined) expect(got.alpha, `${at} alpha`).toBe(w.alpha);
    if (w.lipCompositeHex !== undefined)
      expect(upper(got.lipComposite?.hex ?? null), `${at} lipComposite`).toBe(
        upper(w.lipCompositeHex),
      );
    if (w.deltaE !== undefined) assertDelta(got.deltaE, w.deltaE, `${at} deltaE`);
    if (w.storedIndex !== undefined)
      expect(got.storedIndex, `${at} storedIndex`).toMatchObject(w.storedIndex);
  }

  for (const [slot, w] of Object.entries(want.equipment ?? {}) as [
    CharaGearSlotId,
    LibEquipmentExpect,
  ][]) {
    const got = inspection.equipment[slot];
    const at = `${c.id} lib equipment ${slot}`;
    if (w.status !== undefined) expect(got.status, `${at} status`).toBe(w.status);
    if (w.model !== undefined) {
      if (w.model === null) expect(got.model, `${at} model`).toBeNull();
      else expect(got.model, `${at} model`).toMatchObject(w.model);
    }
    if (w.set !== undefined) expect(got.set, `${at} set`).toMatchObject(w.set);
    if (w.base !== undefined) expect(got.base, `${at} base`).toMatchObject(w.base);
    if (w.variant !== undefined) expect(got.variant, `${at} variant`).toMatchObject(w.variant);
    if (w.dye1 !== undefined) expect(got.dye1, `${at} dye1`).toMatchObject(w.dye1);
    if (w.dye2 !== undefined) expect(got.dye2, `${at} dye2`).toMatchObject(w.dye2);
  }
}

function registerLibraryTests(cases: ParityCase[]): void {
  describe('[library] xivcharakit readChara + inspectChara + resolveAppearance', () => {
    it.each(cases.map((c) => [`${c.id} ${c.title}`, c] as const))('%s', async (_name, c) => {
      assertLib(c, await runLib(c));
    });
  });
}

// ---- section IDN
const idnCasesSection: ParityCase[] = (() => {
  /**
   * IDN: identity, aliases and document shape. Library expectations are derived from
   * `inspect.ts` (enumeration(): numbers are `values[raw - start]` with Race/Tribe start 1 and
   * Gender start 0; strings go through the alias map, then an exact, case-sensitive match; a
   * non-matching string or 0-255 integer is `unsupported`, anything else `invalid`; canonical race
   * comes from a valid Tribe, else from a valid Race only when Tribe is absent/null),
   * `read.ts` (NOT_CHARACTER unless some CHARACTER_FIELDS key is present) and `appearance/resolve.ts`
   * (skin/hair need a valid tribe AND gender, else `missingTribeGender`; limbal kind and lip
   * `indexMeaning` follow canonicalRace). Skin hexes come from lookup.ts (skin index 20).
   */
  const idnCases: ParityCase[] = [
    {
      id: 'IDN-01',
      title: 'legacy Helion tribe reads as Helions (Hrothgar), fur-pattern lip included',
      planRow: 'Legacy `Helion`',
      doc: { Tribe: 'Helion', Gender: 'Masculine', Race: 'Hrothgar', LipsToneFurPattern: 2 },
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Host TRIBE_MAP maps Helion to Helions and keeps tribeRaw "Helion"; library tribeAliases maps Helion to Helions with raw "Helion" kept (compatibility.md "Legacy Helion alias"). Canonical race Hrothgar must then reach the lip: host inerts it as furPattern, library sets indexMeaning furPattern/inactive. A missing alias blocks adoption. This is the one Hrothgar fur-pattern lip case of the IDN section (ACT-25..27 own the rest).',
      lib: {
        identity: {
          tribe: { state: 'valid', value: 'Helions', raw: 'Helion' },
          canonicalRace: 'Hrothgar',
          raceSource: 'tribe',
        },
        slots: {
          lip: {
            indexMeaning: 'furPattern',
            interpretation: 'inactive',
            active: false,
            reason: 'furPattern',
          },
        },
        noIssueCodes: ['RACE_TRIBE_MISMATCH', 'UNSUPPORTED_VALUE'],
      },
    },
    {
      id: 'IDN-02',
      title: 'Midlander Masculine resolves Hyur and the Midlander male skin sheet',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'Hyur', Tribe: 'Midlander', Gender: 'Masculine', Skintone: 20 },
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Tribe determines race on both sides (host SUBRACE_TO_RACE; library RACES[floor(TRIBES.indexOf/2)]). Skin 20 Midlander Masculine is #AB8C71 (Feminine #AE9174, Highlander Masculine #A1846B), so the hex pins tribe AND gender reaching the palette. Wrong tribe-to-race mapping breaks skin/hair, hence blocking.',
      lib: {
        identity: {
          canonicalRace: 'Hyur',
          raceSource: 'tribe',
          tribe: { state: 'valid', value: 'Midlander' },
          gender: { state: 'valid', value: 'Masculine' },
        },
        slots: {
          skin: {
            interpretation: 'palette',
            creatorHex: '#AB8C71',
            displayHex: '#AB8C71',
            reason: 'paletteOnly',
          },
        },
        noIssueCodes: ['RACE_TRIBE_MISMATCH'],
      },
    },
    {
      id: 'IDN-03',
      title: 'Duskwight Feminine resolves Elezen and the Duskwight female skin sheet',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'Elezen', Tribe: 'Duskwight', Gender: 'Feminine', Skintone: 20 },
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Duskwight is TRIBES[3], race index 1 = Elezen on the library side; host SUBRACE_TO_RACE agrees. Skin 20 Duskwight Feminine is #A09E86 (Masculine #9F9984, Wildwood Feminine #AF8D71).',
      lib: {
        identity: {
          canonicalRace: 'Elezen',
          raceSource: 'tribe',
          tribe: { state: 'valid', value: 'Duskwight' },
          gender: { state: 'valid', value: 'Feminine' },
        },
        slots: { skin: { interpretation: 'palette', displayHex: '#A09E86' } },
        noIssueCodes: ['RACE_TRIBE_MISMATCH'],
      },
    },
    {
      id: 'IDN-04',
      title: 'Dunesfolk with the game enum race spelling Lalafel resolves Lalafell, no mismatch',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'Lalafel', Tribe: 'Dunesfolk', Gender: 'Feminine', Skintone: 20 },
      classification: 'preserved',
      note: 'Host derives Lalafell from the tribe and never reads Race. Library raceAliases maps Lalafel to Lalafell (raw "Lalafel" kept), so Race is valid and equals the tribe race: no RACE_TRIBE_MISMATCH. Skin 20 Dunesfolk Feminine is #AB8D70 (Dunesfolk/Plainsfolk Masculine #A69371). Non-blocking: the Race alias beside a valid Tribe only decides the mismatch diagnostic, never canonicalRace.',
      lib: {
        identity: {
          canonicalRace: 'Lalafell',
          raceSource: 'tribe',
          race: { state: 'valid', value: 'Lalafell', raw: 'Lalafel' },
          tribe: { state: 'valid', value: 'Dunesfolk' },
        },
        slots: { skin: { interpretation: 'palette', displayHex: '#AB8D70' } },
        noIssueCodes: ['RACE_TRIBE_MISMATCH', 'UNSUPPORTED_VALUE'],
      },
    },
    {
      id: 'IDN-05',
      title: "KeeperOfTheMoon with race spelling Miqote resolves Miqo'te, no mismatch",
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'Miqote', Tribe: 'KeeperOfTheMoon', Gender: 'Masculine', Skintone: 20 },
      classification: 'preserved',
      note: 'Library raceAliases maps Miqote to Miqo\'te (valid, raw "Miqote" kept, equal to the tribe race, so no mismatch); host derives Miqo\'te from the tribe. Skin 20 KeeperOfTheMoon Masculine is #A79F9A (Feminine #A8A69F, SeekerOfTheSun Masculine #A47D63). Non-blocking: the Race alias beside a valid Tribe only decides the mismatch diagnostic.',
      lib: {
        identity: {
          canonicalRace: "Miqo'te",
          raceSource: 'tribe',
          race: { state: 'valid', value: "Miqo'te", raw: 'Miqote' },
          tribe: { state: 'valid', value: 'KeeperOfTheMoon' },
        },
        slots: { skin: { interpretation: 'palette', displayHex: '#A79F9A' } },
        noIssueCodes: ['RACE_TRIBE_MISMATCH', 'UNSUPPORTED_VALUE'],
      },
    },
    {
      id: 'IDN-06',
      title: 'Hellsguard Feminine resolves Roegadyn and the Hellsguard female skin sheet',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'Roegadyn', Tribe: 'Hellsguard', Gender: 'Feminine', Skintone: 20 },
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Hellsguard is TRIBES[9], race index 4 = Roegadyn; host agrees. Skin 20 Hellsguard Feminine is #8D7771 (Masculine #937C74, SeaWolf Feminine #909F7E).',
      lib: {
        identity: {
          canonicalRace: 'Roegadyn',
          raceSource: 'tribe',
          tribe: { state: 'valid', value: 'Hellsguard' },
        },
        slots: { skin: { interpretation: 'palette', displayHex: '#8D7771' } },
        noIssueCodes: ['RACE_TRIBE_MISMATCH'],
      },
    },
    {
      id: 'IDN-07',
      title: 'Xaela with race spelling AuRa: host AuRa, library Au Ra, limbal ring on both',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'AuRa', Tribe: 'Xaela', Gender: 'Masculine', Skintone: 20, LimbalEyes: 3 },
      classification: 'preserved',
      note: 'Host race type is AuRa; library canonical race is "Au Ra" (the adapter maps it back, plan contract). raceAliases maps AuRa to Au Ra (raw "AuRa" kept), so no mismatch. Au Ra makes LimbalEyes a limbal ring on both sides (host kind via race AuRa, library via canonicalRace Au Ra). Skin 20 Xaela Masculine is #575266 (Feminine #7A4544, Raen Masculine #6B3E3A). Non-blocking: the Race alias beside a valid Tribe only decides the mismatch diagnostic.',
      lib: {
        identity: {
          canonicalRace: 'Au Ra',
          raceSource: 'tribe',
          race: { state: 'valid', value: 'Au Ra', raw: 'AuRa' },
          tribe: { state: 'valid', value: 'Xaela' },
        },
        slots: {
          skin: { interpretation: 'palette', displayHex: '#575266' },
          limbal: { kind: 'limbal', creatorHex: '#B3B3B3' },
        },
        noIssueCodes: ['RACE_TRIBE_MISMATCH', 'UNSUPPORTED_VALUE'],
      },
    },
    {
      id: 'IDN-08',
      title: 'canonical Helions resolves Hrothgar and the Helions skin sheet',
      planRow: 'Legacy `Helion`',
      doc: { Race: 'Hrothgar', Tribe: 'Helions', Gender: 'Masculine', Skintone: 20 },
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'The plural Helions is the canonical spelling (TRIBES[12], race index 6 = Hrothgar), so the alias of IDN-01 must not swallow it: tribe raw stays "Helions" on both sides. Skin 20 Helions is #473523 (TheLost #6C6C6C). The fur-pattern lip is pinned once, in IDN-01.',
      lib: {
        identity: {
          canonicalRace: 'Hrothgar',
          raceSource: 'tribe',
          tribe: { state: 'valid', value: 'Helions', raw: 'Helions' },
        },
        slots: { skin: { interpretation: 'palette', displayHex: '#473523' } },
      },
    },
    {
      id: 'IDN-09',
      title: 'TheLost Feminine resolves Hrothgar and The Lost skin sheet',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'Hrothgar', Tribe: 'TheLost', Gender: 'Feminine', Skintone: 20 },
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'TheLost is TRIBES[13], race index 6 = Hrothgar. Skin 20 TheLost is #6C6C6C (Helions #473523), so the hex pins the tribe reaching the palette. Tribe-to-race/palette mapping for the sixteen tribes is a required contract, hence blocking.',
      lib: {
        identity: {
          canonicalRace: 'Hrothgar',
          raceSource: 'tribe',
          tribe: { state: 'valid', value: 'TheLost' },
        },
        slots: { skin: { interpretation: 'palette', displayHex: '#6C6C6C' } },
      },
    },
    {
      id: 'IDN-10',
      title: 'Rava resolves Viera and the Rava skin sheet',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: {
        Race: 'Viera',
        Tribe: 'Rava',
        Gender: 'Feminine',
        Skintone: 20,
        LipsToneFurPattern: 2,
      },
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Rava is TRIBES[14], race index 7 = Viera. Skin 20 Rava is #694B3D (Veena #DAAA8C). A non-Hrothgar race keeps the lip a colour index (host lip not inert; library indexMeaning color, lipsDark[2] #CCCCCC). Lip activation (no Mouth key) is owned by ACT and deliberately not asserted here.',
      lib: {
        identity: {
          canonicalRace: 'Viera',
          raceSource: 'tribe',
          tribe: { state: 'valid', value: 'Rava' },
        },
        slots: {
          skin: { interpretation: 'palette', displayHex: '#694B3D' },
          lip: { indexMeaning: 'color', creatorHex: '#CCCCCC' },
        },
      },
    },
    {
      id: 'IDN-11',
      title: 'Veena Masculine resolves Viera and the Veena skin sheet',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'Viera', Tribe: 'Veena', Gender: 'Masculine', Skintone: 20 },
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Veena is TRIBES[15] (the last entry), race index 7 = Viera; an off-by-one in the tribe table would fall off the end. Skin 20 Veena is #DAAA8C (Rava #694B3D).',
      lib: {
        identity: {
          canonicalRace: 'Viera',
          raceSource: 'tribe',
          tribe: { state: 'valid', value: 'Veena' },
          gender: { state: 'valid', value: 'Masculine' },
        },
        slots: { skin: { interpretation: 'palette', displayHex: '#DAAA8C' } },
      },
    },
    {
      id: 'IDN-12',
      title: 'unknown (wrong-case) tribe: host refuses, library unsupported with no race fallback',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: { Race: 'Hyur', Tribe: 'midlander', Gender: 'Masculine', LEyeColor: 0 },
      classification: 'intentional',
      note: 'Host mapNamed refuses an unrecognised Tribe (exact own-key lookup). Library matching is case-sensitive, so "midlander" is a string with no match = unsupported (UNSUPPORTED_VALUE); compatibility.md: an unsupported Tribe does not permit Race fallback, so canonicalRace stays null although Race "Hyur" is valid. A bad identity does not discard a race-independent colour: eye 0 still resolves to #F7F7F7.',
      lib: {
        identity: {
          tribe: { state: 'unsupported', raw: 'midlander' },
          race: { state: 'valid', value: 'Hyur' },
          canonicalRace: null,
          raceSource: null,
        },
        slots: {
          leftEye: { interpretation: 'palette', creatorHex: '#F7F7F7', displayHex: '#F7F7F7' },
        },
        issues: [{ code: 'UNSUPPORTED_VALUE', path: ['Tribe'] }],
        noIssueCodes: ['RACE_TRIBE_MISMATCH', 'INVALID_FIELD'],
      },
    },
    {
      id: 'IDN-13',
      title: 'numeric Tribe 12 and Gender 0: host refuses, library reads Xaela Masculine',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Tribe: 12, Gender: 0, Skintone: 20 },
      classification: 'intentional',
      note: 'Host refuses any non-string Tribe (checked before Gender). Library enumeration: Tribe is 1-based (values[12-1] = Xaela), Gender 0-based (values[0] = Masculine). Skin 20 Xaela Masculine #575266 pins both bases: 0-based Tribe would give Helions (#473523), 1-based Gender would give Feminine (#7A4544).',
      lib: {
        identity: {
          tribe: { state: 'valid', value: 'Xaela', raw: 12 },
          gender: { state: 'valid', value: 'Masculine', raw: 0 },
          canonicalRace: 'Au Ra',
          raceSource: 'tribe',
        },
        slots: {
          skin: { interpretation: 'palette', creatorHex: '#575266', displayHex: '#575266' },
        },
        noIssueCodes: ['UNSUPPORTED_VALUE', 'INVALID_FIELD'],
      },
    },
    {
      id: 'IDN-14',
      title: 'numeric Gender 1 beside a string tribe: host refuses, library reads Feminine',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'Elezen', Tribe: 'Wildwood', Gender: 1, Skintone: 20 },
      classification: 'intentional',
      note: 'Host mapNamed refuses a non-string Gender. Library Gender is 0-based, so 1 = Feminine and skin 20 Wildwood Feminine resolves to #AF8D71 (Masculine #AE876E).',
      lib: {
        identity: {
          gender: { state: 'valid', value: 'Feminine', raw: 1 },
          canonicalRace: 'Elezen',
        },
        slots: { skin: { interpretation: 'palette', displayHex: '#AF8D71' } },
        noIssueCodes: ['UNSUPPORTED_VALUE', 'INVALID_FIELD'],
      },
    },
    {
      id: 'IDN-15',
      title:
        'Gender "Male": host maps it to Male, library unsupported so skin and hair lose their sheet',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: char({ Gender: 'Male', Skintone: 20, HairTone: 5 }),
      classification: 'intentional',
      note: 'REGISTER QUESTION (plan row): host GENDER_MAP accepts "Male"; the library knows only Masculine/Feminine, so "Male" is a string with no match = unsupported, current(gender) is null and resolve.ts gives skin/hair missingTribeGender (MISSING_PALETTE_CONTEXT). Host resolves Wildwood Masculine skin 20 #AE876E and hair 5 #515151.',
      lib: {
        identity: {
          gender: { state: 'unsupported', raw: 'Male' },
          tribe: { state: 'valid', value: 'Wildwood' },
          canonicalRace: 'Elezen',
        },
        slots: {
          skin: {
            interpretation: 'unresolved',
            reason: 'missingTribeGender',
            displayHex: null,
            sheetIndex: 20,
          },
          hair: { interpretation: 'unresolved', reason: 'missingTribeGender', displayHex: null },
        },
        issues: [
          { code: 'UNSUPPORTED_VALUE', path: ['Gender'] },
          { code: 'MISSING_PALETTE_CONTEXT', path: ['Skintone'] },
          { code: 'MISSING_PALETTE_CONTEXT', path: ['HairTone'] },
        ],
      },
    },
    {
      id: 'IDN-16',
      title: 'Gender "Female": host maps it to Female, library unsupported (skin unresolved)',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'AuRa', Tribe: 'Xaela', Gender: 'Female', Skintone: 20 },
      classification: 'intentional',
      note: 'REGISTER QUESTION, second spelling: host GENDER_MAP maps "Female" to Female (Xaela Feminine skin 20 #7A4544); library "Female" has no match = unsupported, so skin is missingTribeGender while tribe and canonical race stay valid.',
      lib: {
        identity: {
          gender: { state: 'unsupported', raw: 'Female' },
          canonicalRace: 'Au Ra',
          raceSource: 'tribe',
        },
        slots: {
          skin: { interpretation: 'unresolved', reason: 'missingTribeGender', displayHex: null },
        },
        issues: [
          { code: 'UNSUPPORTED_VALUE', path: ['Gender'] },
          { code: 'MISSING_PALETTE_CONTEXT', path: ['Skintone'] },
        ],
      },
    },
    {
      id: 'IDN-17',
      title: 'tribe-less file with Race Lalafel: race from Race, skin unresolved on both',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'Lalafel', Gender: 'Feminine', Skintone: 20 },
      classification: 'preserved',
      note: 'No Tribe key: host RACE_FALLBACK_MAP maps Lalafel to Lalafell; library raceAliases does too and raceSource is "race" (Tribe absent permits fallback). Skin needs a tribe on both: host error noTribe, library missingTribeGender with the sheet index kept.',
      lib: {
        identity: {
          canonicalRace: 'Lalafell',
          raceSource: 'race',
          race: { state: 'valid', value: 'Lalafell', raw: 'Lalafel' },
          tribe: { state: 'absent' },
        },
        slots: {
          skin: {
            interpretation: 'unresolved',
            reason: 'missingTribeGender',
            sheetIndex: 20,
            displayHex: null,
          },
        },
        issues: [{ code: 'MISSING_PALETTE_CONTEXT', path: ['Skintone'] }],
      },
    },
    {
      id: 'IDN-18',
      title: "tribe-less file with Race Miqote reads Miqo'te on both",
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'Miqote', Gender: 'Masculine', LEyeColor: 0 },
      classification: 'preserved',
      note: "Game enum spelling without the apostrophe: host fallback map Miqote → Miqo'te; library raceAliases Miqote → Miqo'te, raceSource race.",
      lib: {
        identity: {
          canonicalRace: "Miqo'te",
          raceSource: 'race',
          race: { state: 'valid', value: "Miqo'te", raw: 'Miqote' },
        },
        noIssueCodes: ['UNSUPPORTED_VALUE'],
      },
    },
    {
      id: 'IDN-19',
      title: 'tribe-less file with Race AuRa: limbal ring on both sides',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'AuRa', Gender: 'Feminine', LimbalEyes: 3 },
      classification: 'preserved',
      note: 'Host fallback AuRa → AuRa; library raceAliases AuRa → "Au Ra" (raceSource race). The race alone decides limbal vs tattoo: kind limbal on both, features 3 = #B3B3B3 (no tribe needed). Without the alias the library would report limbalOrTattoo.',
      lib: {
        identity: {
          canonicalRace: 'Au Ra',
          raceSource: 'race',
          race: { state: 'valid', value: 'Au Ra', raw: 'AuRa' },
        },
        slots: { limbal: { kind: 'limbal', interpretation: 'palette', displayHex: '#B3B3B3' } },
      },
    },
    {
      id: 'IDN-23',
      title: 'contradictory Race Hyur beside Tribe Raen: tribe wins, library flags the mismatch',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'Hyur', Tribe: 'Raen', Gender: 'Feminine', Skintone: 20, LimbalEyes: 3 },
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Plan: use the canonical race, not a contradictory declared race. Host never reads Race beside a tribe; library canonicalRace comes from the tribe and, since Race is valid and differs, adds RACE_TRIBE_MISMATCH while keeping declared race Hyur visible. Raen Feminine skin 20 #BB856D; Au Ra makes LimbalEyes a limbal ring.',
      lib: {
        identity: {
          canonicalRace: 'Au Ra',
          raceSource: 'tribe',
          race: { state: 'valid', value: 'Hyur' },
          tribe: { state: 'valid', value: 'Raen' },
        },
        slots: {
          skin: { interpretation: 'palette', displayHex: '#BB856D' },
          limbal: { kind: 'limbal' },
        },
        issues: [{ code: 'RACE_TRIBE_MISMATCH', path: ['Race'] }],
      },
    },
    {
      id: 'IDN-24',
      title:
        'unknown Race beside a valid Tribe: host fine, library race unsupported but canonical from tribe',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: { Race: 'Hyuran', Tribe: 'Midlander', Gender: 'Masculine', Skintone: 20 },
      classification: 'preserved',
      note: 'Plan row: an unknown Race never refuses the host file. Library Race "Hyuran" has no match = unsupported (UNSUPPORTED_VALUE), canonicalRace still Hyur from the tribe, and no RACE_TRIBE_MISMATCH because that check requires a valid Race. Skin 20 Midlander Masculine #AB8C71 still resolves.',
      lib: {
        identity: {
          race: { state: 'unsupported', raw: 'Hyuran' },
          canonicalRace: 'Hyur',
          raceSource: 'tribe',
        },
        slots: { skin: { interpretation: 'palette', displayHex: '#AB8C71' } },
        issues: [{ code: 'UNSUPPORTED_VALUE', path: ['Race'] }],
        noIssueCodes: ['RACE_TRIBE_MISMATCH'],
      },
    },
    {
      id: 'IDN-25',
      title: 'null Tribe: both fall back to Race, skin unresolved for lack of a tribe',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: { Race: 'Viera', Tribe: null, Gender: 'Feminine', Skintone: 20 },
      classification: 'preserved',
      note: 'Host mapNamed treats null Tribe as no tribe and reads the Race fallback (Viera). Library Tribe state null permits Race fallback (raceSource race). Skin: host error noTribe, library missingTribeGender.',
      lib: {
        identity: {
          tribe: { state: 'null', raw: null },
          canonicalRace: 'Viera',
          raceSource: 'race',
        },
        slots: { skin: { interpretation: 'unresolved', reason: 'missingTribeGender' } },
        noIssueCodes: ['INVALID_FIELD', 'UNSUPPORTED_VALUE'],
      },
    },
    {
      id: 'IDN-26',
      title: 'object Tribe: host refuses, library invalid with no race fallback',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: { Race: 'Viera', Tribe: { Name: 'Rava' }, Gender: 'Feminine', LEyeColor: 0 },
      classification: 'intentional',
      note: 'Host mapNamed refuses a non-string Tribe. Library: an object is neither a string nor a 0-255 integer, so the state is invalid (INVALID_FIELD, not UNSUPPORTED_VALUE), and an invalid Tribe does not permit the Race fallback: canonicalRace null.',
      lib: {
        identity: {
          tribe: { state: 'invalid', raw: { Name: 'Rava' } },
          race: { state: 'valid', value: 'Viera' },
          canonicalRace: null,
          raceSource: null,
        },
        issues: [{ code: 'INVALID_FIELD', path: ['Tribe'] }],
        noIssueCodes: ['UNSUPPORTED_VALUE'],
      },
    },
    {
      id: 'IDN-27',
      title: 'Tribe "constructor": host refuses, library unsupported',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: { Tribe: 'constructor', Gender: 'Feminine', LEyeColor: 0 },
      classification: 'intentional',
      note: 'Host mapNamed uses Object.hasOwn (FINDING-027), so an inherited key is unrecognised and refused. Library looks the string up in a Map and an array, so it never resolves to a prototype member: unsupported, canonicalRace null.',
      lib: {
        identity: {
          tribe: { state: 'unsupported', raw: 'constructor' },
          canonicalRace: null,
          raceSource: null,
        },
        issues: [{ code: 'UNSUPPORTED_VALUE', path: ['Tribe'] }],
      },
    },
    {
      id: 'IDN-28',
      title: 'Tribe "__proto__": host refuses, library unsupported',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: { Tribe: '__proto__', Gender: 'Masculine', LEyeColor: 0 },
      classification: 'intentional',
      note: 'Host own-key lookup rejects "__proto__" (no own property on TRIBE_MAP). Library: no alias or TRIBES entry matches, so unsupported and canonicalRace null; it must not resolve to Object.prototype.',
      lib: {
        identity: {
          tribe: { state: 'unsupported', raw: '__proto__' },
          canonicalRace: null,
          raceSource: null,
        },
        issues: [{ code: 'UNSUPPORTED_VALUE', path: ['Tribe'] }],
      },
    },
    {
      id: 'IDN-29',
      title:
        'identity plus controls, no colour key: host refuses, library keeps eight unresolved slots',
      planRow: 'Partial equipment-only document',
      doc: char({ Mouth: 128, FacePaint: 1, EnableHighlights: true }),
      classification: 'intentional',
      note: 'Plan row: the host needs one of the 15 colour keys and Mouth/FacePaint/EnableHighlights do not count. The library admits any CHARACTER_FIELDS key; every index is absent so each slot stays interpretation unresolved, reason missingColor (no fabricated colour). The controls make highlights/facePaint/lip active true, so none turns inactive.',
      lib: {
        identity: { canonicalRace: 'Elezen', raceSource: 'tribe' },
        slots: {
          leftEye: { interpretation: 'unresolved', reason: 'missingColor', displayHex: null },
          rightEye: { interpretation: 'unresolved', reason: 'missingColor', displayHex: null },
          hair: { interpretation: 'unresolved', reason: 'missingColor', displayHex: null },
          highlights: { interpretation: 'unresolved', reason: 'missingColor', active: true },
          skin: { interpretation: 'unresolved', reason: 'missingColor', displayHex: null },
          limbal: { interpretation: 'unresolved', reason: 'missingColor', kind: 'tattoo' },
          lip: { interpretation: 'unresolved', reason: 'missingColor', active: true },
          facePaint: { interpretation: 'unresolved', reason: 'missingColor', active: true },
        },
      },
    },
    {
      id: 'IDN-30',
      title: 'equipment-only document: host refuses, library accepts and keeps the worn piece',
      planRow: 'Partial equipment-only document',
      doc: { Body: armor(6100, 1, 36, 0) },
      classification: 'intentional',
      note: 'THE equipment-only case of the register (GEA-32 / ENV-07 duplicated it). Plan row: accept a supported character document, keep valid gear usable, and keep unresolved appearance explicit. Body is a CHARACTER_FIELDS key, so readChara admits it; a complete uint16 armor model (no set lane) with base > 0 is worn. No identity: canonicalRace null, limbal kind limbalOrTattoo, lip indexMeaning unknown. Every index is absent, so each slot returns missingColor at resolve.ts before any palette request or context check: no colour is fabricated and MISSING_PALETTE_CONTEXT is never raised.',
      lib: {
        identity: {
          canonicalRace: null,
          raceSource: null,
          tribe: { state: 'absent' },
          gender: { state: 'absent' },
        },
        equipment: {
          Body: {
            status: 'worn',
            model: { base: 6100, variant: 1 },
            set: { state: 'absent' },
            base: { state: 'valid', value: 6100 },
            variant: { state: 'valid', value: 1 },
            dye1: { state: 'valid', value: 36 },
            dye2: { state: 'valid', value: 0 },
          },
        },
        slots: {
          leftEye: { interpretation: 'unresolved', reason: 'missingColor', displayHex: null },
          hair: { interpretation: 'unresolved', reason: 'missingColor', displayHex: null },
          skin: { interpretation: 'unresolved', reason: 'missingColor', displayHex: null },
          limbal: { kind: 'limbalOrTattoo', interpretation: 'unresolved', reason: 'missingColor' },
          lip: { indexMeaning: 'unknown', interpretation: 'unresolved', reason: 'missingColor' },
        },
        noIssueCodes: ['MISSING_PALETTE_CONTEXT', 'INCOMPLETE_MODEL'],
      },
    },
    {
      id: 'IDN-31',
      title: 'numeric Tribe 0 (below the 1-based start): library unsupported, no Race fallback',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: { Race: 'Viera', Tribe: 0, Gender: 'Feminine', LEyeColor: 0 },
      classification: 'intentional',
      note: 'Host refuses any non-string Tribe. Library Tribe is 1-based, so 0 reads values[-1] = undefined; 0 is a 0-255 integer, so the state is unsupported (UNSUPPORTED_VALUE, not INVALID_FIELD) and an unsupported Tribe permits no Race fallback: canonicalRace null although Race Viera is valid. A 0-based reader would call it Midlander/Hyur. Plan row: preserve valid independent appearance, do not guess missing context.',
      lib: {
        identity: {
          tribe: { state: 'unsupported', raw: 0 },
          race: { state: 'valid', value: 'Viera' },
          canonicalRace: null,
          raceSource: null,
        },
        issues: [{ code: 'UNSUPPORTED_VALUE', path: ['Tribe'] }],
        noIssueCodes: ['INVALID_FIELD'],
      },
    },
    {
      id: 'IDN-32',
      title: 'numeric Tribe 16 (the last 1-based entry): library reads Veena',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Tribe: 16, Gender: 0, Skintone: 20 },
      classification: 'intentional',
      note: 'Host refuses a numeric Tribe. Library: values[16-1] = TRIBES[15] = Veena, race index 7 = Viera; a 0-based reader would fall off the table (unsupported). Skin 20 Veena Masculine is #DAAA8C (Rava #694B3D). The plan row approves the library accepting numeric enums.',
      lib: {
        identity: {
          tribe: { state: 'valid', value: 'Veena', raw: 16 },
          gender: { state: 'valid', value: 'Masculine', raw: 0 },
          canonicalRace: 'Viera',
          raceSource: 'tribe',
        },
        slots: { skin: { interpretation: 'palette', displayHex: '#DAAA8C' } },
        noIssueCodes: ['UNSUPPORTED_VALUE', 'INVALID_FIELD'],
      },
    },
    {
      id: 'IDN-33',
      title: 'numeric Tribe 17 (one past the table): library unsupported, no Race fallback',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: { Race: 'Viera', Tribe: 17, Gender: 'Feminine', LEyeColor: 0 },
      classification: 'intentional',
      note: 'Host refuses a numeric Tribe. Library: values[16] is undefined and 17 is a 0-255 integer, so unsupported (UNSUPPORTED_VALUE); no Race fallback, canonicalRace null. Catches a reader that clamps or wraps the index.',
      lib: {
        identity: {
          tribe: { state: 'unsupported', raw: 17 },
          canonicalRace: null,
          raceSource: null,
        },
        issues: [{ code: 'UNSUPPORTED_VALUE', path: ['Tribe'] }],
        noIssueCodes: ['INVALID_FIELD'],
      },
    },
    {
      id: 'IDN-34',
      title: 'numeric Tribe 256 (wider than a byte): library invalid, not unsupported',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: { Race: 'Viera', Tribe: 256, Gender: 'Feminine', LEyeColor: 0 },
      classification: 'intentional',
      note: 'Host refuses a numeric Tribe. Library: no table entry and isUint(256, 255) is false, so the value cannot be a producer byte: state invalid with INVALID_FIELD (inspect.ts field(): unsupported only for a string or 0-255 integer). No Race fallback.',
      lib: {
        identity: { tribe: { state: 'invalid', raw: 256 }, canonicalRace: null, raceSource: null },
        issues: [{ code: 'INVALID_FIELD', path: ['Tribe'] }],
        noIssueCodes: ['UNSUPPORTED_VALUE'],
      },
    },
    {
      id: 'IDN-35',
      title: 'fractional Tribe 1.5: library invalid, never floored to Midlander',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: { Race: 'Viera', Tribe: 1.5, Gender: 'Feminine', LEyeColor: 0 },
      classification: 'intentional',
      note: 'Host refuses a numeric Tribe. Library enumeration decodes numbers only when Number.isInteger, and isUint rejects a fraction, so 1.5 is invalid (INVALID_FIELD), not floored to values[0] = Midlander; no Race fallback. Plan row: do not silently coerce invalid values.',
      lib: {
        identity: { tribe: { state: 'invalid', raw: 1.5 }, canonicalRace: null, raceSource: null },
        issues: [{ code: 'INVALID_FIELD', path: ['Tribe'] }],
        noIssueCodes: ['UNSUPPORTED_VALUE'],
      },
    },
    {
      id: 'IDN-36',
      title: 'numeric Gender 2 (past the 0-based pair): library unsupported, skin unresolved',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: { Race: 'Elezen', Tribe: 'Wildwood', Gender: 2, Skintone: 20 },
      classification: 'intentional',
      note: 'Host refuses a non-string Gender. Library Gender is 0-based over [Masculine, Feminine]: values[2] is undefined and 2 is a byte, so unsupported (UNSUPPORTED_VALUE); current(gender) is null, so skin is missingTribeGender with MISSING_PALETTE_CONTEXT while tribe and canonical race stay valid. A 1-based Gender reader would give Feminine and resolve #AF8D71.',
      lib: {
        identity: {
          gender: { state: 'unsupported', raw: 2 },
          tribe: { state: 'valid', value: 'Wildwood' },
          canonicalRace: 'Elezen',
        },
        slots: {
          skin: {
            interpretation: 'unresolved',
            reason: 'missingTribeGender',
            sheetIndex: 20,
            displayHex: null,
          },
        },
        issues: [
          { code: 'UNSUPPORTED_VALUE', path: ['Gender'] },
          { code: 'MISSING_PALETTE_CONTEXT', path: ['Skintone'] },
        ],
      },
    },
    {
      id: 'IDN-37',
      title: 'null Gender beside a valid Tribe: neither side guesses a gender for skin and hair',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: char({ Gender: null, Skintone: 20, HairTone: 5 }),
      classification: 'preserved',
      note: 'Host mapNamed treats null as no gender (no refusal), so skin and hair give error noTribe while tribe/race stay Wildwood/Elezen. Library Gender state null (no issue for null), current(gender) null, so skin/hair are missingTribeGender with MISSING_PALETTE_CONTEXT. Preserved = no colour and no refusal on either side; the adapter maps noTribe to missingTribeGender. Gender ABSENT beside a Tribe is COL-25.',
      lib: {
        identity: {
          gender: { state: 'null', raw: null },
          tribe: { state: 'valid', value: 'Wildwood' },
          canonicalRace: 'Elezen',
        },
        slots: {
          skin: { interpretation: 'unresolved', reason: 'missingTribeGender', displayHex: null },
          hair: { interpretation: 'unresolved', reason: 'missingTribeGender', displayHex: null },
        },
        issues: [
          { code: 'MISSING_PALETTE_CONTEXT', path: ['Skintone'] },
          { code: 'MISSING_PALETTE_CONTEXT', path: ['HairTone'] },
        ],
        noIssueCodes: ['INVALID_FIELD', 'UNSUPPORTED_VALUE'],
      },
    },
    {
      id: 'IDN-38',
      title:
        'numeric Race 6 in a tribe-less file: host ignores it (tattoo), library reads Au Ra (limbal)',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 6, Gender: 'Feminine', LimbalEyes: 3 },
      classification: 'intentional',
      note: 'UNPLANNED: the plan row approves numeric enums in the library but does not mention that the host silently ignores a numeric Race (plan row 101 is the nearest basis). Host lookupOptional returns null for a non-string Race (no refusal), so race is null and the limbal slot defaults to kind tattoo. Library Race is 1-based: values[6-1] = "Au Ra", valid, and with Tribe absent raceSource is race, so LimbalEyes is a limbal ring. Colour features[3] = #B3B3B3 on both. The plan row approves numeric enums in the library; the adapter must map canonicalRace back to AuRa and accept the kind change.',
      lib: {
        identity: {
          race: { state: 'valid', value: 'Au Ra', raw: 6 },
          canonicalRace: 'Au Ra',
          raceSource: 'race',
        },
        slots: { limbal: { kind: 'limbal', interpretation: 'palette', displayHex: '#B3B3B3' } },
        noIssueCodes: ['UNSUPPORTED_VALUE', 'INVALID_FIELD'],
      },
    },
    {
      id: 'IDN-39',
      title:
        'unknown Race string in a tribe-less file: host guesses tattoo, library limbalOrTattoo',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: { Race: 'Hyuran', Gender: 'Masculine', LimbalEyes: 3 },
      classification: 'intentional',
      note: 'Host: an unknown Race never refuses; race is null and the limbal kind defaults to tattoo. Library: "Hyuran" matches no alias or RACES entry, so unsupported (UNSUPPORTED_VALUE at Race), canonicalRace null, and the limbal kind is limbalOrTattoo (race unknown). The colour is race-independent: features[3] = #B3B3B3 on both. Plan row: do not guess missing context; the new kind value is approved by the shared interface contract (kind adds limbalOrTattoo when the race is unknown), as in COL-06. Sibling of IDN-24, where a valid Tribe still decides the race.',
      lib: {
        identity: {
          race: { state: 'unsupported', raw: 'Hyuran' },
          canonicalRace: null,
          raceSource: null,
        },
        slots: {
          limbal: { kind: 'limbalOrTattoo', interpretation: 'palette', displayHex: '#B3B3B3' },
        },
        issues: [{ code: 'UNSUPPORTED_VALUE', path: ['Race'] }],
      },
    },
    {
      id: 'IDN-40',
      title: 'wrong-case Gender "masculine": host refuses, library unsupported',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: { Race: 'Elezen', Tribe: 'Wildwood', Gender: 'masculine', Skintone: 20 },
      classification: 'intentional',
      note: 'Host GENDER_MAP is an exact own-key lookup, so "masculine" is unrecognised and the file is refused. Library matching is case-sensitive with no Gender alias map: unsupported (UNSUPPORTED_VALUE), skin missingTribeGender, tribe and canonical race still valid. Gender sibling of IDN-12.',
      lib: {
        identity: {
          gender: { state: 'unsupported', raw: 'masculine' },
          tribe: { state: 'valid', value: 'Wildwood' },
          canonicalRace: 'Elezen',
        },
        slots: {
          skin: { interpretation: 'unresolved', reason: 'missingTribeGender', displayHex: null },
        },
        issues: [
          { code: 'UNSUPPORTED_VALUE', path: ['Gender'] },
          { code: 'MISSING_PALETTE_CONTEXT', path: ['Skintone'] },
        ],
      },
    },
    {
      id: 'IDN-41',
      title: 'empty-string Tribe: host refuses, library unsupported (not treated as absent)',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: { Race: 'Viera', Tribe: '', Gender: 'Feminine', LEyeColor: 0 },
      classification: 'intentional',
      note: 'Host mapNamed refuses "" as an unrecognised value (only null/undefined count as no tribe). Library: "" is a string with no match, so unsupported, and an unsupported Tribe permits no Race fallback: canonicalRace null although Race Viera is valid. A reader treating "" as absent would fall back to Viera. Eye 0 still resolves to #F7F7F7.',
      lib: {
        identity: {
          tribe: { state: 'unsupported', raw: '' },
          race: { state: 'valid', value: 'Viera' },
          canonicalRace: null,
          raceSource: null,
        },
        slots: { leftEye: { interpretation: 'palette', displayHex: '#F7F7F7' } },
        issues: [{ code: 'UNSUPPORTED_VALUE', path: ['Tribe'] }],
      },
    },
    {
      id: 'IDN-42',
      title: 'Highlander Masculine resolves Hyur and the Highlander male skin sheet',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'Hyur', Tribe: 'Highlander', Gender: 'Masculine', Skintone: 20 },
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Highlander is TRIBES[1], race index 0 = Hyur; host SUBRACE_TO_RACE agrees. Skin 20 Highlander Masculine is #A1846B (Midlander Masculine #AB8C71; Highlander Feminine #AE9174 equals Midlander Feminine, hence Masculine here). Tribe-to-race/palette mapping for the sixteen tribes is a required contract.',
      lib: {
        identity: {
          canonicalRace: 'Hyur',
          raceSource: 'tribe',
          tribe: { state: 'valid', value: 'Highlander' },
        },
        slots: {
          skin: { interpretation: 'palette', creatorHex: '#A1846B', displayHex: '#A1846B' },
        },
        noIssueCodes: ['RACE_TRIBE_MISMATCH'],
      },
    },
    {
      id: 'IDN-43',
      title: 'Plainsfolk Feminine resolves Lalafell and the Plainsfolk female skin sheet',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'Lalafell', Tribe: 'Plainsfolk', Gender: 'Feminine', Skintone: 60 },
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Plainsfolk is TRIBES[4], race index 2 = Lalafell. Index 60 because at 20 Plainsfolk equals Dunesfolk Masculine: skin 60 Plainsfolk Feminine is #9A815E (Dunesfolk Feminine #A17D5D). Dunesfolk Masculine shares the creator hex #9A815E, so the library half also pins the shader entry #9A9575 (Dunesfolk Masculine #A09173). Sixteen-tribe contract, blocking.',
      lib: {
        identity: {
          canonicalRace: 'Lalafell',
          raceSource: 'tribe',
          tribe: { state: 'valid', value: 'Plainsfolk' },
        },
        slots: {
          skin: {
            interpretation: 'palette',
            creatorHex: '#9A815E',
            shaderHex: '#9A9575',
            displayHex: '#9A815E',
          },
        },
        noIssueCodes: ['RACE_TRIBE_MISMATCH'],
      },
    },
    {
      id: 'IDN-44',
      title: "SeekerOfTheSun Feminine resolves Miqo'te and the Seeker female skin sheet",
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: "Miqo'te", Tribe: 'SeekerOfTheSun', Gender: 'Feminine', Skintone: 20 },
      classification: 'preserved',
      blocksIfDiverges: true,
      note: "SeekerOfTheSun is TRIBES[6], race index 3 = Miqo'te. Skin 20 SeekerOfTheSun Feminine is #A78366 (Masculine #A47D63, KeeperOfTheMoon Feminine #A8A69F). Sixteen-tribe contract, blocking.",
      lib: {
        identity: {
          canonicalRace: "Miqo'te",
          raceSource: 'tribe',
          tribe: { state: 'valid', value: 'SeekerOfTheSun' },
        },
        slots: {
          skin: { interpretation: 'palette', creatorHex: '#A78366', displayHex: '#A78366' },
        },
        noIssueCodes: ['RACE_TRIBE_MISMATCH'],
      },
    },
    {
      id: 'IDN-45',
      title: 'SeaWolf Masculine resolves Roegadyn and the Sea Wolf male skin sheet',
      planRow: 'Au Ra / AuRa, feminine/masculine enums',
      doc: { Race: 'Roegadyn', Tribe: 'SeaWolf', Gender: 'Masculine', Skintone: 20 },
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'SeaWolf is TRIBES[8], race index 4 = Roegadyn. Skin 20 SeaWolf Masculine is #96A784 (Feminine #909F7E, Hellsguard Masculine #937C74). Sixteen-tribe contract, blocking.',
      lib: {
        identity: {
          canonicalRace: 'Roegadyn',
          raceSource: 'tribe',
          tribe: { state: 'valid', value: 'SeaWolf' },
        },
        slots: {
          skin: { interpretation: 'palette', creatorHex: '#96A784', displayHex: '#96A784' },
        },
        noIssueCodes: ['RACE_TRIBE_MISMATCH'],
      },
    },
    {
      id: 'IDN-46',
      title: 'object Gender beside a valid tribe: host refuses, library marks the field invalid',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: { Race: 'Elezen', Tribe: 'Wildwood', Gender: {}, Skintone: 20 },
      classification: 'intentional',
      note: 'Host mapNamed refuses a non-string Gender (expected a string, got object). Library: an object matches neither the numeric nor the string branch of enumeration(), so gender is invalid with INVALID_FIELD at the Gender path, and skin cannot resolve for lack of a gender (missingTribeGender). The tribe still resolves.',
      lib: {
        identity: {
          gender: { state: 'invalid' },
          tribe: { state: 'valid', value: 'Wildwood' },
          canonicalRace: 'Elezen',
        },
        issues: [{ code: 'INVALID_FIELD', path: ['Gender'] }],
        slots: {
          skin: { interpretation: 'unresolved', reason: 'missingTribeGender', displayHex: null },
        },
      },
    },
  ];

  return idnCases;
})();

// ---- section COL
const colCasesSection: ParityCase[] = (() => {

  /** Library: an active slot whose valid index resolves on the creator palette with no extended data. */
  const libPalette = (
    sheetIndex: number,
    creatorHex: string,
    extra: Partial<LibSlotExpect> = {},
  ): LibSlotExpect => ({
    active: true,
    interpretation: 'palette',
    reason: 'paletteOnly',
    sheetIndex,
    variant: null,
    creatorHex,
    displayHex: creatorHex,
    extendedHex: null,
    deltaE: null,
    ...extra,
  });

  /** Lip and face paint at the same file index, with both controls switched on. */
  const split = (index: number): Record<string, unknown> =>
    char({ LipsToneFurPattern: index, Mouth: 128, FacePaintColor: index, FacePaint: 1 });

  const colCases: ParityCase[] = [
    {
      id: 'COL-01',
      title: 'all eight slots resolve a distinct in-range index to the creator swatch',
      planRow: 'Task 1 step 2: comparison tests for all eight colors',
      doc: char({
        LEyeColor: 17,
        REyeColor: 42,
        HairTone: 30,
        Highlights: 60,
        EnableHighlights: true,
        Skintone: 30,
        LimbalEyes: 40,
        LipsToneFurPattern: 40,
        Mouth: 128,
        FacePaintColor: 12,
        FacePaint: 1,
      }),
      classification: 'preserved',
      note: 'Distinct indices per slot (eyes 17/42, lip 40 vs face paint 12 on identical sheets) so a crossed key fails. Both sides read creator hex = display hex; Elezen limbal is a tattoo; resolve.ts gives paletteOnly with no extended data. Library shader refs: hair/skin Wildwood F 30, lipsDark 40, none for face paint.',
      lib: {
        eyesShareIndex: false,
        slots: {
          leftEye: libPalette(17, '#F7F0CF', { kind: 'leftEye', shaderHex: '#F7F0CF' }),
          rightEye: libPalette(42, '#DCBA6C', { kind: 'rightEye', shaderHex: '#DCBA6C' }),
          hair: libPalette(30, '#665C43', { shaderHex: '#60513D' }),
          highlights: libPalette(60, '#9F692E', { shaderHex: '#9F692E' }),
          skin: libPalette(30, '#654F41', { shaderHex: '#62574E' }),
          limbal: libPalette(40, '#EFE1C0', { kind: 'tattoo', shaderHex: '#C5B694' }),
          lip: libPalette(40, '#E0B2AE', {
            variant: 'dark',
            indexMeaning: 'color',
            shaderHex: '#95716F',
            lipCompositeHex: null,
          }),
          facePaint: libPalette(12, '#B4A987', { variant: 'dark', shaderHex: null }),
        },
      },
    },
    {
      id: 'COL-02',
      title: 'equal eye indices share one badge',
      planRow: 'Eye sharing (Task 1 step 2, all eight colors)',
      doc: char({ LEyeColor: 42, REyeColor: 42 }),
      classification: 'preserved',
      note: 'Host: eyesShareIndex = both indices non-null and equal. Library: both storedIndex fields valid and equal (resolve.ts eyesShareIndex). Both eyes read eyes[42] = #DCBA6C.',
      lib: {
        eyesShareIndex: true,
        slots: { leftEye: libPalette(42, '#DCBA6C'), rightEye: libPalette(42, '#DCBA6C') },
      },
    },
    {
      id: 'COL-03',
      title: 'hair and skin read the Wildwood feminine sheets',
      planRow: 'Task 1 step 2: all eight colors (race-specific sheets)',
      doc: char({ HairTone: 12, Skintone: 12 }),
      classification: 'preserved',
      note: 'Skin 12 differs across all four of Wildwood M/F and Raen M/F (#AF886F/#B18D73/#70443E/#815E64), so a wrong tribe or gender mapping fails; hair 12 is gender-independent in the data and discriminates tribe only (#C0B793 vs Raen #C4BB99). Library requests use tribe Wildwood, gender Feminine.',
      lib: {
        identity: { gender: { state: 'valid', value: 'Feminine' } },
        slots: {
          hair: libPalette(12, '#C0B793', { shaderHex: '#C6BCA6' }),
          skin: libPalette(12, '#B18D73', { shaderHex: '#AC9B8A' }),
        },
      },
    },
    {
      id: 'COL-04',
      title: 'hair and skin read the Raen masculine sheets',
      planRow: 'Task 1 step 2: all eight colors (race-specific sheets)',
      doc: { Race: 'AuRa', Tribe: 'Raen', Gender: 'Masculine', HairTone: 12, Skintone: 12 },
      classification: 'preserved',
      note: 'Second tribe+gender pair: Raen Masculine hair 12 = #C4BB99, skin 12 = #70443E (Raen Feminine skin would be #815E64, Wildwood Masculine #AF886F). The library maps Masculine to the provider Male column (default-provider.ts).',
      lib: {
        identity: { gender: { state: 'valid', value: 'Masculine' }, canonicalRace: 'Au Ra' },
        slots: {
          hair: libPalette(12, '#C4BB99', { shaderHex: '#BDB7A0' }),
          skin: libPalette(12, '#70443E', { shaderHex: '#81504C' }),
        },
      },
    },
    {
      id: 'COL-05',
      title: 'limbal slot on an Au Ra is a limbal ring',
      planRow: 'Task 1 step 2: all eight colors (limbal/tattoo kind)',
      doc: { Race: 'AuRa', Tribe: 'Raen', Gender: 'Feminine', LimbalEyes: 30 },
      classification: 'preserved',
      note: 'Host kind = limbal when race is AuRa; library kind = limbal when canonicalRace is "Au Ra" (resolve.ts). Both read features[30] = #746040; the library shader ref is #634F2E.',
      lib: {
        slots: { limbal: libPalette(30, '#746040', { kind: 'limbal', shaderHex: '#634F2E' }) },
      },
    },
    {
      id: 'COL-06',
      title: 'limbal slot with no race: host says tattoo, library says limbalOrTattoo',
      planRow: 'Shared interface contract: kind adds limbalOrTattoo (race unknown)',
      doc: { LimbalEyes: 30 },
      classification: 'intentional',
      note: 'With neither Tribe nor Race the host defaults the kind to tattoo; the library reports limbalOrTattoo (race === null). The colour is race-independent, so both still resolve features[30] = #746040; consumers switching on kind must handle the new value.',
      lib: {
        identity: { canonicalRace: null, raceSource: null },
        slots: {
          limbal: libPalette(30, '#746040', { kind: 'limbalOrTattoo', shaderHex: '#634F2E' }),
        },
      },
    },
    {
      id: 'COL-07',
      title: 'lip and face paint at 0: first dark entry',
      planRow: 'Task 1 step 2: dark/light lips',
      doc: split(0),
      classification: 'preserved',
      note: 'Both sides split 0-95 dark. Lip and face paint dark[0] = #F8F8F8. The library lip shader ref is lipsDark[0] = #ADADAD; face paint never requests a shader colour.',
      lib: {
        slots: {
          lip: libPalette(0, '#F8F8F8', { variant: 'dark', shaderHex: '#ADADAD' }),
          facePaint: libPalette(0, '#F8F8F8', { variant: 'dark', shaderHex: null }),
        },
      },
    },
    {
      id: 'COL-08',
      title: 'lip and face paint at 95: last dark entry',
      planRow: 'Task 1 step 2: dark/light lips',
      doc: split(95),
      classification: 'preserved',
      note: 'Upper dark bound on both sides (index <= 95). dark[95] = #393F21; the library lip shader ref is lipsDark[95] = #1D240C.',
      lib: {
        slots: {
          lip: libPalette(95, '#393F21', { variant: 'dark', shaderHex: '#1D240C' }),
          facePaint: libPalette(95, '#393F21', { variant: 'dark', shaderHex: null }),
        },
      },
    },
    {
      id: 'COL-09',
      title: 'lip and face paint at 96: start of the gap',
      planRow: 'Task 1 step 2: dark/light lips (96-127 gap)',
      doc: split(96),
      classification: 'intentional',
      note: "UNPLANNED: the host names the 96-127 gap (error midRangeIndex, user-visible); the library folds it into indexOutOfRange with PALETTE_INDEX_OUT_OF_RANGE (resolve.ts split branch: neither <= 95 nor 128-223) and leaves sheetIndex/variant null. Neither side clamps or fabricates a colour. Adapter obligation: derive the host's midRangeIndex message from storedIndex.value 96-127; web-app chara-ui.ts maps it to swatch.slotError.midRangeIndex.",
      lib: {
        issues: [
          { code: 'PALETTE_INDEX_OUT_OF_RANGE', path: ['LipsToneFurPattern'] },
          { code: 'PALETTE_INDEX_OUT_OF_RANGE', path: ['FacePaintColor'] },
        ],
        noIssueCodes: ['INVALID_FIELD'],
        slots: {
          lip: {
            active: true,
            interpretation: 'unresolved',
            reason: 'indexOutOfRange',
            sheetIndex: null,
            variant: null,
            creatorHex: null,
            displayHex: null,
            storedIndex: { state: 'valid', value: 96 },
          },
          facePaint: {
            active: true,
            interpretation: 'unresolved',
            reason: 'indexOutOfRange',
            sheetIndex: null,
            variant: null,
            creatorHex: null,
            displayHex: null,
            storedIndex: { state: 'valid', value: 96 },
          },
        },
      },
    },
    {
      id: 'COL-10',
      title: 'lip and face paint at 127: end of the gap',
      planRow: 'Task 1 step 2: dark/light lips (96-127 gap)',
      doc: split(127),
      classification: 'intentional',
      note: "UNPLANNED: upper gap bound. Host midRangeIndex (96 <= i <= 127, user-visible), library indexOutOfRange (neither <= 95 nor 128-223); no colour on either side. Adapter obligation: derive the host's midRangeIndex message from storedIndex.value 96-127; web-app chara-ui.ts maps it to swatch.slotError.midRangeIndex.",
      lib: {
        issues: [
          { code: 'PALETTE_INDEX_OUT_OF_RANGE', path: ['LipsToneFurPattern'] },
          { code: 'PALETTE_INDEX_OUT_OF_RANGE', path: ['FacePaintColor'] },
        ],
        noIssueCodes: ['INVALID_FIELD'],
        slots: {
          lip: {
            active: true,
            interpretation: 'unresolved',
            reason: 'indexOutOfRange',
            sheetIndex: null,
            variant: null,
            displayHex: null,
            storedIndex: { state: 'valid', value: 127 },
          },
          facePaint: {
            active: true,
            interpretation: 'unresolved',
            reason: 'indexOutOfRange',
            sheetIndex: null,
            variant: null,
            displayHex: null,
            storedIndex: { state: 'valid', value: 127 },
          },
        },
      },
    },
    {
      id: 'COL-11',
      title: 'lip and face paint at 128: first light entry, in-sheet index 0',
      planRow: 'Task 1 step 2: dark/light lips',
      doc: split(128),
      classification: 'preserved',
      provider: 'tagged',
      note: 'File index minus 128 on both sides. Host: light[0] = #F8F8F8 (same hex as dark[0], so sheetIndex/sheetVariant carry the proof). Library, tagged provider: lip creator lipsLight[0] = #050000 and shader lipsDark[0] = #04FF00; face paint creator facePaintLight[0] = #070000, no shader request. A dark-sheet request would read #040000/#060000; a file-index request would read ...80.',
      lib: {
        slots: {
          lip: libPalette(0, '#050000', { variant: 'light', shaderHex: '#04FF00' }),
          facePaint: libPalette(0, '#070000', { variant: 'light', shaderHex: null }),
        },
      },
    },
    {
      id: 'COL-12',
      title: 'lip and face paint at 223: last light entry, in-sheet index 95',
      planRow: 'Task 1 step 2: dark/light lips',
      doc: split(223),
      classification: 'preserved',
      provider: 'tagged',
      note: 'Upper light bound, in-sheet 95 (0x5F). Host: light[95] = #393F21. Library, tagged provider: lip creator lipsLight[95] = #05005F, shader lipsDark[95] = #04FF5F (a light lip compares against its dark shader entry); face paint facePaintLight[95] = #07005F with no shader request.',
      lib: {
        slots: {
          lip: libPalette(95, '#05005F', { variant: 'light', shaderHex: '#04FF5F' }),
          facePaint: libPalette(95, '#07005F', { variant: 'light', shaderHex: null }),
        },
      },
    },
    {
      id: 'COL-13',
      title: 'lip and face paint at 224: past the light range',
      planRow: 'Task 1 step 2: dark/light lips',
      doc: split(224),
      classification: 'preserved',
      note: 'Above 223 both sides report out of range (host indexOutOfRange, not midRangeIndex; library indexOutOfRange since 224 is a valid uint8). No colour, no clamping.',
      lib: {
        issues: [
          { code: 'PALETTE_INDEX_OUT_OF_RANGE', path: ['LipsToneFurPattern'] },
          { code: 'PALETTE_INDEX_OUT_OF_RANGE', path: ['FacePaintColor'] },
        ],
        slots: {
          lip: {
            interpretation: 'unresolved',
            reason: 'indexOutOfRange',
            sheetIndex: null,
            variant: null,
            displayHex: null,
            storedIndex: { state: 'valid', value: 224 },
          },
          facePaint: {
            interpretation: 'unresolved',
            reason: 'indexOutOfRange',
            sheetIndex: null,
            variant: null,
            displayHex: null,
            storedIndex: { state: 'valid', value: 224 },
          },
        },
      },
    },
    {
      id: 'COL-14',
      title: 'non-split palettes at 191: last entry',
      planRow: 'Task 1 step 2: all eight colors (192-entry sheets)',
      doc: char({ LEyeColor: 191, Highlights: 191, EnableHighlights: true }),
      classification: 'preserved',
      note: 'Eyes and highlights have 192 entries on both sides; 191 is the last. eyes[191] = #3D4025, highlights[191] = #3E4223 (shader #414024). No split rule: variant null.',
      lib: {
        slots: {
          leftEye: libPalette(191, '#3D4025', { shaderHex: '#3D4025' }),
          highlights: libPalette(191, '#3E4223', { shaderHex: '#414024' }),
        },
      },
    },
    {
      id: 'COL-15',
      title: 'non-split palettes at 192: no entry',
      planRow:
        'Unknown tribe/gender or malformed color (out-of-range index never refuses the file)',
      doc: char({ LEyeColor: 192, Highlights: 192, EnableHighlights: true }),
      classification: 'preserved',
      note: 'HOST QUIRK: on a sheet miss the host keeps the raw value as sheetIndex (192) beside error indexOutOfRange. Library: 192 is a valid uint8 but index >= 192 gives indexOutOfRange with PALETTE_INDEX_OUT_OF_RANGE before sheetIndex is set (resolve.ts).',
      lib: {
        issues: [
          { code: 'PALETTE_INDEX_OUT_OF_RANGE', path: ['LEyeColor'] },
          { code: 'PALETTE_INDEX_OUT_OF_RANGE', path: ['Highlights'] },
        ],
        noIssueCodes: ['INVALID_FIELD'],
        slots: {
          leftEye: {
            active: true,
            interpretation: 'unresolved',
            reason: 'indexOutOfRange',
            sheetIndex: null,
            displayHex: null,
            storedIndex: { state: 'valid', value: 192 },
          },
          highlights: {
            active: true,
            interpretation: 'unresolved',
            reason: 'indexOutOfRange',
            sheetIndex: null,
            displayHex: null,
            storedIndex: { state: 'valid', value: 192 },
          },
        },
      },
    },
    {
      id: 'COL-16',
      title: 'negative index: host fails the lookup, library marks the field invalid',
      planRow: 'Unknown tribe/gender or malformed color (negative index)',
      doc: char({ LEyeColor: -1, REyeColor: 5 }),
      classification: 'preserved',
      note: 'HOST QUIRK: the host accepts any finite number, misses the sheet lookup and keeps the raw value as sheetIndex (-1). Neither side refuses the file or invents a colour. The library index is uint8, so -1 is invalid (INVALID_FIELD) and the slot is unresolved/invalidIndex; the other eye still resolves eyes[5] = #5C5C5C.',
      lib: {
        issues: [{ code: 'INVALID_FIELD', path: ['LEyeColor'] }],
        noIssueCodes: ['PALETTE_INDEX_OUT_OF_RANGE'],
        slots: {
          leftEye: {
            interpretation: 'unresolved',
            reason: 'invalidIndex',
            sheetIndex: null,
            displayHex: null,
            storedIndex: { state: 'invalid', raw: -1 },
          },
          rightEye: libPalette(5, '#5C5C5C'),
        },
      },
    },
    {
      id: 'COL-17',
      title: 'fractional index: host fails the lookup, library marks the field invalid',
      planRow: 'Unknown tribe/gender or malformed color (fractional index)',
      doc: char({ LEyeColor: 5, REyeColor: 4.5 }),
      classification: 'preserved',
      note: 'HOST QUIRK: the host never floors an index and keeps the raw value as sheetIndex on a miss: 4.5 matches no sheet entry, error indexOutOfRange with sheetIndex 4.5. The library requires a safe integer (isUint), so 4.5 is invalid and the slot unresolved/invalidIndex; the left eye resolves #5C5C5C.',
      lib: {
        issues: [{ code: 'INVALID_FIELD', path: ['REyeColor'] }],
        slots: {
          leftEye: libPalette(5, '#5C5C5C'),
          rightEye: {
            interpretation: 'unresolved',
            reason: 'invalidIndex',
            sheetIndex: null,
            displayHex: null,
            storedIndex: { state: 'invalid', raw: 4.5 },
          },
        },
      },
    },
    {
      id: 'COL-18',
      title: 'index 256: outside uint8, so invalid rather than out of range',
      planRow: 'Unknown tribe/gender or malformed color (out-of-range index)',
      doc: char({ LEyeColor: 256 }),
      classification: 'preserved',
      note: 'HOST QUIRK: the host errors on the lookup and keeps the raw value as sheetIndex (indexOutOfRange, sheetIndex 256). The library field is a byte (max 255), so 256 is invalid/invalidIndex with INVALID_FIELD, not indexOutOfRange: a library reading indices as uint16 would fail here.',
      lib: {
        issues: [{ code: 'INVALID_FIELD', path: ['LEyeColor'] }],
        noIssueCodes: ['PALETTE_INDEX_OUT_OF_RANGE'],
        slots: {
          leftEye: {
            interpretation: 'unresolved',
            reason: 'invalidIndex',
            sheetIndex: null,
            displayHex: null,
            storedIndex: { state: 'invalid', raw: 256 },
          },
        },
      },
    },
    {
      id: 'COL-19',
      title: 'both eyes at the same invalid index: host shares, library does not',
      planRow:
        'Unlisted: eyesShareIndex on equal invalid indices (nearest basis: Unknown tribe/gender or malformed color, do not silently coerce invalid values)',
      doc: char({ LEyeColor: -1, REyeColor: -1 }),
      classification: 'intentional',
      note: 'UNPLANNED: host eyesShareIndex is true (chara-resolver.ts only checks both indices non-null and equal, so two -1 indices "share" one failing badge); the library reports false (resolve.ts eyesShareIndex requires both storedIndex fields valid). HOST QUIRK: a shared badge for two failing indices. No plan row covers it: the maintainer must approve the difference and decide which eyesShareIndex the Task 3 adapter projects into the inherited ResolvedCharaCharacter field.',
      lib: {
        eyesShareIndex: false,
        issues: [
          { code: 'INVALID_FIELD', path: ['LEyeColor'] },
          { code: 'INVALID_FIELD', path: ['REyeColor'] },
        ],
        slots: {
          leftEye: {
            interpretation: 'unresolved',
            reason: 'invalidIndex',
            displayHex: null,
            storedIndex: { state: 'invalid', raw: -1 },
          },
          rightEye: {
            interpretation: 'unresolved',
            reason: 'invalidIndex',
            displayHex: null,
            storedIndex: { state: 'invalid', raw: -1 },
          },
        },
      },
    },
    {
      id: 'COL-20',
      title: 'non-numeric index: host refuses the file, library keeps the other slots',
      planRow: 'Unknown tribe/gender or malformed color (non-numeric index)',
      doc: char({ LEyeColor: '5', REyeColor: 5 }),
      classification: 'intentional',
      note: 'The host refuses the whole file for a non-null non-numeric index (readIndex). The library marks only that field invalid (INVALID_FIELD, invalidIndex) and still resolves the right eye eyes[5] = #5C5C5C; eyesShareIndex is false.',
      lib: {
        issues: [{ code: 'INVALID_FIELD', path: ['LEyeColor'] }],
        eyesShareIndex: false,
        slots: {
          leftEye: {
            interpretation: 'unresolved',
            reason: 'invalidIndex',
            displayHex: null,
            storedIndex: { state: 'invalid', raw: '5' },
          },
          rightEye: libPalette(5, '#5C5C5C'),
        },
      },
    },
    {
      id: 'COL-21',
      title: 'null and absent palette indices are both no colour',
      planRow: 'Unknown tribe/gender or malformed color (null index)',
      doc: char({ HairTone: null, LEyeColor: 5 }),
      classification: 'preserved',
      note: 'Host: a null index reads as an absent key; with no live float the slot is inert with no reason. Library: storedIndex null vs absent stay distinct, but both end unresolved/missingColor with no display colour (resolve.ts returns before any palette request).',
      lib: {
        slots: {
          hair: {
            active: true,
            interpretation: 'unresolved',
            reason: 'missingColor',
            displayHex: null,
            creatorHex: null,
            storedIndex: { state: 'null' },
          },
          skin: {
            active: true,
            interpretation: 'unresolved',
            reason: 'missingColor',
            displayHex: null,
            creatorHex: null,
            storedIndex: { state: 'absent' },
          },
        },
      },
    },
    {
      id: 'COL-22',
      title: 'Hrothgar LipsToneFurPattern is a fur pattern, not a colour',
      planRow: 'Hrothgar fur',
      doc: { Race: 'Hrothgar', Tribe: 'Helions', Gender: 'Masculine', LipsToneFurPattern: 3 },
      classification: 'preserved',
      note: 'Host: on Hrothgar the key is a fur-pattern enum, inert furPattern. Library: indexMeaning furPattern; with no live extended colour the slot is active false, inactive, reason furPattern, and no palette is requested (sheetIndex null).',
      lib: {
        slots: {
          lip: {
            active: false,
            interpretation: 'inactive',
            reason: 'furPattern',
            indexMeaning: 'furPattern',
            sheetIndex: null,
            creatorHex: null,
            displayHex: null,
          },
        },
      },
    },
    {
      id: 'COL-23',
      title: 'lip index with no race: host resolves a lip, library cannot tell lip from fur',
      planRow: 'Unknown tribe/gender or malformed color (missing context: do not guess)',
      doc: { LipsToneFurPattern: 20 },
      classification: 'intentional',
      note: 'Without Tribe/Race the host still resolves lipsDark[20] = #AC9660. The library cannot know whether the byte is a lip colour or a Hrothgar fur pattern: indexMeaning unknown, unresolved/missingRace, and with Mouth absent activation is null (bitSet || null).',
      lib: {
        slots: {
          lip: {
            active: null,
            indexMeaning: 'unknown',
            interpretation: 'unresolved',
            reason: 'missingRace',
            sheetIndex: null,
            creatorHex: null,
            displayHex: null,
          },
        },
      },
    },
    // COL-24 deleted in the refinement round: it duplicated ACT-23 (lip index, Mouth 128, no race).
    {
      id: 'COL-25',
      title: 'hair and skin with Tribe but no Gender: no race-specific sheet',
      planRow: 'Unknown tribe/gender or malformed color (missing context: do not guess)',
      doc: { Tribe: 'Wildwood', HairTone: 12, Skintone: 12 },
      classification: 'preserved',
      note: 'Neither side guesses a gender. Host: noTribe with sheetIndex null. Library: sheetIndex is set before the context check (resolve.ts lines 319-321), then missingTribeGender with MISSING_PALETTE_CONTEXT and no colour.',
      lib: {
        identity: { gender: { state: 'absent' }, tribe: { state: 'valid', value: 'Wildwood' } },
        issues: [
          { code: 'MISSING_PALETTE_CONTEXT', path: ['HairTone'] },
          { code: 'MISSING_PALETTE_CONTEXT', path: ['Skintone'] },
        ],
        slots: {
          hair: {
            active: true,
            interpretation: 'unresolved',
            reason: 'missingTribeGender',
            sheetIndex: 12,
            creatorHex: null,
            displayHex: null,
          },
          skin: {
            active: true,
            interpretation: 'unresolved',
            reason: 'missingTribeGender',
            sheetIndex: 12,
            creatorHex: null,
            displayHex: null,
          },
        },
      },
    },
    {
      id: 'COL-26',
      title: 'light lip (140) beside dark face paint (12): each requests its own palette',
      planRow: 'Task 1 step 2: dark/light lips',
      doc: char({ LipsToneFurPattern: 140, Mouth: 128, FacePaintColor: 12, FacePaint: 1 }),
      classification: 'preserved',
      provider: 'tagged',
      note: 'Host: lip 140 -> light sheet, sheetIndex 12; face paint 12 -> dark sheet, sheetIndex 12; all four sheets hold #B4A987 at 12. Library, tagged provider: lip creator lipsLight[12] = #05000C with shader lipsDark[12] = #04FF0C; face paint creator facePaintDark[12] = #06000C, no shader request. Fails a library that reads dark for light, uses the file index (8C), crosses the two slots, or asks lipsLight/face paint for a shader colour.',
      lib: {
        slots: {
          lip: libPalette(12, '#05000C', {
            variant: 'light',
            indexMeaning: 'color',
            shaderHex: '#04FF0C',
          }),
          facePaint: libPalette(12, '#06000C', { variant: 'dark', shaderHex: null }),
        },
      },
    },
    {
      id: 'COL-27',
      title: 'dark lip (12) beside light face paint (140): the mirror pairing',
      planRow: 'Task 1 step 2: dark/light lips',
      doc: char({ LipsToneFurPattern: 12, Mouth: 128, FacePaintColor: 140, FacePaint: 1 }),
      classification: 'preserved',
      provider: 'tagged',
      note: 'Mirror of COL-26 so every one of the four creator palettes is requested once across the pair. Host: lip dark sheetIndex 12, face paint light sheetIndex 12, both #B4A987. Library, tagged: lip lipsDark[12] = #04000C, shader lipsDark[12] = #04FF0C; face paint facePaintLight[12] = #07000C, no shader.',
      lib: {
        slots: {
          lip: libPalette(12, '#04000C', {
            variant: 'dark',
            indexMeaning: 'color',
            shaderHex: '#04FF0C',
          }),
          facePaint: libPalette(12, '#07000C', { variant: 'light', shaderHex: null }),
        },
      },
    },
    {
      id: 'COL-28',
      title:
        'hair 200 with Tribe but no Gender: host reports missing context, library reports out of range',
      planRow:
        'Unknown tribe/gender or malformed color (missing context and out-of-range index together)',
      doc: { Tribe: 'Wildwood', HairTone: 200 },
      classification: 'intentional',
      note: 'UNPLANNED: precedence differs. Host resolveSheet checks Tribe+Gender first, so hair is noTribe (sheetIndex null). Library resolve.ts runs the >= 192 range check before the context check, so hair is indexOutOfRange with PALETTE_INDEX_OUT_OF_RANGE at HairTone and no MISSING_PALETTE_CONTEXT. Neither shows a colour; the adapter must choose which message the host UI shows (the library reason, or noTribe when context is also missing).',
      lib: {
        issues: [{ code: 'PALETTE_INDEX_OUT_OF_RANGE', path: ['HairTone'] }],
        noIssueCodes: ['MISSING_PALETTE_CONTEXT', 'INVALID_FIELD'],
        slots: {
          hair: {
            active: true,
            interpretation: 'unresolved',
            reason: 'indexOutOfRange',
            sheetIndex: null,
            creatorHex: null,
            displayHex: null,
            storedIndex: { state: 'valid', value: 200 },
          },
        },
      },
    },
    {
      id: 'COL-29',
      title: 'race sheets and limbal at 191 with full context: last entry',
      planRow: 'Task 1 step 2: all eight colors (192-entry race and features sheets)',
      doc: char({ HairTone: 191, Skintone: 191, LimbalEyes: 191 }),
      classification: 'preserved',
      note: 'Wildwood Feminine hair[191] = #2E381A (shader #1E321D), skin[191] = #553423 (shader #533A2A); features[191] = #3B3E26 (shader #32351C), an Elezen tattoo. 191 is the last entry on both sides, so an off-by-one bound (> 190 or >= 191) fails here.',
      lib: {
        noIssueCodes: ['MISSING_PALETTE_CONTEXT', 'PALETTE_INDEX_OUT_OF_RANGE'],
        slots: {
          hair: libPalette(191, '#2E381A', { shaderHex: '#1E321D' }),
          skin: libPalette(191, '#553423', { shaderHex: '#533A2A' }),
          limbal: libPalette(191, '#3B3E26', { kind: 'tattoo', shaderHex: '#32351C' }),
        },
      },
    },
    {
      id: 'COL-30',
      title: 'race sheets and limbal at 192 with full context: no entry',
      planRow:
        'Unknown tribe/gender or malformed color (out-of-range index never refuses the file)',
      doc: char({ HairTone: 192, Skintone: 192, LimbalEyes: 192 }),
      classification: 'preserved',
      note: 'HOST QUIRK: with Tribe+Gender present the host finds the sheet, the lookup misses, and it reports indexOutOfRange keeping the raw value as sheetIndex 192 (unlike COL-28, where context is checked first). Library: 192 is a valid uint8 but >= 192 gives indexOutOfRange with PALETTE_INDEX_OUT_OF_RANGE at each key, sheetIndex null, before any palette request.',
      lib: {
        issues: [
          { code: 'PALETTE_INDEX_OUT_OF_RANGE', path: ['HairTone'] },
          { code: 'PALETTE_INDEX_OUT_OF_RANGE', path: ['Skintone'] },
          { code: 'PALETTE_INDEX_OUT_OF_RANGE', path: ['LimbalEyes'] },
        ],
        noIssueCodes: ['MISSING_PALETTE_CONTEXT', 'INVALID_FIELD'],
        slots: {
          hair: {
            active: true,
            interpretation: 'unresolved',
            reason: 'indexOutOfRange',
            sheetIndex: null,
            displayHex: null,
            storedIndex: { state: 'valid', value: 192 },
          },
          skin: {
            active: true,
            interpretation: 'unresolved',
            reason: 'indexOutOfRange',
            sheetIndex: null,
            displayHex: null,
            storedIndex: { state: 'valid', value: 192 },
          },
          limbal: {
            active: true,
            interpretation: 'unresolved',
            reason: 'indexOutOfRange',
            sheetIndex: null,
            displayHex: null,
            storedIndex: { state: 'valid', value: 192 },
          },
        },
      },
    },
    {
      id: 'COL-31',
      title: 'fractional lip and negative face paint on the split slots',
      planRow:
        'Unknown tribe/gender or malformed color (fractional/negative index on a split slot)',
      doc: char({ LipsToneFurPattern: 4.5, Mouth: 128, FacePaintColor: -1, FacePaint: 1 }),
      classification: 'preserved',
      note: 'HOST QUIRK: the host split accepts 4.5 as dark (0 <= i <= 95), keeps sheetIndex 4.5 and sheetVariant dark, then misses the lookup (indexOutOfRange); -1 fails the split itself, so sheetIndex/variant stay null. The library requires a uint8 (isUint: safe integer 0-255), so both fields are invalid (INVALID_FIELD, raw kept) and both slots unresolved/invalidIndex with variant null. No colour, no refusal on either side.',
      lib: {
        issues: [
          { code: 'INVALID_FIELD', path: ['LipsToneFurPattern'] },
          { code: 'INVALID_FIELD', path: ['FacePaintColor'] },
        ],
        noIssueCodes: ['PALETTE_INDEX_OUT_OF_RANGE'],
        slots: {
          lip: {
            active: true,
            interpretation: 'unresolved',
            reason: 'invalidIndex',
            sheetIndex: null,
            variant: null,
            displayHex: null,
            storedIndex: { state: 'invalid', raw: 4.5 },
          },
          facePaint: {
            active: true,
            interpretation: 'unresolved',
            reason: 'invalidIndex',
            sheetIndex: null,
            variant: null,
            displayHex: null,
            storedIndex: { state: 'invalid', raw: -1 },
          },
        },
      },
    },
    {
      id: 'COL-32',
      title: 'lip 95.5 and face paint 127.5: between ranges, but not the 96-127 gap',
      planRow: 'Unknown tribe/gender or malformed color (fractional index on a split slot)',
      doc: char({ LipsToneFurPattern: 95.5, Mouth: 128, FacePaintColor: 127.5, FacePaint: 1 }),
      classification: 'preserved',
      note: 'HOST QUIRK: 95.5 is above 95 and below 96, and 127.5 is above 127 and below 128, so the host split falls through to indexOutOfRange (not midRangeIndex) with sheetIndex null. The library marks both invalid (not uint8): INVALID_FIELD, invalidIndex, raw kept. No colour on either side.',
      lib: {
        issues: [
          { code: 'INVALID_FIELD', path: ['LipsToneFurPattern'] },
          { code: 'INVALID_FIELD', path: ['FacePaintColor'] },
        ],
        noIssueCodes: ['PALETTE_INDEX_OUT_OF_RANGE'],
        slots: {
          lip: {
            interpretation: 'unresolved',
            reason: 'invalidIndex',
            sheetIndex: null,
            variant: null,
            displayHex: null,
            storedIndex: { state: 'invalid', raw: 95.5 },
          },
          facePaint: {
            interpretation: 'unresolved',
            reason: 'invalidIndex',
            sheetIndex: null,
            variant: null,
            displayHex: null,
            storedIndex: { state: 'invalid', raw: 127.5 },
          },
        },
      },
    },
    {
      id: 'COL-33',
      title: 'Race-only document: lip resolves from Race, hair has no tribe',
      planRow: 'Unknown tribe/gender or malformed color (missing context: do not guess)',
      doc: { Race: 'Elezen', Gender: 'Feminine', LipsToneFurPattern: 20, Mouth: 128, HairTone: 12 },
      classification: 'preserved',
      note: 'With no Tribe, both sides take the race from Race (host RACE_FALLBACK_MAP; library raceSource race, inspect.ts) so the lip is a colour: lipsDark[20] = #AC9660, library shader lipsDark[20] = #54431B. Hair needs a tribe: host noTribe, library sheetIndex 12 then missingTribeGender with MISSING_PALETTE_CONTEXT at HairTone. No guessed tribe on either side.',
      lib: {
        identity: {
          canonicalRace: 'Elezen',
          raceSource: 'race',
          race: { state: 'valid', value: 'Elezen' },
          tribe: { state: 'absent' },
        },
        issues: [{ code: 'MISSING_PALETTE_CONTEXT', path: ['HairTone'] }],
        slots: {
          lip: libPalette(20, '#AC9660', {
            variant: 'dark',
            indexMeaning: 'color',
            shaderHex: '#54431B',
          }),
          hair: {
            active: true,
            interpretation: 'unresolved',
            reason: 'missingTribeGender',
            sheetIndex: 12,
            creatorHex: null,
            displayHex: null,
          },
        },
      },
    },
    {
      id: 'COL-34',
      title: 'hair and skin with Gender but no Tribe: no race-specific sheet',
      planRow: 'Unknown tribe/gender or malformed color (missing context: do not guess)',
      doc: { Gender: 'Feminine', HairTone: 12, Skintone: 12 },
      classification: 'preserved',
      note: 'Converse of COL-25. Neither side guesses a tribe. Host: tribe null, noTribe with sheetIndex null. Library: tribe absent, sheetIndex 12 set before the context check, then missingTribeGender with MISSING_PALETTE_CONTEXT at each key and no colour.',
      lib: {
        identity: {
          tribe: { state: 'absent' },
          gender: { state: 'valid', value: 'Feminine' },
          canonicalRace: null,
        },
        issues: [
          { code: 'MISSING_PALETTE_CONTEXT', path: ['HairTone'] },
          { code: 'MISSING_PALETTE_CONTEXT', path: ['Skintone'] },
        ],
        slots: {
          hair: {
            active: true,
            interpretation: 'unresolved',
            reason: 'missingTribeGender',
            sheetIndex: 12,
            creatorHex: null,
            displayHex: null,
          },
          skin: {
            active: true,
            interpretation: 'unresolved',
            reason: 'missingTribeGender',
            sheetIndex: 12,
            creatorHex: null,
            displayHex: null,
          },
        },
      },
    },
    {
      id: 'COL-35',
      title: 'lip and face paint 96.5: host says midRangeIndex, library says invalid',
      planRow: 'Task 1 step 2: dark/light lips (96-127 gap, fractional)',
      doc: split(96.5),
      classification: 'intentional',
      note: 'UNPLANNED: 96.5 lies inside the host 96-127 gap test, so the host shows midRangeIndex (HOST QUIRK: the gap test also catches non-integers); the library field is invalid (not uint8), so the slot is invalidIndex with INVALID_FIELD and storedIndex has no value (raw 96.5). The ruling-2 adapter obligation keyed on storedIndex.value 96-127 does not fire here: the maintainer decides whether the adapter also reads storedIndex.raw or accepts the invalid-index message.',
      lib: {
        issues: [
          { code: 'INVALID_FIELD', path: ['LipsToneFurPattern'] },
          { code: 'INVALID_FIELD', path: ['FacePaintColor'] },
        ],
        noIssueCodes: ['PALETTE_INDEX_OUT_OF_RANGE'],
        slots: {
          lip: {
            interpretation: 'unresolved',
            reason: 'invalidIndex',
            variant: null,
            displayHex: null,
            storedIndex: { state: 'invalid', raw: 96.5 },
          },
          facePaint: {
            interpretation: 'unresolved',
            reason: 'invalidIndex',
            variant: null,
            displayHex: null,
            storedIndex: { state: 'invalid', raw: 96.5 },
          },
        },
      },
    },
  ];

  return colCases;
})();

// ---- section GEA
const geaCasesSection: ParityCase[] = (() => {
  /**
   * GEA: gear models, dye channels and Glasses.
   *
   * Host rules (chara-parser.ts): a slot is read only when it is an object (`typeof === 'object'`,
   * non-null); `readModelLane` keeps a positive finite number floored and reads anything else
   * (missing, null, negative, string) as 0; `isWornCharaModel` is `base > 0` (weapons:
   * `set > 0 || base > 0`); dyes are emitted only off a worn slot, only when a finite number > 0,
   * as stored; slots are walked in the fixed GEAR_SLOTS order; `readGlassesId` takes the object's
   * `GlassesId` or the bare value, positive finite only, floored, else null.
   *
   * Library rules (xivcharakit inspect.ts `Inspector.equipment`, api.md "Equipment entries",
   * compatibility.md "Equipment"/"Facewear"): a slot that is not a record is `invalid`
   * (INVALID_FIELD); lanes and dyes are uint16 via `isUint(raw, 65535)` (safe integer, 0..65535);
   * dyes are read before the lane check, so they survive an incomplete model; any lane that is
   * not valid gives INCOMPLETE_MODEL, status `invalid`, model null; a complete model is `worn` when
   * base > 0 (weapons: or set > 0), else `empty`, keeping the stored variant; facewear is
   * `isUint(raw)` or a record whose own `GlassesId` is `isUint` (default max 65535), zero valid.
   * The reader refuses any unsafe integer anywhere with INVALID_NUMBER (read.ts).
   *
   * Every document carries `LEyeColor: 0` so the host does not refuse it (no colour key), except
   * GEA-32, which pins exactly that refusal.
   */
  const doc = (extra: Record<string, unknown> = {}): Record<string, unknown> =>
    char({ LEyeColor: 0, ...extra });

  const geaCases: ParityCase[] = [
    // ------------------------------------------------------------ worn slots and dye channels
    {
      id: 'GEA-01',
      title: 'worn armor with both dye channels',
      planRow: 'Task 1 step 2: both dye channels, worn gear',
      doc: doc({ Body: armor(361, 3, 12, 34) }),
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Host: base 361 > 0 is worn, both channels > 0 are emitted. Library: all lanes uint16 so model {361,3}, base > 0 is worn, DyeId/DyeId2 uint16 are valid; an untouched slot stays absent. The adapter needs this model + channels for badges (plan "Worn-slot filtering").',
      lib: {
        equipment: {
          Body: {
            status: 'worn',
            model: { base: 361, variant: 3 },
            dye1: { state: 'valid', value: 12 },
            dye2: { state: 'valid', value: 34 },
          },
          HeadGear: { status: 'absent', model: null },
        },
        noIssueCodes: ['INCOMPLETE_MODEL', 'INVALID_FIELD'],
      },
    },
    {
      id: 'GEA-02',
      title: 'dye on channel 2 only; channel 1 zero',
      planRow: 'Invalid dye or zero dye',
      doc: doc({ Legs: armor(361, 3, 0, 45) }),
      classification: 'preserved',
      note: 'Host drops the zero channel 1 and emits channel 2 (35% of dyed channels are the second one). Library: zero is a valid uint16 stain ("zero stains remain valid evidence", api.md), so dye1 is valid 0, not absent; the projection omits it as undyed.',
      lib: {
        equipment: {
          Legs: {
            status: 'worn',
            model: { base: 361, variant: 3 },
            dye1: { state: 'valid', value: 0 },
            dye2: { state: 'valid', value: 45 },
          },
        },
      },
    },
    {
      id: 'GEA-03',
      title: 'dye on channel 1 only; channel 2 zero',
      planRow: 'Invalid dye or zero dye',
      doc: doc({ Hands: armor(361, 3, 7, 0) }),
      classification: 'preserved',
      note: 'Host emits channel 1 only. Library: dye1 valid 7, dye2 valid 0 (zero is valid evidence, never absent); the projection keeps only valid nonzero channels, so the badge list matches.',
      lib: {
        equipment: {
          Hands: {
            status: 'worn',
            model: { base: 361, variant: 3 },
            dye1: { state: 'valid', value: 7 },
            dye2: { state: 'valid', value: 0 },
          },
        },
      },
    },
    {
      id: 'GEA-04',
      title: 'empty armor slot (base 0, variant 4) still carrying stains 254/255',
      planRow: 'Task 1 step 2: worn/empty gear',
      doc: doc({ HeadGear: armor(0, 4, 254, 255) }),
      classification: 'preserved',
      note: 'Host: base 0 is not worn, so neither the model nor the stains are emitted. Library: lanes are complete uint16, base 0 is `empty` keeping the stored variant 4 (compatibility.md "A ModelBase of 0 with a non-zero ModelVariant is empty"); the stains stay valid evidence that the worn-slot projection filters out.',
      lib: {
        equipment: {
          HeadGear: {
            status: 'empty',
            model: { base: 0, variant: 4 },
            dye1: { state: 'valid', value: 254 },
            dye2: { state: 'valid', value: 255 },
          },
        },
        noIssueCodes: ['INCOMPLETE_MODEL'],
      },
    },
    {
      id: 'GEA-05',
      title: 'weapon worn by base only (set 0)',
      planRow: 'Task 1 step 2: worn gear (weapon triple)',
      doc: doc({ MainHand: weapon(0, 19, 1, 5, 0) }),
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Host: weapon is worn when set > 0 OR base > 0, model carries set 0. Library: ModelSet 0 is a valid uint16 lane, model {set 0, base 19, variant 1}, worn because base > 0 (compatibility.md "Weapons with a positive set or base are worn").',
      lib: {
        equipment: {
          MainHand: {
            status: 'worn',
            model: { set: 0, base: 19, variant: 1 },
            dye1: { state: 'valid', value: 5 },
            dye2: { state: 'valid', value: 0 },
          },
        },
      },
    },
    {
      id: 'GEA-06',
      title: 'weapon worn by set only (base 0)',
      planRow: 'Task 1 step 2: worn gear (weapon triple)',
      doc: doc({ OffHand: weapon(201, 0, 1, 0, 6) }),
      classification: 'preserved',
      note: 'Host: set 201 > 0 makes the weapon worn although base is 0. Library: complete triple, weapon worn because set > 0, model keeps base 0. An implementation applying the armor rule (base > 0) to weapons fails here on either side.',
      lib: {
        equipment: {
          OffHand: {
            status: 'worn',
            model: { set: 201, base: 0, variant: 1 },
            dye2: { state: 'valid', value: 6 },
          },
        },
      },
    },
    {
      id: 'GEA-07',
      title: 'hidden weapon: all lanes 0 with Anamnesis stains 254/255',
      planRow: 'Task 1 step 2: worn/empty gear',
      doc: doc({ MainHand: weapon(0, 0, 0, 254, 255) }),
      classification: 'preserved',
      note: 'Host: set 0 and base 0 is empty, so the 254/255 stains (Anamnesis hidden weapon) colour nothing and are not emitted. Library: complete all-zero triple is `empty` ("All-zero valid models are empty"), stains valid evidence for the projection to drop.',
      lib: {
        equipment: {
          MainHand: {
            status: 'empty',
            model: { set: 0, base: 0, variant: 0 },
            dye1: { state: 'valid', value: 254 },
            dye2: { state: 'valid', value: 255 },
          },
        },
      },
    },
    {
      id: 'GEA-08',
      title: 'null hand records',
      planRow: 'Task 1 step 2: worn/empty gear',
      doc: doc({ MainHand: null, OffHand: null }),
      classification: 'preserved',
      note: 'Host: a null record is skipped like an empty slot (one Anamnesis file). Library: the slot field state is `null`, so status is `null` and no model is returned (inspect.ts copies a non-valid stored state into status). Neither side emits a worn piece.',
      lib: {
        equipment: {
          MainHand: { status: 'null', model: null },
          OffHand: { status: 'null', model: null },
        },
        noIssueCodes: ['INCOMPLETE_MODEL', 'INVALID_FIELD'],
      },
    },
    {
      id: 'GEA-09',
      title: 'slot value that is a string, not a record',
      planRow: 'Unknown tribe/gender or malformed color (invalid gear never refuses)',
      doc: doc({ Body: '361' }),
      classification: 'intentional',
      note: 'Host: `typeof gear !== "object"` silently skips the slot, indistinguishable from no gear. Library: the slot decoder requires a record, so the field is invalid (INVALID_FIELD) and status `invalid`, model null — a bounded diagnostic instead of a silent empty slot (plan row "Unknown tribe/gender or malformed color": invalid gear never refuses and is not coerced). inspect.ts `equipment` returns before reading any lane when the slot is not a record, so the lanes stay absent and no INCOMPLETE_MODEL is raised.',
      lib: {
        equipment: { Body: { status: 'invalid', model: null, base: { state: 'absent' } } },
        issues: [{ code: 'INVALID_FIELD', path: ['Body'] }],
        noIssueCodes: ['INCOMPLETE_MODEL'],
      },
    },

    // ---------------------------------------------------------------- incomplete / invalid lanes
    {
      id: 'GEA-10',
      title: 'armor missing ModelBase, and armor with a null ModelBase',
      planRow: 'Missing/fractional model lanes',
      doc: doc({
        Feet: { ModelVariant: 2, DyeId: 5, DyeId2: 0 },
        Legs: { ModelBase: null, ModelVariant: 1, DyeId: 0, DyeId2: 0 },
      }),
      classification: 'intentional',
      note: 'Host defaults a missing or null lane to 0, so both pieces read as empty and the Feet dye is dropped. Library: an absent or null ModelBase is not valid, so INCOMPLETE_MODEL, status invalid, model null ("Missing/null lanes are incomplete; they never default to zero"); absent and null states raise no INVALID_FIELD, and the dye read before the lane check stays valid.',
      lib: {
        equipment: {
          Feet: {
            status: 'invalid',
            model: null,
            base: { state: 'absent' },
            variant: { state: 'valid', value: 2 },
            dye1: { state: 'valid', value: 5 },
          },
          Legs: {
            status: 'invalid',
            model: null,
            base: { state: 'null', raw: null },
            variant: { state: 'valid', value: 1 },
          },
        },
        issues: [
          { code: 'INCOMPLETE_MODEL', path: ['Feet'] },
          { code: 'INCOMPLETE_MODEL', path: ['Legs'] },
        ],
        noIssueCodes: ['INVALID_FIELD'],
      },
    },
    {
      id: 'GEA-11',
      title: 'weapon missing ModelSet with a positive base',
      planRow: 'Missing/fractional model lanes',
      doc: doc({ MainHand: { ModelBase: 19, ModelVariant: 1, DyeId: 3, DyeId2: 0 } }),
      classification: 'intentional',
      note: 'HOST QUIRK: the plan row says the old parser coerces missing lanes to zero (empty), but a coerced ModelSet beside a positive base gives a WORN weapon with an invented 0 lane, {set 0, base 19, variant 1}, plus its dye (chara-parser.ts:561-570, readModelLane :599-603; isWornCharaModel is set > 0 || base > 0 for weapons). Library: weapons need ModelSet (inspect.ts:188-193), so the set lane is absent, INCOMPLETE_MODEL at [MainHand], status invalid, model null (plan: "Do not invent or floor lanes"); the dye stays valid evidence.',
      lib: {
        equipment: {
          MainHand: {
            status: 'invalid',
            model: null,
            set: { state: 'absent' },
            base: { state: 'valid', value: 19 },
            variant: { state: 'valid', value: 1 },
            dye1: { state: 'valid', value: 3 },
          },
        },
        issues: [{ code: 'INCOMPLETE_MODEL', path: ['MainHand'] }],
        noIssueCodes: ['INVALID_FIELD'],
      },
    },
    {
      id: 'GEA-12',
      title: 'fractional armor lane 5.7',
      planRow: 'Missing/fractional model lanes',
      doc: doc({ Body: { ModelBase: 5.7, ModelVariant: 1, DyeId: 9, DyeId2: 0 } }),
      classification: 'intentional',
      note: 'Host floors a positive fraction (5.7 -> 5) and treats the piece as worn, dye included. Library: 5.7 is not a safe integer, so ModelBase is invalid (INVALID_FIELD) and the model incomplete (INCOMPLETE_MODEL), status invalid, model null; the dye stays valid.',
      lib: {
        equipment: {
          Body: {
            status: 'invalid',
            model: null,
            base: { state: 'invalid', raw: 5.7 },
            variant: { state: 'valid', value: 1 },
            dye1: { state: 'valid', value: 9 },
          },
        },
        issues: [
          { code: 'INVALID_FIELD', path: ['Body', 'ModelBase'] },
          { code: 'INCOMPLETE_MODEL', path: ['Body'] },
        ],
      },
    },
    {
      id: 'GEA-13',
      title: 'lane 65535 is accepted by both',
      planRow: 'Missing/fractional model lanes',
      doc: doc({ Ears: armor(65535, 65535) }),
      classification: 'preserved',
      note: 'Host keeps any positive finite lane. Library: 65535 is the uint16 maximum (`isUint(raw, 65535)` is inclusive), so the model is complete and worn. Pins the upper bound from below; GEA-14 pins it from above.',
      lib: {
        equipment: { Ears: { status: 'worn', model: { base: 65535, variant: 65535 } } },
        noIssueCodes: ['INCOMPLETE_MODEL', 'INVALID_FIELD'],
      },
    },
    {
      id: 'GEA-14',
      title: 'lane 65536 is out of uint16 range',
      planRow: 'Missing/fractional model lanes',
      doc: doc({ Neck: armor(65536, 1) }),
      classification: 'intentional',
      note: 'Host emits 65536 unchanged as a worn base. Library: above the uint16 maximum the lane is invalid (INVALID_FIELD) and the model incomplete (INCOMPLETE_MODEL), status invalid, model null (plan: "Require complete uint16 models").',
      lib: {
        equipment: {
          Neck: {
            status: 'invalid',
            model: null,
            base: { state: 'invalid', raw: 65536 },
            variant: { state: 'valid', value: 1 },
          },
        },
        issues: [
          { code: 'INVALID_FIELD', path: ['Neck', 'ModelBase'] },
          { code: 'INCOMPLETE_MODEL', path: ['Neck'] },
        ],
      },
    },
    {
      id: 'GEA-15',
      title: 'negative and string-valued base lanes',
      planRow: 'Missing/fractional model lanes',
      doc: doc({
        Wrists: { ModelBase: -3, ModelVariant: 1, DyeId: 4, DyeId2: 0 },
        RightRing: { ModelBase: '50', ModelVariant: 1, DyeId: 0, DyeId2: 0 },
      }),
      classification: 'intentional',
      note: 'Host coerces a negative or non-numeric lane to 0, so both pieces read as empty and Wrists loses its dye. Library: neither is a uint, so both lanes are invalid, both models incomplete, status invalid, model null — never an empty slot (review focus 1: no fabricated empty equipment slot).',
      lib: {
        equipment: {
          Wrists: {
            status: 'invalid',
            model: null,
            base: { state: 'invalid', raw: -3 },
            variant: { state: 'valid', value: 1 },
            dye1: { state: 'valid', value: 4 },
          },
          RightRing: {
            status: 'invalid',
            model: null,
            base: { state: 'invalid', raw: '50' },
            variant: { state: 'valid', value: 1 },
          },
        },
        issues: [
          { code: 'INVALID_FIELD', path: ['Wrists', 'ModelBase'] },
          { code: 'INCOMPLETE_MODEL', path: ['Wrists'] },
          { code: 'INVALID_FIELD', path: ['RightRing', 'ModelBase'] },
          { code: 'INCOMPLETE_MODEL', path: ['RightRing'] },
        ],
      },
    },
    {
      id: 'GEA-16',
      title: 'negative variant beside a valid base',
      planRow: 'Missing/fractional model lanes',
      doc: doc({ LeftRing: { ModelBase: 50, ModelVariant: -1, DyeId: 0, DyeId2: 0 } }),
      classification: 'intentional',
      note: 'HOST QUIRK: the plan row says coerced lanes read as empty, but a coerced ModelVariant beside a positive base gives a WORN ring with an invented 0 lane, {50, 0}, that does not exist in the file (chara-parser.ts:563-569). Library: ModelVariant is not a uint, so INVALID_FIELD at [LeftRing, ModelVariant] + INCOMPLETE_MODEL at [LeftRing], status invalid, model null.',
      lib: {
        equipment: {
          LeftRing: {
            status: 'invalid',
            model: null,
            base: { state: 'valid', value: 50 },
            variant: { state: 'invalid', raw: -1 },
          },
        },
        issues: [
          { code: 'INVALID_FIELD', path: ['LeftRing', 'ModelVariant'] },
          { code: 'INCOMPLETE_MODEL', path: ['LeftRing'] },
        ],
      },
    },

    // ------------------------------------------------------------------------- dye values
    {
      id: 'GEA-17',
      title: 'fractional dye 2.5 on a worn piece',
      planRow: 'Invalid dye or zero dye',
      doc: doc({ Body: armor(361, 3, 2.5, 0) }),
      classification: 'intentional',
      note: 'Host emits any positive finite dye as stored, so stainId 2.5 reaches the badge list. Library: 2.5 is not a uint16, dye1 invalid (INVALID_FIELD); dyes are independent so the model stays complete and worn (api.md "missing/invalid dyes cannot invalidate a supported model").',
      lib: {
        equipment: {
          Body: {
            status: 'worn',
            model: { base: 361, variant: 3 },
            dye1: { state: 'invalid' },
            dye2: { state: 'valid', value: 0 },
          },
        },
        issueCodes: ['INVALID_FIELD'],
        noIssueCodes: ['INCOMPLETE_MODEL'],
      },
    },
    {
      id: 'GEA-18',
      title: 'negative dye on channel 1, null dye on channel 2',
      planRow: 'Invalid dye or zero dye',
      doc: doc({ Body: { ModelBase: 361, ModelVariant: 3, DyeId: -5, DyeId2: null } }),
      classification: 'intentional',
      note: 'Host silently drops both (not a positive finite number), as if undyed. Library: -5 is invalid (INVALID_FIELD at [Body, DyeId]) and null is the `null` state, neither one called undyed; the model stays worn. The badge projection (valid nonzero channels only) is unchanged, an empty list; the difference is the diagnostic that plan row "Invalid dye or zero dye" adopts ("retain a diagnostic for invalid channels, without calling them undyed").',
      lib: {
        equipment: {
          Body: {
            status: 'worn',
            model: { base: 361, variant: 3 },
            dye1: { state: 'invalid', raw: -5 },
            dye2: { state: 'null', raw: null },
          },
        },
        issues: [{ code: 'INVALID_FIELD', path: ['Body', 'DyeId'] }],
        noIssueCodes: ['INCOMPLETE_MODEL'],
      },
    },
    {
      id: 'GEA-19',
      title: 'dye 65535 valid and dye 65536 invalid while the model stays valid',
      planRow: 'Invalid dye or zero dye',
      doc: doc({ Feet: armor(6026, 2, 65535, 65536) }),
      classification: 'intentional',
      blocksIfDiverges: true,
      note: 'Host emits both values as stored. Library: 65535 is the inclusive uint16 maximum (valid), 65536 is invalid (INVALID_FIELD), and the invalid channel does not invalidate the model, still worn {6026,2} (api.md "Dyes are independent"). Blocking: the plan needs valid models usable beside invalid channels.',
      lib: {
        equipment: {
          Feet: {
            status: 'worn',
            model: { base: 6026, variant: 2 },
            dye1: { state: 'valid', value: 65535 },
            dye2: { state: 'invalid' },
          },
        },
        issueCodes: ['INVALID_FIELD'],
        noIssueCodes: ['INCOMPLETE_MODEL'],
      },
    },

    // ------------------------------------------------------------------- all twelve slots
    {
      id: 'GEA-20',
      title: 'all twelve slots worn, keys in scrambled order',
      planRow: 'Task 1 step 2: worn gear',
      doc: doc({
        RightRing: armor(57, 2, 1, 0),
        Feet: armor(6026, 2, 9, 10),
        MainHand: weapon(201, 19, 1, 5, 0),
        Neck: armor(54, 1),
        Body: armor(361, 3, 12, 34),
        OffHand: weapon(251, 3, 2, 0, 6),
        Ears: armor(53, 1),
        HeadGear: armor(6025, 1, 7, 0),
        LeftRing: armor(56, 1),
        Hands: armor(361, 3, 0, 8),
        Wrists: armor(55, 1),
        Legs: armor(361, 3),
      }),
      classification: 'preserved',
      note: 'HOST QUIRK: the ParsedCharaFile docstrings say gearDyes/gearModels are "in file slot order" (chara-parser.ts:148,150), but the code walks the fixed GEAR_SLOTS order (chara-parser.ts:557: MainHand, OffHand, HeadGear, Body, Hands, Legs, Feet, Ears, Neck, Wrists, LeftRing, RightRing), not document order, for models and dyes alike; the adapter projection must emit that fixed order. Library inspects every EQUIPMENT_SLOTS entry by name, so every slot is worn with its own lanes; order lives in the projection.',
      lib: {
        equipment: {
          MainHand: {
            status: 'worn',
            model: { set: 201, base: 19, variant: 1 },
            dye1: { state: 'valid', value: 5 },
          },
          OffHand: {
            status: 'worn',
            model: { set: 251, base: 3, variant: 2 },
            dye2: { state: 'valid', value: 6 },
          },
          HeadGear: {
            status: 'worn',
            model: { base: 6025, variant: 1 },
            dye1: { state: 'valid', value: 7 },
          },
          Body: {
            status: 'worn',
            model: { base: 361, variant: 3 },
            dye2: { state: 'valid', value: 34 },
          },
          Hands: {
            status: 'worn',
            model: { base: 361, variant: 3 },
            dye2: { state: 'valid', value: 8 },
          },
          Legs: { status: 'worn', model: { base: 361, variant: 3 } },
          Feet: {
            status: 'worn',
            model: { base: 6026, variant: 2 },
            dye2: { state: 'valid', value: 10 },
          },
          Ears: { status: 'worn', model: { base: 53, variant: 1 } },
          Neck: { status: 'worn', model: { base: 54, variant: 1 } },
          Wrists: { status: 'worn', model: { base: 55, variant: 1 } },
          LeftRing: { status: 'worn', model: { base: 56, variant: 1 } },
          RightRing: {
            status: 'worn',
            model: { base: 57, variant: 2 },
            dye1: { state: 'valid', value: 1 },
          },
        },
        noIssueCodes: ['INCOMPLETE_MODEL', 'INVALID_FIELD'],
      },
    },

    // ---------------------------------------------------------------------------- Glasses
    {
      id: 'GEA-21',
      title: 'Glasses as an object {GlassesId: 12}',
      planRow: 'Task 1 step 2: both Glasses shapes',
      doc: doc({ Glasses: { GlassesId: 12 } }),
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Host reads the object\'s GlassesId (Anamnesis, Ktisis). Library facewear decoder accepts a record with an own uint16 GlassesId (compatibility.md "Facewear"), valid 12. Losing the current object shape would drop facewear for every modern export.',
      lib: { facewear: { state: 'valid', value: 12 }, noIssueCodes: ['INVALID_FIELD'] },
    },
    {
      id: 'GEA-22',
      title: 'Glasses as a bare integer (Brio-era shape)',
      planRow: 'Task 1 step 2: both Glasses shapes',
      doc: doc({ Glasses: 12 }),
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Host accepts the Brio-era bare integer. Library facewear decoder accepts `isUint(raw)` directly ("legacy numeric and current object representations", api.md), valid 12.',
      lib: { facewear: { state: 'valid', value: 12 }, noIssueCodes: ['INVALID_FIELD'] },
    },
    {
      id: 'GEA-23',
      title: 'Glasses 0 is no facewear',
      planRow: 'Shared interface contract: glassesId 0 maps to null',
      doc: doc({ Glasses: { GlassesId: 0 } }),
      classification: 'preserved',
      note: 'Host: row 0 is "none", read as null. Library: zero is a valid uint ("zero remains valid"), so facewear is valid 0; the contract maps glassesId 0 to null in the projection, so the visible result is preserved.',
      lib: { facewear: { state: 'valid', value: 0 }, noIssueCodes: ['INVALID_FIELD'] },
    },
    {
      id: 'GEA-24',
      title: 'Glasses null',
      planRow: 'Task 1 step 2: both Glasses shapes',
      doc: doc({ Glasses: null }),
      classification: 'preserved',
      note: 'Host: null is not a number, so glassesId null. Library: a present null key is the `null` field state (no issue), distinct from absent; both project to no facewear.',
      lib: { facewear: { state: 'null' }, noIssueCodes: ['INVALID_FIELD'] },
    },
    {
      id: 'GEA-25',
      title: 'Glasses as a numeric string',
      planRow: 'Unknown tribe/gender or malformed color (invalid Glasses never refuses)',
      doc: doc({ Glasses: '12' }),
      classification: 'intentional',
      note: 'Host ignores a string silently (glassesId null, same as none). Library: neither a uint nor a record, so facewear is invalid with INVALID_FIELD ("Missing/invalid nested IDs never default to zero"); not coerced to 12 either.',
      lib: { facewear: { state: 'invalid' }, issueCodes: ['INVALID_FIELD'] },
    },
    {
      id: 'GEA-26',
      title: 'Glasses negative',
      planRow: 'Unknown tribe/gender or malformed color (invalid Glasses never refuses)',
      doc: doc({ Glasses: -4 }),
      classification: 'intentional',
      note: 'Host: not > 0, so silently null. Library: -4 fails `isUint` (value >= 0), facewear invalid with INVALID_FIELD instead of reading as no facewear.',
      lib: { facewear: { state: 'invalid' }, issueCodes: ['INVALID_FIELD'] },
    },
    {
      id: 'GEA-27',
      title: 'Glasses fractional 12.5',
      planRow:
        'Shared interface contract: glassesId (host floors fractions, library requires a uint)',
      doc: doc({ Glasses: 12.5 }),
      classification: 'intentional',
      note: 'Host floors a positive fraction to 12 and would look up a real facewear row. Library: 12.5 is not a safe integer, facewear invalid (INVALID_FIELD); the plan contract names this difference explicitly.',
      lib: { facewear: { state: 'invalid' }, issueCodes: ['INVALID_FIELD'] },
    },
    {
      id: 'GEA-28',
      title: 'Glasses object without GlassesId',
      planRow: 'Unknown tribe/gender or malformed color (invalid Glasses never refuses)',
      doc: doc({ Glasses: {} }),
      classification: 'intentional',
      note: 'Host reads the missing nested key as undefined, so null (no facewear). Library: a record without an own GlassesId is invalid, not absent and not 0 ("Missing/invalid nested IDs never default to zero").',
      lib: { facewear: { state: 'invalid' }, issueCodes: ['INVALID_FIELD'] },
    },
    {
      id: 'GEA-29',
      title: 'Glasses 65536, above uint16',
      planRow: 'Unknown tribe/gender or malformed color (invalid Glasses never refuses)',
      doc: doc({ Glasses: 65536 }),
      classification: 'intentional',
      note: 'Host emits any positive finite integer (65536). Library: `isUint(raw)` defaults to max 65535 (models.ts), so facewear is invalid with INVALID_FIELD (compatibility.md "Facewear: uint16").',
      lib: { facewear: { state: 'invalid' }, issueCodes: ['INVALID_FIELD'] },
    },
    {
      id: 'GEA-30',
      title: 'Glasses as an unsafe integer (2^53) refuses the library read',
      planRow: 'Duplicate keys, depth/node limits, unsafe numbers',
      doc: doc({ Glasses: 9007199254740992 }),
      classification: 'intentional',
      note: 'Plan row 114 (accept the library\'s bounded refusal): an unsafe integer is not a field state in the library, so this is the one Glasses value that refuses the WHOLE document instead of marking facewear invalid. Host: finite and > 0, so glassesId 9007199254740992. Library reader: an integer that is not a safe integer fails INVALID_NUMBER for the whole document (read.ts `value`), before inspection (plan row "unsafe numbers": accept the bounded refusal).',
      lib: { refused: 'INVALID_NUMBER' },
    },
    {
      id: 'GEA-31',
      title: 'Glasses object with a fractional GlassesId',
      planRow:
        'Shared interface contract: glassesId (host floors fractions, library requires a uint)',
      doc: doc({ Glasses: { GlassesId: 2.5 } }),
      classification: 'intentional',
      note: 'Host floors the nested value too (2.5 -> 2). Library: the nested GlassesId must be `isUint`, so facewear is invalid with INVALID_FIELD; pins that the object shape gets the same uint rule as the bare shape (GEA-27).',
      lib: { facewear: { state: 'invalid' }, issueCodes: ['INVALID_FIELD'] },
    },

    // ------------------------------------------------------------- equipment-only document
    {
      id: 'GEA-32',
      title: 'Glasses + Body document without a colour key',
      planRow: 'Partial equipment-only document',
      doc: { Body: armor(361, 3, 12, 0), Glasses: { GlassesId: 12 } },
      classification: 'intentional',
      note: 'Bare document, no identity keys; the Glasses + Body variant (IDN owns the plain Body-only document). Host refuses a file with none of the 15 colour keys; gear and Glasses do not count (chara-parser.ts:472). Library: equipment slots and Glasses are CHARACTER_FIELDS, so readChara admits it (no NOT_CHARACTER); the gear reads worn with its dye and facewear valid ("valid gear remains useful"), and the appearance stays explicitly unresolved ("unresolved appearance stays explicit"): every index is absent, so each slot keeps its unresolved/missingColor default (resolve.ts:264-277) before any palette request, hence no MISSING_PALETTE_CONTEXT (raised later, at :321). Both halves of plan row "Partial equipment-only document", an intentional app change.',
      lib: {
        equipment: {
          Body: {
            status: 'worn',
            model: { base: 361, variant: 3 },
            dye1: { state: 'valid', value: 12 },
            dye2: { state: 'valid', value: 0 },
          },
        },
        facewear: { state: 'valid', value: 12 },
        slots: {
          hair: { interpretation: 'unresolved', reason: 'missingColor', displayHex: null },
          leftEye: { interpretation: 'unresolved', reason: 'missingColor', displayHex: null },
        },
        noIssueCodes: ['MISSING_PALETTE_CONTEXT', 'INCOMPLETE_MODEL'],
      },
    },

    // ------------------------------------------------------- refinement round: shapes and lanes
    {
      id: 'GEA-33',
      title: 'slot value that is an array',
      planRow: 'Unknown tribe/gender or malformed color (invalid gear never refuses)',
      doc: doc({ Body: [] }),
      classification: 'intentional',
      note: 'Host: `typeof [] === "object"` passes the slot gate (chara-parser.ts:559), every lane reads as 0, so the slot is silently skipped as empty. Library: isRecord excludes arrays (field-spec.ts:89), so the slot is invalid with INVALID_FIELD at [Body], status invalid, and inspect.ts returns before the lane check (no INCOMPLETE_MODEL). Sibling of GEA-09: an implementation that admits arrays as records fails here only.',
      lib: {
        equipment: { Body: { status: 'invalid', model: null, base: { state: 'absent' } } },
        issues: [{ code: 'INVALID_FIELD', path: ['Body'] }],
        noIssueCodes: ['INCOMPLETE_MODEL'],
      },
    },
    {
      id: 'GEA-34',
      title: 'Glasses as an array',
      planRow: 'Unknown tribe/gender or malformed color (invalid Glasses never refuses)',
      doc: doc({ Glasses: [] }),
      classification: 'intentional',
      note: 'Host: an array is an object, `[]["GlassesId"]` is undefined, so glassesId null, the same as no facewear (chara-parser.ts:609-615). Library: neither `isUint` nor a record (isRecord excludes arrays), so facewear is invalid with INVALID_FIELD at [Glasses] (inspect.ts:327-336) and keeps the raw [].',
      lib: {
        facewear: { state: 'invalid', raw: [] },
        issues: [{ code: 'INVALID_FIELD', path: ['Glasses'] }],
      },
    },
    {
      id: 'GEA-35',
      title: 'armor carrying ModelSet > 0 with ModelBase 0 is empty',
      planRow: 'Task 1 step 2: worn/empty gear (armor ignores ModelSet)',
      doc: doc({ Body: { ModelSet: 5, ModelBase: 0, ModelVariant: 1, DyeId: 7, DyeId2: 0 } }),
      classification: 'preserved',
      note: 'Host: the armor rule is base > 0 (isWornCharaModel, chara-models.ts:111), so set 5 does not make Body worn and its dye is not emitted. Library: ModelSet is read only for MainHand/OffHand (inspect.ts:188), so the set lane stays absent and the complete armor model {base 0, variant 1} is empty. Mirror of GEA-06: catches the weapon rule applied to armor on either side.',
      lib: {
        equipment: {
          Body: {
            status: 'empty',
            model: { base: 0, variant: 1 },
            set: { state: 'absent' },
            dye1: { state: 'valid', value: 7 },
          },
        },
        noIssueCodes: ['INCOMPLETE_MODEL', 'INVALID_FIELD'],
      },
    },
    {
      id: 'GEA-36',
      title: 'worn piece with no DyeId/DyeId2 keys',
      planRow: 'Invalid dye or zero dye (missing dyes cannot invalidate a supported model)',
      doc: doc({ Body: { ModelBase: 361, ModelVariant: 3 } }),
      classification: 'preserved',
      note: 'Host: emits the worn model and no dyes (an undefined channel is not a positive number). Library: dye1/dye2 are absent with no issue and the complete model stays worn (inspect.ts:107, 186-187; api.md "missing/invalid dyes cannot invalidate a supported model"). Catches an implementation that makes dye keys part of model completeness.',
      lib: {
        equipment: {
          Body: {
            status: 'worn',
            model: { base: 361, variant: 3 },
            dye1: { state: 'absent' },
            dye2: { state: 'absent' },
          },
        },
        noIssueCodes: ['INCOMPLETE_MODEL', 'INVALID_FIELD'],
      },
    },
    {
      id: 'GEA-37',
      title: 'weapon missing ModelSet with ModelBase 0',
      planRow: 'Missing/fractional model lanes',
      doc: doc({ MainHand: { ModelBase: 0, ModelVariant: 1, DyeId: 3, DyeId2: 0 } }),
      classification: 'intentional',
      note: 'Host: the missing set reads as 0, and set 0 with base 0 is not worn, so the weapon and its dye are skipped as an empty slot. Library: weapons need ModelSet (inspect.ts:188-193), so the set lane is absent, INCOMPLETE_MODEL at [MainHand], status invalid, model null, never empty (plan: "omit incomplete/invalid models from lookup and show a bounded warning"). Sibling of GEA-11 (positive base); the visible badge list is the same, the bounded warning is new.',
      lib: {
        equipment: {
          MainHand: {
            status: 'invalid',
            model: null,
            set: { state: 'absent' },
            base: { state: 'valid', value: 0 },
            dye1: { state: 'valid', value: 3 },
          },
        },
        issues: [{ code: 'INCOMPLETE_MODEL', path: ['MainHand'] }],
        noIssueCodes: ['INVALID_FIELD'],
      },
    },
    {
      id: 'GEA-38',
      title: 'Glasses object with a null GlassesId',
      planRow: 'Unknown tribe/gender or malformed color (invalid Glasses never refuses)',
      doc: doc({ Glasses: { GlassesId: null } }),
      classification: 'intentional',
      note: 'Host: the nested null is not a number, so glassesId null. Library: the outer Glasses value is a non-null record, so the field is not the `null` state; its own GlassesId exists but `isUint(null)` is false, so facewear is invalid with INVALID_FIELD at [Glasses] (inspect.ts:327-336). Distinguishes a nested null from a top-level null (GEA-24, state null).',
      lib: {
        facewear: { state: 'invalid', raw: { GlassesId: null } },
        issues: [{ code: 'INVALID_FIELD', path: ['Glasses'] }],
      },
    },
    {
      id: 'GEA-39',
      title: 'Glasses object with a numeric-string GlassesId',
      planRow: 'Unknown tribe/gender or malformed color (invalid Glasses never refuses)',
      doc: doc({ Glasses: { GlassesId: '12' } }),
      classification: 'intentional',
      note: 'Host: the nested string is not a number, so glassesId null (silently, as no facewear). Library: the nested GlassesId must be `isUint`, so facewear is invalid with INVALID_FIELD at [Glasses], never coerced to 12. Object-shape twin of GEA-25.',
      lib: {
        facewear: { state: 'invalid', raw: { GlassesId: '12' } },
        issues: [{ code: 'INVALID_FIELD', path: ['Glasses'] }],
      },
    },
    {
      id: 'GEA-40',
      title: 'Glasses object with GlassesId 65536',
      planRow: 'Unknown tribe/gender or malformed color (invalid Glasses never refuses)',
      doc: doc({ Glasses: { GlassesId: 65536 } }),
      classification: 'intentional',
      note: 'Host: any positive finite nested number is kept, glassesId 65536. Library: the nested GlassesId uses the same `isUint` default maximum 65535 as the bare shape, so facewear is invalid with INVALID_FIELD at [Glasses]. Object-shape twin of GEA-29: catches a decoder that range-checks only the bare integer.',
      lib: {
        facewear: { state: 'invalid', raw: { GlassesId: 65536 } },
        issues: [{ code: 'INVALID_FIELD', path: ['Glasses'] }],
      },
    },
    {
      id: 'GEA-41',
      title: 'dye as a numeric string on a worn piece',
      planRow: 'Invalid dye or zero dye',
      doc: doc({ Body: { ModelBase: 361, ModelVariant: 3, DyeId: '5', DyeId2: 0 } }),
      classification: 'intentional',
      note: 'Host silently drops the non-numeric channel as if undyed (typeof check, chara-parser.ts:576). Library: "5" is not a uint16, so dye1 is invalid with INVALID_FIELD at [Body, DyeId], keeping the raw string, and the model stays worn. Plan row "Invalid dye or zero dye" names non-numeric dyes explicitly: retain a diagnostic, never coerce to 5.',
      lib: {
        equipment: {
          Body: {
            status: 'worn',
            model: { base: 361, variant: 3 },
            dye1: { state: 'invalid', raw: '5' },
            dye2: { state: 'valid', value: 0 },
          },
        },
        issues: [{ code: 'INVALID_FIELD', path: ['Body', 'DyeId'] }],
        noIssueCodes: ['INCOMPLETE_MODEL'],
      },
    },
    {
      id: 'GEA-42',
      title: 'Glasses key absent',
      planRow: 'Task 1 step 2: both Glasses shapes (absent key)',
      doc: doc(),
      classification: 'preserved',
      note: 'Host: record.Glasses is undefined, so glassesId null. Library: no own Glasses key gives facewear state `absent` (inspect.ts:107), distinct from a present null (GEA-24) and raising no issue; both project to no facewear.',
      lib: { facewear: { state: 'absent' }, noIssueCodes: ['INVALID_FIELD'] },
    },
    {
      id: 'GEA-43',
      title: 'invalid slot beside a valid worn slot',
      planRow: 'Missing/fractional model lanes (retaining valid other slots)',
      doc: doc({
        Body: armor(361, 3, 12, 0),
        Hands: { ModelBase: -3, ModelVariant: 1, DyeId: 4, DyeId2: 0 },
      }),
      classification: 'intentional',
      blocksIfDiverges: true,
      note: 'Host: Body is emitted worn with its dye; the negative Hands base is coerced to 0, so Hands is silently skipped. Library: Hands is invalid (INVALID_FIELD at [Hands, ModelBase], INCOMPLETE_MODEL at [Hands]), while Body stays worn {361,3} with dye1 12 (plan row: "omit incomplete/invalid models ... while retaining valid other slots"). Blocking: the Body half is the required contract that one bad slot never takes valid gear down with it; the Hands half is the intentional new warning.',
      lib: {
        equipment: {
          Body: {
            status: 'worn',
            model: { base: 361, variant: 3 },
            dye1: { state: 'valid', value: 12 },
          },
          Hands: {
            status: 'invalid',
            model: null,
            base: { state: 'invalid', raw: -3 },
            dye1: { state: 'valid', value: 4 },
          },
        },
        issues: [
          { code: 'INVALID_FIELD', path: ['Hands', 'ModelBase'] },
          { code: 'INCOMPLETE_MODEL', path: ['Hands'] },
        ],
      },
    },
    {
      id: 'GEA-44',
      title: 'armor missing ModelVariant beside a positive base',
      planRow: 'Missing/fractional model lanes',
      doc: doc({ Body: { ModelBase: 361, DyeId: 4, DyeId2: 0 } }),
      classification: 'intentional',
      note: 'HOST QUIRK: the missing variant is coerced to 0 and, base 361 being > 0, the host emits a WORN piece {361, 0} that the file never named, plus its dye (chara-parser.ts:563-577). Library: ModelVariant absent, so INCOMPLETE_MODEL at [Body], status invalid, model null, base valid 361 and the dye kept as evidence; an absent lane raises no INVALID_FIELD (plan: "Do not invent or floor lanes").',
      lib: {
        equipment: {
          Body: {
            status: 'invalid',
            model: null,
            base: { state: 'valid', value: 361 },
            variant: { state: 'absent' },
            dye1: { state: 'valid', value: 4 },
          },
        },
        issues: [{ code: 'INCOMPLETE_MODEL', path: ['Body'] }],
        noIssueCodes: ['INVALID_FIELD'],
      },
    },
  ];

  return geaCases;
})();

// ---- section ACT
const actCasesSection: ParityCase[] = (() => {
  /*
   * Section ACT: activation controls (EnableHighlights, FacePaint, the Mouth lip-colour bit) and the lip.
   * ACT-01 now lives here as the plan's verbatim highlights + face-paint tuple; the seed's ACT-01
   * (char()-wrapped) must be dropped at assembly so the register keeps exactly one copy.
   * ACT-11 was deleted (it added no discriminator beyond ACT-09); ids are stable, so the gap stays.
   *
   * Register split for every unknown-activation case (active null): the colour evidence
   * (interpretation / displayHex) is preserved; the intentional host change is `matchHex: null`
   * (Task 3), and the Task 3 adapter must key its activity-unknown warning on `active === null`,
   * never on `reason` (a stored float turns the reason into extendedInactive / ambiguousZeroBlock).
   *
   * Literal palette values (lookup.ts, host sheets = bundled provider data):
   *   highlights 0: creator #F7F7F7; facePaintDark 0: creator #F8F8F8
   *   highlights 10: creator #F4EACD, shader #F4EACD
   *   lipsDark 53: creator #621C33, shader #340A1C
   *   facePaintDark 5: creator #484848 (no shader entry)
   *   skin 12 Wildwood Feminine: creator #B18D73, shader #AC9B8A
   * Lip composite #621C33 over #B18D73 in linear sRGB: alpha 0.5 → #90685A, alpha 1 → #621C33
   * (computed by hand from the sRGB transfer functions; the host's blendHex confirms it).
   *
   * Library rules cited below are from xivcharakit `appearance/resolve.ts` (activation:
   * highlights = the EnableHighlights field, face paint = `FacePaint & ~0x80` !== 0, lip = Mouth bit
   * 0x80 on a known non-Hrothgar race; `active === false` → inactive before the noLip check; reason
   * chain ambiguousZeroBlock → extendedInactive → activityUnknown → paletteOnly) and `inspect.ts`
   * (`EnableHighlights` valid only as a boolean; `FacePaint`/`Mouth` valid only as a uint 0–255).
   */
  const HROTHGAR = { Race: 'Hrothgar', Tribe: 'Helions', Gender: 'Masculine' };
  /** Every one of the seven floats zero in every channel, MouthColor with its 4th (alpha) part. */
  const ZERO_BLOCK = {
    SkinColor: '0, 0, 0',
    LeftEyeColor: '0, 0, 0',
    RightEyeColor: '0, 0, 0',
    LimbalRingColor: '0, 0, 0',
    HairColor: '0, 0, 0',
    HairHighlight: '0, 0, 0',
    MouthColor: '0, 0, 0, 0',
  };

  const actCases: ParityCase[] = [
    // ------------------------------------------------------------- EnableHighlights
    {
      id: 'ACT-01',
      title: 'plan tuple: highlights and face paint without their controls give activity unknown',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color',
      doc: { Highlights: 0, FacePaintColor: 0 },
      provider: 'gray',
      classification: 'intentional',
      note: 'Shared interface contract, verbatim synthetic tuple {"Highlights":0,"FacePaintColor":0} with a #808080 provider: EnableHighlights absent → active null; FacePaint absent → paint null → active null; both palettes are shared (no tribe/gender needed), so palette / #808080 / activityUnknown for both slots. The host treats a missing flag as enabled and a missing FacePaint as painted (#F7F7F7, #F8F8F8). Colour evidence is preserved; the intentional change is host matchHex: null (Task 3). The only FacePaint-absent case in the register.',
      lib: {
        identity: { canonicalRace: null },
        noIssueCodes: ['INVALID_FIELD'],
        slots: {
          highlights: {
            active: null,
            interpretation: 'palette',
            displayHex: '#808080',
            reason: 'activityUnknown',
          },
          facePaint: {
            active: null,
            interpretation: 'palette',
            displayHex: '#808080',
            reason: 'activityUnknown',
          },
        },
      },
    },
    {
      id: 'ACT-02',
      title: 'EnableHighlights true: both show the highlight palette color',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color',
      doc: char({ Highlights: 10, EnableHighlights: true }),
      provider: 'gray',
      classification: 'preserved',
      note: 'A valid true flag makes the library slot active (resolve.ts: active = EnableHighlights value); with no extended color the reason is paletteOnly, which separates it from the activityUnknown of a missing flag. The host resolves index 10 to #F4EACD.',
      lib: {
        slots: {
          highlights: {
            active: true,
            interpretation: 'palette',
            reason: 'paletteOnly',
            displayHex: '#808080',
          },
        },
      },
    },
    {
      id: 'ACT-03',
      title: 'EnableHighlights false: both make highlights inert',
      planRow: 'Explicitly disabled highlight or face-paint control',
      doc: char({ Highlights: 10, EnableHighlights: false }),
      provider: 'gray',
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Plan row: the host inerts EnableHighlights false (highlightsDisabled) and the library must give active false, inactive, highlightsDisabled with no display color (resolve.ts final loop, active === false branch).',
      lib: {
        slots: {
          highlights: {
            active: false,
            interpretation: 'inactive',
            reason: 'highlightsDisabled',
            displayHex: null,
          },
        },
      },
    },
    {
      id: 'ACT-04',
      title: 'EnableHighlights null: host enabled, library activity unknown',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color',
      doc: char({ Highlights: 10, EnableHighlights: null }),
      provider: 'gray',
      classification: 'intentional',
      note: 'The host inerts only a literal false (`!== false`), so null shows the highlight. The library field is state null with no issue (inspect.ts field(): null returns before decode), current() gives null, so active null; with no extended color the reason is activityUnknown and the palette preview is kept. Colour evidence is preserved; the intentional change is host matchHex: null (Task 3).',
      lib: {
        noIssueCodes: ['INVALID_FIELD'],
        slots: {
          highlights: {
            active: null,
            interpretation: 'palette',
            reason: 'activityUnknown',
            displayHex: '#808080',
          },
        },
      },
    },
    {
      id: 'ACT-05',
      title:
        'EnableHighlights "yes" (non-boolean): host enabled, library invalid field and unknown',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color',
      doc: char({ Highlights: 10, EnableHighlights: 'yes' }),
      provider: 'gray',
      classification: 'intentional',
      note: 'The host treats any non-false value as enabled and never refuses the file for it. inspect.ts accepts only a boolean, so "yes" is an invalid field (INVALID_FIELD at ["EnableHighlights"]) and the slot is active null / activityUnknown, not true. Colour evidence is preserved; the intentional change is host matchHex: null (Task 3).',
      lib: {
        issueCodes: ['INVALID_FIELD'],
        issues: [{ code: 'INVALID_FIELD', path: ['EnableHighlights'] }],
        slots: {
          highlights: {
            active: null,
            interpretation: 'palette',
            reason: 'activityUnknown',
            displayHex: '#808080',
          },
        },
      },
    },
    {
      id: 'ACT-06',
      title: 'EnableHighlights false over a live off-grid highlight float stays inactive',
      planRow: 'Explicitly disabled highlight or face-paint control',
      doc: char({
        Highlights: 10,
        EnableHighlights: false,
        IsExtendedAppearanceValid: true,
        HairHighlight: squared('#00FF00'),
      }),
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Plan row: disabled "whatever the extended data" (the same required contract as ACT-03/07). The library sets extendedActive false and inactive/highlightsDisabled for active false even when the float is live, but keeps the decoded extendedHex and the creator color as evidence; the host makes it inert with the float hex kept.',
      lib: {
        slots: {
          highlights: {
            active: false,
            interpretation: 'inactive',
            reason: 'highlightsDisabled',
            extendedActive: false,
            extendedHex: '#00FF00',
            creatorHex: '#F4EACD',
            displayHex: null,
          },
        },
      },
    },
    // ------------------------------------------------------------------- FacePaint
    {
      id: 'ACT-07',
      title: 'FacePaint 0: both make face paint inert',
      planRow: 'Explicitly disabled highlight or face-paint control',
      doc: char({ FacePaintColor: 5, FacePaint: 0 }),
      provider: 'gray',
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Plan row: the host inerts FacePaint 0 (facePaintNone) and the library gives active false (0 & ~0x80 === 0), inactive, facePaintNone.',
      lib: {
        slots: {
          facePaint: {
            active: false,
            interpretation: 'inactive',
            reason: 'facePaintNone',
            displayHex: null,
          },
        },
      },
    },
    {
      id: 'ACT-08',
      title: 'FacePaint 128 (mirror flag alone): host paints, library none',
      planRow: 'FacePaint mirror flag alone (128)',
      doc: char({ FacePaintColor: 5, FacePaint: 128 }),
      provider: 'gray',
      classification: 'intentional',
      note: 'Plan row: only 0 inerts on the host, so 128 shows #484848. The library masks the mirror bit (128 & ~0x80 === 0) and gives active false, inactive, facePaintNone.',
      lib: {
        slots: {
          facePaint: {
            active: false,
            interpretation: 'inactive',
            reason: 'facePaintNone',
            displayHex: null,
          },
        },
      },
    },
    {
      id: 'ACT-09',
      title: 'FacePaint 129 (mirrored style 1): both paint',
      planRow: 'FacePaint mirror flag alone (128)',
      doc: char({ FacePaintColor: 5, FacePaint: 129 }),
      provider: 'gray',
      classification: 'preserved',
      note: 'Plan row: a value with non-zero low bits stays active. 129 & ~0x80 = 1, so library active true with reason paletteOnly (no extended color for face paint); host shows #484848.',
      lib: {
        slots: {
          facePaint: {
            active: true,
            interpretation: 'palette',
            reason: 'paletteOnly',
            displayHex: '#808080',
          },
        },
      },
    },
    {
      id: 'ACT-10',
      title: 'FacePaint 4 (plain style): both paint',
      planRow: 'FacePaint mirror flag alone (128)',
      doc: char({ FacePaintColor: 5, FacePaint: 4 }),
      provider: 'gray',
      classification: 'preserved',
      note: 'A valid style without the mirror bit: library active true (4 & ~0x80 = 4), paletteOnly; host shows #484848. Rules out an implementation that reads only bit 0x80 or only the value 1.',
      lib: {
        slots: {
          facePaint: {
            active: true,
            interpretation: 'palette',
            reason: 'paletteOnly',
            displayHex: '#808080',
          },
        },
      },
    },
    {
      id: 'ACT-12',
      title: 'FacePaint null: host paints, library activity unknown',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color',
      doc: char({ FacePaintColor: 5, FacePaint: null }),
      provider: 'gray',
      classification: 'intentional',
      note: 'Host readIndex gives null, which is not 0, so the paint shows. Library FacePaint field state null (no issue) → paint null → active null; reason activityUnknown with the palette preview kept. Colour evidence is preserved; the intentional change is host matchHex: null (Task 3).',
      lib: {
        noIssueCodes: ['INVALID_FIELD'],
        slots: {
          facePaint: {
            active: null,
            interpretation: 'palette',
            reason: 'activityUnknown',
            displayHex: '#808080',
          },
        },
      },
    },
    {
      id: 'ACT-13',
      title: 'FacePaint non-numeric: host refuses the file, library invalid field and unknown',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color',
      doc: char({ FacePaintColor: 5, FacePaint: 'none' }),
      provider: 'gray',
      classification: 'intentional',
      note: 'Plan row: a non-numeric FacePaint refuses the host file (readIndex). The library keeps the document: FacePaint is an invalid uint8 field (INVALID_FIELD), so face paint is active null / activityUnknown with its palette preview. Colour evidence is kept; the intentional change is host matchHex: null (Task 3).',
      lib: {
        issueCodes: ['INVALID_FIELD'],
        issues: [{ code: 'INVALID_FIELD', path: ['FacePaint'] }],
        slots: {
          facePaint: {
            active: null,
            interpretation: 'palette',
            reason: 'activityUnknown',
            displayHex: '#808080',
          },
        },
      },
    },
    {
      id: 'ACT-14',
      title: 'FacePaint 256 (beyond uint8): host paints, library invalid field and unknown',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color',
      doc: char({ FacePaintColor: 5, FacePaint: 256 }),
      provider: 'gray',
      classification: 'intentional',
      note: 'The host paints any non-zero number. inspect.ts reads FacePaint with integer(…, 255), so 256 is invalid (not masked to 0, which would wrongly give facePaintNone): active null, activityUnknown, INVALID_FIELD at ["FacePaint"]. Colour evidence is preserved; the intentional change is host matchHex: null (Task 3).',
      lib: {
        issueCodes: ['INVALID_FIELD'],
        issues: [{ code: 'INVALID_FIELD', path: ['FacePaint'] }],
        slots: {
          facePaint: {
            active: null,
            interpretation: 'palette',
            reason: 'activityUnknown',
            displayHex: '#808080',
          },
        },
      },
    },
    // ------------------------------------------------------------ Mouth lip-color bit
    {
      id: 'ACT-15',
      title: 'Mouth 128 (lip bit set) on a Wildwood: both show the lip',
      planRow: 'Lip-color bit (0x80 of Mouth) clear',
      doc: char({ LipsToneFurPattern: 53, Mouth: 128 }),
      provider: 'gray',
      classification: 'preserved',
      note: 'Known non-Hrothgar race with bit 0x80 set: library lipEnabled true → active true, paletteOnly. The host never reads Mouth and shows lipsDark 53 (#621C33).',
      lib: {
        slots: {
          lip: {
            active: true,
            interpretation: 'palette',
            reason: 'paletteOnly',
            displayHex: '#808080',
            indexMeaning: 'color',
          },
        },
      },
    },
    {
      id: 'ACT-16',
      title: 'Mouth 131 (lip bit set plus a mouth shape): both show the lip',
      planRow: 'Lip-color bit (0x80 of Mouth) clear',
      doc: char({ LipsToneFurPattern: 53, Mouth: 131 }),
      provider: 'gray',
      classification: 'preserved',
      note: '131 & 0x80 is non-zero, so library active true / paletteOnly: the bit is tested, not the whole value compared to 128. Host shows #621C33.',
      lib: {
        slots: {
          lip: {
            active: true,
            interpretation: 'palette',
            reason: 'paletteOnly',
            displayHex: '#808080',
          },
        },
      },
    },
    {
      id: 'ACT-17',
      title: 'Mouth 2 (lip bit clear) on a Wildwood: host shows the lip, library disables it',
      planRow: 'Lip-color bit (0x80 of Mouth) clear',
      doc: char({ LipsToneFurPattern: 53, Mouth: 2 }),
      provider: 'gray',
      classification: 'intentional',
      blocksIfDiverges: true,
      note: 'Plan row: follow library activation (required contract: lip-bit-clear stays inactive). Bit clear on a known non-Hrothgar race → lipEnabled false → active false, inactive, lipDisabled. The host never reads Mouth and shows #621C33 (the committed Ktisis export case).',
      lib: {
        slots: {
          lip: {
            active: false,
            interpretation: 'inactive',
            reason: 'lipDisabled',
            displayHex: null,
          },
        },
      },
    },
    {
      id: 'ACT-18',
      title: 'Mouth 0 on a Wildwood: library disables the lip',
      planRow: 'Lip-color bit (0x80 of Mouth) clear',
      doc: char({ LipsToneFurPattern: 53, Mouth: 0 }),
      provider: 'gray',
      classification: 'intentional',
      blocksIfDiverges: true,
      note: 'A valid Mouth 0 has the bit clear, so the library gives lipDisabled (not activityUnknown: 0 is a value, not a missing control). Host shows #621C33.',
      lib: {
        slots: {
          lip: {
            active: false,
            interpretation: 'inactive',
            reason: 'lipDisabled',
            displayHex: null,
          },
        },
      },
    },
    {
      id: 'ACT-19',
      title: 'plan lip tuple: Wildwood lip index without Mouth gives activity unknown',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color',
      doc: { Tribe: 'Wildwood', LipsToneFurPattern: 53 },
      provider: 'gray',
      classification: 'intentional',
      note: 'Shared interface contract, verbatim synthetic tuple: {"Tribe":"Wildwood","LipsToneFurPattern":53} with a #808080 provider yields lip active null, palette, #808080, activityUnknown (Mouth absent on a known race → lipEnabled null). The host shows lipsDark 53. Colour evidence is preserved; the intentional change is host matchHex: null (Task 3). Not blocking: activity-unknown is not on ruling 8\'s required-contract list.',
      lib: {
        identity: { canonicalRace: 'Elezen', gender: { state: 'absent' } },
        slots: {
          lip: {
            active: null,
            interpretation: 'palette',
            displayHex: '#808080',
            reason: 'activityUnknown',
          },
        },
      },
    },
    {
      id: 'ACT-20',
      title: 'Mouth null on a Wildwood: library activity unknown',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color',
      doc: char({ LipsToneFurPattern: 53, Mouth: null }),
      provider: 'gray',
      classification: 'intentional',
      note: 'Mouth field state null (no issue) → current() null → lipEnabled null on a known race: active null, palette preview, activityUnknown. Host ignores Mouth and shows #621C33. Colour evidence is preserved; the intentional change is host matchHex: null (Task 3).',
      lib: {
        noIssueCodes: ['INVALID_FIELD'],
        slots: {
          lip: {
            active: null,
            interpretation: 'palette',
            reason: 'activityUnknown',
            displayHex: '#808080',
          },
        },
      },
    },
    {
      id: 'ACT-21',
      title: 'Mouth "open" (invalid): host unaffected, library invalid field and unknown',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color',
      doc: char({ LipsToneFurPattern: 53, Mouth: 'open' }),
      provider: 'gray',
      classification: 'intentional',
      note: 'The host never reads Mouth, so an invalid value neither refuses the file nor changes the lip. The library reads it as an invalid uint8 (INVALID_FIELD at ["Mouth"]) → lipEnabled null → active null / activityUnknown. Colour evidence is preserved; the intentional change is host matchHex: null (Task 3).',
      lib: {
        issueCodes: ['INVALID_FIELD'],
        issues: [{ code: 'INVALID_FIELD', path: ['Mouth'] }],
        slots: {
          lip: {
            active: null,
            interpretation: 'palette',
            reason: 'activityUnknown',
            displayHex: '#808080',
          },
        },
      },
    },
    {
      id: 'ACT-22',
      title: 'lip bit clear overrides a live non-zero lip opacity',
      planRow: 'Lip-color bit (0x80 of Mouth) clear',
      doc: char({
        LipsToneFurPattern: 53,
        Mouth: 2,
        Skintone: 12,
        IsExtendedAppearanceValid: true,
        MouthColor: squared('#340A1C', 1),
      }),
      classification: 'intentional',
      blocksIfDiverges: true,
      note: 'Plan row: lipDisabled "also overrides a live non-zero opacity". Library: active false → extendedActive false, inactive, no display and no lip composite, but the decoded extendedHex is kept. Host: the float matches the lipsDark 53 shader (#340A1C) so the index wins and alpha 1 blends to the creator #621C33.',
      lib: {
        slots: {
          lip: {
            active: false,
            interpretation: 'inactive',
            reason: 'lipDisabled',
            extendedActive: false,
            extendedHex: '#340A1C',
            displayHex: null,
            lipCompositeHex: null,
          },
        },
      },
    },
    {
      id: 'ACT-23',
      title:
        'no race, lip bit set: host shows the lip, library knows it is on but cannot read the index',
      planRow: 'Lip-color bit (0x80 of Mouth) clear',
      doc: { Gender: 'Feminine', LipsToneFurPattern: 53, Mouth: 128 },
      provider: 'gray',
      classification: 'intentional',
      note: 'No Tribe and no Race: library lipEnabled = bitSet || null = true, but the lip index meaning is unknown (Hrothgar fur pattern or color), so unresolved / missingRace with no display. The host assumes a color index and shows #621C33.',
      lib: {
        identity: { canonicalRace: null },
        slots: {
          lip: {
            active: true,
            interpretation: 'unresolved',
            reason: 'missingRace',
            indexMeaning: 'unknown',
            displayHex: null,
          },
        },
      },
    },
    {
      id: 'ACT-24',
      title: 'no race, lip bit clear: library activity unknown, not disabled',
      planRow: 'Lip-color bit (0x80 of Mouth) clear',
      doc: { Gender: 'Feminine', LipsToneFurPattern: 53, Mouth: 2 },
      provider: 'gray',
      classification: 'intentional',
      note: 'With no race a clear bit cannot be told from a Hrothgar (which ignores it): bitSet || null = false || null = null, so active null, and the index stays unresolved / missingRace. The host shows #621C33.',
      lib: {
        slots: {
          lip: {
            active: null,
            interpretation: 'unresolved',
            reason: 'missingRace',
            indexMeaning: 'unknown',
            displayHex: null,
          },
        },
      },
    },
    // ------------------------------------------------------------------- Hrothgar lip
    {
      id: 'ACT-25',
      title: 'Hrothgar fur pattern with a live mouth float and Mouth 0: float only on both sides',
      planRow: 'Lip-color bit (0x80 of Mouth) clear',
      doc: {
        ...HROTHGAR,
        LipsToneFurPattern: 3,
        Mouth: 0,
        IsExtendedAppearanceValid: true,
        MouthColor: squared('#A03040', 1),
      },
      classification: 'preserved',
      note: 'Hrothgar ignores the bit (lipEnabled true), so Mouth 0 does not give lipDisabled. The index is a fur pattern, so the live float shows: library extendedOnly, active true, reason floatOnly, displayHex the float; host floatOnly with the float hex. HOST QUIRK: the host floatOnly lip still carries inertReason furPattern (chara-resolver.ts spreads raw.inertReason into every verdict); the Task 3 adapter must not read that field as inactivity.',
      lib: {
        slots: {
          lip: {
            active: true,
            interpretation: 'extendedOnly',
            reason: 'floatOnly',
            indexMeaning: 'furPattern',
            displayHex: '#A03040',
          },
        },
      },
    },
    {
      id: 'ACT-26',
      title: 'Hrothgar fur pattern with a non-live mouth float: inert fur pattern on both sides',
      planRow: 'Lip-color bit (0x80 of Mouth) clear',
      doc: { ...HROTHGAR, LipsToneFurPattern: 3, Mouth: 0, MouthColor: squared('#A03040', 1) },
      classification: 'preserved',
      note: 'Without IsExtendedAppearanceValid the float is not live: library inactive, active false, reason furPattern (not lipDisabled — the bit is ignored on Hrothgar); host inert furPattern.',
      lib: {
        slots: {
          lip: {
            active: false,
            interpretation: 'inactive',
            reason: 'furPattern',
            extendedActive: false,
            displayHex: null,
          },
        },
      },
    },
    {
      id: 'ACT-27',
      title: 'Hrothgar with a non-live zero-alpha mouth float: host no lip, library fur pattern',
      planRow: 'Lip alpha zero with extended data inactive',
      doc: { ...HROTHGAR, LipsToneFurPattern: 3, Mouth: 0, MouthColor: squared('#A03040', 0) },
      classification: 'intentional',
      note: 'Host: stored alpha 0 → noLip regardless of flags or race. Library: the noLip check needs extendedActive, which is false without the flag, so the fur-pattern branch gives inactive / furPattern.',
      lib: {
        slots: {
          lip: { active: false, interpretation: 'inactive', reason: 'furPattern', alpha: 0 },
        },
      },
    },
    // ------------------------------------------- unknown activation with extended data
    {
      id: 'ACT-28',
      title:
        'unknown highlight activation with a live on-grid float: palette agreement, still unknown',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color',
      doc: char({
        Highlights: 10,
        IsExtendedAppearanceValid: true,
        HairHighlight: squared('#F4EACD'),
      }),
      classification: 'intentional',
      note: 'Contract: live extended colors may carry another reason while activation stays unknown. extendedActive = live && hex && active !== false = true; the float equals the shader #F4EACD so reason paletteAgreement, display the creator color, active still null. Host: index wins. Colour evidence is preserved; the intentional change is host matchHex: null (Task 3).',
      lib: {
        slots: {
          highlights: {
            active: null,
            extendedActive: true,
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: '#F4EACD',
            deltaE: { max: 1 },
          },
        },
      },
    },
    {
      id: 'ACT-29',
      title: 'unknown highlight activation with a live off-grid float: off grid, still unknown',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color',
      doc: char({
        Highlights: 10,
        IsExtendedAppearanceValid: true,
        HairHighlight: squared('#00FF00'),
      }),
      classification: 'intentional',
      note: 'Same rule as ACT-28 with a float far from the shader: library offGrid, reason offGrid, displayHex the float, active null, extendedActive true. Host offGrid with the float hex. Colour evidence is preserved; the intentional change is host matchHex: null (Task 3).',
      lib: {
        slots: {
          highlights: {
            active: null,
            extendedActive: true,
            interpretation: 'offGrid',
            reason: 'offGrid',
            displayHex: '#00FF00',
            deltaE: { min: 6 },
          },
        },
      },
    },
    {
      id: 'ACT-30',
      title:
        'unknown highlight activation with a non-live float: reason extendedInactive, not activityUnknown',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color',
      doc: char({ Highlights: 10, HairHighlight: squared('#00FF00') }),
      classification: 'intentional',
      note: 'The library reason chain tests extendedHex before active === null, so an unknown-activation slot with a stored but non-live float reads extendedInactive (active still null, palette preview kept). Host: index wins with indexWinNote extendedMissing. Adapter obligation: the Task 3 activity-unknown warning must key on active === null, never on reason (see ACT-42). Colour evidence is preserved; the intentional change is host matchHex: null (Task 3).',
      lib: {
        slots: {
          highlights: {
            active: null,
            extendedActive: false,
            interpretation: 'palette',
            reason: 'extendedInactive',
            displayHex: '#F4EACD',
          },
        },
      },
    },
    // -------------------------------------------------------------- lip alpha
    {
      id: 'ACT-31',
      title: 'lip alpha 0, live, bit set: no lip on both sides',
      planRow: 'Unlisted: live lip alpha 0 with the bit set gives noLip on both',
      doc: char({
        LipsToneFurPattern: 53,
        Mouth: 128,
        IsExtendedAppearanceValid: true,
        MouthColor: squared('#340A1C', 0),
      }),
      classification: 'preserved',
      note: 'Live extended data with stored alpha 0 and the lip enabled: library extendedActive && alpha <= 0 → active false, inactive, noLip; host noLip.',
      lib: {
        slots: {
          lip: {
            active: false,
            interpretation: 'inactive',
            reason: 'noLip',
            displayHex: null,
            alpha: 0,
          },
        },
      },
    },
    {
      id: 'ACT-32',
      title:
        'lip alpha 0 with the extended flag absent: host no lip, library keeps the palette lip',
      planRow: 'Lip alpha zero with extended data inactive',
      doc: char({ LipsToneFurPattern: 53, Mouth: 128, MouthColor: squared('#340A1C', 0) }),
      classification: 'intentional',
      note: 'Plan "corrected behavior": with the bit set, inactive stored alpha must not suppress an indexed lip. Library extendedActive false → no noLip; palette, creator #621C33, reason extendedInactive. Host: alpha 0 → noLip regardless of flags.',
      lib: {
        slots: {
          lip: {
            active: true,
            extendedActive: false,
            interpretation: 'palette',
            reason: 'extendedInactive',
            displayHex: '#621C33',
            lipCompositeHex: null,
          },
        },
      },
    },
    {
      id: 'ACT-33',
      title: 'lip alpha 0, live, bit clear: host no lip, library lip disabled',
      planRow: 'Lip-color bit (0x80 of Mouth) clear',
      doc: char({
        LipsToneFurPattern: 53,
        Mouth: 2,
        IsExtendedAppearanceValid: true,
        MouthColor: squared('#340A1C', 0),
      }),
      classification: 'intentional',
      blocksIfDiverges: true,
      note: 'Both hide the lip but for different reasons (required contract: lip-bit-clear stays inactive): the library checks active === false before the noLip test, so the reason is lipDisabled; the host reports noLip.',
      lib: { slots: { lip: { active: false, interpretation: 'inactive', reason: 'lipDisabled' } } },
    },
    {
      id: 'ACT-34',
      title: 'lip alpha 0, live, Mouth missing: alpha settles the unknown activation as no lip',
      planRow: 'Unlisted: live lip alpha 0 settles an unknown lip control (Mouth missing) as noLip',
      doc: char({
        LipsToneFurPattern: 53,
        IsExtendedAppearanceValid: true,
        MouthColor: squared('#340A1C', 0),
      }),
      classification: 'preserved',
      note: 'The extended data is live, so plan row "Lip alpha zero with extended data inactive" does not apply (ACT-38 is that row\'s Mouth-missing case). Mouth absent → active null, but extendedActive (live && hex && active !== false) is true and alpha <= 0, so the library sets active false, inactive, noLip (resolve.ts noLip check) — the same answer as the host. Live stored opacity is colour evidence, not fabricated inactivity.',
      lib: {
        slots: {
          lip: { active: false, interpretation: 'inactive', reason: 'noLip', extendedActive: true },
        },
      },
    },
    {
      id: 'ACT-35',
      title: 'lip alpha 0.5 live over a known skin: same linear-light composite',
      planRow:
        'Gamma-2 decoding, creator/shader comparison, activation, lip composition, eye correction',
      doc: char({
        LipsToneFurPattern: 53,
        Mouth: 128,
        Skintone: 12,
        IsExtendedAppearanceValid: true,
        MouthColor: squared('#340A1C', 0.5),
      }),
      classification: 'preserved',
      note: 'The float equals the lipsDark 53 shader, so both display the creator #621C33; skin 12 shows #B18D73. Both composite in linear sRGB at alpha 0.5: #90685A (hand-computed; library lipComposite.hex vs host blendHex).',
      lib: {
        slots: {
          lip: {
            active: true,
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: '#621C33',
            alpha: 0.5,
            lipCompositeHex: '#90685A',
          },
          skin: { displayHex: '#B18D73' },
        },
      },
    },
    {
      id: 'ACT-36',
      title: 'lip alpha above 1 is clamped for the composite and reported',
      planRow:
        'Gamma-2 decoding, creator/shader comparison, activation, lip composition, eye correction',
      doc: char({
        LipsToneFurPattern: 53,
        Mouth: 128,
        Skintone: 12,
        IsExtendedAppearanceValid: true,
        MouthColor: squared('#340A1C', 1.5),
      }),
      classification: 'preserved',
      note: 'Both keep the stored alpha 1.5 and clamp to 1 for the composite, which therefore equals the lip creator #621C33; the library also reports ALPHA_CLAMPED (resolve.ts: alpha outside 0–1).',
      lib: {
        issueCodes: ['ALPHA_CLAMPED'],
        noIssueCodes: ['EXTENDED_CLAMPED'],
        slots: { lip: { active: true, alpha: 1.5, lipCompositeHex: '#621C33' } },
      },
    },
    // ------------------------------------------------------ refinement-round additions
    {
      id: 'ACT-37',
      title: 'lip alpha 0.5 with a non-live float: host composites, library does not',
      planRow:
        'Unlisted: lip composite from a non-live extended float (host composites on alpha alone)',
      doc: char({
        LipsToneFurPattern: 53,
        Mouth: 128,
        Skintone: 12,
        MouthColor: squared('#340A1C', 0.5),
      }),
      classification: 'intentional',
      note: 'UNPLANNED: the host composites whenever lip.alpha > 0 without checking IsExtendedAppearanceValid (chara-resolver.ts lip blend), giving blendHex #90685A; the library composes only when lip.extendedActive (resolve.ts lipComposite guard), so lipComposite is null and the lip shows the palette creator #621C33 with reason extendedInactive. The maintainer must decide whether a non-live stored opacity may still drive the host lip preview; the Task 3 adapter must not fabricate a composite from non-live data. HOST QUIRK: the host blend ignores liveness although its index/float verdict honours it (indexWinNote extendedMissing on the same slot). ACT-35 is the live counterpart.',
      lib: {
        slots: {
          lip: {
            active: true,
            extendedActive: false,
            interpretation: 'palette',
            reason: 'extendedInactive',
            displayHex: '#621C33',
            extendedHex: '#340A1C',
            alpha: 0.5,
            lipCompositeHex: null,
          },
          skin: { displayHex: '#B18D73' },
        },
      },
    },
    {
      id: 'ACT-38',
      title:
        'Mouth missing with a non-live alpha 0: host no lip, library unknown activation with the palette lip',
      planRow: 'Lip alpha zero with extended data inactive',
      doc: char({ LipsToneFurPattern: 53, MouthColor: squared('#340A1C', 0) }),
      classification: 'intentional',
      note: 'Plan row: a missing/null/invalid Mouth gives active null and inactive stored alpha must not suppress the indexed lip. Library: Mouth absent on a known race → lipEnabled null; not live → extendedActive false, so no noLip; palette creator #621C33; the reason chain tests extendedHex before active === null, so reason extendedInactive, not activityUnknown (adapter must key on active === null). Host: alpha 0 → noLip regardless of flags. ACT-44/45 are the Mouth null/invalid variants. Colour evidence is preserved; the intentional change is host matchHex: null (Task 3).',
      lib: {
        noIssueCodes: ['AMBIGUOUS_ZERO_BLOCK'],
        slots: {
          lip: {
            active: null,
            extendedActive: false,
            interpretation: 'palette',
            reason: 'extendedInactive',
            displayHex: '#621C33',
            alpha: 0,
            lipCompositeHex: null,
          },
        },
      },
    },
    {
      id: 'ACT-39',
      title: 'Mouth 2 with a non-live alpha 0 (committed-export shape): both hide the lip',
      planRow: 'Lip alpha zero with extended data inactive',
      doc: char({ LipsToneFurPattern: 53, Mouth: 2, MouthColor: squared('#340A1C', 0) }),
      classification: 'intentional',
      blocksIfDiverges: true,
      note: 'Plan row: a clear bit gives lipDisabled (the shape the plan attributes to the committed Anamnesis/Brio exports: Mouth 2, stored alpha 0; none of the five repo fixtures has it, so this case is synthetic; the real-producer shape is the XIVCharaKit repo export fixtures/producer-exports/anamnesis-default.chara). Library: active false is checked first in the final loop → inactive, lipDisabled, extendedActive false, no display. Host: alpha 0 → noLip. Same visible outcome, different reason; required contract (lip-bit-clear stays inactive). ACT-33 is the live version.',
      lib: {
        slots: {
          lip: {
            active: false,
            interpretation: 'inactive',
            reason: 'lipDisabled',
            extendedActive: false,
            displayHex: null,
            alpha: 0,
          },
        },
      },
    },
    {
      id: 'ACT-40',
      title: 'Hrothgar with a live alpha-0 mouth float: no lip on both sides',
      planRow: 'Task 1: Hrothgar fur (live lip alpha 0 gives noLip on both)',
      doc: {
        ...HROTHGAR,
        LipsToneFurPattern: 3,
        IsExtendedAppearanceValid: true,
        MouthColor: squared('#A03040', 0),
      },
      classification: 'preserved',
      note: 'Live sibling of ACT-27. Library: Hrothgar → lipEnabled true → extendedActive true; the noLip check (extendedActive && alpha <= 0) runs before the fur-pattern branch, so active false, inactive, noLip (not floatOnly, not furPattern). Host: alpha 0 → noLip regardless of race.',
      lib: {
        slots: {
          lip: {
            active: false,
            interpretation: 'inactive',
            reason: 'noLip',
            extendedActive: true,
            indexMeaning: 'furPattern',
            displayHex: null,
            alpha: 0,
          },
        },
      },
    },
    {
      id: 'ACT-41',
      title:
        'unknown lip activation with a live alpha 0.5 float: palette agreement and a composite, still unknown',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color',
      doc: char({
        LipsToneFurPattern: 53,
        Skintone: 12,
        IsExtendedAppearanceValid: true,
        MouthColor: squared('#340A1C', 0.5),
      }),
      classification: 'intentional',
      note: 'Contract: live extended colours may carry another reason while activation stays unknown. Mouth absent → active null; extendedActive = live && hex && active !== false = true; the float equals the lipsDark 53 shader → paletteAgreement, display #621C33; the composite guard needs only extendedActive, so lipComposite #90685A is kept while active stays null. Host: index #621C33, blendHex #90685A. Colour evidence is preserved; the intentional change is host matchHex: null (Task 3).',
      lib: {
        slots: {
          lip: {
            active: null,
            extendedActive: true,
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: '#621C33',
            deltaE: { max: 1 },
            alpha: 0.5,
            lipCompositeHex: '#90685A',
          },
        },
      },
    },
    {
      id: 'ACT-42',
      title:
        'adapter hook: all-zero block on active-null slots reads ambiguousZeroBlock, not activityUnknown',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color',
      doc: char({
        Highlights: 10,
        LipsToneFurPattern: 53,
        IsExtendedAppearanceValid: true,
        ...ZERO_BLOCK,
      }),
      classification: 'intentional',
      note: 'EnableHighlights and Mouth are absent, so both slots have active null, but the stored all-zero block makes the reason ambiguousZeroBlock (resolve.ts reason chain: ambiguous && extendedHex first). The Task 3 adapter must therefore key its activity-unknown warning on active === null, never on reason === activityUnknown. Host: uncaptured block → no floats, both indices win with no note and lip alpha null. Colour evidence is preserved; the intentional change is host matchHex: null (Task 3).',
      lib: {
        issueCodes: ['AMBIGUOUS_ZERO_BLOCK'],
        slots: {
          highlights: {
            active: null,
            extendedActive: false,
            interpretation: 'palette',
            reason: 'ambiguousZeroBlock',
            extendedHex: '#000000',
            displayHex: '#F4EACD',
          },
          lip: {
            active: null,
            extendedActive: false,
            interpretation: 'palette',
            reason: 'ambiguousZeroBlock',
            displayHex: '#621C33',
            alpha: 0,
            lipCompositeHex: null,
          },
        },
      },
    },
    {
      id: 'ACT-43',
      title:
        'FacePaint 0.5 (fractional): host paints, library invalid field and unknown, never none',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color',
      doc: char({ FacePaintColor: 5, FacePaint: 0.5 }),
      provider: 'gray',
      classification: 'intentional',
      note: 'Replaces the deleted ACT-11 as the sharper FacePaint discriminator. The host paints any non-zero number (#484848). inspect.ts integer(…, 255) rejects a non-integer, so FacePaint is invalid (INVALID_FIELD at ["FacePaint"]) → active null, activityUnknown; a build that truncated 0.5 to 0 would wrongly give facePaintNone. Colour evidence is preserved; the intentional change is host matchHex: null (Task 3).',
      lib: {
        issues: [{ code: 'INVALID_FIELD', path: ['FacePaint'] }],
        slots: {
          facePaint: {
            active: null,
            interpretation: 'palette',
            reason: 'activityUnknown',
            displayHex: '#808080',
          },
        },
      },
    },
    {
      id: 'ACT-44',
      title:
        'Mouth null with a non-live alpha 0: host no lip, library unknown activation with the palette lip',
      planRow: 'Lip alpha zero with extended data inactive',
      doc: char({ LipsToneFurPattern: 53, Mouth: null, MouthColor: squared('#340A1C', 0) }),
      classification: 'intentional',
      note: 'Null variant of ACT-38. Mouth state null (no issue) → current() null → lipEnabled null; not live → no noLip; palette #621C33, reason extendedInactive (extendedHex precedes active === null). Host: alpha 0 → noLip. Colour evidence is preserved; the intentional change is host matchHex: null (Task 3).',
      lib: {
        noIssueCodes: ['INVALID_FIELD'],
        slots: {
          lip: {
            active: null,
            extendedActive: false,
            interpretation: 'palette',
            reason: 'extendedInactive',
            displayHex: '#621C33',
            alpha: 0,
          },
        },
      },
    },
    {
      id: 'ACT-45',
      title:
        'Mouth invalid with a non-live alpha 0: host no lip, library unknown activation with the palette lip',
      planRow: 'Lip alpha zero with extended data inactive',
      doc: char({ LipsToneFurPattern: 53, Mouth: 'open', MouthColor: squared('#340A1C', 0) }),
      classification: 'intentional',
      note: 'Invalid variant of ACT-38. Mouth "open" is an invalid uint8 (INVALID_FIELD at ["Mouth"]) → current() null → lipEnabled null; not live → no noLip; palette #621C33, reason extendedInactive. Host never reads Mouth and makes alpha 0 noLip. Colour evidence is preserved; the intentional change is host matchHex: null (Task 3).',
      lib: {
        issues: [{ code: 'INVALID_FIELD', path: ['Mouth'] }],
        slots: {
          lip: {
            active: null,
            extendedActive: false,
            interpretation: 'palette',
            reason: 'extendedInactive',
            displayHex: '#621C33',
            alpha: 0,
          },
        },
      },
    },
  ];

  return actCases;
})();

// ---- section EXT
const extCasesSection: ParityCase[] = (() => {
  /**
   * EXT section: extended float parsing, gamma decoding, liveness, the all-zero block and eye pairing.
   *
   * Palette literals (lookup.ts, bundled sheets = host sheets):
   *   eyes 42  creator #DCBA6C shader #DCBA6C     eyes 169 creator #87C0A3 shader #87C0A3
   *   highlights 42  creator #E1BA70 shader #FFBA56     lipsDark 10 creator #EBE4BF shader #888467
   *   lipsLight 10 creator #EBE4BF shader none (the lip shader reference is always lipsDark)
   *   features 3  creator #B3B3B3 shader #8F8F8F        skin 12 Wildwood Feminine creator #B18D73
   *   eyes 191 is the last eye entry (192 entries), so eye index 192 has no creator or shader colour.
   * The eye palette's two halves are identical, so the host's creator-based eye pairing and the
   * library's shader-based pairing see the same reference colours.
   * Custom eye colours: #1030F0 (ΔE2000 73 from #DCBA6C, 57 from #87C0A3) and #F01030 (44 / 61).
   * #DCBA6C vs #87C0A3 is ΔE2000 26.5, so a float on the other eye's entry is far off-grid on its own.
   */

  const LEFT = '#DCBA6C'; // eyes 42
  const RIGHT = '#87C0A3'; // eyes 169
  const CUSTOM = '#1030F0';
  const CUSTOM2 = '#F01030';

  /** Every channel of squared(LEFT) right-padded with zeros: the same numbers, a longer string. */
  const padded = (width: number): string =>
    squared(LEFT)
      .split(', ')
      .map((part) => part.padEnd(width, '0'))
      .join(', ');
  const PADDED_46 = padded(46); // 3 × 46 + 4 = 142 characters, every part ≤ 64
  const PADDED_70 = padded(70); // 3 × 70 + 4 = 214 characters, every part > 64

  /** A valid, live right eye beside a malformed left one: proves the library keeps other slots. */
  const liveRight = {
    REyeColor: 169,
    RightEyeColor: squared(RIGHT),
    IsExtendedAppearanceValid: true,
  };
  const rightStillRead = {
    rightEye: {
      extendedHex: RIGHT,
      interpretation: 'palette',
      reason: 'paletteAgreement',
      displayHex: RIGHT,
    },
  } as const;
  const leftInvalid = {
    leftEye: {
      extendedHex: null,
      extendedActive: false,
      interpretation: 'palette',
      reason: 'paletteOnly',
      displayHex: LEFT,
    },
  } as const;

  /** The two eyes on different entries, with the live flag; floats supplied per case. */
  const eyes = (
    left: string,
    right: string,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> =>
    char({
      LEyeColor: 42,
      REyeColor: 169,
      LeftEyeColor: squared(left),
      RightEyeColor: squared(right),
      IsExtendedAppearanceValid: true,
      ...extra,
    });

  const ZERO_BLOCK = {
    SkinColor: '0, 0, 0',
    LeftEyeColor: '0, 0, 0',
    RightEyeColor: '0, 0, 0',
    LimbalRingColor: '0, 0, 0',
    HairColor: '0, 0, 0',
    HairHighlight: '0, 0, 0',
    MouthColor: '0, 0, 0, 0',
  };

  const extCases: ParityCase[] = [
    // ------------------------------------------------------------------ float string shapes
    {
      id: 'EXT-01',
      title: 'three-part float on its own entry decodes to the same hex and agrees',
      planRow:
        'Task 1 step 2: all eight colors / gamma-2 decoding (Unknown tribe/gender or malformed color: valid shape)',
      doc: char({ LEyeColor: 42, LeftEyeColor: squared(LEFT), IsExtendedAppearanceValid: true }),
      classification: 'preserved',
      note: 'Both decode round(sqrt(c)*255) (parser squaredToSrgb255, color-math gamma2Hex), so squared(#DCBA6C) reads back #DCBA6C at ΔE 0 against the eye shader; a wrong decode (sRGB curve) lands ~3 ΔE off and a missing decode far off.',
      lib: {
        slots: {
          leftEye: {
            extendedHex: LEFT,
            effectiveExtendedHex: LEFT,
            extendedActive: true,
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: LEFT,
            deltaE: { max: 1 },
          },
        },
        noIssueCodes: ['INVALID_FIELD', 'EXTENDED_CLAMPED'],
      },
    },
    {
      id: 'EXT-02',
      title: 'four parts on a non-Mouth colour: host ignores the alpha, library rejects the field',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: char({ LEyeColor: 42, LeftEyeColor: `${squared(CUSTOM)}, 1`, ...liveRight }),
      classification: 'intentional',
      note: 'Host parseFloatColor accepts 3 or 4 parts for every field and keeps the alpha only on the lip, so the left float is a live #1030F0 (offGrid). Library inspect.ts vector(raw, 3) demands exactly 3 parts for every colour but MouthColor → INVALID_FIELD, extendedHex null, the index wins (paletteOnly); "do not silently coerce invalid values".',
      lib: { issueCodes: ['INVALID_FIELD'], slots: { ...leftInvalid, ...rightStillRead } },
    },
    {
      id: 'EXT-03',
      title: 'one trailing separator on a 3-channel colour: host tolerates, library rejects',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: char({ LEyeColor: 42, LeftEyeColor: `${squared(CUSTOM)}, `, ...liveRight }),
      classification: 'intentional',
      note: 'UNPLANNED: the host drops one empty fourth segment on an rgb-stored field (chara-parser.ts:334-336; plan row 101 lists this only as CURRENT host behavior and plans nothing for the shape) and reads #1030F0 offGrid; the library splits on "," into 4 parts, parts.length !== 3 → INVALID_FIELD (inspect.ts:76-77), extendedHex null, the index wins. No producer writes this shape (hand edits only; Anamnesis/Brio drop empty entries on read). The maintainer must decide: adopt the stricter library reader, or ask the library for one-trailing-separator tolerance.',
      lib: { issueCodes: ['INVALID_FIELD'], slots: { ...leftInvalid, ...rightStillRead } },
    },
    {
      id: 'EXT-04',
      title: '"Infinity" channel: host refuses the file, library invalidates the one field',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: char({ LEyeColor: 42, LeftEyeColor: 'Infinity, 0.25, 0.25', ...liveRight }),
      classification: 'intentional',
      note: 'Host DOTNET_FLOAT rejects "Infinity" and throws for the whole file. Library numericToken rejects it too, but only LeftEyeColor becomes INVALID_FIELD; the right eye still reads and agrees (plan: preserve valid independent appearance).',
      lib: { issueCodes: ['INVALID_FIELD'], slots: { ...leftInvalid, ...rightStillRead } },
    },
    {
      id: 'EXT-05',
      title: '"0x10" channel: host refuses the file, library invalidates the one field',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: char({ LEyeColor: 42, LeftEyeColor: '0x10, 0.25, 0.25', ...liveRight }),
      classification: 'intentional',
      note: 'Number("0x10") is 16, so both sides use a .NET-float pattern: host refuses the file, library numericToken fails → INVALID_FIELD on LeftEyeColor only, never a clamped white channel.',
      lib: { issueCodes: ['INVALID_FIELD'], slots: { ...leftInvalid, ...rightStillRead } },
    },
    {
      id: 'EXT-06',
      title: 'empty channel: host refuses the file, library invalidates the one field',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: char({ LEyeColor: 42, LeftEyeColor: '0.25,, 0.25', ...liveRight }),
      classification: 'intentional',
      note: 'Number("") is 0; host (BUG-133) refuses the empty segment for the whole file. Library: 3 parts but "" fails numericToken → INVALID_FIELD, extendedHex null, no black channel fabricated.',
      lib: { issueCodes: ['INVALID_FIELD'], slots: { ...leftInvalid, ...rightStillRead } },
    },
    {
      id: 'EXT-07',
      title: '214-character float with parts over 64 characters: host refuses, library invalid',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: char({ LEyeColor: 42, LeftEyeColor: PADDED_70, ...liveRight }),
      classification: 'intentional',
      note: 'Host MAX_FLOAT_COLOR_LENGTH 128 refuses the file before splitting (message names the length only). Library vector() rejects any part longer than 64 characters → INVALID_FIELD on that field alone.',
      lib: { issueCodes: ['INVALID_FIELD'], slots: { ...leftInvalid, ...rightStillRead } },
    },
    {
      id: 'EXT-08',
      title: '142-character float whose parts are each under 64: host refuses, library reads it',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: char({ LEyeColor: 42, LeftEyeColor: PADDED_46, ...liveRight }),
      classification: 'intentional',
      note: 'Zero-padded squared(#DCBA6C): host refuses anything over 128 characters; library caps each part at 64 characters but not the whole string, so the same numbers decode to #DCBA6C and agree (paletteAgreement). A library that copied the host 128 cap fails here.',
      lib: {
        noIssueCodes: ['INVALID_FIELD'],
        slots: {
          leftEye: {
            extendedHex: LEFT,
            extendedActive: true,
            interpretation: 'palette',
            reason: 'paletteAgreement',
          },
        },
      },
    },
    {
      id: 'EXT-09',
      title: 'array [r, g, b] float: host refuses a non-string, library accepts it',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: char({
        LEyeColor: 42,
        LeftEyeColor: [0.0625, 0.25, 0.5625],
        IsExtendedAppearanceValid: true,
      }),
      classification: 'intentional',
      note: 'Host parseFloatColor throws for any non-string ("got object"). Library vector() takes a 3-element finite array: sqrt → 64, 128, 191 = #4080BF, far from #DCBA6C → offGrid.',
      lib: {
        noIssueCodes: ['INVALID_FIELD'],
        slots: {
          leftEye: {
            extendedHex: '#4080BF',
            interpretation: 'offGrid',
            reason: 'offGrid',
            displayHex: '#4080BF',
            deltaE: { min: 6 },
          },
        },
      },
    },
    {
      id: 'EXT-10',
      title: 'object {R, G, B} float: host refuses a non-string, library accepts it',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: char({
        LEyeColor: 42,
        LeftEyeColor: { R: 0.0625, G: 0.25, B: 0.5625 },
        IsExtendedAppearanceValid: true,
      }),
      classification: 'intentional',
      note: 'Host refuses ("got object"). Library vector() reads an object with an R key as R,G,B (A only for size 4): the same #4080BF as EXT-09, offGrid against eye 42.',
      lib: {
        noIssueCodes: ['INVALID_FIELD'],
        slots: {
          leftEye: { extendedHex: '#4080BF', interpretation: 'offGrid', displayHex: '#4080BF' },
        },
      },
    },
    // ------------------------------------------------------------------ gamma clamp
    {
      id: 'EXT-11',
      title: 'channels above 1 and below 0 clamp to the same hex; library warns',
      planRow:
        'Task 1 step 2: gamma-2 decoding (Unknown tribe/gender or malformed color: finite but out of range)',
      doc: char({
        LEyeColor: 42,
        LeftEyeColor: '1.5, 0.5, -0.25',
        IsExtendedAppearanceValid: true,
      }),
      classification: 'preserved',
      note: 'Both clamp each channel to [0,1] before sqrt: 255, round(0.7071*255)=180, 0 → #FFB400 (ΔE2000 11.5 from #DCBA6C, offGrid). The library additionally reports EXTENDED_CLAMPED (resolve.ts: a channel < 0 or > 1); the host has no issue list.',
      lib: {
        issueCodes: ['EXTENDED_CLAMPED'],
        slots: {
          leftEye: {
            extendedHex: '#FFB400',
            interpretation: 'offGrid',
            displayHex: '#FFB400',
            deltaE: { min: 6 },
          },
        },
      },
    },
    // ------------------------------------------------------------------ liveness
    {
      id: 'EXT-12',
      title: 'live float that disagrees: off-grid on both sides',
      planRow: 'Task 1 step 2: activation (IsExtendedAppearanceValid true)',
      doc: char({ LEyeColor: 42, LeftEyeColor: squared(CUSTOM), IsExtendedAppearanceValid: true }),
      classification: 'preserved',
      note: 'Flag true + ΔE2000 73 > 6 against the eye shader: host verdict offGrid (float wins, both hexes named); library extendedActive, interpretation/reason offGrid, displayHex the decoded float.',
      lib: {
        slots: {
          leftEye: {
            extendedActive: true,
            interpretation: 'offGrid',
            reason: 'offGrid',
            displayHex: CUSTOM,
            creatorHex: LEFT,
            shaderHex: LEFT,
            deltaE: { min: 6 },
          },
        },
      },
    },
    {
      id: 'EXT-13',
      title: 'disagreeing float without IsExtendedAppearanceValid: index wins',
      planRow: 'Task 1 step 2: activation (flag absent)',
      doc: char({ LEyeColor: 42, LeftEyeColor: squared(CUSTOM) }),
      classification: 'preserved',
      note: 'Host: floats live only when the flag is present and true → index, indexWinNote extendedMissing, no ΔE. Library: valid flag required for live → extendedActive false, palette, reason extendedInactive (extendedHex still decoded as evidence).',
      lib: {
        slots: {
          leftEye: {
            extendedActive: false,
            interpretation: 'palette',
            reason: 'extendedInactive',
            displayHex: LEFT,
            extendedHex: CUSTOM,
            deltaE: null,
          },
        },
      },
    },
    {
      id: 'EXT-14',
      title: 'disagreeing float with IsExtendedAppearanceValid false: index wins',
      planRow: 'Task 1 step 2: activation (flag false)',
      doc: char({ LEyeColor: 42, LeftEyeColor: squared(CUSTOM), IsExtendedAppearanceValid: false }),
      classification: 'preserved',
      note: 'Flag false is declared but not true: host index + extendedMissing (extendedDeclared true); library valid false → extendedInactive, displayHex the creator entry.',
      lib: {
        slots: {
          leftEye: {
            extendedActive: false,
            interpretation: 'palette',
            reason: 'extendedInactive',
            displayHex: LEFT,
            deltaE: null,
          },
        },
      },
    },
    {
      id: 'EXT-15',
      title: 'non-boolean IsExtendedAppearanceValid ("true" string) is not live',
      planRow:
        'Unknown tribe/gender or malformed color (invalid IsExtendedAppearanceValid never refuses)',
      doc: char({
        LEyeColor: 42,
        LeftEyeColor: squared(CUSTOM),
        IsExtendedAppearanceValid: 'true',
      }),
      classification: 'preserved',
      note: 'Host: === true is false for a string, file not refused → index + extendedMissing. Library: the boolean decoder fails → INVALID_FIELD, current() null → not live → extendedInactive. Neither coerces "true".',
      lib: {
        issueCodes: ['INVALID_FIELD'],
        slots: {
          leftEye: { extendedActive: false, interpretation: 'palette', reason: 'extendedInactive' },
        },
      },
    },
    {
      id: 'EXT-16',
      title:
        'live eye float a little off its entry (ΔE ≈ 1.8): agreement, the palette swatch shows',
      planRow: 'Task 1 step 2: activation (float agrees within the off-grid threshold)',
      doc: char({
        LEyeColor: 42,
        LeftEyeColor: squared('#D8BC70'),
        IsExtendedAppearanceValid: true,
      }),
      classification: 'preserved',
      note: '#D8BC70 is ΔE2000 1.77 from #DCBA6C: ≤ 6 so host verdict index (deltaE computed) and library palette/paletteAgreement with displayHex the creator entry, not the float.',
      lib: {
        slots: {
          leftEye: {
            extendedActive: true,
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: LEFT,
            extendedHex: '#D8BC70',
            deltaE: { max: 6 },
          },
        },
      },
    },
    {
      id: 'EXT-17',
      title:
        'live highlight float equal to the shader entry agrees even though the creator swatch differs',
      planRow: 'Task 1 step 2: activation (float judged against the shader color)',
      doc: char({
        Highlights: 42,
        EnableHighlights: true,
        HairHighlight: squared('#FFBA56'),
        IsExtendedAppearanceValid: true,
      }),
      classification: 'preserved',
      note: 'Highlights 42: creator #E1BA70, shader #FFBA56 (ΔE2000 7.6 apart). Both compare a float with the shader half, so ΔE 0 → host index, library paletteAgreement showing the creator swatch; an implementation comparing with the creator would call it offGrid.',
      lib: {
        slots: {
          highlights: {
            active: true,
            interpretation: 'palette',
            reason: 'paletteAgreement',
            creatorHex: '#E1BA70',
            shaderHex: '#FFBA56',
            displayHex: '#E1BA70',
            deltaE: { max: 1 },
          },
        },
      },
    },
    {
      id: 'EXT-18',
      title: 'live float with no index: float-only on both sides',
      planRow: 'Task 1 step 2: activation (extended-only slot)',
      doc: char({ LeftEyeColor: squared(CUSTOM), IsExtendedAppearanceValid: true }),
      classification: 'preserved',
      note: 'No LEyeColor key: host verdict floatOnly with the float hex; library storedIndex absent + extendedActive → extendedOnly, reason floatOnly, displayHex the decoded float.',
      lib: {
        slots: {
          leftEye: {
            storedIndex: { state: 'absent' },
            extendedActive: true,
            interpretation: 'extendedOnly',
            reason: 'floatOnly',
            displayHex: CUSTOM,
          },
        },
      },
    },
    {
      id: 'EXT-19',
      title: 'float with no index and no live flag: nothing to show on either side',
      planRow: 'Task 1 step 2: activation (extended-only slot, not live)',
      doc: char({ LeftEyeColor: squared(CUSTOM) }),
      classification: 'preserved',
      note: 'Host: index null and float not live → verdict inert with no inertReason. Library: storedIndex absent, extendedActive false → stays unresolved/missingColor, displayHex null. Different vocabulary, same outcome: no colour is fabricated from a non-live float.',
      lib: {
        slots: {
          leftEye: {
            extendedActive: false,
            interpretation: 'unresolved',
            reason: 'missingColor',
            displayHex: null,
            extendedHex: CUSTOM,
          },
        },
      },
    },
    // ------------------------------------------------------------------ all-zero block
    {
      id: 'EXT-20',
      title:
        'all-zero seven-float block: absent on the host, ambiguous and not live in the library',
      planRow: 'Lip alpha zero with extended data inactive (all-zero extended blocks)',
      doc: char({
        LEyeColor: 42,
        LipsToneFurPattern: 10,
        Mouth: 128,
        IsExtendedAppearanceValid: true,
        ...ZERO_BLOCK,
      }),
      classification: 'preserved',
      note: 'Host parser nulls an every-channel-zero block (alpha included) → no float, index wins with no note, lip alpha null so the indexed lip stays. Library: AMBIGUOUS_ZERO_BLOCK, live false; floats still decode (#000000, lip alpha 0) but reason ambiguousZeroBlock and the palette shows; Mouth 0x80 set keeps the lip active, and alpha 0 cannot suppress it because the lip is not extendedActive. Same visible outcome.',
      lib: {
        issueCodes: ['AMBIGUOUS_ZERO_BLOCK'],
        slots: {
          leftEye: {
            extendedHex: '#000000',
            extendedActive: false,
            interpretation: 'palette',
            reason: 'ambiguousZeroBlock',
            displayHex: LEFT,
            deltaE: null,
          },
          lip: {
            active: true,
            extendedActive: false,
            alpha: 0,
            interpretation: 'palette',
            reason: 'ambiguousZeroBlock',
            displayHex: '#EBE4BF',
          },
        },
      },
    },
    {
      id: 'EXT-21',
      title: 'one black float among live ones is kept; every extended key maps to its own slot',
      planRow:
        'Task 1 step 2: all eight colors / extended-key mapping (and the all-zero-block exception of "Lip alpha zero with extended data inactive": a partly black block is not uncaptured)',
      doc: char({
        LEyeColor: 42,
        REyeColor: 169,
        IsExtendedAppearanceValid: true,
        ...ZERO_BLOCK,
        RightEyeColor: squared(RIGHT),
        SkinColor: squared('#867A6E'),
        HairColor: squared('#515151'),
        HairHighlight: squared('#A0B0C0'),
        LimbalRingColor: squared('#405060'),
        MouthColor: squared('#888467', 1),
      }),
      classification: 'preserved',
      note: 'The block is not zero everywhere, so neither side treats it as uncaptured: the black left-eye float is live and ΔE2000 70 from #DCBA6C → offGrid #000000 on both sides; the right eye agrees. Hair, highlights, skin, limbal and lip carry no index, so each shows its own float (host floatOnly, library extendedOnly/floatOnly, resolve.ts:394-403) with seven distinct colours: swapping any two keys (HairColor↔SkinColor, LimbalRingColor↔HairHighlight) fails. Lip alpha 1 composites to the lip colour itself on both sides; the library lip is active null (Mouth absent on a known race, resolve.ts:199-200) but still extendedActive.',
      lib: {
        noIssueCodes: ['AMBIGUOUS_ZERO_BLOCK', 'INVALID_FIELD'],
        slots: {
          leftEye: {
            extendedActive: true,
            extendedHex: '#000000',
            interpretation: 'offGrid',
            displayHex: '#000000',
          },
          rightEye: { interpretation: 'palette', reason: 'paletteAgreement' },
          hair: {
            storedIndex: { state: 'absent' },
            extendedActive: true,
            interpretation: 'extendedOnly',
            reason: 'floatOnly',
            displayHex: '#515151',
          },
          highlights: {
            storedIndex: { state: 'absent' },
            active: null,
            extendedActive: true,
            interpretation: 'extendedOnly',
            displayHex: '#A0B0C0',
          },
          skin: {
            storedIndex: { state: 'absent' },
            extendedActive: true,
            interpretation: 'extendedOnly',
            reason: 'floatOnly',
            displayHex: '#867A6E',
          },
          limbal: {
            kind: 'tattoo',
            storedIndex: { state: 'absent' },
            extendedActive: true,
            interpretation: 'extendedOnly',
            displayHex: '#405060',
          },
          lip: {
            active: null,
            extendedActive: true,
            interpretation: 'extendedOnly',
            displayHex: '#888467',
            alpha: 1,
            lipCompositeHex: '#888467',
          },
        },
      },
    },
    {
      id: 'EXT-22',
      title: 'six zero floats and a Mouth alpha of 1: the block is captured',
      planRow:
        'Lip alpha zero with extended data inactive (all-zero extended blocks: alpha channel counts)',
      doc: char({
        LEyeColor: 42,
        IsExtendedAppearanceValid: true,
        ...ZERO_BLOCK,
        MouthColor: '0, 0, 0, 1',
      }),
      classification: 'preserved',
      note: 'Host checks (alpha ?? 0) === 0 and the library checks every MouthColor component (4 of them), so a non-zero alpha makes the block real: the black eye float is live → offGrid #000000 on both sides, no AMBIGUOUS_ZERO_BLOCK. An implementation that tested only RGB would call it uncaptured.',
      lib: {
        noIssueCodes: ['AMBIGUOUS_ZERO_BLOCK'],
        slots: {
          leftEye: { extendedActive: true, interpretation: 'offGrid', displayHex: '#000000' },
        },
      },
    },
    {
      id: 'EXT-23',
      title: 'six zero floats with MouthColor absent: a sparse file named black on purpose',
      planRow:
        'Lip alpha zero with extended data inactive (all-zero extended blocks: all seven keys required)',
      doc: char({
        LEyeColor: 42,
        IsExtendedAppearanceValid: true,
        ...ZERO_BLOCK,
        MouthColor: undefined,
      }), // undefined → key dropped by JSON.stringify
      classification: 'preserved',
      note: 'Host requires every one of the seven floats non-null to call the block uncaptured; library ZERO_KEYS.every needs a valid value per key (absent → false). Six zeros therefore stay live: offGrid #000000, no AMBIGUOUS_ZERO_BLOCK.',
      lib: {
        noIssueCodes: ['AMBIGUOUS_ZERO_BLOCK'],
        slots: {
          leftEye: { extendedActive: true, interpretation: 'offGrid', displayHex: '#000000' },
        },
      },
    },
    // ------------------------------------------------------------------ eye pairing
    {
      id: 'EXT-24',
      title:
        'exact eye crossing: both swap silently; library keeps the stored order in extendedHex',
      planRow: 'Crossed eyes (every current Brio export)',
      doc: eyes(RIGHT, LEFT),
      classification: 'preserved',
      note: 'Each float lands (ΔE ≤ 1) on the other eye entry and neither on its own: host uncrossEyeFloats swaps → both index at ΔE 0. Library pairEyes bothCrossed → effectiveExtendedHex swapped, extendedHex unchanged (original vs effective), correction historicalEyePairSwap, one HISTORICAL_EYE_PAIR_SWAP record, no warning (the exact crossing is silent).',
      lib: {
        corrections: 1,
        noIssueCodes: ['EYE_PAIRING_INFERRED', 'EYE_PAIRING_UNCONFIRMED'],
        slots: {
          leftEye: {
            extendedHex: RIGHT,
            effectiveExtendedHex: LEFT,
            correction: 'historicalEyePairSwap',
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: LEFT,
            deltaE: { max: 1 },
          },
          rightEye: {
            extendedHex: LEFT,
            effectiveExtendedHex: RIGHT,
            correction: 'historicalEyePairSwap',
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: RIGHT,
          },
        },
      },
    },
    {
      id: 'EXT-25',
      title: 'straight heterochromia pair: no swap',
      planRow: 'Crossed eyes (every current Brio export)',
      doc: eyes(LEFT, RIGHT),
      classification: 'preserved',
      note: 'Each float lands on its own entry: host straight → no swap; library crossedLeft/Right require !lands(own) → false, no correction. A swap-on-any-difference implementation fails here.',
      lib: {
        corrections: 0,
        noIssueCodes: ['EYE_PAIRING_INFERRED', 'EYE_PAIRING_UNCONFIRMED'],
        slots: {
          leftEye: {
            extendedHex: LEFT,
            effectiveExtendedHex: LEFT,
            correction: null,
            reason: 'paletteAgreement',
          },
          rightEye: {
            extendedHex: RIGHT,
            effectiveExtendedHex: RIGHT,
            correction: null,
            reason: 'paletteAgreement',
          },
        },
      },
    },
    {
      id: 'EXT-26',
      title: 'one-sided crossing beside a custom colour: host never swaps, library swaps and warns',
      planRow: 'Crossed eyes (every current Brio export): one-sided inference',
      doc: eyes(RIGHT, CUSTOM),
      classification: 'intentional',
      note: 'Left float = the right entry, right float = custom #1030F0. Host needs both floats on the other entry → no swap: left #87C0A3 offGrid (ΔE 26.5) and right #1030F0 offGrid. Library: crossedLeft && custom(right) → oneSided swap: left effective #1030F0 offGrid, right effective #87C0A3 agrees; EYE_PAIRING_INFERRED, one correction (plan: adopt the one-sided inference with its warning).',
      lib: {
        corrections: 1,
        issueCodes: ['EYE_PAIRING_INFERRED'],
        noIssueCodes: ['EYE_PAIRING_UNCONFIRMED'],
        slots: {
          leftEye: {
            extendedHex: RIGHT,
            effectiveExtendedHex: CUSTOM,
            correction: 'historicalEyePairSwap',
            interpretation: 'offGrid',
            displayHex: CUSTOM,
            deltaE: { min: 6 },
          },
          rightEye: {
            extendedHex: CUSTOM,
            effectiveExtendedHex: RIGHT,
            correction: 'historicalEyePairSwap',
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: RIGHT,
          },
        },
      },
    },
    {
      id: 'EXT-27',
      title: 'two custom eye colours: no swap, no warning',
      planRow: 'Crossed eyes (every current Brio export)',
      doc: eyes(CUSTOM, CUSTOM2),
      classification: 'preserved',
      note: 'Neither float lands on either entry: host crossed false; library crossedLeft/Right false and oneSided needs one crossed match → nothing. Both eyes offGrid with their own floats; no correction, no EYE_PAIRING_* issue.',
      lib: {
        corrections: 0,
        noIssueCodes: ['EYE_PAIRING_INFERRED', 'EYE_PAIRING_UNCONFIRMED'],
        slots: {
          leftEye: {
            effectiveExtendedHex: CUSTOM,
            correction: null,
            interpretation: 'offGrid',
            displayHex: CUSTOM,
          },
          rightEye: {
            effectiveExtendedHex: CUSTOM2,
            correction: null,
            interpretation: 'offGrid',
            displayHex: CUSTOM2,
          },
        },
      },
    },
    {
      id: 'EXT-28',
      title: 'shared eye index with differing floats: no swap',
      planRow: 'Crossed eyes (every current Brio export)',
      doc: eyes(RIGHT, LEFT, { REyeColor: 42 }),
      classification: 'preserved',
      note: 'Both indices 42: host returns early on equal indices; library pairEyes requires differing stored indices. Left #87C0A3 stays offGrid on entry 42, right #DCBA6C agrees; eyesShareIndex true on both sides.',
      lib: {
        eyesShareIndex: true,
        corrections: 0,
        slots: {
          leftEye: { effectiveExtendedHex: RIGHT, correction: null, interpretation: 'offGrid' },
          rightEye: { effectiveExtendedHex: LEFT, correction: null, interpretation: 'palette' },
        },
      },
    },
    {
      id: 'EXT-29',
      title: 'crossed floats without the live flag: host swaps anyway, library does not',
      planRow:
        'Crossed eyes (every current Brio export): host swaps even when extended data is not live',
      doc: eyes(RIGHT, LEFT, { IsExtendedAppearanceValid: undefined }),
      classification: 'intentional',
      note: 'Plan row: uncrossEyeFloats never checks liveness, so the host swaps the floats (floatHex reads swapped) and the index wins with extendedMissing. Library pairEyes needs both eyes extendedActive → no swap: extendedHex = effectiveExtendedHex = stored order, no correction, reason extendedInactive.',
      lib: {
        corrections: 0,
        noIssueCodes: ['EYE_PAIRING_INFERRED', 'EYE_PAIRING_UNCONFIRMED'],
        slots: {
          leftEye: {
            extendedHex: RIGHT,
            effectiveExtendedHex: RIGHT,
            correction: null,
            extendedActive: false,
            reason: 'extendedInactive',
            displayHex: LEFT,
          },
          rightEye: {
            extendedHex: LEFT,
            effectiveExtendedHex: LEFT,
            correction: null,
            extendedActive: false,
            reason: 'extendedInactive',
            displayHex: RIGHT,
          },
        },
      },
    },
    {
      id: 'EXT-30',
      title: 'exact crossing with historicalEyeCorrection off: library leaves it and warns',
      planRow: 'Crossed eyes (every current Brio export): correction toggle',
      doc: eyes(RIGHT, LEFT),
      policy: { historicalEyeCorrection: false },
      classification: 'intentional',
      note: 'Pins the NON-default historicalEyeCorrection:false pending the plan row-111 decision ("decide explicitly whether the host keeps historicalEyeCorrection at its default"); it is not an adopted host change, and if the host keeps the default EXT-24 governs. The host has no toggle and swaps (both eyes index at ΔE 0). With the policy off the library records no correction and raises EYE_PAIRING_UNCONFIRMED (resolve.ts:158-164); each eye then compares its stored float with its own shader → offGrid (ΔE 26.5) showing the uncorrected colour.',
      lib: {
        corrections: 0,
        issueCodes: ['EYE_PAIRING_UNCONFIRMED'],
        noIssueCodes: ['EYE_PAIRING_INFERRED'],
        slots: {
          leftEye: {
            effectiveExtendedHex: RIGHT,
            correction: null,
            interpretation: 'offGrid',
            displayHex: RIGHT,
            deltaE: { min: 6 },
          },
          rightEye: {
            effectiveExtendedHex: LEFT,
            correction: null,
            interpretation: 'offGrid',
            displayHex: LEFT,
          },
        },
      },
    },
    // ------------------------------------------------------------------ unavailable palette data
    {
      id: 'EXT-31',
      title:
        'shader colour unavailable for a live eye float: library unresolved, never the creator as stand-in',
      planRow: 'Missing shader reference',
      doc: char({
        LEyeColor: 42,
        REyeColor: 169,
        LeftEyeColor: squared('#808080'),
        IsExtendedAppearanceValid: true,
      }),
      provider: 'noShader',
      classification: 'intentional',
      note: 'provider noShader: creator #808080, every shader request null. The live float equals the creator colour, so a library that used the creator as a pretend shader reference would report paletteAgreement; resolve.ts:405-414 instead leaves the slot unresolved/missingShaderReference, displayHex null, with MISSING_SHADER_REFERENCE at path [slot] (not the float key). The right eye has no float and still shows its creator colour (paletteOnly). The provider mode cannot reach the host, which always compares with its own shader table (chara-resolver.ts:398-405; its creator fallback is unreachable with the shipped tables), so the host reads offGrid against #DCBA6C.',
      lib: {
        corrections: 0,
        issues: [{ code: 'MISSING_SHADER_REFERENCE', path: ['leftEye'] }],
        noIssueCodes: ['PALETTE_UNAVAILABLE', 'INVALID_PALETTE_RESPONSE'],
        slots: {
          leftEye: {
            creatorHex: '#808080',
            shaderHex: null,
            extendedHex: '#808080',
            extendedActive: true,
            interpretation: 'unresolved',
            reason: 'missingShaderReference',
            displayHex: null,
            deltaE: null,
          },
          rightEye: {
            creatorHex: '#808080',
            shaderHex: null,
            interpretation: 'palette',
            reason: 'paletteOnly',
            displayHex: '#808080',
          },
        },
      },
    },
    {
      id: 'EXT-32',
      title:
        'creator colour unavailable for a live eye float: library unresolved/missingPaletteEntry',
      planRow:
        'Shared interface contract: "unavailable color evidence remains unresolved" (Review focus 2)',
      doc: char({
        LEyeColor: 42,
        LeftEyeColor: squared('#808080'),
        IsExtendedAppearanceValid: true,
      }),
      provider: 'noCreator',
      classification: 'intentional',
      note: 'provider noCreator: creator null, shader #808080 (= the live float). resolve.ts:353 sets missingPaletteEntry and the final loop stops at :405 (no creator) before any comparison, so the slot stays unresolved with displayHex null and deltaE null: neither the shader colour nor the float is shown as a stand-in, and a null provider result raises no issue (paletteHex returns at :71). The host never lacks a creator entry for an in-range index and is unaffected by the provider mode: offGrid against #DCBA6C.',
      lib: {
        noIssueCodes: [
          'MISSING_SHADER_REFERENCE',
          'PALETTE_UNAVAILABLE',
          'INVALID_PALETTE_RESPONSE',
        ],
        slots: {
          leftEye: {
            creatorHex: null,
            shaderHex: '#808080',
            extendedActive: true,
            interpretation: 'unresolved',
            reason: 'missingPaletteEntry',
            displayHex: null,
            deltaE: null,
          },
        },
      },
    },
    // ------------------------------------------------------------------ limbal float
    {
      id: 'EXT-33',
      title: 'live LimbalRingColor on its shader entry: agreement against the features shader',
      planRow: 'Task 1 step 2: all eight colors / extended-key mapping (limbal/tattoo slot)',
      doc: char({
        LimbalEyes: 3,
        LimbalRingColor: squared('#8F8F8F'),
        IsExtendedAppearanceValid: true,
      }),
      classification: 'preserved',
      note: 'Features 3: creator #B3B3B3, shader #8F8F8F (about ΔE2000 11 apart). LimbalRingColor pairs with LimbalEyes and the features shader on both sides (SHADER_PALETTE limbal → features; resolve.ts DEFINITIONS), so ΔE 0 → host index, library paletteAgreement showing the creator swatch; kind tattoo for an Elezen. Reading the float from another key, or comparing with the creator, gives offGrid.',
      lib: {
        slots: {
          limbal: {
            kind: 'tattoo',
            extendedHex: '#8F8F8F',
            extendedActive: true,
            creatorHex: '#B3B3B3',
            shaderHex: '#8F8F8F',
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: '#B3B3B3',
            deltaE: { max: 1 },
          },
        },
      },
    },
    // ------------------------------------------------------------------ MouthColor shape
    {
      id: 'EXT-34',
      title: 'zero block whose MouthColor has three parts: host uncaptured, library live and black',
      planRow:
        'Lip alpha zero with extended data inactive (all-zero extended blocks) × Unknown tribe/gender or malformed color',
      doc: char({
        LEyeColor: 42,
        IsExtendedAppearanceValid: true,
        ...ZERO_BLOCK,
        MouthColor: '0, 0, 0',
      }),
      classification: 'intentional',
      note: 'UNPLANNED: the host reads a 3-part MouthColor with alpha null, so (alpha ?? 0) === 0 holds and the block is uncaptured (chara-parser.ts:501-503): no floats, the eye shows palette #DCBA6C. The library vector(raw, 4) rejects it (INVALID_FIELD at MouthColor, inspect.ts:311), ZERO_KEYS.every fails on the invalid field (resolve.ts:174-177), the block is live and the black eye float goes offGrid #000000. A visible flip neither plan row covers: the maintainer must accept it or the adapter must treat an invalid MouthColor beside six zero floats as uncaptured. HOST QUIRK: the host counts an alpha-less 3-part MouthColor as alpha 0 ((alpha ?? 0) === 0, chara-parser.ts:501-503) toward an uncaptured block.',
      lib: {
        issues: [{ code: 'INVALID_FIELD', path: ['MouthColor'] }],
        noIssueCodes: ['AMBIGUOUS_ZERO_BLOCK'],
        slots: {
          leftEye: {
            extendedHex: '#000000',
            extendedActive: true,
            interpretation: 'offGrid',
            reason: 'offGrid',
            displayHex: '#000000',
          },
        },
      },
    },
    {
      id: 'EXT-35',
      title:
        'three-part MouthColor on a lip index: host reads it alpha-less, library rejects the field',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: char({
        LipsToneFurPattern: 10,
        Mouth: 128,
        MouthColor: squared(CUSTOM),
        IsExtendedAppearanceValid: true,
      }),
      classification: 'intentional',
      note: 'Mirror of EXT-02. Host parseFloatColor accepts 3 parts on the rgba field (alpha null), so the lip float #1030F0 is live and offGrid against the lipsDark shader #888467, with no blend (alpha null). Library vector(raw, 4) demands 4 parts for MouthColor → INVALID_FIELD, extendedHex and alpha null, the lip shows its palette colour (paletteOnly; Mouth 0x80 set keeps it active). "Do not silently coerce invalid values".',
      lib: {
        issues: [{ code: 'INVALID_FIELD', path: ['MouthColor'] }],
        slots: {
          lip: {
            active: true,
            extendedHex: null,
            extendedActive: false,
            alpha: null,
            interpretation: 'palette',
            reason: 'paletteOnly',
            displayHex: '#EBE4BF',
            lipCompositeHex: null,
          },
        },
      },
    },
    {
      id: 'EXT-36',
      title:
        'MouthColor with a deleted alpha ("r, g, b, "): host refuses the file, library invalidates the field',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: char({
        LipsToneFurPattern: 10,
        Mouth: 128,
        MouthColor: `${squared('#888467')}, `,
        ...liveRight,
      }),
      classification: 'intentional',
      note: 'On the rgba field the host does not pop an empty fourth segment (that tolerance is rgb-only, chara-parser.ts:334), "" fails DOTNET_FLOAT and the whole file is refused. Library: 4 parts, "" fails numericToken → INVALID_FIELD on MouthColor alone; the lip falls back to its palette colour and the right eye still reads (plan: preserve valid independent appearance).',
      lib: {
        issues: [{ code: 'INVALID_FIELD', path: ['MouthColor'] }],
        slots: {
          ...rightStillRead,
          lip: {
            extendedHex: null,
            alpha: null,
            interpretation: 'palette',
            reason: 'paletteOnly',
            displayHex: '#EBE4BF',
          },
        },
      },
    },
    // ------------------------------------------------------------------ eye pairing (more)
    {
      id: 'EXT-37',
      title:
        'mirror one-sided crossing (right float on the left entry, custom left): library swaps and warns',
      planRow: 'Crossed eyes (every current Brio export): one-sided inference',
      doc: eyes(CUSTOM, LEFT),
      classification: 'intentional',
      note: 'The crossedRight && custom(left) branch (resolve.ts:139), the mirror of EXT-26: the right float #DCBA6C lands on the left entry and not its own, the left float #1030F0 fits neither shader → oneSided swap with EYE_PAIRING_INFERRED and one correction: left effective #DCBA6C agrees, right effective #1030F0 offGrid. Host needs both floats on the other entry → no swap: left #1030F0 offGrid, right #DCBA6C offGrid (ΔE 26.5 from #87C0A3). Plan: adopt the one-sided inference with its warning.',
      lib: {
        corrections: 1,
        issueCodes: ['EYE_PAIRING_INFERRED'],
        noIssueCodes: ['EYE_PAIRING_UNCONFIRMED'],
        slots: {
          leftEye: {
            extendedHex: CUSTOM,
            effectiveExtendedHex: LEFT,
            correction: 'historicalEyePairSwap',
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: LEFT,
          },
          rightEye: {
            extendedHex: LEFT,
            effectiveExtendedHex: CUSTOM,
            correction: 'historicalEyePairSwap',
            interpretation: 'offGrid',
            displayHex: CUSTOM,
            deltaE: { min: 6 },
          },
        },
      },
    },
    {
      id: 'EXT-38',
      title:
        'one-sided crossing with historicalEyeCorrection off: no swap, library warns unconfirmed',
      planRow: 'Crossed eyes (every current Brio export): correction toggle (one-sided evidence)',
      doc: eyes(RIGHT, CUSTOM),
      policy: { historicalEyeCorrection: false },
      classification: 'intentional',
      note: 'Pins the NON-default historicalEyeCorrection:false pending the plan row-111 decision; not an adopted host change. Same document as EXT-26: with the policy off the library takes the second EYE_PAIRING_UNCONFIRMED branch (resolve.ts:158-163, one-sided wording), records no correction and each eye keeps its stored float (left #87C0A3 offGrid against #DCBA6C, right #1030F0 offGrid). The host never swaps here either, so the previews agree; only the library warning differs.',
      lib: {
        corrections: 0,
        issueCodes: ['EYE_PAIRING_UNCONFIRMED'],
        noIssueCodes: ['EYE_PAIRING_INFERRED'],
        slots: {
          leftEye: {
            extendedHex: RIGHT,
            effectiveExtendedHex: RIGHT,
            correction: null,
            interpretation: 'offGrid',
            displayHex: RIGHT,
          },
          rightEye: {
            extendedHex: CUSTOM,
            effectiveExtendedHex: CUSTOM,
            correction: null,
            interpretation: 'offGrid',
            displayHex: CUSTOM,
          },
        },
      },
    },
    // ------------------------------------------------------------------ overflow
    {
      id: 'EXT-39',
      title:
        'overflowing exponent "1e999": host refuses the file, library invalidates the one field',
      planRow: 'Unknown tribe/gender or malformed color',
      doc: char({ LEyeColor: 42, LeftEyeColor: '1e999, 0.25, 0.25', ...liveRight }),
      classification: 'intentional',
      note: 'The token matches both float patterns but Number("1e999") is Infinity: the host Number.isFinite check refuses the whole file (chara-parser.ts:342); the library numericToken passes and the finite check fails (inspect.ts:92) → INVALID_FIELD on LeftEyeColor only, never a clamped white channel; the right eye still reads.',
      lib: {
        issues: [{ code: 'INVALID_FIELD', path: ['LeftEyeColor'] }],
        slots: { ...leftInvalid, ...rightStillRead },
      },
    },
    // ------------------------------------------------------------------ all-zero block (more)
    {
      id: 'EXT-40',
      title: 'zero block with Mouth absent: lip activity unknown, reason ambiguousZeroBlock',
      planRow:
        'Missing/null/invalid highlight, face-paint or lip-color control with a resolved color (with an all-zero block)',
      doc: char({
        LEyeColor: 42,
        LipsToneFurPattern: 10,
        IsExtendedAppearanceValid: true,
        ...ZERO_BLOCK,
      }),
      classification: 'intentional',
      note: 'Host: the block is uncaptured, the lip alpha is null and the indexed lip shows #EBE4BF. Library: Mouth absent on a known race → lip active null (resolve.ts:199-200), not live, palette #EBE4BF, but reason ambiguousZeroBlock, not activityUnknown, because :429 tests the zero block before active === null. Adapter obligation (Task 3): key the activity-unknown warning and matchHex null on active === null, never on the reason.',
      lib: {
        issueCodes: ['AMBIGUOUS_ZERO_BLOCK'],
        slots: {
          lip: {
            active: null,
            extendedActive: false,
            alpha: 0,
            interpretation: 'palette',
            reason: 'ambiguousZeroBlock',
            displayHex: '#EBE4BF',
          },
        },
      },
    },
    {
      id: 'EXT-41',
      title: 'zero block with one key null: neither side calls it uncaptured',
      planRow:
        'Lip alpha zero with extended data inactive (all-zero extended blocks: all seven keys required)',
      doc: char({
        LEyeColor: 42,
        IsExtendedAppearanceValid: true,
        ...ZERO_BLOCK,
        LimbalRingColor: null,
      }),
      classification: 'preserved',
      note: 'Sibling of EXT-23 with the key present as null: host requires f !== null for every float (chara-parser.ts:501-503) and the library current(null) is null so ZERO_KEYS.every is false; a null field raises no issue. The black eye float stays live → offGrid #000000 on both sides.',
      lib: {
        noIssueCodes: ['AMBIGUOUS_ZERO_BLOCK', 'INVALID_FIELD'],
        slots: {
          leftEye: {
            extendedActive: true,
            extendedHex: '#000000',
            interpretation: 'offGrid',
            displayHex: '#000000',
          },
        },
      },
    },
    {
      id: 'EXT-42',
      title:
        'zero block with IsExtendedAppearanceValid false: still treated as uncaptured/ambiguous',
      planRow:
        'Lip alpha zero with extended data inactive (all-zero extended blocks: independent of the flag)',
      doc: char({ LEyeColor: 42, IsExtendedAppearanceValid: false, ...ZERO_BLOCK }),
      classification: 'preserved',
      note: 'Neither side gates the zero-block test on the flag. Host nulls the floats first, so floatHex is null and there is no extendedMissing note (it needs a float). Library raises AMBIGUOUS_ZERO_BLOCK anyway (resolve.ts:174-183) and the reason is ambiguousZeroBlock, not extendedInactive (:429 precedes :431). Same visible outcome: the palette eye. The flag-absent document takes the same paths. HOST QUIRK: the host nulls the all-zero block in the parser before liveness is considered, so the slot carries no extendedMissing note.',
      lib: {
        issueCodes: ['AMBIGUOUS_ZERO_BLOCK'],
        slots: {
          leftEye: {
            extendedHex: '#000000',
            extendedActive: false,
            interpretation: 'palette',
            reason: 'ambiguousZeroBlock',
            displayHex: LEFT,
            deltaE: null,
          },
        },
      },
    },
    // ------------------------------------------------------------------ eye pairing preconditions
    {
      id: 'EXT-43',
      title: 'crossed-looking floats with the right eye index 192 (no palette entry): no swap',
      planRow:
        'Crossed eyes (every current Brio export): library preconditions (valid differing indices and both shader colors)',
      doc: eyes(RIGHT, LEFT, { REyeColor: 192 }),
      classification: 'preserved',
      note: 'Eye index 192 is valid uint8 but past the 192-entry sheet: the library returns indexOutOfRange before any palette request, so the right shaderHex is null and pairEyes returns (resolve.ts:114-115). An implementation that treated the missing shader as "does not land" would see crossedRight plus a custom left and swap one-sidedly. Host: sheet.find(192) fails, so lands() is false and uncrossEyeFloats does not swap; the right eye errors indexOutOfRange.',
      lib: {
        corrections: 0,
        issues: [{ code: 'PALETTE_INDEX_OUT_OF_RANGE', path: ['REyeColor'] }],
        noIssueCodes: ['EYE_PAIRING_INFERRED', 'EYE_PAIRING_UNCONFIRMED'],
        slots: {
          leftEye: {
            extendedHex: RIGHT,
            effectiveExtendedHex: RIGHT,
            correction: null,
            interpretation: 'offGrid',
            displayHex: RIGHT,
          },
          rightEye: {
            storedIndex: { state: 'valid', value: 192 },
            shaderHex: null,
            effectiveExtendedHex: LEFT,
            correction: null,
            interpretation: 'unresolved',
            reason: 'indexOutOfRange',
            displayHex: null,
          },
        },
      },
    },
    {
      id: 'EXT-44',
      title: 'crossed-looking floats with an invalid right eye index (4.5): no swap',
      planRow:
        'Crossed eyes (every current Brio export): library preconditions (valid differing indices and both shader colors)',
      doc: eyes(RIGHT, LEFT, { REyeColor: 4.5 }),
      classification: 'preserved',
      note: 'A fractional index is invalid in the library (isUint, INVALID_FIELD at REyeColor) → invalidIndex, no palette request, and pairEyes requires both storedIndex fields valid → no swap. Host keeps 4.5 as the index, finds no sheet entry (error indexOutOfRange, sheetIndex 4.5) and lands() is false → no swap. Same outcome; the library keeps the raw 4.5.',
      lib: {
        corrections: 0,
        issues: [{ code: 'INVALID_FIELD', path: ['REyeColor'] }],
        noIssueCodes: ['EYE_PAIRING_INFERRED', 'EYE_PAIRING_UNCONFIRMED'],
        slots: {
          leftEye: {
            effectiveExtendedHex: RIGHT,
            correction: null,
            interpretation: 'offGrid',
            displayHex: RIGHT,
          },
          rightEye: {
            storedIndex: { state: 'invalid', raw: 4.5 },
            effectiveExtendedHex: LEFT,
            correction: null,
            interpretation: 'unresolved',
            reason: 'invalidIndex',
            displayHex: null,
          },
        },
      },
    },
    // ------------------------------------------------------------------ light lip with a live float
    {
      id: 'EXT-45',
      title:
        'light lip index with a live float and alpha 0.5: compared with lipsDark at the in-sheet index, composited',
      planRow: 'Task 1 step 2: dark/light lips (light index with a live float and composite)',
      doc: char({
        LipsToneFurPattern: 138,
        Mouth: 128,
        Skintone: 12,
        MouthColor: squared('#888467', 0.5),
        IsExtendedAppearanceValid: true,
      }),
      classification: 'preserved',
      note: 'File index 138 = light sheet entry 10 (creator #EBE4BF); the stored float is the lipsDark shader entry 10 (#888467) on both sides (host SHADER_PALETTE lip → lipsDark at sheetIndex; resolve.ts:345), so ΔE 0 → host index, library paletteAgreement. A shader request to lipsLight (none bundled) or at file index 138 returns null and would give missingShaderReference. Alpha 0.5 composites #EBE4BF over skin #B18D73 in linear light → #D1BF9F (hand-computed with the color-math compositeHex formula, which the host shares).',
      lib: {
        noIssueCodes: ['MISSING_SHADER_REFERENCE', 'ALPHA_CLAMPED'],
        slots: {
          lip: {
            active: true,
            variant: 'light',
            sheetIndex: 10,
            creatorHex: '#EBE4BF',
            shaderHex: '#888467',
            extendedActive: true,
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: '#EBE4BF',
            alpha: 0.5,
            deltaE: { max: 1 },
            lipCompositeHex: '#D1BF9F',
          },
          skin: { interpretation: 'palette', displayHex: '#B18D73' },
        },
      },
    },
  ];

  return extCases;
})();

// ---- section ENV
const envCasesSection: ParityCase[] = (() => {
  /**
   * Section ENV: document admission and robustness. Compares the READERS only, with the library's
   * default `readChara` options (the 8,192-byte facade limit belongs to Task 3).
   *
   * Literal palette values (lookup.ts, 2026-10-25): eyes 2 = #D3D3D3, eyes 3 = #B3B3B3,
   * eyes 7 = #262626 (creator and shader halves are identical for these eye entries).
   *
   * Library rules cited below are from ffxiv-chara `packages/chara/src/`:
   * - read.ts `READ_DEFAULTS`: maxBytes 16 MiB, maxDepth 32, maxNodes 100,000, maxKeyLength 1,024,
   *   maxStringLength 65,536.
   * - read.ts `Reader.read`: a leading U+FEFF is skipped; anything but whitespace after the root
   *   value is INVALID_JSON.
   * - read.ts `Reader.value`: depth > maxDepth fails MAX_DEPTH (the root value is depth 1, every
   *   object member / array element is depth + 1); every value and every object key counts one node
   *   and the count passing maxNodes fails MAX_NODES; a non-image string longer than maxStringLength
   *   fails MAX_STRING_LENGTH (an image string has no length limit); a numeric token that is not
   *   finite, or is an integer outside Number.isSafeInteger, fails INVALID_NUMBER.
   * - read.ts `Reader.object`: a key longer than maxKeyLength fails MAX_KEY_LENGTH; keys are compared
   *   after JSON string decoding, per object (a fresh Set for every object, nested ones included),
   *   and a repeat fails DUPLICATE_KEY; records are `Object.create(null)`; a key equal to
   *   `base64image` (case-insensitive) is never stored, sets `hasEmbeddedImage`, records
   *   `{path, type}` in `embeddedImages`, and adds IMAGE_OMITTED (string/null value) or
   *   INVALID_IMAGE_TYPE (anything else) at path [key].
   * - read.ts `readChara`: a non-record root, or a record with no key in CHARACTER_FIELDS
   *   (field-spec.ts: equipment slots, byte/colour/float fields, Race, Tribe, Gender, Age, ModelType,
   *   EnableHighlights, FacialFeatures, Glasses, BustScale, IsExtendedAppearanceValid), fails
   *   NOT_CHARACTER. The test is `Object.keys(...).some(...)`, so a key whose value is null counts.
   *   Every key outside KNOWN_FIELDS (CHARACTER_FIELDS + METADATA_FIELDS) adds UNSUPPORTED_FIELD at
   *   path [key].
   * - inspect.ts `inspectChara` copies the reader's issues into the inspection; `Inspector.field`:
   *   `Object.hasOwn` decides absent, null is state `null`.
   * - appearance/resolve.ts: a slot whose index is absent/null and has no live extended color stays
   *   `interpretation: 'unresolved'`, `reason: 'missingColor'`; an active valid eye index with no
   *   extended data is `palette` / `paletteOnly` with `displayHex = creatorHex`.
   *
   * Host: parseCharaFile (chara-parser.ts:444-475) is native JSON.parse, then "not a JSON object"
   * for a non-object/null/array root, then "carries no character colour fields" unless one of the
   * 15 COLOR_KEYS is present (`in`). It has no depth, node, string or key-length bound.
   */

  const BASE = '"Tribe":"Wildwood","Gender":"Feminine"';
  /** A minimal identity + left-eye-3 document with `extra` JSON members appended. */
  const withLeftEye3 = (extra: string): string => `{${BASE},"LEyeColor":3,${extra}}`;
  /** The same minimal identity + left-eye-3 document as an object. */
  const leftEye3 = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    Tribe: 'Wildwood',
    Gender: 'Feminine',
    LEyeColor: 3,
    ...extra,
  });
  /** `k` nested empty arrays: the outermost sits at depth 2 under the root object, the innermost at k + 1. */
  const nested = (k: number): string => '['.repeat(k) + ']'.repeat(k);

  const PNG_1X1 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const LEFT_EYE_3_LIB = {
    active: true,
    interpretation: 'palette',
    reason: 'paletteOnly',
    creatorHex: '#B3B3B3',
    displayHex: '#B3B3B3',
    storedIndex: { state: 'valid', value: 3 },
  } as const;
  const UNRESOLVED_ABSENT = {
    interpretation: 'unresolved',
    reason: 'missingColor',
    displayHex: null,
    storedIndex: { state: 'absent' },
  } as const;

  const ROW_LIMITS = 'Duplicate keys, depth/node limits, unsafe numbers';
  const ROW_IMAGE = 'Embedded image under 8 KiB';
  const ROW_PARTIAL = 'Partial equipment-only document';

  const envCases: ParityCase[] = [
    // ------------------------------------------------------------ not a character document
    {
      id: 'ENV-01',
      title: 'text that is not JSON is refused by both',
      planRow: 'Generic admission (no plan row): both refuse non-JSON text',
      doc: 'Tribe: Wildwood\nLEyeColor: 3',
      classification: 'preserved',
      note: 'Host JSON.parse throws and parseCharaFile rethrows "not valid JSON". Library read.ts Reader.value finds no string/object/array/literal/digit at "T" and fails INVALID_JSON.',
      lib: { refused: 'INVALID_JSON' },
    },
    {
      id: 'ENV-02',
      title: 'a JSON array root is refused, not unwrapped',
      planRow: 'Generic admission (no plan row): non-object root refused by both, never unwrapped',
      doc: `[{${BASE},"LEyeColor":3}]`,
      classification: 'preserved',
      note: 'Host refuses a non-object root ("not a JSON object") even when the array holds a character. Library readChara: isRecord(fields) is false for an array, so NOT_CHARACTER; neither unwraps the first element.',
      lib: { refused: 'NOT_CHARACTER' },
    },
    {
      id: 'ENV-03',
      title: 'a scalar root is refused',
      planRow: 'Generic admission (no plan row): scalar root refused by both',
      doc: '42',
      classification: 'preserved',
      note: 'Host: typeof 42 is not "object", so "not a JSON object". Library: the Reader admits the scalar token, then readChara fails NOT_CHARACTER because the root is not a record (not INVALID_JSON).',
      lib: { refused: 'NOT_CHARACTER' },
    },
    {
      id: 'ENV-04',
      title: 'an empty object is refused',
      planRow: ROW_PARTIAL,
      doc: {},
      classification: 'preserved',
      note: 'Host: no COLOR_KEYS key present, so "carries no character colour fields". Library: Object.keys({}) has no CHARACTER_FIELDS key, so NOT_CHARACTER.',
      lib: { refused: 'NOT_CHARACTER' },
    },
    {
      id: 'ENV-05',
      title: 'a metadata-only object (TypeName + Nickname) is refused',
      planRow: ROW_PARTIAL,
      doc: { TypeName: 'Anamnesis Character File', Nickname: 'Parity Test' },
      classification: 'preserved',
      note: 'Host: neither key is a colour key. Library: TypeName and Nickname are METADATA_FIELDS, which are KNOWN_FIELDS but not CHARACTER_FIELDS, so readChara fails NOT_CHARACTER.',
      lib: { refused: 'NOT_CHARACTER' },
    },
    {
      id: 'ENV-06',
      title: 'a pose-only object (unknown keys only) is refused',
      planRow: ROW_PARTIAL,
      doc: {
        TypeName: 'Anamnesis Pose',
        Position: '0, 0, 0',
        Bones: { Root: { Position: '0, 0, 0', Rotation: '0, 0, 0, 1' } },
      },
      classification: 'preserved',
      note: 'Host: no colour key, refused. Library: Position and Bones are not CHARACTER_FIELDS (TypeName is metadata), so NOT_CHARACTER; unknown keys never make a document a character.',
      lib: { refused: 'NOT_CHARACTER' },
    },

    // ------------------------------------------------------------ partial documents
    // ENV-07 (Body-only document) deleted: IDN-30 owns that document.
    {
      id: 'ENV-08',
      title: 'Glasses-only document: host refuses, library reads the facewear row',
      planRow: ROW_PARTIAL,
      doc: { Glasses: { GlassesId: 3 } },
      classification: 'intentional',
      note: 'Host: Glasses is not one of the 15 colour keys, so refused. Library: Glasses is in CHARACTER_FIELDS; inspect.ts facewear decodes { GlassesId: uint } as valid 3.',
      lib: {
        facewear: { state: 'valid', value: 3 },
        slots: { leftEye: UNRESOLVED_ABSENT },
        noIssueCodes: ['UNSUPPORTED_FIELD', 'INVALID_FIELD'],
      },
    },
    {
      id: 'ENV-09',
      title: 'Race-only document: host refuses, library takes the race as the canonical race',
      planRow: ROW_PARTIAL,
      doc: { Race: 'Elezen' },
      classification: 'intentional',
      note: 'Host: Race is not a colour key, so refused. Library: Race is in CHARACTER_FIELDS; with Tribe absent and Race valid, inspect.ts sets canonicalRace Elezen with raceSource race, which makes the limbal slot kind tattoo (not limbalOrTattoo).',
      lib: {
        identity: {
          race: { state: 'valid', value: 'Elezen' },
          tribe: { state: 'absent' },
          canonicalRace: 'Elezen',
          raceSource: 'race',
        },
        slots: { limbal: { kind: 'tattoo', ...UNRESOLVED_ABSENT } },
      },
    },
    {
      id: 'ENV-10',
      title:
        'control bytes only (Mouth, FacePaint, EnableHighlights): host refuses, library reads activation',
      planRow: ROW_PARTIAL,
      doc: { Mouth: 130, FacePaint: 0, EnableHighlights: true },
      classification: 'intentional',
      note: 'Plan row: Mouth, FacePaint and EnableHighlights do not count for the host. Library: all three are CHARACTER_FIELDS. resolve.ts: highlights active = EnableHighlights true; facePaint (0 & ~0x80) = 0 so inactive/facePaintNone; with no race the lip is on only if bit 0x80 is set, and 130 has it, so active true with indexMeaning unknown; absent indices stay unresolved/missingColor.',
      lib: {
        slots: {
          highlights: { active: true, ...UNRESOLVED_ABSENT },
          facePaint: {
            active: false,
            interpretation: 'inactive',
            reason: 'facePaintNone',
            displayHex: null,
          },
          lip: { active: true, indexMeaning: 'unknown', ...UNRESOLVED_ABSENT },
        },
      },
    },
    {
      id: 'ENV-11',
      title: 'a colour key whose value is null admits the document on both sides',
      planRow: ROW_PARTIAL,
      doc: { LEyeColor: null },
      classification: 'preserved',
      note: 'Plan row: the host counts a colour key "even as null" (key presence, `in`), and resolves the null index as inert. Library readChara tests Object.keys, so a null supported field also admits the document; inspect.ts gives state null, and resolve.ts leaves it unresolved/missingColor.',
      lib: {
        identity: { canonicalRace: null },
        slots: {
          leftEye: {
            active: true,
            interpretation: 'unresolved',
            reason: 'missingColor',
            displayHex: null,
            storedIndex: { state: 'null' },
          },
        },
      },
    },

    // ------------------------------------------------------------ bounded refusals
    {
      id: 'ENV-12',
      title: 'duplicate key: host keeps the last value, library refuses',
      planRow: ROW_LIMITS,
      doc: `{${BASE},"LEyeColor":3,"LEyeColor":7}`,
      classification: 'intentional',
      note: 'Native JSON.parse keeps the last member, so the host reads LEyeColor 7 (eyes 7 = #262626). read.ts Reader.object keeps a per-object key Set and fails DUPLICATE_KEY on the repeat; plan row accepts the bounded refusal.',
      lib: { refused: 'DUPLICATE_KEY' },
    },
    {
      id: 'ENV-13',
      title: 'escaped-key duplicate (L\\u0045yeColor) is still a duplicate for both',
      planRow: ROW_LIMITS,
      doc: `{${BASE},"LEyeColor":3,"L\\u0045yeColor":7}`,
      classification: 'intentional',
      note: 'JSON.parse decodes \\u0045 to "E", so the host sees one key and keeps the last value, 7. read.ts decodes each key with JSON.parse before the Set lookup, so the escaped spelling collides and fails DUPLICATE_KEY (a raw-token comparison would miss it).',
      lib: { refused: 'DUPLICATE_KEY' },
    },
    {
      id: 'ENV-14',
      title: 'an integer beyond 2^53 in an unknown field: host ignores it, library refuses',
      planRow: ROW_LIMITS,
      doc: withLeftEye3('"Revision":9007199254740993'),
      classification: 'intentional',
      note: 'The host never reads the unknown key and resolves left eye 3 (#B3B3B3). read.ts: Number("9007199254740993") is an integer that fails Number.isSafeInteger, so INVALID_NUMBER, even under a key the library would only flag as unsupported.',
      lib: { refused: 'INVALID_NUMBER' },
    },
    {
      id: 'ENV-15',
      title:
        'an overflowing exponent (1e999) in an unknown field: host ignores it, library refuses',
      planRow: ROW_LIMITS,
      doc: withLeftEye3('"Scale":1e999'),
      classification: 'intentional',
      note: 'JSON.parse yields Infinity under a key the host never reads, so left eye 3 resolves. read.ts: Number("1e999") is not finite, so INVALID_NUMBER.',
      lib: { refused: 'INVALID_NUMBER' },
    },
    {
      id: 'ENV-16',
      title: 'nesting exactly at the default depth limit (32) is admitted by both',
      planRow: ROW_LIMITS,
      doc: withLeftEye3(`"Pose":${nested(31)}`),
      classification: 'preserved',
      note: 'Root object is depth 1 and Pose is depth 2, so 31 nested empty arrays put the innermost at depth 32, which read.ts admits (fails only when depth > 32). Pose is outside KNOWN_FIELDS, so UNSUPPORTED_FIELD at ["Pose"]; left eye 3 still resolves on both sides.',
      lib: {
        slots: { leftEye: LEFT_EYE_3_LIB },
        issues: [{ code: 'UNSUPPORTED_FIELD', path: ['Pose'] }],
      },
    },
    {
      id: 'ENV-17',
      title:
        'nesting one level past the default depth limit: host accepts, library refuses MAX_DEPTH',
      planRow: ROW_LIMITS,
      doc: withLeftEye3(`"Pose":${nested(32)}`),
      classification: 'intentional',
      note: 'Native JSON.parse has no depth bound and the host ignores Pose. With 32 nested arrays the innermost sits at depth 33 > maxDepth 32, so read.ts fails MAX_DEPTH before building the graph; the depth check covers unknown keys too.',
      lib: { refused: 'MAX_DEPTH' },
    },

    // ------------------------------------------------------------ embedded image
    {
      id: 'ENV-18',
      title: 'a populated small Base64Image is omitted by both',
      planRow: ROW_IMAGE,
      doc: char({ LEyeColor: 3, Base64Image: PNG_1X1 }),
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Plan row: preserve omission, no blanket image rejection. The host never reads Base64Image. read.ts drops the key from fields (so no UNSUPPORTED_FIELD), sets hasEmbeddedImage, records type string, and adds IMAGE_OMITTED at ["Base64Image"]; left eye 3 still resolves.',
      lib: {
        slots: { leftEye: LEFT_EYE_3_LIB },
        hasEmbeddedImage: true,
        embeddedImageTypes: ['string'],
        issues: [{ code: 'IMAGE_OMITTED', path: ['Base64Image'] }],
        noIssueCodes: ['UNSUPPORTED_FIELD', 'INVALID_IMAGE_TYPE'],
      },
    },
    {
      id: 'ENV-19',
      title: 'a null Base64Image placeholder is omitted by both',
      planRow: ROW_IMAGE,
      doc: char({ LEyeColor: 3, Base64Image: null }),
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Plan row: null placeholders included. read.ts classifies a value starting with "n" as type null and adds IMAGE_OMITTED (info) at ["Base64Image"], never INVALID_IMAGE_TYPE, and does not store the key; the host ignores it.',
      lib: {
        slots: { leftEye: LEFT_EYE_3_LIB },
        hasEmbeddedImage: true,
        embeddedImageTypes: ['null'],
        issues: [{ code: 'IMAGE_OMITTED', path: ['Base64Image'] }],
        noIssueCodes: ['UNSUPPORTED_FIELD', 'INVALID_IMAGE_TYPE'],
      },
    },
    {
      id: 'ENV-20',
      title: 'an empty-string Base64Image placeholder is omitted by both',
      planRow: ROW_IMAGE,
      doc: char({ LEyeColor: 3, Base64Image: '' }),
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Plan row: empty placeholders included. read.ts sees a string token (initial ") and adds IMAGE_OMITTED at ["Base64Image"]; the key never reaches fields. The host ignores the key; left eye 3 resolves on both sides.',
      lib: {
        slots: { leftEye: LEFT_EYE_3_LIB },
        hasEmbeddedImage: true,
        embeddedImageTypes: ['string'],
        issues: [{ code: 'IMAGE_OMITTED', path: ['Base64Image'] }],
        noIssueCodes: ['UNSUPPORTED_FIELD', 'INVALID_IMAGE_TYPE'],
      },
    },

    // ------------------------------------------------------------ tolerated extras
    {
      id: 'ENV-21',
      title: 'unknown extra fields are ignored by both',
      planRow:
        'Generic admission (no plan row): unknown extra fields tolerated, reported as UNSUPPORTED_FIELD',
      doc: char({ LEyeColor: 3, Bones: { Root: { Position: '0, 0, 0' } }, ExtraFlag: true }),
      classification: 'preserved',
      note: 'The host reads only the keys it knows. Library readChara stores the unknown keys but reports each as UNSUPPORTED_FIELD at its own path (outside KNOWN_FIELDS) without refusing, and no image is involved; left eye 3 resolves unchanged.',
      lib: {
        slots: { leftEye: LEFT_EYE_3_LIB },
        hasEmbeddedImage: false,
        issues: [
          { code: 'UNSUPPORTED_FIELD', path: ['Bones'] },
          { code: 'UNSUPPORTED_FIELD', path: ['ExtraFlag'] },
        ],
      },
    },
    {
      id: 'ENV-22',
      title: 'a leading U+FEFF before the JSON text: host parser refuses, library skips it',
      planRow:
        'Unlisted (new register row): leading U+FEFF - library skips one BOM (read.ts:100), host JSON.parse refuses; API-level only, since every host caller (File.text / Response.text / default TextDecoder) strips the BOM first; non-blocking',
      doc: '\uFEFF' + `{${BASE},"LEyeColor":3}`,
      classification: 'intentional',
      note: 'UNPLANNED: the library skips one leading U+FEFF while the host refuses; the maintainer must add this row to the plan compatibility table (API-level only, non-blocking). Native JSON.parse does not treat U+FEFF as whitespace, so parseCharaFile reports "not valid JSON" for a string that still carries it. read.ts Reader.read skips one leading U+FEFF (charCodeAt(0) === 0xfeff, api.md), so the library reads the character. The library is the more lenient side; in production the web app (File.text) and the bot (Response.text / TextDecoder) strip the BOM before the host parser, so users do not see the difference.',
      lib: {
        identity: { tribe: { state: 'valid', value: 'Wildwood' } },
        slots: { leftEye: LEFT_EYE_3_LIB },
      },
    },
    {
      id: 'ENV-23',
      title: 'a __proto__ key is an inert own property for both, never a prototype',
      planRow: 'Generic admission (no plan row): prototype-shaped keys stay inert own properties',
      doc: `{"__proto__":{"LEyeColor":3,"Tribe":"Raen"},${BASE},"REyeColor":2}`,
      classification: 'preserved',
      note: 'JSON.parse defines "__proto__" as an own data property, so the host does not inherit LEyeColor 3: left eye stays null/inert (a host pollution or setter bug would surface it; the nested Tribe is shadowed by the own Tribe either way). Library records are Object.create(null) and inspect.ts uses Object.hasOwn, so the nested values could not surface even under a pollution bug; the library-side discriminator is the own key itself, reported as UNSUPPORTED_FIELD at ["__proto__"].',
      lib: {
        identity: { tribe: { state: 'valid', value: 'Wildwood' }, canonicalRace: 'Elezen' },
        slots: {
          leftEye: UNRESOLVED_ABSENT,
          rightEye: {
            interpretation: 'palette',
            creatorHex: '#D3D3D3',
            storedIndex: { state: 'valid', value: 2 },
          },
        },
        issues: [{ code: 'UNSUPPORTED_FIELD', path: ['__proto__'] }],
      },
    },
    {
      id: 'ENV-24',
      title: 'constructor / hasOwnProperty / toString keys do not disturb either reader',
      planRow: 'Generic admission (no plan row): prototype-shaped keys stay inert own properties',
      doc: `{"constructor":{"prototype":{"LEyeColor":3}},"hasOwnProperty":0,"toString":"x",${BASE},"REyeColor":2}`,
      classification: 'preserved',
      note: 'The host uses `in` and Object.hasOwn on its own tables, never record.hasOwnProperty, so shadowing it is harmless and left eye stays absent. The library reads own keys of null-prototype records; each of the three keys is only UNSUPPORTED_FIELD at its own path, and the right eye resolves on both sides.',
      lib: {
        identity: { tribe: { state: 'valid', value: 'Wildwood' } },
        slots: {
          leftEye: UNRESOLVED_ABSENT,
          rightEye: {
            interpretation: 'palette',
            creatorHex: '#D3D3D3',
            storedIndex: { state: 'valid', value: 2 },
          },
        },
        issues: [
          { code: 'UNSUPPORTED_FIELD', path: ['constructor'] },
          { code: 'UNSUPPORTED_FIELD', path: ['hasOwnProperty'] },
          { code: 'UNSUPPORTED_FIELD', path: ['toString'] },
        ],
      },
    },

    // ------------------------------------------------------------ refinement additions
    {
      id: 'ENV-25',
      title:
        'more than 100,000 nodes under an unknown key: host accepts, library refuses MAX_NODES',
      planRow: ROW_LIMITS,
      doc: leftEye3({ Pose: new Array<number>(100_001).fill(0) }),
      classification: 'intentional',
      note: 'Native JSON.parse has no node bound and the host never reads Pose, so left eye 3 resolves. read.ts counts one node per value and per key: the 100,001 array elements alone pass maxNodes 100,000, so MAX_NODES (the text is about 200 KB, far under the 16 MiB maxBytes, so INPUT_TOO_LARGE cannot fire first).',
      lib: { refused: 'MAX_NODES' },
    },
    {
      id: 'ENV-26',
      title: 'a numeric Base64Image is omitted with INVALID_IMAGE_TYPE, never refused',
      planRow: ROW_IMAGE,
      doc: char({ LEyeColor: 3, Base64Image: 7 }),
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Plan row: no blanket image-field rejection. The host ignores the key. read.ts classifies the initial digit as type number, adds INVALID_IMAGE_TYPE (warning) at ["Base64Image"] instead of IMAGE_OMITTED, still sets hasEmbeddedImage and never stores the key (so no UNSUPPORTED_FIELD); left eye 3 resolves.',
      lib: {
        slots: { leftEye: LEFT_EYE_3_LIB },
        hasEmbeddedImage: true,
        embeddedImageTypes: ['number'],
        issues: [{ code: 'INVALID_IMAGE_TYPE', path: ['Base64Image'] }],
        noIssueCodes: ['UNSUPPORTED_FIELD', 'IMAGE_OMITTED'],
      },
    },
    {
      id: 'ENV-27',
      title: 'an object Base64Image is omitted with INVALID_IMAGE_TYPE, never refused',
      planRow: ROW_IMAGE,
      doc: char({ LEyeColor: 3, Base64Image: { Data: PNG_1X1 } }),
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Plan row: no blanket image-field rejection. The host ignores the key. read.ts classifies the initial "{" as type object, adds INVALID_IMAGE_TYPE at ["Base64Image"], walks the value in discard mode (nothing stored, the nested Data never becomes a field), and adds no UNSUPPORTED_FIELD; left eye 3 resolves.',
      lib: {
        slots: { leftEye: LEFT_EYE_3_LIB },
        hasEmbeddedImage: true,
        embeddedImageTypes: ['object'],
        issues: [{ code: 'INVALID_IMAGE_TYPE', path: ['Base64Image'] }],
        noIssueCodes: ['UNSUPPORTED_FIELD', 'IMAGE_OMITTED'],
      },
    },
    {
      id: 'ENV-28',
      title:
        'a duplicate key inside a nested Body object: host keeps the last dye, library refuses',
      planRow: ROW_LIMITS,
      doc: `{${BASE},"LEyeColor":3,"Body":{"ModelBase":6016,"ModelVariant":1,"DyeId":1,"DyeId":2}}`,
      classification: 'intentional',
      note: 'Native JSON.parse keeps the last nested member, so the host emits Body dye channel 1 = stain 2 and resolves left eye 3. read.ts Reader.object creates a fresh key Set for every object, nested ones included, so the repeated DyeId inside Body fails DUPLICATE_KEY for the whole document.',
      lib: { refused: 'DUPLICATE_KEY' },
    },
    {
      id: 'ENV-29',
      title: 'a document whose only key is Base64Image is refused by both',
      planRow: 'Generic admission (no plan row): an image key does not make a character document',
      doc: { Base64Image: PNG_1X1 },
      classification: 'preserved',
      note: 'Host: Base64Image is not a colour key, so "carries no character colour fields". Library: read.ts never stores the image key, so fields is an empty record and readChara fails NOT_CHARACTER; the image does not make a document a character.',
      lib: { refused: 'NOT_CHARACTER' },
    },
    {
      id: 'ENV-30',
      title:
        'an unsafe integer in a known index field: host reads a rounded index, library refuses',
      planRow: ROW_LIMITS,
      doc: `{${BASE},"LEyeColor":9007199254740993}`,
      classification: 'intentional',
      note: 'JSON.parse rounds 9007199254740993 to 9007199254740992, a finite number the host readIndex accepts; the resolver then gives the left eye a slot verdict (no eyes entry, so error indexOutOfRange) instead of refusing. read.ts: the integer fails Number.isSafeInteger, so INVALID_NUMBER for the whole document. Sibling of ENV-14, which uses an unknown key.',
      lib: { refused: 'INVALID_NUMBER' },
    },
    {
      id: 'ENV-31',
      title:
        'a non-image string over 65,536 characters: host accepts, library refuses MAX_STRING_LENGTH',
      planRow: ROW_LIMITS,
      doc: leftEye3({ Nickname: 'x'.repeat(65_537) }),
      classification: 'intentional',
      note: "Native JSON.parse has no string bound and the host never reads Nickname, so left eye 3 resolves. read.ts Reader.string counts decoded characters and fails when ++length > maxStringLength 65,536, so 65,537 characters fail MAX_STRING_LENGTH. Plan row 114 names depth/node limits; row 114's planned behavior (accept the library's bounded refusal) covers every READ_DEFAULTS bound, string length included; in production the 8 KiB byte cap refuses such a file first.",
      lib: { refused: 'MAX_STRING_LENGTH' },
    },
    {
      id: 'ENV-32',
      title: 'a key over 1,024 characters: host accepts, library refuses MAX_KEY_LENGTH',
      planRow: ROW_LIMITS,
      doc: leftEye3({ ['K'.repeat(1_025)]: 0 }),
      classification: 'intentional',
      note: "The host never reads the unknown key, so left eye 3 resolves. read.ts reads every object key with limit maxKeyLength 1,024 and code MAX_KEY_LENGTH, so a 1,025-character key refuses the document. Plan row 114 names depth/node limits; row 114's planned behavior (accept the library's bounded refusal) covers every READ_DEFAULTS bound, key length included; in production the 8 KiB byte cap refuses such a file first.",
      lib: { refused: 'MAX_KEY_LENGTH' },
    },
    {
      id: 'ENV-33',
      title: 'non-whitespace after the root object is refused by both',
      planRow: 'Generic admission (no plan row): trailing content after the root refused by both',
      doc: `{${BASE},"LEyeColor":3} x`,
      classification: 'preserved',
      note: 'Host: JSON.parse rejects trailing content, so "not valid JSON". Library read.ts Reader.read skips trailing whitespace only, then pos !== text.length fails INVALID_JSON (a reader that stopped after the first value would admit it).',
      lib: { refused: 'INVALID_JSON' },
    },
    {
      id: 'ENV-34',
      title: 'a JSON null root is refused by both',
      planRow: 'Generic admission (no plan row): null root refused by both',
      doc: 'null',
      classification: 'preserved',
      note: 'Host: data === null, so "not a JSON object" (typeof null is "object", the explicit null check catches it). Library: the Reader admits the null literal, then isRecord(null) is false, so NOT_CHARACTER (not INVALID_JSON).',
      lib: { refused: 'NOT_CHARACTER' },
    },
    {
      id: 'ENV-35',
      title: 'a lowercase base64image key is omitted as an image, not stored as an unknown field',
      planRow: ROW_IMAGE,
      doc: char({ LEyeColor: 3, base64image: PNG_1X1 }),
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'The host ignores the key under any spelling. read.ts matches key.toLowerCase() === "base64image", so the lowercase spelling is omitted like Base64Image: hasEmbeddedImage, IMAGE_OMITTED at ["base64image"], not stored and not UNSUPPORTED_FIELD. Blocking: embedded-image omission is a required contract whatever the key spelling, since a library that stored the payload would retain it.',
      lib: {
        slots: { leftEye: LEFT_EYE_3_LIB },
        hasEmbeddedImage: true,
        embeddedImageTypes: ['string'],
        issues: [{ code: 'IMAGE_OMITTED', path: ['base64image'] }],
        noIssueCodes: ['UNSUPPORTED_FIELD', 'INVALID_IMAGE_TYPE'],
      },
    },
  ];

  return envCases;
})();

// ---- section FIX
const fixCasesSection: ParityCase[] = (() => {
  /**
   * Section FIX: the repo's five real-shaped fixtures (`__tests__/fixtures/*.chara`) read whole, as
   * real-producer evidence for the plan rows the other sections pin only synthetically.
   *
   * Producer shapes, stated only from what each file shows:
   * - duskwight-heterochromia: no TypeName; writes IsExtendedAppearanceValid true, null SkinGloss /
   *   HairGloss / BustScale and null Author / Description / Version / Base64Image / Tags placeholders —
   *   the shape compatibility.md:57 attributes to Brio (the host's parser test calls it "old Anamnesis").
   * - hrothgar-helions, wildwood-facepaint: no TypeName (unlabeled); same placeholders and flag, but
   *   gloss vectors are written.
   * - lalafell-dunesfolk, xaela-anamnesis-header: TypeName "Anamnesis Character File", no
   *   IsExtendedAppearanceValid, no Base64Image / Tags (scrubbed).
   * None is Ktisis-shaped: all five carry an extended block (compatibility.md:50, Ktisis writes none).
   * Plan row 107's "four committed real exports store Mouth 2" describes the library's own exports,
   * not these five; here only the duskwight file stores Mouth 2.
   *
   * Expected hexes come from lookup.ts (creator / shader) and from decoding the stored floats by hand
   * (round(sqrt(c) * 255)); composites from the linear-light formula (color-math.ts:96-108,
   * chara-resolver.ts:156-162), computed in a scratch script, never by calling either implementation.
   */
  const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
  const fixture = (name: string): Record<string, unknown> =>
    JSON.parse(readFileSync(join(fixturesDir, name), 'utf8')) as Record<string, unknown>;

  const DUSK = fixture('duskwight-heterochromia.chara');
  const HROTH = fixture('hrothgar-helions.chara');
  const LALA = fixture('lalafell-dunesfolk.chara');
  const WILD = fixture('wildwood-facepaint.chara');
  const XAELA = fixture('xaela-anamnesis-header.chara');

  const ROW_DISABLED = 'Explicitly disabled highlight or face-paint control';
  const ROW_CROSSED = 'Crossed eyes (every current Brio export)';
  const ROW_LIP_BIT = 'Lip-color bit (`0x80` of `Mouth`) clear on a lip palette index';
  const ROW_OWNERSHIP =
    'Ownership row: gamma-2 decoding, creator/shader comparison, activation, lip composition (plan line 88)';
  const ROW_IDENTITY =
    'Task 1 step 2: identity aliases, both dye channels, worn/empty gear, Glasses (real export)';

  /** Placeholders the Brio-shaped / unlabeled exports write: Tags is not a known field, Base64Image null is omitted. */
  const PLACEHOLDER_ISSUES = [
    { code: 'UNSUPPORTED_FIELD', path: ['Tags'] },
    { code: 'IMAGE_OMITTED', path: ['Base64Image'] },
  ];

  const fixCases: ParityCase[] = [
    // ------------------------------------------------------------ duskwight-heterochromia
    {
      id: 'FIX-01',
      title: 'duskwight export: identity, worn/empty gear, both dye channels, Glasses 0',
      planRow: ROW_IDENTITY,
      doc: DUSK,
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Producer shape: no TypeName, Brio-shaped (null glosses/BustScale, flag true). Tribe Duskwight gives canonical Elezen on both sides (required tribe -> race/palette contract). Gear walks GEAR_SLOTS on the host; the library keeps every lane as uint16 evidence, the empty off-hand is status empty with a zero model, and dye 0 is a valid 0 (inspect.ts:186-210). Glasses {GlassesId:0}: host null, library valid 0, mapped to null by the contract (plan line 169). Real-producer evidence: "Tags": null is not a known field (UNSUPPORTED_FIELD at ["Tags"], read.ts:330-336) and "Base64Image": null is omitted with IMAGE_OMITTED (read.ts:246-274).',
      lib: {
        identity: {
          canonicalRace: 'Elezen',
          raceSource: 'tribe',
          race: { state: 'valid', value: 'Elezen' },
          tribe: { state: 'valid', value: 'Duskwight' },
          gender: { state: 'valid', value: 'Feminine' },
        },
        equipment: {
          MainHand: {
            status: 'worn',
            model: { set: 5603, base: 9, variant: 3 },
            dye1: { state: 'valid', value: 0 },
          },
          OffHand: { status: 'empty', model: { set: 0, base: 0, variant: 0 } },
          HeadGear: {
            status: 'worn',
            model: { base: 813, variant: 2 },
            dye1: { state: 'valid', value: 92 },
            dye2: { state: 'valid', value: 1 },
          },
          Body: {
            status: 'worn',
            model: { base: 876, variant: 1 },
            dye2: { state: 'valid', value: 92 },
          },
          Feet: {
            status: 'worn',
            model: { base: 6135, variant: 1 },
            dye1: { state: 'valid', value: 97 },
          },
          RightRing: { status: 'worn', model: { base: 53, variant: 1 } },
        },
        facewear: { state: 'valid', value: 0 },
        hasEmbeddedImage: true,
        embeddedImageTypes: ['null'],
        issues: PLACEHOLDER_ISSUES,
        noIssueCodes: [
          'RACE_TRIBE_MISMATCH',
          'INVALID_FIELD',
          'INCOMPLETE_MODEL',
          'INVALID_IMAGE_TYPE',
        ],
      },
    },
    {
      id: 'FIX-02',
      title: 'duskwight export: crossed heterochromia eye floats are un-crossed by both',
      planRow: ROW_CROSSED,
      doc: DUSK,
      classification: 'preserved',
      note: 'The fixture DOES carry IsExtendedAppearanceValid true and its block is not all zero, so the library eyes are live. LeftEyeColor decodes to #DCBA6C (eye 42) beside LEyeColor 169 (#87C0A3), RightEyeColor to #87C0A3 beside REyeColor 42: each lands on the other eye at dE 0 and on its own at dE 26.5. Host uncrossEyeFloats swaps the floats (chara-resolver.ts:173-202); library pairEyes sees bothCrossed, swaps effectiveExtendedHex silently with one HISTORICAL_EYE_PAIR_SWAP and no warning, and keeps extendedHex original (resolve.ts:100-157, api.md:124). The effective preview matches the host floatHex; the adapter must read effectiveExtendedHex, not extendedHex.',
      lib: {
        eyesShareIndex: false,
        corrections: 1,
        noIssueCodes: ['EYE_PAIRING_INFERRED', 'EYE_PAIRING_UNCONFIRMED'],
        slots: {
          leftEye: {
            active: true,
            extendedActive: true,
            extendedHex: '#DCBA6C',
            effectiveExtendedHex: '#87C0A3',
            correction: 'historicalEyePairSwap',
            creatorHex: '#87C0A3',
            shaderHex: '#87C0A3',
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: '#87C0A3',
            deltaE: { max: 1 },
          },
          rightEye: {
            active: true,
            extendedActive: true,
            extendedHex: '#87C0A3',
            effectiveExtendedHex: '#DCBA6C',
            correction: 'historicalEyePairSwap',
            creatorHex: '#DCBA6C',
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: '#DCBA6C',
            deltaE: { max: 1 },
          },
        },
      },
    },
    {
      id: 'FIX-03',
      title:
        'duskwight export: four custom off-grid colors judged against the shader, FacePaint 0 inactive',
      planRow: `${ROW_OWNERSHIP}; ${ROW_DISABLED}`,
      doc: DUSK,
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Live floats far from the shader entry go off grid on both sides (threshold 6): hair #BF6F69 vs shader #302620 (dE 37.4), highlights #7F4367 vs #B69458 (45.8), skin #F0D5DE vs shader #FCFCFD (13.5; the creator swatch is #FEE6D4), limbal #5A1322 vs #000000 (25.6); the displayed color is the float (resolve.ts:416-424, chara-resolver.ts:398-407). Limbal is a tattoo on an Elezen. FacePaint 0 inerts FacePaintColor 55 on both sides whatever else is stored (resolve.ts:359-368); the library keeps the creator evidence #41111C. Blocking: FacePaint 0 staying inactive is a required contract.',
      lib: {
        slots: {
          hair: {
            interpretation: 'offGrid',
            reason: 'offGrid',
            creatorHex: '#4A2B12',
            shaderHex: '#302620',
            displayHex: '#BF6F69',
            deltaE: { min: 6 },
          },
          highlights: {
            active: true,
            interpretation: 'offGrid',
            reason: 'offGrid',
            creatorHex: '#B69458',
            displayHex: '#7F4367',
            deltaE: { min: 6 },
          },
          skin: {
            interpretation: 'offGrid',
            reason: 'offGrid',
            creatorHex: '#FEE6D4',
            shaderHex: '#FCFCFD',
            displayHex: '#F0D5DE',
            deltaE: { min: 6 },
          },
          limbal: {
            kind: 'tattoo',
            interpretation: 'offGrid',
            reason: 'offGrid',
            creatorHex: '#262626',
            shaderHex: '#000000',
            displayHex: '#5A1322',
            deltaE: { min: 6 },
          },
          facePaint: {
            active: false,
            interpretation: 'inactive',
            reason: 'facePaintNone',
            displayHex: null,
            creatorHex: '#41111C',
          },
        },
      },
    },
    {
      id: 'FIX-04',
      title: 'duskwight export: Mouth 2 (lip bit clear) disables a live lip with opacity 0.6',
      planRow: ROW_LIP_BIT,
      doc: DUSK,
      classification: 'intentional',
      blocksIfDiverges: true,
      note: 'Plan row 107, in the "overrides a live non-zero opacity" clause: Mouth 2 has bit 0x80 clear on an Elezen, so lipEnabled is false and the library lip is inactive/lipDisabled with no display and no composite (resolve.ts:192-201, 359-368), keeping creatorHex #621C33 and alpha 0.6 as evidence. The host never reads Mouth: index 53 wins (float #340A1C equals the lipsDark shader entry) and composites #621C33 over the off-grid skin float #F0D5DE at 0.6 = #AE8F98. Blocking: lip-bit-clear staying inactive is a required contract.',
      lib: {
        slots: {
          lip: {
            active: false,
            indexMeaning: 'color',
            interpretation: 'inactive',
            reason: 'lipDisabled',
            displayHex: null,
            creatorHex: '#621C33',
            shaderHex: '#340A1C',
            extendedHex: '#340A1C',
            extendedActive: false,
            variant: 'dark',
            sheetIndex: 53,
            alpha: 0.6,
            lipCompositeHex: null,
          },
        },
      },
    },

    // ------------------------------------------------------------ hrothgar-helions
    {
      id: 'FIX-05',
      title: 'hrothgar export: plural Helions, weapon pair, empty Hands/accessories, Glasses 0',
      planRow: ROW_IDENTITY,
      doc: HROTH,
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Producer shape: no TypeName (unlabeled), flag true, gloss vectors written. The file writes the plural "Helions" (not the legacy Helion alias): both read Hrothgar with no RACE_TRIBE_MISMATCH against Race "Hrothgar" (required tribe -> race contract). Both weapons are worn triples; Hands and the five accessories are 0/0, which the host skips (isWornCharaModel) and the library keeps as status empty with valid zero lanes and dyes (inspect.ts:202-210). Same Tags / Base64Image placeholders as the duskwight export.',
      lib: {
        identity: {
          canonicalRace: 'Hrothgar',
          raceSource: 'tribe',
          race: { state: 'valid', value: 'Hrothgar' },
          tribe: { state: 'valid', value: 'Helions', raw: 'Helions' },
          gender: { state: 'valid', value: 'Feminine' },
        },
        equipment: {
          MainHand: { status: 'worn', model: { set: 301, base: 31, variant: 1 } },
          OffHand: { status: 'worn', model: { set: 351, base: 31, variant: 1 } },
          Body: {
            status: 'worn',
            model: { base: 436, variant: 1 },
            dye1: { state: 'valid', value: 105 },
          },
          Hands: {
            status: 'empty',
            model: { base: 0, variant: 0 },
            dye1: { state: 'valid', value: 0 },
            dye2: { state: 'valid', value: 0 },
          },
          Ears: { status: 'empty', model: { base: 0, variant: 0 } },
        },
        facewear: { state: 'valid', value: 0 },
        hasEmbeddedImage: true,
        embeddedImageTypes: ['null'],
        issues: PLACEHOLDER_ISSUES,
        noIssueCodes: ['RACE_TRIBE_MISMATCH', 'INVALID_FIELD', 'INCOMPLETE_MODEL'],
      },
    },
    {
      id: 'FIX-06',
      title:
        'hrothgar export: fur-pattern lip with a live alpha-0 float is noLip; EnableHighlights false is inactive',
      planRow: `Task 1 step 2: Hrothgar fur; ${ROW_DISABLED}`,
      doc: HROTH,
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Lip: LipsToneFurPattern 35 is a fur pattern on Hrothgar. The live MouthColor "0, 0, 0, 0" (block not all zero, flag true) gives alpha 0: the host noLip check runs first (chara-resolver.ts:345); the library lip is active (Hrothgar ignores the bit, so Mouth 131 here does NOT count as bit-set coverage), extendedActive true, and the noLip branch runs before the furPattern branch (resolve.ts:370-380), so reason noLip, never furPattern, with no creator request (resolve.ts:282-285). Highlights: EnableHighlights false inerts index 1 on both; the library keeps creator #E7E7E7 / shader #E4E4E4 and the float #BA989E as evidence. Blocking: EnableHighlights false staying inactive is a required contract.',
      lib: {
        slots: {
          lip: {
            active: false,
            indexMeaning: 'furPattern',
            interpretation: 'inactive',
            reason: 'noLip',
            displayHex: null,
            creatorHex: null,
            extendedHex: '#000000',
            extendedActive: true,
            alpha: 0,
            lipCompositeHex: null,
          },
          highlights: {
            active: false,
            interpretation: 'inactive',
            reason: 'highlightsDisabled',
            displayHex: null,
            creatorHex: '#E7E7E7',
            shaderHex: '#E4E4E4',
            extendedHex: '#BA989E',
            extendedActive: false,
          },
        },
      },
    },
    {
      id: 'FIX-07',
      title:
        'hrothgar export: live floats on the shader entries read as the creator swatch; FacePaint 106 active (light sheet)',
      planRow: ROW_OWNERSHIP,
      doc: HROTH,
      classification: 'preserved',
      note: 'Every live float equals its SHADER entry (dE 0), so both sides keep the palette and show the creator swatch. Limbal is the verdict discriminator (creator #976632 against float #85521C is dE 7.2, so a float judged against the creator would land off grid); skin discriminates only through the deltaE max 1 assertion (creator #6A4D45 against float #74544B is dE 2.9, under the threshold of 6). Eyes share index 165. FacePaint 106 has non-zero low bits, so face paint is active (resolve.ts:217-223); FacePaintColor 171 is light, in-sheet 43, #A14138, with no shader request.',
      lib: {
        eyesShareIndex: true,
        corrections: 0,
        slots: {
          leftEye: {
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: '#1F4F43',
            correction: null,
          },
          rightEye: {
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: '#1F4F43',
            correction: null,
          },
          hair: {
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: '#BA989E',
            deltaE: { max: 1 },
          },
          skin: {
            interpretation: 'palette',
            reason: 'paletteAgreement',
            creatorHex: '#6A4D45',
            shaderHex: '#74544B',
            extendedHex: '#74544B',
            displayHex: '#6A4D45',
            deltaE: { max: 1 },
          },
          limbal: {
            kind: 'tattoo',
            interpretation: 'palette',
            reason: 'paletteAgreement',
            shaderHex: '#85521C',
            displayHex: '#976632',
            deltaE: { max: 1 },
          },
          facePaint: {
            active: true,
            interpretation: 'palette',
            reason: 'paletteOnly',
            variant: 'light',
            sheetIndex: 43,
            creatorHex: '#A14138',
            shaderHex: null,
            displayHex: '#A14138',
          },
        },
      },
    },

    // ------------------------------------------------------------ lalafell-dunesfolk
    {
      id: 'FIX-08',
      title: 'Anamnesis lalafell export: Race "Lalafel", producer label, no flag, gear and Glasses',
      planRow: ROW_IDENTITY,
      doc: LALA,
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Producer shape: TypeName "Anamnesis Character File", no IsExtendedAppearanceValid (Anamnesis never writes it, api.md:118). The tribe decides the race on both sides (required tribe -> race contract); the drifted "Lalafel" is the library alias for Lalafell (inspect.ts:61-65) with the raw kept and no RACE_TRIBE_MISMATCH. No Tags or Base64Image key, so no UNSUPPORTED_FIELD and no image. Gear: weapon with both dye channels, empty off-hand and LeftRing (status empty), RightRing worn.',
      lib: {
        identity: {
          canonicalRace: 'Lalafell',
          raceSource: 'tribe',
          tribe: { state: 'valid', value: 'Dunesfolk' },
          gender: { state: 'valid', value: 'Feminine' },
        },
        equipment: {
          MainHand: {
            status: 'worn',
            model: { set: 801, base: 89, variant: 1 },
            dye1: { state: 'valid', value: 86 },
            dye2: { state: 'valid', value: 6 },
          },
          OffHand: { status: 'empty', model: { set: 0, base: 0, variant: 0 } },
          Body: {
            status: 'worn',
            model: { base: 6208, variant: 1 },
            dye2: { state: 'valid', value: 64 },
          },
          LeftRing: { status: 'empty', model: { base: 0, variant: 0 } },
          RightRing: { status: 'worn', model: { base: 58, variant: 2 } },
        },
        facewear: { state: 'valid', value: 0 },
        hasEmbeddedImage: false,
        embeddedImageTypes: [],
        noIssueCodes: [
          'UNSUPPORTED_FIELD',
          'RACE_TRIBE_MISMATCH',
          'IMAGE_OMITTED',
          'INVALID_FIELD',
          'INCOMPLETE_MODEL',
        ],
      },
    },
    {
      id: 'FIX-09',
      title:
        'Anamnesis lalafell export: without the flag the index wins on every slot; FacePaint 129 stays active',
      planRow:
        'FacePaint mirror flag alone (129 stays active); extended block not live without the flag (api.md:118, compatibility.md:53)',
      doc: LALA,
      classification: 'preserved',
      note: 'No IsExtendedAppearanceValid: the host keeps the index and flags indexWinNote extendedMissing (chara-resolver.ts:408-413); the library keeps the stored block as inactive evidence, interpretation palette, reason extendedInactive, displayHex = creator (resolve.ts:425-432). The stored floats equal the shader entries (hair #853D53 vs creator #822C3C, skin #CDB7A1 vs #CE9E81, limbal #C6C6C6 vs #F7F7F7) but are never compared. FacePaint 129 = mirror bit + style 1, active on both (plan row 108); FacePaintColor 187 is light, in-sheet 59, #682668. Limbal is a tattoo on a Lalafell. The lip is FIX-10.',
      lib: {
        eyesShareIndex: true,
        corrections: 0,
        noIssueCodes: ['AMBIGUOUS_ZERO_BLOCK'],
        slots: {
          leftEye: {
            active: true,
            extendedActive: false,
            extendedHex: '#985726',
            interpretation: 'palette',
            reason: 'extendedInactive',
            displayHex: '#985726',
            deltaE: null,
          },
          rightEye: {
            interpretation: 'palette',
            reason: 'extendedInactive',
            displayHex: '#985726',
          },
          hair: {
            interpretation: 'palette',
            reason: 'extendedInactive',
            creatorHex: '#822C3C',
            displayHex: '#822C3C',
          },
          highlights: {
            active: true,
            interpretation: 'palette',
            reason: 'extendedInactive',
            displayHex: '#984154',
          },
          skin: {
            interpretation: 'palette',
            reason: 'extendedInactive',
            displayHex: '#CE9E81',
            deltaE: null,
          },
          limbal: {
            kind: 'tattoo',
            interpretation: 'palette',
            reason: 'extendedInactive',
            displayHex: '#F7F7F7',
          },
          facePaint: {
            active: true,
            interpretation: 'palette',
            reason: 'paletteOnly',
            variant: 'light',
            sheetIndex: 59,
            displayHex: '#682668',
          },
        },
      },
    },
    {
      id: 'FIX-10',
      title:
        'Anamnesis lalafell export: Mouth 128 keeps the light lip; host composites a non-live opacity, library does not',
      planRow:
        'Unlisted: lip alpha > 0 with extended data not live (ruling 6); lip-color bit set (Mouth 128)',
      doc: LALA,
      classification: 'intentional',
      note: 'UNPLANNED: on a real Anamnesis export the host composites the lip although the float is not live (chara-resolver.ts:422 tests only alpha > 0): #804995 over skin #CE9E81 at 0.2509804 = #BE8F86; the library composes only from live extended data (resolve.ts:440-445), so lipComposite is null while alpha stays as evidence. The maintainer must decide whether non-live Anamnesis opacity may tint the preview; the Task 3 adapter must not invent blendHex. Preserved part: Mouth 128 sets bit 0x80, so the light lip (186, in-sheet 58, #804995) stays active on both (plan row 110), shown from the creator with reason extendedInactive.',
      lib: {
        slots: {
          lip: {
            active: true,
            indexMeaning: 'color',
            variant: 'light',
            sheetIndex: 58,
            interpretation: 'palette',
            reason: 'extendedInactive',
            creatorHex: '#804995',
            shaderHex: '#4A2F60',
            extendedHex: '#4A2F60',
            extendedActive: false,
            displayHex: '#804995',
            alpha: 0.2509804,
            lipCompositeHex: null,
          },
        },
      },
    },
    {
      id: 'FIX-11',
      title:
        'Anamnesis lalafell export, tagged provider: light lip and light face paint request the light sheets',
      planRow: 'Task 1 step 2: dark/light lips (real export; palette-tagged provider)',
      doc: LALA,
      provider: 'tagged',
      classification: 'preserved',
      note: 'The host light and dark lip/face-paint sheets hold identical colors, so only a tagged provider shows which palette was asked for. Lip 186 is light, in-sheet 58 (0x3A): creator lipsLight #05003A, shader reference always lipsDark #04FF3A (resolve.ts:288-349). Face paint 187 is light, in-sheet 59 (0x3B): creator facePaintLight #07003B, no shader request. The host picks the same light sheets (chara-resolver.ts:237-289) at the same in-sheet indices. The non-live block keeps both on the creator.',
      lib: {
        slots: {
          lip: {
            variant: 'light',
            sheetIndex: 58,
            creatorHex: '#05003A',
            shaderHex: '#04FF3A',
            displayHex: '#05003A',
            interpretation: 'palette',
          },
          facePaint: {
            active: true,
            variant: 'light',
            sheetIndex: 59,
            creatorHex: '#07003B',
            shaderHex: null,
            displayHex: '#07003B',
            interpretation: 'palette',
          },
        },
      },
    },

    // ------------------------------------------------------------ wildwood-facepaint
    {
      id: 'FIX-12',
      title: 'wildwood export: identity, gear with one dyed channel per piece, Glasses 0',
      planRow: ROW_IDENTITY,
      doc: WILD,
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Producer shape: no TypeName (unlabeled), flag true, gloss vectors written. Tribe Wildwood gives canonical Elezen on both sides (required tribe -> race contract). Eleven worn pieces, only HeadGear and Feet dyed (102); the library keeps undyed channels as valid 0, never invalid (inspect.ts:186-187). Same Tags / Base64Image placeholders as the duskwight export.',
      lib: {
        identity: {
          canonicalRace: 'Elezen',
          raceSource: 'tribe',
          tribe: { state: 'valid', value: 'Wildwood' },
          gender: { state: 'valid', value: 'Feminine' },
        },
        equipment: {
          MainHand: { status: 'worn', model: { set: 501, base: 78, variant: 2 } },
          OffHand: { status: 'empty', model: { set: 0, base: 0, variant: 0 } },
          HeadGear: {
            status: 'worn',
            model: { base: 633, variant: 5 },
            dye1: { state: 'valid', value: 102 },
            dye2: { state: 'valid', value: 0 },
          },
          Body: {
            status: 'worn',
            model: { base: 686, variant: 1 },
            dye1: { state: 'valid', value: 0 },
          },
        },
        facewear: { state: 'valid', value: 0 },
        hasEmbeddedImage: true,
        embeddedImageTypes: ['null'],
        issues: PLACEHOLDER_ISSUES,
        noIssueCodes: ['RACE_TRIBE_MISMATCH', 'INVALID_FIELD', 'INCOMPLETE_MODEL'],
      },
    },
    {
      id: 'FIX-13',
      title:
        'wildwood export: live floats agree with the palette on six slots; FacePaint 4 active (light sheet)',
      planRow: ROW_OWNERSHIP,
      doc: WILD,
      classification: 'preserved',
      note: 'Every live float equals its shader entry (dE 0): eyes #477C8F, hair #3E2B22 (creator #552813), highlights #E4E4E4 (creator #E7E7E7, enabled), skin #E9E3D9 (creator #F0CDB4), limbal #85521C (creator #976632). Both keep the palette and show the creator. FacePaint 4 (bit clear, style 4) is active on both (resolve.ts:217-223); FacePaintColor 171 is light, in-sheet 43, #A14138.',
      lib: {
        eyesShareIndex: true,
        corrections: 0,
        slots: {
          leftEye: {
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: '#477C8F',
            deltaE: { max: 1 },
          },
          rightEye: {
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: '#477C8F',
          },
          hair: {
            interpretation: 'palette',
            reason: 'paletteAgreement',
            shaderHex: '#3E2B22',
            displayHex: '#552813',
            deltaE: { max: 1 },
          },
          highlights: {
            active: true,
            interpretation: 'palette',
            reason: 'paletteAgreement',
            shaderHex: '#E4E4E4',
            displayHex: '#E7E7E7',
          },
          skin: {
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: '#F0CDB4',
            deltaE: { max: 1 },
          },
          limbal: {
            kind: 'tattoo',
            interpretation: 'palette',
            reason: 'paletteAgreement',
            displayHex: '#976632',
          },
          facePaint: {
            active: true,
            interpretation: 'palette',
            reason: 'paletteOnly',
            variant: 'light',
            sheetIndex: 43,
            displayHex: '#A14138',
          },
        },
      },
    },
    {
      id: 'FIX-14',
      title:
        'wildwood export: Mouth 131 (lip bit set) with a live 0.6 opacity composites the same on both',
      planRow: `Lip-color bit set (Mouth 131) on a lip palette index; ${ROW_OWNERSHIP}`,
      doc: WILD,
      classification: 'preserved',
      note: 'Mouth 131 has bit 0x80 set on an Elezen, so the library lip is active (resolve.ts:192-201); the host never reads Mouth. Index 43 (#A14138) agrees with the live float #612827 = lipsDark shader 43 (dE 0), so the lip shows the creator, and both composite it over the skin creator #F0CDB4 at 0.6 = #C68F7D (resolve.ts:438-453; chara-resolver.ts:419-430; the two formulas agree here because every channel is in range).',
      lib: {
        slots: {
          lip: {
            active: true,
            indexMeaning: 'color',
            interpretation: 'palette',
            reason: 'paletteAgreement',
            creatorHex: '#A14138',
            shaderHex: '#612827',
            extendedHex: '#612827',
            extendedActive: true,
            displayHex: '#A14138',
            alpha: 0.6,
            deltaE: { max: 1 },
            lipCompositeHex: '#C68F7D',
          },
        },
      },
    },

    // ------------------------------------------------------------ xaela-anamnesis-header
    {
      id: 'FIX-15',
      title:
        'Anamnesis xaela export: Race "AuRa", producer label, no flag, gear with second dye channels',
      planRow: ROW_IDENTITY,
      doc: XAELA,
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'Producer shape: TypeName "Anamnesis Character File", no IsExtendedAppearanceValid. Tribe Xaela gives the race on both sides (required tribe -> race contract): host AuRa, library canonical "Au Ra", mapped to AuRa by the contract (plan line 167); Race "AuRa" is the library alias (inspect.ts:61-65), raw kept, no RACE_TRIBE_MISMATCH. Body and Feet carry dye 113 on channel 2. No Tags or Base64Image key.',
      lib: {
        identity: {
          canonicalRace: 'Au Ra',
          raceSource: 'tribe',
          tribe: { state: 'valid', value: 'Xaela' },
          gender: { state: 'valid', value: 'Feminine' },
        },
        equipment: {
          MainHand: {
            status: 'worn',
            model: { set: 801, base: 30, variant: 2 },
            dye1: { state: 'valid', value: 6 },
          },
          OffHand: { status: 'empty', model: { set: 0, base: 0, variant: 0 } },
          Feet: {
            status: 'worn',
            model: { base: 6195, variant: 1 },
            dye1: { state: 'valid', value: 6 },
            dye2: { state: 'valid', value: 113 },
          },
        },
        facewear: { state: 'valid', value: 0 },
        hasEmbeddedImage: false,
        noIssueCodes: [
          'UNSUPPORTED_FIELD',
          'RACE_TRIBE_MISMATCH',
          'IMAGE_OMITTED',
          'INVALID_FIELD',
          'INCOMPLETE_MODEL',
        ],
      },
    },
    {
      id: 'FIX-16',
      title:
        'Anamnesis xaela export: EnableHighlights false inactive, Au Ra limbal ring, index wins without the flag',
      planRow: `${ROW_DISABLED}; extended block not live without the flag (api.md:118)`,
      doc: XAELA,
      classification: 'preserved',
      blocksIfDiverges: true,
      note: 'EnableHighlights false inerts Highlights 84 on both (plan row 106); the library keeps creator #893C21 and the stored float #121212 as evidence (resolve.ts:359-368). Without the flag the other slots keep the index (host extendedMissing, library extendedInactive): eyes #8C87B9, hair #121212, skin #886250 (float #87776D unused). LimbalEyes is a limbal ring on an Au Ra on both sides (kind limbal), #262626 with a black stored float. LimbalRingColor "0, 0, 0" alone is not an all-zero block. FacePaint 3 is active; FacePaintColor 7 is dark #000000. Blocking: EnableHighlights false staying inactive is a required contract.',
      lib: {
        eyesShareIndex: true,
        noIssueCodes: ['AMBIGUOUS_ZERO_BLOCK'],
        slots: {
          highlights: {
            active: false,
            interpretation: 'inactive',
            reason: 'highlightsDisabled',
            displayHex: null,
            creatorHex: '#893C21',
            extendedHex: '#121212',
            extendedActive: false,
          },
          leftEye: { interpretation: 'palette', reason: 'extendedInactive', displayHex: '#8C87B9' },
          hair: { interpretation: 'palette', reason: 'extendedInactive', displayHex: '#121212' },
          skin: { interpretation: 'palette', reason: 'extendedInactive', displayHex: '#886250' },
          limbal: {
            kind: 'limbal',
            interpretation: 'palette',
            reason: 'extendedInactive',
            extendedHex: '#000000',
            displayHex: '#262626',
          },
          facePaint: {
            active: true,
            interpretation: 'palette',
            reason: 'paletteOnly',
            variant: 'dark',
            sheetIndex: 7,
            displayHex: '#000000',
          },
        },
      },
    },
    {
      id: 'FIX-17',
      title:
        'Anamnesis xaela export: Mouth 129 keeps the lip; host composites a non-live 0.706 opacity, library does not',
      planRow:
        'Unlisted: lip alpha > 0 with extended data not live (ruling 6); lip-color bit set (Mouth 129)',
      doc: XAELA,
      classification: 'intentional',
      note: 'UNPLANNED: the same non-live composite difference as FIX-10 on the second Anamnesis export: the host composites lip #000000 over skin #886250 at 0.7058824 = #4C352A (chara-resolver.ts:422); the library gives no lipComposite without live extended data (resolve.ts:440-445). Same maintainer decision. Preserved part: Mouth 129 has bit 0x80 set with low bit 1 (a mask test, not == 128), so the lip stays active and shows the dark entry 7 #000000 from the creator, reason extendedInactive.',
      lib: {
        slots: {
          lip: {
            active: true,
            indexMeaning: 'color',
            variant: 'dark',
            sheetIndex: 7,
            interpretation: 'palette',
            reason: 'extendedInactive',
            creatorHex: '#000000',
            extendedHex: '#000000',
            extendedActive: false,
            displayHex: '#000000',
            alpha: 0.7058824,
            lipCompositeHex: null,
          },
        },
      },
    },
  ];

  return fixCases;
})();

const CASES: ParityCase[] = [
  ...idnCasesSection,
  ...colCasesSection,
  ...geaCasesSection,
  ...actCasesSection,
  ...extCasesSection,
  ...envCasesSection,
  ...fixCasesSection,
];

registerIntegrityTests(CASES);
registerLibraryTests(CASES);
