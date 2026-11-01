/**
 * /swatch Command — Business Logic (5.0 character-file frame)
 *
 * Reads a `.chara` file through core's library-backed facade
 * (`inspectCharaForTools` → `resolveCharaForTools`: field states, gamma on
 * the floats, activation, the lip composite and the eye-pair correction are
 * the library's) and renders the confirmed character sheet: matched slots
 * only, each on the suite's measured row with a shaped lead (slot short over
 * grid address, OFF GRID in amber). Past five rows the SAFEST match drops
 * (/contrast's tail rule) — both orders show the same five rows.
 *
 * A slot is matched only through the projection's `matchHex` (confirmed
 * active and resolved), never a fallback to `displayHex` or a preview colour:
 * unknown activation, an inactive control and an unresolved colour give no
 * row, no `slot:` target and no strip colour. A live lip matches its
 * composite (`lipComposite?.hex ?? matchHex`), still gated on `matchHex`.
 *
 * `slot:` routes to the other confirmed shape: 14J·2 with the slot's winning
 * colour as target. The chip stays /SWATCH for every route.
 *
 * What the PNG deliberately leaves to the embed: the OFF-GRID hex pair, the
 * lip raw-vs-blend, worn gear dyes (already stain IDs — a text list), the
 * dropped-slot note, and the /manual pointer.
 *
 * @module commands/swatch
 */

import {
  ColorService,
  type CharaSlotId,
  type ImportedCharaCharacter,
  type ImportedCharaSlot,
  type ResolvedCharaCharacter,
  type ResolvedCharaSlot,
} from '@xivdyetools/core';
import type { Dye } from '@xivdyetools/types';
import { createTranslator, type LocaleCode, type TranslatorLogger } from '../i18n/index.js';
import {
  cardTheme,
  generateNearestSheet,
  generateSwatchCard,
  num,
  toolGlyph,
  type NearestSheetRow,
  type SwatchCardRow,
} from '@xivdyetools/svg';
import { dyeService } from '../input-resolution.js';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
import { failureKind } from './failure-kind.js';
import type { EmbedData } from './types.js';
import { genderSymbol, producerToken, readCharaForTools, tribeDisplay } from './chara-identity.js';

// ============================================================================
// Types
// ============================================================================

export type SwatchSlotOption =
  | 'skin'
  | 'hair'
  | 'highlights'
  | 'eyes'
  | 'lip'
  | 'facepaint'
  | 'limbal';

export interface SwatchInput {
  /**
   * Optional logger — surfaces Translator missing-key warnings, which are
   * otherwise silent (2026-08-20 i18n audit, F-13). Any `{ warn(msg) }`.
   */
  logger?: TranslatorLogger;
  /**
   * Raw text of the .chara attachment. Optional since `fileBytes` exists;
   * with neither, the result is PARSE_FAILED.
   */
  fileText?: string;
  /**
   * The capped attachment bytes as received. Preferred over `fileText`, so
   * invalid UTF-8 is refused by the reader instead of being re-encoded.
   */
  fileBytes?: Uint8Array;
  /** slots (file order, default) | hardest (worst-first) — same five rows */
  order?: 'slots' | 'hardest';
  /** Routes to 14J·2 with this slot's winning colour as target */
  slot?: SwatchSlotOption;
  locale: LocaleCode;
  theme?: 'dark' | 'light';
}

/**
 * A resolved character as this module lets it leave: the Ktisis nickname is
 * gone from the TYPE, not just the runtime object, so no branch of
 * `executeSwatch` can read it into a card or an embed (PRIVACY_POLICY §3 —
 * players use their real name there).
 *
 * Each slot's `verdict` describes the colour; it is not a matching gate. The
 * card matches only confirmed-active, resolved colours, and a slot outside
 * that rule (unknown activation included, which reads `inert` with no
 * `inertReason`) carries no `indexHex`, `floatHex`, `gridAddress` or
 * `blendHex`, so no colour the card excludes can be matched from here.
 *
 * @deprecated Since 4.12.0. Use svgString/embed for presentation. Planned removal in bot-logic 5.0.0 after the published minor and consumer-acceptance gates in DEPRECATIONS.md.
 */
export type SwatchCharacter = Omit<ResolvedCharaCharacter, 'nickname'>;

