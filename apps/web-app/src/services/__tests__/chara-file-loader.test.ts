/**
 * loadCharaFile / cancelCharaLoad — the `.chara` loader behind the file card.
 *
 * Name and size guards (WEB-13, FINDING-001 of the 2026-10-15 import review): a file not named
 * `*.chara`, then one over core's 8 KiB `MAX_CHARA_FILE_BYTES`, is refused before any byte is read,
 * and a refused drop never disturbs an import still in flight. The read itself is capped
 * (`file.slice(0, MAX + 1)`), so a file that grows after the size check is still refused.
 *
 * The bytes then go to the inspection service (a worker; Task 4). The service is mocked here with
 * controllable deferreds, so each test decides when a read or an inspection finishes. Only the
 * newest admitted file may publish: the generation check runs around both the read and the
 * inspection, and `cancelCharaLoad()` (SWAP) invalidates both.
 *
 * Failures are fixed codes only (no exception text), the last valid session survives every one of
 * them, and `chara_parse` telemetry records `ok:false` only for a file the inspection refused.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MAX_CHARA_FILE_BYTES, type ImportedCharaCharacter } from '@xivdyetools/core';
import { logger } from '@shared/logger';
import { cancelCharaLoad, loadCharaFile } from '../chara-file-loader';
import { CharaSessionService } from '../chara-session-service';
import { TelemetryService } from '../telemetry-service';
import { CharaInspectionError } from '../chara-inspection-service';
import { validateImportedCharacter } from '../chara-inspection-protocol';
import { dyeService } from '../dye-service-wrapper';
import { makeImportedCharacter, makeImportedSlot } from '../../__tests__/mocks/imported-chara';

const { inspect, cancel } = vi.hoisted(() => ({ inspect: vi.fn(), cancel: vi.fn() }));
vi.mock('../chara-inspection-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../chara-inspection-service')>()),
  inspectCharaBytes: inspect,
  cancelCharaInspection: cancel,
}));

const NAME_CANARY = 'FILE-CANARY-4e1d';
const NICK_CANARY = 'NICK-CANARY-90ab';
const RAW_CANARY = 'RAW-CANARY-77c2';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A `.chara` file of `content`; `size` overrides the reported size without allocating it. */
function charaFile(name = 'look.chara', content = '{"REyeColor":42}', size?: number): File {
  const file = new File([content], name);
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  return file;
}

/** A file whose capped read finishes (or fails) only when the test says so. */
function slowFile(name: string) {
  const file = charaFile(name);
  const read = deferred<ArrayBuffer>();
  const slice = vi.fn(() => ({ arrayBuffer: () => read.promise }));
  Object.defineProperty(file, 'slice', { value: slice });
  return { file, read, slice };
}

const bytes = (n = 16): ArrayBuffer => new ArrayBuffer(n);

/** Every argument handed to the (mocked) app logger, serialized. */
function loggedText(): string {
  return (['debug', 'info', 'warn', 'error', 'log'] as const)
    .flatMap((method) => vi.mocked(logger[method]).mock.calls)
    .map((args) => args.map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : String(a))))
    .join('\n');
}

let track: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  CharaSessionService.setSession(null);
  inspect.mockReset();
  cancel.mockReset();
  inspect.mockImplementation(() => Promise.resolve(makeImportedCharacter()));
  for (const method of ['debug', 'info', 'warn', 'error', 'log'] as const) {
    vi.mocked(logger[method]).mockClear();
  }
  track = vi.spyOn(TelemetryService, 'track').mockImplementation(() => {});
});

afterEach(() => {
  cancelCharaLoad();
  CharaSessionService.setSession(null);
  vi.restoreAllMocks();
});

