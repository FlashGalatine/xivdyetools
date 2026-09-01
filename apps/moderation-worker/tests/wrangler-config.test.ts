/**
 * wrangler.toml invariants that no source test can reach (the damage happens
 * at deploy time). Parsed with regexes — the file is small and the shapes are
 * simple (same approach as apps/presets-api/tests/wrangler-config.test.ts and
 * apps/discord-worker/tests/wrangler-config.test.ts).
 *
 * FINDING-023 (2026-08-29 security audit): moderation-worker had no
 * config-drift guard at all — a `workers_dev` flip, the wrong environment
 * publishing, or the KV / D1 ids silently drifting from the workers they must
 * match (FINDING-013's fail-closed validateEnv only catches a *missing*
 * binding, not one pointed at the wrong namespace) would only be caught by
 * hand.
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

// Cross-worker tomls for the two shared-id checks below.
const discordWorkerToml = readFileSync(
  join(__dirname, '..', '..', 'discord-worker', 'wrangler.toml'),
  'utf-8',
).replace(/\r\n/g, '\n');
const presetsApiToml = readFileSync(
  join(__dirname, '..', '..', 'presets-api', 'wrangler.toml'),
  'utf-8',
).replace(/\r\n/g, '\n');
const presetsApiProductionStart = presetsApiToml.search(/^\[env\.production\]$/m);
const presetsApiTopLevel = presetsApiToml.slice(0, presetsApiProductionStart);
const presetsApiProduction = presetsApiToml.slice(presetsApiProductionStart);

interface ParsedTier {
  namespaceId: number;
  limit: number;
  period: number;
}

/** Parse every `[[<header>]]` rate-limit block, keyed by binding name. */
function parseTiers(header: string): Map<string, ParsedTier> {
  const pattern = new RegExp(
    `^\\[\\[${header.replace(/\./g, '\\.')}\\]\\]\\n` +
      `name = "([A-Z_]+)"\\n` +
      `namespace_id = "(\\d+)"\\n` +
      `simple = \\{ limit = (\\d+), period = (\\d+) \\}$`,
    'gm',
  );
  const tiers = new Map<string, ParsedTier>();
  for (const match of toml.matchAll(pattern)) {
    tiers.set(match[1], {
      namespaceId: Number(match[2]),
      limit: Number(match[3]),
      period: Number(match[4]),
    });
  }
  return tiers;
}

/** Anchored `[[<header>]]` D1 block matcher shared by the two DB assertions below. */
function d1Pattern(header: string): RegExp {
  return new RegExp(
    `^\\[\\[${header.replace(/\./g, '\\.')}\\]\\]\\n` +
      `binding = "DB"\\n` +
      `database_name = "xivdyetools-presets"\\n` +
      `database_id = "([0-9a-f-]+)"$`,
    'm',
  );
}

