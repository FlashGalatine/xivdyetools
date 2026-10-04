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

  /**
   * FINDING-006 (2026-10-03 security audit): the retired
   * xivdyetools.projectgalatine.com origin is gone from the CORS allowlist
   * (DOMAIN_DEPRECATION Phase 1). Pin the exact production list so any
   * addition is a reviewed change.
   */
  it('pins the exact production CORS allowlist', () => {
    const additional = production.match(/ADDITIONAL_CORS_ORIGINS = "([^"]*)"/)?.[1];
    expect(additional?.split(',')).toEqual([
      'https://xiv-colorexplorer.pages.dev',
      'https://beta.xivdyetools.app',
    ]);
    expect(production).toContain('CORS_ORIGIN = "https://xivdyetools.app"');
    expect(toml).not.toMatch(/https:\/\/xivdyetools\.projectgalatine\.com/);
  });

  /**
   * FINDING-022 (2026-10-03 security audit): both privacy policies promise
   * Workers Logs are off, so the state is pinned in config in BOTH blocks and
   * no log sink may be added without updating the policies in the same change.
   */
  it('pins observability off at the top level and in production', () => {
    expect(topLevel).toMatch(/^\[observability\]\nenabled = false$/m);
    expect(production).toMatch(/^\[env\.production\.observability\]\nenabled = false$/m);
    expect(toml).not.toMatch(/^\s*enabled\s*=\s*true/m);
  });

  /**
   * The daily retention job (src/retention-job.ts) is what makes the published
   * retention periods hold; it runs in production only. A top-level trigger
   * would give the routeless dev worker a cron of its own.
   */
  it('runs exactly one daily retention cron in production and none at the top level', () => {
    expect(topLevel).not.toMatch(/^\[triggers\]$/m);
    expect(topLevel).not.toMatch(/^crons\s*=/m);
    expect(production).toMatch(/^\[env\.production\.triggers\]$/m);
    const crons = production.match(/^crons = \[([^\]]*)\]$/m)?.[1] ?? '';
    const entries = crons.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
    expect(entries).toHaveLength(1);
    // minute hour * * * : once a day.
    expect(entries[0]).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
  });

  it('configures no logpush and no tail consumers', () => {
    expect(toml).not.toMatch(/^\s*logpush\s*=\s*true/m);
    expect(toml).not.toMatch(/^\s*\[\[(env\.[a-z]+\.)?tail_consumers\]\]/m);
    expect(toml).not.toMatch(/^\s*tail_consumers\s*=\s*\[\s*[^\]\s]/m);
  });
});
