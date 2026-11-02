/**
 * XIV Dye Tools 5.0 — shared vocabulary for the `.chara` views (10A Sheet).
 *
 * The file card, the THIS CHARACTER sheet and DYES ON THIS GLAMOUR draw from
 * one set of sizes, colours and labels so they read as one family. Everything
 * here is stateless: each helper reads only the current theme and locale.
 *
 * The views render inside the v4 shell's shadow DOM, so styles are inline and
 * every colour comes from a theme token or from the theme-aware pairs below.
 *
 * Spec: docs/research/monorepo-2.0/10a-sheet-port-spec.md (10A "Sheet")
 *
 * @module components/chara-ui
 */

import type {
  CharaImportIssue,
  ImportedCharaCharacter,
  ImportedCharaSlot,
} from '@xivdyetools/core';
import type { Dye } from '@xivdyetools/types';
import { LanguageService } from '@services/index';
import { ThemeService } from '@services/theme-service';

export const MONO = 'var(--font-mono)';
/** Matches globals.css h1–h6 — Space Grotesk with the system fallback. */
export const SANS = 'var(--font-display)';
const OFF_GRID_AMBER = '#F4BF4F';
const OFF_GRID_AMBER_LIGHT = '#B45309';
const LOCAL_ONLY_GREEN = '#61C554';
const LOCAL_ONLY_GREEN_LIGHT = '#137A33';
/** The suite's swatch inset ring — load-bearing on extreme colours. */
export const INSET_RING = 'box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.28);';

/** Why an unresolved slot has no color, as the card says it. */
type CharaSlotProblem = 'midRangeIndex' | 'indexOutOfRange' | 'noTribe' | 'noRace' | 'unknown';

/** The control a file switched off (or, for Hrothgar, a lip index that is a fur pattern). */
type CharaInactiveReason =
  'highlightsDisabled' | 'facePaintNone' | 'noLip' | 'lipDisabled' | 'furPattern';

/**
 * How a slot reads on every `.chara` view:
 *
 * - `onGrid` / `offGrid`: a confirmed color (`matchHex` set) on or off the creator grid; matched,
 *   pickable and saved.
 * - `activityUnknown`: a resolved color whose control the file does not state (`active === null`).
 *   Shown as evidence, never matched, picked, saved or exported (D4).
 * - `inactive`: the file switched it off. `absent`: the file does not store it.
 * - `unresolved`: the file stores it, but it cannot be read; `code` picks the sentence.
 */
type CharaSlotView =
  | { kind: 'onGrid' }
  | { kind: 'offGrid' }
  | { kind: 'activityUnknown' }
  | { kind: 'inactive'; reason: CharaInactiveReason }
  | { kind: 'absent' }
  | { kind: 'unresolved'; code: CharaSlotProblem };

/**
 * Problem → locale key. Spelled out (not `` `swatch.slotError.${code}` ``) so every
 * key is a literal the orphan scanner can see.
 */
const SLOT_PROBLEM_KEY: Record<CharaSlotProblem, string> = {
  midRangeIndex: 'swatch.slotError.midRangeIndex',
  indexOutOfRange: 'swatch.slotError.indexOutOfRange',
  noTribe: 'swatch.slotError.noTribe',
  noRace: 'swatch.slotError.noRace',
  unknown: 'swatch.slotError.unknown',
};

const INACTIVE_REASONS: ReadonlySet<string> = new Set<CharaInactiveReason>([
  'highlightsDisabled',
  'facePaintNone',
  'noLip',
  'lipDisabled',
  'furPattern',
]);

/** Issue codes that say the page could not supply creator colors for this file. */
const PALETTE_FAILURE_CODES: ReadonlySet<string> = new Set([
  'PALETTE_UNAVAILABLE',
  'INVALID_PALETTE_RESPONSE',
]);

/** A `swatch.*` string — the namespace every `.chara` view writes in. */
export function tSwatch(key: string): string {
  return LanguageService.t(`swatch.${key}`);
}

/**
 * A count in the locale's plural form (I18N-007): the `one` key where
 * `Intl.PluralRules` says so — en 1, fr 0 and 1, never in ja / ko / zh — and
 * the `other` key otherwise. `{n}` is always filled in, since French reaches
 * `one` with 0. Both keys are passed spelled out, never built from a stem, so
 * the orphan scanner (`scripts/analyze-unused-keys.js`) sees each as a literal.
 */
export function tCount(n: number, one: string, other: string): string {
  const form = new Intl.PluralRules(LanguageService.getCurrentLocale()).select(n);
  return LanguageService.tInterpolate(form === 'one' ? one : other, { n: String(n) });
}

