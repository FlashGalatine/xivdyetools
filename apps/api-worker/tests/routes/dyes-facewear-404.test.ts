/**
 * BUG-037: `routes/dyes.ts`'s negative-id branch (`resolveIdType` → 'facewear')
 * resolves through core's `getFacewearColorByLegacyItemID()` and answers a
 * documented 404 — this was covered only at the helper level, never over
 * HTTP. `-1629` is a real row of core's frozen `LEGACY_FACEWEAR_ITEM_IDS` map
 * (`packages/core/src/config/facewear.ts`) → slug `silver` → the matching
 * `facewearColors` entry `{ name: "Silver", hex: "#c0c0c0" }`
 * (`packages/core/src/data/facewear_colors.json`). `-1` is a syntactically
 * valid negative id (it passes `CANONICAL_DYE_ID`, `/^-?[1-9]\d{0,9}$/`) that
 * is not a key in that map at all.
 *
 * `facewearId` and `hex` below are copied from those two core source files
 * literally, not read from them at runtime, per the task brief.
 *
 * This is a separate file — not an addition to `tests/routes/dyes.test.ts` —
 * because that file's module-scope `app` shares one rate-limit bucket across
 * every request it makes (the limiter backend is memoized once per module
 * load, and `getClientIp` reads a constant 'unknown' with no
 * `CF-Connecting-IP` header in tests), and that file is already close to its
 * 65-request budget (see the note above its own `getFresh` helper). A
 * separate test file gets its own fresh import of `src/index.js` and
 * therefore its own fresh limiter closure / budget.
 */
import { describe, it, expect } from 'vitest';
import app from '../../src/index.js';
import { createMockEnv } from '../test-utils.js';

async function get(path: string) {
  return app.request(path, { method: 'GET' }, createMockEnv());
}

describe('GET /v1/dyes/:id — legacy Facewear negative-id 404 (BUG-037)', () => {
  it('explains a negative id that IS a legacy Facewear synthetic id', async () => {
    const res = await get('/v1/dyes/-1629');
    const body = (await res.json()) as any;

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe('NOT_FOUND');
    expect(body.message).toBe(
      'ID -1629 was the legacy synthetic ID for the Facewear color "Silver". Facewear colors are no longer served as dyes.'
    );
    expect(body.details).toEqual({ facewearId: 'silver', hex: '#c0c0c0' });
  });

  it('answers a bare 404 (no details) for a negative id NOT in the legacy map', async () => {
    const res = await get('/v1/dyes/-1');
    const body = (await res.json()) as any;

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe('NOT_FOUND');
    expect(body.message).toBe(
      'Negative IDs (legacy Facewear synthetic IDs) are no longer served as dyes.'
    );
    expect(body.details).toBeUndefined();
  });
});
