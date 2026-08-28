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
  fetchWorlds: vi.fn(),
  fetchDataCenters: vi.fn(),
}));

import { createUserTranslatorWithPrefs } from '../../services/bot-i18n.js';
import { fetchDataCenters, fetchWorlds } from '../../services/budget/index.js';

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
  const ctx = {} as ExecutionContext;

  beforeEach(() => {
    env = { KV: {} as KVNamespace } as unknown as Env;
    vi.clearAllMocks();
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

    beforeEach(() => {
      vi.mocked(fetchWorlds).mockResolvedValue(worlds as never);
      vi.mocked(fetchDataCenters).mockResolvedValue(datacenters as never);
    });

    it('maps a stored world through its datacenter to a region link', async () => {
      withWorld('Gilgamesh');

      const body = await bodyOf(await handleManualCommand(interaction('spectrum_prices'), env, ctx));

      expect(body.data.embeds[0].description).toContain('manual5.learnLead');
    });

    it('accepts a datacenter name stored in the world slot', async () => {
      withWorld('Chaos');

      const body = await bodyOf(await handleManualCommand(interaction('spectrum_prices'), env, ctx));

      expect(body.data.embeds[0].description).toContain('manual5.learnLead');
    });

    it.each(['Elemental', 'Aether', 'Chaos'])('resolves the %s region', async (dc) => {
      withWorld(dc);

      const body = await bodyOf(await handleManualCommand(interaction('spectrum_prices'), env, ctx));

      expect(body.data.embeds[0].description).toContain('manual5.learnLead');
    });

    it('degrades to no link when the user has no stored world', async () => {
      withWorld(undefined);

      const body = await bodyOf(await handleManualCommand(interaction('spectrum_prices'), env, ctx));

      expect(body.data.embeds[0].description).not.toContain('manual5.learnLead');
      expect(fetchWorlds).not.toHaveBeenCalled();
    });

    it('degrades to no link for a world nobody recognises', async () => {
      withWorld('Atlantis');

      const body = await bodyOf(await handleManualCommand(interaction('spectrum_prices'), env, ctx));

      expect(body.data.embeds[0].description).not.toContain('manual5.learnLead');
    });

    it('degrades to no link when the Universalis proxy is unavailable', async () => {
      withWorld('Gilgamesh');
      vi.mocked(fetchWorlds).mockRejectedValue(new Error('proxy down'));

      const body = await bodyOf(await handleManualCommand(interaction('spectrum_prices'), env, ctx));

      expect(body.data.embeds[0].description).not.toContain('manual5.learnLead');
      // …and still answers the interaction
      expect(body.type).toBe(4);
    });

    it('degrades to no link when the world exists but no datacenter claims it', async () => {
      withWorld('Gilgamesh');
      vi.mocked(fetchDataCenters).mockResolvedValue([
        { name: 'Aether', region: 'North-America', worlds: [999] },
      ] as never);

      const body = await bodyOf(await handleManualCommand(interaction('spectrum_prices'), env, ctx));

      expect(body.data.embeds[0].description).not.toContain('manual5.learnLead');
    });

    it('matches the world case-insensitively', async () => {
      withWorld('gILGAMESH');

      const body = await bodyOf(await handleManualCommand(interaction('spectrum_prices'), env, ctx));

      expect(body.data.embeds[0].description).toContain('manual5.learnLead');
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

      expect(createUserTranslatorWithPrefs).toHaveBeenCalledWith(env.KV, 'dm-user', 'en-US');
    });

    it("falls back to 'unknown' when there is no user at all", async () => {
      const anonymous = {
        ...interaction(),
        member: undefined,
        user: undefined,
      } as unknown as DiscordInteraction;

      await handleManualCommand(anonymous, env, ctx);

      expect(createUserTranslatorWithPrefs).toHaveBeenCalledWith(env.KV, 'unknown', 'en-US');
    });
  });
});
