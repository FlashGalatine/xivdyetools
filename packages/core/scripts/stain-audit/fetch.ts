import {
  AUDIT_LIMITS,
  canonicalPins,
  completeSnapshot,
  STAIN_ENDPOINT,
  STAIN_FIELDS,
  validatePage,
} from './model.js';
import type { Capture, CapturedPage, Pins } from './model.js';

export type FetchSelection = { mode: 'latest' } | { mode: 'pinned'; pins: Pins };
export interface Transport {
  fetch: typeof globalThis.fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}
class RequestFailure extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly retryAfterMs = 0,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
function retryAfter(value: string | null, now: number): number {
  if (!value) return 0;
  if (/^[0-9]+$/.test(value.trim())) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}
async function attempt(url: string, transport: Transport, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cancel = (): void => {
    controller.abort();
    if (reader) void reader.cancel().catch(() => undefined);
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      cancel();
      reject(new RequestFailure('Request timed out (headers/body timeout)', true));
    }, timeoutMs);
  });
  const read = async (): Promise<string> => {
    let response: Response;
    try {
      response = await transport.fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
    } catch (error) {
      throw new RequestFailure(
        `Transport failure: ${error instanceof Error ? error.message : 'unknown network error'}`,
        true,
        0,
        { cause: error },
      );
    }
    if (controller.signal.aborted) {
      void response.body?.cancel().catch(() => undefined);
      throw new RequestFailure('Request timed out', true);
    }
    if (response.status !== 200) {
      void response.body?.cancel().catch(() => undefined);
      throw new RequestFailure(
        `HTTP ${response.status}`,
        response.status === 429 || (response.status >= 500 && response.status <= 599),
        retryAfter(response.headers.get('retry-after'), transport.now()),
      );
    }
    if (
      response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !==
      'application/json'
    ) {
      void response.body?.cancel().catch(() => undefined);
      throw new RequestFailure('Expected JSON content type', false);
    }
    const advertised = Number(response.headers.get('content-length'));
    if (advertised > AUDIT_LIMITS.maxBytes || !response.body) {
      void response.body?.cancel().catch(() => undefined);
      throw new RequestFailure('Response missing or exceeds 2 MiB byte limit', false);
    }
    reader = response.body.getReader();
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const chunk = await reader.read().catch((error: unknown) => {
        throw new RequestFailure('Response body transport failure', true, 0, { cause: error });
      });
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > AUDIT_LIMITS.maxBytes)
        throw new RequestFailure('Response exceeds 2 MiB byte limit', false);
      chunks.push(chunk.value);
    }
    try {
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
        Buffer.concat(chunks),
      );
    } catch (error) {
      throw new RequestFailure('Invalid UTF-8 JSON response', false, 0, { cause: error });
    }
  };
  try {
    return await Promise.race([read(), timeout]);
  } finally {
    clearTimeout(timer);
    cancel();
  }
}
async function request(
  url: string,
  transport: Transport,
  deadline: number,
): Promise<{ body: string; attempts: number }> {
  for (let attempts = 1; attempts <= AUDIT_LIMITS.maxAttempts; attempts++) {
    const remaining = deadline - transport.now();
    if (remaining <= 0) throw new Error('Total scan deadline/budget exceeded');
    try {
      return {
        body: await attempt(url, transport, Math.min(remaining, AUDIT_LIMITS.attemptMs)),
        attempts,
      };
    } catch (error) {
      if (
        !(error instanceof RequestFailure) ||
        !error.retryable ||
        attempts === AUDIT_LIMITS.maxAttempts
      )
        throw error;
      const delay = Math.max(attempts * 1000, error.retryAfterMs);
      if (delay + AUDIT_LIMITS.attemptMs > deadline - transport.now())
        throw new Error('Retry-After/backoff cannot fit total scan budget', { cause: error });
      await transport.sleep(delay);
    }
  }
  throw new Error('Request attempts exhausted');
}
export async function fetchStainCapture(
  selection: FetchSelection,
  transport: Transport,
): Promise<Capture> {
  const deadline = transport.now() + AUDIT_LIMITS.runMs;
  const pages: CapturedPage[] = [];
  let pins = selection.mode === 'pinned' ? canonicalPins(selection.pins) : undefined;
  let after: number | undefined;
  try {
    while (pages.length < AUDIT_LIMITS.maxPages) {
      const url = new URL(STAIN_ENDPOINT);
      url.searchParams.set('language', 'en');
      url.searchParams.set('fields', STAIN_FIELDS);
      url.searchParams.set('limit', String(AUDIT_LIMITS.pageRows));
      if (after !== undefined) url.searchParams.set('after', String(after));
      if (pins) {
        url.searchParams.set('version', pins.version);
        url.searchParams.set('schema', pins.schema);
      }
      const { body, attempts } = await request(url.href, transport, deadline);
      const value: unknown = JSON.parse(body);
      const page = validatePage(value, pins);
      pins = canonicalPins(page.pins);
      if (page.rows.length && after !== undefined && page.rows[0].stainID <= after)
        throw new Error('Duplicate/unordered IDs: pagination made no progress');
      pages.push({ url: url.href, status: 200, attempts, body, page });
      if (!page.rows.length) return { pages, snapshot: completeSnapshot(pages.map((p) => p.page)) };
      after = page.rows[page.rows.length - 1].stainID;
      if (pages.length < AUDIT_LIMITS.maxPages) await transport.sleep(AUDIT_LIMITS.gapMs);
    }
    throw new Error('Page limit reached before terminal empty page');
  } catch (error) {
    throw new Error(
      `Incomplete Stain scan: page ${pages.length + 1}, after=${after ?? 'start'}, version=${pins?.version ?? 'unresolved'}, schema=${pins?.schema ?? 'unresolved'}: ${error instanceof Error ? error.message : 'unknown failure'}`,
      { cause: error },
    );
  }
}
