/**
 * Smoke-test a Cloudflare Pages deployment end to end.
 *
 * Runs after `pages deploy` in both web-app workflows. Five phases, each
 * guarding a failure mode the others cannot see:
 *
 *   1. The deployment alias returns 2xx           -> this build serves at all
 *   2. The custom domain serves the same bytes    -> the domain is on THIS build
 *   3. Response headers on the custom domain:
 *        - x-robots-tag matches the environment   -> beta hidden, production not
 *        - the security headers are all present   -> CSP (with frame-ancestors),
 *          X-Frame-Options, HSTS and Permissions-Policy, in both modes
 *   4. /licenses/xivcharakit.txt on the custom domain serves the notice text as
 *      text/plain                                 -> the .chara reader's license
 *          shipped (checked by body: _redirects turns a missing file into a 200
 *          carrying index.html)
 *   5. In project mode: current custom/Pages/hash/reported branch origins match
 *      this build and dist/_headers CSP; retired aliases/hashes return actual 404.
 *
 * Phase 2 exists to make phase 3 trustworthy. A Pages custom domain is a mutable
 * alias that keeps serving the PREVIOUS deployment until propagation finishes, so
 * without it phase 3 could describe the build before this one.
 *
 * Phase 3's robots assertion runs on the custom domain only. Cloudflare injects
 * `x-robots-tag: noindex` onto every *.pages.dev hostname itself, so that header is
 * only build-determined on the custom domain; and the security headers are the
 * ones users actually receive there. The security check exists because a beta
 * build once appended a second `/*` rule to dist/_headers: Pages keys rules by
 * path, an identical pattern declared twice is last-wins, and the security-header
 * rule was silently replaced (beta served none of them from 2026-08-09) while the
 * robots-only check kept passing. See
 * docs/superpowers/specs/2026-08-10-pages-smoke-test-design.md
 *
 * Usage:
 *   node scripts/smoke-test-pages.js \
 *     --deployment-url <url> --domain <url> --expect-robots noindex|none \
 *     --project xivdyetools|xivdyetools-beta --commit <full-sha> \
 *     --headers-file dist/_headers
 * Project mode also requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN
 * (Pages Read); it never mutates Cloudflare resources.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { inspectPagesDeployment, parseRetentionArgs } from './retain-pages-deployments.mjs';

export const ROBOTS_MODES = ['noindex', 'none'];

/** Headers public/_headers sets on `/*` that must reach the custom domain in both modes. */
export const REQUIRED_SECURITY_HEADERS = [
  'content-security-policy',
  'x-frame-options',
  'strict-transport-security',
  'permissions-policy',
];

/**
 * The .chara reader's license notice (public/licenses/xivcharakit.txt, written by
 * scripts/copy-chara-notices.mjs). public/_redirects answers EVERY unknown path
 * with index.html and a 200, so a missing file still "returns 2xx": only the
 * served body proves the notice shipped. The markers are the MIT grant and the
 * heading of the package's THIRD_PARTY_NOTICES.md, both copied verbatim.
 */
export const READER_NOTICE = {
  path: '/licenses/xivcharakit.txt',
  markers: ['Permission is hereby granted', '# Third-party notices'],
};

// `frame-ancestors` as a directive name: at the start of the policy or right after
// a `;`. A bare substring test would accept it inside another directive's value.
const FRAME_ANCESTORS_DIRECTIVE = /(?:^|;)\s*frame-ancestors(?:\s|;|$)/i;

