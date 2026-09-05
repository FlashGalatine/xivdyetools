/**
 * Harmony routes — 2 endpoints over core's harmony selector.
 *
 * `generateHarmonySlots` is the one algorithm every surface shares since
 * PR #159; the wheel it measures on is core's `ColorWheel` since PR #167.
 * This route adds parsing and serialization only.
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { HARMONY_OFFSETS, generateHarmonySlots, getColorWheel } from '@xivdyetools/core';
import type { Dye } from '@xivdyetools/types';
import { dyeService } from '../lib/services.js';
import { ApiError, ErrorCode } from '../lib/api-error.js';
import { serializeDye, localizedNameFor } from '../lib/dye-serializer.js';
import { localizedHarmonyTypeName, serializeHarmonySlot, serializeWheelSummary } from '../lib/harmony.js';
import {
  CANONICAL_DYE_ID,
  VALID_HARMONY_TYPES,
  applyDyeFilters,
  lookupDyeByResolvedId,
  parseBooleanParam,
  parseColorWheel,
  parseDyeFilters,
  parseHarmonyType,
  parseHex,
  parseIntParam,
  parseMatchingMethod,
  resolveExcludeIds,
  resolveIdType,
} from '../lib/validation.js';
import { successResponse } from '../lib/response.js';

const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400';

const harmonyRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================================
// GET /types — the harmony types and their hue offsets
// ============================================================================

harmonyRouter.get('/types', (c) => {
  const locale = c.get('locale');
  c.header('Cache-Control', CACHE_CONTROL);
  return successResponse(
    c,
    VALID_HARMONY_TYPES.map((id) => ({
      id,
      offsets: HARMONY_OFFSETS[id],
      name: localizedHarmonyTypeName(id, locale),
    })),
    locale,
  );
});

// ============================================================================
// GET / — choose a dye for every slot of a harmony
// ============================================================================

/** The base colour: a dye by id (auto-detected range, like /v1/dyes/:id) or any hex. */
function parseBase(dyeParam: string | undefined, hexParam: string | undefined): { hex: string; dye: Dye | null } {
  if (dyeParam && hexParam) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Provide either "dye" or "hex", not both.', 400, {
      parameter: 'dye',
      received: { dye: dyeParam, hex: hexParam },
      expected: 'one of dye, hex',
    });
  }
  if (hexParam) return { hex: parseHex(hexParam), dye: null };
  if (!dyeParam) {
    throw new ApiError(ErrorCode.MISSING_PARAMETER, 'Missing required parameter: dye (or hex)', 400, {
      parameter: 'dye',
      required: true,
    });
  }
  if (!CANONICAL_DYE_ID.test(dyeParam)) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Parameter "dye" must be a dye id (itemID or stainID).', 400, {
      parameter: 'dye',
      received: dyeParam,
      expected: 'integer',
    });
  }
  const dye = lookupDyeByResolvedId(resolveIdType(Number(dyeParam)));
  if (!dye) {
    throw new ApiError(ErrorCode.NOT_FOUND, `No dye found with ID ${dyeParam}.`, 404, {
      parameter: 'dye',
      received: dyeParam,
    });
  }
  return { hex: dye.hex, dye };
}

harmonyRouter.get('/', (c) => {
  const base = parseBase(c.req.query('dye'), c.req.query('hex'));
  const harmonyType = parseHarmonyType(c.req.query('type'));
  const wheelId = parseColorWheel(c.req.query('wheel'));
  const method = parseMatchingMethod(c.req.query('method'));
  const strict = parseBooleanParam(c.req.query('strict'), 'strict') ?? true;
  const companionCount = parseIntParam(c.req.query('companions'), 'companions', { min: 0, max: 5, defaultValue: 0 });
  const preventDuplicates = parseBooleanParam(c.req.query('preventDuplicates'), 'preventDuplicates') ?? false;
  const locale = c.get('locale');

  const filters = parseDyeFilters(c.req.query.bind(c.req));
  const candidates = applyDyeFilters(dyeService.getAllDyes(), filters);
  const excludeIdsRaw = c.req.query('excludeIds');
  const excludeItemIDs = [
    ...(base.dye ? [base.dye.itemID] : []),
    ...(excludeIdsRaw ? resolveExcludeIds(excludeIdsRaw) : []),
  ];

  const slots = generateHarmonySlots(
    base.hex,
    harmonyType,
    candidates,
    { usePerceptualMatching: strict, matchingMethod: method, wheel: wheelId, companionCount, preventDuplicates },
    { excludeItemIDs },
  );

  c.header('Cache-Control', CACHE_CONTROL);
  return successResponse(
    c,
    {
      base: {
        hex: base.hex,
        dye: base.dye ? serializeDye(base.dye, localizedNameFor(base.dye, locale)) : null,
      },
      harmonyType,
      harmonyTypeName: localizedHarmonyTypeName(harmonyType, locale),
      wheel: serializeWheelSummary(wheelId, locale),
      method,
      strict,
      distanceUnit: strict ? method : 'degrees',
      baseWheelHue: Math.round(getColorWheel(wheelId).hueOf(base.hex) * 1000) / 1000,
      slots: slots.map((slot) => serializeHarmonySlot(slot, locale)),
    },
    locale,
  );
});

export { harmonyRouter };
