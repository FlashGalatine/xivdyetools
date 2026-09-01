/**
 * wrangler.toml invariants that no source test can reach (the damage happens
 * at deploy time). Parsed with regexes — the file is small and the shapes
 * are simple, same approach as apps/presets-api/tests/wrangler-config.test.ts,
 * apps/moderation-worker/tests/wrangler-config.test.ts and
 * apps/oauth/src/__tests__/wrangler-config.test.ts. No new dependency.
 *
 * DELIBERATELY in src/, not tests/: this app's vitest.config.ts only includes
 * `src/**\/*.test.ts`, and all seven of the pre-existing test files are flat
 * inside src/ — a tests/wrangler-config.test.ts here would compile fine and
 * silently never run under `pnpm test`. Do not "fix" this back to tests/
 * without also widening the vitest include.
 *
 * FINDING-023 (2026-08-29 security audit): image-worker is binding-only by
 * design (see docs/operations/IMAGE_WORKER_SPLIT.md and this worker's own
 * wrangler.toml comments) — no routes, no workers_dev, no signature check, no
 * rate limiting, and every request fetches up to 10 MB from a CDN and runs a
 * full photon WASM decode. That design used to be protected by nothing but a
 * wrangler.toml comment: one config flip (workers_dev = true, or a routes
 * entry) would have published an unauthenticated decode/SSRF surface with
 * nothing to notice. This is the fourth and last of a config-drift test set
 * this branch added — presets-api (Sprint 1), oauth (Sprint 2),
 * moderation-worker (Sprint 4) — after this file, FINDING-023 closes.
 *
 * Fix round 2 (S8-R12): the edit this file most needs to catch is not
 * setting `workers_dev` to `true` — it is deleting the `workers_dev = false`
 * line entirely. wrangler 4.126.0 (the pinned version; verified directly
 * against its bundled source, `getSubdomainValues`/`getSubdomainValuesAPIMock`
 * in wrangler-dist/cli.js) computes `defaultWorkersDev = routes.length === 0`
 * whenever the key is absent from config, and both of this worker's
 * environments have zero routes — so a "tidy-up" that drops the line
 * publishes it exactly as surely as writing `true` would, with no line that
 * even looks suspicious in a diff. The two POSITIVE `toMatch(/^workers_dev =
 * false$/m)` assertions below catch a deletion (the expected string is
 * simply no longer there); the "never true anywhere" guard on its own would
 * NOT, since a deleted line leaves no `true` text to find. Both assertion
 * styles matter, for two different failure shapes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Normalise CRLF so `$` anchors line ends on a Windows checkout too.
const toml = readFileSync(join(__dirname, '..', 'wrangler.toml'), 'utf-8').replace(/\r\n/g, '\n');
const productionStart = toml.search(/^\[env\.production\]$/m);
const topLevel = toml.slice(0, productionStart);
const production = toml.slice(productionStart);

// Cross-worker tomls (read-only — these are separate deploy units, never
// asserted against or modified here). Both of image-worker's callers reach it
// purely by the `service = "xivdyetools-image-worker"` name in their own
// wrangler.toml, not by importing anything from this app, so a drift in
// either side only shows up as a runtime "service not found" at THEIR deploy
// time with nothing here to warn first.
const discordWorkerToml = readFileSync(
  join(__dirname, '..', '..', 'discord-worker', 'wrangler.toml'),
  'utf-8',
).replace(/\r\n/g, '\n');
const presetsApiToml = readFileSync(
  join(__dirname, '..', '..', 'presets-api', 'wrangler.toml'),
  'utf-8',
).replace(/\r\n/g, '\n');

/**
 * Fix round 1 (S8-R6): matches a route declared in ANY shape wrangler
 * 4.126.0 (the pinned version) actually accepts, not just the one spelling
 * this repo happens to use elsewhere (`routes = [...]`). Verified against
 * the pinned wrangler with `--dry-run`: an invented key produces a config
 * warning, but every shape below is accepted silently, so silence is the
 * signal that wrangler recognises it as real.
 *
 * Two independent forms, unioned:
 *  - Assignment: `route = …` / `routes = …` — singular (one route, string
 *    or inline table) or plural (an array of either). An optional dotted
 *    prefix (`env.production.routes = …`) is matched too: this repo always
 *    nests routes under an `[env.X]` HEADER instead, but TOML's dotted-key
 *    syntax permits an inline top-level spelling as well, and the point is
 *    to catch every shape wrangler parses, not just the shape used so far.
 *  - Table header: `[route]` / `[routes]` / `[[route]]` / `[[routes]]`,
 *    with the same optional `env.X.` prefix and either bracket depth —
 *    `route` is a single table, `routes` an array of tables, and wrangler
 *    accepts both spellings.
 *
 * `^\s*` anchors every alternative to (optional leading whitespace then)
 * the start of the line, so a `#`-prefixed comment — this file's own
 * wrangler.toml has several mentioning "routes" in prose — can never match:
 * the character right after `^\s*` would have to be `#`, and neither
 * alternative accepts that. Verified directly (see the mutation table in
 * the task report) rather than assumed.
 *
 * Known limit of matching text instead of parsing TOML: a few spellings
 * that move the relevant key or header off the shape these regexes expect
 * still slip through — a quoted bare key (`"routes" = [...]`, which
 * wrangler normalises like the unquoted one) and an inline table (`[env]`
 * + `staging = { routes = [...] }`), both ruled out by the same limitation
 * in the `workers_dev` check above and in all three sibling tests. The
 * SAME class of gap applies to the environment-name check further below:
 * a quoted environment name in a header (`[env."staging"]`) is not seen by
 * `env\.(\w+)` either, since `"` is not a word character. All were
 * confirmed deployable, and none are closed here. Recorded rather than
 * chased: nobody writes wrangler config that way, and closing it means
 * taking on a TOML parser for a guard whose job is to catch an ordinary
 * edit.
 */
