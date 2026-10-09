/**
 * CharaSheet — THIS CHARACTER, one card per colour slot on the loaded file.
 *
 * Real services (setup.ts initialises LanguageService with EN and the dye
 * database) and core's real parser, so the slots and grid addresses are the
 * ones a player's file would produce.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CharaSlotId } from '@xivdyetools/core';
import { CharaSheet, saveCharacterColors, type CharaSheetOptions } from '../chara-sheet';
import { CollectionService, LanguageService, ToastService } from '@services/index';
import { CharaSessionService } from '@services/chara-session-service';
import { ThemeService } from '@services/theme-service';
import { loadCharaFile } from '@services/chara-file-loader';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';

/** Miqo'te female, both eyes on cell 42; the lip index sits in the unused 96–127 gap. */
const FIXTURE = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  Nickname: 'Test Subject',
  Race: 'Miqote',
  Tribe: 'SeekerOfTheSun',
  Gender: 'Feminine',
  REyeColor: 42,
  LEyeColor: 42,
  LipsToneFurPattern: 100,
});

async function load(text: string = FIXTURE, fileName = 'test.chara'): Promise<void> {
  const file = new File([text], fileName, { type: 'application/json' });
  if (typeof (file as Blob).text !== 'function') {
    (file as unknown as { text: () => Promise<string> }).text = () => Promise.resolve(text);
  }
  const result = await loadCharaFile(file);
  expect(result).toEqual({ ok: true });
}

const hosts: HTMLElement[] = [];
const sheets: CharaSheet[] = [];

function mountSheet(options: Partial<CharaSheetOptions> = {}) {
  const container = createTestContainer('chara-sheet-host');
  hosts.push(container);
  const onSlotPick = vi.fn<CharaSheetOptions['onSlotPick']>();
  const sheet = new CharaSheet(container, { onSlotPick, ...options });
  sheet.init();
  sheets.push(sheet);
  return { container, onSlotPick };
}

/** The live slot cards (absent slots are dashed divs, not buttons). */
const slotButtons = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('.chara-slots-grid > button'));
/** Cards drawn with the accent selection ring. */
const ringed = (container: HTMLElement) =>
  slotButtons(container).filter((b) =>
    b.getAttribute('style')?.includes('box-shadow: 0 0 0 1px var(--theme-primary)')
  );
/** Cards announced as the current pick. */
const pressed = (container: HTMLElement) =>
  slotButtons(container).filter((b) => b.getAttribute('aria-pressed') === 'true');

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  // CollectionService keeps its records in memory; clearing storage alone
  // would leak one test's saves into the next one's duplicate-name check.
  CollectionService.reset();
  CharaSessionService.setSession(null);
});

afterEach(() => {
  for (const sheet of sheets.splice(0)) sheet.destroy();
  CharaSessionService.setSession(null);
  for (const host of hosts.splice(0)) cleanupTestContainer(host);
});

