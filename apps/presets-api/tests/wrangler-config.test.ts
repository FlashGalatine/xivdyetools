/**
 * wrangler.toml invariants that no source test can reach (the damage happens
 * at deploy time). Parsed with regexes — the file is small and the shapes are
 * simple (same approach as apps/api-worker/tests/wrangler-config.test.ts).
 *
 * FINDING-023 (2026-08-29 security audit): presets-api had no config-drift
 * guard at all — a bare `pnpm deploy` publishing the wrong env, `workers_dev`
 * flipping on, or a KV binding drifting from the oauth namespace it must
 * match (FINDING-013's fail-closed validateEnv only catches a *missing*
 * binding, not one silently pointed at the wrong namespace).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Normalise CRLF so `$` anchors line ends on a Windows checkout too.
const toml = readFileSync(join(__dirname, '..', 'wrangler.toml'), 'utf-8').replace(/\r\n/g, '\n');
// The table header at column 0.
const productionStart = toml.search(/^\[env\.production\]$/m);
const topLevel = toml.slice(0, productionStart);
const production = toml.slice(productionStart);

// oauth's wrangler.toml inverts the convention (its TOP LEVEL is production —
// see apps/oauth/CLAUDE.md) and its file interleaves top-level tables with
// `[env.development.*]` ones physically (a `[[kv_namespaces]]` block sits
// AFTER the `[env.development]` header but is still top-level — TOML table
// headers are always fully-qualified from the document root, not nested by
// physical position). Slicing this file the way we slice our own would
// silently misattribute that block, so every assertion below matches an
// exact, anchored header instead of relying on a slice boundary.
const oauthToml = readFileSync(join(__dirname, '..', '..', 'oauth', 'wrangler.toml'), 'utf-8').replace(
  /\r\n/g,
  '\n'
);

describe('wrangler.toml', () => {
  it('keeps the top-level worker a routeless dev worker', () => {
    expect(productionStart).toBeGreaterThan(-1);
    const name = topLevel.match(/^name = "([^"]+)"$/m)?.[1];
    expect(name).toMatch(/-dev$/);
    expect(topLevel).toMatch(/^workers_dev = false$/m);
    expect(topLevel).not.toMatch(/^routes = \[/m);
  });

  it('routes production to xivdyetools-presets-api on its custom domain', () => {
    expect(production).toMatch(/^name = "xivdyetools-presets-api"$/m);
    expect(production).toMatch(/^routes = \[/m);
    expect(production).toContain('api.xivdyetools.app');
  });

  it('pins production JWT_ISSUER and ENVIRONMENT', () => {
    expect(production).toContain('JWT_ISSUER = "https://auth.xivdyetools.app"');
    expect(production).toContain('ENVIRONMENT = "production"');
  });

  /**
   * FINDING-013's production validateEnv requires TOKEN_BLACKLIST to be
   * bound, but a binding that silently points at the WRONG namespace passes
   * that check while breaking revocation cross-checking against oauth
   * (FINDING-002) and the FINDING-015 nonce replay cache. The two workers'
   * KV ids must actually agree, in both directions.
   */
  it('shares the TOKEN_BLACKLIST KV namespace with oauth (dev and production)', () => {
    const ourProdId = production.match(
      /^\[\[env\.production\.kv_namespaces\]\]\nbinding = "TOKEN_BLACKLIST"\nid = "([0-9a-f]+)"$/m
    )?.[1];
    const ourDevId = topLevel.match(
      /^\[\[kv_namespaces\]\]\nbinding = "TOKEN_BLACKLIST"\nid = "([0-9a-f]+)"$/m
    )?.[1];
    // oauth's top level IS its production env; its dev block is [env.development].
    const oauthProdId = oauthToml.match(
      /^\[\[kv_namespaces\]\]\nbinding = "TOKEN_BLACKLIST"\nid = "([0-9a-f]+)"$/m
    )?.[1];
    const oauthDevId = oauthToml.match(
      /^\[\[env\.development\.kv_namespaces\]\]\nbinding = "TOKEN_BLACKLIST"\nid = "([0-9a-f]+)"/m
    )?.[1];

    expect(ourProdId).toBe('0d6f3be3b4704e91a83e6387b9769e45');
    expect(ourDevId).toBe('891bbbe834ba4055a06b672b589094be');
    expect(ourProdId).toBe(oauthProdId);
    expect(ourDevId).toBe(oauthDevId);
  });

  it('binds a production RL_PUBLIC ratelimit', () => {
    expect(production).toMatch(/^\[\[env\.production\.ratelimits\]\]\nname = "RL_PUBLIC"$/m);
  });

  it('has no [env.preview] block', () => {
    expect(toml).not.toMatch(/^\[env\.preview\]$/m);
  });
});
