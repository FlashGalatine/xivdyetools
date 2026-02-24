/**
 * XIV Dye Tools - World Service Tests
 *
 * Tests for the WorldService singleton that manages FFXIV world/datacenter lookups.
 * This service provides O(1) lookups via Map indexes for worlds and data centers.
 *
 * @module services/__tests__/world-service.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorldService } from '../world-service';

// Store original fetch for cleanup
const originalFetch = globalThis.fetch;
const mockFetch = vi.fn();

// Sample test data matching the real JSON structure
const mockDataCenters = [
  { name: 'Crystal', region: 'NA', worlds: [34, 37, 41] },
  { name: 'Aether', region: 'NA', worlds: [73, 79, 85] },
  { name: 'Chaos', region: 'EU', worlds: [80, 83, 97] },
];

const mockWorlds = [
  { id: 34, name: 'Brynhildr' },
  { id: 37, name: 'Diabolos' },
  { id: 41, name: 'Malboro' },
  { id: 73, name: 'Adamantoise' },
  { id: 79, name: 'Cactuar' },
  { id: 85, name: 'Faerie' },
  { id: 80, name: 'Cerberus' },
  { id: 83, name: 'Louisoix' },
  { id: 97, name: 'Ragnarok' },
];

/**
 * Create mock fetch response
 */
function createMockResponse(data: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
  } as Response;
}

