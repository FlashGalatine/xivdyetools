/**
 * DYES ON THIS GLAMOUR — Turn 11 (11a Named rows default, 11c Dye-led second
 * lens, Pieces/Dyes toggle, five states). Real services (the suite's
 * LanguageService is initialised with EN in setup.ts); only the resolve
 * round-trip is mocked so each state can be driven deterministically.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GlamourBlock } from '../glamour-block';
import { closeGlamourSheet } from '../glamour-sheet';
import { CharaFileCard } from '../chara-file-card';
import { LanguageService, ModalService, StorageService, ToastService } from '@services/index';
import { CharaSessionService } from '@services/chara-session-service';
import { loadCharaFile } from '@services/chara-file-loader';
import {
  buildGlamourHtml,
  buildGlamourMarkdown,
  buildGlamourPlainText,
} from '@shared/glamour-markdown';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';
import type { CharaResolveResult } from '@services/chara-resolve-service';

const { resolveMock } = vi.hoisted(() => ({ resolveMock: vi.fn() }));
vi.mock('@services/chara-resolve-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/chara-resolve-service')>();
  return { ...actual, resolveCharaEquipment: resolveMock };
});

/**
 * Galatine-shaped fixture: four dyed pieces (five channels, four unique
 * dyes), one worn-undyed piece (Feet), seven empty slots. The off-hand is
 * the bow's quiver (ModelSub); Body is an NPC model with no Item row.
 */
const FIXTURE = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  REyeColor: 42,
  MainHand: { ModelSet: 634, ModelBase: 19, ModelVariant: 1, DyeId: 6, DyeId2: 0 },
  OffHand: { ModelSet: 698, ModelBase: 149, ModelVariant: 1, DyeId: 6, DyeId2: 0 },
  HeadGear: { ModelBase: 361, ModelVariant: 5, DyeId: 1, DyeId2: 0 },
  Body: { ModelBase: 9903, ModelVariant: 1, DyeId: 56, DyeId2: 33 },
  Feet: { ModelBase: 376, ModelVariant: 1, DyeId: 0, DyeId2: 0 },
  Ears: { ModelBase: 0, ModelVariant: 0, DyeId: 0, DyeId2: 0 },
  Glasses: { GlassesId: 0 },
});

/**
 * Show-all fixture: HeadGear dyed on the SECOND channel only (35% of dyed
 * channels are), Body dyed on both, Hands worn-undyed, three accessories
 * worn, Feet empty. Exercises every row class the Show-all switch reveals.
 */
const FIXTURE_ACC = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  REyeColor: 42,
  HeadGear: { ModelBase: 361, ModelVariant: 5, DyeId: 0, DyeId2: 33 },
  Body: { ModelBase: 200, ModelVariant: 1, DyeId: 56, DyeId2: 33 },
  Hands: { ModelBase: 300, ModelVariant: 1, DyeId: 0, DyeId2: 0 },
  Ears: { ModelBase: 12, ModelVariant: 1, DyeId: 0, DyeId2: 0 },
  Neck: { ModelBase: 13, ModelVariant: 1, DyeId: 0, DyeId2: 0 },
  LeftRing: { ModelBase: 14, ModelVariant: 1, DyeId: 0, DyeId2: 0 },
  Glasses: { GlassesId: 0 },
});

/**
 * Earrings the file says carry a channel-2 dye. No FFXIV accessory takes a
 * dye, but the block shows what a file states rather than dropping it.
 */
const FIXTURE_DYED_ACC = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  REyeColor: 42,
  Body: { ModelBase: 200, ModelVariant: 1, DyeId: 56, DyeId2: 0 },
  Ears: { ModelBase: 12, ModelVariant: 1, DyeId: 0, DyeId2: 33 },
  Glasses: { GlassesId: 0 },
});

/** Body dyed on both channels plus facewear — drives the Glasses row. */
const FIXTURE_GLASSES = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  REyeColor: 42,
  Body: { ModelBase: 200, ModelVariant: 1, DyeId: 56, DyeId2: 33 },
  Glasses: { GlassesId: 5 },
});

const glassesResolved = (en: string): CharaResolveResult => ({
  ...RESOLVED,
  glasses: { id: 5, names: { en, ja: en, de: en, fr: en }, iconId: 51000 },
});

/**
 * Facewear and nothing else — no gear model, no dye, just glasses.
 *
 * The block gate counted `gearDyes` and `gearModels` only, so this rendered no
 * block at all and the facewear row the block had just gained was unreachable
 * for exactly the character made of nothing but facewear.
 */
const FIXTURE_GLASSES_ONLY = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  REyeColor: 42,
  Glasses: { GlassesId: 5 },
});

/** Worn but wholly undyed — the glamour that had no block at all before. */
const FIXTURE_NO_DYE = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  REyeColor: 42,
  Body: { ModelBase: 200, ModelVariant: 1, DyeId: 0, DyeId2: 0 },
  Ears: { ModelBase: 12, ModelVariant: 1, DyeId: 0, DyeId2: 0 },
  Glasses: { GlassesId: 0 },
});

/** One piece dyed on one channel: every count in the header is 1 (I18N-007). */
const FIXTURE_ONE_DYE = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  REyeColor: 42,
  Body: { ModelBase: 200, ModelVariant: 1, DyeId: 56, DyeId2: 0 },
  Glasses: { GlassesId: 0 },
});

