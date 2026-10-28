import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const script = resolve('scripts/retain-pages-deployments.mjs');
const load = () => import(pathToFileURL(script).href);
const ACCOUNT = '9390470022b5544dc04854638fdf8c51';
const CURRENT = '970e253a-083a-4d97-bdb2-8e8e2792dee4';
const OLD = '66496174-083a-4d97-bdb2-8e8e2792dee4';
const SHA = 'a'.repeat(40);
const URL_NOW = 'https://970e253a.xiv-colorexplorer.pages.dev';
const options = {
  project: 'xivdyetools',
  deploymentUrl: URL_NOW,
  commit: SHA,
  accountId: ACCOUNT,
  token: 'test-token',
};
const args = ['--project', options.project, '--deployment-url', URL_NOW, '--commit', SHA];
const clone = (v) => JSON.parse(JSON.stringify(v));
const row = (id = CURRENT, extra = {}) => ({
  id,
  project_id: '1f8b22b8-5dc1-4294-acff-ac9bbaf3e697',
  project_name: 'xivdyetools',
  environment: 'production',
  url: `https://${id.slice(0, 8)}.xiv-colorexplorer.pages.dev`,
  aliases: id === CURRENT ? ['https://xivdyetools.app'] : null,
  created_on: id === CURRENT ? '2026-10-28T12:00:00Z' : '2026-10-27T12:00:00Z',
  latest_stage: { name: 'deploy', status: 'success' },
  deployment_trigger: { metadata: { branch: 'main', commit_hash: SHA, commit_dirty: false } },
  ...extra,
});
const project = () => ({
  id: row().project_id,
  name: 'xivdyetools',
  subdomain: 'xiv-colorexplorer.pages.dev',
  production_branch: 'main',
  domains: ['xiv-colorexplorer.pages.dev', 'xivdyetools.app'],
  canonical_deployment: row(),
  latest_deployment: row(),
});
const envelope = (result, extra = {}) => ({
  success: true,
  errors: [],
  messages: [],
  result,
  ...extra,
});
const reply = (data, status = 200) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => clone(data),
});

// In-memory API, not a stub of the retention decisions: real code must inventory,
// revalidate and delete through its HTTP interface. Each test changes an input
// the real service can change and checks the resulting delete set or rejection.
function api({ rows = [row(), row(OLD)], pageSize = 25, deleteResult = {}, change } = {}) {
  let live = clone(rows);
  const calls = [];
  const fetchImpl = async (url, init) => {
    const u = new URL(url);
    const call = { url: u, method: init.method, init, number: calls.length + 1 };
    calls.push(call);
    const altered = change?.(call, { live, calls });
    if (altered !== undefined) return altered;
    if (init.method === 'DELETE') {
      const id = u.pathname.split('/').at(-1);
      live = live.filter((d) => d.id !== id);
      return reply(envelope(deleteResult));
    }
    if (u.pathname.endsWith('/deployments')) {
      const page = Number(u.searchParams.get('page'));
      const result = live.slice((page - 1) * pageSize, page * pageSize);
      return reply(
        envelope(result, {
          result_info: {
            page,
            per_page: pageSize,
            count: result.length,
            total_count: live.length,
            total_pages: Math.ceil(live.length / pageSize),
          },
        })
      );
    }
    if (u.pathname.includes('/deployments/')) {
      const d = live.find((d) => d.id === u.pathname.split('/').at(-1));
      return d
        ? reply(envelope(d))
        : reply(
            envelope(null, { success: false, errors: [{ code: 8000009, message: 'Not found' }] }),
            404
          );
    }
    return reply(envelope(project()));
  };
  return {
    fetchImpl,
    calls,
    deleted: () =>
      calls.filter((c) => c.method === 'DELETE').map((c) => c.url.pathname.split('/').at(-1)),
  };
}

