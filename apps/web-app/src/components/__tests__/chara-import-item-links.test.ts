/**
 * DYES ON THIS GLAMOUR — the "Open in…" menu on an equipment row.
 *
 * The row's icon and item name hand the piece off to seven community
 * databases. What is worth pinning down here is not the URL strings (those are
 * `shared/__tests__/item-links.test.ts`, which needs no DOM) but the wiring:
 * which rows get a trigger at all, which entries each row TYPE offers, and the
 * one asynchronous path — facewear, whose Glasses row id is not an Item id and
 * whose tinted name is not a real item.
 *
 * Real services throughout (setup.ts initialises LanguageService with EN);
 * only the resolve round-trip is mocked, exactly as the sibling glamour suite
 * does it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CharaImport } from '../chara-import';
import { closeItemLinksMenu } from '../item-links-menu';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';
import type { CharaResolveResult } from '@services/chara-resolve-service';

const { resolveMock } = vi.hoisted(() => ({ resolveMock: vi.fn() }));
vi.mock('@services/chara-resolve-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/chara-resolve-service')>();
  return { ...actual, resolveCharaEquipment: resolveMock };
});

/** Body dyed on both channels; HeadGear dyed. Body resolves to NO Item row. */
const FIXTURE = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  REyeColor: 42,
  HeadGear: { ModelBase: 361, ModelVariant: 5, DyeId: 1, DyeId2: 0 },
  Body: { ModelBase: 9903, ModelVariant: 1, DyeId: 56, DyeId2: 33 },
  Glasses: { GlassesId: 0 },
});

/** A ring — the slot pair Eorzea Collection files under one slug. */
const FIXTURE_RING = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  REyeColor: 42,
  RightRing: { ModelBase: 14, ModelVariant: 1, DyeId: 56, DyeId2: 0 },
  Glasses: { GlassesId: 0 },
});

/** GlassesId 5 — a TINT (row 5 sits inside the block whose base is row 1). */
const FIXTURE_TINTED_GLASSES = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  REyeColor: 42,
  Body: { ModelBase: 200, ModelVariant: 1, DyeId: 56, DyeId2: 33 },
  Glasses: { GlassesId: 5 },
});

/** GlassesId 13 — a BASE row: (13 − 1) % 12 === 0, so no lookup is needed. */
const FIXTURE_BASE_GLASSES = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  REyeColor: 42,
  Body: { ModelBase: 200, ModelVariant: 1, DyeId: 56, DyeId2: 33 },
  Glasses: { GlassesId: 13 },
});

const MASK = {
  itemId: 18085,
  names: {
    en: 'Beech Mask of Casting',
    ja: 'ビーチキャスターマスク',
    de: 'Buchenmaske der Magie',
    fr: 'Masque',
  },
  iconId: 41716,
  familySize: 1,
  alternates: [],
  viaMainHand: false,
};

const RING = {
  itemId: 777,
  names: { en: 'Test Ring', ja: 'テストリング', de: 'Testring', fr: 'Anneau test' },
  iconId: 40000,
  familySize: 1,
  alternates: [],
  viaMainHand: false,
};

/** HeadGear has an item; Body deliberately has none (an NPC model). */
const RESOLVED: CharaResolveResult = {
  items: { HeadGear: MASK, Body: null },
  glasses: null,
  version: 'test',
};

const RESOLVED_RING: CharaResolveResult = {
  items: { RightRing: RING },
  glasses: null,
  version: 'test',
};

const TINTED = {
  id: 5,
  names: {
    en: 'White Oval Spectacles',
    ja: 'オーバルグラス:ホワイト',
    de: 'Ovale Brille - Weiß',
    fr: 'Lunettes ovales (blanches)',
  },
  iconId: 51000,
};

const BASE_SPECTACLES = {
  id: 1,
  names: {
    en: 'Oval Spectacles',
    ja: 'オーバルグラス',
    de: 'Ovale Brille',
    fr: 'Lunettes ovales',
  },
  iconId: 51000,
};

