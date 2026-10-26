/**
 * The `.chara` inspection worker (Task 4, palette bridge per the 2026-10-26 ruling), run against the
 * REAL core facade: `inspectCharaForTools` (8,192-byte cap) → `resolveCharaWithProvider(inspection,
 * palettes)` with NO dye lookup (the palette-free entry: `resolveCharaForTools` would pull the shader
 * tables into the worker's bundle). The worker loads no palette or dye data of its own: in a real
 * worker scope it asks the page for each color (`palette` messages) and the page attaches dyes.
 *
 * `inspectCharaForTools` and `resolveCharaWithProvider` are wrapped in pass-through `vi.fn`s so a test can
 * force one throw, capture the provider the worker passes, or hold the projection open; every other
 * test runs the real functions.
 *
 * The answer is `{ type: 'success', id, result }` or `{ type: 'error', id, code }` with code
 * `unreadable` (core refused the input: the throw carries one of the library's input-refusal codes)
 * or `workerFailed` (anything unexpected). No raw message or exception text ever crosses the boundary.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  CharacterColorService,
  createCharaPaletteProvider,
  inspectCharaForTools,
  resolveCharaWithProvider,
  type CharaPaletteProvider,
  type ImportedCharaCharacter,
} from '@xivdyetools/core';
import { logger } from '@shared/logger';
import { handleInspectRequest } from '../chara-inspection.worker';
import {
  isPaletteRequestMessage,
  validateImportedCharacter,
  type CharaPaletteColor,
  type CharaPaletteRequest,
} from '../../services/chara-inspection-protocol';

vi.mock('@xivdyetools/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xivdyetools/core')>();
  return {
    ...actual,
    inspectCharaForTools: vi.fn(actual.inspectCharaForTools),
    resolveCharaWithProvider: vi.fn(actual.resolveCharaWithProvider),
  };
});

type CoreModule = typeof import('@xivdyetools/core');

// A path, not `new URL('<literal>', import.meta.url)`: Vite's asset plugin rewrites that pattern
// to a dev-server http:// URL under vitest, which fileURLToPath refuses.
const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(
  HERE,
  '../../../../../packages/core/src/services/chara/__tests__/fixtures'
);
const WORKER_SOURCE = resolve(HERE, '../chara-inspection.worker.ts');
const FIXTURES = [
  'duskwight-heterochromia.chara',
  'hrothgar-helions.chara',
  'lalafell-dunesfolk.chara',
  'wildwood-facepaint.chara',
  'xaela-anamnesis-header.chara',
] as const;
const MAX_BYTES = 8_192;
/** CHARA_PALETTE_REQUEST_CAP, as a literal so the behavior tests do not depend on the export. */
const CAP = 64;
const CANARY = 'UNEXPECTED-WORKER-CANARY-91c2';

const EYES: CharaPaletteRequest = {
  table: 'creator',
  palette: 'eyes',
  index: 0,
  tribe: 'Dunesfolk',
  gender: 'Feminine',
};
const SHADER_EYES: CharaPaletteRequest = { ...EYES, table: 'shader', index: 1 };
const HAIR: CharaPaletteRequest = {
  table: 'creator',
  palette: 'hair',
  index: 4,
  tribe: 'Dunesfolk',
  gender: 'Feminine',
};

function fixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(FIXTURE_DIR, name)));
}

