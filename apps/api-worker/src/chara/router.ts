/**
 * `/v1/chara/*` — equipment-model resolution for the web app's `.chara` import.
 *
 *   POST /v1/chara/resolve      { gear: [{ slot, set?, base, variant }], glasses? }
 *                               → { version, items: { <slot>: item | null }, glasses? }
 *   GET  /v1/chara/icon/:iconId → the item's icon PNG (proxied + edge-cached)
 *
 * One upstream search per request at most: every (slot, key) the edge cache
 * already holds is replayed, the misses go to XIVAPI in a single nested-group
 * query, and the answers are stored per key for ~7 days. A `.chara` file's
 * dyes never wait on this — the client renders stains from the file first and
 * the names land on the round-trip; an upstream outage costs labels, not data.
 *
 * Mounted under `/v1` so the KV rate limiter applies (one import = one POST
 * plus up to twelve icon GETs, all edge-cached after the first viewer).
 */

import { Hono } from 'hono';
import { getLogger } from '@xivdyetools/worker-kit';
import { CHARA_SLOT_SEARCH_FIELD, isCharaWeaponSlot, isWornCharaModel } from '@xivdyetools/core';
import type { Env, Variables } from '../types.js';
import { ApiError, ErrorCode } from '../lib/api-error.js';
import { BodyTooLargeError, readBoundedText } from '../lib/bounded-body.js';
import { successResponse } from '../lib/response.js';
import { parseIntParam } from '../lib/validation.js';
import { CharaIconCache } from './icon-cache.js';
import { loadIcon } from './icons.js';
import { CharaLookupLoader } from './lookup-loader.js';
import { CharaRowCache } from './cache.js';
import { lookupsFor, resolveCharaEquipment } from './resolver.js';
import { loadAcquisition } from './acquisition.js';
import { loadRegionalNames } from './regional-names.js';
import { UpstreamUnavailableError, XivapiClient, isCanonicalVersion } from './xivapi.js';
import type {
  CharaGearModel,
  CharaGearSlotId,
  CharaResolveRequest,
  GlassesRow,
  ItemRow,
} from './types.js';
import { lookupKey } from './types.js';

const charaRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

const GEAR_SLOTS = Object.keys(CHARA_SLOT_SEARCH_FIELD) as CharaGearSlotId[];
/** Model lanes are uint16 in the game's own struct. */
const LANE_MAX = 0xffff;
/** A twelve-slot body is well under 1 KB; anything bigger is not a `.chara` request. */
const MAX_BODY_BYTES = 8 * 1024;
/**
 * FINDING-025 / API-4: the canonical decimal form only. `parseInt` accepts
 * `041716`, `41716abc`, `41716 ` as 41716 — each a distinct edge-cache key and
 * a fresh upstream fetch for the same icon.
 */
const CANONICAL_ICON_ID = /^[1-9]\d{0,5}$/;
// ============================================================================
// Validation
// ============================================================================

function lane(value: unknown, path: string, required: boolean): number {
  if (value === undefined || value === null) {
    if (required) throw new ApiError(ErrorCode.VALIDATION_ERROR, `${path} is required`, 400);
    return 0;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > LANE_MAX) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      `${path} must be an integer between 0 and ${LANE_MAX}`,
      400,
    );
  }
  return value;
}

