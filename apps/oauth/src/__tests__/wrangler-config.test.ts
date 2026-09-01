/**
 * wrangler.toml invariants that no source test can reach (the damage happens
 * at deploy time). Parsed with regexes — the file is small and the shapes
 * are simple, same approach as apps/presets-api/tests/wrangler-config.test.ts
 * and apps/api-worker/tests/wrangler-config.test.ts. No new dependency.
 *
 * FINDING-023 (2026-08-29 security audit): oauth had no config-drift guard
 * at all, and a bare `wrangler deploy` **is** production on this worker
 * (apps/oauth/CLAUDE.md) — unlike presets-api / api-worker, where the
 * top-level block is a routeless `-dev` worker with no route to production.
 * A config edit here has no `--env production` safety net.
 *
 * oauth's file interleaves top-level (production) tables with
 * `[env.development.*]` ones PHYSICALLY: the top-level `[[kv_namespaces]]`
 * and `[[d1_databases]]` blocks each sit AFTER the `[env.development]`
 * header in the file, but are still top-level — TOML table headers are
 * fully-qualified from the document root, not nested by physical position.
 * presets-api's own wrangler-config.test.ts slices its file at
 * `[env.production]` into a "top half" / "production half" pair, which
 * works there because that file has no such interleaving; doing the same
 * here (e.g. slicing at `[env.development]`) would silently misattribute
 * the top-level kv_namespaces/d1_databases blocks to "development" since
 * they are physically past that header. Every assertion below therefore
 * matches an exact, anchored header directly against the whole file instead
 * of relying on a slice boundary — the same technique presets-api's test
 * already uses to read THIS file cross-file (see its
 * 'shares the TOKEN_BLACKLIST KV namespace with oauth' test).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Normalise CRLF so `$` anchors line ends on a Windows checkout too.
const toml = readFileSync(join(__dirname, '..', '..', 'wrangler.toml'), 'utf-8').replace(/\r\n/g, '\n');

// Cross-file: FINDING-002's revocation cross-check requires the two workers'
// TOKEN_BLACKLIST ids to actually agree, not just be individually present
// (FINDING-013's fail-closed validateEnv only catches a *missing* binding).
const presetsApiToml = readFileSync(
  join(__dirname, '..', '..', '..', 'presets-api', 'wrangler.toml'),
  'utf-8'
).replace(/\r\n/g, '\n');

describe('wrangler.toml', () => {
  it('names the top-level (production) worker xivdyetools-oauth', () => {
    expect(toml).toMatch(/^name = "xivdyetools-oauth"$/m);
  });

  it('pins the top-level (production) ENVIRONMENT to production', () => {
    expect(toml).toMatch(/^\[vars\]$/m);
    expect(toml).toMatch(/^ENVIRONMENT = "production"$/m);
  });

  it('routes the top-level worker to auth.xivdyetools.app', () => {
    expect(toml).toMatch(/^routes = \[/m);
    expect(toml).toContain('auth.xivdyetools.app');
  });

  /**
   * This worker's top level IS production (no [env.production] block
   * exists, or should ever exist again). FINDING-029 (2026-08-21 audit)
   * deleted the former [env.preview], which bound production D1 + KV behind
   * a stale frontend origin and sat outside every `=== 'production'` gate.
   * The invariant is "no second production-shaped env exists", not the
   * literal absent label.
   */
  it('has exactly one [env.development] and no [env.preview] / [env.production] block', () => {
    const devHeaders = toml.match(/^\[env\.development\]$/gm) ?? [];
    expect(devHeaders).toHaveLength(1);
    expect(toml).not.toMatch(/^\[env\.preview\]$/m);
    expect(toml).not.toMatch(/^\[env\.production\]$/m);
  });

  it('binds three top-level [[ratelimits]] tiers RL_AUTH_10/20/30 with limits 10/20/30', () => {
    expect(toml).toMatch(
      /^\[\[ratelimits\]\]\nname = "RL_AUTH_10"\nnamespace_id = "\d+"\nsimple = \{ limit = 10, period = 60 \}$/m
    );
    expect(toml).toMatch(
      /^\[\[ratelimits\]\]\nname = "RL_AUTH_20"\nnamespace_id = "\d+"\nsimple = \{ limit = 20, period = 60 \}$/m
    );
    expect(toml).toMatch(
      /^\[\[ratelimits\]\]\nname = "RL_AUTH_30"\nnamespace_id = "\d+"\nsimple = \{ limit = 30, period = 60 \}$/m
    );
  });

  it('binds three [[env.development.ratelimits]] tiers RL_AUTH_10/20/30 with distinct namespace_ids', () => {
    const ids = ['10', '20', '30'].map((limit) => {
      const re = new RegExp(
        `^\\[\\[env\\.development\\.ratelimits\\]\\]\\nname = "RL_AUTH_${limit}"\\nnamespace_id = "(\\d+)"\\nsimple = \\{ limit = ${limit}, period = 60 \\}$`,
        'm'
      );
      return toml.match(re)?.[1];
    });

    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    // Pairwise distinct — a copy-pasted block pointing two tiers at the same
    // namespace would silently merge their counters.
    expect(new Set(ids).size).toBe(3);
  });

  it('shares the TOKEN_BLACKLIST KV namespace with presets-api (dev and production)', () => {
    const ourProdId = toml.match(
      /^\[\[kv_namespaces\]\]\nbinding = "TOKEN_BLACKLIST"\nid = "([0-9a-f]+)"$/m
    )?.[1];
    const ourDevId = toml.match(
      /^\[\[env\.development\.kv_namespaces\]\]\nbinding = "TOKEN_BLACKLIST"\nid = "([0-9a-f]+)"$/m
    )?.[1];
    // presets-api's own file is not interleaved (its dev/top-level tables
    // all precede [env.production]), but these regexes are anchored the
    // same way regardless, for the same reason as our own two above.
    const presetsApiDevId = presetsApiToml.match(
      /^\[\[kv_namespaces\]\]\nbinding = "TOKEN_BLACKLIST"\nid = "([0-9a-f]+)"$/m
    )?.[1];
    const presetsApiProdId = presetsApiToml.match(
      /^\[\[env\.production\.kv_namespaces\]\]\nbinding = "TOKEN_BLACKLIST"\nid = "([0-9a-f]+)"$/m
    )?.[1];

    expect(ourProdId).toBe('0d6f3be3b4704e91a83e6387b9769e45');
    expect(ourDevId).toBe('891bbbe834ba4055a06b672b589094be');
    // oauth's top level (production) <-> presets-api's [env.production]
    expect(ourProdId).toBe(presetsApiProdId);
    // oauth's [env.development] <-> presets-api's top level (dev)
    expect(ourDevId).toBe(presetsApiDevId);
  });

  it('does not point the [env.development] D1 database at the production database', () => {
    const prodId = toml.match(
      /^\[\[d1_databases\]\]\nbinding = "DB"\ndatabase_name = "xivdyetools-users"\ndatabase_id = "([0-9a-f-]+)"$/m
    )?.[1];
    // The dev block has explanatory comment lines between database_name and
    // database_id (it is a TODO placeholder) — skip lazily to the next
    // database_id line rather than assuming a fixed line count.
    const devId = toml.match(
      /^\[\[env\.development\.d1_databases\]\]\n[\s\S]*?\ndatabase_id = "([^"]+)"$/m
    )?.[1];

    expect(prodId).toBe('6e97b759-70dd-49a8-a93c-0541c7fe6c67');
    expect(devId).toBeTruthy();
    // Deliberately NOT asserting the literal "TODO_RUN_WRANGLER_D1_CREATE" —
    // that placeholder is expected to be replaced with a real id once the
    // dev database is created, and the invariant that matters (dev must
    // never alias production) has to keep holding after that happens too.
    expect(devId).not.toBe(prodId);
  });
});
