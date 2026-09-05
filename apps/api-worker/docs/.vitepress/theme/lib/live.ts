/**
 * The console card's request plumbing and the live-strip readers.
 *
 * Nothing here decides *when* to fetch — the index rows call `fetchStrip` on
 * mount, the card calls `send` on tap — it only turns a Response into the
 * three things the frames print: a swatch run, a count, or the API's own
 * error text verbatim.
 */

export const API_BASE = 'https://data.xivdyetools.app';

export interface Swatch {
  hex: string;
  name: string;
}

const HEX_RE = /^#?[0-9a-f]{6}$/i;

/**
 * Every `hex` in a response, depth-first, deduplicated on (hex, name), capped
 * at `max`. A dye object is `{ hex, name }`; a match result nests it under
 * `dye`; a list is an array of either — the walk does not care which.
 */
export function collectHexes(value: unknown, max = 12): Swatch[] {
  const out: Swatch[] = [];
  const walk = (node: unknown, depth: number): void => {
    if (!node || typeof node !== 'object' || out.length >= max || depth > 6) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (typeof obj.hex === 'string' && HEX_RE.test(obj.hex)) {
      const hex = obj.hex.startsWith('#') ? obj.hex : `#${obj.hex}`;
      const name = String(obj.name ?? obj.localizedName ?? '');
      if (!out.some((s) => s.hex.toLowerCase() === hex.toLowerCase() && s.name === name)) {
        out.push({ hex, name });
      }
    }
    for (const key of Object.keys(obj)) {
      if (key !== 'hex') walk(obj[key], depth + 1);
    }
  };
  walk(value, 0);
  return out;
}

/** Item count for a response with no colours: the first array in `data`, or its key count. */
export function countOf(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === 'object') {
    for (const v of Object.values(data as Record<string, unknown>)) {
      if (Array.isArray(v)) return v.length;
    }
    return Object.keys(data as object).length;
  }
  return 0;
}

export interface JsonLine {
  pad: string;
  key: string;
  sep: string;
  rest: string;
}

/** Pretty JSON split into (indent, "key", ": ", rest) so keys and values can take two colours. */
export function toJsonLines(value: unknown): JsonLine[] {
  return JSON.stringify(value, null, 2)
    .split('\n')
    .map((line) => {
      const m = line.match(/^(\s*)("[^"]*")(:\s*)(.*)$/);
      return m ? { pad: m[1], key: m[2], sep: m[3], rest: m[4] } : { pad: '', key: '', sep: '', rest: line };
    });
}

/**
 * The API's own words for a failure. The `/v1` envelope is
 * `{ success: false, error: CODE, message }`; anything else falls back to the
 * raw body so a non-JSON answer is still printed rather than paraphrased.
 */
export function errorTextOf(json: unknown, text: string, statusText: string): string {
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message) return obj.message;
    if (typeof obj.error === 'string' && obj.error) return obj.error;
  }
  return text.slice(0, 160) || statusText || 'request failed';
}

export type StripState =
  | { state: 'loading' }
  | { state: 'none'; text: string }
  | { state: 'ok'; swatches: Swatch[]; label: string; meta: string }
  | { state: 'count'; count: number; meta: string }
  | { state: 'err'; text: string; meta: string };

export async function fetchStrip(query: string): Promise<StripState> {
  const t0 = performance.now();
  try {
    const res = await fetch(API_BASE + query);
    const ms = Math.round(performance.now() - t0);
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    const meta = `${res.status} · ${ms} ms`;
    if (!res.ok) return { state: 'err', text: errorTextOf(json, text, res.statusText), meta };
    const data = json && typeof json === 'object' && 'data' in (json as object) ? (json as { data: unknown }).data : json;
    const swatches = collectHexes(data);
    if (swatches.length) {
      const label = swatches.length === 1 ? swatches[0].name : `${swatches[0].name} +${swatches.length - 1}`;
      return { state: 'ok', swatches, label, meta };
    }
    return { state: 'count', count: countOf(data), meta };
  } catch (e) {
    return { state: 'err', text: e instanceof Error ? e.message : 'fetch failed', meta: '— · —' };
  }
}

export interface SentResponse {
  ok: boolean;
  status: number;
  statusText: string;
  ms: number;
  requestId: string | null;
  contentType: string;
  json: unknown | undefined;
  text: string;
  /** Object URL for an image body, so the card can show the PNG the proxy served. */
  imageUrl: string | null;
}

export async function send(url: string, init?: RequestInit): Promise<SentResponse> {
  const t0 = performance.now();
  const res = await fetch(url, init);
  const ms = Math.round(performance.now() - t0);
  const contentType = res.headers.get('content-type') ?? '';
  const requestId = res.headers.get('x-request-id');
  if (contentType.startsWith('image/')) {
    const blob = await res.blob();
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      ms,
      requestId,
      contentType,
      json: undefined,
      text: `${contentType} · ${blob.size} bytes`,
      imageUrl: URL.createObjectURL(blob),
    };
  }
  const text = await res.text();
  let json: unknown | undefined;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { ok: res.ok, status: res.status, statusText: res.statusText, ms, requestId, contentType, json, text, imageUrl: null };
}

export interface ParamSpec {
  name: string;
  in: 'path' | 'query';
  required?: boolean;
  default?: string;
  description?: string;
  options?: string[];
}

/** Substitute `:path` params and append the non-empty query params. */
export function buildUrl(endpoint: string, params: readonly ParamSpec[], values: Record<string, string>): string {
  let path = endpoint;
  const query: string[] = [];
  for (const p of params) {
    const val = values[p.name];
    if (!val) continue;
    if (p.in === 'path') path = path.replace(`:${p.name}`, encodeURIComponent(val));
    else query.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(val)}`);
  }
  return API_BASE + path + (query.length ? `?${query.join('&')}` : '');
}

/**
 * The body is copied exactly as the textarea holds it — never re-parsed — so
 * the command always reproduces what Send would post, malformed JSON included.
 */
export function curlFor(url: string, method: HttpMethodLike, body = ''): string {
  if (method === 'POST') {
    return `curl -X POST "${url}" -H "Content-Type: application/json" -d '${body.replace(/'/g, "'\\''")}'`;
  }
  return `curl "${url}"`;
}

type HttpMethodLike = 'GET' | 'POST';