export type SwatchResult =
  | {
      ok: true;
      svgString: string;
      embed: EmbedData;
      /**
       * Never carries the character's name — see PRIVACY_POLICY §3.
       * @deprecated Since 4.12.0. Use svgString/embed for presentation. Planned removal in bot-logic 5.0.0 after the published minor and consumer-acceptance gates in DEPRECATIONS.md.
       */
      character: SwatchCharacter;
    }
  | {
      ok: false;
      error: 'PARSE_FAILED' | 'NO_LIVE_SLOTS' | 'SLOT_MISSING' | 'GENERATION_FAILED';
      errorMessage: string;
    };

// ============================================================================
// Internals
// ============================================================================

const ROW_CAP = 5;

/** kind → slot-short locale key (leftEye/rightEye share the eyes label). */
const SLOT_KEYS: Record<ImportedCharaSlot['kind'], string> = {
  skin: 'card.slotSkin',
  hair: 'card.slotHair',
  highlights: 'card.slotHl',
  leftEye: 'card.slotEyes',
  rightEye: 'card.slotEyes',
  lip: 'card.slotLip',
  facePaint: 'card.slotPaint',
  tattoo: 'card.slotTattoo',
  // the race is unknown: a limbal ring only on Au Ra, so it reads as a tattoo
  limbalOrTattoo: 'card.slotTattoo',
  limbal: 'card.slotLimbal',
};

/** The slot: option → parser slot ids, in preference order. */
const SLOT_OPTION_IDS: Record<SwatchSlotOption, CharaSlotId[]> = {
  skin: ['skin'],
  hair: ['hair'],
  highlights: ['highlights'],
  eyes: ['leftEye', 'rightEye'],
  lip: ['lip'],
  facepaint: ['facePaint'],
  limbal: ['limbal'],
};

/**
 * The slot: option → its name in a sentence. The card labels above are short
 * upper-case column heads ("HL", "TATT."), so the refusal has its own set.
 */
const SLOT_OPTION_NAME_KEYS: Record<SwatchSlotOption, string> = {
  skin: 'card.swatchSlotName.skin',
  hair: 'card.swatchSlotName.hair',
  highlights: 'card.swatchSlotName.highlights',
  eyes: 'card.swatchSlotName.eyes',
  lip: 'card.swatchSlotName.lip',
  facepaint: 'card.swatchSlotName.facepaint',
  limbal: 'card.swatchSlotName.limbal',
};

/**
 * The colour a slot is matched against, or null when it takes no part in
 * matching. The gate is the projection's `matchHex` alone (confirmed active,
 * resolved) — never `displayHex` or a preview. A lip matches its live blend:
 * the library composites only over live extended data, so a lip without one
 * matches its own colour.
 */
function winningHex(slot: ImportedCharaSlot): string | null {
  if (slot.matchHex === null) return null;
  if (slot.slot === 'lip') return slot.lipComposite?.hex ?? slot.matchHex;
  return slot.matchHex;
}

/** The float won the slot: OFF GRID, or a colour with no palette index. */
function floatWon(slot: ImportedCharaSlot): boolean {
  return slot.interpretation === 'offGrid' || slot.interpretation === 'extendedOnly';
}

/**
 * A colour the file stores whose activation it does not state (a missing,
 * null or invalid `EnableHighlights` / `FacePaint` / `Mouth`). Keyed on
 * `active === null`, never on the library's reason: an all-zero extended
 * block reads `ambiguousZeroBlock`, not `activityUnknown`. A slot with no
 * colour at all is nothing to explain.
 */
function isActivityUnknown(slot: ImportedCharaSlot): boolean {
  return slot.active === null && slot.displayHex !== null;
}

/**
 * The unresolved reasons that mean the file stored a colour the reader could
 * not use: an invalid or out-of-range index (the 96-127 lip / face-paint gap
 * included), a palette index with no clan / gender (or, for a lip, no race)
 * to pick its sheet, and an index or live float the palettes have no entry
 * for. `missingColor` is not here — it is a slot the file leaves empty, unless
 * the colour it stores is malformed (below) — and neither is any inactive
 * reason: an explicitly disabled control, a lip of opacity zero and a
 * Hrothgar fur pattern are not failures.
 */
const UNUSABLE_REASONS: ReadonlySet<ImportedCharaSlot['reason']> = new Set<ImportedCharaSlot['reason']>([
  'invalidIndex',
  'indexOutOfRange',
  'missingTribeGender',
  'missingRace',
  'missingPaletteEntry',
  'missingShaderReference',
]);

