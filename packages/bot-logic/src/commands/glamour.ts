/**
 * /glamour Command — Business Logic (Glamour Reader Directions, turn 1, 2a)
 *
 * Reads a `.chara` file as a glamour: every worn piece, the dyes on it, and
 * whether the game lets it be worn that way. The resolve answer and the
 * in-game rules are the web reader's (api-worker `POST /v1/chara/resolve`,
 * core `chara-twins`); only the output is new. Each piece is named as the
 * twin the default rule picks — the first that passes, preferring a dyeable
 * one, then not Dated — so a list never names an item the file's character
 * can't wear.
 *
 * The picture shows the look: the dyed pieces in slot order, five at most,
 * with the verdict in the right column. The embed carries the list: every
 * piece in the GPOSERS form (English labels, the submission format), so
 * nothing past five is lost and it can be copied from Discord. No character
 * name anywhere — the header says whose file it is by producer and tribe.
 *
 * The resolver is injected: the Discord adapter calls api-worker through its
 * service binding; this module never does I/O.
 *
 * @module commands/glamour
 */

import {
  charaPieceTone,
  charaTwinsOf,
  defaultCharaTwin,
  formatCharaModelLabel,
  GPOSERS_HEADER,
  gposersGroups,
  parseCharaFile,
  resolveCharaColors,
  type CharaGearModel,
  type CharaGearSlotId,
  type CharaPieceProblem,
  type CharaPieceTone,
  type CharaTwin,
  type CharaTwinRules,
  type GposersInput,
  type ResolvedCharaCharacter,
} from '@xivdyetools/core';
import type { Race, RaceKey } from '@xivdyetools/types';
import { generateGlamourCard, type GlamourCardRow } from '@xivdyetools/svg';
import { createTranslator, type LocaleCode, type Translator, type TranslatorLogger } from '../i18n/index.js';
import { dyeService } from '../input-resolution.js';
import { getLocalizedDyeName, getLocalizedRace, initializeLocale } from '../localization.js';
import { genderSymbol, getCharacterColors, producerToken, tribeDisplay } from './chara-identity.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Types
// ============================================================================

/** Item names as api-worker answers them: ko / zh only when the regional tables know the item. */
export interface GlamourItemNames {
  en: string;
  ja: string;
  de: string;
  fr: string;
  ko?: string;
  zh?: string;
}

/** One requested slot of the resolve answer (the fields this command reads). */
export interface GlamourResolvedItem {
  itemId: number;
  names: GlamourItemNames;
  alternates: ReadonlyArray<{ itemId: number; names: GlamourItemNames; acquisition?: string }>;
  /** Rows sharing this look — the whole family, past the named alternates' cap */
  familySize?: number;
  /** OffHand only: the off-hand model is the main weapon's own (quiver, focus…) */
  viaMainHand?: boolean;
  rules?: CharaTwinRules[];
  /** The item's GPOSERS acquisition line (api-worker ≥ 0.15.0) */
  acquisition?: string;
}

export interface GlamourResolveAnswer {
  /** `null` = the model has no Item row (NPC / prop model) */
  items: Partial<Record<CharaGearSlotId, GlamourResolvedItem | null>>;
  glasses?: { names: GlamourItemNames } | null;
}

/** Resolves the worn models; the adapter supplies the transport. */
export type GlamourResolver = (gear: CharaGearModel[], glassesId: number | null) => Promise<GlamourResolveAnswer>;

export interface GlamourInput {
  /** Raw text of the .chara attachment */
  fileText: string;
  locale: LocaleCode;
  resolve: GlamourResolver;
  theme?: 'dark' | 'light';
  /**
   * Whether the card's fonts can draw a string. Item names come from the game
   * data at run time and the CJK fonts are subsets, so a name the fonts can't
   * draw goes on the card in English; the embed keeps the localized name.
   * Absent = everything is drawable.
   */
  canDraw?: (text: string) => boolean;
  /** Surfaces Translator missing-key warnings. Any `{ warn(msg) }`. */
  logger?: TranslatorLogger;
}

export type GlamourResult =
  | { ok: true; svgString: string; embed: EmbedData }
  | {
      ok: false;
      error: 'PARSE_FAILED' | 'NO_GEAR' | 'RESOLVE_FAILED' | 'RESOLVE_BUSY' | 'GENERATION_FAILED';
      errorMessage: string;
    };

// ============================================================================
// Internals
// ============================================================================

const ROW_CAP = 5;

/** GPOSERS order: weapons, armour, accessories, the right ring before the left. */
const SLOT_ORDER: readonly CharaGearSlotId[] = [
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
  'RightRing',
  'LeftRing',
];