const BOW = {
  itemId: 49486,
  names: {
    en: 'Runaway Bow',
    ja: '逃走の弓',
    de: 'Geistergleis-Bogen',
    fr: 'Arc de Glasya-Labolas',
  },
  iconId: 32065,
  familySize: 1,
  alternates: [],
  viaMainHand: false,
};
const RESOLVED: CharaResolveResult = {
  items: {
    MainHand: BOW,
    OffHand: { ...BOW, viaMainHand: true },
    HeadGear: {
      itemId: 18085,
      names: {
        en: 'Beech Mask of Casting',
        ja: 'ビーチキャスターマスク',
        de: 'Buchenmaske der Magie',
        fr: 'Masque',
      },
      iconId: 41716,
      familySize: 3,
      alternates: [
        {
          itemId: 18090,
          names: { en: 'Beech Mask of Casting Replica', ja: 'x', de: 'x', fr: 'x' },
        },
      ],
      viaMainHand: false,
    },
    Body: null,
  },
  glasses: null,
  version: 'test',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Everything `mount` built. The session is app-wide, so each test tears it all down. */
const mounted: Array<{ destroy(): void }> = [];

afterEach(() => {
  for (const component of mounted.splice(0)) component.destroy();
  CharaSessionService.setSession(null);
});

async function mount(pending: Promise<CharaResolveResult>, fixture: string = FIXTURE) {
  resolveMock.mockReturnValue(pending);
  const container = createTestContainer('chara-host');
  const glamour = createTestContainer('chara-glamour');
  // The file card carries SWAP; the block draws whatever the session holds.
  const card = new CharaFileCard(container);
  card.init();
  const block = new GlamourBlock(glamour);
  block.init();
  mounted.push(card, block);
  // loadCharaFile is the drop/choose handler's only job; drive it directly so
  // the test is deterministic (jsdom's File lacks text() on some versions).
  const file = new File([fixture], 'galatine.chara', { type: 'application/json' });
  if (typeof (file as Blob).text !== 'function') {
    (file as unknown as { text: () => Promise<string> }).text = () => Promise.resolve(fixture);
  }
  await loadCharaFile(file);
  return { block, container, glamour };
}

const block = (glamour: HTMLElement) =>
  glamour.querySelector<HTMLElement>('[data-role="glamour-block"]')!;

describe('GlamourBlock — DYES ON THIS GLAMOUR (Turn 11)', () => {
  let hosts: HTMLElement[] = [];

  beforeEach(() => {
    resolveMock.mockReset();
    localStorage.clear();
  });
  afterEach(() => {
    hosts.forEach(cleanupTestContainer);
    hosts = [];
  });

  it('RESOLVING: renders the dyes from the file first, with a skeleton where each name lands', async () => {
    const pending = deferred<CharaResolveResult>();
    const { container, glamour } = await mount(pending.promise);
    hosts = [container, glamour];

    expect(resolveMock).toHaveBeenCalledTimes(1);
    const [gear, glassesId] = resolveMock.mock.calls[0];
    expect(gear.map((m: { slot: string }) => m.slot)).toEqual([
      'MainHand',
      'OffHand',
      'HeadGear',
      'Body',
      'Feet',
    ]);
    expect(glassesId).toBeNull();

    const rows = block(glamour).querySelectorAll('[data-role="piece-rows"] > [data-slot]');
    expect(Array.from(rows).map((r) => (r as HTMLElement).dataset.slot)).toEqual([
      'MainHand',
      'OffHand',
      'HeadGear',
      'Body',
    ]);
    expect(block(glamour).querySelectorAll('[data-role="name-skeleton"]')).toHaveLength(4);
    expect(block(glamour).querySelectorAll('[data-role="item-name"]')).toHaveLength(0);
    // Five chips: one per dyed channel (Body carries two).
    expect(
      rows[3].querySelectorAll('span[title*="·"], span[title^="#"]').length
    ).toBeGreaterThanOrEqual(2);
    // The slot tag is localised (en.json gearSlot.*), not the raw key.
    expect(rows[0].textContent).toContain('Main Hand');
    expect(rows[0].textContent).not.toContain('MainHand');
  });

  it('11a: names land in place — lang attr, +N badge with alternates, off-hand via the main weapon, MODEL key for no item row, icon tiles', async () => {
    const pending = deferred<CharaResolveResult>();
    const { container, glamour } = await mount(pending.promise);
    hosts = [container, glamour];

    pending.resolve(RESOLVED);
    await vi.waitFor(() => {
      expect(block(glamour).querySelectorAll('[data-role="item-name"]').length).toBe(3);
    });

    const row = (slot: string) =>
      block(glamour).querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
    const main = row('MainHand').querySelector<HTMLElement>('[data-role="item-name"]')!;
    expect(main.textContent).toBe('Runaway Bow');
    expect(main.lang).toBe('en');
    // Quiver = the bow's own ModelSub — same item, no suffix (Ktisis/Anamnesis/Brio convention)
    expect(row('OffHand').querySelector('[data-role="item-name"]')?.textContent).toBe(
      'Runaway Bow'
    );

    const badge = row('HeadGear').querySelector<HTMLElement>('[data-role="twin-chip"]')!;
    expect(badge.textContent).toBe('+2');
    expect(badge.title).toBe('Same model: Beech Mask of Casting Replica …');
    expect(badge.getAttribute('aria-label')).toBe(
      'Same look as 2 other items: pick the one the list names'
    );
    expect(row('MainHand').querySelector('[data-role="twin-chip"]')).toBeNull();
    // Five dyed channels carrying four unique dyes
    expect(block(glamour).querySelector('[data-role="equip-count"]')?.textContent).toBe(
      '5 channels · 4 dyes'
    );

    // NPC model: the packed key is the honest label — never an error
    expect(row('Body').querySelector('[data-role="item-name"]')).toBeNull();
    expect(row('Body').querySelector('[data-role="model-key"]')?.textContent).toBe('MODEL 9903·1');
    expect(block(glamour).querySelectorAll('[data-role="name-skeleton"]')).toHaveLength(0);

    const tile = row('HeadGear').querySelector<HTMLElement>('[data-role="item-icon"]')!;
    expect(tile.style.backgroundImage).toContain('/v1/chara/icon/41716');
    expect(
      row('Body').querySelector<HTMLElement>('[data-role="item-icon"]')!.style.backgroundImage
    ).toBe('');

    // Footnote splits worn-undyed (Feet) from empty (12 − 5)
    expect(block(glamour).querySelector('[data-role="glamour-foot"]')?.textContent).toBe(
      '1 worn piece is undyed (DyeId 0) · 7 slots are empty.'
    );
    expect(block(glamour).querySelector('[data-role="names-unavailable"]')).toBeNull();
  });

  /**
   * I18N-007: these counts were passed into one plural string, so a single
   * channel read "1 channels · 1 dyes" and a pair of twins "Same look as 1
   * other items". Each count now picks its key by the locale's plural rule.
   */
  it('takes the singular at one: 1 channel · 1 dye', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED), FIXTURE_ONE_DYE);
    hosts = [container, glamour];

    expect(block(glamour).querySelector('[data-role="equip-count"]')?.textContent).toBe(
      '1 channel · 1 dye'
    );
    expect(block(glamour).querySelector('[data-role="glamour-foot"]')?.textContent).toBe(
      '0 worn pieces are undyed (DyeId 0) · 11 slots are empty.'
    );
  });

  it('names a pair of twins in the singular: "Same look as 1 other item"', async () => {
    const pair: CharaResolveResult = {
      ...RESOLVED,
      items: { ...RESOLVED.items, HeadGear: { ...RESOLVED.items.HeadGear!, familySize: 2 } },
    };
    const { container, glamour } = await mount(Promise.resolve(pair));
    hosts = [container, glamour];
    const chip = () =>
      block(glamour).querySelector<HTMLElement>('[data-slot="HeadGear"] [data-role="twin-chip"]');
    await vi.waitFor(() => expect(chip()).not.toBeNull());

    expect(chip()!.textContent).toBe('+1');
    expect(chip()!.getAttribute('aria-label')).toBe(
      'Same look as 1 other item: pick the one the list names'
    );
  });

  it("picks the footnote's form by the locale plural rule, so French 0 takes the singular", async () => {
    await LanguageService.setLocale('fr');
    const spy = vi.spyOn(LanguageService, 'tInterpolate');
    try {
      const { container, glamour } = await mount(Promise.resolve(RESOLVED), FIXTURE_ONE_DYE);
      hosts = [container, glamour];
      await vi.waitFor(() => {
        expect(block(glamour).querySelector('[data-role="glamour-foot"]')).not.toBeNull();
      });
      // fr: 0 and 1 are both `one`; the count is filled in, never a literal 1
      expect(spy).toHaveBeenCalledWith('swatch.footWornUndyed_one', { n: '0' });
      expect(spy).toHaveBeenCalledWith('swatch.footEmpty_other', { n: '11' });
      expect(spy).toHaveBeenCalledWith('swatch.equipChannels_one', { n: '1' });
      expect(spy).toHaveBeenCalledWith('swatch.equipDyes_one', { n: '1' });
    } finally {
      spy.mockRestore();
      await LanguageService.setLocale('en');
    }
  });

  it('NAMES UNAVAILABLE: falls back to the shipped row plus one quiet line — dyes untouched', async () => {
    const pending = deferred<CharaResolveResult>();
    const { container, glamour } = await mount(pending.promise);
    hosts = [container, glamour];

    pending.reject(new Error('api-worker answered 503'));
    await vi.waitFor(() => {
      expect(block(glamour).querySelector('[data-role="names-unavailable"]')).not.toBeNull();
    });
    expect(block(glamour).querySelectorAll('[data-role="name-skeleton"]')).toHaveLength(0);
    expect(block(glamour).querySelectorAll('[data-role="item-name"]')).toHaveLength(0);
    expect(block(glamour).querySelectorAll('[data-role="model-key"]')).toHaveLength(0);
    // Rows and chips are still there — the file's stains never waited on the network.
    expect(block(glamour).querySelectorAll('[data-role="piece-rows"] > [data-slot]')).toHaveLength(
      4
    );
    expect(block(glamour).querySelector('[data-role="glamour-foot"]')?.textContent).toContain(
      '7 slots are empty'
    );
  });

  it('11c: the Dyes lens shows one row per unique dye with carriers as icons and ×N, and persists', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    await vi.waitFor(() => {
      expect(block(glamour).querySelectorAll('[data-role="item-name"]').length).toBe(3);
    });

    const dyesBtn = block(glamour).querySelector<HTMLButtonElement>(
      'button[data-glamour-view="dyes"]'
    )!;
    expect(dyesBtn.getAttribute('aria-pressed')).toBe('false');
    dyesBtn.click();

    const rows = block(glamour).querySelectorAll<HTMLElement>(
      '[data-role="dye-rows"] > [data-stain-id]'
    );
    expect(Array.from(rows).map((r) => r.dataset.stainId)).toEqual(['6', '1', '56', '33']);
    // Stain 6 is worn on both hands — two carriers, ×2
    const six = rows[0];
    const carriers = six.querySelectorAll<HTMLElement>('[data-role="carrier"]');
    expect(Array.from(carriers).map((c) => c.dataset.slot)).toEqual(['MainHand', 'OffHand']);
    expect(carriers[0].title).toBe('MAIN HAND — Runaway Bow');
    expect(carriers[0].style.backgroundImage).toContain('/v1/chara/icon/32065');
    expect(six.textContent).toContain('×2');
    expect(six.textContent).toContain('ID 6');
    // Body's two channels are two rows (56, 33), each ×1 (blank count)
    expect(rows[2].textContent).not.toContain('×');
    // Body has no item: the carrier keeps the slot label alone
    expect(rows[2].querySelector<HTMLElement>('[data-role="carrier"]')!.title).toBe('BODY');

    expect(
      block(glamour).querySelector('button[data-glamour-view="dyes"]')?.getAttribute('aria-pressed')
    ).toBe('true');
    expect(StorageService.getItem<string>('xivdyetools_swatch_glamour_view')).toBe('dyes');
  });

  it('opens in the persisted lens', async () => {
    StorageService.setItem('xivdyetools_swatch_glamour_view', 'dyes');
    const { container, glamour } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    expect(block(glamour).querySelector('[data-role="dye-rows"]')).not.toBeNull();
    expect(block(glamour).querySelector('[data-role="piece-rows"]')).toBeNull();
  });

  it('moveTo redraws the block in a new container, keeping its names and palette draft', async () => {
    const { block, container, glamour } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    const makePalette = Array.from(glamour.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Make a palette')
    )!;
    makePalette.click();
    const name = glamour.querySelector<HTMLInputElement>('input[type="text"]')!;
    name.value = 'Sunset set';
    name.dispatchEvent(new Event('input'));
    const next = createTestContainer('chara-glamour-next');
    hosts.push(next);

    block.moveTo(next);

    expect(glamour.childElementCount).toBe(0);
    expect(next.querySelector<HTMLInputElement>('input[type="text"]')?.value).toBe('Sunset set');
    expect(next.querySelector('[data-slot="HeadGear"] [data-role="item-name"]')?.textContent).toBe(
      'Beech Mask of Casting'
    );
    // The names came along: moving is not a new lookup.
    expect(resolveMock).toHaveBeenCalledTimes(1);
  });

  it('SWAP aborts an in-flight resolve and the late answer never renders', async () => {
    const pending = deferred<CharaResolveResult>();
    const { container, glamour } = await mount(pending.promise);
    hosts = [container, glamour];
    const swap = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'SWAP'
    )!;
    swap.click();
    expect(glamour.querySelector('[data-role="glamour-block"]')).toBeNull();
    pending.resolve(RESOLVED);
    await new Promise((r) => setTimeout(r, 0));
    expect(glamour.querySelector('[data-role="glamour-block"]')).toBeNull();
  });
});

