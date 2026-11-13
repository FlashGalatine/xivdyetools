/**
 * Abridged acquisition lines — the maintainer's rules, pinned.
 *
 * Three layers: the maintainer's worked examples (table-driven), invariants
 * over every line of api-worker's real acquisition table, and a pinned list of
 * every line where the instance step drops a source, so a table refresh that
 * adds one gets a person's eyes.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abridgeAcquisition } from '../glamour-abridged';

const HERE = dirname(fileURLToPath(import.meta.url));
const TABLE_PATH = resolve(HERE, '../../../../api-worker/src/chara/data/acquisition.en.json');
const DROPS_PATH = resolve(HERE, 'glamour-abridged-drops.json');

const TABLE = JSON.parse(readFileSync(TABLE_PATH, 'utf-8')) as Record<string, string>;
const LINES = Object.values(TABLE);

const EXAMPLES: ReadonlyArray<readonly [string, string]> = [
  ['Cenote Ja Ja Gural / Vault Oneiron', 'Cenote Ja Ja Gural / Vault Oneiron'],
  ["Scrip Exchange - Old Gridania (100 Orange Crafters' Scrips)", 'Scrip Exchange - Old Gridania'],
  ['FFXIV Online Store', 'FFXIV Online Store'],
  ['Varsarudh - Old Sharlayan', 'Varsarudh - Old Sharlayan'],
  [
    'Theone - Solution Nine (Bygone Brass Brais of Scouting, 1 Thundersteeped Twine)',
    'Theone - Solution Nine',
  ],
  ["Enie - Ishgard - The Firmament (3,000 Skybuilders' Scrips)", 'Enie - Ishgard - The Firmament'],
  ['Crafted (CRP Lvl. 86) / Godgyth - Sinus Ardorum (20,811 Gil)', 'Crafted (CRP Lvl. 86)'],
  ['Crafted (CRP Lvl. 90)', 'Crafted (CRP Lvl. 90)'],
  [
    'Expedition Antiquarian - The Occult Crescent: North Horn (40 Arcane Amulets)',
    'Expedition Antiquarian - The Occult Crescent: North Horn',
  ],
  ['Geraint - Old Gridania (151 Gil)', 'Geraint - Old Gridania (151 Gil)'],
  ['Pharos Sirius / Copperbell Mines (Hard) / Haukke Manor (Hard)', 'Pharos Sirius'],
  [
    'The Second Coil of Bahamut - Turn 2 / The Second Coil of Bahamut - Turn 3 / The Second Coil of Bahamut (Savage) - Turn 2 / The Second Coil of Bahamut (Savage) - Turn 3',
    'The Second Coil of Bahamut - Turn 2 / The Second Coil of Bahamut - Turn 3',
  ],
  [
    "Eden's Promise: Litany (Savage) / Eden's Promise: Anamorphosis (Savage)",
    "Eden's Promise: Litany (Savage) / Eden's Promise: Anamorphosis (Savage)",
  ],
  [
    "The Whorleater (Extreme) / Aelina - Mor Dhona - Revenant's Toll (1 Wave Wand)",
    'The Whorleater (Extreme)',
  ],
  ["The Wanderer's Palace / Junkmonger - Upper La Noscea (3,168 Gil)", "The Wanderer's Palace"],
  ['The Aquapolis / Crafted (WVR Lvl. 60)', 'Crafted (WVR Lvl. 60)'],
  [
    'The Aquapolis / Spoils Collector - Ishgard - The Pillars (1 Copper Voyage Spoil)',
    'Spoils Collector - Ishgard - The Pillars',
  ],
  [
    'The Aquapolis / I Hope Mentor Will Notice Me III (Achievement)',
    'I Hope Mentor Will Notice Me III (Achievement)',
  ],
  ["Matoya's Relict / Moogle Treasure Trove", "Matoya's Relict"],
  ["Baelsar's Wall / Sohm Al (Hard) / Shire Custodian's Accessories Coffer", "Baelsar's Wall"],
  [
    "The Minstrel's Ballad: Sphene's Burden / Paladin's Arms Eternal (IL 725)",
    "The Minstrel's Ballad: Sphene's Burden",
  ],
  [
    "Hismena - Idyllshire (280 Allagan Tomestones of Poetics) / Shire Custodian's Accessories Coffer",
    'Hismena - Idyllshire',
  ],
  ["Fathard - Eulmore (5 Archaeotania's Horns) / Moogle Treasure Trove", 'Fathard - Eulmore'],
  ['Crafted (GSM Lvl. 40) / Subaquatic Voyages', 'Crafted (GSM Lvl. 40)'],
  ['Seika - Idyllshire (1 A) / Yolaine - Ishgard - Foundation (2 B)', 'Seika - Idyllshire'],
  [
    'Vath Stickpeddler - The Dravanian Forelands (40,000 Gil) / Vath Stickpeddler - The Dravanian Forelands (9 Black Copper Gil)',
    'Vath Stickpeddler - The Dravanian Forelands (40,000 Gil)',
  ],
  [
    'Lead by Example (Sidequest) / Of Cooks and Books (Sidequest)',
    'Lead by Example (Sidequest) / Of Cooks and Books (Sidequest)',
  ],
  [
    'Timeworn Toadskin Map / Timeworn Boarskin Map',
    'Timeworn Toadskin Map / Timeworn Boarskin Map',
  ],
  [
    'Desynthesis (CUL) - Shark Tuna / Desynthesis (CUL) - Spearnose',
    'Desynthesis (CUL) - Shark Tuna / Desynthesis (CUL) - Spearnose',
  ],
  [
    'Lizbeth - Ishgard - The Firmament (Kupo of Fortune)',
    'Lizbeth - Ishgard - The Firmament (Kupo of Fortune)',
  ],
  [
    'Alexander - The Burden of the Father (Savage)',
    'Alexander - The Burden of the Father (Savage)',
  ],
  ['', ''],
];

describe('abridgeAcquisition: the maintainer examples', () => {
  it.each(EXAMPLES)('%s', (line, expected) => {
    expect(abridgeAcquisition(line)).toBe(expected);
  });
});

describe('abridgeAcquisition: an empty part is not a source', () => {
  // A player's Full line can keep a stray separator: the field stores what is
  // typed, untrimmed. No generated line has an empty part.
  it.each([
    ['The Howling Eye (Hard) / ', 'The Howling Eye (Hard)'],
    ['The Whorleater (Extreme) / ', 'The Whorleater (Extreme)'],
    ['Sastasha (Hard) /  ', 'Sastasha (Hard)'],
    ['Sastasha / ', 'Sastasha'],
    [' / Crafted (X)', 'Crafted (X)'],
    [' / Geraint - Old Gridania (151 Gil)', 'Geraint - Old Gridania (151 Gil)'],
    [' / Seika - Idyllshire (1 A)', 'Seika - Idyllshire'],
    [' / Sastasha / The Aery (Hard)', 'Sastasha'],
  ])('%j', (line, expected) => {
    expect(abridgeAcquisition(line)).toBe(expected);
  });

  it.each([' / Moogle Treasure Trove', 'Moogle Treasure Trove / ', ' / ', '   '])(
    'rule 5 leaves %j unchanged',
    (line) => {
      expect(abridgeAcquisition(line)).toBe(line);
    }
  );
});

describe('abridgeAcquisition: an excluded map dungeon does not end the instances', () => {
  it.each([
    ['The Aquapolis / Sastasha / Crafted (WVR Lvl. 60)', 'Sastasha'],
    ['Cenote Ja Ja Gural / The Aery / Geraint - Old Gridania (151 Gil)', 'The Aery'],
    [
      "The Aquapolis / Sastasha / Scrip Exchange - Old Gridania (100 Orange Crafters' Scrips)",
      'Sastasha',
    ],
    ['Sastasha / The Aquapolis / The Aery / Crafted (WVR Lvl. 60)', 'Sastasha / The Aery'],
    ['The Aquapolis / Moogle Treasure Trove / Crafted (WVR Lvl. 60)', 'Crafted (WVR Lvl. 60)'],
  ])('%s', (line, expected) => {
    expect(abridgeAcquisition(line)).toBe(expected);
  });
});

describe('abridgeAcquisition: any other source beats a map dungeon', () => {
  // The maintainer's ruling of 2026-11-13: not only a craft or a purchase.
  it.each([
    [
      'The Aquapolis / I Hope Mentor Will Notice Me III (Achievement)',
      'I Hope Mentor Will Notice Me III (Achievement)',
    ],
    ['The Aquapolis / Sastasha', 'Sastasha'],
    ['The Aquapolis', 'The Aquapolis'],
    ['Cenote Ja Ja Gural / Vault Oneiron', 'Cenote Ja Ja Gural / Vault Oneiron'],
  ])('%s', (line, expected) => {
    expect(abridgeAcquisition(line)).toBe(expected);
  });
});

describe('abridgeAcquisition: a bracket needs the space the rule states', () => {
  // A priced vendor ends with ` (...)`. A bracket with no space before it is not
  // a price, so it is neither stripped nor able to empty the line.
  it.each([
    ['(Lv. 1 - 50)', '(Lv. 1 - 50)'],
    ['(Patch 7.0 - 7.3) / Moogle Treasure Trove', '(Patch 7.0 - 7.3)'],
    ['Moogle Treasure Trove / (a - 1)', 'Moogle Treasure Trove / (a - 1)'],
    ['(1 - 2) / (3 - 4)', '(1 - 2) / (3 - 4)'],
    ['Foo - Bar(1 A)', 'Foo - Bar(1 A)'],
    // The space here is the field's edge, not a vendor's name before a bracket
    [' (1 - 2)', '(1 - 2)'],
  ])('%j', (line, expected) => {
    expect(abridgeAcquisition(line)).toBe(expected);
  });
});

describe('abridgeAcquisition: whitespace around a part does not change what it is', () => {
  // The field stores what is typed, untrimmed, so deleting `/ Yolaine ...` from a
  // two-vendor line leaves a trailing space. No generated line has any of this.
  it.each([
    ['Seika - Idyllshire (1 A) ', 'Seika - Idyllshire'],
    ['Seika - Idyllshire (1 A)  / Crafted (X)', 'Crafted (X)'],
    ['Seika - Idyllshire (1 A)\n / Crafted (X)', 'Crafted (X)'],
    ['Geraint - Old Gridania (151 Gil) ', 'Geraint - Old Gridania (151 Gil)'],
    ['Lead by Example (Sidequest)  / Crafted (X)', 'Crafted (X)'],
    ['Moogle Treasure Trove  / Crafted (X)', 'Crafted (X)'],
    ['The Aquapolis  / Crafted (X)', 'Crafted (X)'],
    ['Sastasha  / Crafted (X)', 'Sastasha'],
  ])('%j', (line, expected) => {
    expect(abridgeAcquisition(line)).toBe(expected);
  });

  it.each([
    ['Seika - Idyllshire (1 A) /', 'Seika - Idyllshire'],
    ['/ Seika - Idyllshire (1 A)', 'Seika - Idyllshire'],
    [
      'Seika - Idyllshire (1 A) / / Geraint - Old Gridania (151 Gil)',
      'Geraint - Old Gridania (151 Gil)',
    ],
  ])('a dangling separator in %j is no part of a source', (line, expected) => {
    expect(abridgeAcquisition(line)).toBe(expected);
  });

  it.each([
    'Moogle Treasure Trove /',
    '/ Moogle Treasure Trove',
    '/',
    'Lead by Example (Sidequest) ',
  ])('rule 5 leaves %j unchanged', (line) => {
    expect(abridgeAcquisition(line)).toBe(line);
  });
});

describe('abridgeAcquisition: a line far longer than any real one', () => {
  it('does not overflow the stack', () => {
    // The field has no length limit, and a throw here would stop the sheet opening.
    const line = Array<string>(300_000).fill('A').join(' / ');
    expect(abridgeAcquisition(line) === line).toBe(true);
  });
});

/** A part that is a priced vendor, by the maintainer's definition. */
function isPricedVendor(part: string): boolean {
  const m = / - .*\(([^()]*)\)$/.exec(part);
  return m !== null && /[\d,]/.test(m[1]);
}
function isGil(part: string): boolean {
  return isPricedVendor(part) && /\([\d,]+ Gil\)$/.test(part);
}
function isCraft(part: string): boolean {
  return part.startsWith('Crafted (');
}

