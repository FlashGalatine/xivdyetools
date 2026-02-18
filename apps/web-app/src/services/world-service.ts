/**
 * XIV Dye Tools - World Service
 *
 * Singleton service for FFXIV world and data center lookups.
 * Loads server data once and provides fast lookups by ID or name.
 *
 * @module services/world-service
 */

import type { World, DataCenter } from '@shared/types';
import { logger } from '@shared/logger';

/**
 * WorldService - Singleton for world/datacenter resolution
 *
 * Features:
 * - Loads worlds.json and data-centers.json once on initialization
 * - Provides O(1) lookups via Map indexes
 * - Used by MarketBoard, ResultCards, and any component needing server names
 */
class WorldServiceClass {
  private worlds: World[] = [];
  private dataCenters: DataCenter[] = [];

  // Indexed lookups for O(1) access
  private worldById: Map<number, World> = new Map();
  private worldByName: Map<string, World> = new Map();
  private dataCenterByName: Map<string, DataCenter> = new Map();

  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the service by loading server data
   * Safe to call multiple times - will only load once
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.loadServerData();
    return this.initPromise;
  }

  /**
   * Load worlds and data centers from JSON files
   */
  private async loadServerData(): Promise<void> {
    try {
      const [dcResponse, worldsResponse] = await Promise.all([
        fetch('/json/data-centers.json'),
        fetch('/json/worlds.json'),
      ]);

      if (!dcResponse.ok || !worldsResponse.ok) {
        throw new Error(
          `Failed to load server data: DC=${dcResponse.status}, Worlds=${worldsResponse.status}`
        );
      }

      this.dataCenters = await dcResponse.json();
      this.worlds = await worldsResponse.json();

      // Build indexed lookups
      this.buildIndexes();

      this.initialized = true;
      logger.info(
        `WorldService initialized: ${this.worlds.length} worlds, ${this.dataCenters.length} data centers`
      );
    } catch (error) {
      logger.error('WorldService: Failed to load server data', error);
      // Mark as initialized even on error to prevent infinite retries
      this.initialized = true;
    }
  }

  /**
   * Build Map indexes for O(1) lookups
   */
  private buildIndexes(): void {
    this.worldById.clear();
    this.worldByName.clear();
    this.dataCenterByName.clear();

    for (const world of this.worlds) {
      this.worldById.set(world.id, world);
      this.worldByName.set(world.name.toLowerCase(), world);
    }

    for (const dc of this.dataCenters) {
      this.dataCenterByName.set(dc.name.toLowerCase(), dc);
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ============================================================================
  // World Lookups
  // ============================================================================

  /**
   * Get world name by ID
   * @param worldId - Universalis world ID
   * @returns World name or undefined if not found
   */
  getWorldName(worldId: number | undefined): string | undefined {
    if (worldId === undefined) return undefined;
    return this.worldById.get(worldId)?.name;
  }

  /**
   * Get world by ID
   * @param worldId - Universalis world ID
   * @returns World object or undefined if not found
   */
  getWorldById(worldId: number): World | undefined {
    return this.worldById.get(worldId);
  }

  /**
   * Get world by name (case-insensitive)
   * @param name - World name (e.g., "Balmung")
   * @returns World object or undefined if not found
   */
  getWorldByName(name: string): World | undefined {
    return this.worldByName.get(name.toLowerCase());
  }

  /**
   * Get all worlds
   */
  getAllWorlds(): readonly World[] {
    return this.worlds;
  }

  // ============================================================================
  // Data Center Lookups
  // ============================================================================

  /**
   * Get data center by name (case-insensitive)
   * @param name - Data center name (e.g., "Crystal")
   * @returns DataCenter object or undefined if not found
   */
  getDataCenter(name: string): DataCenter | undefined {
    return this.dataCenterByName.get(name.toLowerCase());
  }

  /**
   * Get all data centers
   */
  getAllDataCenters(): readonly DataCenter[] {
    return this.dataCenters;
  }

  /**
   * Get all worlds in a data center
   * @param dcName - Data center name (e.g., "Crystal")
   * @returns Array of World objects in that DC
   */
  getWorldsInDataCenter(dcName: string): World[] {
    const dc = this.dataCenterByName.get(dcName.toLowerCase());
    if (!dc) return [];

    return dc.worlds
      .map((worldId) => this.worldById.get(worldId))
      .filter((w): w is World => w !== undefined);
  }

  /**
   * Find which data center a world belongs to
   * @param worldId - World ID
   * @returns DataCenter object or undefined if not found
   */
  getDataCenterForWorld(worldId: number): DataCenter | undefined {
    for (const dc of this.dataCenters) {
      if (dc.worlds.includes(worldId)) {
        return dc;
      }
    }
    return undefined;
  }

  /**
   * Check if a server name is a data center (vs a world)
   * @param name - Server name to check
   * @returns true if it's a data center name
   */
  isDataCenter(name: string): boolean {
    return this.dataCenterByName.has(name.toLowerCase());
  }

  /**
   * Check if a server name is a world
   * @param name - Server name to check
   * @returns true if it's a world name
   */
  isWorld(name: string): boolean {
    return this.worldByName.has(name.toLowerCase());
  }

  // ============================================================================
  // Reset (for testing)
  // ============================================================================

  /**
   * Reset service state (for testing)
   */
  reset(): void {
    this.worlds = [];
    this.dataCenters = [];
    this.worldById.clear();
    this.worldByName.clear();
    this.dataCenterByName.clear();
    this.initialized = false;
    this.initPromise = null;
  }
}

// Export singleton instance
export const WorldService = new WorldServiceClass();