/**
 * Show all pieces — the second axis of the Pieces lens. The block's unit
 * stops being "a dyed channel" and becomes "a piece the character wears":
 * worn-undyed armour and the five accessory slots (which no FFXIV item can
 * dye) get rows. Chips became positional in the same change: a dyeable slot
 * always shows channel 1 then channel 2, with a neutral chip standing in for
 * an undyed channel, so chip position reads as DyeId / DyeId2 everywhere.
 */
describe('GlamourBlock — Show all pieces', () => {
  let hosts: HTMLElement[] = [];

  beforeEach(() => {
    resolveMock.mockReset();
    localStorage.clear();
  });
  afterEach(() => {
    hosts.forEach(cleanupTestContainer);
    hosts = [];
  });

  const rowsOf = (glamour: HTMLElement) =>
    Array.from(
      block(glamour).querySelectorAll<HTMLElement>('[data-role="piece-rows"] > [data-slot]')
    );
  const switchOf = (glamour: HTMLElement) =>
    block(glamour).querySelector<HTMLButtonElement>('[data-role="show-all-switch"]')!;
  const chipsOf = (row: HTMLElement) =>
    Array.from(
      row.querySelectorAll<HTMLElement>('[data-role="dye-chip"], [data-role="undyed-chip"]')
    );

  it('is off by default and leaves the dyed-only row set alone', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED), FIXTURE_ACC);
    hosts = [container, glamour];

    expect(switchOf(glamour).getAttribute('aria-checked')).toBe('false');
    expect(rowsOf(glamour).map((r) => r.dataset.slot)).toEqual(['HeadGear', 'Body']);
  });

  it('chips are positional even with the switch off — channel 1 then channel 2, neutral for undyed', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED), FIXTURE_ACC);
    hosts = [container, glamour];

    // HeadGear carries DyeId2 only: the FIRST chip is the neutral placeholder.
    const head = chipsOf(rowsOf(glamour)[0]);
    expect(head.map((c) => c.dataset.channel)).toEqual(['1', '2']);
    expect(head.map((c) => c.dataset.role)).toEqual(['undyed-chip', 'dye-chip']);

    // Body carries both — two real chips, no placeholder.
    const body = chipsOf(rowsOf(glamour)[1]);
    expect(body.map((c) => c.dataset.role)).toEqual(['dye-chip', 'dye-chip']);
  });

  it('turning it on adds worn-undyed armour and accessories, in file slot order, and never empty slots', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED), FIXTURE_ACC);
    hosts = [container, glamour];

    switchOf(glamour).click();

    expect(rowsOf(glamour).map((r) => r.dataset.slot)).toEqual([
      'HeadGear',
      'Body',
      'Hands',
      'Ears',
      'Neck',
      'LeftRing',
    ]);
    // Feet, Legs, weapons, Wrists and RightRing are unworn — the footnote's job.
    expect(block(glamour).querySelector('[data-slot="Feet"]')).toBeNull();
    expect(switchOf(glamour).getAttribute('aria-checked')).toBe('true');
    expect(StorageService.getItem<string>('xivdyetools_swatch_glamour_show_all')).toBe('on');
  });

  it('accessories get no chips at all — no FFXIV accessory is dyeable', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED), FIXTURE_ACC);
    hosts = [container, glamour];
    switchOf(glamour).click();

    for (const slot of ['Ears', 'Neck', 'LeftRing']) {
      const row = block(glamour).querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
      expect(chipsOf(row)).toHaveLength(0);
      expect(row.querySelector('[data-role="dye-line"]')?.textContent).toBe('Undyed');
    }
    // Worn-undyed ARMOUR still gets its two neutral chips.
    const hands = block(glamour).querySelector<HTMLElement>('[data-slot="Hands"]')!;
    expect(chipsOf(hands).map((c) => c.dataset.role)).toEqual(['undyed-chip', 'undyed-chip']);
    expect(hands.querySelector('[data-role="dye-line"]')?.textContent).toBe('Undyed');
  });

  it('an accessory the file says is dyed shows what the file says, with no positional stand-in', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED), FIXTURE_DYED_ACC);
    hosts = [container, glamour];

    // A dyeable slot dyed on channel 2 only would draw a neutral chip in
    // channel 1's place; an accessory draws just the channel the file states.
    const ears = block(glamour).querySelector<HTMLElement>('[data-slot="Ears"]')!;
    expect(chipsOf(ears).map((c) => [c.dataset.role, c.dataset.channel])).toEqual([
      ['dye-chip', '2'],
    ]);
    const line = ears.querySelector('[data-role="dye-line"]')!.textContent!;
    expect(line).not.toBe('');
    expect(line).not.toContain('Undyed');
  });

  it('a half-dyed piece names the empty channel rather than hiding it', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED), FIXTURE_ACC);
    hosts = [container, glamour];

    const line = rowsOf(glamour)[0].querySelector('[data-role="dye-line"]')!.textContent!;
    expect(line).toMatch(/^Undyed \+ .+/);
    expect(line).not.toBe('Undyed');
  });

  it('opens in the persisted state', async () => {
    StorageService.setItem('xivdyetools_swatch_glamour_show_all', 'on');
    const { container, glamour } = await mount(Promise.resolve(RESOLVED), FIXTURE_ACC);
    hosts = [container, glamour];
    expect(rowsOf(glamour)).toHaveLength(6);
  });

  it('is inert in the Dyes lens, which has no undyed unit to show', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED), FIXTURE_ACC);
    hosts = [container, glamour];

    expect(switchOf(glamour).disabled).toBe(false);
    block(glamour).querySelector<HTMLButtonElement>('button[data-glamour-view="dyes"]')!.click();
    expect(switchOf(glamour).disabled).toBe(true);
    expect(block(glamour).querySelector('[data-role="dye-rows"]')).not.toBeNull();
  });

  it('facewear gets a row under the switch only, tinted from the colour word in its name', async () => {
    const { container, glamour } = await mount(
      Promise.resolve(glassesResolved('Silver Spectacles')),
      FIXTURE_GLASSES
    );
    hosts = [container, glamour];
    // Body is an NPC model with no Item row, so the MODEL key — not a name —
    // is this fixture's "the resolve landed" signal.
    await vi.waitFor(() => {
      expect(block(glamour).querySelector('[data-role="model-key"]')).not.toBeNull();
    });

    // Facewear carries no dye, so it stays out of the dyed-only view.
    expect(block(glamour).querySelector('[data-slot="Facewear"]')).toBeNull();
    switchOf(glamour).click();

    const row = block(glamour).querySelector<HTMLElement>('[data-slot="Facewear"]')!;
    expect(row.querySelector('[data-role="item-name"]')?.textContent).toBe('Silver Spectacles');
    expect(
      row.querySelector<HTMLElement>('[data-role="item-icon"]')!.style.backgroundImage
    ).toContain('/v1/chara/icon/51000');
    const chip = row.querySelector<HTMLElement>('[data-role="facewear-chip"]')!;
    expect(chip.dataset.facewearColor).toBe('silver');
    expect(chip.title).toBe('Silver · facewear color');
    expect(row.querySelector('[data-role="dye-line"]')?.textContent).toBe('Silver');
    // It is facewear, not a dye channel — never a dye chip.
    expect(row.querySelector('[data-role="dye-chip"]')).toBeNull();
  });

  // HC-003: the tooltip passed core's English name ("Silver") into the
  // localized tag, while the line under the name already used the locale's.
  it("names the facewear colour in the chip tooltip in the reader's language", async () => {
    await LanguageService.setLocale('de');
    try {
      const { container, glamour } = await mount(
        Promise.resolve(glassesResolved('Silver Spectacles')),
        FIXTURE_GLASSES
      );
      hosts = [container, glamour];
      await vi.waitFor(() => {
        expect(block(glamour).querySelector('[data-role="model-key"]')).not.toBeNull();
      });
      switchOf(glamour).click();

      const row = block(glamour).querySelector<HTMLElement>('[data-slot="Facewear"]')!;
      const chip = row.querySelector<HTMLElement>('[data-role="facewear-chip"]')!;
      expect(LanguageService.getFacewearColorName('silver')).toBe('Silber');
      expect(chip.title).toContain('Silber');
      expect(chip.title).not.toContain('Silver');
      // The line under the name and the tooltip name the colour alike
      expect(row.querySelector('[data-role="dye-line"]')?.textContent).toBe('Silber');
    } finally {
      await LanguageService.setLocale('en');
    }
  });

  /**
   * 2026-09-03 review: the block gate counted `gearDyes` and `gearModels` only.
   * A `.chara` carrying nothing but facewear therefore rendered no block, so
   * the facewear row this feature had just added was unreachable for exactly
   * the character it most needed to describe — `startResolve` still fetched
   * the glasses and still threw the answer away, as before the row existed.
   */
  it('a facewear-only glamour gets the block, and its facewear row', async () => {
    const { container, glamour } = await mount(
      Promise.resolve(glassesResolved('Silver Spectacles')),
      FIXTURE_GLASSES_ONLY
    );
    hosts = [container, glamour];

    // The block exists at all — this is the assertion that was failing.
    expect(block(glamour)).not.toBeNull();

    await vi.waitFor(() => {
      expect(block(glamour).querySelector('[data-slot="Facewear"]')).toBeNull();
    });
    switchOf(glamour).click();

    await vi.waitFor(() => {
      const row = block(glamour).querySelector<HTMLElement>('[data-slot="Facewear"]');
      expect(row).not.toBeNull();
      expect(row!.querySelector('[data-role="item-name"]')?.textContent).toBe('Silver Spectacles');
    });
  });

  it('facewear whose name carries no colour word stays neutral rather than guessing', async () => {
    const { container, glamour } = await mount(
      Promise.resolve(glassesResolved('Kupo Nut Shades')),
      FIXTURE_GLASSES
    );
    hosts = [container, glamour];
    // Body is an NPC model with no Item row, so the MODEL key — not a name —
    // is this fixture's "the resolve landed" signal.
    await vi.waitFor(() => {
      expect(block(glamour).querySelector('[data-role="model-key"]')).not.toBeNull();
    });
    switchOf(glamour).click();

    const row = block(glamour).querySelector<HTMLElement>('[data-slot="Facewear"]')!;
    expect(row.querySelector('[data-role="facewear-chip"]')).toBeNull();
    expect(row.querySelector('[data-role="undyed-chip"]')).not.toBeNull();
    expect(row.querySelector('[data-role="dye-line"]')?.textContent).toBe('Facewear color unknown');
  });

  it('no facewear row when the file wears none', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED), FIXTURE_ACC);
    hosts = [container, glamour];
    switchOf(glamour).click();
    expect(block(glamour).querySelector('[data-slot="Facewear"]')).toBeNull();
  });

  it('a wholly undyed glamour still renders the block, so the switch is reachable', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED), FIXTURE_NO_DYE);
    hosts = [container, glamour];

    expect(block(glamour)).not.toBeNull();
    expect(block(glamour).querySelector('[data-role="no-dyed-pieces"]')).not.toBeNull();
    expect(rowsOf(glamour)).toHaveLength(0);

    switchOf(glamour).click();
    expect(block(glamour).querySelector('[data-role="no-dyed-pieces"]')).toBeNull();
    expect(rowsOf(glamour).map((r) => r.dataset.slot)).toEqual(['Body', 'Ears']);
  });
});

