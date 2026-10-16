/**
 * loadCharaFile — the `.chara` loader behind the file card.
 *
 * Name and size guards: the loader used to read `file.text()` of any size and
 * hand it to the parser; a multi-GB drop would hang the tab (self-DoS,
 * 2026-08-21 security audit, WEB-13), and the drop zone took a `.pose` as
 * readily as a `.chara` (FINDING-001, 2026-10-15 import review). It now
 * refuses a file not named `*.chara`, then one over core's 8 KiB
 * `MAX_CHARA_FILE_BYTES`, before reading either. Telemetry: one `chara_parse`
 * per file that reached the parser, never for one refused or unreadable
 * before it.
 *
 * Real services (LanguageService and the dye database are initialised in
 * setup.ts); nothing here reaches the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadCharaFile } from '../chara-file-loader';
import { CharaSessionService } from '../chara-session-service';
import { TelemetryService } from '../telemetry-service';
import { MAX_CHARA_FILE_BYTES } from '@xivdyetools/core';

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
  it('is 8 KiB', () => {
    expect(MAX_CHARA_FILE_BYTES).toBe(8_192);
  });

  it('refuses a file over the cap before reading it', async () => {
    const file = fileOfSize(MAX_CHARA_FILE_BYTES + 1);
    const textSpy = vi.spyOn(file, 'text');

    const result = await loadCharaFile(file);

    expect(result).toEqual({ ok: false, error: 'tooLarge' });
    expect(textSpy).not.toHaveBeenCalled();
    expect(CharaSessionService.getSession()).toBeNull();
  });

  it('still reads a file at the cap', async () => {
    const file = fileOfSize(MAX_CHARA_FILE_BYTES, JSON.stringify({ TypeName: 'x' }));
    const textSpy = vi.spyOn(file, 'text');

    const result = await loadCharaFile(file);

    expect(textSpy).toHaveBeenCalledTimes(1);
    expect(result).not.toEqual({ ok: false, error: 'tooLarge' });
  });

  it('counts bytes, not characters: 3,000 kana are 9,000 bytes', async () => {
    const text = JSON.stringify({ Nickname: 'ア'.repeat(3_000), REyeColor: 42 });
    const file = new File([text], 'kana.chara');
    expect(text.length).toBeLessThan(MAX_CHARA_FILE_BYTES);
    expect(file.size).toBeGreaterThan(MAX_CHARA_FILE_BYTES);

    expect(await loadCharaFile(file)).toEqual({ ok: false, error: 'tooLarge' });
  });

  it('keeps the loaded character when a refused file is dropped on top of it', async () => {
    await loadCharaFile(fileOfSize(10, ANAMNESIS_FIXTURE, 'first.chara'));
    const before = CharaSessionService.getSession();

    await loadCharaFile(fileOfSize(MAX_CHARA_FILE_BYTES + 1));

    expect(CharaSessionService.getSession()).toBe(before);
  });
});

/**
 * FINDING-001 (2026-10-15 import review): the drop zone forwarded any first
 * file, so a dropped `.pose` was read and parsed before it failed. The check
 * is on the name, case-insensitive, never on `file.type`: browsers report ''
 * for `.chara`, which has no registered MIME type.
 */
