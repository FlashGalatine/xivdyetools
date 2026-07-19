/**
 * Category Service
 * Module-level cache of valid category IDs, with promise deduplication.
 *
 * REFACTOR-017 (2026-07-18 audit): extracted from handlers/presets.ts so the
 * cache state and its lifecycle live away from route definitions.
 */

// PRESETS-CRITICAL-002: Cache valid categories from database
// Categories are cached at module level and refreshed periodically
let cachedCategories: string[] | null = null;
let categoryCacheTime = 0;
// OPT-001: Pending promise for deduplication — prevents thundering herd on cache miss
let categoriesFetchPromise: Promise<string[]> | null = null;
const CATEGORY_CACHE_TTL = 60000; // 1 minute

/**
 * Reset the category cache (exported for testing)
 */
export function resetCategoryCache(): void {
  cachedCategories = null;
  categoryCacheTime = 0;
  categoriesFetchPromise = null;
}

/**
 * Get valid category IDs from database with caching
 * This replaces the hardcoded VALID_CATEGORIES array
 *
 * OPT-001: Uses promise deduplication to prevent thundering herd —
 * concurrent cache misses share a single in-flight database query
 */
export async function getValidCategories(db: D1Database): Promise<string[]> {
  const now = Date.now();

  // Return cached categories if still valid
  if (cachedCategories && now - categoryCacheTime < CATEGORY_CACHE_TTL) {
    return cachedCategories;
  }

  // OPT-001: If a fetch is already in progress, await it instead of starting a new one
  if (categoriesFetchPromise) {
    return categoriesFetchPromise;
  }

  // Start the fetch and cache the promise for deduplication
  categoriesFetchPromise = db
    .prepare('SELECT id FROM categories')
    .all<{ id: string }>()
    .then((result) => {
      cachedCategories = (result.results || []).map(row => row.id);
      categoryCacheTime = Date.now();
      return cachedCategories;
    })
    .finally(() => {
      categoriesFetchPromise = null;
    });

  return categoriesFetchPromise;
}