/**
 * The GPOSERS list — Copy list and Save .md in the block head. Both write
 * the worn glamour in the template's fixed order, whatever lens or switch is
 * showing, and wait for names to land before they go live. Copy puts real
 * bold on the clipboard (HTML) with a plain flavour beside it; the .md
 * download keeps Markdown.
 */
describe('GlamourBlock — Copy list / Save .md', () => {
  let hosts: HTMLElement[] = [];
  let write: ReturnType<typeof vi.fn>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let clicked: HTMLAnchorElement[];

  /**
   * jsdom has no ClipboardItem; this stand-in just keeps what it was given —
   * a promise per flavour, since the content lands after the chunk loads.
   */
  class FakeClipboardItem {
    constructor(public readonly items: Record<string, Blob | Promise<Blob>>) {}
  }

  // Globals this block redefines, restored after each test so nothing below
  // inherits a clipboard that rejects or an execCommand that returns false.
  const saved = {
    clipboard: Object.getOwnPropertyDescriptor(navigator, 'clipboard'),
    clipboardItem: Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem'),
    createObjectURL: Object.getOwnPropertyDescriptor(URL, 'createObjectURL'),
    revokeObjectURL: Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL'),
    execCommand: Object.getOwnPropertyDescriptor(document, 'execCommand'),
  };
  const restore = (
    target: object,
    key: string,
    descriptor: PropertyDescriptor | undefined
  ): void => {
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else delete (target as Record<string, unknown>)[key];
  };

  const copyBtn = (glamour: HTMLElement) =>
    block(glamour).querySelector<HTMLButtonElement>('[data-role="copy-list"]')!;
  const exportBtn = (glamour: HTMLElement) =>
    block(glamour).querySelector<HTMLButtonElement>('[data-role="export-markdown"]')!;
  const sheetEl = () => document.querySelector<HTMLElement>('[data-role="glamour-sheet"]');
  /** Copy list opens the export sheet (design 2c); its own Copy list writes. */
  const copyVia = async (glamour: HTMLElement): Promise<void> => {
    copyBtn(glamour).click();
    await vi.waitFor(() => expect(sheetEl()).not.toBeNull());
    sheetEl()!.querySelector<HTMLButtonElement>('[data-role="sheet-copy"]')!.click();
  };
  /** The block's Save .md opens the export sheet; the sheet's Save .md downloads. */
  const exportVia = async (glamour: HTMLElement): Promise<void> => {
    exportBtn(glamour).click();
    await vi.waitFor(() => expect(sheetEl()).not.toBeNull());
    sheetEl()!.querySelector<HTMLButtonElement>('[data-role="sheet-save"]')!.click();
  };

  /** The flavours the last copy put on the clipboard, once they have landed. */
  const copied = async (): Promise<{ html: string; text: string }> => {
    const [items] = write.mock.calls[0] as [FakeClipboardItem[]];
    return {
      html: await (await items[0].items['text/html']).text(),
      text: await (await items[0].items['text/plain']).text(),
    };
  };

  /**
   * What FIXTURE + RESOLVED must write: the five worn slots only, names where
   * known, dyes only where a channel is dyed, Feet worn-undyed with no item.
   */
  const EXPECTED_INPUT = {
    MainHand: { name: 'Runaway Bow', dye1: 'Soot Black' },
    OffHand: { name: 'Runaway Bow', dye1: 'Soot Black' },
    HeadGear: { name: 'Beech Mask of Casting', dye1: 'Snow White' },
    Body: { dye1: 'Deepwood Green', dye2: 'Loam Brown' },
    Feet: {},
  };
  const EXPECTED_TEXT = buildGlamourPlainText(EXPECTED_INPUT);
  const EXPECTED_HTML = buildGlamourHtml(EXPECTED_INPUT);
  const EXPECTED_MARKDOWN = buildGlamourMarkdown(EXPECTED_INPUT);

  beforeEach(() => {
    resolveMock.mockReset();
    localStorage.clear();
    write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write, writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      writable: true,
      value: FakeClipboardItem,
    });
    clicked = [];
    createObjectURL = vi.fn().mockReturnValue('blob:glamour');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clicked.push(this);
    });
    vi.spyOn(ToastService, 'success').mockImplementation(() => 'toast');
    vi.spyOn(ToastService, 'error').mockImplementation(() => 'toast');
  });
  afterEach(() => {
    closeGlamourSheet();
    hosts.forEach(cleanupTestContainer);
    hosts = [];
    vi.restoreAllMocks();
    restore(navigator, 'clipboard', saved.clipboard);
    restore(globalThis, 'ClipboardItem', saved.clipboardItem);
    restore(URL, 'createObjectURL', saved.createObjectURL);
    restore(URL, 'revokeObjectURL', saved.revokeObjectURL);
    restore(document, 'execCommand', saved.execCommand);
  });

  it('renders both actions in the block head, disabled until names have landed', async () => {
    const pending = deferred<CharaResolveResult>();
    const { container, glamour } = await mount(pending.promise);
    hosts = [container, glamour];

    expect(copyBtn(glamour).textContent).toBe('Copy list');
    expect(exportBtn(glamour).textContent).toBe('Save .md');
    expect(copyBtn(glamour).disabled).toBe(true);
    expect(exportBtn(glamour).disabled).toBe(true);

    pending.resolve(RESOLVED);
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));
    expect(exportBtn(glamour).disabled).toBe(false);
  });

  it('Copy list and Save .md open the export sheet before anything is copied or saved (design 2c)', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));

    copyBtn(glamour).click();
    await vi.waitFor(() => expect(sheetEl()).not.toBeNull());
    expect(write).not.toHaveBeenCalled();
    expect(sheetEl()!.textContent).toContain('Glamour list');
    closeGlamourSheet();

    exportBtn(glamour).click();
    await vi.waitFor(() => expect(sheetEl()).not.toBeNull());
    expect(clicked).toHaveLength(0);
  });

  it('destroying the block closes its export sheet, so the sheet never outlives the reader', async () => {
    const { container, glamour, block: glamourBlock } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));
    copyBtn(glamour).click();
    await vi.waitFor(() => expect(sheetEl()).not.toBeNull());

    glamourBlock.destroy();

    expect(sheetEl()).toBeNull();
    expect(ModalService.hasOpenModals()).toBe(false);
  });

  it('a sheet still loading when the block is destroyed never opens', async () => {
    const { container, glamour, block: glamourBlock } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));

    copyBtn(glamour).click();
    glamourBlock.destroy();
    await vi.dynamicImportSettled();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sheetEl()).toBeNull();
  });

  it('closing the sheet gives focus back to the button that opened it', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));
    // A click does not focus a button in Safari (nor in jsdom), so the block
    // hands the sheet its opener instead of leaving it to document.activeElement.
    copyBtn(glamour).click();
    await vi.waitFor(() => expect(sheetEl()).not.toBeNull());

    closeGlamourSheet();

    expect(document.activeElement).toBe(copyBtn(glamour));
  });

  it('copies the worn slots as plain text with no Markdown syntax — names where known, dyes only where dyed — then confirms', async () => {
    // The file names its character; the submission form must never carry it.
    const named = JSON.stringify({ ...JSON.parse(FIXTURE), Nickname: 'Galatine Ashe' });
    const { container, glamour } = await mount(Promise.resolve(RESOLVED), named);
    hosts = [container, glamour];
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));

    await copyVia(glamour);
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));

    const { text, html } = await copied();
    expect(text).toBe(
      [
        'Glamour Items:',
        'Main Hand: Runaway Bow',
        'Dye 1: Soot Black',
        'Acquisition:',
        '',
        'Off Hand: Runaway Bow',
        'Dye 1: Soot Black',
        'Acquisition:',
        '',
        'Head: Beech Mask of Casting',
        'Dye 1: Snow White',
        'Acquisition:',
        '',
        'Body:',
        'Dye 1: Deepwood Green',
        'Dye 2: Loam Brown',
        'Acquisition:',
        '',
        'Feet:',
        'Acquisition:',
        '',
      ].join('\n')
    );
    expect(text).toBe(EXPECTED_TEXT);
    expect(text).not.toContain('*');
    expect(text).not.toContain('Galatine');
    expect(html).not.toContain('Galatine');
    await vi.waitFor(() =>
      expect(ToastService.success).toHaveBeenCalledWith('Glamour list copied to clipboard')
    );
    expect(clicked).toHaveLength(0);
  });

  it("starts the clipboard write inside the sheet's Copy click", async () => {
    // WebKit (Safari, every iOS browser) refuses a clipboard write once the
    // click's activation has lapsed. The sheet is loaded before its button
    // exists, so the write must already be under way when that click's
    // handler returns — asserted with nothing awaited in between.
    const { container, glamour } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));

    copyBtn(glamour).click();
    await vi.waitFor(() => expect(sheetEl()).not.toBeNull());
    sheetEl()!.querySelector<HTMLButtonElement>('[data-role="sheet-copy"]')!.click();
    expect(write).toHaveBeenCalledTimes(1);

    expect((await copied()).text).toBe(EXPECTED_TEXT);
    await vi.waitFor(() =>
      expect(ToastService.success).toHaveBeenCalledWith('Glamour list copied to clipboard')
    );
  });

  it('copies real bold beside the plain text, so Word and Google Docs keep the slot labels bold', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));

    await copyVia(glamour);
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));

    const { html } = await copied();
    expect(html).toBe(EXPECTED_HTML);
    expect(html).toContain('<strong>Main Hand:</strong> Runaway Bow<br>Dye 1: Soot Black');
    expect(html).toContain('<p><strong>Feet:</strong><br>Acquisition:</p>');
    expect(html).not.toContain('**');
  });

  it('exports Markdown as glamour-equipment.md, with no character name in the file name', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    await vi.waitFor(() => expect(exportBtn(glamour).disabled).toBe(false));

    await exportVia(glamour);

    await vi.waitFor(() => expect(clicked).toHaveLength(1));
    expect(clicked[0].download).toBe('glamour-equipment.md');
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/markdown');
    await expect(blob.text()).resolves.toBe(EXPECTED_MARKDOWN);
    expect(await blob.text()).toContain(
      '**Main Hand:** Runaway Bow\nDye 1: Soot Black\nAcquisition:'
    );
    expect(write).not.toHaveBeenCalled();
    expect(ToastService.error).not.toHaveBeenCalled();
  });

  it('reports a failed export rather than a silent one', async () => {
    createObjectURL.mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const { container, glamour } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    await vi.waitFor(() => expect(exportBtn(glamour).disabled).toBe(false));

    await exportVia(glamour);

    await vi.waitFor(() =>
      expect(ToastService.error).toHaveBeenCalledWith("Couldn't save the Glamour list")
    );
    expect(clicked).toHaveLength(0);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('writes the full glamour regardless of the lens or the Show all switch', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));

    block(glamour).querySelector<HTMLButtonElement>('[data-glamour-view="dyes"]')!.click();
    await copyVia(glamour);
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect((await copied()).text).toBe(EXPECTED_TEXT);
  });

  it('names an unknown stain by its id and the facewear by its item name', async () => {
    const { container, glamour } = await mount(
      Promise.resolve(glassesResolved('Silver Spectacles')),
      JSON.stringify({
        TypeName: 'Anamnesis Character File',
        REyeColor: 42,
        Body: { ModelBase: 200, ModelVariant: 1, DyeId: 999, DyeId2: 33 },
        Glasses: { GlassesId: 5 },
      })
    );
    hosts = [container, glamour];
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));

    await copyVia(glamour);
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const { text } = await copied();
    expect(text).toContain('Body:\nDye 1: #999\nDye 2: Loam Brown\nAcquisition:');
    expect(text).toContain('Facewear: Silver Spectacles\nAcquisition:');
  });

  it('keeps a worn slot whose name never arrived — slots and dyes are local — including facewear', async () => {
    const { container, glamour } = await mount(
      Promise.reject(new Error('503')),
      FIXTURE_GLASSES_ONLY
    );
    hosts = [container, glamour];
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));

    await copyVia(glamour);
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect((await copied()).text).toBe('Glamour Items:\nFacewear:\nAcquisition:\n');
  });

  it('still offers both actions when item names are unavailable', async () => {
    const { container, glamour } = await mount(Promise.reject(new Error('503')));
    hosts = [container, glamour];
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));

    await copyVia(glamour);
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect((await copied()).text).toContain('Main Hand:\nDye 1: Soot Black\nAcquisition:');
  });

  it('reports a failed copy rather than a silent one', async () => {
    write.mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(false),
    });
    const { container, glamour } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));

    await copyVia(glamour);
    await vi.waitFor(() =>
      expect(ToastService.error).toHaveBeenCalledWith("Couldn't copy the Glamour list")
    );
    expect(ToastService.success).not.toHaveBeenCalled();
  });
});

