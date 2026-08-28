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
import { BodyTooLargeError, readBoundedBytes, readBoundedText } from '../lib/bounded-body.js';
import { successResponse } from '../lib/response.js';
import { parseIntParam } from '../lib/validation.js';
import { CharaRowCache } from './cache.js';
import { indexRows, lookupsFor, resolveCharaEquipment } from './resolver.js';
import { UpstreamUnavailableError, XivapiClient } from './xivapi.js';
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
/** Icon PNGs are ~10 KB at _hr1; 1 MB is a generous ceiling before we refuse to buffer. */
const MAX_ICON_BYTES = 1024 * 1024;
const ICON_CACHE_CONTROL = 'public, max-age=2592000, immutable';
/**
 * FINDING-025 / API-4: the canonical decimal form only. `parseInt` accepts
 * `041716`, `41716abc`, `41716 ` as 41716 — each a distinct edge-cache key and
 * a fresh upstream fetch for the same icon.
 */
const CANONICAL_ICON_ID = /^[1-9]\d{0,5}$/;
/** The eight-byte PNG signature — the only body the icon proxy will serve (API-12). */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(bytes: Uint8Array): boolean {
  return bytes.byteLength >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

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
    throw new ApiError(ErrorCode.INVALID_BODY, 'Body must be a JSON object with a `gear` array', 400);
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
    return weapon
      ? { slot: typedSlot, set, base, variant }
      : { slot: typedSlot, base, variant };
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
  // Same cast as the Universalis router — Hono's ctx type lags workers-types.
  const cache = new CharaRowCache(
    c.executionCtx as ExecutionContext,
    new URL(c.req.url).origin,
    client.versionKey,
  );

  const lookups = lookupsFor(request.gear);
  const rows = await cache.getRows(lookups);
  const misses = lookups.filter((l) => !rows.has(lookupKey(l)));

  let version: string | null = null;
  let upstreamCalls = 0;
  try {
    const [search, glassesCached] = await Promise.all([
      misses.length > 0 ? client.searchItems(misses) : Promise.resolve(null),
      request.glasses ? cache.getGlasses(request.glasses) : Promise.resolve(undefined),
    ]);

    if (search) {
      upstreamCalls++;
      version = search.version;
      const index = indexRows(search.rows);
      // FINDING-025 / API-3: a truncated page (next cursor / 500-row cap) may
      // be missing tail groups — answer this request from what came back, but
      // never store those keys as "no item row" for a week.
      if (search.truncated) {
        getLogger(c)?.warn('XIVAPI search page truncated — not caching this request\'s misses', {
          operation: 'chara.resolve',
          lookups: misses.length,
          rows: search.rows.length,
        });
      }
      for (const lookup of misses) {
        const found: ItemRow[] = index.get(lookupKey(lookup)) ?? [];
        rows.set(lookupKey(lookup), found);
        if (!search.truncated) cache.storeRows(lookup, found);
      }
    }

    let glassesRow: GlassesRow | null | undefined = undefined;
    if (request.glasses) {
      if (glassesCached !== undefined) {
        glassesRow = glassesCached;
      } else {
        upstreamCalls++;
        const fetched = await client.getGlasses(request.glasses);
        glassesRow = fetched.row;
        version ??= fetched.version;
        cache.storeGlasses(request.glasses, fetched.row);
      }
    }

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
    throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Parameter "iconId" must be a positive integer (canonical decimal, 1–999999).', 400, {
      parameter: 'iconId',
      received: rawId,
      expected: 'integer 1–999999 without leading zeros, signs or trailing characters',
    });
  }
  const iconId = parseIntParam(rawId, 'iconId', { min: 1, max: 999_999 });
  // Cache under the CANONICAL public URL (path rebuilt from the parsed id,
  // query stripped) so every viewer of the same icon shares one edge entry,
  // and the browser gets a long immutable TTL.
  const url = new URL(c.req.url);
  url.pathname = `/v1/chara/icon/${iconId}`;
  url.search = '';
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  const edge = typeof caches !== 'undefined' ? caches.default : null;

  const hit = await edge?.match(cacheKey);
  if (hit) {
    const headers = new Headers(hit.headers);
    headers.set('X-Cache', 'HIT');
    return new Response(hit.body, { status: 200, headers });
  }

  const client = new XivapiClient(c.env);
  let upstream: Response;
  try {
    upstream = await client.fetchIcon(iconId);
  } catch (error) {
    return upstreamDown(error);
  }
  if (upstream.status === 404) {
    throw new ApiError(ErrorCode.NOT_FOUND, `No icon ${iconId}`, 404);
  }
  if (!upstream.ok) {
    throw new ApiError(ErrorCode.UPSTREAM_UNAVAILABLE, `Icon upstream answered ${upstream.status}`, 503);
  }
  const declared = Number(upstream.headers.get('Content-Length') ?? '0');
  if (declared > MAX_ICON_BYTES) {
    throw new ApiError(ErrorCode.UPSTREAM_UNAVAILABLE, 'Icon exceeds the size ceiling', 503);
  }
  // FINDING-025 / API-12: byte-budgeted read (Content-Length is advisory) …
  let bytes: Uint8Array;
  try {
    bytes = await readBoundedBytes(upstream.body, MAX_ICON_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      throw new ApiError(ErrorCode.UPSTREAM_UNAVAILABLE, 'Icon exceeds the size ceiling', 503);
    }
    throw error;
  }
  // … and the proxy serves image/png or nothing: the upstream Content-Type is
  // never reflected, and a 2xx body that is not a PNG is refused — not stored
  // under a 30-day immutable key.
  if (!isPng(bytes)) {
    throw new ApiError(ErrorCode.UPSTREAM_UNAVAILABLE, 'Icon upstream did not return a PNG', 503);
  }

  const response = new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': 'inline',
      'Content-Security-Policy': 'sandbox',
      'Cache-Control': ICON_CACHE_CONTROL,
      'X-Cache': 'MISS',
    },
  });
  if (edge) {
    c.executionCtx.waitUntil(edge.put(cacheKey, response.clone()).catch(() => {}));
  }
  return response;
});

export { charaRouter };
