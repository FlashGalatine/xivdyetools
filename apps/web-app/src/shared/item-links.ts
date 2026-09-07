/**
 * XIV Dye Tools - External item links for the Swatch Manager's equipment rows.
 *
 * A glamour piece is worth looking up elsewhere: what else uses this model,
 * what it costs, where it drops. Seven community databases answer that, and
 * they split into two families that fail in different ways:
 *
 *   - ADDRESSED BY ITEM ID — Eorzea Collection, GarlandTools, Teamcraft. A
 *     wrong id silently opens the wrong item, which is worse than no link.
 *   - ADDRESSED BY NAME — Mirapri (Japanese), GamerEscape (English wiki
 *     titles), the Lodestone (per-region search). A wrong name 404s.
 *
 * That split is why facewear is handled apart from gear. `.chara` carries
 * `Glasses.GlassesId`, a **Glasses sheet** row id — not an Item id — so the
 * id-addressed three are withheld on that row rather than pointed at whatever
 * item happens to share the number.
 *
 * Everything here is pure: callers pass names that are already resolved, and
 * this module only formats. Facewear's base-name lookup is the caller's job
 * (it is a network round trip) — `glassesBaseRowId` gives it the row to ask
 * for.
 *
 * @module shared/item-links
 */

import type { CharaGearSlotId, LodestoneRegion } from '@xivdyetools/core';
import type { CharaItemNames } from '@services/chara-resolve-service';

/** The seven destinations, in menu order. */
export type ItemLinkId =
  | 'eorzeaCollection'
  | 'gearsetGallery'
  | 'mirapri'
  | 'garlandTools'
  | 'teamcraft'
  | 'gamerEscape'
  | 'lodestone';

/**
 * Eorzea Collection's slug for each gear slot. Both rings map to `ring`: the
 * site files a ring under one slug regardless of the hand it is worn on.
 */
export const EORZEA_COLLECTION_SLOT: Readonly<Record<CharaGearSlotId, string>> = {
  MainHand: 'weapon',
  OffHand: 'offhand',
  HeadGear: 'head',
  Body: 'body',
  Hands: 'hands',
  Legs: 'legs',
  Feet: 'feet',
  Ears: 'earrings',
  Neck: 'necklace',
  Wrists: 'bracelets',
  LeftRing: 'ring',
  RightRing: 'ring',
};

/**
 * The Gearset Gallery filters on the five armour slots only — it has no facet
 * for a weapon or an accessory. Absent means NO entry, never a dead one.
 */
export const GEARSET_GALLERY_SLOT: Readonly<Partial<Record<CharaGearSlotId, string>>> = {
  HeadGear: 'head',
  Body: 'body',
  Hands: 'hands',
  Legs: 'legs',
  Feet: 'feet',
};

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

/** Eorzea Collection — every other glamour using this piece. */
export function eorzeaCollectionUrl(slot: CharaGearSlotId, itemId: number): string {
  return `https://ffxiv.eorzeacollection.com/glamours/${EORZEA_COLLECTION_SLOT[slot]}/${itemId}`;
}

/** Eorzea Collection's Gearset Gallery — null on a slot it cannot filter. */
export function gearsetGalleryUrl(slot: CharaGearSlotId, itemId: number): string | null {
  const facet = GEARSET_GALLERY_SLOT[slot];
  return facet ? `https://ffxiv.eorzeacollection.com/gearsets?${facet}Piece=${itemId}` : null;
}

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
  | { kind: 'gear'; slot: CharaGearSlotId; itemId: number; names: CharaItemNames }
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
 * omitted, never rendered dead: a facewear row has no Item id, and four of the
 * twelve gear slots have no Gearset Gallery facet.
 */
export function buildItemLinkMenu(target: ItemLinkTarget): ItemLinkMenu {
  const entries: ItemLinkEntry[] = [];

  if (target.kind === 'gear') {
    entries.push({ id: 'eorzeaCollection', url: eorzeaCollectionUrl(target.slot, target.itemId) });
    const gearset = gearsetGalleryUrl(target.slot, target.itemId);
    if (gearset) entries.push({ id: 'gearsetGallery', url: gearset });
  }

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
