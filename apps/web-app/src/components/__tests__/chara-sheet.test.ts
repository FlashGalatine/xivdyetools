/**
 * CharaSheet — THIS CHARACTER, one card per colour slot on the loaded file.
 *
 * Real services (setup.ts initialises LanguageService with EN and the dye
 * database) and core's real parser, so the slots and grid addresses are the
 * ones a player's file would produce.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CharaSlotId, ImportedCharaCharacter } from '@xivdyetools/core';
import { CharaSheet, saveCharacterColors, type CharaSheetOptions } from '../chara-sheet';
import {
  CollectionService,
  ColorService,
  dyeService,
  LanguageService,
  ToastService,
} from '@services/index';
import { CharaSessionService } from '@services/chara-session-service';
import ja from '../../locales/ja.json';
import { ThemeService } from '@services/theme-service';
import { loadCharaFile } from '@services/chara-file-loader';
import { inspectCharaBytes } from '@services/chara-inspection-service';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';
import { makeImportedCharacter, makeImportedSlot } from '../../__tests__/mocks/imported-chara';

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
  it('saves the closest dye for each worn colour as a character record with the localized default name', async () => {
    const success = vi.spyOn(ToastService, 'success').mockImplementation(() => '');
    await load();

    saveCharacterColors(CharaSessionService.getSession()!);

    const saved = CollectionService.getCollections().find((c) => c.kind === 'character');
    expect(saved?.name).toBe(LanguageService.t('swatch.characterDefaultName'));
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
    const base = LanguageService.t('swatch.characterDefaultName');
    expect(characterRecords().map((c) => c.name)).toEqual([base, `${base} (1)`]);
    expect(success).toHaveBeenCalledTimes(2);
  });

  it('ignores even a long imported nickname when numbering default names', async () => {
    vi.spyOn(ToastService, 'success').mockImplementation(() => '');
    const long = 'N'.repeat(60);
    await load(JSON.stringify({ ...JSON.parse(FIXTURE), Nickname: long }));
    const session = CharaSessionService.getSession()!;

    saveCharacterColors(session);
    saveCharacterColors(session);

    const base = LanguageService.t('swatch.characterDefaultName');
    expect(characterRecords().map((c) => c.name)).toEqual([base, `${base} (1)`]);
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
  it.each(['', '   ', undefined])(
    'uses the default without persisting the filename when the Nickname is %j',
    async (nickname) => {
      vi.spyOn(ToastService, 'success').mockImplementation(() => '');
      const error = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
      await load(JSON.stringify({ ...JSON.parse(FIXTURE), Nickname: nickname }), 'blank.chara');

      saveCharacterColors(CharaSessionService.getSession()!);

      expect(error).not.toHaveBeenCalled();
      expect(characterRecords().map((c) => c.name)).toEqual([
        LanguageService.t('swatch.characterDefaultName'),
      ]);
    }
  );

  it('saves with a default when neither nickname nor filename supplies a name', async () => {
    await load(JSON.stringify({ ...JSON.parse(FIXTURE), Nickname: undefined }));
    const session = CharaSessionService.getSession()!;

    saveCharacterColors({ ...session, fileName: '' });

    expect(characterRecords().map((c) => c.name)).toEqual([
      LanguageService.t('swatch.characterDefaultName'),
    ]);
  });

  it('uses the actual current locale default and leaves existing named records unchanged', async () => {
    const existing = CollectionService.createCollection('Existing personal name', undefined, {
      kind: 'character',
    })!;
    CollectionService.addDyeToCollection(existing.id, 1);
    const before = JSON.parse(JSON.stringify(CollectionService.getCollections()));
    const previousLocale = LanguageService.getCurrentLocale();
    await load();
    try {
      await LanguageService.setLocale('ja');
      expect(LanguageService.getCurrentLocale()).toBe('ja');
      expect(LanguageService.t('swatch.characterDefaultName')).toBe(ja.swatch.characterDefaultName);

      saveCharacterColors(CharaSessionService.getSession()!);

      expect(characterRecords().map((c) => c.name)).toEqual([
        'Existing personal name',
        ja.swatch.characterDefaultName,
      ]);
      expect(CollectionService.getCollections().find((c) => c.id === existing.id)).toEqual(
        before[0]
      );
    } finally {
      await LanguageService.setLocale(previousLocale);
    }
  });
});

// ---------------------------------------------------------------------------
// Task 5 (assignment B): the evidence states of the xivcharakit-backed projection. Real files
// through the loader where a short document produces the state (the plan's tuples among them);
// the shared factory for live extended floats, the eye correction and the lip composite.
// ---------------------------------------------------------------------------

const BASE = {
  TypeName: 'Anamnesis Character File',
  Nickname: 'Test Subject',
  Race: 'Miqote',
  Tribe: 'SeekerOfTheSun',
  Gender: 'Feminine',
};
const t = (key: string): string => LanguageService.t(key);

/** Every slot card, button or not, by slot. */
const cardFor = (container: HTMLElement, slot: CharaSlotId): HTMLElement | null =>
  container.querySelector<HTMLElement>(`.chara-slots-grid > [data-slot="${slot}"]`);
