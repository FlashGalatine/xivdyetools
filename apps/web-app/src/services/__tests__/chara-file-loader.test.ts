/**
 * loadCharaFile — the `.chara` loader behind the file card.
 *
 * Size guard: the loader used to read `file.text()` of any size and hand it to
 * the parser; a multi-GB drop would hang the tab (self-DoS, 2026-08-21
 * security audit, WEB-13). It now refuses a file over the shared cap before
 * reading it. Telemetry: one `chara_parse` per file that reached the parser,
 * never for one refused or unreadable before it.
 *
 * Real services (LanguageService and the dye database are initialised in
 * setup.ts); nothing here reaches the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadCharaFile } from '../chara-file-loader';
import { CharaSessionService } from '../chara-session-service';
import { TelemetryService } from '../telemetry-service';
import { MAX_USER_FILE_BYTES } from '@shared/constants';

/**
 * Galatine-shaped Anamnesis fixture (same shape as glamour-block.test.ts's
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

/** A File whose reported size is `size` bytes without allocating them. */
function fileOfSize(size: number, content = '{}', name = 'huge.chara'): File {
  const file = new File([content], name, { type: 'application/json' });
  Object.defineProperty(file, 'size', { value: size });
  if (typeof (file as Blob).text !== 'function') {
    (file as unknown as { text: () => Promise<string> }).text = () => Promise.resolve(content);
  }
  return file;
}

beforeEach(() => {
  CharaSessionService.setSession(null);
});

afterEach(() => {
  CharaSessionService.setSession(null);
  vi.restoreAllMocks();
});

describe('loadCharaFile — size guard (WEB-13)', () => {
  it('refuses a file over the cap before reading it', async () => {
    const file = fileOfSize(MAX_USER_FILE_BYTES + 1);
    const textSpy = vi.spyOn(file, 'text');

    const result = await loadCharaFile(file);

    expect(result).toEqual({ ok: false, error: 'tooLarge' });
    expect(textSpy).not.toHaveBeenCalled();
    expect(CharaSessionService.getSession()).toBeNull();
  });

  it('still reads a file at the cap', async () => {
    const file = fileOfSize(MAX_USER_FILE_BYTES, JSON.stringify({ TypeName: 'x' }));
    const textSpy = vi.spyOn(file, 'text');

    const result = await loadCharaFile(file);

    expect(textSpy).toHaveBeenCalledTimes(1);
    expect(result).not.toEqual({ ok: false, error: 'tooLarge' });
  });
});

describe('loadCharaFile — the session', () => {
  it('makes a parsed file the loaded character, under its file name', async () => {
    const listener = vi.fn();
    const unsubscribe = CharaSessionService.subscribe(listener);

    const result = await loadCharaFile(fileOfSize(10, ANAMNESIS_FIXTURE, 'galatine.chara'));
    unsubscribe();

    expect(result).toEqual({ ok: true });
    const session = CharaSessionService.getSession();
    expect(session?.fileName).toBe('galatine.chara');
    expect(session?.resolved.producer).toBe('Anamnesis Character File');
    // Subscribers have heard about it by the time the load resolves.
    expect(listener).toHaveBeenCalledWith(session);
  });

  it("keeps core's reason for a parse failure, and leaves the loaded file alone", async () => {
    await loadCharaFile(fileOfSize(10, ANAMNESIS_FIXTURE, 'first.chara'));
    const before = CharaSessionService.getSession();

    const result = await loadCharaFile(fileOfSize(10, '{ not json', 'broken.chara'));

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: 'failed' });
    expect((result as { reason: string }).reason.length).toBeGreaterThan(0);
    expect(CharaSessionService.getSession()).toBe(before);
  });

  it('reports an unreadable file (a stale handle) as a failure with its reason', async () => {
    const file = fileOfSize(10, '{}');
    vi.spyOn(file, 'text').mockRejectedValue(new Error('file changed on disk'));

    const result = await loadCharaFile(file);

    expect(result).toEqual({ ok: false, error: 'failed', reason: 'file changed on disk' });
    expect(CharaSessionService.getSession()).toBeNull();
  });
});

describe('loadCharaFile — telemetry', () => {
  it('records a failed parse with producer none', async () => {
    const track = vi.spyOn(TelemetryService, 'track').mockImplementation(() => {});
    await loadCharaFile(fileOfSize(10, '{"not":"a chara"}'));
    expect(track).toHaveBeenCalledWith('chara_parse', { ok: false, producer: 'none' });
  });

  it('records a successful parse with the normalised producer', async () => {
    const track = vi.spyOn(TelemetryService, 'track').mockImplementation(() => {});
    await loadCharaFile(fileOfSize(10, ANAMNESIS_FIXTURE));
    expect(track).toHaveBeenCalledWith('chara_parse', { ok: true, producer: 'anamnesis' });
  });

  it('records a successful parse even when a subscriber throws (a consumer bug is not a parse failure)', async () => {
    const track = vi.spyOn(TelemetryService, 'track').mockImplementation(() => {});
    const unsubscribe = CharaSessionService.subscribe(() => {
      throw new Error('consumer bug');
    });
    try {
      const result = await loadCharaFile(fileOfSize(10, ANAMNESIS_FIXTURE));
      expect(result).toEqual({ ok: true });
    } finally {
      unsubscribe();
    }
    expect(track).toHaveBeenCalledWith('chara_parse', { ok: true, producer: 'anamnesis' });
    expect(track).not.toHaveBeenCalledWith('chara_parse', expect.objectContaining({ ok: false }));
  });

  it('does not record a parse when the file cannot be read (stale handle)', async () => {
    const track = vi.spyOn(TelemetryService, 'track').mockImplementation(() => {});
    const file = fileOfSize(10, '{}');
    vi.spyOn(file, 'text').mockRejectedValue(new Error('file changed on disk'));

    await loadCharaFile(file);

    expect(track).not.toHaveBeenCalled();
  });

  it('does not count a size-refused file as a parse', async () => {
    const track = vi.spyOn(TelemetryService, 'track').mockImplementation(() => {});
    await loadCharaFile(fileOfSize(MAX_USER_FILE_BYTES + 1));
    expect(track).not.toHaveBeenCalled();
  });
});
