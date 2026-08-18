/**
 * The BUG-035 safe wrapper and the multipart follow-up builder.
 *
 * `safeEditOriginalResponse` exists because a deferred interaction that
 * never gets edited shows "application did not respond" forever. So its
 * contract is: never throw, always report the outcome, and log enough to
 * diagnose. Both the non-OK arm and the threw arm need the with-logger and
 * without-logger variants, since handlers call them both ways.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { editOriginalResponse, safeEditOriginalResponse, sendFollowUp } from './discord-api.js';

const silentLogger = () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });

describe('discord-api safe wrappers', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe.each([['safeEditOriginalResponse', safeEditOriginalResponse]] as const)(
    '%s',
    (_name, call) => {
      it('reports true when Discord accepts', async () => {
        expect(await call('app-id', 'token', { content: 'hi' })).toBe(true);
      });

      it('reports false and logs the status on a non-OK response', async () => {
        vi.mocked(fetch).mockResolvedValue(new Response('rate limited', { status: 429 }));
        const logger = silentLogger();

        expect(await call('app-id', 'token', { content: 'hi' }, logger as never)).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('failed'),
          undefined,
          expect.objectContaining({ status: 429 }),
        );
      });

      it('falls back to console on a non-OK response with no logger', async () => {
        vi.mocked(fetch).mockResolvedValue(new Response('nope', { status: 500 }));

        expect(await call('app-id', 'token', { content: 'hi' })).toBe(false);
        expect(consoleError).toHaveBeenCalled();
      });

      it('reports false and logs when the request throws', async () => {
        vi.mocked(fetch).mockRejectedValue(new Error('socket hang up'));
        const logger = silentLogger();

        expect(await call('app-id', 'token', { content: 'hi' }, logger as never)).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('threw'),
          expect.any(Error),
        );
      });

      it('falls back to console when the request throws with no logger', async () => {
        vi.mocked(fetch).mockRejectedValue(new Error('socket hang up'));

        expect(await call('app-id', 'token', { content: 'hi' })).toBe(false);
        expect(consoleError).toHaveBeenCalled();
      });

      it('passes a non-Error rejection through without crashing the logger', async () => {
        vi.mocked(fetch).mockRejectedValue('a bare string');
        const logger = silentLogger();

        expect(await call('app-id', 'token', { content: 'hi' }, logger as never)).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('threw'), undefined);
      });

      it('still reports false when reading the error body itself fails', async () => {
        const unreadable = new Response('x', { status: 500 });
        vi.spyOn(unreadable, 'text').mockRejectedValue(new Error('body already consumed'));
        vi.mocked(fetch).mockResolvedValue(unreadable);

        expect(await call('app-id', 'token', { content: 'hi' })).toBe(false);
      });
    },
  );
});

describe('follow-up payload construction', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const lastBody = () => vi.mocked(fetch).mock.calls[0][1] as RequestInit;

  it('sends JSON when there is no attachment', async () => {
    await sendFollowUp('app-id', 'token', { content: 'plain' });

    const init = lastBody();
    expect(String((init.headers as Record<string, string>)['Content-Type'])).toContain(
      'application/json',
    );
    expect(JSON.parse(init.body as string).content).toBe('plain');
  });

  it('marks an ephemeral follow-up with flag 64', async () => {
    await sendFollowUp('app-id', 'token', { content: 'secret', ephemeral: true });

    expect(JSON.parse(lastBody().body as string).flags).toBe(64);
  });

  it('sends multipart form data when a file is attached', async () => {
    await sendFollowUp('app-id', 'token', {
      content: 'with file',
      file: { name: 'card.png', data: new Uint8Array([1, 2, 3]), contentType: 'image/png' },
    });

    expect(lastBody().body).toBeInstanceOf(FormData);
  });

  it('rewrites the placeholder image URL to the real attachment name', async () => {
    await sendFollowUp('app-id', 'token', {
      embeds: [{ title: 'Card', image: { url: 'attachment://image.png' } }],
      file: { name: 'harmony.png', data: new Uint8Array([1]), contentType: 'image/png' },
    });

    const form = lastBody().body as FormData;
    const payload = JSON.parse(form.get('payload_json') as string);
    expect(payload.embeds[0].image.url).toBe('attachment://harmony.png');
    expect(payload.attachments[0].filename).toBe('harmony.png');
  });

  it('leaves an embed image alone when it is not the placeholder', async () => {
    await sendFollowUp('app-id', 'token', {
      embeds: [{ title: 'Card', image: { url: 'https://example.test/real.png' } }],
      file: { name: 'harmony.png', data: new Uint8Array([1]), contentType: 'image/png' },
    });

    const form = lastBody().body as FormData;
    const payload = JSON.parse(form.get('payload_json') as string);
    expect(payload.embeds[0].image.url).toBe('https://example.test/real.png');
  });

  it('carries components through the multipart path', async () => {
    await sendFollowUp('app-id', 'token', {
      components: [{ type: 1, components: [] }],
      file: { name: 'x.png', data: new Uint8Array([1]), contentType: 'image/png' },
    });

    const form = lastBody().body as FormData;
    expect(JSON.parse(form.get('payload_json') as string).components).toHaveLength(1);
  });

  it('omits content from the payload when none was given', async () => {
    await sendFollowUp('app-id', 'token', {
      file: { name: 'x.png', data: new Uint8Array([1]), contentType: 'image/png' },
    });

    const form = lastBody().body as FormData;
    expect(JSON.parse(form.get('payload_json') as string).content).toBeUndefined();
  });

  it('edits the original response via PATCH on the @original route', async () => {
    await editOriginalResponse('app-id', 'token', { content: 'edited' });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('/messages/@original');
    expect((init as RequestInit).method).toBe('PATCH');
  });
});
