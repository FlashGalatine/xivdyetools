/**
 * /glamour adapter: the .chara attachment guards it shares with /swatch, the
 * resolve call through the api-worker service binding, and the card + embed
 * it posts. The business logic is bot-logic's executeGlamour (mocked here).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GlamourInput } from '@xivdyetools/bot-logic';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { handleGlamourCommand } from './glamour.js';
import type { Env, DiscordInteraction, InteractionResponseBody } from '../../types/env.js';

vi.mock('../../services/svg/renderer.js', () => ({
  renderSvgToPng: vi.fn().mockResolvedValue(new Uint8Array([1])),
}));

const mockSafeEdit = vi.fn().mockResolvedValue(true);
vi.mock('../../utils/discord-api.js', () => ({
  safeEditOriginalResponse: (...args: unknown[]) => mockSafeEdit(...args),
}));

vi.mock('../../services/preferences.js', () => ({
  getUserPreferences: vi.fn().mockResolvedValue({ theme: 'light' }),
}));

vi.mock('../../services/bot-i18n.js', async () => {
  const { createTranslator } = await import('@xivdyetools/bot-logic/i18n');
  return {
    createTranslator,
    createUserTranslator: vi.fn().mockResolvedValue(createTranslator('en')),
  };
});

const markMock = vi.fn();
vi.mock('../../services/command-trace.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/command-trace.js')>();
  return { ...actual, markCommandOutcome: (...args: unknown[]) => markMock(...args) };
});

const mockExecuteGlamour = vi.fn();
vi.mock('@xivdyetools/bot-logic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xivdyetools/bot-logic')>();
  return {
    ...actual,
    executeGlamour: (...args: unknown[]) => mockExecuteGlamour(...args),
  };
});

const CDN_URL = 'https://cdn.discordapp.com/attachments/1/2/look.chara?ex=1&is=2&hm=3';

function makeInteraction(url: string, size = 2048): DiscordInteraction {
  return {
    id: 'int-1',
    application_id: 'app-1',
    type: 2,
    token: 'token-1',
    locale: 'en-US',
    member: { user: { id: 'user-1' } },
    data: {
      name: 'glamour',
      options: [{ name: 'file', type: 11, value: 'att-1' }],
      resolved: {
        attachments: {
          'att-1': { id: 'att-1', filename: 'look.chara', size, url, proxy_url: url, content_type: 'application/json' },
        },
      },
    },
  } as unknown as DiscordInteraction;
}

describe('/glamour', () => {
  let env: Env;
  let ctx: ExecutionContext;
  let pending: Promise<unknown>[];
  let binding: { fetch: ReturnType<typeof vi.fn> };

  const settle = () => Promise.all(pending);
  const lastEdit = () => (mockSafeEdit.mock.calls.at(-1) as unknown[])[2] as {
    embeds: Array<{ title?: string; description?: string; image?: { url: string } }>;
    file?: { name: string; contentType: string };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    pending = [];
    binding = {
      fetch: vi.fn(async () =>
        Response.json({ success: true, data: { items: { HeadGear: { itemId: 2629 } }, glasses: null } })
      ),
    };
    env = {
      DISCORD_PUBLIC_KEY: 'k',
      DISCORD_TOKEN: 't',
      DISCORD_CLIENT_ID: 'app-1',
      KV: {} as KVNamespace,
      UNIVERSALIS_PROXY: binding as unknown as Fetcher,
    } as unknown as Env;
    ctx = {
      waitUntil: vi.fn((p: Promise<unknown>) => {
        pending.push(p);
      }),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"REyeColor":42}'))
    );
    mockExecuteGlamour.mockResolvedValue({
      ok: true,
      svgString: '<svg/>',
      embed: { title: 'Glamour · 5 dyed pieces', description: '**Glamour Items:**', color: 0 },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses an attachment that is not on a Discord CDN host before deferring', async () => {
    const res = await handleGlamourCommand(makeInteraction('https://evil.example/look.chara'), env, ctx);
    const body = (await res.json()) as InteractionResponseBody;

    expect(body.type).toBe(4);
    expect(body.data?.flags).toBe(64);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
  });

  it('refuses a file past 1 MiB before deferring', async () => {
    const res = await handleGlamourCommand(makeInteraction(CDN_URL, 2 * 1_048_576), env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data?.content).toBe('Could not read the file — it is larger than 1 MB');
  });

  it('defers, reads the file and posts the card with the list in the embed', async () => {
    const res = await handleGlamourCommand(makeInteraction(CDN_URL), env, ctx);
    expect(((await res.json()) as InteractionResponseBody).type).toBe(5);
    await settle();

    const call = mockExecuteGlamour.mock.calls[0][0] as GlamourInput;
    expect(call.fileText).toBe('{"REyeColor":42}');
    expect(call.locale).toBe('en');
    expect(call.theme).toBe('light');

    const edit = lastEdit();
    expect(edit.embeds[0].title).toBe('Glamour · 5 dyed pieces');
    expect(edit.embeds[0].description).toBe('**Glamour Items:**');
    expect(edit.embeds[0].image?.url).toBe('attachment://glamour.png');
    expect(edit.file).toMatchObject({ name: 'glamour.png', contentType: 'image/png' });
  });

  it.each(['en', 'ja', 'zh'] as const)(
    'renders the card with the %s user locale, which picks the CJK font load order',
    async (locale) => {
      // JP loads first only for ja, so Japanese item names draw in Japanese
      // letterforms and zh/ko/en renders stay as they were (font-load-order.test.ts)
      const { createUserTranslator } = await import('../../services/bot-i18n.js');
      const { createTranslator } = await import('@xivdyetools/bot-logic/i18n');
      vi.mocked(createUserTranslator).mockResolvedValueOnce(createTranslator(locale));
      const { renderSvgToPng } = await import('../../services/svg/renderer.js');

      await handleGlamourCommand(makeInteraction(CDN_URL), env, ctx);
      await settle();

      expect((mockExecuteGlamour.mock.calls[0][0] as GlamourInput).locale).toBe(locale);
      expect(renderSvgToPng).toHaveBeenCalledWith('<svg/>', { scale: 2, locale });
    },
  );

  it('hands bot-logic the request logger, so a card that fails to draw says why (BUG-125)', async () => {
    const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } as unknown as ExtendedLogger;
    await handleGlamourCommand(makeInteraction(CDN_URL), env, ctx, logger);
    await settle();

    expect((mockExecuteGlamour.mock.calls[0][0] as GlamourInput).logger).toBe(logger);
  });

  it('logs the failure code, never the reply text, when bot-logic fails', async () => {
    // The reply can quote the file (a name, a gear value); none of it may reach a log
    const SENTINEL = 'Real Name Sentinel 7f3a';
    const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };
    mockExecuteGlamour.mockResolvedValue({
      ok: false,
      error: 'GENERATION_FAILED',
      errorMessage: `Failed to generate the card for ${SENTINEL}`,
    });
    const interaction = makeInteraction(CDN_URL);
    await handleGlamourCommand(interaction, env, ctx, logger as unknown as ExtendedLogger);
    await settle();

    expect(markMock).toHaveBeenCalledWith(interaction, 'render');
    expect(logger.warn).toHaveBeenCalledWith('Glamour command failed', { error: 'GENERATION_FAILED' });
    // The reply did carry it, so its absence below is the adapter's doing
    expect(lastEdit().embeds[0].description).toContain(SENTINEL);
    const logged = [logger.debug, logger.info, logger.warn, logger.error]
      .flatMap((level) => level.mock.calls.flat())
      .map((arg: unknown) =>
        arg instanceof Error
          ? `${arg.name} ${arg.message} ${arg.stack ?? ''}`
          : JSON.stringify(arg),
      )
      .join('\n');
    expect(logged).not.toContain(SENTINEL);
  });

  it("tells the card which names the bundled fonts can't draw", async () => {
    await handleGlamourCommand(makeInteraction(CDN_URL), env, ctx);
    await settle();
    const { canDraw } = mockExecuteGlamour.mock.calls[0][0] as GlamourInput;

    expect(canDraw).toBeTypeOf('function');
    expect(canDraw!('Hempen Coif')).toBe(true);
  });

  it('resolves the worn models through the api-worker binding', async () => {
    await handleGlamourCommand(makeInteraction(CDN_URL), env, ctx);
    await settle();
    const { resolve } = mockExecuteGlamour.mock.calls[0][0] as GlamourInput;

    const answer = await resolve([{ slot: 'HeadGear', base: 361, variant: 5 }], 40);

    expect(answer.items.HeadGear).toEqual({ itemId: 2629 });
    const request = binding.fetch.mock.calls[0][0] as Request;
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe('/v1/chara/resolve');
    expect(await request.json()).toEqual({ gear: [{ slot: 'HeadGear', base: 361, variant: 5 }], glasses: 40 });
  });

  it('rejects the resolve when api-worker does not answer with items', async () => {
    binding.fetch.mockResolvedValue(new Response('busy', { status: 503 }));
    await handleGlamourCommand(makeInteraction(CDN_URL), env, ctx);
    await settle();
    const { resolve } = mockExecuteGlamour.mock.calls[0][0] as GlamourInput;

    await expect(resolve([{ slot: 'HeadGear', base: 361, variant: 5 }], null)).rejects.toThrow('503');
  });

  it('carries the api-worker status on a refused resolve, so a 429 reads as busy', async () => {
    binding.fetch.mockResolvedValue(new Response('slow down', { status: 429 }));
    await handleGlamourCommand(makeInteraction(CDN_URL), env, ctx);
    await settle();
    const { resolve } = mockExecuteGlamour.mock.calls[0][0] as GlamourInput;

    await expect(resolve([{ slot: 'HeadGear', base: 361, variant: 5 }], null)).rejects.toMatchObject({ status: 429 });
  });

  it("carries api-worker's own reason on a refused file's error, beside its status", async () => {
    const reason = 'gear[0].base must be an integer between 0 and 65535';
    binding.fetch.mockResolvedValue(Response.json({ success: false, error: 'VALIDATION_ERROR', message: reason }, { status: 400 }));
    await handleGlamourCommand(makeInteraction(CDN_URL), env, ctx);
    await settle();
    const { resolve } = mockExecuteGlamour.mock.calls[0][0] as GlamourInput;

    await expect(resolve([{ slot: 'Body', base: 70000, variant: 1 }], null)).rejects.toMatchObject({ status: 400, message: reason });
  });

  it('falls back to the status when a refusal carries no reason', async () => {
    binding.fetch.mockResolvedValue(new Response('too large', { status: 413 }));
    await handleGlamourCommand(makeInteraction(CDN_URL), env, ctx);
    await settle();
    const { resolve } = mockExecuteGlamour.mock.calls[0][0] as GlamourInput;

    await expect(resolve([{ slot: 'Body', base: 1, variant: 1 }], null)).rejects.toMatchObject({
      status: 413,
      message: 'api-worker answered 413',
    });
  });

  it('answers a file api-worker refuses as a problem with the file, traced as input, not as an outage', async () => {
    const { executeGlamour } = await vi.importActual<typeof import('@xivdyetools/bot-logic')>('@xivdyetools/bot-logic');
    mockExecuteGlamour.mockImplementation(executeGlamour);
    // A hand edit past the game's uint16 model lane: the parser takes it, api-worker does not
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          Tribe: 'Midlander',
          Gender: 'Feminine',
          REyeColor: 42,
          Body: { ModelBase: 70000, ModelVariant: 1, DyeId: 0, DyeId2: 0 },
        })
      )
    );
    const reason = 'gear[0].base must be an integer between 0 and 65535';
    binding.fetch.mockResolvedValue(Response.json({ success: false, error: 'VALIDATION_ERROR', message: reason }, { status: 400 }));
    const interaction = makeInteraction(CDN_URL);
    await handleGlamourCommand(interaction, env, ctx);
    await settle();

    expect(markMock).toHaveBeenCalledWith(interaction, 'image_input');
    const edit = lastEdit();
    expect(edit.file).toBeUndefined();
    // HC-002: a localized reason, not api-worker's English one
    expect(edit.embeds[0].description).toContain('Could not read the file — it is not a .chara file the bot can read');
    expect(edit.embeds[0].description).not.toContain('65535');
    expect(edit.embeds[0].description).not.toMatch(/try again/i);
  });

  it('records a busy lookup as rate limited, not as a failure of ours', async () => {
    mockExecuteGlamour.mockResolvedValue({
      ok: false,
      error: 'RESOLVE_BUSY',
      errorMessage: 'The item lookup is busy right now. Try again in a minute.',
    });
    const interaction = makeInteraction(CDN_URL);
    await handleGlamourCommand(interaction, env, ctx);
    await settle();

    expect(markMock).toHaveBeenCalledWith(interaction, 'rate_limited');
    expect(lastEdit().embeds[0].description).toContain('busy');
  });

  it('answers a failed read with the error, never a card', async () => {
    mockExecuteGlamour.mockResolvedValue({
      ok: false,
      error: 'RESOLVE_FAILED',
      errorMessage: "Couldn't look up the items right now. Try again in a minute.",
    });
    await handleGlamourCommand(makeInteraction(CDN_URL), env, ctx);
    await settle();

    const edit = lastEdit();
    expect(edit.embeds[0].description).toContain('look up the items');
    expect(edit.file).toBeUndefined();
  });

  describe('the resolve transport', () => {
    const resolveVia = async (over: Partial<Env>) => {
      env = { ...env, ...over } as Env;
      await handleGlamourCommand(makeInteraction(CDN_URL), env, ctx);
      await settle();
      return (mockExecuteGlamour.mock.calls[0][0] as GlamourInput).resolve;
    };

    it('uses UNIVERSALIS_PROXY_URL in local development, without glasses when there are none', async () => {
      const resolve = await resolveVia({ UNIVERSALIS_PROXY: undefined, UNIVERSALIS_PROXY_URL: 'http://localhost:8787' });
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(Response.json({ success: true, data: { items: {} } }));

      const answer = await resolve([{ slot: 'Body', base: 1, variant: 1 }], null);

      expect(answer).toEqual({ items: {}, glasses: null });
      const [url, init] = fetchMock.mock.calls.at(-1)!;
      expect(url).toBe('http://localhost:8787/v1/chara/resolve');
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({ gear: [{ slot: 'Body', base: 1, variant: 1 }] });
    });

    // bot-logic logs '[glamour] resolve failed: <class> <code>' (never the
    // message), so the code is what tells these two apart from an outage.
    it('refuses to resolve with no binding and no URL', async () => {
      const resolve = await resolveVia({ UNIVERSALIS_PROXY: undefined, UNIVERSALIS_PROXY_URL: undefined });
      await expect(resolve([], null)).rejects.toMatchObject({
        message: expect.stringContaining('not configured'),
        code: 'BINDING_MISSING',
      });
    });

    it('refuses an envelope that does not carry items', async () => {
      binding.fetch.mockResolvedValue(Response.json({ success: false, error: 'NOPE' }));
      const resolve = await resolveVia({});
      await expect(resolve([], null)).rejects.toMatchObject({
        message: expect.stringContaining('Malformed'),
        code: 'MALFORMED_ENVELOPE',
      });
    });
  });

  describe('failures answer with an error, never a card', () => {
    it('a download the CDN refuses', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('gone', { status: 403 }));
      await handleGlamourCommand(makeInteraction(CDN_URL), env, ctx);
      await settle();

      expect(mockExecuteGlamour).not.toHaveBeenCalled();
      expect(lastEdit().embeds[0].description).toContain('the download failed (HTTP 403)');
    });

    it('a download that never arrives', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('timeout'));
      await handleGlamourCommand(makeInteraction(CDN_URL), env, ctx);
      await settle();

      expect(mockExecuteGlamour).not.toHaveBeenCalled();
      expect(lastEdit().file).toBeUndefined();
    });

    it.each(['PARSE_FAILED', 'GENERATION_FAILED'])('%s', async (error) => {
      mockExecuteGlamour.mockResolvedValue({ ok: false, error, errorMessage: 'Could not read the file — bad' });
      await handleGlamourCommand(makeInteraction(CDN_URL), env, ctx);
      await settle();
      expect(lastEdit().embeds[0].description).toContain('Could not read the file');
    });

    it('a card that fails to render', async () => {
      const { renderSvgToPng } = await import('../../services/svg/renderer.js');
      vi.mocked(renderSvgToPng).mockRejectedValueOnce(new Error('resvg'));
      await handleGlamourCommand(makeInteraction(CDN_URL), env, ctx);
      await settle();
      expect(lastEdit().file).toBeUndefined();
    });
  });

  it('answers a request with no user in the interaction locale', async () => {
    const interaction = makeInteraction(CDN_URL);
    delete (interaction as { member?: unknown }).member;
    await handleGlamourCommand(interaction, env, ctx);
    await settle();

    const call = mockExecuteGlamour.mock.calls[0][0] as GlamourInput;
    expect(call.locale).toBe('en');
    expect(call.theme).toBeUndefined();
  });
});