describe('Pages retention interface and inactive workflow wiring', () => {
  it('provides the guarded script', () => expect(existsSync(script)).toBe(true));
  it('defaults to dry-run and requires a second activation gate for apply', async () => {
    const { parseRetentionArgs, retainPagesDeployments } = await load();
    expect(parseRetentionArgs(args).apply).toBe(false);
    expect(parseRetentionArgs([...args, '--apply']).apply).toBe(true);
    const service = api();
    await expect(
      retainPagesDeployments({ ...options, ...service, apply: true, activation: 'false' })
    ).rejects.toThrow(/activation/i);
    expect(service.calls).toEqual([]);
  });
  it('rejects duplicate flags, unknown options and projects, non-origin URLs, and incomplete SHAs', async () => {
    const { parseRetentionArgs } = await load();
    for (const bad of [
      [...args, '--apply=false'],
      [...args, '--commit', SHA],
      [...args, '--force'],
      args.map((x) => (x === 'xivdyetools' ? 'xivdyetools-api-docs' : x)),
      args.map((x) => (x === URL_NOW ? URL_NOW + '/path' : x)),
      args.map((x) => (x === SHA ? 'abcdef1' : x)),
    ]) {
      expect(() => parseRetentionArgs(bad)).toThrow();
    }
  });
  for (const [file, name, token] of [
    ['deploy-web-app.yml', 'xivdyetools', 'CLOUDFLARE_API_TOKEN'],
    ['deploy-web-app-beta.yml', 'xivdyetools-beta', 'CLOUDFLARE_API_TOKEN_BETA'],
  ]) {
    it(`${file} binds smoke and dry-run retention to this deploy without activating deletion`, () => {
      const yaml = readFileSync(resolve(`../../.github/workflows/${file}`), 'utf8');
      const smoke = yaml.slice(yaml.indexOf('      - name: Smoke test'));
      expect(smoke).toContain(`--project ${name}`);
      expect(smoke).toContain('--commit "$EXPECTED_COMMIT"');
      expect(smoke).toContain('--headers-file dist/_headers');
      expect(smoke).toContain(`secrets.${token}`);
      expect(smoke).toContain('name: Pages retention (dry-run; activation deferred)');
      expect(smoke).toContain('node scripts/retain-pages-deployments.mjs');
      expect(smoke).toContain('PAGES_RETENTION_APPLY: ${{ vars.PAGES_RETENTION_APPLY }}');
      expect(smoke).not.toMatch(/^\s+--apply(?:\s|$)/m);
      expect(smoke).toContain('EXPECTED_COMMIT: ${{ github.sha }}');
      expect(smoke).toContain('DEPLOYMENT_URL: ${{ steps.deploy.outputs.deployment-url }}');
    });
  }
});