/** Validate the JSON body into a CharaResolveRequest — loud about which field is wrong. */
export function parseResolveBody(body: unknown): CharaResolveRequest {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(
      ErrorCode.INVALID_BODY,
      'Body must be a JSON object with a `gear` array',
      400,
    );
  }
  const record = body as Record<string, unknown>;
  const gearRaw = record['gear'];
  if (!Array.isArray(gearRaw)) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, '`gear` must be an array of worn pieces', 400);
  }
  if (gearRaw.length > GEAR_SLOTS.length) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      `\`gear\` carries ${gearRaw.length} entries; a character has ${GEAR_SLOTS.length} slots`,
      400,
    );
  }

  const seen = new Set<string>();
  const gear: CharaGearModel[] = gearRaw.map((entry, i) => {
    const path = `gear[${i}]`;
    if (typeof entry !== 'object' || entry === null) {
      throw new ApiError(ErrorCode.VALIDATION_ERROR, `${path} must be an object`, 400);
    }
    const g = entry as Record<string, unknown>;
    const slot = g['slot'];
    if (typeof slot !== 'string' || !GEAR_SLOTS.includes(slot as CharaGearSlotId)) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        `${path}.slot must be one of: ${GEAR_SLOTS.join(', ')}`,
        400,
      );
    }
    if (seen.has(slot)) {
      throw new ApiError(ErrorCode.VALIDATION_ERROR, `${path}.slot "${slot}" appears twice`, 400);
    }
    seen.add(slot);
    const typedSlot = slot as CharaGearSlotId;
    const weapon = isCharaWeaponSlot(typedSlot);
    const set = weapon ? lane(g['set'], `${path}.set`, false) : 0;
    const base = lane(g['base'], `${path}.base`, true);
    const variant = lane(g['variant'], `${path}.variant`, false);
    if (!isWornCharaModel(typedSlot, set, base)) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        `${path} describes an empty slot (base 0) — send worn pieces only`,
        400,
      );
    }
    return weapon ? { slot: typedSlot, set, base, variant } : { slot: typedSlot, base, variant };
  });

  const glassesRaw = record['glasses'];
  const request: CharaResolveRequest = { gear };
  if (glassesRaw !== undefined && glassesRaw !== null && glassesRaw !== 0) {
    if (
      typeof glassesRaw !== 'number' ||
      !Number.isInteger(glassesRaw) ||
      glassesRaw < 1 ||
      glassesRaw > LANE_MAX
    ) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        `\`glasses\` must be a Glasses sheet row id (1–${LANE_MAX})`,
        400,
      );
    }
    request.glasses = glassesRaw;
  }
  return request;
}

async function readJsonBody(raw: Request): Promise<unknown> {
  // Cheap fast-fail when the client declares its size …
  const length = Number(raw.headers.get('Content-Length') ?? '0');
  if (length > MAX_BODY_BYTES) {
    throw new ApiError(ErrorCode.INVALID_BODY, `Body exceeds ${MAX_BODY_BYTES} bytes`, 413);
  }
  // … and the authoritative guard: FINDING-025 / API-2 — a chunked or HTTP/2
  // body carries no Content-Length, so the cap is enforced on the stream and
  // the reader cancelled the moment it passes 8 KB (bytes, not UTF-16 units).
  let text: string;
  try {
    text = await readBoundedText(raw.body, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      throw new ApiError(ErrorCode.INVALID_BODY, `Body exceeds ${MAX_BODY_BYTES} bytes`, 413);
    }
    throw error;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(ErrorCode.INVALID_BODY, 'Body is not valid JSON', 400);
  }
}

function upstreamDown(error: unknown): never {
  if (error instanceof UpstreamUnavailableError) {
    throw new ApiError(
      ErrorCode.UPSTREAM_UNAVAILABLE,
      'XIVAPI is not answering right now (search re-indexes after a game patch) — item names are temporarily unavailable; dyes are unaffected.',
      503,
      { upstreamStatus: error.status },
    );
  }
  throw error;
}

// ============================================================================
// POST /resolve
// ============================================================================

