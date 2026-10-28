/**
 * The message contract between the page and the `.chara` inspection worker.
 *
 * A structured-clone message is its own trust boundary, separate from core's projection, so the
 * page re-validates every answer before adopting it. The validator works on an allowlist: a result
 * carrying any field the projection never produces (a raw document, stored extended floats, an
 * unknown key) is rejected whole, never stripped, because a worker that leaks raw data is defective.
 *
 * Structured clone keeps more than JSON does: an array's non-index properties survive it, and so do
 * holes. So every record must hold exactly its allowlisted own data properties (no accessor, no
 * symbol, no non-enumerable extra), every array must be dense and index-only, and the page adopts
 * a freshly built DTO assembled from values read exactly once, never the received object.
 *
 * The worker holds no palette or dye data. While it inspects, it asks the page for each palette
 * color (`palette` -> `palette-result` / `palette-error`, at most `CHARA_PALETTE_REQUEST_CAP` per
 * inspection), and it sends every dye badge as `dye: null`; the page attaches the dyes after
 * validating the answer. Both directions of the palette exchange are validated the same way.
 *
 * @module services/chara-inspection-protocol
 */

import type { CharaGearSlotId, ImportedCharaCharacter, ImportedCharaSlot } from '@xivdyetools/core';

/** The page asks the worker to inspect one transferred buffer. */
export interface CharaInspectionRequest {
  type: 'inspect';
  id: number;
  bytes: ArrayBuffer;
}

/** Codes a worker may answer with; `timedOut` / `superseded` are synthesized by the page only. */
export type CharaInspectionWorkerCode = 'unreadable' | 'workerFailed';

export type CharaInspectionResponse =
  | { type: 'success'; id: number; result: ImportedCharaCharacter }
  | { type: 'error'; id: number; code: CharaInspectionWorkerCode };

/**
 * One palette color the worker asks the page for: the library's palette request, carried as is.
 * The worker holds no palette data of its own (the page already bundles it; a second copy in the
 * worker would ship the same tables twice).
 */
export interface CharaPaletteRequest {
  table: 'creator' | 'shader';
  palette:
    | 'eyes'
    | 'highlights'
    | 'features'
    | 'lipsDark'
    | 'lipsLight'
    | 'facePaintDark'
    | 'facePaintLight'
    | 'skin'
    | 'hair';
  index: number;
  tribe?: string | null;
  gender?: 'Masculine' | 'Feminine' | null;
}

/** The page's color for one request, in the library's palette-color shape. */
export interface CharaPaletteColor extends CharaPaletteRequest {
  hex: string;
  rgb: readonly [number, number, number];
  datasetVersion: string;
}

/** Worker -> page: one palette request; `seq` is unique per request within the inspection `id`. */
export interface CharaPaletteRequestMessage {
  type: 'palette';
  id: number;
  seq: number;
  request: CharaPaletteRequest;
}

/** Page -> worker: the color (null when the host holds none), or a failure with no text. */
export type CharaPaletteReply =
  | { type: 'palette-result'; id: number; seq: number; color: CharaPaletteColor | null }
  | { type: 'palette-error'; id: number; seq: number };

/** How many palette requests one inspection may make; the worker and the page both enforce it. */
export const CHARA_PALETTE_REQUEST_CAP = 64;

/** How long the page waits for one inspection before terminating its worker. */
export const CHARA_INSPECTION_TIMEOUT_MS = 5_000;

const MAX_LABEL_UNITS = 256;
// Reject oversized arrays before reading entries; uniqueness checks remain the backstop
// for repeated slots and (slot, channel) pairs within those bounds.
const MAX_GEAR_MODELS = 12;
const MAX_DYE_CHANNELS = 24;
const MAX_ISSUES = 64;
const MAX_ISSUE_PATH_SEGMENTS = 32;
const MAX_SERIALIZED_CHARS = 256 * 1024;
const UINT16_MAX = 0xffff;
const CANONICAL_HEX = /^#[0-9A-F]{6}$/;