const UNTINTED = {
  id: 13,
  names: {
    en: 'Shaded Spectacles',
    ja: 'シェイデッドグラス',
    de: 'Getönte Brille',
    fr: 'Lunettes teintées',
  },
  iconId: 51001,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function mount(fixture: string) {
  const container = createTestContainer('chara-host');
  const glamour = createTestContainer('chara-glamour');
  const importer = new CharaImport(
    container,
    { onSlotPick: vi.fn(), onResolved: vi.fn() },
    { glamourContainer: glamour }
  );
  importer.init();
  const file = new File([fixture], 'test.chara', { type: 'application/json' });
  if (typeof (file as Blob).text !== 'function') {
    (file as unknown as { text: () => Promise<string> }).text = () => Promise.resolve(fixture);
  }
  await (importer as unknown as { loadFile(f: File): Promise<void> }).loadFile(file);
  return { importer, container, glamour };
}

/** Reveal every worn piece — the facewear row only exists under Show all. */
function showAll(glamour: HTMLElement): void {
  glamour.querySelector<HTMLElement>('[data-role="show-all-switch"]')?.click();
}

const menu = () => document.querySelector<HTMLElement>('[data-role="item-links-menu"]');

/**
 * Click a trigger and wait for the menu to mount.
 *
 * The menu is a dynamic import (it is interaction-only, and shipping it in the
 * swatch chunk put that chunk over its size budget), so the click that opens it
 * resolves a promise before anything appears.
 */
async function openMenu(node: HTMLElement | null): Promise<void> {
  node!.click();
  await vi.waitFor(() => expect(menu()).not.toBeNull());
}
const entryIds = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-role="item-links-menu"] [data-link]'))
    .map((n) => n.dataset.link)
    .filter((id): id is string => id !== undefined);

