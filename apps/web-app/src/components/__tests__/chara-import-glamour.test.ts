/**
 * DYES ON THIS GLAMOUR — Turn 11 (11a Named rows default, 11c Dye-led second
 * lens, Pieces/Dyes toggle, five states). Real services (the suite's
 * LanguageService is initialised with EN in setup.ts); only the resolve
 * round-trip is mocked so each state can be driven deterministically.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CharaImport } from '../chara-import';
import { StorageService } from '@services/index';
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

async function mount(pending: Promise<CharaResolveResult>) {
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
  const file = new File([FIXTURE], 'galatine.chara', { type: 'application/json' });
  if (typeof (file as Blob).text !== 'function') {
    (file as unknown as { text: () => Promise<string> }).text = () => Promise.resolve(FIXTURE);
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