/**
 * Two localized sentences as one line (I18N-012). Japanese and Chinese close a
 * sentence with a full-width 。！？ that carries its own spacing, so nothing
 * goes between; every other locale here writes one space after its stop.
 */
export function joinSentences(first: string, second: string): string {
  return /[。！？]$/.test(first) ? `${first}${second}` : `${first} ${second}`;
}

/** Which problem an unresolved slot (other than `missingColor`) has. */
function slotProblem(
  slot: ImportedCharaSlot,
  issues: readonly CharaImportIssue[]
): CharaSlotProblem {
  // The 96–127 gap keys on the projection's flag, never on `index` (ruling 2): it also covers
  // a fraction such as 96.5, which the library reads as an invalid index.
  if (slot.indexGap && (slot.reason === 'indexOutOfRange' || slot.reason === 'invalidIndex')) {
    return 'midRangeIndex';
  }
  switch (slot.reason) {
    case 'indexOutOfRange':
      return 'indexOutOfRange';
    case 'missingTribeGender':
      return 'noTribe';
    case 'missingRace':
      return 'noRace';
    case 'missingPaletteEntry':
      // No entry in the sheet, unless the page could not supply its colors at all.
      return issues.some((i) => PALETTE_FAILURE_CODES.has(i.code)) ? 'unknown' : 'indexOutOfRange';
    default:
      return 'unknown';
  }
}

/**
 * Classify one slot. Keys unknown activation on `active`, never on `reason`: a live float with no
 * stated control keeps the library's own reason (`offGrid`, `floatOnly`…) while `active` is null.
 * `issues` (the character's) only decide the sentence for a missing palette entry.
 */
export function slotViewState(
  slot: ImportedCharaSlot,
  issues: readonly CharaImportIssue[] = []
): CharaSlotView {
  if (slot.interpretation === 'inactive') {
    return INACTIVE_REASONS.has(slot.reason)
      ? { kind: 'inactive', reason: slot.reason as CharaInactiveReason }
      : { kind: 'absent' };
  }
  if (slot.interpretation === 'unresolved') {
    return slot.reason === 'missingColor'
      ? { kind: 'absent' }
      : { kind: 'unresolved', code: slotProblem(slot, issues) };
  }
  if (slot.displayHex === null) return { kind: 'unresolved', code: 'unknown' };
  if (slot.active === null) return { kind: 'activityUnknown' };
  if (slot.matchHex !== null) {
    return slot.interpretation === 'palette' ? { kind: 'onGrid' } : { kind: 'offGrid' };
  }
  // Defensive: a color that is not confirmed is shown, never matched.
  return { kind: 'activityUnknown' };
}

/**
 * The color the slot shows (strip, counts, card swatch): the labelled lip composite where one
 * exists, else the library's display color. Unknown activation keeps its preview (D6); an
 * inactive or unresolved slot has none.
 */
export function previewHex(slot: ImportedCharaSlot): string | null {
  if (slot.displayHex === null) return null;
  return slot.lipComposite?.hex ?? slot.displayHex;
}

/**
 * The color a confirmed slot is matched, picked and saved as; null for anything not confirmed,
 * with no fallback to `displayHex`. The lip follows its composite over the skin, the color the
 * character shows (`swatch.blendNote`; D1).
 */
export function matchTargetHex(slot: ImportedCharaSlot): string | null {
  if (slot.matchHex === null) return null;
  return slot.lipComposite?.hex ?? slot.matchHex;
}

/** The slot points at a real creator cell: a sheet index with a resolved creator entry (D3). */
export function hasValidGridCoordinate(slot: ImportedCharaSlot): boolean {
  return slot.sheetIndex !== null && slot.creatorHex !== null;
}

/**
 * The localized sentence for an unresolved slot. Core's own messages are EN engineering text that
 * names fields; the projection carries none, and the keys are spelled out in `SLOT_PROBLEM_KEY`.
 */
export function slotProblemText(
  slot: ImportedCharaSlot,
  issues: readonly CharaImportIssue[]
): string {
  return LanguageService.t(SLOT_PROBLEM_KEY[slotProblem(slot, issues)]);
}

/** OFF GRID and warning amber, legible on either theme. */
export function amber(): string {
  return ThemeService.isDarkMode() ? OFF_GRID_AMBER : OFF_GRID_AMBER_LIGHT;
}

/** LOCAL ONLY / valid-palette green, legible on either theme. */
export function green(): string {
  return ThemeService.isDarkMode() ? LOCAL_ONLY_GREEN : LOCAL_ONLY_GREEN_LIGHT;
}