describe('loadCharaFile — name guard (FINDING-001)', () => {
  it.each([
    'Trick & Treat Duo (L).pose',
    'look.png',
    'look.chara.png',
    'look.json',
    'look.txt',
    'chara',
    'look',
  ])('refuses %s before reading it', async (name) => {
    const file = charaFile(name);
    const slice = vi.spyOn(file, 'slice');

    expect(await loadCharaFile(file)).toEqual({ ok: false, error: 'notChara' });
    expect(slice).not.toHaveBeenCalled();
    expect(inspect).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    expect(CharaSessionService.getSession()).toBeNull();
  });

  it.each(['look.chara', 'LOOK.CHARA', 'look.Chara', 'look.png.chara'])(
    'reads %s',
    async (name) => {
      expect(await loadCharaFile(charaFile(name))).toEqual({ ok: true });
    }
  );

  it('reads a .chara whose MIME type the browser left empty', async () => {
    const file = new File(['{}'], 'look.chara');
    expect(file.type).toBe('');
    expect(await loadCharaFile(file)).toEqual({ ok: true });
  });

  it('checks the name before the size', async () => {
    expect(await loadCharaFile(charaFile('huge.pose', '{}', MAX_CHARA_FILE_BYTES + 1))).toEqual({
      ok: false,
      error: 'notChara',
    });
  });
});

describe('loadCharaFile — size guard (WEB-13)', () => {
  it('is 8 KiB', () => {
    expect(MAX_CHARA_FILE_BYTES).toBe(8_192);
  });

  it('refuses a file over the cap before reading it', async () => {
    const file = charaFile('huge.chara', '{}', MAX_CHARA_FILE_BYTES + 1);
    const slice = vi.spyOn(file, 'slice');

    expect(await loadCharaFile(file)).toEqual({ ok: false, error: 'tooLarge' });
    expect(slice).not.toHaveBeenCalled();
    expect(inspect).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    expect(CharaSessionService.getSession()).toBeNull();
  });

  it('reads a file at the cap, through a capped slice', async () => {
    const file = charaFile('at-cap.chara', 'x'.repeat(MAX_CHARA_FILE_BYTES));
    const slice = vi.spyOn(file, 'slice');

    expect(await loadCharaFile(file)).toEqual({ ok: true });
    expect(slice).toHaveBeenCalledWith(0, MAX_CHARA_FILE_BYTES + 1);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect((inspect.mock.calls[0]![0] as ArrayBuffer).byteLength).toBe(MAX_CHARA_FILE_BYTES);
  });

  it('counts bytes, not characters: 3,000 kana are 9,000 bytes', async () => {
    const text = JSON.stringify({ Nickname: 'ア'.repeat(3_000), REyeColor: 42 });
    const file = new File([text], 'kana.chara');
    expect(text.length).toBeLessThan(MAX_CHARA_FILE_BYTES);
    expect(file.size).toBeGreaterThan(MAX_CHARA_FILE_BYTES);

    expect(await loadCharaFile(file)).toEqual({ ok: false, error: 'tooLarge' });
  });

  it('refuses a file that grew after the size check (the read is capped, not trusted)', async () => {
    // Reports 10 bytes, but its contents run past the cap: the capped read yields MAX + 1.
    const file = charaFile('grew.chara', 'x'.repeat(MAX_CHARA_FILE_BYTES + 800), 10);

    expect(await loadCharaFile(file)).toEqual({ ok: false, error: 'tooLarge' });
    expect(inspect).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    expect(CharaSessionService.getSession()).toBeNull();
  });

  it('keeps the loaded character when a refused file is dropped on top of it', async () => {
    await loadCharaFile(charaFile('first.chara'));
    const before = CharaSessionService.getSession();

    await loadCharaFile(charaFile('huge.chara', '{}', MAX_CHARA_FILE_BYTES + 1));
    await loadCharaFile(charaFile('look.png'));

    expect(CharaSessionService.getSession()).toBe(before);
  });
});

