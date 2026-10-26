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

import { readBoundedText } from '../lib/bounded-body.js';
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
  'LevelEquip',
  // Which class the weapon or tool is; the GPOSERS list's Off Hand rule reads it.
  'ItemUICategory.row_id',
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
export function iconAssetUrl(base: string, iconId: number, version: string): string {
  const id6 = String(iconId).padStart(6, '0');
  const folder = `${id6.slice(0, 3)}000`;
  const path = `ui/icon/${folder}/${id6}_hr1.tex`;
  return `${base}/api/asset?${new URLSearchParams({ path, format: 'png', version }).toString()}`;
}

interface RawSearchRow {
  row_id: number;
  fields: Record<string, unknown>;
}

interface RawSearchResponse {
  version?: string;
  schema?: string;
  results?: RawSearchRow[];
  next?: string;
}

export interface XivapiAssetContext {
  readonly base: string;
  readonly version: string;
  readonly cacheable: boolean;
}

export function isCanonicalVersion(value: string): boolean {
  return CANONICAL_VERSION.test(value);
}

export interface XivapiContext {
  readonly base: string;
  readonly version: string;
  readonly schema: string | undefined;
  /** Null means bootstrap discovery failed: never read/write shared data. */
  readonly cacheNamespace: string | null;
}

export interface XivapiResponseIdentity {
  version: string | null;
  schema: string | null;
}

const CANONICAL_VERSION = /^[0-9a-f]{16}$/;
const CANONICAL_SCHEMA = /^exdschema@2:rev:[0-9a-f]{40}$/;
const CONTEXT_TTL_MS = 10 * 60_000;
const CONTEXT_FAILURE_TTL_MS = 60_000;
const CONTEXT_TIMEOUT_MS = 3_000;
const MAX_CONTEXT_BYTES = 32 * 1024;
const contextMemo = new Map<string, { expires: number; value: Promise<XivapiContext> }>();
const lastResolvedContext = new Map<string, XivapiContext>();

interface RawSheetRow {
  row_id: number;
  version?: string;
  schema?: string;
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

/** ItemUICategory row id; null when absent (0 is the sheet's blank row, not a category). */
function uiCategoryOf(value: unknown): number | null {
  const id = relationId(value);
  return id !== null && id > 0 ? id : null;
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
    levelEquip:
      typeof f['LevelEquip'] === 'number' && Number.isFinite(f['LevelEquip'])
        ? f['LevelEquip']
        : null,
    uiCategory: uiCategoryOf(f['ItemUICategory']),
    rules: rulesOf(f),
  };
}

export class XivapiClient {
  private readonly base: string;
  private readonly version: string;
  private readonly schema: string | undefined;

  constructor(env: XivapiEnv) {
    this.base = new URL(env.XIVAPI_BASE ?? DEFAULT_XIVAPI_BASE).toString().replace(/\/$/, '');
    this.version = env.XIVAPI_VERSION ?? DEFAULT_XIVAPI_VERSION;
    this.schema = env.XIVAPI_SCHEMA;
  }

  /** One complete snapshot for cache access AND every data call in a request. */
  resolveContext(): Promise<XivapiContext> {
    if (CANONICAL_VERSION.test(this.version) && this.schema && CANONICAL_SCHEMA.test(this.schema)) {
      return Promise.resolve(this.context(this.version, this.schema));
    }
    const memoKey = JSON.stringify([this.base, this.version, this.schema ?? null]);
    const now = Date.now();
    const hit = contextMemo.get(memoKey);
    if (hit && hit.expires > now) return hit.value;
    const entry = {
      expires: now + CONTEXT_TTL_MS,
      value: Promise.resolve<XivapiContext>(this.fallback()),
    };
    entry.value = this.discoverContext().then((found) => {
      if (found) {
        lastResolvedContext.set(memoKey, found);
        return found;
      }
      entry.expires = Date.now() + CONTEXT_FAILURE_TTL_MS;
      return lastResolvedContext.get(memoKey) ?? this.fallback();
    });
    contextMemo.set(memoKey, entry);
    return entry.value;
  }

  async resolveAssetContext(versionOverride?: string): Promise<XivapiAssetContext> {
    const version = versionOverride ?? this.version;
    if (isCanonicalVersion(version)) return { base: this.base, version, cacheable: true };
    const context = await this.resolveContext();
    return {
      base: context.base,
      version: context.version,
      cacheable: context.cacheNamespace !== null,
    };
  }

  private fallback(): XivapiContext {
    return { base: this.base, version: this.version, schema: this.schema, cacheNamespace: null };
  }

  private context(version: string, schema: string): XivapiContext {
    return {
      base: this.base,
      version,
      schema,
      cacheNamespace: JSON.stringify([this.base, version, schema]),
    };
  }

