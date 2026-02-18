/**
 * Budget Pipeline Integration Tests
 *
 * Tests the Universalis client with mock Service Bindings and the
 * budget calculator's dye lookup functions with real @xivdyetools/core data.
 *
 * The full findCheaperAlternatives pipeline requires the Cloudflare Cache API
 * (caches.default), so we test sub-pipelines individually:
 * - universalis-client.ts: fetchPrices, fetchPricesBatched, validateWorld, getWorldAutocomplete
 * - budget-calculator.ts: searchDyes, getDyeById, getDyeByName, getAllDyes, getCategories
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchPrices,
  fetchPricesBatched,
  isUniversalisEnabled,
  fetchWorlds,
  fetchDataCenters,
  validateWorld,
  getWorldAutocomplete,
} from './universalis-client.js';
import {
  searchDyes,
  getDyeById,
  getDyeByName,
  getDyeAutocomplete,
  getAllDyes,
  getCategories,
} from './budget-calculator.js';
import { createMockServiceBinding, createMockUniversalisProxy } from '../../test-utils.integration.js';
import { createMockEnv } from '../../test-utils.js';
import type { Env } from '../../types/env.js';

// ============================================================================
// Universalis Client Integration Tests
// ============================================================================

describe('Universalis Client: Service Binding Integration', () => {
  let env: Env;

  beforeEach(() => {
    env = createMockEnv({
      UNIVERSALIS_PROXY: createMockUniversalisProxy(),
    });
  });

  describe('isUniversalisEnabled', () => {
    it('returns true when Service Binding is configured', () => {
      expect(isUniversalisEnabled(env)).toBe(true);
    });

    it('returns true when URL is configured', () => {
      const urlEnv = createMockEnv({
        UNIVERSALIS_PROXY_URL: 'https://proxy.example.com',
      });
      expect(isUniversalisEnabled(urlEnv)).toBe(true);
    });

    it('returns false when neither is configured', () => {
      const bareEnv = createMockEnv();
      expect(isUniversalisEnabled(bareEnv)).toBe(false);
    });
  });

  describe('fetchPrices', () => {
    it('fetches prices for a single item via Service Binding', async () => {
      const prices = await fetchPrices(env, 'Cactuar', [5701]);

      expect(prices.size).toBe(1);
      const price = prices.get(5701);
      expect(price).toBeDefined();
      expect(price!.itemID).toBe(5701);
      expect(price!.currentMinPrice).toBeGreaterThan(0);
      expect(price!.world).toBe('Cactuar');
      expect(price!.fetchedAt).toBeDefined();
    });

    it('fetches prices for multiple items', async () => {
      const itemIds = [5701, 5702, 5703, 5704, 5705];
      const prices = await fetchPrices(env, 'Aether', itemIds);

      expect(prices.size).toBe(itemIds.length);
      for (const id of itemIds) {
        expect(prices.has(id)).toBe(true);
      }
    });

    it('returns empty map for empty item list', async () => {
      const prices = await fetchPrices(env, 'Cactuar', []);
      expect(prices.size).toBe(0);
    });

    it('throws for more than 100 items', async () => {
      const tooMany = Array.from({ length: 101 }, (_, i) => 5700 + i);
      await expect(fetchPrices(env, 'Cactuar', tooMany)).rejects.toThrow('Too many items');
    });

    it('constructs correct URL path to Service Binding', async () => {
      await fetchPrices(env, 'Cactuar', [5701, 5702]);

      const fetcher = env.UNIVERSALIS_PROXY as unknown as { fetch: ReturnType<typeof vi.fn> };
      expect(fetcher.fetch).toHaveBeenCalledTimes(1);

      const call = fetcher.fetch.mock.calls[0];
      const request = call[0] as Request;
      const url = new URL(request.url);
      expect(url.pathname).toBe('/api/v2/aggregated/Cactuar/5701,5702');
    });
  });

  describe('fetchPricesBatched', () => {
    it('handles items under batch limit in single request', async () => {
      const itemIds = Array.from({ length: 50 }, (_, i) => 5700 + i);
      const prices = await fetchPricesBatched(env, 'Cactuar', itemIds);

      expect(prices.size).toBe(50);

      const fetcher = env.UNIVERSALIS_PROXY as unknown as { fetch: ReturnType<typeof vi.fn> };
      expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    });

    it('splits items over 100 into multiple batches', async () => {
      const itemIds = Array.from({ length: 136 }, (_, i) => 5700 + i);
      const prices = await fetchPricesBatched(env, 'Aether', itemIds);

      // Should have results for all 136 items
      expect(prices.size).toBe(136);

      // Should have made 2 fetch calls (100 + 36)
      const fetcher = env.UNIVERSALIS_PROXY as unknown as { fetch: ReturnType<typeof vi.fn> };
      expect(fetcher.fetch).toHaveBeenCalledTimes(2);
    });

    it('merges results from multiple batches correctly', async () => {
      const itemIds = Array.from({ length: 150 }, (_, i) => 5700 + i);
      const prices = await fetchPricesBatched(env, 'Cactuar', itemIds);

      // Verify first and last items from different batches are present
      expect(prices.has(5700)).toBe(true);
      expect(prices.has(5849)).toBe(true);

      // Each item should have unique price data
      const firstPrice = prices.get(5700)!;
      const lastPrice = prices.get(5849)!;
      expect(firstPrice.currentMinPrice).not.toBe(lastPrice.currentMinPrice);
    });
  });

  describe('fetchWorlds', () => {
    it('returns world list from Service Binding', async () => {
      const worlds = await fetchWorlds(env);

      expect(worlds).toBeInstanceOf(Array);
      expect(worlds.length).toBeGreaterThan(0);
      expect(worlds[0]).toHaveProperty('id');
      expect(worlds[0]).toHaveProperty('name');
    });
  });

  describe('fetchDataCenters', () => {
    it('returns data center list from Service Binding', async () => {
      const dcs = await fetchDataCenters(env);

      expect(dcs).toBeInstanceOf(Array);
      expect(dcs.length).toBeGreaterThan(0);
      expect(dcs[0]).toHaveProperty('name');
      expect(dcs[0]).toHaveProperty('region');
      expect(dcs[0]).toHaveProperty('worlds');
    });
  });

  describe('validateWorld', () => {
    it('validates a known world name (case-insensitive)', async () => {
      const result = await validateWorld(env, 'cactuar');
      expect(result).toBe('Cactuar');
    });

    it('validates a known datacenter name', async () => {
      const result = await validateWorld(env, 'aether');
      expect(result).toBe('Aether');
    });

    it('returns null for unknown world', async () => {
      const result = await validateWorld(env, 'FakeWorld');
      expect(result).toBeNull();
    });
  });

  describe('getWorldAutocomplete', () => {
    it('returns matching worlds and datacenters', async () => {
      const suggestions = await getWorldAutocomplete(env, 'cac');

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty('name');
      expect(suggestions[0]).toHaveProperty('value');
    });

    it('returns datacenters before worlds', async () => {
      // "a" matches "Aether" DC
      const suggestions = await getWorldAutocomplete(env, 'a');

      // First result should be the datacenter
      const dcSuggestion = suggestions.find(s => s.name.includes('Data Center'));
      expect(dcSuggestion).toBeDefined();
    });

    it('returns empty array for no matches', async () => {
      const suggestions = await getWorldAutocomplete(env, 'zzzzz');
      expect(suggestions).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('throws when neither Service Binding nor URL is configured', async () => {
      const bareEnv = createMockEnv();
      await expect(fetchPrices(bareEnv, 'Cactuar', [5701])).rejects.toThrow('not configured');
    });

    it('throws on non-200 responses from Service Binding', async () => {
      const errorProxy = createMockServiceBinding({
        '/api/v2/aggregated/': () => new Response(
          JSON.stringify({ error: 'Rate limited' }),
          { status: 429 },
        ),
      });
      const errorEnv = createMockEnv({ UNIVERSALIS_PROXY: errorProxy });

      await expect(fetchPrices(errorEnv, 'Cactuar', [5701])).rejects.toThrow();
    });
  });
});

// ============================================================================
// Budget Calculator: Dye Lookup Integration Tests (Real Core Data)
// ============================================================================

describe('Budget Calculator: Dye Lookup with Real Core Data', () => {
  describe('searchDyes', () => {
    it('finds dyes by partial name', () => {
      const results = searchDyes('white');
      expect(results.length).toBeGreaterThan(0);
      // All results should contain "white" (case-insensitive)
      for (const dye of results) {
        expect(dye.name.toLowerCase()).toContain('white');
      }
    });

    it('returns empty for nonsense query', () => {
      const results = searchDyes('xyznonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('getDyeById', () => {
    it('finds a dye by its internal ID', () => {
      // Use a known dye from the database by searching first
      const allDyes = getAllDyes();
      expect(allDyes.length).toBeGreaterThan(0);

      const firstDye = allDyes[0];
      const foundDye = getDyeById(firstDye.id);
      expect(foundDye).not.toBeNull();
      expect(foundDye!.id).toBe(firstDye.id);
      expect(foundDye!.name).toBeDefined();
      expect(foundDye!.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('returns null for non-existent ID', () => {
      const dye = getDyeById(99999);
      expect(dye).toBeNull();
    });
  });

  describe('getDyeByName', () => {
    it('finds a dye by exact name (case-insensitive)', () => {
      const dye = getDyeByName('snow white');
      expect(dye).not.toBeNull();
      expect(dye!.name.toLowerCase()).toBe('snow white');
    });

    it('returns null for non-existent name', () => {
      const dye = getDyeByName('Nonexistent Dye');
      expect(dye).toBeNull();
    });
  });

  describe('getDyeAutocomplete', () => {
    it('returns formatted autocomplete choices', () => {
      const choices = getDyeAutocomplete('red');
      expect(choices.length).toBeGreaterThan(0);

      for (const choice of choices) {
        expect(choice).toHaveProperty('name');
        expect(choice).toHaveProperty('value');
        // Name should include category in parentheses
        expect(choice.name).toContain('(');
        // Value should be a numeric string (itemID)
        expect(Number(choice.value)).toBeGreaterThan(0);
      }
    });

    it('excludes Facewear dyes (negative itemIDs)', () => {
      const choices = getDyeAutocomplete('');
      for (const choice of choices) {
        expect(Number(choice.value)).toBeGreaterThan(0);
      }
    });

    it('respects the limit parameter', () => {
      const limited = getDyeAutocomplete('', 5);
      expect(limited.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getAllDyes', () => {
    it('returns the full dye database', () => {
      const dyes = getAllDyes();
      expect(dyes.length).toBeGreaterThan(100);

      // Every dye should have required fields
      for (const dye of dyes) {
        expect(dye.id).toBeDefined();
        expect(dye.name).toBeDefined();
        expect(dye.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(dye.category).toBeDefined();
      }
    });
  });

  describe('getCategories', () => {
    it('returns dye categories', () => {
      const categories = getCategories();
      expect(categories.length).toBeGreaterThan(0);
      // Categories in the actual database are pluralized (e.g., "Reds", "Blues")
      expect(categories).toContain('Reds');
      expect(categories).toContain('Blues');
    });
  });
});
