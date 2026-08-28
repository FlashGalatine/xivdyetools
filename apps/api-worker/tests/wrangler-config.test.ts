/**
 * wrangler.toml invariants that no source test can reach (the damage happens
 * at deploy time). Parsed with regexes — the file is small and the shapes are
 * simple (same approach as og-worker's tests/wrangler-env.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Normalise CRLF so `$` anchors line ends on a Windows checkout too.
const toml = readFileSync(join(__dirname, '..', 'wrangler.toml'), 'utf-8').replace(/\r\n/g, '\n');
// The table header at column 0 — the same string also appears in the BUG-008 comment up top.
const productionStart = toml.search(/^\[env\.production\]$/m);
const topLevel = toml.slice(0, productionStart);
const production = toml.slice(productionStart);

describe('wrangler.toml', () => {
  /**
   * FINDING-025 / API-5 / INF-12: the top-level env is the routeless dev
   * worker. Without routes, wrangler defaults `workers_dev` (and preview
   * URLs) ON, so a single `pnpm deploy` publishes a second copy of the
   * Universalis/XIVAPI relay on a public workers.dev hostname — with
   * ENVIRONMENT=development. Both must be off explicitly.
   */
  it('keeps the routeless dev worker off workers.dev and preview URLs', () => {
    expect(productionStart).toBeGreaterThan(-1);
    expect(topLevel).toMatch(/^workers_dev = false$/m);
    expect(topLevel).toMatch(/^preview_urls = false$/m);
  });

  it('keeps production on its custom domains only', () => {
    expect(production).toMatch(/^routes = \[/m);
    expect(production).toContain('data.xivdyetools.app');
    expect(production).not.toMatch(/^workers_dev = true$/m);
  });
});