type ImportedGearModel = ImportedCharaCharacter['gearModels'][number];
type ImportedGearDye = ImportedCharaCharacter['gearDyes'][number];
type ImportedIssue = ImportedCharaCharacter['issues'][number];

// Each vocabulary below is a Record over its type, so a value added upstream fails type-check
// here until the validator learns it.
const APPEARANCE_SLOTS: Record<ImportedCharaSlot['slot'], true> = {
  leftEye: true,
  rightEye: true,
  hair: true,
  highlights: true,
  skin: true,
  limbal: true,
  lip: true,
  facePaint: true,
};
const SLOT_COUNT = Object.keys(APPEARANCE_SLOTS).length;

const SLOT_KINDS: Record<ImportedCharaSlot['kind'], true> = {
  ...APPEARANCE_SLOTS,
  tattoo: true,
  limbalOrTattoo: true,
};

const INDEX_MEANINGS: Record<ImportedCharaSlot['indexMeaning'], true> = {
  color: true,
  furPattern: true,
  unknown: true,
};

const INDEX_STATES: Record<ImportedCharaSlot['indexState'], true> = {
  absent: true,
  null: true,
  valid: true,
  invalid: true,
  unsupported: true,
};

const INTERPRETATIONS: Record<ImportedCharaSlot['interpretation'], true> = {
  palette: true,
  offGrid: true,
  extendedOnly: true,
  inactive: true,
  unresolved: true,
};

const REASONS: Record<ImportedCharaSlot['reason'], true> = {
  paletteOnly: true,
  paletteAgreement: true,
  offGrid: true,
  floatOnly: true,
  extendedInactive: true,
  ambiguousZeroBlock: true,
  invalidIndex: true,
  indexOutOfRange: true,
  missingTribeGender: true,
  missingRace: true,
  missingColor: true,
  missingPaletteEntry: true,
  missingShaderReference: true,
  highlightsDisabled: true,
  facePaintNone: true,
  furPattern: true,
  noLip: true,
  lipDisabled: true,
  activityUnknown: true,
};

const RACES: Record<NonNullable<ImportedCharaCharacter['race']>, true> = {
  Hyur: true,
  Elezen: true,
  Lalafell: true,
  "Miqo'te": true,
  Roegadyn: true,
  AuRa: true,
  Hrothgar: true,
  Viera: true,
};

const SUBRACES: Record<NonNullable<ImportedCharaCharacter['tribe']>, true> = {
  Midlander: true,
  Highlander: true,
  Wildwood: true,
  Duskwight: true,
  Plainsfolk: true,
  Dunesfolk: true,
  SeekerOfTheSun: true,
  KeeperOfTheMoon: true,
  SeaWolf: true,
  Hellsguard: true,
  Raen: true,
  Xaela: true,
  Helions: true,
  TheLost: true,
  Rava: true,
  Veena: true,
};

const GENDERS: Record<NonNullable<ImportedCharaCharacter['gender']>, true> = {
  Male: true,
  Female: true,
};

const GEAR_SLOTS: Record<CharaGearSlotId, true> = {
  MainHand: true,
  OffHand: true,
  HeadGear: true,
  Body: true,
  Hands: true,
  Legs: true,
  Feet: true,
  Ears: true,
  Neck: true,
  Wrists: true,
  LeftRing: true,
  RightRing: true,
};

const SEVERITIES: Record<ImportedCharaCharacter['issues'][number]['severity'], true> = {
  info: true,
  warning: true,
  error: true,
};

const CHARACTER_KEYS: ReadonlySet<string> = new Set<keyof ImportedCharaCharacter>([
  'producer',
  'race',
  'tribe',
  'gender',
  'nickname',
  'extendedValid',
  'extendedDeclared',
  'slots',
  'eyesShareIndex',
  'gearDyes',
  'gearModels',
  'glassesId',
  'issues',
]);

const SLOT_KEYS: ReadonlySet<string> = new Set<keyof ImportedCharaSlot>([
  'slot',
  'kind',
  'indexMeaning',
  'sheetIndex',
  'variant',
  'gridAddress',
  'creatorHex',
  'shaderHex',
  'extendedHex',
  'effectiveExtendedHex',
  'extendedActive',
  'active',
  'interpretation',
  'reason',
  'deltaE',
  'displayHex',
  'alpha',
  'lipComposite',
  'correction',
  'index',
  'indexState',
  'matchHex',
  'indexGap',
]);