describe('loadCharaFile — name guard', () => {
  it.each([
    'Trick & Treat Duo (L).pose',
    'look.png',
    'look.chara.png',
    'look.json',
    'look.txt',
    'chara',
    'look',
  ])('refuses %s before reading it', async (name) => {
    const file = fileOfSize(10, ANAMNESIS_FIXTURE, name);
    const textSpy = vi.spyOn(file, 'text');
    const track = vi.spyOn(TelemetryService, 'track').mockImplementation(() => {});

    expect(await loadCharaFile(file)).toEqual({ ok: false, error: 'notChara' });
    expect(textSpy).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    expect(CharaSessionService.getSession()).toBeNull();
  });

  it.each(['look.chara', 'LOOK.CHARA', 'look.Chara', 'look.png.chara'])(
    'reads %s',
    async (name) => {
      expect(await loadCharaFile(fileOfSize(10, ANAMNESIS_FIXTURE, name))).toEqual({ ok: true });
    }
  );

  it('reads a .chara whose MIME type the browser left empty', async () => {
    const file = new File([ANAMNESIS_FIXTURE], 'look.chara');
    expect(file.type).toBe('');
    expect(await loadCharaFile(file)).toEqual({ ok: true });
  });

  it('checks the name before the size', async () => {
    expect(await loadCharaFile(fileOfSize(MAX_CHARA_FILE_BYTES + 1, '{}', 'huge.pose'))).toEqual({
      ok: false,
      error: 'notChara',
    });
  });

  it('still parses a renamed pose and refuses it for its content', async () => {
    const pose = JSON.stringify({ FileExtension: '.pose', TypeName: 'Anamnesis Pose', Bones: {} });
    const result = await loadCharaFile(fileOfSize(10, pose, 'renamed.chara'));
    expect(result).toMatchObject({ ok: false, error: 'failed' });
    if (!result.ok && result.error === 'failed')
      expect(result.reason).toMatch(/no character colour fields/);
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
    await loadCharaFile(fileOfSize(MAX_CHARA_FILE_BYTES + 1));
    expect(track).not.toHaveBeenCalled();
  });
});

/** A file whose read finishes only when the test says so. */
function slowFile(name: string) {
  const file = new File(['{}'], name, { type: 'application/json' });
  const read: { finish?: (text: string) => void; fail?: (error: Error) => void } = {};
  Object.defineProperty(file, 'text', {
    value: () =>
      new Promise<string>((resolve, reject) => {
        read.finish = resolve;
        read.fail = reject;
      }),
  });
  return { file, read };
}

describe('loadCharaFile — overlapping loads', () => {
  it('the newest file wins even when an older one finishes last', async () => {
    const track = vi.spyOn(TelemetryService, 'track').mockImplementation(() => {});
    const older = slowFile('older.chara');
    const olderLoad = loadCharaFile(older.file);

    const newer = await loadCharaFile(fileOfSize(10, ANAMNESIS_FIXTURE, 'newer.chara'));
    older.read.finish!(ANAMNESIS_FIXTURE);

    expect(newer).toEqual({ ok: true });
    expect(await olderLoad).toEqual({ ok: false, error: 'superseded' });
    expect(CharaSessionService.getSession()?.fileName).toBe('newer.chara');
    // Replaced while it was still being read, the older file is never parsed,
    // so only the newer parse is counted.
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('does not report a failure for a file a newer one replaced', async () => {
    const older = slowFile('older.chara');
    const olderLoad = loadCharaFile(older.file);

    await loadCharaFile(fileOfSize(10, ANAMNESIS_FIXTURE, 'newer.chara'));
    older.read.fail!(new Error('file changed on disk'));

    expect(await olderLoad).toEqual({ ok: false, error: 'superseded' });
    expect(CharaSessionService.getSession()?.fileName).toBe('newer.chara');
  });

  it.each([
    ['a file that is not a .chara', () => fileOfSize(10, '{}', 'look.pose')],
    ['an oversized .chara', () => fileOfSize(MAX_CHARA_FILE_BYTES + 1)],
  ])('a refused drop (%s) does not cancel a .chara still loading', async (_case, refused) => {
    const pending = slowFile('pending.chara');
    const pendingLoad = loadCharaFile(pending.file);

    expect((await loadCharaFile(refused())).ok).toBe(false);
    pending.read.finish!(ANAMNESIS_FIXTURE);

    expect(await pendingLoad).toEqual({ ok: true });
    expect(CharaSessionService.getSession()?.fileName).toBe('pending.chara');
  });
});
