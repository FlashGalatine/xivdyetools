/**
 * XIV Dye Tools - External item links for the Swatch Manager's equipment rows.
 *
 * A glamour piece is worth looking up elsewhere: what else uses this model,
 * what it costs, where it drops. Five community databases answer that, and
 * they split into two families that fail in different ways:
 *
 *   - ADDRESSED BY ITEM ID — GarlandTools, Teamcraft. A wrong id silently
 *     opens the wrong item, which is worse than no link.
 *   - ADDRESSED BY NAME — Mirapri (Japanese), GamerEscape (English wiki
 *     titles), the Lodestone (per-region search). A wrong name 404s.
 *
 * That split is why facewear is handled apart from gear. `.chara` carries
 * `Glasses.GlassesId`, a **Glasses sheet** row id — not an Item id — so the
 * id-addressed pair is withheld on that row rather than pointed at whatever
 * item happens to share the number.
 *
 * NO EORZEA COLLECTION. It was the obvious sixth and seventh entry (the
 * glamour catalogue, and its Gearset Gallery) and both were built and then
 * removed, so this note exists to stop the next person rebuilding them:
 *
 *   - EC addresses items by its OWN dense auto-increment key, not the game's
 *     item id. Its API returns both, the game's under a field it calls
 *     `XIVApiId`: EC 25404 → item 44605, EC 25405 → item 44610, EC 25410 →
 *     item 44635. EC counts by one while item ids step by five across job
 *     variants, so the delta drifts (19201 → 19225 over seven consecutive
 *     rows) and NO offset or formula recovers it.
 *   - Worse, it fails silently. Both id spaces are dense integers over
 *     overlapping ranges, so passing the game's id does not 404 — EC filters
 *     to a DIFFERENT item.
 *   - The mapping can only come from EC, and it will not be given to us: the
 *     lookup is POST-only behind a Cloudflare managed challenge (403 to any
 *     server-side request), there is no name-keyed GET route for gear, and
 *     `robots.txt` carries `User-agent: ClaudeBot / Disallow: /` plus
 *     `Content-Signal: ai-train=no, use=reference`.
 *
 * Restoring the entries needs Eorzea Collection's own blessing — a published
 * mapping or a sanctioned lookup — not a cleverer client.
 *
 * Everything here is pure: callers pass names that are already resolved, and
 * this module only formats. Facewear's base-name lookup is the caller's job
 * (it is a network round trip) — `glassesBaseRowId` gives it the row to ask
 * for.
 *
 * @module shared/item-links
 */

import type { LodestoneRegion } from '@xivdyetools/core';
import type { CharaItemNames } from '@services/chara-resolve-service';

/** The five destinations, in menu order. */
export type ItemLinkId = 'mirapri' | 'garlandTools' | 'teamcraft' | 'gamerEscape' | 'lodestone';

/**
 * The Lodestone's regions, in the order the submenu lists them. Regions are
 * hosts, not locales: `na` and `eu` are both English, so both search the
 * English name.
 */
export const LODESTONE_REGIONS: readonly LodestoneRegion[] = ['na', 'eu', 'jp', 'de', 'fr'];

const LODESTONE_REGION_NAME: Readonly<Record<LodestoneRegion, keyof CharaItemNames>> = {
  na: 'en',
  eu: 'en',
  jp: 'ja',
  de: 'de',
  fr: 'fr',
};

/** GarlandTools item page. */
export function garlandToolsUrl(itemId: number): string {
  return `https://www.garlandtools.org/db/#item/${itemId}`;
}

/** Teamcraft item page. */
export function teamcraftUrl(itemId: number): string {
  return `https://ffxivteamcraft.com/db/en/item/${itemId}`;
}

/** Mirapri keyword search. The site is Japanese, so it wants the JP name. */
export function mirapriUrl(names: CharaItemNames): string {
  return `https://mirapri.com/?keyword=${encodeURIComponent(names.ja)}`;
}

