/**
 * DYES ON THIS GLAMOUR — Turn 11 (11a Named rows default, 11c Dye-led second
 * lens, Pieces/Dyes toggle, five states). Real services (the suite's
 * LanguageService is initialised with EN in setup.ts); only the resolve
 * round-trip is mocked so each state can be driven deterministically.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CharaImport } from '../chara-import';
import { StorageService, ToastService } from '@services/index';
import { buildGlamourMarkdown } from '@shared/glamour-markdown';
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

async function mount(pending: Promise<CharaResolveResult>, fixture: string = FIXTURE) {
  resolveMock.mockReturnValue(pending);
  const container = createTestContainer('chara-host');
  const glamour = createTestContainer('chara-glamour');
  const importer = new CharaImport(
    container,
    { onSlotPick: vi.fn(), onResolved: vi.fn() },
    { glamourContainer: glamour }
  );
  importer.init();
  // loadFile is the drop/choose handler's only job; drive it directly so the
  // test is deterministic (jsdom's File lacks text() on some versions).
  const file = new File([fixture], 'galatine.chara', { type: 'application/json' });
  if (typeof (file as Blob).text !== 'function') {
    (file as unknown as { text: () => Promise<string> }).text = () => Promise.resolve(fixture);
  }
  await (importer as unknown as { loadFile(f: File): Promise<void> }).loadFile(file);
  return { importer, container, glamour };
}

const block = (glamour: HTMLElement) =>
  glamour.querySelector<HTMLElement>('[data-role="glamour-block"]')!;

describe('CharaImport — DYES ON THIS GLAMOUR (Turn 11)', () => {
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
    expect(rows[0].textContent).toContain('Weapon');
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

    const badge = row('HeadGear').querySelector<HTMLElement>('[data-role="same-model"]')!;
    expect(badge.textContent).toBe('+2');
    expect(badge.title).toBe('Same model: Beech Mask of Casting Replica …');
    expect(row('MainHand').querySelector('[data-role="same-model"]')).toBeNull();

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
    expect(carriers[0].title).toBe('WEAPON — Runaway Bow');
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
describe('CharaImport — Show all pieces', () => {
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
    expect(chip.title).toBe('Silver · facewear colour');
    expect(row.querySelector('[data-role="dye-line"]')?.textContent).toBe('Silver');
    // It is facewear, not a dye channel — never a dye chip.
    expect(row.querySelector('[data-role="dye-chip"]')).toBeNull();
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
    expect(row.querySelector('[data-role="dye-line"]')?.textContent).toBe(
      'Facewear colour unknown'
    );
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
 * The GPOSERS list — Copy list and Export .md in the block head. Both write
 * the whole worn glamour in the template's fixed order, whatever lens or
 * switch is showing, and wait for names to land before they go live.
 */
describe('CharaImport — Copy list / Export .md', () => {
  let hosts: HTMLElement[] = [];
  let writeText: ReturnType<typeof vi.fn>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let clicked: HTMLAnchorElement[];

  const copyBtn = (glamour: HTMLElement) =>
    block(glamour).querySelector<HTMLButtonElement>('[data-role="copy-list"]')!;
  const exportBtn = (glamour: HTMLElement) =>
    block(glamour).querySelector<HTMLButtonElement>('[data-role="export-markdown"]')!;

  /** What FIXTURE + RESOLVED must write: names where known, dyes by channel, blanks elsewhere. */
  const EXPECTED = buildGlamourMarkdown({
    MainHand: { name: 'Runaway Bow', dye1: 'Soot Black' },
    OffHand: { name: 'Runaway Bow', dye1: 'Soot Black' },
    HeadGear: { name: 'Beech Mask of Casting', dye1: 'Snow White' },
    Body: { dye1: 'Deepwood Green', dye2: 'Loam Brown' },
  });

  beforeEach(() => {
    resolveMock.mockReset();
    localStorage.clear();
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
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
    hosts.forEach(cleanupTestContainer);
    hosts = [];
    vi.restoreAllMocks();
  });

  it('renders both actions in the block head, disabled until names have landed', async () => {
    const pending = deferred<CharaResolveResult>();
    const { container, glamour } = await mount(pending.promise);
    hosts = [container, glamour];

    expect(copyBtn(glamour).textContent).toBe('Copy list');
    expect(exportBtn(glamour).textContent).toBe('Export .md');
    expect(copyBtn(glamour).disabled).toBe(true);
    expect(exportBtn(glamour).disabled).toBe(true);

    pending.resolve(RESOLVED);
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));
    expect(exportBtn(glamour).disabled).toBe(false);
  });

  it('copies the whole template with item names, dyes by channel and blanks for the unknown, then confirms', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));

    copyBtn(glamour).click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));

    const text = writeText.mock.calls[0][0] as string;
    expect(text.slice(0, text.indexOf('**Hands:**'))).toBe(
      [
        '**Glamour Items:**',
        '**Main Hand:** Runaway Bow',
        'Dye 1: Soot Black',
        'Dye 2:',
        'Acquisition:',
        '',
        '**Off Hand:** Runaway Bow',
        'Dye 1: Soot Black',
        'Dye 2:',
        'Acquisition:',
        '',
        '**Head:** Beech Mask of Casting',
        'Dye 1: Snow White',
        'Dye 2:',
        'Acquisition:',
        '',
        '**Body:**',
        'Dye 1: Deepwood Green',
        'Dye 2: Loam Brown',
        'Acquisition:',
        '',
        '',
      ].join('\n')
    );
    expect(text).toBe(EXPECTED);
    await vi.waitFor(() =>
      expect(ToastService.success).toHaveBeenCalledWith('Equipment list copied to clipboard')
    );
    expect(clicked).toHaveLength(0);
  });

  it('exports the same text as glamour-equipment.md, with no character name in the file name', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    await vi.waitFor(() => expect(exportBtn(glamour).disabled).toBe(false));

    exportBtn(glamour).click();

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('glamour-equipment.md');
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/markdown');
    await expect(blob.text()).resolves.toBe(EXPECTED);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('writes the full glamour regardless of the lens or the Show all switch', async () => {
    const { container, glamour } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));

    block(glamour).querySelector<HTMLButtonElement>('[data-glamour-view="dyes"]')!.click();
    copyBtn(glamour).click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toBe(EXPECTED);
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

    copyBtn(glamour).click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain('**Body:**\nDye 1: #999\nDye 2: Loam Brown\nAcquisition:');
    expect(text).toContain('**Facewear:** Silver Spectacles\nAcquisition:');
  });

  it('still offers both actions when item names are unavailable — slots and dyes are local', async () => {
    const { container, glamour } = await mount(Promise.reject(new Error('503')));
    hosts = [container, glamour];
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));

    copyBtn(glamour).click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain('**Main Hand:**\nDye 1: Soot Black\nDye 2:');
  });

  it('reports a failed copy rather than a silent one', async () => {
    writeText.mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(false),
    });
    const { container, glamour } = await mount(Promise.resolve(RESOLVED));
    hosts = [container, glamour];
    await vi.waitFor(() => expect(copyBtn(glamour).disabled).toBe(false));

    copyBtn(glamour).click();
    await vi.waitFor(() =>
      expect(ToastService.error).toHaveBeenCalledWith("Couldn't copy the equipment list")
    );
    expect(ToastService.success).not.toHaveBeenCalled();
  });
});
