/**
 * Categories Handler
 * Routes for category listing
 */

import { Hono } from 'hono';
import type { Env, AuthContext, CategoryMeta, CategoryRow } from '../types.js';
import { notFoundResponse } from '../utils/api-response.js';

type Variables = {
  auth: AuthContext;
};

export const categoriesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// REFACTOR-010: Named constants for cache TTL values so they can be updated in one place.
const CATEGORY_CDN_TTL = 60;          // s-maxage: Cloudflare edge cache (seconds)
const CATEGORY_BROWSER_TTL = 30;      // max-age: browser cache (seconds)
const CATEGORY_SWR_TTL = 120;         // stale-while-revalidate window (seconds)
const CATEGORY_CACHE_CONTROL = `public, s-maxage=${CATEGORY_CDN_TTL}, max-age=${CATEGORY_BROWSER_TTL}, stale-while-revalidate=${CATEGORY_SWR_TTL}`;

// OPT-001: Module-level pending promise to deduplicate concurrent D1 queries during CDN
// cache misses. CF Workers share module state within an isolate — concurrent requests to
// the same isolate share one D1 roundtrip instead of firing duplicate queries.
let pendingCategoryListFetch: Promise<CategoryMeta[]> | null = null;

/**
 * Execute D1 query for the full category list.
 * Extracted so it can be deduplicated via pendingCategoryListFetch.
 */
async function fetchAllCategories(db: D1Database): Promise<CategoryMeta[]> {
  const query = `
    SELECT
      c.id,
      c.name,
      c.description,
      c.icon,
      c.is_curated,
      c.display_order,
      COUNT(CASE WHEN p.status = 'approved' THEN 1 END) as preset_count
    FROM categories c
    LEFT JOIN presets p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.display_order ASC
  `;

  const result = await db.prepare(query).all<CategoryRow & { preset_count: number }>();

  return (result.results || []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    is_curated: row.is_curated === 1,
    display_order: row.display_order,
    preset_count: row.preset_count || 0,
  }));
}

/**
 * GET /api/v1/categories
 * List all categories with preset counts
 *
 * PERFORMANCE: Categories change infrequently, so we cache the response
 * at the edge (Cloudflare CDN) and in browsers for 60 seconds.
 */
categoriesRouter.get('/', async (c) => {
  // OPT-001: Deduplicate concurrent D1 queries — reuse an in-flight fetch if one exists.
  pendingCategoryListFetch ??= fetchAllCategories(c.env.DB).finally(() => {
    pendingCategoryListFetch = null;
  });

  const categories = await pendingCategoryListFetch;

  // Set cache headers - cache for 60 seconds at edge and browser
  // s-maxage = CDN cache time, max-age = browser cache time
  // stale-while-revalidate allows serving stale content while fetching fresh
  return c.json(
    { categories },
    200,
    {
      'Cache-Control': CATEGORY_CACHE_CONTROL,
    }
  );
});

/**
 * GET /api/v1/categories/:id
 * Get a single category by ID
 *
 * PERFORMANCE: Individual categories cached for 60 seconds at edge
 */
categoriesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  const query = `
    SELECT
      c.id,
      c.name,
      c.description,
      c.icon,
      c.is_curated,
      c.display_order,
      COUNT(CASE WHEN p.status = 'approved' THEN 1 END) as preset_count
    FROM categories c
    LEFT JOIN presets p ON p.category_id = c.id
    WHERE c.id = ?
    GROUP BY c.id
  `;

  const row = await c.env.DB.prepare(query).bind(id).first<
    CategoryRow & { preset_count: number }
  >();

  if (!row) {
    return notFoundResponse(c, 'Category');
  }

  const category: CategoryMeta = {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    is_curated: row.is_curated === 1,
    display_order: row.display_order,
    preset_count: row.preset_count || 0,
  };

  return c.json(
    category,
    200,
    {
      'Cache-Control': CATEGORY_CACHE_CONTROL,
    }
  );
});
