/**
 * /swatch Command — Business Logic (5.0 character-file frame)
 *
 * Parses a `.chara` file with core's decided rules (key presence not
 * TypeName, gamma on the floats, flag gating, the Helions guard, never
 * Base64Image) and renders the confirmed character sheet: live slots only,
 * each on the suite's measured row with a shaped lead (slot short over grid
 * address, OFF GRID in amber). Past five live slots the SAFEST match drops
 * (/contrast's tail rule) — both orders show the same five rows.
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
  CharacterColorService,
  ColorService,
  parseCharaFile,
  resolveCharaColors,
  type CharaSlotId,
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
import type { EmbedData } from './types.js';

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
  /** Raw text of the .chara attachment */
  fileText: string;
  /** slots (file order, default) | hardest (worst-first) — same five rows */
  order?: 'slots' | 'hardest';
  /** Routes to 14J·2 with this slot's winning colour as target */
  slot?: SwatchSlotOption;
  locale: LocaleCode;
  theme?: 'dark' | 'light';
}

export type SwatchResult =
  | {
      ok: true;
      svgString: string;
      embed: EmbedData;
      /** Never carries the character's name — see PRIVACY_POLICY §3. */
      character: Omit<ResolvedCharaCharacter, 'nickname'>;
    }
  | {
      ok: false;
      error: 'PARSE_FAILED' | 'NO_LIVE_SLOTS' | 'SLOT_MISSING' | 'GENERATION_FAILED';
      errorMessage: string;
    };

// ============================================================================
// Internals
// ============================================================================

/**
 * Shared palette-sheet service (data is bundled — no I/O). Constructed on
 * first use, NOT at module load: consumer test suites mock
 * `@xivdyetools/core` minimally, and an import-time `new` breaks every suite
 * whose mock lacks the class.
 */
let characterColors: CharacterColorService | null = null;
function getCharacterColors(): CharacterColorService {
  characterColors ??= new CharacterColorService();
  return characterColors;
}

const ROW_CAP = 5;

/** kind → slot-short locale key (leftEye/rightEye share the eyes label). */
const SLOT_KEYS: Record<string, string> = {
  skin: 'card.slotSkin',
  hair: 'card.slotHair',
  highlights: 'card.slotHl',
  leftEye: 'card.slotEyes',
  rightEye: 'card.slotEyes',
  lip: 'card.slotLip',
  facePaint: 'card.slotPaint',
  tattoo: 'card.slotTattoo',
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

/** The winning colour: float when off grid, the composited blend for lip. */
function winningHex(slot: ResolvedCharaSlot): string | null {
  if (slot.slot === 'lip' && slot.blendHex) return slot.blendHex;
  if (slot.verdict === 'offGrid' || slot.verdict === 'floatOnly') {
    return slot.floatHex ?? slot.indexHex;
  }
  return slot.indexHex ?? slot.floatHex;
}

function isLive(slot: ResolvedCharaSlot): boolean {
  return (
    (slot.verdict === 'index' || slot.verdict === 'offGrid' || slot.verdict === 'floatOnly') &&
    winningHex(slot) !== null
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

/** "SeekerOfTheSun" → "SEEKER OF THE SUN". */
function tribeDisplay(tribe: string | null): string {
  if (!tribe) return '';
  return tribe.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
}

/**
 * Strips the Ktisis nickname before a character record leaves this module —
 * `SwatchResult.character` must never carry the character's name (PRIVACY_POLICY §3).
 */
function withoutNickname(
  character: ResolvedCharaCharacter
): Omit<ResolvedCharaCharacter, 'nickname'> {
  const { nickname, ...safeCharacter } = character;
  void nickname;
  return safeCharacter;
}

interface LiveRow {
  slot: ResolvedCharaSlot;
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

  let character: ResolvedCharaCharacter;
  try {
    const parsed = parseCharaFile(input.fileText);
    character = await resolveCharaColors(parsed, getCharacterColors(), dyeService);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: 'PARSE_FAILED',
      errorMessage: t.t('card.swatchParseError', { message }),
    };
  }

  try {
    // Live rows in file order; merged eyes are one row, heterochromia two.
    const rows: LiveRow[] = [];
    for (const slot of character.slots) {
      if (!isLive(slot)) continue;
      if (slot.slot === 'rightEye' && character.eyesShareIndex) continue;

      const hex = winningHex(slot)!;
      const match = nearestDye(hex);
      const offGrid = slot.verdict === 'offGrid' || slot.verdict === 'floatOnly';
      let addr = offGrid ? t.t('card.offGridShort') : (slot.gridAddress ?? '—');
      if (!offGrid && (slot.slot === 'leftEye' || slot.slot === 'rightEye')) {
        if (character.eyesShareIndex) addr += '·LR';
        else addr += slot.slot === 'leftEye' ? '·L' : '·R';
      }
      rows.push({
        slot,
        label: t.t(SLOT_KEYS[slot.kind] ?? 'card.slotSkin'),
        addr,
        addrWarn: offGrid,
        sourceHex: hex,
        dye: match.dye,
        deltaE: match.deltaE,
      });
    }

    if (rows.length === 0) {
      return { ok: false, error: 'NO_LIVE_SLOTS', errorMessage: t.t('card.swatchNoSlots') };
    }

    const genderSymbol =
      character.gender === 'Male' ? '♂' : character.gender === 'Female' ? '♀' : '';
    const charSub = [
      [tribeDisplay(character.tribe), genderSymbol].filter(Boolean).join(' '),
      character.producer ? character.producer.toUpperCase() : null,
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
          errorMessage: t.t('card.swatchSlotMissing', { slot: input.slot }),
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
        title: t.t('card.swatchTitle'),
        description: `${target.label} \`${target.sourceHex.toUpperCase()}\`\n${shareUrl}`,
        color: parseInt(target.sourceHex.replace('#', ''), 16),
      };
      return { ok: true, svgString, embed, character: withoutNickname(character) };
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
      title: t.t('card.swatchTitle'),
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
            index: r.slot.indexHex ?? '—',
            float: r.slot.floatHex ?? r.sourceHex,
          })
        );
      }
    }
    const lip = rows.find((r) => r.slot.slot === 'lip');
    if (lip && lip.slot.alpha !== null && lip.slot.alpha < 1 && lip.slot.blendHex) {
      lines.push(
        t.t('card.swatchLip', {
          alpha: num(lip.slot.alpha, locale, 2),
          raw: lip.slot.floatHex ?? lip.slot.indexHex ?? '—',
          blend: lip.slot.blendHex,
        })
      );
    }
    const gearNames = Array.from(
      new Set(
        character.gearDyes
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
      title: t.t('card.swatchTitle'),
      description: lines.join('\n'),
      color: parseInt(kept[0].sourceHex.replace('#', ''), 16),
    };

    return { ok: true, svgString, embed, character: withoutNickname(character) };
  } catch {
    return {
      ok: false,
      error: 'GENERATION_FAILED',
      errorMessage: t.t('errors.generationFailed'),
    };
  }
}
