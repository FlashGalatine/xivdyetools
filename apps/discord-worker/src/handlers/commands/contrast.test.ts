/**
 * Tests for the /contrast command handler (adapter).
 *
 * The adapter's whole job is: collect the dye options, reject bad input
 * *before* deferring, then hand off to bot-logic and render. The
 * defer-boundary matters — Discord shows a permanent "application did not
 * respond" if an error path defers and then never edits, so the two
 * validation failures must return a type-4 response rather than a deferral.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleContrastCommand } from './contrast.js';
import type { DiscordInteraction, Env } from '../../types/env.js';

vi.mock('../../services/bot-i18n.js', () => {
  const translator = (locale: string) => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      key === 'errors.invalidColor' ? `invalid:${vars?.input}` : key,
    getLocale: () => locale,
  });
  return {
    createUserTranslator: vi.fn().mockResolvedValue(translator('en')),
    createTranslator: vi.fn((locale: string) => translator(locale)),
  };
});

vi.mock('../../services/i18n.js', () => ({
  discordLocaleToLocaleCode: vi.fn(() => 'en'),
  initializeLocale: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/preferences.js', () => ({
  getUserPreferences: vi.fn().mockResolvedValue({ theme: 'dark' }),
}));

vi.mock('../../utils/color.js', () => ({
  resolveColorInput: vi.fn((value: string) => {
    if (value === 'nosuchdye') return null;
    return {
      hex: '#FFFFFF',
      name: `Resolved ${value}`,
      itemID: 5729,
      dye: { id: 1, name: `Resolved ${value}`, hex: '#FFFFFF' },
    };
  }),
}));

vi.mock('../../services/svg/renderer.js', () => ({
  renderSvgToPng: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));

vi.mock('../../utils/discord-api.js', () => ({
  safeEditOriginalResponse: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@xivdyetools/bot-logic', () => ({
  executeContrast: vi.fn().mockResolvedValue({
    ok: true,
    svgString: '<svg>contrast</svg>',
    embed: { title: 'Contrast', description: 'desc', color: 0x123456 },
  }),
}));

import { executeContrast } from '@xivdyetools/bot-logic';
import { getUserPreferences } from '../../services/preferences.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { resolveColorInput } from '../../utils/color.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';

describe('handleContrastCommand', () => {
  let env: Env;
  let ctx: ExecutionContext;
  let deferred: Promise<unknown>[];

  const interaction = (
    dyes: string[],
    overrides: Partial<DiscordInteraction> = {}
  ): DiscordInteraction =>
    ({
      token: 'interaction-token',
      locale: 'en-US',
      member: { user: { id: 'user-1' } },
      data: {
        name: 'contrast',
        options: dyes.map((value, i) => ({ name: `dye${i + 1}`, value })),
      },
      ...overrides,
    }) as unknown as DiscordInteraction;

  /** Run whatever the handler handed to ctx.waitUntil. */
  const settle = () => Promise.all(deferred);

  beforeEach(() => {
    deferred = [];
    env = {
      DISCORD_CLIENT_ID: 'client-id',
      DISCORD_TOKEN: 'token',
      KV: {} as KVNamespace,
    } as unknown as Env;
    ctx = {
      waitUntil: vi.fn((p: Promise<unknown>) => deferred.push(p)),
    } as unknown as ExecutionContext;

    vi.clearAllMocks();
    vi.mocked(executeContrast).mockResolvedValue({
      ok: true,
      svgString: '<svg>contrast</svg>',
      embed: { title: 'Contrast', description: 'desc', color: 0x123456 },
    } as never);
    vi.mocked(renderSvgToPng).mockResolvedValue(new Uint8Array([1, 2, 3]) as never);
    vi.mocked(getUserPreferences).mockResolvedValue({ theme: 'dark' } as never);
    vi.mocked(resolveColorInput).mockImplementation((value: string) =>
      value === 'nosuchdye'
        ? null
        : ({
            hex: '#FFFFFF',
            name: `Resolved ${value}`,
            itemID: 5729,
            dye: { id: 1, name: `Resolved ${value}`, hex: '#FFFFFF' },
          } as never)
    );
  });

  describe('input validation (before the defer)', () => {
    it('rejects fewer than two dyes without deferring', async () => {
      const response = await handleContrastCommand(interaction(['Snow White']), env, ctx);
      const body = (await response.json()) as { type: number; data: { flags: number } };

      expect(body.type).toBe(4);
      expect(body.data.flags).toBe(64);
      expect(ctx.waitUntil).not.toHaveBeenCalled();
    });

    it('rejects zero dyes', async () => {
      const response = await handleContrastCommand(interaction([]), env, ctx);
      const body = (await response.json()) as { type: number };

      expect(body.type).toBe(4);
      expect(ctx.waitUntil).not.toHaveBeenCalled();
    });

    it('names the offending input when a dye cannot be resolved', async () => {
      const response = await handleContrastCommand(
        interaction(['Snow White', 'nosuchdye']),
        env,
        ctx
      );
      const body = (await response.json()) as {
        data: { embeds: { description?: string; fields?: unknown }[] };
      };

      expect(ctx.waitUntil).not.toHaveBeenCalled();
      expect(JSON.stringify(body)).toContain('invalid:nosuchdye');
    });

    it('ignores options that are not dye slots', async () => {
      const withExtras = interaction(['Snow White', 'Soot Black']);
      withExtras.data!.options!.push({ name: 'theme', value: 'light' } as never);

      await handleContrastCommand(withExtras, env, ctx);
      await settle();

      expect(vi.mocked(executeContrast).mock.calls[0][0].dyes).toHaveLength(2);
    });

    it('skips options with an empty value', async () => {
      const withEmpty = interaction(['Snow White', 'Soot Black']);
      withEmpty.data!.options!.push({ name: 'dye3', value: '' } as never);

      await handleContrastCommand(withEmpty, env, ctx);
      await settle();

      expect(vi.mocked(executeContrast).mock.calls[0][0].dyes).toHaveLength(2);
    });

    it('caps at four dyes — the command schema only offers four slots', async () => {
      await handleContrastCommand(
        interaction(['one', 'two', 'three', 'four', 'five']),
        env,
        ctx
      );
      await settle();

      expect(vi.mocked(executeContrast).mock.calls[0][0].dyes).toHaveLength(4);
    });
  });

  describe('the happy path', () => {
    it('defers, then edits the original response with the rendered card', async () => {
      const response = await handleContrastCommand(
        interaction(['Snow White', 'Soot Black']),
        env,
        ctx
      );
      const body = (await response.json()) as { type: number };

      expect(body.type).toBe(5); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      await settle();

      expect(renderSvgToPng).toHaveBeenCalledWith('<svg>contrast</svg>', { scale: 2 });
      const payload = vi.mocked(safeEditOriginalResponse).mock.calls[0][2] as {
        embeds: { title: string; image: { url: string } }[];
        file: { name: string; contentType: string };
      };
      expect(payload.embeds[0].title).toBe('Contrast');
      expect(payload.embeds[0].image.url).toBe('attachment://contrast.png');
      expect(payload.file.name).toBe('contrast.png');
      expect(payload.file.contentType).toBe('image/png');
    });

    it('passes the stored card theme through to bot-logic', async () => {
      vi.mocked(getUserPreferences).mockResolvedValue({ theme: 'light' } as never);

      await handleContrastCommand(interaction(['Snow White', 'Soot Black']), env, ctx);
      await settle();

      expect(vi.mocked(executeContrast).mock.calls[0][0].theme).toBe('light');
    });

    it('falls back to the resolved hex when a colour has no name', async () => {
      vi.mocked(resolveColorInput).mockReturnValue({
        hex: '#abcdef',
        itemID: undefined,
        dye: undefined,
      } as never);

      await handleContrastCommand(interaction(['#abcdef', '#123456']), env, ctx);
      await settle();

      expect(vi.mocked(executeContrast).mock.calls[0][0].dyes[0].name).toBe('#ABCDEF');
    });
  });

  describe('user identity', () => {
    it('reads the user id from member.user in a guild', async () => {
      await handleContrastCommand(interaction(['Snow White', 'Soot Black']), env, ctx);

      expect(getUserPreferences).toHaveBeenCalledWith(env.KV, 'user-1');
    });

    it('reads the user id from user in a DM', async () => {
      const dm = interaction(['Snow White', 'Soot Black'], {
        member: undefined,
        user: { id: 'dm-user' },
      } as Partial<DiscordInteraction>);

      await handleContrastCommand(dm, env, ctx);

      expect(getUserPreferences).toHaveBeenCalledWith(env.KV, 'dm-user');
    });

    it('skips the preference lookup entirely when there is no user id', async () => {
      const anonymous = interaction(['Snow White', 'Soot Black'], {
        member: undefined,
        user: undefined,
      } as Partial<DiscordInteraction>);

      await handleContrastCommand(anonymous, env, ctx);
      await settle();

      expect(getUserPreferences).not.toHaveBeenCalled();
      expect(vi.mocked(executeContrast).mock.calls[0][0].theme).toBeUndefined();
    });

    it('defaults the locale when the interaction carries none', async () => {
      const noLocale = interaction(['Snow White', 'Soot Black'], {
        member: undefined,
        user: undefined,
        locale: undefined,
      } as Partial<DiscordInteraction>);

      await handleContrastCommand(noLocale, env, ctx);
      await settle();

      expect(vi.mocked(executeContrast).mock.calls[0][0].locale).toBe('en');
    });
  });

  describe('failure after the defer', () => {
    it('edits in an error embed when bot-logic reports failure', async () => {
      vi.mocked(executeContrast).mockResolvedValue({
        ok: false,
        error: 'GENERATION_FAILED',
        errorMessage: 'nope',
      } as never);
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      await handleContrastCommand(
        interaction(['Snow White', 'Soot Black']),
        env,
        ctx,
        logger as never
      );
      await settle();

      expect(logger.error).toHaveBeenCalled();
      expect(renderSvgToPng).not.toHaveBeenCalled();
      expect(JSON.stringify(vi.mocked(safeEditOriginalResponse).mock.calls[0][2])).toContain(
        'errors.generationFailed'
      );
    });

    it('edits in an error embed when rasterization throws', async () => {
      vi.mocked(renderSvgToPng).mockRejectedValue(new Error('resvg exploded'));
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      await handleContrastCommand(
        interaction(['Snow White', 'Soot Black']),
        env,
        ctx,
        logger as never
      );
      await settle();

      expect(logger.error).toHaveBeenCalled();
      expect(JSON.stringify(vi.mocked(safeEditOriginalResponse).mock.calls[0][2])).toContain(
        'errors.generationFailed'
      );
    });

    it('survives a non-Error rejection and still answers the interaction', async () => {
      vi.mocked(renderSvgToPng).mockRejectedValue('a string, not an Error');

      await handleContrastCommand(interaction(['Snow White', 'Soot Black']), env, ctx);
      await settle();

      expect(safeEditOriginalResponse).toHaveBeenCalled();
    });

    it('works without a logger', async () => {
      vi.mocked(executeContrast).mockResolvedValue({
        ok: false,
        error: 'GENERATION_FAILED',
        errorMessage: 'nope',
      } as never);

      await handleContrastCommand(interaction(['Snow White', 'Soot Black']), env, ctx);

      await expect(settle()).resolves.toBeDefined();
      expect(safeEditOriginalResponse).toHaveBeenCalled();
    });
  });
});
