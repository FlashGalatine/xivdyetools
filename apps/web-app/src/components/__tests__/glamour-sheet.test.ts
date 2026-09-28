/**
 * The export sheet (design 2c): Copy list and Export .md open a preview of
 * the GPOSERS list with one editable Acquisition field per piece. Edits are
 * kept on this device, keyed by the gear; a twin pick never overwrites one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ResolvedCharaCharacter } from '@xivdyetools/core';
import { ToastService } from '@services/index';
import { AcquisitionEdits, gearHash } from '@shared/acquisition-edits';
import type { GlamourListSource } from '../glamour-list-actions';
import { closeGlamourSheet, openGlamourSheet } from '../glamour-sheet';

const { downloadMock, copyMock } = vi.hoisted(() => ({
  downloadMock: vi.fn(),
  copyMock: vi.fn(),
}));
vi.mock('@shared/download-file', () => ({ downloadTextFile: downloadMock }));
vi.mock('@shared/clipboard', () => ({ copyRichTextToClipboard: copyMock }));

const names = (en: string) => ({ en, ja: en, de: en, fr: en });

/** Head dyed stain 1 (unknown to the fixture → "#1"), Body undyed, Legs with no source. */
function source(picked: Partial<Record<string, number>> = {}): GlamourListSource {
  const resolved = {
    gearModels: [
      { slot: 'HeadGear', base: 361, variant: 5 },
      { slot: 'Body', base: 200, variant: 1 },
      { slot: 'Legs', base: 300, variant: 1 },
    ],
    gearDyes: [{ slot: 'HeadGear', channel: 1, stainId: 1, dye: null }],
    glassesId: null,
    nickname: 'Galatine Ashe',
  } as unknown as ResolvedCharaCharacter;
  const item = (itemId: number, en: string, acquisition?: string) => ({
    itemId,
    names: names(en),
    iconId: null,
    familySize: 1,
    alternates: [],
    viaMainHand: false,
    ...(acquisition ? { acquisition } : {}),
  });
  return {
    resolved,
    equipment: {
      items: {
        HeadGear: item(2629, 'Hempen Coif', 'Crafted (WVR Lvl. 3)'),
        Body: item(5000, 'Plain Robe', 'Vendor - Old Gridania (10 Gil)'),
        Legs: item(6000, 'Viera Gaskins'),
      },
      glasses: null,
      version: 'test',
    },
    picked: {
      HeadGear: {
        names: names('Hempen Coif'),
        acquisition: 'Crafted (WVR Lvl. 3)',
        itemId: picked.HeadGear ?? 2629,
      },
    },
  };
}

const sheet = () => document.querySelector<HTMLElement>('[data-role="glamour-sheet"]');
const rowOf = (slot: string) =>
  sheet()!.querySelector<HTMLElement>(`[data-role="sheet-row"][data-slot="${slot}"]`)!;
const field = (slot: string) => rowOf(slot).querySelector<HTMLTextAreaElement>('textarea')!;
const state = (slot: string) => rowOf(slot).querySelector('[data-role="sheet-state"]')?.textContent;
const preview = () => sheet()!.querySelector('[data-role="sheet-preview"]')!.textContent;
const type = (slot: string, value: string) => {
  field(slot).value = value;
  field(slot).dispatchEvent(new Event('input'));
};
const HEAD_HASH = gearHash('HeadGear', 2629, [1]);

beforeEach(() => {
  localStorage.clear();
  downloadMock.mockReset();
  copyMock.mockReset().mockResolvedValue(true);
  vi.spyOn(ToastService, 'success').mockImplementation(() => 'toast');
  vi.spyOn(ToastService, 'error').mockImplementation(() => 'toast');
});
afterEach(() => {
  closeGlamourSheet();
  vi.restoreAllMocks();
});

