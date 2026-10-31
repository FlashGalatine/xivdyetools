import { describe, it, expect } from 'vitest';
import * as smoke from './smoke-test-pages.js';
import {
  parseArgs,
  READER_NOTICE,
  REQUIRED_SECURITY_HEADERS,
  ROBOTS_MODES,
  smokeTestPages,
} from './smoke-test-pages.js';

const ok = [
  '--deployment-url',
  'https://abc.example.pages.dev',
  '--domain',
  'https://site.test',
  '--expect-robots',
  'noindex',
];

describe('parseArgs', () => {
  it('accepts the three flags in space-separated form', () => {
    expect(parseArgs(ok)).toEqual({
      deploymentUrl: 'https://abc.example.pages.dev',
      domain: 'https://site.test',
      expectRobots: 'noindex',
    });
  });

  it('accepts --flag=value form', () => {
    expect(
      parseArgs([
        '--deployment-url=https://abc.example.pages.dev',
        '--domain=https://site.test',
        '--expect-robots=none',
      ])
    ).toEqual({
      deploymentUrl: 'https://abc.example.pages.dev',
      domain: 'https://site.test',
      expectRobots: 'none',
    });
  });

  it('rejects a missing --deployment-url by naming wrangler-action as the cause', () => {
    // The realistic failure: wrangler-action's output is empty, so the workflow
    // interpolates nothing. Blaming the site here would send the operator to the
    // wrong system.
    expect(() =>
      parseArgs(['--domain', 'https://site.test', '--expect-robots', 'noindex'])
    ).toThrow(/deployment-url.*wrangler-action/is);
  });

  it('rejects an empty --deployment-url the same way', () => {
    expect(() =>
      parseArgs([
        '--deployment-url=',
        '--domain',
        'https://site.test',
        '--expect-robots',
        'noindex',
      ])
    ).toThrow(/deployment-url.*wrangler-action/is);
  });

  it('rejects a missing --domain', () => {
    expect(() =>
      parseArgs(['--deployment-url', 'https://abc.example.pages.dev', '--expect-robots', 'noindex'])
    ).toThrow(/--domain/);
  });

  it('rejects an unrecognised --expect-robots value', () => {
    expect(() =>
      parseArgs([
        '--deployment-url',
        'https://a.test',
        '--domain',
        'https://b.test',
        '--expect-robots',
        'maybe',
      ])
    ).toThrow(/--expect-robots.*noindex\|none.*maybe/s);
  });

  it('rejects a flag given no value', () => {
    expect(() => parseArgs(['--deployment-url', '--domain', 'https://b.test'])).toThrow(
      /needs a value/
    );
  });

  it('rejects a bare positional argument', () => {
    expect(() => parseArgs([...ok, 'stray'])).toThrow(/unexpected argument: stray/);
  });

  it('exposes exactly the two supported robots modes', () => {
    expect(ROBOTS_MODES).toEqual(['noindex', 'none']);
  });

  it('rejects a malformed --deployment-url with an annotated error, not a raw TypeError', () => {
    expect(() =>
      parseArgs([
        '--deployment-url',
        'notaurl',
        '--domain',
        'https://site.test',
        '--expect-robots',
        'noindex',
      ])
    ).toThrow(/--deployment-url is not a valid absolute URL/);
  });

  it('rejects a malformed --domain with an annotated error', () => {
    expect(() =>
      parseArgs([
        '--deployment-url',
        'https://a.test',
        '--domain',
        'notaurl',
        '--expect-robots',
        'noindex',
      ])
    ).toThrow(/--domain is not a valid absolute URL/);
  });

  it('rejects a scheme-relative --domain, since new URL requires absolute', () => {
    expect(() =>
      parseArgs([
        '--deployment-url',
        'https://a.test',
        '--domain',
        '//example.com',
        '--expect-robots',
        'noindex',
      ])
    ).toThrow(/--domain is not a valid absolute URL/);
  });

  it('rejects a path-only --domain, since new URL requires absolute', () => {
    expect(() =>
      parseArgs([
        '--deployment-url',
        'https://a.test',
        '--domain',
        '/foo',
        '--expect-robots',
        'noindex',
      ])
    ).toThrow(/--domain is not a valid absolute URL/);
  });
});

