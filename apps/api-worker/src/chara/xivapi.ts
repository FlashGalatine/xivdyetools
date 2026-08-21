/**
 * XIVAPI v2 client for equipment-model resolution — the only place in the
 * worker that talks to v2.xivapi.com.
 *
 * Verified query grammar (docs/research/chara-equipment-resolution §4):
 *   GET /api/search?sheets=Item
 *       &query=+((+EquipSlotCategory.Head=1 +ModelMain=328041) (…))
 *       &fields=Name,Name@ja,Name@de,Name@fr,Icon.id,ModelMain,ModelSub,EquipSlotCategory.<col>…
 * - `+clause` = required, nested required groups batch every slot of a file
 *   into ONE request; 64-bit `ModelMain` equality works.
 * - `ModelMain` is the raw packed integer (no struct decoding by the schema).
 * - A real User-Agent is mandatory (the default Python UA gets a 403).
 * - `limit` is silently capped at 500; one file's families fit comfortably.
 * - Search is a separate ingestion: after a patch `/api/search` returns 503
 *   `unavailable` until the new version is indexed. That surfaces here as
 *   UpstreamUnavailableError → the route answers 503 and the client falls back
 *   to slot-only rows (never an error banner).
 * - German names carry U+00AD soft hyphens — stripped at ingest.
 */

import type { GlassesRow, ItemRow, SlotLookup } from './types.js';

export interface XivapiEnv {
  XIVAPI_BASE?: string;
  XIVAPI_VERSION?: string;
  XIVAPI_SCHEMA?: string;
}

export const DEFAULT_XIVAPI_BASE = 'https://v2.xivapi.com';
export const DEFAULT_XIVAPI_VERSION = 'latest';
const USER_AGENT = 'XIVDyeTools/1.0 (+https://xivdyetools.app; chara-resolve)';
const UPSTREAM_TIMEOUT_MS = 10_000;
/** XIVAPI's hard cap; one file's families are far below it. */
const SEARCH_LIMIT = 500;
/** Every EquipSlotCategory column the resolver can be asked for. */
const SLOT_COLUMNS = [
  'MainHand',
  'OffHand',
  'Head',
  'Body',
  'Gloves',
  'Legs',
  'Feet',
  'Ears',
  'Neck',
  'Wrists',
  'FingerL',
  'FingerR',
] as const;

const ITEM_FIELDS = [
  'Name',
  'Name@ja',
  'Name@de',
  'Name@fr',
  'Icon.id',
  'ModelMain',
  'ModelSub',
  ...SLOT_COLUMNS.map((col) => `EquipSlotCategory.${col}`),
].join(',');

const GLASSES_FIELDS = 'Name,Name@ja,Name@de,Name@fr,Icon.id';

/** Upstream answered, but said "not now" (503 while ingesting, 5xx, timeout). */
export class UpstreamUnavailableError extends Error {
  constructor(
    public readonly status: number,
    detail: string,
  ) {
    super(`XIVAPI unavailable: ${status} ${detail}`);
    this.name = 'UpstreamUnavailableError';
  }
}

/** Strip U+00AD soft hyphens (German names) and trim. */
export function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.replace(/­/g, '').trim() : '';
}

/**
 * Build the nested-group query for a set of (slot column, packed key)
 * lookups. Duplicate lookups collapse; order is preserved for readability.
 */