const ROUTE_DECLARATION = new RegExp(
  [
    String.raw`^\s*(?:[\w.]+\.)?routes?\s*=`,
    String.raw`^\s*\[{1,2}\s*(?:[\w.]+\.)?routes?\s*\]{1,2}\s*$`,
  ].join('|'),
  'm',
);

/** Anchored `[[<header>]]` service-binding matcher, same technique as the
 *  sibling tests' PRESETS_API / DISCORD_WORKER binding assertions. */
function serviceBinding(source: string, header: string, binding: string): string | undefined {
  const pattern = new RegExp(
    `^\\[\\[${header.replace(/\./g, '\\.')}\\]\\]\\nbinding = "${binding}"\\nservice = "([^"]+)"$`,
    'm',
  );
  return source.match(pattern)?.[1];
}

describe('wrangler.toml', () => {
  /**
   * Fix round 2 (S8-R11): wrangler resolves config in a fixed order —
   * wrangler.json, then wrangler.jsonc, then wrangler.toml — so either file
   * existing alongside wrangler.toml would SHADOW the exact file every
   * other assertion in this suite reads: wrangler would deploy from a
   * config this file has never looked at, while staying green throughout.
   * Checked first, ahead of every other assertion here, because if this one
   * fails the rest are meaningless.
   */
  it('has no wrangler.json or wrangler.jsonc shadowing wrangler.toml', () => {
    expect(existsSync(join(__dirname, '..', 'wrangler.json'))).toBe(false);
    expect(existsSync(join(__dirname, '..', 'wrangler.jsonc'))).toBe(false);
  });

  it('finds the [env.production] header (sanity check for the slice below)', () => {
    expect(productionStart).toBeGreaterThan(-1);
  });

  it('keeps the top-level worker a routeless, unreachable dev worker', () => {
    expect(topLevel).toMatch(/^name = "xivdyetools-image-worker-dev"$/m);
    expect(topLevel).toMatch(/^workers_dev = false$/m);
    expect(topLevel).toMatch(/^preview_urls = false$/m);
  });

  it('names production the exact worker both callers bind to', () => {
    expect(production).toMatch(/^name = "xivdyetools-image-worker"$/m);
    expect(production).toMatch(/^workers_dev = false$/m);
    expect(production).toMatch(/^preview_urls = false$/m);
  });

  /**
   * `routes` and `workers_dev` are inheritable keys: a named environment
   * takes the top-level value unless it declares its own (see e.g.
   * discord-worker's wrangler.toml header comment, or
   * apps/og-worker/tests/wrangler-env.test.ts). The sibling tests in this set
   * handle that by asserting routes exist ONLY under their own
   * `[env.production]`, because those workers' production environments are
   * SUPPOSED to have routes — checking either slice alone would miss a
   * top-level `routes` silently leaking into the other named env.
   * image-worker's invariant is stronger: NEITHER environment may ever have
   * routes, in either direction. That makes a single whole-file check both
   * simpler and inheritance-safe — the only way any environment ends up with
   * routes, by explicit declaration or by inheritance, is if the literal text
   * appears somewhere in the document. Its absence anywhere rules out both,
   * so this one assertion cannot pass merely because a `routes` key moved to
   * a slice this file isn't looking at.
   *
   * Fix round 1 (S8-R6): a single spelling (`routes = [`) is not the whole
   * invariant — wrangler also accepts the singular `route = …` assignment
   * and both the singular and plural table-header forms, in any named
   * environment, and a review with a runnable wrangler confirmed all of
   * them deploy with no config warning. `ROUTE_DECLARATION` (declared
   * above) covers every shape; this assertion is the same "absence
   * anywhere" argument as before, just against a complete pattern instead
   * of one spelling of it.
   */
  it('never declares a route, in any spelling, in either environment or by inheritance', () => {
    expect(toml).not.toMatch(ROUTE_DECLARATION);
  });

  // Belt-and-suspenders against a corrupted or duplicated key slipping past
  // the positive assertions above — TOML forbids duplicate keys in one table,
  // but this file is regex-parsed, not schema-validated, so a second
  // `workers_dev = true` line appended below the real one would not be
  // caught by a `toMatch` that already found the first, correct line.
  it('never sets workers_dev or preview_urls to true anywhere in the file', () => {
    expect(toml).not.toMatch(/^workers_dev = true$/m);
    expect(toml).not.toMatch(/^preview_urls = true$/m);
  });

  /**
   * Fix round 1 (S8-R7): the original version of this test matched only a
   * BARE `[env.NAME]` header, so `[env.staging.vars]` — a real, deployable
   * environment (`wrangler deploy --env staging` targets it) that never
   * declares a bare `[env.staging]` header at all — passed straight
   * through undetected. wrangler does not require the bare header to
   * exist; any `[env.NAME...]` or `[[env.NAME...]]` table, at any nesting,
   * is enough to define the environment. So instead of matching a specific
   * header shape, this extracts the environment NAME from every header
   * that starts with `env.` — sub-tables and array-of-tables included —
   * and asserts the set of distinct names, which is what actually
   * determines what `--env` values are deployable. (A quoted environment
   * name — `[env."staging"]` — is the one shape this still misses; see the
   * "known limit" note on `ROUTE_DECLARATION` above.)
   */
  it('declares exactly one environment name (production) across every env.* header', () => {
    const envNames = [...new Set([...toml.matchAll(/^\s*\[{1,2}\s*env\.(\w+)/gm)].map((m) => m[1]))];
    expect(envNames).toEqual(['production']);
  });

  /**
   * The cross-worker contract FINDING-023 calls out by name: both callers
   * construct `new Request('https://image-worker/<path>', …)` and reach this
   * worker purely by the `service = "xivdyetools-image-worker"` name in
   * their own wrangler.toml — discord-worker's image-client.ts:54 and
   * presets-api's preview-image-service.ts:152. Neither caller imports
   * anything from this app, so if production's `name` ever drifted, both
   * bindings would fail at THEIR deploy time with nothing here to warn
   * first. Checked in all four locations: both callers each declare the
   * binding twice — their own dev/beta environment AND their
   * `[env.production]` — and, per this worker's own wrangler.toml comment,
   * every one of those four points at the PRODUCTION image-worker name,
   * never the orphaned "-dev" one.
   */
  it('is the service both discord-worker and presets-api bind IMAGE_WORKER to, in all of their environments', () => {
    const productionName = production.match(/^name = "([^"]+)"$/m)?.[1];
    expect(productionName).toBe('xivdyetools-image-worker');

    expect(serviceBinding(discordWorkerToml, 'services', 'IMAGE_WORKER')).toBe(productionName);
    expect(serviceBinding(discordWorkerToml, 'env.production.services', 'IMAGE_WORKER')).toBe(
      productionName,
    );
    expect(serviceBinding(presetsApiToml, 'services', 'IMAGE_WORKER')).toBe(productionName);
    expect(serviceBinding(presetsApiToml, 'env.production.services', 'IMAGE_WORKER')).toBe(
      productionName,
    );
  });
});
