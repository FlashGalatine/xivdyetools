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

  // The retired proxy.xivdyetools.projectgalatine.com custom domain was removed in
  // the dashboard on 2026-10-05; a deploy would re-attach it if it were listed.
  it('keeps production on its custom domains only', () => {
    expect(production).toMatch(/^routes = \[/m);
    const patterns = [...production.matchAll(/pattern = "([^"]+)"/g)].map((m) => m[1]);
    expect(patterns).toEqual(['data.xivdyetools.app', 'proxy.xivdyetools.app', 'developers.xivdyetools.app']);
    expect(production).not.toMatch(/^workers_dev = true$/m);
  });

  /**
   * Web-app telemetry (POST /v1/telemetry) writes to Analytics Engine. The
   * dev worker must have its own dataset so ad-hoc `pnpm dev` traffic never
   * pollutes the production series, and production must never point at it.
   */
  /**
   * POST /v1/telemetry must not share the API bucket: both environments bind
   * TELEMETRY_RATE_LIMITER at 240 / 60 s, and every namespace_id in the file
   * (now including the two Universalis proxy buckets) is unique (the platform requires uniqueness per account).
   */
  it('binds a separate telemetry rate-limit bucket per environment with unique namespace ids', () => {
    expect(topLevel).toMatch(
      /^\[\[ratelimits\]\]\nname = "TELEMETRY_RATE_LIMITER"\nnamespace_id = "\d+"\nsimple = \{ limit = 240, period = 60 \}$/m,
    );
    expect(production).toMatch(
      /^\[\[env\.production\.ratelimits\]\]\nname = "TELEMETRY_RATE_LIMITER"\nnamespace_id = "\d+"\nsimple = \{ limit = 240, period = 60 \}$/m,
    );
    const ids = [...toml.matchAll(/^namespace_id = "(\d+)"$/gm)].map((m) => m[1]);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
  });

  /**
   * Our own workers reach /v1/* over a service binding with no client IP, so
   * they share one key; SERVICE_RATE_LIMITER gives that key a ceiling of 20x
   * a public IP's (1300 / 60 s) in both environments (BUG-048's rule).
   */
  it('binds a service-binding bucket at 20x the public limit in both environments', () => {
    expect(topLevel).toMatch(
      /^\[\[ratelimits\]\]\nname = "SERVICE_RATE_LIMITER"\nnamespace_id = "\d+"\nsimple = \{ limit = 1300, period = 60 \}$/m,
    );
    expect(production).toMatch(
      /^\[\[env\.production\.ratelimits\]\]\nname = "SERVICE_RATE_LIMITER"\nnamespace_id = "\d+"\nsimple = \{ limit = 1300, period = 60 \}$/m,
    );
  });

  it('binds a separate Analytics Engine dataset per environment', () => {
    expect(topLevel).toMatch(
      /^\[\[analytics_engine_datasets\]\]\nbinding = "ANALYTICS"\ndataset = "xivdyetools_web_analytics_dev"$/m,
    );
    expect(production).toMatch(
      /^\[\[env\.production\.analytics_engine_datasets\]\]\nbinding = "ANALYTICS"\ndataset = "xivdyetools_web_analytics"$/m,
    );
    expect(production).not.toContain('xivdyetools_web_analytics_dev');
  });

  /**
   * FINDING-011 (2026-10-03 security audit): the Universalis proxy counts its
   * cache misses through two native rate-limit bindings whose `simple` limit
   * must equal what the code asks for — the CloudflareRateLimiter tier is
   * chosen without regard to maxRequests, so a drifted number would silently
   * change the budget. Parsed per environment: production's vars are an inline
   * table under [env.production], which an anchored `^RATE_LIMIT_REQUESTS`
   * regex would never see (it would find the dev value in both slices).
   */
  const SERVICE_BINDING_BUDGET_MULTIPLIER = 20;

  describe.each([
    ['development (top level)', topLevel, '[[ratelimits]]'],
    ['production', production, '[[env.production.ratelimits]]'],
  ])('Universalis proxy rate-limit bindings: %s', (_label, slice, header) => {
    const requests = Number(slice.match(/\bRATE_LIMIT_REQUESTS = "(\d+)"/)?.[1]);
    const windowSeconds = Number(slice.match(/\bRATE_LIMIT_WINDOW_SECONDS = "(\d+)"/)?.[1]);
    const binding = (name: string) => {
      const m = slice.match(
        new RegExp(
          `^${header.replace(/[[\]]/g, '\\$&')}\\nname = "${name}"\\nnamespace_id = "\\d+"\\nsimple = \\{ limit = (\\d+), period = (\\d+) \\}$`,
          'm',
        ),
      );
      return m ? { limit: Number(m[1]), period: Number(m[2]) } : undefined;
    };

    it('reads this environment\'s own RATE_LIMIT_* vars', () => {
      expect(requests).toBeGreaterThan(0);
      expect([10, 60]).toContain(windowSeconds);
    });

    it('UNIVERSALIS_RATE_LIMITER limit equals RATE_LIMIT_REQUESTS, period the window', () => {
      expect(binding('UNIVERSALIS_RATE_LIMITER')).toEqual({ limit: requests, period: windowSeconds });
    });

    it('UNIVERSALIS_SERVICE_RATE_LIMITER limit is 20x RATE_LIMIT_REQUESTS, period the window', () => {
      expect(binding('UNIVERSALIS_SERVICE_RATE_LIMITER')).toEqual({
        limit: SERVICE_BINDING_BUDGET_MULTIPLIER * requests,
        period: windowSeconds,
      });
    });
  });

  it('pins the expected Universalis limits (30 / 600 in production, 60 / 1200 in dev)', () => {
    expect(production).toMatch(/\bRATE_LIMIT_REQUESTS = "30"/);
    expect(topLevel).toMatch(/^RATE_LIMIT_REQUESTS = "60"$/m);
  });

  /**
   * FINDING-022 (2026-10-03 security audit): both privacy policies promise
   * persistent Workers Logs are off. `observability` is inheritable, but it is
   * declared in both blocks so neither can drift on by accident.
   */
  it('pins Workers Logs off in both blocks (FINDING-022)', () => {
    expect(topLevel).toMatch(/^\[observability\]\nenabled = false$/m);
    expect(production).toMatch(/^\[env\.production\.observability\]\nenabled = false$/m);
  });

  it('never enables observability, logpush or tail consumers', () => {
    expect(toml).not.toMatch(/^\s*enabled\s*=\s*true\b/m);
    expect(toml).not.toMatch(/observability\s*=\s*\{[^}]*enabled\s*=\s*true/);
    expect(toml).not.toMatch(/^\s*logpush\s*=\s*true/m);
    expect(toml).not.toMatch(/tail_consumers/);
    expect(toml).not.toMatch(/head_sampling_rate|invocation_logs/);
  });
});
