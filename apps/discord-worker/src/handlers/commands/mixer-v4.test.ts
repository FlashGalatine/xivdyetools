/**
 * Tests for the /mixer command handler (V4 adapter, dye blending — BUG-034).
 *
 * The adapter's job: validate the two dye options before deferring, resolve
 * blending/matching mode (explicit option > stored preference > suite
 * default), delegate to bot-logic's `executeMixer`, render the SVG, and mark
 * the command outcome on a render failure. Modelled on `contrast.test.ts`'s
 * scaffold (real `preferences.ts` + a null-returning KV so the real default
 * resolution runs, mocked bot-logic/render/discord-api).
 *
 * NOTE (brief deviation): task-4b-brief.md's BUG-034 item 2 asks for
 * "ratio bounds" clamp/reject coverage. Reading `commands/schemas.ts` (the
 * /mixer registration) and `mixer-v4.ts` shows the command has NO
 * ratio/percentage option at all — the five blend ratios
 * (`MIXER_SWEEP_RATIOS = [25, 40, 50, 65, 80]`) are a fixed constant consumed
 * entirely inside bot-logic's `executeMixer`, which this adapter test mocks
 * away. There is nothing in `mixer-v4.ts` for an adapter-level ratio test to
 * exercise. Per the brief's own instruction to assert "against what
 * mixer-v4.ts actually does," this file substitutes coverage of the other
 * real option the handler resolves the same way (`matching`), explicit +
 * default, in its place. Reported as a concern, not fixed (no production
 * edits).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMixerV4Command } from './mixer-v4.js';
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
  initializeLocale: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/svg/renderer.js', () => ({
  renderSvgToPng: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));

vi.mock('../../utils/discord-api.js', () => ({
  safeEditOriginalResponse: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@xivdyetools/bot-logic', () => ({
  executeMixer: vi.fn().mockResolvedValue({
    ok: true,
    svgString: '<svg>mixer</svg>',
    blendingMode: 'ryb',
    sweep: [],
    embed: { title: 'Mixer Result', description: '**50%** · Rolanberry Red', color: 0x123456 },
  }),
  resolveColorInput: vi.fn((value: string) =>
    value === 'nosuchdye'
      ? null
      : {
          hex: '#FFFFFF',
          name: `Resolved ${value}`,
          id: 1,
          itemID: 5729,
          stainID: 1,
        },
  ),
}));

import { executeMixer, resolveColorInput } from '@xivdyetools/bot-logic';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';

describe('handleMixerV4Command', () => {
  let env: Env;
  let ctx: ExecutionContext;
  let deferred: Promise<unknown>[];

  const interaction = (
    options: Array<{ name: string; value: string }>,
    overrides: Partial<DiscordInteraction> = {},
  ): DiscordInteraction =>
    ({
      id: 'int-1',
      application_id: 'app-1',
      token: 'interaction-token',
      locale: 'en-US',
      member: { user: { id: 'user-1' } },
      data: { name: 'mixer', options },
      ...overrides,
    }) as unknown as DiscordInteraction;

  const dyeOptions = (extra: Array<{ name: string; value: string }> = []) => [
    { name: 'dye1', value: 'Rolanberry Red' },
    { name: 'dye2', value: 'Celeste Green' },
    ...extra,
  ];

  /** Run whatever the handler handed to ctx.waitUntil. */
  const settle = () => Promise.all(deferred);

  beforeEach(() => {
    deferred = [];
    env = {
      DISCORD_CLIENT_ID: 'client-id',
      DISCORD_TOKEN: 'token',
      // getUserPreferences falls through to migrateLegacyPreferences and
      // returns `{}` when every kv.get resolves null — the real
      // resolveBlendingMode / resolveMatchingMethod then run for real,
      // which is what lets the RYB-default test below actually exercise
      // the BUG-006 code path instead of a stubbed answer.
      KV: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null }),
      } as unknown as KVNamespace,
    } as unknown as Env;
    ctx = {
      waitUntil: vi.fn((p: Promise<unknown>) => deferred.push(p)),
    } as unknown as ExecutionContext;

    vi.clearAllMocks();
    vi.mocked(executeMixer).mockResolvedValue({
      ok: true,
      svgString: '<svg>mixer</svg>',
      blendingMode: 'ryb',
      sweep: [],
      embed: { title: 'Mixer Result', description: '**50%** · Rolanberry Red', color: 0x123456 },
    } as never);
    vi.mocked(renderSvgToPng).mockResolvedValue(new Uint8Array([1, 2, 3]) as never);
    vi.mocked(resolveColorInput).mockImplementation((value: string) =>
      value === 'nosuchdye'
        ? null
        : ({
            hex: '#FFFFFF',
            name: `Resolved ${value}`,
            id: 1,
            itemID: 5729,
            stainID: 1,
          } as never),
    );
    // KV mock functions are fresh objects per beforeEach already (see above),
    // so no separate reset is needed for them.
  });

  describe('input validation (before the defer)', () => {
    it('rejects when dye1 is missing without deferring', async () => {
      const response = await handleMixerV4Command(
        interaction([{ name: 'dye2', value: 'Celeste Green' }]),
        env,
        ctx,
      );
      const body = (await response.json()) as { type: number; data: { flags: number; embeds: { description: string }[] } };

      expect(body.type).toBe(4);
      expect(body.data.flags).toBe(64);
      expect(body.data.embeds[0].description).toBe('mixer.bothRequired');
      expect(ctx.waitUntil).not.toHaveBeenCalled();
      expect(executeMixer).not.toHaveBeenCalled();
    });

    it('rejects when dye2 is missing without deferring', async () => {
      const response = await handleMixerV4Command(
        interaction([{ name: 'dye1', value: 'Rolanberry Red' }]),
        env,
        ctx,
      );
      const body = (await response.json()) as { type: number };

      expect(body.type).toBe(4);
      expect(ctx.waitUntil).not.toHaveBeenCalled();
    });

    it('names the offending input when dye1 cannot be resolved', async () => {
      const response = await handleMixerV4Command(
        interaction(dyeOptions([]).map((o) => (o.name === 'dye1' ? { ...o, value: 'nosuchdye' } : o))),
        env,
        ctx,
      );
      const body = (await response.json()) as { data: { embeds: { description: string }[] } };

      expect(body.data.embeds[0].description).toBe('invalid:nosuchdye');
      expect(ctx.waitUntil).not.toHaveBeenCalled();
    });

    it('names the offending input when dye2 cannot be resolved', async () => {
      const response = await handleMixerV4Command(
        interaction(dyeOptions([]).map((o) => (o.name === 'dye2' ? { ...o, value: 'nosuchdye' } : o))),
        env,
        ctx,
      );
      const body = (await response.json()) as { data: { embeds: { description: string }[] } };

      expect(body.data.embeds[0].description).toBe('invalid:nosuchdye');
      expect(ctx.waitUntil).not.toHaveBeenCalled();
    });
  });

  describe('mode option -> bot-logic call args', () => {
    // The command's full choice list (commands/schemas.ts /mixer -> mode).
    const modes = ['rgb', 'lab', 'oklab', 'ryb', 'hsl', 'spectral'] as const;

    it.each(modes)('passes mode=%s through to executeMixer as blendingMode', async (mode) => {
      await handleMixerV4Command(interaction(dyeOptions([{ name: 'mode', value: mode }])), env, ctx);
      await settle();

      expect(vi.mocked(executeMixer).mock.calls[0][0]).toMatchObject({ blendingMode: mode });
    });

    // BUG-006 (2026-09-02 audit): a prior refactor broke exactly this default,
    // and only bot-logic's own tests caught it — nothing at the adapter layer
    // pinned "no mode option" to RYB.
    it('defaults blendingMode to RYB when no mode option is given', async () => {
      await handleMixerV4Command(interaction(dyeOptions()), env, ctx);
      await settle();

      expect(vi.mocked(executeMixer).mock.calls[0][0]).toMatchObject({ blendingMode: 'ryb' });
    });
  });

  // Substitutes brief item 2 (ratio bounds) — see file header NOTE.
  describe('matching option -> bot-logic call args', () => {
    it('passes an explicit matching method through', async () => {
      await handleMixerV4Command(
        interaction(dyeOptions([{ name: 'matching', value: 'redmean' }])),
        env,
        ctx,
      );
      await settle();

      expect(vi.mocked(executeMixer).mock.calls[0][0]).toMatchObject({ matchingMethod: 'redmean' });
    });

    it('defaults matchingMethod to ciede2000 when no matching option is given', async () => {
      await handleMixerV4Command(interaction(dyeOptions()), env, ctx);
      await settle();

      expect(vi.mocked(executeMixer).mock.calls[0][0]).toMatchObject({ matchingMethod: 'ciede2000' });
    });
  });

  describe('failure paths', () => {
    it('does not mark a render outcome on NO_MATCHES (answers with the no-match message)', async () => {
      vi.mocked(executeMixer).mockResolvedValue({
        ok: false,
        error: 'NO_MATCHES',
        errorMessage: 'no matches',
      } as never);

      const { startCommandTrace } = await import('../../services/command-trace.js');
      const int = interaction(dyeOptions());
      const trace = startCommandTrace(int, { command: 'mixer', subcommand: '', userId: 'u1', locale: 'en' });

      await handleMixerV4Command(int, env, ctx);
      await settle();

      expect(trace.outcome).toBeNull();
      expect(vi.mocked(safeEditOriginalResponse).mock.calls[0][2]).toMatchObject({
        embeds: [{ description: 'errors.noMatchFound' }],
      });
      expect(renderSvgToPng).not.toHaveBeenCalled();
    });

    it('marks a render outcome on GENERATION_FAILED', async () => {
      vi.mocked(executeMixer).mockResolvedValue({
        ok: false,
        error: 'GENERATION_FAILED',
        errorMessage: 'boom',
      } as never);
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const { startCommandTrace } = await import('../../services/command-trace.js');
      const int = interaction(dyeOptions());
      const trace = startCommandTrace(int, { command: 'mixer', subcommand: '', userId: 'u1', locale: 'en' });

      await handleMixerV4Command(int, env, ctx, logger as never);
      await settle();

      expect(trace.outcome).toBe('render');
      expect(logger.error).toHaveBeenCalledWith('Mixer command error');
      expect(vi.mocked(safeEditOriginalResponse).mock.calls[0][2]).toMatchObject({
        embeds: [{ description: 'errors.generationFailed' }],
      });
    });

    it('marks a render outcome when rasterization throws', async () => {
      vi.mocked(renderSvgToPng).mockRejectedValue(new Error('resvg exploded'));
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const { startCommandTrace } = await import('../../services/command-trace.js');
      const int = interaction(dyeOptions());
      const trace = startCommandTrace(int, { command: 'mixer', subcommand: '', userId: 'u1', locale: 'en' });

      await handleMixerV4Command(int, env, ctx, logger as never);
      await settle();

      expect(trace.outcome).toBe('render');
      expect(logger.error).toHaveBeenCalledWith('Mixer render error', expect.any(Error));
      expect(vi.mocked(safeEditOriginalResponse).mock.calls[0][2]).toMatchObject({
        embeds: [{ description: 'errors.generationFailed' }],
      });
    });

    it('answers the interaction even without a logger', async () => {
      vi.mocked(renderSvgToPng).mockRejectedValue(new Error('resvg exploded'));

      await handleMixerV4Command(interaction(dyeOptions()), env, ctx);
      await expect(settle()).resolves.toBeDefined();

      expect(safeEditOriginalResponse).toHaveBeenCalled();
    });

    it('survives a non-Error rejection and still answers the interaction', async () => {
      vi.mocked(renderSvgToPng).mockRejectedValue('a string, not an Error');
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      await handleMixerV4Command(interaction(dyeOptions()), env, ctx, logger as never);
      await settle();

      // `error instanceof Error ? error : undefined` — the false branch.
      expect(logger.error).toHaveBeenCalledWith('Mixer render error', undefined);
      expect(safeEditOriginalResponse).toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('defers, then edits the original response with the rendered card', async () => {
      const response = await handleMixerV4Command(interaction(dyeOptions()), env, ctx);
      const body = (await response.json()) as { type: number };

      expect(body.type).toBe(5); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      await settle();

      expect(renderSvgToPng).toHaveBeenCalledWith('<svg>mixer</svg>', { scale: 2 });
      expect(resolveColorInput).toHaveBeenCalledWith('Rolanberry Red', {
        excludeFacewear: true,
        locale: 'en',
      });

      const payload = vi.mocked(safeEditOriginalResponse).mock.calls[0][2] as {
        embeds: { title: string; description: string; color: number; image: { url: string } }[];
        file: { name: string; contentType: string };
      };
      expect(payload.embeds[0].title).toBe('Mixer Result');
      expect(payload.embeds[0].description).toBe('**50%** · Rolanberry Red');
      expect(payload.embeds[0].color).toBe(0x123456);
      expect(payload.embeds[0].image.url).toBe('attachment://mixer.png');
      expect(payload.file.name).toBe('mixer.png');
      expect(payload.file.contentType).toBe('image/png');
    });
  });
});
