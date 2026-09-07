/**
 * XIV Dye Tools - External item-link builders
 *
 * The Swatch Manager's equipment rows hand a piece off to seven community
 * databases. Three of them address an item by its Item-sheet row id and four
 * by its NAME, which is what makes this module worth testing on its own: a
 * wrong id opens the wrong item, and a wrong name opens a 404. Both read as
 * bugs in our UI rather than in theirs.
 *
 * The facewear row is the interesting case. `Glasses.GlassesId` is a Glasses
 * sheet row id, NOT an Item id, so the id-addressed sites are withheld there
 * (see `buildItemLinkMenu` — facewear gets the three name-addressed ones).
 *
 * @module shared/__tests__/item-links.test
 */

import { describe, it, expect } from 'vitest';
import type { CharaItemNames } from '@services/chara-resolve-service';
import {
  EORZEA_COLLECTION_SLOT,
  GEARSET_GALLERY_SLOT,
  GLASSES_BLOCK,
  buildItemLinkMenu,
  eorzeaCollectionUrl,
  gamerEscapeUrl,
  garlandToolsUrl,
  gearsetGalleryUrl,
  glassesBaseRowId,
  isGlassesTint,
  lodestoneUrl,
  mirapriUrl,
  teamcraftUrl,
} from '../item-links';

const NAMES: CharaItemNames = {
  en: 'Ruby Rose Top',
  ja: 'ルビーローズトップ',
  de: 'Rubinrose-Oberteil',
  fr: 'Haut rose rubis',
};

describe('slot slugs', () => {
  it('maps all twelve gear slots onto Eorzea Collection slugs', () => {
    expect(EORZEA_COLLECTION_SLOT).toEqual({
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
    });
  });

  it('sends both ring slots to the same slug — Eorzea Collection has one', () => {
    expect(EORZEA_COLLECTION_SLOT.LeftRing).toBe(EORZEA_COLLECTION_SLOT.RightRing);
  });

  it('offers the Gearset Gallery for exactly the five armour slots', () => {
    expect(Object.keys(GEARSET_GALLERY_SLOT).sort()).toEqual(
      ['Body', 'Feet', 'Hands', 'HeadGear', 'Legs'].sort()
    );
  });
});

describe('id-addressed URLs', () => {
  it('builds an Eorzea Collection additional-glamours URL', () => {
    expect(eorzeaCollectionUrl('Body', 12345)).toBe(
      'https://ffxiv.eorzeacollection.com/glamours/body/12345'
    );
    expect(eorzeaCollectionUrl('RightRing', 7)).toBe(
      'https://ffxiv.eorzeacollection.com/glamours/ring/7'
    );
  });

  it('builds a Gearset Gallery URL for an armour slot and nothing for the rest', () => {
    expect(gearsetGalleryUrl('HeadGear', 900)).toBe(
      'https://ffxiv.eorzeacollection.com/gearsets?headPiece=900'
    );
    // Accessories and weapons have no Gearset Gallery facet — never a dead entry.
    expect(gearsetGalleryUrl('Ears', 900)).toBeNull();
    expect(gearsetGalleryUrl('MainHand', 900)).toBeNull();
    expect(gearsetGalleryUrl('LeftRing', 900)).toBeNull();
  });

  it('builds GarlandTools and Teamcraft URLs', () => {
    expect(garlandToolsUrl(12345)).toBe('https://www.garlandtools.org/db/#item/12345');
    expect(teamcraftUrl(12345)).toBe('https://ffxivteamcraft.com/db/en/item/12345');
  });
});

describe('name-addressed URLs', () => {
  it('searches Mirapri by the JAPANESE name — the site is Japanese', () => {
    expect(mirapriUrl(NAMES)).toBe(
      `https://mirapri.com/?keyword=${encodeURIComponent('ルビーローズトップ')}`
    );
  });

  it('builds a GamerEscape wiki path with underscores for spaces', () => {
    expect(gamerEscapeUrl(NAMES)).toBe('https://ffxiv.gamerescape.com/wiki/Ruby_Rose_Top');
  });

  it('leaves wiki-legal punctuation intact rather than percent-encoding it', () => {
    // MediaWiki titles carry apostrophes and parentheses verbatim; encoding
    // them yields a page that does not exist.
    const punct: CharaItemNames = { ...NAMES, en: "Minstrel's Spectacles (Left)" };
    expect(gamerEscapeUrl(punct)).toBe(
      "https://ffxiv.gamerescape.com/wiki/Minstrel's_Spectacles_(Left)"
    );
  });

  it('escapes a name that would otherwise break out of the wiki path', () => {
    const nasty: CharaItemNames = { ...NAMES, en: 'A/B & C?' };
    const url = gamerEscapeUrl(nasty);
    expect(url.startsWith('https://ffxiv.gamerescape.com/wiki/')).toBe(true);
    expect(url).not.toContain('/wiki/A/B');
    expect(url).toContain('%2F');
    expect(url).toContain('%26');
    expect(url).toContain('%3F');
  });

  it('joins Lodestone search terms with + and picks the name for the region', () => {
    expect(lodestoneUrl('na', NAMES)).toBe(
      'https://na.finalfantasyxiv.com/lodestone/playguide/db/search/?q=Ruby+Rose+Top'
    );
    // Europe is an English-language region — it searches the English name.
    expect(lodestoneUrl('eu', NAMES)).toBe(
      'https://eu.finalfantasyxiv.com/lodestone/playguide/db/search/?q=Ruby+Rose+Top'
    );
    expect(lodestoneUrl('de', NAMES)).toBe(
      'https://de.finalfantasyxiv.com/lodestone/playguide/db/search/?q=Rubinrose-Oberteil'
    );
    expect(lodestoneUrl('fr', NAMES)).toBe(
      'https://fr.finalfantasyxiv.com/lodestone/playguide/db/search/?q=Haut+rose+rubis'
    );
    expect(lodestoneUrl('jp', NAMES)).toBe(
      `https://jp.finalfantasyxiv.com/lodestone/playguide/db/search/?q=${encodeURIComponent(
        'ルビーローズトップ'
      )}`
    );
  });

  it('percent-encodes a Lodestone query rather than letting it add parameters', () => {
    const nasty: CharaItemNames = { ...NAMES, en: 'A&b=c' };
    expect(lodestoneUrl('na', nasty)).toBe(
      'https://na.finalfantasyxiv.com/lodestone/playguide/db/search/?q=A%26b%3Dc'
    );
  });
});

