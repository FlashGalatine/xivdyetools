/**
 * CharaImport — the host hears about every way a loaded file goes away, and a
 * re-render of the host is not one of them.
 *
 * `onResolved(null)` is what releases the host's grid pins and the sidebar's
 * tribe/gender readout lock (`swatch.fileProvided`). SWAP fired it; destroy()
 * did not, so a file dropped by the Swatch tool's teardown (a trip to another
 * tool) left the selectors locked with the drop zone back on screen.
 *
 * The tool's re-render (a language switch) dropped the file too, because it
 * built a fresh importer. It now moves the one it has into its new containers
 * with remount(), and the file stays.
 *
 * Real core parser and real services; only the equipment round-trip is mocked
 * so nothing reaches the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ResolvedCharaCharacter } from '@xivdyetools/core';
import { LanguageService } from '@services/index';
import type { CharaResolveResult } from '@services/chara-resolve-service';
import { CharaImport } from '../chara-import';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';

/** Nothing but an eye colour: parses, and has no gear to resolve. */
const FIXTURE = JSON.stringify({ TypeName: 'Anamnesis Character File', REyeColor: 42 });

/** One dyed weapon: the glamour block gets a row, and the row an item name. */
const GEAR_FIXTURE = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  REyeColor: 42,
  MainHand: { ModelSet: 634, ModelBase: 19, ModelVariant: 1, DyeId: 6, DyeId2: 0 },
});

const RESOLVED: CharaResolveResult = {
  items: {
    MainHand: {
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
    },
  },
  glasses: null,
  version: 'test',
};

const { resolveMock } = vi.hoisted(() => ({ resolveMock: vi.fn() }));
vi.mock('@services/chara-resolve-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/chara-resolve-service')>();
  return { ...actual, resolveCharaEquipment: resolveMock };
});

type LoadFile = { loadFile(f: File): Promise<void> };

