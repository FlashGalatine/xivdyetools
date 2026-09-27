/**
 * CharaImport — the host hears about every way a loaded file goes away.
 *
 * `onResolved(null)` is what releases the host's grid pins and the sidebar's
 * tribe/gender readout lock (`swatch.fileProvided`). SWAP fired it; destroy()
 * did not, so a file dropped by the Swatch tool's teardown (a trip to another
 * tool) or by its re-render (a language switch) left the selectors locked
 * with the drop zone back on screen.
 *
 * Real core parser and real services; only the equipment round-trip is mocked
 * so nothing reaches the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ResolvedCharaCharacter } from '@xivdyetools/core';
import { CharaImport } from '../chara-import';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';

/** Nothing but an eye colour: parses, and has no gear to resolve. */
const FIXTURE = JSON.stringify({ TypeName: 'Anamnesis Character File', REyeColor: 42 });

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
