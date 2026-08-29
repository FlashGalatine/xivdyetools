/**
 * /swatch handler — attachment download hardening (FINDING-033) and the
 * public parse-error embed (FINDING-019), 2026-08-21 security audit.
 *
 * The attachment URL comes from Discord's signed `resolved.attachments`, so
 * the host allowlist, timeout, no-redirect and post-download cap are
 * defence-in-depth against a lying `size`, a slow CDN or a future change
 * that lets a non-Discord URL reach the handler. The parse-error path is
 * a PUBLIC edit of the deferred message, and the parser echoes `.chara`
 * field VALUES — attacker-controlled file content — into it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { escapeDiscordMarkdown } from '@xivdyetools/bot-logic';
import { handleSwatchCommand } from './swatch.js';
import type { Env, DiscordInteraction, InteractionResponseBody } from '../../types/env.js';

vi.mock('../../services/svg/renderer.js', () => ({
  renderSvgToPng: vi.fn().mockResolvedValue(new Uint8Array([1])),
}));

const mockSafeEdit = vi.fn().mockResolvedValue(true);
vi.mock('../../utils/discord-api.js', () => ({
  safeEditOriginalResponse: (...args: unknown[]) => mockSafeEdit(...args),
}));

vi.mock('../../services/preferences.js', () => ({
  getUserPreferences: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../services/bot-i18n.js', async () => {
  const { createTranslator } = await import('@xivdyetools/bot-logic/i18n');
  return {
    createTranslator,
    createUserTranslator: vi.fn().mockResolvedValue(createTranslator('en')),
  };
});

const mockExecuteSwatch = vi.fn();
vi.mock('@xivdyetools/bot-logic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xivdyetools/bot-logic')>();
  return {
    ...actual,
    executeSwatch: (...args: unknown[]) => mockExecuteSwatch(...args),
  };
});

const CDN_URL = 'https://cdn.discordapp.com/attachments/1/2/char.chara?ex=1&is=2&hm=3';
const MIB = 1_048_576;

function makeInteraction(url: string, size = 2048): DiscordInteraction {
  return {
    id: 'int-1',
    application_id: 'app-1',
    type: 2,
    token: 'token-1',
    locale: 'en-US',
    member: { user: { id: 'user-1' } },
    data: {
      name: 'swatch',
      options: [{ name: 'file', type: 11, value: 'att-1' }],
      resolved: {
        attachments: {
          'att-1': {
            id: 'att-1',
            filename: 'char.chara',
            size,
            url,
            proxy_url: url,
            content_type: 'application/json',
          },
        },
      },
    },
  } as unknown as DiscordInteraction;
}

/** A body of exactly `bytes` bytes, streamed in 64 KiB chunks (no Content-Length). */
function streamOf(bytes: number): ReadableStream<Uint8Array> {
  const chunk = new Uint8Array(64 * 1024).fill(0x61);
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= bytes) {
        controller.close();
        return;
      }
      const n = Math.min(chunk.byteLength, bytes - sent);
      controller.enqueue(chunk.subarray(0, n));
      sent += n;
    },
  });
}