describe('glasses row arithmetic', () => {
  // Verified against the live Glasses sheet (2026-09-06, 487 non-empty rows):
  // every one of the 41 blocks is a base row followed by exactly 11 tints, and
  // the computed base is always a real, non-empty row.
  it('treats every twelfth row from 1 as the untinted base', () => {
    expect(GLASSES_BLOCK).toBe(12);
    expect(isGlassesTint(1)).toBe(false);
    expect(isGlassesTint(13)).toBe(false);
    expect(isGlassesTint(145)).toBe(false);
    expect(isGlassesTint(2)).toBe(true);
    expect(isGlassesTint(12)).toBe(true);
    expect(isGlassesTint(50)).toBe(true);
  });

  it('resolves a tint to the base row that owns it', () => {
    expect(glassesBaseRowId(1)).toBe(1);
    expect(glassesBaseRowId(2)).toBe(1);
    expect(glassesBaseRowId(12)).toBe(1);
    expect(glassesBaseRowId(13)).toBe(13);
    // "Silver Spectacles" (50) belongs to "Simple Spectacles" (49) — the case
    // no text strip of the English name can recover.
    expect(glassesBaseRowId(50)).toBe(49);
    expect(glassesBaseRowId(60)).toBe(49);
    // "Brass Goggles" (145) is a BASE row whose name merely starts with a
    // colour word; the arithmetic never mistakes it for a tint.
    expect(glassesBaseRowId(145)).toBe(145);
    expect(glassesBaseRowId(146)).toBe(145);
  });

  it('never returns a row below 1', () => {
    expect(glassesBaseRowId(0)).toBe(1);
    expect(glassesBaseRowId(-5)).toBe(1);
  });
});

describe('buildItemLinkMenu', () => {
  it('gives an armour piece all six flat entries plus five Lodestone regions', () => {
    const menu = buildItemLinkMenu({
      kind: 'gear',
      slot: 'Body',
      itemId: 12345,
      names: NAMES,
    });
    expect(menu.entries.map((e) => e.id)).toEqual([
      'eorzeaCollection',
      'gearsetGallery',
      'mirapri',
      'garlandTools',
      'teamcraft',
      'gamerEscape',
    ]);
    expect(menu.lodestone.map((r) => r.region)).toEqual(['na', 'eu', 'jp', 'de', 'fr']);
  });

  it('drops the Gearset Gallery on a slot the gallery has no facet for', () => {
    const menu = buildItemLinkMenu({
      kind: 'gear',
      slot: 'Neck',
      itemId: 12345,
      names: NAMES,
    });
    expect(menu.entries.map((e) => e.id)).not.toContain('gearsetGallery');
    expect(menu.entries.map((e) => e.id)).toContain('eorzeaCollection');
  });

  it('withholds every id-addressed site from facewear', () => {
    // The row id is a Glasses row, not an Item row — Eorzea Collection,
    // GarlandTools and Teamcraft would each open an unrelated item.
    const menu = buildItemLinkMenu({ kind: 'facewear', names: NAMES });
    expect(menu.entries.map((e) => e.id)).toEqual(['mirapri', 'gamerEscape']);
    expect(menu.lodestone).toHaveLength(5);
  });

  it('builds every entry as an absolute https URL', () => {
    const menu = buildItemLinkMenu({
      kind: 'gear',
      slot: 'Feet',
      itemId: 9,
      names: NAMES,
    });
    for (const { url } of [...menu.entries, ...menu.lodestone]) {
      expect(url.startsWith('https://')).toBe(true);
    }
  });
});