describe('loadCharaFile — the session', () => {
  it('publishes the inspection result as is, under the file name, before resolving', async () => {
    const result = makeImportedCharacter({ nickname: 'Test Subject' });
    inspect.mockResolvedValueOnce(result);
    const listener = vi.fn();
    const unsubscribe = CharaSessionService.subscribe(listener);

    expect(await loadCharaFile(charaFile('galatine.chara'))).toEqual({ ok: true });
    unsubscribe();

    const session = CharaSessionService.getSession();
    expect(session?.fileName).toBe('galatine.chara');
    expect(session?.resolved).toBe(result);
    expect(listener).toHaveBeenCalledWith(session);
  });

  it('hands the inspection the bytes it read', async () => {
    const content = '{"REyeColor":42,"LEyeColor":7}';
    await loadCharaFile(charaFile('bytes.chara', content));

    const sent = inspect.mock.calls[0]![0] as ArrayBuffer;
    expect(new TextDecoder().decode(sent)).toBe(content);
  });

  it("keeps the service's dye objects: no rehydration in the loader", async () => {
    const dye = dyeService.getByStainId(6)!;
    const result = makeImportedCharacter({
      gearDyes: [{ slot: 'Body', channel: 1, stainId: 6, dye }],
      gearModels: [{ slot: 'Body', base: 9903, variant: 1 }],
    });
    inspect.mockResolvedValueOnce(result);

    await loadCharaFile(charaFile('dyed.chara'));

    const gearDyes = CharaSessionService.getSession()!.resolved.gearDyes;
    expect(gearDyes).toBe(result.gearDyes);
    expect(gearDyes[0]!.dye).toBe(dye);
  });

  it('caps the file name at 256 UTF-16 units', async () => {
    const name = `${'n'.repeat(300)}.chara`;

    expect(await loadCharaFile(charaFile(name))).toEqual({ ok: true });

    const fileName = CharaSessionService.getSession()!.fileName;
    expect(fileName).toHaveLength(256);
    expect(name.startsWith(fileName)).toBe(true);
  });

  it("passes the adapter's 256-unit nickname through unchanged", async () => {
    const nickname = 'N'.repeat(256);
    inspect.mockResolvedValueOnce(makeImportedCharacter({ nickname }));

    await loadCharaFile(charaFile('nick.chara'));

    expect(CharaSessionService.getSession()!.resolved.nickname).toBe(nickname);
  });

  it('the factory builds a character the page validator accepts', () => {
    const character: ImportedCharaCharacter = makeImportedCharacter({
      slots: { highlights: { active: null, reason: 'activityUnknown' } },
    });
    expect(validateImportedCharacter(character)).not.toBeNull();
    expect(character.slots[3]!.matchHex).toBeNull();
    expect(makeImportedSlot().matchHex).toBe(makeImportedSlot().displayHex);
  });
});

describe('loadCharaFile — failures are fixed codes, and the last valid session survives', () => {
  it.each(['unreadable', 'workerFailed', 'timedOut'] as const)(
    'an inspection that fails %s returns only that code and keeps the loaded file',
    async (code) => {
      await loadCharaFile(charaFile('first.chara'));
      const before = CharaSessionService.getSession();
      inspect.mockRejectedValueOnce(new CharaInspectionError(code));

      const result = await loadCharaFile(charaFile('broken.chara'));

      expect(result).toEqual({ ok: false, error: code });
      expect(Object.keys(result).sort()).toEqual(['error', 'ok']);
      expect(CharaSessionService.getSession()).toBe(before);
    }
  );

  it('an unexpected throw from the inspection is workerFailed, and its text goes nowhere', async () => {
    inspect.mockRejectedValueOnce(new Error(`boom ${RAW_CANARY}`));

    const result = await loadCharaFile(charaFile('odd.chara'));

    expect(result).toEqual({ ok: false, error: 'workerFailed' });
    expect(JSON.stringify(result)).not.toContain(RAW_CANARY);
    expect(loggedText()).not.toContain(RAW_CANARY);
  });

  it('a file that cannot be read (stale handle) is unreadable, with no exception text', async () => {
    await loadCharaFile(charaFile('first.chara'));
    const before = CharaSessionService.getSession();
    const stale = slowFile('stale.chara');
    const load = loadCharaFile(stale.file);
    stale.read.reject(new Error(`file changed on disk ${RAW_CANARY}`));

    const result = await load;

    expect(result).toEqual({ ok: false, error: 'unreadable' });
    expect(Object.keys(result).sort()).toEqual(['error', 'ok']);
    expect(CharaSessionService.getSession()).toBe(before);
    expect(inspect).toHaveBeenCalledTimes(1); // the first file only
    expect(loggedText()).not.toContain(RAW_CANARY);
  });
});