const BODY = '<!doctype html><title>XIV Dye Tools</title>';
const OTHER = '<!doctype html><title>an older build</title>';

const ALIAS = 'https://abc.example.pages.dev';
const SITE = 'https://site.test';

/** Production values from public/_headers. */
const SECURITY_DEFAULTS = {
  'content-security-policy':
    "default-src 'self'; script-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; frame-ancestors 'none'; upgrade-insecure-requests;",
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
  'permissions-policy': 'geolocation=(), microphone=(), camera=()',
};

/** A response double. `headers` is a plain object with get() rather than a real
 *  Headers instance, because these tests run under the jsdom environment the
 *  web-app vitest config sets and we do not rely on jsdom exposing Headers.
 *  Carries the production security headers by default; pass `undefined` for a
 *  name to drop it, or another value to override it. */
function response(status, body, headers = {}) {
  const merged = { ...SECURITY_DEFAULTS };
  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase();
    if (v === undefined) delete merged[key];
    else merged[key] = v;
  }
  const lower = merged;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => lower[name.toLowerCase()] ?? null },
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  };
}

/** The served .chara reader notice, as public/licenses/xivcharakit.txt ships it. */
const NOTICE_BODY = [
  'xivcharakit 0.1.0-beta.4: license and third-party notices',
  '',
  '======== xivcharakit 0.1.0-beta.4: dist/LICENSE ========',
  'MIT License',
  '',
  'Permission is hereby granted, free of charge, to any person obtaining a copy',
  '======== xivcharakit 0.1.0-beta.4: dist/THIRD_PARTY_NOTICES.md ========',
  '# Third-party notices',
  '',
].join('\n');
const noticeResponse = (status = 200, body = NOTICE_BODY, headers = {}) =>
  response(status, body, { 'content-type': 'text/plain; charset=utf-8', ...headers });

