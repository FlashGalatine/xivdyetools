/** Build-time transport: one immutable XIVAPI context and optional exact-URL replay. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Pins = { version: string; schema: string };
const VERSION = /^[0-9a-f]{16}$/;
const SCHEMA = /^exdschema@2:rev:[0-9a-f]{40}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const XIVAPI = 'https://v2.xivapi.com/api/';
const UA = 'xivdyetools-build-acquisition/1.0 (https://xivdyetools.app)';
const TIMEOUT_MS = 30_000;
const MAX_BODY_BYTES = 64 * 1024 * 1024;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalPins(body: unknown): Pins {
  if (!record(body) || typeof body.version !== 'string' || !VERSION.test(body.version)) {
    throw new Error(
      'XIVAPI response is missing a canonical game version (16 lowercase hex digits)',
    );
  }
  if (typeof body.schema !== 'string' || !SCHEMA.test(body.schema)) {
    throw new Error(
      'XIVAPI response is missing a canonical schema (exdschema@2:rev:<40 lowercase hex digits>)',
    );
  }
  return { version: body.version, schema: body.schema };
}

/** Legacy metadata needs a deliberate schema override; recorded pins cannot be replaced. */
export function pinnedSelection(
  meta: unknown,
  schemaOverride?: string,
): { teamcraftCommit: string; version: string; schema: string } {
  if (
    !record(meta) ||
    typeof meta.teamcraftCommit !== 'string' ||
    !COMMIT.test(meta.teamcraftCommit)
  ) {
    throw new Error(
      '--pinned requires a recorded immutable Teamcraft commit (40 lowercase hex digits)',
    );
  }
  if (typeof meta.xivapiVersion !== 'string' || !VERSION.test(meta.xivapiVersion)) {
    throw new Error(
      '--pinned requires a recorded canonical XIVAPI version (16 lowercase hex digits)',
    );
  }
  if (schemaOverride !== undefined && !SCHEMA.test(schemaOverride)) {
    throw new Error('--schema requires exdschema@2:rev:<40 lowercase hex digits>');
  }
  const schema = Object.hasOwn(meta, 'xivapiSchema') ? meta.xivapiSchema : schemaOverride;
  if (typeof schema !== 'string' || !SCHEMA.test(schema)) {
    throw new Error(
      '--pinned metadata has no valid XIVAPI schema; legacy metadata requires an explicit --schema pin',
    );
  }
  if (schemaOverride !== undefined && schema !== schemaOverride) {
    throw new Error('--schema conflicts with the recorded XIVAPI schema');
  }
  return { teamcraftCommit: meta.teamcraftCommit, version: meta.xivapiVersion, schema };
}

function validateXivapi(body: unknown, expected?: Partial<Pins>): Pins {
  const pins = canonicalPins(body);
  if (expected?.version !== undefined && pins.version !== expected.version) {
    throw new Error(
      `XIVAPI version conflicts with the fixed pin: expected ${expected.version}, received ${pins.version}`,
    );
  }
  if (expected?.schema !== undefined && pins.schema !== expected.schema) {
    throw new Error(
      `XIVAPI schema conflicts with the fixed pin: expected ${expected.schema}, received ${pins.schema}`,
    );
  }
  // canonicalPins has checked this already; keep the type guard local for TypeScript.
  if (!record(body)) throw new Error('Invalid XIVAPI response');
  const validRow = (value: unknown, fieldsRequired: boolean): boolean => {
    if (!record(value) || !Number.isSafeInteger(value.row_id) || (value.row_id as number) < 0)
      return false;
    if ((fieldsRequired || Object.hasOwn(value, 'fields')) && !record(value.fields)) return false;
    if (Object.hasOwn(value, 'version') && value.version !== pins.version) return false;
    if (Object.hasOwn(value, 'schema') && value.schema !== pins.schema) return false;
    return true;
  };
  let payload = false;
  if (Object.hasOwn(body, 'fields')) {
    if (!record(body.fields)) throw new Error('Invalid XIVAPI fields payload');
    payload = true;
  }
  for (const key of ['rows', 'results'] as const) {
    if (!Object.hasOwn(body, key)) continue;
    const values = body[key];
    if (!Array.isArray(values) || !values.every((value) => validRow(value, key === 'results'))) {
      throw new Error(`Invalid XIVAPI ${key} payload`);
    }
    payload = true;
  }
  if (!payload) throw new Error('XIVAPI response has no valid fields, rows, or results payload');
  if (Object.hasOwn(body, 'next') && body.next !== null && typeof body.next !== 'string') {
    throw new Error('Invalid XIVAPI cursor payload');
  }
  return pins;
}