/** Each slot's extended colour field (face paint has none), as a diagnostic path names it. */
const COLOUR_FIELDS: Record<CharaSlotId, string | null> = {
  leftEye: 'LeftEyeColor',
  rightEye: 'RightEyeColor',
  hair: 'HairColor',
  highlights: 'HairHighlight',
  skin: 'SkinColor',
  limbal: 'LimbalRingColor',
  lip: 'MouthColor',
  facePaint: null,
};

/** The reader's codes for a stored field it refused: wrong type, malformed or unknown value. */
const REFUSED_FIELD_CODES: ReadonlySet<string> = new Set(['INVALID_FIELD', 'UNSUPPORTED_VALUE']);

/**
 * A colour the file holds but that could not be used, so it gives no row:
 * an unresolved slot for one of `UNUSABLE_REASONS`, or an unresolved
 * `missingColor` slot whose only colour, its extended float, was refused as
 * malformed. Keyed on the projection's reason and fixed issue codes, never on
 * the library's message. A slot that still matched (a malformed float beside
 * a valid index) is not reported: its colour was matched.
 */
function isUnusable(slot: ImportedCharaSlot, issues: NamelessCharacter['issues']): boolean {
  if (slot.interpretation !== 'unresolved') return false;
  if (UNUSABLE_REASONS.has(slot.reason)) return true;
  const field = COLOUR_FIELDS[slot.slot];
  return (
    slot.reason === 'missingColor' &&
    field !== null &&
    issues.some((i) => REFUSED_FIELD_CODES.has(i.code) && i.path.length === 1 && i.path[0] === field)
  );
}

/** Full-scan best dye by ΔE2000 (schema v2 has no Facewear entries). */
function nearestDye(hex: string): { dye: Dye; deltaE: number } {
  let best: { dye: Dye; deltaE: number } | null = null;
  for (const dye of dyeService.getAllDyes()) {
    const deltaE = ColorService.getDistanceForMethod(hex, dye.hex, 'ciede2000');
    if (!best || deltaE < best.deltaE) best = { dye, deltaE };
  }
  return best!;
}

/** The projection without its nickname — see `withoutNickname`. */
type NamelessCharacter = Omit<ImportedCharaCharacter, 'nickname'>;

/**
 * Strips the Ktisis nickname the moment the file is projected — nothing in
 * this module reads a record that still has one, and `SwatchResult.character`
 * must never carry the character's name (PRIVACY_POLICY §3).
 */
function withoutNickname(character: ImportedCharaCharacter): NamelessCharacter {
  const { nickname, ...safeCharacter } = character;
  void nickname;
  return safeCharacter;
}

type LegacyVerdict = ResolvedCharaSlot['verdict'];
type LegacyInertReason = NonNullable<ResolvedCharaSlot['inertReason']>;
type LegacyError = NonNullable<ResolvedCharaSlot['error']>;

const LEGACY_VERDICTS: Record<ImportedCharaSlot['interpretation'], LegacyVerdict> = {
  palette: 'index',
  offGrid: 'offGrid',
  extendedOnly: 'floatOnly',
  inactive: 'inert',
  unresolved: 'error',
};

/** The library's inactive reasons the legacy union can name (`lipDisabled` is a lip turned off: `noLip`). */
const LEGACY_INERT_REASONS: Partial<Record<ImportedCharaSlot['reason'], LegacyInertReason>> = {
  highlightsDisabled: 'highlightsDisabled',
  facePaintNone: 'facePaintNone',
  furPattern: 'furPattern',
  noLip: 'noLip',
  lipDisabled: 'noLip',
};

/**
 * The legacy error of an unresolved slot. Fixed text, never a stored value:
 * the 96-127 gap keys on the adapter's `indexGap` (which covers a fraction
 * such as 96.5), never on the index itself.
 */
function legacyError(slot: ImportedCharaSlot): LegacyError | undefined {
  if (slot.indexGap) {
    return {
      code: 'midRangeIndex',
      message: 'index falls in the 96-127 gap between the dark (0-95) and light (128-223) ranges',
    };
  }
  switch (slot.reason) {
    case 'invalidIndex':
    case 'indexOutOfRange':
    case 'missingPaletteEntry':
      return { code: 'indexOutOfRange', message: 'index has no entry in its colour sheet' };
    case 'missingTribeGender':
    case 'missingRace':
      return { code: 'noTribe', message: 'needs Tribe and Gender to resolve its race-specific sheet' };
    default:
      return undefined;
  }
}