describe('FINDING-009 exact current and retired origin probes', () => {
  const current = {
    subdomain: 'xiv-colorexplorer.pages.dev',
    domains: ['xiv-colorexplorer.pages.dev', 'xivdyetools.app'],
    canonical: {
      url: 'https://970e253a.xiv-colorexplorer.pages.dev',
      aliases: ['https://xivdyetools.app', 'https://main.xiv-colorexplorer.pages.dev'],
    },
  };
  const expectedCsp =
    "default-src 'self'; script-src 'self'; connect-src 'self' https://api.xivdyetools.app; object-src 'none'; frame-src 'none'; frame-ancestors 'none';";
  const originOptions = {
    project: 'xivdyetools',
    current,
    expectedCsp,
    expectedBody: new TextEncoder().encode(BODY),
    sleep: async () => {},
  };
  const history = [
    'https://v4-ui-migration.xiv-colorexplorer.pages.dev/',
    'https://66496174.xiv-colorexplorer.pages.dev/',
    'https://1c989934.xiv-colorexplorer.pages.dev/',
  ];
  function origins(overrides = {}) {
    const seen = [];
    return {
      seen,
      fetchImpl: async (url, init) => {
        seen.push({ url, init });
        if (overrides[url] instanceof Error) throw overrides[url];
        return (
          overrides[url] ??
          (history.includes(url)
            ? response(404, 'Not found')
            : response(200, BODY, { 'content-security-policy': expectedCsp }))
        );
      },
    };
  }
  it('provides exact origin verification', () =>
    expect(smoke.checkPagesOrigins).toBeTypeOf('function'));
  it('reads the CSP from the single built catch-all rule, rejecting duplicates or missing policy', () => {
    expect(smoke.readBuiltCsp(`/*\n  Content-Security-Policy: ${expectedCsp}\n`)).toBe(expectedCsp);
    for (const text of [
      '/*\n  X-Frame-Options: DENY',
      `/*\n  Content-Security-Policy: ${expectedCsp}\n/*\n  X-Robots-Tag: noindex`,
      `/*\n  Content-Security-Policy: ${expectedCsp}\n  Content-Security-Policy: ${expectedCsp}`,
    ]) {
      expect(() => smoke.readBuiltCsp(text)).toThrow(/CSP|catch-all/i);
    }
  });
  it('checks custom, canonical Pages, hash and every reported branch alias against the same build', async () => {
    const service = origins();
    expect(await smoke.checkPagesOrigins({ ...originOptions, ...service })).toEqual([]);
    expect([...new Set(service.seen.map((c) => c.url))].sort()).toEqual(
      [
        ...history,
        'https://xivdyetools.app/',
        'https://xiv-colorexplorer.pages.dev/',
        'https://970e253a.xiv-colorexplorer.pages.dev/',
        'https://main.xiv-colorexplorer.pages.dev/',
      ].sort()
    );
    expect(service.seen.every((c) => c.init.redirect === 'manual')).toBe(true);
  });
  it.each([
    ['missing CSP', { 'content-security-policy': undefined }],
    [
      'weaker CSP',
      {
        'content-security-policy': expectedCsp.replace(
          "connect-src 'self'",
          "connect-src 'self' https://*.workers.dev"
        ),
      },
    ],
    ['duplicate directive', { 'content-security-policy': expectedCsp + 'connect-src *;' }],
  ])('fails a hash origin with %s', async (_name, headers) => {
    const service = origins({
      'https://970e253a.xiv-colorexplorer.pages.dev/': response(200, BODY, headers),
    });
    expect((await smoke.checkPagesOrigins({ ...originOptions, ...service })).join('\n')).toMatch(
      /970e253a.*CSP/i
    );
  });
  it('accepts equivalent directive and token ordering but rejects an added allowance on the same origin', async () => {
    const reordered =
      expectedCsp
        .split(';')
        .filter(Boolean)
        .reverse()
        .map((directive) => {
          const [name, ...tokens] = directive.trim().split(/\s+/);
          return [name, ...tokens.reverse()].join(' ');
        })
        .join(';') + ';';
    const service = origins({
      'https://xiv-colorexplorer.pages.dev/': response(200, BODY, {
        'content-security-policy': reordered,
      }),
    });
    expect(await smoke.checkPagesOrigins({ ...originOptions, ...service })).toEqual([]);
    const widened = reordered.replace('connect-src ', 'connect-src https://*.workers.dev ');
    expect(widened).not.toBe(reordered);
    const bad = origins({
      'https://xiv-colorexplorer.pages.dev/': response(200, BODY, {
        'content-security-policy': widened,
      }),
    });
    expect((await smoke.checkPagesOrigins({ ...originOptions, ...bad })).join('\n')).toMatch(
      /xiv-colorexplorer\.pages\.dev\/.*CSP/i
    );
  });
  it.each([200, 301, 302, 403, 500])(
    'does not accept HTTP %s as retired-host closure',
    async (status) => {
      const service = origins({
        [history[0]]: response(status, BODY, { location: 'https://xivdyetools.app/' }),
      });
      expect((await smoke.checkPagesOrigins({ ...originOptions, ...service })).join('\n')).toMatch(
        /v4-ui-migration.*404/
      );
    }
  );
  it('does not accept DNS failure as retired-host closure', async () => {
    const service = origins({ [history[0]]: new Error('ENOTFOUND') });
    expect((await smoke.checkPagesOrigins({ ...originOptions, ...service })).join('\n')).toMatch(
      /v4-ui-migration.*ENOTFOUND/
    );
  });
  it('fails a current branch alias serving a different build or redirect', async () => {
    for (const bad of [
      response(200, OTHER, { 'content-security-policy': expectedCsp }),
      response(302, '', { location: 'https://xivdyetools.app/' }),
    ]) {
      const service = origins({ 'https://main.xiv-colorexplorer.pages.dev/': bad });
      expect((await smoke.checkPagesOrigins({ ...originOptions, ...service })).join('\n')).toMatch(
        /main.*build|main.*HTTP 302/
      );
    }
  });
  it('checks the retired beta hash separately', async () => {
    const beta = {
      subdomain: 'xivdyetools-beta.pages.dev',
      domains: ['xivdyetools-beta.pages.dev', 'beta.xivdyetools.app'],
      canonical: {
        url: 'https://5c880756.xivdyetools-beta.pages.dev',
        aliases: ['https://beta.xivdyetools.app'],
      },
    };
    const seen = [];
    const failures = await smoke.checkPagesOrigins({
      ...originOptions,
      project: 'xivdyetools-beta',
      current: beta,
      fetchImpl: async (url) => {
        seen.push(url);
        return response(url.includes('ecc7fb76') ? 404 : 200, BODY, {
          'content-security-policy': expectedCsp,
        });
      },
    });
    expect(failures).toEqual([]);
    expect(seen).toContain('https://ecc7fb76.xivdyetools-beta.pages.dev/');
    expect(seen).not.toContain(history[0]);
  });
});