charaRouter.post('/resolve', async (c) => {
  const request = parseResolveBody(await readJsonBody(c.req.raw));
  const client = new XivapiClient(c.env);
  // OPT-002: the ko/zh and acquisition tables load on first use. Start that
  // now so it overlaps the cache read and the upstream search instead of
  // following them; it is awaited just before the resolver needs it. The
  // no-op catch only stops an unhandled-rejection report when the request
  // fails earlier — the awaited promise below still rejects.
  const tablesReady = Promise.all([loadRegionalNames(), loadAcquisition()]);
  tablesReady.catch(() => undefined);
  // Same cast as the Universalis router — Hono's ctx type lags workers-types.
  // OPT-004 dropped the origin argument: `CacheService` builds its synthetic
  // keys from a fixed host now, so which of the worker's domains a request
  // arrived on no longer partitions the cache. `CACHE_NAME` was always the
  // real namespace.
  // Capture the full snapshot once; no shared cache exists for an unresolved alias.
  const contextPending = client.resolveContext();
  c.executionCtx.waitUntil(contextPending.catch(() => undefined));
  const context = await contextPending;
  const cache =
    context.cacheNamespace === null
      ? null
      : new CharaRowCache(c.executionCtx as ExecutionContext, context.cacheNamespace);

  const lookups = lookupsFor(request.gear);
  const rows = cache ? await cache.getRows(lookups) : new Map<string, ItemRow[]>();
  const misses = lookups.filter((l) => !rows.has(lookupKey(l)));

  const loader = new CharaLookupLoader(client, context, cache, c.executionCtx as ExecutionContext);
  let version: string | null = null;
  let upstreamCalls = 0;
  try {
    const [search, glassesCached] = await Promise.all([
      misses.length > 0 ? loader.loadRows(misses) : Promise.resolve(null),
      request.glasses && cache ? cache.getGlasses(request.glasses) : Promise.resolve(undefined),
    ]);

    if (search) {
      upstreamCalls++;
      version = search.version;
      const index = search.rows;
      // FINDING-025 / API-3: a truncated page (next cursor / 500-row cap) may
      // be missing tail groups — answer this request from what came back, but
      // never store those keys as "no item row" for a week.
      if (search.truncated) {
        getLogger(c)?.warn("XIVAPI search page truncated — not caching this request's misses", {
          operation: 'chara.resolve',
          lookups: misses.length,
          families: search.rows.size,
        });
      }
      for (const lookup of misses) {
        const found: ItemRow[] = index.get(lookupKey(lookup)) ?? [];
        rows.set(lookupKey(lookup), found);
      }
    }

    let glassesRow: GlassesRow | null | undefined = undefined;
    if (request.glasses) {
      if (glassesCached !== undefined) {
        glassesRow = glassesCached;
      } else {
        upstreamCalls++;
        const fetched = await loader.loadGlasses(request.glasses);
        glassesRow = fetched.row;
        version ??= fetched.version;
        if (
          search &&
          ((search.version !== null &&
            fetched.version !== null &&
            search.version !== fetched.version) ||
            (search.schema !== null && fetched.schema !== null && search.schema !== fetched.schema))
        ) {
          throw new UpstreamUnavailableError(0, 'mixed fallback snapshots');
        }
      }
    }

    await tablesReady;
    const data = resolveCharaEquipment(
      request,
      (lookup) => rows.get(lookupKey(lookup)) ?? [],
      glassesRow,
      version,
    );
    // A POST answer is per-request; the per-key cache behind it is what makes
    // the next viewer cheap. Never let a shared cache hold the envelope.
    c.header('Cache-Control', 'no-store');
    c.header('X-Cache', upstreamCalls === 0 ? 'HIT' : 'MISS');
    return successResponse(c, data);
  } catch (error) {
    return upstreamDown(error);
  }
});

// ============================================================================
// GET /icon/:iconId
// ============================================================================

charaRouter.get('/icon/:iconId', async (c) => {
  const rawId = c.req.param('iconId');
  if (!CANONICAL_ICON_ID.test(rawId)) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Parameter "iconId" must be a positive integer (canonical decimal, 1–999999).',
      400,
      {
        parameter: 'iconId',
        received: rawId,
        expected: 'integer 1–999999 without leading zeros, signs or trailing characters',
      },
    );
  }
  const iconId = parseIntParam(rawId, 'iconId', { min: 1, max: 999_999 });
  const versions = new URL(c.req.url).searchParams.getAll('version');
  const version = versions[0];
  if (versions.length > 1 || (version !== undefined && !isCanonicalVersion(version))) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'version must be one canonical 16-character lower-case hexadecimal game key',
      400,
    );
  }
  const client = new XivapiClient(c.env);
  const contextPending = client.resolveAssetContext(version);
  c.executionCtx.waitUntil(contextPending.catch(() => undefined));
  const context = await contextPending;
  const cache = new CharaIconCache();
  try {
    const payload = await loadIcon(client, context, iconId, cache);
    if (payload.cacheUpdate) {
      c.executionCtx.waitUntil(cache.put(context, iconId, payload.cacheUpdate));
    }
    return new Response(payload.bytes, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'inline',
        'Content-Security-Policy': 'sandbox',
        'Cache-Control':
          version === undefined
            ? 'public, max-age=300, must-revalidate'
            : 'public, max-age=2592000, immutable',
        'X-Cache': payload.cacheStatus,
      },
    });
  } catch (error) {
    return upstreamDown(error);
  }
});

export { charaRouter };