/** A standalone ArrayBuffer holding exactly these bytes (what the page transfers). */
function bufferOf(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

/** The fixture padded with trailing JSON whitespace to exactly `size` bytes. */
function paddedTo(size: number): ArrayBuffer {
  const fixture = fixtureBytes('lalafell-dunesfolk.chara');
  const padded = new Uint8Array(size);
  padded.set(fixture);
  padded.fill(0x20, fixture.byteLength);
  return padded.buffer;
}

async function actualCore(): Promise<CoreModule> {
  return vi.importActual<CoreModule>('@xivdyetools/core');
}

/** The page-side provider: core's bridge over a real CharacterColorService. */
function hostProvider(): CharaPaletteProvider {
  return createCharaPaletteProvider(new CharacterColorService());
}

const nullProvider = (): CharaPaletteProvider => ({ getColor: async () => null });
const throwingProvider = (): CharaPaletteProvider => ({
  getColor: async () => {
    throw new Error(CANARY);
  },
});

/** What the core facade itself projects for these bytes with this provider and no dye lookup. */
async function expectedProjection(
  bytes: Uint8Array,
  palettes: CharaPaletteProvider = hostProvider()
): Promise<ImportedCharaCharacter> {
  const core = await actualCore();
  return core.resolveCharaWithProvider(core.inspectCharaForTools(bytes), palettes);
}

/** A log argument as text, including an Error's message and stack. */
function describeArg(arg: unknown): string {
  if (arg instanceof Error) return `${arg.message} ${arg.stack ?? ''}`;
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

/** Records a promise's outcome without leaving a rejection unhandled. */
function track<T>(promise: Promise<T>) {
  const state: { status: 'pending' | 'resolved' | 'rejected'; value?: T; error?: unknown } = {
    status: 'pending',
  };
  promise.then(
    (value) => {
      state.status = 'resolved';
      state.value = value;
    },
    (error: unknown) => {
      state.status = 'rejected';
      state.error = error;
    }
  );
  return state;
}

/** Let microtasks and a few macrotasks run (real timers). */
async function flush(rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setTimeout(r, 0));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('handleInspectRequest: valid files', () => {
  it.each(FIXTURES)(
    "%s answers success with core's projection for the given provider and no dyes",
    async (name) => {
      // Red if the worker ignores the provider it is given, passes a dye lookup, or if the
      // validator refuses a real projection (e.g. one carrying indexGap).
      const bytes = fixtureBytes(name);
      const palettes = hostProvider();
      vi.mocked(resolveCharaWithProvider).mockClear();
      const response = await handleInspectRequest(
        { type: 'inspect', id: 7, bytes: bufferOf(bytes) },
        palettes
      );
      expect(response.type).toBe('success');
      if (response.type !== 'success') return;
      expect(response.id).toBe(7);
      expect(Object.keys(response).sort()).toEqual(['id', 'result', 'type']);
      expect(vi.mocked(resolveCharaWithProvider)).toHaveBeenCalledTimes(1);
      const [, passed, dyes] = vi.mocked(resolveCharaWithProvider).mock.calls[0];
      expect(passed).toBe(palettes);
      expect(dyes).toBeUndefined();
      expect(response.result).toEqual(await expectedProjection(bytes));
      for (const badge of response.result.gearDyes) expect(badge.dye).toBeNull();
      for (const slot of response.result.slots) expect(typeof slot.indexGap).toBe('boolean');
      expect(validateImportedCharacter(response.result)).not.toBeNull();
    }
  );

  it('sends every dye badge as null: the page attaches dyes, not the worker', async () => {
    // Red if the worker still looks badges up in the offline dye database.
    const response = await handleInspectRequest(
      { type: 'inspect', id: 3, bytes: bufferOf(fixtureBytes('lalafell-dunesfolk.chara')) },
      hostProvider()
    );
    if (response.type !== 'success') throw new Error('expected a success response');
    const { gearDyes } = response.result;
    expect(gearDyes.length).toBeGreaterThan(0);
    for (const badge of gearDyes) {
      expect(badge.stainId).toBeGreaterThan(0);
      expect(badge.dye).toBeNull();
    }
  });

  it('echoes the largest safe id', async () => {
    const response = await handleInspectRequest(
      {
        type: 'inspect',
        id: Number.MAX_SAFE_INTEGER,
        bytes: bufferOf(fixtureBytes('hrothgar-helions.chara')),
      },
      hostProvider()
    );
    expect(response).toEqual(
      expect.objectContaining({ type: 'success', id: Number.MAX_SAFE_INTEGER })
    );
  });

  it('accepts an input of exactly 8,192 bytes', async () => {
    const response = await handleInspectRequest(
      { type: 'inspect', id: 11, bytes: paddedTo(MAX_BYTES) },
      hostProvider()
    );
    expect(response.type).toBe('success');
  });
});

describe('handleInspectRequest: a provider that has no color is not a worker failure', () => {
  it.each(FIXTURES)(
    '%s with a provider that answers null resolves unresolved slots',
    async (name) => {
      // Red if a null palette answer is reported as workerFailed instead of the library's
      // missingPaletteEntry / unresolved states.
      const bytes = fixtureBytes(name);
      const response = await handleInspectRequest(
        { type: 'inspect', id: 12, bytes: bufferOf(bytes) },
        nullProvider()
      );
      expect(response.type).toBe('success');
      if (response.type !== 'success') return;
      expect(response.result).toEqual(await expectedProjection(bytes, nullProvider()));
      for (const slot of response.result.slots) expect(slot.creatorHex).toBeNull();
      expect(response.result.issues.map((i) => i.code)).not.toContain('PALETTE_UNAVAILABLE');
      expect(validateImportedCharacter(response.result)).not.toBeNull();
    }
  );

  it.each(FIXTURES)('%s with a provider that throws records PALETTE_UNAVAILABLE', async (name) => {
    // Red if a throwing provider becomes workerFailed, or its exception text crosses over.
    const bytes = fixtureBytes(name);
    const response = await handleInspectRequest(
      { type: 'inspect', id: 13, bytes: bufferOf(bytes) },
      throwingProvider()
    );
    expect(response.type).toBe('success');
    if (response.type !== 'success') return;
    expect(response.result).toEqual(await expectedProjection(bytes, throwingProvider()));
    expect(response.result.issues.map((i) => i.code)).toContain('PALETTE_UNAVAILABLE');
    for (const slot of response.result.slots) expect(slot.matchHex).toBeNull();
    expect(JSON.stringify(response)).not.toContain(CANARY);
    expect(validateImportedCharacter(response.result)).not.toBeNull();
  });
});

describe('handleInspectRequest: refusals answer unreadable', () => {
  const encode = (text: string): ArrayBuffer => bufferOf(new TextEncoder().encode(text));

  it.each([
    ['an 8,193-byte input', () => paddedTo(MAX_BYTES + 1)],
    [
      'invalid UTF-8',
      () => bufferOf(new Uint8Array([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d])),
    ],
    ['non-JSON text', () => encode('not json')],
    ['an empty input', () => new ArrayBuffer(0)],
    ['JSON that is not a character', () => encode('{"hello":1}')],
    ['a JSON array', () => encode('[]')],
  ])('%s', async (_label, bytes) => {
    // Red if a core refusal is reported as workerFailed, or carries any message text.
    const response = await handleInspectRequest(
      { type: 'inspect', id: 21, bytes: bytes() },
      hostProvider()
    );
    expect(response).toStrictEqual({ type: 'error', id: 21, code: 'unreadable' });
  });
});

describe('handleInspectRequest: only a refusal code means unreadable (F5)', () => {
  const request = () => ({
    type: 'inspect' as const,
    id: 41,
    bytes: bufferOf(fixtureBytes('lalafell-dunesfolk.chara')),
  });

  /** An error shaped like the library's `CharaInputError`: a fixed message and a string code. */
  const refusal = (code: string) => Object.assign(new Error(CANARY), { code });

  it.each([
    'INPUT_TOO_LARGE',
    'INVALID_UTF8',
    'INVALID_JSON',
    'NOT_CHARACTER',
    'MAX_DEPTH',
    'MAX_NODES',
    'MAX_KEY_LENGTH',
    'MAX_STRING_LENGTH',
    'DUPLICATE_KEY',
    'INVALID_NUMBER',
  ])('a thrown %s refusal answers unreadable', async (code) => {
    vi.mocked(inspectCharaForTools).mockImplementationOnce(() => {
      throw refusal(code);
    });
    expect(await handleInspectRequest(request(), hostProvider())).toStrictEqual({
      type: 'error',
      id: 41,
      code: 'unreadable',
    });
  });

  it.each<[string, () => unknown]>([
    ['a TypeError with no code', () => new TypeError(CANARY)],
    ['an error whose code is not an input refusal', () => refusal('ERR_INTERNAL')],
    ['a host misuse (INVALID_OPTIONS)', () => refusal('INVALID_OPTIONS')],
    ['a host misuse (INVALID_INPUT)', () => refusal('INVALID_INPUT')],
    ['a non-string code', () => Object.assign(new Error(CANARY), { code: 7 })],
    ['a thrown string', () => CANARY],
    ['a thrown null', () => null],
  ])('%s from the facade answers workerFailed', async (_label, thrown) => {
    // Red if every throw inside inspectCharaForTools is reported as unreadable.
    vi.mocked(inspectCharaForTools).mockImplementationOnce(() => {
      throw thrown();
    });
    const response = await handleInspectRequest(request(), hostProvider());
    expect(response).toStrictEqual({ type: 'error', id: 41, code: 'workerFailed' });
    expect(JSON.stringify(response)).not.toContain(CANARY);
  });
});

describe('handleInspectRequest: unexpected failures', () => {
  it('answers workerFailed with no exception text in the response or the logs', async () => {
    vi.mocked(resolveCharaWithProvider).mockImplementationOnce(async () => {
      throw new Error(CANARY);
    });
    const consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined)
    );
    const loggerMethods = logger as unknown as Record<string, ReturnType<typeof vi.fn>>;
    for (const method of Object.values(loggerMethods)) method.mockClear?.();

    const response = await handleInspectRequest(
      { type: 'inspect', id: 33, bytes: bufferOf(fixtureBytes('lalafell-dunesfolk.chara')) },
      hostProvider()
    );

    expect(response).toStrictEqual({ type: 'error', id: 33, code: 'workerFailed' });
    expect(JSON.stringify(response)).not.toContain(CANARY);
    const logged = [
      ...consoleSpies.flatMap((spy) => spy.mock.calls),
      ...Object.values(loggerMethods).flatMap((method) => method.mock?.calls ?? []),
    ];
    for (const args of logged) {
      for (const arg of args) {
        expect(describeArg(arg)).not.toContain(CANARY);
      }
    }
  });
});

