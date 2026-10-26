/**
 * The `.chara` inspection worker's message handler (Task 4), run against the REAL core facade:
 * `inspectCharaForTools` (8,192-byte cap) → `resolveCharaForTools` with the host palettes and the
 * offline dye database. `inspectCharaForTools` is wrapped in a pass-through `vi.fn` so the F5 tests
 * can force one throw each with `mockImplementationOnce`; every other test runs the real function.
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
  DyeService,
  dyeDatabase,
  inspectCharaForTools,
  resolveCharaForTools,
} from '@xivdyetools/core';
import { logger } from '@shared/logger';
import { handleInspectRequest } from '../chara-inspection.worker';
import { validateImportedCharacter } from '../../services/chara-inspection-protocol';

vi.mock('@xivdyetools/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xivdyetools/core')>();
  return { ...actual, inspectCharaForTools: vi.fn(actual.inspectCharaForTools) };
});

// A path, not `new URL('<literal>', import.meta.url)`: Vite's asset plugin rewrites that pattern
// to a dev-server http:// URL under vitest, which fileURLToPath refuses.
const FIXTURE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../packages/core/src/services/chara/__tests__/fixtures'
);
const FIXTURES = [
  'duskwight-heterochromia.chara',
  'hrothgar-helions.chara',
  'lalafell-dunesfolk.chara',
  'wildwood-facepaint.chara',
  'xaela-anamnesis-header.chara',
] as const;
const MAX_BYTES = 8_192;
const CANARY = 'UNEXPECTED-WORKER-CANARY-91c2';

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

/** What the core facade itself projects for these bytes with the offline dye database. */
async function expectedProjection(bytes: Uint8Array) {
  const dyes = new DyeService(dyeDatabase);
  return resolveCharaForTools(inspectCharaForTools(bytes), new CharacterColorService(), {
    getByStainId: (stainId: number) => dyes.getByStainId(stainId),
  });
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('handleInspectRequest: valid files', () => {
  it.each(FIXTURES)('%s answers success with the core projection for its id', async (name) => {
    // Red if the worker skips the host palettes, the dye lookup or the projection, or if the
    // validator refuses a real projection (e.g. by applying the hex rule to dye objects).
    const bytes = fixtureBytes(name);
    const response = await handleInspectRequest({ type: 'inspect', id: 7, bytes: bufferOf(bytes) });
    expect(response.type).toBe('success');
    if (response.type !== 'success') return;
    expect(response.id).toBe(7);
    expect(Object.keys(response).sort()).toEqual(['id', 'result', 'type']);
    expect(validateImportedCharacter(response.result)).not.toBeNull();
    expect(response.result).toEqual(await expectedProjection(bytes));
  });

  it('resolves dye badges through the offline dye database', async () => {
    // Red if the worker passes no dye lookup (every badge would be `dye: null`).
    const response = await handleInspectRequest({
      type: 'inspect',
      id: 3,
      bytes: bufferOf(fixtureBytes('lalafell-dunesfolk.chara')),
    });
    if (response.type !== 'success') throw new Error('expected a success response');
    const { gearDyes } = response.result;
    expect(gearDyes.length).toBeGreaterThan(0);
    for (const badge of gearDyes) expect(badge.dye?.stainID).toBe(badge.stainId);
  });

  it('echoes the largest safe id', async () => {
    const response = await handleInspectRequest({
      type: 'inspect',
      id: Number.MAX_SAFE_INTEGER,
      bytes: bufferOf(fixtureBytes('hrothgar-helions.chara')),
    });
    expect(response).toEqual(
      expect.objectContaining({ type: 'success', id: Number.MAX_SAFE_INTEGER })
    );
  });

  it('accepts an input of exactly 8,192 bytes', async () => {
    const response = await handleInspectRequest({
      type: 'inspect',
      id: 11,
      bytes: paddedTo(MAX_BYTES),
    });
    expect(response.type).toBe('success');
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
    const response = await handleInspectRequest({ type: 'inspect', id: 21, bytes: bytes() });
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
    expect(await handleInspectRequest(request())).toStrictEqual({
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
    const response = await handleInspectRequest(request());
    expect(response).toStrictEqual({ type: 'error', id: 41, code: 'workerFailed' });
    expect(JSON.stringify(response)).not.toContain(CANARY);
  });
});

describe('handleInspectRequest: unexpected failures', () => {
  it('answers workerFailed with no exception text in the response or the logs', async () => {
    const lookup = vi.spyOn(DyeService.prototype, 'getByStainId').mockImplementation(() => {
      throw new Error(CANARY);
    });
    const consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined)
    );
    const loggerMethods = logger as unknown as Record<string, ReturnType<typeof vi.fn>>;
    for (const method of Object.values(loggerMethods)) method.mockClear?.();

    const response = await handleInspectRequest({
      type: 'inspect',
      id: 33,
      bytes: bufferOf(fixtureBytes('lalafell-dunesfolk.chara')),
    });

    expect(lookup).toHaveBeenCalled();
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

describe('message listener registration', () => {
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

  it('inside a worker scope, answers an inspect message through postMessage', async () => {
    vi.stubGlobal('WorkerGlobalScope', class {});
    const add = vi.spyOn(globalThis, 'addEventListener').mockImplementation(() => undefined);
    const post = vi.spyOn(globalThis, 'postMessage').mockImplementation(() => undefined);
    vi.resetModules();
    try {
      await import('../chara-inspection.worker');
      const registered = add.mock.calls.find(([type]) => type === 'message')?.[1] as
        ((event: MessageEvent) => unknown) | undefined;
      const handler =
        registered ?? (globalThis.onmessage as ((event: MessageEvent) => unknown) | null);
      expect(handler).toBeTypeOf('function');
      const bytes = fixtureBytes('wildwood-facepaint.chara');
      handler?.call(globalThis, {
        data: { type: 'inspect', id: 5, bytes: bufferOf(bytes) },
      } as MessageEvent);
      await vi.waitFor(() => expect(post).toHaveBeenCalled());
      expect(post.mock.calls[0][0]).toEqual({
        type: 'success',
        id: 5,
        result: await expectedProjection(bytes),
      });
    } finally {
      globalThis.onmessage = null;
    }
  });
});