describe('CharaSheet — THIS CHARACTER', () => {
  it('stays empty until a file is loaded, then draws one card per slot', async () => {
    const { container } = mountSheet();
    expect(container.childElementCount).toBe(0);

    await load();

    expect(container.textContent).toContain(LanguageService.t('swatch.slotsHead'));
    const resolved = CharaSessionService.getSession()!.resolved;
    expect(container.querySelector('.chara-slots-grid')!.childElementCount).toBe(
      resolved.slots.length
    );
  });

  it('says why an unreadable slot is empty, in the keyed sentence', async () => {
    const { container } = mountSheet();
    await load();

    expect(container.textContent).toContain(LanguageService.t('swatch.slotError.midRangeIndex'));
    expect(container.textContent).not.toContain('LipsToneFurPattern');
  });

  it('hands a picked slot to the host with its grid address, and rings it', async () => {
    const { container, onSlotPick } = mountSheet();
    await load();

    const card = slotButtons(container)[0]!;
    card.click();

    expect(onSlotPick).toHaveBeenCalledTimes(1);
    const [hex, label, gridRef, slot] = onSlotPick.mock.calls[0]!;
    expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(label.length).toBeGreaterThan(0);
    expect(gridRef).toEqual({ paletteBase: 'eyeColors', variant: null, sheetIndex: 42 });
    expect(['leftEye', 'rightEye']).toContain(slot);
    expect(ringed(container)).toHaveLength(1);
  });

  it('draws the host-supplied slot selected on the first render', async () => {
    await load();
    const firstSlot = CharaSessionService.getSession()!.resolved.slots[0]!.slot;

    const { container } = mountSheet({ selectedSlot: firstSlot });

    expect(ringed(container)).toHaveLength(1);
    expect(pressed(container)).toEqual([ringed(container)[0]]);
  });

  it('drops the ring when a different file replaces the character', async () => {
    const { container } = mountSheet();
    await load();
    slotButtons(container)[0]!.click();
    expect(ringed(container)).toHaveLength(1);

    CharaSessionService.setSession(null);
    await load(FIXTURE, 'other.chara');

    expect(slotButtons(container).length).toBeGreaterThan(0);
    expect(ringed(container)).toHaveLength(0);
    expect(pressed(container)).toHaveLength(0);
  });

  // BUG-083 (2026-10-04 deep-dive): a pick re-rendered the whole sheet, so the
  // focused card was detached and keyboard focus fell to <body>; no card said
  // which one was picked to a screen reader.
  it('moves the ring in place, keeping keyboard focus on the picked card', async () => {
    const { container, onSlotPick } = mountSheet();
    await load();
    const [first, second] = slotButtons(container);
    expect(second).toBeDefined();
    expect(slotButtons(container).map((b) => b.getAttribute('aria-pressed'))).toEqual(
      slotButtons(container).map(() => 'false')
    );

    first!.focus();
    first!.click();
    second!.focus();
    second!.click();

    expect(onSlotPick).toHaveBeenCalledTimes(2);
    // The same nodes, still mounted: nothing was rebuilt under the keyboard.
    expect(slotButtons(container)[0]).toBe(first);
    expect(slotButtons(container)[1]).toBe(second);
    expect(second!.isConnected).toBe(true);
    expect(document.activeElement).toBe(second);
    expect(first!.getAttribute('aria-pressed')).toBe('false');
    expect(second!.getAttribute('aria-pressed')).toBe('true');
    expect(ringed(container)).toEqual([second]);
  });

  // BUG-083 follow-up (2026-10-04 Sprint 22 review): the host drops a slot pick
  // in several places (a grid cell, a palette chip, Clear) without remounting
  // the sheet, so the ring and aria-pressed have to be movable from outside.
  describe('setSelectedSlot', () => {
    it('moves the ring to the named slot in place', async () => {
      const { container, onSlotPick } = mountSheet();
      await load();
      const [first, second] = slotButtons(container);
      first!.click();

      sheets[0]!.setSelectedSlot(second!.dataset.slot as CharaSlotId);

      expect(slotButtons(container)[0]).toBe(first);
      expect(pressed(container)).toEqual([second]);
      expect(ringed(container)).toEqual([second]);
      // Only a click is a pick: the host already knows what it asked for.
      expect(onSlotPick).toHaveBeenCalledTimes(1);
    });

    it('with null, leaves no card ringed or pressed', async () => {
      const { container } = mountSheet();
      await load();
      slotButtons(container)[0]!.click();

      sheets[0]!.setSelectedSlot(null);

      expect(ringed(container)).toHaveLength(0);
      expect(pressed(container)).toHaveLength(0);
    });
  });

  // BUG-083 follow-up (2026-10-04 Sprint 22 review): the ΔE tier colours and
  // the error red are hexes read from the theme at render. A slot click used
  // to re-render the whole sheet and so repainted them; once the pick moved in
  // place, nothing repainted them after a theme switch.
  describe('theme switches', () => {
    const TIER_RAMP_LIGHT = ['#137A33', '#1C7D3A', '#B45309', '#B91C1C'];
    const TIER_RAMP_DARK = ['#5bbd68', '#8bc34a', '#ffc107', '#f4645a'];
    const inlineStyles = (container: HTMLElement): string =>
      Array.from(container.querySelectorAll('[style]'))
        .map((node) => node.getAttribute('style') ?? '')
        .join('\n');
    /** The tier-coloured ΔE number on each live card. */
    const deltaColours = (container: HTMLElement): string[] =>
      slotButtons(container).map((card) => {
        const spans = Array.from(card.querySelectorAll<HTMLElement>('span'));
        return spans[spans.length - 1]!.style.color;
      });

    let startTheme: ReturnType<typeof ThemeService.getCurrentTheme>;

    beforeEach(() => {
      startTheme = ThemeService.getCurrentTheme();
      ThemeService.setTheme('standard-light');
    });

    afterEach(() => {
      ThemeService.setTheme(startTheme);
    });

    it('repaints the tier colours and the error red in the new palette', async () => {
      const { container } = mountSheet();
      await load();
      const light = inlineStyles(container);
      expect(TIER_RAMP_LIGHT.some((hex) => light.includes(hex))).toBe(true);
      const lightDeltas = deltaColours(container);

      ThemeService.setTheme('standard-dark');

      const dark = inlineStyles(container);
      for (const hex of TIER_RAMP_LIGHT) {
        expect(dark).not.toContain(hex);
      }
      // The unreadable lip's sentence, in the dark theme's red
      expect(dark).toContain('color: #f4645a');
      expect(deltaColours(container)).not.toEqual(lightDeltas);
      expect(TIER_RAMP_DARK.some((hex) => dark.includes(hex))).toBe(true);
    });

    it('keeps the picked slot ringed and pressed', async () => {
      const { container } = mountSheet();
      await load();
      const picked = slotButtons(container)[1]!;
      picked.click();

      ThemeService.setTheme('standard-dark');

      expect(pressed(container).map((b) => b.dataset.slot)).toEqual([picked.dataset.slot]);
      expect(ringed(container).map((b) => b.dataset.slot)).toEqual([picked.dataset.slot]);
    });

    it('draws the slot the host last set, not the last one clicked', async () => {
      const { container } = mountSheet();
      await load();
      const [first, second] = slotButtons(container);
      first!.click();
      sheets[0]!.setSelectedSlot(second!.dataset.slot as CharaSlotId);

      ThemeService.setTheme('standard-dark');

      expect(pressed(container).map((b) => b.dataset.slot)).toEqual([second!.dataset.slot]);
    });

    it('keeps keyboard focus on the same slot card', async () => {
      const { container } = mountSheet();
      await load();
      const focused = slotButtons(container)[1]!;
      focused.focus();
      expect(document.activeElement).toBe(focused);

      ThemeService.setTheme('standard-dark');

      const active = document.activeElement as HTMLElement | null;
      expect(active?.isConnected).toBe(true);
      expect(container.contains(active)).toBe(true);
      expect(active?.dataset.slot).toBe(focused.dataset.slot);
    });

    it('stops listening once destroyed', async () => {
      const { container } = mountSheet();
      await load();
      sheets[0]!.destroy();
      expect(container.childElementCount).toBe(0);

      ThemeService.setTheme('standard-dark');

      expect(container.childElementCount).toBe(0);
    });
  });
});