const LIP_COMPOSITE_KEYS: ReadonlySet<string> = new Set(['hex', 'alpha', 'derived']);
const GEAR_MODEL_REQUIRED_KEYS = ['slot', 'base', 'variant'] as const;
const GEAR_MODEL_KEYS: ReadonlySet<string> = new Set([...GEAR_MODEL_REQUIRED_KEYS, 'set']);
const GEAR_DYE_KEYS: ReadonlySet<string> = new Set(['slot', 'channel', 'stainId', 'dye']);
const ISSUE_KEYS: ReadonlySet<string> = new Set(['code', 'severity', 'path']);

const MAX_PALETTE_INDEX = 255;
const MAX_TRIBE_UNITS = 32;
const MAX_DATASET_VERSION_UNITS = 64;
const CHANNEL_MAX = 255;

const PALETTE_TABLES: Record<CharaPaletteRequest['table'], true> = { creator: true, shader: true };
const PALETTE_NAMES: Record<CharaPaletteRequest['palette'], true> = {
  eyes: true,
  highlights: true,
  features: true,
  lipsDark: true,
  lipsLight: true,
  facePaintDark: true,
  facePaintLight: true,
  skin: true,
  hair: true,
};
const PALETTE_GENDERS: Record<NonNullable<CharaPaletteRequest['gender']>, true> = {
  Masculine: true,
  Feminine: true,
};

const PALETTE_REQUEST_KEYS = ['table', 'palette', 'index', 'tribe', 'gender'] as const;
const PALETTE_REQUEST_REQUIRED_KEYS = ['table', 'palette', 'index'] as const;
const PALETTE_REQUEST_KEY_SET: ReadonlySet<string> = new Set(PALETTE_REQUEST_KEYS);
const PALETTE_COLOR_KEYS: ReadonlySet<string> = new Set([
  ...PALETTE_REQUEST_KEYS,
  'hex',
  'rgb',
  'datasetVersion',
]);
const PALETTE_COLOR_REQUIRED_KEYS = [
  ...PALETTE_REQUEST_REQUIRED_KEYS,
  'hex',
  'rgb',
  'datasetVersion',
] as const;
const PALETTE_MESSAGE_KEYS: ReadonlySet<string> = new Set(['type', 'id', 'seq', 'request']);
const PALETTE_RESULT_KEYS: ReadonlySet<string> = new Set(['type', 'id', 'seq', 'color']);
const PALETTE_ERROR_KEYS: ReadonlySet<string> = new Set(['type', 'id', 'seq']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** One own data property's value, or `undefined` for a missing key or an accessor property. */
function ownDataValue(target: object, key: PropertyKey): { value: unknown } | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  return descriptor && 'value' in descriptor ? { value: descriptor.value } : undefined;
}

/**
 * Read a record's fields once: null unless it is a non-array object whose own keys are all
 * allowlisted strings held by plain data properties (no accessor, no symbol; a non-enumerable
 * property counts like any other), with every required key present.
 */
function readRecord(
  value: unknown,
  allowed: ReadonlySet<string>,
  required: Iterable<string> = allowed
): Map<string, unknown> | null {
  if (!isRecord(value)) return null;
  const fields = new Map<string, unknown>();
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.has(key)) return null;
    const field = ownDataValue(value, key);
    if (!field) return null;
    fields.set(key, field.value);
  }
  for (const key of required) if (!fields.has(key)) return null;
  return fields;
}

/**
 * Read an array's elements once: null unless it is dense and index-only (own keys exactly
 * `0 … length-1` plus `length`, each a data property) and at most `maxLength` long.
 */
