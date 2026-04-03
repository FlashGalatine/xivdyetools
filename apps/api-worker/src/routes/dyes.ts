/**
 * Dye routes — 7 endpoints for dye database access.
 *
 * Route registration order matters: static paths (search, categories, batch,
 * consolidation-groups, stain/:stainId) must be registered before the
 * parameterized /:id route to avoid Hono matching conflicts.
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { CONSOLIDATED_IDS, isConsolidationActive, LocalizationService } from '@xivdyetools/core';
import { dyeService } from '../lib/services.js';
import { serializeDye } from '../lib/dye-serializer.js';
import { ApiError, ErrorCode } from '../lib/api-error.js';
import {
  parseHex,
  parseIntParam,
  parseEnumParam,
  parseBooleanParam,
  parseCommaSeparatedIds,
  parseLocale,
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
  errorResponse,
  buildPagination,
} from '../lib/response.js';
import type { Dye } from '@xivdyetools/types';

const dyesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================================
// GET /search — Name search
// ============================================================================

dyesRouter.get('/search', async (c) => {
  const q = c.req.query('q');
  if (!q || q.trim() === '') {
    throw new ApiError(ErrorCode.MISSING_PARAMETER, 'Missing required parameter: q', 400, {
      parameter: 'q',
      required: true,
    });
  }

  const locale = parseLocale(c.req.query('locale'));

  let results: Dye[];
  if (locale !== 'en') {
    await LocalizationService.setLocale(locale);
    results = dyeService.searchByLocalizedName(q);
  } else {
    results = dyeService.searchByName(q);
  }

  const serialized = results.map((dye) => {
    const localizedName = locale !== 'en'
      ? (LocalizationService.getDyeName(dye.itemID) || undefined)
      : undefined;
    return serializeDye(dye, localizedName);
  });

  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return successResponse(c, serialized, locale);
});

// ============================================================================
// GET /categories — Category list with counts
// ============================================================================

dyesRouter.get('/categories', (c) => {
  const categories = dyeService.getCategories();
  const data = categories.map((category) => ({
    name: category,
    count: dyeService.searchByCategory(category).length,
  }));

  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return successResponse(c, data);
});

// ============================================================================
// GET /batch — Multi-ID lookup (max 50, mixed types)
// ============================================================================

dyesRouter.get('/batch', async (c) => {
  const ids = parseCommaSeparatedIds(c.req.query('ids'), 'ids', 50);
  const idType = parseEnumParam(c.req.query('idType'), 'idType', ['auto', 'item', 'stain'] as const, 'auto');
  const locale = parseLocale(c.req.query('locale'));

  if (locale !== 'en') {
    await LocalizationService.setLocale(locale);
  }

  const found: ReturnType<typeof serializeDye>[] = [];
  const notFound: number[] = [];

  for (const id of ids) {
    let dye: Dye | null = null;

    if (idType === 'auto') {
      dye = lookupDyeByResolvedId(resolveIdType(id));
    } else if (idType === 'item') {
      dye = dyeService.getDyeById(id);
    } else {
      dye = dyeService.getByStainId(id);
    }

    if (dye) {
      const localizedName = locale !== 'en'
        ? (LocalizationService.getDyeName(dye.itemID) || undefined)
        : undefined;
      found.push(serializeDye(dye, localizedName));
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

dyesRouter.get('/consolidation-groups', (c) => {
  const allDyes = dyeService.getAllDyes();
  const consolidationActive = isConsolidationActive();

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

  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return successResponse(c, {
    consolidationActive,
    groups,
    unconsolidated: {
      count: unconsolidated.length,
      dyes: unconsolidated.map((d) => ({ itemID: d.itemID, stainID: d.stainID, name: d.name })),
    },
  });
});

// ============================================================================
// GET /stain/:stainId — Explicit stainID lookup
// ============================================================================

dyesRouter.get('/stain/:stainId', async (c) => {
  const raw = c.req.param('stainId');
  const stainId = parseInt(raw, 10);

  if (isNaN(stainId) || stainId <= 0) {
    throw new ApiError(ErrorCode.INVALID_STAIN_ID, `Invalid stain ID "${raw}". Must be a positive integer.`, 400, {
      parameter: 'stainId',
      received: raw,
      expected: 'positive integer (1-125)',
    });
  }

  const locale = parseLocale(c.req.query('locale'));
  const dye = dyeService.getByStainId(stainId);
  if (!dye) {
    throw new ApiError(ErrorCode.NOT_FOUND, `No dye found with stain ID ${stainId}.`, 404);
  }

  let localizedName: string | undefined;
  if (locale !== 'en') {
    await LocalizationService.setLocale(locale);
    localizedName = LocalizationService.getDyeName(dye.itemID) || undefined;
  }

  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return successResponse(c, serializeDye(dye, localizedName), locale);
});

// ============================================================================
// GET /:id — Single dye lookup (auto-detect ID type)
// ============================================================================

dyesRouter.get('/:id', async (c) => {
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
    const hint = resolution.type === 'invalid'
      ? ` ID ${id} falls in the unassigned range (126-5728).`
      : '';
    throw new ApiError(ErrorCode.NOT_FOUND, `No dye found with ID ${id}.${hint}`, 404);
  }

  const locale = parseLocale(c.req.query('locale'));
  let localizedName: string | undefined;
  if (locale !== 'en') {
    await LocalizationService.setLocale(locale);
    localizedName = LocalizationService.getDyeName(dye.itemID) || undefined;
  }

  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return successResponse(c, serializeDye(dye, localizedName), locale);
});

// ============================================================================
// GET / — List all dyes with filtering, sorting, and pagination
// ============================================================================

dyesRouter.get('/', async (c) => {
  const locale = parseLocale(c.req.query('locale'));
  const category = c.req.query('category');
  const excludeIdsRaw = c.req.query('excludeIds');
  const minPriceRaw = c.req.query('minPrice');
  const maxPriceRaw = c.req.query('maxPrice');
  const minPrice = minPriceRaw !== undefined ? parseIntParam(minPriceRaw, 'minPrice', { min: 0 }) : undefined;
  const maxPrice = maxPriceRaw !== undefined ? parseIntParam(maxPriceRaw, 'maxPrice', { min: 0 }) : undefined;
  const sortRaw = c.req.query('sort');
  const sort = sortRaw !== undefined ? parseEnumParam(sortRaw, 'sort', VALID_SORT_FIELDS) : undefined;
  const order = parseEnumParam(c.req.query('order'), 'order', VALID_ORDERS, 'asc');
  const page = parseIntParam(c.req.query('page'), 'page', { min: 1, defaultValue: 1 });
  const perPage = parseIntParam(c.req.query('perPage'), 'perPage', { min: 1, max: 200, defaultValue: 50 });

  // Boolean filters
  const metallic = parseBooleanParam(c.req.query('metallic'));
  const pastel = parseBooleanParam(c.req.query('pastel'));
  const dark = parseBooleanParam(c.req.query('dark'));
  const cosmic = parseBooleanParam(c.req.query('cosmic'));
  const ishgardian = parseBooleanParam(c.req.query('ishgardian'));
  const consolidationType = c.req.query('consolidationType') as 'A' | 'B' | 'C' | undefined;

  // Acquisition/expense filters
  const dyeFilters = parseDyeFilters(c.req.query.bind(c.req));

  if (consolidationType && !VALID_CONSOLIDATION_TYPES.includes(consolidationType as 'A' | 'B' | 'C')) {
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

  // Acquisition/expense filters (vendor, craft, alliedSociety, expensive)
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

  // Localization
  if (locale !== 'en') {
    await LocalizationService.setLocale(locale);
  }

  const serialized = paged.map((dye) => {
    const localizedName = locale !== 'en'
      ? (LocalizationService.getDyeName(dye.itemID) || undefined)
      : undefined;
    return serializeDye(dye, localizedName);
  });

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
