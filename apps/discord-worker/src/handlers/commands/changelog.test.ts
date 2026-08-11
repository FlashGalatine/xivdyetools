/**
 * Tests for the /changelog command handler.
 *
 * The handler is always ephemeral and always answers inline — there is no
 * defer, so every path (cache hit, network failure, unknown version) must
 * still produce a type-4 response. The KV cache is the interesting part:
 * a miss must populate it, and a hit must not re-fetch, because the raw
 * GitHub URL is rate-limited and every isolate would otherwise hammer it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleChangelogCommand } from './changelog.js';
import type { DiscordInteraction, Env } from '../../types/env.js';

vi.mock('../../services/bot-i18n.js', () => ({
  createUserTranslator: vi.fn().mockResolvedValue({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
    getLocale: () => 'en',
  }),
}));

// Keep-a-Changelog headers: `## [x.y.z] - YYYY-MM-DD` is what parseAll matches
const MARKDOWN = `# Changelog

## [5.0.0] - 2026-08-01
### Added
- The 5.0 card suite
### Fixed
- A thing

## [4.9.0] - 2026-07-01
### Added
- Older stuff

## [4.8.0] - 2026-06-01
### Added
- Even older
`;

function memoryKv(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => void store.delete(key)),
  } as unknown as KVNamespace & { store: Map<string, string> };
}

const interaction = (version?: string): DiscordInteraction =>
  ({
    token: 'tok',
    locale: 'en-US',
    member: { user: { id: 'user-1' } },
    data: {
      name: 'changelog',
      options: version ? [{ name: 'version', value: version }] : [],
    },
  }) as unknown as DiscordInteraction;

type Body = {
  type: number;
  data: {
    flags: number;
    content?: string;
    embeds?: { title: string; description: string; fields: { name: string; value: string }[] }[];
  };
};

describe('handleChangelogCommand', () => {
  let env: Env & { KV: ReturnType<typeof memoryKv> };
  const ctx = {} as ExecutionContext;

  beforeEach(() => {
    env = { KV: memoryKv() } as unknown as Env & { KV: ReturnType<typeof memoryKv> };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(MARKDOWN, { status: 200 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('is always ephemeral and answers inline', async () => {
    const body = (await (await handleChangelogCommand(interaction(), env, ctx)).json()) as Body;

    expect(body.type).toBe(4);
    expect(body.data.flags).toBe(64);
  });

  it('expands the newest entry by default', async () => {
    const body = (await (await handleChangelogCommand(interaction(), env, ctx)).json()) as Body;

    expect(body.data.embeds![0].title).toContain('5.0.0');
    expect(body.data.embeds![0].title).toContain('2026-08-01');
    expect(body.data.embeds![0].description).toContain('The 5.0 card suite');
  });

  it('lists the earlier releases as collapsed one-liners', async () => {
    const body = (await (await handleChangelogCommand(interaction(), env, ctx)).json()) as Body;
    const earlier = body.data.embeds![0].fields[0];

    expect(earlier.value).toContain('4.9.0');
    expect(earlier.value).toContain('4.8.0');
    // …and tells the user how to expand one
    expect(earlier.value).toContain('/changelog version:4.9.0');
    expect(earlier.value).not.toContain('5.0.0');
  });

  it('expands a requested version instead', async () => {
    const body = (await (
      await handleChangelogCommand(interaction('4.9.0'), env, ctx)
    ).json()) as Body;

    expect(body.data.embeds![0].title).toContain('4.9.0');
    expect(body.data.embeds![0].description).toContain('Older stuff');
    // The newest now appears in the collapsed list
    expect(body.data.embeds![0].fields[0].value).toContain('5.0.0');
  });

  it('tolerates whitespace around a requested version', async () => {
    const body = (await (
      await handleChangelogCommand(interaction('  4.9.0  '), env, ctx)
    ).json()) as Body;

    expect(body.data.embeds![0].title).toContain('4.9.0');
  });

  it('reports an unknown version rather than silently showing the newest', async () => {
    const body = (await (
      await handleChangelogCommand(interaction('9.9.9'), env, ctx)
    ).json()) as Body;

    expect(JSON.stringify(body)).toContain('changelog.notFound:9.9.9');
  });

  describe('the KV cache', () => {
    it('populates the cache on a miss', async () => {
      await handleChangelogCommand(interaction(), env, ctx);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(env.KV.put).toHaveBeenCalledWith(
        'changelog:raw:v1',
        MARKDOWN,
        expect.objectContaining({ expirationTtl: 600 })
      );
    });

    it('serves a cache hit without touching the network', async () => {
      env.KV.store.set('changelog:raw:v1', MARKDOWN);

      const body = (await (await handleChangelogCommand(interaction(), env, ctx)).json()) as Body;

      expect(fetch).not.toHaveBeenCalled();
      expect(body.data.embeds![0].title).toContain('5.0.0');
    });
  });

  describe('when the source cannot be read', () => {
    it('reports empty on a non-OK response', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('nope', { status: 404 }));

      const body = (await (await handleChangelogCommand(interaction(), env, ctx)).json()) as Body;

      expect(JSON.stringify(body)).toContain('changelog.empty');
      expect(env.KV.put).not.toHaveBeenCalled();
    });

    it('reports empty when the fetch throws', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('network down'));

      const body = (await (await handleChangelogCommand(interaction(), env, ctx)).json()) as Body;

      expect(JSON.stringify(body)).toContain('changelog.empty');
    });

    it('reports empty when the markdown parses to nothing', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('# Changelog\n\nnothing here', { status: 200 }));

      const body = (await (await handleChangelogCommand(interaction(), env, ctx)).json()) as Body;

      expect(JSON.stringify(body)).toContain('changelog.empty');
    });
  });

  describe('user identity', () => {
    it('reads the id from user in a DM', async () => {
      const dm = {
        ...interaction(),
        member: undefined,
        user: { id: 'dm-user' },
      } as unknown as DiscordInteraction;

      await expect(handleChangelogCommand(dm, env, ctx)).resolves.toBeInstanceOf(Response);
    });

    it("falls back to 'unknown' when the interaction carries no user at all", async () => {
      const anonymous = {
        ...interaction(),
        member: undefined,
        user: undefined,
      } as unknown as DiscordInteraction;

      const response = await handleChangelogCommand(anonymous, env, ctx);

      expect((await response.json() as Body).type).toBe(4);
    });
  });

  it('omits the earlier-releases field when there is only one entry', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('## [5.0.0] - 2026-08-01\n### Added\n- Only one\n', { status: 200 })
    );

    const body = (await (await handleChangelogCommand(interaction(), env, ctx)).json()) as Body;

    expect(body.data.embeds![0].fields).toEqual([]);
  });

  it('truncates a very long entry to Discord embed limits', async () => {
    const huge = `## [5.0.0] - 2026-08-01\n### Added\n${Array.from(
      { length: 500 },
      (_, i) => `- item number ${i} with quite a lot of padding text`
    ).join('\n')}\n`;
    vi.mocked(fetch).mockResolvedValue(new Response(huge, { status: 200 }));

    const body = (await (await handleChangelogCommand(interaction(), env, ctx)).json()) as Body;

    expect(body.data.embeds![0].description.length).toBeLessThanOrEqual(4000);
  });
});