/**
 * Each race's `EquipRaceCategory` column (core's `CHARA_WEAR_RACE_COLUMNS`
 * order; wear-mask bits `2 * column` and `2 * column + 1`) and its locale key.
 * Keyed by our `Race` identifier, never the sheet's column spelling — the
 * sheet writes `Miqote`, the parser answers `Miqo'te` — so a race is compared
 * by identity and the compiler holds the table to every race.
 */
const WEAR_RACES: Record<Race, { column: number; key: RaceKey }> = {
  Hyur: { column: 0, key: 'hyur' },
  Elezen: { column: 1, key: 'elezen' },
  Lalafell: { column: 2, key: 'lalafell' },
  "Miqo'te": { column: 3, key: 'miqote' },
  Roegadyn: { column: 4, key: 'roegadyn' },
  AuRa: { column: 5, key: 'auRa' },
  Hrothgar: { column: 6, key: 'hrothgar' },
  Viera: { column: 7, key: 'viera' },
};

/** Slot → its card short (literal keys, so the i18n orphan gate can see them). */
const SLOT_KEYS: Record<CharaGearSlotId, string> = {
  MainHand: 'card.glamourSlot.MainHand',
  OffHand: 'card.glamourSlot.OffHand',
  HeadGear: 'card.glamourSlot.HeadGear',
  Body: 'card.glamourSlot.Body',
  Hands: 'card.glamourSlot.Hands',
  Legs: 'card.glamourSlot.Legs',
  Feet: 'card.glamourSlot.Feet',
  Ears: 'card.glamourSlot.Ears',
  Neck: 'card.glamourSlot.Neck',
  Wrists: 'card.glamourSlot.Wrists',
  RightRing: 'card.glamourSlot.RightRing',
  LeftRing: 'card.glamourSlot.LeftRing',
};

/** Discord's embed description limit, with room for the closing lines. */
const EMBED_BUDGET = 4000;

const SHARE_URL = 'https://xivdyetools.app/glamour';

interface PieceDye {
  channel: 1 | 2;
  name: string;
  hex: string | null;
  stainId: number;
}

interface Piece {
  slot: CharaGearSlotId;
  dyes: PieceDye[];
  /** The twin the list names (localized), or the model label when there is no item */
  name: string;
  /** The same twin's English name — the card's fallback when the fonts can't draw `name` */
  nameEn: string;
  /** Other items with the same look */
  twins: number;
  tone: CharaPieceTone;
  status: string;
  acquisition: string | null;
  /** A twin fixed this: the lowest row's problem and name */
  fixed: { problem: CharaPieceProblem; other: string } | null;
  /** Nothing fixes this */
  blocked: CharaPieceProblem | null;
  company: boolean;
}

function localName(names: GlamourItemNames, locale: LocaleCode): string {
  return (names as unknown as Record<string, string | undefined>)[locale] ?? names.en;
}

/**
 * A wear mask that admits exactly one race (either gender) names it — unless
 * that is the character's own race, when what blocks the piece is gender and
 * "VIERA" would tell a Viera man nothing. Otherwise null.
 */
function onlyOtherRace(mask: number | null, race: Race | null): RaceKey | null {
  if (mask === null) return null;
  const allowed = Object.values(WEAR_RACES).filter(({ column }) => ((mask >> (2 * column)) & 0b11) !== 0);
  if (allowed.length !== 1 || (race !== null && allowed[0] === WEAR_RACES[race])) return null;
  return allowed[0].key;
}

function blockedStatus(
  twin: CharaTwin<GlamourItemNames>,
  race: Race | null,
  t: Translator,
  locale: LocaleCode
): string {
  const problem = twin.problems[0];
  if (problem === 'wear') {
    const other = onlyOtherRace(twin.rules?.wearMask ?? null, race);
    return other ? getLocalizedRace(other, locale).toLocaleUpperCase(locale) : t.t('card.glamourStatusWear');
  }
  if (problem === 'dye') return t.t('card.glamourStatusDye');
  return t.t('card.glamourStatusGlamour');
}

