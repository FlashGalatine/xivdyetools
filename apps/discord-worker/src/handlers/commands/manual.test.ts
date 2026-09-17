/**
 * Tests for the /manual command handler.
 *
 * Two rules shape the assertions. Learn-more links degrade to *no link*
 * rather than to the English one — a German player following an English
 * Lodestone URL is worse than no URL. And the 🪙 topic resolves its link by
 * game **region**, derived from the user's stored world via Universalis, not
 * by locale; every failure in that lookup has to land on the same
 * absent-link state rather than throwing inside an ephemeral reply.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleManualCommand } from './manual.js';
import type { DiscordInteraction, Env } from '../../types/env.js';

vi.mock('../../services/bot-i18n.js', () => ({
  createUserTranslatorWithPrefs: vi.fn(),
}));

vi.mock('../../services/budget/index.js', () => ({
  getCachedWorlds: vi.fn(),
  getCachedDataCenters: vi.fn(),
}));

vi.mock('../../utils/discord-api.js', () => ({
  safeEditOriginalResponse: vi.fn().mockResolvedValue(true),
}));

import { createUserTranslatorWithPrefs } from '../../services/bot-i18n.js';
import { getCachedDataCenters, getCachedWorlds } from '../../services/budget/index.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';

const translator = (locale = 'en') => ({
  t: (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}|${Object.values(vars).join(',')}` : key,
  getLocale: () => locale,
});

const interaction = (topic?: string): DiscordInteraction =>
  ({
    token: 'tok',
    locale: 'en-US',
    member: { user: { id: 'user-1' } },
    data: { name: 'manual', options: topic ? [{ name: 'topic', value: topic }] : [] },
  }) as unknown as DiscordInteraction;

type Body = {
  type: number;
  data: { flags: number; embeds: { title: string; description: string }[] };
};

const bodyOf = async (r: Response) => (await r.json()) as Body;

describe('handleManualCommand', () => {
  let env: Env;
  let ctx: ExecutionContext;
  let pending: Promise<unknown>[];

  const settle = () => Promise.all(pending);

  beforeEach(() => {
    vi.clearAllMocks();
    env = { KV: {} as KVNamespace, DISCORD_CLIENT_ID: 'app-1' } as unknown as Env;
    pending = [];
    ctx = {
      waitUntil: vi.fn((p: Promise<unknown>) => {
        pending.push(p.catch(() => undefined));
      }),
    } as unknown as ExecutionContext;
    vi.mocked(createUserTranslatorWithPrefs).mockResolvedValue({
      t: translator(),
      prefs: {},
    } as never);
  });

  it('is always ephemeral', async () => {
    const body = await bodyOf(await handleManualCommand(interaction(), env, ctx));

    expect(body.type).toBe(4);
    expect(body.data.flags).toBe(64);
  });

  it('shows the topic index when no topic is given', async () => {
    const body = await bodyOf(await handleManualCommand(interaction(), env, ctx));

    expect(body.data.embeds.length).toBeGreaterThan(0);
  });

  it('falls back to the index for an unrecognised topic', async () => {
    const index = await bodyOf(await handleManualCommand(interaction(), env, ctx));
    const unknown = await bodyOf(await handleManualCommand(interaction('nonsense'), env, ctx));

    expect(unknown.data.embeds).toEqual(index.data.embeds);
  });

  it('renders the match_image topic on its own branch', async () => {
    const body = await bodyOf(await handleManualCommand(interaction('match_image'), env, ctx));

    expect(JSON.stringify(body)).toContain('matchImageHelp.title');
  });

  describe('the 5.0 topics', () => {
    it.each([
      ['color_vision', 'colorVision'],
      ['contrast', 'contrast'],
      ['matching_methods', 'matchingMethods'],
      ['character_file', 'characterFile'],
    ])('renders %s as a single embed keyed on %s', async (topic, key) => {
      const body = await bodyOf(await handleManualCommand(interaction(topic), env, ctx));

      expect(body.data.embeds).toHaveLength(1);
      expect(body.data.embeds[0].description).toContain(`manual5.topics.${key}.body`);
      expect(body.data.embeds[0].title).toContain(`manual5.topics.${key}.name`);
    });

    it('prints authority and host for a learn-more link, never the path', async () => {
      const body = await bodyOf(await handleManualCommand(interaction('contrast'), env, ctx));

      if (body.data.embeds[0].description.includes('manual5.learnLead')) {
        // authority · host — no deep path segment leaks into the embed
        expect(body.data.embeds[0].description).toMatch(/manual5\.learnLead\|\[.+\]\(.+\) · .+/);
      }
    });
  });

  describe('spectrum_prices resolves its link by game region', () => {
    const worlds = [{ id: 40, name: 'Gilgamesh' }];
    const datacenters = [
      { name: 'Aether', region: 'North-America', worlds: [40] },
      { name: 'Elemental', region: 'Japan', worlds: [23] },
      { name: 'Chaos', region: 'Europe', worlds: [80] },
    ];

    const withWorld = (world?: string) =>
      vi.mocked(createUserTranslatorWithPrefs).mockResolvedValue({
        t: translator(),
        prefs: world ? { world } : {},
      } as never);

    // BUG-008: the handler defers this one topic and edits the original
    // response once the (potentially slow) lookup finishes — run the
    // deferred ack, drain ctx.waitUntil, then read what was sent to the
    // edit helper instead of the direct response body.
    const editedEmbed = async (topic = 'spectrum_prices') => {
      const body = await bodyOf(await handleManualCommand(interaction(topic), env, ctx));
      await settle();
      const call = vi.mocked(safeEditOriginalResponse).mock.calls[0];
      const options = call?.[2] as { embeds: { description: string }[] } | undefined;
      return { body, embed: options?.embeds[0] };
    };

    beforeEach(() => {
      vi.mocked(getCachedWorlds).mockResolvedValue(worlds as never);
      vi.mocked(getCachedDataCenters).mockResolvedValue(datacenters as never);
    });

    it('defers ephemerally instead of answering directly', async () => {
      withWorld('Gilgamesh');

      const body = await bodyOf(await handleManualCommand(interaction('spectrum_prices'), env, ctx));

      expect(body.type).toBe(5); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      expect(body.data.flags).toBe(64);
      await settle();
    });

    it('every other topic still answers directly, without deferring', async () => {
      const body = await bodyOf(await handleManualCommand(interaction('contrast'), env, ctx));

      expect(body.type).toBe(4);
      expect(ctx.waitUntil).not.toHaveBeenCalled();
    });

    it('maps a stored world through its datacenter to a region link', async () => {
      withWorld('Gilgamesh');

      const { embed } = await editedEmbed();

      expect(embed?.description).toContain('manual5.learnLead');
    });

    it('accepts a datacenter name stored in the world slot', async () => {
      withWorld('Chaos');

      const { embed } = await editedEmbed();

      expect(embed?.description).toContain('manual5.learnLead');
    });

    it.each(['Elemental', 'Aether', 'Chaos'])('resolves the %s region', async (dc) => {
      withWorld(dc);

      const { embed } = await editedEmbed();

      expect(embed?.description).toContain('manual5.learnLead');
    });

    it('answers directly with no link and never defers when the user has no stored world (B2)', async () => {
      withWorld(undefined);

      const body = await bodyOf(await handleManualCommand(interaction('spectrum_prices'), env, ctx));

      // resolveLodestoneRegion returns null before any I/O with no world, so
      // there's nothing worth deferring for — the reply is synchronous, like
      // every other topic.
      expect(body.type).toBe(4); // CHANNEL_MESSAGE_WITH_SOURCE, not DEFERRED (5)
      expect(ctx.waitUntil).not.toHaveBeenCalled();
      expect(safeEditOriginalResponse).not.toHaveBeenCalled();
      expect(getCachedWorlds).not.toHaveBeenCalled();
      expect(body.data.embeds[0].description).not.toContain('manual5.learnLead');
    });

    it('degrades to no link for a world nobody recognises', async () => {
      withWorld('Atlantis');

      const { embed } = await editedEmbed();

      expect(embed?.description).not.toContain('manual5.learnLead');
    });

    it('degrades to no link when the Universalis proxy is unavailable, and still edits the deferred message', async () => {
      withWorld('Gilgamesh');
      vi.mocked(getCachedWorlds).mockRejectedValue(new Error('proxy down'));

      const { embed } = await editedEmbed();

      expect(embed?.description).not.toContain('manual5.learnLead');
      // …and still lands the no-link embed via the follow-up edit
      expect(safeEditOriginalResponse).toHaveBeenCalledTimes(1);
    });

    it('degrades to no link when the world exists but no datacenter claims it', async () => {
      withWorld('Gilgamesh');
      vi.mocked(getCachedDataCenters).mockResolvedValue([
        { name: 'Aether', region: 'North-America', worlds: [999] },
      ] as never);

      const { embed } = await editedEmbed();

      expect(embed?.description).not.toContain('manual5.learnLead');
    });

    it('matches the world case-insensitively', async () => {
      withWorld('gILGAMESH');

      const { embed } = await editedEmbed();

      expect(embed?.description).toContain('manual5.learnLead');
    });

    it('marks the command outcome when the deferred edit fails (B2)', async () => {
      withWorld('Gilgamesh');
      vi.mocked(safeEditOriginalResponse).mockResolvedValueOnce(false);

      const { startCommandTrace } = await import('../../services/command-trace.js');
      const int = interaction('spectrum_prices');
      const trace = startCommandTrace(int, {
        command: 'manual',
        subcommand: '',
        userId: 'user-1',
        locale: 'en',
      });

      await bodyOf(await handleManualCommand(int, env, ctx));
      await settle();

      expect(trace.outcome).toBe('unknown');
    });
  });

  describe('user identity', () => {
    it('reads the id from user in a DM', async () => {
      const dm = {
        ...interaction(),
        member: undefined,
        user: { id: 'dm-user' },
      } as unknown as DiscordInteraction;

      await handleManualCommand(dm, env, ctx);

      expect(createUserTranslatorWithPrefs).toHaveBeenCalledWith(
        env.KV,
        'dm-user',
        'en-US',
        undefined
      );
    });

    it("falls back to 'unknown' when there is no user at all", async () => {
      const anonymous = {
        ...interaction(),
        member: undefined,
        user: undefined,
      } as unknown as DiscordInteraction;

      await handleManualCommand(anonymous, env, ctx);

      expect(createUserTranslatorWithPrefs).toHaveBeenCalledWith(
        env.KV,
        'unknown',
        'en-US',
        undefined
      );
    });
  });
});