describe('wrangler.toml', () => {
  it('keeps the top-level worker a routeless dev worker', () => {
    expect(productionStart).toBeGreaterThan(-1);
    expect(topLevel).toMatch(/^name = "xivdyetools-moderation-worker-dev"$/m);
    expect(topLevel).toMatch(/^workers_dev = false$/m);
    expect(topLevel).not.toMatch(/^routes = \[/m);
  });

  /**
   * `workers_dev` is an inheritable key (see the file's own header comment):
   * a named environment takes the top-level value unless it overrides it.
   * Unlike `routes` — which has to live ONLY under `[env.production]`, or the
   * dev worker would inherit the production custom domains — moderation-worker
   * wants the same `false` in both envs, so it is declared once at top level
   * (asserted above) and `[env.production]` deliberately does not repeat it.
   * The drift this guards against is an explicit override reappearing here.
   */
  it('routes production to xivdyetools-moderation-worker on both custom domains', () => {
    expect(production).toMatch(/^name = "xivdyetools-moderation-worker"$/m);
    expect(production).not.toMatch(/^workers_dev = true$/m);
    expect(production).toMatch(/^routes = \[/m);
    expect(production).toContain('moderation-bot.xivdyetools.app');
    expect(production).toContain('moderation-bot.xivdyetools.projectgalatine.com');
    expect(production.match(/custom_domain = true/g) ?? []).toHaveLength(2);
  });

  it('pins ENVIRONMENT in both environments (FINDING-013)', () => {
    expect(topLevel).toMatch(/^ENVIRONMENT = "development"$/m);
    expect(production).toMatch(/^ENVIRONMENT = "production"$/m);
  });

  /**
   * Unlike the dev-id-vs-prod-id pattern used elsewhere in this file, the KV
   * namespace here is DELIBERATELY THE SAME value in both of moderation-worker's
   * own envs, AND the same namespace discord-worker binds only in ITS
   * production env: this worker has no KV of its own (rate-limit counters +
   * user preferences) — it borrows discord-worker's live production namespace
   * so a preference lookup here agrees with one from discord-worker, even from
   * the routeless moderation dev worker. Distinctness would be the bug here,
   * not the invariant.
   */
  it("shares discord-worker's production KV namespace in both envs (deliberately identical)", () => {
    const topLevelId = topLevel.match(
      /^\[\[kv_namespaces\]\]\nbinding = "KV"\nid = "([0-9a-f]+)"$/m,
    )?.[1];
    const productionId = production.match(
      /^\[\[env\.production\.kv_namespaces\]\]\nbinding = "KV"\nid = "([0-9a-f]+)"$/m,
    )?.[1];
    const discordWorkerProductionId = discordWorkerToml.match(
      /^\[\[env\.production\.kv_namespaces\]\]\nbinding = "KV"\nid = "([0-9a-f]+)"$/m,
    )?.[1];

    expect(topLevelId).toBe('1fcb7e037ccd4172a47fccd97cf8e753');
    expect(productionId).toBe(topLevelId);
    expect(discordWorkerProductionId).toBe(topLevelId);
  });

  it('shares the xivdyetools-presets D1 database with presets-api (same id, all four blocks)', () => {
    const topLevelId = topLevel.match(d1Pattern('d1_databases'))?.[1];
    const productionId = production.match(d1Pattern('env.production.d1_databases'))?.[1];
    const presetsApiTopLevelId = presetsApiTopLevel.match(d1Pattern('d1_databases'))?.[1];
    const presetsApiProductionId = presetsApiProduction.match(
      d1Pattern('env.production.d1_databases'),
    )?.[1];

    expect(topLevelId).toBe('e17d68a1-5a44-4c88-b02b-07d053cbe321');
    expect(productionId).toBe(topLevelId);
    expect(presetsApiTopLevelId).toBe(topLevelId);
    expect(presetsApiProductionId).toBe(topLevelId);
  });

  it('binds PRESETS_API to xivdyetools-presets-api in both envs', () => {
    expect(topLevel).toMatch(
      /^\[\[services\]\]\nbinding = "PRESETS_API"\nservice = "xivdyetools-presets-api"$/m,
    );
    expect(production).toMatch(
      /^\[\[env\.production\.services\]\]\nbinding = "PRESETS_API"\nservice = "xivdyetools-presets-api"$/m,
    );
  });

  it.each([
    ['top-level (dev)', 'ratelimits', 1033, 1034],
    ['production', 'env.production.ratelimits', 1031, 1032],
  ] as const)(
    'binds RL_COMMAND (25/60) and RL_AUTOCOMPLETE (70/60) in %s with the pinned namespace_ids',
    (_label, header, commandId, autocompleteId) => {
      const tiers = parseTiers(header);
      expect([...tiers.keys()].sort()).toEqual(['RL_AUTOCOMPLETE', 'RL_COMMAND']);
      expect(tiers.get('RL_COMMAND')).toMatchObject({
        limit: 25,
        period: 60,
        namespaceId: commandId,
      });
      expect(tiers.get('RL_AUTOCOMPLETE')).toMatchObject({
        limit: 70,
        period: 60,
        namespaceId: autocompleteId,
      });
    },
  );

  it('gives all four rate-limit tiers a distinct namespace_id (dev ids differ from production)', () => {
    const ids = [
      ...parseTiers('ratelimits').values(),
      ...parseTiers('env.production.ratelimits').values(),
    ].map((tier) => tier.namespaceId);

    expect(ids.slice().sort((a, b) => a - b)).toEqual([1031, 1032, 1033, 1034]);
    expect(new Set(ids).size).toBe(4);
  });

  it('has no [env.preview] block', () => {
    expect(toml).not.toMatch(/^\[env\.preview\]$/m);
  });
});
