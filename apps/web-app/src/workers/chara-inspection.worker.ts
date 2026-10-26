/**
 * The `.chara` inspection worker: reads one transferred buffer through core's facade (8 KiB cap)
 * and answers with the projected character, never the inspection or document behind it.
 *
 * The worker loads no palette or dye data of its own: the page already bundles the palettes, and a
 * second copy here would ship the same tables twice. While it inspects, it asks the page for each
 * palette color (`palette` messages, at most `CHARA_PALETTE_REQUEST_CAP` per inspection) and sends
 * every dye badge as `dye: null`; the page attaches the dyes. It projects through core's
 * `resolveCharaWithProvider`, the entry with no import path to the palette tables, so a production
 * build emits no shader-table chunk for the worker. Core is imported through its narrow
 * `@xivdyetools/core/chara` entry, never the barrel: the barrel would bundle core's color engine,
 * localization and locale data into this chunk.
 *
 * Core's refusal of the input answers `unreadable`; anything unexpected answers `workerFailed`.
 * No exception or message text crosses the boundary, and nothing here logs: a log line could carry
 * a label from the file.
 *
 * @entrypoint No importer by design — the page starts this module as a module worker through
 * new Worker(new URL(…, import.meta.url)), which the bundler follows and an import scan cannot
 *
 * @module workers/chara-inspection.worker
 */

import { inspectCharaForTools, resolveCharaWithProvider } from '@xivdyetools/core/chara';
import {
  CHARA_PALETTE_REQUEST_CAP,
  isInspectionRequest,
  isPaletteRequestMessage,
  parsePaletteReply,
  type CharaInspectionRequest,
  type CharaInspectionResponse,
  type CharaPaletteColor,
  type CharaPaletteReply,
  type CharaPaletteRequest,
  type CharaPaletteRequestMessage,
} from '../services/chara-inspection-protocol';

/** Where the projection gets its palette colors: in a worker scope, the page. */
interface CharaPaletteSource {
  getColor(request: CharaPaletteRequest): Promise<CharaPaletteColor | null>;
}

/**
 * The library's `CharaInputError` codes that refuse the INPUT (xivcharakit docs/api.md, "CharaErrorCode").
 * `INVALID_OPTIONS` and `INVALID_INPUT` are left out on purpose: the worker always passes a
 * Uint8Array and core's fixed limits, so either one means a host defect, not a bad file.
 */
const INPUT_REFUSAL_CODES: ReadonlySet<string> = new Set([
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
]);

/**
 * The one rejection the bridge gives the library (a fixed code, never page text). The library
 * records it as an unavailable palette; it never reaches the page.
 */
const PALETTE_UNAVAILABLE = 'chara-inspection:paletteUnavailable';

/** True when a thrown value carries one of the library's input-refusal codes. */
function isInputRefusal(thrown: unknown): boolean {
  if (typeof thrown !== 'object' || thrown === null) return false;
  const code: unknown = (thrown as { code?: unknown }).code;
  return typeof code === 'string' && INPUT_REFUSAL_CODES.has(code);
}

/** Inspect and project one request's bytes against `palettes`, with no dye lookup. Never rejects. */
export async function handleInspectRequest(
  request: CharaInspectionRequest,
  palettes: CharaPaletteSource
): Promise<CharaInspectionResponse> {
  const { id } = request;
  let inspection: ReturnType<typeof inspectCharaForTools>;
  try {
    inspection = inspectCharaForTools(new Uint8Array(request.bytes));
  } catch (thrown) {
    // Only core's own refusal of the input is `unreadable`; any other throw is unexpected.
    return { type: 'error', id, code: isInputRefusal(thrown) ? 'unreadable' : 'workerFailed' };
  }
  try {
    const result = await resolveCharaWithProvider(inspection, palettes);
    return { type: 'success', id, result };
  } catch {
    return { type: 'error', id, code: 'workerFailed' };
  }
}