describe('CharaImport — "Open in…" menu', () => {
  let hosts: HTMLElement[] = [];
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resolveMock.mockReset();
    localStorage.clear();
    openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
  });
  afterEach(() => {
    closeItemLinksMenu();
    openSpy.mockRestore();
    hosts.forEach(cleanupTestContainer);
    hosts = [];
  });

  it('makes the icon and the item name keyboard-reachable triggers', async () => {
    resolveMock.mockResolvedValue(RESOLVED);
    const { glamour } = await mount(FIXTURE);
    hosts.push(glamour);

    const row = glamour.querySelector<HTMLElement>('[data-slot="HeadGear"]')!;
    const icon = row.querySelector<HTMLElement>('[data-role="item-icon"]')!;
    const name = row.querySelector<HTMLElement>('[data-role="item-name"]')!;

    for (const node of [icon, name]) {
      expect(node.getAttribute('role')).toBe('button');
      expect(node.tabIndex).toBe(0);
      expect(node.dataset.itemLinks).toBe('trigger');
      // The tile ships aria-hidden as decoration; a control cannot stay hidden.
      expect(node.getAttribute('aria-hidden')).toBeNull();
      expect(node.getAttribute('aria-label')).toContain('Beech Mask of Casting');
    }
  });

  it('leaves a row with no Item row untouched — there is nothing to link', async () => {
    resolveMock.mockResolvedValue(RESOLVED);
    const { glamour } = await mount(FIXTURE);
    hosts.push(glamour);

    // Body is an NPC model: no item id, no name, so no trigger anywhere on it.
    const body = glamour.querySelector<HTMLElement>('[data-slot="Body"]')!;
    expect(body.querySelector('[data-item-links="trigger"]')).toBeNull();

    const icon = body.querySelector<HTMLElement>('[data-role="item-icon"]')!;
    icon.click();
    expect(menu()).toBeNull();
  });

  it('opens the four gear entries plus a Lodestone submenu', async () => {
    resolveMock.mockResolvedValue(RESOLVED);
    const { glamour } = await mount(FIXTURE);
    hosts.push(glamour);

    await openMenu(
      glamour.querySelector<HTMLElement>('[data-slot="HeadGear"] [data-role="item-name"]')
    );

    expect(menu()).not.toBeNull();
    expect(entryIds()).toEqual([
      'mirapri',
      'garlandTools',
      'teamcraft',
      'gamerEscape',
      'lodestone',
    ]);
  });

  it('opens the destination in a new tab, then dismisses', async () => {
    resolveMock.mockResolvedValue(RESOLVED);
    const { glamour } = await mount(FIXTURE);
    hosts.push(glamour);

    await openMenu(
      glamour.querySelector<HTMLElement>('[data-slot="HeadGear"] [data-role="item-icon"]')
    );
    document.querySelector<HTMLElement>('[data-link="garlandTools"]')!.click();

    expect(openSpy).toHaveBeenCalledWith(
      'https://www.garlandtools.org/db/#item/18085',
      '_blank',
      'noopener,noreferrer'
    );
    expect(menu()).toBeNull();
  });

  it('gives an accessory the same entries as an armour piece', async () => {
    resolveMock.mockResolvedValue(RESOLVED_RING);
    const { glamour } = await mount(FIXTURE_RING);
    hosts.push(glamour);

    await openMenu(
      glamour.querySelector<HTMLElement>('[data-slot="RightRing"] [data-role="item-name"]')
    );
    // Nothing about the entry set is slot-dependent any more — every site
    // still offered takes the item id or the name, neither of which varies
    // by slot.
    expect(entryIds()).toEqual([
      'mirapri',
      'garlandTools',
      'teamcraft',
      'gamerEscape',
      'lodestone',
    ]);

    document.querySelector<HTMLElement>('[data-link="teamcraft"]')!.click();
    expect(openSpy).toHaveBeenCalledWith(
      'https://ffxivteamcraft.com/db/en/item/777',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('expands the Lodestone into its five regional hosts', async () => {
    resolveMock.mockResolvedValue(RESOLVED);
    const { glamour } = await mount(FIXTURE);
    hosts.push(glamour);

    await openMenu(
      glamour.querySelector<HTMLElement>('[data-slot="HeadGear"] [data-role="item-name"]')
    );
    const lodestone = document.querySelector<HTMLElement>('[data-link="lodestone"]')!;
    expect(lodestone.getAttribute('aria-expanded')).toBe('false');
    lodestone.click();

    const submenu = document.querySelector<HTMLElement>('[data-role="item-links-lodestone"]')!;
    expect(submenu).not.toBeNull();
    expect(lodestone.getAttribute('aria-expanded')).toBe('true');
    expect(
      Array.from(submenu.querySelectorAll<HTMLElement>('[data-region]')).map(
        (n) => n.dataset.region
      )
    ).toEqual(['na', 'eu', 'jp', 'de', 'fr']);

    // Japan searches the Japanese name, not the English one.
    submenu.querySelector<HTMLElement>('[data-region="jp"]')!.click();
    expect(openSpy).toHaveBeenCalledWith(
      `https://jp.finalfantasyxiv.com/lodestone/playguide/db/search/?q=${encodeURIComponent(
        'ビーチキャスターマスク'
      )}`,
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('reaches the same menu from a carrier icon in the Dyes lens', async () => {
    resolveMock.mockResolvedValue(RESOLVED);
    const { glamour } = await mount(FIXTURE);
    hosts.push(glamour);

    glamour.querySelector<HTMLElement>('[data-glamour-view="dyes"]')!.click();
    const carrier = glamour.querySelector<HTMLElement>(
      '[data-role="carrier"][data-slot="HeadGear"]'
    )!;
    expect(carrier.dataset.itemLinks).toBe('trigger');
    await openMenu(carrier);
    expect(entryIds()).toContain('teamcraft');
  });

  describe('facewear', () => {
    it('offers only the name-addressed sites — a Glasses row is not an Item id', async () => {
      resolveMock.mockResolvedValueOnce({ ...RESOLVED, glasses: UNTINTED });
      const { glamour } = await mount(FIXTURE_BASE_GLASSES);
      hosts.push(glamour);
      showAll(glamour);

      await openMenu(
        glamour.querySelector<HTMLElement>('[data-slot="Facewear"] [data-role="item-name"]')
      );
      expect(entryIds()).toEqual(['mirapri', 'gamerEscape', 'lodestone']);
    });

    it('needs no lookup for an untinted row — its own name IS the base name', async () => {
      resolveMock.mockResolvedValueOnce({ ...RESOLVED, glasses: UNTINTED });
      const { glamour } = await mount(FIXTURE_BASE_GLASSES);
      hosts.push(glamour);
      showAll(glamour);
      const callsBefore = resolveMock.mock.calls.length;

      await openMenu(
        glamour.querySelector<HTMLElement>('[data-slot="Facewear"] [data-role="item-name"]')
      );

      expect(resolveMock.mock.calls.length).toBe(callsBefore);
      document.querySelector<HTMLElement>('[data-link="gamerEscape"]')!.click();
      expect(openSpy).toHaveBeenCalledWith(
        'https://ffxiv.gamerescape.com/wiki/Shaded_Spectacles',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('resolves a TINTED row to its base row before offering a link', async () => {
      resolveMock.mockResolvedValueOnce({ ...RESOLVED, glasses: TINTED });
      const { glamour } = await mount(FIXTURE_TINTED_GLASSES);
      hosts.push(glamour);
      showAll(glamour);

      // Held open, so the resolving state is genuinely observable — an
      // already-settled promise would land before the first assertion could
      // read it, and the skeletons would be untestable.
      const base = deferred<CharaResolveResult>();
      resolveMock.mockReturnValueOnce(base.promise);

      await openMenu(
        glamour.querySelector<HTMLElement>('[data-slot="Facewear"] [data-role="item-name"]')
      );

      // Skeletons first — never a link built from the tinted name.
      expect(
        menu()!.querySelector('[data-role="item-links-body"]')!.getAttribute('data-state')
      ).toBe('resolving');
      expect(entryIds()).toEqual([]);
      // Row 5 lives in the block whose base is row 1.
      expect(resolveMock).toHaveBeenLastCalledWith([], 1);

      base.resolve({ items: {}, glasses: BASE_SPECTACLES, version: 'test' });
      await vi.waitFor(() => {
        expect(entryIds()).toEqual(['mirapri', 'gamerEscape', 'lodestone']);
      });

      // "White Oval Spectacles" is not an item; "Oval Spectacles" is.
      document.querySelector<HTMLElement>('[data-link="gamerEscape"]')!.click();
      expect(openSpy).toHaveBeenCalledWith(
        'https://ffxiv.gamerescape.com/wiki/Oval_Spectacles',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('offers nothing rather than a dead link when the base name never arrives', async () => {
      resolveMock.mockResolvedValueOnce({ ...RESOLVED, glasses: TINTED });
      const { glamour } = await mount(FIXTURE_TINTED_GLASSES);
      hosts.push(glamour);
      showAll(glamour);

      resolveMock.mockRejectedValueOnce(new Error('api-worker unreachable'));
      await openMenu(
        glamour.querySelector<HTMLElement>('[data-slot="Facewear"] [data-role="item-name"]')
      );

      await vi.waitFor(() => {
        expect(document.querySelector('[data-role="item-links-unavailable"]')).not.toBeNull();
      });
      expect(entryIds()).toEqual([]);
    });
  });

  describe('dismissal', () => {
    it('closes on Escape', async () => {
      resolveMock.mockResolvedValue(RESOLVED);
      const { glamour } = await mount(FIXTURE);
      hosts.push(glamour);

      await openMenu(
        glamour.querySelector<HTMLElement>('[data-slot="HeadGear"] [data-role="item-name"]')
      );
      expect(menu()).not.toBeNull();

      await vi.waitFor(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(menu()).toBeNull();
      });
    });

    it('closes when the component is destroyed — it lives outside the container', async () => {
      resolveMock.mockResolvedValue(RESOLVED);
      const { importer, glamour } = await mount(FIXTURE);
      hosts.push(glamour);

      await openMenu(
        glamour.querySelector<HTMLElement>('[data-slot="HeadGear"] [data-role="item-name"]')
      );
      expect(menu()).not.toBeNull();

      importer.destroy();
      expect(menu()).toBeNull();
    });

    it('closes when switching lens — every row it was anchored to is replaced', async () => {
      resolveMock.mockResolvedValue(RESOLVED);
      const { glamour } = await mount(FIXTURE);
      hosts.push(glamour);

      await openMenu(
        glamour.querySelector<HTMLElement>('[data-slot="HeadGear"] [data-role="item-name"]')
      );
      expect(menu()).not.toBeNull();

      glamour.querySelector<HTMLElement>('[data-glamour-view="dyes"]')!.click();
      expect(menu()).toBeNull();
    });
  });
});
