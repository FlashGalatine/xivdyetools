/**
 * Smoke-test a Cloudflare Pages deployment end to end.
 *
 * Runs after `pages deploy` in both web-app workflows. Three phases, each
 * guarding a failure mode the others cannot see:
 *
 *   1. The deployment alias returns 2xx           -> this build serves at all
 *   2. The custom domain serves the same bytes    -> the domain is on THIS build
 *   3. x-robots-tag matches the environment       -> beta hidden, production not
 *
 * Phase 2 exists to make phase 3 trustworthy. A Pages custom domain is a mutable
 * alias that keeps serving the PREVIOUS deployment until propagation finishes, so
 * without it phase 3 could describe the build before this one.
 *
 * Phase 3 cannot be asserted on the alias: Cloudflare injects
 * `x-robots-tag: noindex` onto every *.pages.dev hostname itself, so the header is
 * only build-determined on the custom domain. See
 * docs/superpowers/specs/2026-08-10-pages-smoke-test-design.md
 *
 * Usage:
 *   node scripts/smoke-test-pages.js \
 *     --deployment-url <url> --domain <url> --expect-robots noindex|none
 */

export const ROBOTS_MODES = ['noindex', 'none'];

export function parseArgs(argv) {
  const values = new Map();

  for (let i = 0; i < argv.length; i++) {
    const match = /^--([a-z][a-z-]*)(?:=([\s\S]*))?$/.exec(argv[i]);
    if (!match) throw new Error(`unexpected argument: ${argv[i]}`);

    const [, name, inline] = match;
    if (inline !== undefined) {
      values.set(name, inline);
      continue;
    }

    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) throw new Error(`--${name} needs a value`);
    values.set(name, next);
    i++;
  }

  const deploymentUrl = values.get('deployment-url') ?? '';
  const domain = values.get('domain') ?? '';
  const expectRobots = values.get('expect-robots') ?? '';

  // Deliberately the first and loudest check. An empty value here means
  // wrangler-action produced no deployment URL, which would otherwise reduce this
  // whole gate to a silent no-op.
  if (!deploymentUrl) {
    throw new Error(
      '--deployment-url is empty or missing: wrangler-action produced no deployment URL, so there is nothing to smoke test'
    );
  }
  if (!domain) throw new Error('--domain is required');
  if (!ROBOTS_MODES.includes(expectRobots)) {
    throw new Error(`--expect-robots must be ${ROBOTS_MODES.join('|')}, got "${expectRobots}"`);
  }

  return { deploymentUrl, domain, expectRobots };
}
