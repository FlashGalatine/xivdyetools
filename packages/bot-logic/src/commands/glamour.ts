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
  GPOSERS_ACQUISITION_LABEL,
  gposersGroups,
  gposersOmittedSlots,
  type CharaGearModel,
  type CharaGearSlotId,
  type CharaImportIssue,
  type CharaPieceProblem,
  type CharaPieceTone,
  type CharaTwin,
  type CharaTwinRules,
  type GposersInput,
  type GposersSlotFacts,
  type ResolvedCharaCharacter,
} from '@xivdyetools/core';
import type { Race, RaceKey } from '@xivdyetools/types';
import { generateGlamourCard, type GlamourCardRow } from '@xivdyetools/svg';
import { createTranslator, type LocaleCode, type Translator, type TranslatorLogger } from '../i18n/index.js';
import { getLocalizedDyeName, getLocalizedRace, initializeLocale } from '../localization.js';
import { genderSymbol, producerToken, readCharaForTools, tribeDisplay } from './chara-identity.js';
import { failureKind } from './failure-kind.js';
import { sanitizeLineValue } from '../discord-markdown.js';
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
  /** The named item's ItemUICategory row (api-worker ≥ 0.20.0); what decides whether an Off Hand is listed */
  uiCategory?: number;
}

export interface GlamourResolveAnswer {
  /** `null` = the model has no Item row (NPC / prop model) */
  items: Partial<Record<CharaGearSlotId, GlamourResolvedItem | null>>;
  glasses?: { names: GlamourItemNames } | null;
}

/**
 * Resolves the worn models; the adapter supplies the transport. A failure may
 * carry the HTTP `status` on the thrown error: 429 answers RESOLVE_BUSY; a
 * refused body (400, 413, 422) PARSE_FAILED with a localized reason (the
 * error's own message is English, so it is not shown — HC-002); the rest
 * RESOLVE_FAILED.
 */
export type GlamourResolver = (gear: CharaGearModel[], glassesId: number | null) => Promise<GlamourResolveAnswer>;