export function el(tag: string, style: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.setAttribute('style', style);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Mono chip label (8.5px, letter-spaced) — the drawn card vocabulary. */
export function monoChip(text: string, fg: string, bg: string): HTMLElement {
  return el(
    'span',
    `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; padding: 3px 7px; border-radius: 5px; background: ${bg}; color: ${fg}; white-space: nowrap;`,
    text
  );
}

export function slotLabel(slot: Pick<ImportedCharaSlot, 'slot' | 'kind'>): string {
  switch (slot.slot) {
    case 'leftEye':
      return tSwatch('slotLeftEye');
    case 'rightEye':
      return tSwatch('slotRightEye');
    case 'hair':
      return tSwatch('slotHair');
    case 'highlights':
      return tSwatch('slotHighlights');
    case 'skin':
      return tSwatch('slotSkin');
    case 'limbal':
      // Race unknown: the slot is a limbal ring (Au Ra) or a tattoo (everyone else).
      if (slot.kind === 'limbalOrTattoo') return tSwatch('palTattoo');
      return slot.kind === 'tattoo' ? tSwatch('slotTattoo') : tSwatch('slotLimbal');
    case 'lip':
      return tSwatch('slotLips');
    case 'facePaint':
      return tSwatch('slotFacePaint');
    default:
      return slot.slot;
  }
}

export function dyeName(dye: Dye): string {
  return LanguageService.getDyeName(dye.itemID) || dye.name;
}

/**
 * Whether the character wears anything DYES ON THIS GLAMOUR can show: a dyed
 * channel, a worn piece, or facewear.
 *
 * `glassesId` counts as worn. It was once left out while the block gained a
 * facewear row, so a `.chara` carrying ONLY facewear rendered no block and
 * that row was unreachable. The item lookup makes the same three-way test.
 */
export function hasGlamour(
  resolved: Pick<ImportedCharaCharacter, 'gearDyes' | 'gearModels' | 'glassesId'>
): boolean {
  return (
    resolved.gearDyes.length > 0 || resolved.gearModels.length > 0 || resolved.glassesId !== null
  );
}

/** One row of the file card's amber warnings card. */
export interface CharaWarning {
  tag: string;
  text: string;
  severe: boolean;
}

/** Equipment slot → its `swatch.gearSlot.*` label key, spelled out for the orphan scanner. */
const GEAR_SLOT_KEY: Record<string, string> = {
  MainHand: 'swatch.gearSlot.MainHand',
  OffHand: 'swatch.gearSlot.OffHand',
  HeadGear: 'swatch.gearSlot.HeadGear',
  Body: 'swatch.gearSlot.Body',
  Hands: 'swatch.gearSlot.Hands',
  Legs: 'swatch.gearSlot.Legs',
  Feet: 'swatch.gearSlot.Feet',
  Ears: 'swatch.gearSlot.Ears',
  Neck: 'swatch.gearSlot.Neck',
  Wrists: 'swatch.gearSlot.Wrists',
  LeftRing: 'swatch.gearSlot.LeftRing',
  RightRing: 'swatch.gearSlot.RightRing',
};

/** The localized gear-slot label for a diagnostic path segment, or null for anything else. */
function gearSlotLabel(segment: string | number | undefined): string | null {
  return typeof segment === 'string' && Object.hasOwn(GEAR_SLOT_KEY, segment)
    ? LanguageService.t(GEAR_SLOT_KEY[segment]!)
    : null;
}

/** Fields whose bad value the slot itself already explains (`invalidIndex`): no extra row. */
const APPEARANCE_INDEX_FIELDS: ReadonlySet<string> = new Set([
  'LEyeColor',
  'REyeColor',
  'HairTone',
  'Highlights',
  'Skintone',
  'LimbalEyes',
  'LipsToneFurPattern',
  'FacePaintColor',
]);

const IDENTITY_FIELDS: ReadonlySet<string> = new Set(['Tribe', 'Gender', 'Race']);

/**
 * Issue code → row text key; `null` is silent. A code not listed here is shown with the generic
 * `swatch.issue.unknown` when its severity is warning or error, and is silent when info.
 *
 * Silent on purpose: routine producer output (an omitted image, unknown fields: 93 of 99 corpus
 * files), preview-bounding notes (`AMBIGUOUS_ZERO_BLOCK` is silent, D7) and slot-bound codes the
 * slot's own row already states. `INVALID_FIELD` / `UNSUPPORTED_VALUE` are routed by path in
 * `issueRow`, not here.
 */
const ISSUE_KEY: Record<string, string | null> = {
  RACE_TRIBE_MISMATCH: 'swatch.issue.raceTribeMismatch',
  EYE_PAIRING_INFERRED: 'swatch.issue.eyePairingInferred',
  PALETTE_UNAVAILABLE: 'swatch.issue.paletteUnavailable',
  INVALID_PALETTE_RESPONSE: 'swatch.issue.paletteUnavailable',
  ISSUES_TRUNCATED: 'swatch.issue.truncated',
  MISSING_PALETTE_CONTEXT: null,
  PALETTE_INDEX_OUT_OF_RANGE: null,
  MISSING_SHADER_REFERENCE: null,
  IMAGE_OMITTED: null,
  INVALID_IMAGE_TYPE: null,
  UNSUPPORTED_FIELD: null,
  AMBIGUOUS_ZERO_BLOCK: null,
  EXTENDED_CLAMPED: null,
  ALPHA_CLAMPED: null,
};

/** The row text for one diagnostic, or null when it is silent here. */
function issueRow(issue: CharaImportIssue, includeGear: boolean): string | null {
  const [head, field] = issue.path;
  const gearLabel = gearSlotLabel(head);
  if (gearLabel !== null) {
    // Gear: only the Glamour Reader shows the pieces these rows are about (D5).
    if (!includeGear) return null;
    const fieldError = issue.code === 'INVALID_FIELD' || issue.code === 'UNSUPPORTED_VALUE';
    if (issue.code === 'INCOMPLETE_MODEL' || (fieldError && field === undefined)) {
      // A missing model, or a slot that is not a piece at all: nothing to look up.
      return `${gearLabel} · ${LanguageService.t('swatch.issue.incompleteModel')}`;
    }
    if (fieldError && (field === 'DyeId' || field === 'DyeId2')) {
      return `${gearLabel} · ${LanguageService.t('swatch.issue.invalidDye')}`;
    }
    // A bad model lane: the piece's INCOMPLETE_MODEL row already says it.
    if (fieldError) return null;
  }
  if (issue.code === 'INVALID_FIELD' || issue.code === 'UNSUPPORTED_VALUE') {
    if (typeof head === 'string' && IDENTITY_FIELDS.has(head)) {
      return LanguageService.t('swatch.issue.invalidIdentity');
    }
    if (typeof head === 'string' && APPEARANCE_INDEX_FIELDS.has(head)) return null;
    return LanguageService.t('swatch.issue.invalidField');
  }
  if (Object.hasOwn(ISSUE_KEY, issue.code)) {
    const key = ISSUE_KEY[issue.code];
    return key ? LanguageService.t(key) : null;
  }
  return issue.severity === 'info' ? null : LanguageService.t('swatch.issue.unknown');
}

/**
 * The file card's amber warnings: one row per slot that needs a word (an unreadable slot in red,
 * an unconfirmed control, an off-grid color), then one row per distinct diagnostic sentence.
 * Absent and switched-off slots say nothing here; their sheet cards explain them. Every text is a
 * locale sentence, prefixed with a slot label where one applies, never a code or a path.
 */
export function charaWarnings(
  resolved: Pick<ImportedCharaCharacter, 'slots' | 'issues'>,
  options: { includeGear: boolean }
): CharaWarning[] {
  const out: CharaWarning[] = [];
  for (const slot of resolved.slots) {
    const view = slotViewState(slot, resolved.issues);
    const label = slotLabel(slot);
    if (view.kind === 'unresolved') {
      out.push({
        tag: LanguageService.t('swatch.warnErrorTag'),
        text: `${label} · ${LanguageService.t(SLOT_PROBLEM_KEY[view.code])}`,
        severe: true,
      });
    } else if (view.kind === 'activityUnknown') {
      out.push({
        tag: LanguageService.t('swatch.activityUnknownTag'),
        text: `${label} · ${LanguageService.t('swatch.activityUnknownNote')}`,
        severe: false,
      });
    } else if (view.kind === 'offGrid') {
      out.push({
        tag: LanguageService.t('swatch.offGrid'),
        text: `${label} · ${LanguageService.t('swatch.offGridNote')}`,
        severe: false,
      });
    }
  }
  const seen = new Set<string>();
  for (const issue of resolved.issues) {
    const text = issueRow(issue, options.includeGear);
    if (text === null || seen.has(text)) continue;
    seen.add(text);
    out.push({ tag: LanguageService.t('swatch.warnCheckTag'), text, severe: false });
  }
  return out;
}