const allCards = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>('.chara-slots-grid > *'));
/** The header's `x / 8`. */
const headerCount = (container: HTMLElement): string | null | undefined =>
  container.querySelector('div > div > span:last-child')?.textContent;
/** The ΔE number a matched card ends with (mono, 11px). */
const hasBestDyeRow = (card: HTMLElement): boolean =>
  Array.from(card.querySelectorAll<HTMLElement>('span')).some((s) => s.style.fontSize === '11px');

async function loadDoc(doc: object, fileName = 'test.chara'): Promise<void> {
  const result = await loadCharaFile(
    new File([JSON.stringify(doc)], fileName, { type: 'application/json' })
  );
  expect(result).toEqual({ ok: true });
}

/** Load a hand-built projection through the real loader (the inspection answers it once). */
async function loadImported(resolved: ImportedCharaCharacter): Promise<void> {
  vi.mocked(inspectCharaBytes).mockResolvedValueOnce(resolved);
  await loadDoc(BASE);
}

const absent = {
  interpretation: 'unresolved',
  reason: 'missingColor',
  displayHex: null,
  creatorHex: null,
  shaderHex: null,
  sheetIndex: null,
  gridAddress: null,
} as const;

describe('CharaSheet — evidence states (Task 5)', () => {
  describe('unknown activation: a preview, never a match (D4, D6)', () => {
    it('draws the plan tuple {Highlights:0, FacePaintColor:0} as unconfirmed previews', async () => {
      const { container, onSlotPick } = mountSheet();
      await loadDoc({ ...BASE, Highlights: 0, FacePaintColor: 0 });
      const resolved = CharaSessionService.getSession()!.resolved;

      for (const slot of ['highlights', 'facePaint'] as const) {
        const data = resolved.slots.find((s) => s.slot === slot)!;
        expect([data.active, data.interpretation, data.matchHex]).toEqual([null, 'palette', null]);
        const card = cardFor(container, slot)!;
        expect(card.tagName).toBe('DIV');
        expect(card.textContent).toContain(t('swatch.activityUnknownTag'));
        expect(card.textContent).toContain(t('swatch.activityUnknownNote'));
        // The address is evidence too: shown, but nothing links to it.
        expect(card.textContent).toContain(data.gridAddress!);
        expect(card.innerHTML.toUpperCase()).toContain(`BACKGROUND: ${data.displayHex!}`);
        expect(hasBestDyeRow(card)).toBe(false);
        card.click();
      }
      expect(onSlotPick).not.toHaveBeenCalled();
      expect(headerCount(container)).toBe('2 / 8');
    });

    it('draws the plan tuple {Tribe:Wildwood, LipsToneFurPattern:53} as an unconfirmed lip', async () => {
      const { container } = mountSheet();
      await loadDoc({ Tribe: 'Wildwood', LipsToneFurPattern: 53 });
      const lip = CharaSessionService.getSession()!.resolved.slots.find((s) => s.slot === 'lip')!;

      expect([lip.active, lip.interpretation, lip.reason, lip.matchHex]).toEqual([
        null,
        'palette',
        'activityUnknown',
        null,
      ]);
      const card = cardFor(container, 'lip')!;
      expect(card.tagName).toBe('DIV');
      expect(card.textContent).toContain(t('swatch.activityUnknownTag'));
    });

    it('saves nothing from unconfirmed slots', async () => {
      const error = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
      await loadDoc({ ...BASE, Highlights: 0, FacePaintColor: 0 });

      saveCharacterColors(CharaSessionService.getSession()!);

      expect(CollectionService.getCollections().filter((c) => c.kind === 'character')).toEqual([]);
      expect(error).toHaveBeenCalledWith(t('errors.saveChangesFailed'));
    });

    it('never matches or saves a lip composite of unknown activation', async () => {
      const error = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
      const { container } = mountSheet();
      await loadImported(
        makeImportedCharacter({
          slots: [
            makeImportedSlot({
              slot: 'lip',
              active: null,
              reason: 'activityUnknown',
              displayHex: '#AA0000',
              lipComposite: { hex: '#CC8877', alpha: 0.4, derived: true },
            }),
          ],
        })
      );

      expect(cardFor(container, 'lip')!.tagName).toBe('DIV');
      saveCharacterColors(CharaSessionService.getSession()!);
      expect(error).toHaveBeenCalledWith(t('errors.saveChangesFailed'));
    });
  });

  describe('switched off in the file: dashed, with the reason', () => {
    it.each([
      ['highlights', { EnableHighlights: false, Highlights: 5 }, 'swatch.absentHighlightsOff'],
      ['facePaint', { FacePaint: 128, FacePaintColor: 5 }, 'swatch.absentFacePaintOff'],
      ['lip', { Mouth: 2, LipsToneFurPattern: 10 }, 'swatch.absentLipOff'],
      [
        'lip',
        { Race: 'Hrothgar', Tribe: 'Helions', Gender: 'Masculine', LipsToneFurPattern: 3 },
        'swatch.absentFurPattern',
      ],
    ] as const)('%s with %j says %s', async (slot, fields, key) => {
      const { container } = mountSheet();
      await loadDoc({ ...BASE, ...fields });
      const card = cardFor(container, slot)!;

      expect(t(key)).not.toBe(key);
      expect(card.tagName).toBe('DIV');
      expect(card.textContent).toContain(t(key));
      expect(card.getAttribute('style')).not.toContain('244, 100, 90');
    });

    it('says the lip is off when its alpha is zero (noLip)', async () => {
      const { container } = mountSheet();
      await loadImported(
        makeImportedCharacter({
          slots: {
            lip: { active: false, interpretation: 'inactive', reason: 'noLip', displayHex: null },
          },
        })
      );
      expect(cardFor(container, 'lip')!.textContent).toContain(t('swatch.absentNoLips'));
    });
  });

  describe('unresolved: dashed red, with the keyed sentence', () => {
    it.each([
      ['hair', { Tribe: undefined, Gender: undefined, HairTone: 5 }, 'swatch.slotError.noTribe'],
      ['lip', { LipsToneFurPattern: 100 }, 'swatch.slotError.midRangeIndex'],
      ['hair', { HairTone: 200 }, 'swatch.slotError.indexOutOfRange'],
      [
        'lip',
        { Race: undefined, Tribe: undefined, LipsToneFurPattern: 10 },
        'swatch.slotError.noRace',
      ],
      ['hair', { HairTone: 'brown' }, 'swatch.slotError.unknown'],
    ] as const)('%s with %j says %s', async (slot, fields, key) => {
      const { container, onSlotPick } = mountSheet();
      await loadDoc({ ...BASE, ...fields });
      const card = cardFor(container, slot)!;

      expect(t(key)).not.toBe(key);
      expect(card.tagName).toBe('DIV');
      expect(card.textContent).toContain(t(key));
      expect(card.getAttribute('style')).toContain('244, 100, 90');
      card.click();
      expect(onSlotPick).not.toHaveBeenCalled();
    });
  });

  it('draws a gear-only file as eight quiet "not in file" cards', async () => {
    const { container } = mountSheet();
    await loadDoc({
      TypeName: 'Anamnesis Character File',
      Body: { ModelBase: 1, ModelVariant: 1, DyeId: 1, DyeId2: 0 },
    });

    const cards = allCards(container);
    expect(cards).toHaveLength(8);
    for (const card of cards) {
      expect(card.tagName).toBe('DIV');
      expect(card.textContent).toContain(t('swatch.absentNotInFile'));
      expect(card.getAttribute('style')).not.toContain('244, 100, 90');
    }
    expect(headerCount(container)).toBe('0 / 8');
  });

  describe('confirmed colors: matched and pickable', () => {
    it('hands an off-grid pick no grid address, and its own color', async () => {
      const { container, onSlotPick } = mountSheet();
      await loadImported(
        makeImportedCharacter({
          slots: {
            hair: { interpretation: 'offGrid', reason: 'offGrid', displayHex: '#335577' },
            skin: {
              interpretation: 'extendedOnly',
              reason: 'floatOnly',
              index: null,
              indexState: 'absent',
              sheetIndex: null,
              gridAddress: null,
              creatorHex: null,
              displayHex: '#775533',
            },
          },
        })
      );

      for (const [slot, hex] of [
        ['hair', '#335577'],
        ['skin', '#775533'],
      ] as const) {
        const card = cardFor(container, slot)!;
        expect(card.tagName).toBe('BUTTON');
        expect(card.textContent).toContain(t('swatch.offGrid'));
        expect(hasBestDyeRow(card)).toBe(true);
        card.click();
        expect(onSlotPick).toHaveBeenLastCalledWith(hex, expect.any(String), null, slot);
      }
    });

    it('links a grid pick only for a valid creator coordinate', async () => {
      const { container, onSlotPick } = mountSheet();
      await loadDoc({ ...BASE, LEyeColor: 42, HairTone: 5, LipsToneFurPattern: 130, Mouth: 130 });

      cardFor(container, 'leftEye')!.click();
      cardFor(container, 'lip')!.click();

      expect(onSlotPick.mock.calls.map((c) => c[2])).toEqual([
        { paletteBase: 'eyeColors', variant: null, sheetIndex: 42 },
        { paletteBase: 'lipColors', variant: 'light', sheetIndex: 2 },
      ]);
      // Hair has no creator entry without its clan: no link, and not pickable at all.
      await loadDoc({ ...BASE, Tribe: undefined, HairTone: 5 }, 'no-clan.chara');
      expect(cardFor(container, 'hair')!.tagName).toBe('DIV');
    });

    it('marks an index the stored float disagrees with (extendedInactive), but not an ambiguous zero block (D7)', async () => {
      const { container } = mountSheet();
      await loadImported(
        makeImportedCharacter({
          slots: {
            hair: { reason: 'extendedInactive', gridAddress: 'R1·C6' },
            skin: { reason: 'ambiguousZeroBlock', gridAddress: 'R1·C7' },
          },
        })
      );
      const address = (slot: CharaSlotId) =>
        Array.from(cardFor(container, slot)!.querySelectorAll<HTMLElement>('span')).find((s) =>
          s.textContent?.startsWith('R1·')
        )!;

      expect(address('hair').textContent).toBe('R1·C6 *');
      expect(address('hair').title).toBe(t('swatch.indexWinsNote'));
      expect(address('skin').textContent).toBe('R1·C7');
      expect(address('skin').title).toBe('');
    });

    it('shows the corrected eye colors with the eye-swap note', async () => {
      const { container } = mountSheet();
      await loadImported(
        makeImportedCharacter({
          slots: {
            leftEye: {
              correction: 'historicalEyePairSwap',
              extendedHex: '#0000FF',
              effectiveExtendedHex: '#FF0000',
              displayHex: '#FF0000',
            },
            rightEye: {
              correction: 'historicalEyePairSwap',
              extendedHex: '#FF0000',
              effectiveExtendedHex: '#0000FF',
              displayHex: '#0000FF',
            },
          },
        })
      );

      for (const [slot, rgb] of [
        ['leftEye', 'rgb(255, 0, 0)'],
        ['rightEye', 'rgb(0, 0, 255)'],
      ] as const) {
        const card = cardFor(container, slot)!;
        const noted = card.querySelector<HTMLElement>(`[title="${t('swatch.eyeSwapNote')}"]`);
        expect(noted).not.toBeNull();
        expect(noted!.style.background).toBe(rgb);
      }
      expect(
        cardFor(container, 'hair')!.querySelector(`[title="${t('swatch.eyeSwapNote')}"]`)
      ).toBeNull();
    });

    it('matches, picks and saves a confirmed lip by its composite over the skin (D1)', async () => {
      vi.spyOn(ToastService, 'success').mockImplementation(() => '');
      const { container, onSlotPick } = mountSheet();
      await loadImported(
        makeImportedCharacter({
          slots: [
            makeImportedSlot({
              slot: 'lip',
              displayHex: '#000000',
              lipComposite: { hex: '#FFFFFF', alpha: 0.4, derived: true },
            }),
          ],
        })
      );
      const card = cardFor(container, 'lip')!;

      expect(card.textContent).toContain(
        LanguageService.tInterpolate('swatch.blendTag', { alpha: '0.40' })
      );
      card.click();
      expect(onSlotPick.mock.calls[0]![0]).toBe('#FFFFFF');

      saveCharacterColors(CharaSessionService.getSession()!);
      const saved = CollectionService.getCollections().find((c) => c.kind === 'character')!;
      expect(saved.dyes).toHaveLength(1);
      const dyeHex = dyeService.getByStainId(saved.dyes[0]!)!.hex;
      expect(ColorService.getDistanceForMethod(dyeHex, '#FFFFFF', 'ciede2000')).toBeLessThan(
        ColorService.getDistanceForMethod(dyeHex, '#000000', 'ciede2000')
      );
    });

    it('counts every slot with a preview in the header', async () => {
      const { container } = mountSheet();
      await loadImported(
        makeImportedCharacter({
          slots: {
            hair: absent,
            skin: absent,
            highlights: { active: null, reason: 'activityUnknown', displayHex: '#808080' },
          },
        })
      );
      expect(headerCount(container)).toBe('6 / 8');
    });
  });
});
