/**
 * FINDING-009: keep the current deployment of the two web-app Pages projects.
 *
 * node scripts/retain-pages-deployments.mjs --project xivdyetools \
 *   --deployment-url https://<hash>.xiv-colorexplorer.pages.dev --commit <full-sha>
 *
 * Default: read-only dry-run. Deletion needs BOTH --apply and the protected
 * environment setting PAGES_RETENTION_APPLY=true. The deploy workflows omit
 * --apply deliberately; activating the setting alone cannot enable cleanup.
 * Token: CLOUDFLARE_API_TOKEN (Pages Read, or Pages Write for apply), account:
 * CLOUDFLARE_ACCOUNT_ID. No credentials or raw API bodies are logged.
 *
 * API: https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/delete/
 * `force` only allows deletion of aliased non-production deployments. It is not
 * a fallback for API errors. Pages has no documented conditional DELETE: fresh
 * checks and workflow serialization reduce races, but cannot make an external
 * rollback between the final GET and DELETE atomic. An ambiguous DELETE stops
 * the run without replay; inspect fresh state before another run.
 */
import { pathToFileURL } from 'node:url';

const ACCOUNT_ID = '9390470022b5544dc04854638fdf8c51';
const PROJECTS = {
  xivdyetools: {
    id: '1f8b22b8-5dc1-4294-acff-ac9bbaf3e697',
    subdomain: 'xiv-colorexplorer.pages.dev',
    domain: 'xivdyetools.app',
    branch: 'main',
  },
  'xivdyetools-beta': {
    id: 'a79b5fda-613d-4cb9-8e3e-81c7358429d7',
    subdomain: 'xivdyetools-beta.pages.dev',
    domain: 'beta.xivdyetools.app',
    branch: 'beta',
  },
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA = /^[0-9a-f]{40}$/;
const TERMINAL = new Set(['success', 'failure', 'canceled', 'skipped']);
const STAGES = new Set(['queued', 'initialize', 'clone_repo', 'build', 'deploy']);
const PAGE_SIZE = 25;
const MAX_PAGES = 200;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const fail = (message) => {
  throw new Error(message);
};
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const configFor = (project) =>
  Object.hasOwn(PROJECTS, project) ? PROJECTS[project] : fail('Unexpected Pages project');

function origin(value) {
  if (typeof value !== 'string') fail('Invalid Pages URL');
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    fail('Pages URL must be an HTTPS origin');
  return url.origin;
}

function validateOptions({ project, deploymentUrl, commit }) {
  const config = configFor(project);
  const url = origin(deploymentUrl);
  const host = new URL(url).hostname;
  if (
    !/^[0-9a-f]{8}$/.test(host.split('.')[0]) ||
    host !== `${host.split('.')[0]}.${config.subdomain}`
  )
    fail('Unexpected deployment URL');
  if (!SHA.test(commit)) fail('Expected a full lowercase commit SHA');
  return config;
}

export function parseRetentionArgs(argv) {
  const values = new Map();
  for (let i = 0; i < argv.length; i++) {
    const match = /^--(project|deployment-url|commit|apply)(?:=([\s\S]*))?$/.exec(argv[i]);
    if (!match) fail('Unknown retention argument');
    const [, key, inline] = match;
    if (values.has(key)) fail(`Duplicate --${key}`);
    if (key === 'apply') {
      if (inline !== undefined) fail('--apply takes no value');
      values.set(key, true);
    } else {
      const value = inline ?? argv[++i];
      if (!value || value.startsWith('--')) fail(`--${key} needs a value`);
      values.set(key, value);
    }
  }
  const options = {
    project: values.get('project'),
    deploymentUrl: values.get('deployment-url'),
    commit: values.get('commit'),
    apply: values.get('apply') === true,
  };
  validateOptions(options);
  return options;
}

// Strict envelope checks apply even when HTTP status is successful. API error
// details are intentionally not copied into errors: they may echo request data.
function client({
  accountId,
  token,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  if (accountId !== ACCOUNT_ID) fail('Unexpected Cloudflare account');
  if (typeof token !== 'string' || !token.trim() || /[\r\n]/.test(token))
    fail('CLOUDFLARE_API_TOKEN is required');
  return async (method, path, { allowMissing = false } = {}) => {
    for (let attempt = 1; attempt <= (method === 'GET' ? 3 : 1); attempt++) {
      let response;
      try {
        response = await fetchImpl(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${path}`,
          {
            method,
            redirect: 'error',
            signal: AbortSignal.timeout(20000),
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          }
        );
      } catch {
        if (method === 'GET' && attempt < 3) {
          await sleep(attempt * 1000);
          continue;
        }
        fail(
          `${method} Pages request failed${method === 'DELETE' ? '; outcome ambiguous, not retried' : ''}`
        );
      }
      const missingResponse = allowMissing && method === 'GET' && response.status === 404;
      if (!response.ok && !missingResponse) {
        if (
          method === 'GET' &&
          (response.status === 429 || response.status >= 500) &&
          attempt < 3
        ) {
          await sleep(attempt * 1000);
          continue;
        }
        fail(
          `${method} Pages request HTTP ${response.status}${method === 'DELETE' ? '; not retried' : ''}`
        );
      }
      let data;
      try {
        // Bound real HTTP bodies; simple response doubles may expose json only.
        if (response.body?.getReader) {
          const reader = response.body.getReader();
          const chunks = [];
          let size = 0;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              size += value.byteLength;
              if (size > MAX_BODY_BYTES) fail('Pages API body exceeds limit');
              chunks.push(Buffer.from(value));
            }
          } finally {
            await reader.cancel();
          }
          data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } else data = await response.json();
      } catch {
        fail(`${method} Pages API malformed or oversized JSON`);
      }
      if (missingResponse) {
        // Only the specific Pages deployment-not-found response proves absence.
        // A proxy 404, malformed body or another API error is not reconciliation.
        if (
          response.ok ||
          !record(data) ||
          data.success !== false ||
          data.result !== null ||
          !Array.isArray(data.messages) ||
          !Array.isArray(data.errors) ||
          data.errors.length !== 1 ||
          data.errors[0]?.code !== 8000009 ||
          typeof data.errors[0]?.message !== 'string'
        )
          fail('GET Pages deletion reconciliation received an unexpected HTTP 404 envelope');
        return { absent: true };
      }
      if (
        !record(data) ||
        data.success !== true ||
        !Array.isArray(data.errors) ||
        data.errors.length ||
        !Array.isArray(data.messages) ||
        !Object.hasOwn(data, 'result')
      )
        fail(`${method} Pages API unsuccessful or malformed envelope`);
      return { result: data.result, result_info: data.result_info, absent: false };
    }
    fail('Pages request retry limit exceeded');
  };
}

function deployment(value, project, { current = false } = {}) {
  const config = configFor(project);
  if (
    !record(value) ||
    !UUID.test(value.id) ||
    value.project_id !== config.id ||
    value.project_name !== project
  )
    fail('Invalid deployment identity');
  if (!['production', 'preview'].includes(value.environment))
    fail('Invalid deployment environment');
  if (!STAGES.has(value.latest_stage?.name) || !TERMINAL.has(value.latest_stage?.status))
    fail('Nonterminal or invalid deployment state');
  if (
    current &&
    (value.environment !== 'production' ||
      value.latest_stage.name !== 'deploy' ||
      value.latest_stage.status !== 'success')
  )
    fail('Current deployment is not successful production');
  if (
    typeof value.created_on !== 'string' ||
    !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value.created_on) ||
    !Number.isFinite(Date.parse(value.created_on))
  )
    fail('Invalid deployment timestamp');
  const url = origin(value.url);
  if (url !== `https://${value.id.slice(0, 8)}.${config.subdomain}`)
    fail('Unexpected hash deployment origin');
  const metadata = value.deployment_trigger?.metadata;
  if (
    !record(metadata) ||
    typeof metadata.branch !== 'string' ||
    !metadata.branch ||
    metadata.branch.length > 255 ||
    !SHA.test(metadata.commit_hash) ||
    metadata.commit_dirty !== false
  )
    fail('Invalid deployment trigger metadata');
  const aliases = value.aliases === null ? [] : value.aliases;
  if (!Array.isArray(aliases) || aliases.length > 20) fail('Invalid deployment aliases');
  const normalized = aliases.map(origin).sort();
  if (new Set(normalized).size !== normalized.length) fail('Duplicate deployment aliases');
  const branchAlias = `https://${metadata.branch.toLowerCase().replace(/[^a-z0-9]/g, '-')}.${config.subdomain}`;
  const liveAliases = new Set([
    `https://${config.domain}`,
    `https://${config.subdomain}`,
    `https://${config.branch}.${config.subdomain}`,
  ]);
  for (const alias of normalized) {
    if (
      current
        ? !liveAliases.has(alias)
        : value.environment !== 'preview' || alias !== branchAlias || liveAliases.has(alias)
    )
      fail('Unexpected or protected deployment alias');
  }
  return {
    id: value.id,
    project_id: config.id,
    project_name: project,
    environment: value.environment,
    url,
    aliases: normalized,
    created_on: value.created_on,
    status: value.latest_stage.status,
    stage: value.latest_stage.name,
    branch: metadata.branch,
    commit: metadata.commit_hash,
  };
}

async function currentProject(request, options) {
  const { project, deploymentUrl, commit } = options;
  const config = configFor(project);
  const data = (await request('GET', project)).result;
  if (
    !record(data) ||
    data.id !== config.id ||
    data.name !== project ||
    data.subdomain !== config.subdomain ||
    data.production_branch !== config.branch
  )
    fail('Unexpected Pages project identity or branch');
  if (
    !Array.isArray(data.domains) ||
    !same([...data.domains].sort(), [config.domain, config.subdomain].sort())
  )
    fail('Unexpected Pages project domains');
  const canonical = deployment(data.canonical_deployment, project, { current: true });
  const latest = deployment(data.latest_deployment, project, { current: true });
  if (
    !same(canonical, latest) ||
    canonical.url !== origin(deploymentUrl) ||
    canonical.commit !== commit ||
    canonical.branch !== config.branch ||
    !canonical.aliases.includes(`https://${config.domain}`)
  )
    fail('Current deployment URL, commit or latest deployment changed');
  return {
    id: config.id,
    name: project,
    subdomain: config.subdomain,
    domains: [...data.domains].sort(),
    canonical,
    latest,
  };
}

/** Read-only metadata for smoke checks; does not inventory or delete history. */
export async function inspectPagesDeployment(options) {
  validateOptions(options);
  return currentProject(client(options), options);
}

async function inventory(request, project, current) {
  const rows = [];
  const ids = new Set();
  let totals;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await request('GET', `${project}/deployments?page=${page}&per_page=${PAGE_SIZE}`);
    const info = data.result_info;
    if (
      !Array.isArray(data.result) ||
      !record(info) ||
      !['page', 'per_page', 'count', 'total_count', 'total_pages'].every((k) =>
        Number.isSafeInteger(info[k])
      )
    )
      fail('Invalid inventory pagination');
    if (
      info.page !== page ||
      info.per_page < 1 ||
      info.per_page > PAGE_SIZE ||
      info.total_pages < 1 ||
      info.total_pages > MAX_PAGES ||
      info.total_count < 1 ||
      info.total_count > MAX_PAGES * PAGE_SIZE ||
      info.count !== data.result.length ||
      info.count < 1 ||
      info.count > info.per_page ||
      info.total_pages !== Math.ceil(info.total_count / info.per_page)
    )
      fail('Inconsistent inventory pagination');
    const signature = [info.per_page, info.total_count, info.total_pages];
    if (totals && !same(totals, signature)) fail('Inventory pagination changed');
    totals = signature;
    if (page < info.total_pages && info.count !== info.per_page) fail('Incomplete inventory page');
    for (const raw of data.result) {
      const row = deployment(raw, project, { current: raw.id === current.canonical.id });
      if (ids.has(row.id)) fail('Duplicate deployment in inventory');
      ids.add(row.id);
      if (
        row.id === current.canonical.id
          ? !same(row, current.canonical)
          : Date.parse(row.created_on) >= Date.parse(current.canonical.created_on)
      )
        fail('Inventory current deployment changed or candidate is newer');
      rows.push(row);
    }
    if (page === info.total_pages) {
      if (rows.length !== info.total_count || !ids.has(current.canonical.id))
        fail('Incomplete inventory or missing current deployment');
      return rows.sort((a, b) => a.id.localeCompare(b.id));
    }
  }
  fail('Inventory pagination limit exceeded');
}

export async function retainPagesDeployments(options) {
  validateOptions(options);
  if (options.apply && options.activation !== 'true')
    fail('Apply activation requires PAGES_RETENTION_APPLY=true');
  const request = client(options);
  const current = await currentProject(request, options);
  const rows = await inventory(request, options.project, current);
  const protectedId = current.canonical.id;
  const candidates = rows.filter((r) => r.id !== protectedId);
  const result = {
    project: options.project,
    mode: options.apply ? 'apply' : 'dry-run',
    protectedId,
    candidates: candidates.map((r) => r.id),
    deleted: [],
  };
  if (!same(current, await currentProject(request, options)))
    fail('Current project changed during inventory');
  if (!same(rows, await inventory(request, options.project, current)))
    fail('Deployment inventory changed; stop and re-inventory');
  if (!options.apply) return result;
  for (const candidate of candidates) {
    if (!same(current, await currentProject(request, options)))
      fail('Current project changed before deletion');
    const fresh = deployment(
      (await request('GET', `${options.project}/deployments/${candidate.id}`)).result,
      options.project
    );
    if (fresh.id === protectedId || !same(fresh, candidate))
      fail('Candidate changed before deletion');
    // Never expand permission in response to a failure. Only a validated preview
    // branch alias needs force; production candidates must have no aliases.
    const force = fresh.environment === 'preview' && fresh.aliases.length > 0;
    const receipt = await request(
      'DELETE',
      `${options.project}/deployments/${fresh.id}${force ? '?force=true' : ''}`
    );
    if (
      receipt.result !== null &&
      !(record(receipt.result) && Object.keys(receipt.result).length === 0)
    )
      fail('Malformed DELETE receipt; stop without replay');
    // Both null and {} are documented empty success bodies. Neither by itself
    // proves the deletion took effect: preserve current and confirm absence
    // through a separate GET before moving to the next candidate.
    if (!same(current, await currentProject(request, options)))
      fail('Current project changed during deletion reconciliation');
    const removed = await request('GET', `${options.project}/deployments/${fresh.id}`, {
      allowMissing: true,
    });
    if (!removed.absent) fail('Candidate still exists after DELETE; stop without replay');
    result.deleted.push(fresh.id);
  }
  if (!same(current, await currentProject(request, options)))
    fail('Current project changed after deletion');
  const remaining = await inventory(request, options.project, current);
  if (remaining.length !== 1 || remaining[0].id !== protectedId)
    fail('Post-delete inventory did not converge to current deployment');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await retainPagesDeployments({
      ...parseRetentionArgs(process.argv.slice(2)),
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
      activation: process.env.PAGES_RETENTION_APPLY,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`::error::Pages retention: ${error.message}`);
    process.exitCode = 1;
  }
}