interface Options {
  version?: string;
  schema?: string;
  cacheDir?: string;
  offline?: boolean;
  fetch?: typeof globalThis.fetch;
  /** A lower cap may be used by bounded callers; never raises the 64 MiB ceiling. */
  maxBodyBytes?: number;
}

class HttpFailure extends Error {
  constructor(
    message: string,
    readonly retry: boolean,
  ) {
    super(message);
  }
}

export class AcquisitionSource {
  private readonly version: string;
  private readonly schema: string | undefined;
  private readonly cacheDir: string | undefined;
  private readonly offline: boolean;
  private readonly fetch: typeof globalThis.fetch;
  private readonly maxBodyBytes: number;
  private selected: Pins | undefined;
  private resolving: Promise<Pins> | undefined;

  constructor(options: Options = {}) {
    this.version = options.version ?? 'latest';
    this.schema = options.schema;
    this.cacheDir = options.cacheDir;
    this.offline = options.offline ?? false;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.maxBodyBytes = options.maxBodyBytes ?? MAX_BODY_BYTES;
    if (
      !Number.isSafeInteger(this.maxBodyBytes) ||
      this.maxBodyBytes < 1 ||
      this.maxBodyBytes > MAX_BODY_BYTES
    ) {
      throw new Error('maxBodyBytes must be a positive integer no greater than 64 MiB');
    }
    if (!this.version.trim() || (this.schema !== undefined && !SCHEMA.test(this.schema))) {
      throw new Error(
        'Acquisition source requires a nonempty version and an immutable schema when supplied',
      );
    }
    if (VERSION.test(this.version) && this.schema !== undefined) {
      this.selected = { version: this.version, schema: this.schema };
    }
    if (this.offline && (!this.cacheDir || !this.selected)) {
      throw new Error(
        '--offline requires a cache directory and both immutable XIVAPI version/schema pins',
      );
    }
  }

  get pins(): Pins {
    if (!this.selected) throw new Error('XIVAPI pins have not been resolved');
    return { ...this.selected };
  }

  async resolve(): Promise<Pins> {
    if (this.selected) return this.pins;
    if (!this.resolving) {
      this.resolving = this.discover().finally(() => {
        this.resolving = undefined;
      });
    }
    return { ...(await this.resolving) };
  }

  private async discover(): Promise<Pins> {
    const query = new URLSearchParams({ fields: 'Name', version: this.version });
    if (this.schema !== undefined) query.set('schema', this.schema);
    const expected = {
      version: VERSION.test(this.version) ? this.version : undefined,
      schema: this.schema,
    };
    let selected: Pins | undefined;
    // Discovery is deliberately live and uncached: latest is never an immutable identity.
    await this.load(`${XIVAPI}sheet/Item/1?${query}`, false, (body) => {
      selected = validateXivapi(body, expected);
    });
    if (!selected) throw new Error('XIVAPI pins have not been resolved');
    this.selected = selected;
    return this.pins;
  }