/**
 * One projected slot in the legacy `ResolvedCharaSlot` shape, as the old
 * resolver's readers read it:
 * - `verdict` from the interpretation (palette → index, offGrid, extendedOnly
 *   → floatOnly, inactive → inert, unresolved → error), except that a slot
 *   with no usable colour (`missingColor`: no palette index and no live
 *   float) stays `inert`, as the legacy resolver answered an absent key — it
 *   is not a failure — and a slot of unknown activation (`active === null`)
 *   is `inert` with no `inertReason`, since nothing says it is switched off;
 * - with a `matchHex`: `indexHex` = the creator swatch, `floatHex` = the
 *   effective (eye-pair corrected) extended colour, `blendHex` = the live lip
 *   composite. Without one, those three and `gridAddress` are null, as the
 *   old resolver's inert slots were: the legacy shape carries no colour the
 *   matching rule excludes;
 * - `kind` `limbalOrTattoo` (race unknown) → `tattoo`, the legacy non-Au Ra kind.
 * This module never matches by verdict, only by `matchHex`.
 */
function toLegacySlot(slot: ImportedCharaSlot): ResolvedCharaSlot {
  const verdict: LegacyVerdict =
    slot.active === null || (slot.interpretation === 'unresolved' && slot.reason === 'missingColor')
      ? 'inert'
      : LEGACY_VERDICTS[slot.interpretation];
  const matched = slot.matchHex !== null;
  const legacy: ResolvedCharaSlot = {
    slot: slot.slot,
    kind: slot.kind === 'limbalOrTattoo' ? 'tattoo' : slot.kind,
    verdict,
    index: slot.index,
    sheetIndex: slot.sheetIndex,
    sheetVariant: slot.variant,
    gridAddress: matched ? slot.gridAddress : null,
    indexHex: matched ? slot.creatorHex : null,
    floatHex: matched ? (slot.effectiveExtendedHex ?? slot.extendedHex) : null,
    deltaE: slot.deltaE,
    alpha: slot.alpha,
    blendHex: matched ? (slot.lipComposite?.hex ?? null) : null,
  };
  const inertReason = verdict === 'inert' && slot.active !== null ? LEGACY_INERT_REASONS[slot.reason] : undefined;
  if (inertReason) legacy.inertReason = inertReason;
  const error = verdict === 'error' ? legacyError(slot) : undefined;
  if (error) legacy.error = error;
  // A float the file stores that is not live: the index wins, and says so
  if (verdict === 'index' && slot.extendedHex !== null && !slot.extendedActive) {
    legacy.indexWinNote = 'extendedMissing';
  }
  return legacy;
}

/**
 * `SwatchResult.character` keeps its published shape
 * (`Omit<ResolvedCharaCharacter, 'nickname'>`): the projection mapped back
 * slot by slot, its diagnostics (`issues`) left behind.
 */
function toSwatchCharacter(character: NamelessCharacter): SwatchCharacter {
  const { issues, slots, ...rest } = character;
  void issues;
  return { ...rest, slots: slots.map(toLegacySlot) };
}

interface LiveRow {
  slot: ImportedCharaSlot;
  label: string;
  addr: string;
  addrWarn: boolean;
  sourceHex: string;
  dye: Dye;
  deltaE: number;
}

// ============================================================================
// Execute
// ============================================================================

