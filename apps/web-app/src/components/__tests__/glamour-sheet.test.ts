/**
 * The export sheet (design 2c): Copy list and Save .md open a preview of
 * the GPOSERS list with one editable Acquisition field per piece. Edits are
 * kept on this device, keyed by the gear; a twin pick never overwrites one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ResolvedCharaCharacter } from '@xivdyetools/core';
import {
  LanguageService,
  ModalService,
  RouterService,
  StorageService,
  ToastService,
} from '@services/index';
import { KeyboardService } from '@services/keyboard-service';
import { AcquisitionEdits, abridgedEditKey, gearHash } from '@shared/acquisition-edits';
import { STORAGE_PREFIX } from '@shared/constants';
import type { ToggleSwitchV4 } from '@components/v4/toggle-switch-v4';
import {
  glamourInputWithAcquisition,
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
const BODY_HASH = gearHash('Body', 5000, []);
const formatToggle = () => sheet()!.querySelector<ToggleSwitchV4>('[data-role="sheet-format"]')!;
const formatSwitch = () =>
  formatToggle().shadowRoot!.querySelector<HTMLElement>('[role="switch"]')!;
/** Flip Abridged the way a player does: a click on the switch inside the toggle. */
const flip = async (): Promise<void> => {
  await formatToggle().updateComplete;
  formatSwitch().click();
  await formatToggle().updateComplete;
};
const fieldLabel = (slot: string) => rowOf(slot).querySelector('label span')?.textContent;
/** Body with two sources, so Abridged has something to shorten. */
const CRAFT_OR_VENDOR = 'Crafted (WVR Lvl. 9) / Vendor - Old Gridania (10 Gil)';
function twoSources(): GlamourListSource {
  const base = source();
  return {
    ...base,
    equipment: {
      ...base.equipment!,
      items: {
        ...base.equipment!.items,
        Body: { ...base.equipment!.items.Body!, acquisition: CRAFT_OR_VENDOR },
      },
    },
  };
}
/** The base outfit with two rings: the same Silver Ring twice, or a Silver and a Gold. */
function ringsWorn(same: boolean): GlamourListSource {
  const base = source();
  const ring = (itemId: number, en: string) => ({
    itemId,
    names: names(en),
    iconId: null,
    familySize: 1,
    alternates: [],
    viaMainHand: false,
    acquisition: `${en} vendor`,
  });
  return {
    ...base,
    resolved: {
      ...base.resolved,
      gearModels: [
        ...base.resolved.gearModels,
        { slot: 'RightRing', base: 50, variant: 1 },
        { slot: 'LeftRing', base: same ? 50 : 60, variant: 1 },
      ],
    } as ResolvedCharaCharacter,
    equipment: {
      ...base.equipment!,
      items: {
        ...base.equipment!.items,
        RightRing: ring(4000, 'Silver Ring'),
        LeftRing: same ? ring(4000, 'Silver Ring') : ring(4100, 'Gold Ring'),
      },
    },
  };
}
/**
 * Two rings on one model family, each named by its own twin: the same gear keys
 * either way, and the picks alone decide whether they merge into a Rings row.
 */
function ringTwins(right: 'A' | 'B', left: 'A' | 'B'): GlamourListSource {
  const base = source();
  const item = {
    itemId: 4000,
    names: names('Silver Ring A'),
    iconId: null,
    familySize: 2,
    alternates: [{ itemId: 4001, names: names('Silver Ring B'), iconId: null }],
    viaMainHand: false,
    acquisition: 'A vendor',
  };
  const twin = (which: 'A' | 'B') => ({
    itemId: which === 'A' ? 4000 : 4001,
    names: names(`Silver Ring ${which}`),
    acquisition: `${which} vendor`,
  });
  return {
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
      items: { ...base.equipment!.items, RightRing: item, LeftRing: item },
    },
    picked: { ...base.picked, RightRing: twin(right), LeftRing: twin(left) },
  };
}

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

  it('keeps Tab inside the sheet, and gives focus back to what opened it', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    openGlamourSheet(source());
    await formatToggle().updateComplete;
    const panel = sheet()!.querySelector<HTMLElement>('[role="dialog"]')!;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>('button, textarea, v4-toggle-switch')
    );
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

describe('glamour export sheet — nothing to write in Abridged', () => {
  const FORMAT_KEY = `${STORAGE_PREFIX}_glamour_list_format`;
  /** Worn gear that is all left out of the list: only an invisible bracelet. */
  const nothingListed = (): GlamourListSource =>
    ({
      resolved: {
        gearModels: [{ slot: 'Wrists', base: 100, variant: 1 }],
        gearDyes: [],
        glassesId: null,
        gender: 'Male',
      } as unknown as ResolvedCharaCharacter,
      equipment: {
        items: {
          Wrists: {
            itemId: 8693,
            names: names('Promise of Innocence'),
            iconId: null,
            familySize: 2,
            alternates: [{ itemId: 8694, names: names("The Emperor's New Bracelet") }],
            viaMainHand: false,
          },
        },
        glasses: null,
      },
    }) as GlamourListSource;
  const copyButton = () => sheet()!.querySelector<HTMLButtonElement>('[data-role="sheet-copy"]')!;
  const saveButton = () => sheet()!.querySelector<HTMLButtonElement>('[data-role="sheet-save"]')!;

  it('writes nothing: Copy list and Save .md are off, so no blank clipboard, file or toast', () => {
    StorageService.setItem(FORMAT_KEY, 'abridged');
    openGlamourSheet(nothingListed());

    expect(preview()).toBe('');
    expect(copyButton().disabled).toBe(true);
    expect(saveButton().disabled).toBe(true);
    copyButton().click();
    saveButton().click();
    expect(copyMock).not.toHaveBeenCalled();
    expect(downloadMock).not.toHaveBeenCalled();
    expect(ToastService.success).not.toHaveBeenCalled();
  });

  it('opens with focus inside the dialog even though the action it named is off', () => {
    StorageService.setItem(FORMAT_KEY, 'abridged');
    openGlamourSheet(nothingListed(), 'save');

    expect(sheet()!.contains(document.activeElement)).toBe(true);
  });

  it('follows the toggle: the full form still has its header to write', async () => {
    openGlamourSheet(nothingListed());
    expect(copyButton().disabled).toBe(false);
    expect(saveButton().disabled).toBe(false);

    await flip();
    expect(copyButton().disabled).toBe(true);
    expect(saveButton().disabled).toBe(true);

    await flip();
    expect(copyButton().disabled).toBe(false);
    expect(saveButton().disabled).toBe(false);
  });

  it('leaves Copy list and Save .md on when Abridged has rows', () => {
    StorageService.setItem(FORMAT_KEY, 'abridged');
    openGlamourSheet(source());

    expect(copyButton().disabled).toBe(false);
    expect(saveButton().disabled).toBe(false);
  });
});