describe('loadCharaFile — telemetry (D8)', () => {
  it('records a refused file with producer none', async () => {
    inspect.mockRejectedValueOnce(new CharaInspectionError('unreadable'));
    await loadCharaFile(charaFile());
    expect(track).toHaveBeenCalledWith('chara_parse', { ok: false, producer: 'none' });
    expect(track).toHaveBeenCalledTimes(1);
  });

  it.each(['workerFailed', 'timedOut'] as const)(
    'records nothing for %s (not a parse outcome)',
    async (code) => {
      inspect.mockRejectedValueOnce(new CharaInspectionError(code));
      await loadCharaFile(charaFile());
      expect(track).not.toHaveBeenCalled();
    }
  );

  it('records nothing when the file cannot be read (stale handle)', async () => {
    const stale = slowFile('stale.chara');
    const load = loadCharaFile(stale.file);
    stale.read.reject(new Error('file changed on disk'));
    await load;
    expect(track).not.toHaveBeenCalled();
  });

  it('records a successful parse with the normalized producer', async () => {
    await loadCharaFile(charaFile());
    expect(track).toHaveBeenCalledWith('chara_parse', { ok: true, producer: 'anamnesis' });
  });

  it('records a successful parse even when a subscriber throws (a consumer bug is not a parse failure)', async () => {
    const unsubscribe = CharaSessionService.subscribe(() => {
      throw new Error('consumer bug');
    });
    try {
      expect(await loadCharaFile(charaFile())).toEqual({ ok: true });
    } finally {
      unsubscribe();
    }
    expect(track).toHaveBeenCalledWith('chara_parse', { ok: true, producer: 'anamnesis' });
    expect(track).not.toHaveBeenCalledWith('chara_parse', expect.objectContaining({ ok: false }));
  });
});

describe('loadCharaFile — logs carry no labels', () => {
  it('logs neither the file name, the nickname nor the producer text', async () => {
    inspect.mockResolvedValueOnce(
      makeImportedCharacter({ nickname: NICK_CANARY, producer: `${RAW_CANARY} Character File` })
    );
    await loadCharaFile(charaFile(`${NAME_CANARY}.chara`));
    inspect.mockRejectedValueOnce(new CharaInspectionError('unreadable'));
    await loadCharaFile(charaFile(`${NAME_CANARY}-2.chara`));

    const text = loggedText();
    expect(text).not.toContain(NAME_CANARY);
    expect(text).not.toContain(NICK_CANARY);
    expect(text).not.toContain(RAW_CANARY);
  });
});

