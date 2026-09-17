/**
 * /swatch business-logic tests — the character-file frame against core's own
 * fixture corpus (real parse rules, real palette sheets, real dye matching).
 */
import { describe, it, expect } from 'vitest';
import { parseCharaFile } from '@xivdyetools/core';
import { executeSwatch, type SwatchInput } from './swatch.js';
import {
  DUSKWIGHT_HETEROCHROMIA,
  HROTHGAR_HELIONS,
} from './__fixtures__/chara-fixtures.js';

const FIXTURES: Record<string, string> = {
  'duskwight-heterochromia.chara': DUSKWIGHT_HETEROCHROMIA,
  'hrothgar-helions.chara': HROTHGAR_HELIONS,
};
const fixture = (name: string): string => FIXTURES[name];

/** The fixture as an object, for format-proof field injection. */
const parsedFixture = (name: string): Record<string, unknown> =>
  JSON.parse(fixture(name)) as Record<string, unknown>;

/**
 * The Duskwight fixture with a Ktisis nickname, injected by object merge
 * rather than string surgery so a re-vendored fixture cannot silently turn
 * the injection into a no-op. Players routinely use their real name here —
 * and as the `.chara` export filename ("Firstname Lastname.chara").
 */
const WITH_NICKNAME = JSON.stringify({
  ...parsedFixture('duskwight-heterochromia.chara'),
  Nickname: 'Real Name',
});

/**
 * Minimal heterochromia file, both eyes pushed OFF GRID: `REyeColor: 42`
 * (left eye, index hex `#DCBA6C` — a golden tan) and `LEyeColor: 169` (right
 * eye, index hex `#87C0A3` — a sage green), each paired with an extended
 * float (`LeftEyeColor`/`RightEyeColor`, crossed per the parser's own rule)
 * set to a saturated primary nowhere near its index colour — pure blue and
 * pure red respectively — to push ΔE2000 far past `OFF_GRID_DELTA_E2000` (6).
 * Every other colour key is omitted, so hair/skin/lip/etc. all resolve inert
 * and the only two live rows are the eyes (BUG-006).
 */
const HETEROCHROMIA_OFF_GRID = JSON.stringify({
  IsExtendedAppearanceValid: true,
  REyeColor: 42,
  LEyeColor: 169,
  LeftEyeColor: '0, 0, 1',
  RightEyeColor: '1, 0, 0',
});

/**
 * Same shape, but both eyes share index 42 (`eyesShareIndex: true`) — only
 * the left eye carries a divergent float, which is enough: the right eye row
 * never renders when the indices match (`executeSwatch` merges it away), so
 * this fixture covers the "shared-index off grid" arm of BUG-006 (the `·LR`
 * label badge) independent of what the right eye's own verdict would have
 * been.
 */