/** Queues responses per host. The final entry repeats once exhausted, so a test
 *  can describe "fails twice then succeeds" without listing 36 entries.
 *
 *  Requests for the reader notice path are routed separately so the existing
 *  per-host queues keep describing the page itself: a `${host}${path}` key
 *  queues responses for that path, and without one the host answers with the
 *  correct notice. They are recorded in `licenseCalls`, not `calls`. */
function fakeFetch(byHost) {
  const queues = new Map(Object.entries(byHost).map(([host, list]) => [host, [...list]]));
  const calls = [];
  const licenseCalls = [];
  const impl = async (url) => {
    const { host, pathname } = new URL(url);
    if (pathname === READER_NOTICE.path) {
      licenseCalls.push(url);
      const queue = queues.get(`${host}${pathname}`);
      if (!queue) return noticeResponse();
      const next = queue.length > 1 ? queue.shift() : queue[0];
      if (next instanceof Error) throw next;
      return next;
    }
    calls.push(url);
    const queue = queues.get(host);
    if (!queue) throw new Error(`test fetch: no responses queued for host ${host}`);
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) throw next;
    return next;
  };
  impl.calls = calls;
  impl.licenseCalls = licenseCalls;
  return impl;
}

const run = (overrides) =>
  smokeTestPages({
    deploymentUrl: ALIAS,
    domain: SITE,
    expectRobots: 'noindex',
    sleep: async () => {},
    ...overrides,
  });