describe('glamour export sheet — the Abridged toggle', () => {
  const FORMAT_KEY = `${STORAGE_PREFIX}_glamour_list_format`;
  const BODY_ABRIDGED = abridgedEditKey(BODY_HASH);
  // Assigned, not spied: the setup file's matchMedia is itself a mock, and a spy
  // on it would leave phone mode behind for every later test
  const desktopMatchMedia = window.matchMedia;
  const phone = () => {
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
  };
  afterEach(() => {
    window.matchMedia = desktopMatchMedia;
  });

  it('is off by default, labelled, and the sheet writes the full form', async () => {
    openGlamourSheet(twoSources());
    await formatToggle().updateComplete;

    expect(formatToggle().checked).toBe(false);
    expect(formatSwitch().getAttribute('aria-checked')).toBe('false');
    expect(formatSwitch().getAttribute('aria-label')).toBe('Abridged');
    expect(preview()).toContain('Glamour Items:');
    expect(preview()).toContain(`Acquisition: ${CRAFT_OR_VENDOR}`);
    expect(field('Body').value).toBe(CRAFT_OR_VENDOR);
    expect(fieldLabel('Body')).toBe('Acquisition:');
  });

  it('flipping it changes the preview, every field and its label, and back again', async () => {
    openGlamourSheet(twoSources());
    await flip();

    expect(formatToggle().checked).toBe(true);
    expect(preview()).toBe(
      [
        'Head: Hempen Coif',
        'Dyes: #1',
        'Obtained: Crafted (WVR Lvl. 3)',
        '',
        'Body: Plain Robe',
        'Obtained: Crafted (WVR Lvl. 9)',
        '',
        'Legs: Viera Gaskins',
        'Obtained:',
        '',
      ].join('\n')
    );
    expect(field('Body').value).toBe('Crafted (WVR Lvl. 9)');
    expect(fieldLabel('Body')).toBe('Obtained:');
    expect(state('Body')).toBe('FILLED');
    expect(state('Legs')).toBe('BLANK');
    expect(sheet()!.querySelector('[data-role="sheet-counts"]')!.textContent).toBe(
      '2 FILLED1 BLANK'
    );

    await flip();
    expect(preview()).toContain(`Acquisition: ${CRAFT_OR_VENDOR}`);
    expect(field('Body').value).toBe(CRAFT_OR_VENDOR);
    expect(fieldLabel('Body')).toBe('Acquisition:');
  });

  it('is remembered on this device across a reopen, and off again once flipped off', async () => {
    openGlamourSheet(twoSources());
    await flip();
    expect(StorageService.getItem(FORMAT_KEY)).toBe('abridged');

    closeGlamourSheet();
    openGlamourSheet(twoSources());
    await formatToggle().updateComplete;
    expect(formatToggle().checked).toBe(true);
    expect(preview()).toContain('Obtained: Crafted (WVR Lvl. 9)');
    expect(field('Body').value).toBe('Crafted (WVR Lvl. 9)');

    await flip();
    closeGlamourSheet();
    openGlamourSheet(twoSources());
    await formatToggle().updateComplete;
    expect(formatToggle().checked).toBe(false);
  });

  it('treats a stored value it does not know as off', async () => {
    StorageService.setItem(FORMAT_KEY, 'something-else');
    openGlamourSheet(twoSources());
    await formatToggle().updateComplete;
    expect(formatToggle().checked).toBe(false);
    // The toggle reads the same comparison on its own: the fields and preview
    // are what fall to the Abridged path if the unknown value gets through.
    expect(field('Body').value).toBe(CRAFT_OR_VENDOR);
    expect(fieldLabel('Body')).toBe('Acquisition:');
    expect(preview()).toContain('Glamour Items:');
  });

  describe('when the choice cannot be saved', () => {
    const refuseFormatWrites = () => {
      const real = StorageService.setItem.bind(StorageService);
      return vi
        .spyOn(StorageService, 'setItem')
        .mockImplementation((key: string, value: unknown) =>
          key === FORMAT_KEY ? false : real(key, value)
        );
    };
    // The choice lives in the module for the page: a write that works ends it
    afterEach(async () => {
      vi.restoreAllMocks();
      closeGlamourSheet();
      openGlamourSheet(source());
      await flip();
      await flip();
      closeGlamourSheet();
      localStorage.clear();
    });

    it('keeps Abridged for the page, as the edits made in it are kept', async () => {
      refuseFormatWrites();
      openGlamourSheet(twoSources());
      await flip();
      type('Body', 'Typed short');
      closeGlamourSheet();

      openGlamourSheet(twoSources());
      await formatToggle().updateComplete;
      expect(formatToggle().checked).toBe(true);
      expect(field('Body').value).toBe('Typed short');
      expect(preview()).toContain('Obtained: Typed short');
    });

    it('keeps Full for the page over an older stored Abridged', async () => {
      StorageService.setItem(FORMAT_KEY, 'abridged');
      refuseFormatWrites();
      openGlamourSheet(twoSources());
      await flip();
      closeGlamourSheet();

      openGlamourSheet(twoSources());
      await formatToggle().updateComplete;
      expect(formatToggle().checked).toBe(false);
      expect(field('Body').value).toBe(CRAFT_OR_VENDOR);
    });

    it('goes back to the stored choice once a write works', async () => {
      const refused = refuseFormatWrites();
      openGlamourSheet(twoSources());
      await flip();
      refused.mockRestore();
      await flip();
      closeGlamourSheet();
      StorageService.setItem(FORMAT_KEY, 'abridged');

      openGlamourSheet(twoSources());
      await formatToggle().updateComplete;
      expect(formatToggle().checked).toBe(true);
    });
  });

  it('Copy list and Save .md follow it, flavours and filename both', async () => {
    openGlamourSheet(twoSources());
    await flip();

    sheet()!.querySelector<HTMLButtonElement>('[data-role="sheet-copy"]')!.click();
    const [payload] = copyMock.mock.calls[0] as [{ text: string; html: string }];
    expect(payload.text).toContain('Body: Plain Robe\nObtained: Crafted (WVR Lvl. 9)\n');
    expect(payload.text).not.toContain('Glamour Items:');
    expect(payload.html).toContain(
      '<p><strong>Body: Plain Robe</strong><br>Obtained: Crafted (WVR Lvl. 9)</p>'
    );

    sheet()!.querySelector<HTMLButtonElement>('[data-role="sheet-save"]')!.click();
    const [markdown, file] = downloadMock.mock.calls[0] as [string, string];
    expect(markdown).toContain('**Body: Plain Robe**\nObtained: Crafted (WVR Lvl. 9)\n');
    expect(file).toBe('glamour-equipment-abridged.md');

    await flip();
    sheet()!.querySelector<HTMLButtonElement>('[data-role="sheet-save"]')!.click();
    const [fullMarkdown, fullFile] = downloadMock.mock.calls[1] as [string, string];
    expect(fullMarkdown).toContain('**Glamour Items:**');
    expect(fullFile).toBe('glamour-equipment.md');
  });

  describe('the two levels of edits', () => {
    it('abridges a full edit into the baseline, and the full edit drives the chip', async () => {
      AcquisitionEdits.set(BODY_HASH, {
        text: 'Crafted (ALC Lvl. 1) / Vendor - Town (5 Gil)',
        baseItemId: 5000,
      });
      openGlamourSheet(twoSources());
      await flip();

      expect(field('Body').value).toBe('Crafted (ALC Lvl. 1)');
      expect(state('Body')).toBe('EDITED');
      expect(AcquisitionEdits.get(BODY_ABRIDGED)).toBeNull();
    });

    it('stores what is typed under the Abridged key, word for word, and leaves full alone', async () => {
      openGlamourSheet(twoSources());
      await flip();
      type('Body', 'Vendor A / Vendor B (10 Gil)');

      expect(AcquisitionEdits.get(BODY_ABRIDGED)).toEqual({
        text: 'Vendor A / Vendor B (10 Gil)',
        baseItemId: 5000,
      });
      expect(AcquisitionEdits.get(BODY_HASH)).toBeNull();
      expect(state('Body')).toBe('EDITED');
      expect(preview()).toContain('Obtained: Vendor A / Vendor B (10 Gil)');

      await flip();
      expect(field('Body').value).toBe(CRAFT_OR_VENDOR);
      expect(state('Body')).toBe('FILLED');
      expect(preview()).not.toContain('Vendor A');

      await flip();
      expect(field('Body').value).toBe('Vendor A / Vendor B (10 Gil)');
    });

    it('removes the Abridged edit when the text goes back to the baseline', async () => {
      openGlamourSheet(twoSources());
      await flip();
      type('Body', 'x');
      type('Body', 'Crafted (WVR Lvl. 9)');

      expect(AcquisitionEdits.get(BODY_ABRIDGED)).toBeNull();
      expect(state('Body')).toBe('FILLED');
    });

    it('takes the baseline from the full edit when one exists, not the generated line', async () => {
      AcquisitionEdits.set(BODY_HASH, { text: 'Crafted (ALC Lvl. 1)', baseItemId: 5000 });
      openGlamourSheet(twoSources());
      await flip();
      type('Body', 'x');
      type('Body', 'Crafted (WVR Lvl. 9)');
      // The generated line's short form is not the baseline here: this is an edit
      expect(AcquisitionEdits.get(BODY_ABRIDGED)?.text).toBe('Crafted (WVR Lvl. 9)');

      type('Body', 'Crafted (ALC Lvl. 1)');
      expect(AcquisitionEdits.get(BODY_ABRIDGED)).toBeNull();
      expect(AcquisitionEdits.get(BODY_HASH)?.text).toBe('Crafted (ALC Lvl. 1)');
      expect(state('Body')).toBe('EDITED');
    });

    it('a blank typed in Abridged is an edit: kept, shown blank, chip EDITED', async () => {
      openGlamourSheet(twoSources());
      await flip();
      type('Body', '');

      expect(AcquisitionEdits.get(BODY_ABRIDGED)).toEqual({ text: '', baseItemId: 5000 });
      expect(state('Body')).toBe('EDITED');
      expect(preview()).toContain('Body: Plain Robe\nObtained:\n');

      closeGlamourSheet();
      openGlamourSheet(twoSources());
      await formatToggle().updateComplete;
      expect(field('Body').value).toBe('');
      expect(state('Body')).toBe('EDITED');
    });

    it('a blank full edit is an edit in both forms, never the generated line', async () => {
      AcquisitionEdits.set(BODY_HASH, { text: '', baseItemId: 5000 });
      openGlamourSheet(twoSources());
      expect(field('Body').value).toBe('');
      expect(state('Body')).toBe('EDITED');

      await flip();
      expect(field('Body').value).toBe('');
      expect(state('Body')).toBe('EDITED');
      expect(preview()).toContain('Body: Plain Robe\nObtained:\n');
    });

    it('a blank Abridged edit wins over a full edit', async () => {
      AcquisitionEdits.set(BODY_HASH, { text: 'My full note', baseItemId: 5000 });
      AcquisitionEdits.set(BODY_ABRIDGED, { text: '', baseItemId: 5000 });
      StorageService.setItem(FORMAT_KEY, 'abridged');
      openGlamourSheet(twoSources());

      expect(field('Body').value).toBe('');
    });

    it('full mode ignores an Abridged edit: chip, line and warning', () => {
      AcquisitionEdits.set(BODY_ABRIDGED, { text: 'Short', baseItemId: 1 });
      openGlamourSheet(twoSources());

      expect(field('Body').value).toBe(CRAFT_OR_VENDOR);
      expect(state('Body')).toBe('FILLED');
      expect(rowOf('Body').querySelector('[data-role="sheet-warn"]')).toBeNull();
    });

    it('warns for a stale Abridged edit; Keep mine re-bases that key only', async () => {
      AcquisitionEdits.set(BODY_HASH, { text: 'Full', baseItemId: 1 });
      AcquisitionEdits.set(BODY_ABRIDGED, { text: 'Short', baseItemId: 2 });
      StorageService.setItem(FORMAT_KEY, 'abridged');
      openGlamourSheet(twoSources());

      expect(field('Body').value).toBe('Short');
      rowOf('Body').querySelector<HTMLButtonElement>('[data-role="sheet-keep"]')!.click();

      expect(AcquisitionEdits.get(BODY_ABRIDGED)).toEqual({ text: 'Short', baseItemId: 5000 });
      expect(AcquisitionEdits.get(BODY_HASH)).toEqual({ text: 'Full', baseItemId: 1 });
      expect(rowOf('Body').querySelector('[data-role="sheet-warn"]')).toBeNull();
    });

    it('Use new source removes the stale Abridged edit only', async () => {
      AcquisitionEdits.set(BODY_HASH, { text: 'Crafted (ALC Lvl. 1)', baseItemId: 5000 });
      AcquisitionEdits.set(BODY_ABRIDGED, { text: 'Short', baseItemId: 2 });
      StorageService.setItem(FORMAT_KEY, 'abridged');
      openGlamourSheet(twoSources());
      rowOf('Body').querySelector<HTMLButtonElement>('[data-role="sheet-use-new"]')!.click();

      expect(AcquisitionEdits.get(BODY_ABRIDGED)).toBeNull();
      expect(AcquisitionEdits.get(BODY_HASH)?.text).toBe('Crafted (ALC Lvl. 1)');
      expect(field('Body').value).toBe('Crafted (ALC Lvl. 1)');
    });

    it('Use new source keeps a fresh full edit after the stale Abridged edit was typed away', async () => {
      AcquisitionEdits.set(BODY_HASH, { text: 'Mine', baseItemId: 5000 });
      AcquisitionEdits.set(BODY_ABRIDGED, { text: 'Short', baseItemId: 2 });
      StorageService.setItem(FORMAT_KEY, 'abridged');
      openGlamourSheet(twoSources());
      // The baseline: this removes the Abridged edit, and the warning stays up
      type('Body', 'Mine');
      expect(AcquisitionEdits.get(BODY_ABRIDGED)).toBeNull();
      rowOf('Body').querySelector<HTMLButtonElement>('[data-role="sheet-use-new"]')!.click();

      expect(AcquisitionEdits.get(BODY_HASH)).toEqual({ text: 'Mine', baseItemId: 5000 });
      expect(field('Body').value).toBe('Mine');
    });

    it('a stale full edit warns in Abridged too, and the actions land on the full key', async () => {
      AcquisitionEdits.set(BODY_HASH, { text: 'Full', baseItemId: 1 });
      StorageService.setItem(FORMAT_KEY, 'abridged');
      openGlamourSheet(twoSources());

      rowOf('Body').querySelector<HTMLButtonElement>('[data-role="sheet-keep"]')!.click();
      expect(AcquisitionEdits.get(BODY_HASH)).toEqual({ text: 'Full', baseItemId: 5000 });
      expect(AcquisitionEdits.get(BODY_ABRIDGED)).toBeNull();

      AcquisitionEdits.set(BODY_HASH, { text: 'Full', baseItemId: 1 });
      closeGlamourSheet();
      openGlamourSheet(twoSources());
      rowOf('Body').querySelector<HTMLButtonElement>('[data-role="sheet-use-new"]')!.click();
      expect(AcquisitionEdits.get(BODY_HASH)).toBeNull();
      expect(field('Body').value).toBe('Crafted (WVR Lvl. 9)');
    });

    it('Use new source reaches the new source in one click when both edits are stale', async () => {
      AcquisitionEdits.set(BODY_HASH, { text: 'Full stale', baseItemId: 1 });
      AcquisitionEdits.set(BODY_ABRIDGED, { text: 'Short', baseItemId: 1 });
      StorageService.setItem(FORMAT_KEY, 'abridged');
      openGlamourSheet(twoSources());
      rowOf('Body').querySelector<HTMLButtonElement>('[data-role="sheet-use-new"]')!.click();

      expect(field('Body').value).toBe('Crafted (WVR Lvl. 9)');
      expect(rowOf('Body').querySelector('[data-role="sheet-warn"]')).toBeNull();
      expect(state('Body')).toBe('FILLED');
    });

    it('Use new source clears what was typed over a stale full edit, and the full edit too', async () => {
      AcquisitionEdits.set(BODY_HASH, { text: 'Full stale', baseItemId: 1 });
      StorageService.setItem(FORMAT_KEY, 'abridged');
      openGlamourSheet(twoSources());
      type('Body', 'typed');
      rowOf('Body').querySelector<HTMLButtonElement>('[data-role="sheet-use-new"]')!.click();

      expect(field('Body').value).toBe('Crafted (WVR Lvl. 9)');
      expect(rowOf('Body').querySelector('[data-role="sheet-warn"]')).toBeNull();
    });

    it.each(['sheet-keep', 'sheet-use-new'])(
      '%s keeps focus on the row it replaced, inside the dialog',
      (role) => {
        AcquisitionEdits.set(BODY_HASH, { text: 'Full stale', baseItemId: 1 });
        openGlamourSheet(twoSources());
        const button = rowOf('Body').querySelector<HTMLButtonElement>(`[data-role="${role}"]`)!;
        button.focus();
        button.click();

        expect(document.activeElement).toBe(rowOf('Body'));
      }
    );

    it('a fresh Abridged edit hides a stale full edit: the active edit decides', () => {
      AcquisitionEdits.set(BODY_HASH, { text: 'Full', baseItemId: 1 });
      AcquisitionEdits.set(BODY_ABRIDGED, { text: 'Short', baseItemId: 5000 });
      StorageService.setItem(FORMAT_KEY, 'abridged');
      openGlamourSheet(twoSources());

      expect(rowOf('Body').querySelector('[data-role="sheet-warn"]')).toBeNull();
    });

    it.each([
      ['full', false],
      ['Abridged', true],
    ])('Reset all clears both keys for every piece, from %s', async (_mode, abridged) => {
      AcquisitionEdits.set('someone-else', { text: 'keep', baseItemId: 1 });
      AcquisitionEdits.set(BODY_HASH, { text: 'Full', baseItemId: 5000 });
      AcquisitionEdits.set(BODY_ABRIDGED, { text: '', baseItemId: 5000 });
      AcquisitionEdits.set(abridgedEditKey(HEAD_HASH), { text: 'Short', baseItemId: 2629 });
      openGlamourSheet(twoSources());
      if (abridged) await flip();
      sheet()!.querySelector<HTMLButtonElement>('[data-role="sheet-reset"]')!.click();

      expect(AcquisitionEdits.get(BODY_HASH)).toBeNull();
      expect(AcquisitionEdits.get(BODY_ABRIDGED)).toBeNull();
      expect(AcquisitionEdits.get(abridgedEditKey(HEAD_HASH))).toBeNull();
      expect(AcquisitionEdits.get('someone-else')).not.toBeNull();
      expect(state('Body')).toBe('FILLED');
      expect(field('Body').value).toBe(abridged ? 'Crafted (WVR Lvl. 9)' : CRAFT_OR_VENDOR);
    });
  });

  describe('placement', () => {
    it('sits in the header between the counts and the close button on desktop', () => {
      openGlamourSheet(source());
      const counts = sheet()!.querySelector<HTMLElement>('[data-role="sheet-counts"]')!;
      const head = counts.parentElement!;
      const close = head.querySelector('button')!;

      expect(formatToggle().parentElement).toBe(head);
      expect(counts.nextElementSibling).toBe(formatToggle());
      expect(formatToggle().nextElementSibling).toBe(close);
    });

    it('gets its own strip directly under the header on a phone', () => {
      phone();
      openGlamourSheet(source());
      const counts = sheet()!.querySelector<HTMLElement>('[data-role="sheet-counts"]')!;
      const head = counts.parentElement!;

      expect(head.contains(formatToggle())).toBe(false);
      expect(head.nextElementSibling).toBe(formatToggle().parentElement);
    });
  });

  describe('keyboard', () => {
    const press = (target: HTMLElement, shiftKey = false): void => {
      // composed, as a real key press is: the switch is inside the toggle's shadow root
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, composed: true })
      );
    };
    const lastControl = () =>
      sheet()!.querySelector<HTMLButtonElement>('[data-role="sheet-copy"]')!;

    it('Tab from the last control lands on the switch inside the toggle', async () => {
      openGlamourSheet(source());
      await formatToggle().updateComplete;
      lastControl().focus();
      press(lastControl());

      expect(document.activeElement).toBe(formatToggle());
      expect(formatToggle().shadowRoot!.activeElement).toBe(formatSwitch());
    });

    it('Shift+Tab from the toggle wraps to the last control', async () => {
      openGlamourSheet(source());
      await formatToggle().updateComplete;
      formatSwitch().focus();
      press(formatSwitch(), true);

      expect(document.activeElement).toBe(lastControl());
    });

    describe('with focus outside the panel', () => {
      // A click on the toggle's label or the title drops focus to <body>, and a
      // browser's Tab goes on from there. jsdom moves no focus on a click.
      it('Shift+Tab from <body> wraps to the last control', async () => {
        openGlamourSheet(source());
        await formatToggle().updateComplete;
        lastControl().blur();
        expect(document.activeElement).toBe(document.body);
        press(document.body, true);

        expect(document.activeElement).toBe(lastControl());
      });

      it('Tab from <body> wraps to the first control', async () => {
        openGlamourSheet(source());
        await formatToggle().updateComplete;
        lastControl().blur();
        press(document.body);

        expect(document.activeElement).toBe(formatToggle());
        expect(formatToggle().shadowRoot!.activeElement).toBe(formatSwitch());
      });

      it('Shift+Tab from a control behind the sheet comes back to it', async () => {
        const behind = document.createElement('button');
        document.body.appendChild(behind);
        openGlamourSheet(source());
        await formatToggle().updateComplete;
        behind.focus();
        press(behind, true);

        expect(document.activeElement).toBe(lastControl());
        behind.remove();
      });
    });

    it('leaves Tab alone between the controls inside the panel', async () => {
      openGlamourSheet(source());
      await formatToggle().updateComplete;
      field('Body').focus();
      const tab = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      field('Body').dispatchEvent(tab);

      expect(tab.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(field('Body'));
    });

    it('keeps the close button first on a phone, where the toggle sits under it', async () => {
      phone();
      openGlamourSheet(source());
      await formatToggle().updateComplete;
      lastControl().focus();
      press(lastControl());

      expect(document.activeElement?.getAttribute('aria-label')).toBe('Close');
    });

    it('flips with the keyboard from the switch', async () => {
      openGlamourSheet(source());
      await formatToggle().updateComplete;
      formatSwitch().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await formatToggle().updateComplete;

      expect(preview()).toContain('Obtained:');
    });
  });

  it('gives the track a visible color from theme tokens on this toggle alone', () => {
    openGlamourSheet(source());
    expect(formatToggle().style.getPropertyValue('--v4-toggle-bg')).toContain('var(--theme-');
    expect(formatToggle().style.getPropertyValue('--v4-toggle-bg-hover')).toContain('var(--theme-');
  });

  it('keeps a hovered switch in the theme, since no theme defines its on-hover color', () => {
    openGlamourSheet(source());
    expect(formatToggle().style.getPropertyValue('--theme-primary-hover')).toContain(
      'var(--theme-primary)'
    );
  });
});