describe('/swatch attachment handling', () => {
  let env: Env;
  let ctx: ExecutionContext;
  let pending: Promise<unknown>[];

  const settle = () => Promise.all(pending);
  const lastEditEmbed = (): { description?: string } => {
    const call = mockSafeEdit.mock.calls.at(-1) as unknown[];
    return (call[2] as { embeds: Array<{ description?: string }> }).embeds[0];
  };

  beforeEach(() => {
    vi.clearAllMocks();
    pending = [];
    env = {
      DISCORD_PUBLIC_KEY: 'k',
      DISCORD_TOKEN: 't',
      DISCORD_CLIENT_ID: 'app-1',
      KV: {} as KVNamespace,
    } as unknown as Env;
    ctx = {
      waitUntil: vi.fn((p: Promise<unknown>) => {
        pending.push(p);
      }),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"SkinColor":1}')),
    );
    mockExecuteSwatch.mockResolvedValue({
      ok: true,
      svgString: '<svg/>',
      embed: { title: 't', description: 'd', color: 0 },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('host allowlist (FINDING-033)', () => {
    it('refuses an attachment that is not on a Discord CDN host before deferring', async () => {
      const res = await handleSwatchCommand(
        makeInteraction('https://evil.example/char.chara'),
        env,
        ctx,
      );
      const body = (await res.json()) as InteractionResponseBody;

      expect(body.type).toBe(4);
      expect(body.data!.flags).toBe(64);
      expect(fetch).not.toHaveBeenCalled();
      expect(ctx.waitUntil).not.toHaveBeenCalled();
    });

    it('refuses a plain-http Discord URL and a look-alike host', async () => {
      for (const url of [
        'http://cdn.discordapp.com/attachments/1/2/char.chara',
        'https://cdn.discordapp.com.evil.example/attachments/1/2/char.chara',
        'not a url',
      ]) {
        const res = await handleSwatchCommand(makeInteraction(url), env, ctx);
        const body = (await res.json()) as InteractionResponseBody;
        expect(body.type).toBe(4);
        expect(body.data!.flags).toBe(64);
      }
      expect(fetch).not.toHaveBeenCalled();
    });

    it.each([
      'https://cdn.discordapp.com/attachments/1/2/char.chara',
      'https://media.discordapp.net/attachments/1/2/char.chara',
    ])('accepts %s and defers', async (url) => {
      const res = await handleSwatchCommand(makeInteraction(url), env, ctx);
      expect(((await res.json()) as InteractionResponseBody).type).toBe(5);

      await settle();
      expect(fetch).toHaveBeenCalledWith(url, expect.anything());
      expect(mockExecuteSwatch).toHaveBeenCalled();
    });
  });

  describe('download limits (FINDING-033)', () => {
    it('fetches with a timeout signal and never follows redirects', async () => {
      await handleSwatchCommand(makeInteraction(CDN_URL), env, ctx);
      await settle();

      expect(fetch).toHaveBeenCalledWith(
        CDN_URL,
        // `manual`, not `error` — workerd rejects `error` outright (2026-08-29)
        expect.objectContaining({ redirect: 'manual', signal: expect.any(AbortSignal) }),
      );
    });

    it('rejects a response whose Content-Length exceeds the cap without reading it', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(streamOf(10), { headers: { 'content-length': String(2 * MIB) } }),
      );

      await handleSwatchCommand(makeInteraction(CDN_URL), env, ctx);
      await settle();

      expect(mockExecuteSwatch).not.toHaveBeenCalled();
      expect(lastEditEmbed().description).toContain('too large');
    });

    it('rejects a body that turns out larger than the cap even when Discord reported a small size', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(streamOf(MIB + 1)));

      await handleSwatchCommand(makeInteraction(CDN_URL, 512), env, ctx);
      await settle();

      expect(mockExecuteSwatch).not.toHaveBeenCalled();
      expect(lastEditEmbed().description).toContain('too large');
    });

    it('hands the downloaded text to executeSwatch when it is within the cap', async () => {
      await handleSwatchCommand(makeInteraction(CDN_URL), env, ctx);
      await settle();

      expect(mockExecuteSwatch).toHaveBeenCalledWith(
        expect.objectContaining({ fileText: '{"SkinColor":1}' }),
      );
    });

    it('still refuses an attachment Discord itself reports as over the cap', async () => {
      const res = await handleSwatchCommand(makeInteraction(CDN_URL, MIB + 1), env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      expect(body.type).toBe(4);
      expect(body.data!.flags).toBe(64);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('public parse-error embed (FINDING-019)', () => {
    it('sanitises the parser message (file values are attacker-controlled) before the public edit', async () => {
      const hostile = '[Free gil, click](https://phish.example) @everyone **now**';
      mockExecuteSwatch.mockResolvedValue({
        ok: false,
        error: 'parse',
        errorMessage: `Could not read the file — .chara field SkinColor: unrecognised value "${hostile}"`,
      });

      await handleSwatchCommand(makeInteraction(CDN_URL), env, ctx);
      await settle();

      const description = lastEditEmbed().description!;
      expect(description).not.toContain('[Free gil, click](https://phish.example)');
      expect(description).toContain(escapeDiscordMarkdown('[Free gil, click](https://phish.example)'));
      expect(description).not.toContain('@everyone');
      expect(description).not.toContain('**now**');
      expect(description).toContain('SkinColor');
    });
  });
});
