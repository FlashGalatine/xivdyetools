/**
 * HybridPresetService — what one getPresets() call tells its caller.
 *
 * 2026-10-04 deep-dive BUG-029: preset-tool's tombstone reconciliation reads
 * "absent from the fetched pool" as "deleted by its author". Two things in this
 * service made that reading wrong without any failure showing:
 *
 * - a failed community leg was logged and swallowed, so a transient 5xx came
 *   back as a curated-only list — indistinguishable from "no community presets
 *   exist" — and every saved community preset was tombstoned;
 * - the merged curated + community list is sorted and cut to `limit`, so API
 *   rows dropped for space looked deleted too.
 *
 * Uses the msw handlers for the presets API (`__tests__/mocks/handlers.ts`).
 *
 * @module services/__tests__/hybrid-preset-service.test
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../__tests__/mocks/server';
import { mockPresets } from '../../__tests__/mocks/handlers';

vi.mock('../auth-service', () => ({
  authService: {
    isAuthenticated: vi.fn(() => false),
    getAuthHeaders: vi.fn(() => ({})),
  },
}));

import { hybridPresetService } from '../hybrid-preset-service';
import { communityPresetService } from '../community-preset-service';

const API_URL = 'https://api.xivdyetools.app';

describe('HybridPresetService.getPresets (BUG-029)', () => {
  beforeAll(async () => {
    // The default /health handler answers OK, so the community leg is live.
    await hybridPresetService.initialize();
  });

  beforeEach(() => {
    // A cached success from an earlier case would hide the failure below.
    communityPresetService.clearCache();
  });

  it('reports a community leg that answered, with the ids it returned', async () => {
    const result = await hybridPresetService.getPresets({ sort: 'popular', limit: 50 });

    expect(result.apiOk).toBe(true);
    expect(result.apiIds).toEqual(mockPresets.map((p) => `community-${p.id}`));
  });

  it('reports a failed community leg instead of passing off the curated list as the pool', async () => {
    server.use(
      http.get(`${API_URL}/api/v1/presets`, () =>
        HttpResponse.json({ message: 'Internal error' }, { status: 500 })
      )
    );

    const result = await hybridPresetService.getPresets({ sort: 'popular', limit: 50 });

    expect(result.apiOk).toBe(false);
    expect(result.apiIds).toEqual([]);
    // The curated half is still served — the Official tab must survive this.
    expect(result.presets.length).toBeGreaterThan(0);
    expect(result.presets.every((p) => p.isCurated && !p.isFromAPI)).toBe(true);
  });

  it('counts the community rows before the merged list is cut to the limit', async () => {
    // The API leg answers both rows (limit 2), but 'name' sort puts two
    // curated palettes ("All Saints' Wake", "Autumn") ahead of "Dark Knight",
    // so the cut to 2 drops both API rows from the displayed list.
    const result = await hybridPresetService.getPresets({ sort: 'name', limit: 2 });

    expect(result.presets).toHaveLength(2);
    expect(result.presets.some((p) => p.isFromAPI)).toBe(false);
    expect(result.apiIds).toEqual(mockPresets.map((p) => `community-${p.id}`));
  });
});