describe('glamour export sheet — a switch per piece', () => {
  const FORMAT_KEY = `${STORAGE_PREFIX}_glamour_list_format`;
  const includeOf = (slot: string) =>
    rowOf(slot).querySelector<ToggleSwitchV4>('[data-role="sheet-include"]')!;
  const switchOf = async (slot: string): Promise<HTMLElement> => {
    await includeOf(slot).updateComplete;
    return includeOf(slot).shadowRoot!.querySelector<HTMLElement>('[role="switch"]')!;
  };
  /** Flip a piece's switch the way a player does: a click on the switch inside the toggle. */
  const flipPiece = async (slot: string): Promise<void> => {
    (await switchOf(slot)).click();
    await includeOf(slot).updateComplete;
  };
  const copyButton = () => sheet()!.querySelector<HTMLButtonElement>('[data-role="sheet-copy"]')!;
  const saveButton = () => sheet()!.querySelector<HTMLButtonElement>('[data-role="sheet-save"]')!;
  const resetButton = () => sheet()!.querySelector<HTMLButtonElement>('[data-role="sheet-reset"]')!;
  const counts = () => sheet()!.querySelector('[data-role="sheet-counts"]')!.textContent;
  const copied = () => {
    copyButton().click();
    return copyMock.mock.lastCall![0] as { text: string; html: string };
  };
  const saved = () => {
    saveButton().click();
    return downloadMock.mock.lastCall![0] as string;
  };
  const useAbridged = () => StorageService.setItem(FORMAT_KEY, 'abridged');

  // The off switches live in the module for the page: Reset all is how a player
  // clears them, and it covers the outfit that is open, so each outfit gets one
  afterEach(() => {
    for (const outfit of [source(), ringsWorn(true), ringsWorn(false), ringTwins('A', 'B')]) {
      closeGlamourSheet();
      openGlamourSheet(outfit);
      resetButton().click();
    }
    closeGlamourSheet();
    localStorage.clear();
  });

  it('gives every row a switch, on by default', async () => {
    openGlamourSheet(source());
    for (const slot of ['HeadGear', 'Body', 'Legs']) {
      expect(includeOf(slot).checked).toBe(true);
      expect((await switchOf(slot)).getAttribute('aria-checked')).toBe('true');
    }
    expect(field('Body').disabled).toBe(false);
  });

  it('starts on for a different piece in a slot already switched off', async () => {
    openGlamourSheet(source());
    await flipPiece('HeadGear');
    closeGlamourSheet();

    const base = source();
    const items = base.equipment!.items;
    openGlamourSheet({
      ...base,
      resolved: {
        ...base.resolved,
        gearModels: [
          { slot: 'HeadGear', base: 400, variant: 1 },
          ...base.resolved.gearModels.filter((m) => m.slot !== 'HeadGear'),
        ],
      } as ResolvedCharaCharacter,
      equipment: {
        ...base.equipment!,
        items: {
          ...items,
          HeadGear: { ...items.HeadGear!, itemId: 2700, names: names('Iron Helm') },
        },
      },
      picked: {},
    });
    expect(includeOf('HeadGear').checked).toBe(true);
    expect(preview()).toContain('Head: Iron Helm');
    closeGlamourSheet();

    openGlamourSheet(source());
    expect(includeOf('HeadGear').checked).toBe(false);
  });

  describe('when the names lookup fails, and a later one lands', () => {
    const noNames = (): GlamourListSource => ({ ...source(), equipment: null, picked: {} });
    const withFacewear = (equipment: GlamourListSource['equipment']): GlamourListSource => ({
      ...source(),
      resolved: { ...source().resolved, glassesId: 2 },
      equipment,
      picked: {},
    });

    it('a piece switched off before the names landed stays off, everywhere', async () => {
      openGlamourSheet(noNames());
      await flipPiece('Body');
      closeGlamourSheet();

      openGlamourSheet(source());
      expect(includeOf('Body').checked).toBe(false);
      expect(field('Body').disabled).toBe(true);
      expect(preview()).not.toContain('Plain Robe');
      expect(copied().text).not.toContain('Plain Robe');
      expect(saved()).not.toContain('Plain Robe');
    });

    it('a piece switched off after the names landed stays off when they do not', async () => {
      openGlamourSheet(source());
      await flipPiece('Body');
      closeGlamourSheet();

      openGlamourSheet(noNames());
      expect(includeOf('Body').checked).toBe(false);
    });

    it('Reset all on the landed outfit leaves no old switch behind', async () => {
      openGlamourSheet(noNames());
      await flipPiece('Body');
      closeGlamourSheet();

      openGlamourSheet(source());
      resetButton().click();
      expect(includeOf('Body').checked).toBe(true);
      closeGlamourSheet();

      openGlamourSheet(noNames());
      expect(includeOf('Body').checked).toBe(true);
    });

    describe('Reset all and the lines typed in the other lookup state', () => {
      const editsKey = `${STORAGE_PREFIX}_glamour_acquisition_edits`;
      const stored = () => StorageService.getItem<Record<string, unknown>>(editsKey);

      it('with the names landed, forgets a line typed while the lookup was down, in both forms', async () => {
        openGlamourSheet(noNames());
        type('Body', 'typed offline');
        await flip();
        type('Body', 'short offline');
        await flip();
        closeGlamourSheet();

        openGlamourSheet(source());
        resetButton().click();
        closeGlamourSheet();

        expect(stored()).toBeNull();
        openGlamourSheet(noNames());
        expect(field('Body').value).toBe('');
        expect(preview()).not.toContain('typed offline');
      });

      it('with the names landed, forgets both rings’ lines from the merged row', () => {
        const offline: GlamourListSource = { ...ringsWorn(true), equipment: null, picked: {} };
        openGlamourSheet(offline);
        type('RightRing', 'right offline');
        type('LeftRing', 'left offline');
        closeGlamourSheet();

        openGlamourSheet(ringsWorn(true));
        expect(rowOf('LeftRing')).toBeNull();
        resetButton().click();

        expect(stored()).toBeNull();
      });

      // The family's row is only known from the answer, so with the lookup down the
      // key does not exist to be deleted. The guide and PRIVACY.md say so.
      it('with the lookup down, cannot reach a line filed under the family; with names it can', () => {
        openGlamourSheet(source());
        type('Body', 'typed landed');
        closeGlamourSheet();

        openGlamourSheet(noNames());
        expect(field('Body').value).toBe('');
        resetButton().click();
        closeGlamourSheet();

        openGlamourSheet(source());
        expect(field('Body').value).toBe('typed landed');
        resetButton().click();

        expect(stored()).toBeNull();
      });
    });

    it('covers Facewear too', async () => {
      openGlamourSheet(withFacewear(null));
      await flipPiece('Facewear');
      closeGlamourSheet();

      openGlamourSheet(
        withFacewear({
          ...source().equipment!,
          glasses: { id: 2, names: names('Round Glasses'), iconId: 200053 },
        })
      );
      expect(includeOf('Facewear').checked).toBe(false);
      expect(preview()).not.toContain('Round Glasses');

      resetButton().click();
      closeGlamourSheet();
      openGlamourSheet(withFacewear(null));
      expect(includeOf('Facewear').checked).toBe(true);
    });
  });

  describe('belongs to one outfit: the file’s worn gear and dyes', () => {
    /** The base outfit with its file changed. The lookup's answer stays as it is. */
    const outfit = (file: Partial<GlamourListSource['resolved']>): GlamourListSource => {
      const base = source();
      return { ...base, resolved: { ...base.resolved, ...file } };
    };
    const models = () => source().resolved.gearModels;
    const dyes = () => source().resolved.gearDyes;
    /** Head and Body are the same pieces with the same dyes; only the Legs differ. */
    const legsSwapped = () =>
      outfit({ gearModels: models().map((m) => (m.slot === 'Legs' ? { ...m, base: 301 } : m)) });
    const bodyDyed = (stainId: number) =>
      outfit({ gearDyes: [...dyes(), { slot: 'Body', channel: 1, stainId, dye: null }] });
    const invisibleWrists = (landed: boolean): GlamourListSource => {
      const base = outfit({
        gearModels: [...models(), { slot: 'Wrists', base: 70, variant: 1 }],
      });
      return {
        ...base,
        picked: {},
        equipment: landed
          ? {
              ...base.equipment!,
              items: {
                ...base.equipment!.items,
                Wrists: {
                  itemId: 7000,
                  names: names("The Emperor's New Bracelets"),
                  iconId: null,
                  familySize: 1,
                  alternates: [],
                  viaMainHand: false,
                },
              },
            }
          : null,
      };
    };
    const mergedRingsLegsSwapped = (): GlamourListSource => {
      const rings = ringsWorn(true);
      return {
        ...rings,
        resolved: {
          ...rings.resolved,
          gearModels: rings.resolved.gearModels.map((m) =>
            m.slot === 'Legs' ? { ...m, base: 301 } : m
          ),
        },
      };
    };
    /** A file whose only worn piece is invisible, so the landed sheet has no rows at all. */
    const onlyInvisibleWrists = (landed: boolean): GlamourListSource => {
      const wrists = invisibleWrists(landed);
      return {
        ...wrists,
        resolved: {
          ...wrists.resolved,
          gearModels: wrists.resolved.gearModels.filter((m) => m.slot === 'Wrists'),
          gearDyes: [],
        },
      };
    };
    /** The same gear and dyes on either gender: the Robe has a row only on a male file. */
    const robe = (gender: 'Male' | 'Female'): GlamourListSource => {
      const base = outfit({ gender });
      return {
        ...base,
        picked: {},
        equipment: {
          ...base.equipment!,
          items: {
            ...base.equipment!.items,
            Body: {
              ...base.equipment!.items.Body!,
              names: names("The Emperor's New Robe"),
            },
          },
        },
      };
    };
    /** Two dyes on one piece, however the file happens to list them. */
    const headDyedTwice = (reversed: boolean): GlamourListSource => {
      const both = [
        { slot: 'HeadGear', channel: 1, stainId: 1, dye: null },
        { slot: 'HeadGear', channel: 2, stainId: 2, dye: null },
      ] as GlamourListSource['resolved']['gearDyes'];
      return outfit({ gearDyes: reversed ? [...both].reverse() : both });
    };
    const differences: Array<[string, () => GlamourListSource]> = [
      ['a piece swapped', legsSwapped],
      [
        'a piece added',
        () => outfit({ gearModels: [...models(), { slot: 'Feet', base: 80, variant: 1 }] }),
      ],
      [
        'a piece taken off',
        () => outfit({ gearModels: models().filter((m) => m.slot !== 'Legs') }),
      ],
      ['a dye on another piece', () => bodyDyed(2)],
      [
        'a dye on a slot with no model',
        () =>
          outfit({ gearDyes: [...dyes(), { slot: 'Feet', channel: 1, stainId: 2, dye: null }] }),
      ],
      ['facewear added', () => outfit({ glassesId: 2 })],
      [
        'a dye moved to the piece’s other channel',
        () => outfit({ gearDyes: [{ slot: 'HeadGear', channel: 2, stainId: 1, dye: null }] }),
      ],
    ];

    // Each outfit keeps its own switches, so each needs its own Reset all
    afterEach(() => {
      for (const worn of [
        ...differences.map(([, make]) => make()),
        bodyDyed(3),
        invisibleWrists(false),
        mergedRingsLegsSwapped(),
        robe('Male'),
        onlyInvisibleWrists(false),
        headDyedTwice(false),
      ]) {
        closeGlamourSheet();
        openGlamourSheet(worn);
        resetButton().click();
      }
      closeGlamourSheet();
    });

    it('a different outfit wearing the same piece with the same dyes starts on', async () => {
      openGlamourSheet(source());
      await flipPiece('HeadGear');
      closeGlamourSheet();

      openGlamourSheet(legsSwapped());
      expect(includeOf('HeadGear').checked).toBe(true);
      expect(field('HeadGear').disabled).toBe(false);
      expect(preview()).toContain('Head: Hempen Coif');
      closeGlamourSheet();

      openGlamourSheet(source());
      expect(includeOf('HeadGear').checked).toBe(false);
      expect(preview()).not.toContain('Hempen Coif');
    });

    it.each(differences)('%s makes a different outfit', async (_change, different) => {
      openGlamourSheet(source());
      await flipPiece('HeadGear');
      closeGlamourSheet();

      openGlamourSheet(different());
      expect(includeOf('HeadGear').checked).toBe(true);
    });

    it('two dyes on one piece are the same outfit however the file lists them', async () => {
      openGlamourSheet(headDyedTwice(false));
      await flipPiece('HeadGear');
      closeGlamourSheet();

      openGlamourSheet(headDyedTwice(true));
      expect(includeOf('HeadGear').checked).toBe(false);
    });

    it('a switch thrown in one outfit does not reach the other', async () => {
      openGlamourSheet(legsSwapped());
      await flipPiece('HeadGear');
      closeGlamourSheet();

      openGlamourSheet(source());
      expect(includeOf('HeadGear').checked).toBe(true);
    });

    it('one dye changed on another piece makes a new outfit, and the old one keeps its switch', async () => {
      openGlamourSheet(bodyDyed(2));
      await flipPiece('HeadGear');
      closeGlamourSheet();

      openGlamourSheet(bodyDyed(3));
      expect(includeOf('HeadGear').checked).toBe(true);
      closeGlamourSheet();

      openGlamourSheet(bodyDyed(2));
      expect(includeOf('HeadGear').checked).toBe(false);
    });

    it('the same outfit from a fresh source keeps its switches, however the file lists it', async () => {
      const dyed = () => bodyDyed(2);
      openGlamourSheet(dyed());
      await flipPiece('HeadGear');
      closeGlamourSheet();

      // What SWAP and a second drop of the file hand over: new objects, same outfit
      const fresh = dyed();
      openGlamourSheet({
        ...fresh,
        resolved: {
          ...fresh.resolved,
          gearModels: [...fresh.resolved.gearModels].reverse(),
          gearDyes: [...fresh.resolved.gearDyes].reverse(),
        },
      });
      expect(includeOf('HeadGear').checked).toBe(false);
      expect(preview()).not.toContain('Hempen Coif');
    });

    it('the names lookup landing keeps the switch, with a slot it then omits', async () => {
      openGlamourSheet(invisibleWrists(false));
      expect(rowOf('Wrists')).not.toBeNull();
      await flipPiece('Body');
      closeGlamourSheet();

      openGlamourSheet(invisibleWrists(true));
      expect(rowOf('Wrists')).toBeNull();
      expect(includeOf('Body').checked).toBe(false);
      expect(preview()).not.toContain('Plain Robe');
      closeGlamourSheet();

      openGlamourSheet(invisibleWrists(false));
      expect(includeOf('Body').checked).toBe(false);
    });

    it('a switch thrown after the lookup omitted a slot holds when it fails', async () => {
      openGlamourSheet(invisibleWrists(true));
      await flipPiece('Body');
      closeGlamourSheet();

      openGlamourSheet(invisibleWrists(false));
      expect(includeOf('Body').checked).toBe(false);
    });

    it('a twin pick, or dropping the pick, keeps it', async () => {
      openGlamourSheet(source());
      await flipPiece('Body');
      closeGlamourSheet();

      openGlamourSheet(source({ HeadGear: 372 }));
      expect(includeOf('Body').checked).toBe(false);
      closeGlamourSheet();

      openGlamourSheet({ ...source(), picked: {} });
      expect(includeOf('Body').checked).toBe(false);
    });

    it('Reset all on one outfit leaves the other’s switch on the shared piece alone', async () => {
      openGlamourSheet(source());
      await flipPiece('HeadGear');
      closeGlamourSheet();

      openGlamourSheet(legsSwapped());
      resetButton().click();
      expect(includeOf('HeadGear').checked).toBe(true);
      closeGlamourSheet();

      openGlamourSheet(source());
      expect(includeOf('HeadGear').checked).toBe(false);

      resetButton().click();
      expect(includeOf('HeadGear').checked).toBe(true);
    });

    describe('Reset all reaches a piece of this outfit with no row in this view', () => {
      it('the Robe, from the female file of the same outfit', async () => {
        openGlamourSheet(robe('Male'));
        await flipPiece('Body');
        closeGlamourSheet();

        openGlamourSheet(robe('Female'));
        expect(rowOf('Body')).toBeNull();
        resetButton().click();
        closeGlamourSheet();

        openGlamourSheet(robe('Male'));
        expect(includeOf('Body').checked).toBe(true);
        expect(preview()).toContain('Robe');
      });

      it('a slot the names lookup omits once it lands', async () => {
        openGlamourSheet(invisibleWrists(false));
        await flipPiece('Wrists');
        closeGlamourSheet();

        openGlamourSheet(invisibleWrists(true));
        expect(rowOf('Wrists')).toBeNull();
        resetButton().click();
        closeGlamourSheet();

        openGlamourSheet(invisibleWrists(false));
        expect(includeOf('Wrists').checked).toBe(true);
      });

      it('with no row drawn at all', async () => {
        openGlamourSheet(onlyInvisibleWrists(false));
        await flipPiece('Wrists');
        closeGlamourSheet();

        openGlamourSheet(onlyInvisibleWrists(true));
        expect(sheet()!.querySelector('[data-role="sheet-row"]')).toBeNull();
        resetButton().click();
        closeGlamourSheet();

        openGlamourSheet(onlyInvisibleWrists(false));
        expect(includeOf('Wrists').checked).toBe(true);
      });
    });

    it('a merged Rings row starts on in a different outfit, and still covers both rings', async () => {
      openGlamourSheet(ringsWorn(true));
      await flipPiece('RightRing');
      closeGlamourSheet();

      openGlamourSheet(mergedRingsLegsSwapped());
      expect(includeOf('RightRing').checked).toBe(true);
      expect(preview()).toContain('Rings: Silver Ring');
      closeGlamourSheet();

      openGlamourSheet(ringsWorn(true));
      expect(includeOf('RightRing').checked).toBe(false);
      expect(preview()).not.toContain('Ring');
    });
  });

  it('sits outside the row label, whose clicks forward to the field', () => {
    openGlamourSheet(source());
    expect(includeOf('Body').closest('label')).toBeNull();
    expect(includeOf('Body').parentElement).toBe(
      rowOf('Body').querySelector('[data-role="sheet-state"]')!.parentElement
    );
  });

  it('shows no visible text on the switch, and names it after the piece', async () => {
    openGlamourSheet(source());
    await includeOf('Body').updateComplete;
    expect((await switchOf('Body')).getAttribute('aria-label')).toBe(
      'Include Plain Robe in the list'
    );
    expect(includeOf('Body').shadowRoot!.querySelector('.toggle-label')).toBeNull();
  });

  it('names the switch after the slot when the piece has no name', async () => {
    openGlamourSheet({ ...source(), equipment: null, picked: {} });
    expect((await switchOf('Legs')).getAttribute('aria-label')).toBe('Include Legs in the list');
  });

  it('draws the track from the same theme tokens as the Abridged toggle', () => {
    openGlamourSheet(source());
    for (const property of ['--v4-toggle-bg', '--v4-toggle-bg-hover', '--theme-primary-hover']) {
      expect(includeOf('Body').style.getPropertyValue(property)).toBe(
        formatToggle().style.getPropertyValue(property)
      );
      expect(includeOf('Body').style.getPropertyValue(property)).toContain('var(--theme-');
    }
  });

  describe('off leaves the piece out', () => {
    it('of the preview, Copy (both flavours) and Save, in the full form', async () => {
      openGlamourSheet(source());
      await flipPiece('Body');

      expect(preview()).not.toContain('Plain Robe');
      expect(preview()).toContain('Head: Hempen Coif');
      const { text, html } = copied();
      expect(text).not.toContain('Plain Robe');
      expect(text).toContain('Hempen Coif');
      expect(html).not.toContain('Plain Robe');
      expect(html).toContain('Hempen Coif');
      expect(saved()).not.toContain('Plain Robe');
      expect(saved()).toContain('Hempen Coif');
    });

    it('of the preview, Copy (both flavours) and Save, in Abridged', async () => {
      useAbridged();
      openGlamourSheet(source());
      await flipPiece('Body');

      expect(preview()).not.toContain('Plain Robe');
      expect(preview()).toContain('Head: Hempen Coif');
      const { text, html } = copied();
      expect(text).not.toContain('Plain Robe');
      expect(html).not.toContain('Plain Robe');
      expect(html).toContain('Hempen Coif');
      expect(saved()).not.toContain('Plain Robe');
    });

    it('and on puts it back', async () => {
      openGlamourSheet(source());
      const before = preview();
      await flipPiece('Body');
      await flipPiece('Body');

      expect(includeOf('Body').checked).toBe(true);
      expect(preview()).toBe(before);
    });
  });

  describe('keeps its state for the page', () => {
    it('across a flip of the Abridged toggle, both ways', async () => {
      openGlamourSheet(source());
      await flipPiece('Body');
      await flip();

      expect(includeOf('Body').checked).toBe(false);
      expect(preview()).not.toContain('Plain Robe');
      expect(field('Body').disabled).toBe(true);

      await flip();
      expect(includeOf('Body').checked).toBe(false);
      expect(preview()).not.toContain('Plain Robe');
    });

    it('across a reopen', async () => {
      openGlamourSheet(source());
      await flipPiece('Body');
      closeGlamourSheet();

      openGlamourSheet(source());
      expect(includeOf('Body').checked).toBe(false);
      expect(field('Body').disabled).toBe(true);
      expect(preview()).not.toContain('Plain Robe');
    });

    it('across a twin pick, which keeps the key', async () => {
      openGlamourSheet(source());
      await flipPiece('HeadGear');
      closeGlamourSheet();

      openGlamourSheet(source({ HeadGear: 372 }));
      expect(includeOf('HeadGear').checked).toBe(false);
    });

    it('across a redraw from a warning’s button', async () => {
      AcquisitionEdits.set(HEAD_HASH, { text: 'Stale head', baseItemId: 1 });
      openGlamourSheet(source());
      await flipPiece('Body');
      rowOf('HeadGear').querySelector<HTMLButtonElement>('[data-role="sheet-keep"]')!.click();

      expect(includeOf('HeadGear').checked).toBe(true);
      expect(includeOf('Body').checked).toBe(false);
      expect(preview()).not.toContain('Plain Robe');
    });

    it('and nothing about it reaches the device', async () => {
      openGlamourSheet(source());
      const keys = () => Object.keys(localStorage).sort();
      const before = keys();
      await flipPiece('Body');
      closeGlamourSheet();
      openGlamourSheet(source());

      expect(keys()).toEqual(before);
    });
  });

  describe('rings', () => {
    it('one switch on a merged Rings row covers both rings', async () => {
      openGlamourSheet(ringsWorn(true));
      expect(sheet()!.querySelector('[data-slot="LeftRing"]')).toBeNull();
      expect(preview()).toContain('Rings: Silver Ring');

      await flipPiece('RightRing');
      expect(preview()).not.toContain('Ring');
      expect(copied().text).not.toContain('Ring');
      expect(saved()).not.toContain('Ring');

      await flipPiece('RightRing');
      expect(preview()).toContain('Rings: Silver Ring');
    });

    it('different rings each have their own', async () => {
      openGlamourSheet(ringsWorn(false));

      await flipPiece('RightRing');
      expect(preview()).not.toContain('Right Ring:');
      expect(preview()).toContain('Left Ring: Gold Ring');

      await flipPiece('LeftRing');
      expect(preview()).not.toContain('Ring');

      await flipPiece('RightRing');
      expect(preview()).toContain('Right Ring: Silver Ring');
      expect(preview()).not.toContain('Left Ring:');
    });

    describe('when a twin pick merges or splits them', () => {
      const reopen = (outfit: GlamourListSource): void => {
        closeGlamourSheet();
        openGlamourSheet(outfit);
      };

      it('a merged switch turned off still covers both once they split', async () => {
        openGlamourSheet(ringTwins('A', 'A'));
        await flipPiece('RightRing');

        reopen(ringTwins('A', 'B'));
        expect(includeOf('RightRing').checked).toBe(false);
        expect(includeOf('LeftRing').checked).toBe(false);
        expect(preview()).not.toContain('Ring');
      });

      it.each(['RightRing', 'LeftRing'])(
        'a merged row is off when %s was off before they merged',
        async (slot) => {
          openGlamourSheet(ringTwins('A', 'B'));
          await flipPiece(slot);

          reopen(ringTwins('A', 'A'));
          expect(includeOf('RightRing').checked).toBe(false);
          expect(field('RightRing').disabled).toBe(true);
          expect(preview()).not.toContain('Ring');
        }
      );

      it('a merged switch turned on brings both back once they split', async () => {
        openGlamourSheet(ringTwins('A', 'B'));
        await flipPiece('RightRing');
        await flipPiece('LeftRing');

        reopen(ringTwins('A', 'A'));
        await flipPiece('RightRing');
        expect(preview()).toContain('Rings: Silver Ring A');

        reopen(ringTwins('A', 'B'));
        expect(includeOf('RightRing').checked).toBe(true);
        expect(includeOf('LeftRing').checked).toBe(true);
        expect(preview()).toContain('Right Ring: Silver Ring A');
        expect(preview()).toContain('Left Ring: Silver Ring B');
      });

      it('Reset all on a merged row turns both back on once they split', async () => {
        openGlamourSheet(ringTwins('A', 'B'));
        await flipPiece('LeftRing');

        reopen(ringTwins('A', 'A'));
        resetButton().click();

        reopen(ringTwins('A', 'B'));
        expect(includeOf('LeftRing').checked).toBe(true);
        expect(field('LeftRing').disabled).toBe(false);
        expect(preview()).toContain('Left Ring: Silver Ring B');
      });

      it('Reset all on a merged row forgets both rings’ edits, in both forms', async () => {
        openGlamourSheet(ringTwins('A', 'B'));
        type('RightRing', 'my right note');
        type('LeftRing', 'my left note');
        await flip();
        type('RightRing', 'short right');
        type('LeftRing', 'short left');
        await flip();

        reopen(ringTwins('A', 'A'));
        resetButton().click();

        for (const slot of ['RightRing', 'LeftRing']) {
          const hash = gearHash(slot, 4000, []);
          expect(AcquisitionEdits.get(hash)).toBeNull();
          expect(AcquisitionEdits.get(abridgedEditKey(hash))).toBeNull();
        }
        reopen(ringTwins('A', 'B'));
        expect(field('RightRing').value).toBe('A vendor');
        expect(field('LeftRing').value).toBe('B vendor');
        expect(preview()).not.toContain('my left note');
        await flip();
        expect(preview()).not.toContain('short left');
      });

      it('a ring switched off is still the one off after a merge and a split', async () => {
        openGlamourSheet(ringTwins('A', 'B'));
        await flipPiece('LeftRing');

        reopen(ringTwins('A', 'A'));
        reopen(ringTwins('A', 'B'));
        expect(includeOf('RightRing').checked).toBe(true);
        expect(includeOf('LeftRing').checked).toBe(false);
        expect(preview()).toContain('Right Ring: Silver Ring A');
        expect(preview()).not.toContain('Left Ring:');
      });
    });
  });

  describe('an off row', () => {
    const dimmed = (node: Element) => (node as HTMLElement).style.opacity !== '';

    it('stays in the sheet, dimmed, with its field locked', async () => {
      openGlamourSheet(source());
      const row = rowOf('HeadGear');
      expect(field('HeadGear').disabled).toBe(false);
      expect(dimmed(field('HeadGear').closest('label')!)).toBe(false);

      await flipPiece('HeadGear');
      expect(rowOf('HeadGear')).toBe(row);
      expect(field('HeadGear').disabled).toBe(true);
      expect(dimmed(field('HeadGear').closest('label')!)).toBe(true);
      // The label, the name and the chip, and the dye line under them
      const chip = row.querySelector<HTMLElement>('[data-role="sheet-state"]')!;
      for (const part of chip.parentElement!.children) {
        if (part !== includeOf('HeadGear')) expect(dimmed(part)).toBe(true);
      }
      expect(dimmed(chip.parentElement!.nextElementSibling!)).toBe(true);

      await flipPiece('HeadGear');
      expect(field('HeadGear').disabled).toBe(false);
      expect(dimmed(field('HeadGear').closest('label')!)).toBe(false);
      expect(dimmed(chip)).toBe(false);
    });

    it('never dims the switch itself, or anything around it', async () => {
      openGlamourSheet(source());
      await flipPiece('Body');
      let node: HTMLElement | null = includeOf('Body');
      while (node && node !== sheet()) {
        expect(node.style.opacity).toBe('');
        node = node.parentElement;
      }
    });

    it('draws the same from a redraw and a reopen as from the flip', async () => {
      openGlamourSheet(source());
      await flipPiece('Body');
      const flipped = rowOf('Body').outerHTML;
      await flip();
      await flip();
      expect(rowOf('Body').outerHTML).toBe(flipped);
      closeGlamourSheet();
      openGlamourSheet(source());
      expect(rowOf('Body').outerHTML).toBe(flipped);
    });

    it('keeps what was typed there, in both forms, and gives it back', async () => {
      openGlamourSheet(source());
      type('Legs', 'Moonfire Faire (2014)');
      await flipPiece('Legs');

      expect(field('Legs').value).toBe('Moonfire Faire (2014)');
      expect(AcquisitionEdits.get(gearHash('Legs', 6000, []))?.text).toBe('Moonfire Faire (2014)');
      expect(preview()).not.toContain('Moonfire');
      expect(state('Legs')).toBe('EDITED');

      await flipPiece('Legs');
      expect(field('Legs').value).toBe('Moonfire Faire (2014)');
      expect(preview()).toContain('Legs: Viera Gaskins\nAcquisition: Moonfire Faire (2014)');

      // Abridged's own line, kept under its own key
      const abridgedKey = abridgedEditKey(gearHash('Legs', 6000, []));
      await flip();
      type('Legs', 'Moonfire Faire');
      await flipPiece('Legs');

      expect(field('Legs').value).toBe('Moonfire Faire');
      expect(AcquisitionEdits.get(abridgedKey)?.text).toBe('Moonfire Faire');
      expect(preview()).not.toContain('Moonfire');
      expect(state('Legs')).toBe('EDITED');

      await flipPiece('Legs');
      expect(field('Legs').value).toBe('Moonfire Faire');
      expect(preview()).toContain('Obtained: Moonfire Faire');

      // Neither form's line touched the other's
      await flip();
      expect(field('Legs').value).toBe('Moonfire Faire (2014)');
    });

    it('locks a warning’s buttons too, so nothing changes the kept edit', async () => {
      AcquisitionEdits.set(BODY_HASH, { text: 'Kept', baseItemId: 1 });
      openGlamourSheet(source());
      await flipPiece('Body');
      const useNew = () =>
        rowOf('Body').querySelector<HTMLButtonElement>('[data-role="sheet-use-new"]')!;
      expect(useNew().disabled).toBe(true);
      useNew().click();
      expect(AcquisitionEdits.get(BODY_HASH)?.text).toBe('Kept');

      await flipPiece('Body');
      expect(useNew().disabled).toBe(false);
    });

    it('keeps focus on the switch: the row is not rebuilt', async () => {
      openGlamourSheet(source());
      const control = await switchOf('Body');
      control.focus();
      control.click();
      await includeOf('Body').updateComplete;

      expect(document.activeElement).toBe(includeOf('Body'));
      expect(includeOf('Body').shadowRoot!.activeElement).toBe(control);
      expect(await switchOf('Body')).toBe(control);
    });

    it('flips with the keyboard from the switch', async () => {
      openGlamourSheet(source());
      (await switchOf('Body')).dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true })
      );
      await includeOf('Body').updateComplete;

      expect(preview()).not.toContain('Plain Robe');
    });
  });

  describe('the counts', () => {
    it('only include pieces that are on', async () => {
      openGlamourSheet(source());
      type('HeadGear', 'My note');
      expect(counts()).toBe('1 FILLED1 EDITED1 BLANK');

      await flipPiece('Body');
      expect(counts()).toBe('1 EDITED1 BLANK');

      await flipPiece('HeadGear');
      expect(counts()).toBe('1 BLANK');

      await flipPiece('Legs');
      expect(counts()).toBe('');

      await flipPiece('Body');
      expect(counts()).toBe('1 FILLED');
    });

    it('in Abridged too', async () => {
      useAbridged();
      openGlamourSheet(source());
      await flipPiece('Legs');
      expect(counts()).toBe('2 FILLED');
    });
  });

  describe('Reset all', () => {
    it('turns every piece of this outfit back on, as well as clearing edits', async () => {
      openGlamourSheet(source());
      type('Legs', 'My note');
      await flipPiece('Legs');
      await flipPiece('Body');
      resetButton().click();

      for (const slot of ['HeadGear', 'Body', 'Legs']) {
        expect(includeOf(slot).checked).toBe(true);
        expect(field(slot).disabled).toBe(false);
      }
      expect(field('Legs').value).toBe('');
      expect(preview()).toContain('Plain Robe');
      expect(counts()).toBe('2 FILLED1 BLANK');
    });

    it('leaves another outfit’s switches alone', async () => {
      openGlamourSheet(ringsWorn(false));
      await flipPiece('LeftRing');
      closeGlamourSheet();

      // The same Head, Body and Legs, but no rings
      openGlamourSheet(source());
      resetButton().click();
      closeGlamourSheet();

      openGlamourSheet(ringsWorn(false));
      expect(includeOf('LeftRing').checked).toBe(false);
    });
  });

  describe('with every piece off', () => {
    const allOff = async (): Promise<void> => {
      for (const slot of ['HeadGear', 'Body', 'Legs']) await flipPiece(slot);
    };

    it.each([
      ['full', false],
      ['Abridged', true],
    ])('Copy list and Save .md are disabled in %s', async (_mode, abridged) => {
      if (abridged) useAbridged();
      openGlamourSheet(source());
      await allOff();

      expect(copyButton().disabled).toBe(true);
      expect(saveButton().disabled).toBe(true);
      copyButton().click();
      saveButton().click();
      expect(copyMock).not.toHaveBeenCalled();
      expect(downloadMock).not.toHaveBeenCalled();
    });

    it('one piece back on enables them, and so does Reset all', async () => {
      openGlamourSheet(source());
      await allOff();
      await flipPiece('Body');
      expect(copyButton().disabled).toBe(false);
      expect(saveButton().disabled).toBe(false);

      await flipPiece('Body');
      expect(copyButton().disabled).toBe(true);
      resetButton().click();
      expect(copyButton().disabled).toBe(false);
      expect(saveButton().disabled).toBe(false);
    });

    it('stays disabled when the Abridged toggle is flipped', async () => {
      openGlamourSheet(source());
      await allOff();
      await flip();
      expect(copyButton().disabled).toBe(true);
      await flip();
      expect(saveButton().disabled).toBe(true);
    });

    it('a reopen lands focus inside the dialog, on the close button', async () => {
      openGlamourSheet(source());
      await allOff();
      closeGlamourSheet();

      openGlamourSheet(source(), 'copy');
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Close');
    });

    it('Tab wraps at Reset all, the last control left', async () => {
      openGlamourSheet(source());
      await allOff();
      await formatToggle().updateComplete;
      const press = (target: HTMLElement, shiftKey = false): void => {
        target.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, composed: true })
        );
      };

      resetButton().focus();
      press(resetButton());
      expect(document.activeElement).toBe(formatToggle());
      expect(formatToggle().shadowRoot!.activeElement).toBe(formatSwitch());

      press(formatSwitch(), true);
      expect(document.activeElement).toBe(resetButton());
    });

    it('keeps a list with no rows as it is: the full form can still write its header', () => {
      const nothing = source();
      nothing.resolved = { ...nothing.resolved, gearModels: [], gearDyes: [] };
      openGlamourSheet(nothing);

      expect(copyButton().disabled).toBe(false);
      expect(saveButton().disabled).toBe(false);
    });
  });

  it('Tab still wraps at Copy list with switches in the rows', async () => {
    openGlamourSheet(source());
    await formatToggle().updateComplete;
    copyButton().focus();
    copyButton().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true })
    );
    expect(formatToggle().shadowRoot!.activeElement).toBe(formatSwitch());
  });

  it('leaves Tab alone on a row’s switch: it is neither end of the sheet', async () => {
    openGlamourSheet(source());
    const control = await switchOf('Body');
    control.focus();
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    control.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  describe('everything on', () => {
    const FULL_TEXT = [
      'Glamour Items:',
      'Head: Hempen Coif',
      'Dye 1: #1',
      'Acquisition: Crafted (WVR Lvl. 3)',
      '',
      'Body: Plain Robe',
      'Acquisition: Vendor - Old Gridania (10 Gil)',
      '',
      'Legs: Viera Gaskins',
      'Acquisition:',
      '',
    ].join('\n');
    const FULL_MARKDOWN = [
      '**Glamour Items:**',
      '**Head:** Hempen Coif',
      'Dye 1: #1',
      'Acquisition: Crafted (WVR Lvl. 3)',
      '',
      '**Body:** Plain Robe',
      'Acquisition: Vendor - Old Gridania (10 Gil)',
      '',
      '**Legs:** Viera Gaskins',
      'Acquisition:',
      '',
    ].join('\n');
    const FULL_HTML =
      '<p><strong>Glamour Items:</strong><br><strong>Head:</strong> Hempen Coif<br>Dye 1: #1<br>Acquisition: Crafted (WVR Lvl. 3)</p>' +
      '<p><strong>Body:</strong> Plain Robe<br>Acquisition: Vendor - Old Gridania (10 Gil)</p>' +
      '<p><strong>Legs:</strong> Viera Gaskins<br>Acquisition:</p>';
    const ABRIDGED_TEXT = [
      'Head: Hempen Coif',
      'Dyes: #1',
      'Obtained: Crafted (WVR Lvl. 3)',
      '',
      'Body: Plain Robe',
      'Obtained: Vendor - Old Gridania (10 Gil)',
      '',
      'Legs: Viera Gaskins',
      'Obtained:',
      '',
    ].join('\n');

    it('writes the full form byte for byte as it did, in all three renderings', () => {
      openGlamourSheet(source());
      expect(preview()).toBe(FULL_TEXT);
      expect(copied()).toEqual({ text: FULL_TEXT, html: FULL_HTML });
      expect(saved()).toBe(FULL_MARKDOWN);
    });

    it('writes Abridged byte for byte as it did', () => {
      useAbridged();
      openGlamourSheet(source());
      expect(preview()).toBe(ABRIDGED_TEXT);
      expect(copied().text).toBe(ABRIDGED_TEXT);
    });

    it('comes back to the same bytes after a switch goes off and on again', async () => {
      openGlamourSheet(source());
      await flipPiece('Legs');
      await flipPiece('Legs');
      expect(copied()).toEqual({ text: FULL_TEXT, html: FULL_HTML });
      expect(saved()).toBe(FULL_MARKDOWN);
    });

    it('still writes one Rings block for two identical rings', () => {
      openGlamourSheet(ringsWorn(true));
      expect(preview()).toContain('Rings: Silver Ring\nAcquisition: Silver Ring vendor\n');
      expect(preview()).not.toContain('Left Ring');
    });
  });
});

