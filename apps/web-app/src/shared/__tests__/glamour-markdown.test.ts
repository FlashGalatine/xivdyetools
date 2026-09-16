/**
 * Tests for the GPOSERS-style glamour list generator.
 *
 * The output is pasted into a submission form by hand, so the contract is the
 * exact text: bold slot labels, the fourteen template slots always present in
 * the template's order, `Dye 1` / `Dye 2` only where the game has a channel,
 * and `Acquisition:` left blank for the player to fill in.
 */

import { describe, it, expect } from 'vitest';
import {
  GLAMOUR_MARKDOWN_FILENAME,
  buildGlamourMarkdown,
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
  it('writes the GPOSERS template exactly: bold header, bold slot labels, dye lines on dyeable slots, blank Acquisition', () => {
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
        'Dye 2:',
        'Acquisition:',
        '',
        '**Head:** Beech Mask of Casting',
        'Dye 1:',
        'Dye 2: Rolanberry Red',
        'Acquisition:',
        '',
        '**Body:** Chivalric Coat of Fending',
        'Dye 1: Jet Black',
        'Dye 2: Jet Black',
        'Acquisition:',
        '',
        '**Hands:** Ramie Gloves',
        'Dye 1:',
        'Dye 2:',
        'Acquisition:',
        '',
        '**Legs:** Ramie Slops',
        'Dye 1: #123',
        'Dye 2:',
        'Acquisition:',
        '',
        '**Feet:** Ramie Shoes',
        'Dye 1:',
        'Dye 2:',
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
        '**Fashion Accessory:**',
        'Acquisition:',
        '',
      ].join('\n')
    );
  });

  it('emits every template slot even when nothing is known, so the player has the whole form to fill in', () => {
    const text = buildGlamourMarkdown({});
    const labels = text.match(/^\*\*[^*]+:\*\*/gm) ?? [];
    expect(labels).toEqual([
      '**Glamour Items:**',
      '**Main Hand:**',
      '**Off Hand:**',
      '**Head:**',
      '**Body:**',
      '**Hands:**',
      '**Legs:**',
      '**Feet:**',
      '**Earrings:**',
      '**Necklace:**',
      '**Bracelets:**',
      '**Right Ring:**',
      '**Left Ring:**',
      '**Facewear:**',
      '**Fashion Accessory:**',
    ]);
    // Seven dyeable slots × two channels; the accessory slots get none.
    expect(text.match(/^Dye [12]:/gm)).toHaveLength(14);
    expect(text.match(/^Acquisition:/gm)).toHaveLength(14);
  });

  it('never writes a dye line on an accessory, even when a file claims one', () => {
    const text = buildGlamourMarkdown({ Ears: { name: 'Earring', dye1: 'Jet Black' } });
    const earrings = text.slice(text.indexOf('**Earrings:**'), text.indexOf('**Necklace:**'));
    expect(earrings).toBe('**Earrings:** Earring\nAcquisition:\n\n');
  });

  it('leaves no trailing space behind a blank value', () => {
    expect(buildGlamourMarkdown({})).not.toMatch(/ $/m);
  });

  it('names the download without any character name in it', () => {
    expect(GLAMOUR_MARKDOWN_FILENAME).toBe('glamour-equipment.md');
  });
});