describe('glamour export sheet', () => {
  it('lists every worn piece with its generated line, and counts them', () => {
    openGlamourSheet(source());
    expect(sheet()!.textContent).toContain('Glamour list');
    expect(field('HeadGear').value).toBe('Crafted (WVR Lvl. 3)');
    expect(field('Body').value).toBe('Vendor - Old Gridania (10 Gil)');
    expect(field('Legs').value).toBe('');
    expect([state('HeadGear'), state('Body'), state('Legs')]).toEqual([
      'FILLED',
      'FILLED',
      'BLANK',
    ]);
    expect(sheet()!.querySelector('[data-role="sheet-counts"]')!.textContent).toBe(
      '2 FILLED1 BLANK'
    );
    expect(preview()).toContain('Head: Hempen Coif\nDye 1: #1\nAcquisition: Crafted (WVR Lvl. 3)');
    expect(preview()).toContain('Legs: Viera Gaskins\nAcquisition:\n');
    expect(sheet()!.textContent).not.toContain('Galatine');
  });

  it('keeps an edit on this device, keyed by the gear, and shows it everywhere', () => {
    openGlamourSheet(source());
    type('Legs', 'Moonfire Faire (2014)');

    expect(state('Legs')).toBe('EDITED');
    expect(preview()).toContain('Legs: Viera Gaskins\nAcquisition: Moonfire Faire (2014)');
    expect(AcquisitionEdits.get(gearHash('Legs', 6000, []))).toEqual({
      text: 'Moonfire Faire (2014)',
      baseItemId: 6000,
    });

    closeGlamourSheet();
    openGlamourSheet(source());
    expect(field('Legs').value).toBe('Moonfire Faire (2014)');
  });

  it('forgets an edit that is put back to the generated line', () => {
    openGlamourSheet(source());
    type('Body', 'x');
    type('Body', 'Vendor - Old Gridania (10 Gil)');
    expect(state('Body')).toBe('FILLED');
    expect(AcquisitionEdits.get(gearHash('Body', 5000, []))).toBeNull();
  });

  it('Reset all clears this outfit’s edits', () => {
    AcquisitionEdits.set('someone-else', { text: 'keep', baseItemId: 1 });
    openGlamourSheet(source());
    type('Body', 'My note');
    sheet()!.querySelector<HTMLButtonElement>('[data-role="sheet-reset"]')!.click();

    expect(field('Body').value).toBe('Vendor - Old Gridania (10 Gil)');
    expect(AcquisitionEdits.get(gearHash('Body', 5000, []))).toBeNull();
    expect(AcquisitionEdits.get('someone-else')).not.toBeNull();
  });

  it('warns instead of overwriting when a twin pick changed an edited piece', () => {
    AcquisitionEdits.set(HEAD_HASH, { text: 'Palace of the Dead, my note', baseItemId: 2630 });
    openGlamourSheet(source());

    expect(state('HeadGear')).toBe('EDITED');
    expect(field('HeadGear').value).toBe('Palace of the Dead, my note');
    const warn = rowOf('HeadGear').querySelector('[data-role="sheet-warn"]')!;
    expect(warn.textContent).toContain(
      'You picked Hempen Coif, which has its own source. Your edited line is still here.'
    );

    warn.querySelector<HTMLButtonElement>('[data-role="sheet-use-new"]')!.click();
    expect(field('HeadGear').value).toBe('Crafted (WVR Lvl. 3)');
    expect(AcquisitionEdits.get(HEAD_HASH)).toBeNull();
  });

  it('Keep mine adopts the edit for the new pick and drops the warning', () => {
    AcquisitionEdits.set(HEAD_HASH, { text: 'my note', baseItemId: 2630 });
    openGlamourSheet(source());
    rowOf('HeadGear').querySelector<HTMLButtonElement>('[data-role="sheet-keep"]')!.click();

    expect(AcquisitionEdits.get(HEAD_HASH)).toEqual({ text: 'my note', baseItemId: 2629 });
    expect(rowOf('HeadGear').querySelector('[data-role="sheet-warn"]')).toBeNull();
  });

  it('Copy list copies the edited list; Save .md downloads it', () => {
    openGlamourSheet(source());
    type('Legs', 'Moonfire Faire (2014)');

    sheet()!.querySelector<HTMLButtonElement>('[data-role="sheet-copy"]')!.click();
    expect(copyMock).toHaveBeenCalledTimes(1);
    const [payload] = copyMock.mock.calls[0] as [{ text: string; html: string }];
    expect(payload.text).toContain('Acquisition: Moonfire Faire (2014)');
    expect(payload.html).toContain('Acquisition: Moonfire Faire (2014)');

    sheet()!.querySelector<HTMLButtonElement>('[data-role="sheet-save"]')!.click();
    const [markdown, file] = downloadMock.mock.calls[0] as [string, string];
    expect(markdown).toContain('**Legs:** Viera Gaskins');
    expect(markdown).toContain('Acquisition: Moonfire Faire (2014)');
    expect(file).toBe('glamour-equipment.md');
  });

  it('says what it keeps, and closes on Escape', () => {
    openGlamourSheet(source());
    expect(sheet()!.textContent).toContain(
      "Edits are kept on this device for this outfit. The character's name is never in the list, and the file itself is never saved."
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(sheet()).toBeNull();
  });
});
