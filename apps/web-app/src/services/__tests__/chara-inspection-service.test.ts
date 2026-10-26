/**
 * The page side of the `.chara` inspection worker (Task 4): one module worker per import, a
 * transferred input buffer, a validated answer accepted only for the ACTIVE request id, an exact
 * 5_000 ms timeout, supersession by a newer import, explicit cancellation, and a terminated worker
 * on every settled path. A failure must never leave state that blocks the next import.
 *
 * `Worker` is a fake installed with `vi.stubGlobal`; the test drives its message / error /
 * messageerror events. The service module is re-imported per test so no pending call leaks across.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  CharacterColorService,
  DyeService,
  createCharaPaletteProvider,
  dyeDatabase,
  inspectCharaForTools,
  resolveCharaWithProvider,
  type CharaPaletteProvider,
  type ImportedCharaCharacter,
} from '@xivdyetools/core';
import {
  isInspectionRequest,
  parsePaletteReply,
  type CharaPaletteColor,
  type CharaPaletteRequest,
} from '../chara-inspection-protocol';

// setup.ts replaces this service with an in-thread stand-in for every other suite; this one drives
// the real service against a fake Worker.
vi.unmock('@services/chara-inspection-service');

// createCharaPaletteProvider is wrapped in a pass-through vi.fn so a test can hand the page a
// provider whose answer the page must refuse to post (it re-validates before posting).
vi.mock('@xivdyetools/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xivdyetools/core')>();
  return {
    ...actual,
    createCharaPaletteProvider: vi.fn(actual.createCharaPaletteProvider),
  };
});

type ServiceModule = typeof import('../chara-inspection-service');
type CoreModule = typeof import('@xivdyetools/core');
type FailureCode = 'unreadable' | 'workerFailed' | 'timedOut' | 'superseded';

const CANARY = 'RAW-WORKER-CANARY-7f3a';
// A path, not `new URL('<literal>', import.meta.url)`: Vite's asset plugin rewrites that pattern
// to a dev-server http:// URL under vitest, which fileURLToPath refuses.
const FIXTURE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../packages/core/src/services/chara/__tests__/fixtures'
);
const FIXTURE = resolve(FIXTURE_DIR, 'lalafell-dunesfolk.chara');
const FIXTURES = [
  'duskwight-heterochromia.chara',
  'hrothgar-helions.chara',
  'lalafell-dunesfolk.chara',
  'wildwood-facepaint.chara',
  'xaela-anamnesis-header.chara',
] as const;
/** CHARA_PALETTE_REQUEST_CAP, as a literal so the behavior tests do not depend on the export. */
const CAP = 64;

type Handler = (this: unknown, event: unknown) => void;

class FakeWorker {
  static instances: FakeWorker[] = [];

  readonly url: string;
  readonly options: unknown;
  readonly posted: Array<{ message: unknown; transfer: unknown[] }> = [];
  readonly terminate = vi.fn();
  onmessage: Handler | null = null;
  onerror: Handler | null = null;
  onmessageerror: Handler | null = null;
  private readonly listeners = new Map<string, Set<Handler>>();

