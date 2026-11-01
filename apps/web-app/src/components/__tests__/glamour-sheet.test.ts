/**
 * The export sheet (design 2c): Copy list and Save .md open a preview of
 * the GPOSERS list with one editable Acquisition field per piece. Edits are
 * kept on this device, keyed by the gear; a twin pick never overwrites one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ResolvedCharaCharacter } from '@xivdyetools/core';
import { LanguageService, ModalService, RouterService, ToastService } from '@services/index';
import { KeyboardService } from '@services/keyboard-service';
import { AcquisitionEdits, gearHash } from '@shared/acquisition-edits';
import {
  glamourMarkdownInput,
  glamourSheetPieces,
  type GlamourListSource,
} from '../glamour-list-actions';
import {
  buildGlamourHtml,
  buildGlamourMarkdown,
  buildGlamourPlainText,
} from '@shared/glamour-markdown';
import { closeGlamourSheet, openGlamourSheet } from '../glamour-sheet';
import { logger } from '@shared/logger';

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
  it('prefills and exports the unlock source for a colored facewear variant, keeping manual edits', () => {
    const base = source();
    const facewear: GlamourListSource = {
      ...base,
      resolved: { ...base.resolved, glassesId: 2 },
      equipment: {
        ...base.equipment!,
        glasses: {
          id: 2,
          names: names('Silver Oval Spectacles'),
          iconId: 200053,
          acquisition: 'Gold Saucer Attendant - The Gold Saucer (100,000 MGP)',
        },
      },
    };
    openGlamourSheet(facewear);
    expect(field('Facewear').value).toBe('Gold Saucer Attendant - The Gold Saucer (100,000 MGP)');
    expect(preview()).toContain(
      'Facewear: Silver Oval Spectacles\nAcquisition: Gold Saucer Attendant - The Gold Saucer (100,000 MGP)'
    );
    sheet()!.querySelector<HTMLButtonElement>('[data-role="sheet-save"]')!.click();
    expect(downloadMock.mock.calls[0][0]).toContain(
      '**Facewear:** Silver Oval Spectacles\nAcquisition: Gold Saucer Attendant - The Gold Saucer (100,000 MGP)'
    );
    type('Facewear', 'My source note');
    closeGlamourSheet();
    openGlamourSheet(facewear);
    expect(field('Facewear').value).toBe('My source note');
  });

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

  // I18N-007: the count rode in one plural string ("1 pieces").
  it('counts the pieces in the locale plural form', () => {
    openGlamourSheet(source());
    expect(sheet()!.textContent).toContain('GPOSERS format · 3 pieces · edit anything');
    closeGlamourSheet();

    const one = source();
    one.resolved = {
      ...one.resolved,
      gearModels: one.resolved.gearModels.slice(0, 1),
    } as ResolvedCharaCharacter;
    openGlamourSheet(one);
    expect(sheet()!.textContent).toContain('GPOSERS format · 1 piece · edit anything');
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

  it('lists a retired piece by its name and files its edit under the family row', () => {
    // 2026-10-09 merge-day review: an all-retired family is named, not null,
    // so the sheet writes it like any piece — never as a bare model.
    const base = source();
    const retired: GlamourListSource = {
      ...base,
      equipment: {
        ...base.equipment!,
        items: {
          ...base.equipment!.items,
          Legs: {
            itemId: 4000,
            names: names('Dated Hempen Breeches'),
            iconId: null,
            familySize: 1,
            alternates: [],
            viaMainHand: false,
            retired: true,
          },
        },
      },
    };
    openGlamourSheet(retired);
    expect(preview()).toContain('Legs: Dated Hempen Breeches\nAcquisition:\n');
    type('Legs', 'Retired before 2.0');
    expect(AcquisitionEdits.get(gearHash('Legs', 4000, []))).toEqual({
      text: 'Retired before 2.0',
      baseItemId: 4000,
    });
  });

  it('keeps an edit on a piece with no item behind it (the resolve failed)', () => {
    openGlamourSheet({ ...source(), equipment: null, picked: {} });
    type('Legs', 'Found it: Moogle Treasure Trove');

    expect(preview()).toContain('Acquisition: Found it: Moogle Treasure Trove');
    closeGlamourSheet();
    openGlamourSheet({ ...source(), equipment: null, picked: {} });
    expect(field('Legs').value).toBe('Found it: Moogle Treasure Trove');
  });

  it('writes an Acquisition line as one line, whatever the field holds', () => {
    openGlamourSheet(source());
    type('Body', 'Vendor\nOld Gridania');

    expect(preview()).toContain('Acquisition: Vendor Old Gridania');
    expect(preview()).not.toContain('Vendor\nOld');
  });

  it('shows two identical rings as one Rings row, the one the list writes', () => {
    const base = source();
    const ring = {
      itemId: 4000,
      names: names('Silver Ring'),
      iconId: null,
      familySize: 1,
      alternates: [],
      viaMainHand: false,
    };
    const ringed: GlamourListSource = {
      ...base,
      resolved: {
        ...base.resolved,
        gearModels: [
          ...base.resolved.gearModels,
          { slot: 'RightRing', base: 50, variant: 1 },
          { slot: 'LeftRing', base: 50, variant: 1 },
        ],
      } as ResolvedCharaCharacter,
      equipment: {
        ...base.equipment!,
        items: { ...base.equipment!.items, RightRing: ring, LeftRing: ring },
      },
    };
    openGlamourSheet(ringed);

    expect(sheet()!.querySelector('[data-role="sheet-row"][data-slot="LeftRing"]')).toBeNull();
    expect(rowOf('RightRing').textContent).toContain('Rings');
    type('RightRing', 'Vendor');
    expect(preview()).toContain('Rings: Silver Ring\nAcquisition: Vendor');
  });

  it('files an edit under the family row, not the pick, so a twin pick keeps the key', () => {
    // The list names the Dated coif (#372), but the family's row is #2629
    openGlamourSheet(source({ HeadGear: 372 }));
    type('HeadGear', 'My note');

    expect(AcquisitionEdits.get(HEAD_HASH)).toEqual({ text: 'My note', baseItemId: 372 });
    expect(AcquisitionEdits.get(gearHash('HeadGear', 372, [1]))).toBeNull();
  });

  describe('when the named row is not the family’s lowest', () => {
    // api-worker names the lowest row WITH a line (#29334); the blank #29254 is an alternate
    const named = (): GlamourListSource => {
      const base = source();
      return {
        ...base,
        picked: {},
        equipment: {
          ...base.equipment!,
          items: {
            ...base.equipment!.items,
            Legs: {
              itemId: 29334,
              names: names('Augmented Crystarium Slacks'),
              iconId: null,
              familySize: 2,
              alternates: [{ itemId: 29254, names: names('Crystarium Slacks') }],
              viaMainHand: false,
              acquisition: 'Aymark - Eulmore (280 Allagan Tomestones of Poetics)',
            },
          },
        },
      };
    };

    it('files an edit under the lowest row, so a later patch does not orphan it', () => {
      openGlamourSheet(named());
      type('Legs', 'My note');

      expect(AcquisitionEdits.get(gearHash('Legs', 29254, []))).toEqual({
        text: 'My note',
        baseItemId: 29334,
      });
      expect(AcquisitionEdits.get(gearHash('Legs', 29334, []))).toBeNull();
    });

    it('shows an edit already stored under the lowest row', () => {
      AcquisitionEdits.set(gearHash('Legs', 29254, []), {
        text: 'Saved earlier',
        baseItemId: 29254,
      });
      openGlamourSheet(named());

      expect(field('Legs').value).toBe('Saved earlier');
      // The edit replaced the old default's blank line; the named twin now has
      // a source, so the sheet offers it once instead of overwriting the edit
      const warn = rowOf('Legs').querySelector('[data-role="sheet-warn"]');
      expect(warn).not.toBeNull();
      expect(warn!.querySelector('[data-role="sheet-use-new"]')).not.toBeNull();
    });
  });

  it('keeps a family with no alternates keyed on its own row', () => {
    openGlamourSheet(source());
    type('Body', 'Mine');

    expect(AcquisitionEdits.get(gearHash('Body', 5000, []))).toEqual({
      text: 'Mine',
      baseItemId: 5000,
    });
  });

  it('keeps Tab inside the sheet, and gives focus back to what opened it', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    openGlamourSheet(source());
    const panel = sheet()!.querySelector<HTMLElement>('[role="dialog"]')!;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>('button, textarea'));
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;

    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);
    first.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
    );
    expect(document.activeElement).toBe(last);

    closeGlamourSheet();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('gives focus back to an opener inside nested shadow roots, where every tool renders', () => {
    // document.activeElement stops at the outermost host (v4-layout-shell in
    // the app), and focusing a host does nothing — the real opener is inside.
    const shell = document.createElement('div');
    document.body.appendChild(shell);
    const inner = document.createElement('div');
    shell.attachShadow({ mode: 'open' }).appendChild(inner);
    const opener = document.createElement('button');
    inner.attachShadow({ mode: 'open' }).appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(shell);

    openGlamourSheet(source());
    expect(inner.shadowRoot!.activeElement).not.toBe(opener);
    closeGlamourSheet();

    expect(inner.shadowRoot!.activeElement).toBe(opener);
    shell.remove();
  });

  it('gives focus back to the opener it was handed, even one a click never focused', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    openGlamourSheet(source(), 'copy', opener);
    closeGlamourSheet();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('is a modal while it is up: global shortcuts stand down until it closes', () => {
    const navigate = vi.spyOn(RouterService, 'navigateTo').mockImplementation(() => {});
    const cycle = vi.spyOn(LanguageService, 'cycleToNextLocale').mockResolvedValue();
    const press = (key: string, shiftKey = false) =>
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));
    KeyboardService.initialize();
    try {
      openGlamourSheet(source());
      expect(ModalService.hasOpenModals()).toBe(true);
      press('3');
      press('L', true);
      expect(navigate).not.toHaveBeenCalled();
      expect(cycle).not.toHaveBeenCalled();

      closeGlamourSheet();
      expect(ModalService.hasOpenModals()).toBe(false);
      press('3');
      expect(navigate).toHaveBeenCalledWith('accessibility');
    } finally {
      KeyboardService.destroy();
    }
  });

  it('says what it keeps, and closes on Escape', () => {
    openGlamourSheet(source());
    expect(sheet()!.textContent).toContain(
      "Edits are kept on this device for each piece of gear. The character's name is never in the list, and the file itself is never saved."
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(sheet()).toBeNull();
  });
});

// The list leaves out what a submission form has no use for: pieces the
// character cannot be seen wearing, and an Off Hand under a main hand that
// does not take one. The reader's rows are untouched; only the list changes.
describe('glamour list omissions', () => {
  type Slot = 'MainHand' | 'OffHand' | 'Body' | 'Hands' | 'Wrists';
  const slotModel = (slot: Slot) => ({ slot, base: 100, variant: 1 });
  const entry = (itemId: number, en: string, alternates: string[] = [], uiCategory?: number) => ({
    itemId,
    names: names(en),
    iconId: null,
    familySize: 1 + alternates.length,
    alternates: alternates.map((alt, i) => ({ itemId: itemId + i + 1, names: names(alt) })),
    viaMainHand: false,
    ...(uiCategory === undefined ? {} : { uiCategory }),
  });
  const wearing = (
    items: Partial<Record<Slot, ReturnType<typeof entry> | null>>,
    gender: 'Male' | 'Female' | null = 'Male',
    equipment = true
  ): GlamourListSource =>
    ({
      resolved: {
        gearModels: (Object.keys(items) as Slot[]).map(slotModel),
        gearDyes: [],
        glassesId: null,
        gender,
      } as unknown as ResolvedCharaCharacter,
      equipment: equipment ? { items, glasses: null } : null,
    }) as GlamourListSource;
  const everyRendering = (source: GlamourListSource) => {
    const input = glamourMarkdownInput(source);
    return [buildGlamourMarkdown(input), buildGlamourPlainText(input), buildGlamourHtml(input)];
  };

  it('leaves an invisible bracelet family out of every rendering and out of the sheet rows', () => {
    const source = wearing({
      Body: entry(5000, 'Plain Robe'),
      Wrists: entry(8693, 'Promise of Innocence', ["The Emperor's New Bracelet"]),
    });
    for (const text of everyRendering(source)) {
      expect(text).not.toContain('Bracelets:');
      expect(text).toContain('Plain Robe');
    }
    expect(glamourSheetPieces(source).map((p) => p.slot)).toEqual(['Body']);
  });

  it("keeps The Emperor's New Gloves", () => {
    const source = wearing({ Hands: entry(6000, "The Emperor's New Gloves") });
    for (const text of everyRendering(source)) expect(text).toContain('Hands:');
    expect(glamourSheetPieces(source).map((p) => p.slot)).toEqual(['Hands']);
  });

  it("keeps The Emperor's New Robe for a male or unknown character, drops it for a female one", () => {
    const robe = { Body: entry(7000, "The Emperor's New Robe") };
    for (const gender of ['Male', null] as const)
      for (const text of everyRendering(wearing(robe, gender))) expect(text).toContain('Body:');
    for (const text of everyRendering(wearing(robe, 'Female'))) expect(text).not.toContain('Body:');
  });

  it('drops an Off Hand under a main hand that takes none, keeps it under one that does', () => {
    const hands = (mainCategory?: number) =>
      wearing({
        MainHand: entry(1000, 'Main Weapon', [], mainCategory),
        OffHand: entry(1100, 'Shield'),
      });
    // 1 = Pugilist's Arm: a fist pair, so the second weapon is the same one
    for (const text of everyRendering(hands(1))) expect(text).not.toContain('Off Hand:');
    for (const text of everyRendering(hands(2))) expect(text).toContain('Off Hand:');
    // No category known (an older api-worker): nothing is dropped on a guess
    for (const text of everyRendering(hands())) expect(text).toContain('Off Hand:');
    expect(glamourSheetPieces(hands(1)).map((p) => p.slot)).toEqual(['MainHand']);
  });

  it("leaves out an Off Hand that is the main hand's own model, keeps a genuine second tool", () => {
    // 12 = Carpenter's primary tool; its sub-model comes back as the Off Hand
    const tools = (viaMainHand: boolean) =>
      wearing({
        MainHand: entry(38890, "Indagator's Saw", [], 12),
        OffHand: { ...entry(38890, "Indagator's Saw"), viaMainHand },
      });
    for (const text of everyRendering(tools(true))) expect(text).not.toContain('Off Hand:');
    expect(glamourSheetPieces(tools(true)).map((p) => p.slot)).toEqual(['MainHand']);
    for (const text of everyRendering(tools(false))) expect(text).toContain('Off Hand:');
    expect(glamourSheetPieces(tools(false)).map((p) => p.slot)).toEqual(['MainHand', 'OffHand']);
  });

  it('omits nothing before the equipment answer lands', () => {
    const source = wearing({ Wrists: entry(8693, 'Promise of Innocence') }, 'Female', false);
    for (const text of everyRendering(source)) expect(text).toContain('Bracelets:');
  });
});

describe('glamour export sheet — failure logs carry no raw error', () => {
  const CANARY = 'RAW-SHEET-CANARY-3b9e';

  /** Every argument any logger method was given, as text (an Error's message and stack too). */
  function logged(spies: Array<{ mock: { calls: unknown[][] } }>): string[] {
    return spies.flatMap((spy) =>
      spy.mock.calls.flatMap((args) =>
        args.map((arg) =>
          arg instanceof Error ? `${arg.message} ${arg.stack ?? ''}` : (JSON.stringify(arg) ?? '')
        )
      )
    );
  }

  const spyLogger = () =>
    (['error', 'warn', 'info', 'debug'] as const).map((method) =>
      vi.spyOn(logger, method).mockImplementation(() => {})
    );

  it('a failed Save .md logs a fixed message and toasts, quoting nothing from the error', () => {
    // Red if the catch passes the thrown error to the logger.
    const spies = spyLogger();
    downloadMock.mockImplementation(() => {
      throw new Error(CANARY);
    });
    openGlamourSheet(source());
    sheet()!.querySelector<HTMLButtonElement>('[data-role="sheet-save"]')!.click();

    expect(ToastService.error).toHaveBeenCalledWith(LanguageService.t('swatch.listExportFailed'));
    expect(spies[0]).toHaveBeenCalledWith('[GlamourSheet] Export failed');
    expect(spies[0].mock.calls.every((args) => args.length === 1)).toBe(true);
    for (const text of logged(spies)) expect(text).not.toContain(CANARY);
  });

  it('a failed Copy list logs a fixed message and toasts, quoting nothing from the error', async () => {
    // Red if the rejection's error object reaches the logger.
    const spies = spyLogger();
    copyMock.mockRejectedValue(new Error(CANARY));
    openGlamourSheet(source());
    sheet()!.querySelector<HTMLButtonElement>('[data-role="sheet-copy"]')!.click();

    await vi.waitFor(() =>
      expect(ToastService.error).toHaveBeenCalledWith(LanguageService.t('swatch.listCopyFailed'))
    );
    expect(spies[0]).toHaveBeenCalledWith('[GlamourSheet] Copy failed');
    expect(spies[0].mock.calls.every((args) => args.length === 1)).toBe(true);
    for (const text of logged(spies)) expect(text).not.toContain(CANARY);
  });
});
