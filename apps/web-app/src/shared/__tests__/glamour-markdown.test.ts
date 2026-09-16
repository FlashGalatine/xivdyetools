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
  GLAMOUR_MARKDOWN_FILENAME,
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