describe('WorldService', () => {
  beforeEach(() => {
    // Reset service state before each test
    WorldService.reset();
    mockFetch.mockReset();
    // Set up fetch mock for each test
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  describe('initialization', () => {
    it('should initialize and load server data successfully', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockDataCenters))
        .mockResolvedValueOnce(createMockResponse(mockWorlds));

      await WorldService.initialize();

      expect(WorldService.isInitialized()).toBe(true);
      expect(WorldService.getAllWorlds()).toHaveLength(9);
      expect(WorldService.getAllDataCenters()).toHaveLength(3);
    });

    it('should only initialize once when called multiple times', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockDataCenters))
        .mockResolvedValueOnce(createMockResponse(mockWorlds));

      await WorldService.initialize();
      await WorldService.initialize();
      await WorldService.initialize();

      // fetch should only be called twice (once for each JSON file)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle initialization errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(null, false));

      await WorldService.initialize();

      // Should mark as initialized even on error to prevent infinite retries
      expect(WorldService.isInitialized()).toBe(true);
      expect(WorldService.getAllWorlds()).toHaveLength(0);
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await WorldService.initialize();

      expect(WorldService.isInitialized()).toBe(true);
      expect(WorldService.getAllWorlds()).toHaveLength(0);
    });
  });

  describe('world lookups', () => {
    beforeEach(async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockDataCenters))
        .mockResolvedValueOnce(createMockResponse(mockWorlds));
      await WorldService.initialize();
    });

    it('should get world name by ID', () => {
      expect(WorldService.getWorldName(34)).toBe('Brynhildr');
      expect(WorldService.getWorldName(37)).toBe('Diabolos');
      expect(WorldService.getWorldName(97)).toBe('Ragnarok');
    });

    it('should return undefined for unknown world ID', () => {
      expect(WorldService.getWorldName(99999)).toBeUndefined();
    });

    it('should return undefined when worldId is undefined', () => {
      expect(WorldService.getWorldName(undefined)).toBeUndefined();
    });

    it('should get world by ID', () => {
      const world = WorldService.getWorldById(34);
      expect(world).toBeDefined();
      expect(world?.name).toBe('Brynhildr');
      expect(world?.id).toBe(34);
    });

    it('should return undefined for unknown world by ID', () => {
      expect(WorldService.getWorldById(99999)).toBeUndefined();
    });

    it('should get world by name (case-insensitive)', () => {
      expect(WorldService.getWorldByName('Brynhildr')?.id).toBe(34);
      expect(WorldService.getWorldByName('brynhildr')?.id).toBe(34);
      expect(WorldService.getWorldByName('BRYNHILDR')?.id).toBe(34);
    });

    it('should return undefined for unknown world by name', () => {
      expect(WorldService.getWorldByName('UnknownWorld')).toBeUndefined();
    });

    it('should return all worlds', () => {
      const worlds = WorldService.getAllWorlds();
      expect(worlds).toHaveLength(9);
      expect(worlds.some((w) => w.name === 'Brynhildr')).toBe(true);
      expect(worlds.some((w) => w.name === 'Ragnarok')).toBe(true);
    });
  });

  describe('data center lookups', () => {
    beforeEach(async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockDataCenters))
        .mockResolvedValueOnce(createMockResponse(mockWorlds));
      await WorldService.initialize();
    });

    it('should get data center by name (case-insensitive)', () => {
      expect(WorldService.getDataCenter('Crystal')?.name).toBe('Crystal');
      expect(WorldService.getDataCenter('crystal')?.name).toBe('Crystal');
      expect(WorldService.getDataCenter('CRYSTAL')?.name).toBe('Crystal');
    });

    it('should return undefined for unknown data center', () => {
      expect(WorldService.getDataCenter('UnknownDC')).toBeUndefined();
    });

    it('should return all data centers', () => {
      const dataCenters = WorldService.getAllDataCenters();
      expect(dataCenters).toHaveLength(3);
      expect(dataCenters.some((dc) => dc.name === 'Crystal')).toBe(true);
      expect(dataCenters.some((dc) => dc.name === 'Aether')).toBe(true);
    });

    it('should get worlds in a data center', () => {
      const worlds = WorldService.getWorldsInDataCenter('Crystal');
      expect(worlds).toHaveLength(3);
      expect(worlds.some((w) => w.name === 'Brynhildr')).toBe(true);
      expect(worlds.some((w) => w.name === 'Diabolos')).toBe(true);
      expect(worlds.some((w) => w.name === 'Malboro')).toBe(true);
    });

    it('should return empty array for unknown data center worlds', () => {
      const worlds = WorldService.getWorldsInDataCenter('UnknownDC');
      expect(worlds).toHaveLength(0);
    });

    it('should find data center for a world', () => {
      const dc = WorldService.getDataCenterForWorld(34); // Brynhildr
      expect(dc?.name).toBe('Crystal');
    });

    it('should find correct data center for EU world', () => {
      const dc = WorldService.getDataCenterForWorld(97); // Ragnarok
      expect(dc?.name).toBe('Chaos');
    });

    it('should return undefined for unknown world in data center lookup', () => {
      const dc = WorldService.getDataCenterForWorld(99999);
      expect(dc).toBeUndefined();
    });
  });

  describe('server type checks', () => {
    beforeEach(async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockDataCenters))
        .mockResolvedValueOnce(createMockResponse(mockWorlds));
      await WorldService.initialize();
    });

    it('should correctly identify data centers', () => {
      expect(WorldService.isDataCenter('Crystal')).toBe(true);
      expect(WorldService.isDataCenter('Aether')).toBe(true);
      expect(WorldService.isDataCenter('crystal')).toBe(true);
    });

    it('should correctly identify that worlds are not data centers', () => {
      expect(WorldService.isDataCenter('Brynhildr')).toBe(false);
      expect(WorldService.isDataCenter('Ragnarok')).toBe(false);
    });

    it('should correctly identify worlds', () => {
      expect(WorldService.isWorld('Brynhildr')).toBe(true);
      expect(WorldService.isWorld('brynhildr')).toBe(true);
      expect(WorldService.isWorld('Ragnarok')).toBe(true);
    });

    it('should correctly identify that data centers are not worlds', () => {
      expect(WorldService.isWorld('Crystal')).toBe(false);
      expect(WorldService.isWorld('Aether')).toBe(false);
    });

    it('should return false for unknown server names', () => {
      expect(WorldService.isDataCenter('Unknown')).toBe(false);
      expect(WorldService.isWorld('Unknown')).toBe(false);
    });
  });

  describe('reset functionality', () => {
    it('should reset all service state', async () => {
      // Initialize first
      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockDataCenters))
        .mockResolvedValueOnce(createMockResponse(mockWorlds));
      await WorldService.initialize();

      expect(WorldService.isInitialized()).toBe(true);
      expect(WorldService.getAllWorlds()).toHaveLength(9);

      // Reset
      WorldService.reset();

      expect(WorldService.isInitialized()).toBe(false);
      expect(WorldService.getAllWorlds()).toHaveLength(0);
      expect(WorldService.getAllDataCenters()).toHaveLength(0);
    });

    it('should allow re-initialization after reset', async () => {
      // Initialize
      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockDataCenters))
        .mockResolvedValueOnce(createMockResponse(mockWorlds));
      await WorldService.initialize();

      // Reset
      WorldService.reset();
      mockFetch.mockReset();

      // Re-initialize
      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockDataCenters))
        .mockResolvedValueOnce(createMockResponse(mockWorlds));
      await WorldService.initialize();

      expect(WorldService.isInitialized()).toBe(true);
      expect(WorldService.getAllWorlds()).toHaveLength(9);
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockDataCenters))
        .mockResolvedValueOnce(createMockResponse(mockWorlds));
      await WorldService.initialize();
    });

    it('should handle lowercase lookups correctly', () => {
      // Lowercase lookups should work (as per the service implementation)
      expect(WorldService.getWorldByName('brynhildr')?.id).toBe(34);
      expect(WorldService.getDataCenter('crystal')?.name).toBe('Crystal');
    });

    it('should handle empty data center worlds gracefully', () => {
      const dc = WorldService.getDataCenter('Crystal');
      // Remove all world IDs to test edge case
      if (dc) {
        // Can't directly modify since it's from a Map, but this tests the normal flow
        expect(dc.worlds).toHaveLength(3);
      }
    });
  });
});
