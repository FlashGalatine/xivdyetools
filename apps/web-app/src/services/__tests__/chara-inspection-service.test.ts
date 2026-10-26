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
  dyeDatabase,
  inspectCharaForTools,
  resolveCharaForTools,
  type ImportedCharaCharacter,
} from '@xivdyetools/core';
import { isInspectionRequest } from '../chara-inspection-protocol';

type ServiceModule = typeof import('../chara-inspection-service');
type FailureCode = 'unreadable' | 'workerFailed' | 'timedOut' | 'superseded';

const CANARY = 'RAW-WORKER-CANARY-7f3a';
// A path, not `new URL('<literal>', import.meta.url)`: Vite's asset plugin rewrites that pattern
// to a dev-server http:// URL under vitest, which fileURLToPath refuses.
const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../packages/core/src/services/chara/__tests__/fixtures/lalafell-dunesfolk.chara'
);

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
let validResult: ImportedCharaCharacter;

function result(): ImportedCharaCharacter {
  return structuredClone(validResult);
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
  const bytes = new Uint8Array(readFileSync(FIXTURE));
  const dyes = new DyeService(dyeDatabase);
  validResult = await resolveCharaForTools(
    inspectCharaForTools(bytes),
    new CharacterColorService(),
    {
      getByStainId: (stainId: number) => dyes.getByStainId(stainId),
    }
  );
});

beforeEach(async () => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
  vi.resetModules();
  mod = await import('../chara-inspection-service');
});

afterEach(() => {
  mod.cancelCharaInspection();
  vi.useRealTimers();
  vi.unstubAllGlobals();
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
    expect(call.value).toEqual(validResult);
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
    expect(second.call.value).toEqual(validResult);
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
      expect(next.call.value).toEqual(validResult);
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
