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

import { CHARA_WEAR_RACE_COLUMNS, charaWearMask } from '@xivdyetools/core';
import type { CharaItemRules, GlassesRow, ItemRow, SlotLookup } from './types.js';

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

/**
 * The in-game check's fields: dye channels, the glamour flag, the race/gender
 * lock (`EquipRaceCategory`, read column by column like the slot booleans, so a
 * schema rename drops a field instead of the request) and the Grand Company
 * lock. No classes or jobs: since patch 7.4 any job can wear any piece for
 * glamour.
 */
const RULE_FIELDS = [
  'DyeCount',
  'IsGlamorous',
  ...[...CHARA_WEAR_RACE_COLUMNS, 'Male', 'Female'].map((col) => `EquipRestriction.${col}`),
  'GrandCompany.row_id',
];

const ITEM_FIELDS = [
  'Name',
  'Name@ja',
  'Name@de',
  'Name@fr',
  'Icon.id',
  'ModelMain',
  'ModelSub',
  ...SLOT_COLUMNS.map((col) => `EquipSlotCategory.${col}`),
  ...RULE_FIELDS,
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
  return `${base}/api/asset?${new URLSearchParams({ path, format: 'png' }).toString()}`;
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

/** `GET /api/version`: `{ versions: [{ key, names: ['7.55x2', 'latest'] }, …] }`. */
interface RawVersionList {
  versions?: Array<{ key?: string; names?: string[] }>;
}

/**
 * How long a resolved `latest` key is trusted (BUG-040). XIVAPI re-points
 * `latest` from an hourly Thaliak poll, so ten minutes of lag adds nothing
 * noticeable to a patch-day cold start and keeps the lookup to roughly one
 * extra tiny request per isolate per ten minutes.
 */
const VERSION_KEY_TTL_MS = 10 * 60_000;
/** After a failed lookup (literal-alias fallback) retry sooner. */
const VERSION_KEY_FAILURE_TTL_MS = 60_000;
/** Short: this sits in front of every cold-cache /resolve. */
const VERSION_LOOKUP_TIMEOUT_MS = 3_000;
/** Per isolate, keyed by `${base}|${alias}`. */
const versionKeyMemo = new Map<string, { expires: number; key: Promise<string> }>();
/**
 * The last key a lookup actually resolved, per the same memo key. A failed
 * refresh keeps answering with it (stale-if-error), so rows cached under it
 * stay reachable through an XIVAPI blip instead of every import going cold.
 */
const lastResolvedKey = new Map<string, string>();

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

/** A relation's own columns: `{ value, sheet, row_id, fields: {…} }` → `fields`. */
function relationFields(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const fields = (value as Record<string, unknown>)['fields'];
  return typeof fields === 'object' && fields !== null
    ? (fields as Record<string, unknown>)
    : undefined;
}

/** A relation's row: `{ value, sheet, row_id, … }` → `row_id` (or `value`); null when absent. */
function relationId(value: unknown): number | null {
  if (typeof value !== 'object' || value === null) return null;
  const link = value as Record<string, unknown>;
  const id = link['row_id'] ?? link['value'];
  return typeof id === 'number' ? id : null;
}

/**
 * The in-game rules, or null when any field is missing: a partial answer
 * must not read as "takes no dye" or "any company can wear it".
 */
function rulesOf(f: Record<string, unknown>): CharaItemRules | null {
  const dyeCount = f['DyeCount'];
  const glamorous = f['IsGlamorous'];
  const restriction = relationFields(f['EquipRestriction']);
  const company = relationId(f['GrandCompany']);
  if (typeof dyeCount !== 'number' || !restriction || company === null) return null;
  if (typeof glamorous !== 'boolean' && glamorous !== 0 && glamorous !== 1) return null;
  return {
    dyeCount,
    glamourable: glamorous === true || glamorous === 1,
    wearMask: charaWearMask(restriction),
    grandCompany: company,
  };
}

/** Trim a raw search row to the cache shape. Exported for the resolver tests. */
export function parseItemRow(raw: RawSearchRow): ItemRow {
  const f = raw.fields;
  const escFields = relationFields(f['EquipSlotCategory']);
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
    rules: rulesOf(f),
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

  /**
   * The key cache entries are namespaced under (BUG-040).
   *
   * A real key (`XIVAPI_VERSION = "284bb7f44b9c0976"`) is its own namespace.
   * The moving alias `latest` is not: it re-points on patch day, so using the
   * literal string kept the namespace constant across patches and a cached
   * pre-patch row family outlived the patch by up to TTL + SWR (8 days). It is
   * therefore resolved to the key it currently points at through
   * `GET /api/version`, memoized per isolate for VERSION_KEY_TTL_MS — the
   * cache is read before any search, so the answer's own `version` field
   * arrives too late to key the read.
   *
   * Never throws. If the lookup fails, or `latest` is not listed, the last key
   * this isolate resolved is kept (stale-if-error); only an isolate that has
   * never resolved one falls back to the literal alias (the pre-fix
   * behavior). The lookup is retried after VERSION_KEY_FAILURE_TTL_MS, so an
   * XIVAPI hiccup cannot take /resolve down.
   *
   * Searches and Glasses fetches send this same key as their `version`, so the
   * namespace a row is stored under and the game version it was read from
   * always agree, even in the window before the memo notices a re-point.
   */
  cacheNamespace(): Promise<string> {
    if (this.version !== DEFAULT_XIVAPI_VERSION) return Promise.resolve(this.version);
    const memoKey = `${this.base}|${this.version}`;
    const now = Date.now();
    const hit = versionKeyMemo.get(memoKey);
    if (hit && hit.expires > now) return hit.key;
    const entry = { expires: now + VERSION_KEY_TTL_MS, key: Promise.resolve('') };
    entry.key = this.lookupVersionKey().then((found) => {
      if (found !== null) {
        lastResolvedKey.set(memoKey, found);
        return found;
      }
      // A fallback answer is trusted for a minute only, so recovery is quick.
      entry.expires = Date.now() + VERSION_KEY_FAILURE_TTL_MS;
      return lastResolvedKey.get(memoKey) ?? this.version;
    });
    versionKeyMemo.set(memoKey, entry);
    return entry.key;
  }

  /** The key `latest` points at, or null when it cannot be determined. */
  private async lookupVersionKey(): Promise<string | null> {
    try {
      const response = await this.get(`${this.base}/api/version`, VERSION_LOOKUP_TIMEOUT_MS);
      if (!response.ok) return null;
      const body = await response.json<RawVersionList>();
      const match = body.versions?.find((v) => v.names?.includes(this.version));
      return typeof match?.key === 'string' && match.key.length > 0 ? match.key : null;
    } catch {
      return null;
    }
  }

  private async params(extra: Record<string, string>): Promise<URLSearchParams> {
    const p = new URLSearchParams({ ...extra, version: await this.cacheNamespace() });
    if (this.schema) p.set('schema', this.schema);
    return p;
  }

  private async get(url: string, timeoutMs: number = UPSTREAM_TIMEOUT_MS): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
        // FINDING-025 / API-9: never follow a redirect to a third host and
        // then cache (or proxy) whatever it serves — XIVAPI answers directly.
        // `manual`, NOT `error`: workerd implements only follow/manual and
        // throws a TypeError on `error` (every XIVAPI call failed that way in
        // production until 2026-08-29); a 3xx is refused just below instead.
        redirect: 'manual',
      });
    } catch (error) {
      throw new UpstreamUnavailableError(0, error instanceof Error ? error.message : 'fetch failed');
    }
    if (response.status >= 300 && response.status < 400) {
      throw new UpstreamUnavailableError(response.status, 'redirect refused');
    }
    if (response.status === 503 || response.status >= 500 || response.status === 429) {
      throw new UpstreamUnavailableError(response.status, response.statusText || 'unavailable');
    }
    return response;
  }

  /**
   * One request for every lookup. Returns the rows as XIVAPI grouped them —
   * the caller re-associates by (slot column × ModelMain).
   *
   * `truncated` (FINDING-025 / API-3): the single page could not have held
   * every family — XIVAPI handed back a `next` cursor, or filled the page to
   * the 500-row cap. The tail groups may then be incomplete or absent, so
   * the caller must not cache this answer's misses as "no item row".
   */
  async searchItems(
    lookups: readonly SlotLookup[],
  ): Promise<{ version: string | null; rows: ItemRow[]; truncated: boolean }> {
    if (lookups.length === 0) return { version: null, rows: [], truncated: false };
    const url = `${this.base}/api/search?${(await this.params({
      sheets: 'Item',
      query: buildResolveQuery(lookups),
      fields: ITEM_FIELDS,
      limit: String(SEARCH_LIMIT),
    })).toString()}`;
    const response = await this.get(url);
    if (!response.ok) {
      throw new UpstreamUnavailableError(response.status, response.statusText || 'search failed');
    }
    const body = await response.json<RawSearchResponse>();
    const results = body.results ?? [];
    const truncated = (typeof body.next === 'string' && body.next.length > 0) || results.length >= SEARCH_LIMIT;
    return { version: body.version ?? null, rows: results.map(parseItemRow), truncated };
  }

  /** Facewear: `GlassesId` IS the Glasses sheet row_id. 404 → null (row 0 / unknown). */
  async getGlasses(id: number): Promise<{ version: string | null; row: GlassesRow | null }> {
    const url = `${this.base}/api/sheet/Glasses/${id}?${(await this.params({ fields: GLASSES_FIELDS })).toString()}`;
    const response = await this.get(url);
    if (response.status === 404) return { version: null, row: null };
    if (!response.ok) {
      throw new UpstreamUnavailableError(response.status, response.statusText || 'sheet failed');
    }
    const body = await response.json<RawSheetRow>();
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