describe('loadCharaFile — overlapping loads and clears', () => {
  it('two overlapping reads: the older read finishing last never reaches the inspection', async () => {
    const older = slowFile('older.chara');
    const olderLoad = loadCharaFile(older.file);

    expect(await loadCharaFile(charaFile('newer.chara'))).toEqual({ ok: true });
    older.read.resolve(bytes());

    expect(await olderLoad).toEqual({ ok: false, error: 'superseded' });
    // Starting the inspection would cancel the newer file's worker: it must not be called.
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(CharaSessionService.getSession()?.fileName).toBe('newer.chara');
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('a read failure on a replaced file is superseded, not unreadable', async () => {
    const older = slowFile('older.chara');
    const olderLoad = loadCharaFile(older.file);

    await loadCharaFile(charaFile('newer.chara'));
    older.read.reject(new Error('file changed on disk'));

    expect(await olderLoad).toEqual({ ok: false, error: 'superseded' });
    expect(CharaSessionService.getSession()?.fileName).toBe('newer.chara');
  });

  it('replacement during worker work: the service supersedes the older call; the newer publishes', async () => {
    const olderInspection = deferred<ImportedCharaCharacter>();
    inspect.mockImplementationOnce(() => olderInspection.promise);
    const olderLoad = loadCharaFile(charaFile('older.chara'));
    await vi.waitFor(() => expect(inspect).toHaveBeenCalledTimes(1));

    // The real service rejects the pending call `superseded` when the next one starts.
    inspect.mockImplementationOnce(() => {
      olderInspection.reject(new CharaInspectionError('superseded'));
      return Promise.resolve(makeImportedCharacter({ nickname: 'Newer' }));
    });
    expect(await loadCharaFile(charaFile('newer.chara'))).toEqual({ ok: true });

    expect(await olderLoad).toEqual({ ok: false, error: 'superseded' });
    expect(CharaSessionService.getSession()?.fileName).toBe('newer.chara');
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('an older inspection that resolves late, after a newer file, never publishes', async () => {
    const olderInspection = deferred<ImportedCharaCharacter>();
    inspect.mockImplementationOnce(() => olderInspection.promise);
    const olderLoad = loadCharaFile(charaFile('older.chara'));
    await vi.waitFor(() => expect(inspect).toHaveBeenCalledTimes(1));

    await loadCharaFile(charaFile('newer.chara'));
    olderInspection.resolve(makeImportedCharacter({ nickname: 'Older' }));

    expect(await olderLoad).toEqual({ ok: false, error: 'superseded' });
    expect(CharaSessionService.getSession()?.fileName).toBe('newer.chara');
    expect(CharaSessionService.getSession()?.resolved.nickname).not.toBe('Older');
  });

  it('an older inspection that fails after a newer file says nothing and records nothing', async () => {
    const olderInspection = deferred<ImportedCharaCharacter>();
    inspect.mockImplementationOnce(() => olderInspection.promise);
    const olderLoad = loadCharaFile(charaFile('older.chara'));
    await vi.waitFor(() => expect(inspect).toHaveBeenCalledTimes(1));

    await loadCharaFile(charaFile('newer.chara'));
    track.mockClear();
    olderInspection.reject(new CharaInspectionError('unreadable'));

    expect(await olderLoad).toEqual({ ok: false, error: 'superseded' });
    expect(track).not.toHaveBeenCalled();
  });

  it('clear during worker work: cancels the inspection, and a late result never publishes', async () => {
    const pending = deferred<ImportedCharaCharacter>();
    inspect.mockImplementationOnce(() => pending.promise);
    const load = loadCharaFile(charaFile('pending.chara'));
    await vi.waitFor(() => expect(inspect).toHaveBeenCalledTimes(1));

    cancelCharaLoad();
    CharaSessionService.setSession(null);
    expect(cancel).toHaveBeenCalledTimes(1);
    // Even if the inspection answers anyway, the cleared load stays cleared.
    pending.resolve(makeImportedCharacter());

    expect(await load).toEqual({ ok: false, error: 'superseded' });
    expect(CharaSessionService.getSession()).toBeNull();
    expect(track).not.toHaveBeenCalled();
  });

  it('clear during the read: the file is never inspected', async () => {
    const slow = slowFile('slow.chara');
    const load = loadCharaFile(slow.file);

    cancelCharaLoad();
    slow.read.resolve(bytes());

    expect(await load).toEqual({ ok: false, error: 'superseded' });
    expect(inspect).not.toHaveBeenCalled();
    expect(CharaSessionService.getSession()).toBeNull();
  });

  it.each([
    ['a file that is not a .chara', () => charaFile('look.pose')],
    ['an oversized .chara', () => charaFile('huge.chara', '{}', MAX_CHARA_FILE_BYTES + 1)],
  ])('a refused drop (%s) does not cancel a .chara in the worker', async (_case, refused) => {
    const pending = deferred<ImportedCharaCharacter>();
    inspect.mockImplementationOnce(() => pending.promise);
    const pendingLoad = loadCharaFile(charaFile('pending.chara'));
    await vi.waitFor(() => expect(inspect).toHaveBeenCalledTimes(1));

    expect((await loadCharaFile(refused())).ok).toBe(false);
    expect(cancel).not.toHaveBeenCalled();
    pending.resolve(makeImportedCharacter());

    expect(await pendingLoad).toEqual({ ok: true });
    expect(CharaSessionService.getSession()?.fileName).toBe('pending.chara');
  });

  it.each([
    ['a file that is not a .chara', () => charaFile('look.pose')],
    ['an oversized .chara', () => charaFile('huge.chara', '{}', MAX_CHARA_FILE_BYTES + 1)],
  ])('a refused drop (%s) does not cancel a .chara still being read', async (_case, refused) => {
    const pending = slowFile('pending.chara');
    const pendingLoad = loadCharaFile(pending.file);

    expect((await loadCharaFile(refused())).ok).toBe(false);
    pending.read.resolve(bytes());

    expect(await pendingLoad).toEqual({ ok: true });
    expect(CharaSessionService.getSession()?.fileName).toBe('pending.chara');
  });
});
