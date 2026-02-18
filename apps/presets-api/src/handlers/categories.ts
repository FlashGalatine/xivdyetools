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

/**
 * GET /api/v1/categories
 * List all categories with preset counts
 *
 * PERFORMANCE: Categories change infrequently, so we cache the response
 * at the edge (Cloudflare CDN) and in browsers for 60 seconds.
 */
categoriesRouter.get('/', async (c) => {
  // Get categories with preset counts
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

  const result = await c.env.DB.prepare(query).all<
    CategoryRow & { preset_count: number }
  >();

  const categories: CategoryMeta[] = (result.results || []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    is_curated: row.is_curated === 1,
    display_order: row.display_order,
    preset_count: row.preset_count || 0,
  }));

  // Set cache headers - cache for 60 seconds at edge and browser
  // s-maxage = CDN cache time, max-age = browser cache time
  // stale-while-revalidate allows serving stale content while fetching fresh
  return c.json(
    { categories },
    200,
    {
      'Cache-Control': 'public, s-maxage=60, max-age=30, stale-while-revalidate=120',
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
      'Cache-Control': 'public, s-maxage=60, max-age=30, stale-while-revalidate=120',
    }
  );
});