describe('GlamourBlock — IN THE GAME (the reader verdict) and twins', () => {
  let hosts: HTMLElement[] = [];

  beforeEach(() => {
    resolveMock.mockReset();
    localStorage.clear();
  });
  afterEach(() => {
    hosts.forEach(cleanupTestContainer);
    hosts = [];
  });

  const rules = (itemIds: number[], dyeCount: number, extra: Record<string, unknown> = {}) => ({
    itemIds,
    dyeCount,
    glamourable: true,
    wearMask: 0xffff,
    grandCompany: 0,
    ...extra,
  });
  const names = (en: string) => ({ en, ja: en, de: en, fr: en });
  const item = (itemId: number, en: string, extra: Record<string, unknown> = {}) => ({
    itemId,
    names: names(en),
    iconId: null,
    familySize: 1,
    alternates: [],
    viaMainHand: false,
    ...extra,
  });
  const verdict = (glamour: HTMLElement) =>
    glamour.querySelector<HTMLElement>('[data-role="verdict"]');
  const counts = (glamour: HTMLElement) =>
    Array.from(verdict(glamour)!.querySelectorAll<HTMLElement>('[data-role="verdict-count"]')).map(
      (c) => c.textContent
    );
  const row = (glamour: HTMLElement, slot: string) =>
    block(glamour).querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
  const part = (glamour: HTMLElement, slot: string, role: string) =>
    row(glamour, slot).querySelector<HTMLElement>(`[data-role="${role}"]`)?.textContent ?? null;

  /** A Midlander woman wearing a head dyed on channel 2 and a body. */
  const MIDLANDER = JSON.stringify({
    TypeName: 'Anamnesis Character File',
    Tribe: 'Midlander',
    Gender: 'Feminine',
    REyeColor: 42,
    HeadGear: { ModelBase: 361, ModelVariant: 5, DyeId: 0, DyeId2: 33 },
    Body: { ModelBase: 200, ModelVariant: 1, DyeId: 56, DyeId2: 0 },
    Glasses: { GlassesId: 0 },
  });
  const COIF = item(372, 'Dated Hempen Coif', {
    familySize: 2,
    alternates: [{ itemId: 2629, names: names('Hempen Coif') }],
    rules: [rules([372], 0), rules([2629], 2)],
  });

  it('says nothing when api-worker answers without rules (an older worker)', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    await vi.waitFor(() =>
      expect(block(glamour).querySelectorAll('[data-role="item-name"]').length).toBe(3)
    );
    expect(verdict(glamour)).toBeNull();
  });

  it('comes first, above ON THIS GLAMOUR', async () => {
    const resolved: CharaResolveResult = {
      items: { HeadGear: COIF, Body: item(200, 'Casting Robe', { rules: [rules([200], 2)] }) },
      glasses: null,
      version: 'test',
    };
    const { container, glamour } = await mount(Promise.resolve(resolved), MIDLANDER);
    hosts = [container, glamour];
    await vi.waitFor(() => expect(verdict(glamour)).not.toBeNull());

    const children = Array.from(block(glamour).children);
    expect(children.indexOf(verdict(glamour)!)).toBe(0);
    expect(verdict(glamour)!.textContent).toContain('IN THE GAME');
    expect(verdict(glamour)!.textContent).toContain('Since 7.4 any job can wear any piece');
  });

  it('names the twin that takes the dye, marks it FIXED BY A TWIN, and says why', async () => {
    const resolved: CharaResolveResult = {
      items: { HeadGear: COIF, Body: item(200, 'Casting Robe', { rules: [rules([200], 2)] }) },
      glasses: null,
      version: 'test',
    };
    const { container, glamour } = await mount(Promise.resolve(resolved), MIDLANDER);
    hosts = [container, glamour];
    await vi.waitFor(() => expect(verdict(glamour)).not.toBeNull());

    expect(part(glamour, 'HeadGear', 'item-name')).toBe('Hempen Coif');
    expect(
      row(glamour, 'HeadGear').querySelector<HTMLElement>('[data-role="twin-chip"]')!.dataset.tone
    ).toBe('fix');
    expect(part(glamour, 'HeadGear', 'piece-tag')).toBe('FIXED BY A TWIN');
    expect(part(glamour, 'HeadGear', 'piece-note')).toBe(
      "Named instead of Dated Hempen Coif, which can't take these dyes"
    );
    // The headline is built from the counts (spec §3)
    expect(verdict(glamour)!.querySelector('[data-role="verdict-head"]')?.textContent).toBe(
      '1 piece named from a twin'
    );
    expect(counts(glamour)).toEqual(['1 FIXED BY A TWIN', '1 FINE AS IS']);
  });

  it('joins the counts into one headline', async () => {
    const resolved: CharaResolveResult = {
      items: {
        HeadGear: COIF,
        Body: item(2967, "Lord's Yukata", { rules: [rules([2967], 1, { wearMask: 0x5555 })] }),
      },
      glasses: null,
      version: 'test',
    };
    const { container, glamour } = await mount(Promise.resolve(resolved), MIDLANDER);
    hosts = [container, glamour];
    await vi.waitFor(() => expect(verdict(glamour)).not.toBeNull());
    expect(verdict(glamour)!.querySelector('[data-role="verdict-head"]')?.textContent).toBe(
      "1 piece named from a twin and 1 piece this character can't wear"
    );
  });

  it('marks a piece nothing fixes as NO FIX, and says why', async () => {
    const viera = JSON.stringify({
      TypeName: 'Anamnesis Character File',
      Tribe: 'Rava',
      Gender: 'Feminine',
      REyeColor: 42,
      Body: { ModelBase: 200, ModelVariant: 1, DyeId: 56, DyeId2: 0 },
    });
    const resolved: CharaResolveResult = {
      items: {
        Body: item(2967, "Lord's Yukata", { rules: [rules([2967], 1, { wearMask: 0x5555 })] }),
      },
      glasses: null,
      version: 'test',
    };
    const { container, glamour } = await mount(Promise.resolve(resolved), viera);
    hosts = [container, glamour];
    await vi.waitFor(() => expect(verdict(glamour)).not.toBeNull());

    expect(part(glamour, 'Body', 'piece-tag')).toBe('NO FIX');
    expect(part(glamour, 'Body', 'piece-note')).toBe(
      "This character can't wear it · Nothing with the same look fixes it"
    );
    expect(verdict(glamour)!.querySelector('[data-role="verdict-head"]')?.textContent).toBe(
      "1 piece this character can't wear"
    );
    expect(counts(glamour)).toEqual(['1 NO FIX']);
  });

  it('flags a Grand Company piece without failing it', async () => {
    const resolved: CharaResolveResult = {
      items: {
        Body: item(1618, "Serpent Private's Coat", {
          rules: [rules([1618], 2, { grandCompany: 2 })],
        }),
      },
      glasses: null,
      version: 'test',
    };
    const { container, glamour } = await mount(Promise.resolve(resolved), MIDLANDER);
    hosts = [container, glamour];
    await vi.waitFor(() => expect(verdict(glamour)).not.toBeNull());

    expect(part(glamour, 'Body', 'piece-tag')).toBeNull();
    expect(part(glamour, 'Body', 'piece-note')).toBe('Needs the right Grand Company');
    // Its own outcome: the chips add up to the pieces (spec G7), and the headline says it
    expect(counts(glamour)).toEqual(['1 NEEDS A GRAND COMPANY']);
    expect(verdict(glamour)!.querySelector('[data-role="verdict-head"]')?.textContent).toBe(
      '1 piece that needs the right Grand Company'
    );
  });

  it('says a model with no item behind it has no fix', async () => {
    const resolved: CharaResolveResult = {
      items: { HeadGear: COIF, Body: null },
      glasses: null,
      version: 'test',
    };
    const { container, glamour } = await mount(Promise.resolve(resolved), MIDLANDER);
    hosts = [container, glamour];
    await vi.waitFor(() => expect(verdict(glamour)).not.toBeNull());

    expect(part(glamour, 'Body', 'piece-tag')).toBe('NO FIX');
    expect(part(glamour, 'Body', 'piece-note')).toBe('A model with no item behind it');
    expect(counts(glamour)).toEqual(['1 FIXED BY A TWIN', '1 NO FIX']);
  });

  it('marks twins that are a free choice in grey and names the other one', async () => {
    const resolved: CharaResolveResult = {
      items: {
        Body: item(30000, 'Augmented Deepshadow Coat of Striking', {
          familySize: 2,
          alternates: [{ itemId: 30001, names: names('Deepshadow Coat of Striking') }],
          rules: [rules([30000, 30001], 2)],
        }),
      },
      glasses: null,
      version: 'test',
    };
    const { container, glamour } = await mount(Promise.resolve(resolved), MIDLANDER);
    hosts = [container, glamour];
    await vi.waitFor(() => expect(verdict(glamour)).not.toBeNull());

    expect(
      row(glamour, 'Body').querySelector<HTMLElement>('[data-role="twin-chip"]')!.dataset.tone
    ).toBe('choice');
    expect(part(glamour, 'Body', 'piece-tag')).toBeNull();
    expect(part(glamour, 'Body', 'piece-note')).toBe(
      'Same look as Deepshadow Coat of Striking · either is fine'
    );
  });

  it('opens the twin picker from +N; picking a twin renames the row and redoes the verdict', async () => {
    const resolved: CharaResolveResult = {
      items: { HeadGear: COIF },
      glasses: null,
      version: 'test',
    };
    const { container, glamour } = await mount(Promise.resolve(resolved), MIDLANDER);
    hosts = [container, glamour];
    await vi.waitFor(() => expect(verdict(glamour)).not.toBeNull());

    row(glamour, 'HeadGear').querySelector<HTMLElement>('[data-role="twin-chip"]')!.click();
    const choices = Array.from(document.querySelectorAll<HTMLElement>('[data-role="twin-option"]'));
    expect(choices.map((c) => c.dataset.itemId)).toEqual(['372', '2629']);

    // Pick the Dated coif, which can't take the dye: the row says so
    choices[0]!.click();
    expect(part(glamour, 'HeadGear', 'item-name')).toBe('Dated Hempen Coif');
    expect(part(glamour, 'HeadGear', 'piece-tag')).toBe('NO FIX');
    expect(part(glamour, 'HeadGear', 'piece-note')).toBe(
      "It can't take the dyes the file puts on it · Hempen Coif can be worn instead"
    );
    expect(counts(glamour)).toEqual(['1 NO FIX']);
  });

  it('gives an undyed piece the verdict counts a row of its own, even with Show all off', async () => {
    const file = JSON.stringify({
      TypeName: 'Anamnesis Character File',
      Tribe: 'Midlander',
      Gender: 'Feminine',
      REyeColor: 42,
      HeadGear: { ModelBase: 361, ModelVariant: 5, DyeId: 1, DyeId2: 0 },
      Legs: { ModelBase: 777, ModelVariant: 1, DyeId: 0, DyeId2: 0 },
      Feet: { ModelBase: 99, ModelVariant: 1, DyeId: 0, DyeId2: 0 },
      Glasses: { GlassesId: 0 },
    });
    const resolved: CharaResolveResult = {
      items: {
        HeadGear: item(2629, 'Hempen Coif', { rules: [rules([2629], 1)] }),
        Legs: item(9500, 'Viera Gaskins', { rules: [rules([9500], 1, { wearMask: 0xc000 })] }),
        Feet: item(3000, 'Hempen Boots', { rules: [rules([3000], 1)] }),
      },
      glasses: null,
      version: 'test',
    };
    const { container, glamour } = await mount(Promise.resolve(resolved), file);
    hosts = [container, glamour];
    await vi.waitFor(() => expect(verdict(glamour)).not.toBeNull());

    expect(counts(glamour)).toContain('1 NO FIX');
    // The NO FIX piece takes no dye, but the rows explain the verdict
    expect(part(glamour, 'Legs', 'item-name')).toBe('Viera Gaskins');
    expect(part(glamour, 'Legs', 'piece-tag')).toBe('NO FIX');
    // An undyed piece that is fine stays behind Show all
    expect(block(glamour).querySelector('[data-slot="Feet"]')).toBeNull();
  });

  it('keeps a twin pick when the reader is left and opened again, and a new file starts clean', async () => {
    const resolved: CharaResolveResult = {
      items: { HeadGear: COIF },
      glasses: null,
      version: 'test',
    };
    const { container, glamour, block: first } = await mount(Promise.resolve(resolved), MIDLANDER);
    hosts = [container, glamour];
    await vi.waitFor(() => expect(verdict(glamour)).not.toBeNull());
    row(glamour, 'HeadGear').querySelector<HTMLElement>('[data-role="twin-chip"]')!.click();
    document.querySelector<HTMLElement>('[data-role="twin-option"][data-item-id="372"]')!.click();

    // Leave the reader (the block is torn down) and come back to the same file
    first.destroy();
    const again = createTestContainer('chara-glamour-again');
    hosts.push(again);
    const second = new GlamourBlock(again);
    second.init();
    mounted.push(second);
    await vi.waitFor(() => expect(verdict(again)).not.toBeNull());
    expect(part(again, 'HeadGear', 'item-name')).toBe('Dated Hempen Coif');

    // A new file is a new session: its picks start from the default rule
    const file = new File([MIDLANDER], 'other.chara', { type: 'application/json' });
    if (typeof (file as Blob).text !== 'function') {
      (file as unknown as { text: () => Promise<string> }).text = () => Promise.resolve(MIDLANDER);
    }
    await loadCharaFile(file);
    await vi.waitFor(() => expect(part(again, 'HeadGear', 'item-name')).toBe('Hempen Coif'));
  });

  it('a pick from the paired off-hand row names the weapon both rows show', async () => {
    const replica = {
      ...item(7863, 'Curtana Zenith', {
        familySize: 2,
        alternates: [{ itemId: 25000, names: names('Curtana Zenith Replica') }],
        rules: [rules([7863], 1), rules([25000], 1)],
      }),
    };
    const resolved: CharaResolveResult = {
      items: { MainHand: replica, OffHand: { ...replica, viaMainHand: true } },
      glasses: null,
      version: 'test',
    };
    const { container, glamour } = await mount(Promise.resolve(resolved));
    hosts = [container, glamour];
    await vi.waitFor(() =>
      expect(row(glamour, 'OffHand').querySelector('[data-role="twin-chip"]')).not.toBeNull()
    );

    row(glamour, 'OffHand').querySelector<HTMLElement>('[data-role="twin-chip"]')!.click();
    document.querySelector<HTMLElement>('[data-role="twin-option"][data-item-id="25000"]')!.click();

    expect(part(glamour, 'MainHand', 'item-name')).toBe('Curtana Zenith Replica');
    expect(part(glamour, 'OffHand', 'item-name')).toBe('Curtana Zenith Replica');
  });

  it('the Dyes lens names the twin the list names, on the carrier and on the menu it opens', async () => {
    const resolved: CharaResolveResult = {
      items: { HeadGear: COIF },
      glasses: null,
      version: 'test',
    };
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { container, glamour } = await mount(Promise.resolve(resolved), MIDLANDER);
    hosts = [container, glamour];
    await vi.waitFor(() => expect(verdict(glamour)).not.toBeNull());
    // The lowest row (#372) is the Dated coif; the list names Hempen Coif (#2629)
    expect(part(glamour, 'HeadGear', 'item-name')).toBe('Hempen Coif');

    block(glamour).querySelector<HTMLElement>('[data-glamour-view="dyes"]')!.click();
    const carrier = block(glamour).querySelector<HTMLElement>(
      '[data-role="carrier"][data-slot="HeadGear"]'
    )!;
    expect(carrier.title).toContain('Hempen Coif');
    expect(carrier.title).not.toContain('Dated');
    expect(carrier.getAttribute('aria-label')).not.toContain('Dated');

    carrier.click();
    const menu = () => document.querySelector<HTMLElement>('[data-role="item-links-menu"]');
    await vi.waitFor(() => expect(menu()).not.toBeNull());
    expect(menu()!.firstElementChild!.textContent).toBe('Hempen Coif');
    menu()!.querySelector<HTMLElement>('[data-link="garlandTools"]')!.click();
    expect(open).toHaveBeenCalledWith(
      'https://www.garlandtools.org/db/#item/2629',
      '_blank',
      'noopener,noreferrer'
    );
    open.mockRestore();
  });

  it('writes the twin it names into Copy list and Save .md', async () => {
    const resolved: CharaResolveResult = {
      items: { HeadGear: COIF },
      glasses: null,
      version: 'test',
    };
    const { block: b, container, glamour } = await mount(Promise.resolve(resolved), MIDLANDER);
    hosts = [container, glamour];
    await vi.waitFor(() => expect(verdict(glamour)).not.toBeNull());

    const { glamourMarkdownInput } = await import('../glamour-list-actions');
    const source = (
      b as unknown as { listSource(): import('../glamour-list-actions').GlamourListSource }
    ).listSource();
    expect(glamourMarkdownInput(source).HeadGear?.name).toBe('Hempen Coif');
  });
});
