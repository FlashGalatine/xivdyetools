/**
 * BUG-038: every route that reads a numeric query parameter through
 * parseIntParam / parseFloatParam answers a malformed spelling with the same
 * 400 VALIDATION_ERROR it already used for `abc`, instead of silently serving
 * the numeric prefix (`limit=1e2` -> 1 result, `page=2abc` -> page 2).
 */
import { describe, it, expect } from 'vitest';
import app from '../../src/index.js';
import { createMockEnv } from '../test-utils.js';

const env = createMockEnv();

const cases: Array<[route: string, param: string, bad: string, goodUrl: string]> = [
  ['/v1/match/within-distance', 'limit', '1e2', '/v1/match/within-distance?hex=FF0000&maxDistance=30&limit=5'],
  ['/v1/match/within-distance', 'maxDistance', '10px', '/v1/match/within-distance?hex=FF0000&maxDistance=30'],
  ['/v1/dyes', 'page', '2abc', '/v1/dyes?page=2'],
  ['/v1/dyes', 'perPage', '10.5', '/v1/dyes?perPage=10'],
  ['/v1/dyes', 'minPrice', '1e3', '/v1/dyes?minPrice=100'],
  ['/v1/dyes', 'maxPrice', '0x10', '/v1/dyes?maxPrice=100'],
  ['/v1/harmony', 'companions', '1e0', '/v1/harmony?dye=1&type=triadic&companions=1'],
  ['/v1/wheels/rgb', 'stops', '12abc', '/v1/wheels/rgb?stops=12'],
];

describe('malformed numeric query parameters (BUG-038)', () => {
  it.each(cases)('%s?%s=%s -> 400 VALIDATION_ERROR', async (route, param, bad, goodUrl) => {
    const sep = route === '/v1/match/within-distance' ? '&hex=FF0000&maxDistance=30' : '';
    const extra = route === '/v1/harmony' ? '&dye=1&type=triadic' : '';
    const url =
      route === '/v1/match/within-distance' && param === 'maxDistance'
        ? `${route}?hex=FF0000&maxDistance=${bad}`
        : `${route}?${param}=${encodeURIComponent(bad)}${sep}${extra}`;
    const res = await app.request(url, { method: 'GET' }, env);
    const body = (await res.json()) as { error: string; details?: { parameter?: string } };
    expect(res.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.details?.parameter).toBe(param);

    // The canonical spelling of the same parameter still works.
    const ok = await app.request(goodUrl, { method: 'GET' }, env);
    expect(ok.status).toBe(200);
  });
});