/** Execute the /swatch command against a .chara file's text. */
export async function executeSwatch(input: SwatchInput): Promise<SwatchResult> {
  const { locale } = input;
  const t = createTranslator(locale, input.logger);
  await initializeLocale(locale);

  // Neutral, localized title for the card and every embed — never the
  // character's name or the attachment filename (PRIVACY_POLICY §3).
  const title = t.t('card.swatchTitle');

  // The nickname is stripped the moment the file is projected: neither
  // `projected` nor `character` has a `nickname` member, so nothing below can
  // print one.
  let projected: NamelessCharacter;
  let character: SwatchCharacter;
  try {
    projected = withoutNickname(await readCharaForTools(input));
    character = toSwatchCharacter(projected);
  } catch (error) {
    // The try runs the projection, the nickname strip and the legacy mapping
    // too, so a bot-side bug lands here as well: log the class and code (a
    // reader refusal's fixed code, e.g. DUPLICATE_KEY or INVALID_UTF8), never
    // the message.
    input.logger?.warn(`[swatch] parse failed: ${failureKind(error)}`);
    // HC-002: the parser's reason is English, so the reply gives a localized one
    return {
      ok: false,
      error: 'PARSE_FAILED',
      errorMessage: t.t('card.swatchParseError', { message: t.t('card.charaFileReason.unreadable') }),
    };
  }

  try {
    // Matched rows in file order; merged eyes are one row, heterochromia two.
    const leftEye = projected.slots.find((s) => s.slot === 'leftEye');
    const rightEye = projected.slots.find((s) => s.slot === 'rightEye');
    const leftHex = leftEye ? winningHex(leftEye) : null;
    const rightHex = rightEye ? winningHex(rightEye) : null;
    const mergeEyes = leftHex !== null && rightHex !== null && leftHex.toUpperCase() === rightHex.toUpperCase();
    const rows: LiveRow[] = [];
    for (const slot of projected.slots) {
      const hex = winningHex(slot);
      if (hex === null) continue;
      if (slot.slot === 'rightEye' && mergeEyes) {
        continue;
      }

      const match = nearestDye(hex);
      const offGrid = floatWon(slot);
      const addr = offGrid ? t.t('card.offGridShort') : (slot.gridAddress ?? '—');
      // The L/R/LR eye marker rides the LABEL line, not the address line: the
      // address line's OFF-GRID token already fills its 56px budget (I18N-011
      // in @xivdyetools/svg — "OFF GRID" alone clears it by ~1.4px), so a
      // suffix there ellipsises away on an off-grid row in 5 of 6 locales
      // (BUG-006 review). The label line has real headroom for every locale's
      // slot short + "·LR" (worst case AUGEN·LR at ~60.96 of 56px once the
      // lead line's letterSpacing: 0.8 — packages/svg/src/frame.ts:582-588 —
      // is counted; textWidth/fitText don't model letter-spacing, so a bare
      // textWidth call understates it at 54.56px) regardless of on/off-grid
      // state — the ~5px overhang past the 56px budget is absorbed by the
      // 10px gutter before the swatch pair, with no collision and no
      // ellipsis, which is what makes the marker survive.
      let label = t.t(SLOT_KEYS[slot.kind]);
      if (slot.slot === 'leftEye' || slot.slot === 'rightEye') {
        if (mergeEyes) label += '·LR';
        else label += slot.slot === 'leftEye' ? '·L' : '·R';
      }
      rows.push({
        slot,
        label,
        addr,
        addrWarn: offGrid,
        sourceHex: hex,
        dye: match.dye,
        deltaE: match.deltaE,
      });
    }

    // Colours the file stores without saying whether they are switched on, and
    // colours it stores that could not be used: kept out of matching, each
    // explained in one fixed localized sentence
    const explanations: string[] = [];
    if (projected.slots.some(isActivityUnknown)) explanations.push(t.t('card.swatchActivityUnknown'));
    if (projected.slots.some((s) => isUnusable(s, projected.issues))) explanations.push(t.t('card.swatchUnusable'));

    if (rows.length === 0) {
      return {
        ok: false,
        error: 'NO_LIVE_SLOTS',
        errorMessage: [t.t('card.swatchNoSlots'), ...explanations].join('\n'),
      };
    }

    const charSub = [
      [tribeDisplay(projected.tribe, locale), genderSymbol(projected.gender)].filter(Boolean).join(' '),
      producerToken(projected.producer),
    ]
      .filter(Boolean)
      .join(' · ');
    const shareUrl = 'https://xivdyetools.app/swatch';

    // slot: routes to 14J·2 — the slot's winning colour as target
    if (input.slot) {
      const wanted = SLOT_OPTION_IDS[input.slot];
      const target = wanted
        .map((id) => rows.find((r) => r.slot.slot === id))
        .find((r) => r !== undefined);
      if (!target) {
        return {
          ok: false,
          error: 'SLOT_MISSING',
          errorMessage: t.t('card.swatchSlotMissing', {
            slot: t.t(SLOT_OPTION_NAME_KEYS[input.slot]),
          }),
        };
      }
      const nearest = dyeService
        .getAllDyes()
        .map((dye) => ({
          dye,
          deltaE: ColorService.getDistanceForMethod(target.sourceHex, dye.hex, 'ciede2000'),
        }))
        .sort((a, b) => a.deltaE - b.deltaE)
        .slice(0, ROW_CAP);
      const sheetRows: NearestSheetRow[] = nearest.map((n, i) => ({
        rank: i + 1,
        hex: n.dye.hex,
        name: getLocalizedDyeName(n.dye.itemID, n.dye.name, locale),
        deltaE: n.deltaE,
      }));
      const th = cardTheme(input.theme);
      const svgString = generateNearestSheet({
        targetHex: target.sourceHex,
        targetText: `${target.label} ${target.sourceHex.toUpperCase()}`,
        rows: sheetRows,
        labels: {
          target: t.t('card.target'),
          rank: t.t('card.rank'),
          nearest: t.t('card.found'),
          matchKey: t.t('card.matchKey'),
        },
        lang: locale,
        theme: input.theme,
        commandLabel: '/SWATCH',
        commandGlyph: toolGlyph('swatch', 'compact', {
          size: 13,
          ink: th.pillInk,
          accent: th.glyphAccent,
        }),
      });
      const embed: EmbedData = {
        title,
        description: `${target.label} \`${target.sourceHex.toUpperCase()}\`\n${shareUrl}`,
        color: parseInt(target.sourceHex.replace('#', ''), 16),
      };
      return { ok: true, svgString, embed, character };
    }

    // Tail rule: past five live slots the SAFEST match drops — both orders
    // show the same five rows.
    const totalLive = rows.length;
    const kept = [...rows];
    const dropped: LiveRow[] = [];
    while (kept.length > ROW_CAP) {
      let safest = 0;
      for (let i = 1; i < kept.length; i++) {
        if (kept[i].deltaE < kept[safest].deltaE) safest = i;
      }
      dropped.push(...kept.splice(safest, 1));
    }
    if (input.order === 'hardest') {
      kept.sort((a, b) => b.deltaE - a.deltaE);
    }

    const cardRows: SwatchCardRow[] = kept.map((r) => ({
      slotLabel: r.label,
      addr: r.addr,
      ...(r.addrWarn ? { addrWarn: true } : {}),
      sourceHex: r.sourceHex,
      dyeHex: r.dye.hex,
      name: getLocalizedDyeName(r.dye.itemID, r.dye.name, locale),
      deltaE: r.deltaE,
    }));

    const svgString = generateSwatchCard({
      stripHexes: rows.map((r) => r.sourceHex),
      charSub,
      title,
      rows: cardRows,
      labels: {
        lSlot: t.t('card.swatchSlot'),
        lNearest: t.t('card.swatchNearest'),
        footKey: t.tc('card.swatchFootKey', totalLive, { s: kept.length, n: totalLive }),
      },
      lang: locale,
      theme: input.theme,
    });

    // The embed carries what the PNG deliberately leaves out
    const lines: string[] = [];
    for (const r of rows) {
      if (r.addrWarn) {
        lines.push(
          t.t('card.swatchOffGrid', {
            slot: r.label,
            index: r.slot.creatorHex ?? '—',
            float: r.slot.effectiveExtendedHex ?? r.sourceHex,
          })
        );
      }
    }
    const lip = rows.find((r) => r.slot.slot === 'lip');
    const composite = lip?.slot.lipComposite;
    if (lip && composite && composite.alpha < 1) {
      // The color the blend was made from: the file's own only when it won the verdict.
      // An unedited file stores the shader color, which is not the swatch the blend used
      const raw = floatWon(lip.slot) ? lip.slot.effectiveExtendedHex : lip.slot.creatorHex;
      lines.push(
        t.t('card.swatchLip', {
          alpha: num(composite.alpha, locale, 2),
          raw: raw ?? '—',
          blend: composite.hex,
        })
      );
    }
    lines.push(...explanations);
    const gearNames = Array.from(
      new Set(
        projected.gearDyes
          .filter((g) => g.dye !== null)
          .map((g) => getLocalizedDyeName(g.dye!.itemID, g.dye!.name, locale))
      )
    );
    if (gearNames.length > 0) {
      lines.push(t.t('card.swatchGear', { list: gearNames.join(' · ') }));
    }
    for (const d of dropped) {
      lines.push(t.t('card.swatchDropped', { slot: d.label, de: num(d.deltaE, locale, 1) }));
    }
    lines.push(`${t.t('card.manualLead')} \`/manual topic:👤\`${t.t('card.manualTail')}`);
    lines.push(shareUrl);

    const embed: EmbedData = {
      title,
      description: lines.join('\n'),
      color: parseInt(kept[0].sourceHex.replace('#', ''), 16),
    };

    return { ok: true, svgString, embed, character };
  } catch (error) {
    // Like the read's catch above, this names the error's class only.
    input.logger?.warn(`[swatch] generation failed: ${failureKind(error)}`);
    return {
      ok: false,
      error: 'GENERATION_FAILED',
      errorMessage: t.t('errors.generationFailed'),
    };
  }
}