describe('glamourInputWithAcquisition — the slots left out', () => {
  it('leaves a slot out, and fills in the rest', () => {
    const input = glamourInputWithAcquisition(
      source(),
      { HeadGear: 'Head line', Body: 'Body line' },
      new Set(['HeadGear'])
    );
    expect(input.HeadGear).toBeUndefined();
    expect(input.Body?.acquisition).toBe('Body line');
    expect(input.Legs).toBeDefined();
  });

  it('writes the same list as before when nothing is left out', () => {
    const input = glamourInputWithAcquisition(source(), { Body: 'Body line' }, new Set());
    const expected = glamourMarkdownInput(source());
    expected.Body!.acquisition = 'Body line';
    expect(input).toEqual(expected);
  });

  it('drops both rings for a merged Rings row: no stray Left Ring', () => {
    const input = glamourInputWithAcquisition(ringsWorn(true), {}, new Set(['RightRing']));
    expect(input.RightRing).toBeUndefined();
    expect(input.LeftRing).toBeUndefined();
    expect(buildGlamourPlainText(input)).not.toMatch(/Ring/);
  });

  it('keeps the other ring when different rings are left out one at a time', () => {
    const right = glamourInputWithAcquisition(ringsWorn(false), {}, new Set(['RightRing']));
    expect(right.RightRing).toBeUndefined();
    expect(right.LeftRing?.name).toBe('Gold Ring');

    const left = glamourInputWithAcquisition(ringsWorn(false), {}, new Set(['LeftRing']));
    expect(left.RightRing?.name).toBe('Silver Ring');
    expect(left.LeftRing).toBeUndefined();
  });
});

describe('glamourMarkdownInput — the dye channel count', () => {
  const pickedWith = (dyeCount?: number): GlamourListSource => {
    const base = source();
    return {
      ...base,
      picked: {
        HeadGear: {
          ...base.picked!.HeadGear!,
          ...(dyeCount === undefined ? {} : { dyeCount }),
        },
      },
    };
  };

  it('copies the pick’s dyeCount onto the piece, a zero included', () => {
    expect(glamourMarkdownInput(pickedWith(2)).HeadGear?.dyeSlots).toBe(2);
    expect(glamourMarkdownInput(pickedWith(0)).HeadGear?.dyeSlots).toBe(0);
  });

  it('leaves the count off when the pick does not know it', () => {
    const input = glamourMarkdownInput(pickedWith());
    expect(input.HeadGear).not.toHaveProperty('dyeSlots');
    expect(input.Body).not.toHaveProperty('dyeSlots');
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
