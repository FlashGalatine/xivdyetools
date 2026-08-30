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
import { TelemetryService } from '@services/telemetry-service';
import { MAX_USER_FILE_BYTES } from '@shared/constants';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';

/**
 * Galatine-shaped Anamnesis fixture (same shape as chara-import-glamour.test.ts's
 * FIXTURE) — enough key presence for core's `parseCharaFile` to succeed and for
 * `TypeName` to normalise to the 'anamnesis' producer bucket.
 */
const ANAMNESIS_FIXTURE = JSON.stringify({
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

describe('CharaImport — telemetry', () => {
  let container: HTMLElement;
  let importer: CharaImport;

  beforeEach(() => {
    resolveMock.mockReset();
    resolveMock.mockReturnValue(new Promise(() => {}));
    container = createTestContainer('chara-host-telemetry');
    importer = new CharaImport(container, { onSlotPick: vi.fn() }, {});
    importer.init();
  });

  afterEach(() => {
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  it('records a failed parse with producer none', async () => {
    const track = vi.spyOn(TelemetryService, 'track').mockImplementation(() => {});
    vi.spyOn(ToastService, 'error').mockImplementation(() => 'toast');
    await (importer as unknown as LoadFile).loadFile(fileOfSize(10, '{"not":"a chara"}'));
    expect(track).toHaveBeenCalledWith('chara_parse', { ok: false, producer: 'none' });
  });

  it('records a successful parse with the normalised producer', async () => {
    const track = vi.spyOn(TelemetryService, 'track').mockImplementation(() => {});
    await (importer as unknown as LoadFile).loadFile(fileOfSize(10, ANAMNESIS_FIXTURE));
    expect(track).toHaveBeenCalledWith('chara_parse', { ok: true, producer: 'anamnesis' });
  });

  it('records a successful parse even when a host callback throws (a host bug is not a parse failure)', async () => {
    const track = vi.spyOn(TelemetryService, 'track').mockImplementation(() => {});
    const host = createTestContainer('chara-host-throwing');
    const throwing = new CharaImport(
      host,
      {
        onSlotPick: vi.fn(),
        onResolved: () => {
          throw new Error('host bug');
        },
      },
      {}
    );
    throwing.init();
    try {
      await (throwing as unknown as LoadFile).loadFile(fileOfSize(10, ANAMNESIS_FIXTURE));
    } finally {
      throwing.destroy();
      cleanupTestContainer(host);
    }
    expect(track).toHaveBeenCalledWith('chara_parse', { ok: true, producer: 'anamnesis' });
    expect(track).not.toHaveBeenCalledWith('chara_parse', expect.objectContaining({ ok: false }));
  });

  it('does not record a parse when the file cannot be read (stale handle)', async () => {
    const track = vi.spyOn(TelemetryService, 'track').mockImplementation(() => {});
    const errorSpy = vi.spyOn(ToastService, 'error').mockImplementation(() => 'toast');
    const file = fileOfSize(10, '{}');
    vi.spyOn(file, 'text').mockRejectedValue(new Error('file changed on disk'));

    await (importer as unknown as LoadFile).loadFile(file);

    expect(track).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('does not count a size-refused file as a parse', async () => {
    const track = vi.spyOn(TelemetryService, 'track').mockImplementation(() => {});
    vi.spyOn(ToastService, 'error').mockImplementation(() => 'toast');
    await (importer as unknown as LoadFile).loadFile(fileOfSize(MAX_USER_FILE_BYTES + 1));
    expect(track).not.toHaveBeenCalled();
  });
});