describe('smokeTestPages', () => {
  it('integrates metadata, built CSP and exact retired-origin probes in project mode', async () => {
    const id = '970e253a-083a-4d97-bdb2-8e8e2792dee4';
    const sha = 'a'.repeat(40);
    const deploymentUrl = 'https://970e253a.xiv-colorexplorer.pages.dev';
    const d = {
      id,
      project_id: '1f8b22b8-5dc1-4294-acff-ac9bbaf3e697',
      project_name: 'xivdyetools',
      environment: 'production',
      url: deploymentUrl,
      aliases: ['https://xivdyetools.app'],
      created_on: '2026-10-28T12:00:00Z',
      latest_stage: { name: 'deploy', status: 'success' },
      deployment_trigger: { metadata: { branch: 'main', commit_hash: sha, commit_dirty: false } },
    };
    const p = {
      id: d.project_id,
      name: 'xivdyetools',
      subdomain: 'xiv-colorexplorer.pages.dev',
      production_branch: 'main',
      domains: ['xiv-colorexplorer.pages.dev', 'xivdyetools.app'],
      canonical_deployment: d,
      latest_deployment: d,
    };
    let apiReads = 0;
    const apiFetchImpl = async () => {
      apiReads++;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, errors: [], messages: [], result: p }),
      };
    };
    const seen = [];
    const fetchImpl = async (url) => {
      seen.push(url);
      if (url.includes('/licenses/')) return noticeResponse();
      return response(/v4-ui-migration|66496174|1c989934/.test(url) ? 404 : 200, BODY);
    };
    const options = {
      deploymentUrl,
      domain: 'https://xivdyetools.app',
      project: 'xivdyetools',
      commit: sha,
      expectRobots: 'none',
      expectedCsp: SECURITY_DEFAULTS['content-security-policy'],
      accountId: '9390470022b5544dc04854638fdf8c51',
      token: 'test',
      sleep: async () => {},
      fetchImpl,
      apiFetchImpl,
    };
    const result = await smokeTestPages(options);
    expect(result.failures).toEqual([]);
    expect(apiReads).toBe(2);
    expect(seen).toContain('https://xiv-colorexplorer.pages.dev/');
    expect(seen).toContain('https://v4-ui-migration.xiv-colorexplorer.pages.dev/');
    const wrongSha = await smokeTestPages({ ...options, commit: 'b'.repeat(40) });
    expect(wrongSha.ok).toBe(false);
    expect(wrongSha.failures.join(' ')).toMatch(/commit/);
    const weakBuilt = await smokeTestPages({ ...options, expectedCsp: 'default-src *;' });
    expect(weakBuilt.ok).toBe(false);
    expect(weakBuilt.failures.join(' ')).toMatch(/CSP/);
  });
  it('passes when the domain serves this build and carries noindex', async () => {
    const result = await run({
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, BODY, { 'x-robots-tag': 'noindex, nofollow' })],
      }),
    });
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.summary).toContain(SITE);
  });

  it('passes for production when the domain serves this build with no robots header', async () => {
    const result = await run({
      expectRobots: 'none',
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, BODY)],
      }),
    });
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('fails when the alias never returns 2xx, and blames the deployment not the domain', async () => {
    const result = await run({
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(500, 'nope')],
        'site.test': [response(200, BODY, { 'x-robots-tag': 'noindex' })],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toContain(ALIAS);
    expect(result.failures[0]).toMatch(/500/);
    // The domain must not be mentioned: it was never the problem.
    expect(result.failures[0]).not.toContain(SITE);
  });

  it('retries the alias and succeeds on a later attempt', async () => {
    const fetchImpl = fakeFetch({
      'abc.example.pages.dev': [response(522, ''), response(522, ''), response(200, BODY)],
      'site.test': [response(200, BODY, { 'x-robots-tag': 'noindex' })],
    });
    const result = await run({ fetchImpl });
    expect(result.ok).toBe(true);
    expect(fetchImpl.calls.filter((u) => u.includes('pages.dev'))).toHaveLength(3);
  });

  it('surfaces a transport error against the alias rather than crashing', async () => {
    const result = await run({
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [new Error('getaddrinfo ENOTFOUND')],
        'site.test': [response(200, BODY)],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toMatch(/ENOTFOUND/);
  });

  it('fails distinctly when the domain never answers at all', async () => {
    const result = await run({
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(522, '')],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toMatch(/never returned 2xx/);
    expect(result.failures[0]).toMatch(/522/);
    // Must say the build is fine, so nobody debugs the deployment.
    expect(result.failures[0]).toContain(ALIAS);
    expect(result.failures[0]).not.toMatch(/different build/);
  });

  it('fails distinctly when the domain answers but serves a different build', async () => {
    const result = await run({
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, OTHER, { 'x-robots-tag': 'noindex' })],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toMatch(/different build/);
    expect(result.failures[0]).toMatch(/175s/);
    expect(result.failures[0]).not.toMatch(/never returned 2xx/);
    // Names the second possible cause, so a zone feature that rewrites HTML is not
    // silently blamed on Pages alias lag forever.
    expect(result.failures[0]).toMatch(/zone feature/);
  });

  it('waits for the domain to converge instead of failing on the first mismatch', async () => {
    const fetchImpl = fakeFetch({
      'abc.example.pages.dev': [response(200, BODY)],
      'site.test': [
        response(200, OTHER),
        response(200, OTHER),
        response(200, BODY, { 'x-robots-tag': 'noindex' }),
      ],
    });
    const result = await run({ fetchImpl });
    expect(result.ok).toBe(true);
    expect(fetchImpl.calls.filter((u) => u.includes('site.test'))).toHaveLength(3);
  });

  it('fails when a beta domain is missing noindex', async () => {
    const result = await run({
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, BODY)],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toMatch(/without X-Robots-Tag: noindex/);
  });

  it('fails when a production domain carries noindex, naming the likely cause', async () => {
    const result = await run({
      expectRobots: 'none',
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, BODY, { 'x-robots-tag': 'noindex, nofollow' })],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toMatch(/beta build/i);
  });

  it('does not mistake a header that merely contains the substring for noindex', async () => {
    // 'noindexing' must not satisfy the beta assertion.
    const result = await run({
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, BODY, { 'x-robots-tag': 'noindexing' })],
      }),
    });
    expect(result.ok).toBe(false);
  });

  it('does not mistake the parameter directive max-image-preview:none for noindex', async () => {
    // The false positive being fixed: ':' is a word boundary, so a naive
    // /\b(noindex|none)\b/ match treats this value-taking key as noindex.
    const result = await run({
      expectRobots: 'none',
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, BODY, { 'x-robots-tag': 'max-image-preview:none' })],
      }),
    });
    expect(result.ok).toBe(true);
  });

  it('still catches a real noindex sitting alongside a parameter directive', async () => {
    // Proves the strip does not swallow a real directive next to a parameter one.
    const result = await run({
      expectRobots: 'none',
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, BODY, { 'x-robots-tag': 'max-image-preview:none, noindex' })],
      }),
    });
    expect(result.ok).toBe(false);
  });

  it('still counts a per-user-agent none as noindex', async () => {
    // Anything before a colon that is not one of the four parameter-directive keys
    // is a user-agent name, whose value is a real directive.
    const result = await run({
      expectRobots: 'noindex',
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, BODY, { 'x-robots-tag': 'googlebot: none' })],
      }),
    });
    expect(result.ok).toBe(true);
  });

  it('fails when a production domain carries none, naming the likely cause', async () => {
    // 'none' is equivalent to 'noindex, nofollow' -- production deindexed is
    // the real hazard this assertion exists to catch.
    const result = await run({
      expectRobots: 'none',
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, BODY, { 'x-robots-tag': 'none' })],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toMatch(/beta build/i);
  });

  it('passes for beta when the domain carries none instead of noindex', async () => {
    // 'none' hides the site just as effectively as 'noindex'.
    const result = await run({
      expectRobots: 'noindex',
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, BODY, { 'x-robots-tag': 'none' })],
      }),
    });
    expect(result.ok).toBe(true);
  });

  it('does not mistake nonetheless for none', async () => {
    const result = await run({
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, BODY, { 'x-robots-tag': 'nonetheless' })],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toMatch(/without X-Robots-Tag: noindex/);
  });

  describe('security headers on the custom domain', () => {
    const pair = (siteHeaders) => ({
      'abc.example.pages.dev': [response(200, BODY)],
      'site.test': [response(200, BODY, siteHeaders)],
    });

    it('exposes the four required header names', () => {
      expect(REQUIRED_SECURITY_HEADERS).toEqual([
        'content-security-policy',
        'x-frame-options',
        'strict-transport-security',
        'permissions-policy',
      ]);
    });

    it('fails a beta domain missing CSP and X-Frame-Options, naming both and the cause', async () => {
      const result = await run({
        fetchImpl: fakeFetch(
          pair({
            'x-robots-tag': 'noindex',
            'content-security-policy': undefined,
            'x-frame-options': undefined,
          })
        ),
      });
      expect(result.ok).toBe(false);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toContain('content-security-policy');
      expect(result.failures[0]).toContain('x-frame-options');
      expect(result.failures[0]).not.toContain('strict-transport-security');
      expect(result.failures[0]).not.toContain('permissions-policy');
      expect(result.failures[0]).toMatch(/declared twice in dist\/_headers/);
      expect(result.failures[0]).toMatch(/later identical pattern replace/);
    });

    it('fails a production domain missing only HSTS', async () => {
      const result = await run({
        expectRobots: 'none',
        fetchImpl: fakeFetch(pair({ 'strict-transport-security': undefined })),
      });
      expect(result.ok).toBe(false);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toContain('strict-transport-security');
      expect(result.failures[0]).not.toContain('x-frame-options');
    });

    it('fails when Permissions-Policy is missing', async () => {
      const result = await run({
        fetchImpl: fakeFetch(pair({ 'x-robots-tag': 'noindex', 'permissions-policy': undefined })),
      });
      expect(result.ok).toBe(false);
      expect(result.failures[0]).toContain('permissions-policy');
    });

    it('treats a whitespace-only value as missing', async () => {
      const result = await run({
        fetchImpl: fakeFetch(pair({ 'x-robots-tag': 'noindex', 'x-frame-options': '   ' })),
      });
      expect(result.ok).toBe(false);
      expect(result.failures[0]).toContain('x-frame-options');
    });

    it('fails a CSP that has no frame-ancestors directive', async () => {
      const result = await run({
        fetchImpl: fakeFetch(
          pair({
            'x-robots-tag': 'noindex',
            'content-security-policy': "default-src 'self'; script-src 'self'",
          })
        ),
      });
      expect(result.ok).toBe(false);
      expect(result.failures[0]).toContain('frame-ancestors');
    });

    it('does not accept frame-ancestors appearing only inside another directive value', async () => {
      const result = await run({
        fetchImpl: fakeFetch(
          pair({
            'x-robots-tag': 'noindex',
            'content-security-policy':
              "default-src 'self'; report-uri https://r.test/frame-ancestors; img-src frame-ancestors.test",
          })
        ),
      });
      expect(result.ok).toBe(false);
      expect(result.failures[0]).toContain('frame-ancestors');
    });

    it('accepts frame-ancestors when it is the first directive', async () => {
      const result = await run({
        fetchImpl: fakeFetch(
          pair({
            'x-robots-tag': 'noindex',
            'content-security-policy': "frame-ancestors 'none'; default-src 'self'",
          })
        ),
      });
      expect(result.ok).toBe(true);
    });

    it('reports robots and header failures together', async () => {
      const result = await run({
        fetchImpl: fakeFetch(pair({ 'content-security-policy': undefined })),
      });
      expect(result.ok).toBe(false);
      expect(result.failures).toHaveLength(2);
      expect(result.failures[0]).toMatch(/without X-Robots-Tag: noindex/);
      expect(result.failures[1]).toContain('content-security-policy');
    });

    it('passes with every security header present, in both modes', async () => {
      const beta = await run({ fetchImpl: fakeFetch(pair({ 'x-robots-tag': 'noindex' })) });
      expect(beta.failures).toEqual([]);
      expect(beta.ok).toBe(true);
      expect(beta.summary).toMatch(/security headers/);
      const prod = await run({ expectRobots: 'none', fetchImpl: fakeFetch(pair({})) });
      expect(prod.failures).toEqual([]);
      expect(prod.ok).toBe(true);
    });

    it('reads a real Headers instance with mixed-case names', async () => {
      const headers = new Headers({
        'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
        'X-Frame-Options': 'DENY',
        'Strict-Transport-Security': 'max-age=31536000',
        'Permissions-Policy': 'camera=()',
        'X-Robots-Tag': 'noindex',
      });
      const real = {
        ok: true,
        status: 200,
        headers,
        arrayBuffer: async () => new TextEncoder().encode(BODY).buffer,
      };
      const result = await run({
        fetchImpl: fakeFetch({
          'abc.example.pages.dev': [response(200, BODY)],
          'site.test': [real],
        }),
      });
      expect(result.failures).toEqual([]);
      expect(result.ok).toBe(true);
    });
  });

  // public/_redirects answers every unknown path with index.html and a 200, so
  // "the notice URL returned 2xx" proves nothing: only the served body does.
  describe('the .chara reader license notice on the custom domain', () => {
    const NOTICE_KEY = `site.test${'/licenses/xivcharakit.txt'}`;
    const withNotice = (noticeQueue, siteHeaders = { 'x-robots-tag': 'noindex' }) => ({
      'abc.example.pages.dev': [response(200, BODY)],
      'site.test': [response(200, BODY, siteHeaders)],
      ...(noticeQueue ? { [NOTICE_KEY]: noticeQueue } : {}),
    });

    it('names the served path and the markers it requires', () => {
      expect(READER_NOTICE.path).toBe('/licenses/xivcharakit.txt');
      expect(READER_NOTICE.markers).toEqual([
        'Permission is hereby granted',
        '# Third-party notices',
      ]);
    });

    it('fetches the notice from the custom domain, not the deployment alias, and passes', async () => {
      const fetchImpl = fakeFetch(withNotice([noticeResponse()]));
      const result = await run({ fetchImpl });
      expect(result.failures).toEqual([]);
      expect(result.ok).toBe(true);
      expect(fetchImpl.licenseCalls).toEqual([`${SITE}/licenses/xivcharakit.txt`]);
      expect(result.summary).toMatch(/license notice/);
    });

    it('fails when the path falls through to the SPA index.html with a 200', async () => {
      const result = await run({
        fetchImpl: fakeFetch(
          withNotice([response(200, BODY, { 'content-type': 'text/html; charset=utf-8' })])
        ),
      });
      expect(result.ok).toBe(false);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toContain('/licenses/xivcharakit.txt');
      expect(result.failures[0]).toMatch(/index\.html/);
      expect(result.failures[0]).toMatch(/copy-chara-notices/);
    });

    it('fails when the body lacks the third-party notices', async () => {
      const result = await run({
        fetchImpl: fakeFetch(
          withNotice([
            noticeResponse(200, 'MIT License\n\nPermission is hereby granted, free of charge\n'),
          ])
        ),
      });
      expect(result.ok).toBe(false);
      expect(result.failures[0]).toContain('# Third-party notices');
      expect(result.failures[0]).not.toContain('Permission is hereby granted"');
    });

    it('fails when the body lacks the MIT license text', async () => {
      const result = await run({
        fetchImpl: fakeFetch(withNotice([noticeResponse(200, '# Third-party notices\n')])),
      });
      expect(result.ok).toBe(false);
      expect(result.failures[0]).toContain('Permission is hereby granted');
    });

    it('fails when the notice is not served as text/plain', async () => {
      const result = await run({
        fetchImpl: fakeFetch(
          withNotice([
            noticeResponse(200, NOTICE_BODY, { 'content-type': 'application/octet-stream' }),
          ])
        ),
      });
      expect(result.ok).toBe(false);
      expect(result.failures[0]).toMatch(/text\/plain/);
      expect(result.failures[0]).toContain('application/octet-stream');
    });

    it('fails when the notice is text/plain but names no charset', async () => {
      const result = await run({
        fetchImpl: fakeFetch(
          withNotice([noticeResponse(200, NOTICE_BODY, { 'content-type': 'text/plain' })])
        ),
      });
      expect(result.ok).toBe(false);
      expect(result.failures[0]).toMatch(/charset=utf-8/);
      expect(result.failures[0]).toContain('/licenses/*');
    });

    it('names index.html for an HTML page whose bytes differ from the converged page', async () => {
      const result = await run({
        fetchImpl: fakeFetch(
          withNotice([
            response(200, '<!doctype html><html><body>another shell</body></html>', {
              'content-type': 'text/html; charset=utf-8',
            }),
          ])
        ),
      });
      expect(result.ok).toBe(false);
      expect(result.failures[0]).toMatch(/index\.html/);
      expect(result.failures[0]).toMatch(/copy-chara-notices/);
    });

    it('fails, after retrying, when the notice never returns 2xx', async () => {
      const fetchImpl = fakeFetch(withNotice([noticeResponse(404, 'Not Found')]));
      const result = await run({ fetchImpl });
      expect(result.ok).toBe(false);
      expect(result.failures[0]).toContain('/licenses/xivcharakit.txt');
      expect(result.failures[0]).toMatch(/404/);
      expect(fetchImpl.licenseCalls).toHaveLength(3);
    });

    it('retries a transient failure and then passes', async () => {
      const fetchImpl = fakeFetch(
        withNotice([new Error('socket hang up'), noticeResponse(522, ''), noticeResponse()])
      );
      const result = await run({ fetchImpl });
      expect(result.failures).toEqual([]);
      expect(result.ok).toBe(true);
      expect(fetchImpl.licenseCalls).toHaveLength(3);
    });

    it('reports a missing notice alongside header failures', async () => {
      const result = await run({
        fetchImpl: fakeFetch(
          withNotice([response(200, BODY, { 'content-type': 'text/html' })], {
            'x-robots-tag': 'noindex',
            'x-frame-options': undefined,
          })
        ),
      });
      expect(result.ok).toBe(false);
      expect(result.failures).toHaveLength(2);
      expect(result.failures[0]).toContain('x-frame-options');
      expect(result.failures[1]).toContain('/licenses/xivcharakit.txt');
    });
  });

  it('sends the CI user agent and asks the edge not to serve a cached answer', async () => {
    const seen = [];
    const base = fakeFetch({
      'abc.example.pages.dev': [response(200, BODY)],
      'site.test': [response(200, BODY, { 'x-robots-tag': 'noindex' })],
    });
    await run({
      fetchImpl: async (url, init) => {
        seen.push(init);
        return base(url, init);
      },
    });
    expect(seen).not.toHaveLength(0);
    for (const init of seen) {
      expect(init.headers['User-Agent']).toBe('xivdyetools-ci');
      expect(init.headers['Cache-Control']).toBe('no-cache');
    }
  });
});