describe('abridgeAcquisition: the whole table', () => {
  const outputs = LINES.map((line) => [line, abridgeAcquisition(line)] as const);

  it('reads the whole table', () => {
    // A floor, not the exact count: a table refresh adds rows, and the pinned drop
    // list below is what asks a person to look. Same idea as api-worker's table.test.ts.
    expect(LINES.length).toBeGreaterThan(24000);
  });

  it('never returns an empty line for a non-empty one', () => {
    expect(outputs.filter(([line, out]) => line !== '' && out === '').slice(0, 5)).toEqual([]);
  });

  it('keeps no priced bracket unless it is Gil', () => {
    const bad = outputs.filter(([, out]) =>
      out.split(' / ').some((p) => isPricedVendor(p) && !isGil(p))
    );
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('a multi-part output holds no craft and no priced vendor', () => {
    const bad = outputs.filter(([, out]) => {
      const parts = out.split(' / ');
      return parts.length > 1 && parts.some((p) => isCraft(p) || isPricedVendor(p));
    });
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('every output part came from the input line', () => {
    const bad = outputs.filter(([line, out]) => {
      const inputParts = line.split(' / ');
      return out
        .split(' / ')
        .some((p) => !inputParts.some((ip) => ip === p || ip.startsWith(p + ' (')));
    });
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

describe('abridgeAcquisition: lines where the instance step drops a source', () => {
  // Two or more parts, output differs, every output part is an untouched input
  // part, and none is a craft or priced vendor: only the instance rule does that.
  const dropped: Record<string, string> = {};
  for (const line of LINES) {
    const parts = line.split(' / ');
    if (parts.length < 2) continue;
    const out = abridgeAcquisition(line);
    if (out === line) continue;
    const outParts = out.split(' / ');
    if (outParts.some((p) => isCraft(p) || isPricedVendor(p))) continue;
    // A removed price bracket is the vendor rule, not the instance rule.
    if (!outParts.every((p) => parts.includes(p))) continue;
    dropped[line] = out;
  }

  it('matches the pinned list', () => {
    const pinned = JSON.parse(readFileSync(DROPS_PATH, 'utf-8')) as Record<string, string>;
    // If this fails, a table refresh added or changed a line where Abridged
    // drops a source. A person should check the new line against the rules
    // and update glamour-abridged-drops.json.
    expect(dropped).toEqual(pinned);
  });
});
