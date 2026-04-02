import { describe, it, expect } from 'vitest';
import app from '../../src/index.js';
import { createMockEnv } from '../test-utils.js';

const env = createMockEnv();

/** Helper to make GET requests to the app */
async function get(path: string) {
  return app.request(path, { method: 'GET' }, env);
}

/** Helper to parse JSON response */
async function getJson(path: string) {
  const res = await get(path);
  const body = await res.json();
  return { res, body };
}

describe('GET /v1/dyes', () => {
  it('returns paginated dye list', async () => {
    const { res, body } = await getJson('/v1/dyes');

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.perPage).toBe(50);
    expect(body.pagination.total).toBeGreaterThan(0);
    expect(body.meta.apiVersion).toBe('v1');
  });

  it('respects perPage and page params', async () => {
    const { body } = await getJson('/v1/dyes?perPage=10&page=2');

    expect(body.success).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(10);
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.perPage).toBe(10);
    expect(body.pagination.hasPrev).toBe(true);
  });

  it('filters by category', async () => {
    const { body } = await getJson('/v1/dyes?category=Red');

    expect(body.success).toBe(true);
    for (const dye of body.data) {
      expect(dye.category).toBe('Red');
    }
  });

  it('filters by metallic boolean', async () => {
    const { body } = await getJson('/v1/dyes?metallic=true&perPage=200');

    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    for (const dye of body.data) {
      expect(dye.isMetallic).toBe(true);
    }
  });

  it('sorts by brightness descending', async () => {
    const { body } = await getJson('/v1/dyes?sort=brightness&order=desc&perPage=200');

    expect(body.success).toBe(true);
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i - 1].hsv.v).toBeGreaterThanOrEqual(body.data[i].hsv.v);
    }
  });

  it('rejects invalid perPage', async () => {
    const { res, body } = await getJson('/v1/dyes?perPage=500');

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('includes Cache-Control header', async () => {
    const res = await get('/v1/dyes');
    expect(res.headers.get('Cache-Control')).toContain('max-age=3600');
  });
});

describe('GET /v1/dyes/:id', () => {
  it('looks up by itemID (5729+)', async () => {
    const { res, body } = await getJson('/v1/dyes/5729');

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.itemID).toBe(5729);
    expect(body.data.name).toBeDefined();
  });

  it('auto-detects stainID (1-125)', async () => {
    const { res, body } = await getJson('/v1/dyes/1');

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.stainID).toBe(1);
  });

  it('returns 404 for invalid range (126-5728)', async () => {
    const { res, body } = await getJson('/v1/dyes/200');

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe('NOT_FOUND');
  });

  it('returns 400 for non-numeric ID', async () => {
    const { res, body } = await getJson('/v1/dyes/abc');

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });
});

describe('GET /v1/dyes/stain/:stainId', () => {
  it('looks up by explicit stainID', async () => {
    const { res, body } = await getJson('/v1/dyes/stain/1');

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.stainID).toBe(1);
  });

  it('returns 400 for invalid stainID', async () => {
    const { res, body } = await getJson('/v1/dyes/stain/0');

    expect(res.status).toBe(400);
    expect(body.error).toBe('INVALID_STAIN_ID');
  });

  it('returns 404 for unknown stainID', async () => {
    const { res, body } = await getJson('/v1/dyes/stain/999');

    expect(res.status).toBe(404);
    expect(body.error).toBe('NOT_FOUND');
  });
});

describe('GET /v1/dyes/search', () => {
  it('finds dyes by name', async () => {
    const { res, body } = await getJson('/v1/dyes/search?q=snow');

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].name.toLowerCase()).toContain('snow');
  });

  it('returns 400 when q is missing', async () => {
    const { res, body } = await getJson('/v1/dyes/search');

    expect(res.status).toBe(400);
    expect(body.error).toBe('MISSING_PARAMETER');
  });

  it('returns empty array for no matches', async () => {
    const { body } = await getJson('/v1/dyes/search?q=zzzznonexistent');

    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });
});

describe('GET /v1/dyes/categories', () => {
  it('returns category list with counts', async () => {
    const { res, body } = await getJson('/v1/dyes/categories');

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    for (const cat of body.data) {
      expect(cat.name).toBeDefined();
      expect(cat.count).toBeGreaterThan(0);
    }
  });
});

describe('GET /v1/dyes/batch', () => {
  it('resolves mixed ID types', async () => {
    const { res, body } = await getJson('/v1/dyes/batch?ids=5729,1');

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.dyes.length).toBe(2);
  });

  it('reports not-found IDs', async () => {
    const { body } = await getJson('/v1/dyes/batch?ids=5729,999999');

    expect(body.success).toBe(true);
    expect(body.data.dyes.length).toBe(1);
    expect(body.data.notFound).toContain(999999);
  });

  it('supports idType=stain', async () => {
    const { body } = await getJson('/v1/dyes/batch?ids=1,2,3&idType=stain');

    expect(body.success).toBe(true);
    expect(body.data.dyes.length).toBe(3);
    for (const dye of body.data.dyes) {
      expect(dye.stainID).toBeGreaterThanOrEqual(1);
      expect(dye.stainID).toBeLessThanOrEqual(3);
    }
  });

  it('returns 400 when ids is missing', async () => {
    const { res, body } = await getJson('/v1/dyes/batch');

    expect(res.status).toBe(400);
    expect(body.error).toBe('MISSING_PARAMETER');
  });
});

describe('GET /v1/dyes/consolidation-groups', () => {
  it('returns consolidation group metadata', async () => {
    const { res, body } = await getJson('/v1/dyes/consolidation-groups');

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.groups).toHaveLength(3);
    expect(body.data.groups[0].type).toBe('A');
    expect(body.data.groups[1].type).toBe('B');
    expect(body.data.groups[2].type).toBe('C');
    expect(typeof body.data.consolidationActive).toBe('boolean');
    expect(body.data.unconsolidated).toBeDefined();
  });
});
