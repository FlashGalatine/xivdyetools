/**
 * XIV Dye Tools - wrangler.toml environment invariants
 *
 * These assert properties of the deployment config that no source test can
 * reach, because the damage they prevent happens at request time on a real
 * hostname. Parsed with regexes rather than a TOML library: the file is small,
 * the shapes asserted are simple, and adding a dependency to test config would
 * be a poor trade.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const toml = readFileSync(join(__dirname, '..', 'wrangler.toml'), 'utf-8');

/**
 * Split the file into its `[vars]` (beta/top-level) and `[env.production.vars]`
 * sections. A section runs until the next table header at column 0.
 */
function varsBlock(header: string): string {
  const start = toml.indexOf(`${header}\n`);
  expect(start, `${header} not found in wrangler.toml`).toBeGreaterThan(-1);
  const rest = toml.slice(start + header.length + 1);
  const end = rest.search(/^\[/m);
  return end === -1 ? rest : rest.slice(0, end);
}

function readVar(block: string, key: string): string {
  const match = new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, 'm').exec(block);
  expect(match, `${key} not found`).not.toBeNull();
  return match![1];
}

const ENVIRONMENTS = [
  { label: 'beta (top-level)', header: '[vars]' },
  { label: 'production', header: '[env.production.vars]' },
];

describe('wrangler.toml environments', () => {
  describe.each(ENVIRONMENTS)('$label', ({ header }) => {
    const block = varsBlock(header);

    /**
     * The load-bearing one. `isOgImageHost()` decides "is this request for our
     * own image host?" by comparing the request hostname to
     * OG_IMAGE_BASE_URL's, and a match makes it redirect humans to
     * APP_BASE_URL rather than passing them through to the SPA. If the two
     * vars ever name the same host, every tool page on that environment
     * bounces real visitors away instead of rendering the app.
     */
    it('serves images from a different hostname than the app', () => {
      const app = new URL(readVar(block, 'APP_BASE_URL'));
      const image = new URL(readVar(block, 'OG_IMAGE_BASE_URL'));
      expect(image.hostname).not.toBe(app.hostname);
    });

    /**
     * v2.0.0 fixed an omission where every emitted og:image URL was missing
     * the /og/ prefix the image routes actually register under, so no
     * generated card had ever been fetched. The var is the only thing holding
     * that prefix — the URL builders in og-data-generator.ts append tool paths
     * to it directly.
     */
    it('carries the /og route prefix on the image base URL', () => {
      expect(readVar(block, 'OG_IMAGE_BASE_URL')).toMatch(/\/og$/);
    });
  });

  it('keeps beta and production on separate origins', () => {
    const beta = readVar(varsBlock('[vars]'), 'APP_BASE_URL');
    const production = readVar(varsBlock('[env.production.vars]'), 'APP_BASE_URL');
    expect(beta).not.toBe(production);
  });

  it('keeps beta and production analytics in separate datasets', () => {
    const datasets = [...toml.matchAll(/^dataset\s*=\s*"([^"]+)"/gm)].map((m) => m[1]);
    expect(datasets.length).toBe(2);
    expect(new Set(datasets).size).toBe(2);
  });

  /**
   * `routes` is an inheritable key. Production declares its own, so the beta
   * routes above cannot reach it — but only for as long as that declaration
   * exists. Deleting it would silently hand production the beta route list.
   */
  it('declares routes in both environments so neither inherits the other', () => {
    expect(toml).toMatch(/^routes = \[/m);
    expect(toml).toMatch(/^\[env\.production\][\s\S]*?^routes = \[/m);
  });

  it('never points a production route at a beta hostname', () => {
    const productionBlock = toml.slice(toml.indexOf('[env.production]'));
    const productionRoutes = productionBlock.slice(0, productionBlock.indexOf(']'));
    expect(productionRoutes).not.toContain('beta.');
  });

  /**
   * FINDING-024 / OG-5 (2026-08-21 security audit): the beta env already has
   * its zone routes and the og-beta custom domain; a workers.dev hostname on
   * top was a third, unauthenticated copy of the render surface on which the
   * human pass-through self-fetched (CF error 1042). Both environments
   * declare the flag explicitly (it is inheritable) and both keep it off.
   */
  it('keeps every environment off workers.dev', () => {
    const flags = [...toml.matchAll(/^workers_dev\s*=\s*(true|false)/gm)].map((m) => m[1]);
    expect(flags).toHaveLength(2);
    expect(flags).toEqual(['false', 'false']);
  });
});
