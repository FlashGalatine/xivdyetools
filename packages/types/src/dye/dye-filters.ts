/**
 * Dye Type Filters
 *
 * Filter configuration for excluding dye categories from results.
 * All fields are optional — undefined or false means "do not exclude".
 *
 * Used by:
 * - Web app (ConfigSidebar / tool components)
 * - Discord bot (user preferences)
 * - API worker (query parameters)
 * - Bot-logic execute functions
 *
 * @module dye/dye-filters
 */

/**
 * Configuration for filtering dyes by type and acquisition source.
 *
 * When a field is `true`, dyes matching that criterion are excluded
 * from results. When `false` or `undefined`, no filtering is applied.
 */
export interface DyeTypeFilters {
  /** Exclude metallic dyes */
  excludeMetallic?: boolean;
  /** Exclude pastel dyes */
  excludePastel?: boolean;
  /** Exclude dark dyes */
  excludeDark?: boolean;
  /** Exclude cosmic dyes */
  excludeCosmic?: boolean;
  /** Exclude Ishgardian dyes */
  excludeIshgardian?: boolean;
  /** Exclude expensive dyes (Pure White, Jet Black) */
  excludeExpensive?: boolean;
  /** Exclude vendor-sold dyes (Dye Vendor) */
  excludeVendorDyes?: boolean;
  /** Exclude crafted dyes (Crafting, Treasure Chest) */
  excludeCraftDyes?: boolean;
  /** Exclude allied society dyes */
  excludeAlliedSocietyDyes?: boolean;
}
