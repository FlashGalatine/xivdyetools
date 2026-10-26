/**
 * The xivcharakit-backed `.chara` import: bounded reading, appearance interpretation against the
 * host palettes, and a projection into the application's `ImportedCharaCharacter`.
 *
 * The library owns JSON admission, field states, gamma decoding, activation, lip composition and
 * the eye-pair correction. This module owns only the host concerns: the 8 KiB admission cap, the
 * host vocabulary (`AuRa`, `Male`/`Female`), the matching policy (`matchHex`), dye badges from the
 * offline database, and a projection that carries no raw document, image or unknown field.
 */

import {
  EQUIPMENT_SLOTS,
  inspectChara,
  readChara,
  type CharaInspection,
  type Issue,
} from 'xivcharakit';
import {
  resolveAppearance,
  type AppearanceSlot,
  type AppearanceSlotInspection,
} from 'xivcharakit/appearance';
import type { Gender, Race, SubRace } from '@xivdyetools/types';
import type { CharacterColorService } from '../CharacterColorService.js';
import { MAX_CHARA_FILE_BYTES } from './chara-parser.js';
import type { CharaGearModel } from './chara-models.js';
import type { StainIdLookup, ResolvedGearDye } from './chara-resolver.js';
import { createCharaPaletteProvider } from './chara-palette-provider.js';
import type {
  CharaPaletteProvider,
  CharaImportIssue,
  ImportedCharaCharacter,
  ImportedCharaSlot,
} from './chara-library-types.js';

/** Eight-slot order of the projection. */
const SLOT_ORDER: readonly AppearanceSlot[] = [
  'leftEye',
  'rightEye',
  'hair',
  'highlights',
  'skin',
  'limbal',
  'lip',
  'facePaint',
];

/** Local nickname / producer labels, in UTF-16 code units. */
const MAX_LABEL_UNITS = 256;
const MAX_ISSUES = 64;
const MAX_PATH_SEGMENTS = 32;
const MAX_PATH_INDEX = 1_000_000;

/**
 * Schema-field names a diagnostic path may carry; anything else becomes `unknown`.
 *
 * Built on first use, not at module load: a top-level `new Set([...spread])` is something a
 * bundler cannot prove side-effect free, so it kept this module (and the library entry it
 * reads `EQUIPMENT_SLOTS` from) in every consumer's shared chunk even when nothing imported
 * the facade. The web app's `modals` chunk went 902 B over its budget (PR #327 CI).
 */
let knownPathSegments: ReadonlySet<string> | undefined;
function isKnownPathSegment(segment: string): boolean {
  knownPathSegments ??= new Set([
    ...EQUIPMENT_SLOTS,
    'Height',
    'Head',
    'Hair',
    'Skintone',
    'REyeColor',
    'HairTone',
    'Highlights',
    'LimbalEyes',
    'Eyebrows',
    'LEyeColor',
    'Eyes',
    'Nose',
    'Jaw',
    'Mouth',
    'LipsToneFurPattern',
    'EarMuscleTailSize',
    'TailEarsType',
    'Bust',
    'FacePaint',
    'FacePaintColor',
    'SkinColor',
    'SkinGloss',
    'LeftEyeColor',
    'RightEyeColor',
    'LimbalRingColor',
    'HairColor',
    'HairGloss',
    'HairHighlight',
    'MouthColor',
    'Transparency',
    'MuscleTone',
    'HeightMultiplier',
    'Race',
    'Tribe',
    'Gender',
    'Age',
    'ModelType',
    'EnableHighlights',
    'FacialFeatures',
    'Glasses',
    'BustScale',
    'IsExtendedAppearanceValid',
    'TypeName',
    '$type',
    'FileExtension',
    'FileVersion',
    'Author',
    'Description',
    'Version',
    'Nickname',
    'SaveMode',
    'ObjectKind',
    'ModelBase',
    'ModelVariant',
    'ModelSet',
    'DyeId',
    'DyeId2',
    'GlassesId',
  ]);
  return knownPathSegments.has(segment);
}

const HOST_RACE: Record<string, Race> = {
  Hyur: 'Hyur',
  Elezen: 'Elezen',
  Lalafell: 'Lalafell',
  "Miqo'te": "Miqo'te",
  Roegadyn: 'Roegadyn',
  'Au Ra': 'AuRa',
  Hrothgar: 'Hrothgar',
  Viera: 'Viera',
};
const HOST_GENDER: Record<string, Gender> = { Masculine: 'Male', Feminine: 'Female' };

/**
 * Read and inspect a `.chara` document, refusing input over `MAX_CHARA_FILE_BYTES` (a string is
 * measured in UTF-8 bytes). Throws the library's `CharaInputError` for structural refusals.
 */
export function inspectCharaForTools(input: string | Uint8Array): CharaInspection {
  return inspectChara(readChara(input, { maxBytes: MAX_CHARA_FILE_BYTES }));
}

function boundedLabel(value: string | number | undefined): string | null {
  if (typeof value !== 'string') return null;
  return value.length > MAX_LABEL_UNITS ? value.slice(0, MAX_LABEL_UNITS) : value;
}

