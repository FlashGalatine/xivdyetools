/**
 * /swatch business-logic tests — the character-file frame against core's own
 * fixture corpus (real parse rules, real palette sheets, real dye matching).
 */
import { describe, it, expect } from 'vitest';
import { executeSwatch } from './swatch.js';
import {
  DUSKWIGHT_HETEROCHROMIA,
  HROTHGAR_HELIONS,
} from './__fixtures__/chara-fixtures.js';

const FIXTURES: Record<string, string> = {
  'duskwight-heterochromia.chara': DUSKWIGHT_HETEROCHROMIA,
  'hrothgar-helions.chara': HROTHGAR_HELIONS,
};
const fixture = (name: string): string => FIXTURES[name];

describe('executeSwatch', () => {
  it('renders the character sheet with live slots only', async () => {
    const result = await executeSwatch({
      fileText: fixture('duskwight-heterochromia.chara'),
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('<svg');
    expect(result.svgString).toContain('/SWATCH');
    expect(result.svgString).toContain('SLOT');
    expect(result.svgString).toContain('NEAREST DYE');
    // Heterochromia: split eyes carry an ·L/·R suffix (this fixture has 7
    // live slots, so the cap drops the two safest — the left eye among them)
    expect(result.svgString).toMatch(/·(L|R)</);
    const height = Number(/height="(\d+)"/.exec(result.svgString)?.[1]);
    expect(height).toBeLessThanOrEqual(350);
    // The footer counts what parsed: 5 of 7
    expect(result.svgString).toContain('nearest by ΔE2000 · 5 of 7 slots');
    // …and the embed names every dropped slot
    expect(result.embed.description).toMatch(/Dropped \(safest\)/);
    expect(result.embed.description).toContain('xivdyetools.app/swatch');
  });

  it('past five live slots the SAFEST match drops, whatever the order', async () => {
    const text = fixture('duskwight-heterochromia.chara');
    const a = await executeSwatch({ fileText: text, locale: 'en' });
    const b = await executeSwatch({ fileText: text, locale: 'en', order: 'hardest' });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    const names = (svg: string): string[] =>
      [...svg.matchAll(/font-weight="600">([^<]+)<\/text>/g)].map((m) => m[1]);
    // Same rows either way (order differs, set does not)
    expect(new Set(names(a.svgString))).toEqual(new Set(names(b.svgString)));
  });

  it('slot: routes to the 14J·2 nearest sheet with the chip still /SWATCH', async () => {
    const result = await executeSwatch({
      fileText: fixture('duskwight-heterochromia.chara'),
      locale: 'en',
      slot: 'hair',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('/SWATCH');
    expect(result.svgString).toContain('RANK');
  });

  it('a missing slot is a sentence, not a frame', async () => {
    const result = await executeSwatch({
      fileText: fixture('hrothgar-helions.chara'),
      locale: 'en',
      // Hrothgar have fur-gated hair highlights; ask for a slot the file
      // cannot serve live. Highlights are fur-inert on Hrothgar.
      slot: 'highlights',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('SLOT_MISSING');
    expect(result.errorMessage).toContain('highlights');
  });

  it('a file that fails to parse names the failure — never a frame', async () => {
    const result = await executeSwatch({ fileText: '{not valid json', locale: 'en' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('PARSE_FAILED');
    expect(result.errorMessage.length).toBeGreaterThan(0);
  });

  it('localizes slot shorts (DE)', async () => {
    const result = await executeSwatch({
      fileText: fixture('duskwight-heterochromia.chara'),
      locale: 'de',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('HAUT');
    expect(result.svgString).toContain('NÄCHSTE FARBE');
  });

  it('never displays the character name — nickname or filename — on the card or embed', async () => {
    // Players routinely use their real name as a Ktisis nickname or as the
    // `.chara` export filename ("Firstname Lastname.chara"). Inject a
    // nickname into the fixture and confirm neither it nor the (formerly
    // accepted) filename ever reaches the rendered SVG or the embed.
    const withNickname = fixture('duskwight-heterochromia.chara').replace(
      '"ModelType": 0,',
      '"ModelType": 0,\n  "Nickname": "Real Name",'
    );
    const result = await executeSwatch({
      fileText: withNickname,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).not.toContain('Real Name');
    expect(result.svgString).not.toContain('duskwight');
    expect(result.embed.title).not.toContain('Real Name');
    expect(result.embed.title).not.toContain('duskwight');
    expect(result.embed.description).not.toContain('Real Name');
    expect(result.embed.description).not.toContain('duskwight');
    expect(result.embed.title).toBe('Character swatch');
  });
});