describe('saveCharacterColors', () => {
  it('saves the closest dye for each worn colour as a character record, named after the character', async () => {
    const success = vi.spyOn(ToastService, 'success').mockImplementation(() => '');
    await load();

    saveCharacterColors(CharaSessionService.getSession()!);

    const saved = CollectionService.getCollections().find((c) => c.kind === 'character');
    expect(saved?.name).toBe('Test Subject');
    // Both eyes share one cell, so one colour — and one dye.
    expect(saved?.dyes).toHaveLength(1);
    expect(success).toHaveBeenCalledWith(LanguageService.t('swatch.characterSavedOne'));
  });

  const characterRecords = () =>
    CollectionService.getCollections().filter((c) => c.kind === 'character');

  // BUG-016 (2026-10-04 deep-dive): a second save under the same name hit
  // createCollection's duplicate check and showed the generic failure toast.
  it('saves a second copy under a numbered name instead of failing on the duplicate', async () => {
    const success = vi.spyOn(ToastService, 'success').mockImplementation(() => '');
    const error = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
    await load();
    const session = CharaSessionService.getSession()!;

    saveCharacterColors(session);
    saveCharacterColors(session);

    expect(error).not.toHaveBeenCalled();
    expect(characterRecords().map((c) => c.name)).toEqual(['Test Subject', 'Test Subject (1)']);
    expect(success).toHaveBeenCalledTimes(2);
  });

  it('numbers a 50-character name by trimming the name, never the suffix', async () => {
    vi.spyOn(ToastService, 'success').mockImplementation(() => '');
    const long = 'N'.repeat(60);
    await load(JSON.stringify({ ...JSON.parse(FIXTURE), Nickname: long }));
    const session = CharaSessionService.getSession()!;

    saveCharacterColors(session);
    saveCharacterColors(session);

    expect(characterRecords().map((c) => c.name)).toEqual([
      'N'.repeat(50),
      `${'N'.repeat(46)} (1)`,
    ]);
  });

  it('says the collection limit is reached instead of "save failed" when there is no room', async () => {
    const warning = vi.spyOn(ToastService, 'warning').mockImplementation(() => '');
    const error = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
    for (let i = 0; i < 50; i++) CollectionService.createCollection(`Seed ${i}`);
    await load();

    saveCharacterColors(CharaSessionService.getSession()!);

    expect(characterRecords()).toHaveLength(0);
    expect(error).not.toHaveBeenCalledWith(LanguageService.t('errors.saveChangesFailed'));
    expect(warning).toHaveBeenCalledWith(LanguageService.t('collections.collectionsLimitReached'));
  });

  // BUG-082 (2026-10-04 deep-dive): `??` kept an empty or whitespace Nickname,
  // which trims to nothing, so createCollection rejected every save.
  it.each(['', '   '])(
    'names the record after the file when the Nickname is %j',
    async (nickname) => {
      vi.spyOn(ToastService, 'success').mockImplementation(() => '');
      const error = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
      await load(JSON.stringify({ ...JSON.parse(FIXTURE), Nickname: nickname }), 'blank.chara');

      saveCharacterColors(CharaSessionService.getSession()!);

      expect(error).not.toHaveBeenCalled();
      expect(characterRecords().map((c) => c.name)).toEqual(['blank.chara']);
    }
  );
});
