/**
 * XIV Dye Tools - External item-link builders
 *
 * The Swatch Manager's equipment rows hand a piece off to five community
 * databases. Two of them address an item by its Item-sheet row id and three
 * by its NAME, which is what makes this module worth testing on its own: a
 * wrong id opens the wrong item, and a wrong name opens a 404. Both read as
 * bugs in our UI rather than in theirs.
 *
 * The facewear row is the interesting case. `Glasses.GlassesId` is a Glasses
 * sheet row id, NOT an Item id, so the id-addressed sites are withheld there
 * (see `buildItemLinkMenu` — facewear gets the three name-addressed ones).
 *
 * Eorzea Collection is deliberately absent; the module docblock says why, and
 * the last describe block below guards it.
 *
 * @module shared/__tests__/item-links.test
 */

import { describe, it, expect } from 'vitest';
import type { CharaItemNames } from '@services/chara-resolve-service';
import * as itemLinks from '../item-links';
import {
  GLASSES_BLOCK,
  buildItemLinkMenu,
  gamerEscapeUrl,
  garlandToolsUrl,
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

describe('id-addressed URLs', () => {
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
  it.each([
    ['Shaded Spectacles', 'The_Faces_We_Wear_-_Shaded_Spectacles'],
    ['Oval Spectacles', 'The_Faces_We_Wear_-_Oval_Spectacles'],
    ['Monocle', 'The_Faces_We_Wear_-_Monocles'],
    ["Minstrel's Spectacles", "The_Faces_We_Wear_-_Minstrel's_Spectacles"],
    ['Eyepatch (Left)', 'The_Faces_We_Wear_-_Eyepatch_(Left)'],
  ])('links facewear %s to its unlock item, not same-named headgear', (name, title) => {
    const names = { ...NAMES, en: name };
    const facewear = buildItemLinkMenu({ kind: 'facewear', names });
    const gear = buildItemLinkMenu({ kind: 'gear', itemId: 12345, names });
    expect(facewear.entries.find((entry) => entry.id === 'gamerEscape')?.url).toBe(
      `https://ffxiv.gamerescape.com/wiki/${title}`
    );
    expect(gear.entries.find((entry) => entry.id === 'gamerEscape')?.url).toBe(
      gamerEscapeUrl(names)
    );
    expect(facewear.entries.find((entry) => entry.id === 'mirapri')?.url).toBe(mirapriUrl(names));
    expect(facewear.lodestone[0].url).toBe(lodestoneUrl('na', names));
  });

  it('gives a gear piece all four flat entries plus five Lodestone regions', () => {
    const menu = buildItemLinkMenu({ kind: 'gear', itemId: 12345, names: NAMES });
    expect(menu.entries.map((e) => e.id)).toEqual([
      'mirapri',
      'garlandTools',
      'teamcraft',
      'gamerEscape',
    ]);
    expect(menu.lodestone.map((r) => r.region)).toEqual(['na', 'eu', 'jp', 'de', 'fr']);
  });

  it('withholds every id-addressed site from facewear', () => {
    // The row id is a Glasses row, not an Item row — GarlandTools and
    // Teamcraft would each open an unrelated item.
    const menu = buildItemLinkMenu({ kind: 'facewear', names: NAMES });
    expect(menu.entries.map((e) => e.id)).toEqual(['mirapri', 'gamerEscape']);
    expect(menu.lodestone).toHaveLength(5);
  });

  it('builds every entry as an absolute https URL', () => {
    const menu = buildItemLinkMenu({ kind: 'gear', itemId: 9, names: NAMES });
    for (const { url } of [...menu.entries, ...menu.lodestone]) {
      expect(url.startsWith('https://')).toBe(true);
    }
  });
});

describe('Eorzea Collection is deliberately absent', () => {
  // EC addresses items by its OWN dense auto-increment key, not the game's
  // item id — its API returns ours as `XIVApiId` (EC 25404 → item 44605,
  // EC 25410 → item 44635, so the delta drifts and no offset recovers it).
  // Passing the game's id does not 404; it silently opens a DIFFERENT item.
  // The mapping is only obtainable from EC, whose lookup is POST-only behind
  // a Cloudflare challenge and whose robots.txt disallows ClaudeBot outright.
  //
  // This block is the guard: rebuilding those entries from the item id turns
  // it red, so the next person has to read the reason before shipping it.
  const menu = buildItemLinkMenu({ kind: 'gear', itemId: 44626, names: NAMES });

  it('offers no entry pointing at eorzeacollection.com', () => {
    for (const { url } of [...menu.entries, ...menu.lodestone]) {
      expect(url).not.toContain('eorzeacollection.com');
    }
  });

  it('exports no Eorzea Collection URL builder or slot table', () => {
    const surface = Object.keys(itemLinks);
    expect(surface.filter((k) => /eorzea|gearset/i.test(k))).toEqual([]);
  });

  it('has no link id reserved for it', () => {
    expect(menu.entries.map((e) => e.id)).not.toContain('eorzeaCollection');
    expect(menu.entries.map((e) => e.id)).not.toContain('gearsetGallery');
  });
});
