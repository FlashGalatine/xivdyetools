/**
 * Inspects `.chara` bytes off the main thread: one same-origin module worker per call (the CSP's
 * `script-src 'self'` admits it; a `blob:` or `data:` worker would be refused), the input buffer
 * transferred rather than copied, and an answer accepted only when it validates and carries the
 * ACTIVE request id.
 *
 * Only one inspection is pending at a time. A new call supersedes the pending one, and
 * `cancelCharaInspection()` abandons it; either way the old call rejects `superseded` and its
 * worker is terminated, so a late answer can never publish. Every settled path (success, failure,
 * timeout, supersession, cancellation) terminates its worker exactly once and leaves nothing that
 * blocks the next call.
 *
 * The worker holds no palette or dye data. While a call is live, the page answers its worker's
 * palette requests (active id only, at most `CHARA_PALETTE_REQUEST_CAP`) from one shared
 * `CharacterColorService` through core's palette provider, and posts an answer only if the call is
 * still live when it is ready. The deadline spans the whole exchange. After a validated success,
 * the page attaches each badge's dye from its own offline database. `prefetchCharaPalettes()`
 * loads those shared palettes in idle time (the file card calls it when its drop zone shows), so
 * a cold import does not spend its deadline on the palette download.
 *
 * Errors carry one fixed message per code, never event or exception text.
 *
 * @module services/chara-inspection-service
 */

import {
  CharacterColorService,
  createCharaPaletteProvider,
  type CharaPaletteProvider,
  type ImportedCharaCharacter,
} from '@xivdyetools/core';
import { dyeService } from '@services/dye-service-wrapper';
import {
  CHARA_INSPECTION_TIMEOUT_MS,
  CHARA_PALETTE_REQUEST_CAP,
  parseInspectionResponse,
  parsePaletteReply,
  parsePaletteRequestMessage,
  type CharaInspectionRequest,
  type CharaPaletteReply,
  type CharaPaletteRequest,
  type CharaPaletteRequestMessage,
} from './chara-inspection-protocol';

export type CharaInspectionErrorCode = 'unreadable' | 'workerFailed' | 'timedOut' | 'superseded';

const ERROR_MESSAGES: Record<CharaInspectionErrorCode, string> = {
  unreadable: 'chara-inspection:unreadable',
  workerFailed: 'chara-inspection:workerFailed',
  timedOut: 'chara-inspection:timedOut',
  superseded: 'chara-inspection:superseded',
};

/** A failed inspection. The message is a fixed code string; the UI maps `code` to a locale key. */
export class CharaInspectionError extends Error {
  readonly code: CharaInspectionErrorCode;

  constructor(code: CharaInspectionErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'CharaInspectionError';
    this.code = code;
  }
}

interface PendingInspection {
  id: number;
  worker: Worker | null;
  timer: ReturnType<typeof setTimeout> | null;
  /** Palette requests received for this inspection, answered or not. */
  paletteRequests: number;
  resolve: (result: ImportedCharaCharacter) => void;
  reject: (error: CharaInspectionError) => void;
}

let lastId = 0;
let pending: PendingInspection | null = null;

/** One host palette service for every call: each new one would reload the race tables. */
let characterColors: CharacterColorService | undefined;
let pagePalettes: CharaPaletteProvider | undefined;

function getPagePalettes(): CharaPaletteProvider {
  characterColors ??= new CharacterColorService();
  pagePalettes ??= createCharaPaletteProvider(characterColors);
  return pagePalettes;
}

/**
 * One lookup per lazily loaded table the page answers from: the creator hair and skin tables
 * (`CharacterColorService`'s race JSON) and the race and shared shader tables. Any fixed tribe
 * and gender will do; the tables load whole.
 */
const WARM_UP_REQUESTS: readonly CharaPaletteRequest[] = [
  { table: 'creator', palette: 'hair', index: 0, tribe: 'Midlander', gender: 'Feminine' },
  { table: 'creator', palette: 'skin', index: 0, tribe: 'Midlander', gender: 'Feminine' },
  { table: 'shader', palette: 'hair', index: 0, tribe: 'Midlander', gender: 'Feminine' },
  { table: 'shader', palette: 'eyes', index: 0 },
];

/** How long an idle-time warm-up may wait for the browser to go idle. */
const WARM_UP_IDLE_TIMEOUT_MS = 2_000;

/** The warm-up in flight or done; null before the first call and after a failed one. */
let warmUp: Promise<void> | null = null;

/** True when the visitor asked the browser to save data (`navigator.connection.saveData`). */
function saveDataRequested(): boolean {
  try {
    const connection = (globalThis.navigator as { connection?: { saveData?: unknown } } | undefined)
      ?.connection;
    return connection?.saveData === true;
  } catch {
    return false;
  }
}

