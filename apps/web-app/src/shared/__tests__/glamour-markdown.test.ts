/**
 * Tests for the GPOSERS-style glamour list generators.
 *
 * The output is pasted into a submission form by hand, so the contract is the
 * exact text: bold slot labels, worn slots only in the template's order,
 * `Dye 1` / `Dye 2` only where a channel is actually dyed, and `Acquisition:`
 * left blank for the player to fill in. Three renderings share one model:
 * Markdown for the .md download, plain text and HTML for the clipboard.
 */

import { describe, it, expect } from 'vitest';
import {
  GLAMOUR_ABRIDGED_FILENAME,
  GLAMOUR_MARKDOWN_FILENAME,
  OBTAINED_LABEL,
  buildGlamourHtml,
  buildGlamourMarkdown,
  buildGlamourPlainText,
  type GlamourMarkdownInput,
} from '../glamour-markdown';

const FULL: GlamourMarkdownInput = {
  MainHand: { name: 'Runaway Bow', dye1: 'Jet Black', dye2: 'Snow White' },
  OffHand: { name: 'Runaway Bow', dye1: 'Jet Black' },
  HeadGear: { name: 'Beech Mask of Casting', dye2: 'Rolanberry Red' },
  Body: { name: 'Chivalric Coat of Fending', dye1: 'Jet Black', dye2: 'Jet Black' },
  Hands: { name: 'Ramie Gloves' },
  Legs: { name: 'Ramie Slops', dye1: '#123' },
  Feet: { name: 'Ramie Shoes' },
  Ears: { name: "Menphina's Earring" },
  Neck: { name: 'Blessed Fletchings' },
  Wrists: { name: 'Dawnlight Bracelet' },
  RightRing: { name: 'Ring of Fire' },
  LeftRing: { name: 'Ring of Ice' },
  Facewear: { name: 'Silver Spectacles' },
};

describe('buildGlamourMarkdown', () => {
  it('writes the GPOSERS template exactly: bold header, bold slot labels, dye lines only where dyed, blank Acquisition', () => {
    expect(buildGlamourMarkdown(FULL)).toBe(
      [
        '**Glamour Items:**',
        '**Main Hand:** Runaway Bow',
        'Dye 1: Jet Black',
        'Dye 2: Snow White',
        'Acquisition:',
        '',
        '**Off Hand:** Runaway Bow',
        'Dye 1: Jet Black',
        'Acquisition:',
        '',
        '**Head:** Beech Mask of Casting',
        'Dye 2: Rolanberry Red',
        'Acquisition:',
        '',
        '**Body:** Chivalric Coat of Fending',
        'Dye 1: Jet Black',
        'Dye 2: Jet Black',
        'Acquisition:',
        '',
        '**Hands:** Ramie Gloves',
        'Acquisition:',
        '',
        '**Legs:** Ramie Slops',
        'Dye 1: #123',
        'Acquisition:',
        '',
        '**Feet:** Ramie Shoes',
        'Acquisition:',
        '',
        "**Earrings:** Menphina's Earring",
        'Acquisition:',
        '',
        '**Necklace:** Blessed Fletchings',
        'Acquisition:',
        '',
        '**Bracelets:** Dawnlight Bracelet',
        'Acquisition:',
        '',
        '**Right Ring:** Ring of Fire',
        'Acquisition:',
        '',
        '**Left Ring:** Ring of Ice',
        'Acquisition:',
        '',
        '**Facewear:** Silver Spectacles',
        'Acquisition:',
        '',
      ].join('\n')
    );
  });

  it('lists worn slots only, in the template order regardless of input order', () => {
    const text = buildGlamourMarkdown({
      LeftRing: { name: 'Ring of Ice' },
      RightRing: { name: 'Ring of Fire' },
      Body: { name: 'Coat' },
    });
    expect(text.match(/^\*\*[^*]+:\*\*/gm)).toEqual([
      '**Glamour Items:**',
      '**Body:**',
      '**Right Ring:**',
      '**Left Ring:**',
    ]);
    expect(text).not.toContain('Fashion Accessory');
  });

  it('keeps a worn slot whose name is unknown, with the label left bare for filling in', () => {
    expect(buildGlamourMarkdown({ Body: { dye1: 'Jet Black' } })).toBe(
      '**Glamour Items:**\n**Body:**\nDye 1: Jet Black\nAcquisition:\n'
    );
  });

  it('writes only the header when nothing is worn', () => {
    expect(buildGlamourMarkdown({})).toBe('**Glamour Items:**');
  });

  it('never writes a dye line on an accessory, even when a file claims one', () => {
    expect(buildGlamourMarkdown({ Ears: { name: 'Earring', dye1: 'Jet Black' } })).toBe(
      '**Glamour Items:**\n**Earrings:** Earring\nAcquisition:\n'
    );
  });

  it('leaves no trailing space behind a blank value', () => {
    expect(buildGlamourMarkdown({ Body: {}, Ears: {} })).not.toMatch(/ $/m);
  });

  it('names the download without any character name in it', () => {
    expect(GLAMOUR_MARKDOWN_FILENAME).toBe('glamour-equipment.md');
  });
});

