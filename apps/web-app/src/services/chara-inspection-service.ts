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
 * Errors carry one fixed message per code, never event or exception text.
 *
 * @testonly not yet wired into the .chara loader; chara-inspection-service.test.ts drives the
 * worker lifecycle (transfer, active-id answers, timeout, supersession) until the import flow uses it.
 *
 * @module services/chara-inspection-service
 */

import type { ImportedCharaCharacter } from '@xivdyetools/core';
import {
  CHARA_INSPECTION_TIMEOUT_MS,
  parseInspectionResponse,
  type CharaInspectionRequest,
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
  resolve: (result: ImportedCharaCharacter) => void;
  reject: (error: CharaInspectionError) => void;
}

let lastId = 0;
let pending: PendingInspection | null = null;

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

function handleMessage(call: PendingInspection, data: unknown): void {
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
  if (response.type === 'success') finish(call, { result: response.result });
  else finish(call, { code: response.code });
}

/**
 * Inspect one `.chara` buffer in a worker. The buffer is transferred, so it is detached here once
 * the request is posted. Rejects with `CharaInspectionError`; never throws synchronously.
 */
export function inspectCharaBytes(bytes: ArrayBuffer): Promise<ImportedCharaCharacter> {
  cancelCharaInspection();

  return new Promise<ImportedCharaCharacter>((resolve, reject) => {
    const call: PendingInspection = { id: nextId(), worker: null, timer: null, resolve, reject };
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
    worker.addEventListener('message', (event: MessageEvent) => handleMessage(call, event.data));
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