export interface GlamourInput {
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
  /**
   * Surfaces Translator missing-key warnings, why the lookup failed
   * (RESOLVE_FAILED) and why a card failed to draw (GENERATION_FAILED) —
   * BUG-125. Any `{ warn(msg) }`.
   */
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

/** The statuses with which api-worker refuses a request body: malformed, too large, invalid. */
const REFUSED_BODY_STATUSES: ReadonlySet<number> = new Set([400, 413, 422]);

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

/** Whole embed description budget in UTF-16 units, including notes and closing lines. */
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
  /**
   * The twin the card and the notes name (localized), or the model label when
   * there is no item — the no-fix note then puts the slot's label before it
   */
  name: string;
  /** The same twin's English name — the card's fallback when the fonts can't draw `name` */
  nameEn: string;
  /**
   * The name the GPOSERS list writes: the twin's, or null when there is no
   * item. A model label means nothing on a submission form, so the list keeps
   * the slot's label bare as a prompt to fill in, as the web list does (BUG-124).
   */
  listName: string | null;
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

/** The reader's codes for a stored field it refused: wrong type, malformed or unknown value. */
const REFUSED_FIELD_CODES: ReadonlySet<string> = new Set(['INVALID_FIELD', 'UNSUPPORTED_VALUE']);

const GEAR_SLOTS: ReadonlySet<string> = new Set(SLOT_ORDER);

/**
 * Whether the reader left out a gear model the file stores: `INCOMPLETE_MODEL`
 * (a lane missing, null, fractional, negative or past uint16 — never floored
 * or defaulted) or a refused value at a gear slot itself (a slot that is no
 * object). A null slot is no gear, not a dropped one. Keyed on the
 * projection's fixed issue codes and slot paths, never the library's text.
 */
function droppedGear(issues: readonly CharaImportIssue[]): boolean {
  return issues.some(
    (i) =>
      i.path.length === 1 &&
      GEAR_SLOTS.has(String(i.path[0])) &&
      (i.code === 'INCOMPLETE_MODEL' || REFUSED_FIELD_CODES.has(i.code))
  );
}

/**
 * Whether a listed piece stores a dye channel the reader refused (not a
 * uint16: negative, fractional, a string…). The projection keeps only valid
 * nonzero stains as dyes, so such a channel would otherwise read as undyed.
 * Zero and a missing or null channel are undyed and stay silent; so does a
 * channel on an empty or dropped slot, which is no listed piece.
 */
function invalidDyeOnListed(issues: readonly CharaImportIssue[], listed: ReadonlySet<string>): boolean {
  return issues.some(
    (i) =>
      REFUSED_FIELD_CODES.has(i.code) &&
      i.path.length === 2 &&
      listed.has(String(i.path[0])) &&
      (i.path[1] === 'DyeId' || i.path[1] === 'DyeId2')
  );
}

/** A worn model as the resolver request carries it: the four validated lanes, nothing else. */
function wireModel({ slot, base, variant, set }: CharaGearModel): CharaGearModel {
  return set === undefined ? { slot, base, variant } : { slot, base, variant, set };
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
      listName: null,
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
  const name = localName(picked.names, locale);
  return {
    slot,
    dyes,
    name,
    nameEn: picked.names.en,
    listName: name,
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
 * Code-point cap for one resolver value. The longest acquisition line api-worker
 * ships is 659 code points, so no real line is cut, while one oversized value
 * still cannot push every later slot out of the list.
 */
const VALUE_CAP = 700;

/**
 * Resolver values are untrusted embed text: collapse controls/whitespace,
 * defuse mentions, escape the markup that can form mid-line and bound escape
 * growth. Parentheses stay bare, so a copied acquisition line reads
 * "Crafted (WVR Lvl. 1)" with no backslashes. Trusted form labels, dye names
 * and localized advisory wording are assembled separately.
 */
function plain(text: string): string {
  return sanitizeLineValue(text, VALUE_CAP);
}

/** Shorten already escaped literal text by UTF-16 units without splitting emoji or escapes. */
function truncateLiteral(text: string, maxUnits: number): string {
  if (text.length <= maxUnits) return text;
  let cut = '';
  for (const char of text) {
    if (cut.length + char.length > maxUnits - 1) break;
    cut += char;
  }
  const trailing = cut.match(/\\+$/)?.[0].length ?? 0;
  if (trailing % 2 === 1) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/**
 * Every piece in the GPOSERS form — core's model (`chara-gposers`), the one
 * the web reader renders too — with Discord-bold labels and no blank lines.
 * A worn piece with no name (no item behind the model, glasses the resolve
 * didn't name) keeps its label bare; `facewear` null = the file wears none.
 * `omitted` are the worn slots the guide wants erased (invisible pieces, an
 * Off Hand the main hand can't carry): left out of the list, still on the card.
 */
function gposersList(
  pieces: Piece[],
  facewear: { name: string | null } | null,
  omitted: ReadonlySet<string>
): string[] {
  const input: GposersInput = {};
  for (const piece of pieces) {
    if (omitted.has(piece.slot)) continue;
    const dye = (channel: 1 | 2): string | null => piece.dyes.find((d) => d.channel === channel)?.name ?? null;
    input[piece.slot] = { name: piece.listName, dye1: dye(1), dye2: dye(2), acquisition: piece.acquisition };
  }
  if (facewear) input.Facewear = facewear;
  const lines = [`**${GPOSERS_HEADER}**`];
  for (const group of gposersGroups(input)) {
    for (const line of group) {
      const label = line.bold ? `**${line.label}**` : line.label;
      const value = line.bold || line.label === GPOSERS_ACQUISITION_LABEL ? plain(line.value) : line.value;
      lines.push(value ? `${label} ${value}` : label);
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

  // HC-002: the parser's and api-worker's reasons are English, so a refused
  // file gets one localized reason instead of either message
  const unreadable = t.t('card.swatchParseError', { message: t.t('card.charaFileReason.unreadable') });

  // Only these members leave the read: the nickname (PRIVACY_POLICY §3) and
  // the appearance are never taken out of the projection. `issues` are fixed
  // codes and sanitized paths, read only to choose the fixed warning lines.
  let gearModels: CharaGearModel[];
  let gearDyes: ResolvedCharaCharacter['gearDyes'];
  let glassesId: number | null;
  let race: ResolvedCharaCharacter['race'];
  let gender: ResolvedCharaCharacter['gender'];
  let tribe: ResolvedCharaCharacter['tribe'];
  let producer: string | null;
  let issues: CharaImportIssue[];
  try {
    ({ gearModels, gearDyes, glassesId, race, gender, tribe, producer, issues } = await readCharaForTools(input));
  } catch (error) {
    // The try runs the projection too, so a bot-side bug lands here as well:
    // log the class and code (a reader refusal's fixed code, e.g.
    // DUPLICATE_KEY or INVALID_UTF8), never the message, as /swatch's read does.
    input.logger?.warn(`[glamour] parse failed: ${failureKind(error)}`);
    return { ok: false, error: 'PARSE_FAILED', errorMessage: unreadable };
  }

  // Gear the file stores that the reader left out, said in one fixed line
  const gearSkipped = droppedGear(issues) ? t.t('card.glamourGearSkipped') : null;

  if (gearModels.length === 0) {
    const noGear = t.t('card.glamourNoGear');
    return { ok: false, error: 'NO_GEAR', errorMessage: gearSkipped ? `${noGear}\n${gearSkipped}` : noGear };
  }

  let answer: GlamourResolveAnswer;
  try {
    // Each model copied to exactly { slot, base, variant, set? }: only the
    // validated lanes the projection kept (complete uint16 models) leave
    answer = await input.resolve(gearModels.map(wireModel), glassesId);
  } catch (error) {
    const status = (error as { status?: unknown } | null)?.status;
    // A 429 is api-worker's service bucket, full for a minute — busy, not broken
    if (status === 429) {
      return { ok: false, error: 'RESOLVE_BUSY', errorMessage: t.t('card.glamourResolveBusy') };
    }
    // A refused body is api-worker refusing what the file describes (the
    // reader already keeps only complete uint16 lanes, so this is api-worker's
    // own validation going further), so a hand edit or a damaged file fails
    // every time — the file's problem, not an outage to retry. The error
    // carries api-worker's own reason, but that is English, so the reply says
    // it in the reader's language (HC-002). A missing route or a refused
    // caller (404, 401, 403) is our deploy, so it stays below.
    if (typeof status === 'number' && REFUSED_BODY_STATUSES.has(status)) {
      return { ok: false, error: 'PARSE_FAILED', errorMessage: unreadable };
    }
    // BUG-125: a missing binding, a malformed envelope and an outage all land
    // here, so say which — the class and the status, never the message (an
    // api-worker reason can echo the file's gear values).
    input.logger?.warn(
      `[glamour] resolve failed: ${failureKind(error)}${typeof status === 'number' ? ` (status ${status})` : ''}`
    );
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
      lookLabel: p.twins > 0 ? t.tc('card.glamourLooks', p.twins, { n: p.twins }) : t.t('card.glamourOneLook'),
      twins: p.twins,
      tone: p.tone,
      name: canDraw(p.name) ? p.name : p.nameEn,
      dyes: p.dyes.filter((d) => d.hex !== null).map((d) => ({ hex: d.hex!, name: d.name })),
      status: p.status,
    }));

    const svgString = generateGlamourCard({
      stripHexes,
      // Clan and gender first, as /swatch orders it: the header is fitted to a
      // pixel budget, and a long localized clan (ja, fr) must push the producer
      // into the ellipsis, not the gender symbol, which the card shows nowhere else.
      charSub: [[tribeDisplay(tribe, locale), genderSymbol(gender)].filter(Boolean).join(' '), producerToken(producer)]
        .filter(Boolean)
        .join(' · '),
      title: count,
      titleExtra: dyeCount,
      rows: cardRows,
      footKey,
      lang: locale,
      theme: input.theme,
    });

    // The embed carries the whole list and what the picture can't say. The
    // file wearing glasses puts Facewear in the list whether or not the resolve
    // named them (the parser answers null for none — row 0 is "none").
    const facewear = glassesId ? { name: answer.glasses ? localName(answer.glasses.names, locale) : null } : null;
    // Every worn slot is a key, so an Off Hand with no item behind it is still
    // judged by the main hand; a slot with no named family stays (unknown).
    const facts: Partial<Record<CharaGearSlotId, GposersSlotFacts>> = {};
    for (const p of pieces) {
      const item = answer.items[p.slot] ?? null;
      facts[p.slot] = item ? { familyEn: [item.names.en, ...item.alternates.map((a) => a.names.en)] } : {};
    }
    const omitted = gposersOmittedSlots(facts, {
      gender,
      mainHandUiCategory: answer.items.MainHand?.uiCategory ?? null,
    });
    const list = gposersList(pieces, facewear, omitted);
    // Compact resolver names only when the full advisory tail would overflow;
    // retain every localized reason and the trusted manual/share suffix.
    const advisoryNotes = (nameBudget: number): string[] => {
      const noteName = (text: string): string => truncateLiteral(plain(text), nameBudget);
      const notes: string[] = [];
      const fixed = pieces.filter((p) => p.fixed);
      if (fixed.length > 0) {
        notes.push(
          `${t.t('card.glamourNamedLead')} ${fixed
            .map((p) => t.t(FIXED_KEYS[p.fixed!.problem], { name: noteName(p.name), other: noteName(p.fixed!.other) }))
            .join(' · ')}`
        );
      }
      const blocked = pieces.filter((p) => p.blocked);
      if (blocked.length > 0) {
        // A model label carries no slot, and the list writes a no-item piece as
        // its bare slot, so the note names the slot: for an undyed piece (no card
        // row) or one past row five, nothing else ties the model to its slot.
        const blockedName = (p: Piece): string =>
          p.blocked === 'noItem' ? `${t.t(SLOT_KEYS[p.slot])} ${p.name}` : noteName(p.name);
        notes.push(
          `${t.t('card.glamourBlockedLead')} ${blocked.map((p) => t.t(BLOCKED_KEYS[p.blocked!], { name: blockedName(p) })).join(' · ')}`
        );
      }
      const company = pieces.filter((p) => p.company);
      if (company.length > 0) {
        notes.push(t.t('card.glamourCompany', { list: company.map((p) => noteName(p.name)).join(' · ') }));
      }
      if (gearSkipped) notes.push(gearSkipped);
      if (invalidDyeOnListed(issues, new Set(pieces.map((p) => p.slot)))) notes.push(t.t('card.glamourDyeInvalid'));
      return notes;
    };
    const closing = `${t.t('card.glamourManual')} \`/manual topic:👤\`\n${SHARE_URL}`;
    let nameBudget = VALUE_CAP * 2; // VALUE_CAP code points can occupy twice as many UTF-16 units.
    let tail = [...advisoryNotes(nameBudget), closing].join('\n');
    // Leave one ellipsis and the blank line even if no complete body line fits.
    while (tail.length > EMBED_BUDGET - 3) {
      nameBudget = Math.floor(nameBudget / 2);
      tail = [...advisoryNotes(nameBudget), closing].join('\n');
    }
    let body = list.join('\n');
    const bodyBudget = Math.max(0, EMBED_BUDGET - tail.length - 2);
    if (body.length > bodyBudget) {
      const end = body.lastIndexOf('\n', Math.max(0, bodyBudget - 2));
      body = end >= 0 ? `${body.slice(0, end)}\n…` : '…';
    }

    const first = stripHexes[0];
    const embed: EmbedData = {
      title: `${t.t('card.glamourTitle')} · ${count}`,
      description: `${body}\n\n${tail}`,
      color: first ? parseInt(first.replace('#', ''), 16) : 0xea4133,
    };

    return { ok: true, svgString, embed };
  } catch (error) {
    input.logger?.warn(`[glamour] generation failed: ${failureKind(error)}`);
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: t.t('errors.generationFailed') };
  }
}