  async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const pins = await this.resolve();
    if (!/^[a-zA-Z0-9_/-]+$/.test(path) || path.includes('..'))
      throw new Error('Invalid XIVAPI path');
    const query = new URLSearchParams({ ...params, ...pins });
    const url = `${XIVAPI}${path.replace(/^\/+/, '')}?${query}`;
    return this.load<T>(url, true, (body) => {
      validateXivapi(body, pins);
    });
  }

  /** Teamcraft discovery stays live; only raw files addressed by full commit are cached. */
  async json<T>(url: string): Promise<T> {
    const parsed = new URL(url);
    const immutable =
      parsed.protocol === 'https:' &&
      parsed.hostname === 'raw.githubusercontent.com' &&
      /^\/ffxiv-teamcraft\/ffxiv-teamcraft\/[0-9a-f]{40}\/.+\.json$/.test(parsed.pathname);
    return this.load<T>(url, immutable, (body) => {
      if (!record(body) && !Array.isArray(body))
        throw new Error(`Invalid Teamcraft JSON payload: ${url}`);
    });
  }

  private parse(text: string, url: string, validate: (body: unknown) => void): unknown {
    if (Buffer.byteLength(text, 'utf8') > this.maxBodyBytes)
      throw new Error(`Response body exceeds ${this.maxBodyBytes} bytes: ${url}`);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${url}`);
    }
    validate(body);
    return body;
  }

  private async load<T>(
    url: string,
    immutable: boolean,
    validate: (body: unknown) => void,
  ): Promise<T> {
    const file =
      immutable && this.cacheDir
        ? join(this.cacheDir, `${createHash('sha256').update(url).digest('hex')}.json`)
        : undefined;
    if (file) {
      let cached: string | undefined;
      try {
        // JSON escaping can expand raw text to at most six times its byte size.
        if ((await stat(file)).size > this.maxBodyBytes * 6 + url.length + 1024)
          throw new Error(`Cache envelope too large: ${file}`);
        cached = await readFile(file, 'utf8');
      } catch (error) {
        if (!record(error) || error.code !== 'ENOENT') throw error;
      }
      if (cached !== undefined) {
        let envelope: unknown;
        try {
          envelope = JSON.parse(cached);
        } catch {
          throw new Error(`Malformed acquisition cache: ${file}`);
        }
        if (!record(envelope) || envelope.url !== url || typeof envelope.body !== 'string') {
          throw new Error(`Invalid acquisition cache envelope: ${file}`);
        }
        return this.parse(envelope.body, url, validate) as T;
      }
    }
    if (this.offline) throw new Error(`Offline acquisition cache miss: ${url}`);
    const text = await this.download(url);
    const body = this.parse(text, url, validate);
    if (file) {
      await mkdir(this.cacheDir!, { recursive: true });
      await writeFile(file, JSON.stringify({ url, body: text }), 'utf8');
    }
    return body as T;
  }

  private async download(url: string): Promise<string> {
    for (let attempt = 1; ; attempt++) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Acquisition request timeout after ${TIMEOUT_MS}ms: ${url}`));
          controller.abort();
        }, TIMEOUT_MS);
      });
      try {
        const request = async () => {
          const response = await this.fetch(url, {
            headers: { 'User-Agent': UA },
            signal: controller.signal,
          });
          if (controller.signal.aborted) {
            void response.body?.cancel().catch(() => {});
            throw new Error(`Acquisition request timeout: ${url}`);
          }
          if (!response.ok) {
            void response.body?.cancel().catch(() => {});
            if (response.status === 429)
              throw new HttpFailure(`429 rate limited; retry later: ${url}`, false);
            if (response.status === 503 && url.startsWith(XIVAPI)) {
              throw new HttpFailure(
                `XIVAPI 503: this version is unavailable or not ingested; retry later: ${url}`,
                false,
              );
            }
            throw new HttpFailure(
              `${response.status} ${response.statusText}: ${url}`,
              response.status >= 500 && response.status <= 599,
            );
          }
          const reader = response.body?.getReader();
          if (!reader) throw new Error(`Missing response body: ${url}`);
          const cancel = () => {
            void reader.cancel().catch(() => {});
          };
          controller.signal.addEventListener('abort', cancel, { once: true });
          const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });
          let bytes = 0;
          let text = '';
          try {
            for (;;) {
              const chunk = await reader.read();
              if (chunk.done) break;
              bytes += chunk.value.byteLength;
              if (bytes > this.maxBodyBytes)
                throw new Error(`Response body exceeds ${this.maxBodyBytes} bytes: ${url}`);
              text += decoder.decode(chunk.value, { stream: true });
            }
            return text + decoder.decode();
          } finally {
            controller.signal.removeEventListener('abort', cancel);
            cancel();
          }
        };
        return await Promise.race([request(), timeout]);
      } catch (error) {
        if (!(error instanceof HttpFailure) || !error.retry || attempt >= 3) throw error;
      } finally {
        clearTimeout(timer);
        controller.abort();
      }
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}
