/**
 * The `.chara` inspection worker: reads one transferred buffer through core's facade (8 KiB cap)
 * and answers with the projected character, never the inspection or document behind it.
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

import {
  CharacterColorService,
  DyeService,
  dyeDatabase,
  inspectCharaForTools,
  resolveCharaForTools,
} from '@xivdyetools/core';
import {
  isInspectionRequest,
  type CharaInspectionRequest,
  type CharaInspectionResponse,
} from '../services/chara-inspection-protocol';

let characterColors: CharacterColorService | undefined;
let dyes: DyeService | undefined;

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

/** True when a thrown value carries one of the library's input-refusal codes. */
function isInputRefusal(thrown: unknown): boolean {
  if (typeof thrown !== 'object' || thrown === null) return false;
  const code: unknown = (thrown as { code?: unknown }).code;
  return typeof code === 'string' && INPUT_REFUSAL_CODES.has(code);
}

/** Inspect and project one request's bytes. Never rejects. */
export async function handleInspectRequest(
  request: CharaInspectionRequest
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
    characterColors ??= new CharacterColorService();
    dyes ??= new DyeService(dyeDatabase);
    const result = await resolveCharaForTools(inspection, characterColors, dyes);
    return { type: 'success', id, result };
  } catch {
    return { type: 'error', id, code: 'workerFailed' };
  }
}

async function onInspectMessage(event: MessageEvent): Promise<void> {
  if (!isInspectionRequest(event.data)) return;
  const response = await handleInspectRequest(event.data);
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

// Registered only inside a real worker scope, so importing this module elsewhere (tests, a
// bundler's graph walk) wires nothing.
if (typeof (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope !== 'undefined') {
  globalThis.addEventListener('message', (event: MessageEvent) => {
    void onInspectMessage(event);
  });
}
