import { describe, it, expect } from 'vitest';
import app from '../../src/index.js';
import { createMockEnv } from '../test-utils.js';
import { VENDOR_ACQUISITIONS, CRAFT_ACQUISITIONS, ALLIED_SOCIETY_ACQUISITIONS, EXPENSIVE_DYE_IDS } from '@xivdyetools/core';

const env = createMockEnv();

async function get(path: string) {
  return app.request(path, { method: 'GET' }, env);
}

async function getJson(path: string) {
  const res = await get(path);
  const body = await res.json() as any;
  return { res, body };
}

describe('GET /v1/match/closest', () => {
  it('finds closest dye to a red hex', async () => {
    const { res, body } = await getJson('/v1/match/closest?hex=FF0000');

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.dye).toBeDefined();
    expect(body.data.distance).toBeDefined();
    expect(typeof body.data.distance).toBe('number');
    expect(body.data.method).toBe('oklab');
    expect(body.data.inputHex).toBe('#FF0000');
  });

  it('accepts hex with hash prefix', async () => {
    const { res, body } = await getJson('/v1/match/closest?hex=%23FF0000');

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('supports different matching methods', async () => {
    const { body } = await getJson('/v1/match/closest?hex=FF0000&method=ciede2000');

    expect(body.success).toBe(true);
    expect(body.data.method).toBe('ciede2000');
  });

  it('supports oklch-weighted with custom weights', async () => {
    const { body } = await getJson('/v1/match/closest?hex=FF0000&method=oklch-weighted&kL=2&kC=1&kH=0.5');

    expect(body.success).toBe(true);
    expect(body.data.method).toBe('oklch-weighted');
  });

  it('returns 400 for missing hex', async () => {
    const { res, body } = await getJson('/v1/match/closest');

    expect(res.status).toBe(400);
    expect(body.error).toBe('MISSING_PARAMETER');
  });

  it('returns 400 for invalid hex', async () => {
    const { res, body } = await getJson('/v1/match/closest?hex=not-a-color');

    expect(res.status).toBe(400);
    expect(body.error).toBe('INVALID_HEX');
  });

  it('returns 400 for invalid method', async () => {
    const { res, body } = await getJson('/v1/match/closest?hex=FF0000&method=invalid');

    expect(res.status).toBe(400);
    expect(body.error).toBe('INVALID_MATCHING_METHOD');
  });

  it('includes Cache-Control header', async () => {
    const res = await get('/v1/match/closest?hex=FF0000');
    expect(res.headers.get('Cache-Control')).toContain('max-age=3600');
  });
});

describe('GET /v1/match/within-distance', () => {
  it('finds dyes within distance', async () => {
    const { res, body } = await getJson('/v1/match/within-distance?hex=FF0000&maxDistance=50');

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.results)).toBe(true);
    expect(body.data.inputHex).toBe('#FF0000');
    expect(body.data.maxDistance).toBe(50);
    expect(body.data.method).toBe('oklab');
    expect(typeof body.data.resultCount).toBe('number');
  });

  it('results are sorted by distance ascending', async () => {
    const { body } = await getJson('/v1/match/within-distance?hex=FF0000&maxDistance=100');

    if (body.data.results.length > 1) {
      for (let i = 1; i < body.data.results.length; i++) {
        expect(body.data.results[i - 1].distance).toBeLessThanOrEqual(body.data.results[i].distance);
      }
    }
  });

  it('respects limit parameter', async () => {
    const { body } = await getJson('/v1/match/within-distance?hex=FF0000&maxDistance=500&limit=5');

    expect(body.success).toBe(true);
    expect(body.data.results.length).toBeLessThanOrEqual(5);
  });

  it('returns 400 for missing hex', async () => {
    const { res, body } = await getJson('/v1/match/within-distance?maxDistance=30');

    expect(res.status).toBe(400);
    expect(body.error).toBe('MISSING_PARAMETER');
  });

  it('returns 400 for missing maxDistance', async () => {
    const { res, body } = await getJson('/v1/match/within-distance?hex=FF0000');

    expect(res.status).toBe(400);
    expect(body.error).toBe('MISSING_PARAMETER');
  });

  it('returns empty results for very small distance', async () => {
    const { body } = await getJson('/v1/match/within-distance?hex=123456&maxDistance=0.01');

    expect(body.success).toBe(true);
    expect(body.data.results.length).toBe(0);
  });
});

describe('Match route dye filters', () => {
  it('/closest excludes metallic dyes when metallic=false', async () => {
    const { body } = await getJson('/v1/match/closest?hex=CCCCCC&metallic=false');

    expect(body.success).toBe(true);
    expect(body.data.dye.isMetallic).toBe(false);
  });

  it('/closest returns only metallic when metallic=true', async () => {
    const { body } = await getJson('/v1/match/closest?hex=CCCCCC&metallic=true');

    expect(body.success).toBe(true);
    expect(body.data.dye.isMetallic).toBe(true);
  });

  it('/closest excludes vendor dyes when vendor=false', async () => {
    const { body } = await getJson('/v1/match/closest?hex=FF0000&vendor=false');

    expect(body.success).toBe(true);
    expect(VENDOR_ACQUISITIONS).not.toContain(body.data.dye.acquisition);
  });

  it('/within-distance excludes metallic dyes', async () => {
    const { body } = await getJson('/v1/match/within-distance?hex=CCCCCC&maxDistance=500&metallic=false&limit=136');

    expect(body.success).toBe(true);
    for (const result of body.data.results) {
      expect(result.dye.isMetallic).toBe(false);
    }
  });

  it('/within-distance filters by acquisition', async () => {
    const { body } = await getJson('/v1/match/within-distance?hex=FF0000&maxDistance=500&vendor=true&limit=136');

    expect(body.success).toBe(true);
    expect(body.data.results.length).toBeGreaterThan(0);
    for (const result of body.data.results) {
      expect(VENDOR_ACQUISITIONS).toContain(result.dye.acquisition);
    }
  });

  it('/within-distance excludes expensive dyes', async () => {
    const { body } = await getJson('/v1/match/within-distance?hex=FFFFFF&maxDistance=500&expensive=false&limit=136');

    expect(body.success).toBe(true);
    for (const result of body.data.results) {
      expect(EXPENSIVE_DYE_IDS).not.toContain(result.dye.itemID);
    }
  });

  it('no filters returns normal results', async () => {
    const { body } = await getJson('/v1/match/closest?hex=FF0000');

    expect(body.success).toBe(true);
    expect(body.data.dye).toBeDefined();
  });
});
