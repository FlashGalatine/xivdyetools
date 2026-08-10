import { describe, it, expect } from 'vitest';
import { parseArgs, ROBOTS_MODES, smokeTestPages } from './smoke-test-pages.js';

const ok = ['--deployment-url', 'https://abc.example.pages.dev', '--domain', 'https://site.test', '--expect-robots', 'noindex'];

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
    expect(() => parseArgs(['--domain', 'https://site.test', '--expect-robots', 'noindex'])).toThrow(
      /deployment-url.*wrangler-action/is
    );
  });

  it('rejects an empty --deployment-url the same way', () => {
    expect(() =>
      parseArgs(['--deployment-url=', '--domain', 'https://site.test', '--expect-robots', 'noindex'])
    ).toThrow(/deployment-url.*wrangler-action/is);
  });

  it('rejects a missing --domain', () => {
    expect(() =>
      parseArgs(['--deployment-url', 'https://abc.example.pages.dev', '--expect-robots', 'noindex'])
    ).toThrow(/--domain/);
  });

  it('rejects an unrecognised --expect-robots value', () => {
    expect(() =>
      parseArgs(['--deployment-url', 'https://a.test', '--domain', 'https://b.test', '--expect-robots', 'maybe'])
    ).toThrow(/--expect-robots.*noindex\|none.*maybe/s);
  });

  it('rejects a flag given no value', () => {
    expect(() => parseArgs(['--deployment-url', '--domain', 'https://b.test'])).toThrow(/needs a value/);
  });

  it('rejects a bare positional argument', () => {
    expect(() => parseArgs([...ok, 'stray'])).toThrow(/unexpected argument: stray/);
  });

  it('exposes exactly the two supported robots modes', () => {
    expect(ROBOTS_MODES).toEqual(['noindex', 'none']);
  });
});

const BODY = '<!doctype html><title>XIV Dye Tools</title>';
const OTHER = '<!doctype html><title>an older build</title>';

const ALIAS = 'https://abc.example.pages.dev';
const SITE = 'https://site.test';

/** A response double. `headers` is a plain object with get() rather than a real
 *  Headers instance, because these tests run under the jsdom environment the
 *  web-app vitest config sets and we do not rely on jsdom exposing Headers. */
function response(status, body, headers = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => lower[name.toLowerCase()] ?? null },
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  };
}

/** Queues responses per host. The final entry repeats once exhausted, so a test
 *  can describe "fails twice then succeeds" without listing 36 entries. */
function fakeFetch(byHost) {
  const queues = new Map(Object.entries(byHost).map(([host, list]) => [host, [...list]]));
  const calls = [];
  const impl = async (url) => {
    const { host } = new URL(url);
    calls.push(url);
    const queue = queues.get(host);
    if (!queue) throw new Error(`test fetch: no responses queued for host ${host}`);
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) throw next;
    return next;
  };
  impl.calls = calls;
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
    expect(result.failures[0]).toMatch(/180s/);
    expect(result.failures[0]).not.toMatch(/never returned 2xx/);
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
