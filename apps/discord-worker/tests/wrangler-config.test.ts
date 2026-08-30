/**
 * wrangler.toml invariants that no source test can reach (the damage happens
 * at deploy time). Parsed with regexes — the file is small and the shapes are
 * simple (same approach as apps/presets-api/tests/wrangler-config.test.ts).
 *
 * FINDING-007 (2026-08-29 security audit): the per-user rate-limit counters
 * moved off Upstash Redis onto the native `[[ratelimits]]` bindings. The
 * limiter degrades *silently* when the config drifts — worker-kit routes a
 * command to the largest bound tier when nothing fits, so a missing or
 * mistyped tier just hands every command a bigger allowance, and a
 * namespace_id shared with another worker silently merges two workers'
 * counters. Neither is observable from a source test.
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

/**
 * One tier per distinct effective limit (`maxRequests + burstAllowance`) in
 * worker-kit's DISCORD_COMMAND_LIMITS: extractor:image 5, budget/preset/
 * accessibility 10, the default and the rendering commands 15, dye/preferences
 * 20, about/manual/changelog 30, autocomplete 60 + 10 burst.
 */
const EXPECTED_TIERS: ReadonlyArray<readonly [string, number]> = [
  ['RL_5', 5],
  ['RL_10', 10],
  ['RL_15', 15],
  ['RL_20', 20],
  ['RL_30', 30],
  ['RL_70', 70],
];

interface ParsedTier {
  namespaceId: number;
  limit: number;
  period: number;
}

/** Parse every `[[<header>]]` rate-limit block, keyed by binding name. */
function parseTiers(header: string): Map<string, ParsedTier> {
  const pattern = new RegExp(
    `^\\[\\[${header.replace(/\./g, '\\.')}\\]\\]\\n` +
      `name = "([A-Z0-9_]+)"\\n` +
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

describe('wrangler.toml', () => {
  it('keeps the top-level worker the routeless beta bot', () => {
    expect(productionStart).toBeGreaterThan(-1);
    const name = topLevel.match(/^name = "([^"]+)"$/m)?.[1];
    expect(name).toMatch(/-dev$/);
    expect(topLevel).toMatch(/^workers_dev = true$/m);
    expect(topLevel).not.toMatch(/^routes = \[/m);
  });

  it('routes production to xivdyetools-discord-worker on both custom domains', () => {
    expect(production).toMatch(/^name = "xivdyetools-discord-worker"$/m);
    expect(production).toMatch(/^workers_dev = false$/m);
    expect(production).toMatch(/^routes = \[/m);
    expect(production).toContain('bot.xivdyetools.app');
    expect(production).toContain('bot.xivdyetools.projectgalatine.com');
  });

  it.each([
    ['top-level (beta)', 'ratelimits'],
    ['production', 'env.production.ratelimits'],
  ])('binds the six DISCORD_COMMAND_LIMITS tiers in %s', (_label, header) => {
    const tiers = parseTiers(header);
    expect([...tiers.keys()].sort()).toEqual(EXPECTED_TIERS.map(([n]) => n).sort());
    for (const [name, limit] of EXPECTED_TIERS) {
      expect(tiers.get(name)).toMatchObject({ limit, period: 60 });
    }
  });

  it('gives all twelve tiers a distinct namespace_id in this worker\'s reserved range', () => {
    const ids = [...parseTiers('ratelimits').values(), ...parseTiers('env.production.ratelimits').values()].map(
      (tier) => tier.namespaceId,
    );
    expect(ids).toHaveLength(12);
    // 1001-1034 belong to api-worker / presets-api / oauth / moderation-worker.
    for (const id of ids) expect(id).toBeGreaterThanOrEqual(1041);
    expect(new Set(ids).size).toBe(12);
  });

  it('names no Upstash secret (FINDING-007 — Upstash is no longer a processor)', () => {
    expect(toml).not.toMatch(/UPSTASH/i);
  });

  it('has no [env.preview] block', () => {
    expect(toml).not.toMatch(/^\[env\.preview\]$/m);
  });
});