function charaFile(content: string): File {
  const file = new File([content], 'test.chara', { type: 'application/json' });
  if (typeof (file as Blob).text !== 'function') {
    (file as unknown as { text: () => Promise<string> }).text = () => Promise.resolve(content);
  }
  return file;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** The item names a glamour block shows, in row order. */
const itemNames = (glamour: HTMLElement) =>
  Array.from(glamour.querySelectorAll('[data-role="item-name"]'), (node) => node.textContent);

describe('CharaImport — destroy() with a file loaded', () => {
  let container: HTMLElement;

  beforeEach(() => {
    resolveMock.mockReset();
    resolveMock.mockReturnValue(new Promise(() => {}));
    container = createTestContainer('chara-host-lifecycle');
  });

  afterEach(() => {
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  it('reports the file as cleared, as SWAP does', async () => {
    const onResolved = vi.fn<(resolved: ResolvedCharaCharacter | null) => void>();
    const importer = new CharaImport(container, { onSlotPick: vi.fn(), onResolved });
    importer.init();
    await (importer as unknown as LoadFile).loadFile(charaFile(FIXTURE));
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onResolved.mock.calls[0][0]).not.toBeNull();

    importer.destroy();

    expect(onResolved).toHaveBeenCalledTimes(2);
    expect(onResolved).toHaveBeenLastCalledWith(null);
  });

  it('finishes tearing down when the host callback throws', async () => {
    const importer = new CharaImport(container, {
      onSlotPick: vi.fn(),
      onResolved: () => {
        throw new Error('host bug');
      },
    });
    importer.init();
    await (importer as unknown as LoadFile).loadFile(charaFile(FIXTURE));

    // The Swatch tool calls this first in its own destroy(); a throw here
    // would skip the rest of the tool's teardown.
    expect(() => importer.destroy()).not.toThrow();
    expect(container.childElementCount).toBe(0);
  });
});

describe('CharaImport — destroy() while a file is still loading', () => {
  /** Sets tribe and gender too, so a late report would also rewrite them. */
  const TRIBE_FIXTURE = JSON.stringify({
    TypeName: 'Anamnesis Character File',
    Tribe: 'Rava',
    Gender: 'Feminine',
    REyeColor: 42,
  });
  let container: HTMLElement;

  beforeEach(() => {
    resolveMock.mockReset();
    resolveMock.mockReturnValue(new Promise(() => {}));
    container = createTestContainer('chara-host-late-load');
  });

  afterEach(() => {
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  it('drops the late result instead of reporting it to the host', async () => {
    const onResolved = vi.fn();
    const onTribeGender = vi.fn();
    const importer = new CharaImport(container, { onSlotPick: vi.fn(), onResolved, onTribeGender });
    importer.init();
    // Still reading when the host tears the importer down (a trip to another
    // tool; a language switch remounts it instead, below)
    let finishReading!: (text: string) => void;
    const file = charaFile(TRIBE_FIXTURE);
    vi.spyOn(file, 'text').mockReturnValue(
      new Promise<string>((resolve) => {
        finishReading = resolve;
      })
    );
    const loading = (importer as unknown as LoadFile).loadFile(file);

    importer.destroy();
    finishReading(TRIBE_FIXTURE);
    await loading;

    // A report now would put back the readout lock destroy() just released
    expect(onTribeGender).not.toHaveBeenCalled();
    expect(onResolved).not.toHaveBeenCalled();
    expect(container.childElementCount).toBe(0);
  });
});

describe('CharaImport — remount() with a file loaded', () => {
  /** The host's containers, then the ones its re-render builds. */
  let host: HTMLElement;
  let glamour: HTMLElement;
  let newHost: HTMLElement;
  let newGlamour: HTMLElement;

  beforeEach(() => {
    resolveMock.mockReset();
    host = createTestContainer('chara-host-before');
    glamour = createTestContainer('chara-glamour-before');
    newHost = createTestContainer('chara-host-after');
    newGlamour = createTestContainer('chara-glamour-after');
  });

  afterEach(async () => {
    await LanguageService.setLocale('en');
    [host, glamour, newHost, newGlamour].forEach(cleanupTestContainer);
    vi.restoreAllMocks();
  });

  /** An importer in the host's first containers, with GEAR_FIXTURE loaded. */
  async function loaded(
    onResolved: (resolved: ResolvedCharaCharacter | null) => void = vi.fn()
  ): Promise<CharaImport> {
    const importer = new CharaImport(
      host,
      { onSlotPick: vi.fn(), onResolved },
      { glamourContainer: glamour }
    );
    importer.init();
    await (importer as unknown as LoadFile).loadFile(charaFile(GEAR_FIXTURE));
    return importer;
  }

  it('draws the file again in the new containers, in the current language', async () => {
    resolveMock.mockResolvedValue(RESOLVED);
    const onResolved = vi.fn<(resolved: ResolvedCharaCharacter | null) => void>();
    const importer = await loaded(onResolved);
    await vi.waitFor(() => expect(itemNames(glamour)).toEqual(['Runaway Bow']));

    await LanguageService.setLocale('ja');
    importer.remount(newHost, { glamourContainer: newGlamour });

    expect(newHost.textContent).toContain('キャラクターの色を保存'); // the file card, in Japanese
    expect(itemNames(newGlamour)).toEqual(['逃走の弓']); // the resolved name, in Japanese
    expect(host.childElementCount + glamour.childElementCount).toBe(0); // no copy left behind
    expect(onResolved).toHaveBeenCalledTimes(1); // the load only: a move is not a clear
  });

  it('lands an equipment lookup still in flight in the new glamour block', async () => {
    const pending = deferred<CharaResolveResult>();
    resolveMock.mockReturnValue(pending.promise);
    const importer = await loaded();
    expect(glamour.querySelector('[data-role="name-skeleton"]')).not.toBeNull();

    importer.remount(newHost, { glamourContainer: newGlamour });
    pending.resolve(RESOLVED);

    await vi.waitFor(() => expect(itemNames(newGlamour)).toEqual(['Runaway Bow']));
  });

  it('lands a file still loading in the new containers, unlike destroy()', async () => {
    resolveMock.mockReturnValue(new Promise(() => {}));
    const onResolved = vi.fn<(resolved: ResolvedCharaCharacter | null) => void>();
    const importer = new CharaImport(
      host,
      { onSlotPick: vi.fn(), onResolved },
      { glamourContainer: glamour }
    );
    importer.init();
    let finishReading!: (text: string) => void;
    const file = charaFile(GEAR_FIXTURE);
    vi.spyOn(file, 'text').mockReturnValue(
      new Promise<string>((resolve) => {
        finishReading = resolve;
      })
    );
    const loading = (importer as unknown as LoadFile).loadFile(file);

    importer.remount(newHost, { glamourContainer: newGlamour });
    finishReading(GEAR_FIXTURE);
    await loading;

    expect(onResolved).toHaveBeenCalledTimes(1); // the host hears about the file...
    expect(onResolved.mock.calls[0][0]).not.toBeNull();
    expect(newHost.textContent).toContain('test.chara'); // ...and it shows where the host looks
    expect(newGlamour.querySelector('[data-role="glamour-block"]')).not.toBeNull();
  });
});
