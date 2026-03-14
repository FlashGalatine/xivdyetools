/**
 * Consolidated dye item IDs for Patch 7.5.
 *
 * PATCH DAY (2026-04-28): Replace null values with real item IDs from datamining.
 * This is the ONLY file that needs updating on patch day.
 */
export const CONSOLIDATED_IDS: Record<'A' | 'B' | 'C', number | null> = {
  A: null, // ARR dyes (85 dyes, itemIDs 5729-5813)
  B: null, // Ishgardian Restoration dyes (9 dyes, itemIDs 30116-30124)
  C: null, // Cosmic Exploration dyes (11 dyes, itemIDs 48163-48172, 48227)
};

/**
 * Whether dye consolidation is active (all IDs are known).
 * Returns true only when all three consolidated IDs have been set.
 */
export function isConsolidationActive(): boolean {
  return (
    CONSOLIDATED_IDS.A !== null &&
    CONSOLIDATED_IDS.B !== null &&
    CONSOLIDATED_IDS.C !== null
  );
}

/**
 * Get the market board item ID for a dye.
 *
 * - If consolidation is active and the dye has a consolidationType, returns the consolidated ID.
 * - Otherwise returns the dye's original itemID.
 * - Facewear dyes (negative IDs) always return the original ID.
 */
export function getMarketItemID(dye: {
  itemID: number;
  consolidationType: 'A' | 'B' | 'C' | null;
}): number {
  if (dye.itemID < 0) return dye.itemID; // Facewear
  if (!dye.consolidationType) return dye.itemID; // Special/uncategorized
  if (!isConsolidationActive()) return dye.itemID; // Pre-patch fallback
  return CONSOLIDATED_IDS[dye.consolidationType]!;
}