describe('the Acquisition line and the rings (GPOSERS reminders, March 2026)', () => {
  const WITH_LINES: GlamourMarkdownInput = {
    HeadGear: { name: 'Hempen Coif', dye1: 'Snow White', acquisition: 'Crafted (WVR Lvl. 3)' },
    Body: { name: 'Plain Robe', acquisition: null },
  };

  it('writes the line in all three renderings, and the bare label without one', () => {
    expect(buildGlamourMarkdown(WITH_LINES)).toContain('Acquisition: Crafted (WVR Lvl. 3)');
    expect(buildGlamourPlainText(WITH_LINES)).toContain('Acquisition: Crafted (WVR Lvl. 3)');
    expect(buildGlamourHtml(WITH_LINES)).toContain('Acquisition: Crafted (WVR Lvl. 3)');
    expect(buildGlamourPlainText(WITH_LINES)).toContain('Body: Plain Robe\nAcquisition:\n');
  });

  it('writes two identical rings once, as Rings', () => {
    const text = buildGlamourPlainText({
      RightRing: { name: 'Ring of Ascension', acquisition: 'Some Vendor - Old Gridania (1 Gil)' },
      LeftRing: { name: 'Ring of Ascension', acquisition: 'Some Vendor - Old Gridania (1 Gil)' },
    });
    expect(text).toBe(
      'Glamour Items:\nRings: Ring of Ascension\nAcquisition: Some Vendor - Old Gridania (1 Gil)\n'
    );
  });

  it('keeps two different rings apart', () => {
    const text = buildGlamourPlainText({
      RightRing: { name: 'Ring A' },
      LeftRing: { name: 'Ring B' },
    });
    expect(text).toContain('Right Ring: Ring A');
    expect(text).toContain('Left Ring: Ring B');
  });
});

describe('buildGlamourPlainText', () => {
  it('is the Markdown rendering without the asterisks — nothing else differs', () => {
    expect(buildGlamourPlainText(FULL)).toBe(buildGlamourMarkdown(FULL).replaceAll('**', ''));
    expect(buildGlamourPlainText(FULL)).not.toContain('*');
  });
});

describe('buildGlamourHtml', () => {
  it('bolds the header and slot labels with <strong>, one paragraph per slot with <br> line breaks', () => {
    expect(
      buildGlamourHtml({
        MainHand: { name: 'Runaway Bow', dye1: 'Jet Black' },
        Ears: { name: "Menphina's Earring" },
      })
    ).toBe(
      '<p><strong>Glamour Items:</strong><br>' +
        '<strong>Main Hand:</strong> Runaway Bow<br>' +
        'Dye 1: Jet Black<br>' +
        'Acquisition:</p>' +
        '<p><strong>Earrings:</strong> Menphina&#39;s Earring<br>Acquisition:</p>'
    );
  });

  it('escapes markup in names so an item can never inject HTML', () => {
    const html = buildGlamourHtml({ Body: { name: 'Coat <b>&</b> "Tails"' } });
    expect(html).toContain('Coat &lt;b&gt;&amp;&lt;/b&gt; &quot;Tails&quot;');
    expect(html).not.toContain('<b>');
  });

  it('writes only the bold header when nothing is worn', () => {
    expect(buildGlamourHtml({})).toBe('<p><strong>Glamour Items:</strong></p>');
  });
});