/** Resolves once the browser is idle (or, without requestIdleCallback, on the next task). */
function whenIdle(): Promise<void> {
  return new Promise<void>((resolve) => {
    const requestIdle = (
      globalThis as {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    if (typeof requestIdle === 'function') {
      try {
        requestIdle.call(globalThis, () => resolve(), { timeout: WARM_UP_IDLE_TIMEOUT_MS });
        return;
      } catch {
        // Fall through to a timer.
      }
    }
    setTimeout(resolve, 0);
  });
}

/**
 * Load the page's palette tables in idle time, before the first import needs them, so a cold
 * import does not spend its deadline downloading the palette chunk. Warms the same shared
 * `CharacterColorService` and provider the inspection answers from. Idempotent (a second call
 * shares the first warm-up), a no-op under `saveData`, and it never throws or rejects: a failed
 * warm-up resolves and lets a later call retry. It changes nothing about an inspection.
 */
export function prefetchCharaPalettes(): Promise<void> {
  if (warmUp) return warmUp;
  if (saveDataRequested()) return Promise.resolve();
  const attempt: Promise<void> = whenIdle()
    .then(async () => {
      const palettes = getPagePalettes();
      await Promise.all(WARM_UP_REQUESTS.map((request) => palettes.getColor(request)));
    })
    .catch(() => {
      // Nothing to report: the first import loads the tables itself. Allow a later retry.
      if (warmUp === attempt) warmUp = null;
    });
  warmUp = attempt;
  return attempt;
}

function nextId(): number {
  lastId = lastId >= Number.MAX_SAFE_INTEGER ? 1 : lastId + 1;
  return lastId;
}

/**
 * Settle the pending call if it is still `call`: clear its deadline, terminate its worker once and
 * release the slot before resolving or rejecting.
 */
function finish(
  call: PendingInspection,
  outcome: { result: ImportedCharaCharacter } | { code: CharaInspectionErrorCode }
): void {
  if (pending !== call) return;
  pending = null;
  if (call.timer !== null) clearTimeout(call.timer);
  call.timer = null;
  const worker = call.worker;
  call.worker = null;
  try {
    worker?.terminate();
  } catch {
    // Nothing to recover: the worker is abandoned either way.
  }
  if ('result' in outcome) call.resolve(outcome.result);
  else call.reject(new CharaInspectionError(outcome.code));
}

/** True while `call` is the active call and `worker` is still its (unterminated) worker. */
function isLive(call: PendingInspection, worker: Worker): boolean {
  return pending === call && call.worker === worker;
}

/**
 * Answer one palette request from the page's palettes, to the same worker, and only if the call
 * is still live once the answer is ready. The deadline is not touched: it spans the whole exchange.
 */
async function answerPalette(
  call: PendingInspection,
  worker: Worker,
  message: CharaPaletteRequestMessage
): Promise<void> {
  const { id, seq } = message;
  const failure: CharaPaletteReply = { type: 'palette-error', id, seq };
  call.paletteRequests += 1;
  let reply: CharaPaletteReply = failure;
  if (call.paletteRequests <= CHARA_PALETTE_REQUEST_CAP) {
    try {
      const color = await getPagePalettes().getColor(message.request);
      reply = parsePaletteReply({ type: 'palette-result', id, seq, color }) ?? failure;
    } catch {
      // The provider failed: the worker gets a palette-error, never the exception.
    }
  }
  if (!isLive(call, worker)) return;
  try {
    worker.postMessage(reply);
  } catch {
    // The worker is gone or the reply could not be cloned; the deadline ends the call.
  }
}

/** The validated projection with each badge's dye looked up in the host's offline database. */
function attachDyes(result: ImportedCharaCharacter): ImportedCharaCharacter {
  return {
    ...result,
    gearDyes: result.gearDyes.map((badge) => ({
      ...badge,
      dye: dyeService.getByStainId(badge.stainId) ?? null,
    })),
  };
}

function handleMessage(call: PendingInspection, worker: Worker, data: unknown): void {
  const paletteRequest = parsePaletteRequestMessage(data);
  if (paletteRequest !== null) {
    // Only the live call's own worker, asking for the active id, is answered.
    if (paletteRequest.id === call.id && isLive(call, worker)) {
      void answerPalette(call, worker, paletteRequest);
    }
    return;
  }
  const response = parseInspectionResponse(data);
  if (response === null) {
    // Malformed, unknown-type or another id's answer is ignored. A success for the ACTIVE id whose
    // result fails validation is a defective worker: fail now rather than wait for the deadline.
    const envelope = (typeof data === 'object' && data !== null ? data : {}) as {
      type?: unknown;
      id?: unknown;
    };
    if (envelope.type === 'success' && envelope.id === call.id) {
      finish(call, { code: 'workerFailed' });
    }
    return;
  }
  if (response.id !== call.id) return;
  if (response.type === 'error') {
    finish(call, { code: response.code });
    return;
  }
  if (pending !== call) return;
  let result: ImportedCharaCharacter;
  try {
    // After validation, so a malformed dye from the worker still fails the call above.
    result = attachDyes(response.result);
  } catch {
    finish(call, { code: 'workerFailed' });
    return;
  }
  finish(call, { result });
}

/**
 * Inspect one `.chara` buffer in a worker. The buffer is transferred, so it is detached here once
 * the request is posted. Rejects with `CharaInspectionError`; never throws synchronously.
 */
export function inspectCharaBytes(bytes: ArrayBuffer): Promise<ImportedCharaCharacter> {
  cancelCharaInspection();

  return new Promise<ImportedCharaCharacter>((resolve, reject) => {
    const call: PendingInspection = {
      id: nextId(),
      worker: null,
      timer: null,
      paletteRequests: 0,
      resolve,
      reject,
    };
    pending = call;

    try {
      call.worker = new Worker(new URL('../workers/chara-inspection.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      finish(call, { code: 'workerFailed' });
      return;
    }

    const worker = call.worker;
    worker.addEventListener('message', (event: MessageEvent) =>
      handleMessage(call, worker, event.data)
    );
    worker.addEventListener('error', () => finish(call, { code: 'workerFailed' }));
    worker.addEventListener('messageerror', () => finish(call, { code: 'workerFailed' }));
    call.timer = setTimeout(() => finish(call, { code: 'timedOut' }), CHARA_INSPECTION_TIMEOUT_MS);

    const request: CharaInspectionRequest = { type: 'inspect', id: call.id, bytes };
    try {
      worker.postMessage(request, [bytes]);
    } catch {
      finish(call, { code: 'workerFailed' });
    }
  });
}

/** Abandon the pending inspection, if any: it rejects `superseded` and its worker is terminated. */
export function cancelCharaInspection(): void {
  if (pending) finish(pending, { code: 'superseded' });
}
