/**
 * CharaImport — file-size guard on the .chara loader.
 *
 * `loadFile` used to read `file.text()` of any size and hand it to the
 * parser; a multi-GB drop would hang the tab (self-DoS, 2026-08-21 security
 * audit, WEB-13). The loader now refuses a file over the shared cap before
 * reading it, with the same toast wording the other file inputs use.
 *
 * Real services (LanguageService is initialised with EN in setup.ts); only
 * the equipment resolve round-trip is mocked so nothing reaches the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CharaImport } from '../chara-import';
import { LanguageService, ToastService } from '@services/index';
import { MAX_USER_FILE_BYTES } from '@shared/constants';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';

const { resolveMock } = vi.hoisted(() => ({ resolveMock: vi.fn() }));
vi.mock('@services/chara-resolve-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/chara-resolve-service')>();
  return { ...actual, resolveCharaEquipment: resolveMock };
});

type LoadFile = { loadFile(f: File): Promise<void> };

/** A File whose reported size is `size` bytes without allocating them. */
function fileOfSize(size: number, content = '{}'): File {
  const file = new File([content], 'huge.chara', { type: 'application/json' });
  Object.defineProperty(file, 'size', { value: size });
  if (typeof (file as Blob).text !== 'function') {
    (file as unknown as { text: () => Promise<string> }).text = () => Promise.resolve(content);
  }
  return file;
}

describe('CharaImport — .chara file size guard (WEB-13)', () => {
  let container: HTMLElement;
  let importer: CharaImport;

  beforeEach(() => {
    resolveMock.mockReset();
    resolveMock.mockReturnValue(new Promise(() => {}));
    container = createTestContainer('chara-host');
    importer = new CharaImport(container, { onSlotPick: vi.fn() }, {});
    importer.init();
  });

  afterEach(() => {
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  it('refuses a file over the cap before reading it and tells the user why', async () => {
    const errorSpy = vi.spyOn(ToastService, 'error').mockImplementation(() => 'toast');
    const file = fileOfSize(MAX_USER_FILE_BYTES + 1);
    const textSpy = vi.spyOn(file, 'text');

    await (importer as unknown as LoadFile).loadFile(file);

    expect(textSpy).not.toHaveBeenCalled();
    expect(resolveMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(LanguageService.t('errors.fileTooLarge'));
    // The key is a real translation, not an echo of the key
    expect(LanguageService.t('errors.fileTooLarge')).not.toBe('errors.fileTooLarge');
  });

  it('still reads a file at or under the cap', async () => {
    const errorSpy = vi.spyOn(ToastService, 'error').mockImplementation(() => 'toast');
    const file = fileOfSize(MAX_USER_FILE_BYTES, JSON.stringify({ TypeName: 'x' }));
    const textSpy = vi.spyOn(file, 'text');

    await (importer as unknown as LoadFile).loadFile(file);

    expect(textSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalledWith(LanguageService.t('errors.fileTooLarge'));
  });
});