/**
 * GamerEscape wiki page.
 *
 * MediaWiki titles use `_` for a space and carry apostrophes, parentheses and
 * hyphens verbatim — `encodeURIComponent` already leaves those alone, and it
 * still escapes the characters that would break the path (`/`, `&`, `?`).
 * Underscoring BEFORE encoding matters: encoding first turns a space into
 * `%20`, which is no longer a space to replace.
 */
export function gamerEscapeUrl(names: CharaItemNames): string {
  const title = encodeURIComponent(names.en.replace(/ /g, '_'));
  return `https://ffxiv.gamerescape.com/wiki/${title}`;
}

/**
 * Lodestone item search for one region, in that region's language.
 *
 * The query joins words with `+`. Encoding first and swapping `%20` for `+`
 * (rather than replacing spaces up front) keeps `&`, `=` and `?` escaped, so
 * an item name can never add a parameter of its own.
 */
export function lodestoneUrl(region: LodestoneRegion, names: CharaItemNames): string {
  const name = names[LODESTONE_REGION_NAME[region]] ?? names.en;
  const q = encodeURIComponent(name).replace(/%20/g, '+');
  return `https://${region}.finalfantasyxiv.com/lodestone/playguide/db/search/?q=${q}`;
}

/**
 * Rows per facewear family in the Glasses sheet: one untinted base followed by
 * the eleven tints.
 */
export const GLASSES_BLOCK = 12;

/**
 * Is this Glasses row one of the eleven tints rather than the base item?
 *
 * The sheet is laid out in strict blocks of twelve — verified against the live
 * sheet (2026-09-06): 41 blocks, 487 non-empty rows, every computed base a
 * real row. The arithmetic is why this is not a text rule: "Brass Goggles" is
 * a BASE row that merely starts with a colour word, and the tints of "Simple
 * Spectacles" are named "Silver Spectacles" — dropping the colour word gets
 * both wrong.
 */
export function isGlassesTint(rowId: number): boolean {
  return rowId >= 1 && (rowId - 1) % GLASSES_BLOCK !== 0;
}

/** The untinted base row that owns `rowId` (itself, when it is already a base). */
export function glassesBaseRowId(rowId: number): number {
  if (rowId < 1) return 1;
  return Math.floor((rowId - 1) / GLASSES_BLOCK) * GLASSES_BLOCK + 1;
}

/** A gear piece (every site) or the facewear row (name-addressed sites only). */
export type ItemLinkTarget =
  | { kind: 'gear'; itemId: number; names: CharaItemNames }
  | { kind: 'facewear'; names: CharaItemNames };

export interface ItemLinkEntry {
  id: Exclude<ItemLinkId, 'lodestone'>;
  url: string;
}

export interface LodestoneLinkEntry {
  region: LodestoneRegion;
  url: string;
}

export interface ItemLinkMenu {
  /** Flat entries, in menu order. */
  entries: ItemLinkEntry[];
  /** The Lodestone's five regions — a submenu, always present. */
  lodestone: LodestoneLinkEntry[];
}

/**
 * Every link worth offering for one row. Entries a target cannot support are
 * omitted, never rendered dead: a facewear row has no Item id, so it gets the
 * name-addressed entries alone.
 */
export function buildItemLinkMenu(target: ItemLinkTarget): ItemLinkMenu {
  const entries: ItemLinkEntry[] = [];

  entries.push({ id: 'mirapri', url: mirapriUrl(target.names) });

  if (target.kind === 'gear') {
    entries.push({ id: 'garlandTools', url: garlandToolsUrl(target.itemId) });
    entries.push({ id: 'teamcraft', url: teamcraftUrl(target.itemId) });
  }

  entries.push({ id: 'gamerEscape', url: gamerEscapeUrl(target.names) });

  return {
    entries,
    lodestone: LODESTONE_REGIONS.map((region) => ({
      region,
      url: lodestoneUrl(region, target.names),
    })),
  };
}