describe("the Abridged form (the maintainer's post)", () => {
  const POST: GlamourMarkdownInput = {
    MainHand: {
      name: 'Figment of the Journey',
      dye1: 'Rust Red',
      dye2: 'Ash Grey',
      acquisition: 'Cenote Ja Ja Gural / Vault Oneiron',
    },
    HeadGear: {
      name: 'Cauldronrise Beret',
      dye1: 'Metallic Brass',
      dye2: 'Kobold Brown',
      acquisition: 'Scrip Exchange - Old Gridania',
    },
    Body: {
      name: "Ex-arch's Jacket",
      dye1: 'Raisin Brown',
      dye2: 'Snow White',
      acquisition: 'FFXIV Online Store',
    },
    Hands: {
      name: "Spaekona's Wrist Torques",
      dye1: 'Soot Black',
      dye2: 'Cork Brown',
      acquisition: 'Varsarudh - Old Sharlayan',
    },
    Legs: {
      name: 'Augmented Bygone Brass Brais of Scouting',
      dye1: 'Dark Brown',
      dye2: 'Jet Black',
      acquisition: 'Theone - Solution Nine',
    },
    Feet: {
      name: "Boltfiend's Costume Boots",
      dye1: 'Kobold Brown',
      dye2: 'Metallic Gold',
      acquisition: 'Enie - Ishgard - The Firmament',
    },
    Ears: { name: 'Ironwood Earrings of Crafting', acquisition: 'Crafted (CRP Lvl. 86)' },
    RightRing: { name: 'Rinascita Ring of Fending', acquisition: 'Crafted (CRP Lvl. 90)' },
    LeftRing: { name: 'Rinascita Ring of Fending', acquisition: 'Crafted (CRP Lvl. 90)' },
    Facewear: {
      name: 'Brass Simple Oval Spectacles',
      acquisition: 'Expedition Antiquarian - The Occult Crescent: North Horn',
    },
  };

  it('writes the whole post exactly, in plain text', () => {
    expect(buildGlamourPlainText(POST, 'abridged')).toBe(
      [
        'Main Hand: Figment of the Journey',
        'Dyes: Rust Red / Ash Grey',
        'Obtained: Cenote Ja Ja Gural / Vault Oneiron',
        '',
        'Head: Cauldronrise Beret',
        'Dyes: Metallic Brass / Kobold Brown',
        'Obtained: Scrip Exchange - Old Gridania',
        '',
        "Body: Ex-arch's Jacket",
        'Dyes: Raisin Brown / Snow White',
        'Obtained: FFXIV Online Store',
        '',
        "Hands: Spaekona's Wrist Torques",
        'Dyes: Soot Black / Cork Brown',
        'Obtained: Varsarudh - Old Sharlayan',
        '',
        'Legs: Augmented Bygone Brass Brais of Scouting',
        'Dyes: Dark Brown / Jet Black',
        'Obtained: Theone - Solution Nine',
        '',
        "Feet: Boltfiend's Costume Boots",
        'Dyes: Kobold Brown / Metallic Gold',
        'Obtained: Enie - Ishgard - The Firmament',
        '',
        'Earrings: Ironwood Earrings of Crafting',
        'Obtained: Crafted (CRP Lvl. 86)',
        '',
        'Rings: Rinascita Ring of Fending',
        'Obtained: Crafted (CRP Lvl. 90)',
        '',
        'Facewear: Brass Simple Oval Spectacles',
        'Obtained: Expedition Antiquarian - The Occult Crescent: North Horn',
        '',
      ].join('\n')
    );
  });

  it('bolds the whole first line in Markdown, and writes no header', () => {
    const text = buildGlamourMarkdown(
      { MainHand: { name: 'Figment', dye1: 'Rust Red', dye2: 'Ash Grey', acquisition: 'Here' } },
      'abridged'
    );
    expect(text).toBe('**Main Hand: Figment**\nDyes: Rust Red / Ash Grey\nObtained: Here\n');
  });

  it('bolds the whole first line in the clipboard HTML, one paragraph per slot, escaped', () => {
    expect(
      buildGlamourHtml(
        {
          MainHand: { name: 'Figment <b>', dye1: 'Rust Red', acquisition: 'A & B' },
          Ears: { name: "Menphina's Earring" },
        },
        'abridged'
      )
    ).toBe(
      '<p><strong>Main Hand: Figment &lt;b&gt;</strong><br>Dyes: Rust Red<br>Obtained: A &amp; B</p>' +
        '<p><strong>Earrings: Menphina&#39;s Earring</strong><br>Obtained:</p>'
    );
  });

  it('keeps a bold bare label for a slot with no name, and a bare Obtained: with no source', () => {
    expect(buildGlamourMarkdown({ Body: {} }, 'abridged')).toBe('**Body:**\nObtained:\n');
    expect(buildGlamourPlainText({ Body: {} }, 'abridged')).toBe('Body:\nObtained:\n');
    expect(buildGlamourHtml({ Body: {} }, 'abridged')).toBe(
      '<p><strong>Body:</strong><br>Obtained:</p>'
    );
    expect(buildGlamourPlainText({ Body: {}, Ears: {} }, 'abridged')).not.toMatch(/ $/m);
  });

  describe('the Dyes line', () => {
    const dyesOf = (piece: GlamourMarkdownInput['Body']): string | undefined =>
      buildGlamourPlainText({ Body: piece }, 'abridged')
        .split('\n')
        .find((line) => line.startsWith('Dyes:'));

    it('both channels dyed: A / B', () => {
      expect(dyesOf({ dye1: 'A', dye2: 'B' })).toBe('Dyes: A / B');
      expect(dyesOf({ dye1: 'A', dye2: 'B', dyeSlots: 2 })).toBe('Dyes: A / B');
    });

    it('only channel 2 dyed: None / B, whatever the slot count', () => {
      expect(dyesOf({ dye2: 'B' })).toBe('Dyes: None / B');
      expect(dyesOf({ dye2: 'B', dyeSlots: 2 })).toBe('Dyes: None / B');
    });

    it('only channel 1 dyed on a piece known to have two slots: A / None', () => {
      expect(dyesOf({ dye1: 'A', dyeSlots: 2 })).toBe('Dyes: A / None');
    });

    it('only channel 1 dyed on one slot, or an unknown count: A', () => {
      expect(dyesOf({ dye1: 'A', dyeSlots: 1 })).toBe('Dyes: A');
      expect(dyesOf({ dye1: 'A', dyeSlots: null })).toBe('Dyes: A');
      expect(dyesOf({ dye1: 'A' })).toBe('Dyes: A');
    });

    it('nothing dyed: no line, even on a piece with two slots', () => {
      expect(dyesOf({ name: 'Coat' })).toBeUndefined();
      expect(dyesOf({ name: 'Coat', dyeSlots: 2 })).toBeUndefined();
    });

    it('never on an accessory or facewear, even when a file claims a dye', () => {
      const text = buildGlamourPlainText(
        {
          Ears: { name: 'Earring', dye1: 'A', dye2: 'B', dyeSlots: 2 },
          Facewear: { name: 'Glasses', dye1: 'A' },
        },
        'abridged'
      );
      expect(text).toBe('Earrings: Earring\nObtained:\n\nFacewear: Glasses\nObtained:\n');
    });

    it('takes the slot count from the piece on that line, not a neighbour', () => {
      const text = buildGlamourPlainText(
        { HeadGear: { dye1: 'A', dyeSlots: 1 }, Body: { dye1: 'B', dyeSlots: 2 } },
        'abridged'
      );
      expect(text).toBe('Head:\nDyes: A\nObtained:\n\nBody:\nDyes: B / None\nObtained:\n');
    });

    it('is not fooled by a piece named like a dye label', () => {
      expect(buildGlamourPlainText({ Body: { name: 'Dye 1:' } }, 'abridged')).toBe(
        'Body: Dye 1:\nObtained:\n'
      );
    });
  });

  it('writes the acquisition line as given: the sheet is what shortens it', () => {
    const text = buildGlamourPlainText(
      { Body: { acquisition: 'Crafted (WVR Lvl. 3) / Vendor - Town (10 Gil)' } },
      'abridged'
    );
    expect(text).toBe('Body:\nObtained: Crafted (WVR Lvl. 3) / Vendor - Town (10 Gil)\n');
  });

  it("shares the full form's one-line cleaning, rings and worn-only rules", () => {
    expect(
      buildGlamourPlainText(
        {
          LeftRing: { name: 'Ring A' },
          RightRing: { name: 'Ring B', acquisition: 'Vendor\nTown' },
        },
        'abridged'
      )
    ).toBe('Right Ring: Ring B\nObtained: Vendor Town\n\nLeft Ring: Ring A\nObtained:\n');
  });

  it('gives an empty string for empty input in all three renderings', () => {
    expect(buildGlamourMarkdown({}, 'abridged')).toBe('');
    expect(buildGlamourPlainText({}, 'abridged')).toBe('');
    expect(buildGlamourHtml({}, 'abridged')).toBe('');
  });

  it('leaves the full form byte-identical, by default and when asked by name', () => {
    const withSlots: GlamourMarkdownInput = {
      ...FULL,
      MainHand: { ...FULL.MainHand, dyeSlots: 2 },
      Legs: { ...FULL.Legs, dyeSlots: 1 },
    };
    expect(buildGlamourMarkdown(withSlots)).toBe(buildGlamourMarkdown(FULL));
    expect(buildGlamourMarkdown(FULL, 'full')).toBe(buildGlamourMarkdown(FULL));
    expect(buildGlamourPlainText(withSlots, 'full')).toBe(buildGlamourPlainText(FULL));
    expect(buildGlamourHtml(withSlots, 'full')).toBe(buildGlamourHtml(FULL));
    expect(buildGlamourPlainText(FULL)).toContain('Glamour Items:');
  });

  it('names its own download and its own field label', () => {
    expect(GLAMOUR_ABRIDGED_FILENAME).toBe('glamour-equipment-abridged.md');
    expect(OBTAINED_LABEL).toBe('Obtained:');
  });
});
