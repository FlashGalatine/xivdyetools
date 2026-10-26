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
 * the page attaches each badge's dye from its own offline database.
 *
 * Errors carry one fixed message per code, never event or exception text.
 *
 * @testonly not yet wired into the .chara loader; chara-inspection-service.test.ts drives the
 * worker lifecycle (transfer, active-id answers, timeout, supersession) until the import flow uses it.
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