  private async discoverContext(): Promise<XivapiContext | null> {
    try {
      const params = this.params({ fields: 'Name' }, this.fallback());
      const response = await this.get(
        this.base + '/api/sheet/Item/1?' + params.toString(),
        CONTEXT_TIMEOUT_MS,
      );
      if (!response.ok) return null;
      const body = JSON.parse(
        await readBoundedText(response.body, MAX_CONTEXT_BYTES),
      ) as RawSheetRow;
      if (
        body.row_id !== 1 ||
        typeof body.version !== 'string' ||
        typeof body.schema !== 'string' ||
        !CANONICAL_VERSION.test(body.version) ||
        !CANONICAL_SCHEMA.test(body.schema)
      )
        return null;
      if (CANONICAL_VERSION.test(this.version) && body.version !== this.version) return null;
      if (this.schema && CANONICAL_SCHEMA.test(this.schema) && body.schema !== this.schema)
        return null;
      return this.context(body.version, body.schema);
    } catch {
      return null;
    }
  }

  private params(extra: Record<string, string>, context: XivapiContext): URLSearchParams {
    const params = new URLSearchParams({ ...extra, version: context.version });
    if (context.schema) params.set('schema', context.schema);
    return params;
  }

  private identity(
    context: XivapiContext,
    body: { version?: string; schema?: string },
  ): XivapiResponseIdentity {
    const version = typeof body.version === 'string' ? body.version : null;
    const schema = typeof body.schema === 'string' ? body.schema : null;
    if (
      context.cacheNamespace !== null &&
      (version !== context.version || schema !== context.schema)
    ) {
      throw new UpstreamUnavailableError(
        0,
        'response identity does not match the captured context',
      );
    }
    return { version, schema };
  }

  private async get(
    url: string,
    timeoutMs: number = UPSTREAM_TIMEOUT_MS,
    headers: Record<string, string> = {},
    allowNotModified = false,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...headers },
        signal: AbortSignal.timeout(timeoutMs),
        // FINDING-025 / API-9: never follow a redirect to a third host and
        // then cache (or proxy) whatever it serves — XIVAPI answers directly.
        // `manual`, NOT `error`: workerd implements only follow/manual and
        // throws a TypeError on `error` (every XIVAPI call failed that way in
        // production until 2026-08-29); a 3xx is refused just below instead.
        redirect: 'manual',
      });
    } catch (error) {
      throw new UpstreamUnavailableError(
        0,
        error instanceof Error ? error.message : 'fetch failed',
      );
    }
    if (response.status === 304 && allowNotModified) return response;
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
    context: XivapiContext,
  ): Promise<XivapiResponseIdentity & { rows: ItemRow[]; truncated: boolean }> {
    if (lookups.length === 0) return { version: null, schema: null, rows: [], truncated: false };
    const url = `${context.base}/api/search?${this.params(
      {
        sheets: 'Item',
        query: buildResolveQuery(lookups),
        fields: ITEM_FIELDS,
        limit: String(SEARCH_LIMIT),
      },
      context,
    ).toString()}`;
    const response = await this.get(url);
    if (!response.ok) {
      throw new UpstreamUnavailableError(response.status, response.statusText || 'search failed');
    }
    const body = await response.json<RawSearchResponse>();
    const identity = this.identity(context, body);
    if (!Array.isArray(body.results))
      throw new UpstreamUnavailableError(0, 'missing search results');
    const results = body.results;
    const truncated =
      (typeof body.next === 'string' && body.next.length > 0) || results.length >= SEARCH_LIMIT;
    return { ...identity, rows: results.map(parseItemRow), truncated };
  }

  /** Facewear: `GlassesId` IS the Glasses sheet row_id. 404 → null (row 0 / unknown). */
  async getGlasses(
    id: number,
    context: XivapiContext,
  ): Promise<XivapiResponseIdentity & { row: GlassesRow | null }> {
    const url = `${context.base}/api/sheet/Glasses/${id}?${this.params({ fields: GLASSES_FIELDS }, context).toString()}`;
    const response = await this.get(url);
    if (response.status === 404) return { version: null, schema: null, row: null };
    if (!response.ok) {
      throw new UpstreamUnavailableError(response.status, response.statusText || 'sheet failed');
    }
    const body = await response.json<RawSheetRow>();
    if (body.row_id !== id) throw new UpstreamUnavailableError(0, 'incorrect Glasses row');
    return {
      ...this.identity(context, body),
      row: { rowId: body.row_id, names: namesOf(body.fields), iconId: iconIdOf(body.fields) },
    };
  }

  /** Raw icon PNG — the `/v1/chara/icon/:id` proxy's upstream. */
  async fetchIcon(
    iconId: number,
    context: XivapiAssetContext,
    ifNoneMatch?: string,
  ): Promise<Response> {
    return this.get(
      iconAssetUrl(context.base, iconId, context.version),
      UPSTREAM_TIMEOUT_MS,
      { Accept: 'image/png', ...(ifNoneMatch ? { 'If-None-Match': ifNoneMatch } : {}) },
      Boolean(ifNoneMatch),
    );
  }
}
