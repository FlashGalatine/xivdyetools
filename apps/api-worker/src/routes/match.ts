/**
 * Match routes — 2 endpoints for color matching against the dye database.
 *
 * Both endpoints recalculate distance for the response since the core
 * findClosestDye/findDyesWithinDistance methods return Dye objects
 * without distance values.
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { LocalizationService } from '@xivdyetools/core';
import type { FindClosestOptions, FindWithinDistanceOptions } from '@xivdyetools/core';
import { dyeService, calculateDistance } from '../lib/services.js';
import { serializeDyeWithDistance } from '../lib/dye-serializer.js';
import { ErrorCode } from '../lib/api-error.js';
import {
  parseHex,
  parseFloatParam,
  parseIntParam,
  parseMatchingMethod,
  parseLocale,
  resolveExcludeIds,
  parseDyeFilters,
  buildFilterExcludeIds,
  applyDyeFilters,
} from '../lib/validation.js';
import { successResponse } from '../lib/response.js';

const matchRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================================
// GET /closest — Find the single closest dye to a hex color
// ============================================================================

matchRouter.get('/closest', async (c) => {
  const hex = parseHex(c.req.query('hex'));
  const method = parseMatchingMethod(c.req.query('method'));
  const locale = parseLocale(c.req.query('locale'));
  const excludeIdsRaw = c.req.query('excludeIds');

  // OKLCH weights (only meaningful for oklch-weighted method)
  const kL = parseFloatParam(c.req.query('kL'), 'kL', { min: 0, defaultValue: 1.0 });
  const kC = parseFloatParam(c.req.query('kC'), 'kC', { min: 0, defaultValue: 1.0 });
  const kH = parseFloatParam(c.req.query('kH'), 'kH', { min: 0, defaultValue: 1.0 });

  // Dye type/acquisition filters
  const filters = parseDyeFilters(c.req.query.bind(c.req));
  const filterExcludeIds = buildFilterExcludeIds(filters);
  const userExcludeIds = excludeIdsRaw ? resolveExcludeIds(excludeIdsRaw) : [];
  const combinedExcludeIds = [...userExcludeIds, ...filterExcludeIds];

  const options: FindClosestOptions = {
    excludeIds: combinedExcludeIds.length > 0 ? combinedExcludeIds : undefined,
    matchingMethod: method,
    weights: method === 'oklch-weighted' ? { kL, kC, kH } : undefined,
  };

  const dye = dyeService.findClosestDye(hex, options);

  if (!dye) {
    return c.json(
      {
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'No matching dye found.',
        meta: {
          requestId: c.get('requestId') || 'unknown',
          apiVersion: c.env.API_VERSION || 'v1',
        },
      },
      404,
    );
  }

  // Recalculate distance for the response (core doesn't return it)
  const distance = calculateDistance(hex, dye.hex, method,
    method === 'oklch-weighted' ? { kL, kC, kH } : undefined);

  let localizedName: string | undefined;
  if (locale !== 'en') {
    await LocalizationService.setLocale(locale);
    localizedName = LocalizationService.getDyeName(dye.itemID) || undefined;
  }

  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return successResponse(c, {
    ...serializeDyeWithDistance(dye, distance, localizedName),
    method,
    inputHex: hex,
  }, locale);
});

// ============================================================================
// GET /within-distance — Find all dyes within a distance threshold
// ============================================================================

matchRouter.get('/within-distance', async (c) => {
  const hex = parseHex(c.req.query('hex'));
  const maxDistance = parseFloatParam(c.req.query('maxDistance'), 'maxDistance', { min: 0.01 });
  const method = parseMatchingMethod(c.req.query('method'));
  const limit = parseIntParam(c.req.query('limit'), 'limit', { min: 1, max: 136, defaultValue: 20 });
  const locale = parseLocale(c.req.query('locale'));
  const excludeIdsRaw = c.req.query('excludeIds');

  const kL = parseFloatParam(c.req.query('kL'), 'kL', { min: 0, defaultValue: 1.0 });
  const kC = parseFloatParam(c.req.query('kC'), 'kC', { min: 0, defaultValue: 1.0 });
  const kH = parseFloatParam(c.req.query('kH'), 'kH', { min: 0, defaultValue: 1.0 });

  const weights = method === 'oklch-weighted' ? { kL, kC, kH } : undefined;

  // Dye type/acquisition filters
  const filters = parseDyeFilters(c.req.query.bind(c.req));

  const options: FindWithinDistanceOptions = {
    maxDistance,
    limit,
    matchingMethod: method,
    weights,
  };

  // Note: core returns Dye[] without distances, and excludeIds uses dye.id
  // We need to handle excludeIds separately for within-distance
  let dyes = dyeService.findDyesWithinDistance(hex, options);

  // Apply excludeIds if provided (resolve mixed IDs to internal IDs)
  if (excludeIdsRaw) {
    const excludeInternalIds = new Set(resolveExcludeIds(excludeIdsRaw));
    dyes = dyes.filter((d) => !excludeInternalIds.has(d.id));
  }

  // Apply dye type/acquisition filters
  dyes = applyDyeFilters(dyes, filters);

  if (locale !== 'en') {
    await LocalizationService.setLocale(locale);
  }

  // Recalculate distances for the response
  const results = dyes.map((dye) => {
    const dist = calculateDistance(hex, dye.hex, method, weights);
    const localizedName = locale !== 'en'
      ? (LocalizationService.getDyeName(dye.itemID) || undefined)
      : undefined;
    return serializeDyeWithDistance(dye, dist, localizedName);
  });

  // Sort by distance (should already be sorted from core, but ensure it)
  results.sort((a, b) => a.distance - b.distance);

  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return successResponse(c, {
    results,
    inputHex: hex,
    maxDistance,
    method,
    resultCount: results.length,
  }, locale);
});

export { matchRouter };
