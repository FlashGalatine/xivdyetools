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
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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
   */
  it('never declares routes, in either environment or by inheritance', () => {
    expect(toml).not.toMatch(/^routes = \[/m);
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

  it('declares exactly one named environment ([env.production]) and nothing else', () => {
    const envHeaders = toml.match(/^\[env\.\w+\]$/gm) ?? [];
    expect(envHeaders).toEqual(['[env.production]']);
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
