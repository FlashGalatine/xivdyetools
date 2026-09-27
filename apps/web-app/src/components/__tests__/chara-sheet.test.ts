/**
 * CharaSheet — THIS CHARACTER, one card per colour slot on the loaded file.
 *
 * Real services (setup.ts initialises LanguageService with EN and the dye
 * database) and core's real parser, so the slots and grid addresses are the
 * ones a player's file would produce.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CharaSheet, saveCharacterColors, type CharaSheetOptions } from '../chara-sheet';
import { CollectionService, LanguageService, ToastService } from '@services/index';
import { CharaSessionService } from '@services/chara-session-service';
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

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
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
});