function readPiece(
  slot: CharaGearSlotId,
  model: CharaGearModel,
  item: GlamourResolvedItem | null,
  dyes: PieceDye[],
  character: Pick<ResolvedCharaCharacter, 'race' | 'gender'>,
  t: Translator,
  locale: LocaleCode
): Piece {
  if (!item) {
    return {
      slot,
      dyes,
      name: t.t('card.glamourNoItemName', { key: formatCharaModelLabel(model) }),
      nameEn: t.t('card.glamourNoItemName', { key: formatCharaModelLabel(model) }),
      twins: 0,
      tone: 'block',
      status: '—',
      acquisition: null,
      fixed: null,
      blocked: 'noItem',
      company: false,
    };
  }
  const dyedChannel = dyes.reduce((max, d) => Math.max(max, d.channel), 0);
  const twins = charaTwinsOf(item, dyedChannel, { race: character.race, gender: character.gender });
  const picked = defaultCharaTwin(twins);
  const tone = charaPieceTone(twins, picked);
  const lowest = twins[0];
  const status =
    tone === 'fix'
      ? t.t('card.glamourStatusTwin')
      : tone === 'block'
        ? blockedStatus(picked, character.race, t, locale)
        : t.t('card.glamourStatusOk');
  return {
    slot,
    dyes,
    name: localName(picked.names, locale),
    nameEn: picked.names.en,
    // The whole family, as the web counts it — not just the named alternates
    twins: (item.familySize ?? twins.length) - 1,
    tone,
    status,
    acquisition: picked.acquisition ?? null,
    fixed:
      tone === 'fix' && lowest && lowest.problems[0]
        ? { problem: lowest.problems[0], other: localName(lowest.names, locale) }
        : null,
    blocked: tone === 'block' ? (picked.problems[0] ?? null) : null,
    company: (picked.rules?.grandCompany ?? 0) > 0,
  };
}

const FIXED_KEYS: Record<CharaPieceProblem, string> = {
  dye: 'card.glamourFixedDye',
  glamour: 'card.glamourFixedGlamour',
  wear: 'card.glamourFixedWear',
  noItem: 'card.glamourFixedWear',
};

const BLOCKED_KEYS: Record<CharaPieceProblem, string> = {
  dye: 'card.glamourBlockedDye',
  glamour: 'card.glamourBlockedGlamour',
  wear: 'card.glamourBlockedWear',
  noItem: 'card.glamourBlockedNoItem',
};

/**
 * Keep an item name or acquisition line from turning into Discord formatting.
 * Both come from api-worker, never the file, so this escapes the formatting
 * characters only — not the parentheses and brackets `escapeDiscordMarkdown`
 * guards against masked links, which would reach a copied list as backslashes
 * ("Crafted \(WVR Lvl. 1\)").
 */