  constructor(url: string | URL, options?: unknown) {
    this.url = String(url);
    this.options = options;
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, listener: Handler): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)?.add(listener);
  }

  removeEventListener(type: string, listener: Handler): void {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(message: unknown, transferOrOptions?: unknown): void {
    const transfer = Array.isArray(transferOrOptions)
      ? transferOrOptions
      : ((transferOrOptions as { transfer?: unknown[] } | undefined)?.transfer ?? []);
    this.posted.push({ message, transfer });
  }

  emit(type: 'message' | 'error' | 'messageerror', event: unknown): void {
    const property = this[`on${type}`];
    property?.call(this, event);
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener.call(this, event);
  }

  /** The id of the request this worker was given. */
  get requestId(): number {
    return (this.posted[0]?.message as { id: number }).id;
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

/** Drain microtasks without touching (real or fake) timers. */
async function settle(): Promise<void> {
  for (let i = 0; i < 25; i++) await Promise.resolve();
}

let mod: ServiceModule;
/** The core module the freshly imported service sees (same registry). */
let core: CoreModule;
/** What the worker sends for the Lalafell fixture: the projection with every badge's dye null. */
let validResult: ImportedCharaCharacter;
/** What the page resolves for it: the same projection with the offline database's dyes attached. */
let attachedResult: ImportedCharaCharacter;
/** Worker-form and attached projections of every core fixture. */
const fixtureResults = new Map<
  string,
  { worker: ImportedCharaCharacter; attached: ImportedCharaCharacter }
>();

function result(): ImportedCharaCharacter {
  return structuredClone(validResult);
}

/** The projection with each badge's dye looked up in the offline database (unknown stain: null). */
function attachDyes(projection: ImportedCharaCharacter): ImportedCharaCharacter {
  const dyes = new DyeService(dyeDatabase);
  const copy = structuredClone(projection);
  for (const badge of copy.gearDyes) badge.dye = dyes.getByStainId(badge.stainId) ?? null;
  return copy;
}

/** The worker form: what `resolveCharaWithProvider` projects with the host palettes and no dyes. */
async function workerProjection(bytes: Uint8Array): Promise<ImportedCharaCharacter> {
  return resolveCharaWithProvider(
    inspectCharaForTools(bytes),
    createCharaPaletteProvider(new CharacterColorService())
  );
}

function success(id: number, value: unknown = result()) {
  return { data: { type: 'success', id, result: value } };
}

function expectFailure(error: unknown, code: FailureCode): void {
  expect(error).toBeInstanceOf(mod.CharaInspectionError);
  expect(error).toBeInstanceOf(Error);
  expect((error as { code: string }).code).toBe(code);
  expect((error as Error).message).not.toContain(CANARY);
}

/** Start a call and return it with its (single new) worker, once the request is posted. */
async function start(bytes: ArrayBuffer = new ArrayBuffer(16)) {
  const before = FakeWorker.instances.length;
  const call = track(mod.inspectCharaBytes(bytes));
  await settle();
  expect(FakeWorker.instances).toHaveLength(before + 1);
  const worker = FakeWorker.instances[before];
  expect(worker.posted).toHaveLength(1);
  return { call, worker, bytes };
}

beforeAll(async () => {
  validResult = await workerProjection(new Uint8Array(readFileSync(FIXTURE)));
  attachedResult = attachDyes(validResult);
  for (const name of FIXTURES) {
    const worker = await workerProjection(new Uint8Array(readFileSync(resolve(FIXTURE_DIR, name))));
    fixtureResults.set(name, { worker, attached: attachDyes(worker) });
  }
});

beforeEach(async () => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
  vi.resetModules();
  core = (await import('@xivdyetools/core')) as CoreModule;
  mod = await import('../chara-inspection-service');
});

afterEach(() => {
  mod.cancelCharaInspection();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('inspectCharaBytes: request', () => {
  it('starts a same-origin module worker and transfers the exact input buffer', async () => {
    // Red if the worker is a classic/blob worker, if the URL moves, or if the buffer is copied.
    const { worker, bytes } = await start(new ArrayBuffer(32));
    expect(worker.url).toMatch(/\/src\/workers\/chara-inspection\.worker\.ts(?:\?|$)/);
    expect(worker.options).toEqual(expect.objectContaining({ type: 'module' }));
    const { message, transfer } = worker.posted[0];
    expect(isInspectionRequest(message)).toBe(true);
    expect((message as { type: string }).type).toBe('inspect');
    expect((message as { bytes: ArrayBuffer }).bytes).toBe(bytes);
    expect(transfer).toHaveLength(1);
    expect(transfer[0]).toBe(bytes);
  });

  it('gives each call a distinct positive safe integer id', async () => {
    const first = await start();
    mod.cancelCharaInspection();
    const second = await start();
    expect(Number.isSafeInteger(first.worker.requestId) && first.worker.requestId > 0).toBe(true);
    expect(Number.isSafeInteger(second.worker.requestId) && second.worker.requestId > 0).toBe(true);
    expect(second.worker.requestId).not.toBe(first.worker.requestId);
  });
});

describe('inspectCharaBytes: answers', () => {
  it('resolves with a validated result for the active id and terminates the worker once', async () => {
    const { call, worker } = await start();
    worker.emit('message', success(worker.requestId));
    await settle();
    expect(call.status).toBe('resolved');
    expect(call.value).toEqual(attachedResult);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it.each(['unreadable', 'workerFailed'] as const)(
    'rejects a %s error response with that code and a fixed message',
    async (code) => {
      const { call, worker } = await start();
      worker.emit('message', {
        data: { type: 'error', id: worker.requestId, code, message: CANARY },
      });
      await settle();
      expect(call.status).toBe('rejected');
      expectFailure(call.error, code);
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    ['a non-object', 'garbage'],
    ['null data', null],
    ['a success without an id', { type: 'success', result: 'x' }],
    ['an unknown type for another id', { type: 'progress', id: 987_654 }],
  ])('ignores %s and stays pending', async (_label, data) => {
    const { call, worker } = await start();
    worker.emit('message', { data });
    await settle();
    expect(call.status).toBe('pending');
    expect(worker.terminate).not.toHaveBeenCalled();
    // ...and the real answer still lands.
    worker.emit('message', success(worker.requestId));
    await settle();
    expect(call.status).toBe('resolved');
  });

  it('ignores a valid answer for another id and stays pending', async () => {
    // Red if any well-formed message settles the call regardless of its id.
    const { call, worker } = await start();
    worker.emit('message', success(worker.requestId + 1));
    worker.emit('message', {
      data: { type: 'error', id: worker.requestId + 1, code: 'unreadable' },
    });
    await settle();
    expect(call.status).toBe('pending');
    expect(worker.terminate).not.toHaveBeenCalled();
    worker.emit('message', success(worker.requestId));
    await settle();
    expect(call.status).toBe('resolved');
  });

  it('fails as workerFailed when the active id carries an invalid result', async () => {
    const invalid = { ...result(), slots: result().slots.slice(0, 7) };
    const { call, worker } = await start();
    worker.emit('message', success(worker.requestId, invalid));
    await settle();
    expect(call.status).toBe('rejected');
    expectFailure(call.error, 'workerFailed');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('fails as workerFailed when the active id carries raw document data', async () => {
    const { call, worker } = await start();
    worker.emit('message', success(worker.requestId, { ...result(), document: { raw: CANARY } }));
    await settle();
    expect(call.status).toBe('rejected');
    expectFailure(call.error, 'workerFailed');
  });

  it("rejects workerFailed on the worker's error event without exposing its text", async () => {
    const { call, worker } = await start();
    worker.emit('error', { type: 'error', message: CANARY, error: new Error(CANARY) });
    await settle();
    expect(call.status).toBe('rejected');
    expectFailure(call.error, 'workerFailed');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('rejects workerFailed on a messageerror event', async () => {
    const { call, worker } = await start();
    worker.emit('messageerror', { type: 'messageerror', data: CANARY });
    await settle();
    expect(call.status).toBe('rejected');
    expectFailure(call.error, 'workerFailed');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('uses one fixed workerFailed message whatever the cause', async () => {
    // Red if the message is built from the event or exception text.
    const messages: string[] = [];
    const a = await start();
    a.worker.emit('error', { type: 'error', message: `${CANARY}-A` });
    await settle();
    messages.push((a.call.error as Error).message);
    const b = await start();
    b.worker.emit('messageerror', { type: 'messageerror', data: `${CANARY}-B` });
    await settle();
    messages.push((b.call.error as Error).message);
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error(`${CANARY}-C`);
        }
      }
    );
    const c = track(mod.inspectCharaBytes(new ArrayBuffer(4)));
    await settle();
    messages.push((c.error as Error).message);
    expect(messages[0].length).toBeGreaterThan(0);
    expect(new Set(messages).size).toBe(1);
    for (const message of messages) expect(message).not.toContain(CANARY);
  });
});

describe('inspectCharaBytes: startup failures', () => {
  it('rejects workerFailed (never throws synchronously) when the Worker constructor throws', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error(CANARY);
        }
      }
    );
    let promise: Promise<ImportedCharaCharacter> | undefined;
    expect(() => {
      promise = mod.inspectCharaBytes(new ArrayBuffer(4));
    }).not.toThrow();
    const call = track(promise as Promise<ImportedCharaCharacter>);
    await settle();
    expect(call.status).toBe('rejected');
    expectFailure(call.error, 'workerFailed');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects workerFailed when Worker is unavailable', async () => {
    vi.stubGlobal('Worker', undefined);
    const call = track(mod.inspectCharaBytes(new ArrayBuffer(4)));
    await settle();
    expect(call.status).toBe('rejected');
    expectFailure(call.error, 'workerFailed');
  });

  it('rejects workerFailed and terminates the worker when postMessage throws', async () => {
    vi.useFakeTimers();
    class ThrowingPostWorker extends FakeWorker {
      override postMessage(): void {
        throw new Error(CANARY);
      }
    }
    vi.stubGlobal('Worker', ThrowingPostWorker);
    const call = track(mod.inspectCharaBytes(new ArrayBuffer(4)));
    await settle();
    expect(call.status).toBe('rejected');
    expectFailure(call.error, 'workerFailed');
    expect(FakeWorker.instances).toHaveLength(1);
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledTimes(1);
    // The deadline was armed before postMessage threw; settling cleared it.
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('inspectCharaBytes: timeout', () => {
  it('rejects timedOut at exactly 5_000 ms (not 4_999) and terminates the worker', async () => {
    vi.useFakeTimers();
    const { call, worker } = await start();
    await vi.advanceTimersByTimeAsync(4_999);
    await settle();
    expect(call.status).toBe('pending');
    expect(worker.terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(call.status).toBe('rejected');
    expectFailure(call.error, 'timedOut');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    // A late answer after the timeout changes nothing and terminates nothing again.
    worker.emit('message', success(worker.requestId));
    await settle();
    expect(call.status).toBe('rejected');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('is not extended by ignored messages', async () => {
    vi.useFakeTimers();
    const { call, worker } = await start();
    await vi.advanceTimersByTimeAsync(2_500);
    worker.emit('message', success(worker.requestId + 1));
    await vi.advanceTimersByTimeAsync(2_500);
    await settle();
    expect(call.status).toBe('rejected');
    expectFailure(call.error, 'timedOut');
  });

  it("gives a superseding call its own 5_000 ms and clears the old call's timer", async () => {
    // Red if the first call's timer survives and fails the second call early.
    vi.useFakeTimers();
    const first = await start();
    await vi.advanceTimersByTimeAsync(3_000);
    const second = await start();
    // Only the second call's deadline is armed: superseding cleared the first one's.
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(4_999);
    await settle();
    expect(second.call.status).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expectFailure(second.call.error, 'timedOut');
    expectFailure(first.call.error, 'superseded');
    expect(first.worker.terminate).toHaveBeenCalledTimes(1);
    expect(second.worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('clears the timer once the call resolves', async () => {
    // Red if finish() stops clearing the deadline: the pending guard would make the stale timer a
    // no-op, but it would still hold the settled call's closure for 5 s.
    vi.useFakeTimers();
    const { call, worker } = await start();
    expect(vi.getTimerCount()).toBe(1);
    worker.emit('message', success(worker.requestId));
    await settle();
    expect(call.status).toBe('resolved');
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(10_000);
    await settle();
    expect(call.status).toBe('resolved');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});

describe('supersession and cancellation', () => {
  it('a second call supersedes the first: first rejects superseded, its worker ends, second resolves', async () => {
    vi.useFakeTimers();
    const first = await start();
    const second = await start();
    await settle();
    expect(first.call.status).toBe('rejected');
    expectFailure(first.call.error, 'superseded');
    expect(first.worker.terminate).toHaveBeenCalledTimes(1);
    expect(second.worker).not.toBe(first.worker);
    expect(second.call.status).toBe('pending');
    expect(vi.getTimerCount()).toBe(1);

    // The superseded worker's late answer never settles the new call.
    first.worker.emit('message', success(first.worker.requestId));
    second.worker.emit('message', success(first.worker.requestId));
    await settle();
    expect(second.call.status).toBe('pending');

    second.worker.emit('message', success(second.worker.requestId));
    await settle();
    expect(second.call.status).toBe('resolved');
    expect(second.call.value).toEqual(attachedResult);
    expect(second.worker.terminate).toHaveBeenCalledTimes(1);
    expect(first.worker.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancelCharaInspection rejects the pending call superseded and terminates its worker', async () => {
    vi.useFakeTimers();
    const { call, worker } = await start();
    mod.cancelCharaInspection();
    await settle();
    expect(call.status).toBe('rejected');
    expectFailure(call.error, 'superseded');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a late success from a cancelled worker never resolves anything', async () => {
    const cancelled = await start();
    mod.cancelCharaInspection();
    cancelled.worker.emit('message', success(cancelled.worker.requestId));
    await settle();
    expect(cancelled.call.status).toBe('rejected');
    expectFailure(cancelled.call.error, 'superseded');

    const next = await start();
    cancelled.worker.emit('message', success(cancelled.worker.requestId));
    next.worker.emit('message', success(cancelled.worker.requestId));
    await settle();
    expect(next.call.status).toBe('pending');
    expect(cancelled.worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('cancel with nothing pending is a no-op', async () => {
    expect(() => mod.cancelCharaInspection()).not.toThrow();
    expect(FakeWorker.instances).toHaveLength(0);

    const { call, worker } = await start();
    worker.emit('message', success(worker.requestId));
    await settle();
    expect(call.status).toBe('resolved');
    mod.cancelCharaInspection();
    mod.cancelCharaInspection();
    await settle();
    expect(call.status).toBe('resolved');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('cancelling twice terminates the worker once', async () => {
    const { worker } = await start();
    mod.cancelCharaInspection();
    mod.cancelCharaInspection();
    await settle();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});

describe('a late event from a dead worker never frees the active call (F2)', () => {
  // Red if finish() drops its `pending !== call` guard: A's late event would then run finish(A),
  // null the slot while B is in flight, and leave B impossible to cancel or supersede (it would
  // stay pending, its worker never terminated, its timer still armed).
  type Late = (worker: FakeWorker) => void;
  const LATE_EVENTS: Array<[string, Late]> = [
    ['success for its own id', (w) => w.emit('message', success(w.requestId))],
    [
      'error response for its own id',
      (w) => w.emit('message', { data: { type: 'error', id: w.requestId, code: 'unreadable' } }),
    ],
    [
      'invalid success for its own id',
      (w) => w.emit('message', success(w.requestId, { slots: [] })),
    ],
    ['error event', (w) => w.emit('error', { type: 'error', message: CANARY })],
    ['messageerror event', (w) => w.emit('messageerror', { type: 'messageerror', data: CANARY })],
  ];

  async function expectBStillOwnsTheSlot(
    a: Awaited<ReturnType<typeof start>>,
    b: Awaited<ReturnType<typeof start>>
  ): Promise<void> {
    expect(b.call.status).toBe('pending');
    expect(b.worker.terminate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    mod.cancelCharaInspection();
    await settle();
    expect(b.call.status).toBe('rejected');
    expectFailure(b.call.error, 'superseded');
    expect(b.worker.terminate).toHaveBeenCalledTimes(1);
    expect(a.worker.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  }

  it.each(LATE_EVENTS)(
    'after a cancel, a late %s from A leaves B cancellable',
    async (_l, late) => {
      vi.useFakeTimers();
      const a = await start();
      mod.cancelCharaInspection();
      await settle();
      expectFailure(a.call.error, 'superseded');

      const b = await start();
      late(a.worker);
      await settle();
      await expectBStillOwnsTheSlot(a, b);
    }
  );

  it.each(LATE_EVENTS)(
    'after a timeout, a late %s from A leaves B cancellable',
    async (_l, late) => {
      vi.useFakeTimers();
      const a = await start();
      await vi.advanceTimersByTimeAsync(5_000);
      await settle();
      expectFailure(a.call.error, 'timedOut');

      const b = await start();
      late(a.worker);
      await settle();
      await expectBStillOwnsTheSlot(a, b);
    }
  );

  it('after a supersede, a late success from A leaves B able to be superseded in turn', async () => {
    vi.useFakeTimers();
    const a = await start();
    const b = await start();
    a.worker.emit('message', success(a.worker.requestId));
    await settle();
    const c = await start();
    expectFailure(b.call.error, 'superseded');
    expect(b.worker.terminate).toHaveBeenCalledTimes(1);
    expect(c.call.status).toBe('pending');
    expect(vi.getTimerCount()).toBe(1);
  });
});

describe('a failure never blocks the next import', () => {
  type Trigger = (worker: FakeWorker) => void;
  const FAILURES: Array<[string, FailureCode, Trigger]> = [
    [
      'an unreadable response',
      'unreadable',
      (w) => w.emit('message', { data: { type: 'error', id: w.requestId, code: 'unreadable' } }),
    ],
    [
      'a workerFailed response',
      'workerFailed',
      (w) => w.emit('message', { data: { type: 'error', id: w.requestId, code: 'workerFailed' } }),
    ],
    ['an error event', 'workerFailed', (w) => w.emit('error', { type: 'error', message: CANARY })],
    ['a messageerror event', 'workerFailed', (w) => w.emit('messageerror', { data: null })],
    [
      'an invalid result',
      'workerFailed',
      (w) => w.emit('message', success(w.requestId, { slots: [] })),
    ],
    ['a cancellation', 'superseded', () => mod.cancelCharaInspection()],
  ];

  it.each(FAILURES)(
    'after %s the next call starts a fresh worker and resolves',
    async (_l, code, fail) => {
      vi.useFakeTimers();
      const failed = await start();
      fail(failed.worker);
      await settle();
      expectFailure(failed.call.error, code);
      expect(vi.getTimerCount()).toBe(0);

      const next = await start();
      expect(next.worker).not.toBe(failed.worker);
      expect(vi.getTimerCount()).toBe(1);
      next.worker.emit('message', success(next.worker.requestId));
      await settle();
      expect(next.call.status).toBe('resolved');
      expect(next.call.value).toEqual(attachedResult);
      expect(failed.worker.terminate).toHaveBeenCalledTimes(1);
      expect(next.worker.terminate).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it('after a timeout the next call resolves', async () => {
    vi.useFakeTimers();
    const failed = await start();
    await vi.advanceTimersByTimeAsync(5_000);
    await settle();
    expectFailure(failed.call.error, 'timedOut');
    const next = await start();
    next.worker.emit('message', success(next.worker.requestId));
    await settle();
    expect(next.call.status).toBe('resolved');
  });

  it('after a Worker constructor failure the next call resolves', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error(CANARY);
        }
      }
    );
    const failed = track(mod.inspectCharaBytes(new ArrayBuffer(4)));
    await settle();
    expectFailure(failed.error, 'workerFailed');

    vi.stubGlobal('Worker', FakeWorker);
    const next = await start();
    next.worker.emit('message', success(next.worker.requestId));
    await settle();
    expect(next.call.status).toBe('resolved');
  });
});

// ---------------------------------------------------------------------------------------------
// The palette bridge, page side (2026-10-26 ruling): the worker asks the page for each palette
// color; the page answers from ONE shared CharacterColorService through core's
// createCharaPaletteProvider, only to the active worker, only for the active id, only while the
// call is still the active one. The 5_000 ms deadline spans the whole exchange.
// ---------------------------------------------------------------------------------------------

const EYES: CharaPaletteRequest = {
  table: 'creator',
  palette: 'eyes',
  index: 0,
  tribe: 'Dunesfolk',
  gender: 'Feminine',
};
const SHADER_EYES: CharaPaletteRequest = { ...EYES, table: 'shader' };
const HAIR: CharaPaletteRequest = { ...EYES, palette: 'hair', index: 4 };

/** The worker asks the page for one color. */
function askPalette(
  worker: FakeWorker,
  seq: number,
  request: CharaPaletteRequest = EYES,
  id: number = worker.requestId
): void {
  worker.emit('message', { data: { type: 'palette', id, seq, request } });
}

/** Everything the page posted to this worker after the inspect request. */
function replies(worker: FakeWorker): Array<Record<string, unknown>> {
  return worker.posted.slice(1).map((p) => p.message as Record<string, unknown>);
}

/** What core's own page-side provider answers for this request. */
async function pageColor(request: CharaPaletteRequest) {
  return core.createCharaPaletteProvider(new core.CharacterColorService()).getColor(request);
}

/** Let real-timer work (the shader tables' first dynamic import) run. */
async function flushReal(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
  await settle();
}

/** A promise the test resolves by hand. */
function deferred<T>() {
  let resolveIt!: (value: T) => void;
  let rejectIt!: (error: unknown) => void;
  const promise = new Promise<T>((r, j) => {
    resolveIt = r;
    rejectIt = j;
  });
  return { promise, resolve: resolveIt, reject: rejectIt };
}

/** A race color table where every index holds this hex (what getHairColors would load). */
function raceTable(hex: string) {
  return Array.from({ length: 192 }, () => ({
    hex,
    rgb: { r: 1, g: 2, b: 3 },
  })) as unknown as Awaited<ReturnType<CharacterColorService['getHairColors']>>;
}

describe('palette bridge: answers to the active worker', () => {
  it("answers a creator eyes request with the color core's page-side provider gives", async () => {
    // Red if the page does not answer palette messages, or answers from anything but core's bridge.
    const { call, worker } = await start();
    askPalette(worker, 1, EYES);
    await vi.waitFor(() => expect(replies(worker)).toHaveLength(1));
    const expected = await pageColor(EYES);
    expect(expected?.hex).toBe(
      new core.CharacterColorService().getEyeColors()[0].hex.toUpperCase()
    );
    const [reply] = replies(worker);
    expect(reply).toEqual({
      type: 'palette-result',
      id: worker.requestId,
      seq: 1,
      color: expected,
    });
    expect(parsePaletteReply(reply)).not.toBeNull();
    expect(call.status).toBe('pending');
    expect(worker.terminate).not.toHaveBeenCalled();
  });

  it('answers a shader eyes request from the shader table', async () => {
    const { worker } = await start();
    askPalette(worker, 4, SHADER_EYES);
    await vi.waitFor(() => expect(replies(worker)).toHaveLength(1));
    const expected = await pageColor(SHADER_EYES);
    expect(expected?.hex).toMatch(/^#[0-9A-F]{6}$/);
    expect(replies(worker)[0]).toEqual({
      type: 'palette-result',
      id: worker.requestId,
      seq: 4,
      color: expected,
    });
  });

  it('answers a race palette request with its tribe and gender', async () => {
    const { worker } = await start();
    askPalette(worker, 2, HAIR);
    await vi.waitFor(() => expect(replies(worker)).toHaveLength(1));
    const expected = await pageColor(HAIR);
    expect(expected).toEqual(expect.objectContaining({ tribe: 'Dunesfolk', gender: 'Feminine' }));
    expect(replies(worker)[0]).toEqual({
      type: 'palette-result',
      id: worker.requestId,
      seq: 2,
      color: expected,
    });
  });

  it('answers a null color for an entry the host does not hold', async () => {
    const { worker } = await start();
    askPalette(worker, 3, { ...EYES, index: 200 });
    await vi.waitFor(() => expect(replies(worker)).toHaveLength(1));
    expect(replies(worker)[0]).toStrictEqual({
      type: 'palette-result',
      id: worker.requestId,
      seq: 3,
      color: null,
    });
  });

  it('answers palette-error when the shared service fails to load a table, with no exception text', async () => {
    // Red if a provider failure leaves the worker waiting, or leaks the exception.
    const loader = vi
      .spyOn(core.CharacterColorService.prototype, 'getHairColors')
      .mockRejectedValue(new Error(CANARY));
    const { call, worker } = await start();
    askPalette(worker, 7, HAIR);
    await vi.waitFor(() => expect(replies(worker)).toHaveLength(1));
    expect(loader).toHaveBeenCalled();
    expect(replies(worker)[0]).toStrictEqual({
      type: 'palette-error',
      id: worker.requestId,
      seq: 7,
    });
    expect(JSON.stringify(worker.posted.map((p) => p.message))).not.toContain(CANARY);
    expect(call.status).toBe('pending');
  });

  it('answers palette-error when a shared-table getter throws', async () => {
    vi.spyOn(core.CharacterColorService.prototype, 'getEyeColors').mockImplementation(() => {
      throw new Error(CANARY);
    });
    const { worker } = await start();
    askPalette(worker, 1, EYES);
    await vi.waitFor(() => expect(replies(worker)).toHaveLength(1));
    expect(replies(worker)[0]).toStrictEqual({
      type: 'palette-error',
      id: worker.requestId,
      seq: 1,
    });
  });

  it(`answers request ${CAP + 1} of one inspection with palette-error`, async () => {
    // Red if the page answers without bound.
    const { worker } = await start();
    for (let seq = 1; seq <= CAP; seq++) askPalette(worker, seq, { ...EYES, index: seq - 1 });
    await vi.waitFor(() => expect(replies(worker)).toHaveLength(CAP));
    for (const reply of replies(worker)) expect(reply.type).toBe('palette-result');
    askPalette(worker, CAP + 1, EYES);
    await vi.waitFor(() => expect(replies(worker)).toHaveLength(CAP + 1));
    const over = replies(worker).find((r) => r.seq === CAP + 1);
    expect(over).toStrictEqual({ type: 'palette-error', id: worker.requestId, seq: CAP + 1 });
  });

  it('shares one CharacterColorService across requests and calls', async () => {
    // Red if each request (or each call) builds its own service: every build reloads the tables.
    const loads = vi.spyOn(core.CharacterColorService.prototype, 'getHairColors');
    const first = await start();
    askPalette(first.worker, 1, HAIR);
    askPalette(first.worker, 2, HAIR);
    await vi.waitFor(() => expect(replies(first.worker)).toHaveLength(2));
    first.worker.emit('message', success(first.worker.requestId));
    await settle();
    const second = await start();
    askPalette(second.worker, 1, HAIR);
    await vi.waitFor(() => expect(replies(second.worker)).toHaveLength(1));
    const instances = new Set(loads.mock.instances);
    expect(loads).toHaveBeenCalledTimes(3);
    expect(instances.size).toBe(1);
  });
});

describe('palette bridge: everything else is ignored', () => {
  it.each<[string, (worker: FakeWorker) => unknown]>([
    [
      'an extra key',
      (w) => ({ type: 'palette', id: w.requestId, seq: 1, request: EYES, raw: CANARY }),
    ],
    [
      'an index of 256',
      (w) => ({ type: 'palette', id: w.requestId, seq: 1, request: { ...EYES, index: 256 } }),
    ],
    ['a zero seq', (w) => ({ type: 'palette', id: w.requestId, seq: 0, request: EYES })],
    ['a missing request', (w) => ({ type: 'palette', id: w.requestId, seq: 1 })],
    [
      'an unknown palette',
      (w) => ({ type: 'palette', id: w.requestId, seq: 1, request: { ...EYES, palette: 'lips' } }),
    ],
    [
      'a page-side reply type',
      (w) => ({ type: 'palette-result', id: w.requestId, seq: 1, color: null }),
    ],
  ])('a palette message with %s: nothing posted, the call stays pending', async (_label, data) => {
    // Red if an invalid request is answered, or treated as a worker failure.
    const { call, worker } = await start();
    worker.emit('message', { data: data(worker) });
    await flushReal();
    expect(replies(worker)).toHaveLength(0);
    expect(call.status).toBe('pending');
    expect(worker.terminate).not.toHaveBeenCalled();
    // ...and a valid request is still answered, and the answer still lands.
    askPalette(worker, 2, EYES);
    await vi.waitFor(() => expect(replies(worker)).toHaveLength(1));
    worker.emit('message', success(worker.requestId));
    await settle();
    expect(call.status).toBe('resolved');
  });

  it('a palette message for another id is ignored', async () => {
    const { call, worker } = await start();
    askPalette(worker, 1, EYES, worker.requestId + 1);
    await flushReal();
    expect(replies(worker)).toHaveLength(0);
    expect(call.status).toBe('pending');
  });

  // Each dead-call case also spies on the getter the request would read: red if a dead call's
  // palette message reaches the page-side provider at all (only the post would be suppressed).
  const eyeLookups = () => vi.spyOn(core.CharacterColorService.prototype, 'getEyeColors');

  it('a superseded worker gets no answer, and nothing reaches the new one', async () => {
    const first = await start();
    const second = await start();
    const lookups = eyeLookups();
    askPalette(first.worker, 1, EYES);
    askPalette(second.worker, 1, EYES, first.worker.requestId);
    await flushReal();
    expect(replies(first.worker)).toHaveLength(0);
    expect(replies(second.worker)).toHaveLength(0);
    expect(lookups).not.toHaveBeenCalled();
  });

  it('a cancelled worker gets no answer', async () => {
    const { worker } = await start();
    mod.cancelCharaInspection();
    const lookups = eyeLookups();
    askPalette(worker, 1, EYES);
    await flushReal();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(replies(worker)).toHaveLength(0);
    expect(lookups).not.toHaveBeenCalled();
  });

  it('a timed-out worker gets no answer', async () => {
    vi.useFakeTimers();
    const { call, worker } = await start();
    await vi.advanceTimersByTimeAsync(5_000);
    await settle();
    expectFailure(call.error, 'timedOut');
    vi.useRealTimers();
    const lookups = eyeLookups();
    askPalette(worker, 1, EYES);
    await flushReal();
    expect(replies(worker)).toHaveLength(0);
    expect(lookups).not.toHaveBeenCalled();
  });

  it('a worker whose call already resolved gets no answer', async () => {
    const { call, worker } = await start();
    worker.emit('message', success(worker.requestId));
    await settle();
    expect(call.status).toBe('resolved');
    const lookups = eyeLookups();
    askPalette(worker, 1, EYES);
    await flushReal();
    expect(replies(worker)).toHaveLength(0);
    expect(lookups).not.toHaveBeenCalled();
  });
});

describe("palette bridge: the page re-validates its provider's answer before posting", () => {
  /** A well-formed creator eyes color whose hex has letters, so a lowercase copy differs. */
  const LETTERED: CharaPaletteColor = {
    table: 'creator',
    palette: 'eyes',
    index: 0,
    hex: '#ABCDEF',
    rgb: [171, 205, 239],
    datasetVersion: 'xivdyetools-host-palette-bridge/1',
  };

  it('posts a well-formed provider color as palette-result', async () => {
    // The control: the stub itself is a color the protocol accepts.
    vi.mocked(core.createCharaPaletteProvider).mockReturnValueOnce({
      getColor: async () => ({ ...LETTERED }),
    });
    const { worker } = await start();
    askPalette(worker, 1, EYES);
    await vi.waitFor(() => expect(replies(worker)).toHaveLength(1));
    expect(replies(worker)[0]).toStrictEqual({
      type: 'palette-result',
      id: worker.requestId,
      seq: 1,
      color: LETTERED,
    });
  });

  it.each<[string, Record<string, unknown>]>([
    ['a lowercase hex', { ...LETTERED, hex: '#abcdef' }],
    ['an extra key', { ...LETTERED, raw: CANARY }],
  ])('answers palette-error when the provider returns a color with %s', async (_label, color) => {
    // Red if the page posts its provider's answer without parsePaletteReply: the worker would be
    // handed a color the protocol refuses (and would only drop it and wait out the deadline).
    const createProvider = vi.mocked(core.createCharaPaletteProvider);
    createProvider.mockReturnValueOnce({
      getColor: async () => color,
    } as unknown as CharaPaletteProvider);
    const { call, worker } = await start();
    askPalette(worker, 5, EYES);
    await vi.waitFor(() => expect(replies(worker)).toHaveLength(1));
    expect(createProvider).toHaveBeenCalledTimes(1);
    expect(replies(worker)[0]).toStrictEqual({
      type: 'palette-error',
      id: worker.requestId,
      seq: 5,
    });
    expect(JSON.stringify(worker.posted.map((p) => p.message))).not.toContain(CANARY);
    expect(call.status).toBe('pending');
  });
});

describe('palette bridge: a late provider answer is never posted', () => {
  async function pendingHairRequest() {
    const load = deferred<Awaited<ReturnType<CharacterColorService['getHairColors']>>>();
    vi.spyOn(core.CharacterColorService.prototype, 'getHairColors').mockReturnValue(load.promise);
    const started = await start();
    askPalette(started.worker, 1, HAIR);
    await settle();
    expect(replies(started.worker)).toHaveLength(0);
    return { ...started, load };
  }

  it('after the call resolved', async () => {
    // Red if the page posts without re-checking, after the await, that the call is still active.
    const { call, worker, load } = await pendingHairRequest();
    worker.emit('message', success(worker.requestId));
    await settle();
    expect(call.status).toBe('resolved');
    load.resolve(raceTable('#112233'));
    await flushReal();
    expect(replies(worker)).toHaveLength(0);
  });

  it('after the call was superseded', async () => {
    const { worker, load } = await pendingHairRequest();
    const next = await start();
    load.resolve(raceTable('#112233'));
    await flushReal();
    expect(replies(worker)).toHaveLength(0);
    expect(replies(next.worker)).toHaveLength(0);
  });

  it('after the call was cancelled', async () => {
    const { worker, load } = await pendingHairRequest();
    mod.cancelCharaInspection();
    load.resolve(raceTable('#112233'));
    await flushReal();
    expect(replies(worker)).toHaveLength(0);
  });

  it('a palette-error after the call settled is not posted either', async () => {
    const load = deferred<Awaited<ReturnType<CharacterColorService['getHairColors']>>>();
    vi.spyOn(core.CharacterColorService.prototype, 'getHairColors').mockReturnValue(load.promise);
    const { worker } = await start();
    askPalette(worker, 1, HAIR);
    await settle();
    mod.cancelCharaInspection();
    load.reject(new Error(CANARY));
    await flushReal();
    expect(replies(worker)).toHaveLength(0);
  });
});

describe('palette bridge: the deadline spans the whole exchange', () => {
  it('times out at exactly 5_000 ms while a palette answer is pending, and never posts it', async () => {
    // Red if a pending palette answer holds the call open, or posts to a timed-out worker.
    const load = deferred<Awaited<ReturnType<CharacterColorService['getHairColors']>>>();
    vi.spyOn(core.CharacterColorService.prototype, 'getHairColors').mockReturnValue(load.promise);
    vi.useFakeTimers();
    const { call, worker } = await start();
    askPalette(worker, 1, HAIR);
    await vi.advanceTimersByTimeAsync(4_999);
    await settle();
    expect(call.status).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expectFailure(call.error, 'timedOut');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    load.resolve(raceTable('#112233'));
    await flushReal();
    expect(replies(worker)).toHaveLength(0);
  });

  it('answered palette requests do not extend the deadline', async () => {
    // Red if each palette answer re-arms the timer.
    vi.useFakeTimers();
    const { call, worker } = await start();
    await vi.advanceTimersByTimeAsync(2_500);
    askPalette(worker, 1, EYES);
    // The creator eyes answer needs no data load, only microtasks.
    for (let i = 0; i < 4; i++) await settle();
    expect(replies(worker)).toHaveLength(1);
    expect(replies(worker)[0].type).toBe('palette-result');
    await vi.advanceTimersByTimeAsync(2_499);
    await settle();
    expect(call.status).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expectFailure(call.error, 'timedOut');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('dyes are attached on the page, after validation', () => {
  it.each(FIXTURES)('%s resolves with the offline database dyes attached', async (name) => {
    // Red if the page adopts the worker's null badges, or looks dyes up anywhere but the
    // host's offline database.
    const fixture = fixtureResults.get(name);
    if (!fixture) throw new Error(`test setup: no fixture ${name}`);
    for (const badge of fixture.worker.gearDyes) expect(badge.dye).toBeNull();
    const { call, worker } = await start();
    worker.emit('message', success(worker.requestId, structuredClone(fixture.worker)));
    await settle();
    expect(call.status).toBe('resolved');
    expect(call.value).toEqual(fixture.attached);
    for (const badge of call.value?.gearDyes ?? []) {
      if (badge.dye === null) continue;
      expect(badge.dye.stainID).toBe(badge.stainId);
      expect(typeof badge.dye.name).toBe('string');
    }
  });

  it('at least one fixture carries a dye the database knows', () => {
    const known = [...fixtureResults.values()].flatMap((f) =>
      f.attached.gearDyes.filter((badge) => badge.dye !== null)
    );
    expect(known.length).toBeGreaterThan(0);
  });

  it('an unknown stain resolves to a null dye', async () => {
    const value = result();
    value.gearDyes = [
      { slot: 'Body', channel: 1, stainId: 86, dye: null },
      { slot: 'Legs', channel: 2, stainId: 65_000, dye: null },
    ];
    const { call, worker } = await start();
    worker.emit('message', success(worker.requestId, value));
    await settle();
    expect(call.status).toBe('resolved');
    const [known, unknown] = call.value?.gearDyes ?? [];
    expect(known.dye?.stainID).toBe(86);
    expect(typeof known.dye?.name).toBe('string');
    expect(unknown.dye).toBeNull();
  });

  it('a well-formed dye the worker sends is replaced by the database dye', async () => {
    // The page never trusts the worker's dye: it looks every badge up itself.
    const forged = { ...new DyeService(dyeDatabase).getByStainId(86), name: 'FORGED-NAME' };
    const value = result();
    value.gearDyes = [{ slot: 'Body', channel: 1, stainId: 86, dye: forged as never }];
    const { call, worker } = await start();
    worker.emit('message', success(worker.requestId, value));
    await settle();
    expect(call.status).toBe('resolved');
    expect(call.value?.gearDyes[0].dye).toEqual(new DyeService(dyeDatabase).getByStainId(86));
    expect(JSON.stringify(call.value)).not.toContain('FORGED-NAME');
  });

  it.each<[string, (dye: Record<string, unknown>) => void]>([
    ['an extra key', (dye) => (dye.raw = CANARY)],
    ['a stainID that differs from its badge', (dye) => (dye.stainID = 85)],
    ['a numeric hex', (dye) => (dye.hex = 0xe2000e)],
  ])(
    'still rejects a worker answer whose dye has %s (validation runs before the attach)',
    async (_label, forge) => {
      // Red if the attach runs first: it would overwrite the forged dye and hide the defect.
      const dye = structuredClone(
        new DyeService(dyeDatabase).getByStainId(86)
      ) as unknown as Record<string, unknown>;
      forge(dye);
      const value = result();
      value.gearDyes = [{ slot: 'Body', channel: 1, stainId: 86, dye: dye as never }];
      const { call, worker } = await start();
      worker.emit('message', success(worker.requestId, value));
      await settle();
      expect(call.status).toBe('rejected');
      expectFailure(call.error, 'workerFailed');
    }
  );
});
