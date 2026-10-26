/**
 * Test factories for the xivcharakit-backed `.chara` projection (`ImportedCharaSlot` /
 * `ImportedCharaCharacter`), for suites that hand-build a session instead of loading a file.
 *
 * Defaults describe a confirmed-active palette color, the plainest matchable state. `matchHex`
 * follows the shared host rule unless the override sets it: it equals `displayHex` only for
 * `active === true`, an interpretation other than `inactive` / `unresolved`, and a non-null
 * `displayHex`. So an override such as `{ active: null }` yields an unknown-activation slot with
 * `matchHex: null` without restating it, and a built character passes the page's own validator
 * (`validateImportedCharacter`), as a worker answer would.
 */
import type { ImportedCharaCharacter, ImportedCharaSlot } from '@xivdyetools/core';

type SlotName = ImportedCharaSlot['slot'];

/** The projection's slot order (core `chara-library.ts`). */
export const IMPORTED_SLOT_ORDER: readonly SlotName[] = [
  'leftEye',
  'rightEye',
  'hair',
  'highlights',
  'skin',
  'limbal',
  'lip',
  'facePaint',
];

const DEFAULT_HEX = '#6A4F3B';

/** The shared host matching rule (core adapter, page validator). */
function matchHexOf(slot: Omit<ImportedCharaSlot, 'matchHex'>): string | null {
  return slot.active === true &&
    slot.interpretation !== 'inactive' &&
    slot.interpretation !== 'unresolved' &&
    slot.displayHex !== null
    ? slot.displayHex
    : null;
}

/**
 * One appearance slot. Without overrides: the left eye, palette index 42 (`R6·C3`), active, with
 * the creator, shader and display colors all `#6A4F3B`. `kind` follows `slot` unless overridden.
 */
export function makeImportedSlot(overrides: Partial<ImportedCharaSlot> = {}): ImportedCharaSlot {
  const slot = overrides.slot ?? 'leftEye';
  const base: Omit<ImportedCharaSlot, 'matchHex'> = {
    slot,
    kind: slot,
    index: 42,
    indexState: 'valid',
    indexMeaning: 'color',
    indexGap: false,
    sheetIndex: 42,
    variant: null,
    gridAddress: 'R6·C3',
    creatorHex: DEFAULT_HEX,
    shaderHex: DEFAULT_HEX,
    extendedHex: null,
    effectiveExtendedHex: null,
    extendedActive: false,
    active: true,
    interpretation: 'palette',
    reason: 'paletteOnly',
    deltaE: null,
    displayHex: DEFAULT_HEX,
    alpha: null,
    lipComposite: null,
    correction: null,
  };
  const merged = { ...base, ...overrides };
  return {
    ...merged,
    matchHex: 'matchHex' in overrides ? (overrides.matchHex ?? null) : matchHexOf(merged),
  };
}

export interface ImportedCharacterOverrides extends Partial<Omit<ImportedCharaCharacter, 'slots'>> {
  /**
   * Either the full slot list (used as given), or per-slot overrides merged into the default
   * eight, which keep the projection's order.
   */
  slots?: ImportedCharaSlot[] | Partial<Record<SlotName, Partial<ImportedCharaSlot>>>;
}

/**
 * A projected character: a Seeker of the Sun female from an Anamnesis file, no nickname, eight
 * default slots (each `makeImportedSlot({ slot })`), no gear, no facewear and no issues.
 */
export function makeImportedCharacter(
  overrides: ImportedCharacterOverrides = {}
): ImportedCharaCharacter {
  const { slots, ...rest } = overrides;
  const builtSlots = Array.isArray(slots)
    ? slots
    : IMPORTED_SLOT_ORDER.map((slot) => makeImportedSlot({ slot, ...(slots?.[slot] ?? {}) }));
  return {
    producer: 'Anamnesis Character File',
    race: "Miqo'te",
    tribe: 'SeekerOfTheSun',
    gender: 'Female',
    nickname: null,
    extendedValid: false,
    extendedDeclared: false,
    eyesShareIndex: false,
    gearDyes: [],
    gearModels: [],
    glassesId: null,
    issues: [],
    ...rest,
    slots: builtSlots,
  };
}