function plain(text: string): string {
  return text.replace(/([*_~`|\\])/g, '\\$1');
}

/**
 * Every piece in the GPOSERS form — core's model (`chara-gposers`), the one
 * the web reader renders too — with Discord-bold labels and no blank lines.
 */
function gposersList(pieces: Piece[], glasses: string | null): string[] {
  const input: GposersInput = {};
  for (const piece of pieces) {
    const dye = (channel: 1 | 2): string | null => piece.dyes.find((d) => d.channel === channel)?.name ?? null;
    input[piece.slot] = { name: piece.name, dye1: dye(1), dye2: dye(2), acquisition: piece.acquisition };
  }
  if (glasses) input.Facewear = { name: glasses };
  const lines = [`**${GPOSERS_HEADER}**`];
  for (const group of gposersGroups(input)) {
    for (const line of group) {
      const label = line.bold ? `**${line.label}**` : line.label;
      lines.push(line.value ? `${label} ${plain(line.value)}` : label);
    }
  }
  return lines;
}

// ============================================================================
// Command
// ============================================================================

/** Execute the /glamour command against a .chara file's text. */
export async function executeGlamour(input: GlamourInput): Promise<GlamourResult> {
  const { locale } = input;
  const t = createTranslator(locale, input.logger);
  await initializeLocale(locale);

  let character: ResolvedCharaCharacter;
  try {
    character = await resolveCharaColors(parseCharaFile(input.fileText), getCharacterColors(), dyeService);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: 'PARSE_FAILED', errorMessage: t.t('card.swatchParseError', { message }) };
  }
  // The nickname never leaves this function (PRIVACY_POLICY §3)
  const { gearModels, gearDyes, glassesId, race, gender, tribe, producer } = character;

  if (gearModels.length === 0) {
    return { ok: false, error: 'NO_GEAR', errorMessage: t.t('card.glamourNoGear') };
  }

  let answer: GlamourResolveAnswer;
  try {
    answer = await input.resolve(gearModels, glassesId);
  } catch (error) {
    // A 429 is api-worker's service bucket, full for a minute — busy, not broken
    if ((error as { status?: unknown } | null)?.status === 429) {
      return { ok: false, error: 'RESOLVE_BUSY', errorMessage: t.t('card.glamourResolveBusy') };
    }
    return { ok: false, error: 'RESOLVE_FAILED', errorMessage: t.t('card.glamourResolveFailed') };
  }

  try {
    const pieces: Piece[] = [];
    for (const slot of SLOT_ORDER) {
      const model = gearModels.find((m) => m.slot === slot);
      if (!model) continue;
      const item = answer.items[slot] ?? null;
      // The main weapon's own off-hand model is the main weapon, not a piece
      if (slot === 'OffHand' && item?.viaMainHand) continue;
      const dyes: PieceDye[] = gearDyes
        .filter((g) => g.slot === slot)
        .sort((a, b) => a.channel - b.channel)
        .map((g) => ({
          channel: g.channel,
          stainId: g.stainId,
          hex: g.dye?.hex ?? null,
          name: g.dye ? getLocalizedDyeName(g.dye.itemID, g.dye.name, locale) : `#${g.stainId}`,
        }));
      pieces.push(readPiece(slot, model, item, dyes, { race, gender }, t, locale));
    }

    const dyed = pieces.filter((p) => p.dyes.length > 0);
    const listed = dyed.length > 0 ? dyed : pieces;
    const rows = listed.slice(0, ROW_CAP);

    const uniqueDyes = new Map<number, string | null>();
    for (const p of dyed) for (const d of p.dyes) if (!uniqueDyes.has(d.stainId)) uniqueDyes.set(d.stainId, d.hex);
    const stripHexes = [...uniqueDyes.values()].filter((h): h is string => h !== null);

    const count = dyed.length > 0 ? t.tc('card.glamourPieces', dyed.length, { n: dyed.length }) : t.tc('card.glamourWorn', pieces.length, { n: pieces.length });
    const dyeCount = uniqueDyes.size > 0 ? t.tc('card.glamourDyes', uniqueDyes.size, { n: uniqueDyes.size }) : t.t('card.glamourNoDyes');
    const fixes = listed.filter((p) => p.tone === 'fix').length;
    const blocks = listed.filter((p) => p.tone === 'block').length;
    const footKey = [
      dyed.length > 0
        ? t.tc('card.glamourFootShown', listed.length, { s: rows.length, n: listed.length })
        : t.tc('card.glamourFootShownWorn', listed.length, { s: rows.length, n: listed.length }),
      fixes > 0 ? t.tc('card.glamourFootTwins', fixes, { n: fixes }) : null,
      blocks > 0 ? t.tc('card.glamourFootBlocked', blocks, { n: blocks }) : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const canDraw = input.canDraw ?? ((): boolean => true);
    const cardRows: GlamourCardRow[] = rows.map((p) => ({
      slotLabel: t.t(SLOT_KEYS[p.slot]),
      lookLabel: p.twins > 0 ? t.t('card.glamourLooks', { n: p.twins }) : t.t('card.glamourOneLook'),
      twins: p.twins,
      tone: p.tone,
      name: canDraw(p.name) ? p.name : p.nameEn,
      dyes: p.dyes.filter((d) => d.hex !== null).map((d) => ({ hex: d.hex!, name: d.name })),
      status: p.status,
    }));

    const svgString = generateGlamourCard({
      stripHexes,
      charSub: [producerToken(producer), [tribeDisplay(tribe), genderSymbol(gender)].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(' · '),
      title: count,
      titleExtra: dyeCount,
      rows: cardRows,
      footKey,
      lang: locale,
      theme: input.theme,
    });

    // The embed carries the whole list and what the picture can't say
    const glasses = glassesId && answer.glasses ? localName(answer.glasses.names, locale) : null;
    const list = gposersList(pieces, glasses);
    const notes: string[] = [];
    const fixed = pieces.filter((p) => p.fixed);
    if (fixed.length > 0) {
      notes.push(
        `${t.t('card.glamourNamedLead')} ${fixed
          .map((p) => t.t(FIXED_KEYS[p.fixed!.problem], { name: plain(p.name), other: plain(p.fixed!.other) }))
          .join(' · ')}`
      );
    }
    const blocked = pieces.filter((p) => p.blocked);
    if (blocked.length > 0) {
      notes.push(
        `${t.t('card.glamourBlockedLead')} ${blocked.map((p) => t.t(BLOCKED_KEYS[p.blocked!], { name: plain(p.name) })).join(' · ')}`
      );
    }
    const company = pieces.filter((p) => p.company);
    if (company.length > 0) {
      notes.push(t.t('card.glamourCompany', { list: company.map((p) => plain(p.name)).join(' · ') }));
    }
    notes.push(`${t.t('card.glamourManual')} \`/manual topic:👤\``, SHARE_URL);

    const tail = notes.join('\n');
    let body = list.join('\n');
    if (body.length + tail.length + 2 > EMBED_BUDGET) {
      body = `${body.slice(0, body.lastIndexOf('\n', EMBED_BUDGET - tail.length - 4))}\n…`;
    }

    const first = stripHexes[0];
    const embed: EmbedData = {
      title: `${t.t('card.glamourTitle')} · ${count}`,
      description: `${body}\n\n${tail}`,
      color: first ? parseInt(first.replace('#', ''), 16) : 0xea4133,
    };

    return { ok: true, svgString, embed };
  } catch {
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: t.t('errors.generationFailed') };
  }
}