export function parseArgs(argv) {
  const values = new Map();

  for (let i = 0; i < argv.length; i++) {
    const match = /^--([a-z][a-z-]*)(?:=([\s\S]*))?$/.exec(argv[i]);
    if (!match) throw new Error(`unexpected argument: ${argv[i]}`);

    const [, name, inline] = match;
    if (
      !['deployment-url', 'domain', 'expect-robots', 'project', 'commit', 'headers-file'].includes(
        name
      )
    )
      throw new Error(`unexpected argument: --${name}`);
    if (values.has(name)) throw new Error(`duplicate argument: --${name}`);
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

  // Without this, a malformed URL dies inside `new URL()` in smokeTestPages as an
  // uncaught TypeError -- no ::error:: annotation, so unlike every other failure
  // path here it would not surface on the run summary.
  for (const [flag, value] of [
    ['--deployment-url', deploymentUrl],
    ['--domain', domain],
  ]) {
    try {
      new URL(value);
    } catch {
      throw new Error(`${flag} is not a valid absolute URL: "${value}"`);
    }
  }

  const project = values.get('project');
  const commit = values.get('commit');
  const headersFile = values.get('headers-file');
  if (project || commit || headersFile) {
    if (!project || !commit || !headersFile)
      throw new Error('--project, --commit and --headers-file must be supplied together');
    parseRetentionArgs([
      '--project',
      project,
      '--deployment-url',
      deploymentUrl,
      '--commit',
      commit,
    ]);
    return { deploymentUrl, domain, expectRobots, project, commit, headersFile };
  }
  return { deploymentUrl, domain, expectRobots };
}

// Read the policy actually shipped by this build, including beta transformations.
// A duplicate catch-all rule is last-wins on Pages and must never be normalized
// into a policy that was not served. Duplicate CSP directives are also rejected.
export function readBuiltCsp(headersText) {
  let catchAllCount = 0;
  let inCatchAll = false;
  const policies = [];
  for (const line of headersText.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (/^\S/.test(line)) {
      inCatchAll = line.trim() === '/*';
      if (inCatchAll) catchAllCount++;
    } else if (inCatchAll) {
      const match = /^\s+content-security-policy:\s*(.+)$/i.exec(line);
      if (match) policies.push(match[1].trim());
    }
  }
  if (catchAllCount !== 1 || policies.length !== 1)
    throw new Error('Built _headers must contain one catch-all rule and one CSP');
  normalizeCsp(policies[0]);
  return policies[0];
}

function normalizeCsp(policy) {
  if (typeof policy !== 'string' || !policy.trim()) throw new Error('CSP missing');
  const directives = new Map();
  for (const part of policy.split(';')) {
    const tokens = part.trim().split(/\s+/);
    if (!tokens[0]) continue;
    const name = tokens.shift().toLowerCase();
    if (!/^[a-z][a-z-]*$/.test(name) || directives.has(name))
      throw new Error('CSP malformed or duplicate directive');
    directives.set(name, [...new Set(tokens)].sort());
  }
  if (!directives.size) throw new Error('CSP missing');
  return JSON.stringify([...directives].sort(([a], [b]) => a.localeCompare(b)));
}

const RETIRED_ORIGINS = {
  xivdyetools: [
    'https://v4-ui-migration.xiv-colorexplorer.pages.dev/',
    'https://66496174.xiv-colorexplorer.pages.dev/',
    'https://1c989934.xiv-colorexplorer.pages.dev/',
  ],
  'xivdyetools-beta': ['https://ecc7fb76.xivdyetools-beta.pages.dev/'],
};

/** Require actual 404s, never network failures or redirects, for retired hosts. */
export async function checkPagesOrigins({
  project,
  current,
  expectedCsp,
  expectedBody,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  if (!Object.hasOwn(RETIRED_ORIGINS, project)) throw new Error('Unexpected Pages project');
  const wantCsp = normalizeCsp(expectedCsp);
  const wantHash = sha256(expectedBody);
  const positive = [
    ...new Set(
      [
        current.canonical.url,
        ...current.domains.map((host) => `https://${host}`),
        ...current.canonical.aliases,
      ].map((url) => new URL('/', url).href)
    ),
  ];
  const failures = [];
  // Metadata has already been checked by inspectPagesDeployment. No arbitrary
  // CLI origin list is accepted. Use manual redirects and bounded fetches so a
  // hash alias redirecting elsewhere cannot impersonate a preserved deployment.
  for (const url of positive) {
    let detail = '';
    for (let attemptNumber = 1; attemptNumber <= CONVERGE_ATTEMPTS; attemptNumber++) {
      try {
        const res = await fetchImpl(url, {
          ...REQUEST_INIT,
          redirect: 'manual',
          signal: AbortSignal.timeout(20000),
        });
        if (res.status !== 200) {
          detail = `HTTP ${res.status}`;
          await res.body?.cancel();
        } else if (sha256(Buffer.from(await res.arrayBuffer())) !== wantHash)
          detail = 'serves a different build';
        else {
          try {
            detail =
              normalizeCsp(res.headers.get('content-security-policy')) === wantCsp
                ? ''
                : 'CSP differs from built _headers';
          } catch {
            detail = 'CSP missing, malformed or duplicated';
          }
          // Once the expected build is served, retrying a bad CSP cannot turn
          // that deployment into a safe one. Report its policy immediately.
          break;
        }
      } catch (error) {
        detail = `request failed: ${error.message}`;
      }
      if (attemptNumber < CONVERGE_ATTEMPTS) await sleep(DELAY_MS);
    }
    if (detail) failures.push(`${url} ${detail}`);
  }
  for (const url of RETIRED_ORIGINS[project]) {
    let detail = '';
    for (let attemptNumber = 1; attemptNumber <= NOTICE_ATTEMPTS; attemptNumber++) {
      try {
        const res = await fetchImpl(url, {
          ...REQUEST_INIT,
          redirect: 'manual',
          signal: AbortSignal.timeout(20000),
        });
        // Release the unused body even on 404; repeated probes must not retain
        // connections while waiting for propagation or a transient edge error.
        await res.body?.cancel();
        detail = res.status === 404 ? '' : `HTTP ${res.status}; expected actual HTTP 404`;
      } catch (error) {
        detail = `request failed: ${error.message}; expected actual HTTP 404`;
      }
      if (!detail) break;
      if (attemptNumber < NOTICE_ATTEMPTS) await sleep(DELAY_MS);
    }
    if (detail) failures.push(`${url} ${detail}`);
  }
  return failures;
}

// Phase 1: the deployment alias is *usually* live the moment `wrangler pages
// deploy` returns, but not always — on 2026-08-21 a beta deploy (8add1630)
// answered 404 for more than 25 s after the upload succeeded and then served
// fine, failing the old 6-attempt (~25 s) budget on a deploy that worked. Two
// minutes absorbs that propagation lag without hiding a genuinely dead
// deployment for long.
const REACH_ATTEMPTS = 24;
// Phase 2: the custom domain has to pick up the new production deployment.
// Normally seconds; budgeted generously so ordinary alias lag never fails a
// deploy that actually worked.
const CONVERGE_ATTEMPTS = 36;
const DELAY_MS = 5000;
// CONVERGE_ATTEMPTS attempts sleep between attempts, not after each one, so the
// budget is (CONVERGE_ATTEMPTS - 1) sleeps, not CONVERGE_ATTEMPTS.
const CONVERGE_BUDGET_S = ((CONVERGE_ATTEMPTS - 1) * DELAY_MS) / 1000;
// Phase 4: the domain already serves this build by then, so this only absorbs a
// transient edge error, not propagation lag.
const NOTICE_ATTEMPTS = 3;

// `X-Robots-Tag` is a comma-separated directive list, and four of its keys take a
// value that is not a robots state: `max-image-preview:none` does not mean noindex.
// Anything else before a colon is a user-agent (`googlebot: none`), whose value is a
// real directive and must still count.
const PARAMETER_DIRECTIVES =
  /\b(?:max-snippet|max-image-preview|max-video-preview|unavailable_after)\s*:\s*[^,]*/gi;

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
  project,
  commit,
  expectedCsp,
  accountId = process.env.CLOUDFLARE_ACCOUNT_ID,
  token = process.env.CLOUDFLARE_API_TOKEN,
  apiFetchImpl = fetch,
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
          `${site} answered but still serves a different build than ${alias} after ${CONVERGE_BUDGET_S}s; either the Pages alias has not picked up this deployment, or a zone feature that rewrites HTML (Rocket Loader, Email Obfuscation) is mutating the response so the bytes can never match`
        )
      : fail(
          `${site} never returned 2xx (last: ${domainDetail}); the deployment is live at ${alias}, so this is the domain, not the build`
        );
  }

  // ---- Phase 3: robots + security headers, on the only host where they are ours
  const robots = domainHeaders.get('x-robots-tag');
  // `none` is defined as equivalent to `noindex, nofollow`, so it counts as
  // noindex here -- a production site served `none` is just as deindexed.
  const hasNoindex = /\b(noindex|none)\b/i.test((robots ?? '').replace(PARAMETER_DIRECTIVES, ''));
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

  const missing = REQUIRED_SECURITY_HEADERS.filter(
    (name) => (domainHeaders.get(name) ?? '').trim() === ''
  );
  const csp = domainHeaders.get('content-security-policy') ?? '';
  if (csp.trim() !== '' && !FRAME_ANCESTORS_DIRECTIVE.test(csp)) {
    missing.push('content-security-policy frame-ancestors directive');
  }
  if (missing.length > 0) {
    failures.push(
      `${site} is missing security headers: ${missing.join(', ')}. The likely cause is a path pattern declared twice in dist/_headers (e.g. a second \`/*\` rule): Cloudflare Pages lets the later identical pattern replace the earlier one rather than merge them`
    );
  }

  // ---- Phase 4: the reader license notice ships, as a file, not the SPA ----
  const noticeFailure = await checkReaderNotice(fetchImpl, sleep, domain, want);
  if (noticeFailure) failures.push(noticeFailure);

  if (project) {
    try {
      const metadataOptions = {
        project,
        deploymentUrl,
        commit,
        accountId,
        token,
        fetchImpl: apiFetchImpl,
        sleep,
      };
      const current = await inspectPagesDeployment(metadataOptions);
      const custom = current.domains.find((host) => !host.endsWith('.pages.dev'));
      if (
        new URL(domain).origin !== `https://${custom}` ||
        expectRobots !== (project === 'xivdyetools' ? 'none' : 'noindex')
      )
        throw new Error('Pages project does not match the smoke domain or robots mode');
      failures.push(
        ...(await checkPagesOrigins({
          project,
          current,
          expectedCsp,
          expectedBody: aliasBody,
          fetchImpl,
          sleep,
        }))
      );
      const after = await inspectPagesDeployment(metadataOptions);
      if (JSON.stringify(current) !== JSON.stringify(after))
        throw new Error('Current Pages metadata changed during origin probes');
    } catch (error) {
      failures.push(`Pages live-origin verification: ${error.message}`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    summary: `${site} serves this deployment (sha256 ${want.slice(0, 12)}), robots as expected for --expect-robots ${expectRobots}, security headers present, reader license notice served.${project ? ' Current Pages origins match build/CSP; retired origins return actual 404.' : ''}`,
  };
}

/**
 * Returns a failure sentence, or null when the custom domain serves the notice.
 * `indexSha` is the converged page's hash: the SPA fallback answers with exactly
 * those bytes, which is the failure this check exists to name.
 */
async function checkReaderNotice(fetchImpl, sleep, domain, indexSha) {
  const url = new URL(READER_NOTICE.path, domain).toString();
  let result = null;
  for (let i = 1; i <= NOTICE_ATTEMPTS; i++) {
    result = await attempt(fetchImpl, url);
    if (result.ok) break;
    if (i < NOTICE_ATTEMPTS) await sleep(DELAY_MS);
  }
  if (!result.ok) {
    return `${url} never returned 2xx after ${NOTICE_ATTEMPTS} attempts (last: ${result.detail}); the .chara reader's license notice is not being served`;
  }

  const body = result.body.toString('utf8');
  const contentType = result.headers.get('content-type') ?? '';
  if (sha256(result.body) === indexSha || /^\s*<(?:!doctype|html)\b/i.test(body)) {
    return `${url} answered with the SPA's index.html (the _redirects fallback), so public/licenses/xivcharakit.txt did not ship; the build's copy-chara-notices step writes it`;
  }
  const missing = READER_NOTICE.markers.filter((marker) => !body.includes(marker));
  if (missing.length > 0) {
    return `${url} is served but lacks ${missing.map((m) => `"${m}"`).join(' and ')}; it is not the xivcharakit license and third-party notice copy-chara-notices generates`;
  }
  if (!/^text\/plain\s*;\s*charset=utf-8$/i.test(contentType.trim())) {
    return `${url} is served as ${contentType || '<no content-type>'}, not text/plain; charset=utf-8; check the /licenses/* rule in public/_headers`;
  }
  return null;
}

// Guarded so importing this module from tests does not run the CLI. Under vitest
// process.argv[1] is the vitest binary, so this is false.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    if (options.headersFile)
      options.expectedCsp = readBuiltCsp(readFileSync(options.headersFile, 'utf8'));
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