function readArray(value: unknown, maxLength: number): unknown[] | null {
  if (!Array.isArray(value)) return null;
  const length: unknown = value.length;
  if (typeof length !== 'number' || length > maxLength) return null;
  if (Reflect.ownKeys(value).length !== length + 1) return null;
  const items: unknown[] = [];
  for (let i = 0; i < length; i++) {
    const item = ownDataValue(value, String(i));
    if (!item) return null;
    items.push(item.value);
  }
  return items;
}

function isIn<T extends string>(vocabulary: Record<T, true>, value: unknown): value is T {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(vocabulary, value);
}

function isPositiveSafeId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isUint16(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= UINT16_MAX;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** A local label: a string of at most 256 UTF-16 code units. */
function isLabel(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_LABEL_UNITS;
}

function isLabelOrNull(value: unknown): value is string | null {
  return value === null || isLabel(value);
}

function isCanonicalHex(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_HEX.test(value);
}

function isHexOrNull(value: unknown): value is string | null {
  return value === null || isCanonicalHex(value);
}

/** `undefined` when invalid; `null` is a valid "no composite". */
function readLipComposite(value: unknown): ImportedCharaSlot['lipComposite'] | undefined {
  if (value === null) return null;
  const fields = readRecord(value, LIP_COMPOSITE_KEYS);
  if (!fields) return undefined;
  const hex = fields.get('hex');
  const alpha = fields.get('alpha');
  const derived = fields.get('derived');
  if (!isCanonicalHex(hex) || !isFiniteNumber(alpha) || derived !== true) return undefined;
  return { hex, alpha, derived };
}

/** The shared matching rule: a match only on a confirmed-active, resolved slot, equal to its display. */
function isMatchConsistent(slot: ImportedCharaSlot): boolean {
  if (slot.matchHex === null) return true;
  return (
    isCanonicalHex(slot.matchHex) &&
    slot.active === true &&
    slot.interpretation !== 'inactive' &&
    slot.interpretation !== 'unresolved' &&
    slot.displayHex !== null &&
    slot.matchHex === slot.displayHex
  );
}

function readSlot(value: unknown): ImportedCharaSlot | null {
  const fields = readRecord(value, SLOT_KEYS);
  if (!fields) return null;
  const slotName = fields.get('slot');
  const kind = fields.get('kind');
  const indexMeaning = fields.get('indexMeaning');
  const sheetIndex = fields.get('sheetIndex');
  const variant = fields.get('variant');
  const gridAddress = fields.get('gridAddress');
  const creatorHex = fields.get('creatorHex');
  const shaderHex = fields.get('shaderHex');
  const extendedHex = fields.get('extendedHex');
  const effectiveExtendedHex = fields.get('effectiveExtendedHex');
  const extendedActive = fields.get('extendedActive');
  const active = fields.get('active');
  const interpretation = fields.get('interpretation');
  const reason = fields.get('reason');
  const deltaE = fields.get('deltaE');
  const displayHex = fields.get('displayHex');
  const alpha = fields.get('alpha');
  const lipComposite = readLipComposite(fields.get('lipComposite'));
  const correction = fields.get('correction');
  const index = fields.get('index');
  const indexState = fields.get('indexState');
  const matchHex = fields.get('matchHex');
  const indexGap = fields.get('indexGap');
  if (!(
    isIn(APPEARANCE_SLOTS, slotName) &&
    isIn(SLOT_KINDS, kind) &&
    isIn(INDEX_MEANINGS, indexMeaning) &&
    (sheetIndex === null || isNonNegativeInteger(sheetIndex)) &&
    (variant === null || variant === 'dark' || variant === 'light') &&
    isLabelOrNull(gridAddress) &&
    isHexOrNull(creatorHex) &&
    isHexOrNull(shaderHex) &&
    isHexOrNull(extendedHex) &&
    isHexOrNull(effectiveExtendedHex) &&
    typeof extendedActive === 'boolean' &&
    (active === null || typeof active === 'boolean') &&
    isIn(INTERPRETATIONS, interpretation) &&
    isIn(REASONS, reason) &&
    (deltaE === null || isFiniteNumber(deltaE)) &&
    isHexOrNull(displayHex) &&
    (alpha === null || isFiniteNumber(alpha)) &&
    lipComposite !== undefined &&
    (correction === null || correction === 'historicalEyePairSwap') &&
    (index === null || isNonNegativeInteger(index)) &&
    isIn(INDEX_STATES, indexState) &&
    isHexOrNull(matchHex) &&
    typeof indexGap === 'boolean'
  )) {
    return null;
  }
  const slot: ImportedCharaSlot = {
    slot: slotName,
    kind,
    indexMeaning,
    sheetIndex,
    variant,
    gridAddress,
    creatorHex,
    shaderHex,
    extendedHex,
    effectiveExtendedHex,
    extendedActive,
    active,
    interpretation,
    reason,
    deltaE,
    displayHex,
    alpha,
    lipComposite,
    correction,
    index,
    indexState,
    matchHex,
    indexGap,
  };
  return isMatchConsistent(slot) ? slot : null;
}

function readSlots(value: unknown): ImportedCharaSlot[] | null {
  const items = readArray(value, SLOT_COUNT);
  if (!items || items.length !== SLOT_COUNT) return null;
  const slots: ImportedCharaSlot[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const slot = readSlot(item);
    if (!slot || seen.has(slot.slot)) return null;
    seen.add(slot.slot);
    slots.push(slot);
  }
  return slots;
}

function readGearModels(value: unknown): ImportedGearModel[] | null {
  const items = readArray(value, MAX_GEAR_MODELS);
  if (!items) return null;
  const models: ImportedGearModel[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const fields = readRecord(item, GEAR_MODEL_KEYS, GEAR_MODEL_REQUIRED_KEYS);
    if (!fields) return null;
    const slot = fields.get('slot');
    const base = fields.get('base');
    const variant = fields.get('variant');
    const set = fields.get('set');
    if (!isIn(GEAR_SLOTS, slot) || seen.has(slot)) return null;
    if (!isUint16(base) || !isUint16(variant)) return null;
    if (set !== undefined && !isUint16(set)) return null;
    seen.add(slot);
    models.push(set === undefined ? { slot, base, variant } : { slot, set, base, variant });
  }
  return models;
}

function readGearDyes(value: unknown): ImportedGearDye[] | null {
  const items = readArray(value, MAX_DYE_CHANNELS);
  if (!items) return null;
  const badges: ImportedGearDye[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const fields = readRecord(item, GEAR_DYE_KEYS);
    if (!fields) return null;
    const slot = fields.get('slot');
    const channel = fields.get('channel');
    const stainId = fields.get('stainId');
    if (!isIn(GEAR_SLOTS, slot)) return null;
    if (channel !== 1 && channel !== 2) return null;
    if (!isUint16(stainId)) return null;
    // The worker never owns dye data; only the page attaches its offline dye objects.
    if (fields.get('dye') !== null) return null;
    const channelKey = `${slot}:${channel}`;
    if (seen.has(channelKey)) return null;
    seen.add(channelKey);
    badges.push({ slot, channel, stainId, dye: null });
  }
  return badges;
}

function readIssuePath(value: unknown): Array<string | number> | null {
  const items = readArray(value, MAX_ISSUE_PATH_SEGMENTS);
  if (!items) return null;
  const path: Array<string | number> = [];
  for (const segment of items) {
    if (!isLabel(segment) && !isNonNegativeInteger(segment)) return null;
    path.push(segment);
  }
  return path;
}

function readIssues(value: unknown): ImportedIssue[] | null {
  const items = readArray(value, MAX_ISSUES);
  if (!items) return null;
  const issues: ImportedIssue[] = [];
  for (const item of items) {
    const fields = readRecord(item, ISSUE_KEYS);
    if (!fields) return null;
    const code = fields.get('code');
    const severity = fields.get('severity');
    const path = readIssuePath(fields.get('path'));
    if (typeof code !== 'string' || code.length === 0) return null;
    if (!isIn(SEVERITIES, severity) || !path) return null;
    issues.push({ code, severity, path });
  }
  return issues;
}

function readCharacter(value: unknown): ImportedCharaCharacter | null {
  const fields = readRecord(value, CHARACTER_KEYS);
  if (!fields) return null;
  const producer = fields.get('producer');
  const race = fields.get('race');
  const tribe = fields.get('tribe');
  const gender = fields.get('gender');
  const nickname = fields.get('nickname');
  const extendedValid = fields.get('extendedValid');
  const extendedDeclared = fields.get('extendedDeclared');
  const eyesShareIndex = fields.get('eyesShareIndex');
  const glassesId = fields.get('glassesId');
  if (!(
    isLabelOrNull(producer) &&
    isLabelOrNull(nickname) &&
    (race === null || isIn(RACES, race)) &&
    (tribe === null || isIn(SUBRACES, tribe)) &&
    (gender === null || isIn(GENDERS, gender)) &&
    typeof extendedValid === 'boolean' &&
    typeof extendedDeclared === 'boolean' &&
    typeof eyesShareIndex === 'boolean' &&
    (glassesId === null || isUint16(glassesId))
  )) {
    return null;
  }
  const slots = readSlots(fields.get('slots'));
  const gearModels = readGearModels(fields.get('gearModels'));
  const gearDyes = readGearDyes(fields.get('gearDyes'));
  const issues = readIssues(fields.get('issues'));
  if (!slots || !gearModels || !gearDyes || !issues) return null;
  return {
    producer,
    race,
    tribe,
    gender,
    nickname,
    extendedValid,
    extendedDeclared,
    slots,
    eyesShareIndex,
    gearDyes,
    gearModels,
    glassesId,
    issues,
  };
}

function fitsSerializedBound(value: ImportedCharaCharacter): boolean {
  const json = JSON.stringify(value);
  return typeof json === 'string' && json.length <= MAX_SERIALIZED_CHARS;
}

/**
 * Validate a worker's projected character. Returns a freshly built copy, assembled only from values
 * read once from plain data properties, when every bound holds; null otherwise (including when the
 * input carries any field, non-index array property or accessor the projection does not produce).
 * The 256 KiB bound is measured on that copy. Never returns the input or any part of it.
 */
export function validateImportedCharacter(value: unknown): ImportedCharaCharacter | null {
  try {
    const character = readCharacter(value);
    return character && fitsSerializedBound(character) ? character : null;
  } catch {
    // A hostile direct caller (a throwing proxy trap, say) gets the same answer as a bad message.
    return null;
  }
}

/** True for a well-formed request: an `inspect` with a positive safe integer id and an ArrayBuffer. */
export function isInspectionRequest(value: unknown): value is CharaInspectionRequest {
  return (
    isRecord(value) &&
    value.type === 'inspect' &&
    isPositiveSafeId(value.id) &&
    value.bytes instanceof ArrayBuffer
  );
}

/**
 * Parse a worker answer. Null when it is malformed, of an unknown type, or carries a result that
 * fails validation. An error answer is rebuilt from its three fields, so nothing else (such as a
 * raw message) crosses over.
 */
export function parseInspectionResponse(value: unknown): CharaInspectionResponse | null {
  if (!isRecord(value) || !isPositiveSafeId(value.id)) return null;
  if (value.type === 'error') {
    if (value.code !== 'unreadable' && value.code !== 'workerFailed') return null;
    return { type: 'error', id: value.id, code: value.code };
  }
  if (value.type === 'success') {
    const result = validateImportedCharacter(value.result);
    return result ? { type: 'success', id: value.id, result } : null;
  }
  return null;
}

/**
 * The request fields shared by a palette request and a palette color, rebuilt; null when any is
 * out of its vocabulary or range. An absent (or undefined) tribe / gender stays absent.
 */
function readPaletteRequestFields(fields: Map<string, unknown>): CharaPaletteRequest | null {
  const table = fields.get('table');
  const palette = fields.get('palette');
  const index = fields.get('index');
  const tribe = fields.get('tribe');
  const gender = fields.get('gender');
  if (!(
    isIn(PALETTE_TABLES, table) &&
    isIn(PALETTE_NAMES, palette) &&
    typeof index === 'number' &&
    Number.isInteger(index) &&
    index >= 0 &&
    index <= MAX_PALETTE_INDEX &&
    (tribe === undefined ||
      tribe === null ||
      (typeof tribe === 'string' && tribe.length <= MAX_TRIBE_UNITS)) &&
    (gender === undefined || gender === null || isIn(PALETTE_GENDERS, gender))
  )) {
    return null;
  }
  const request: CharaPaletteRequest = { table, palette, index };
  if (tribe !== undefined) request.tribe = tribe;
  if (gender !== undefined) request.gender = gender;
  return request;
}

function readRgb(value: unknown): CharaPaletteColor['rgb'] | null {
  const items = readArray(value, 3);
  if (!items || items.length !== 3) return null;
  const [r, g, b] = items;
  const isChannel = (channel: unknown): channel is number =>
    typeof channel === 'number' &&
    Number.isInteger(channel) &&
    channel >= 0 &&
    channel <= CHANNEL_MAX;
  return isChannel(r) && isChannel(g) && isChannel(b) ? [r, g, b] : null;
}

/** `undefined` when invalid; `null` is a valid "the host holds no such color". */
function readPaletteColor(value: unknown): CharaPaletteColor | null | undefined {
  if (value === null) return null;
  const fields = readRecord(value, PALETTE_COLOR_KEYS, PALETTE_COLOR_REQUIRED_KEYS);
  if (!fields) return undefined;
  const request = readPaletteRequestFields(fields);
  const hex = fields.get('hex');
  const rgb = readRgb(fields.get('rgb'));
  const datasetVersion = fields.get('datasetVersion');
  if (!(
    request &&
    isCanonicalHex(hex) &&
    rgb &&
    typeof datasetVersion === 'string' &&
    datasetVersion.length <= MAX_DATASET_VERSION_UNITS
  )) {
    return undefined;
  }
  return { ...request, hex, rgb, datasetVersion };
}

/**
 * Parse a worker's palette request: the message rebuilt from its four fields, or null when it is
 * malformed, carries any extra key, or holds a request out of the library's vocabulary.
 */
export function parsePaletteRequestMessage(value: unknown): CharaPaletteRequestMessage | null {
  try {
    const fields = readRecord(value, PALETTE_MESSAGE_KEYS);
    if (!fields) return null;
    const id = fields.get('id');
    const seq = fields.get('seq');
    if (fields.get('type') !== 'palette' || !isPositiveSafeId(id) || !isPositiveSafeId(seq)) {
      return null;
    }
    const requestFields = readRecord(
      fields.get('request'),
      PALETTE_REQUEST_KEY_SET,
      PALETTE_REQUEST_REQUIRED_KEYS
    );
    const request = requestFields && readPaletteRequestFields(requestFields);
    return request ? { type: 'palette', id, seq, request } : null;
  } catch {
    return null;
  }
}

/** True for a well-formed worker -> page palette request (see `parsePaletteRequestMessage`). */
export function isPaletteRequestMessage(value: unknown): value is CharaPaletteRequestMessage {
  return parsePaletteRequestMessage(value) !== null;
}

/**
 * Parse the page's answer to one palette request. Returns a freshly built reply (its color and rgb
 * included), or null when it is malformed, of another type, or carries any extra key.
 */
export function parsePaletteReply(value: unknown): CharaPaletteReply | null {
  try {
    if (!isRecord(value)) return null;
    const type = ownDataValue(value, 'type')?.value;
    if (type === 'palette-error') {
      const fields = readRecord(value, PALETTE_ERROR_KEYS);
      const id = fields?.get('id');
      const seq = fields?.get('seq');
      return isPositiveSafeId(id) && isPositiveSafeId(seq) ? { type, id, seq } : null;
    }
    if (type === 'palette-result') {
      const fields = readRecord(value, PALETTE_RESULT_KEYS);
      if (!fields) return null;
      const id = fields.get('id');
      const seq = fields.get('seq');
      const color = readPaletteColor(fields.get('color'));
      if (!isPositiveSafeId(id) || !isPositiveSafeId(seq) || color === undefined) return null;
      return { type, id, seq, color };
    }
    return null;
  } catch {
    return null;
  }
}