export function buildResolveQuery(lookups: readonly SlotLookup[]): string {
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const l of lookups) {
    const id = `${l.field}:${l.key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    groups.push(`(+EquipSlotCategory.${l.field}=1 +ModelMain=${l.key})`);
  }
  return `+(${groups.join(' ')})`;
}

/** `ui/icon/041000/041716_hr1.tex` → the PNG asset URL for an icon id. */
export function iconAssetUrl(base: string, iconId: number): string {
  const id6 = String(iconId).padStart(6, '0');
  const folder = `${id6.slice(0, 3)}000`;
  const path = `ui/icon/${folder}/${id6}_hr1.tex`;
  return `${base}/api/asset?${new URLSearchParams({ path, format: 'png' })}`;
}

interface RawSearchRow {
  row_id: number;
  fields: Record<string, unknown>;
}

interface RawSearchResponse {
  version?: string;
  results?: RawSearchRow[];
  next?: string;
}

interface RawSheetRow {
  row_id: number;
  version?: string;
  fields: Record<string, unknown>;
}

function iconIdOf(fields: Record<string, unknown>): number | null {
  const icon = fields['Icon'];
  if (typeof icon === 'object' && icon !== null) {
    const id = (icon as Record<string, unknown>)['id'];
    if (typeof id === 'number' && Number.isFinite(id) && id > 0) return id;
  }
  return null;
}

function namesOf(fields: Record<string, unknown>): ItemRow['names'] {
  return {
    en: cleanName(fields['Name']),
    ja: cleanName(fields['Name@ja']),
    de: cleanName(fields['Name@de']),
    fr: cleanName(fields['Name@fr']),
  };
}

/** Trim a raw search row to the cache shape. Exported for the resolver tests. */
export function parseItemRow(raw: RawSearchRow): ItemRow {
  const f = raw.fields;
  const esc = f['EquipSlotCategory'];
  const escFields =
    typeof esc === 'object' && esc !== null
      ? ((esc as Record<string, unknown>)['fields'] as Record<string, unknown> | undefined)
      : undefined;
  const slots = SLOT_COLUMNS.filter((col) => escFields?.[col] === 1);
  // ModelMain tops out at 65535 << 32 ≈ 2.8e14 — exact in a JS number, so
  // String() round-trips the packed value losslessly.
  return {
    rowId: raw.row_id,
    names: namesOf(f),
    iconId: iconIdOf(f),
    modelMain: String(f['ModelMain'] ?? 0),
    modelSub: String(f['ModelSub'] ?? 0),
    slots: [...slots],
  };
}

export class XivapiClient {
  private readonly base: string;
  private readonly version: string;
  private readonly schema: string | undefined;

  constructor(env: XivapiEnv) {
    this.base = (env.XIVAPI_BASE ?? DEFAULT_XIVAPI_BASE).replace(/\/$/, '');
    this.version = env.XIVAPI_VERSION ?? DEFAULT_XIVAPI_VERSION;
    this.schema = env.XIVAPI_SCHEMA;
  }

  /** The version key cache entries are namespaced under. */
  get versionKey(): string {
    return this.version;
  }

  private params(extra: Record<string, string>): URLSearchParams {
    const p = new URLSearchParams({ ...extra, version: this.version });
    if (this.schema) p.set('schema', this.schema);
    return p;
  }

  private async get(url: string): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (error) {
      throw new UpstreamUnavailableError(0, error instanceof Error ? error.message : 'fetch failed');
    }
    if (response.status === 503 || response.status >= 500 || response.status === 429) {
      throw new UpstreamUnavailableError(response.status, response.statusText || 'unavailable');
    }
    return response;
  }

  /**
   * One request for every lookup. Returns the rows as XIVAPI grouped them —
   * the caller re-associates by (slot column × ModelMain).
   */
  async searchItems(
    lookups: readonly SlotLookup[],
  ): Promise<{ version: string | null; rows: ItemRow[] }> {
    if (lookups.length === 0) return { version: null, rows: [] };
    const url = `${this.base}/api/search?${this.params({
      sheets: 'Item',
      query: buildResolveQuery(lookups),
      fields: ITEM_FIELDS,
      limit: String(SEARCH_LIMIT),
    })}`;
    const response = await this.get(url);
    if (!response.ok) {
      throw new UpstreamUnavailableError(response.status, response.statusText || 'search failed');
    }
    const body = (await response.json()) as RawSearchResponse;
    const rows = (body.results ?? []).map(parseItemRow);
    return { version: body.version ?? null, rows };
  }

  /** Facewear: `GlassesId` IS the Glasses sheet row_id. 404 → null (row 0 / unknown). */
  async getGlasses(id: number): Promise<{ version: string | null; row: GlassesRow | null }> {
    const url = `${this.base}/api/sheet/Glasses/${id}?${this.params({ fields: GLASSES_FIELDS })}`;
    const response = await this.get(url);
    if (response.status === 404) return { version: null, row: null };
    if (!response.ok) {
      throw new UpstreamUnavailableError(response.status, response.statusText || 'sheet failed');
    }
    const body = (await response.json()) as RawSheetRow;
    return {
      version: body.version ?? null,
      row: { rowId: body.row_id, names: namesOf(body.fields), iconId: iconIdOf(body.fields) },
    };
  }

  /** Raw icon PNG — the `/v1/chara/icon/:id` proxy's upstream. */
  async fetchIcon(iconId: number): Promise<Response> {
    return this.get(iconAssetUrl(this.base, iconId));
  }
}
