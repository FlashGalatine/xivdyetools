/**
 * XIV Dye Tools - Cloudflare Pages middleware contract
 *
 * `functions/_middleware.ts` runs in front of every Pages request. It is
 * deployed next to `dist/` by wrangler rather than bundled by Vite, so nothing
 * else in the suite ever loaded it.
 *
 * What it guards is not cosmetic. `public/_redirects` ends in the SPA catch-all
 * (`/* /index.html 200`) and `public/_headers` marks `/assets/*`
 * `max-age=31536000, immutable` — and Cloudflare Pages MERGES overlapping
 * patterns, so a request for a hashed asset the deployment does not have (a
 * pruned file, a client one deploy ahead, an alias still lagging) came back as
 * `index.html` with a 200 and that immutable rule attached. Browsers and the
 * edge then serve HTML as the script for a year. This project has already been
 * hit by exactly that shape (2026-08 cache-poisoning incident; 2026-08-29
 * security audit, FINDING-027).
 *
 * The test lives here rather than under `functions/` so it is picked up by the
 * suite's existing `src/**` vitest include, the knip entry list, and tsc's
 * `src` include — the last of which also puts `functions/_middleware.ts` into
 * the type-check program for the first time.
 *
 * @module __tests__/pages-middleware.test
 */

import { describe, it, expect, vi } from 'vitest';
import { onRequest } from '../../functions/_middleware';

const html = (body = '<!doctype html><title>XIV Dye Tools</title>'): Response =>
  new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

/** Run the middleware for `url`, with `next()` resolving to `downstream`. */
function run(url: string, downstream: Response) {
  const next = vi.fn(() => Promise.resolve(downstream));
  return { result: onRequest({ request: new Request(url), next }), next };
}

describe('functions/_middleware onRequest', () => {
  describe('/assets/* HTML fallback guard (FINDING-027)', () => {
    it('refuses the SPA fallback served under an /assets/ URL', async () => {
      const { result } = run('https://xivdyetools.app/assets/index-abc123.js', html());
      const response = await result;

      expect(response.status).toBe(404);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      const body = await response.text();
      expect(body).not.toContain('<!doctype html>');
      expect(body).toBe('Not found');
    });

    it('passes a real asset response through untouched', async () => {
      const downstream = new Response('export const a = 1;\n', {
        status: 200,
        headers: {
          'Content-Type': 'application/javascript',
          // The real value /assets/* carries in public/_headers, not a stand-in
          // — a middleware bug that only preserved part of the header would
          // still pass a fixture that just said 'immutable'.
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
      const { result } = run('https://xivdyetools.app/assets/index-abc123.js', downstream);
      const response = await result;

      // Same object => byte-identical status, body and headers by construction.
      expect(response).toBe(downstream);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/javascript');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
      expect(await response.text()).toBe('export const a = 1;\n');
    });

    it('passes an /assets/ response with no Content-Type through', async () => {
      // Only `text/html` is blocked: an unlabelled body is not the SPA shell,
      // and a guard that 404s on a missing header would break real assets.
      const downstream = new Response('binary', { status: 200 });
      downstream.headers.delete('Content-Type');
      const { result } = run('https://xivdyetools.app/assets/logo.woff2', downstream);

      expect(await result).toBe(downstream);
    });

    it('leaves HTML alone outside /assets/', async () => {
      // Every real route IS the catch-all HTML, and `_headers` deliberately
      // keeps /og/* and /fonts/* out from under the immutable rule (they are
      // not content-hashed) — so the guard is scoped to the one prefix that
      // carries `immutable`, not to "looks like a static file".
      for (const path of ['/harmony', '/og/social-card.png', '/fonts/Onest-Variable.woff2']) {
        const downstream = html();
        const { result } = run(`https://xivdyetools.app${path}`, downstream);
        const response = await result;

        expect(response, path).toBe(downstream);
        expect(response.status, path).toBe(200);
        expect(await response.text()).toContain('<!doctype html>');
      }
    });
  });

  describe('legacy domain redirect', () => {
    it('redirects before any asset handling and never calls next()', async () => {
      const { result, next } = run(
        'https://xivdyetools.projectgalatine.com/assets/index-abc123.js',
        html()
      );
      const response = await result;

      expect(response.status).toBe(301);
      expect(response.headers.get('Location')).toBe(
        'https://xivdyetools.app/assets/index-abc123.js'
      );
      expect(next).not.toHaveBeenCalled();
    });
  });
});
