/**
 * Tests for the /changelog command handler.
 *
 * The handler is always ephemeral and always answers inline. The bot's own
 * `apps/discord-worker/CHANGELOG-laymans.md` is bundled into the Worker at
 * build time — wrangler's `[[rules]] type = "Text"` in production, the
 * markdown-as-text plugin in vitest.config.ts here — so there is no network
 * fetch, no KV cache and no "GitHub is down" path any more. The markdown is a
 * module import, mocked below with a fixture; the real file has its own
 * contract test next to the parser (changelog-parser.test.ts).
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

// Keep-a-Changelog headers: `## [x.y.z] - YYYY-MM-DD` is what parseAll matches.
// Hoisted because the vi.mock factory below runs while this file's imports
// are still being evaluated (vi.mock is hoisted above them).
const { MARKDOWN } = vi.hoisted(() => ({
  MARKDOWN: `# What's New — XIV Dye Tools Discord bot

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
`,
}));

/** The handler's own import specifier — this test lives in the same directory. */
const CHANGELOG_MODULE = '../../../CHANGELOG-laymans.md';

vi.mock('../../../CHANGELOG-laymans.md', () => ({ default: MARKDOWN }));

/**
 * Re-import the handler against a different bundled file. `vi.resetModules()`
 * drops the cached handler module so the new `vi.doMock` registration is what
 * its `import … from '../../../CHANGELOG-laymans.md'` resolves to.
 */
async function handlerWithMarkdown(markdown: string): Promise<typeof handleChangelogCommand> {
  vi.resetModules();
  vi.doMock(CHANGELOG_MODULE, () => ({ default: markdown }));
  const mod = await import('./changelog.js');
  return mod.handleChangelogCommand;
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
  type Kv = { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };
  let env: Env & { KV: Kv };
  const ctx = {} as ExecutionContext;

  const run = async (i: DiscordInteraction, handler = handleChangelogCommand): Promise<Body> =>
    (await (await handler(i, env, ctx)).json()) as Body;

  beforeEach(() => {
    env = { KV: { get: vi.fn(), put: vi.fn() } } as unknown as Env & { KV: Kv };
    // The notes ship inside the Worker bundle: any fetch is a regression, and
    // a stub that rejects keeps a regression from reaching the real network.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network must not be used')));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('is always ephemeral and answers inline', async () => {
    const body = await run(interaction());

    expect(body.type).toBe(4);
    expect(body.data.flags).toBe(64);
  });

  it('serves the bundled notes — no fetch, no cache read or write', async () => {
    const body = await run(interaction());

    expect(fetch).not.toHaveBeenCalled();
    expect(env.KV.get).not.toHaveBeenCalled();
    expect(env.KV.put).not.toHaveBeenCalled();
    expect(body.data.embeds![0].title).toContain('5.0.0');
  });

  it('expands the newest entry by default', async () => {
    const body = await run(interaction());

    expect(body.data.embeds![0].title).toContain('5.0.0');
    expect(body.data.embeds![0].title).toContain('2026-08-01');
    expect(body.data.embeds![0].description).toContain('The 5.0 card suite');
  });

  it('lists the earlier releases as collapsed one-liners', async () => {
    const body = await run(interaction());
    const earlier = body.data.embeds![0].fields[0];

    expect(earlier.value).toContain('4.9.0');
    expect(earlier.value).toContain('4.8.0');
    // …and tells the user how to expand one
    expect(earlier.value).toContain('/changelog version:4.9.0');
    expect(earlier.value).not.toContain('5.0.0');
  });

  it('expands a requested version instead', async () => {
    const body = await run(interaction('4.9.0'));

    expect(body.data.embeds![0].title).toContain('4.9.0');
    expect(body.data.embeds![0].description).toContain('Older stuff');
    // The newest now appears in the collapsed list
    expect(body.data.embeds![0].fields[0].value).toContain('5.0.0');
  });

  it('tolerates whitespace around a requested version', async () => {
    const body = await run(interaction('  4.9.0  '));

    expect(body.data.embeds![0].title).toContain('4.9.0');
  });

  it('reports an unknown version rather than silently showing the newest', async () => {
    const body = await run(interaction('9.9.9'));

    expect(JSON.stringify(body)).toContain('changelog.notFound:9.9.9');
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

      const body = await run(anonymous);

      expect(body.type).toBe(4);
    });
  });

  describe('with a different bundled file', () => {
    it('omits the earlier-releases field when there is only one entry', async () => {
      const handler = await handlerWithMarkdown('## [5.0.0] - 2026-08-01\n### Added\n- Only one\n');

      const body = await run(interaction(), handler);

      expect(body.data.embeds![0].fields).toEqual([]);
    });

    it('cuts a very long entry on a line boundary, under the embed limit, and says so', async () => {
      const items = Array.from(
        { length: 500 },
        (_, i) => `item number ${i} with quite a lot of padding text`
      );
      const handler = await handlerWithMarkdown(
        `## [5.0.0] - 2026-08-01\n### Added\n${items.map((s) => `- ${s}`).join('\n')}\n`
      );

      const { description } = (await run(interaction(), handler)).data.embeds![0];

      expect(description.length).toBeLessThanOrEqual(4000);
      const lines = description.split('\n');
      // The cut announces itself…
      expect(lines.pop()).toBe('…');
      // …and the last kept line is a whole bullet, never a torn one.
      expect(items.some((s) => lines[lines.length - 1] === `• ${s}`)).toBe(true);
    });

    it('reports empty when the bundled markdown parses to nothing', async () => {
      // Parse failures are silent by design (see changelog-parser.ts); a file
      // that drifts off the grammar must still answer, not throw.
      const handler = await handlerWithMarkdown('# Changelog\n\nnothing here');

      const body = await run(interaction(), handler);

      expect(JSON.stringify(body)).toContain('changelog.empty');
    });
  });
});