const HETEROCHROMIA_SHARED_OFF_GRID = JSON.stringify({
  IsExtendedAppearanceValid: true,
  REyeColor: 42,
  LEyeColor: 42,
  LeftEyeColor: '0, 0, 1',
});

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
    // Heterochromia: split eyes carry an ·L/·R suffix on the slot LABEL (this
    // fixture has 7 live slots, so the cap drops the two safest — the left
    // eye among them)
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

  describe('chara-name privacy (PRIVACY_POLICY §3)', () => {
    it('the nickname fixture really carries the nickname — guards the guards below', () => {
      expect(parseCharaFile(WITH_NICKNAME).nickname).toBe('Real Name');
    });

    it('never displays the character name on the card or the embed', async () => {
      const result = await executeSwatch({ fileText: WITH_NICKNAME, locale: 'en' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.svgString).not.toContain('Real Name');
      expect(result.embed.title).not.toContain('Real Name');
      expect(result.embed.description).not.toContain('Real Name');
      expect(result.embed.title).toBe('Character swatch');
    });

    it('never displays the character name on the slot: route either', async () => {
      const result = await executeSwatch({ fileText: WITH_NICKNAME, locale: 'en', slot: 'hair' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.svgString).not.toContain('Real Name');
      expect(result.embed.title).not.toContain('Real Name');
      expect(result.embed.description).not.toContain('Real Name');
      expect(result.embed.title).toBe('Character swatch');
    });

    it('never returns the Ktisis nickname on result.character', async () => {
      const result = await executeSwatch({ fileText: WITH_NICKNAME, locale: 'en' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect('nickname' in result.character).toBe(false);
    });

    it('takes no filename — the attachment name cannot reach the renderer', () => {
      // Type-level guard: `SwatchInput.fileName` was removed in 3.0.0. If the
      // field ever returns, the excess-property error below disappears and
      // the `@ts-expect-error` itself fails type-check.
      const input: SwatchInput = {
        fileText: fixture('duskwight-heterochromia.chara'),
        locale: 'en',
        // @ts-expect-error — no `fileName` on SwatchInput (chara-name privacy, 3.0.0)
        fileName: 'duskwight.chara',
      };
      expect(input.fileText).toContain('"Tribe": "Duskwight"');
    });

    it('prints only a known producer token — a hand-edited TypeName is omitted', async () => {
      // `TypeName` is free text the uploader controls; only the exporter
      // families print (as a fixed token), so the identifier line can never
      // carry a name smuggled in through that field.
      const base = parsedFixture('duskwight-heterochromia.chara');
      const named = await executeSwatch({
        fileText: JSON.stringify({ ...base, TypeName: 'Firstname Lastname' }),
        locale: 'en',
      });
      const known = await executeSwatch({
        fileText: JSON.stringify({ ...base, TypeName: 'Anamnesis Character File' }),
        locale: 'en',
      });

      expect(named.ok && known.ok).toBe(true);
      if (!named.ok || !known.ok) return;
      expect(named.svgString).not.toContain('Firstname');
      expect(named.svgString).not.toContain('FIRSTNAME');
      expect(named.embed.description).not.toContain('Firstname');
      expect(known.svgString).toContain('DUSKWIGHT ♀ · ANAMNESIS');
      expect(known.svgString).not.toContain('CHARACTER FILE');
    });
  });

  describe('BUG-006: off-grid eyes keep their L/R marker', () => {
    // The marker rides the slot LABEL line ("EYES·L"), not the address line.
    // The address line's off-grid token already fills its 56px lead budget
    // (I18N-011 in @xivdyetools/svg — "OFF GRID" alone clears it by ~1.4px),
    // so a suffix there used to ellipsise away on an off-grid row in 5 of 6
    // locales. The label line has real headroom for every locale's slot
    // short + "·LR" (worst case "AUGEN·LR" at 54.56 of 56px, verified by hand
    // against `textWidth` — see the fix report), which is what makes the
    // marker survive regardless of grid state or locale. en is the primary
    // case now that width is no longer a factor; zh below is the kept CJK
    // case.
    it('gives heterochromia off-grid eyes distinct ·L / ·R LABEL markers, addr unmarked', async () => {
      const result = await executeSwatch({ fileText: HETEROCHROMIA_OFF_GRID, locale: 'en' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Sanity: both eyes really did resolve off grid with distinct indices
      // (the bug can't be observed otherwise).
      const leftEye = result.character.slots.find((s) => s.slot === 'leftEye');
      const rightEye = result.character.slots.find((s) => s.slot === 'rightEye');
      expect(leftEye?.verdict).toBe('offGrid');
      expect(rightEye?.verdict).toBe('offGrid');
      expect(result.character.eyesShareIndex).toBe(false);

      // The label carries the marker — the `<` confirms it is the full,
      // un-ellipsised text-node content.
      expect(result.svgString).toContain('EYES·L<');
      expect(result.svgString).toContain('EYES·R<');
      // The address line is the bare OFF-GRID token, on both rows, with no
      // suffix anywhere.
      expect(result.svgString).not.toContain('OFF GRID·');
      expect(result.svgString.match(/OFF GRID</g)?.length).toBe(2);
    });

    it('gives heterochromia off-grid eyes their LABEL marker in a CJK locale too (zh)', async () => {
      const result = await executeSwatch({ fileText: HETEROCHROMIA_OFF_GRID, locale: 'zh' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // "眼睛" (EYES) + "·L"/"·R" — well inside the 56px budget (see the fix
      // report), unlike the address line's "网格外" (OFF GRID), which is
      // deliberately left unmarked.
      expect(result.svgString).toContain('眼睛·L<');
      expect(result.svgString).toContain('眼睛·R<');
      expect(result.svgString).not.toContain('网格外·');
      expect(result.svgString.match(/网格外</g)?.length).toBe(2);
    });

    it('merges shared-index off-grid eyes into one row with an ·LR LABEL marker', async () => {
      const result = await executeSwatch({
        fileText: HETEROCHROMIA_SHARED_OFF_GRID,
        locale: 'en',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.character.eyesShareIndex).toBe(true);
      const leftEye = result.character.slots.find((s) => s.slot === 'leftEye');
      expect(leftEye?.verdict).toBe('offGrid');

      // Now visible directly (no locale/width workaround needed for ·LR).
      expect(result.svgString).toContain('EYES·LR<');
      expect(result.svgString).not.toContain('OFF GRID·');
      // Only one live row total (the merged eye row).
      expect(result.svgString.match(/OFF GRID</g)?.length).toBe(1);
    });
  });
});
