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
});