function safePath(path: readonly (string | number)[]): (string | number)[] {
  return path.slice(0, MAX_PATH_SEGMENTS).map((segment) => {
    if (typeof segment === 'number') {
      return Number.isSafeInteger(segment) && segment >= 0 && segment <= MAX_PATH_INDEX
        ? segment
        : 'unknown';
    }
    return isKnownPathSegment(segment) ? segment : 'unknown';
  });
}

function projectIssues(sources: readonly Issue[]): CharaImportIssue[] {
  const distinct: CharaImportIssue[] = [];
  const seen = new Set<string>();
  for (const issue of sources) {
    const path = safePath(issue.path);
    const key = JSON.stringify([issue.code, issue.severity, path]);
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push({ code: issue.code, severity: issue.severity, path });
  }
  if (distinct.length <= MAX_ISSUES) return distinct;
  return [
    ...distinct.slice(0, MAX_ISSUES - 1),
    { code: 'ISSUES_TRUNCATED', severity: 'warning', path: [] },
  ];
}

/** The unused 96-127 gap between the dark and light lip / face-paint sheets (COL-09/10/35). */
function isIndexGap(slot: AppearanceSlotInspection): boolean {
  if (slot.slot !== 'lip' && slot.slot !== 'facePaint') return false;
  if (slot.indexMeaning !== 'color') return false;
  const stored = slot.storedIndex;
  if (stored.state === 'absent' || stored.state === 'null') return false;
  const n = stored.raw;
  return typeof n === 'number' && Number.isFinite(n) && n >= 96 && n <= 127;
}

function isPaletteProvider(
  colors: CharacterColorService | CharaPaletteProvider,
): colors is CharaPaletteProvider {
  return typeof (colors as Partial<CharaPaletteProvider>).getColor === 'function';
}

function matchHexFor(slot: {
  active: boolean | null;
  interpretation: string;
  displayHex: string | null;
}): string | null {
  if (slot.active !== true) return null;
  if (slot.interpretation === 'inactive' || slot.interpretation === 'unresolved') return null;
  return slot.displayHex;
}

/**
 * Interpret an inspection against the host palettes and project it for the application. Consumes
 * only reader-produced inspections; retains no `document`, `fields`, `raw` or stored extended data.
 *
 * `colors` is either the host `CharacterColorService` (bridged by `createCharaPaletteProvider`) or a
 * ready palette provider (recognized by its `getColor` function), which is used as is.
 */
export async function resolveCharaForTools(
  inspection: CharaInspection,
  colors: CharacterColorService | CharaPaletteProvider,
  dyes?: StainIdLookup,
): Promise<ImportedCharaCharacter> {
  const appearance = await resolveAppearance(inspection, {
    palettes: isPaletteProvider(colors) ? colors : createCharaPaletteProvider(colors),
  });

  const slots: ImportedCharaSlot[] = SLOT_ORDER.map((name) => {
    const source = appearance.slots[name];
    // storedExtended is dropped on purpose: no stored document value travels with the projection
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { storedIndex, storedExtended: _storedExtended, ...rest } = source;
    return {
      ...rest,
      index: storedIndex.state === 'valid' ? storedIndex.value : null,
      indexState: storedIndex.state,
      matchHex: matchHexFor(rest),
      indexGap: isIndexGap(source),
    };
  });

  const gearModels: CharaGearModel[] = [];
  const gearDyes: ResolvedGearDye[] = [];
  for (const slot of EQUIPMENT_SLOTS) {
    const piece = inspection.equipment[slot];
    if (piece.status !== 'worn' || !piece.model) continue;
    const model: CharaGearModel = {
      slot,
      base: piece.model.base,
      variant: piece.model.variant,
    };
    if (piece.model.set !== undefined) model.set = piece.model.set;
    gearModels.push(model);
    for (const [channel, field] of [
      [1, piece.dye1],
      [2, piece.dye2],
    ] as const) {
      if (field.state === 'valid' && field.value > 0) {
        gearDyes.push({
          slot,
          channel,
          stainId: field.value,
          dye: dyes?.getByStainId(field.value) ?? null,
        });
      }
    }
  }

  const { identity } = inspection;
  const tribe = identity.tribe.state === 'valid' ? (identity.tribe.value as SubRace) : null;
  const gender =
    identity.gender.state === 'valid' ? (HOST_GENDER[identity.gender.value] ?? null) : null;
  const flag = inspection.extended.IsExtendedAppearanceValid;
  const glasses = inspection.facewear;

  return {
    producer: boundedLabel(inspection.metadata.TypeName.value),
    race: identity.canonicalRace ? (HOST_RACE[identity.canonicalRace] ?? null) : null,
    tribe,
    gender,
    nickname: boundedLabel(inspection.metadata.Nickname.value),
    extendedValid: flag.state === 'valid' && flag.value === true,
    extendedDeclared: flag.state !== 'absent',
    slots,
    eyesShareIndex: appearance.eyesShareIndex,
    gearDyes,
    gearModels,
    glassesId: glasses.state === 'valid' && glasses.value > 0 ? glasses.value : null,
    issues: projectIssues([...inspection.issues, ...appearance.issues]),
  };
}