describe('complete inventory and guarded deletion', () => {
  it.each([
    ['empty object', {}],
    ['null', null],
  ])(
    'reconciles each %s DELETE receipt before deleting the next candidate',
    async (_name, deleteResult) => {
      const older = '11223344-083a-4d97-bdb2-8e8e2792dee4';
      const service = api({ rows: [row(), row(OLD), row(older)], deleteResult });
      const result = await (
        await load()
      ).retainPagesDeployments({ ...options, ...service, apply: true, activation: 'true' });
      expect(result.deleted).toEqual([older, OLD]);
      const first = service.calls.findIndex((c) => c.method === 'DELETE');
      expect(service.calls[first + 1].method).toBe('GET');
      expect(service.calls[first + 1].url.pathname).toMatch(/\/projects\/xivdyetools$/);
      expect(service.calls[first + 2].method).toBe('GET');
      expect(service.calls[first + 2].url.pathname).toMatch(
        new RegExp('/deployments/' + older + '$')
      );
    }
  );
  it('preserves the unprocessed candidate after an empty-object success followed by an API error', async () => {
    const older = '11223344-083a-4d97-bdb2-8e8e2792dee4';
    let survivors;
    const service = api({
      rows: [row(), row(OLD), row(older)],
      change: (c, state) => {
        if (c.method === 'DELETE' && c.url.pathname.endsWith('/' + OLD)) {
          survivors = state.live.map((d) => d.id);
          return reply(
            envelope(null, { success: false, errors: [{ code: 1, message: 'Denied' }] })
          );
        }
      },
    });
    await expect(
      (await load()).retainPagesDeployments({
        ...options,
        ...service,
        apply: true,
        activation: 'true',
      })
    ).rejects.toThrow(/DELETE.*envelope/);
    expect(survivors).toEqual([CURRENT, OLD]);
    expect(service.deleted()).toEqual([older, OLD]);
    expect(
      service.calls.filter((c) => c.method === 'DELETE' && c.url.pathname.endsWith('/' + OLD))
    ).toHaveLength(1);
  });
  it('does not continue after a success receipt if the candidate still exists', async () => {
    const older = '11223344-083a-4d97-bdb2-8e8e2792dee4';
    const service = api({
      rows: [row(), row(OLD), row(older)],
      change: (c) => (c.method === 'DELETE' ? reply(envelope({})) : undefined),
    });
    await expect(
      (await load()).retainPagesDeployments({
        ...options,
        ...service,
        apply: true,
        activation: 'true',
      })
    ).rejects.toThrow(/still exists|reconcil/i);
    expect(service.deleted()).toEqual([older]);
  });
  it.each([
    [
      'unexpected code',
      envelope(null, { success: false, errors: [{ code: 9999999, message: 'Other error' }] }),
    ],
    ['malformed envelope', { success: false, result: null }],
    ['success-marked 404', envelope(null)],
  ])('rejects %s from post-delete absence reconciliation', async (_name, data) => {
    const service = api({
      change: (c, state) =>
        c.method === 'GET' &&
        c.url.pathname.endsWith('/deployments/' + OLD) &&
        state.calls.some((prior) => prior.method === 'DELETE')
          ? reply(data, 404)
          : undefined,
    });
    await expect(
      (await load()).retainPagesDeployments({
        ...options,
        ...service,
        apply: true,
        activation: 'true',
      })
    ).rejects.toThrow(/reconcil|404/);
    expect(service.deleted()).toEqual([OLD]);
  });
  it.each([{ unexpected: true }, [], '', 0])(
    'rejects an unexpected nonempty DELETE result %j',
    async (deleteResult) => {
      const service = api({ deleteResult });
      await expect(
        (await load()).retainPagesDeployments({
          ...options,
          ...service,
          apply: true,
          activation: 'true',
        })
      ).rejects.toThrow(/receipt/);
      expect(service.deleted()).toEqual([OLD]);
    }
  );
  it('reports superseded IDs without DELETE by default, accepting null aliases', async () => {
    const service = api();
    const result = await (await load()).retainPagesDeployments({ ...options, ...service });
    expect(result).toMatchObject({
      mode: 'dry-run',
      protectedId: CURRENT,
      candidates: [OLD],
      deleted: [],
    });
    expect(service.deleted()).toEqual([]);
  });
  it('reads every page twice before its first deletion, then preserves current', async () => {
    const service = api({ pageSize: 1 });
    const result = await (
      await load()
    ).retainPagesDeployments({ ...options, ...service, apply: true, activation: 'true' });
    expect(result.deleted).toEqual([OLD]);
    expect(service.deleted()).toEqual([OLD]);
    const firstDelete = service.calls.findIndex((c) => c.method === 'DELETE');
    const lists = service.calls
      .slice(0, firstDelete)
      .filter((c) => c.url.pathname.endsWith('/deployments'));
    expect(lists.map((c) => c.url.searchParams.get('page'))).toEqual(['1', '2', '1', '2']);
    expect(
      service.calls
        .filter((c) => c.method === 'DELETE')
        .every((c) => !c.url.searchParams.has('force'))
    ).toBe(true);
  });
  it.each([
    ['wrong identity', () => ({ ...project(), id: 'wrong' })],
    ['wrong domains', () => ({ ...project(), domains: ['evil.test'] })],
    ['wrong branch', () => ({ ...project(), production_branch: 'elsewhere' })],
    ['changed current', () => ({ ...project(), canonical_deployment: row(OLD) })],
    ['changed latest', () => ({ ...project(), latest_deployment: row(OLD) })],
    [
      'wrong commit',
      () => ({
        ...project(),
        canonical_deployment: row(CURRENT, {
          deployment_trigger: {
            metadata: { branch: 'main', commit_hash: 'b'.repeat(40), commit_dirty: false },
          },
        }),
      }),
    ],
  ])('rejects %s before deleting', async (_name, changed) => {
    const service = api({
      change: (c) =>
        c.url.pathname.endsWith('/xivdyetools') ? reply(envelope(changed())) : undefined,
    });
    await expect(
      (await load()).retainPagesDeployments({
        ...options,
        ...service,
        apply: true,
        activation: 'true',
      })
    ).rejects.toThrow();
    expect(service.deleted()).toEqual([]);
  });
  it.each([
    ['duplicate IDs', [row(), row(OLD), row(OLD)]],
    ['foreign project', [row(), row(OLD, { project_name: 'xivdyetools-beta' })]],
    ['invalid UUID', [row(), row('bad')]],
    ['nonterminal', [row(), row(OLD, { latest_stage: { name: 'deploy', status: 'active' } })]],
    ['invalid aliases', [row(), row(OLD, { aliases: {} })]],
    ['unrecognized alias', [row(), row(OLD, { aliases: ['https://evil.test'] })]],
    ['live alias on candidate', [row(), row(OLD, { aliases: ['https://xivdyetools.app'] })]],
    ['newer candidate', [row(), row(OLD, { created_on: '2026-10-29T12:00:00Z' })]],
    ['missing current', [row(OLD)]],
  ])('rejects %s in inventory', async (_name, rows) => {
    const service = api({ rows });
    await expect(
      (await load()).retainPagesDeployments({
        ...options,
        ...service,
        apply: true,
        activation: 'true',
      })
    ).rejects.toThrow();
    expect(service.deleted()).toEqual([]);
  });
  it.each(['missing', 'wrong page', 'wrong count', 'wrong total', 'unbounded'])(
    'rejects %s pagination',
    async (kind) => {
      const service = api({
        change: (c) => {
          if (!c.url.pathname.endsWith('/deployments')) return;
          const info = { page: 1, per_page: 25, count: 2, total_count: 2, total_pages: 1 };
          if (kind === 'wrong page') info.page = 2;
          if (kind === 'wrong count') info.count = 0;
          if (kind === 'wrong total') info.total_count = 3;
          if (kind === 'unbounded') info.total_pages = 10001;
          return reply(
            envelope([row(), row(OLD)], kind === 'missing' ? {} : { result_info: info })
          );
        },
      });
      await expect(
        (await load()).retainPagesDeployments({ ...options, ...service })
      ).rejects.toThrow(/pagination|inventory/i);
      expect(service.deleted()).toEqual([]);
    }
  );
  it('aborts on drift in the second inventory', async () => {
    let lists = 0;
    const service = api({
      change: (c) => {
        if (c.url.pathname.endsWith('/deployments') && ++lists === 2)
          return reply(
            envelope([row()], {
              result_info: { page: 1, per_page: 25, count: 1, total_count: 1, total_pages: 1 },
            })
          );
      },
    });
    await expect(
      (await load()).retainPagesDeployments({
        ...options,
        ...service,
        apply: true,
        activation: 'true',
      })
    ).rejects.toThrow(/changed|drift/i);
    expect(service.deleted()).toEqual([]);
  });
  it('fresh protection detects a deployment or rollback before the DELETE', async () => {
    let projectReads = 0;
    const service = api({
      change: (c) => {
        if (c.url.pathname.endsWith('/xivdyetools') && ++projectReads >= 3)
          return reply(envelope({ ...project(), canonical_deployment: row(OLD) }));
      },
    });
    await expect(
      (await load()).retainPagesDeployments({
        ...options,
        ...service,
        apply: true,
        activation: 'true',
      })
    ).rejects.toThrow();
    expect(service.deleted()).toEqual([]);
  });
  it('rejects changed candidate metadata before DELETE', async () => {
    const service = api({
      change: (c) =>
        c.url.pathname.endsWith('/deployments/' + OLD)
          ? reply(envelope(row(OLD, { aliases: ['https://xivdyetools.app'] })))
          : undefined,
    });
    await expect(
      (await load()).retainPagesDeployments({
        ...options,
        ...service,
        apply: true,
        activation: 'true',
      })
    ).rejects.toThrow();
    expect(service.deleted()).toEqual([]);
  });
  it('uses force only for the exact preview branch alias, never for production', async () => {
    const preview = row(OLD, {
      environment: 'preview',
      aliases: ['https://v4-ui-migration.xiv-colorexplorer.pages.dev'],
      deployment_trigger: {
        metadata: { branch: 'v4-ui-migration', commit_hash: SHA, commit_dirty: false },
      },
    });
    const service = api({ rows: [row(), preview] });
    await (
      await load()
    ).retainPagesDeployments({ ...options, ...service, apply: true, activation: 'true' });
    expect(service.calls.find((c) => c.method === 'DELETE').url.searchParams.get('force')).toBe(
      'true'
    );
    const production = api({ rows: [row(), { ...preview, environment: 'production' }] });
    await expect(
      (await load()).retainPagesDeployments({
        ...options,
        ...production,
        apply: true,
        activation: 'true',
      })
    ).rejects.toThrow(/alias/i);
    expect(production.deleted()).toEqual([]);
  });
  it.each(['http', 'success', 'malformed', 'throw'])(
    'stops on %s DELETE failure without replay',
    async (kind) => {
      const service = api({
        change: (c) => {
          if (c.method !== 'DELETE') return;
          if (kind === 'throw') throw new Error('socket closed after send');
          if (kind === 'malformed') return reply({ success: true });
          return reply(
            envelope(null, {
              success: kind !== 'success',
              errors: kind === 'success' ? [{ code: 1, message: 'Denied' }] : [],
            }),
            kind === 'http' ? 503 : 200
          );
        },
      });
      await expect(
        (await load()).retainPagesDeployments({
          ...options,
          ...service,
          apply: true,
          activation: 'true',
        })
      ).rejects.toThrow();
      expect(service.deleted()).toEqual([OLD]);
    }
  );
  it('bounds transient GET retries and never logs credentials', async () => {
    let attempts = 0;
    const service = api({
      change: () => {
        attempts++;
        return reply(envelope(null), 503);
      },
    });
    await expect(
      (await load()).retainPagesDeployments({ ...options, ...service, sleep: async () => {} })
    ).rejects.toThrow(/GET.*503/);
    expect(attempts).toBe(3);
  });
  it('does not retry a denied or malformed successful GET envelope', async () => {
    for (const data of [
      envelope(null, { success: false, errors: [{ code: 1, message: 'Denied' }] }),
      { success: true, result: project() },
      envelope(project(), { errors: [{ code: 1, message: 'warning is an error' }] }),
    ]) {
      const service = api({ change: () => reply(data) });
      await expect(
        (await load()).retainPagesDeployments({ ...options, ...service })
      ).rejects.toThrow(/envelope/);
      expect(service.calls).toHaveLength(1);
    }
  });
  it('rejects a wrong account or missing credential without making a request', async () => {
    for (const extra of [
      { accountId: '0'.repeat(32) },
      { token: '' },
      { token: 'bad\r\nsecret' },
    ]) {
      const service = api();
      await expect(
        (await load()).retainPagesDeployments({ ...options, ...service, ...extra })
      ).rejects.toThrow();
      expect(service.calls).toEqual([]);
    }
  });
  it('accepts the beta project identity and protects its current production deployment', async () => {
    const betaId = '5c880756-1342-4e55-87bd-dee867764118';
    const betaRow = {
      ...row(betaId),
      project_id: 'a79b5fda-613d-4cb9-8e3e-81c7358429d7',
      project_name: 'xivdyetools-beta',
      url: 'https://5c880756.xivdyetools-beta.pages.dev',
      aliases: ['https://beta.xivdyetools.app'],
      deployment_trigger: { metadata: { branch: 'beta', commit_hash: SHA, commit_dirty: false } },
    };
    const beta = {
      ...project(),
      id: betaRow.project_id,
      name: betaRow.project_name,
      subdomain: 'xivdyetools-beta.pages.dev',
      production_branch: 'beta',
      domains: ['xivdyetools-beta.pages.dev', 'beta.xivdyetools.app'],
      canonical_deployment: betaRow,
      latest_deployment: betaRow,
    };
    const service = api({
      change: (c) =>
        c.url.pathname.endsWith('/deployments')
          ? reply(
              envelope([betaRow], {
                result_info: { page: 1, per_page: 25, count: 1, total_count: 1, total_pages: 1 },
              })
            )
          : reply(envelope(beta)),
    });
    const result = await (
      await load()
    ).retainPagesDeployments({
      ...options,
      ...service,
      project: 'xivdyetools-beta',
      deploymentUrl: betaRow.url,
    });
    expect(result).toMatchObject({ protectedId: betaId, candidates: [], deleted: [] });
    expect(
      service.calls.every((c) => c.url.pathname.includes('/pages/projects/xivdyetools-beta'))
    ).toBe(true);
  });
  it('stops subsequent deletion when current changes after the first receipt', async () => {
    const older = '11223344-083a-4d97-bdb2-8e8e2792dee4';
    const service = api({
      rows: [row(), row(OLD), row(older)],
      change: (c, state) => {
        if (
          c.url.pathname.endsWith('/xivdyetools') &&
          state.calls.some((prior) => prior.method === 'DELETE')
        )
          return reply(envelope({ ...project(), latest_deployment: row(OLD) }));
      },
    });
    await expect(
      (await load()).retainPagesDeployments({
        ...options,
        ...service,
        apply: true,
        activation: 'true',
      })
    ).rejects.toThrow();
    expect(service.deleted()).toEqual([older]);
  });
});
