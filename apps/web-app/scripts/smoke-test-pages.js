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

import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

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

// Phase 1: the deployment alias is live the moment `wrangler pages deploy`
// returns, so this budget only absorbs edge warm-up.
const REACH_ATTEMPTS = 6;
// Phase 2: the custom domain has to pick up the new production deployment.
// Normally seconds; budgeted generously so ordinary alias lag never fails a
// deploy that actually worked.
const CONVERGE_ATTEMPTS = 36;
const DELAY_MS = 5000;

const REQUEST_INIT = {
  headers: {
    'User-Agent': 'xivdyetools-ci',
    // Phase 2 asks "has the alias moved yet?" — a cached answer is precisely the
    // wrong one, so ask the edge to revalidate.
    'Cache-Control': 'no-cache',
  },
  redirect: 'follow',
};

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/** One GET, never throwing. `detail` is always a human-readable cause. */
async function attempt(fetchImpl, url) {
  try {
    const res = await fetchImpl(url, REQUEST_INIT);
    const body = Buffer.from(await res.arrayBuffer());
    return { ok: res.ok, detail: `HTTP ${res.status}`, body, headers: res.headers };
  } catch (error) {
    return { ok: false, detail: `request failed: ${error.message}`, body: null, headers: null };
  }
}

export async function smokeTestPages({
  deploymentUrl,
  domain,
  expectRobots,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const alias = new URL('/', deploymentUrl).toString();
  const site = new URL('/', domain).toString();
  const fail = (message) => ({ ok: false, failures: [message], summary: '' });

  // ---- Phase 1: the build we just uploaded serves at all -------------------
  let aliasBody = null;
  let aliasDetail = 'no attempt made';
  for (let i = 1; i <= REACH_ATTEMPTS; i++) {
    const result = await attempt(fetchImpl, alias);
    aliasDetail = result.detail;
    if (result.ok) {
      aliasBody = result.body;
      break;
    }
    if (i < REACH_ATTEMPTS) await sleep(DELAY_MS);
  }
  if (aliasBody === null) {
    // Deliberately does not mention the custom domain: the deployment itself
    // never served, so the domain is not the story.
    return fail(
      `deployment ${alias} never returned 2xx after ${REACH_ATTEMPTS} attempts (last: ${aliasDetail}); the upload succeeded but the deployment is not serving`
    );
  }
  const want = sha256(aliasBody);

  // ---- Phase 2: the custom domain has caught up to THIS build --------------
  let domainHeaders = null;
  let domainEverAnswered = false;
  let domainDetail = 'no attempt made';
  for (let i = 1; i <= CONVERGE_ATTEMPTS; i++) {
    const result = await attempt(fetchImpl, site);
    domainDetail = result.detail;
    if (result.ok) {
      domainEverAnswered = true;
      if (sha256(result.body) === want) {
        domainHeaders = result.headers;
        break;
      }
    }
    if (i < CONVERGE_ATTEMPTS) await sleep(DELAY_MS);
  }
  if (domainHeaders === null) {
    // Two different problems, two different sentences. A 522 reported as "serves
    // a different build" would send the operator to the wrong system.
    return domainEverAnswered
      ? fail(
          `${site} answered but still serves a different build than ${alias} after ${(CONVERGE_ATTEMPTS * DELAY_MS) / 1000}s; the deploy succeeded and the Pages alias has not picked it up`
        )
      : fail(
          `${site} never returned 2xx (last: ${domainDetail}); the deployment is live at ${alias}, so this is the domain, not the build`
        );
  }

  // ---- Phase 3: robots policy, on the only host where it is ours -----------
  const robots = domainHeaders.get('x-robots-tag');
  const hasNoindex = /\bnoindex\b/i.test(robots ?? '');
  const failures = [];

  if (expectRobots === 'noindex' && !hasNoindex) {
    failures.push(
      `${site} is served without X-Robots-Tag: noindex (got: ${robots ?? '<absent>'}); a beta build must not be indexable`
    );
  }
  if (expectRobots === 'none' && hasNoindex) {
    failures.push(
      `${site} is served WITH X-Robots-Tag: ${robots}; production must stay indexable — did a beta build reach production?`
    );
  }

  return {
    ok: failures.length === 0,
    failures,
    summary: `${site} serves this deployment (sha256 ${want.slice(0, 12)}), robots as expected for --expect-robots ${expectRobots}.`,
  };
}

// Guarded so importing this module from tests does not run the CLI. Under vitest
// process.argv[1] is the vitest binary, so this is false.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`::error::smoke-test-pages: ${error.message}`);
    process.exit(1);
  }

  console.log(`Smoke testing ${options.deploymentUrl} then ${options.domain}`);
  const { ok, failures, summary } = await smokeTestPages(options);

  if (!ok) {
    console.error('Pages smoke test FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    console.error(`::error::${failures[0]}`);
    process.exit(1);
  }
  console.log(summary);
}
