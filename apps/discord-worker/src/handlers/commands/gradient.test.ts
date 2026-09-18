/**
 * Tests for the /gradient command handler (adapter — BUG-033).
 *
 * The adapter validates the two colour options, defers, resolves matching
 * method (explicit option > stored preference > suite default), delegates to
 * bot-logic's `executeGradient`, rebuilds the description with Discord
 * emojis (looked up by STAIN id, per the BUG-032 comment in gradient.ts —
 * see the dedicated test below), renders the SVG, and marks the command
 * outcome on a render failure. Modelled on `contrast.test.ts`'s scaffold.
 *
 * NOTE (brief deviations — task-4b-brief.md BUG-033 items 2 and 3):
 * Reading `gradient.ts` end to end shows the adapter performs NEITHER of
 * the two checks the brief assumed:
 *   - No duplicate-dye rejection exists. Two identical `start_color` /
 *     `end_color` inputs are accepted and passed straight through to
 *     `executeGradient` — there is no equality check anywhere in this file.
 *   - No stage cap exists in the adapter. `stepCount` is read from the
 *     `steps` option and passed to `executeGradient` completely unclamped;
 *     the schema's `min_value: 2` / `max_value: 12` are Discord-client-side
 *     only and do not constrain a raw interaction payload. The "3-stage cap"
 *     named in this app's CLAUDE.md turns out to describe `capGradientRows`
 *     inside bot-logic's `executeGradient` (which this file mocks away), not
 *     anything in the adapter — and that function actually caps at 5 rows,
 *     not 3 (see `packages/bot-logic/src/commands/gradient.ts`).
 * Per the brief's own instruction to test "according to the actual code,"
 * the tests below document the CURRENT (unclamped, unchecked) adapter
 * behaviour instead of asserting a rejection/cap that does not exist.
 * Reported as concerns, not fixed (no production edits).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGradientCommand } from './gradient.js';
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

vi.mock('../../services/svg/renderer.js', () => ({
  renderSvgToPng: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));

vi.mock('../../utils/discord-api.js', () => ({
  safeEditOriginalResponse: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('../../services/emoji.js', () => ({
  getDyeEmoji: vi.fn((stainId: number) =>
    stainId === 1 ? '🟥' : stainId === 2 ? '🟩' : undefined,
  ),
}));

const DYE_FIXTURES: Record<
  string,
  { hex: string; name: string; id: number; itemID: number; stainID: number }
> = {
  'Rolanberry Red': { hex: '#FF0000', name: 'Rolanberry Red', id: 1, itemID: 5729, stainID: 1 },
  'Celeste Green': { hex: '#00FF00', name: 'Celeste Green', id: 2, itemID: 5730, stainID: 2 },
};

function resolveFixture(value: string) {
  if (value === 'nosuchdye') return null;
  return (
    DYE_FIXTURES[value] ?? { hex: '#ABCDEF', name: `Resolved ${value}`, id: 3, itemID: 5731, stainID: 3 }
  );
}

vi.mock('@xivdyetools/bot-logic', () => ({
  executeGradient: vi.fn().mockResolvedValue({
    ok: true,
    svgString: '<svg>gradient</svg>',
    gradientSteps: [
      { hex: '#FF0000', dyeName: 'Rolanberry Red', dye: { stainID: 1, hex: '#FF0000' }, distance: 0 },
      { hex: '#00FF00', dyeName: 'Celeste Green', dye: { stainID: 2, hex: '#00FF00' }, distance: 0 },
    ],
    startColor: { hex: '#FF0000' },
    endColor: { hex: '#00FF00' },
    omittedRows: 0,
    embed: { title: 'Gradient', footer: 'Custom Footer', color: 0x123456 },
  }),
  resolveColorInput: vi.fn((value: string) => resolveFixture(value)),
}));

import { executeGradient, resolveColorInput } from '@xivdyetools/bot-logic';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';
import { getDyeEmoji } from '../../services/emoji.js';

describe('handleGradientCommand', () => {
  let env: Env;
  let ctx: ExecutionContext;
  let deferred: Promise<unknown>[];

  const interaction = (
    options: Array<{ name: string; value: string | number }>,
    overrides: Partial<DiscordInteraction> = {},
  ): DiscordInteraction =>
    ({
      id: 'int-1',
      application_id: 'app-1',
      token: 'interaction-token',
      locale: 'en-US',
      member: { user: { id: 'user-1' } },
      data: { name: 'gradient', options },
      ...overrides,
    }) as unknown as DiscordInteraction;

  const colorOptions = (extra: Array<{ name: string; value: string | number }> = []) => [
    { name: 'start_color', value: 'Rolanberry Red' },
    { name: 'end_color', value: 'Celeste Green' },
    ...extra,
  ];

  /** Run whatever the handler handed to ctx.waitUntil. */
  const settle = () => Promise.all(deferred);

  beforeEach(() => {
    deferred = [];
    env = {
      DISCORD_CLIENT_ID: 'client-id',
      DISCORD_TOKEN: 'token',
      // Real preferences.ts + a null-returning KV: resolveMatchingMethod runs
      // for real, so the ciede2000-default test exercises production wiring.
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
    vi.mocked(executeGradient).mockResolvedValue({
      ok: true,
      svgString: '<svg>gradient</svg>',
      gradientSteps: [
        { hex: '#FF0000', dyeName: 'Rolanberry Red', dye: { stainID: 1, hex: '#FF0000' }, distance: 0 },
        { hex: '#00FF00', dyeName: 'Celeste Green', dye: { stainID: 2, hex: '#00FF00' }, distance: 0 },
      ],
      startColor: { hex: '#FF0000' },
      endColor: { hex: '#00FF00' },
      omittedRows: 0,
      embed: { title: 'Gradient', footer: 'Custom Footer', color: 0x123456 },
    } as never);
    vi.mocked(renderSvgToPng).mockResolvedValue(new Uint8Array([1, 2, 3]) as never);
    vi.mocked(resolveColorInput).mockImplementation((value: string) => resolveFixture(value) as never);
  });

  describe('input validation', () => {
    it('rejects when start_color is missing', async () => {
      const response = await handleGradientCommand(
        interaction([{ name: 'end_color', value: 'Celeste Green' }]),
        env,
        ctx,
      );
      const body = (await response.json()) as { type: number; data: { flags: number } };

      expect(body.type).toBe(4);
      expect(body.data.flags).toBe(64);
      expect(ctx.waitUntil).not.toHaveBeenCalled();
      expect(executeGradient).not.toHaveBeenCalled();
    });

    it('names the offending input when start_color cannot be resolved', async () => {
      const response = await handleGradientCommand(
        interaction([
          { name: 'start_color', value: 'nosuchdye' },
          { name: 'end_color', value: 'Celeste Green' },
        ]),
        env,
        ctx,
      );
      const body = (await response.json()) as { data: { embeds: { description: string }[] } };

      expect(body.data.embeds[0].description).toBe('invalid:nosuchdye');
      expect(ctx.waitUntil).not.toHaveBeenCalled();
    });

    it('names the offending input when end_color cannot be resolved', async () => {
      const response = await handleGradientCommand(
        interaction([
          { name: 'start_color', value: 'Rolanberry Red' },
          { name: 'end_color', value: 'nosuchdye' },
        ]),
        env,
        ctx,
      );
      const body = (await response.json()) as { data: { embeds: { description: string }[] } };

      expect(body.data.embeds[0].description).toBe('invalid:nosuchdye');
      expect(ctx.waitUntil).not.toHaveBeenCalled();
      expect(executeGradient).not.toHaveBeenCalled();
    });
  });

  describe('happy path (two distinct dyes, default stages)', () => {
    it('calls executeGradient with resolved colours and the documented defaults', async () => {
      const response = await handleGradientCommand(interaction(colorOptions()), env, ctx);
      const body = (await response.json()) as { type: number };

      expect(body.type).toBe(5); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      await settle();

      expect(resolveColorInput).toHaveBeenCalledWith('Rolanberry Red', { locale: 'en' });
      expect(vi.mocked(executeGradient).mock.calls[0][0]).toMatchObject({
        startColor: expect.objectContaining({ hex: '#FF0000' }),
        endColor: expect.objectContaining({ hex: '#00FF00' }),
        stepCount: 6,
        colorSpace: 'hsv',
        matchingMethod: 'ciede2000',
        locale: 'en',
      });
    });

    it('edits the original response with the rendered card and dye list', async () => {
      await handleGradientCommand(interaction(colorOptions()), env, ctx);
      await settle();

      expect(renderSvgToPng).toHaveBeenCalledWith('<svg>gradient</svg>', { scale: 2 });

      const payload = vi.mocked(safeEditOriginalResponse).mock.calls[0][2] as {
        embeds: { title: string; description: string; color: number; image: { url: string }; footer: { text: string } }[];
        file: { name: string; contentType: string };
      };
      expect(payload.embeds[0].title).toBe('Gradient');
      expect(payload.embeds[0].footer.text).toBe('Custom Footer');
      expect(payload.embeds[0].image.url).toBe('attachment://image.png');
      expect(payload.embeds[0].color).toBe(0xff0000); // hexToDiscordColor(startColor.hex)
      expect(payload.embeds[0].description).toContain('Rolanberry Red');
      expect(payload.embeds[0].description).toContain('Celeste Green');
      expect(payload.embeds[0].description).toContain('#FF0000');
      expect(payload.embeds[0].description).toContain('#00FF00');
      expect(payload.file.name).toBe('gradient-6-steps.png');
      expect(payload.file.contentType).toBe('image/png');
    });

    it('looks up each step emoji by STAIN id, not itemID (BUG-032 regression)', async () => {
      await handleGradientCommand(interaction(colorOptions()), env, ctx);
      await settle();

      // The fixture steps carry dye.stainID 1 and 2 — an itemID lookup
      // (5729/5730) would come back undefined and drop the chip entirely.
      expect(getDyeEmoji).toHaveBeenCalledWith(1, 'client-id');
      expect(getDyeEmoji).toHaveBeenCalledWith(2, 'client-id');
      const payload = vi.mocked(safeEditOriginalResponse).mock.calls[0][2] as {
        embeds: { description: string }[];
      };
      expect(payload.embeds[0].description).toContain('🟥');
      expect(payload.embeds[0].description).toContain('🟩');
    });

    it('passes an explicit color_space and matching option through', async () => {
      await handleGradientCommand(
        interaction(colorOptions([
          { name: 'color_space', value: 'oklch' },
          { name: 'matching', value: 'redmean' },
        ])),
        env,
        ctx,
      );
      await settle();

      expect(vi.mocked(executeGradient).mock.calls[0][0]).toMatchObject({
        colorSpace: 'oklch',
        matchingMethod: 'redmean',
      });
    });
  });

  describe('duplicate dyes (documents current behaviour — see file header NOTE)', () => {
    it('does NOT reject identical start_color and end_color inputs', async () => {
      const response = await handleGradientCommand(
        interaction([
          { name: 'start_color', value: 'Rolanberry Red' },
          { name: 'end_color', value: 'Rolanberry Red' },
        ]),
        env,
        ctx,
      );
      const body = (await response.json()) as { type: number };

      // NOTE: gradient.ts has no duplicate-dye check. This is the current,
      // shipped behaviour, not a fix — a degenerate (identical) gradient is
      // silently accepted and forwarded to bot-logic.
      expect(body.type).toBe(5);
      await settle();
      expect(executeGradient).toHaveBeenCalled();
      const call = vi.mocked(executeGradient).mock.calls[0][0];
      expect(call.startColor.hex).toBe(call.endColor.hex);
    });
  });

  describe('stage count (documents current behaviour — see file header NOTE)', () => {
    it('passes an in-schema-range steps value straight through unmodified', async () => {
      await handleGradientCommand(interaction(colorOptions([{ name: 'steps', value: 12 }])), env, ctx);
      await settle();

      expect(vi.mocked(executeGradient).mock.calls[0][0]).toMatchObject({ stepCount: 12 });
    });

    it('NOTE: applies no cap at all — an out-of-schema value reaches bot-logic unclamped', async () => {
      // The schema's max_value: 12 is enforced by the Discord client only; a
      // raw interaction payload (a replayed/forged webhook, or a future
      // schema mismatch) is not re-checked here.
      await handleGradientCommand(interaction(colorOptions([{ name: 'steps', value: 999 }])), env, ctx);
      await settle();

      expect(vi.mocked(executeGradient).mock.calls[0][0]).toMatchObject({ stepCount: 999 });
    });

    it('NOTE: steps=0 falls back to the default 6, because `|| 6` treats 0 as falsy', async () => {
      // gradient.ts: `(options.find(...)?.value as number) || 6`. A `??`
      // would only fall back on null/undefined; `||` also catches the
      // legitimate-looking value 0. Below the schema's min_value: 2, so a
      // real client can't produce it, but a raw payload can.
      await handleGradientCommand(interaction(colorOptions([{ name: 'steps', value: 0 }])), env, ctx);
      await settle();

      expect(vi.mocked(executeGradient).mock.calls[0][0]).toMatchObject({ stepCount: 6 });
    });
  });

  describe('render failure -> render outcome', () => {
    it('marks a render outcome on GENERATION_FAILED', async () => {
      vi.mocked(executeGradient).mockResolvedValue({
        ok: false,
        error: 'GENERATION_FAILED',
        errorMessage: 'boom',
      } as never);
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const { startCommandTrace } = await import('../../services/command-trace.js');
      const int = interaction(colorOptions());
      const trace = startCommandTrace(int, { command: 'gradient', subcommand: '', userId: 'u1', locale: 'en' });

      await handleGradientCommand(int, env, ctx, logger as never);
      await settle();

      expect(trace.outcome).toBe('render');
      expect(logger.error).toHaveBeenCalledWith('Gradient command error');
      expect(renderSvgToPng).not.toHaveBeenCalled();
      expect(vi.mocked(safeEditOriginalResponse).mock.calls[0][2]).toMatchObject({
        embeds: [{ description: 'errors.generationFailed' }],
      });
    });

    it('marks a render outcome when rasterization throws', async () => {
      vi.mocked(renderSvgToPng).mockRejectedValue(new Error('resvg exploded'));
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const { startCommandTrace } = await import('../../services/command-trace.js');
      const int = interaction(colorOptions());
      const trace = startCommandTrace(int, { command: 'gradient', subcommand: '', userId: 'u1', locale: 'en' });

      await handleGradientCommand(int, env, ctx, logger as never);
      await settle();

      expect(trace.outcome).toBe('render');
      expect(logger.error).toHaveBeenCalledWith('Gradient render error', expect.any(Error));
      expect(vi.mocked(safeEditOriginalResponse).mock.calls[0][2]).toMatchObject({
        embeds: [{ description: 'errors.generationFailed' }],
      });
    });

    it('answers the interaction even without a logger', async () => {
      vi.mocked(renderSvgToPng).mockRejectedValue(new Error('resvg exploded'));

      await handleGradientCommand(interaction(colorOptions()), env, ctx);
      // `settle()` is `Promise.all(deferred)`, which resolves to `[]` (and
      // passes `resolves.toBeDefined()`) even when nothing deferred — assert
      // the handler actually queued background work before awaiting it.
      expect(deferred).toHaveLength(1);
      await settle();

      expect(safeEditOriginalResponse).toHaveBeenCalled();
    });

    it('survives a non-Error rejection and still answers the interaction', async () => {
      vi.mocked(renderSvgToPng).mockRejectedValue('a string, not an Error');
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      await handleGradientCommand(interaction(colorOptions()), env, ctx, logger as never);
      await settle();

      // `error instanceof Error ? error : undefined` — the false branch.
      expect(logger.error).toHaveBeenCalledWith('Gradient render error', undefined);
      expect(safeEditOriginalResponse).toHaveBeenCalled();
    });
  });
});