interface WaitingRequest {
  resolve: (color: CharaPaletteColor | null) => void;
  reject: (error: Error) => void;
}

/** The palette requests awaiting a page reply, by inspection id, then by seq. */
const waitingByInspection = new Map<number, Map<number, WaitingRequest>>();

/** The library's request, rebuilt from its allowlisted fields only. */
function copyRequest(request: CharaPaletteRequest): CharaPaletteRequest {
  const copy: CharaPaletteRequest = {
    table: request.table,
    palette: request.palette,
    index: request.index,
  };
  if (request.tribe !== undefined) copy.tribe = request.tribe;
  if (request.gender !== undefined) copy.gender = request.gender;
  return copy;
}

/**
 * A palette source that asks the page: each request posts one `palette` message with the next
 * seq and settles on the reply carrying the same id AND seq. A null color resolves null; a
 * `palette-error` rejects. Past the cap, a request rejects without posting.
 */
function createPageBridge(id: number): { source: CharaPaletteSource; close: () => void } {
  const waiting = new Map<number, WaitingRequest>();
  waitingByInspection.set(id, waiting);
  let posted = 0;
  let closed = false;

  const source: CharaPaletteSource = {
    getColor(request) {
      if (closed || posted >= CHARA_PALETTE_REQUEST_CAP) {
        return Promise.reject(new Error(PALETTE_UNAVAILABLE));
      }
      posted += 1;
      const seq = posted;
      const message: CharaPaletteRequestMessage = {
        type: 'palette',
        id,
        seq,
        request: copyRequest(request),
      };
      // A request the page would refuse would only wait out the deadline: fail it here instead.
      if (!isPaletteRequestMessage(message)) {
        return Promise.reject(new Error(PALETTE_UNAVAILABLE));
      }
      return new Promise<CharaPaletteColor | null>((resolve, reject) => {
        waiting.set(seq, { resolve, reject });
        try {
          globalThis.postMessage(message);
        } catch {
          waiting.delete(seq);
          reject(new Error(PALETTE_UNAVAILABLE));
        }
      });
    },
  };

  const close = (): void => {
    closed = true;
    if (waitingByInspection.get(id) === waiting) waitingByInspection.delete(id);
    for (const request of waiting.values()) request.reject(new Error(PALETTE_UNAVAILABLE));
    waiting.clear();
  };

  return { source, close };
}

/** Settle the request a validated reply answers; a stale or unknown reply is ignored. */
function settlePaletteReply(reply: CharaPaletteReply): void {
  const waiting = waitingByInspection.get(reply.id);
  const request = waiting?.get(reply.seq);
  if (!waiting || !request) return;
  waiting.delete(reply.seq);
  if (reply.type === 'palette-error') request.reject(new Error(PALETTE_UNAVAILABLE));
  else request.resolve(reply.color);
}

async function onInspectMessage(request: CharaInspectionRequest): Promise<void> {
  const bridge = createPageBridge(request.id);
  let response: CharaInspectionResponse;
  try {
    response = await handleInspectRequest(request, bridge.source);
  } finally {
    bridge.close();
  }
  try {
    globalThis.postMessage(response);
  } catch {
    // The result could not be cloned: answer with the fixed failure instead.
    const failure: CharaInspectionResponse = {
      type: 'error',
      id: response.id,
      code: 'workerFailed',
    };
    try {
      globalThis.postMessage(failure);
    } catch {
      // The page's deadline ends the call.
    }
  }
}

function onMessage(data: unknown): void {
  if (isInspectionRequest(data)) {
    void onInspectMessage(data);
    return;
  }
  const reply = parsePaletteReply(data);
  if (reply) settlePaletteReply(reply);
}

// Registered only inside a real worker scope, so importing this module elsewhere (tests, a
// bundler's graph walk) wires nothing.
if (typeof (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope !== 'undefined') {
  globalThis.addEventListener('message', (event: MessageEvent) => {
    onMessage(event.data);
  });
}
