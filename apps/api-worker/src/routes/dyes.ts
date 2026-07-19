/**
 * Dye routes — 7 endpoints for dye database access.
 *
 * Route registration order matters: static paths (search, categories, batch,
 * consolidation-groups, stain/:stainId) must be registered before the
 * parameterized /:id route to avoid Hono matching conflicts.
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { CONSOLIDATED_IDS, isConsolidationActive } from '@xivdyetools/core';
import { dyeService } from '../lib/services.js';
import { serializeDye, localizedNameFor } from '../lib/dye-serializer.js';
import { ApiError, ErrorCode } from '../lib/api-error.js';
import {
  parseIntParam,
  parseEnumParam,
  parseBooleanParam,
  parseCommaSeparatedIds,
  resolveIdType,
  lookupDyeByResolvedId,
  resolveExcludeIds,
  parseDyeFilters,
  applyDyeFilters,
  VALID_SORT_FIELDS,
  VALID_ORDERS,
  VALID_CONSOLIDATION_TYPES,
  type ValidSortField,
} from '../lib/validation.js';
import {
  successResponse,
  paginatedResponse,
  buildPagination,
} from '../lib/response.js';
import type { Dye } from '@xivdyetools/types';

const dyesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================================
// GET /search — Name search
// ============================================================================

dyesRouter.get('/search', (c) => {
  const q = c.req.query('q');
  if (!q || q.trim() === '') {
    throw new ApiError(ErrorCode.MISSING_PARAMETER, 'Missing required parameter: q', 400, {
      parameter: 'q',
      required: true,
    });
  }

  const locale = c.get('locale'); // REFACTOR-023: parsed once by localeMiddleware

  // BUG-006: explicit locale — no singleton state involved
  const results: Dye[] = locale !== 'en'
    ? dyeService.searchByLocalizedName(q, locale)
    : dyeService.searchByName(q);

  const serialized = results.map((dye) => serializeDye(dye, localizedNameFor(dye, locale)));

  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return successResponse(c, serialized, locale);
});

// ============================================================================
// GET /categories — Category list with counts
// ============================================================================

// OPT-025 (2026-07-18 audit): pure function of the immutable dye database —
// compute once per isolate
let categoriesPayload: Array<{ name: string; count: number }> | null = null;

dyesRouter.get('/categories', (c) => {
  if (!categoriesPayload) {
    categoriesPayload = dyeService.getCategories().map((category) => ({
      name: category,
      count: dyeService.searchByCategory(category).length,
    }));
  }

  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return successResponse(c, categoriesPayload);
});

// ============================================================================
// GET /batch — Multi-ID lookup (max 50, mixed types)
// ============================================================================

dyesRouter.get('/batch', (c) => {
  const ids = parseCommaSeparatedIds(c.req.query('ids'), 'ids', 50);
  const idType = parseEnumParam(c.req.query('idType'), 'idType', ['auto', 'item', 'stain'] as const, 'auto');
  const locale = c.get('locale'); // REFACTOR-023: parsed once by localeMiddleware

  const found: ReturnType<typeof serializeDye>[] = [];
  const notFound: number[] = [];

  for (const id of ids) {
    let dye: Dye | null;

    if (idType === 'auto') {
      dye = lookupDyeByResolvedId(resolveIdType(id));
    } else if (idType === 'item') {
      dye = dyeService.getDyeById(id);
    } else {
      dye = dyeService.getByStainId(id);
    }

    if (dye) {
      found.push(serializeDye(dye, localizedNameFor(dye, locale)));
    } else {
      notFound.push(id);
    }
  }

  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return successResponse(c, { dyes: found, notFound }, locale);
});

// ============================================================================
// GET /consolidation-groups — Patch 7.5 consolidation metadata
// ============================================================================

// OPT-025: memoized per consolidation-active state so the payload flips
// correctly at the activation-date boundary
const consolidationPayloadCache = new Map<boolean, unknown>();

dyesRouter.get('/consolidation-groups', (c) => {
  const consolidationActive = isConsolidationActive();
  const cached = consolidationPayloadCache.get(consolidationActive);
  if (cached) {
    c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    return successResponse(c, cached);
  }

  const allDyes = dyeService.getAllDyes();

  const groups = (['A', 'B', 'C'] as const).map((type) => {
    const dyes = allDyes.filter((d) => d.consolidationType === type);
    return {
      type,
      consolidatedItemID: CONSOLIDATED_IDS[type],
      dyeCount: dyes.length,
      dyes: dyes.map((d) => ({ itemID: d.itemID, stainID: d.stainID, name: d.name })),
    };
  });

  const unconsolidated = allDyes.filter(
    (d) => d.consolidationType === null && d.category !== 'Facewear',
  );

  const payload = {
    consolidationActive,
    groups,
    unconsolidated: {
      count: unconsolidated.length,
      dyes: unconsolidated.map((d) => ({ itemID: d.itemID, stainID: d.stainID, name: d.name })),
    },
  };
  consolidationPayloadCache.set(consolidationActive, payload);

  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return successResponse(c, payload);
});

// ============================================================================
// GET /stain/:stainId — Explicit stainID lookup
// ============================================================================

dyesRouter.get('/stain/:stainId', (c) => {
  const raw = c.req.param('stainId');
  const stainId = parseInt(raw, 10);

  if (isNaN(stainId) || stainId <= 0) {
    throw new ApiError(ErrorCode.INVALID_STAIN_ID, `Invalid stain ID "${raw}". Must be a positive integer.`, 400, {
      parameter: 'stainId',
      received: raw,
      expected: 'positive integer (1-125)',
    });
  }

  const locale = c.get('locale'); // REFACTOR-023: parsed once by localeMiddleware
  const dye = dyeService.getByStainId(stainId);
  if (!dye) {
    throw new ApiError(ErrorCode.NOT_FOUND, `No dye found with stain ID ${stainId}.`, 404);
  }

  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return successResponse(c, serializeDye(dye, localizedNameFor(dye, locale)), locale);
});

// ============================================================================
// GET /:id — Single dye lookup (auto-detect ID type)
// ============================================================================

dyesRouter.get('/:id', (c) => {
  const raw = c.req.param('id');
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, `Invalid dye ID "${raw}". Must be an integer.`, 400, {
      parameter: 'id',
      received: raw,
      expected: 'integer',
    });
  }

  const resolution = resolveIdType(id);
  const dye = lookupDyeByResolvedId(resolution);

  if (!dye) {
    // BUG-071 (2026-07-18 audit): the API itself emits these consolidated
    // market itemIDs in `marketItemID`; round-tripping one must explain
    // itself instead of a bare 404
    const consolidatedType = Object.entries(CONSOLIDATED_IDS).find(([, cid]) => cid === id)?.[0] as
      | 'A'
      | 'B'
      | 'C'
      | undefined;
    if (consolidatedType) {
      throw new ApiError(
        ErrorCode.NOT_FOUND,
        `ID ${id} is the consolidated market itemID for Type-${consolidatedType} dyes, not a dye entry; see /v1/dyes/consolidation-groups for its members.`,
        404,
        { consolidatedType },
      );
    }
    const hint = resolution.type === 'invalid'
      ? ` ID ${id} falls in the unassigned range (126-5728).`
      : '';
    throw new ApiError(ErrorCode.NOT_FOUND, `No dye found with ID ${id}.${hint}`, 404);
  }

  const locale = c.get('locale'); // REFACTOR-023: parsed once by localeMiddleware

  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return successResponse(c, serializeDye(dye, localizedNameFor(dye, locale)), locale);
});

// ============================================================================
// GET / — List all dyes with filtering, sorting, and pagination
// ============================================================================

dyesRouter.get('/', (c) => {
  const locale = c.get('locale'); // REFACTOR-023: parsed once by localeMiddleware
  const category = c.req.query('category');
  const excludeIdsRaw = c.req.query('excludeIds');
  const minPriceRaw = c.req.query('minPrice');
  const maxPriceRaw = c.req.query('maxPrice');
  // BUG-070 (related): empty-but-present numeric params are treated as "not
  // provided" instead of surfacing a misleading MISSING_PARAMETER error
  const minPrice = minPriceRaw ? parseIntParam(minPriceRaw, 'minPrice', { min: 0 }) : undefined;
  const maxPrice = maxPriceRaw ? parseIntParam(maxPriceRaw, 'maxPrice', { min: 0 }) : undefined;
  const sortRaw = c.req.query('sort');
  const sort = sortRaw !== undefined ? parseEnumParam(sortRaw, 'sort', VALID_SORT_FIELDS) : undefined;
  const order = parseEnumParam(c.req.query('order'), 'order', VALID_ORDERS, 'asc');
  const page = parseIntParam(c.req.query('page'), 'page', { min: 1, defaultValue: 1 });
  const perPage = parseIntParam(c.req.query('perPage'), 'perPage', { min: 1, max: 200, defaultValue: 50 });

  // Boolean filters
  const metallic = parseBooleanParam(c.req.query('metallic'), 'metallic');
  const pastel = parseBooleanParam(c.req.query('pastel'), 'pastel');
  const dark = parseBooleanParam(c.req.query('dark'), 'dark');
  const cosmic = parseBooleanParam(c.req.query('cosmic'), 'cosmic');
  const ishgardian = parseBooleanParam(c.req.query('ishgardian'), 'ishgardian');
  const consolidationType = c.req.query('consolidationType') as 'A' | 'B' | 'C' | undefined;

  // Acquisition/expense filters
  const dyeFilters = parseDyeFilters(c.req.query.bind(c.req));

  if (consolidationType && !VALID_CONSOLIDATION_TYPES.includes(consolidationType)) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, `Invalid consolidationType "${consolidationType}". Must be A, B, or C.`, 400, {
      parameter: 'consolidationType',
      received: consolidationType,
      expected: ['A', 'B', 'C'],
    });
  }

  // Base filtering via DyeService
  const excludeIds = excludeIdsRaw ? resolveExcludeIds(excludeIdsRaw) : undefined;
  let results = dyeService.filterDyes({
    category,
    excludeIds,
    minPrice,
    maxPrice,
  });

  // Boolean filters (applied in-memory)
  if (metallic !== undefined) results = results.filter((d) => d.isMetallic === metallic);
  if (pastel !== undefined) results = results.filter((d) => d.isPastel === pastel);
  if (dark !== undefined) results = results.filter((d) => d.isDark === dark);
  if (cosmic !== undefined) results = results.filter((d) => d.isCosmic === cosmic);
  if (ishgardian !== undefined) results = results.filter((d) => d.isIshgardian === ishgardian);
  if (consolidationType) results = results.filter((d) => d.consolidationType === consolidationType);

  // Acquisition/expense filters (vendor, craft, expensive)
  results = applyDyeFilters(results, dyeFilters);

  // Sorting
  if (sort) {
    const asc = order === 'asc';
    results = sortDyes(results, sort, asc);
  }

  // Pagination
  const total = results.length;
  const pagination = buildPagination(page, perPage, total);
  const start = (page - 1) * perPage;
  const paged = results.slice(start, start + perPage);

  const serialized = paged.map((dye) => serializeDye(dye, localizedNameFor(dye, locale)));

  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return paginatedResponse(c, serialized, pagination, locale);
});

// ============================================================================
// Sorting helper
// ============================================================================

function sortDyes(dyes: Dye[], field: ValidSortField, ascending: boolean): Dye[] {
  const sorted = [...dyes];
  sorted.sort((a, b) => {
    let cmp: number;
    switch (field) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'brightness':
        cmp = a.hsv.v - b.hsv.v;
        break;
      case 'saturation':
        cmp = a.hsv.s - b.hsv.s;
        break;
      case 'hue':
        cmp = a.hsv.h - b.hsv.h;
        break;
      case 'cost':
        cmp = a.cost - b.cost;
        break;
      default:
        cmp = 0;
    }
    return ascending ? cmp : -cmp;
  });
  return sorted;
}

export { dyesRouter };