describe('the worker loads no palette or dye data of its own', () => {
  it('imports no CharacterColorService, DyeService, dyeDatabase or dye-service-wrapper', () => {
    // Red if the worker still constructs the host palettes or the dye database: wired into a
    // module worker, either would ship the ~1 MB palette JSON (or the dye database) a second time.
    const code = readFileSync(WORKER_SOURCE, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const statements = [
      ...(code.match(/^\s*(?:import|export)\b[^;]*?\bfrom\s*['"][^'"]+['"]/gm) ?? []),
      ...(code.match(/\bimport\s*\(\s*['"][^'"]+['"]\s*\)/g) ?? []),
    ];
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(statement).not.toMatch(/\b(?:CharacterColorService|DyeService|dyeDatabase)\b/);
      expect(statement).not.toMatch(/dye-service-wrapper|character_colors|dyes\.json/);
    }
  });

  it('projects through resolveCharaWithProvider, never resolveCharaForTools or the palette bridge', () => {
    // Red if the worker imports resolveCharaForTools (or createCharaPaletteProvider): either one
    // reaches the shader tables, and a production build then emits their chunks for the worker.
    const code = readFileSync(WORKER_SOURCE, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const coreImports = code.match(/^\s*import\b[^;]*?\bfrom\s*['"]@xivdyetools\/core['"]/gm) ?? [];
    expect(coreImports).toHaveLength(1);
    expect(coreImports[0]).toMatch(/\bresolveCharaWithProvider\b/);
    expect(coreImports[0]).not.toMatch(/\bresolveCharaForTools\b/);
    expect(coreImports[0]).not.toMatch(/\bcreateCharaPaletteProvider\b/);
    expect(code).not.toMatch(/\bresolveCharaForTools\b|\bcreateCharaPaletteProvider\b/);
  });
});

// ---------------------------------------------------------------------------------------------
// Inside a worker scope: the message listener and the palette bridge
// ---------------------------------------------------------------------------------------------

type Posted = { type?: unknown; id?: unknown; seq?: unknown; request?: unknown } & Record<
  string,
  unknown
>;

/**
 * Import the worker with `WorkerGlobalScope` stubbed, so it registers its listener. Returns the
 * core module the worker sees (the fresh registry's), a `send` that delivers a message to the
 * worker, and what it posted.
 */
async function loadWorkerScope() {
  vi.stubGlobal('WorkerGlobalScope', class {});
  const add = vi.spyOn(globalThis, 'addEventListener').mockImplementation(() => undefined);
  const post = vi.spyOn(globalThis, 'postMessage').mockImplementation(() => undefined);
  vi.resetModules();
  const core = (await import('@xivdyetools/core')) as CoreModule;
  await import('../chara-inspection.worker');
  const registered = add.mock.calls.find(([type]) => type === 'message')?.[1] as
    ((event: MessageEvent) => unknown) | undefined;
  const handler = registered ?? (globalThis.onmessage as ((event: MessageEvent) => unknown) | null);
  expect(handler).toBeTypeOf('function');
  const send = (data: unknown): void => {
    handler?.call(globalThis, { data } as MessageEvent);
  };
  const posted = (): Posted[] => post.mock.calls.map(([message]) => message as Posted);
  const paletteMessages = (): Posted[] => posted().filter((m) => m.type === 'palette');
  const finals = (): Posted[] => posted().filter((m) => m.type === 'success' || m.type === 'error');
  return { core, send, post, posted, paletteMessages, finals };
}

type Scope = Awaited<ReturnType<typeof loadWorkerScope>>;

/**
 * Answer every palette message the worker posts, through `answer`, until it posts its final
 * answer. Returns everything it posted, in order.
 */
async function drive(
  scope: Scope,
  answer: (message: Posted) => Promise<unknown>
): Promise<{ final: Posted; messages: Posted[] }> {
  const answered = new Set<unknown>();
  for (let round = 0; round < 400; round++) {
    await flush(1);
    const messages = scope.posted();
    const final = messages.find((m) => m.type === 'success' || m.type === 'error');
    if (final) return { final, messages };
    for (const message of messages) {
      if (message.type !== 'palette' || answered.has(message.seq)) continue;
      answered.add(message.seq);
      scope.send(await answer(message));
    }
  }
  throw new Error('test harness: the worker never posted a final answer');
}

/** The page's answer to one palette message, from core's own page-side provider. */
function answerFromHost(provider: CharaPaletteProvider = hostProvider()) {
  return async (message: Posted) => ({
    type: 'palette-result',
    id: message.id,
    seq: message.seq,
    color: await provider.getColor(message.request as CharaPaletteRequest),
  });
}

/**
 * Start an inspection in a worker scope and capture the bridge provider the worker passes to
 * `resolveCharaWithProvider`, holding the projection open so a test can drive the bridge directly.
 */
async function captureBridge(id = 9) {
  const scope = await loadWorkerScope();
  let captured: CharaPaletteProvider | undefined;
  let release: ((value: ImportedCharaCharacter) => void) | undefined;
  let fail: ((error: unknown) => void) | undefined;
  vi.mocked(scope.core.resolveCharaWithProvider).mockImplementationOnce((_inspection, palettes) => {
    captured = palettes as CharaPaletteProvider;
    return new Promise<ImportedCharaCharacter>((resolveProjection, rejectProjection) => {
      release = resolveProjection;
      fail = rejectProjection;
    });
  });
  scope.send({ type: 'inspect', id, bytes: bufferOf(fixtureBytes('lalafell-dunesfolk.chara')) });
  await vi.waitFor(() => expect(captured).toBeDefined());
  const provider = captured as CharaPaletteProvider;
  expect(provider.getColor).toBeTypeOf('function');
  return {
    ...scope,
    id,
    provider,
    release: (value: ImportedCharaCharacter) => release?.(value),
    fail: (error: unknown) => fail?.(error),
  };
}

async function hostColor(request: CharaPaletteRequest): Promise<CharaPaletteColor> {
  const color = await hostProvider().getColor(request);
  if (!color) throw new Error('test setup: the host has no color for this request');
  return color as CharaPaletteColor;
}

describe('message listener registration', () => {
  afterEach(() => {
    globalThis.onmessage = null;
  });

  it('registers nothing when imported outside a worker (jsdom)', async () => {
    // Red if the module wires `self.onmessage` / a message listener unconditionally.
    expect(typeof (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope).toBe(
      'undefined'
    );
    const add = vi.spyOn(globalThis, 'addEventListener').mockImplementation(() => undefined);
    vi.resetModules();
    await import('../chara-inspection.worker');
    expect(add.mock.calls.filter(([type]) => type === 'message')).toHaveLength(0);
    expect(globalThis.onmessage).toBeNull();
  });

  it('inside a worker scope, asks the page for palette colors and then answers the inspection', async () => {
    // Red if the worker resolves colors from its own palette data (no palette message would be
    // posted), or if a page reply is not routed back to the library.
    const scope = await loadWorkerScope();
    const bytes = fixtureBytes('wildwood-facepaint.chara');
    scope.send({ type: 'inspect', id: 5, bytes: bufferOf(bytes) });
    const { final, messages } = await drive(scope, answerFromHost());

    expect(messages[0].type).toBe('palette');
    const palette = messages.filter((m) => m.type === 'palette');
    expect(palette.length).toBeGreaterThan(0);
    expect(messages.indexOf(final)).toBe(messages.length - 1);
    for (const message of palette) {
      expect(message.id).toBe(5);
      expect(isPaletteRequestMessage(message)).toBe(true);
    }
    const seqs = palette.map((m) => m.seq as number);
    expect(new Set(seqs).size).toBe(seqs.length);

    expect(final).toEqual({ type: 'success', id: 5, result: await expectedProjection(bytes) });
    const result = (final as unknown as { result: ImportedCharaCharacter }).result;
    for (const badge of result.gearDyes) expect(badge.dye).toBeNull();
    expect(validateImportedCharacter(result)).not.toBeNull();
  });

  it('a page that answers palette-error to everything yields PALETTE_UNAVAILABLE, not workerFailed', async () => {
    // Red if palette-error resolves null (no PALETTE_UNAVAILABLE) instead of rejecting.
    const scope = await loadWorkerScope();
    const bytes = fixtureBytes('lalafell-dunesfolk.chara');
    scope.send({ type: 'inspect', id: 6, bytes: bufferOf(bytes) });
    const { final } = await drive(scope, async (m) => ({
      type: 'palette-error',
      id: m.id,
      seq: m.seq,
    }));
    expect(final).toEqual({
      type: 'success',
      id: 6,
      result: await expectedProjection(bytes, throwingProvider()),
    });
    const result = (final as unknown as { result: ImportedCharaCharacter }).result;
    expect(result.issues.map((i) => i.code)).toContain('PALETTE_UNAVAILABLE');
  });

  it('a page that answers a null color to everything yields unresolved slots and no PALETTE_UNAVAILABLE', async () => {
    const scope = await loadWorkerScope();
    const bytes = fixtureBytes('lalafell-dunesfolk.chara');
    scope.send({ type: 'inspect', id: 8, bytes: bufferOf(bytes) });
    const { final } = await drive(scope, async (m) => ({
      type: 'palette-result',
      id: m.id,
      seq: m.seq,
      color: null,
    }));
    expect(final).toEqual({
      type: 'success',
      id: 8,
      result: await expectedProjection(bytes, nullProvider()),
    });
    const result = (final as unknown as { result: ImportedCharaCharacter }).result;
    expect(result.issues.map((i) => i.code)).not.toContain('PALETTE_UNAVAILABLE');
  });

  it('still answers an unreadable input without asking for any color', async () => {
    const scope = await loadWorkerScope();
    scope.send({ type: 'inspect', id: 10, bytes: bufferOf(new TextEncoder().encode('not json')) });
    await vi.waitFor(() => expect(scope.finals()).toHaveLength(1));
    expect(scope.paletteMessages()).toHaveLength(0);
    expect(scope.finals()[0]).toStrictEqual({ type: 'error', id: 10, code: 'unreadable' });
  });
});

describe('the bridge provider (worker side of the palette bridge)', () => {
  afterEach(() => {
    globalThis.onmessage = null;
  });

  it('posts one palette message per request, for the inspection id, with increasing seq', async () => {
    const bridge = await captureBridge(9);
    const requests = [EYES, SHADER_EYES, HAIR];
    for (const request of requests) track(bridge.provider.getColor(request));
    await flush();
    const messages = bridge.paletteMessages();
    expect(messages).toHaveLength(3);
    messages.forEach((message, i) => {
      expect(Object.keys(message).sort()).toEqual(['id', 'request', 'seq', 'type']);
      expect(message).toEqual({
        type: 'palette',
        id: 9,
        seq: expect.any(Number),
        request: requests[i],
      });
      expect(isPaletteRequestMessage(message)).toBe(true);
    });
    const seqs = messages.map((m) => m.seq as number);
    for (const seq of seqs) expect(Number.isSafeInteger(seq) && seq > 0).toBe(true);
    expect(seqs[1]).toBeGreaterThan(seqs[0]);
    expect(seqs[2]).toBeGreaterThan(seqs[1]);
  });

  it('ignores a reply with the wrong id or the wrong seq, then resolves on the matching one', async () => {
    // Red if a reply is matched on seq alone, on id alone, or settles the first pending request.
    const bridge = await captureBridge(9);
    const pending = track(bridge.provider.getColor(EYES));
    await flush();
    const [message] = bridge.paletteMessages();
    const color = await hostColor(EYES);
    const forged = { ...color, hex: '#010203', rgb: [1, 2, 3] };
    const { id, seq } = message as { id: number; seq: number };

    bridge.send({ type: 'palette-result', id: id + 1, seq, color: forged });
    bridge.send({ type: 'palette-result', id, seq: seq + 1, color: forged });
    bridge.send({ type: 'palette-error', id: id + 1, seq });
    bridge.send({ type: 'palette-error', id, seq: seq + 1 });
    await flush();
    expect(pending.status).toBe('pending');

    bridge.send({ type: 'palette-result', id, seq, color });
    await flush();
    expect(pending.status).toBe('resolved');
    expect(pending.value).toEqual(color);
  });

  it('ignores a stale reply to an answered request', async () => {
    const bridge = await captureBridge(9);
    const first = track(bridge.provider.getColor(EYES));
    await flush();
    const [firstMessage] = bridge.paletteMessages();
    bridge.send({ type: 'palette-result', id: 9, seq: firstMessage.seq, color: null });
    await flush();
    expect(first.status).toBe('resolved');

    const second = track(bridge.provider.getColor(SHADER_EYES));
    await flush();
    // The first request's seq again: it must not settle the second request.
    bridge.send({ type: 'palette-result', id: 9, seq: firstMessage.seq, color: null });
    bridge.send({ type: 'palette-error', id: 9, seq: firstMessage.seq });
    await flush();
    expect(second.status).toBe('pending');
  });

  it('rejects on palette-error', async () => {
    const bridge = await captureBridge(9);
    const pending = track(bridge.provider.getColor(EYES));
    await flush();
    const [message] = bridge.paletteMessages();
    bridge.send({ type: 'palette-error', id: 9, seq: message.seq });
    await flush();
    expect(pending.status).toBe('rejected');
  });

  it('resolves null for a null color', async () => {
    const bridge = await captureBridge(9);
    const pending = track(bridge.provider.getColor(HAIR));
    await flush();
    const [message] = bridge.paletteMessages();
    bridge.send({ type: 'palette-result', id: 9, seq: message.seq, color: null });
    await flush();
    expect(pending.status).toBe('resolved');
    expect(pending.value).toBeNull();
  });

  it('ignores a malformed reply, then resolves on a valid one', async () => {
    // Red if a reply is used without parsePaletteReply (a lowercase hex, an extra key, a missing
    // color would reach the library).
    const bridge = await captureBridge(9);
    const pending = track(bridge.provider.getColor(EYES));
    await flush();
    const [message] = bridge.paletteMessages();
    const color = await hostColor(EYES);
    const seq = message.seq;
    bridge.send({ type: 'palette-result', id: 9, seq, color: { ...color, hex: '#abcdef' } });
    bridge.send({ type: 'palette-result', id: 9, seq, color: { ...color, raw: CANARY } });
    bridge.send({ type: 'palette-result', id: 9, seq, color, message: CANARY });
    bridge.send({ type: 'palette-result', id: 9, seq });
    bridge.send({ type: 'palette-error', id: 9, seq, message: CANARY });
    bridge.send({ type: 'palette-result', id: String(9), seq, color });
    bridge.send(null);
    bridge.send('palette-result');
    await flush();
    expect(pending.status).toBe('pending');

    bridge.send({ type: 'palette-result', id: 9, seq, color });
    await flush();
    expect(pending.status).toBe('resolved');
    expect(pending.value).toEqual(color);
  });

  it(`rejects request ${CAP + 1} of one inspection without posting it`, async () => {
    // Red if the worker posts without bound: a defective library loop could flood the page.
    const bridge = await captureBridge(9);
    const first = Array.from({ length: CAP }, (_, i) =>
      track(bridge.provider.getColor({ ...EYES, index: i }))
    );
    await flush();
    expect(bridge.paletteMessages()).toHaveLength(CAP);

    const over = track(bridge.provider.getColor({ ...EYES, index: CAP }));
    await flush();
    expect(over.status).toBe('rejected');
    expect(bridge.paletteMessages()).toHaveLength(CAP);

    // The cap counts requests, not requests in flight: answering them all frees nothing.
    for (const message of bridge.paletteMessages()) {
      bridge.send({ type: 'palette-result', id: 9, seq: message.seq, color: null });
    }
    await flush();
    for (const state of first) expect(state.status).toBe('resolved');
    const later = track(bridge.provider.getColor(SHADER_EYES));
    await flush();
    expect(later.status).toBe('rejected');
    expect(bridge.paletteMessages()).toHaveLength(CAP);
  });

  it.each<[string, CharaPaletteRequest]>([
    ['an index of 256', { ...EYES, index: 256 }],
    ['a 33-character tribe', { ...HAIR, tribe: 'T'.repeat(33) }],
  ])('rejects a request with %s at once, without posting it', async (_label, request) => {
    // Red if the worker posts a request the page would refuse: it would only wait out the deadline.
    const bridge = await captureBridge(9);
    const outside = track(bridge.provider.getColor(request));
    await flush();
    expect(outside.status).toBe('rejected');
    expect(bridge.paletteMessages()).toHaveLength(0);
    // A request inside the vocabulary is still posted.
    track(bridge.provider.getColor(EYES));
    await flush();
    expect(bridge.paletteMessages()).toHaveLength(1);
  });

  it('settling the inspection closes the bridge: pending requests reject, late replies and new requests go nowhere', async () => {
    // Red if the bridge is not closed when the projection settles: the pending request would
    // hang, a late reply would still settle it, and a later request would still be posted.
    const bridge = await captureBridge(9);
    const pending = track(bridge.provider.getColor(EYES));
    await flush();
    const [message] = bridge.paletteMessages();
    expect(pending.status).toBe('pending');

    bridge.fail(new Error(CANARY));
    await vi.waitFor(() => expect(bridge.finals()).toHaveLength(1));
    expect(bridge.finals()[0]).toStrictEqual({ type: 'error', id: 9, code: 'workerFailed' });
    await flush();
    expect(pending.status).toBe('rejected');
    expect(String((pending.error as Error).message)).not.toContain(CANARY);

    const color = await hostColor(EYES);
    bridge.send({ type: 'palette-result', id: 9, seq: message.seq, color });
    await flush();
    expect(pending.status).toBe('rejected');
    expect(pending.value).toBeUndefined();

    const after = track(bridge.provider.getColor(HAIR));
    await flush();
    expect(after.status).toBe('rejected');
    expect(bridge.paletteMessages()).toHaveLength(1);
    expect(bridge.posted()).toHaveLength(2);
  });

  it('posts the final answer after the projection settles', async () => {
    const bridge = await captureBridge(9);
    expect(bridge.finals()).toHaveLength(0);
    const projection = await expectedProjection(fixtureBytes('lalafell-dunesfolk.chara'));
    bridge.release(projection);
    await vi.waitFor(() => expect(bridge.finals()).toHaveLength(1));
    expect(bridge.finals()[0]).toEqual({ type: 'success', id: 9, result: projection });
  });
});
