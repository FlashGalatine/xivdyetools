/**
 * An in-thread stand-in for `@services/chara-inspection-service`, installed for every suite by
 * `setup.ts`: jsdom has no `Worker`, so a real-path suite (load a fixture through the real loader
 * and draw it) would otherwise fail every import with `workerFailed`.
 *
 * It runs the worker's own exported `handleInspectRequest` against core's palette provider over
 * one shared `CharacterColorService`, answers each palette request through the protocol's reply
 * validator, sends the answer through `structuredClone` and `parseInspectionResponse` (the thread
 * boundary and the page's validation), and attaches each badge's dye from the page's offline
 * database, as the service does. Error answers throw the service's own `CharaInspectionError`.
 * Supersession matches the service: a new call, or `cancelCharaInspection()`, rejects the pending
 * call `superseded`, and a late answer never settles it.
 *
 * What it does not reproduce: the worker thread itself, the transfer of the input buffer, and the
 * 5,000 ms deadline. `chara-inspection-service.test.ts` (which unmocks the service) and the worker
 * tests cover those.
 *
 * Every dependency is imported lazily inside the calls, never at module top: `setup.ts` loads this
 * module, and a statically imported worker, protocol or core would be cached before a suite's own
 * `vi.mock` of them could apply (the worker suite mocks core).
 */
import type {
  CharaPaletteProvider,
  CharacterColorService,
  ImportedCharaCharacter,
} from '@xivdyetools/core';
import type { CharaInspectionErrorCode } from '@services/chara-inspection-service';

/** The service's error class, taken from the ORIGINAL module so `instanceof` holds for its users. */
type CharaInspectionErrorClass = new (code: CharaInspectionErrorCode) => Error & {
  readonly code: CharaInspectionErrorCode;
};

export interface InlineCharaInspection {
  inspectCharaBytes(bytes: ArrayBuffer): Promise<ImportedCharaCharacter>;
  cancelCharaInspection(): void;
}

interface PendingCall {
  settled: boolean;
  reject: (error: Error) => void;
}

/** Build the two service functions around the original module's `CharaInspectionError`. */
export function createInlineCharaInspection(
  CharaInspectionError: CharaInspectionErrorClass
): InlineCharaInspection {
  let lastId = 0;
  let pending: PendingCall | null = null;
  let colors: CharacterColorService | undefined;
  let palettes: CharaPaletteProvider | undefined;

  async function pagePalettes(): Promise<CharaPaletteProvider> {
    if (!palettes) {
      const core = await import('@xivdyetools/core');
      colors ??= new core.CharacterColorService();
      palettes = core.createCharaPaletteProvider(colors);
    }
    return palettes;
  }

  async function inspect(id: number, bytes: ArrayBuffer): Promise<ImportedCharaCharacter> {
    const [{ handleInspectRequest }, protocol, { dyeService }] = await Promise.all([
      import('../../workers/chara-inspection.worker'),
      import('@services/chara-inspection-protocol'),
      import('@services/dye-service-wrapper'),
    ]);
    const provider = await pagePalettes();
    let seq = 0;
    const source = {
      // As the page answers a palette message: the provider's color, re-validated as a reply.
      async getColor(request: Parameters<CharaPaletteProvider['getColor']>[0]) {
        seq += 1;
        const color = await provider.getColor(request);
        const reply = protocol.parsePaletteReply(
          structuredClone({ type: 'palette-result', id, seq, color })
        );
        if (!reply || reply.type !== 'palette-result') {
          throw new Error('chara-inspection:paletteUnavailable');
        }
        return reply.color;
      },
    };
    const answer = await handleInspectRequest({ type: 'inspect', id, bytes }, source);
    const response = protocol.parseInspectionResponse(structuredClone(answer));
    if (response === null) throw new CharaInspectionError('workerFailed');
    if (response.type === 'error') throw new CharaInspectionError(response.code);
    // The service's attach step: each badge's dye from the page's own offline database.
    return {
      ...response.result,
      gearDyes: response.result.gearDyes.map((badge) => ({
        ...badge,
        dye: dyeService.getByStainId(badge.stainId) ?? null,
      })),
    };
  }

  function cancelCharaInspection(): void {
    const call = pending;
    if (!call || call.settled) return;
    call.settled = true;
    pending = null;
    call.reject(new CharaInspectionError('superseded'));
  }

  function inspectCharaBytes(bytes: ArrayBuffer): Promise<ImportedCharaCharacter> {
    cancelCharaInspection();
    lastId += 1;
    const id = lastId;
    return new Promise<ImportedCharaCharacter>((resolve, reject) => {
      const call: PendingCall = { settled: false, reject };
      pending = call;
      const settle = (outcome: () => void): void => {
        if (call.settled) return;
        call.settled = true;
        if (pending === call) pending = null;
        outcome();
      };
      inspect(id, bytes).then(
        (result) => settle(() => resolve(result)),
        (error: unknown) =>
          settle(() =>
            reject(
              error instanceof CharaInspectionError
                ? error
                : new CharaInspectionError('workerFailed')
            )
          )
      );
    });
  }

  return { inspectCharaBytes, cancelCharaInspection };
}
